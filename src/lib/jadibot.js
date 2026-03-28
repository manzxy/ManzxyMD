/**
 * src/lib/jadibot.js — JadiBot Engine v6
 *
 * FIXES v6:
 *  - loginTimer: track via Map per-number → tidak ada ghost timer dari iterasi lama
 *  - reconnectCount: track via Map per-number (bukan closure entry) → backoff efektif
 *  - ownerJid: strip LID/port saat simpan, fallback dari ownerNum
 *  - connection mati terus: keepAlive 30s, retryDelay 3s, maxRetry 5
 *  - "close before open" guard: pakai creds.registered bukan sessionExists
 *  - 401 saat pairing bukan fatal (hanya fatal jika _everConnected)
 */

'use strict';

const {
default: makeWASocket,
    jidDecode,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const chalk  = require('chalk');
const pino   = require('pino');
// Logger: coba require dulu, fallback ke global._logger, terakhir ke console
let logger;
try {
    logger = require('../core/logger.js');
} catch {
    logger = global._logger || {
        info:    (...a) => console.log('[INFO]',    ...a),
        success: (...a) => console.log('[OK]',      ...a),
        warn:    (...a) => console.warn('[WARN]',   ...a),
        error:   (...a) => console.error('[ERROR]', ...a),
        jb:      (...a) => console.log('[JB]',      ...a),
        channel: (...a) => console.log('[CH]',      ...a),
        mem:     (...a) => console.log('[MEM]',     ...a),
    };
}

const { smsg, sleep }  = require('../core/message.js');
const { config }       = require('../../config.js');
const { useJsonAuthState, sessionExists, deleteSession, listSessions }
                        = require('./json-session.js');

const _pinoLogger = pino({ level: 'silent' });

/* ── DB lazy ──────────────────────────────────────────────────── */
const DB        = () => require('./database.js');
const _regSave  = ()          => { try { DB().jadibotRegistrySave(global.jadiBotSockets); } catch {} };
const _regLoad  = ()          => { try { return DB().jadibotRegistryLoad(); } catch { return []; } };
const _stopSave = (num, info) => { try { DB().jadibotStoppedSave(num, { ...info, stoppedAt: Date.now() }); } catch {} };
const _stopDel  = (num)       => { try { DB().jadibotStoppedDelete(num); } catch {} };
const _stopLoad = ()          => { try { return DB().jadibotStoppedLoad(); } catch { return {}; } };
const _limLoad  = ()          => { try { return DB().jadibotLimitsLoad(); } catch { return { free: 2, premium: 5, global: 20 }; } };
const _limSave  = (obj)       => { try { DB().jadibotLimitsSave(obj); } catch {} };

/* ── Newsletter config ───────────────────────────────────────── */
function _getNewsletterIds() {
    try {
        const raw = DB().getSetting('jadibot_newsletter');
        if (!raw) return [];
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    } catch { return []; }
}
function _setNewsletterIds(ids) {
    try { DB().setSetting('jadibot_newsletter', ids.join(',')); } catch {}
}

/* ── Global state ────────────────────────────────────────────── */
global.jadiBotSockets   = global.jadiBotSockets || new Map();
global.jadibotLimits    = global.jadibotLimits  || _limLoad();

// Track login timers & reconnect counts per-number (bukan per-closure)
// Ini memastikan ghost timer dari iterasi reconnect lama tidak fire
const _loginTimers   = new Map(); // number → timeoutId
const _reconnectNums = new Map(); // number → reconnectCount
const _stopped       = new Set();

/* ── Helpers ─────────────────────────────────────────────────── */
const mainSend = (jid, text) => {
    if (!global.mainSock || !jid) return;
    return global.mainSock.sendMessage(jid, { text }).catch(() => {});
};

/**
 * cleanJid — strip port (:xx), strip LID (@lid/@s.lid)
 * Kembalikan format "628xxx@s.whatsapp.net" atau null jika tidak valid
 */
function cleanJid(raw) {
    if (!raw) return null;
    const s = String(raw);
    // Tolak semua LID
    if (s.includes('@lid') || s.includes('@s.lid')) return null;
    // Strip port (628xxx:6@s.whatsapp.net → 628xxx@s.whatsapp.net)
    const base = s.split(':')[0];
    const num  = base.split('@')[0].replace(/[^0-9]/g, '');
    if (num.length < 10 || num.length > 15) return null;
    return num + '@s.whatsapp.net';
}

function numOnly(raw) {
    const n = String(raw || '').replace(/[^0-9]/g, '');
    return (n.length >= 10 && n.length <= 15) ? n : null;
}

/* ── Expose globals ──────────────────────────────────────────── */
global.getJadibotNewsletters = _getNewsletterIds;
global.setJadibotNewsletters = _setNewsletterIds;

/* ═══════════════════════════════════════════════════════════════
   DISCONNECT CLASSIFIER
   401 = loggedOut — HANYA fatal jika sudah pernah berhasil connect
         (saat pairing, WA normal kirim 401 sebagai bagian flow)
   403 = banned → selalu fatal
   440 = multidevice mismatch → selalu fatal
   515 = stream restart → reconnect delay lebih lama
═══════════════════════════════════════════════════════════════ */
function classifyDisconnect(code, everConnected) {
    if (code === 440) return 'fatal';
    if (code === 403) return 'fatal';
    // 401/loggedOut: fatal HANYA jika sudah pernah konek (sesi valid lalu logout)
    // Saat login baru (QR atau pairing), 401 = normal WA flow → reconnect saja
    if (code === 401 || code === DisconnectReason.loggedOut)
        return everConnected ? 'fatal' : 'reconnect';
    if (code === 515) return 'restart';
    return 'reconnect';
}

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY STORE per jadibot (minimal, cukup untuk plugin)
═══════════════════════════════════════════════════════════════ */
function makeStore() {
    const contacts = {}, messages = {}, chats = {};
    return {
        contacts, messages, chats,
        bind(ev) {
            ev.on('contacts.upsert', list => {
                    for (const ct of list) {
                        if (!ct.id?.includes('@lid')) continue;
                        const { resolveLid } = require('./jid-utils.js');
                        const jid = resolveLid(ct.id, [ct]);
                        if (jid) {
                            global._lidToJidMap = global._lidToJidMap || {};
                            global._lidToJidMap[ct.id] = jid;
                        }
                    }
                });
            ev.on('contacts.update', list => {
                for (const c of list) {
                    if (c.id) contacts[c.id] = { ...(contacts[c.id] || {}), ...c };
                }
            });
            ev.on('chats.upsert', l => { for (const c of l) chats[c.id] = { ...(chats[c.id] || {}), ...c }; });
            ev.on('chats.update', l => { for (const c of l) if (c.id) chats[c.id] = { ...(chats[c.id] || {}), ...c }; });
            ev.on('messages.upsert', ({ messages: msgs }) => {
                for (const m of msgs) {
                    const jid = m.key?.remoteJid;
                    if (!jid) continue;
                    if (!messages[jid]) messages[jid] = [];
                    messages[jid].push(m);
                    if (messages[jid].length > 20) messages[jid].shift();
                    if (m.key?.addressingMode === 'lid'
                        && m.key.participant?.includes('@lid')
                        && m.key.participantAlt?.includes('@s.whatsapp.net')) {
                        global._lidToJidMap = global._lidToJidMap || {};
                        global._lidToJidMap[m.key.participant] = m.key.participantAlt;  // cache internal saja
                    }
                }
            });
        },
        loadMessage: (jid, id) => (messages[jid] || []).find(m => m.key?.id === id) || null,
    };
}

/* ═══════════════════════════════════════════════════════════════
   START JADIBOT
═══════════════════════════════════════════════════════════════ */
async function startJadiBot(number, method = 'pairing', notifJid = null, ownerInfo = {}) {

    if (_stopped.has(number)) return;

    if (global.jadiBotSockets.has(number)) {
        const e = global.jadiBotSockets.get(number);
        if (e.connected) {
            if (notifJid) mainSend(notifJid, `⚠️ *+${number}* sudah aktif!`);
            return;
        }
        // Masih di map tapi belum connected — bersihkan dulu
        global.jadiBotSockets.delete(number);
    }

    // Bersihkan ownerJid dari LID — simpan nomor bersih saja
    const _ownerNum = numOnly(ownerInfo.ownerNum);
    const _ownerJid = cleanJid(ownerInfo.ownerJid)
        || (_ownerNum ? _ownerNum + '@s.whatsapp.net' : null);
    const _ownerRole = ownerInfo.ownerRole || 'free';

    // Auto-resume tanpa session → notif owner
    if (!notifJid && !sessionExists(`session/jadibot/${number}`)) {
        if (_ownerJid) mainSend(_ownerJid,
            `❌ *JadiBot +${number}* tidak bisa resume — session tidak ada.\n*.jadibot ${number}* — daftar ulang`
        );
        return;
    }

    logger.jb(`[JB] +${number} memuat session...`);

    let state, saveCreds;
    try {
        ({ state, saveCreds } = await useJsonAuthState(`session/jadibot/${number}`));
    } catch (e) {
        const tgt = notifJid || _ownerJid;
        if (tgt) mainSend(tgt, `❌ Gagal load session *+${number}*: ${e.message}`);
        return;
    }

    // creds.registered = sudah pernah login sebelumnya (pakai resume, tidak perlu pairing ulang)
    const isResuming = !!state.creds.registered;
    logger.jb(`[JB] +${number} session ${isResuming ? 'resume' : 'login baru'} (${method})`);

    let version;
    try {
        // Timeout 5s — jika lambat/offline, pakai versi fallback langsung
        const _fetchVer = fetchLatestBaileysVersion();
        const _timeout  = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
        ({ version } = await Promise.race([_fetchVer, _timeout]));
    } catch {
        version = [2, 3000, 1021356099]; // fallback version — stabil
    }

    logger.jb(`[JB] +${number} menghubungkan ke WA...`);

    const sock = makeWASocket({
        version,
        logger: _pinoLogger,
        printQRInTerminal:              false,
        connectTimeoutMs:               60_000,  // timeout 60s kalau gagal konek
        defaultQueryTimeoutMs:          20_000,  // query timeout 20s
        syncFullHistory:                false,
        markOnlineOnConnect:            true,
        keepAliveIntervalMs:            30_000,  // 30s lebih stabil
        retryRequestDelayMs:            5_000,   // retry lebih lambat biar tidak spam
        maxMsgRetryCount:               5,       // lebih banyak retry
        generateHighQualityLinkPreview: false,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, _pinoLogger),
        },
    });

    // Jadibot selalu public — semua orang bisa pakai, bukan hanya owner
    sock.public = true;

    // FIX: decodeJid harus ada di socket jadibot — dipakai di smsg() message.js
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/i.test(jid)) {
            try { const d = jidDecode(jid) || {}; return d.user ? `${d.user}@${d.server}` : jid; }
            catch { return jid; }
        }
        return jid;
    };

    const subStore = makeStore();
    subStore.bind(sock.ev);

    const entry = {
        sock,
        store:          subStore,
        number,
        method,
        connected:      false,
        ownerNum:       _ownerNum,
        ownerJid:       _ownerJid,
        ownerRole:      _ownerRole,
        startedAt:      Date.now(),
        _stopped:       false,
        _qrSent:        0,
        _qrReceived:    false,
        _everConnected: isResuming,
        _creds:         state.creds,
    };

    global.jadiBotSockets.set(number, entry);
    _regSave();

    /* ── Login timeout (hanya untuk login baru, bukan resume) ────
     *
     * KRITIS: Simpan timer di _loginTimers Map (bukan closure var).
     * Kenapa: Saat disconnect→reconnect, startJadiBot baru dibuat.
     * Timer lama dari closure sebelumnya tidak bisa di-clear dari
     * startJadiBot baru. Dengan Map, clearLoginTimer(number) dari
     * iterasi manapun selalu clear timer yang benar.
     */
    if (!isResuming) {
        // Clear timer lama jika ada (dari iterasi reconnect sebelumnya)
        clearLoginTimer(number);

        // QR: timeout lebih lama (10 menit) karena user perlu buka WA dulu
        // Pairing: timeout 5 menit cukup
        const timeoutMs = method === 'qr' ? 10 * 60_000 : 5 * 60_000;

        const tid = setTimeout(() => {
            const live = global.jadiBotSockets.get(number);
            if (live?.connected) return;
            if (_stopped.has(number)) return;

            logger.warn(`[JB] +${number} login timeout (${method})`);
            _loginTimers.delete(number);

            if (live) { live._stopped = true; global.jadiBotSockets.delete(number); _regSave(); }
            entry._stopped = true;
            _stopped.add(number);
            try { sock.ws?.close(); } catch {}

            const tgt = notifJid || _ownerJid;
            if (tgt) {
                const hint = method === 'qr'
                    ? 'Scan QR dalam 10 menit tidak dilakukan.'
                    : 'Pastikan sudah masukkan kode pairing di WA.';
                mainSend(tgt,
                    `⏰ *JadiBot +${number} timeout!*\n\n${hint}\n\nCoba lagi: *.jadibot ${number}${method === 'qr' ? ' qr' : ''}*`
                );
            }
            setTimeout(() => _stopped.delete(number), 30_000);
        }, timeoutMs);

        _loginTimers.set(number, tid);
    }

    /* ── Kirim pairing code ──────────────────────────────────── */
    if (!isResuming && method === 'pairing') {
        await sleep(2000);
        if (entry._stopped || _stopped.has(number)) {
            clearLoginTimer(number);
            global.jadiBotSockets.delete(number);
            try { sock.ws?.close(); } catch {}
            return;
        }
        try {
            logger.jb(`[JB] +${number} meminta pairing code...`);
            const code = await sock.requestPairingCode(number);
            logger.jb(`[JB] Pairing code +${number}: ${code}`);
            if (notifJid) mainSend(notifJid,
                `🔗 *Pairing Code JadiBot*\n\n` +
                `Nomor : *+${number}*\nKode  : *${code}*\n\n` +
                `_WhatsApp → Perangkat Tertaut → Tautkan dengan Nomor Telepon_\n\n` +
                `⏰ Kode berlaku *3 menit*\n` +
                `⏳ Setelah masukkan kode, tunggu notif "Bot Aktif"`
            );
        } catch (e) {
            clearLoginTimer(number);
            entry._stopped = true;
            global.jadiBotSockets.delete(number);
            try { sock.ws?.close(); } catch {}
            const tgt = notifJid || _ownerJid;
            if (tgt) mainSend(tgt, `❌ Gagal generate pairing code *+${number}*:\n${e.message}`);
            return;
        }
    }

    /* ═══════════════════════════════════════════════════════
       CONNECTION.UPDATE
    ═══════════════════════════════════════════════════════ */
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (entry._stopped || _stopped.has(number)) return;

        const cur = global.jadiBotSockets.get(number);

        /* QR — kirim ke notifJid tiap kali QR baru muncul, max 3x */
        if (qr && method === 'qr' && !isResuming) {
            logger.jb(`[JB] +${number} QR tersedia — mengirim ke user...`);
            // Sync _qrSent antara entry dan cur (bisa berbeda saat reconnect)
            const sent = Math.max(cur?._qrSent || 0, entry._qrSent || 0);
            if (sent < 3) {
                if (cur) cur._qrSent = sent + 1;
                entry._qrSent = sent + 1;
                const _qrNum = sent + 1;
                if (notifJid && global.mainSock) {
                    try {
                        const QRCode = require('qrcode');
                        const buf = await new Promise((res, rej) =>
                            QRCode.toBuffer(qr, { type: 'png', width: 400 }, (e, b) => e ? rej(e) : res(b))
                        );
                        await global.mainSock.sendMessage(notifJid, {
                            image: buf,
                            caption: `📷 *QR JadiBot +${number}* (${_qrNum}/3)\n\nScan dari WA target!\n⏰ Berlaku 60 detik\n\n_Jika QR expired, QR baru akan dikirim otomatis._`,
                        });
                    } catch {
                        mainSend(notifJid, `⚠️ QR *+${number}* gagal kirim gambar. Scan di terminal server.`);
                    }
                }
                // Set flag: QR sudah dikirim minimal sekali
                if (cur) cur._qrReceived = true;
            }
        }

        /* ── OPEN ─────────────────────────────────────────── */
        if (connection === 'open') {
            // Clear login timer dari Map (bukan closure)
            clearLoginTimer(number);
            // Reset reconnect counter
            _reconnectNums.delete(number);

            let active = global.jadiBotSockets.get(number);
            if (!active) { global.jadiBotSockets.set(number, entry); active = entry; }

            active.sock           = sock;
            active.connected      = true;
            active._stopped       = false;
            active._everConnected = true;
            entry.connected       = true;
            entry._stopped        = false;
            entry._everConnected  = true;

            _stopped.delete(number);
            _regSave();

            logger.success(`[JB] ✓ +${number} online (aktif: ${global.jadiBotSockets.size})`);

            const tgt = notifJid || _ownerJid;
            if (tgt) mainSend(tgt,
                `✅ *JadiBot +${number} AKTIF!*\n\nBot online dan siap menerima pesan.\n\n*.stopjadibot ${number}* — hentikan`
            );
            notifJid = null;

            // Auto-follow newsletter
            setTimeout(async () => {
                const ids = _getNewsletterIds();
                for (const nid of ids) {
                    try { await sock.newsletterFollow(nid); } catch {}
                    await sleep(1000);
                }
            }, 5000);
        }

        /* ── CLOSE ────────────────────────────────────────── */
        if (connection === 'close') {
            const code   = lastDisconnect?.error?.output?.statusCode;
            const errMsg = lastDisconnect?.error?.message || '';

            if (cur) cur.connected = false;
            entry.connected = false;

            logger.warn(`[JB] +${number} disconnect (code: ${code}${errMsg ? ', ' + errMsg : ''})`);

            if (entry._stopped || _stopped.has(number)) return;

            const dcType = classifyDisconnect(code, entry._everConnected);

            /* FATAL */
            if (dcType === 'fatal') {
                clearLoginTimer(number);
                _reconnectNums.delete(number);
                entry._stopped = true;
                _stopped.add(number);
                global.jadiBotSockets.delete(number);
                _regSave();

                if (entry._everConnected) {
                    try { deleteSession(`session/jadibot/${number}`); } catch {}
                    _stopDel(number);
                    if (_ownerJid) mainSend(_ownerJid,
                        `⛔ *JadiBot +${number} logout!* (code ${code})\nSession dihapus.\n*.jadibot ${number}* — daftar ulang`
                    );
                } else {
                    const tgt = notifJid || _ownerJid;
                    if (tgt) mainSend(tgt,
                        `❌ *JadiBot +${number} ditolak WA!* (code ${code})\nCoba lagi: *.jadibot ${number}*`
                    );
                }
                setTimeout(() => _stopped.delete(number), 60_000);
                return;
            }

            /* Belum pernah connect + creds belum registered
             * HANYA berlaku untuk method='pairing' (bukan QR).
             * Untuk QR: creds.registered=false sampai user scan → biarkan reconnect.
             */
            const pairingOk = !!entry._creds?.registered;
            if (method === 'pairing' && !entry._everConnected && !pairingOk) {
                clearLoginTimer(number);
                _reconnectNums.delete(number);
                entry._stopped = true;
                _stopped.add(number);
                global.jadiBotSockets.delete(number);
                _regSave();
                logger.error(`[JB] +${number} pairing gagal (code ${code})`);
                const targets = new Set([_ownerJid, notifJid].filter(Boolean));
                for (const tgt of targets) {
                    mainSend(tgt,
                        `❌ *JadiBot +${number} gagal login!*\n\n` +
                        `Pairing code tidak digunakan atau ditolak WA.\n\n` +
                        `Coba lagi: *.jadibot ${number}*`
                    );
                }
                setTimeout(() => _stopped.delete(number), 30_000);
                return;
            }

            /* QR: jika QR sudah dikirim 3x dan user belum scan → timeout */
            if (method === 'qr' && !entry._everConnected) {
                const qrSent = global.jadiBotSockets.get(number)?._qrSent || 0;
                if (qrSent >= 3) {
                    clearLoginTimer(number);
                    _reconnectNums.delete(number);
                    entry._stopped = true;
                    _stopped.add(number);
                    global.jadiBotSockets.delete(number);
                    _regSave();
                    const tgt = notifJid || _ownerJid;
                    if (tgt) mainSend(tgt,
                        `⏰ *JadiBot +${number} QR timeout!*\n\n` +
                        `Sudah 3x QR dikirim tapi belum di-scan.\n\n` +
                        `Coba lagi: *.jadibot ${number} qr*`
                    );
                    setTimeout(() => _stopped.delete(number), 30_000);
                    return;
                }
                // QR belum dikirim atau masih < 3x → lanjut reconnect (QR baru akan dikirim)
            }

            /* Transient close saat belum pernah open (undefined/515/null)
             * Untuk QR: ini normal — Baileys reconnect sendiri untuk fetch QR
             * Untuk pairing: juga normal sebelum WA kirim pairing code
             * Jangan blocking — langsung lanjut ke reconnect backoff
             */
            if (!entry._everConnected && (code === undefined || code === null || code === 515)) {
                logger.info(`[JB] +${number} transient close (${code})`);
                // Tidak perlu sleep — reconnect backoff di bawah yang handle delay
            }

            /* Cleanup socket SEKARANG sebelum reconnect delay
             * Ini memastikan socket lama tidak akan firing event lagi
             * selama delay reconnect (mencegah double reconnect)
             */
            try { sock.ev.removeAllListeners(); } catch {}
            try { sock.ws?.close?.(); } catch {}

            /* Reconnect backoff — pakai _reconnectNums Map (bukan closure) */
            const attempts = (_reconnectNums.get(number) || 0) + 1;
            _reconnectNums.set(number, attempts);

            const MAX = 15;
            if (attempts > MAX) {
                clearLoginTimer(number);
                _reconnectNums.delete(number);
                entry._stopped = true;
                _stopped.add(number);
                global.jadiBotSockets.delete(number);
                _regSave();
                _stopSave(number, {
                    ownerNum:  cur?.ownerNum  || _ownerNum,
                    ownerJid:  cur?.ownerJid  || _ownerJid,
                    ownerRole: cur?.ownerRole || _ownerRole,
                    method,
                });
                logger.error(`[JB] +${number} menyerah (${MAX}x). Masuk stopped.`);
                if (_ownerJid) mainSend(_ownerJid,
                    `❌ *JadiBot +${number}* gagal reconnect ${MAX}x.\n\nSession aman. Resume: *.startjadibot ${number}*`
                );
                setTimeout(() => {
                    _stopped.delete(number);
                    _reconnectNums.delete(number); // reset counter agar bisa coba lagi
                }, 60_000);
                return;
            }

            // 515 = WA server restart → delay lebih lama
            const delay = dcType === 'restart'
                ? Math.min(15_000 * attempts, 60_000)
                : Math.min(3_000  * attempts, 30_000);

            logger.warn(`[JB] +${number} reconnect #${attempts} in ${(delay/1000).toFixed(1)}s`);

            setTimeout(() => {
                if (entry._stopped || _stopped.has(number)) return;
                if (global.jadiBotSockets.get(number)?.connected) return;

                // Ambil info terbaru dari map sebelum delete
                const saved = global.jadiBotSockets.get(number) || {};
                global.jadiBotSockets.delete(number);

                startJadiBot(number, method, null, {
                    ownerNum:  saved.ownerNum  || _ownerNum,
                    ownerJid:  saved.ownerJid  || _ownerJid,
                    ownerRole: saved.ownerRole || _ownerRole,
                }).catch(e => logger.error(`[JB] Reconnect err +${number}:`, e.message));
            }, delay);
        }
    });

    // Tangkap error WS/session yang menyebabkan force close diam-diam
    sock.ev.on('error', (err) => {
        const _emsg = err?.message || String(err);
        logger.warn(`[JB] +${number} socket error: ${_emsg}`);
        // Stream error fatal → paksa close agar connection.update trigger reconnect
        if (
            _emsg.includes('stream errored') ||
            _emsg.includes('ECONNRESET') ||
            _emsg.includes('ECONNREFUSED') ||
            _emsg.includes('ETIMEDOUT') ||
            _emsg.includes('write EPIPE')
        ) {
            if (entry._stopped || _stopped.has(number)) return;
            try { sock.ev.removeAllListeners(); } catch {}
            try { sock.ws?.close?.(); } catch {}
        }
    });

    sock.ev.on('creds.update', () => {
        // Selalu simpan creds meskipun entry._stopped (creds bisa update saat disconnecting)
        if (entry) entry._creds = state.creds;
        saveCreds().catch(() => {});
    });

    /* Forward pesan ke manzxy.js — HANYA jika bukan command jadibot
     * (jadibot tidak boleh menjalankan .jadibot, .stopjadibot, dll.)
     */
    sock.ev.on('messages.upsert', async chatUpdate => {
        if (entry._stopped || _stopped.has(number)) return;
        const cur = global.jadiBotSockets.get(number);
        if (!cur || cur._stopped) return;
        try {
            const mek = chatUpdate.messages[0];
            if (!mek?.message || mek.key?.remoteJid === 'status@broadcast') return;
            // Resolve LID di participant sebelum handler
            if (mek.key?.participant?.includes('@lid') && mek.key.participantAlt?.includes('@s.whatsapp.net')) {
                global._lidToJidMap = global._lidToJidMap || {};
                global._lidToJidMap[mek.key.participant] = mek.key.participantAlt;
            }

            // Channel/newsletter — skip jika tidak ada command
            const _jbJid     = mek.key?.remoteJid || '';
            const _jbIsCh    = _jbJid.endsWith('@newsletter');
            if (_jbIsCh) {
                const _jbBody = mek.message?.conversation || mek.message?.extendedTextMessage?.text || '';
                const _jbPrfa = config?.prefa || [];
                const _jbPrefArr = Array.isArray(_jbPrfa) ? _jbPrfa : [_jbPrfa];
                const _jbCmd  = _jbPrefArr.some(p => p && _jbBody.startsWith(p));
                if (!_jbCmd) return;
                logger.channel(`[JB CH] +${number} | ${_jbJid} → ${_jbBody.slice(0, 60)}`);
            }
            let m;
            try {
                m = smsg(sock, mek, subStore);
            } catch (smsgErr) {
                logger.warn(`[JB] +${number} smsg error: ${smsgErr.message}`);
                return;
            }
            if (!m) return;
            if (m.fromMe) return;
            // Attach jadibot context — dipakai manzxy.js untuk isOwn & mainOnly check
            sock._jadibotOwner = {
                ownerNum:  entry.ownerNum,
                ownerJid:  entry.ownerJid,
                ownerRole: entry.ownerRole,
                botNumber: number,
            };
            setImmediate(() => {
                require('../../manzxy.js')(sock, m, chatUpdate, subStore)
                    .catch(e => console.error(chalk.red(`[JB MSG] +${number}:`), e.message));
            });
        } catch (e) {
            // "Decrypted message with closed session" — session key lama, skip saja
            if (e.message?.includes('closed session') || e.message?.includes('No matching session')) {
                // Abaikan — ini normal saat session baru terhubung dan ada pesan lama pending
            } else {
                logger.error(`[JB] +${number}: ${e.message}`);
            }
        }
    });
}

/* ── clearLoginTimer helper ─────────────────────────────────── */
function clearLoginTimer(number) {
    const tid = _loginTimers.get(number);
    if (tid !== undefined) { clearTimeout(tid); _loginTimers.delete(number); }
}

/* ═══════════════════════════════════════════════════════════════
   STOP / RESUME / DELETE
═══════════════════════════════════════════════════════════════ */
async function stopJadiBot(number) {
    const entry = global.jadiBotSockets.get(number);
    if (!entry) return false;

    clearLoginTimer(number);
    _reconnectNums.delete(number);
    entry._stopped = true;
    _stopped.add(number);
    _stopSave(number, {
        ownerNum:  entry.ownerNum,
        ownerJid:  entry.ownerJid,
        ownerRole: entry.ownerRole,
        method:    entry.method,
    });
    global.jadiBotSockets.delete(number);
    _regSave();
    try { entry.sock?.ws?.close(); } catch {}
    try { entry.sock?.end?.(new Error('manual stop')); } catch {}
    setTimeout(() => _stopped.delete(number), 5_000);
    logger.success(`[JB] ✓ +${number} stopped`);
    return true;
}

async function resumeJadiBot(number, notifJid = null) {
    if (!sessionExists(`session/jadibot/${number}`))
        return { ok: false, reason: 'Session tidak ada.' };
    const info = _stopLoad()[number] || {};
    _stopped.delete(number);
    _stopDel(number);
    await startJadiBot(number, info.method || 'pairing', notifJid, {
        ownerNum:  info.ownerNum,
        ownerJid:  info.ownerJid,
        ownerRole: info.ownerRole,
    });
    return { ok: true };
}

async function deleteJadibotSession(number) {
    try { deleteSession(`session/jadibot/${number}`); } catch {}
    _stopDel(number);
    logger.warn(`[JB] Session +${number} dihapus.`);
}

/* ═══════════════════════════════════════════════════════════════
   AUTO RESUME
═══════════════════════════════════════════════════════════════ */
async function autoResumeJadibots() {
    // Bersihkan ownerNum corrupt (LID > 15 digit)
    try {
        const db  = DB();
        const reg = _regLoad();
        for (const r of reg) {
            const n = (r.ownerNum || '').replace(/[^0-9]/g, '');
            if (n.length > 15) {
                db.db.prepare('UPDATE jadibot_registry SET owner_num=NULL,owner_jid=NULL WHERE number=?').run(r.number);
                db.db.prepare('UPDATE jadibot_stopped  SET owner_num=NULL,owner_jid=NULL WHERE number=?').run(r.number);
                logger.warn(`[JB] Cleaned corrupt ownerNum +${r.number}`);
            }
        }
    } catch {}

    const registry   = _regLoad();
    const stoppedReg = _stopLoad();
    const sessionNums = listSessions('session/jadibot/')
        .map(id => id.replace('session/jadibot/', ''));
    const allNums = [...new Set([...registry.map(r => r.number), ...sessionNums])];

    if (!allNums.length) { logger.info('[JB] Tidak ada session jadibot.'); return; }
    logger.jb(`[JB] Memeriksa ${allNums.length} session...`);

    for (const number of allNums) {
        if (global.jadiBotSockets.has(number)) continue;
        if (stoppedReg[number]) { logger.info(`[JB] +${number} stopped, skip.`); continue; }
        if (_stopped.has(number)) continue;
        if (!sessionExists(`session/jadibot/${number}`)) continue;

        const info = registry.find(r => r.number === number) || {};
        logger.jb(`[JB] Auto-resuming +${number}...`);
        await startJadiBot(number, info.method || 'pairing', null, {
            ownerNum:  info.ownerNum,
            ownerJid:  info.ownerJid,
            ownerRole: info.ownerRole,
        }).catch(e => logger.error(`[JB] Resume error +${number}:`, e.message));
        await sleep(1500);
    }

    logger.success(`[JB] Aktif: ${global.jadiBotSockets.size}`);
}

/* ── Exports ─────────────────────────────────────────────────── */
global.startJadiBot         = startJadiBot;
global.stopJadiBot          = stopJadiBot;
global.resumeJadiBot        = resumeJadiBot;
global.deleteJadibotSession = deleteJadibotSession;
global.autoResumeJadibots   = autoResumeJadibots;
global.loadStoppedJadibots  = _stopLoad;
global.saveJadibotLimits    = () => _limSave(global.jadibotLimits);

module.exports = { startJadiBot, stopJadiBot, resumeJadiBot, deleteJadibotSession, autoResumeJadibots };
