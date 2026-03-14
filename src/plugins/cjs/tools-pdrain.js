'use strict';

const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');
const crypto   = require('crypto');

// ── pixeldrain client ─────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36';

const BASE_H = {
    'Accept':          '*/*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
    'Connection':      'keep-alive',
    'User-Agent':      UA,
};

// auto-register + login, jadi gak perlu akun manual
async function autoLogin() {
    const rand    = crypto.randomBytes(6).toString('hex');
    const user    = `mzx_${rand}`;
    const email   = `${user}@proton.me`;
    const pass    = crypto.randomBytes(10).toString('hex');

    // register
    const regForm = new FormData();
    regForm.append('username', user);
    regForm.append('email', email);
    regForm.append('password', pass);
    await axios.post('https://pixeldrain.com/api/user/register', regForm, {
        headers: { ...BASE_H, ...regForm.getHeaders(), Origin: 'https://pixeldrain.com', Referer: 'https://pixeldrain.com/register' },
    }).catch(() => {}); // kalau email udah ada skip aja

    // login
    const loginForm = new FormData();
    loginForm.append('username', user);
    loginForm.append('password', pass);
    loginForm.append('app_name', 'website login');
    loginForm.append('redirect', '/user/filemanager');

    const res = await axios.post('https://pixeldrain.com/api/user/login', loginForm, {
        headers: { ...BASE_H, ...loginForm.getHeaders(), Origin: 'https://pixeldrain.com', Referer: 'https://pixeldrain.com/login' },
    });

    const cookie = res.headers['set-cookie']?.find(c => c.startsWith('pd_auth_key='));
    const key    = cookie ? cookie.split(';')[0].split('=')[1] : res.data?.auth_key;
    if (!key) throw new Error('login pixeldrain gagal');
    return key;
}

async function uploadToPixeldrain(buffer, filename, mime) {
    const authKey = await autoLogin();

    const form = new FormData();
    form.append('name', filename);
    form.append('file', buffer, { contentType: mime, filename });

    const res = await axios.post('https://pixeldrain.com/api/file', form, {
        headers: {
            ...BASE_H,
            ...form.getHeaders(),
            Cookie:  `pd_auth_key=${authKey}`,
            Origin:  'https://pixeldrain.com',
            Referer: 'https://pixeldrain.com/t',
        },
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
    });

    if (!res.data?.id) throw new Error('upload gagal, tidak ada ID file');
    return {
        id:       res.data.id,
        url:      `https://pixeldrain.com/u/${res.data.id}`,
        download: `https://pixeldrain.com/api/file/${res.data.id}`,
        filename,
        size: buffer.length,
    };
}

function fmtBytes(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b >= 1048576)    return (b / 1048576).toFixed(2) + ' MB';
    if (b >= 1024)       return (b / 1024).toFixed(2) + ' KB';
    return b + ' B';
}

function getMime(mimetype, ext) {
    if (mimetype) return mimetype;
    const map = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', mp4: 'video/mp4', mp3: 'audio/mpeg', pdf: 'application/pdf',
        zip: 'application/zip', txt: 'text/plain', js: 'text/javascript',
    };
    return map[ext?.toLowerCase()] || 'application/octet-stream';
}

// ── handler ───────────────────────────────────────────────────────
const handler = async (m, { manzxy, reply, args }) => {
    // cek ada file yang di-kirim/reply
    const src = (/image|video|audio|application|document/.test(m.mimetype || '') ? m
               : m.quoted && /image|video|audio|application|document/.test(m.quoted?.mimetype || '') ? m.quoted
               : null);

    if (!src) {
        return reply(
            '❌ kirim atau reply file dulu\n\n' +
            'support: gambar, video, audio, dokumen\n\n' +
            'contoh:\n' +
            '• kirim file → caption: .pixeldrain\n' +
            '• reply file → .pixeldrain'
        );
    }

    const sent = await manzxy.sendMessage(m.chat, { text: '⏳ _mengunggah..._' }, { quoted: m });
    const edit  = txt => manzxy.sendMessage(m.chat, { text: txt, edit: sent.key });

    try {
        await edit('📥 _mendownload file..._');
        const media = await src.download();

        // ambil nama file
        const mimetype = src.mimetype || '';
        const ext      = mimetype.split('/')[1]?.split(';')[0] || 'bin';
        const origName = src.fileName || src.name || src.filename || null;
        const filename = origName || `file_${Date.now()}.${ext}`;
        const mime     = getMime(mimetype, ext);

        await edit('📤 _mengunggah ke pixeldrain..._');
        const result = await uploadToPixeldrain(Buffer.from(media), filename, mime);

        await manzxy.sendMessage(m.chat, { delete: sent.key });

        await reply(
            `╭─「 *Pixeldrain Upload* 」\n` +
            `│ ✅ File berhasil diunggah\n` +
            `│\n` +
            `│ 📄 *Nama*\n` +
            `│ ${result.filename}\n` +
            `│\n` +
            `│ 📦 *Ukuran*\n` +
            `│ ${fmtBytes(result.size)}\n` +
            `│\n` +
            `│ 🔗 *Link*\n` +
            `│ ${result.url}\n` +
            `│\n` +
            `│ ⬇️ *Download langsung*\n` +
            `│ ${result.download}\n` +
            `╰──────────────────`
        );

    } catch (e) {
        console.error('[pixeldrain]', e.message);
        await edit('❌ gagal: ' + e.message);
    }
};

handler.command = ['pixeldrain', 'pdrain'];
handler.tags    = ['tools'];
handler.limit   = true;
handler.fitur   = {
    pixeldrain:  'upload file ke pixeldrain.com dan dapat link | kirim/reply file',
    pdrain:      'alias pixeldrain'
};

module.exports = handler;