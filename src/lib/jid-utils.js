/**
 * jid-utils.js — Centralized JID/LID resolution
 * Diperlukan karena WA terbaru pakai @lid (Long ID) yang tidak mengandung nomor HP
 */
'use strict';

/* ── normalizeNum ─────────────────────────────────────────────
 * "0812.." → "62812.."  |  "628xxx:6@s.whatsapp.net" → "628xxx"
 * Return: string nomor 10-15 digit, atau null
 */
function normalizeNum(raw) {
    if (!raw) return null;
    let n = String(raw).split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (!n) return null;
    if (n.startsWith('0')) n = '62' + n.slice(1);
    if (!n.startsWith('62') && n.length < 11) n = '62' + n;
    return (n.length >= 10 && n.length <= 15) ? n : null;
}

function numToJid(num) {
    const n = normalizeNum(num);
    return n ? n + '@s.whatsapp.net' : null;
}

/* Hapus port suffix & tolak LID. Return "628xxx@s.whatsapp.net" atau null */
function cleanJid(raw) {
    if (!raw) return null;
    const s = String(raw);
    if (s.includes('@lid') || s.includes('@s.lid')) return null;
    const n = normalizeNum(s);
    return n ? n + '@s.whatsapp.net' : null;
}

function isLid(jid) {
    return !!(jid && (String(jid).includes('@lid') || String(jid).includes('@s.lid')));
}

/* ── resolveLid ───────────────────────────────────────────────
 * Coba resolve LID → "628xxx@s.whatsapp.net" via:
 *   1. global._lidToJidMap  (dikumpulkan real-time)
 *   2. participants list (phoneNumber, lidAlt, id)
 *   3. config.ownerLid
 */
function resolveLid(lid, participants = []) {
    if (!lid) return null;

    // 1. Global cache
    const cached = global._lidToJidMap?.[lid];
    if (cached) return cached;

    const lidBase = lid.split('@')[0].split(':')[0];

    // 2. Participants
    for (const p of participants) {
        const idBase  = (p.id  || '').split('@')[0].split(':')[0];
        const altBase = (p.lidAlt || '').split('@')[0];
        const match   = idBase === lidBase || altBase === lidBase;
        if (!match) continue;

        let jid = null;
        if (p.phoneNumber) {
            const n = normalizeNum(p.phoneNumber);
            if (n) jid = n + '@s.whatsapp.net';
        }
        if (!jid && p.id && !p.id.includes('@lid')) {
            const n = normalizeNum(p.id);
            if (n) jid = n + '@s.whatsapp.net';
        }
        if (!jid && p.lidAlt && !p.lidAlt.includes('@lid')) {
            const n = normalizeNum(p.lidAlt);
            if (n) jid = n + '@s.whatsapp.net';
        }
        if (jid) {
            if (!global._lidToJidMap) global._lidToJidMap = {};
            global._lidToJidMap[lid] = jid;
            return jid;
        }
    }

    // 3. ownerLid config
    try {
        const { config } = require('../../config.js');
        const idx = (config.ownerLid || []).indexOf(lid);
        if (idx >= 0 && config.owner?.[idx]) {
            const n = normalizeNum(String(config.owner[idx]));
            if (n) {
                const jid = n + '@s.whatsapp.net';
                if (!global._lidToJidMap) global._lidToJidMap = {};
                global._lidToJidMap[lid] = jid;
                return jid;
            }
        }
    } catch {}

    return null;
}

/* ── resolveJid — resolve apapun ke "628xxx@s.whatsapp.net" ── */
function resolveJid(raw, participants = []) {
    if (!raw) return null;
    const s = String(raw);
    if (isLid(s)) return resolveLid(s, participants);
    return cleanJid(s) || numToJid(normalizeNum(s));
}

/* ── extractTarget ────────────────────────────────────────────
 * Extract target JID dari: mention @tag → args nomor → reply
 * LID-safe: coba resolve setiap sumber
 */
function extractTarget(m, args = [], participants = []) {
    // 1. Mention @tag
    if (m.mentionedJid?.length) {
        for (const raw of m.mentionedJid) {
            if (!raw) continue;
            if (raw.includes('@s.whatsapp.net') && !isLid(raw)) return cleanJid(raw);
            if (isLid(raw)) {
                const r = resolveLid(raw, participants);
                if (r) return r;
                continue; // LID tidak bisa di-resolve → skip, jangan return null dulu
            }
            const n = normalizeNum(raw);
            if (n) return n + '@s.whatsapp.net';
        }
    }

    // 2. Args nomor
    if (args[0] && /^[\d+\-\s]+$/.test(args[0])) {
        const n = normalizeNum(args[0]);
        if (n) return n + '@s.whatsapp.net';
    }

    // 3. Reply/quoted — participantAlt SELALU @s.whatsapp.net
    if (m.quoted) {
        const srcs = [
            m.quoted.key?.participantAlt,
            m.quoted.sender,
            m.quoted.key?.participant,
            m.quoted.key?.remoteJid,
        ];
        for (const src of srcs) {
            if (!src) continue;
            if (src.includes('@s.whatsapp.net') && !isLid(src)) return cleanJid(src);
            if (isLid(src)) {
                const r = resolveLid(src, participants);
                if (r) return r;
            }
        }
    }

    return null;
}

function extractNum(m, args = [], participants = []) {
    const jid = extractTarget(m, args, participants);
    return jid ? normalizeNum(jid) : null;
}

/* ── forceJid ─────────────────────────────────────────────────
 * Resolusi paksa: LID → JID via semua sumber yang tersedia.
 * Dipakai di smsg() dan manzxy.js saat iterasi participants.
 *
 * @param {string}   raw          - JID/LID/nomor mentah
 * @param {Array}    participants - array participant grup (opsional)
 * @param {object}   conn         - Baileys socket (opsional, untuk cache contacts)
 * @returns {string|null}         - "628xxx@s.whatsapp.net" atau null
 */
function forceJid(raw, participants = [], conn = null) {
    if (!raw) return null;
    const s = String(raw);

    // Sudah JID bersih → langsung return
    if (s.includes('@s.whatsapp.net') && !isLid(s)) return cleanJid(s);

    // LID → coba resolve semua sumber
    if (isLid(s)) {
        // 1. participants list
        const fromPart = resolveLid(s, participants);
        if (fromPart) return fromPart;

        // 2. conn.contacts (Baileys stores contacts with notify/pushName)
        if (conn?.contacts) {
            for (const [cid, cdata] of Object.entries(conn.contacts)) {
                if (!cid || isLid(cid)) continue;
                if ((cdata?.lid && cdata.lid === s) ||
                    (cdata?.lidAlt && cdata.lidAlt === s)) {
                    const n = normalizeNum(cid);
                    if (n) {
                        const jid = n + '@s.whatsapp.net';
                        if (!global._lidToJidMap) global._lidToJidMap = {};
                        global._lidToJidMap[s] = jid;
                        return jid;
                    }
                }
            }
        }

        // 3. Global map fallback
        if (global._lidToJidMap?.[s]) return global._lidToJidMap[s];

        return null; // tidak bisa resolve
    }

    // Nomor biasa / JID format lain
    return cleanJid(s) || numToJid(normalizeNum(s)) || null;
}

module.exports = { normalizeNum, numToJid, cleanJid, isLid, resolveLid, resolveJid, extractTarget, extractNum, forceJid };
