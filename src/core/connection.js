/**
 * connection.js — WA connection, reconnect, session recovery
 *
 * Dipisah dari index.js agar index.js hanya jadi entry point tipis.
 *
 * Export:
 *   connectToWhatsApp()   — buat socket baru
 *   scheduleReconnect(id) — jadwalkan reconnect dengan backoff
 *   getSock()             — socket aktif saat ini
 */
'use strict';

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const chalk    = require('chalk');
const pino     = require('pino');

const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode,
} = require('@whiskeysockets/baileys');

const logger       = require('./logger.js');
const { smsg, getBuffer, getSizeMedia } = require('./message.js');
const MediaHandler = require('./media.js');
const store        = require('./store.js');
const { startScheduler, setSchedulerSock } = require('./scheduler.js');

const { useSQLiteAuthState, clearSignalKeys, deleteSession } = require('../lib/sqlite-session.js');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('../lib/exif.js');
const { forceJid }   = require('../lib/jid-utils.js');
const { config, init } = require('../../config.js');

const db = require('../lib/database.js');

const _pinoLogger = pino({ level: 'silent' });

/* ── State ───────────────────────────────────────────────────── */
let _sockId            = 0;
let _reconnects        = 0;
let _reconnectTimer    = null;
let _notifOnlineSentAt = 0;
let _jadibotResumed    = false;
let _signalErrCount    = 0;
let _lastSignalClear   = 0;
let _schedStarted      = false;

/* ── Group meta cache ────────────────────────────────────────── */
const _metaCache = new Map();
const META_TTL   = 5 * 60_000;

async function getGroupMeta(sock, jid) {
    const c = _metaCache.get(jid);
    if (c && Date.now() - c.ts < META_TTL) return c.data;
    const meta = await Promise.race([
        sock.groupMetadata(jid),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
    ]);
    _metaCache.set(jid, { data: meta, ts: Date.now() });
    return meta;
}

function cleanupMetaCache() {
    const now = Date.now();
    for (const [k, v] of _metaCache)
        if (now - v.ts > META_TTL * 2) _metaCache.delete(k);
}

/* ── Owner cache ─────────────────────────────────────────────── */
const _loadOwners = () => {
    const s = new Set((config.owner || []).map(n => String(n).replace(/[^0-9]/g, '')));
    try { db.getOwners().forEach(n => s.add(String(n).replace(/[^0-9]/g, ''))); } catch {}
    return s;
};
let _ownerNums = _loadOwners();
setInterval(() => { _ownerNums = _loadOwners(); }, 60_000);

/* ── Status store ────────────────────────────────────────────── */
const _statusStore          = new Map();
const STATUS_MAX_PER_SENDER = 50;
const STATUS_STORE_EXPIRE   = 24 * 60 * 60_000;

function _handleIncomingStatus(sock, mek) {
    try {
        const rawParticipant = mek.key?.participantAlt || mek.key?.participant || mek.key?.remoteJid || '';
        let resolvedJid = rawParticipant;

        if (rawParticipant.includes('@lid') || rawParticipant.includes('@s.lid')) {
            const resolved = forceJid(rawParticipant, [], sock);
            if (!resolved) return;
            resolvedJid = resolved;
        }

        const num = resolvedJid.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (!num || num.length < 8) return;

        const msg = mek.message;
        if (!msg) return;

        let type = null;
        if      (msg.imageMessage)                             type = 'image';
        else if (msg.videoMessage)                             type = 'video';
        else if (msg.audioMessage)                             type = 'audio';
        else if (msg.documentMessage)                          type = 'document';
        else if (msg.conversation || msg.extendedTextMessage)  type = 'text';
        if (!type) return;

        const entry = {
            id:          mek.key?.id || '',
            type,
            ts:          Date.now(),
            participant: resolvedJid,
            message:     msg,
            caption:     msg.imageMessage?.caption || msg.videoMessage?.caption || '',
            mimetype:    msg.imageMessage?.mimetype || msg.videoMessage?.mimetype
                         || msg.audioMessage?.mimetype || msg.documentMessage?.mimetype || '',
        };

        const list = _statusStore.get(num) || [];
        list.unshift(entry);
        if (list.length > STATUS_MAX_PER_SENDER) list.length = STATUS_MAX_PER_SENDER;
        _statusStore.set(num, list);

        try { sock.readMessages([mek.key]).catch(()=>{}); } catch {}

        if (global._swgcForward)
            global._swgcForward(sock, num, entry).catch(()=>{});

    } catch {}
}

// Bersihkan status lama setiap jam
setInterval(() => {
    const cutoff = Date.now() - STATUS_STORE_EXPIRE;
    for (const [num, list] of _statusStore) {
        const fresh = list.filter(s => s.ts > cutoff);
        if (!fresh.length) _statusStore.delete(num);
        else _statusStore.set(num, fresh);
    }
}, 60 * 60_000);

global._statusStore   = _statusStore;
global.clearSignalKeys = () => clearSignalKeys('session/main');

/* ── Pairing code ────────────────────────────────────────────── */
const question = q => new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a); });
});

/* ── Reconnect ───────────────────────────────────────────────── */
function scheduleReconnect(fromSockId) {
    if (fromSockId !== _sockId) return;
    if (_reconnectTimer !== null) return;

    _reconnects++;
    if (_reconnects > 15) { _reconnects = 1; }

    const delay = Math.min(3_000 * Math.pow(1.5, Math.min(_reconnects - 1, 8)), 30_000);
    logger.warn(`[RECONNECT] #${_reconnects} in ${(delay/1000).toFixed(1)}s...`);

    _reconnectTimer = setTimeout(() => {
        _reconnectTimer = null;
        if (fromSockId !== _sockId) return;
        connectToWhatsApp().catch(e => {
            logger.error('[RECONNECT] Error:', e.message);
            scheduleReconnect(_sockId);
        });
    }, delay);
}

/* ── Unwrap message ──────────────────────────────────────────── */
function unwrapMsg(msg) {
    for (const w of ['ephemeralMessage','viewOnceMessage','viewOnceMessageV2',
                     'documentWithCaptionMessage','editedMessage'])
        if (msg[w]) return msg[w].message || msg[w];
    return msg;
}

/* ════════════════════════════════════════════════════════════════
   MAIN CONNECT
   ════════════════════════════════════════════════════════════════ */
async function connectToWhatsApp() {
    const mySockId = ++_sockId;

    /* ── Load session ─────────────────────────────────────────── */
    let state, saveCreds;
    try {
        ({ state, saveCreds } = await useSQLiteAuthState('session/main'));
    } catch (e) {
        logger.error('[WA] Session load gagal:', e.message);
        setTimeout(() => scheduleReconnect(mySockId), 5_000);
        return;
    }

    /* ── Baileys version ──────────────────────────────────────── */
    let version;
    try {
        const r = await Promise.race([
            fetchLatestBaileysVersion(),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
        ]);
        version = r.version;
    } catch { version = [2, 3000, 1021356099]; }

    const usePairing = init.loginMethod !== 'qr';

    /* ── Make socket ──────────────────────────────────────────── */
    const manzxy = makeWASocket({
        version,
        logger:                         _pinoLogger,
        printQRInTerminal:              !usePairing,
        connectTimeoutMs:               0,
        defaultQueryTimeoutMs:          0,
        syncFullHistory:                false,
        markOnlineOnConnect:            true,
        keepAliveIntervalMs:            25_000,
        retryRequestDelayMs:            3_000,
        maxMsgRetryCount:               3,
        generateHighQualityLinkPreview: true,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, _pinoLogger),
        },
        patchMessageBeforeSending: msg => {
            if (msg.buttonsMessage || msg.templateMessage || msg.listMessage) {
                msg = { viewOnceMessage: { message: {
                    messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
                    ...msg,
                }}};
            }
            return msg;
        },
    });

    store.bind(manzxy.ev);
    manzxy.public  = true;
    manzxy._sockId = mySockId;

    global.mainSock   = manzxy;
    global._mainStore = store;

    setSchedulerSock(manzxy);

    /* ── Helpers ──────────────────────────────────────────────── */
    manzxy.decodeJid = jid => {
        if (!jid) return jid;
        if (/:\d+@/i.test(jid)) { const d = jidDecode(jid) || {}; return d.user ? `${d.user}@${d.server}` : jid; }
        return jid;
    };

    const media = new MediaHandler(manzxy, { getBuffer, getSizeMedia });
    manzxy.media = media;

    manzxy.getFile                     = (p, s) => media.getFile(p, s);
    manzxy.downloadMediaMessage        = m  => media.downloadMediaMessage(m);
    manzxy.downloadAndSaveMediaMessage = (m, f, e) => media.downloadAndSaveMediaMessage(m, f, e);
    manzxy.sendText  = (jid, text, q='', opts={}) => manzxy.sendMessage(jid, { text, ...opts }, { quoted: q });
    manzxy.sendPoll  = (jid, q, opts, quoted='', n=1) => manzxy.sendMessage(jid, { poll: { name: q, values: opts, selectableCount: n } }, { quoted });

    manzxy.sendImageAsSticker = async (jid, p, quoted, opts={}) => {
        let b = Buffer.isBuffer(p) ? p : /^data:/.test(p) ? Buffer.from(p.split`,`[1],'base64')
            : /^https?:/.test(p) ? await getBuffer(p) : fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
        const buf = (opts.packname||opts.author) ? await writeExifImg(b,opts) : await imageToWebp(b);
        await manzxy.sendMessage(jid, { sticker: buf, ...opts }, { quoted });
        return buf;
    };
    manzxy.sendVideoAsSticker = async (jid, p, quoted, opts={}) => {
        let b = Buffer.isBuffer(p) ? p : /^data:/.test(p) ? Buffer.from(p.split`,`[1],'base64')
            : /^https?:/.test(p) ? await getBuffer(p) : fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(0);
        const buf = (opts.packname||opts.author) ? await writeExifVid(b,opts) : await videoToWebp(b);
        await manzxy.sendMessage(jid, { sticker: buf, ...opts }, { quoted });
        return buf;
    };
    manzxy.sendMedia = async (jid, p, cap='', quoted='', opts={}) => {
        const { mime, data } = await manzxy.getFile(p, true);
        const type = mime.split('/')[0];
        const cnt  = type==='image' ? {image:data,caption:cap,...opts}
            : type==='video' ? {video:data,caption:cap,...opts}
            : type==='audio' ? {audio:data,ptt:opts.ptt||false,...opts}
            : {document:data,mimetype:mime,fileName:opts.fileName||'file',...opts};
        await manzxy.sendMessage(jid, cnt, { quoted });
    };

    /* ── Login (first time) ───────────────────────────────────── */
    if (!manzxy.authState.creds.registered) {
        if (usePairing) {
            const phone = await question(chalk.blue('\n[LOGIN] Nomor HP (628xxx):\n> '));
            const code  = await manzxy.requestPairingCode(phone.trim(), init.customPair);
            logger.success(`[LOGIN] Pairing code: ${code}`);
        } else {
            logger.info('[WA] Menunggu QR scan...');
        }
    }

    /* ── Welcome / Leave ──────────────────────────────────────── */
    manzxy.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (mySockId !== _sockId) return;
        try {
            if (action === 'promote' || action === 'demote') return;
            const gd = db.getGroup(id);
            if (!gd?.welcome) return;
            const meta = await getGroupMeta(manzxy, id).catch(() => null);
            if (!meta) return;
            const groupName = meta.subject || 'Grup';
            const groupDesc = meta.desc    || '';
            const memCount  = meta.participants?.length || 0;

            for (const p of participants) {
                const _rawP = typeof p === 'object' ? (p.id || String(p)) : String(p);
                let jid = forceJid(_rawP, [], manzxy) || _rawP;
                if (typeof p === 'object' && p.phoneNumber && !jid.includes('@s.whatsapp.net'))
                    jid = p.phoneNumber.replace(/[^0-9]/g,'') + '@s.whatsapp.net';

                const num  = jid.split(':')[0].split('@')[0];
                const full = `${num}@s.whatsapp.net`;

                // Foto profil — fallback ke default
                let pp = config.thumbnail || 'https://telegra.ph/file/241d7169c11e03445940f.png';
                try { pp = await manzxy.profilePictureUrl(full, 'image'); } catch {}

                let uname = num;
                try {
                    const ct = store.contacts?.[full];
                    uname = ct?.notify || ct?.name || ct?.verifiedName || num;
                } catch {}

                const replace = t => (t||'')
                    .replace(/@user/g,  `@${num}`)
                    .replace(/@group/g, groupName)
                    .replace(/@desc/g,  groupDesc)
                    .replace(/@count/g, memCount)
                    .replace(/@name/g,  uname);

                const isAdd = action === 'add';
                const text  = replace(isAdd
                    ? (gd.welcomeMessage || 'Halo @user, selamat datang di @group! 👋\n📊 Member ke-@count')
                    : (gd.leaveMessage   || 'Selamat tinggal @user dari @group. 👋'));

                await manzxy.sendMessage(id, {
                    text,
                    contextInfo: { mentionedJid: [full], externalAdReply: {
                        title:                 isAdd ? 'W E L C O M E' : 'G O O D B Y E',
                        body:                  groupName,
                        thumbnailUrl:          pp,
                        mediaType:             1,
                        renderLargerThumbnail: true,
                        sourceUrl:             'https://whatsapp.com',
                    }},
                }).catch(()=>{});
            }
        } catch (e) { logger.warn('[WELCOME]', e.message); }
    });

    /* ── Messages ─────────────────────────────────────────────── */
    manzxy.ev.on('messages.upsert', async chatUpdate => {
        if (mySockId !== _sockId) return;
        try {
            const mek = chatUpdate.messages[0];
            if (!mek?.message) return;
            mek.message = unwrapMsg(mek.message);
            const jid = mek.key?.remoteJid;

            if (jid === 'status@broadcast') {
                _handleIncomingStatus(manzxy, mek);
                return;
            }

            const _isChannel = jid?.endsWith('@newsletter');
            if (_isChannel) {
                const _body = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '';
                const _hasCmd = Array.isArray(config?.prefa)
                    ? config.prefa.some(p => _body.startsWith(p))
                    : (config?.prefa && _body.startsWith(config?.prefa));
                if (!_hasCmd) return;
            }

            if (mek.key?.id?.startsWith('BAE5') && mek.key.id.length === 16) return;

            if (!manzxy.public && !mek.key?.fromMe && chatUpdate.type === 'notify') {
                const isGrp = (jid || '').endsWith('@g.us');
                const raw   = isGrp ? (mek.key?.participantAlt || mek.key?.participant || '') : (jid || '');
                const num   = raw.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                if (num.length < 10 || num.length > 15 || !_ownerNums.has(num)) return;
            }

            let m;
            try {
                const { smsg } = require('./message.js');
                m = smsg(manzxy, mek, store);
            } catch (e) {
                logger.warn('[MSG] smsg() error:', e.message);
                return;
            }
            if (!m) return;
            if (m.isGroup) db.getGroup(m.chat);
            if (m.sender)  db.getUser(m.sender);

            if (mek.key?.participant?.includes('@lid') && mek.key.participantAlt?.includes('@s.whatsapp.net'))
                global._lidToJidMap[mek.key.participant] = mek.key.participantAlt;
            if (m.sender?.includes('@lid')) m.sender = '';

            if (m.fromMe) {
                const hasPrefix = Array.isArray(config?.prefa)
                    ? config.prefa.some(p => (m.body || '').startsWith(p))
                    : (config?.prefa && (m.body || '').startsWith(config.prefa));
                const isEval = /^(>|=>|\$)/.test(m.body || '');
                if (!hasPrefix && !isEval) return;
            }

            require('../../manzxy.js')(manzxy, m, chatUpdate, store)
                .catch(e => logger.error('[HANDLER]', e.message));

        } catch (e) {
            _handleMsgError(e, manzxy, mySockId);
        }
    });

    /* ── connection.update ────────────────────────────────────── */
    manzxy.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (mySockId !== _sockId) return;

        if (qr) {
            logger.info('[WA] Scan QR:');
            try { require('qrcode-terminal').generate(qr, { small: true }); } catch { console.log(qr); }
        }

        if (connection === 'close') {
            const code   = lastDisconnect?.error?.output?.statusCode;
            const errMsg = lastDisconnect?.error?.message || '';
            logger.warn(`[WA] Disconnect — code: ${code}${errMsg ? ' | ' + errMsg : ''}`);

            try { manzxy.ev.removeAllListeners(); } catch {}
            try { manzxy.ws?.close?.(); } catch {}

            if (code === DisconnectReason.loggedOut || code === 403) {
                logger.error(`[WA] Logged out (${code}) — hapus session, minta login ulang...`);
                try { deleteSession('session/main'); } catch {}
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 5_000);
                return;
            }
            if (code === 440) {
                logger.warn('[WA] Multidevice conflict — tunggu 15s...');
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 15_000);
                return;
            }
            if (code === 515) {
                logger.warn('[WA] WA server restart (515) — tunggu 10s...');
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 10_000);
                return;
            }
            scheduleReconnect(mySockId);

        } else if (connection === 'connecting') {
            logger.info('[WA] Menghubungkan...');

        } else if (connection === 'open') {
            _reconnects     = 0;
            _signalErrCount = 0;
            if (_reconnectTimer !== null) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }

            setSchedulerSock(manzxy);
            global.mainSock = manzxy;

            const num  = (manzxy.user?.id || '').split(':')[0].split('@')[0] || '?';
            const name = manzxy.user?.name || config.nameBot || 'Bot';
            logger.success(`[WA] Online! +${num} (${name})`);

            if (!_schedStarted) { _schedStarted = true; startScheduler(manzxy); }

            // Notif online — hanya sekali per proses
            if (!_notifOnlineSentAt) {
                _notifOnlineSentAt = Date.now();
                setTimeout(async () => {
                    if (mySockId !== _sockId) return;
                    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
                    const tgl = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    const msg = `✅ *BOT ONLINE*\n\n🤖 ${name}  •  +${num}\n📅 ${tgl}\n💾 RAM: ${ram} MB`;
                    const owners = new Set([...(config.owner||[])]);
                    try { db.getOwners().forEach(n => owners.add(n)); } catch {}
                    for (const o of owners) {
                        const n = String(o).replace(/[^0-9]/g,'');
                        if (n) await manzxy.sendMessage(n+'@s.whatsapp.net', { text: msg }).catch(()=>{});
                    }
                }, 3000);
            }

            // Auto-resume jadibot — hanya sekali
            if (!_jadibotResumed) {
                _jadibotResumed = true;
                setTimeout(async () => {
                    if (mySockId !== _sockId) return;
                    try { await global.autoResumeJadibots?.(); }
                    catch (e) { logger.error('[JB RESUME]', e.message); }
                }, 6000);
            }
        }
    });

    manzxy.ev.on('error', e => {
        if (mySockId !== _sockId) return;
        logger.warn('[WA] Socket error: ' + (e?.message || e));
    });

    manzxy.ev.on('creds.update', () => {
        if (mySockId !== _sockId) return;
        saveCreds();
    });
}

/* ── Handle message decrypt errors ──────────────────────────── */
function _handleMsgError(e, manzxy, mySockId) {
    const eMsg = e.message || '';

    if (eMsg.includes('closed session') || eMsg.includes('No matching session')) return;

    if (
        eMsg.includes('MessageCounterError') ||
        eMsg.includes('Key used already or never filled') ||
        eMsg.includes('decryptWithSession') ||
        eMsg.includes('Bad MAC') ||
        eMsg.includes('decrypt failed') ||
        eMsg.includes('Session not found') ||
        eMsg.includes('Invalid session')
    ) {
        _signalErrCount++;
        const now = Date.now();
        if (_signalErrCount <= 5 && now - _lastSignalClear > 60_000) {
            _lastSignalClear = now;
            logger.warn(`[SESSION] Signal key corrupt #${_signalErrCount} — auto clear & reconnect...`);
            try {
                const ok = clearSignalKeys('session/main');
                if (ok) logger.success('[SESSION] Signal keys cleared OK');
            } catch (ce) { logger.error('[SESSION] clearSignalKeys error:', ce.message); }
            try { manzxy.ev.removeAllListeners(); } catch {}
            try { manzxy.ws?.close?.(); } catch {}
            setTimeout(() => scheduleReconnect(mySockId), 2_000);
        } else if (_signalErrCount > 5) {
            logger.error('[SESSION] Signal error >5x berturut — jalankan .clearkeys dari bot!');
        } else {
            logger.warn('[SESSION] Signal error (throttled):', eMsg.slice(0, 80));
        }
        return;
    }

    logger.error('[MSG UPSERT]', eMsg);
}

/* ── Exports ─────────────────────────────────────────────────── */
function getSock()         { return global.mainSock || null; }
function getMetaCache()    { return _metaCache; }
function cleanMeta()       { cleanupMetaCache(); }
function getOwnerNums()    { return _ownerNums; }

module.exports = { connectToWhatsApp, scheduleReconnect, getSock, getMetaCache, cleanMeta, getOwnerNums };
