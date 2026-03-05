'use strict';
const { config } = require('../../../config.js');

const handler = async (m, { manzxy, reply }) => {
    // Ambil owner pertama dari config
    const ownerNum = config.owner?.[0] ? String(config.owner[0]).replace(/[^0-9]/g, '') : null;
    const ownerName = config.nameBot || 'Owner';

    if (!ownerNum) return reply('❌ Nomor owner belum diset di config.js');

    try {
        await manzxy.sendMessage(m.chat, {
            contacts: {
                displayName: ownerName,
                contacts: [{
                    vcard:
                        `BEGIN:VCARD\nVERSION:3.0\nFN:${ownerName}\n`+
                        `TEL;type=CELL;type=VOICE;waid=${ownerNum}:+${ownerNum}\n`+
                        `END:VCARD`
                }]
            }
        }, { quoted: m });
        await reply(`📱 *Kontak Owner*\n\n👤 *Nama :* ${ownerName}\n📞 *Nomor :* +${ownerNum}`);
    } catch (err) {
        reply(`📱 *Owner Bot*\n\n👤 ${ownerName}\n📞 +${ownerNum}`);
    }
};

handler.command = ['owner', 'contact'];
handler.tags    = ['info'];
handler.limit    = false;
handler.fitur    = {
    'owner': 'Tampilkan kontak owner bot',
    'contact': 'Tampilkan kontak owner bot',
};
module.exports = handler;
