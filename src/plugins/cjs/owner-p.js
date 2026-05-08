/**
 * owner-p.js — Plugin Manager CJS & ESM (UNLIMITED VERSION)
 * ✔ TANPA BATAS PREVIEW (full isi file)
 * ✔ Auto wrap CJS & ESM
 * ✔ Auto detect type
 * ✔ Force reload cache
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const CJS_DIR = path.join(__dirname);
const ESM_DIR = path.join(__dirname, '../esm');

/* ── LIST ───────────────────────────────────────────── */
const listCjs = () =>
    fs.existsSync(CJS_DIR)
        ? fs.readdirSync(CJS_DIR).filter(f => f.endsWith('.js') && f !== 'owner-p.js').sort()
        : [];

const listEsm = () =>
    fs.existsSync(ESM_DIR)
        ? fs.readdirSync(ESM_DIR).filter(f => f.endsWith('.mjs') || (f.endsWith('.js') && f !== 'owner-p.js')).sort()
        : [];

/* ── DETECT TYPE ───────────────────────────────────── */
const detectType = (code) => {
    if (/^\s*(import\s|export\s)/m.test(code)) return 'esm';
    if (/module\.exports|exports\./m.test(code)) return 'cjs';
    return 'cjs';
};

/* ── EXTRACT COMMAND ───────────────────────────────── */
const extractCommand = (code) => {
    const m = code.match(/\.command\s*=\s*\[?['"]([^'"]+)['"]/);
    return m ? m[1] : null;
};

/* ── WRAP CJS ─────────────────────────────────────── */
const wrapCjs = (code, filename) => {
    if (/module\.exports/.test(code) && /handler\.command/.test(code)) return code;

    const cmd = filename.replace('.js', '').replace(/[^a-z0-9]/gi, '');

    if (/const handler\s*=/.test(code) && !/module\.exports/.test(code)) {
        return code + `

handler.command = handler.command || ['${cmd}'];
handler.tags    = handler.tags || ['misc'];
handler.limit   = false;

module.exports = handler;
`;
    }

    return `'use strict';

const handler = async (m, { reply, args, text, command }) => {
${code.split('\n').map(v => '  ' + v).join('\n')}
};

handler.command = ['${cmd}'];
handler.tags    = ['misc'];
handler.limit   = false;
handler.fitur   = { '${cmd}': 'Plugin ${cmd}' };

module.exports = handler;
`;
};

/* ── WRAP ESM ─────────────────────────────────────── */
const wrapEsm = (code, filename) => {
    const cmd = filename.replace(/\.(mjs|js)/, '').replace(/[^a-z0-9]/gi, '');

    if (/export default/.test(code) && /\.command/.test(code)) return code;

    return `export default async function ${cmd}(m, { reply, args, text, command }) {
${code.split('\n').map(v => '  ' + v).join('\n')}
}

${cmd}.command = ['${cmd}'];
${cmd}.tags    = ['misc'];
${cmd}.limit   = false;
${cmd}.fitur   = { '${cmd}': 'Plugin ${cmd}' };
`;
};

/* ── INVALIDATE CACHE ─────────────────────────────── */
const reloadAll = () => {
    try {
        const handlerMod = require('../../lib/handler.js');
        handlerMod.forceReload?.();
    } catch {}

    for (const f of listCjs()) {
        try { delete require.cache[require.resolve(path.join(CJS_DIR, f))]; } catch {}
    }

    global._resetPluginCache?.();
};

/* ═══════════════════════════════════════════════════ */

const handler = async (m, { args, reply, isOwn }) => {
    if (!isOwn) return reply('⛔ Owner only');

    const sub  = (args[0] || '').toLowerCase();
    const arg1 = args[1];
    const arg2 = (args[2] || '').toLowerCase();

    /* MENU */
    if (!sub) {
        return reply(`📦 Plugin Manager

• .plugin list
• .plugin + nama.js
• .plugin - nomor
• .plugin ? nomor
• .plugin reload

Auto wrap aktif`);
    }

    /* LIST */
    if (sub === 'list') {
        const cjs = listCjs();
        const esm = listEsm();

        return reply(
`📁 CJS (${cjs.length})
${cjs.map((v,i)=>`${i+1}. ${v}`).join('\n') || 'kosong'}

📁 ESM (${esm.length})
${esm.map((v,i)=>`${i+1}. ${v}`).join('\n') || 'kosong'}`
        );
    }

    /* RELOAD */
    if (sub === 'reload') {
        reloadAll();
        return reply('✅ Reload sukses');
    }

    /* TAMBAH */
    if (sub === '+') {
        if (!m.quoted?.text) return reply('Reply kode dulu');
        if (!arg1) return reply('Nama file?');

        const code = m.quoted.text;
        const type = arg2 || detectType(code);

        let file = arg1;
        let dir, final;

        if (type === 'esm') {
            if (!file.endsWith('.mjs')) file += '.mjs';
            dir   = ESM_DIR;
            final = wrapEsm(code, file);
        } else {
            if (!file.endsWith('.js')) file += '.js';
            dir   = CJS_DIR;
            final = wrapCjs(code, file);
        }

        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const target = path.join(dir, file);
        fs.writeFileSync(target, final);

        reloadAll();

        return reply(`✅ Plugin masuk
📄 ${file}
⚙️ ${type}`);
    }

    /* HAPUS */
    if (sub === '-') {
        const idx = parseInt(arg1) - 1;
        const files = listCjs();

        if (!files[idx]) return reply('Nomor salah');

        fs.unlinkSync(path.join(CJS_DIR, files[idx]));
        reloadAll();

        return reply(`🗑️ ${files[idx]} dihapus`);
    }

    /* LIHAT (UNLIMITED) */
    if (sub === '?') {
        const idx = parseInt(arg1) - 1;
        const files = listCjs();

        if (!files[idx]) return reply('Nomor salah');

        const content = fs.readFileSync(path.join(CJS_DIR, files[idx]), 'utf8');

        // 🔥 TANPA LIMIT — FULL TEXT
        return reply(`📄 ${files[idx]}

${content}`);
    }

    reply('❓ command tidak dikenal');
};

handler.command = ['plugin'];
handler.owner   = true;

module.exports = handler;