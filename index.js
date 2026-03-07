/* ============================================================
   index.js — ManzxyMD Entry Point v7

   File ini HANYA bertanggung jawab:
     1. Bootstrap: load DB, banner, jadibot engine
     2. Mulai koneksi WA (via connection.js)
     3. Pasang process event handlers
     4. Start cleanup tasks

   Semua logika dipindah ke:
     src/core/connection.js  — koneksi WA, reconnect, session recovery
     src/core/scheduler.js   — scheduler grup + adzan
     src/core/store.js       — in-memory store + LID map
     src/core/cleanup.js     — session/memory/sewa cleanup
   ============================================================ */

'use strict';

const chalk = require('chalk');
const { config, init } = require('./config.js');
const logger = require('./src/core/logger.js');
const db     = require('./src/lib/database.js');

/* ── Load DB ─────────────────────────────────────────────────── */
db.load();

/* ── Init jadibot engine ─────────────────────────────────────── */
require('./src/lib/jadibot.js');

/* ── Banner ──────────────────────────────────────────────────── */
function printBanner() {
    console.clear();
    const w   = 40;
    const sep = chalk.cyan('╠' + '═'.repeat(w-2) + '╣');
    const ln  = (txt, col) => {
        const pad = Math.max(0, w - 2 - txt.length);
        return chalk.cyan('║') + ' '.repeat(Math.floor(pad/2)) + col(txt) + ' '.repeat(Math.ceil(pad/2)) + chalk.cyan('║');
    };
    [
        chalk.cyan('╔' + '═'.repeat(w-2) + '╗'),
        ln('M A N Z X Y  M D',      chalk.bold.magenta),
        ln('WhatsApp Bot Framework', chalk.gray),
        sep,
        ln(`Owner : ${config.nameOwn || 'Owner'}`, chalk.cyan),
        ln(`Bot   : ${config.nameBot || 'Bot'}`,   chalk.cyan),
        ln(`Versi : ${config.version || '2.0'}`,   chalk.cyan),
        chalk.cyan('╚' + '═'.repeat(w-2) + '╝'), '',
    ].forEach(l => console.log(l));
}

/* ── Global restart ──────────────────────────────────────────── */
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

/* ── Process events ──────────────────────────────────────────── */
process.on('uncaughtException', e => {
    logger.error('[UNCAUGHT] ' + (e?.message || e));
    // Jangan exit — bot harus tetap jalan
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

/* ── Start ───────────────────────────────────────────────────── */
printBanner();

const { connectToWhatsApp, scheduleReconnect } = require('./src/core/connection.js');
const { startCleanupTasks }                    = require('./src/core/cleanup.js');

startCleanupTasks();

connectToWhatsApp().catch(e => {
    console.error(chalk.red('[START]'), e.message);
    scheduleReconnect(0);
});
