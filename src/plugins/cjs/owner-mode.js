'use strict';
const { config } = require('../../../config.js');

const handler = async (m, { manzxy, isOwn, command, reply }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    if (command === 'public') {
        manzxy.public      = true;
        global._botPublic  = true;
        config.selfMode    = false;
        return reply('🌐 *Mode: PUBLIC*\n\nSemua orang bisa gunakan bot.\n_Gunakan .self untuk kembali ke self-mode._');
    }

    if (command === 'self') {
        manzxy.public      = false;
        global._botPublic  = false;
        config.selfMode    = true;
        return reply('🔒 *Mode: SELF*\n\nBot hanya merespons owner.\n_Gunakan .public untuk kembali ke mode public._');
    }

    if (command === 'mode') {
        const status = manzxy.public ? '🌐 PUBLIC' : '🔒 SELF';
        return reply(`*Status Mode Bot*\n\nMode saat ini: *${status}*\n\nGunakan:\n• *.self* — aktifkan self-mode\n• *.public* — aktifkan public mode`);
    }
};

handler.command  = ['public', 'self', 'mode'];
handler.tags     = ['owner'];
handler.limit    = false;
handler.owner    = true;

handler.fitur = {
    'public': 'Bot bisa dipakai semua orang',
    'self':   'Bot hanya bisa dipakai owner',
    'mode':   'Cek mode bot saat ini',
};
module.exports = handler;
