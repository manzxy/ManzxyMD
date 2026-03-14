'use strict';

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const FormData = require('form-data');
const axios   = require('axios');

// ── crypto setup dari source asli ────────────────────────────────
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCwlO+boC6cwRo3UfXVBadaYwcX
0zKS2fuVNY2qZ0dgwb1NJ+/Q9FeAosL4ONiosD71on3PVYqRUlL5045mvH2K9i8b
AFVMEip7E6RMK6tKAAif7xzZrXnP1GZ5Rijtqdgwh+YmzTo39cuBCsZqK9oEoeQ3
r/myG9S+9cR5huTuFQIDAQAB
-----END PUBLIC KEY-----`;

const APP_ID = 'aifaceswap';
const U_ID   = '1H5tRtzsBkqXcaJ';
const TH_VER = '83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q';
const UA      = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36';

function randStr(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

// AES-CBC encrypt pakai node native — gak butuh crypto-js
function aesenc(data, keyStr) {
    const key = Buffer.from(keyStr, 'utf8'); // 16 byte
    const iv  = key;
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    cipher.setAutoPadding(true);
    const enc = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    return enc.toString('base64');
}

function rsaenc(data) {
    return crypto.publicEncrypt(
        { key: PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(data, 'utf8')
    ).toString('base64');
}

function genHeaders(type, fp = null) {
    const now = Math.floor(new Date(
        new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(),
        new Date().getUTCHours(), new Date().getUTCMinutes(), new Date().getUTCSeconds()
    ).getTime() / 1000);

    const uuid        = crypto.randomUUID();
    const aesKey      = randStr(16);
    const fingerprint = fp || crypto.randomBytes(16).toString('hex');
    const xGuide      = rsaenc(aesKey);

    const signStr = type === 'upload'
        ? `${APP_ID}:${uuid}:${xGuide}`
        : `${APP_ID}:${U_ID}:${now}:${uuid}:${xGuide}`;

    return {
        fp:        fingerprint,
        fp1:       aesenc(`${APP_ID}:${fingerprint}`, aesKey),
        'x-guide': xGuide,
        'x-sign':  aesenc(signStr, aesKey),
        'x-code':  Date.now().toString(),
    };
}

const BASE_HEADERS = {
    'User-Agent':     UA,
    'Accept':         'application/json, text/plain, */*',
    'origin':         'https://live3d.io',
    'referer':        'https://live3d.io/',
    'theme-version':  TH_VER,
};

async function uploadImage(filePath) {
    const ch   = genHeaders('upload');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), path.basename(filePath));
    form.append('fn_name', 'demo-image-editor');
    form.append('request_from', '9');
    form.append('origin_from', '8f3f0c7387123ae0');

    const res = await axios.post('https://app.live3d.io/aitools/upload-img', form, {
        headers: { ...BASE_HEADERS, ...form.getHeaders(), ...ch },
    });

    if (!res.data?.data?.path) throw new Error('upload gagal: ' + JSON.stringify(res.data));
    return { path: res.data.data.path, fp: ch.fp };
}

async function createJob(remotePath, prompt, fp) {
    const ch = genHeaders('create', fp);
    const payload = {
        fn_name:    'demo-image-editor',
        call_type:  3,
        input: {
            model:          'nano_banana_pro',
            source_images:  [remotePath],
            prompt,
            aspect_radio:   'auto',
            request_from:   9,
        },
        request_from: 9,
        origin_from:  '8f3f0c7387123ae0',
    };

    const res = await axios.post('https://app.live3d.io/aitools/of/create', payload, {
        headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', ...ch },
    });

    if (!res.data?.data?.task_id) throw new Error('buat job gagal: ' + JSON.stringify(res.data));
    return res.data.data.task_id;
}

async function checkJob(taskId, fp) {
    const ch = genHeaders('check', fp);
    const payload = {
        task_id:      taskId,
        fn_name:      'demo-image-editor',
        call_type:    3,
        request_from: 9,
        origin_from:  '8f3f0c7387123ae0',
    };

    const res = await axios.post('https://app.live3d.io/aitools/of/check-status', payload, {
        headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', ...ch },
    });

    return res.data?.data;
}

async function live3d(filePath, prompt) {
    const upload = await uploadImage(filePath);
    const taskId = await createJob(upload.path, prompt, upload.fp);

    let result;
    let tries = 0;
    do {
        await new Promise(r => setTimeout(r, 4000));
        result = await checkJob(taskId, upload.fp);
        tries++;
        if (tries > 30) throw new Error('timeout — server terlalu lama merespons');
    } while (result?.status !== 2);

    if (!result?.result_image) throw new Error('tidak ada hasil dari server');
    return 'https://temp.live3d.io/' + result.result_image;
}

// ── handler ──────────────────────────────────────────────────────
const handler = async (m, { manzxy, text, reply }) => {
    if (!m.quoted || !/image/.test(m.quoted.mimetype || '')) {
        return reply(
            '❌ reply gambar dulu dengan prompt\n\n' +
            'contoh:\n' +
            '.live3d ubah agar dia tersenyum\n' +
            '.live3d ganti background jadi pantai\n' +
            '.live3d tambahkan topi di kepala\n\n' +
            'reply gambar + ketik command + promptnya'
        );
    }

    if (!text) return reply('❌ kasih promptnya juga\ncontoh: .live3d ubah agar dia tersenyum');

    const tmp = `./database/live3d_${Date.now()}.jpg`;
    try {
        await reply('⏳ upload gambar...');

        const media = await m.quoted.download();
        fs.writeFileSync(tmp, media);

        await reply('⚙️ memproses, tunggu sebentar...');

        const resultUrl = await live3d(tmp, text);

        await manzxy.sendMessage(m.chat, {
            image:   { url: resultUrl },
            caption: `✅ selesai\nprompt: _${text}_`,
        }, { quoted: m });

    } catch (e) {
        console.error('[live3d]', e.message);
        reply('❌ gagal: ' + e.message);
    } finally {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    }
};

handler.command = ['live3d'];
handler.tags    = ['ai'];
handler.limit   = true;
handler.fitur   = {
    live3d:  'edit gambar pakai AI (live3d.io) | reply gambar + prompt'
};

module.exports = handler;