'use strict';

const axios = require('axios');

const handler = async (m, { manzxy, reply, args, text }) => {
    if (!text) return reply(
        `╭─「 *GET Request* 」\n` +
        `│\n` +
        `│ Ambil response dari URL/API\n` +
        `│\n` +
        `│ *Format:*\n` +
        `│ .get <url>\n` +
        `│\n` +
        `│ *Contoh:*\n` +
        `│ .get https://api.example.com/data\n` +
        `│ .get https://api.zenzxz.my.id/ai/gemini?q=hai\n` +
        `╰──────────────────`
    );

    const url = args[0];

    // validasi url
    try { new URL(url); } catch {
        return reply('❌ URL tidak valid\ncontoh: .get https://api.example.com/data');
    }

    try {
        const start = Date.now();
        const r = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
            timeout: 15000,
            validateStatus: () => true,
            responseType: 'arraybuffer', // handle semua tipe termasuk binary
        });
        const ms = Date.now() - start;

        // detect content type dulu sebelum parse
        const ct   = r.headers['content-type'] || '';
        const mime = ct.split(';')[0].trim();
        const isText = mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript');

        // convert sesuai tipe
        if (isText) r.data = Buffer.from(r.data).toString('utf8');

        const status = r.status;

        const statusIcon = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
        const caption =
            `╭─「 *GET Response* 」\n` +
            `│ ${statusIcon} Status  : ${status}\n` +
            `│ ⏱️ Latency : ${ms}ms\n` +
            `│ 📄 Type    : ${mime || '-'}\n` +
            `│ 🔗 URL     : ${url.length > 50 ? url.slice(0, 50) + '...' : url}\n` +
            `╰──────────────────`;

        // kirim sesuai tipe konten
        if (mime.startsWith('image/')) {
            const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
            return await manzxy.sendMessage(m.chat, { image: buf, caption }, { quoted: m });
        }

        if (mime.startsWith('video/')) {
            const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
            return await manzxy.sendMessage(m.chat, { video: buf, caption }, { quoted: m });
        }

        if (mime.startsWith('audio/')) {
            const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
            return await manzxy.sendMessage(m.chat, { audio: buf, mimetype: mime }, { quoted: m });
        }

        if (
            mime === 'application/pdf' ||
            mime === 'application/zip' ||
            mime === 'application/x-zip-compressed' ||
            mime === 'application/octet-stream' ||
            mime.startsWith('application/')
        ) {
            const buf      = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
            const filename = url.split('/').pop().split('?')[0] || 'file';
            return await manzxy.sendMessage(m.chat, {
                document: buf,
                mimetype: mime,
                fileName: filename,
                caption,
            }, { quoted: m });
        }

        // teks / json
        let body;
        if (mime.includes('json')) {
            try { body = JSON.stringify(typeof r.data === 'string' ? JSON.parse(r.data) : r.data, null, 2); }
            catch { body = String(r.data); }
        } else {
            body = String(r.data);
        }

        return reply(caption + `\n\n\`\`\`\n${body}\n\`\`\``);

    } catch (e) {
        const msg = e.code === 'ECONNABORTED' ? 'timeout (>15 detik)'
                  : e.code === 'ENOTFOUND'    ? 'domain tidak ditemukan'
                  : e.code === 'ECONNREFUSED' ? 'koneksi ditolak'
                  : e.message;
        return reply(`❌ Gagal fetch\n${msg}`);
    }
};

handler.command = ['get', 'fetch', 'req'];
handler.tags    = ['tools'];
handler.limit   = false;
handler.owner   = true;
handler.fitur   = {
    get:   'fetch GET request dari URL dan tampilkan response'
};

module.exports = handler;