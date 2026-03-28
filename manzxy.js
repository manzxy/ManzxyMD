// FIX: hapus console.clear() — jangan hapus log setiap request masuk
const { config, init } = require('./config.js');
const { description, version, name } = require("./package.json");

// baileys diimport di message.js — tidak perlu dobel impor di sini

const fs     = require('fs');
const util   = require('util');
const chalk  = require('chalk');
const path   = require('path');
const axios  = require('axios');
const crypto = require('crypto');
const moment = require('moment-timezone');
const { spawn, exec } = require('child_process');
// Logger: require dulu, fallback ke global._logger
let logger;
try {
    logger = require('./src/core/logger.js');
} catch {
    logger = global._logger || {
        info:    (...a) => console.log('[INFO]',    ...a),
        success: (...a) => console.log('[OK]',      ...a),
        warn:    (...a) => console.warn('[WARN]',   ...a),
        error:   (...a) => console.error('[ERROR]', ...a),
        box:     (t, c, i) => { console.log(t); i.forEach(x => console.log(x)); },
        plugin:  (...a) => console.log('[PLUGIN]',  ...a),
        cmd:     (...a) => console.log('[CMD]',     ...a),
        mem:     (...a) => console.log('[MEM]',     ...a),
    };
}

const {
    smsg, tanggal, getTime, isUrl, sleep, clockString,
    runtime, fetchJson, getBuffer, jsonformat, format,
    parseMention, getRandom, getGroupAdm, generateProfilePicture
} = require('./src/core/message.js');

/* ============================================================
   DATABASE
   ============================================================ */
// system.js (Case) tidak dipakai - dihapus
const _db  = require("./src/lib/database.js");
if (typeof _db.load === 'function') _db.load(); // idempoten — aman dipanggil berulang

const getUser  = (jid) => { try { return _db.getUser(jid);  } catch { return { banned: false, limit: 20, warn: {}, premium: false, registered: false }; } };
const getGroup = (jid) => { try { return _db.getGroup(jid); } catch { return { adminonly: false, warns: {}, antilinkWarn: {}, mute: false }; } };
const CreatorOnly = false;

/* ============================================================
   CACHE OWNER & PREMIUM — dari SQLite (live, tidak perlu watchFile)
   ============================================================ */
let _ownerCache   = [];
let _premiumCache = [];

const _loadOwner   = () => { try { _ownerCache   = _db.getOwners();      } catch {} };
const _loadPremium = () => { try { _premiumCache = _db.getPremiumList(); } catch {} };

_loadOwner();
_loadPremium();
// Global invalidator — bisa dipanggil dari plugin setelah addprem/delprem
global._invalidatePremCache = () => { _loadOwner(); _loadPremium(); };
// Refresh setiap 5 detik (menggantikan fs.watchFile)
setInterval(() => { _loadOwner(); _loadPremium(); }, 30_000); // refresh tiap 30s

/* ============================================================
   PLUGIN CACHE
   ============================================================ */
let _cjsHandler     = null;
let _esmHandler     = null;
let _esmLoadPlugins = null;
let _pluginsReady   = false;

let _initRetries = 0;
const _initPlugins = async () => {
    if (_pluginsReady) return;
    if (_initRetries >= 3) return; // sudah 3x gagal, stop retry
    _initRetries++;
    try {
        _cjsHandler = require('./src/lib/handler.js');
        // ESM opsional — jika tidak ada, CJS saja tetap jalan
        try {
            const mod   = await import('./src/lib/handle.mjs');
            _esmHandler     = mod.default;
            _esmLoadPlugins = mod.loadPlugins;
        } catch {
            // ESM tidak ada — OK, pakai CJS saja
            _esmHandler     = async () => false;
            _esmLoadPlugins = async () => [];
        }
        _pluginsReady = true;
        _initRetries  = 0;
    } catch (e) {
        logger.error('[PLUGIN INIT ERROR]', e.message);
        _pluginsReady = false;
    }
};
_initPlugins().catch(console.error);

/* ============================================================
   COOLDOWN / ANTI-SPAM — 3 detik (lebih cepat dari sebelumnya)
   ============================================================ */
const cooldownMap       = new Map();
const COOLDOWN_DURATION = 3 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of cooldownMap.entries()) {
        if (now - ts > COOLDOWN_DURATION * 10) cooldownMap.delete(key);
    }
}, 30 * 1000); // cleanup tiap 30s

/* ============================================================
   GROUP METADATA CACHE
   ============================================================ */
const _groupMetaCache = new Map();
const GROUP_META_TTL  = 5 * 60 * 1000; // 5 menit — kurangi WA API calls

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of _groupMetaCache.entries()) {
        if (now - val.ts > GROUP_META_TTL * 10) _groupMetaCache.delete(key);
    }
}, 10 * 60 * 1000);

const getGroupMetaCached = async (manzxy, from) => {
    const cached = _groupMetaCache.get(from);
    if (cached && Date.now() - cached.ts < GROUP_META_TTL) return cached.data;
    const meta = await Promise.race([
        manzxy.groupMetadata(from),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    _groupMetaCache.set(from, { data: meta, ts: Date.now() });
    return meta;
};

/* ============================================================
   NORMALIZE JID
   ============================================================ */
const normalizeNum = (jid) =>
    (jid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');

/* ============================================================
   SHELL EXEC dengan TIMEOUT
   ============================================================ */
const execWithTimeout = (cmd, timeout = 15000) => {
    return new Promise((resolve) => {
        exec(cmd, { timeout }, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
    });
};

/* ============================================================
   PLUGIN LIMIT CACHE
   Di-cache 60 detik, scan CJS & ESM sekaligus
   ============================================================ */
let _pluginLimitCache   = null;
let _pluginLimitCacheTs = 0;

/**
 * Scan & cache semua plugin (CJS + ESM)
 * Return array of plugin objects dengan .limit, .limitCost, .command, .mainOnly
 *
 * FIX: sebelumnya hanya return CJS — ESM tidak masuk, limit ESM tidak pernah dipotong.
 * Sekarang merge CJS + ESM. Cache 30 detik (ESM reload lambat karena import()).
 */
let _allPluginsCache = null;
let _allPluginsCacheTs = 0;
const ALL_PLUGINS_TTL = 30_000;

// Exposed untuk plugin manager — reset cache setelah tambah/hapus plugin
global._resetPluginCache = () => {
    _allPluginsCache   = null;
    _allPluginsCacheTs = 0;
};

const scanAllPlugins = async () => {
    const now = Date.now();
    if (_allPluginsCache && (now - _allPluginsCacheTs) < ALL_PLUGINS_TTL) {
        return _allPluginsCache;
    }

    const all = [];

    // CJS: dari handler.js (mtime-based cache, sudah efisien)
    try {
        const cjsPlugins = await _cjsHandler?.getPlugins?.() || [];
        all.push(...cjsPlugins);
    } catch {}

    // ESM: pakai _esmLoadPlugins yang sudah ada (mtime-cache, tidak double import)
    try {
        if (typeof _esmLoadPlugins === 'function') {
            const esmPlugins = await _esmLoadPlugins();
            all.push(...esmPlugins);
        }
    } catch {}

    _allPluginsCache = all;
    _allPluginsCacheTs = now;
    return all;
};

/* ============================================================
   AUTO RELOAD FILE
   ============================================================ */
// watchFile dihapus — auto-reload manzxy.js menyebabkan state kacau di prod

/* ============================================================
   MAIN HANDLER
   ============================================================ */
module.exports = async function _msgHandler(manzxy, m, chatUpdate, store) {
    try {
        const body = m.body || '';
        const budy = (typeof m.text === 'string' ? m.text : '');

        /* PREFIX */
        let prefix = '';
        let CMD    = false;

        if (Array.isArray(config.prefa)) {
            for (const p of config.prefa) {
                if (body.startsWith(p)) { prefix = p; CMD = true; break; }
            }
        } else if (typeof config.prefa === 'string' && config.prefa) {
            if (body.startsWith(config.prefa)) { prefix = config.prefa; CMD = true; }
        }

        const command = CMD ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args    = CMD ? body.slice(prefix.length).trim().split(' ').slice(1) : [];
        const text    = args.join(' ');

        /* JID HELPERS */
        // cleanJid — strip device suffix, return null hanya jika benar-benar tidak ada nomor
        // FIX: LID tidak langsung dibuang — biarkan fallback chain yang handle
        const cleanJid = (jid) => {
            if (!jid) return null;
            // LID: return null agar caller bisa fallback ke sumber lain
            if (jid.includes('@lid') || jid.includes('@s.lid')) return null;
            const num = (jid.split('@')[0]).split(':')[0].replace(/[^0-9]/g, '');
            return num ? num + '@s.whatsapp.net' : null;
        };

        // isLid — via jid-utils (centralized)
        const { forceJid: _forceJid } = require('./src/lib/jid-utils.js');

        const getCorrectSender = (m) => {
            // FIX: di PV, sender SELALU = remoteJid (bukan bot ID)
            // Bot ID hanya dipakai untuk eval (fromMe=true di PV)
            if (!m.isGroup) {
                return cleanJid(m.key.remoteJid) || cleanJid(m.sender);
            }
            // Grup: pakai participant
            return cleanJid(m.key?.participantAlt) || cleanJid(m.key?.participant) || cleanJid(m.sender);
        };

        const getCorrectFrom = (m) => m.key.remoteJid;

        /* JID PARSING */
        const botJid = cleanJid(manzxy.user.id);
        const botNum = normalizeNum(manzxy.user.id);
        const from   = getCorrectFrom(m);

        /* ── Resolve sender JID ────────────────────────────────
         * Perlu 2 JID berbeda:
         *   senderJid → siapa yang kirim pesan (untuk DB, display)
         *   ownerJid  → untuk isOwn check (pastikan bukan bot JID)
         *
         * Di PV (tidak isGroup):
         *   fromMe=false → remoteJid = pengirim, BUKAN bot
         *   fromMe=true  → bot yang kirim sendiri (eval mode)
         *
         * Di Grup:
         *   participant / participantAlt = JID anggota yang kirim
         * ─────────────────────────────────────────────────── */

        let senderJid;

        if (m.isGroup) {
            // Grup: smsg sudah resolve participantAlt → m.sender
            // Prioritas: m.sender (sudah clean) → participantAlt raw → participant
            // m.sender dari smsg SELALU clean JID (bukan LID) jika participantAlt ada
            senderJid = cleanJid(m.sender)
                     || cleanJid(m.key?.participantAlt)
                     || cleanJid(m.key?.participant)
                     || cleanJid(m.participant)
                     || m.sender
                     || '';
        } else {
            // PV
            if (m.key.fromMe) {
                senderJid = botJid; // eval mode
            } else {
                // smsg sudah resolve: m.sender = cleanJid(remoteJid) untuk PV
                // Kalau masih LID (Baileys gagal decode), kita strip angka sebagai last resort
                // tapi validasi panjang nomor (min 10 digit) agar LID angka tidak lolos
                const _clean = cleanJid(m.sender) || cleanJid(m.key.remoteJid);
                if (_clean) {
                    senderJid = _clean;
                } else {
                    // Benar-benar LID dan tidak bisa di-resolve
                    // Ambil angka tapi validasi — nomor WA valid min 10 digit
                    const _raw   = m.sender || m.key.remoteJid || '';
                    const _digits = _raw.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
                    senderJid = (_digits.length >= 10 && _digits.length <= 15)
                        ? _digits + '@s.whatsapp.net'
                        : ''; // nomor tidak valid (LID digit terlalu panjang/pendek)
                }
            }
        }

        // Pastikan senderJid tidak null
        if (!senderJid) senderJid = m.sender || m.key.remoteJid || '';
        const senderNum = normalizeNum(senderJid);

        /* ── Owner & Premium cache ─────────────────────────── */
        const Owner   = _ownerCache;
        const Premium = _premiumCache;

        /* ── isOwn check ───────────────────────────────────────
         * 3 cara jadi owner:
         *   1. Nomor ada di config.owner atau ownerCache DB
         *   2. m.key.fromMe = true di PV (owner kirim ke bot sendiri)
         *   3. Jadibot: sender = ownerNum jadibot yang terdaftar
         * ─────────────────────────────────────────────────── */
        const _ownerNums = [...Owner, ...config.owner].map(normalizeNum).filter(Boolean);


        // Jadibot owner: sock._jadibotOwner.ownerNum
        // FIX: validasi panjang — LID digit > 15 dianggap invalid
        const _jadibotOwnerRaw = manzxy._jadibotOwner?.ownerNum
            ? normalizeNum(manzxy._jadibotOwner.ownerNum)
            : null;
        const _jadibotOwnerNum = (_jadibotOwnerRaw && _jadibotOwnerRaw.length >= 10 && _jadibotOwnerRaw.length <= 15)
            ? _jadibotOwnerRaw
            : null;

        // Apakah ini jadibot? (bukan bot utama)
        const _isJadiBot = !!manzxy._jadibotOwner;

        // isBotSelf: pesan dari nomor bot itu sendiri
        // Bisa akses semua fitur biasa, tapi TIDAK bisa owner-only & eval (>, =>, $)
        const isBotSelf = m.key.fromMe && (senderNum === botNum || (!senderNum && m.key.fromMe));

        let isOwn = false;
        // SECURITY: fromMe di GRUP tidak otomatis owner (bisa spoofed via inject/reflection)
        // fromMe di PV aman — ini berarti owner chat ke bot sendiri
        if (m.key.fromMe && !m.isGroup && !isBotSelf) {
            // Owner kirim ke bot sendiri (bukan bot kirim ke diri sendiri)
            isOwn = true;
        } else if (senderNum) {
            isOwn = _ownerNums.includes(senderNum)
                 || (_jadibotOwnerNum && senderNum === _jadibotOwnerNum);
        }
        // Guard: sender kosong atau masih LID setelah smsg() → tidak proses
        if (!senderJid || senderJid.includes('@lid')) return;

        // FALLBACK isOwn: jika senderNum gagal/LID, coba sumber lain
        // Filter: hanya nomor valid 10-15 digit (bukan LID angka panjang)
        if (!isOwn && !m.isGroup && !m.key.fromMe) {
            const _validNum = (raw) => {
                if (!raw) return '';
                if (!raw || raw.includes('@lid') || raw.includes('@s.lid')) return '';
                const n = normalizeNum(raw);
                return (n.length >= 10 && n.length <= 15) ? n : '';
            };
            const _fallbackNums = [m.sender, m.key.remoteJid]
                .map(_validNum).filter(Boolean);

            for (const fn of _fallbackNums) {
                if (_ownerNums.includes(fn) || (_jadibotOwnerNum && fn === _jadibotOwnerNum)) {
                    isOwn = true;
                    if (!senderNum || !senderJid) {
                        senderJid = fn + '@s.whatsapp.net';
                    }
                    break;
                }
            }
        }

        const isPrem = senderNum
            ? ([...Premium, ..._ownerNums].includes(senderNum)
               || (_jadibotOwnerNum && senderNum === _jadibotOwnerNum))
            : false;

        // DEBUG: aktifkan untuk trace masalah owner
        if (process.env.DEBUG_OWNER === '1') {
            console.log('[OWNER CHECK]', {
                senderJid, senderNum, isOwn, isPrem,
                fromMe: m.key.fromMe, isGroup: m.isGroup,
                remoteJid: m.key.remoteJid,
                smsgSender: m.sender,
                jadibotOwner: _jadibotOwnerNum,
                ownerNums: _ownerNums,
            });
        }

        /* PUBLIC CHECK */
        // Jadibot selalu public (sock.public=true diset di jadibot.js)
        // Bot utama: ikut setting config (public/self)
        // FIX: m.key.fromMe di PV = owner yang kirim sendiri, selalu lolos
        if (!manzxy.public && !_isJadiBot && !isBotSelf && !CreatorOnly && !isOwn) return;

        /* DATABASE */
        const user = getUser(senderJid);

        let groupData = null;
        if (m.isGroup) groupData = getGroup(from);

        /* BANNED CHECK */
        if (user.banned && !isOwn) {
            return manzxy.sendMessage(m.chat, { text: '🚫 Kamu sedang dibanned.' }, { quoted: m });
        }

        /* ANTI-SPAM / COOLDOWN — owner & premium bebas cooldown */
        if (CMD && !isOwn && !isPrem) {
            const now       = Date.now();
            const lastCmd   = cooldownMap.get(senderJid) || 0;
            const sisaWaktu = COOLDOWN_DURATION - (now - lastCmd);
            if (sisaWaktu > 0) {
                const detik = Math.ceil(sisaWaktu / 1000);
                return manzxy.sendMessage(m.chat, {
                    text: `⏳ Spam terdeteksi! Tunggu *${detik} detik* lagi.`
                }, { quoted: m });
            }
            cooldownMap.set(senderJid, now);
        }

        /* QUOTED MESSAGE */
        let quoted = m.quoted || m;
        if (quoted.mtype === 'buttonsMessage') {
            quoted = quoted[Object.keys(quoted)[1]];
        } else if (quoted.mtype === 'templateMessage') {
            quoted = quoted.hydratedTemplate?.[Object.keys(quoted.hydratedTemplate)[1]];
        } else if (quoted.mtype === 'product') {
            quoted = quoted[Object.keys(quoted)[0]];
        }

        /* GROUP INFO & ADMIN DETECTION */
        const pushname = m.pushName || "No Name";

        let groupMetadata = null;
        let groupName     = "";
        let participants  = [];
        let groupAdmin    = [];
        let botAdmin      = false;
        let isAdmin       = false;

        if (m.isGroup) {
            try {
                groupMetadata = await getGroupMetaCached(manzxy, from);
                groupName     = groupMetadata.subject || "";
                participants  = groupMetadata.participants || [];

                // FIX: getParticipantNum — prioritas phoneNumber, fallback id non-LID, resolve LID via map
                const getParticipantNum = (p) => {
                    // forceJid: resolve LID → JID → normalizeNum
                    const jid = _forceJid(p.id, participants);
                    if (jid) return normalizeNum(jid);
                    if (p.phoneNumber) {
                        const n = String(p.phoneNumber).replace(/[^0-9]/g, '');
                        if (n.length >= 10 && n.length <= 15) return n;
                    }
                    return '';
                };

                // FIX: senderRaw pakai participantAlt dulu (tidak pernah LID)
                const _senderRawAlt = m.key?.participantAlt;
                const senderRaw     = (_senderRawAlt && _senderRawAlt.includes('@s.whatsapp.net'))
                    ? _senderRawAlt
                    : (m.key?.participant || m.sender || '');
                const _senderNum = normalizeNum(senderRaw);

                const adminParticipants = participants.filter(p => p.admin !== null && p.admin !== undefined);

                groupAdmin = adminParticipants.map(p => {
                    return _forceJid(p.id, participants) || null;
                }).filter(Boolean);

                isAdmin = adminParticipants.some(p => {
                    const pNum = getParticipantNum(p);
                    return pNum && _senderNum && pNum === _senderNum;
                });

                botAdmin = adminParticipants.some(p => {
                    const pNum = getParticipantNum(p);
                    return pNum && botNum && pNum === botNum;
                });

            } catch (err) {
                logger.error('[GROUP META ERROR]', err.message);
            }
        }

        /* ── MUTE CHECK ─────────────────────────────────────────────
           Bot diam di grup ini, kecuali owner/admin */
        if (CMD && m.isGroup && groupData?.mute && !isOwn && !isAdmin) {
            return; // diam saja
        }

        /* ADMINONLY CHECK */
        if (m.isGroup && groupData?.adminonly && !isAdmin && !isOwn) {
            return manzxy.sendMessage(m.chat, {
                text: "🔒 Mode AdminOnly aktif!\nHanya admin yang bisa menggunakan fitur."
            }, { quoted: m });
        }

        /* MUTE CHECK di private - skip (mute hanya berlaku untuk grup) */

        /* ANTILINK LISTENER */
        try {
            const antilinkMod = require("./src/plugins/cjs/group-antilink.js");
            await antilinkMod.listener(m, { manzxy, isAdmin, isOwn, botAdmin, from });
        } catch {}

        try {
            const antilinkGcMod = require("./src/plugins/cjs/group-antilinkgc.js");
            await antilinkGcMod.listener(m, { manzxy, isAdmin, isOwn, botAdmin, from, participants });
        } catch {}

        /* ── SEWABOT: INTERCEPTOR LINK GRUP (non-command) ──────────
         * Jika user ada di state waitLink, APAPUN yang dikirim (dengan
         * atau tanpa prefix) yang mengandung link WA grup → langsung proses.
         * Ini menangani kasus: user kirim link saja tanpa command apapun.
         * Tidak berlaku untuk jadibot (mainOnly).
         */
        if (!_isJadiBot && !m.fromMe && !m.isGroup) {
            const _rawBody = m.body || '';
            const _linkMatch = _rawBody.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
            if (_linkMatch) {
                try {
                    const _db2 = require('./src/lib/database.js');
                    const _pending = _db2.sewaPendingGet(senderJid);
                    if (_pending?.step === 'waitLink') {
                        // Ada link + user dalam state waitLink → langsung join
                        const _sewaMod = require('./src/plugins/cjs/main-sewabot.js');
                        if (typeof _sewaMod._joinAndActivate === 'function') {
                            await manzxy.sendMessage(m.chat,
                                { text: '⏳ Mencoba join grup...' }, { quoted: m }
                            );
                            await _sewaMod._joinAndActivate(
                                manzxy, senderJid, _linkMatch[1], _pending,
                                (teks) => manzxy.sendMessage(m.chat, { text: teks }, { quoted: m })
                            );
                            return; // selesai — jangan proses sebagai command
                        }
                    }
                } catch (_e) {
                    // Jangan crash handler utama karena error di interceptor
                }
            }
        }

        /* NON-PREFIX SESSION INTERCEPTOR
         * Tangkap input tanpa prefix untuk plugin yang butuh state/session
         */
        if (!m.fromMe && !CMD) {
            const _sessionPlugins = ['./src/plugins/cjs/tools-snippet.js'];
            for (const _sp of _sessionPlugins) {
                try {
                    const _mod = require(_sp);
                    if (typeof _mod._handleSession === 'function') {
                        const _handled = await _mod._handleSession(
                            senderJid, m.body || '',
                            (teks) => manzxy.sendMessage(m.chat, { text: teks }, { quoted: m })
                        );
                        if (_handled) return;
                    }
                } catch {}
            }
        }

        /* REPLY FUNCTION */
        const reply = (teks) =>
            manzxy.sendMessage(m.chat, { text: teks }, { quoted: m });

        /* TIME & DATE */
        const time = moment().tz("Asia/Jakarta").format("HH:mm:ss");
        const todayDateWIB = new Date().toLocaleDateString('id-ID', {
            timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric'
        });

        const RunTime    = `_${runtime(process.uptime())}_`;
        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

        /* LOGGING */
        if (CMD) {
            // CMD log — tampilkan info pesan masuk
            if (m.isChannel) {
                // Pesan dari channel/newsletter
                const chName = m.chat.split('@')[0];
                logger.box(`📢 ${chName}`, '#e91e63', [
                    `📅 ${chalk.cyan('Date')}    : ${todayDateWIB}  🕐 ${chalk.cyan('Time')} : ${time}`,
                    `📢 ${chalk.cyan('Channel')} : ${chalk.magenta(m.chat)}`,
                    `📝 ${chalk.yellow('.'+command)}${args.length ? chalk.gray('  '+args.join(' ')) : ''}`,
                ]);
            } else if (m.isGroup) {
                logger.box(`📱 ${groupName}`, '#3498db', [
                    `📅 ${chalk.cyan('Date')}    : ${todayDateWIB}  🕐 ${chalk.cyan('Time')} : ${time}`,
                    `🌐 ${chalk.cyan('Group')}   : ${groupName}`,
                    `🗣️  ${chalk.cyan('Sender')}  : ${pushname} (${chalk.gray(senderNum)})`,
                    `📝 ${chalk.yellow('.'+command)}${args.length ? chalk.gray('  '+args.join(' ')) : ''}`,
                ]);
            } else {
                logger.box(`🔒 ${pushname}`, '#9b59b6', [
                    `📅 ${chalk.cyan('Date')}    : ${todayDateWIB}  🕐 ${chalk.cyan('Time')} : ${time}`,
                    `🗣️  ${chalk.cyan('Sender')}  : ${pushname} (${chalk.gray(senderNum)})`,
                    `📝 ${chalk.yellow('.'+command)}${args.length ? chalk.gray('  '+args.join(' ')) : ''}`,
                ]);
            }
        }

        /* INIT PLUGINS — panggil hanya jika belum siap */
        if (!_pluginsReady) {
            await _initPlugins();
            if (!_pluginsReady) return; // masih gagal init, skip
        }

        const handleData = {
            manzxy, m, text, args,
            isOwn, isPrem, CMD, command, reply,
            isAdmin, botAdmin,
            from, senderJid, senderNum, botJid, botNum,
            groupMetadata, participants, groupAdmin, groupData,
            user,
            pushname,
            quoted,
            store,                  // in-memory store (contacts, messages, chats)
isJadiBot: _isJadiBot,  // true jika request dari jadibot (bukan bot utama)
            isBotSelf,              // true jika pesan dari nomor bot sendiri (bukan owner)
        };

        /* ============================================================
           LIMIT CHECK — berlaku untuk CJS & ESM (all roles)
           Owner & Premium (file premium.json) & user.premium (db) = BEBAS LIMIT
           ============================================================ */
        let usedLimit    = false;
        let limitCost    = 1;
        let targetPlugin = null;

        if (CMD && _pluginsReady) {
            try {
                // Cache hasil scan plugins — tidak perlu scan ulang tiap pesan
                if (!global._pluginScanCache || Date.now() - (global._pluginScanCacheTs || 0) > 30_000) {
                    global._pluginScanCache   = await scanAllPlugins();
                    global._pluginScanCacheTs = Date.now();
                }
                const allPlugins = global._pluginScanCache;

                targetPlugin = allPlugins.find(plug => {
                    const cmds = Array.isArray(plug.command) ? plug.command : [plug.command];
                    return cmds.map(c => String(c).toLowerCase()).includes(command);
                });

                // Limit check: berlaku jika bukan owner, bukan premium (file), bukan premium (db)
                // isBotSelf tidak bisa jalankan plugin owner-only (berbahaya)
                if (targetPlugin?.owner && isBotSelf && !isOwn) {
                    return reply('⛔ Command ini hanya bisa dijalankan oleh owner asli.');
                }

                if (targetPlugin?.limit && !isOwn && !isPrem && !user.premium) {
                    const cost = targetPlugin.limitCost || 1;
                    if (user.limit < cost) {
                        return reply(
`⚠️ *Limit kamu sudah habis!*

Sisa limit    : *${user.limit}*
Biaya command : *${cost}*

Limit reset otomatis setiap 12 jam.`
                        );
                    }
                    usedLimit = true;
                    limitCost = cost;
                }
            } catch (e) {
                logger.warn('[LIMIT CHECK]', e.message);
            }
        }

        /* ============================================================
           EXECUTE PLUGIN — CJS & ESM paralel (lebih cepat)
           ============================================================ */

        /* mainOnly check — plugin dengan handler.mainOnly = true
         * tidak boleh dijalankan dari jadibot, hanya dari bot utama.
         * Ini mencegah user menjalankan .jadibot/.stopjadibot/dll dari jadibot.
         */
        if (CMD && _isJadiBot && targetPlugin?.mainOnly) {
            // Beri tahu user bahwa fitur ini hanya bisa dari bot utama
            // Sertakan nomor bot utama agar user tahu harus chat ke mana
            const _mainNum = (() => {
                try {
                    const { config } = require('./config.js');
                    const n = String(config.owner?.[0] || '').replace(/[^0-9]/g, '');
                    return n.length >= 10 ? n : null;
                } catch { return null; }
            })();
            const _mainSock = global.mainSock;
            const _mainBotNum = (() => {
                if (!_mainSock?.user?.id) return null;
                const n = (_mainSock.user.id).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                return n.length >= 10 ? n : null;
            })();
            const _botLine = _mainBotNum
                ? `\n🤖 *Bot utama* : wa.me/${_mainBotNum}`
                : '';
            return reply(
                `⛔ *Fitur ini hanya tersedia di bot utama.*\n` +
                `Jadibot tidak bisa menjalankan perintah ini.${_botLine}`
            );
        }

        let success = false;

        if (CMD && _pluginsReady) {
            // Jalankan CJS & ESM paralel
            const [cjsResult, esmResult] = await Promise.allSettled([
                _cjsHandler(m, command, handleData).catch(e => {
                    logger.error('[CJS]', e.message); return false;
                }),
                _esmHandler(m, command, handleData).catch(e => {
                    logger.error('[ESM]', e.message); return false;
                })
            ]);

            // Kedua handler sekarang return true jika plugin berhasil dijalankan
            if (cjsResult.status === 'fulfilled' && cjsResult.value === true) success = true;
            if (esmResult.status === 'fulfilled' && esmResult.value === true) success = true;
        }

        // Kurangi limit + kirim notif sisa limit setelah command selesai
        if (usedLimit && success) {
            user.limit -= limitCost;
            // Simpan ke DB
            try { _db.saveUser(senderJid, user); } catch {}

            // Notif sisa limit (kirim ke user setelah plugin selesai)
            const remaining = user.limit;
            const _limitMsg =
                remaining <= 0
                    ? `\n\n⚠️ *Limitmu habis!*\nLimit reset otomatis 12 jam lagi.`
                    : `\n\n🔢 *Limit terpakai* ${limitCost > 1 ? `(${limitCost}x)` : ''}\n💳 Sisa limit: *${remaining}*`;
            try { await manzxy.sendMessage(m.chat, { text: _limitMsg }, { quoted: m }); } catch {}
        }

        /* ============================================================
           SWITCH COMMAND
           ============================================================ */
        switch (command) {

            case "totalfitur": {
                const cjsDir = path.join(process.cwd(), "src/plugins/cjs");
                const esmDir = path.join(process.cwd(), "src/plugins/esm");
                const add    = (obj, tag, cmd) => { if (!obj[tag]) obj[tag] = []; obj[tag].push(cmd); };

                const cjsCategory = {};
                const esmCategory = {};

                let totalCjsFile = 0;
                if (fs.existsSync(cjsDir)) {
                    const files = fs.readdirSync(cjsDir).filter(f => f.endsWith(".js"));
                    totalCjsFile = files.length;
                    for (const file of files) {
                        try {
                            delete require.cache[require.resolve(path.join(cjsDir, file))];
                            const plugin = require(path.join(cjsDir, file));
                            const cmds = plugin.command;
                            const tags = plugin.tags || ["others"];
                            if (cmds) {
                                const list = Array.isArray(cmds) ? cmds : [cmds];
                                list.forEach(cmd => tags.forEach(tag => add(cjsCategory, tag, cmd)));
                            }
                        } catch {}
                    }
                }

                let totalEsmFile = 0;
                if (fs.existsSync(esmDir)) {
                    const files = fs.readdirSync(esmDir).filter(f => f.endsWith(".mjs"));
                    totalEsmFile = files.length;
                    for (const file of files) {
                        try {
                            const plugin = await import(path.join(esmDir, file));
                            const mod    = plugin.default || plugin;
                            const cmds   = mod.command;
                            const tags   = mod.tags || ["others"];
                            if (cmds) {
                                const list = Array.isArray(cmds) ? cmds : [cmds];
                                list.forEach(cmd => tags.forEach(tag => add(esmCategory, tag, cmd)));
                            }
                        } catch {}
                    }
                }

                const countTotal = obj => Object.values(obj).reduce((a, b) => a + b.length, 0);
                const cjsTotal   = countTotal(cjsCategory);
                const esmTotal   = countTotal(esmCategory);

                const formatTagStats = (title, obj) => {
                    let t = `\n📂 ${title}\n`;
                    if (!Object.keys(obj).length) return t + "  (kosong)\n";
                    Object.keys(obj).sort().forEach(tag => { t += `  • ${tag} : ${obj[tag].length}\n`; });
                    return t;
                };

                let teks =
`📊 *TOTAL FITUR BOT*

🔹 PLUGIN CJS
• Total File    : ${totalCjsFile}
• Total Command : ${cjsTotal}

🔹 PLUGIN ESM
• Total File    : ${totalEsmFile}
• Total Command : ${esmTotal}

━━━━━━━━━━━━━━━━━━
🔥 TOTAL SEMUA FITUR : ${cjsTotal + esmTotal}
`;
                teks += formatTagStats("Kategori CJS", cjsCategory);
                teks += formatTagStats("Kategori ESM", esmCategory);
                reply(teks);
                break;
            }

            case "adminonly": {
                if (!m.isGroup) return reply("❌ Khusus group");
                if (!isAdmin && !isOwn) return reply("❌ Admin group only!");

                if (args[0] === "on") {
                    groupData.adminonly = true;
                    reply("✅ AdminOnly berhasil diaktifkan");
                } else if (args[0] === "off") {
                    groupData.adminonly = false;
                    reply("❌ AdminOnly berhasil dimatikan");
                } else {
                    reply(`Status AdminOnly: ${groupData.adminonly ? "ON ✅" : "OFF ❌"}`);
                }
                break;
            }

            default: {
                // Eval (=>) — owner asli only, BUKAN isBotSelf
                if (budy.startsWith('=>') && isOwn && !isBotSelf) {
                    try {
                        const code   = budy.slice(2);
                        const result = await eval(`(async () => { return ${code} })()`);
                        await m.reply(util.format(result));
                    } catch (e) { await m.reply(`❌ Error:\n${e.message}`); }
                }
                // Eval (>) — owner asli only, BUKAN isBotSelf
                else if (budy.startsWith('>') && isOwn && !isBotSelf) {
                    try {
                        let evaled = await eval(budy.slice(1));
                        if (typeof evaled !== 'string') evaled = util.inspect(evaled, { depth: 1 });
                        await m.reply(evaled);
                    } catch (e) { await m.reply(`❌ Error:\n${e.message}`); }
                }
                // Shell ($) — owner asli only, BUKAN isBotSelf
                else if (budy.startsWith('$') && isOwn && !isBotSelf) {
                    const { error, stdout, stderr } = await execWithTimeout(budy.slice(1), 15000);
                    if (error)  return m.reply(`❌ Error:\n${error.message}`);
                    if (stderr) return m.reply(`⚠️ stderr:\n${stderr}`);
                    if (stdout) return m.reply(`📤 stdout:\n${stdout}`);
                    return m.reply('✅ Command executed (no output)');
                }
                // isBotSelf mencoba eval/exec → diam saja (jangan reply, hindari loop)
                break;
            }
        }

    } catch (error) {
        logger.error('[HANDLER]', error.message || error);
        try {
            if (m?.chat) {
                await manzxy.sendMessage(m.chat, { text: `❌ Error:\n${error.message}` }, { quoted: m });
            }
        } catch (sendError) {
            logger.error('[SEND ERR]', sendError.message);
        }
    }
};