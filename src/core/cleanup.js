/**
 * cleanup.js — Session cleanup, memory management, sewa checker
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const logger = require('./logger.js');
const { getMetaCache, cleanMeta } = require('./connection.js');
const db = require('../lib/database.js');

const META_TTL = 5 * 60_000;

/* ── Session + tmp cleanup ───────────────────────────────────── */
async function cleanupSessions() {
    let cleaned = 0;

    // 1. Hapus tmp files
    const tmpDirs     = [path.join(process.cwd(), 'database'), path.join(process.cwd(), 'tmp'), os.tmpdir()];
    const TMP_PATTERN = /\.(jpg|jpeg|png|mp4|webp|mp3|ogg|pdf|zip|tmp)$/i;
    const TMP_MAX_AGE = 30 * 60_000;

    for (const dir of tmpDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            for (const f of fs.readdirSync(dir)) {
                if (!TMP_PATTERN.test(f)) continue;
                const fp = path.join(dir, f);
                try {
                    if (Date.now() - fs.statSync(fp).mtimeMs > TMP_MAX_AGE) {
                        fs.unlinkSync(fp); cleaned++;
                    }
                } catch {}
            }
        } catch {}
    }

    // 2. Hapus folder jadibot orphan
    const jbDir = path.join(process.cwd(), 'session', 'jadibot');
    if (fs.existsSync(jbDir)) {
        try {
            const validNums = new Set();
            if (global.jadiBotSockets) for (const [num] of global.jadiBotSockets) validNums.add(num);
            try { const s = global.loadStoppedJadibots?.() || {}; Object.keys(s).forEach(n => validNums.add(n)); } catch {}
            try { const r = db.jadibotRegistryLoad?.() || []; r.forEach(r => r.number && validNums.add(r.number)); } catch {}

            for (const folder of fs.readdirSync(jbDir)) {
                if (!/^\d{10,15}$/.test(folder)) continue;
                if (validNums.has(folder)) continue;
                try {
                    fs.rmSync(path.join(jbDir, folder), { recursive: true, force: true });
                    cleaned++;
                    logger.info(`[CLEANUP] Hapus session orphan: ${folder}`);
                } catch {}
            }
        } catch (e) { logger.warn('[CLEANUP] Scan error:', e.message); }
    }

    // 3. WAL checkpoint
    try { require('../lib/sqlite-session.js')._walCheckpoint?.(); } catch {}

    if (cleaned > 0) logger.info(`[CLEANUP] ${cleaned} file/folder dibersihkan`);
}

/* ── Memory cleanup ──────────────────────────────────────────── */
function cleanupMemory() {
    cleanMeta();

    // Trim store.messages
    const store = global._mainStore;
    if (store?.messages) {
        for (const [jid, msgs] of Object.entries(store.messages)) {
            if (!msgs?.length) { delete store.messages[jid]; continue; }
            if (msgs.length > 5) store.messages[jid] = msgs.slice(-5);
        }
    }

    // Trim _lidToJidMap
    const lidKeys = Object.keys(global._lidToJidMap || {});
    if (lidKeys.length > 1000) lidKeys.slice(0, 500).forEach(k => delete global._lidToJidMap[k]);

    const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    logger.mem(`RSS: ${ram} MB | LID cache: ${lidKeys.length}`);
}

/* ── Sewa checker ────────────────────────────────────────────── */
async function checkExpiredSewa() {
    try {
        const all = db.sewabotGetAll?.() || [];
        const now = Date.now();
        for (const sewa of all) {
            if (!sewa?.groupJid || !sewa?.expiredAt || sewa.expiredAt === -1) continue;
            if (now < sewa.expiredAt) continue;
            if (global.mainSock) {
                global.mainSock.sendMessage(sewa.groupJid, {
                    text: '⌛ *Masa sewa bot telah berakhir!*\n\nBot akan keluar dari grup ini.'
                }).catch(()=>{});
                const ownerNum = (sewa.ownerJid || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                if (ownerNum) {
                    global.mainSock.sendMessage(ownerNum + '@s.whatsapp.net', {
                        text: `⌛ *Sewa Expired!*\nGrup: *${sewa.groupName || sewa.groupJid}*\nPaket: *${sewa.paket}*`
                    }).catch(()=>{});
                }
                setTimeout(() => global.mainSock?.groupLeave(sewa.groupJid).catch(()=>{}), 5000);
            }
            try { db.sewabotDelete(sewa.groupJid); } catch {}
            logger.info('[SEWA] Expired & leave: ' + (sewa.groupName || sewa.groupJid));
        }
    } catch (e) { logger.warn('[SEWA]', e.message); }
}

/* ── Start all intervals ─────────────────────────────────────── */
function startCleanupTasks() {
    setInterval(() => { try { db.save(); } catch {} }, 10 * 60_000);
    setInterval(() => { try { cleanupMemory(); } catch {} }, 15 * 60_000);
    setInterval(() => { checkExpiredSewa().catch(()=>{}); }, 2 * 60 * 60_000);
    setInterval(() => { cleanupSessions().catch(()=>{}); }, 30 * 60_000);
    setTimeout(() => { cleanupSessions().catch(()=>{}); }, 5 * 60_000);
}

module.exports = { startCleanupTasks, cleanupMemory, cleanupSessions };
