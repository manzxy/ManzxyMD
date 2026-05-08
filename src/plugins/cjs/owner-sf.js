'use strict';

const fs   = require('fs');
const path = require('path');

const handler = async (m, { text, args, isOwn, reply, manzxy }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    const sub = (args[0] || '').toLowerCase();

    /* .sf — help */
    if (!args[0]) return reply(
        `🗂️ *File Manager*\n${'─'.repeat(28)}\n\n` +
        `*.sf <path>* — baca file\n` +
        `*.sf write <path>* — tulis (reply kode)\n` +
        `*.sf del <path>* — hapus file\n` +
        `*.sf ls [dir]* — list isi folder\n\n` +
        `*Contoh:*\n` +
        `• *.sf src/plugins/cjs/core.js*\n` +
        `• *.sf write src/plugins/cjs/test.js* (reply kode)\n` +
        `• *.sf ls src/plugins/cjs*`
    );

    const base = process.cwd();

    /* .sf ls — list direktori */
    if (sub === 'ls' || sub === 'dir') {
        const dirPath = args[1] ? path.resolve(base, args[1]) : base;
        if (!dirPath.startsWith(base)) return reply('❌ Path tidak valid.');
        if (!fs.existsSync(dirPath)) return reply(`❌ Folder tidak ada: ${args[1] || '.'}`);
        try {
            const items = fs.readdirSync(dirPath);
            const result = items.map(f => {
                const fp   = path.join(dirPath, f);
                const stat = fs.statSync(fp);
                const size = stat.isDirectory() ? '[dir]' : `${(stat.size/1024).toFixed(1)}KB`;
                return `${stat.isDirectory() ? '📁' : '📄'} ${f} (${size})`;
            }).join('\n');
            return reply(`📂 *${args[1] || '.'}*\n${'─'.repeat(28)}\n${result || '(kosong)'}`);
        } catch (e) { return reply(`❌ ${e.message}`); }
    }

    /* .sf del — hapus file */
    if (sub === 'del' || sub === 'delete' || sub === 'rm') {
        const fp = path.resolve(base, args[1] || '');
        if (!fp.startsWith(base)) return reply('❌ Path tidak valid.');
        if (!fs.existsSync(fp)) return reply('❌ File tidak ada.');
        try {
            fs.unlinkSync(fp);
            return reply(`✅ File dihapus: \`${args[1]}\``);
        } catch (e) { return reply(`❌ Gagal hapus: ${e.message}`); }
    }

    /* .sf write — tulis file */
    if (sub === 'write' || sub === 'save' || sub === 'w') {
        const filePath = args[1];
        if (!filePath) return reply('❌ Masukkan path file.\nContoh: *.sf write src/plugins/cjs/test.js*');
        const code = m.quoted?.text || text.split('\n').slice(2).join('\n');
        if (!code?.trim()) return reply('❌ Tidak ada kode. Reply pesan berisi kode, atau tulis setelah path.');
        const resolved = path.resolve(base, filePath);
        if (!resolved.startsWith(base)) return reply('❌ Path tidak valid.');
        try {
            fs.mkdirSync(path.dirname(resolved), { recursive: true });
            const existed = fs.existsSync(resolved);
            fs.writeFileSync(resolved, code);
            // Syntax check kalau .js
            if (resolved.endsWith('.js')) {
                const { execSync } = require('child_process');
                try { execSync(`node --check "${resolved}"`, { timeout: 5000 }); }
                catch (e) { return reply(`✅ File disimpan tapi ada syntax error:\n\`${e.stderr?.toString().slice(0,200) || e.message}\``); }
            }
            return reply(`✅ File ${existed ? 'ditimpa' : 'dibuat'}: \`${filePath}\`\n📦 ${(Buffer.byteLength(code)/1024).toFixed(2)} KB`);
        } catch (e) { return reply(`❌ Gagal: ${e.message}`); }
    }

    /* .sf <path> — baca file */
    const filePath = args[0];
    const resolved = path.resolve(base, filePath);
    if (!resolved.startsWith(base)) return reply('❌ Path tidak valid.');
    if (!fs.existsSync(resolved)) return reply(`❌ File tidak ada: \`${filePath}\``);
    try {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) return reply(`❌ Itu folder, gunakan *.sf ls ${filePath}*`);
        if (stat.size > 50_000) return reply(`❌ File terlalu besar (${(stat.size/1024).toFixed(1)}KB). Maks 50KB.`);
        const content = fs.readFileSync(resolved, 'utf8');
        return reply(`📄 *${filePath}*\n${'─'.repeat(28)}\n\`\`\`\n${content.slice(0, 3500)}\n\`\`\`${content.length > 3500 ? '\n_(terpotong)_' : ''}`);
    } catch (e) { return reply(`❌ ${e.message}`); }
};

handler.command  = ['sf', 'file', 'fm'];
handler.tags     = ['owner'];
handler.limit    = false;
handler.owner    = true;
handler.mainOnly = true;
handler.fitur    = {
    sf:   'File manager: baca/tulis/hapus/list file server',
    file: 'Alias sf',
    fm:   'Alias sf (file manager)',
};

module.exports = handler;
