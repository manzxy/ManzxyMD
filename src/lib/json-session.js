/**
 * json-session.js — Session Baileys pakai JSON file per nomor
 *
 * Struktur folder:
 *   session/jadibot/<nomor>/creds.json
 *   session/jadibot/<nomor>/app-state-sync-key-*.json
 *   dll
 *
 * Pakai useMultiFileAuthState bawaan Baileys — paling stabil,
 * tidak ada timing issue seperti SQLite async write queue.
 */

'use strict';

const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');
const fs   = require('fs');

/* ── Path resolver ────────────────────────────────────────────── */
function _sessionDir(sessionId) {
    // sessionId = "session/jadibot/628xxx"
    // → <cwd>/session/jadibot/628xxx/
    return path.join(process.cwd(), sessionId);
}

/* ── useJsonAuthState — wrapper useMultiFileAuthState ────────── */
async function useJsonAuthState(sessionId) {
    const dir = _sessionDir(sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return useMultiFileAuthState(dir);
}

/* ── sessionExists — cek apakah folder + creds.json ada ─────── */
function sessionExists(sessionId) {
    try {
        const dir   = _sessionDir(sessionId);
        const creds = path.join(dir, 'creds.json');
        return fs.existsSync(creds);
    } catch { return false; }
}

/* ── deleteSession — hapus seluruh folder session ────────────── */
function deleteSession(sessionId) {
    try {
        const dir = _sessionDir(sessionId);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
}

/* ── listSessions — cari semua folder session dengan prefix ──── */
function listSessions(prefix) {
    // prefix = "session/jadibot/"
    // cari semua subfolder dari <cwd>/session/jadibot/
    try {
        const base = path.join(process.cwd(), prefix);
        if (!fs.existsSync(base)) return [];
        return fs.readdirSync(base)
            .filter(name => {
                const creds = path.join(base, name, 'creds.json');
                return fs.existsSync(creds);
            })
            .map(name => prefix + name);
    } catch { return []; }
}

module.exports = { useJsonAuthState, sessionExists, deleteSession, listSessions };
