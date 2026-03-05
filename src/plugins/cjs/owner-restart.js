'use strict';

const handler = async (m, { manzxy, isOwn, command, reply, senderJid }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    if (command === 'restart') {
        await reply(
            '🔄 *Bot sedang restart...*\n' +
            '_Tunggu 5–10 detik lalu coba kirim pesan._'
        );

        // Pakai global.restartBot dari index.js (spawn child + exit)
        if (typeof global.restartBot === 'function') {
            await global.restartBot(senderJid);
        } else {
            // Fallback: exit langsung (PM2/supervisor akan restart otomatis)
            setTimeout(() => process.exit(0), 1500);
        }
        return;
    }

    if (command === 'shutdown' || command === 'matiin') {
        await reply('🛑 *Bot dimatikan.*\n_Start manual lewat panel/terminal._');
        setTimeout(() => process.exit(0), 1500);
        return;
    }
};

handler.command  = ['restart', 'shutdown', 'matiin'];
handler.tags     = ['owner'];
handler.limit    = false;
handler.owner    = true;
handler.mainOnly = true;

handler.fitur = {
    'restart':  'Restart bot (owner only)',
    'shutdown': 'Matikan bot (start manual dari panel)',
    'matiin':   'Matikan bot',
};

module.exports = handler;
