const fs   = require("fs");
const path = require("path");

const PLUGINS_DIR = path.join(__dirname, "../plugins/cjs");

/* ── Plugin cache — reload hanya jika file berubah ── */
let _cache    = null;  // { cmdMap, plugins }
let _mtimes   = {};
let _lastScan = 0;
const SCAN_INTERVAL = 30_000; // scan tiap 30 detik — hemat I/O untuk low-spec

const _needsReload = () => {
    if (!_cache) return true;
    const now = Date.now();
    if (now - _lastScan < SCAN_INTERVAL) return false;
    _lastScan = now;
    if (!fs.existsSync(PLUGINS_DIR)) return false;
    for (const file of fs.readdirSync(PLUGINS_DIR)) {
        if (!file.endsWith(".js")) continue;
        const fp = path.join(PLUGINS_DIR, file);
        if (_mtimes[fp] !== fs.statSync(fp).mtimeMs) return true;
    }
    return false;
};

const _buildCache = () => {
    const cmdMap  = new Map();
    const plugins = [];
    if (!fs.existsSync(PLUGINS_DIR)) return { cmdMap, plugins };
    for (const file of fs.readdirSync(PLUGINS_DIR)) {
        if (!file.endsWith(".js")) continue;
        const fp = path.join(PLUGINS_DIR, file);
        try {
            delete require.cache[require.resolve(fp)];
            const plugin = require(fp);
            if (typeof plugin !== "function" || !plugin.command) continue;
            plugins.push(plugin);
            const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
            for (const cmd of cmds) cmdMap.set(String(cmd).toLowerCase(), plugin);
            _mtimes[fp] = fs.statSync(fp).mtimeMs;
        } catch (err) {
            require("../core/logger.js").error(`[CJS] Load error ${file}:`, err.message);
        }
    }
    _lastScan = Date.now();
    return { cmdMap, plugins };
};

/* ─────────────────────────────────────────────────────────
   Guard check — validasi flag plugin sebelum eksekusi
   Flags yang didukung:
     handler.group   = true  → hanya di grup
     handler.private = true  → hanya di private chat
     handler.admin   = true  → hanya admin grup
     handler.owner   = true  → hanya owner bot
     handler.premium = true  → hanya premium/owner
   ───────────────────────────────────────────────────────── */
const checkGuard = (plugin, m, Obj) => {
    const { reply, isOwn, isPrem, user, isAdmin, botAdmin } = Obj;
    const isGroup   = m.isGroup;
    const isPrivate = !isGroup;

    const isChannel = m.isChannel || false;

    if (plugin.channel && !isChannel)
        return reply("❌ Fitur ini hanya bisa digunakan di *channel*.");

    if (plugin.group && !isGroup && !isChannel)
        return reply("❌ Fitur ini hanya bisa digunakan di *grup*.");

    if (plugin.private && !isPrivate)
        return reply("❌ Fitur ini hanya bisa digunakan di *private chat*.");

    if (plugin.owner && !isOwn)
        return reply("⛔ Fitur ini khusus *owner bot*.");

    if (plugin.premium && !isOwn && !isPrem && !user?.premium)
        return reply("💎 Fitur ini khusus *premium*. Hubungi owner untuk upgrade.");

    if (plugin.admin && isGroup && !isAdmin && !isOwn)
        return reply("❌ Fitur ini khusus *admin grup*.");

    if (plugin.botAdmin && isGroup && !botAdmin)
        return reply("❌ Bot harus menjadi *admin grup* dulu.");

    return null; // lolos semua guard
};

/* ── Public API ── */
const handleMessage = async (m, commandText, Obj) => {
    if (_needsReload()) _cache = _buildCache();
    const plugin = _cache.cmdMap.get(commandText.toLowerCase());
    if (!plugin) return false;

    // Guard check
    const blocked = checkGuard(plugin, m, Obj);
    if (blocked !== null) return true; // dianggap "handled" (sudah reply error)

    try {
        await plugin(m, Obj);
        return true;
    } catch (err) {
        require("../core/logger.js").error(`[CJS] Exec error .${commandText}:`, err.message);
        Obj.reply?.("❌ Terjadi kesalahan saat menjalankan perintah.");
        return false;
    }
};

handleMessage.getPlugins = () => {
    if (_needsReload()) _cache = _buildCache();
    return Promise.resolve(_cache?.plugins || []);
};

// Force reload — dipanggil setelah plugin ditambah/dihapus via plugin manager
handleMessage.forceReload = () => {
    _lastScan = 0;
    _cache    = null;
    _mtimes   = {};
    _cache    = _buildCache();
};

_cache = _buildCache();
module.exports = handleMessage;
