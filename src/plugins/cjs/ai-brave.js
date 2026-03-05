/* ============================================================
   BRAVE AI PLUGIN
   AI dengan kemampuan browsing internet (Brave Search)

   Commands:
     .brave <pertanyaan>  → Tanya AI dengan akses internet
     .bravesearch <tanya> → Alias

   Contoh:
     .brave siapa presiden indonesia sekarang?
     .brave harga bitcoin hari ini
     .brave berita terbaru tentang AI
   ============================================================ */

const axios = require('axios');

const BRAVE_APIKEY = 'freeApikey'; // ganti jika punya apikey premium

async function askBrave(prompt) {
    const res = await axios.get('https://anabot.my.id/api/ai/brave', {
        params:  { prompt, apikey: BRAVE_APIKEY },
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = res.data;
    if (!data?.success) throw new Error(data?.message || 'API error');
    return data.data?.result;
}

/* ── Format markdown bold (**text**) → WA bold (*text*) ── */
function mdToWa(text) {
    return (text || '')
        .replace(/\*\*(.+?)\*\*/g, '*$1*')   // **bold** → *bold*
        .replace(/\n{3,}/g, '\n\n')           // max 2 newline berturut
        .trim();
}

/* ── Handler ── */
const handler = async (m, { args, reply, manzxy, from }) => {
    const prompt = args.join(' ').trim();
    if (!prompt) return reply(`❓ Masukkan pertanyaan.\nContoh: *.brave siapa presiden indonesia?*`);

    await manzxy.sendMessage(from, {
        text: `🔍 *Brave AI* sedang mencari...\n_"${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"_`
    }, { quoted: m });

    let result;
    try {
        result = await askBrave(prompt);
    } catch (e) {
        return reply(`❌ Gagal: ${e.message}`);
    }

    if (!result?.message) return reply('❌ Tidak ada jawaban dari AI.');

    const answer = mdToWa(result.message);

    // Format referensi jika ada
    let refs = '';
    if (result.references?.length) {
        refs = '\n\n📚 *Referensi:*\n';
        result.references.slice(0, 5).forEach((r, i) => {
            const title = r.title || r.url || r;
            const url   = r.url || '';
            refs += `${i + 1}. ${title}${url ? '\n   ' + url : ''}\n`;
        });
    }

    const text = `🤖 *Brave AI*\n${'─'.repeat(28)}\n\n${answer}${refs}`;

    await manzxy.sendMessage(from, { text }, { quoted: m });
};

handler.command  = ['brave', 'bravesearch', 'braveai'];
handler.tags     = ['ai'];
handler.limit    = true;

handler.fitur    = {
    'brave': 'Tanya AI Brave',
    'bravesearch': 'Tanya AI Brave',
    'braveai': 'Tanya AI Brave',
};
module.exports = handler;