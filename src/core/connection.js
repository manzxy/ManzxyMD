/**
 * connection.js v2.2 — WA Connection Manager
 *
 * Fix utama v2.2:
 *   - Circuit breaker: pause 3 menit jika gagal ≥5x / 2 menit
 *   - _closeHandled flag: WS close + connection.update tidak double-reconnect
 *   - _reconnecting guard: tidak ada dua proses reconnect jalan barengan
 *   - _cleanupSock(): cleanup terpusat, bukan tersebar di setiap handler
 *   - Heartbeat 10 menit / threshold 3x / delay start 60s — tidak false positive
 *   - Bad MAC level 0: cukup clear keys, tidak reconnect
 *   - Backoff maks 60s, counter tidak reset
 *   - Kode 440: tunggu 30s, kode 515: 15s, kode 408/503: 20s
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

const { useSQLiteAuthState, clearSignalKeys, deleteSession, validateSession, repairSession } = require('../lib/sqlite-session.js');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('../lib/exif.js');
const { forceJid }   = require('../lib/jid-utils.js');
const { config, init } = require('../../config.js');
const db = require('../lib/database.js');

const _pinoLogger = pino({ level: 'silent' });

/* ── Socket state ────────────────────────────────────────────── */
let _sockId            = 0;
let _reconnects        = 0;      // naik terus, tidak reset — backoff makin panjang
let _reconnectTimer    = null;
let _reconnecting      = false;  // guard: tidak ada dua reconnect barengan
let _notifOnlineSentAt = 0;
let _jadibotResumed    = false;
let _schedStarted      = false;

/* ── Circuit breaker ─────────────────────────────────────────── */
// Jika gagal reconnect terlalu sering → pause agar tidak spam server WA
let _cbFailCount  = 0;
let _cbWindowTs   = 0;
let _cbTripped    = false;
let _cbResetTimer = null;

const CB_WINDOW    = 2 * 60_000;  // window 2 menit
const CB_LIMIT     = 5;           // trip jika gagal ≥5x dalam window
const CB_COOLDOWN  = 3 * 60_000;  // saat trip: pause 3 menit

function _cbTick() {
    const now = Date.now();
    if (now - _cbWindowTs > CB_WINDOW) { _cbWindowTs = now; _cbFailCount = 0; }
    _cbFailCount++;
    if (!_cbTripped && _cbFailCount >= CB_LIMIT) {
        _cbTripped = true;
        logger.warn(`[CB] Circuit breaker TRIP — ${_cbFailCount}x gagal. Pause ${CB_COOLDOWN/1000}s...`);
        if (_cbResetTimer) clearTimeout(_cbResetTimer);
        _cbResetTimer = setTimeout(() => {
            _cbTripped = false; _cbFailCount = 0; _cbWindowTs = 0;
            if (_cbResetTimer) { clearTimeout(_cbResetTimer); _cbResetTimer = null; }
            logger.info('[CB] Circuit breaker RESET — siap reconnect lagi');
        }, CB_COOLDOWN);
    }
}

function _cbReset() {
    _cbFailCount = 0; _cbTripped = false; _cbWindowTs = 0;
    if (_cbResetTimer) { clearTimeout(_cbResetTimer); _cbResetTimer = null; }
}

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
setInterval(() => { _ownerNums = _loadOwners(); }, 120_000);

/* ── Status store ────────────────────────────────────────────── */
const _statusStore          = new Map();
const STATUS_MAX_PER_SENDER = 20;
const STATUS_STORE_EXPIRE   = 6 * 60 * 60_000;

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
        if (global._swgcForward) global._swgcForward(sock, num, entry).catch(()=>{});
    } catch {}
}

setInterval(() => {
    const cutoff = Date.now() - STATUS_STORE_EXPIRE;
    for (const [num, list] of _statusStore) {
        const fresh = list.filter(s => s.ts > cutoff);
        if (!fresh.length) _statusStore.delete(num);
        else _statusStore.set(num, fresh);
    }
}, 2 * 60 * 60_000);

global._statusStore    = _statusStore;
global.clearSignalKeys = () => clearSignalKeys('session/main');

/* ── Pairing ─────────────────────────────────────────────────── */
const question = q => new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a); });
});

/* ── Cleanup socket ──────────────────────────────────────────── */
// Semua cleanup lewat sini — tidak ada removeAllListeners/ws.close tersebar
function _cleanupSock(sock) {
    if (!sock) return;
    try {
        if (sock._heartbeatTimer) {
            clearInterval(sock._heartbeatTimer);
            sock._heartbeatTimer = null;
        }
    } catch {}
    try { sock.ev.removeAllListeners(); } catch {}
    // Delay kecil agar tidak race dengan event yang masih diproses
    setTimeout(() => { try { sock.ws?.close?.(); } catch {} }, 300);
}

/* ── Reconnect scheduler ─────────────────────────────────────── */
function scheduleReconnect(fromSockId) {
    if (fromSockId !== _sockId) return;   // socket sudah bukan yang aktif
    if (_reconnectTimer !== null) return;  // sudah ada timer pending
    if (_reconnecting) return;             // sedang proses reconnect
    if (_cbTripped) {
        logger.warn('[RECONNECT] Circuit breaker aktif — tunggu reset...');
        return;
    }

    _cbTick();

    // Counter tidak pernah reset → backoff makin lama makin panjang
    _reconnects = Math.min(_reconnects + 1, 12);
    const delay = Math.min(3_000 * Math.pow(1.6, _reconnects - 1), 60_000);
    logger.warn(`[RECONNECT] #${_reconnects} — retry dalam ${(delay/1000).toFixed(1)}s`);

    _reconnectTimer = setTimeout(async () => {
        _reconnectTimer = null;
        if (fromSockId !== _sockId) return;
        if (_cbTripped) { logger.warn('[RECONNECT] CB trip saat timer — skip'); return; }
        _reconnecting = true;
        try {
            await connectToWhatsApp();
        } catch (e) {
            logger.error('[RECONNECT] Gagal:', e.message);
            _reconnecting = false;
            scheduleReconnect(_sockId);
        }
        _reconnecting = false;
    }, delay);
}

/* ── Unwrap nested message ───────────────────────────────────── */
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

    /* ── Session pre-check ────────────────────────────────────── */
    const _sv = validateSession('session/main');
    if (!_sv.valid) {
        logger.warn(`[SESSION] Pre-check: invalid (${_sv.reason}) — repair level 0`);
        repairSession('session/main', 0);
    } else {
        logger.info(`[SESSION] Pre-check OK | ${_sv.me} | keys: ${_sv.keyCount}`);
    }

    let state, saveCreds;
    try {
        ({ state, saveCreds } = await useSQLiteAuthState('session/main'));
    } catch (e) {
        logger.error('[WA] Session load gagal:', e.message);
        setTimeout(() => scheduleReconnect(mySockId), 8_000);
        return;
    }

    /* ── Baileys version ──────────────────────────────────────── */
    let version;
    try {
        const r = await Promise.race([
            fetchLatestBaileysVersion(),
            new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000)),
        ]);
        version = r.version;
    } catch { version = [2, 3000, 1021356099]; }

    const usePairing = init.loginMethod !== 'qr';

    /* ── Make socket ──────────────────────────────────────────── */
    const manzxy = makeWASocket({
        version,
        logger:                         _pinoLogger,
        printQRInTerminal:              !usePairing,
        browser:                        ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs:               60_000,   // 60s — VPS lambat perlu lebih lama
        defaultQueryTimeoutMs:          20_000,   // 20s — toleran
        syncFullHistory:                false,
        markOnlineOnConnect:            false,    // hemat, tidak broadcast online
        keepAliveIntervalMs:            45_000,   // 45s — tidak spam ping
        retryRequestDelayMs:            3_000,
        maxMsgRetryCount:               2,        // 2x — cepat give up decrypt error
        generateHighQualityLinkPreview: false,
        getMessage: async (key) => {
            const jid = key.remoteJid;
            if (jid && store.messages?.[jid]) {
                const found = (store.messages[jid].array || store.messages[jid])
                    .find?.(m => m.key?.id === key.id);
                if (found?.message) return found.message;
            }
            return { conversation: '' };
        },
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, _pinoLogger),
        },
        patchMessageBeforeSending: msg => {
            const hasMsgType =
                msg.buttonsMessage     ||
                msg.listMessage        ||
                msg.templateMessage    ||
                msg.interactiveMessage ||
                msg.buttonsResponseMessage;
            if (hasMsgType) {
                msg.messageContextInfo = { deviceListMetadata: {}, deviceListMetadataVersion: 2 };
            }
            if (msg.interactiveMessage) {
                msg.interactiveMessage.header  = msg.interactiveMessage.header  || { hasMediaAttachment: false };
                msg.interactiveMessage.body    = msg.interactiveMessage.body    || { text: '' };
                msg.interactiveMessage.footer  = msg.interactiveMessage.footer  || { text: '' };
            }
            return msg;
        },
    });

    store.bind(manzxy.ev);

    if (global._botPublic === undefined) global._botPublic = !config.selfMode;
    manzxy.public  = global._botPublic;
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

    manzxy.sendButtons = async (jid, text, buttons = [], footer = '', type = 'button', quoted = null) => {
        const ctx = quoted ? { quoted } : {};
        try {
            if (type === 'list') {
                return await manzxy.sendMessage(jid, {
                    listMessage: { title: text, description: footer, buttonText: '☰ Pilih', sections: buttons, listType: 1 }
                }, ctx);
            }
            if (type === 'template') {
                return await manzxy.sendMessage(jid, {
                    templateMessage: {
                        hydratedTemplate: {
                            hydratedContentText: text,
                            hydratedFooterText:  footer,
                            hydratedButtons: buttons.map(b => ({
                                index: b.index || 0,
                                quickReplyButton: { displayText: b.text, id: b.id },
                            })),
                        }
                    }
                }, ctx);
            }
            return await manzxy.sendMessage(jid, {
                text, footer,
                buttons: buttons.map((b, i) => ({
                    buttonId:   b.id || String(i),
                    buttonText: { displayText: b.text || b.title || String(i+1) },
                    type: 1,
                })),
                headerType: 1,
            }, ctx);
        } catch {
            const opts = buttons.map((b, i) => `${i+1}. ${b.text || b.title}`).join('\n');
            return await manzxy.sendMessage(jid, {
                text: `${text}\n\n${opts}${footer ? '\n\n' + footer : ''}`
            }, ctx);
        }
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
            const phone = await question(chalk.hex('#a855f7')('\n[LOGIN] Masukkan nomor HP (628xxx):\n> '));
            const code  = await manzxy.requestPairingCode(phone.trim(), init.customPair);
            logger.success(`[LOGIN] Pairing code: ${chalk.bold(code)}`);
        } else {
            logger.info('[WA] Menunggu scan QR...');
        }
    }

    /* ── Group participants update ────────────────────────────── */
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

                let pp = config.thumbnail || 'https://telegra.ph/file/241d7169c11e03445940f.png';
                try { pp = await manzxy.profilePictureUrl(full, 'image'); } catch {}

                let uname = num;
                try {
                    const ct = store.contacts?.[full];
                    uname = ct?.notify || ct?.name || ct?.verifiedName || num;
                } catch {}

                const _now  = new Date();
                const _date = _now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });
                const _time = _now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' });
                const replace = t => (t||'')
                    .replace(/@user/g,  `@${num}`)
                    .replace(/@group/g, groupName)
                    .replace(/@desc/g,  groupDesc)
                    .replace(/@count/g, String(memCount))
                    .replace(/@name/g,  uname)
                    .replace(/@date/g,  _date)
                    .replace(/@time/g,  _time);

                const isAdd = action === 'add';
                if (!isAdd && gd.leaveEnabled === false) continue;
                if (isAdd  && !gd.welcome) continue;

                const text = replace(isAdd
                    ? (gd.welcomeMessage || [
                        '┌─────────────────────┐',
                        '│   👋  SELAMAT DATANG  │',
                        '└─────────────────────┘',
                        '',
                        '🎉 Halo @name!',
                        'Selamat bergabung di *@group*',
                        '',
                        '👥 Member ke-*@count*',
                        '📅 @date pukul @time WIB',
                      ].join('\n'))
                    : (gd.leaveMessage || gd.leaveEnabled === false ? null : [
                        '┌──────────────────────┐',
                        '│   👋  SAMPAI JUMPA    │',
                        '└──────────────────────┘',
                        '',
                        '*@name* telah meninggalkan grup.',
                        '',
                        '_Semoga jumpa lagi! 🙏_',
                      ].join('\n')));

                if (pp && pp !== (config.thumbnail || '')) {
                    await manzxy.sendMessage(id, {
                        image: { url: pp },
                        caption: text,
                        contextInfo: {
                            mentionedJid: [full],
                            externalAdReply: {
                                title: isAdd ? '👋 WELCOME' : '👋 GOODBYE',
                                body:  groupName,
                                thumbnailUrl: pp,
                                mediaType: 1,
                                renderLargerThumbnail: true,
                                sourceUrl: 'https://whatsapp.com',
                            },
                        },
                    }).catch(() => manzxy.sendMessage(id, { text, mentions: [full] }).catch(()=>{}));
                } else {
                    await manzxy.sendMessage(id, {
                        text,
                        mentions: [full],
                        contextInfo: { mentionedJid: [full] },
                    }).catch(()=>{});
                }
            }
        } catch (e) { logger.warn('[WELCOME]', e.message); }
    });

    /* ── Messages upsert ──────────────────────────────────────── */
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
    let _closeHandled = false; // FIX: guard agar WS close + connection.update tidak double-reconnect

    manzxy.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (mySockId !== _sockId) return;

        if (qr) {
            logger.info('[WA] Scan QR di bawah:');
            try { require('qrcode-terminal').generate(qr, { small: true }); } catch { console.log(qr); }
        }

        if (connection === 'close') {
            if (_closeHandled) return;  // FIX: sudah ditangani, skip
            _closeHandled = true;

            const code   = lastDisconnect?.error?.output?.statusCode;
            const errMsg = lastDisconnect?.error?.message || '';
            logger.warn(`[WA] Terputus — kode: ${code}${errMsg ? ' | ' + errMsg : ''}`);

            _cleanupSock(manzxy);

            // Logged out / banned — hapus session, tunggu login ulang
            if (code === DisconnectReason.loggedOut || code === 403) {
                logger.error(`[WA] Logged out (${code}) — session dihapus, tunggu pairing ulang`);
                try { deleteSession('session/main'); } catch {}
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 10_000);
                return;
            }
            // Multidevice conflict — ada instance lain, tunggu lebih lama
            if (code === 440) {
                logger.warn('[WA] Multidevice conflict (440) — tunggu 30s...');
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 30_000);
                return;
            }
            // WA server restart
            if (code === 515) {
                logger.warn('[WA] WA restart (515) — tunggu 15s...');
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 15_000);
                return;
            }
            // Timeout / service unavailable
            if (code === 408 || code === 503) {
                logger.warn(`[WA] Server unavailable (${code}) — tunggu 20s...`);
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 20_000);
                return;
            }

            scheduleReconnect(mySockId);

        } else if (connection === 'connecting') {
            _closeHandled = false; // reset flag saat koneksi ulang dimulai
            logger.info('[WA] Menghubungkan ke server WA...');

        } else if (connection === 'open') {
            // Berhasil terhubung — reset semua counter & CB
            _reconnects = 0;
            _reconnecting = false;
            _cbReset();
            if (_reconnectTimer !== null) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }

            manzxy.public = (global._botPublic !== undefined) ? global._botPublic : !config.selfMode;
            setSchedulerSock(manzxy);
            global.mainSock = manzxy;

            const num  = (manzxy.user?.id || '').split(':')[0].split('@')[0] || '?';
            const name = manzxy.user?.name || config.nameBot || 'Bot';
            logger.success(`[WA] Terhubung! +${num} (${name})`);

            if (!_schedStarted) { _schedStarted = true; startScheduler(manzxy); }

            /* ── Heartbeat ──────────────────────────────────────
             * Cek WS readyState setiap 10 menit.
             * Threshold 3x (bukan 2x) — toleran terhadap transient disconnect.
             * Delay start 60s — WS pasti sudah stabil saat heartbeat pertama.
             */
            if (manzxy._heartbeatTimer) { clearInterval(manzxy._heartbeatTimer); manzxy._heartbeatTimer = null; }
            let _hbFails = 0;
            const _startHb = () => {
                if (manzxy._heartbeatTimer) return;
                manzxy._heartbeatTimer = setInterval(() => {
                    if (mySockId !== _sockId) {
                        clearInterval(manzxy._heartbeatTimer);
                        manzxy._heartbeatTimer = null;
                        return;
                    }
                    try {
                        const ws = manzxy.ws;
                        if (!ws || typeof ws.readyState === 'undefined') return; // WS belum siap
                        if (ws.readyState === 1 /* OPEN */) { _hbFails = 0; return; }
                        _hbFails++;
                        logger.warn(`[WA] Heartbeat: WS state=${ws.readyState} (gagal ${_hbFails}/3)`);
                        if (_hbFails >= 3) {
                            logger.warn('[WA] Koneksi zombie — cleanup & reconnect...');
                            clearInterval(manzxy._heartbeatTimer);
                            manzxy._heartbeatTimer = null;
                            _cleanupSock(manzxy);
                            scheduleReconnect(mySockId);
                        }
                    } catch (he) { logger.warn('[WA] Heartbeat error:', he?.message || he); }
                }, 10 * 60_000);
            };
            setTimeout(_startHb, 60_000); // mulai setelah 60s

            /* ── Notif online — hanya sekali per proses ─────── */
            if (!_notifOnlineSentAt) {
                _notifOnlineSentAt = Date.now();
                setTimeout(async () => {
                    if (mySockId !== _sockId) return;
                    const mem  = process.memoryUsage();
                    const ram  = (mem.rss / 1024 / 1024).toFixed(1);
                    const heap = (mem.heapUsed / 1024 / 1024).toFixed(1);
                    const tgl  = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    const mode = manzxy.public ? '🌐 Public' : '🔒 Self';
                    const sv   = validateSession('session/main');
                    const keyInfo = sv.valid ? `✅ OK (${sv.keyCount} keys)` : `⚠️ ${sv.reason}`;

                    const msg = [
                        '╔══════════════════════╗',
                        '║   ✅  BOT ONLINE  ✅   ║',
                        '╚══════════════════════╝',
                        '',
                        `🤖 *${name}*`,
                        `📞 +${num}`,
                        '',
                        '─────────────────────',
                        `📅 ${tgl}`,
                        `💾 RAM   : ${ram} MB  (heap ${heap} MB)`,
                        `🔑 Sesi  : ${keyInfo}`,
                        `⚙️  Mode  : ${mode}`,
                        `🟢 Node  : ${process.version}`,
                        `📦 Versi : v${config.version || '2.1'}`,
                        '─────────────────────',
                        '',
                        '📌 *Quick Commands:*',
                        '  .ping      — cek status & latency',
                        '  .runtime   — info RAM & uptime',
                        '  .totalfitur — lihat semua fitur',
                        '  .self/.public — ganti mode',
                        '  .clearkeys — fix Bad MAC',
                        '',
                        '_Ketik .menu untuk daftar lengkap_',
                    ].join('\n');

                    const owners = new Set([...(config.owner||[])]);
                    try { db.getOwners().forEach(n => owners.add(n)); } catch {}
                    for (const o of owners) {
                        const n = String(o).replace(/[^0-9]/g,'');
                        if (n) await manzxy.sendMessage(n+'@s.whatsapp.net', { text: msg }).catch(()=>{});
                    }
                }, 3000);
            }

            /* ── Auto-resume jadibot — hanya sekali ─────────── */
            if (!_jadibotResumed) {
                _jadibotResumed = true;
                setTimeout(async () => {
                    if (mySockId !== _sockId) return;
                    try { await global.autoResumeJadibots?.(); }
                    catch (e) { logger.error('[JB RESUME]', e.message); }
                }, 8000);
            }
        }
    });

    /* ── Socket error ─────────────────────────────────────────── */
    // Hanya reconnect untuk stream error yang benar-benar fatal
    // Non-fatal (ENOTFOUND sementara, dll) — log saja
    manzxy.ev.on('error', e => {
        if (mySockId !== _sockId) return;
        const msg = e?.message || String(e);
        logger.warn('[WA] Socket error: ' + msg);

        const isFatal =
            msg.includes('stream errored') ||
            msg.includes('ECONNRESET')     ||
            msg.includes('ECONNREFUSED')   ||
            msg.includes('ETIMEDOUT')      ||
            msg.includes('write EPIPE');

        if (isFatal) {
            logger.warn('[WA] Stream error fatal — cleanup & reconnect...');
            _cleanupSock(manzxy);
            setTimeout(() => {
                if (mySockId === _sockId) scheduleReconnect(mySockId);
            }, 5_000);
        }
    });

    /* ── WS events — hanya log, reconnect diserahkan ke ev('error') ── */
    // PENTING: jangan schedule reconnect di sini — sudah ada di connection.update
    // Double-trigger dari sini adalah sumber utama reconnect storm
    try {
        manzxy.ws?.on('close', (code, reason) => {
            if (mySockId !== _sockId) return;
            logger.warn(`[WA] WS close — code: ${code} | ${reason?.toString?.() || ''}`);
        });
        manzxy.ws?.on('error', err => {
            if (mySockId !== _sockId) return;
            logger.warn('[WA] WS error: ' + (err?.message || err));
        });
    } catch {}

    /* ── Creds update ─────────────────────────────────────────── */
    manzxy.ev.on('creds.update', () => {
        if (mySockId !== _sockId) return;
        saveCreds();
    });

    /* ── Anti-ban: throttle sendMessage ───────────────────────── */
    if (config.antiBan && !manzxy._antiBanWrapped) {
        manzxy._antiBanWrapped = true;
        const _origSend = manzxy.sendMessage.bind(manzxy);
        let _lastSendAt = 0;
        manzxy.sendMessage = async (...args) => {
            const delay = config.antiBanDelay || 800;
            const now   = Date.now();
            const wait  = delay - (now - _lastSendAt);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            _lastSendAt = Date.now();
            return _origSend(...args);
        };
    }

    /* ── Auto-read ────────────────────────────────────────────── */
    if (config.autoRead) {
        manzxy.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (!msg.key?.remoteJid || msg.key?.fromMe) continue;
                try { await manzxy.readMessages([msg.key]); } catch {}
            }
        });
    }
}

/* ══════════════════════════════════════════════════════════════
   BAD SESSION / DECRYPT ERROR HANDLER
   Eskalasi: level 0 → clear signal keys (tidak reconnect)
             level 1 → clear semua kecuali creds + reconnect
             level 2 → delete session + alert owner
   ══════════════════════════════════════════════════════════════ */
let _badMacLevel    = 0;
let _badMacCount    = 0;
let _badMacWindowTs = 0;
let _badMacCooldown = 0;

function _handleMsgError(e, manzxy, mySockId) {
    const eMsg = e?.message || String(e);

    // Error normal — skip
    if (
        eMsg.includes('closed session')     ||
        eMsg.includes('No matching session') ||
        eMsg.includes('Connection Closed')   ||
        eMsg.includes('Stream Errored')
    ) return;

    const isBadSession =
        eMsg.includes('MessageCounterError')           ||
        eMsg.includes('Key used already or never filled') ||
        eMsg.includes('decryptWithSession')            ||
        eMsg.includes('Bad MAC')                       ||
        eMsg.includes('decrypt failed')                ||
        eMsg.includes('Session not found')             ||
        eMsg.includes('Invalid session');

    if (isBadSession) {
        const now = Date.now();

        // Reset window tiap 5 menit
        if (now - _badMacWindowTs > 5 * 60_000) { _badMacWindowTs = now; _badMacCount = 0; }
        _badMacCount++;

        // Throttle: maks 1 action per 60 detik — kurangi frekuensi clear key
        if (now - _badMacCooldown < 60_000) {
            logger.warn(`[SESSION] Bad session throttled (${_badMacCount}x): ${eMsg.slice(0, 60)}`);
            return;
        }
        _badMacCooldown = now;

        // Eskalasi threshold lebih tinggi → kurangi false positive
        if (_badMacCount > 20)     _badMacLevel = 2;
        else if (_badMacCount > 8) _badMacLevel = 1;
        else                       _badMacLevel = 0;

        logger.warn(`[SESSION] Bad session #${_badMacCount} level=${_badMacLevel} — repair...`);

        try {
            const result = repairSession('session/main', _badMacLevel);
            logger.success(`[SESSION] Repair OK (${result})`);
            _badMacCount = 0;
        } catch (re) {
            logger.error('[SESSION] Repair error:', re.message);
        }

        // Alert owner jika level kritis
        if (_badMacLevel >= 2) {
            try {
                const owners = config?.owner || [];
                const alertMsg = `⚠️ *[Session Critical]*\n\nSession Bad MAC terlalu sering (${_badMacCount}x).\nBot telah clear session dan akan reconnect.\n\nJika masih bermasalah:\n\`.clearkeys\``;
                for (const o of owners) {
                    const n = String(o).replace(/[^0-9]/g,'');
                    if (n && manzxy) manzxy.sendMessage(n+'@s.whatsapp.net', { text: alertMsg }).catch(()=>{});
                }
            } catch {}
        }

        // Level 0 → cukup clear keys, tidak perlu putus koneksi
        // Level 1+ → reconnect
        if (_badMacLevel >= 1) {
            _cleanupSock(manzxy);
            setTimeout(() => scheduleReconnect(mySockId), 3_000);
        }
        return;
    }

    logger.error('[MSG UPSERT]', eMsg.slice(0, 200));
}

/* ── Exports ─────────────────────────────────────────────────── */
function getSock()      { return global.mainSock || null; }
function getMetaCache() { return _metaCache; }
function cleanMeta()    { cleanupMetaCache(); }
function getOwnerNums() { return _ownerNums; }

module.exports = { connectToWhatsApp, scheduleReconnect, getSock, getMetaCache, cleanMeta, getOwnerNums };
