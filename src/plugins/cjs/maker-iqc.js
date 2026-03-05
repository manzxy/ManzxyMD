/* ============================================================
   IQC — iPhone Quoted Chat Maker
   Buat gambar chat iPhone dari pesan/reply

   Commands:
     .iqc              → Generate dari pesan yang di-reply
     .iqc <teks>       → Generate dari teks custom

   Opsi opsional (pakai | sebagai pemisah):
     .iqc <teks> | bubbleColor=#272a2f | textColor=#FFFFFF | fontName=Arial | signalName=Telkomsel

   Contoh:
     .iqc ehmmmm?
     .iqc halo dunia | bubbleColor=#1e90ff | textColor=#fff
   ============================================================ */

const axios = require('axios');

const IQC_APIKEY = 'freeApikey';

/* ── Default config ── */
const DEFAULTS = {
    bubbleColor: '#272a2f',
    menuColor:   '#272a2f',
    textColor:   '#FFFFFF',
    fontName:    'Arial',
    signalName:  'Telkomsel',
};

/* ── Waktu WIB sekarang ── */
function nowWIB() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

/* ── Parse opsi dari teks → { text, opts } ── */
function parseArgs(raw) {
    const parts = raw.split('|').map(s => s.trim());
    const text  = parts[0];
    const opts  = {};
    for (const part of parts.slice(1)) {
        const [key, ...valArr] = part.split('=');
        if (key && valArr.length) opts[key.trim()] = valArr.join('=').trim();
    }
    return { text, opts };
}

/* ── API call ── */
async function makeIQC(text, opts = {}) {
    const time = nowWIB();
    const params = {
        text,
        chatTime:      opts.chatTime    || time,
        statusBarTime: opts.statusBarTime || time,
        bubbleColor:   opts.bubbleColor || DEFAULTS.bubbleColor,
        menuColor:     opts.menuColor   || DEFAULTS.menuColor,
        textColor:     opts.textColor   || DEFAULTS.textColor,
        fontName:      opts.fontName    || DEFAULTS.fontName,
        signalName:    opts.signalName  || DEFAULTS.signalName,
        apikey:        IQC_APIKEY,
    };

    const res = await axios.get('https://anabot.my.id/api/maker/iqc', {
        params,
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const data = res.data;
    if (!data?.success) throw new Error(data?.message || 'API error');
    return data; // berisi URL gambar atau base64
}

/* ── Handler ── */
const handler = async (m, { args, reply, manzxy, from, pushname }) => {
    // Ambil teks: dari reply atau dari args
    let rawText = args.join(' ').trim();

    if (!rawText && m.quoted) {
        rawText = m.quoted.text || m.quoted.body || m.quoted.caption || '';
    }

    if (!rawText) return reply(
        `❓ Masukkan teks atau reply pesan.\n\n` +
        `Contoh:\n` +
        `• *.iqc ehmmmm?*\n` +
        `• *.iqc halo | bubbleColor=#1e90ff*\n\n` +
        `Opsi: \`bubbleColor\`, \`menuColor\`, \`textColor\`, \`fontName\`, \`signalName\``
    );

    const { text, opts } = parseArgs(rawText);
    if (!text) return reply('❓ Teks tidak boleh kosong.');

    await manzxy.sendMessage(from, { text: '🖼️ Membuat iPhone Quoted Chat...' }, { quoted: m });

    let result;
    try {
        result = await makeIQC(text, opts);
    } catch (e) {
        return reply(`❌ Gagal: ${e.message}`);
    }

    // Ambil URL/base64 gambar dari response
    const imgUrl = result?.data?.url || result?.data?.image || result?.url || result?.image;

    if (!imgUrl) return reply('❌ Tidak ada gambar dari API.\n' + JSON.stringify(result).slice(0, 200));

    try {
        // Kalau base64
        if (imgUrl.startsWith('data:image') || !imgUrl.startsWith('http')) {
            const base64 = imgUrl.replace(/^data:image\/\w+;base64,/, '');
            await manzxy.sendMessage(from, {
                image:   Buffer.from(base64, 'base64'),
                caption: `🍎 *iPhone Quoted Chat*\n_"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"_`,
            }, { quoted: m });
        } else {
            // URL langsung
            const imgBuf = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000 });
            await manzxy.sendMessage(from, {
                image:   Buffer.from(imgBuf.data),
                caption: `🍎 *iPhone Quoted Chat*\n_"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"_`,
            }, { quoted: m });
        }
    } catch (e) {
        reply(`❌ Gagal kirim gambar: ${e.message}`);
    }
};

handler.command = ['iqc', 'iphonechat', 'iqchat'];
handler.tags    = ['maker'];
handler.limit   = true;

handler.fitur    = {
    'iqc': 'Buat gambar quote iPhone-style',
    'iphonechat': 'Buat gambar quote iPhone-style',
    'iqchat': 'Buat gambar quote iPhone-style',
};
module.exports = handler;