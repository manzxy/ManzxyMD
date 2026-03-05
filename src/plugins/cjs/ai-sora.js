/* ============================================================
   AI SORA — Text to Video via nanobana.net/m/sora2

   Commands:
     .sora <prompt>                 → landscape (default)
     .sora <prompt> | portrait      → vertical
     .sora <prompt> | square        → 1:1
     .sora <prompt> | 480           → 480p (cepat)
     .sora <prompt> | portrait 480  → portrait + 480p

   Alias: .ttv .sora2 .textovideo
   ============================================================ */

'use strict';

const axios  = require('axios');
const crypto = require('crypto');

const DELAY  = ms => new Promise(r => setTimeout(r, ms));

const BASE_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'sec-ch-ua':       '"Chromium";v="139", "Not;A=Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
    'origin':          'https://www.nanobana.net',
    'referer':         'https://www.nanobana.net/m/sora2',
};

/* ── Core sora2 function ────────────────────────────────────── */
async function sora2(prompt, aspectRatio = 'landscape', nFrames = '10') {

    // Cookie store per-request — aman untuk concurrent calls
    const jar = {};
    const extract = (res) => {
        const sc = res.headers['set-cookie'];
        if (!sc) return;
        sc.forEach(c => {
            const p = c.split(';')[0].split('=');
            if (p.length > 1) jar[p[0]] = p.slice(1).join('=');
        });
    };
    const cookies = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    const hdr     = (extra = {}) => ({ ...BASE_HEADERS, Cookie: cookies(), ...extra });

    /* 1. Buat email temporer */
    const name  = crypto.randomBytes(6).toString('hex');
    const check = await axios.get(`https://akunlama.com/api/v1/mail/list?recipient=${name}`);
    if (!Array.isArray(check.data) || check.data.length !== 0)
        throw new Error('Email tidak tersedia, coba lagi.');
    const email = `${name}@akunlama.com`;

    /* 2. Kirim OTP ke email */
    const sendRes = await axios.post(
        'https://www.nanobana.net/api/auth/email/send',
        { email },
        { headers: hdr({ 'Content-Type': 'application/json' }) }
    );
    extract(sendRes);

    /* 3. Tunggu OTP dari subject email */
    let otp = null;
    for (let i = 0; i < 20 && !otp; i++) {
        await DELAY(3000);
        const list = await axios.get(`https://akunlama.com/api/v1/mail/list?recipient=${name}`);
        if (Array.isArray(list.data) && list.data.length > 0) {
            for (const mail of list.data) {
                const subject = mail.message?.headers?.subject || '';
                const m = subject.match(/Code:\s*(\d{6})/i);
                if (m) { otp = m[1]; break; }
            }
        }
    }
    if (!otp) throw new Error('OTP tidak diterima (timeout 60 detik). Coba lagi.');

    /* 4. Ambil CSRF token */
    const csrfRes = await axios.get(
        'https://www.nanobana.net/api/auth/csrf',
        { headers: hdr() }
    );
    extract(csrfRes);
    const csrfToken = csrfRes.data?.csrfToken;
    if (!csrfToken) throw new Error('CSRF token tidak ditemukan.');

    /* 5. Login dengan OTP */
    const loginBody = `email=${encodeURIComponent(email)}&code=${otp}&redirect=false&csrfToken=${csrfToken}&callbackUrl=${encodeURIComponent('https://www.nanobana.net/m/sora2')}`;
    const loginRes  = await axios.post(
        'https://www.nanobana.net/api/auth/callback/email-code',
        loginBody,
        { headers: hdr({ 'Content-Type': 'application/x-www-form-urlencoded', 'x-auth-return-redirect': '1' }) }
    );
    extract(loginRes);

    /* 6. Ambil session & user info */
    const sesiRes = await axios.get('https://www.nanobana.net/api/auth/session', { headers: hdr() });
    extract(sesiRes);
    await axios.post('https://www.nanobana.net/api/get-user-info', '', { headers: hdr() }).then(r => extract(r)).catch(() => {});

    /* 7. Submit generate task */
    const submitRes = await axios.post(
        'https://www.nanobana.net/api/sora2/text-to-video/generate',
        { prompt, aspect_ratio: aspectRatio, n_frames: nFrames, remove_watermark: true },
        { headers: hdr({ 'Content-Type': 'application/json' }) }
    );
    extract(submitRes);

    const taskId = submitRes.data?.taskId;
    if (!taskId) throw new Error(`Gagal mendapat task ID. Response: ${JSON.stringify(submitRes.data)}`);

    /* 8. Poll status sampai selesai */
    const PENDING  = ['processing', 'waiting', 'pending', 'queue', 'in_queue'];
    let result;
    let attempts   = 0;
    const MAX_WAIT = 72; // 72 × 5s = 6 menit

    do {
        await DELAY(5000);
        attempts++;
        if (attempts > MAX_WAIT) throw new Error('Timeout — video belum selesai setelah 6 menit.');

        const statusRes = await axios.get(
            `https://www.nanobana.net/api/sora2/text-to-video/task/${taskId}?save=1&prompt=${encodeURIComponent(prompt)}`,
            { headers: hdr() }
        );
        extract(statusRes);
        result = statusRes.data;
    } while (result?.status && PENDING.includes(result.status.toLowerCase()));

    if (['failed', 'error'].includes(result?.status?.toLowerCase()))
        throw new Error(`Server gagal: ${result.error_message || 'Konten mungkin difilter'}`);

    /* 9. Ambil URL video */
    let videoUrl = null;
    if (result.resultUrls?.length)   videoUrl = result.resultUrls[0];
    else if (result.saved?.length)   videoUrl = result.saved[0]?.url;
    else if (result.video_url)       videoUrl = result.video_url;

    if (!videoUrl) throw new Error('Video URL tidak ditemukan di response.');

    return { task_id: taskId, video: videoUrl };
}

/* ── Handler ─────────────────────────────────────────────────── */
const handler = async (m, { manzxy, text, command, reply }) => {

    if (!text) return reply(
`🎬 *SORA — Text to Video AI*

Buat video dari teks menggunakan Sora AI!

*Format:*
_.sora <prompt>_
_.sora <prompt> | <rasio>_

*Rasio layar:*
• *landscape* — horizontal 16:9 (default)
• *portrait*  — vertikal 9:16
• *square*    — kotak 1:1

*Frame (durasi):*
• *10* — default (~3 detik)
• *480* — lebih pendek, lebih cepat

*Contoh:*
_.sora a cat playing in the rain_
_.sora sunset over ocean | portrait_
_.sora robot dancing | square_

⏱️ Proses biasanya 1–4 menit.`
    );

    /* Parse: .sora <prompt> | <rasio> <frame> */
    const parts  = text.split('|');
    const prompt = parts[0].trim();
    const opts   = (parts[1] || '').trim().toLowerCase().split(/\s+/);

    const ASPECT_MAP = {
        'portrait':  'portrait',
        'landscape': 'landscape',
        'square':    'square',
        '9:16':      'portrait',
        '16:9':      'landscape',
        '1:1':       'square',
    };

    let aspectRatio = 'landscape';
    let nFrames     = '10';

    for (const opt of opts) {
        if (ASPECT_MAP[opt]) aspectRatio = ASPECT_MAP[opt];
        if (/^\d+$/.test(opt)) nFrames = opt;
    }

    if (!prompt) return reply('❌ Prompt tidak boleh kosong!');

    const ASPECT_LABEL = {
        landscape: '🖥️ Landscape (16:9)',
        portrait:  '📱 Portrait (9:16)',
        square:    '⬛ Square (1:1)',
    };

    try {
        await reply(
`⏳ *Sora AI sedang membuat video...*

📝 Prompt : _${prompt}_
📐 Rasio  : ${ASPECT_LABEL[aspectRatio] || aspectRatio}
🎞️ Frames : ${nFrames}

_Proses biasanya 1–4 menit. Harap tunggu!_ ☕`
        );

        const result = await sora2(prompt, aspectRatio, nFrames);

        if (!result?.video) return reply('❌ Video tidak tersedia. Coba prompt lain.');

        await manzxy.sendMessage(m.chat, {
            video:   { url: result.video },
            caption:
`🎬 *Sora Text-to-Video*

📝 Prompt : _${prompt}_
📐 Rasio  : ${ASPECT_LABEL[aspectRatio] || aspectRatio}
🆔 Task ID: \`${result.task_id}\``,
        }, { quoted: m });

    } catch (err) {
        console.error('[SORA]', err.message);
        await reply(
`❌ *Gagal membuat video!*

Error: _${err.message}_

💡 Tips:
• Gunakan prompt dalam Bahasa Inggris
• Hindari konten yang melanggar kebijakan
• Coba lagi beberapa saat kemudian`
        );
    }
};

handler.command   = ['sora', 'sora2', 'ttv', 'textovideo'];
handler.tags      = ['ai'];
handler.limit     = true;
handler.limitCost = 3;

handler.fitur    = {
    'sora': 'Tanya AI Sora',
    'sora2': 'Tanya AI Sora (versi 2)',
    'ttv': 'Text to video AI',
    'textovideo': 'Text to video AI',
};
module.exports = handler;
