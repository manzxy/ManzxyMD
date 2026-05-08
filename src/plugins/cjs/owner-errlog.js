'use strict';
/**
 * owner-errlog.js — Error log viewer + AI monitor status
 */

const handler = async (m, { reply, isOwn, command, args }) => {
    if (!isOwn) return reply('⛔ Owner only!');
    const logger = require('../../core/logger.js');

    if (command === 'clearlog') {
        logger.clearErrors();
        return reply('🗑️ Error log dibersihkan.');
    }

    const n    = parseInt(args[0]) || 10;
    const logs = logger.getLast(Math.min(n, 50));

    if (!logs.length) return reply('✅ Tidak ada error log.');

    const cnt   = logger.getErrCount();
    const top5  = Object.entries(cnt)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => `  ${v}x — ${k.slice(0, 50)}`)
        .join('\n');

    const lines = [
        `📋 *Error Log (${logs.length} terakhir)*`,
        '─'.repeat(30),
        ...logs.map((e, i) => {
            const t = new Date(e.ts).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
            const icon = e.lvl === 'ERROR' ? '🔴' : '🟡';
            return `${icon} [${t}] ${e.msg.slice(0, 120)}`;
        }),
        '',
        '📊 *Top Error Patterns:*',
        top5 || '  (belum ada)',
    ];

    reply(lines.join('\n'));
};

handler.command  = ['errlog', 'clearlog'];
handler.tags     = ['owner'];
handler.owner    = true;
handler.limit    = false;
handler.fitur    = {
    'errlog':   'Lihat error log terbaru (opsional: .errlog 20)',
    'clearlog': 'Bersihkan error log',
};
module.exports = handler;
