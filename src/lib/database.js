/**
 * database.js — SQLite3 Backend (pengganti database.json)
 *
 * Menggunakan better-sqlite3 (synchronous, zero-config, sangat cepat).
 * Semua operasi tetap synchronous agar kompatibel dengan kode lama.
 *
 * Tabel:
 *   users    — data per JID
 *   groups   — data per group JID
 *   settings — key-value global (public, autobackup, maintenance)
 *   owners   — daftar nomor owner tambahan
 *   premium  — daftar nomor premium + expired
 *   jadibot_registry — bot aktif
 *   jadibot_stopped  — bot yang di-stop (session masih ada)
 *   jadibot_limits   — konfigurasi limit global
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const BetterSqlite = require('better-sqlite3');

const DB_DIR  = path.join(process.cwd(), 'database');
const DB_PATH = path.join(DB_DIR, 'bot.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

/* ── Buka koneksi ──────────────────────────────────────────── */
const db = new BetterSqlite(DB_PATH);

// WAL mode: jauh lebih cepat untuk write-heavy workload
db.pragma('journal_mode = WAL');
db.pragma('synchronous  = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size   = -32000'); // 32 MB cache
db.pragma('temp_store   = MEMORY');  // temp table di RAM, bukan disk
db.pragma('mmap_size    = 67108864'); // 64 MB mmap untuk reads lebih cepat

/* ── Skema Tabel ───────────────────────────────────────────── */
db.exec(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
        jid             TEXT PRIMARY KEY,
        data            TEXT NOT NULL DEFAULT '{}'
    );

    -- Groups
    CREATE TABLE IF NOT EXISTS groups (
        jid             TEXT PRIMARY KEY,
        data            TEXT NOT NULL DEFAULT '{}'
    );

    -- Settings (key-value)
    CREATE TABLE IF NOT EXISTS settings (
        key             TEXT PRIMARY KEY,
        value           TEXT NOT NULL
    );

    -- Owners (nomor tambahan di luar config.js)
    CREATE TABLE IF NOT EXISTS owners (
        number          TEXT PRIMARY KEY
    );

    -- Premium users
    CREATE TABLE IF NOT EXISTS premium (
        number          TEXT PRIMARY KEY,
        expired_at      INTEGER NOT NULL DEFAULT 0
    );

    -- JadiBot registry (bot aktif)
    CREATE TABLE IF NOT EXISTS jadibot_registry (
        number          TEXT PRIMARY KEY,
        method          TEXT NOT NULL DEFAULT 'pairing',
        owner_num       TEXT,
        owner_jid       TEXT,
        owner_role      TEXT NOT NULL DEFAULT 'free',
        started_at      INTEGER NOT NULL DEFAULT 0
    );

    -- JadiBot stopped (bot di-stop, session masih ada)
    CREATE TABLE IF NOT EXISTS jadibot_stopped (
        number          TEXT PRIMARY KEY,
        method          TEXT NOT NULL DEFAULT 'pairing',
        owner_num       TEXT,
        owner_jid       TEXT,
        owner_role      TEXT NOT NULL DEFAULT 'free',
        stopped_at      INTEGER NOT NULL DEFAULT 0
    );

    -- JadiBot limits
    CREATE TABLE IF NOT EXISTS jadibot_limits (
        key             TEXT PRIMARY KEY,
        value           INTEGER NOT NULL
    );

    -- Channel followers (user yang sudah verifikasi follow channel)
    CREATE TABLE IF NOT EXISTS channel_followers (
        number          TEXT PRIMARY KEY,
        verified_at     INTEGER NOT NULL DEFAULT 0
    );
`);

/* ── Default settings ──────────────────────────────────────── */
const _setDefault = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
_setDefault.run('public',      'true');
_setDefault.run('autobackup',  'true');
_setDefault.run('maintenance', 'false');

const _setLimitDefault = db.prepare(`INSERT OR IGNORE INTO jadibot_limits (key, value) VALUES (?, ?)`);
_setLimitDefault.run('free',    2);
_setLimitDefault.run('premium', 5);
_setLimitDefault.run('global',  20);

/* ── Prepared statements (cache untuk performa) ─────────────── */
const stmts = {
    // users
    getUser:    db.prepare(`SELECT data FROM users WHERE jid = ?`),
    setUser:    db.prepare(`INSERT OR REPLACE INTO users (jid, data) VALUES (?, ?)`),
    allUsers:   db.prepare(`SELECT jid, data FROM users`),

    // groups
    getGroup:   db.prepare(`SELECT data FROM groups WHERE jid = ?`),
    setGroup:   db.prepare(`INSERT OR REPLACE INTO groups (jid, data) VALUES (?, ?)`),
    allGroups:  db.prepare(`SELECT jid, data FROM groups`),

    // settings
    getSetting: db.prepare(`SELECT value FROM settings WHERE key = ?`),
    setSetting: db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`),
    allSettings:db.prepare(`SELECT key, value FROM settings`),

    // owners
    getOwners:  db.prepare(`SELECT number FROM owners`),
    addOwner:   db.prepare(`INSERT OR IGNORE INTO owners (number) VALUES (?)`),
    delOwner:   db.prepare(`DELETE FROM owners WHERE number = ?`),
    hasOwner:   db.prepare(`SELECT 1 FROM owners WHERE number = ?`),

    // premium
    getPremium:  db.prepare(`SELECT number, expired_at FROM premium`),
    addPremium:  db.prepare(`INSERT OR REPLACE INTO premium (number, expired_at) VALUES (?, ?)`),
    delPremium:  db.prepare(`DELETE FROM premium WHERE number = ?`),
    hasPremium:  db.prepare(`SELECT expired_at FROM premium WHERE number = ?`),

    // jadibot registry
    jbRegAll:    db.prepare(`SELECT * FROM jadibot_registry`),
    jbRegSet:    db.prepare(`INSERT OR REPLACE INTO jadibot_registry (number, method, owner_num, owner_jid, owner_role, started_at) VALUES (?, ?, ?, ?, ?, ?)`),
    jbRegDel:    db.prepare(`DELETE FROM jadibot_registry WHERE number = ?`),
    jbRegClear:  db.prepare(`DELETE FROM jadibot_registry`),

    // jadibot stopped
    jbStopAll:   db.prepare(`SELECT * FROM jadibot_stopped`),
    jbStopGet:   db.prepare(`SELECT * FROM jadibot_stopped WHERE number = ?`),
    jbStopSet:   db.prepare(`INSERT OR REPLACE INTO jadibot_stopped (number, method, owner_num, owner_jid, owner_role, stopped_at) VALUES (?, ?, ?, ?, ?, ?)`),
    jbStopDel:   db.prepare(`DELETE FROM jadibot_stopped WHERE number = ?`),

    // jadibot limits
    jbLimAll:    db.prepare(`SELECT key, value FROM jadibot_limits`),
    jbLimGet:    db.prepare(`SELECT value FROM jadibot_limits WHERE key = ?`),
    jbLimSet:    db.prepare(`INSERT OR REPLACE INTO jadibot_limits (key, value) VALUES (?, ?)`),

    // channel followers
    chfAdd:      db.prepare(`INSERT OR REPLACE INTO channel_followers (number, verified_at) VALUES (?, ?)`),
    chfDel:      db.prepare(`DELETE FROM channel_followers WHERE number = ?`),
    chfHas:      db.prepare(`SELECT 1 FROM channel_followers WHERE number = ?`),
    chfAll:      db.prepare(`SELECT number FROM channel_followers`),
};

/* ═══════════════════════════════════════════════════════════
   DEFAULT STRUCTURES
═══════════════════════════════════════════════════════════ */
const defaultUser = {
    limit: 20,
    exp: 0, level: 1,
    premium: false, premiumExpired: 0,
    banned: false,
    registered: false, name: '', sn: '', age: 0, gender: '',
    lastclaim: 0,
    money: 1000, health: 100, mana: 50, stamina: 100,
    stats: { strength: 10, defense: 5, agility: 5 },
    inventory: {},
    equipment: { weapon: null, armor: null },
    cooldown: { adventure: 0, daily: 0, hunt: 0, mine: 0 },
    lastLimitReset: 0,
    warn: {}
};

const defaultGroup = {
    welcome: false, welcomeMessage: '', leaveMessage: '',
    antilink: 'off', antilinkWhitelist: [], antilinkWarn: {},
    antilinkgc: 'off',
    mute: false, setinfo: false, adminonly: false, antiToxic: false,
    warns: {}, maxWarn: 3,
    ephemeral: 0,
    schedule: { jobs: [] }
};

/* ── deepMerge (sama seperti sebelumnya) ────────────────────── */
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            if (target[key] === undefined)
                target[key] = Array.isArray(source[key]) ? [...source[key]] : source[key];
        }
    }
    return target;
}

/* ── Normalize JID ───────────────────────────────────────────── */
function _normalizeJid(jid) {
    if (!jid) return null;
    if (jid.includes('@g.us')) return jid;
    if (jid.includes('@lid'))  return jid;
    const num = jid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    return num ? num + '@s.whatsapp.net' : jid;
}

/* ═══════════════════════════════════════════════════════════
   IN-MEMORY CACHE — sama seperti global.db dulu
   User & group di-cache di RAM, di-flush ke SQLite saat save()
═══════════════════════════════════════════════════════════ */
const _cache = {
    users:    {},   // { jid: userObj }
    groups:   {},   // { jid: groupObj }
};

/* ── Load semua users & groups ke cache ─────────────────────── */
let _dbLoaded = false;
function load() {
    if (_dbLoaded) return; // idempoten — tidak load ulang jika sudah
    _dbLoaded = true;
    // Load users
    for (const row of stmts.allUsers.all()) {
        try { _cache.users[row.jid] = JSON.parse(row.data); }
        catch { _cache.users[row.jid] = { ...defaultUser }; }
    }

    // Load groups
    for (const row of stmts.allGroups.all()) {
        try { _cache.groups[row.jid] = JSON.parse(row.data); }
        catch { _cache.groups[row.jid] = { ...defaultGroup }; }
    }

    // Expose global.db untuk kompatibilitas kode lama (scheduler, dsb)
    global.db = {
        users:    _cache.users,
        groups:   _cache.groups,
        settings: _getSettingsObj(),
    };

    console.log(`[DB] Loaded: ${Object.keys(_cache.users).length} users, ${Object.keys(_cache.groups).length} groups`);
}

function _getSettingsObj() {
    const obj = { autobackup: true, public: true, maintenance: false };
    for (const row of stmts.allSettings.all()) {
        try { obj[row.key] = JSON.parse(row.value); }
        catch { obj[row.key] = row.value; }
    }
    return obj;
}

/* ── Flush cache ke SQLite ───────────────────────────────────── */
const _flushUsers  = db.transaction((entries) => {
    for (const [jid, data] of entries)
        stmts.setUser.run(jid, JSON.stringify(data));
});
const _flushGroups = db.transaction((entries) => {
    for (const [jid, data] of entries)
        stmts.setGroup.run(jid, JSON.stringify(data));
});

// Debounced save — tunggu 2 detik sebelum flush ke SQLite
// Menghindari write tiap pesan saat burst traffic
let _saveTimer = null;
function _scheduleSave() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
        _saveTimer = null;
        _flushDirty();
    }, 2000);
}

function _flushDirty() {
    if (_dirtyUsers.size) {
        const entries = [..._dirtyUsers].map(jid => [jid, _cache.users[jid]]);
        _flushUsers(entries);
        _dirtyUsers.clear();
    }
    if (_dirtyGroups.size) {
        const entries = [..._dirtyGroups].map(jid => [jid, _cache.groups[jid]]);
        _flushGroups(entries);
        _dirtyGroups.clear();
    }
}

let _saveQueued = false;
async function save() {
    if (_saveQueued) return;
    _saveQueued = true;
    // Tunggu sampai akhir event loop supaya batch semua perubahan sekaligus
    setImmediate(() => {
        _saveQueued = false;
        try {
            _flushUsers(Object.entries(_cache.users));
            _flushGroups(Object.entries(_cache.groups));
        } catch (e) { console.error('[DB] Save error:', e.message); }
    });
}

// Auto-flush setiap 30 detik (safety net)
setInterval(() => {
    try {
        _flushUsers(Object.entries(_cache.users));
        _flushGroups(Object.entries(_cache.groups));
    } catch (e) { console.error('[DB] Auto-save error:', e.message); }
}, 30_000);

/* ── Backup (export ke JSON untuk safety) ───────────────────── */
const backupDir = path.join(DB_DIR, 'backup');
async function backup() {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const fileName   = `backup-${Date.now()}.json`;
    const backupPath = path.join(backupDir, fileName);
    const snapshot   = {
        users:    _cache.users,
        groups:   _cache.groups,
        settings: _getSettingsObj(),
    };
    await fs.promises.writeFile(backupPath, JSON.stringify(snapshot, null, 2));
    // Simpan max 5 backup
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort();
    if (files.length > 5) fs.unlinkSync(path.join(backupDir, files[0]));
}

setInterval(() => {
    const settings = _getSettingsObj();
    if (settings.autobackup) backup().catch(e => console.error('[DB] Backup error:', e.message));
}, 6 * 60 * 60 * 1000);

/* ═══════════════════════════════════════════════════════════
   USER API
═══════════════════════════════════════════════════════════ */
// Cache set untuk track user yang sudah di-init (skip deepMerge berikutnya)
const _userInited = new Set();

function getUser(jid) {
    if (!jid) return { ...defaultUser };
    jid = _normalizeJid(jid);

    if (!_cache.users[jid]) {
        const row = stmts.getUser.get(jid);
        _cache.users[jid] = row ? JSON.parse(row.data) : JSON.parse(JSON.stringify(defaultUser));
    }

    const user = _cache.users[jid];

    // deepMerge hanya sekali per user — sangat hemat CPU
    if (!_userInited.has(jid)) {
        deepMerge(user, defaultUser);
        if (!user.warn || typeof user.warn !== 'object' || Array.isArray(user.warn)) user.warn = {};
        _userInited.add(jid);
    }

    // Premium expire — cek hanya kalau user.premium aktif
    if (user.premium && user.premiumExpired && user.premiumExpired < Date.now()) {
        user.premium        = false;
        user.premiumExpired = 0;
    }

    // Limit reset tiap 12 jam
    const now = Date.now();
    if (!user.lastLimitReset || now - user.lastLimitReset > 12 * 3600 * 1000) {
        user.limit          = defaultUser.limit;
        user.lastLimitReset = now;
    }

    return user;
}

const _dirtyUsers  = new Set();
const _dirtyGroups = new Set();

function saveUser(jid, data) {
    jid = _normalizeJid(jid);
    _cache.users[jid] = data;
    _dirtyUsers.add(jid);
    _scheduleSave();
}

/* ═══════════════════════════════════════════════════════════
   GROUP API
═══════════════════════════════════════════════════════════ */
const _groupInited = new Set();

function getGroup(jid) {
    if (!jid) return { ...defaultGroup };

    if (!_cache.groups[jid]) {
        const row = stmts.getGroup.get(jid);
        _cache.groups[jid] = row ? JSON.parse(row.data) : JSON.parse(JSON.stringify(defaultGroup));
    }

    const group = _cache.groups[jid];

    // deepMerge + validasi hanya sekali per group
    if (!_groupInited.has(jid)) {
        deepMerge(group, defaultGroup);
        if (!Array.isArray(group.antilinkWhitelist)) group.antilinkWhitelist = [];
        if (!group.antilinkWarn || typeof group.antilinkWarn !== 'object') group.antilinkWarn = {};
        if (!group.warns        || typeof group.warns        !== 'object') group.warns        = {};
        if (typeof group.maxWarn !== 'number') group.maxWarn = 3;
        if (!group.schedule || typeof group.schedule !== 'object') group.schedule = { jobs: [] };
        if (!Array.isArray(group.schedule.jobs)) group.schedule.jobs = [];
        _groupInited.add(jid);
    }

    return group;
}

function saveGroup(jid, data) {
    _cache.groups[jid] = data;
    _dirtyGroups.add(jid);
    _scheduleSave();
}

/* ═══════════════════════════════════════════════════════════
   OWNER API
═══════════════════════════════════════════════════════════ */
function getOwners() {
    return stmts.getOwners.all().map(r => r.number);
}

function addOwner(number) {
    stmts.addOwner.run(String(number).replace(/[^0-9]/g, ''));
}

function delOwner(number) {
    stmts.delOwner.run(String(number).replace(/[^0-9]/g, ''));
}

function hasOwner(number) {
    return !!stmts.hasOwner.get(String(number).replace(/[^0-9]/g, ''));
}

/* ═══════════════════════════════════════════════════════════
   PREMIUM API
═══════════════════════════════════════════════════════════ */
function getPremiumList() {
    // Cek expired otomatis
    const now  = Date.now();
    const rows = stmts.getPremium.all();
    const valid = [];
    for (const row of rows) {
        if (row.expired_at !== 0 && row.expired_at < now) {
            stmts.delPremium.run(row.number); // auto-hapus yang expired
        } else {
            valid.push(row.number);
        }
    }
    return valid;
}

function addPremiumNum(number, expiredAt = 0) {
    number = String(number).replace(/[^0-9]/g, '');
    stmts.addPremium.run(number, expiredAt);
}

function delPremiumNum(number) {
    stmts.delPremium.run(String(number).replace(/[^0-9]/g, ''));
}

function getPremiumExpiry(number) {
    const row = stmts.hasPremium.get(String(number).replace(/[^0-9]/g, ''));
    return row ? row.expired_at : null;
}

// Kompatibilitas lama
function addPremium(jid, durationMs) {
    const user          = getUser(jid);
    user.premium        = true;
    user.premiumExpired = Date.now() + durationMs;
}
function removePremium(jid) {
    const user          = getUser(jid);
    user.premium        = false;
    user.premiumExpired = 0;
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS API
═══════════════════════════════════════════════════════════ */
function getSetting(key, fallback = null) {
    const row = stmts.getSetting.get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); }
    catch { return row.value; }
}

function setSetting(key, value) {
    if (value === null || value === undefined) {
        db.prepare('DELETE FROM settings WHERE key = ?').run(key);
        if (global.db?.settings) delete global.db.settings[key];
        return;
    }
    stmts.setSetting.run(key, JSON.stringify(value));
    if (global.db?.settings) global.db.settings[key] = value;
}

/* ═══════════════════════════════════════════════════════════
   JADIBOT REGISTRY API
═══════════════════════════════════════════════════════════ */
function jadibotRegistrySave(bots) {
    // bots = Map of number -> entry
    const tx = db.transaction(() => {
        stmts.jbRegClear.run();
        for (const [number, e] of bots.entries()) {
            if (e._stopped) continue;
            stmts.jbRegSet.run(number, e.method || 'pairing', e.ownerNum || null, e.ownerJid || null, e.ownerRole || 'free', e.startedAt || Date.now());
        }
    });
    tx();
}

function jadibotRegistryLoad() {
    return stmts.jbRegAll.all().map(r => ({
        number:    r.number,
        method:    r.method,
        ownerNum:  r.owner_num,
        ownerJid:  r.owner_jid,
        ownerRole: r.owner_role,
        startedAt: r.started_at,
    }));
}

/* ═══════════════════════════════════════════════════════════
   JADIBOT STOPPED API
═══════════════════════════════════════════════════════════ */
function jadibotStoppedSave(number, info) {
    stmts.jbStopSet.run(number, info.method || 'pairing', info.ownerNum || null, info.ownerJid || null, info.ownerRole || 'free', info.stoppedAt || Date.now());
}

function jadibotStoppedDelete(number) {
    stmts.jbStopDel.run(number);
}

function jadibotStoppedLoad() {
    const result = {};
    for (const r of stmts.jbStopAll.all()) {
        result[r.number] = {
            method:    r.method,
            ownerNum:  r.owner_num,
            ownerJid:  r.owner_jid,
            ownerRole: r.owner_role,
            stoppedAt: r.stopped_at,
        };
    }
    return result;
}

function jadibotStoppedGet(number) {
    const r = stmts.jbStopGet.get(number);
    if (!r) return null;
    return { method: r.method, ownerNum: r.owner_num, ownerJid: r.owner_jid, ownerRole: r.owner_role, stoppedAt: r.stopped_at };
}

/* ═══════════════════════════════════════════════════════════
   JADIBOT LIMITS API
═══════════════════════════════════════════════════════════ */
function jadibotLimitsLoad() {
    const result = { free: 2, premium: 5, global: 20 };
    for (const r of stmts.jbLimAll.all()) result[r.key] = r.value;
    return result;
}

function jadibotLimitsSave(limits) {
    const tx = db.transaction(() => {
        for (const [key, value] of Object.entries(limits))
            stmts.jbLimSet.run(key, value);
    });
    tx();
}

/* ═══════════════════════════════════════════════════════════
   CHANNEL FOLLOWERS — whitelist user yang sudah follow channel
═══════════════════════════════════════════════════════════ */
function channelFollowerAdd(number) {
    stmts.chfAdd.run(String(number).replace(/[^0-9]/g,''), Date.now());
}

function channelFollowerDel(number) {
    stmts.chfDel.run(String(number).replace(/[^0-9]/g,''));
}

function channelFollowerHas(number) {
    return !!stmts.chfHas.get(String(number).replace(/[^0-9]/g,''));
}

function channelFollowerList() {
    return stmts.chfAll.all().map(r => r.number);
}

/* ═══════════════════════════════════════════════════════════
   MIGRASI dari JSON lama → SQLite
   Dipanggil sekali saat pertama kali pakai SQLite
═══════════════════════════════════════════════════════════ */
function migrateFromJson() {
    const migrated = getSetting('_sqlite_migrated', false);
    if (migrated) return;

    console.log('[DB] Migrasi dari JSON → SQLite...');

    // database.json
    const oldDbPath = path.join(DB_DIR, 'database.json');
    if (fs.existsSync(oldDbPath)) {
        try {
            const old = JSON.parse(fs.readFileSync(oldDbPath, 'utf8'));
            const txUsers = db.transaction(() => {
                for (const [jid, data] of Object.entries(old.users || {}))
                    stmts.setUser.run(jid, JSON.stringify(data));
            });
            txUsers();
            const txGroups = db.transaction(() => {
                for (const [jid, data] of Object.entries(old.groups || {}))
                    stmts.setGroup.run(jid, JSON.stringify(data));
            });
            txGroups();
            console.log(`[DB] Migrasi: ${Object.keys(old.users||{}).length} users, ${Object.keys(old.groups||{}).length} groups`);
            // Rename agar tidak dimigrasi ulang
            fs.renameSync(oldDbPath, oldDbPath + '.migrated');
        } catch (e) { console.error('[DB] Migrasi database.json gagal:', e.message); }
    }

    // owner.json
    const ownerPath = path.join(DB_DIR, 'owner.json');
    if (fs.existsSync(ownerPath)) {
        try {
            const owners = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
            const tx = db.transaction(() => {
                for (const num of owners) stmts.addOwner.run(String(num).replace(/[^0-9]/g, ''));
            });
            tx();
            console.log(`[DB] Migrasi: ${owners.length} owners`);
            fs.renameSync(ownerPath, ownerPath + '.migrated');
        } catch (e) { console.error('[DB] Migrasi owner.json gagal:', e.message); }
    }

    // premium.json
    const premPath = path.join(DB_DIR, 'premium.json');
    if (fs.existsSync(premPath)) {
        try {
            const prems = JSON.parse(fs.readFileSync(premPath, 'utf8'));
            const tx = db.transaction(() => {
                for (const num of prems) stmts.addPremium.run(String(num).replace(/[^0-9]/g, ''), 0);
            });
            tx();
            console.log(`[DB] Migrasi: ${prems.length} premium users`);
            fs.renameSync(premPath, premPath + '.migrated');
        } catch (e) { console.error('[DB] Migrasi premium.json gagal:', e.message); }
    }

    // jadibot_registry.json
    const jbRegPath = path.join(DB_DIR, 'jadibot_registry.json');
    if (fs.existsSync(jbRegPath)) {
        try {
            const reg = JSON.parse(fs.readFileSync(jbRegPath, 'utf8'));
            const tx = db.transaction(() => {
                for (const e of reg)
                    stmts.jbRegSet.run(e.number, e.method||'pairing', e.ownerNum||null, e.ownerJid||null, e.ownerRole||'free', e.startedAt||Date.now());
            });
            tx();
            fs.renameSync(jbRegPath, jbRegPath + '.migrated');
        } catch (e) { console.error('[DB] Migrasi jadibot_registry.json gagal:', e.message); }
    }

    // jadibot_stopped.json
    const jbStopPath = path.join(DB_DIR, 'jadibot_stopped.json');
    if (fs.existsSync(jbStopPath)) {
        try {
            const stopped = JSON.parse(fs.readFileSync(jbStopPath, 'utf8'));
            const tx = db.transaction(() => {
                for (const [number, info] of Object.entries(stopped))
                    stmts.jbStopSet.run(number, info.method||'pairing', info.ownerNum||null, info.ownerJid||null, info.ownerRole||'free', info.stoppedAt||Date.now());
            });
            tx();
            fs.renameSync(jbStopPath, jbStopPath + '.migrated');
        } catch (e) { console.error('[DB] Migrasi jadibot_stopped.json gagal:', e.message); }
    }

    // jadibot_limits.json
    const jbLimPath = path.join(DB_DIR, 'jadibot_limits.json');
    if (fs.existsSync(jbLimPath)) {
        try {
            const limits = JSON.parse(fs.readFileSync(jbLimPath, 'utf8'));
            jadibotLimitsSave(limits);
            fs.renameSync(jbLimPath, jbLimPath + '.migrated');
        } catch (e) { console.error('[DB] Migrasi jadibot_limits.json gagal:', e.message); }
    }

    setSetting('_sqlite_migrated', true);
    console.log('[DB] ✓ Migrasi selesai → bot.db');
}

/* ── Jalankan migrasi sebelum load ─────────────────────────── */
migrateFromJson();

/* ── Raw db access (untuk keperluan advance) ─────────────────── */

/* ══════════════════════════════════════════════════════════════
   SEWABOT GROUP
   Menyimpan data sewa per group: groupJid → { ownerJid, paket, expiredAt, ... }
   ══════════════════════════════════════════════════════════════ */

function sewabotGet(groupJid) {
    const key = 'sewagrp_' + groupJid.replace(/[^0-9a-z@._]/gi, '_');
    const raw = getSetting(key);
    if (!raw) return null;
    try { return typeof raw === 'object' ? raw : JSON.parse(raw); } catch { return null; }
}

function sewabotSave(groupJid, data) {
    const key = 'sewagrp_' + groupJid.replace(/[^0-9a-z@._]/gi, '_');
    setSetting(key, data);
}

function sewabotDelete(groupJid) {
    const key = 'sewagrp_' + groupJid.replace(/[^0-9a-z@._]/gi, '_');
    setSetting(key, null);
}

function sewabotIsActive(groupJid) {
    const d = sewabotGet(groupJid);
    if (!d || !d.expiredAt) return false;
    if (d.expiredAt === -1) return true;
    return Date.now() < d.expiredAt;
}

function sewabotGetAll() {
    try {
        const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'sewagrp_%'`).all();
        const result = [];
        for (const row of rows) {
            try {
                const data = typeof row.value === 'object' ? row.value : JSON.parse(row.value);
                if (data && data.groupJid) result.push(data);
            } catch {}
        }
        return result;
    } catch { return []; }
}

// Simpan pending payment per sender
function sewaPendingSet(senderJid, data) {
    const key = 'sewapend_' + senderJid.replace(/[^0-9a-z@._]/gi, '_');
    setSetting(key, data);
}
function sewaPendingGet(senderJid) {
    const key = 'sewapend_' + senderJid.replace(/[^0-9a-z@._]/gi, '_');
    const raw = getSetting(key);
    if (!raw) return null;
    try { return typeof raw === 'object' ? raw : JSON.parse(raw); } catch { return null; }
}
function sewaPendingDel(senderJid) {
    const key = 'sewapend_' + senderJid.replace(/[^0-9a-z@._]/gi, '_');
    setSetting(key, null);
}

module.exports = {
    // Core lifecycle
    load,
    save,
    backup,
    db, // raw better-sqlite3 instance jika perlu query custom

    // User
    getUser,
    saveUser,

    // Group
    getGroup,
    saveGroup,

    // Owner
    getOwners,
    addOwner,
    delOwner,
    hasOwner,

    // Premium
    getPremiumList,
    addPremiumNum,
    delPremiumNum,
    getPremiumExpiry,
    addPremium,      // kompatibilitas lama
    removePremium,   // kompatibilitas lama

    // Settings
    getSetting,
    setSetting,

    // JadiBot
    jadibotRegistrySave,
    jadibotRegistryLoad,
    jadibotStoppedSave,
    jadibotStoppedDelete,
    jadibotStoppedLoad,
    jadibotStoppedGet,
    jadibotLimitsLoad,
    jadibotLimitsSave,

    // Channel followers
    channelFollowerAdd,
    channelFollowerDel,
    channelFollowerHas,
    channelFollowerList,
    // SewaBot Group
    sewabotGet,
    sewabotSave,
    sewabotDelete,
    sewabotIsActive,
    sewabotGetAll,
    sewaPendingSet,
    sewaPendingGet,
    sewaPendingDel,

    // Defaults (kompatibilitas lama)
    defaultUser,
    defaultGroup,
};
