/**
 * logger.js — ManzxyMD Logger
 * Level: INFO | SUCCESS | WARN | ERROR | CMD | PLUGIN | DB | WA | JB
 * Warna konsisten, format rapi, timestamp WIB
 */
'use strict';
const chalk = require('chalk');

const WIB = () => new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });

const LEVEL = {
    INFO:    { icon: '●', color: '#5dade2', label: 'INFO   ' },
    SUCCESS: { icon: '✓', color: '#2ecc71', label: 'OK     ' },
    WARN:    { icon: '!', color: '#f39c12', label: 'WARN   ' },
    ERROR:   { icon: '✗', color: '#e74c3c', label: 'ERROR  ' },
    CMD:     { icon: '›', color: '#9b59b6', label: 'CMD    ' },
    PLUGIN:  { icon: '⚙', color: '#1abc9c', label: 'PLUGIN ' },
    DB:      { icon: '⬡', color: '#3498db', label: 'DB     ' },
    WA:      { icon: '◈', color: '#27ae60', label: 'WA     ' },
    JB:      { icon: '◇', color: '#e67e22', label: 'JADIBOT' },
    SCHED:   { icon: '⏱', color: '#8e44ad', label: 'SCHED  ' },
    MEM:     { icon: '◉', color: '#7f8c8d', label: 'MEM    ' },
    CH:      { icon: '📢', color: '#e91e63', label: 'CHANNEL' },
};

const _log = (lvl, ...args) => {
    const t  = LEVEL[lvl] || LEVEL.INFO;
    const ts = chalk.gray(WIB());
    const ic = chalk.hex(t.color).bold(t.icon);
    const lb = chalk.hex(t.color)(t.label);
    const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
    console.log(`${ts} ${ic} ${lb} ${msg}`);
};

/* ── Box untuk pesan masuk (CMD log) ────────────────────── */
const box = (title, colorHex, items) => {
    const W   = 56;
    const clr = chalk.hex(colorHex);
    const top = clr('╭' + '─'.repeat(W) + '╮');
    const mid = clr('├' + '─'.repeat(W) + '┤');
    const bot = clr('╰' + '─'.repeat(W) + '╯');

    console.log(top);
    const titlePad = title.replace(/\u001b\[[0-9;]*m/g, '').length;
    console.log(clr('│ ') + clr.bold(title) + ' '.repeat(Math.max(0, W - 2 - titlePad)) + clr(' │'));
    console.log(mid);
    for (const item of items) {
        const vis = item.replace(/\u001b\[[0-9;]*m/g, '').length;
        console.log(clr('│ ') + item + ' '.repeat(Math.max(0, W - 2 - vis)) + clr(' │'));
    }
    console.log(bot);
};

/* ── Separator line ─────────────────────────────────────── */
const sep = (char = '─', len = 58) => console.log(chalk.gray(char.repeat(len)));

const logger = {
    box,
    sep,

    info:    (...a) => _log('INFO',    ...a),
    success: (...a) => _log('SUCCESS', ...a),
    warn:    (...a) => _log('WARN',    ...a),
    error:   (...a) => _log('ERROR',   ...a),
    cmd:     (...a) => _log('CMD',     ...a),
    plugin:  (...a) => _log('PLUGIN',  ...a),
    db:      (...a) => _log('DB',      ...a),
    wa:      (...a) => _log('WA',      ...a),
    jb:      (...a) => _log('JB',      ...a),
    sched:   (...a) => _log('SCHED',   ...a),
    mem:     (...a) => _log('MEM',     ...a),
    channel: (...a) => _log('CH',      ...a),
};


// Export sebagai global singleton — aman diakses dari modul manapun
global._logger = logger;

module.exports = logger;
