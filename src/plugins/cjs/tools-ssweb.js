'use strict';

const axios = require('axios');

const handler = async (m, { manzxy, args, reply }) => {
    const input  = args[0];
    const device = args[1]?.toLowerCase() === 'mobile' ? 'mobile' : 'desktop';

    if (!input) return reply(
        `╭─「 *Screenshot Web* 」\n` +
        `│\n` +
        `│ *Format:*\n` +
        `│ .ssweb <url> [mobile]\n` +
        `│\n` +
        `│ *Contoh:*\n` +
        `│ .ssweb https://google.com\n` +
        `│ .ssweb github.com mobile\n` +
        `╰──────────────────`
    );

    const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    try { new URL(url); } catch { return reply('❌ URL tidak valid'); }

    const sent = await manzxy.sendMessage(m.chat, { text: `⏳ _screenshot ${device}..._` }, { quoted: m });
    const edit  = txt => manzxy.sendMessage(m.chat, { text: txt, edit: sent.key });

    try {
        const r = await axios.get('https://api.zenzxz.my.id/tools/ssweb', {
            params:       { url, device },
            responseType: 'arraybuffer',
            timeout:      30000,
            headers:      { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
        });

        const ct = r.headers['content-type'] || '';
        if (!ct.startsWith('image/')) throw new Error('response bukan gambar');

        await manzxy.sendMessage(m.chat, { delete: sent.key });

        await manzxy.sendMessage(m.chat, {
            image:   Buffer.from(r.data),
            caption:
                `╭─「 *Screenshot Web* 」\n` +
                `│ 🌐 ${url}\n` +
                `│ 📱 ${device}\n` +
                `╰──────────────────`,
        }, { quoted: m });

    } catch (e) {
        console.error('[ssweb]', e.message);
        await edit('❌ gagal: ' + e.message);
    }
};

handler.command = ['ssweb', 'ss', 'screenshot', 'screenshoot'];
handler.tags    = ['tools'];
handler.limit   = true;
handler.fitur   = {
    ssweb:       'screenshot website | .ssweb <url> [mobile]'
};

module.exports = handler;