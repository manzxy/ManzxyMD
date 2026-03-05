/**
 * core.js — Menu utama
 * Scan semua plugin CJS & ESM, tampilkan per kategori dengan nama fitur dari handler.fitur
 */
'use strict';
const { config }     = require('../../../config.js');
const { getTime, tanggal, runtime } = require('../../core/message.js');
// Case tidak dipakai
const fs             = require('fs');
const path           = require('path');
const util           = require('util');
const { exec }       = require('child_process');

const CJS_DIR = path.join(process.cwd(), 'src/plugins/cjs');
const ESM_DIR = path.join(process.cwd(), 'src/plugins/esm');

/* ── Muat semua plugin CJS (dengan fitur nama) ── */
const loadCjsPlugins = () => {
    const plugins = [];
    if (!fs.existsSync(CJS_DIR)) return plugins;
    for (const file of fs.readdirSync(CJS_DIR).filter(f => f.endsWith('.js'))) {
        try {
            const fp = path.join(CJS_DIR, file);
            delete require.cache[require.resolve(fp)];
            const p = require(fp);
            if (typeof p === 'function' && p.command) plugins.push(p);
        } catch {}
    }
    return plugins;
};

/* ── Muat semua plugin ESM (dengan fitur nama) ── */
const loadEsmPlugins = async () => {
    const plugins = [];
    if (!fs.existsSync(ESM_DIR)) return plugins;
    const { pathToFileURL } = require('url');
    for (const file of fs.readdirSync(ESM_DIR).filter(f => f.endsWith('.mjs') || f.endsWith('.js'))) {
        try {
            const fp  = path.join(ESM_DIR, file);
            const mod = await import(pathToFileURL(fp).href + `?v=${fs.statSync(fp).mtimeMs}`);
            const p   = mod.default || mod;
            if (typeof p === 'function' && p.command) plugins.push(p);
        } catch {}
    }
    return plugins;
};

/* ── Group plugin per tag, tampilkan command + deskripsi dari handler.fitur ── */
const buildMenuSection = (title, plugins) => {
    // byTag: { tag: [ {cmd, desc} ] }
    const byTag = {};

    for (const p of plugins) {
        const tags = Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : ['lainnya']);
        const cmds = Array.isArray(p.command) ? p.command : [p.command];
        const fiturObj = (p.fitur && typeof p.fitur === 'object') ? p.fitur : null;
        const fiturStr = (p.fitur && typeof p.fitur === 'string') ? p.fitur : '';

        for (const tag of tags) {
            if (!byTag[tag]) byTag[tag] = [];

            // Kumpulkan: desc → command pertama yang punya desc itu
            // Alias dengan desc sama → hanya command pertama yang masuk
            const seenDesc = new Map(); // desc → cmd
            for (const cmd of cmds) {
                const desc = fiturObj ? (fiturObj[cmd] || '') : fiturStr;
                if (!desc) continue;
                if (!seenDesc.has(desc)) {
                    seenDesc.set(desc, cmd);  // simpan command pertama per desc
                }
            }
            // Push hanya entry unik (1 desc = 1 baris)
            for (const [desc, cmd] of seenDesc) {
                byTag[tag].push({ cmd, desc });
            }
        }
    }

    const tagsSorted = Object.keys(byTag).sort();
    if (!tagsSorted.length) return '';

    // Dedup global: desc yang sudah muncul di tag sebelumnya tidak tampil lagi
    const seenGlobal = new Set();
    let text = `\n╭──〈 *${title}* 〉`;
    for (const tag of tagsSorted) {
        const lines = [];
        for (const { cmd, desc } of byTag[tag]) {
            if (seenGlobal.has(desc)) continue;
            seenGlobal.add(desc);
            lines.push(`\n│  .${cmd} — ${desc}`);
        }
        if (!lines.length) continue; // skip tag kosong setelah dedup
        text += `\n│\n│ ❏ *${tag.toUpperCase()}*`;
        text += lines.join('');
    }
    text += '\n╰────────────────────';
    return text;
};

const handler = async (m, { manzxy, reply, isOwn }) => {
    const { name, version } = require('../../../package.json');
    const time = getTime('HH:mm:ss');
    const date = tanggal(new Date());
    const run  = runtime(process.uptime());
    const ram  = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    const ownerNum  = config.owner?.[0] ? '+' + String(config.owner[0]).replace(/[^0-9]/g, '') : 'N/A';
    const prefix    = config.prefa?.[0] || '.';
    const botMode   = manzxy.public ? '🌐 Public' : '🔒 Self';

    const [cjsPlugins, esmPlugins] = await Promise.all([
        Promise.resolve(loadCjsPlugins()),
        loadEsmPlugins(),
    ]);

    // Header
    let menu =
        `╭──〈 *${(name || 'ManzxyMD').toUpperCase()}* 〉\n` +
        `│  🤖 Bot     : ${name || 'ManzxyMD'}\n` +
        `│  🌿 Version : ${version || '1.0.0'}\n` +
        `│  📅 Tanggal : ${date}\n` +
        `│  🕐 Waktu   : ${time} WIB\n` +
        `│  ⏳ Uptime  : ${run}\n` +
        `│  💾 RAM     : ${ram} MB\n` +
        `│  👤 Owner   : ${ownerNum}\n` +
        `│  ⚙️  Mode    : ${botMode}\n` +
        `╰────────────────────`;

    // Plugin CJS
    const cjsSection = buildMenuSection('PLUGIN CJS', cjsPlugins);
    if (cjsSection) menu += cjsSection;

    // Plugin ESM
    const esmSection = buildMenuSection('PLUGIN ESM', esmPlugins);
    if (esmSection) menu += esmSection;

    menu += `\n\n_Prefix: *${prefix}*  •  Total: *${cjsPlugins.length + esmPlugins.length} plugin*_`;

    await manzxy.sendMessage(m.chat, {
        text: menu,
        contextInfo: {
            externalAdReply: {
                title: name || 'ManzxyMD',
                body: `${cjsPlugins.length + esmPlugins.length} fitur tersedia`,
                thumbnailUrl: config.thumbnail || '',
                sourceUrl: 'https://github.com/WJayadana/manzxyBase',
                mediaType: 1,
                renderLargerThumbnail: true,
            }
        }
    }, { quoted: m });
};

handler.command = ['menu', 'help'];
handler.tags    = ['info'];
handler.limit    = false;
handler.fitur    = {
    'menu': 'Tampilkan menu semua fitur',
    'help': 'Tampilkan menu semua fitur',
};
module.exports = handler;
