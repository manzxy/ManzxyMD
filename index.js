'use strict';
/**
 * index.js — ManzxyMD Entry Point v8
 */

const chalk  = require('chalk');
const logger = require('./src/core/logger.js');
const { config, init } = require('./config.js');
const db     = require('./src/lib/database.js');

db.load();
global._lidToJidMap = global._lidToJidMap || {};
require('./src/lib/jadibot.js');

/* ════════════════════════════════════════════════════════════════
   BANNER
   ════════════════════════════════════════════════════════════════ */
function printBanner() {
    console.clear();

    // Gradient warna per karakter — terlihat premium di terminal
    const G = [
        '#c084fc','#b975f7','#a855f7','#9333ea',
        '#7c3aed','#6d28d9','#7c3aed','#9333ea',
        '#a855f7','#c084fc',
    ];
    const grad = (str) => str.split('').map((c, i) => chalk.hex(G[i % G.length]).bold(c)).join('');

    const DIM  = '#334155';
    const SUB  = '#94a3b8';
    const MUT  = '#64748b';
    const ACC  = '#c084fc';
    const GRN  = '#22c55e';
    const ORG  = '#f97316';
    const CYN  = '#38bdf8';
    const RED  = '#f87171';

    const c  = chalk;
    const W  = 54;

    // Helper box — hitung visible width, bukan panjang string mentah
    const vis  = (s) => s.replace(/\u001b\[[0-9;]*m/g, '').length;
    const line = (txt, align = 'center') => {
        const vl  = vis(txt);
        const sp  = Math.max(0, W - 2 - vl);
        const lp  = align === 'center' ? Math.floor(sp / 2) : 1;
        const rp  = align === 'center' ? Math.ceil(sp / 2)  : Math.max(0, sp - 1);
        return c.hex(ACC)('║') + ' '.repeat(lp) + txt + ' '.repeat(rp) + c.hex(ACC)('║');
    };

    const TOP  = c.hex(ACC)('╔' + '═'.repeat(W - 2) + '╗');
    const BOT  = c.hex(ACC)('╚' + '═'.repeat(W - 2) + '╝');
    const SEP  = c.hex(ACC)('╠' + '═'.repeat(W - 2) + '╣');
    const EMP  = c.hex(ACC)('║' + ' '.repeat(W - 2) + '║');

    // Judul ASCII mini biar keliatan beda dari bot biasa
    const titleLine1 = grad('███╗   ███╗ █████╗ ███╗  ██╗ ███████╗██╗   ██╗');
    const titleLine2 = grad('████╗ ████║██╔══██╗████╗ ██║╚══███╔╝╚██╗ ██╔╝');
    const titleLine3 = grad('██╔████╔██║███████║██╔██╗██║  ███╔╝  ╚████╔╝ ');
    const titleLine4 = grad('██║╚██╔╝██║██╔══██║██║╚████║ ███╔╝    ╚██╔╝  ');
    const titleLine5 = grad('██║ ╚═╝ ██║██║  ██║██║ ╚███║███████╗   ██║   ');
    const titleLine6 = grad('╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚══╝╚══════╝   ╚═╝  ');

    // Sub info
    const subTxt  = c.hex(SUB)('WhatsApp Bot Framework — Multi Session');
    const verTxt  = c.hex(MUT)(`v${config.version || '2.1'}`) + c.hex(DIM)(' │ ') + c.hex(MUT)(`Node ${process.version}`);

    // Status indicators
    const modeStr = config.selfMode
        ? c.hex(ORG)('⬤ ') + c.hex(ORG).bold('SELF')  + c.hex(MUT)(' (Owner Only)')
        : c.hex(GRN)('⬤ ') + c.hex(GRN).bold('PUBLIC') + c.hex(MUT)(' (Semua User)');
    const loginStr = c.hex(CYN)('⬤ ') + c.hex(CYN).bold(init.loginMethod === 'qr' ? 'QR Code' : 'Pairing Code');

    const botLine   = c.hex(MUT)('Bot   ') + c.hex(DIM)('│ ') + c.hex(ACC).bold(config.nameBot || 'ManzxyMD');
    const ownLine   = c.hex(MUT)('Owner ') + c.hex(DIM)('│ ') + c.hex(ACC).bold(config.nameOwn || 'Owner');
    const modeLine  = c.hex(MUT)('Mode  ') + c.hex(DIM)('│ ') + modeStr;
    const loginLine = c.hex(MUT)('Login ') + c.hex(DIM)('│ ') + loginStr;

    const tagline = c.hex(DIM)('✦ ') + c.hex(MUT).italic('Ringan') + c.hex(DIM)(' · ') + c.hex(MUT).italic('Stabil') + c.hex(DIM)(' · ') + c.hex(MUT).italic('Anti-Lag') + c.hex(DIM)(' ✦');

    console.log('');
    console.log(TOP);
    console.log(EMP);
    console.log(line(titleLine1));
    console.log(line(titleLine2));
    console.log(line(titleLine3));
    console.log(line(titleLine4));
    console.log(line(titleLine5));
    console.log(line(titleLine6));
    console.log(EMP);
    console.log(SEP);
    console.log(EMP);
    console.log(line(subTxt));
    console.log(line(verTxt));
    console.log(EMP);
    console.log(SEP);
    console.log(EMP);
    console.log(line(botLine,   'left'));
    console.log(line(ownLine,   'left'));
    console.log(line(modeLine,  'left'));
    console.log(line(loginLine, 'left'));
    console.log(EMP);
    console.log(SEP);
    console.log(line(tagline));
    console.log(BOT);
    console.log('');
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
process.on('uncaughtException',  e => logger.error('[UNCAUGHT] '   + (e?.message || e)));
process.on('unhandledRejection', r => logger.warn('[UNHANDLED] '   + (r?.message || r)));
process.on('SIGINT',  () => { try { db.save(); } catch {} process.exit(0); });
process.on('SIGTERM', () => { try { db.save(); } catch {} process.exit(0); });

/* ── Start ───────────────────────────────────────────────────── */
printBanner();

logger.info('Memuat sistem...');

const { connectToWhatsApp, scheduleReconnect } = require('./src/core/connection.js');
const { startCleanupTasks }                    = require('./src/core/cleanup.js');

startCleanupTasks();

connectToWhatsApp().catch(e => {
    logger.error('[START] ' + e.message);
    scheduleReconnect(0);
});
