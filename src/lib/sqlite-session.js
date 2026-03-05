/**
 * sqlite-session.js — Session Baileys ke SQLite
 *
 * Perbaikan dari versi lama:
 *   - WAL mode + cache_size + mmap untuk performa & stabilitas
 *   - Write queue per-session → tidak ada concurrent write conflict
 *   - saveCreds pakai mutex → tidak ada race condition saat reconnect cepat
 *   - DB connection robust dengan retry on SQLITE_BUSY
 *   - Tidak buka ulang DB setiap panggilan (cached connection)
 */

'use strict';

const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const path     = require('path');
const fs       = require('fs');
const Database = require('better-sqlite3');

/* ─────────────────────────────────────────────────────────────
   OPEN DB — tuning untuk session yang stabil
   ───────────────────────────────────────────────────────────── */
function _openDb(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const db = new Database(dbPath, {
        // Timeout 10 detik sebelum SQLITE_BUSY → memberi waktu write selesai
        timeout: 10_000,
        // verbose: console.log, // uncomment untuk debug
    });

    // WAL mode — banyak reader, 1 writer, tidak ada locking
    db.pragma('journal_mode = WAL');

    // NORMAL sync = cukup aman + lebih cepat dari FULL
    db.pragma('synchronous = NORMAL');

    // 32 MB cache — kurangi disk I/O
    db.pragma('cache_size = -16384'); // 16MB — cukup untuk low-spec

    // Batasi WAL file agar tidak tumbuh tak terbatas
    db.pragma('wal_autocheckpoint = 1000');

    // Busy handler — retry otomatis jika DB sedang di-write
    db.pragma('busy_timeout = 10000');

    // 64 MB mmap untuk reads cepat
    db.pragma('mmap_size = 33554432'); // 32MB mmap
    // Temp table di RAM
    db.pragma('temp_store = MEMORY');

    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_id  TEXT NOT NULL,
            key_id      TEXT NOT NULL,
            data        TEXT NOT NULL,
            updated_at  INTEGER DEFAULT (strftime('%s','now')),
            PRIMARY KEY (session_id, key_id)
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_sid ON sessions(session_id);
    `);

    return db;
}

/* ─────────────────────────────────────────────────────────────
   PATH RESOLVER
     session/main          → session/session.db
     session/jadibot/628xx → session/jadibot/session.db
   ───────────────────────────────────────────────────────────── */
function _getDbPath(sessionId) {
    if (sessionId.startsWith('session/jadibot/')) {
        return path.join(process.cwd(), 'session', 'jadibot', 'session.db');
    }
    return path.join(process.cwd(), 'session', 'session.db');
}

/* ─────────────────────────────────────────────────────────────
   DB CONNECTION CACHE — satu koneksi per file DB
   ───────────────────────────────────────────────────────────── */
const _dbCache = new Map();

function _getDb(sessionId) {
    const dbPath = _getDbPath(sessionId);
    if (!_dbCache.has(dbPath)) {
        _dbCache.set(dbPath, _openDb(dbPath));
    }
    return _dbCache.get(dbPath);
}

/* ─────────────────────────────────────────────────────────────
   WRITE QUEUE — satu pending write per session_id
   Mencegah concurrent write yang merusak data session
   ───────────────────────────────────────────────────────────── */
const _writeQueues = new Map(); // sessionId → Promise chain

function _enqueue(sessionId, fn) {
    const prev = _writeQueues.get(sessionId) || Promise.resolve();
    const next = prev.then(() => {
        try { return fn(); }
        catch (e) { console.error(`[SESSION] Write error (${sessionId}):`, e.message); }
    });
    _writeQueues.set(sessionId, next);
    // Bersihkan map setelah selesai agar tidak memory leak
    next.finally(() => {
        if (_writeQueues.get(sessionId) === next) _writeQueues.delete(sessionId);
    });
    return next;
}

/* ─────────────────────────────────────────────────────────────
   PREPARED STATEMENT CACHE — compile sekali, pakai berkali-kali
   ───────────────────────────────────────────────────────────── */
const _stmtCache = new Map();

function _stmt(db, sql) {
    // Key pakai db.name (path file DB) + sql — bukan db object
    // db object.toString() = '[object Object]' → semua DB berbagi cache yang sama!
    const key = (db.name || String(db)) + '|' + sql;
    if (!_stmtCache.has(key)) {
        _stmtCache.set(key, db.prepare(sql));
    }
    return _stmtCache.get(key);
}

/* ─────────────────────────────────────────────────────────────
   CORE READ / WRITE / DELETE
   ───────────────────────────────────────────────────────────── */
function _read(db, sessionId, keyId) {
    try {
        const row = _stmt(db,
            'SELECT data FROM sessions WHERE session_id = ? AND key_id = ?'
        ).get(sessionId, keyId);
        if (!row) return null;
        return JSON.parse(row.data, BufferJSON.reviver);
    } catch {
        return null;
    }
}

function _write(db, sessionId, keyId, data) {
    _stmt(db,
        'INSERT OR REPLACE INTO sessions (session_id, key_id, data, updated_at) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))'
    ).run(sessionId, keyId, JSON.stringify(data, BufferJSON.replacer));
}

function _delete(db, sessionId, keyId) {
    _stmt(db,
        'DELETE FROM sessions WHERE session_id = ? AND key_id = ?'
    ).run(sessionId, keyId);
}

/* ─────────────────────────────────────────────────────────────
   BATCH WRITE — semua keys dalam satu transaction
   ───────────────────────────────────────────────────────────── */
function _batchWrite(db, sessionId, entries) {
    // entries: [ { keyId, data | null } ]
    if (!entries.length) return;

    const upsert = _stmt(db,
        'INSERT OR REPLACE INTO sessions (session_id, key_id, data, updated_at) VALUES (?, ?, ?, strftime(\'%s\',\'now\'))'
    );
    const del = _stmt(db,
        'DELETE FROM sessions WHERE session_id = ? AND key_id = ?'
    );

    const tx = db.transaction(() => {
        for (const { keyId, data } of entries) {
            if (data !== null) {
                upsert.run(sessionId, keyId, JSON.stringify(data, BufferJSON.replacer));
            } else {
                del.run(sessionId, keyId);
            }
        }
    });
    tx();
}

/* ─────────────────────────────────────────────────────────────
   useSQLiteAuthState — dipanggil setiap startJadiBot / connectToWhatsApp
   ───────────────────────────────────────────────────────────── */
async function useSQLiteAuthState(sessionId) {
    const db    = _getDb(sessionId);
    const creds = _read(db, sessionId, 'creds') || initAuthCreds();

    const keys = {
        // GET — baca banyak keys sekaligus
        get: async (type, ids) => {
            const result = {};
            for (const id of ids) {
                let val = _read(db, sessionId, `${type}-${id}`);
                if (type === 'app-state-sync-key' && val) {
                    val = proto.Message.AppStateSyncKeyData.fromObject(val);
                }
                result[id] = val;
            }
            return result;
        },

        // SET — tulis semua sekaligus dalam 1 transaction, lewat queue
        set: async (data) => {
            const entries = [];
            for (const [category, items] of Object.entries(data)) {
                for (const [id, val] of Object.entries(items || {})) {
                    entries.push({ keyId: `${category}-${id}`, data: val ?? null });
                }
            }
            if (!entries.length) return;
            return _enqueue(sessionId, () => _batchWrite(db, sessionId, entries));
        },
    };

    // saveCreds — tulis lewat queue agar tidak race condition
    const saveCreds = () => _enqueue(sessionId, () => _write(db, sessionId, 'creds', creds));

    return { state: { creds, keys }, saveCreds };
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */
function sessionExists(sessionId) {
    try {
        const db  = _getDb(sessionId);
        const row = db.prepare(
            'SELECT 1 FROM sessions WHERE session_id = ? LIMIT 1'
        ).get(sessionId);
        return !!row;
    } catch { return false; }
}

function deleteSession(sessionId) {
    try {
        const db = _getDb(sessionId);
        db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
    } catch {}
}

function listSessions(prefix) {
    try {
        const db   = _getDb(prefix + 'dummy');
        const rows = db.prepare(
            'SELECT DISTINCT session_id FROM sessions WHERE session_id LIKE ?'
        ).all(prefix + '%');
        return rows.map(r => r.session_id);
    } catch { return []; }
}

/* ─────────────────────────────────────────────────────────────
   WAL CHECKPOINT — jalankan berkala agar WAL tidak menumpuk
   ───────────────────────────────────────────────────────────── */
function startWalCheckpoint(intervalMs = 10 * 60_000) {
    setInterval(() => {
        for (const [, db] of _dbCache) {
            try { db.pragma('wal_checkpoint(PASSIVE)'); }
            catch {}
        }
    }, intervalMs);
}

// Jalankan otomatis saat module di-load
startWalCheckpoint();

function _walCheckpoint() {
    for (const [, db] of _dbCache) {
        try { db.pragma('wal_checkpoint(PASSIVE)'); } catch {}
    }
}

module.exports = { useSQLiteAuthState, sessionExists, deleteSession, listSessions, _walCheckpoint };
