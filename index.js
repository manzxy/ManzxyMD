/* ============================================================
   index.js — ManzxyMD Entry Point v6

   Tanggung jawab:
     1. Koneksi WA utama + reconnect
     2. LID global map
     3. In-memory store
     4. Scheduler & adzan tick
     5. Welcome / leave handler
     6. Route pesan ke manzxy.js
     7. Session cleanup otomatis (jadibot + tmp files)
     8. Memory management berkala
   ============================================================ */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { config, init } = require('./config.js');

/* ── Owner cache ─────────────────────────────────────────────── */
const _loadOwners = () => {
    const s = new Set((config.owner || []).map(n => String(n).replace(/[^0-9]/g, '')));
    try { require('./src/lib/database.js').getOwners().forEach(n => s.add(String(n).replace(/[^0-9]/g, ''))); } catch {}
    return s;
};
let _ownerNums = _loadOwners();
setInterval(() => { _ownerNums = _loadOwners(); }, 60_000);

/* ── Baileys ─────────────────────────────────────────────────── */
const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode,
} = require('@whiskeysockets/baileys');

const chalk    = require('chalk');
const pino     = require('pino');
const readline = require('readline');

// Logger HARUS di-require sebelum module lain yang mungkin pakai global._logger
const logger = require('./src/core/logger.js');

const { smsg, getBuffer, getSizeMedia, sleep }                  = require('./src/core/message.js');
const { useSQLiteAuthState }                                    = require('./src/lib/sqlite-session.js');
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./src/lib/exif.js');
const MediaHandler                                              = require('./src/core/media.js');

const db = require('./src/lib/database');
require('./src/lib/jadibot.js'); // init jadibot engine di top level
db.load();

const _pinoLogger = pino({ level: 'silent' });

const question = q => new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); res(a); });
});

/* ══════════════════════════════════════════════════════════════
   LID → JID GLOBAL MAP
   ══════════════════════════════════════════════════════════════ */
global._ownerLidCache = global._ownerLidCache || new Set();
global._lidToJidMap   = global._lidToJidMap   || (() => {
    let map = {};
    try { map = require('./src/lib/database.js').loadLidMap() || {}; } catch {}
    try {
        (config.ownerLid || []).forEach((lid, i) => {
            if (!lid || map[lid]) return;
            const num = String(config.owner?.[i] || '').replace(/[^0-9]/g, '');
            if (num.length >= 10 && num.length <= 15) map[lid] = num + '@s.whatsapp.net';
        });
        (config.ownerLid || []).forEach(lid => { if (lid) global._ownerLidCache.add(lid); });
    } catch {}
    return map;
})();

/* ══════════════════════════════════════════════════════════════
   IN-MEMORY STORE
   ══════════════════════════════════════════════════════════════ */
function makeStore() {
    const contacts = {}, messages = {}, chats = {};
    return {
        contacts, messages, chats,
        bind(ev) {
            ev.on('contacts.upsert', list => {
                for (const c of list) {
                    contacts[c.id] = { ...(contacts[c.id] || {}), ...c };
                    if (!c.id?.includes('@lid')) continue;
                    const src = c.phoneNumber || c.lidAlt || c.notify || '';
                    const num = String(src).replace(/[^0-9]/g, '');
                    if (num.length >= 10 && num.length <= 15)
                        global._lidToJidMap[c.id] = num + '@s.whatsapp.net';
                }
            });
            ev.on('contacts.update', list => {
                for (const u of list) {
                    if (!u.id) continue;
                    contacts[u.id] = { ...(contacts[u.id] || {}), ...u };
                    if (u.id.includes('@lid') && u.phoneNumber) {
                        const num = String(u.phoneNumber).replace(/[^0-9]/g, '');
                        if (num.length >= 10 && num.length <= 15)
                            global._lidToJidMap[u.id] = num + '@s.whatsapp.net';
                    }
                }
            });
            ev.on('chats.upsert',  l => { for (const c of l) chats[c.id] = { ...(chats[c.id] || {}), ...c }; });
            ev.on('chats.update',  l => { for (const u of l) if (u.id) chats[u.id] = { ...(chats[u.id] || {}), ...u }; });
            ev.on('messages.upsert', ({ messages: msgs }) => {
                for (const m of msgs) {
                    const jid = m.key?.remoteJid;
                    if (!jid) continue;
                    if (!messages[jid]) messages[jid] = [];
                    messages[jid].push(m);
                    if (messages[jid].length > 20) messages[jid].shift(); // max 20 msg per JID
                    if (m.key?.addressingMode === 'lid'
                        && m.key.participant?.includes('@lid')
                        && m.key.participantAlt?.includes('@s.whatsapp.net')) {
                        global._lidToJidMap[m.key.participant] = m.key.participantAlt;
                    }
                    if (jid.includes('@lid') && m.key?.remoteJidAlt?.includes('@s.whatsapp.net')) {
                        const num = m.key.remoteJidAlt.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                        if (num.length >= 10 && num.length <= 15)
                            global._lidToJidMap[jid] = num + '@s.whatsapp.net';
                    }
                }
            });
        },
        loadMessage: (jid, id) => (messages[jid] || []).find(m => m.key?.id === id) || null,
    };
}

const store = makeStore();

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
function unwrapMsg(msg) {
    for (const w of ['ephemeralMessage','viewOnceMessage','viewOnceMessageV2',
                     'documentWithCaptionMessage','editedMessage']) {
        if (msg[w]) return msg[w].message || msg[w];
    }
    return msg;
}
function padTime(h, m) { return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0'); }

/* ══════════════════════════════════════════════════════════════
   GROUP META CACHE
   ══════════════════════════════════════════════════════════════ */
const _metaCache = new Map();
const META_TTL   = 5 * 60_000; // expire cache groupMetadata

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

/* ══════════════════════════════════════════════════════════════
   SESSION CLEANUP — hapus sampah otomatis
   ══════════════════════════════════════════════════════════════ */
async function cleanupSessions() {
    let cleaned = 0;

    /* ── 1. Hapus tmp files di database/ ─────────────────────── */
    const tmpDirs = [
        path.join(process.cwd(), 'database'),
        path.join(process.cwd(), 'tmp'),
        os.tmpdir(),
    ];
    const TMP_PATTERNS = /\.(jpg|jpeg|png|mp4|webp|mp3|ogg|pdf|zip|tmp)$/i;
    const TMP_MAX_AGE  = 30 * 60_000; // 30 menit

    for (const dir of tmpDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir);
            for (const f of files) {
                if (!TMP_PATTERNS.test(f)) continue;
                const fp  = path.join(dir, f);
                try {
                    const stat = fs.statSync(fp);
                    if (Date.now() - stat.mtimeMs > TMP_MAX_AGE) {
                        fs.unlinkSync(fp);
                        cleaned++;
                    }
                } catch {}
            }
        } catch {}
    }

    /* ── 2. Hapus folder session jadibot yang orphan ────────────
     * "Orphan" = ada folder session tapi nomor tidak terdaftar
     * di registry maupun stopped list (sudah tidak dipakai)
     */
    const jbDir = path.join(process.cwd(), 'session', 'jadibot');
    if (fs.existsSync(jbDir)) {
        try {
            // Kumpulkan nomor yang masih valid
            const validNums = new Set();

            // Dari jadibot aktif
            if (global.jadiBotSockets) {
                for (const [num] of global.jadiBotSockets) validNums.add(num);
            }

            // Dari stopped list
            try {
                const stopped = global.loadStoppedJadibots?.() || {};
                Object.keys(stopped).forEach(n => validNums.add(n));
            } catch {}

            // Dari DB registry (just in case)
            try {
                const DB = require('./src/lib/database.js');
                const reg = DB.jadibotRegistryLoad?.() || [];
                reg.forEach(r => { if (r.number) validNums.add(r.number); });
            } catch {}

            const folders = fs.readdirSync(jbDir);
            for (const folder of folders) {
                // Skip jika bukan folder angka (nomor WA)
                if (!/^\d{10,15}$/.test(folder)) continue;

                // Jika nomor masih valid → skip
                if (validNums.has(folder)) continue;

                // Tidak ada di registry maupun stopped → orphan → hapus
                const folderPath = path.join(jbDir, folder);
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                    cleaned++;
                    logger.info(`[CLEANUP] Hapus session orphan: ${folder}`);
                } catch {}
            }
        } catch (e) {
            logger.warn('[CLEANUP] Session scan error:', e.message);
        }
    }

    /* ── 3. Hapus WAL checkpoint SQLite bot utama ─────────────── */
    try {
        const { _walCheckpoint } = require('./src/lib/sqlite-session.js');
        _walCheckpoint?.();
    } catch {}

    if (cleaned > 0) logger.info(`[CLEANUP] ${cleaned} file/folder dihapus`);
}

/* ══════════════════════════════════════════════════════════════
   MEMORY CLEANUP — flush cache lama agar RAM stabil
   ══════════════════════════════════════════════════════════════ */
function cleanupMemory() {
    /* Hapus metaCache yang expired */
    let expired = 0;
    const now = Date.now();
    for (const [k, v] of _metaCache) {
        if (now - v.ts > META_TTL * 2) { _metaCache.delete(k); expired++; }
    }

    /* Trim store.messages — jaga max 20 per JID, hapus JID tak aktif */
    const MSG_MAX_PER_JID = 5; // low-spec: trim sangat agresif
    for (const [jid, msgs] of Object.entries(store.messages)) {
        if (!msgs?.length) { delete store.messages[jid]; continue; }
        if (msgs.length > MSG_MAX_PER_JID) store.messages[jid] = msgs.slice(-MSG_MAX_PER_JID);
    }

    /* Trim _adzanSent — jaga max 500 entries */
    const adzanKeys = Object.keys(_adzanSent);
    if (adzanKeys.length > 500) adzanKeys.slice(0, 300).forEach(k => delete _adzanSent[k]);

    /* Trim _lidToJidMap — jaga max 5000 entries */
    const lidKeys = Object.keys(global._lidToJidMap || {});
    if (lidKeys.length > 1000) {
        lidKeys.slice(0, 500).forEach(k => {
            if (!global._ownerLidCache?.has(k)) delete global._lidToJidMap[k];
        });
    }

    /* Log RAM */
    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    logger.mem(`RSS: ${ram} MB | Meta: ${expired} expired | LID: ${Object.keys(global._lidToJidMap||{}).length}`);
}

/* ══════════════════════════════════════════════════════════════
   SCHEDULER + ADZAN
   ══════════════════════════════════════════════════════════════ */
let _schedSock    = null;
let _schedStarted = false;
const _adzanSent  = {};

function startScheduler() {
    const tick = async () => {
        try { await schedulerTick(); } catch (e) { logger.error('[SCHED]', e.message); }
        const now = new Date();
        setTimeout(tick, (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 500);
    };
    const now = new Date();
    setTimeout(tick, (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 500);
    logger.success('[SCHEDULER] Started');
}

async function schedulerTick() {
    if (!_schedSock) return;
    const groups = global.db?.groups;
    if (!groups) return;

    const wib  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const nowH = wib.getHours(), nowM = wib.getMinutes(), nowDay = wib.getDay();

    for (const [gid, gd] of Object.entries(groups)) {
        if (!gd?.schedule?.jobs?.length) continue;
        for (const job of gd.schedule.jobs) {
            if (!job.enabled) continue;
            const [jH, jM] = (job.time || '').split(':').map(Number);
            if (jH !== nowH || jM !== nowM) continue;
            if (job.days?.length && !job.days.includes(nowDay)) continue;
            try {
                let msg = '';
                if      (job.action==='close')     { await _schedSock.groupSettingUpdate(gid,'announcement');     msg=`🔒 *[AUTO]* Grup ditutup.`; }
                else if (job.action==='open')      { await _schedSock.groupSettingUpdate(gid,'not_announcement'); msg=`🔓 *[AUTO]* Grup dibuka.`; }
                else if (job.action==='lockinfo')  { await _schedSock.groupSettingUpdate(gid,'locked');   gd.setinfo=true;  msg=`🔏 *[AUTO]* Info dikunci.`; }
                else if (job.action==='unlockinfo'){ await _schedSock.groupSettingUpdate(gid,'unlocked'); gd.setinfo=false; msg=`🔑 *[AUTO]* Info dibuka.`; }
                else if (job.action==='mute')      { gd.mute=true;  msg=`🔇 *[AUTO]* Bot di-mute.`; }
                else if (job.action==='unmute')    { gd.mute=false; msg=`🔊 *[AUTO]* Bot di-unmute.`; }
                if (msg) await _schedSock.sendMessage(gid, { text: msg }).catch(()=>{});
            } catch (e) { logger.warn(`[SCHED] ${gid}:`, e.message); }
            await sleep(300);
        }
    }

    // Adzan
    if (!global._adzanKirim || !global._adzanGetJadwal) return;
    const tgl     = wib.toISOString().split('T')[0];
    const nowTime = padTime(nowH, nowM);
    for (const [gid, gd] of Object.entries(groups)) {
        if (!gd?.adzan?.enabled || !gd.adzan.kotaId) continue;
        try {
            const jadwal = await global._adzanGetJadwal(gd.adzan.kotaId, tgl);
            for (const w of ['subuh','dzuhur','ashar','maghrib','isya']) {
                if (jadwal[w] !== nowTime) continue;
                const key = `${gid}_${w}_${tgl}`;
                if (_adzanSent[key]) continue;
                _adzanSent[key] = true;
                await global._adzanKirim(_schedSock, gid, w, jadwal[w], gd.adzan.kotaNama).catch(()=>{});
                await sleep(500);
            }
        } catch {}
    }
}

/* ══════════════════════════════════════════════════════════════
   BANNER
   ══════════════════════════════════════════════════════════════ */
function printBanner() {
    console.clear();
    const w = 40;
    const line = (txt, col) => {
        const pad = Math.max(0, w - 2 - txt.length);
        return chalk.cyan('║') + ' '.repeat(Math.floor(pad/2)) + col(txt) + ' '.repeat(Math.ceil(pad/2)) + chalk.cyan('║');
    };
    const sep = chalk.cyan('╠' + '═'.repeat(w-2) + '╣');
    const top = chalk.cyan('╔' + '═'.repeat(w-2) + '╗');
    const bot = chalk.cyan('╚' + '═'.repeat(w-2) + '╝');

    [ top,
      line('M A N Z X Y  M D',       chalk.bold.magenta),
      line('WhatsApp Bot Framework',  chalk.gray),
      sep,
      line(`Owner : ${config.nameOwn || 'Owner'}`, chalk.cyan),
      line(`Bot   : ${config.nameBot || 'Bot'}`,   chalk.cyan),
      line(`Versi : ${config.version || '2.0'}`,   chalk.cyan),
      bot, ''
    ].forEach(l => console.log(l));
}

/* ══════════════════════════════════════════════════════════════
   RECONNECT — exponential backoff
   ══════════════════════════════════════════════════════════════ */
let _reconnects          = 0;
let _reconnectTimer      = null;   // setTimeout handle — cancel jika sudah ada
let _sockId              = 0;      // generation counter — tiap socket baru dapat ID unik
let _notifOnlineSentAt   = 0;      // timestamp notif online terakhir (anti-spam)
let _jadibotResumed      = false;  // flag: auto-resume jadibot sudah dijalankan

/**
 * scheduleReconnect(fromSockId)
 *
 * SATU-SATUNYA cara untuk trigger reconnect.
 * fromSockId: ID socket yang request reconnect.
 * Jika _sockId sudah berubah (socket baru sudah dibuat), ABAIKAN.
 * Ini mencegah socket lama yang masih firing events memicu reconnect dobel.
 */
function scheduleReconnect(fromSockId) {
    // Socket lama mencoba reconnect tapi sudah ada socket baru — abaikan
    if (fromSockId !== _sockId) {
        logger.warn(`[RECONNECT] Stale sock ${fromSockId} vs current ${_sockId} — ignored`);
        return;
    }

    // Sudah ada reconnect scheduled — jangan dobel
    if (_reconnectTimer !== null) return;

    _reconnects++;
    if (_reconnects > 15) {
        logger.warn('[RECONNECT] 15x gagal — tunggu 60s lalu coba lagi');
        _reconnects = 1;
    }

    const delay = Math.min(3_000 * Math.pow(1.5, Math.min(_reconnects - 1, 8)), 30_000);
    logger.warn(`[RECONNECT] #${_reconnects} in ${(delay/1000).toFixed(1)}s...`);

    _reconnectTimer = setTimeout(() => {
        _reconnectTimer = null;
        // Cek lagi: jika sockId berubah selama delay, ada orang lain yang sudah connect
        if (fromSockId !== _sockId) return;
        connectToWhatsApp().catch(e => {
            logger.error('[RECONNECT] connectToWhatsApp error:', e.message);
            scheduleReconnect(_sockId);
        });
    }, delay);
}

/* ══════════════════════════════════════════════════════════════
   MAIN CONNECTION
   ══════════════════════════════════════════════════════════════ */
async function connectToWhatsApp() {
    // Increment sockId — semua event handler dari socket lama akan diabaikan
    const mySockId = ++_sockId;

    let state, saveCreds;
    try {
        ({ state, saveCreds } = await useSQLiteAuthState('session/main'));
    } catch (e) {
        logger.error('[WA] Session load gagal:', e.message);
        if (mySockId === _sockId) {
            setTimeout(() => scheduleReconnect(mySockId), 5_000);
        }
        return;
    }

    let version;
    try {
        const _vFetch = fetchLatestBaileysVersion();
        const _vTimer = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000));
        ({ version } = await Promise.race([_vFetch, _vTimer]));
    } catch { version = [2, 3000, 1021356099]; }

    const usePairing = init.loginMethod !== 'qr';

    const manzxy = makeWASocket({
        version,
        logger: _pinoLogger,
        printQRInTerminal: !usePairing,

        /* ── Stability ─────────────────────────────────────────
         * connectTimeoutMs: 0 — tidak ada timeout dari Baileys
         * Sama seperti jadibot, biarkan WA sync tanpa dipotong.
         */
        connectTimeoutMs:               0,       // jangan potong WA sync
        defaultQueryTimeoutMs:          0,
        syncFullHistory:                false,
        markOnlineOnConnect:            true,
        keepAliveIntervalMs:            25_000,  // ping tiap 25 detik
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

    // Bind store ke socket baru
    // Store events yang accumulate tidak masalah karena events lama
    // dari socket lama sudah tidak fire (socket.ev.removeAllListeners() saat close)
    store.bind(manzxy.ev);
    manzxy.public   = true;
    manzxy._sockId  = mySockId;  // tandai socket ini
    global.mainSock = manzxy;
    _schedSock      = manzxy;

    /* Jadibot engine sudah di-init di top level */

    const media  = new MediaHandler(manzxy, { getBuffer, getSizeMedia });
    manzxy.media = media;

    manzxy.decodeJid = jid => {
        if (!jid) return jid;
        if (/:\d+@/i.test(jid)) { const d = jidDecode(jid) || {}; return d.user ? `${d.user}@${d.server}` : jid; }
        return jid;
    };

    /* ── Login (first time) ──────────────────────────────────── */
    if (!manzxy.authState.creds.registered) {
        if (usePairing) {
            const phone = await question(chalk.blue('\n[LOGIN] Nomor HP (628xxx):\n> '));
            const code  = await manzxy.requestPairingCode(phone.trim(), init.customPair);
            logger.success(`[LOGIN] Pairing code: ${code}`);
        } else {
            logger.info('[WA] Menunggu QR scan...');
        }
    }

    /* ── Custom methods ──────────────────────────────────────── */
    manzxy.getFile                     = (p, s) => media.getFile(p, s);
    manzxy.downloadMediaMessage        = m => media.downloadMediaMessage(m);
    manzxy.downloadAndSaveMediaMessage = (m, f, e) => media.downloadAndSaveMediaMessage(m, f, e);
    manzxy.sendText  = (jid, text, q='', opts={}) => manzxy.sendMessage(jid, { text, ...opts }, { quoted: q });
    manzxy.sendPoll  = (jid, q, opts, quoted='', n=1) => manzxy.sendMessage(jid, { poll: { name: q, values: opts, selectableCount: n } }, { quoted });

    manzxy.sendImageAsSticker = async (jid, p, quoted, opts={}) => {
        let b = Buffer.isBuffer(p)?p:/^data:/.test(p)?Buffer.from(p.split`,`[1],'base64')
            :/^https?:/.test(p)?await getBuffer(p):fs.existsSync(p)?fs.readFileSync(p):Buffer.alloc(0);
        const buf = (opts.packname||opts.author) ? await writeExifImg(b,opts) : await imageToWebp(b);
        await manzxy.sendMessage(jid, { sticker: buf, ...opts }, { quoted });
        return buf;
    };
    manzxy.sendVideoAsSticker = async (jid, p, quoted, opts={}) => {
        let b = Buffer.isBuffer(p)?p:/^data:/.test(p)?Buffer.from(p.split`,`[1],'base64')
            :/^https?:/.test(p)?await getBuffer(p):fs.existsSync(p)?fs.readFileSync(p):Buffer.alloc(0);
        const buf = (opts.packname||opts.author) ? await writeExifVid(b,opts) : await videoToWebp(b);
        await manzxy.sendMessage(jid, { sticker: buf, ...opts }, { quoted });
        return buf;
    };
    manzxy.sendMedia = async (jid, p, cap='', quoted='', opts={}) => {
        const { mime, data } = await manzxy.getFile(p, true);
        const type = mime.split('/')[0];
        const cnt  = type==='image'?{image:data,caption:cap,...opts}:type==='video'?{video:data,caption:cap,...opts}
            :type==='audio'?{audio:data,ptt:opts.ptt||false,...opts}:{document:data,mimetype:mime,fileName:opts.fileName||'file',...opts};
        await manzxy.sendMessage(jid, cnt, { quoted });
    };

    /* ── Welcome / Leave ─────────────────────────────────────── */
    manzxy.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (mySockId !== _sockId) return; // socket lama — abaikan
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
                let jid = typeof p === 'object' ? (p.id || String(p)) : String(p);
                if (typeof p === 'object' && p.phoneNumber) {
                    jid = p.phoneNumber.replace(/[^0-9]/g,'') + '@s.whatsapp.net';
                } else if (jid.includes('@lid') && global._lidToJidMap[jid]) {
                    jid = global._lidToJidMap[jid];
                }
                const num  = jid.split(':')[0].split('@')[0];
                const full = `${num}@s.whatsapp.net`;
                let pp = 'https://telegra.ph/file/241d7169c11e03445940f.png';
                try { pp = await manzxy.profilePictureUrl(full, 'image'); } catch {}
                let uname = num;
                try { const ct = store.contacts?.[full]; uname = ct?.notify || ct?.name || ct?.verifiedName || num; } catch {}

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
                        title: isAdd ? 'W E L C O M E' : 'G O O D B Y E',
                        body: groupName, thumbnailUrl: pp,
                        mediaType: 1, renderLargerThumbnail: true,
                        sourceUrl: 'https://whatsapp.com',
                    }},
                }).catch(()=>{});
            }
        } catch (e) { logger.warn('[WELCOME]', e.message); }
    });

    /* ── Messages ────────────────────────────────────────────── */
    manzxy.ev.on('messages.upsert', async chatUpdate => {
        // Abaikan pesan dari socket lama (bisa terjadi saat transisi reconnect)
        if (mySockId !== _sockId) return;
        try {
            const mek = chatUpdate.messages[0];
            if (!mek?.message) return;
            mek.message = unwrapMsg(mek.message);
            const jid = mek.key?.remoteJid;
            if (jid === 'status@broadcast') return;

            // Channel/newsletter - log dan lanjutkan (bisa dipakai owner untuk bot channel)
            const _isChannel = jid?.endsWith('@newsletter');
            if (_isChannel) {
                // Hanya loloskan kalau ada command prefix — channel biasa di-skip
                const _body = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '';
                const _hasCmd = Array.isArray(config?.prefa)
                    ? config.prefa.some(p => _body.startsWith(p))
                    : (config?.prefa && _body.startsWith(config?.prefa));
                if (!_hasCmd) return; // pesan channel tanpa command → skip
                logger.channel(`[CHANNEL] ${jid} → ${_body.slice(0, 60)}`);
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
                m = smsg(manzxy, mek, store);
            } catch (smsgErr) {
                logger.warn('[MSG] smsg() error:', smsgErr.message);
                return;
            }
            if (!m) return;
            if (m.isGroup) db.getGroup(m.chat);
            if (m.sender)  db.getUser(m.sender);

            if (m.isGroup && mek.key?.addressingMode === 'lid') {
                const lid = mek.key?.participant, alt = mek.key?.participantAlt;
                if (lid?.includes('@lid') && alt?.includes('@s.whatsapp.net')) {
                    global._lidToJidMap[lid] = alt;
                    const n = alt.split(':')[0].split('@')[0].replace(/[^0-9]/g,'');
                    if (_ownerNums.has(n)) global._ownerLidCache.add(lid);
                }
            }
            if (!m.isGroup && m.sender?.includes('@lid')) {
                const res = global._lidToJidMap[m.sender];
                if (res) m.sender = res;
            }

            // fromMe: bisa owner kirim ke bot sendiri (eval/command) ATAU bot kirim ke orang lain (outgoing)
            // Blok hanya jika benar-benar outgoing (bukan eval dan bukan command dengan prefix)
            if (m.fromMe) {
                const hasPrefix = Array.isArray(config?.prefa)
                    ? config.prefa.some(p => (m.body || '').startsWith(p))
                    : (config?.prefa && (m.body || '').startsWith(config.prefa));
                const isEval = /^(>|=>|\$)/.test(m.body || '');
                // Loloskan jika ada prefix command atau eval — blok sisanya (outgoing bot)
                if (!hasPrefix && !isEval) return;
            }

            require('./manzxy.js')(manzxy, m, chatUpdate, store)
                .catch(e => logger.error('[HANDLER]', e.message));
        } catch (e) {
            if (e.message?.includes('closed session') || e.message?.includes('No matching session')) {
                // Abaikan — session key lama, normal saat reconnect
            } else {
                logger.error('[MSG UPSERT]', e.message);
            }
        }
    });

    /* ── connection.update ───────────────────────────────────── */
    manzxy.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        // KUNCI ANTI-STUCK: abaikan event dari socket lama
        // Jika mySockId !== _sockId, berarti ada socket baru yang sudah dibuat
        // Event ini dari socket zombie — ABAIKAN sepenuhnya
        if (mySockId !== _sockId) return;

        if (qr) {
            logger.info('[WA] Scan QR di bawah ini:');
            try { require('qrcode-terminal').generate(qr, { small: true }); } catch { console.log(qr); }
        }

        if (connection === 'close') {
            const code   = lastDisconnect?.error?.output?.statusCode;
            const errMsg = lastDisconnect?.error?.message || '';
            logger.warn(`[WA] Disconnect — code: ${code}${errMsg ? ' | ' + errMsg : ''}`);

            // Cleanup socket ini sebelum reconnect
            try { manzxy.ev.removeAllListeners(); } catch {}
            try { manzxy.ws?.close?.(); } catch {}

            // Fatal: logout/banned — hapus session lama, coba login baru
            // JANGAN process.exit — biarkan reconnect, minta login ulang
            if (code === DisconnectReason.loggedOut || code === 403) {
                logger.error('[WA] Logged out/banned (code '+code+').');
                logger.warn('[WA] Session dihapus, meminta login ulang...');
                // Hapus session SQLite agar saat reconnect dipaksa login ulang
                // Session utama ada di: session/session.db (bukan folder 'session/main')
                try {
                    const { deleteSession } = require('./src/lib/sqlite-session.js');
                    deleteSession('session/main');
                    logger.warn('[WA] Session SQLite dihapus. Bot akan minta login ulang.');
                } catch (e) { logger.warn('[WA] Gagal hapus session:', e.message); }
                // Tunggu 5s baru reconnect (beri waktu WA tutup koneksi lama)
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 5_000);
                return;
            }

            // 440 = multidevice conflict → tunggu 15s baru schedule
            if (code === 440) {
                logger.warn('[WA] Multidevice conflict. Tunggu 15s...');
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 15_000);
                return;
            }

            // 515 = WA server restart → tunggu 10s baru schedule
            if (code === 515) {
                logger.warn('[WA] WA server restart (515). Tunggu 10s...');
                setTimeout(() => { if (mySockId === _sockId) scheduleReconnect(mySockId); }, 10_000);
                return;
            }

            // Semua kode lain (undefined, 408, dll) = transient → reconnect normal
            scheduleReconnect(mySockId);

        } else if (connection === 'connecting') {
            logger.info('[WA] Menghubungkan...');

        } else if (connection === 'open') {
            // Reset reconnect counter — koneksi berhasil
            _reconnects = 0;
            // Cancel reconnect timer yang mungkin masih pending
            if (_reconnectTimer !== null) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
            _schedSock      = manzxy;
            global.mainSock = manzxy;

            const num  = (manzxy.user?.id || '').split(':')[0].split('@')[0] || '?';
            const name = manzxy.user?.name || config.nameBot || 'Bot';
            logger.success(`[WA] Online! +${num} (${name})`);

            if (!_schedStarted) { _schedStarted = true; startScheduler(); }

            // Notif online ke owner — HANYA saat pertama kali bot online di proses ini
            // Reconnect biasa (disconnect → reconnect) TIDAK kirim notif lagi
            // Notif baru hanya muncul kalau bot di-restart (proses baru)
            if (!_notifOnlineSentAt) {
                _notifOnlineSentAt = Date.now();
                setTimeout(async () => {
                    if (mySockId !== _sockId) return;
                    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
                    const tgl = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    const msg =
                        `✅ *BOT ONLINE*\n\n` +
                        `🤖 ${name}  •  +${num}\n` +
                        `📅 ${tgl}\n` +
                        `💾 RAM: ${ram} MB`;
                    const owners = new Set([...(config.owner||[])]);
                    try { require('./src/lib/database.js').getOwners().forEach(n => owners.add(n)); } catch {}
                    for (const o of owners) {
                        const n = String(o).replace(/[^0-9]/g,'');
                        if (n) await manzxy.sendMessage(n+'@s.whatsapp.net', { text: msg }).catch(()=>{});
                    }
                }, 3000);
            }

            // Auto-resume semua jadibot — hanya saat pertama kali connect
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
        if (mySockId !== _sockId) return; // socket lama — abaikan
        logger.warn('[WA] Socket error: ' + (e?.message || e));
    });

    manzxy.ev.on('creds.update', () => {
        if (mySockId !== _sockId) return; // socket lama — abaikan
        saveCreds();
    });
}

/* ══════════════════════════════════════════════════════════════
   PERIODIC TASKS
   ══════════════════════════════════════════════════════════════ */

// Simpan DB setiap 10 menit (low-host: kurangi disk I/O)
setInterval(() => { try { db.save(); } catch {} }, 10 * 60_000);

// Memory cleanup setiap 15 menit
setInterval(() => { try { cleanupMemory(); } catch {} }, 15 * 60_000);

// Cek expired sewabot group setiap jam — bot keluar dari grup yang expired
setInterval(async () => {
    try {
        const _db  = require('./src/lib/database.js');
        const all  = _db.sewabotGetAll?.() || [];
        const now  = Date.now();
        for (const sewa of all) {
            if (!sewa?.groupJid || !sewa?.expiredAt || sewa.expiredAt === -1) continue;
            if (now >= sewa.expiredAt) {
                // Expired — notif dulu, baru keluar
                if (global.mainSock) {
                    const ownerNum = (sewa.ownerJid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                    // Notif ke grup
                    global.mainSock.sendMessage(sewa.groupJid, {
                        text: '⌛ *Masa sewa bot telah berakhir!*\n\nBot akan keluar dari grup ini.\nPerpanjang sewa: *.perpanjang <paket>*'
                    }).catch(() => {});
                    // Notif ke owner sewa
                    if (ownerNum) {
                        global.mainSock.sendMessage(ownerNum + '@s.whatsapp.net', {
                            text: '⌛ *Sewa Bot Expired!*\n\nGrup: *' + (sewa.groupName || sewa.groupJid) + '*\nPaket: *' + sewa.paket + '* sudah berakhir.\n\nPerpanjang: *.perpanjang <paket>*'
                        }).catch(() => {});
                    }
                    // Tunggu 5 detik baru keluar
                    setTimeout(() => {
                        global.mainSock.groupLeave(sewa.groupJid).catch(() => {});
                    }, 5000);
                }
                // Hapus dari DB agar tidak diproses lagi
                try { _db.sewabotDelete(sewa.groupJid); } catch {}
                logger.info('[SEWA] Expired & leave: ' + (sewa.groupName || sewa.groupJid));
            }
        }
    } catch (e) {
        logger.warn('[SEWA CHECKER]', e.message);
    }
}, 2 * 60 * 60_000); // cek setiap 2 jam

// Session cleanup setiap 30 menit
setInterval(() => { try { cleanupSessions(); } catch {} }, 30 * 60_000);

// Cleanup pertama kali 5 menit setelah start (beri waktu bot auto-resume jadibot dulu)
setTimeout(() => { try { cleanupSessions(); } catch {} }, 5 * 60_000);

/* ══════════════════════════════════════════════════════════════
   PROCESS EVENTS
   ══════════════════════════════════════════════════════════════ */
process.on('uncaughtException', e => {
    logger.error('[UNCAUGHT] ' + (e?.message || e));
    // Jangan exit — bot harus tetap jalan meskipun ada error tak terduga
});
process.on('unhandledRejection', r => {
    logger.warn('[UNHANDLED] ' + (r?.message || r));
});

const _exit = sig => {
    console.log(chalk.yellow(`\n[EXIT] ${sig}`));
    try { db.save(); } catch {}
    process.exit(0);
};
process.on('SIGINT',  () => _exit('SIGINT'));
process.on('SIGTERM', () => _exit('SIGTERM'));

/* ══════════════════════════════════════════════════════════════
   GLOBAL RESTART
   ══════════════════════════════════════════════════════════════ */
global.restartBot = async (senderJid = null) => {
    const { spawn } = require('child_process');
    try { db.save(); } catch {}
    if (senderJid && global.mainSock) {
        await global.mainSock.sendMessage(senderJid, {
            text: '🔄 *Bot restart...*\n_Tunggu beberapa detik._'
        }).catch(()=>{});
    }
    const child = spawn(process.execPath, process.argv.slice(1), {
        cwd: process.cwd(), env: process.env, detached: true, stdio: 'inherit',
    });
    child.unref();
    setTimeout(() => process.exit(0), 1500);
};

/* ══════════════════════════════════════════════════════════════
   START
   ══════════════════════════════════════════════════════════════ */
printBanner();
connectToWhatsApp().catch(e => {
    console.error(chalk.red('[START]'), e.message);
    scheduleReconnect(_sockId);
});
