/* ============================================================
   AI PIXWITH — Image to Image via pixwith.ai

   Commands:
     .pixwith <prompt> [model]     → Image to image (reply gambar)
     .pixwithmodel                 → Lihat daftar model

   Models:
     nanobanana    → NanoBanana v1 (default, cepat)
     nanobanana2   → NanoBanana v2 (1K, detail lebih baik)
     kling01image  → Kling 1.0 (1K, stabil)
     flux2dev      → Flux.1 Dev
     seedream45    → SeeDream 4.5 (2K, kualitas tinggi)
     chatgpt15     → GPT-Image 1.5

   Contoh:
     .pixwith ubah baju jadi merah
     .pixwith ubah rambut jadi pirang seedream45
     .pixwith buat background pantai nanobanana2
   ============================================================ */

'use strict';

const fs       = require('fs');
const FormData = require('form-data');
const path     = require('path');
const cheerio  = require('cheerio');
const axios    = require('axios');

/* ────────────────────────────────────────────────────────── */
/* HEADERS                                                    */
/* ────────────────────────────────────────────────────────── */
const BASE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'Content-Type': 'application/json',
    'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'origin': 'https://pixwith.ai',
    'referer': 'https://pixwith.ai/',
    'accept-language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
};

/* ────────────────────────────────────────────────────────── */
/* MODEL LIST                                                 */
/* ────────────────────────────────────────────────────────── */
const MODELS = {
    'nanobanana': {
        label:    'NanoBanana v1',
        emoji:    '🍌',
        speed:    'Cepat',
        model_id: '1-10',
        options:  { prompt_optimization: true, num_outputs: 1, aspect_ratio: '0' },
    },
    'nanobanana2': {
        label:    'NanoBanana v2',
        emoji:    '🍌🍌',
        speed:    'Cepat',
        model_id: '1-23',
        options:  { prompt_optimization: true, num_outputs: 1, aspect_ratio: '0', resolution: '1K' },
    },
    'kling01image': {
        label:    'Kling 1.0',
        emoji:    '⚡',
        speed:    'Sedang',
        model_id: '1-34',
        options:  { prompt_optimization: true, num_outputs: 1, aspect_ratio: 'auto', resolution: '1K' },
    },
    'flux2dev': {
        label:    'Flux.1 Dev',
        emoji:    '🌊',
        speed:    'Sedang',
        model_id: '1-28',
        options:  { prompt_optimization: true, num_outputs: 1, aspect_ratio: '0' },
    },
    'seedream45': {
        label:    'SeeDream 4.5',
        emoji:    '✨',
        speed:    'Lambat',
        model_id: '1-32',
        options:  { prompt_optimization: true, num_outputs: 1, aspect_ratio: '1:1', resolution: '2K' },
    },
    'chatgpt15': {
        label:    'GPT-Image 1.5',
        emoji:    '🤖',
        speed:    'Lambat',
        model_id: '1-37',
        options:  { prompt_optimization: true, num_outputs: 1, aspect_ratio: '1:1', quality: 'low' },
    },
};

const MODEL_ALIASES = {
    'nb':       'nanobanana',
    'nb2':      'nanobanana2',
    'kling':    'kling01image',
    'flux':     'flux2dev',
    'seedream': 'seedream45',
    'gpt':      'chatgpt15',
};

const DEFAULT_MODEL = 'nanobanana';
const DELAY = ms => new Promise(r => setTimeout(r, ms));

/* ────────────────────────────────────────────────────────── */
/* AUTH HELPERS                                               */
/* ────────────────────────────────────────────────────────── */
function gensesi() {
    let s = '';
    for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s + '0';
}

function genmail() {
    let s = '';
    for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 36).toString(36);
    return s + '@akunlama.com';
}

async function reqotp(email, session) {
    const res = await axios.post(
        'https://api.pixwith.ai/api/user/send_email_code',
        { email },
        { headers: { ...BASE_HEADERS, 'x-session-token': session } }
    );
    return res.data;
}

async function cekOtp(username) {
    const res = await axios.get(
        `https://akunlama.com/api/v1/mail/list?recipient=${username}`,
        { timeout: 10_000 }
    );
    if (res.data && res.data.length > 0) {
        const mail = res.data[0];
        const r    = await axios.get(
            `https://akunlama.com/api/v1/mail/getHtml?region=${mail.storage.region}&key=${mail.storage.key}`,
            { timeout: 10_000 }
        );
        const $ = cheerio.load(r.data);
        $('script, style').remove();
        const match = $('body').text().replace(/\s+/g, ' ').match(/Verification code:\s*([A-Z0-9]+)/);
        return match ? match[1] : null;
    }
    return null;
}

async function doAuth() {
    const session = gensesi();
    const email   = genmail();
    const user    = email.split('@')[0];

    await reqotp(email, session);

    let otp = null;
    for (let i = 0; i < 20; i++) {
        await DELAY(4000);
        otp = await cekOtp(user);
        if (otp) break;
    }
    if (!otp) throw new Error('OTP tidak datang setelah 80 detik. Coba lagi.');

    const v = await axios.post(
        'https://api.pixwith.ai/api/user/verify_email_code',
        { email, code: otp },
        { headers: { ...BASE_HEADERS, 'x-session-token': session } }
    );

    const ex = await axios.post(
        'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyAoRsni0q79r831sDrUjUTynjAEG2ai-EY',
        { token: v.data.data.custom_token, returnSecureToken: true }
    );

    const l = await axios.post(
        'https://api.pixwith.ai/api/user/get_user',
        { token: ex.data.idToken, ref: '-1' },
        { headers: { ...BASE_HEADERS, 'x-session-token': session } }
    );

    return l.data.data.session_token;
}

/* ────────────────────────────────────────────────────────── */
/* UPLOAD & JOB                                               */
/* ────────────────────────────────────────────────────────── */
async function getpreurl(filename, token) {
    const res = await axios.post(
        'https://api.pixwith.ai/api/chats/pre_url',
        { image_name: filename, content_type: 'image/jpeg' },
        { headers: { ...BASE_HEADERS, 'x-session-token': token } }
    );
    return res.data.data.url;
}

async function uploadToS3(uploadData, filePath) {
    const form = new FormData();
    Object.entries(uploadData.fields).forEach(([k, v]) => form.append(k, v));
    form.append('file', fs.createReadStream(filePath));
    const res = await axios.post(uploadData.url, form, { headers: form.getHeaders() });
    return res.status === 204;
}

async function createItem(imageKey, prompt, token, modelConfig) {
    const res = await axios.post(
        'https://api.pixwith.ai/api/items/create',
        {
            images:   { image1: imageKey },
            prompt,
            options:  modelConfig.options,
            model_id: modelConfig.model_id,
        },
        { headers: { ...BASE_HEADERS, 'x-session-token': token } }
    );
    return res.data;
}

async function waitResult(token, maxWait = 120_000) {
    const deadline = Date.now() + maxWait;
    while (Date.now() < deadline) {
        await DELAY(5000);
        const res = await axios.post(
            'https://api.pixwith.ai/api/items/history',
            { tool_type: '1', tag: '', page: 0, page_size: 12 },
            { headers: { ...BASE_HEADERS, 'x-session-token': token } }
        );
        const item = res.data?.data?.items?.[0];
        if (item?.status === 2) return item;
        if (item?.status === 3) throw new Error('Job gagal di server pixwith.');
    }
    throw new Error('Timeout menunggu hasil (120 detik).');
}

/* ────────────────────────────────────────────────────────── */
/* MAIN FUNCTION                                              */
/* ────────────────────────────────────────────────────────── */
async function pixwith(imgpath, prompt, modelKey) {
    const modelConfig = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
    const token       = await doAuth();
    const filename    = path.basename(imgpath);
    const uploadData  = await getpreurl(filename, token);

    await uploadToS3(uploadData, imgpath);
    await createItem(uploadData.fields.key, prompt, token, modelConfig);
    const result  = await waitResult(token);
    const imgUrl  = result.result_urls.find(u => !u.is_input)?.hd
                 || result.result_urls.find(u => !u.is_input)?.url;

    if (!imgUrl) throw new Error('URL gambar tidak ditemukan di response.');

    return {
        job_id: result.uid,
        model:  modelKey,
        label:  modelConfig.label,
        image:  imgUrl,
        prompt: result.prompt || prompt,
    };
}

/* ────────────────────────────────────────────────────────── */
/* HANDLER                                                    */
/* ────────────────────────────────────────────────────────── */
const handler = async (m, { manzxy, text, args, command, reply, isOwn, isPrem }) => {

    /* ── .pixwithmodel — info daftar model ───────────────── */
    if (command === 'pixwithmodel' || command === 'pixwithmodels') {
        let info = `🎨 *PIXWITH AI — Daftar Model*\n`;
        info    += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (const [key, m] of Object.entries(MODELS)) {
            info += `${m.emoji} *${m.label}*\n`;
            info += `   Key     : \`${key}\`\n`;
            info += `   Kecepatan: ${m.speed}\n\n`;
        }

        info += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        info += `📌 *Cara pakai:*\n`;
        info += `_.pixwith <prompt> [model]_\n\n`;
        info += `*Contoh:*\n`;
        info += `_.pixwith ubah baju jadi merah_\n`;
        info += `_.pixwith buat background pantai seedream45_\n`;
        info += `_.pixwith ganti rambut jadi pirang nanobanana2_`;
        return reply(info);
    }

    /* ── .pixwith — main command ─────────────────────────── */
    if (command === 'pixwith') {

        /* Validasi: harus reply gambar */
        if (!m.quoted || !/image/i.test(m.quoted.mimetype || '')) {
            return reply(
`╭─ 🎨 *PIXWITH AI — Image to Image*
│
│  Reply gambar dengan:
│  _.pixwith <prompt> [model]_
│
│  Contoh:
│  _.pixwith ubah baju jadi merah_
│  _.pixwith buat background pantai seedream45_
│  _.pixwith ganti rambut jadi pirang nb2_
│
│  📋 Lihat model: _.pixwithmodel_
╰────────────────────────────`
            );
        }

        /* Validasi: harus ada prompt */
        if (!text?.trim()) {
            return reply('❌ Prompt tidak boleh kosong!\n\nContoh: _.pixwith ubah baju jadi warna ungu_');
        }

        /* Parse model dari akhir args */
        const parts      = text.trim().split(/\s+/);
        const lastWord   = parts[parts.length - 1].toLowerCase();
        let modelKey     = DEFAULT_MODEL;
        let promptTokens = parts;

        // Cek apakah kata terakhir adalah nama model atau alias
        if (MODELS[lastWord] || MODEL_ALIASES[lastWord]) {
            modelKey     = MODEL_ALIASES[lastWord] || lastWord;
            promptTokens = parts.slice(0, -1);
        }

        const prompt = promptTokens.join(' ').trim();
        if (!prompt) return reply('❌ Prompt tidak boleh kosong!');

        const modelInfo = MODELS[modelKey];
        const tmpPath   = `./database/pixwith_${Date.now()}.jpg`;

        try {
            /* Kirim notif awal */
            await reply(
`⏳ *Pixwith AI sedang memproses...*

🎨 Model  : *${modelInfo.emoji} ${modelInfo.label}*
📝 Prompt : _${prompt}_
⚡ Speed  : ${modelInfo.speed}

_Proses mungkin memakan waktu 30-120 detik._
_Tunggu sebentar ya!_ 🙏`
            );

            /* Download gambar quoted */
            const media = await m.quoted.download();
            fs.writeFileSync(tmpPath, media);

            /* Proses via pixwith API */
            const result = await pixwith(tmpPath, prompt, modelKey);

            /* Kirim hasil */
            await manzxy.sendMessage(m.chat, {
                image:   { url: result.image },
                caption:
`✅ *Pixwith AI — Selesai!*

🎨 Model  : *${modelInfo.emoji} ${modelInfo.label}*
📝 Prompt : _${result.prompt}_
🆔 Job ID : \`${result.job_id}\``,
            }, { quoted: m });

        } catch (err) {
            console.error('[PIXWITH ERROR]', err.message);
            await reply(
`❌ *Gagal memproses gambar!*

Error: _${err.message}_

💡 Tips:
• Pastikan gambar jelas dan tidak terlalu kecil
• Coba model lain: _.pixwithmodel_
• Coba lagi beberapa saat kemudian`
            );
        } finally {
            // Hapus file tmp
            try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
        }
    }
};

handler.command  = ['pixwith', 'pixwithmodel', 'pixwithmodels'];
handler.tags     = ['ai'];
handler.limit    = true;

handler.fitur    = {
    'pixwith': 'Generate gambar AI Pixwith',
    'pixwithmodel': 'Lihat model Pixwith',
};
module.exports = handler;
