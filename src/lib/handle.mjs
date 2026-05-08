/**
 * handle.mjs — ESM Plugin Handler
 * Mtime-based cache + guard flags (group, private, admin, owner, premium, botAdmin)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const require    = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ESM_DIR    = path.join(__dirname, '../plugins/esm');

const logger = require('../core/logger.js');

/* ── Plugin cache (mtime-based) ─────────────────────────── */
let _plugins  = [];
let _mtimes   = {};
let _lastScan = 0;
const SCAN_INTERVAL = 60_000; // selaraskan dengan handler.js

const _needsReload = () => {
    if (!_plugins.length) return true;
    const now = Date.now();
    if (now - _lastScan < SCAN_INTERVAL) return false;
    _lastScan = now;
    if (!fs.existsSync(ESM_DIR)) return false;
    for (const file of fs.readdirSync(ESM_DIR)) {
        if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;
        const fp = path.join(ESM_DIR, file);
        if (_mtimes[fp] !== fs.statSync(fp).mtimeMs) return true;
    }
    return false;
};

export const loadPlugins = async () => {
    if (!_needsReload()) return _plugins;
    const loaded = [];
    if (!fs.existsSync(ESM_DIR)) { _plugins = loaded; return loaded; }
    for (const file of fs.readdirSync(ESM_DIR)) {
        if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;
        const fp = path.join(ESM_DIR, file);
        try {
            const mtime = fs.statSync(fp).mtimeMs;
            const mod   = await import(pathToFileURL(fp).href + `?v=${mtime}`);
            const plugin = mod.default || mod;
            if (typeof plugin === 'function' && plugin.command) {
                loaded.push(plugin);
                _mtimes[fp] = mtime;
            }
        } catch (e) {
            logger.error(`[ESM] Load error ${file}:`, e.message);
        }
    }
    _plugins  = loaded;
    _lastScan = Date.now();
    return loaded;
};

/* ─────────────────────────────────────────────────────────
   Guard check — sama persis dengan handler.js
   Flags: group | private | admin | owner | premium | botAdmin
   ───────────────────────────────────────────────────────── */
const checkGuard = (plugin, m, Obj) => {
    const { reply, isOwn, isPrem, user, isAdmin, botAdmin } = Obj;
    const isGroup   = m.isGroup;
    const isPrivate = !isGroup;

    const isChannel = m.isChannel || false;

    if (plugin.channel && !isChannel)
        return reply('❌ Fitur ini hanya bisa digunakan di *channel*.');

    if (plugin.group && !isGroup && !isChannel)
        return reply('❌ Fitur ini hanya bisa digunakan di *grup*.');

    if (plugin.private && !isPrivate)
        return reply('❌ Fitur ini hanya bisa digunakan di *private chat*.');

    if (plugin.owner && !isOwn)
        return reply('⛔ Fitur ini khusus *owner bot*.');

    if (plugin.premium && !isOwn && !isPrem && !user?.premium)
        return reply('💎 Fitur ini khusus *premium*. Hubungi owner untuk upgrade.');

    if (plugin.admin && isGroup && !isAdmin && !isOwn)
        return reply('❌ Fitur ini khusus *admin grup*.');

    if (plugin.botAdmin && isGroup && !botAdmin)
        return reply('❌ Bot harus menjadi *admin grup* dulu.');

    return null; // lolos semua guard
};

/* ── Handle message ──────────────────────────────────────── */
const handleMessage = async (m, commandText, Obj) => {
    const plugins = await loadPlugins();
    for (const plugin of plugins) {
        const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
        if (!cmds.map(c => String(c).toLowerCase()).includes(commandText.toLowerCase())) continue;

        // Guard check
        const blocked = checkGuard(plugin, m, Obj);
        if (blocked !== null) return true;

        try {
            await plugin(m, Obj);
            return true;
        } catch (err) {
            logger.error(`[ESM] Exec error .${commandText}:`, err.message);
            Obj.reply?.('❌ Terjadi kesalahan saat menjalankan perintah.');
            return false;
        }
    }
    return false;
};

export default handleMessage;
