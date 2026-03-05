/**
 * owner-p.js — Plugin Manager CJS & ESM (unified)
 *
 * ─ FITUR ─────────────────────────────────────────────────────
 *  • .plugin list [cjs|esm]     — lihat semua plugin
 *  • .plugin + <nama> [cjs|esm] — tambah/timpa plugin (reply kode)
 *  • .plugin - <nomor> [cjs|esm]— hapus plugin
 *  • .plugin ? <nomor> [cjs|esm]— lihat isi plugin
 *  • .plugin reload             — paksa reload cache
 *
 * ─ AUTO STRUKTUR ─────────────────────────────────────────────
 *  Saat .plugin + :
 *  1. Deteksi otomatis apakah kode CJS atau ESM dari isinya
 *  2. Wrap kode jika belum punya struktur yang benar:
 *     - CJS: tambah module.exports + handler.command jika belum ada
 *     - ESM: tambah export default + .command jika belum ada
 *  3. Jika file sudah ada → TIMPA (overwrite)
 *  4. Force invalidate cache agar langsung aktif
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const CJS_DIR = path.join(__dirname);
const ESM_DIR = path.join(__dirname, '../esm');

/* ── List files ─────────────────────────────────────────── */
const listCjs = () =>
    fs.existsSync(CJS_DIR)
        ? fs.readdirSync(CJS_DIR).filter(f => f.endsWith('.js') && f !== 'owner-p.js').sort()
        : [];

const listEsm = () =>
    fs.existsSync(ESM_DIR)
        ? fs.readdirSync(ESM_DIR).filter(f => f.endsWith('.mjs') || (f.endsWith('.js') && f !== 'owner-p.js')).sort()
        : [];

/* ── Deteksi tipe dari isi kode ─────────────────────────── */
const detectType = (code) => {
    // ESM: ada import/export syntax
    if (/^\s*(import\s|export\s(default|const|function|async))/m.test(code)) return 'esm';
    // Eksplisit CJS
    if (/module\.exports\s*=|exports\./m.test(code)) return 'cjs';
    // Default ke CJS
    return 'cjs';
};

/* ── Ekstrak nama command dari kode ─────────────────────── */
const extractCommand = (code) => {
    // handler.command = ['xxx'] atau handler.command = 'xxx'
    const m = code.match(/handler\.command\s*=\s*(?:\[['"]([^'"]+)['"]|\s*['"]([^'"]+)['"]\]?)/);
    if (m) return m[1] || m[2];
    // export.command = ...
    const m2 = code.match(/\w+\.command\s*=\s*\[?['"]([^'"]+)['"]/);
    if (m2) return m2[1];
    return null;
};

/* ── Auto-wrap kode CJS ──────────────────────────────────── */
const wrapCjs = (code, filename) => {
    // Sudah punya struktur lengkap
    if (/module\.exports\s*=/.test(code) && /handler\.command\s*=/.test(code)) return code;

    const cmdName = filename.replace('.js', '').replace(/[^a-z0-9]/gi, '');

    // Punya handler tapi belum module.exports
    if (/const handler\s*=/.test(code) && !/module\.exports/.test(code)) {
        return code.trimEnd() + `\n\nif (!handler.command) handler.command = ['${cmdName}'];\nif (!handler.tags) handler.tags = ['misc'];\nmodule.exports = handler;\n`;
handler.limit    = false;
    }

    // Kode polos (fungsi/logika biasa) — wrap jadi handler
    return `'use strict';

const handler = async (m, { manzxy, args, reply, text, command, isOwn, isPrem, senderJid, from }) => {
${code.split('\n').map(l => '    ' + l).join('\n')}
};

handler.command  = ['${cmdName}'];
handler.tags     = ['misc'];
handler.fitur    = { '${cmdName}': 'Plugin ${cmdName}' };
module.exports = handler;
`;
};

/* ── Auto-wrap kode ESM ──────────────────────────────────── */
const wrapEsm = (code, filename) => {
    const cmdName = filename.replace(/\.(mjs|js)$/, '').replace(/[^a-z0-9]/gi, '');

    // Sudah lengkap (punya export default function + .command)
    if (/export\s+default\s+/.test(code) && /\.command\s*=/.test(code)) return code;

    // Punya export default tapi belum .command — tambahkan
    if (/export\s+default\s+(?:async\s+)?function\s+(\w+)/.test(code)) {
        const fnName = code.match(/export\s+default\s+(?:async\s+)?function\s+(\w+)/)[1];
        if (!/\.command\s*=/.test(code)) {
            return code.trimEnd() + `\n\n${fnName}.command = ['${cmdName}'];\n${fnName}.tags    = ['misc'];\n${fnName}.fitur   = { '${cmdName}': 'Plugin ${cmdName}' };\n`;
        }
        return code;
    }

    // Kode polos — wrap jadi ESM handler
    return `import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default async function ${cmdName}(m, { manzxy, args, reply, text, command, isOwn, isPrem, senderJid, from }) {
${code.split('\n').map(l => '    ' + l).join('\n')}
}

${cmdName}.command = ['${cmdName}'];
${cmdName}.tags    = ['misc'];
${cmdName}.fitur   = { '${cmdName}': 'Plugin ${cmdName}' };
`;
};

/* ── Force invalidate semua cache plugin ─────────────────── */
const invalidateAllCaches = () => {
    // CJS: gunakan forceReload() yang langsung rebuild cache
    try {
        const handlerMod = require('../../lib/handler.js');
        if (typeof handlerMod.forceReload === 'function') {
            handlerMod.forceReload();
        } else {
            // fallback: hapus require cache semua plugin
            for (const f of listCjs()) {
                try { delete require.cache[require.resolve(path.join(CJS_DIR, f))]; } catch {}
            }
        }
    } catch {}

    // ESM & allPlugins cache — reset via global flag
    try {
        if (global._resetPluginCache) global._resetPluginCache();
    } catch {}
};

/* ═══════════════════════════════════════════════════════════
   HANDLER
   ═══════════════════════════════════════════════════════════ */
const handler = async (m, { args, reply, isOwn }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    // Parse: .plugin <sub> [arg1] [arg2]
    // sub bisa: list, +, -, ?, reload
    // tipe bisa: cjs, esm (default: auto)
    const sub  = (args[0] || '').toLowerCase();
    const arg1 = args[1] || '';
    const arg2 = (args[2] || '').toLowerCase();

    /* ── TANPA ARGUMEN ── */
    if (!sub) {
        const cjsN = listCjs().length;
        const esmN = listEsm().length;
        return reply(
            `📦 *Plugin Manager*\n` +
            `CJS: *${cjsN} plugin* | ESM: *${esmN} plugin*\n\n` +
            `*Commands:*\n` +
            `• *.plugin list* — semua plugin\n` +
            `• *.plugin list cjs* — plugin CJS saja\n` +
            `• *.plugin list esm* — plugin ESM saja\n\n` +
            `• *.plugin + nama.js* — tambah/timpa CJS (reply kode)\n` +
            `• *.plugin + nama.mjs esm* — tambah/timpa ESM\n` +
            `• *.plugin + nama.js cjs* — force CJS\n\n` +
            `• *.plugin - <nomor>* — hapus CJS\n` +
            `• *.plugin - <nomor> esm* — hapus ESM\n\n` +
            `• *.plugin ? <nomor>* — lihat isi CJS\n` +
            `• *.plugin ? <nomor> esm* — lihat isi ESM\n\n` +
            `• *.plugin reload* — force reload cache\n\n` +
            `💡 *Auto-struktur aktif:* kode akan otomatis\n` +
            `   dibungkus struktur CJS/ESM yang benar.`
        );
    }

    /* ── LIST ── */
    if (sub === 'list' || sub === 'ls') {
        const showCjs = arg1 !== 'esm';
        const showEsm = arg1 !== 'cjs';
        let text = '';

        if (showCjs) {
            const files = listCjs();
            text += `📁 *Plugin CJS* (${files.length})\n`;
            if (files.length) files.forEach((f, i) => { text += `  ${i + 1}. ${f}\n`; });
            else text += `  _kosong_\n`;
            text += '\n';
        }
        if (showEsm) {
            const files = listEsm();
            text += `📁 *Plugin ESM* (${files.length})\n`;
            if (files.length) files.forEach((f, i) => { text += `  ${i + 1}. ${f}\n`; });
            else text += `  _kosong_\n`;
        }
        return reply(text.trim());
    }

    /* ── RELOAD ── */
    if (sub === 'reload') {
        invalidateAllCaches();
        return reply('🔄 Cache plugin di-reset!\n\nPlugin akan reload otomatis pada pesan berikutnya.');
    }

    /* ── TAMBAH / TIMPA ── */
    if (sub === '+') {
        if (!m.quoted?.text) {
            return reply(
                `❌ *Reply ke pesan yang berisi kode plugin!*\n\n` +
                `Format: *.plugin + <nama.js>*\n\n` +
                `Contoh:\n` +
                `• *.plugin + hello.js* — tambah/timpa CJS\n` +
                `• *.plugin + hello.mjs esm* — tambah/timpa ESM\n\n` +
                `💡 Kode tidak perlu punya struktur lengkap —\n` +
                `   bot akan otomatis menyesuaikan!`
            );
        }

        if (!arg1) {
            return reply(`❌ Sertakan nama file!\nContoh: *.plugin + hello.js*`);
        }

        const rawCode  = m.quoted.text;
        const fileName = arg1;

        // Tentukan tipe: dari arg2, atau dari ekstensi file, atau dari isi kode
        let tipe;
        if (arg2 === 'esm' || fileName.endsWith('.mjs')) tipe = 'esm';
        else if (arg2 === 'cjs' || fileName.endsWith('.js')) tipe = 'cjs';
        else tipe = detectType(rawCode);

        let finalName = fileName;
        let targetDir;
        let wrappedCode;

        if (tipe === 'esm') {
            if (!finalName.endsWith('.mjs') && !finalName.endsWith('.js')) finalName += '.mjs';
            if (!fs.existsSync(ESM_DIR)) fs.mkdirSync(ESM_DIR, { recursive: true });
            targetDir   = ESM_DIR;
            wrappedCode = wrapEsm(rawCode, finalName);
        } else {
            if (!finalName.endsWith('.js')) finalName += '.js';
            targetDir   = CJS_DIR;
            wrappedCode = wrapCjs(rawCode, finalName);
        }

        const targetPath = path.join(targetDir, finalName);
        const isOverwrite = fs.existsSync(targetPath);

        // Validasi syntax kode yang sudah di-wrap (hanya untuk CJS)
        if (tipe === 'cjs') {
            try {
                new Function(wrappedCode);
            } catch (e) {
                return reply(
                    `❌ *Kode tidak valid!*\n\n` +
                    `Error: _${e.message}_\n\n` +
                    `Periksa kembali kode kamu.`
                );
            }
        }

        // Tulis file (overwrite jika sudah ada)
        fs.writeFileSync(targetPath, wrappedCode, 'utf8');

        // Invalidate cache agar langsung aktif
        if (tipe === 'cjs') {
            try { delete require.cache[require.resolve(targetPath)]; } catch {}
        }
        invalidateAllCaches();

        const cmdDetected = extractCommand(wrappedCode);
        return reply(
            `${isOverwrite ? '🔄 *Plugin diperbarui (overwrite)!*' : '✅ *Plugin berhasil ditambahkan!*'}\n\n` +
            `📁 Tipe   : *${tipe.toUpperCase()}*\n` +
            `📄 File   : *${finalName}*\n` +
            `📦 Size   : ${(Buffer.byteLength(wrappedCode) / 1024).toFixed(1)} KB\n` +
            (cmdDetected ? `🔑 Command: *.${cmdDetected}*\n` : '') +
            `\n_Auto-struktur diterapkan. Plugin langsung aktif!_`
        );
    }

    /* ── HAPUS ── */
    if (sub === '-') {
        if (!arg1) return reply(`Usage: *.plugin - <nomor> [cjs|esm]*`);

        const isCjs  = arg2 !== 'esm';
        const files  = isCjs ? listCjs() : listEsm();
        const dir    = isCjs ? CJS_DIR : ESM_DIR;
        const idx    = parseInt(arg1) - 1;

        if (isNaN(idx) || idx < 0 || idx >= files.length) {
            return reply(`❌ Nomor tidak valid! (1-${files.length})`);
        }

        const fileName = files[idx];
        const filePath = path.join(dir, fileName);

        // Safety: jangan hapus plugin manager sendiri
        if (fileName === 'owner-p.js' || fileName === 'owner-p.mjs') {
            return reply('⛔ Tidak bisa menghapus Plugin Manager!');
        }

        if (isCjs) {
            try { delete require.cache[require.resolve(filePath)]; } catch {}
        }
        fs.unlinkSync(filePath);
        invalidateAllCaches();

        return reply(`🗑️ Plugin *${fileName}* dihapus!\n_Tipe: ${isCjs ? 'CJS' : 'ESM'}_`);
    }

    /* ── LIHAT ISI ── */
    if (sub === '?') {
        if (!arg1) return reply(`Usage: *.plugin ? <nomor> [cjs|esm]*`);

        const isCjs = arg2 !== 'esm';
        const files = isCjs ? listCjs() : listEsm();
        const dir   = isCjs ? CJS_DIR : ESM_DIR;
        const idx   = parseInt(arg1) - 1;

        if (isNaN(idx) || idx < 0 || idx >= files.length) {
            return reply(`❌ Nomor tidak valid! (1-${files.length})`);
        }

        const fileName = files[idx];
        let content;
        try {
            content = fs.readFileSync(path.join(dir, fileName), 'utf8');
        } catch (e) {
            return reply(`❌ Gagal baca file: ${e.message}`);
        }
        const preview  = content.length > 3000
            ? content.substring(0, 3000) + '\n\n...(truncated, total ' + content.length + ' chars)'
            : content;

        return reply(`📄 *${fileName}* [${isCjs ? 'CJS' : 'ESM'}]\n\n${preview}`);
    }

    return reply(
        `❓ Subcommand tidak dikenal: *${sub}*\n\n` +
        `Tersedia: *list / + / - / ? / reload*\n` +
        `Ketik *.plugin* untuk info lengkap.`
    );
};

handler.command  = ['plugin', 'plugins'];
handler.tags     = ['owner'];
handler.owner    = true;
handler.mainOnly = true;
handler.fitur    = {
    'plugin':  'Kelola plugin CJS & ESM (auto-struktur)',
    'plugins': 'Kelola plugin CJS & ESM (auto-struktur)',
};
module.exports = handler;
