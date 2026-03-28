'use strict';
/**
 * index.js — ManzxyMD Entry Point v8
 * Lebih ringan: tidak ada overhead berat di startup
 */

const chalk  = require('chalk');
const logger = require('./src/core/logger.js');
const { config, init } = require('./config.js');
const db     = require('./src/lib/database.js');

/* ── Load DB ─────────────────────────────────────────────────── */
db.load();

/* ── Init global map ─────────────────────────────────────────── */
global._lidToJidMap = global._lidToJidMap || {};

/* ── Load jadibot engine ─────────────────────────────────────── */
require('./src/lib/jadibot.js');

/* ── Banner ──────────────────────────────────────────────────── */
function printBanner() {
    console.clear();
    const w   = 42;
    const sep = chalk.cyan('╠' + '═'.repeat(w-2) + '╣');
    const ln  = (txt, col) => {
        const pad = Math.max(0, w - 2 - txt.length);
        return chalk.cyan('║') + ' '.repeat(Math.floor(pad/2)) + col(txt) + ' '.repeat(Math.ceil(pad/2)) + chalk.cyan('║');
    };
    [
        chalk.cyan('╔' + '═'.repeat(w-2) + '╗'),
        ln('M A N Z X Y  M D',        chalk.bold.magenta),
        ln('WhatsApp Bot Framework',   chalk.gray),
        sep,
        ln(`Bot   : ${config.nameBot || 'Bot'}`,  chalk.cyan),
        ln(`Owner : ${config.nameOwn || 'Owner'}`, chalk.cyan),
        ln(`Versi : v${config.version || '2.0'}`,  chalk.cyan),
        ln(`Node  : ${process.version}`,           chalk.gray),
        chalk.cyan('╚' + '═'.repeat(w-2) + '╝'), '',
    ].forEach(l => console.log(l));
}

/* ── Global restart ──────────────────────────────────────────── */
global.restartBot = async (senderJid = null) => {
    const { spawn } = require('child_process');
    try { db.save(); } catch {}
    if (senderJid && global.mainSock) {
        await global.mainSock.sendMessage(senderJid, {
            text: '🔄 *Bot restart...*\n_Tunggu 5–10 detik._'
        }).catch(() => {});
    }
    const child = spawn(process.execPath, process.argv.slice(1), {
        cwd: process.cwd(), env: process.env, detached: true, stdio: 'inherit',
    });
    child.unref();
    setTimeout(() => process.exit(0), 1500);
};

/* ── Process events ──────────────────────────────────────────── */
process.on('uncaughtException', e => {
    logger.error('[UNCAUGHT] ' + (e?.message || e));
    // Tidak exit — bot harus tetap jalan
});
process.on('unhandledRejection', r => {
    logger.warn('[UNHANDLED] ' + (r?.message || r));
});
process.on('SIGINT',  () => { try { db.save(); } catch {} process.exit(0); });
process.on('SIGTERM', () => { try { db.save(); } catch {} process.exit(0); });

/* ── Start ───────────────────────────────────────────────────── */
printBanner();

const { connectToWhatsApp, scheduleReconnect } = require('./src/core/connection.js');
const { startCleanupTasks }                    = require('./src/core/cleanup.js');

startCleanupTasks();

connectToWhatsApp().catch(e => {
    logger.error('[START] ' + e.message);
    scheduleReconnect(0);
});
