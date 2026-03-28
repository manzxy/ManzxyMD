'use strict';

/**
 * otp-config.js — Konfigurasi & helper untuk plugin RumahOTP
 * Simpan di src/lib/ bukan src/plugins/cjs/ agar tidak di-reload handler.js
 */

const axios = require('axios');

// ── Config API ────────────────────────────────────────────────
const APIKEY   = 'ISI_API_KEY_RUMAHOTP_KAMU'; // ganti dengan API key kamu
const BASE_V1  = 'https://www.rumahotp.com/api/v1';
const BASE_V2  = 'https://www.rumahotp.com/api/v2';
const HEADERS  = { 'x-apikey': APIKEY, 'Content-Type': 'application/json' };

// ── LINE separator ────────────────────────────────────────────
const LINE = '─'.repeat(30);

// ── Format helpers ────────────────────────────────────────────
const fmtRp   = n  => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = ts => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};
const sisaWaktu = exp => {
    if (!exp) return '-';
    const sisa = new Date(exp).getTime() - Date.now();
    if (sisa <= 0) return 'Kedaluwarsa';
    const m = Math.floor(sisa / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}j ${m % 60}m` : `${m}m`;
};
const stokBadge = n => {
    if (n === null || n === undefined) return '❓';
    if (n === 0)  return '🔴 Habis';
    if (n < 10)   return `🟡 ${n}`;
    return `🟢 ${n}`;
};
const errMsg = e => e?.response?.data?.message || e?.message || 'Terjadi kesalahan';

// ── Database helpers (lazy load) ──────────────────────────────
let _db = null;
const _getDb = () => {
    if (!_db) _db = require('./database.js');
    return _db;
};

const getSaldo   = jid  => _getDb().getUser(jid)?.saldo || 0;
const tambahSaldo = (jid, jumlah) => {
    const db   = _getDb();
    const user = db.getUser(jid);
    user.saldo = (user.saldo || 0) + Number(jumlah);
    db.saveUser(jid, user);
    return user.saldo;
};
const kurangiSaldo = (jid, jumlah) => {
    const db   = _getDb();
    const user = db.getUser(jid);
    user.saldo = Math.max(0, (user.saldo || 0) - Number(jumlah));
    db.saveUser(jid, user);
    return user.saldo;
};

const getSetting = key => {
    try {
        const raw = _getDb().getSetting(key);
        if (raw === null || raw === undefined) return null;
        try { return JSON.parse(raw); } catch { return raw; }
    } catch { return null; }
};
const setSetting = (key, val) => {
    try {
        _getDb().setSetting(key, val === null ? null : JSON.stringify(val));
    } catch {}
};

// ── API wrapper ───────────────────────────────────────────────
const api = {
    // Deposit V1 — buat QRIS (response: qr base64 + id + expired)
    depositCreateV1: (amount) =>
        axios.post(`${BASE_V1}/deposit/create`, { amount }, { headers: HEADERS, timeout: 15000 }),

    // Status V1
    depositStatusV1: (id) =>
        axios.get(`${BASE_V1}/deposit/status`, { params: { id }, headers: HEADERS, timeout: 10000 }),

    // Status V2 — dapat brand_name & buyer_reff
    depositStatusV2: (id) =>
        axios.get(`${BASE_V2}/deposit/status`, { params: { id }, headers: HEADERS, timeout: 10000 }),

    // Cancel deposit
    depositCancel: (id) =>
        axios.post(`${BASE_V1}/deposit/cancel`, { id }, { headers: HEADERS, timeout: 10000 }),

    // Services — daftar layanan OTP
    getServices: () =>
        axios.get(`${BASE_V1}/service/list`, { headers: HEADERS, timeout: 15000 }),

    // Negara per service
    getCountries: (service_code) =>
        axios.get(`${BASE_V1}/service/country`, { params: { service_code }, headers: HEADERS, timeout: 15000 }),

    // Operator per country+provider
    getOperators: (country, provider_id) =>
        axios.get(`${BASE_V1}/operator/list`, { params: { country, provider_id }, headers: HEADERS, timeout: 15000 }),

    // Beli nomor OTP
    buyNumber: (service_code, country, operator_id) =>
        axios.post(`${BASE_V1}/number/buy`, { service_code, country, operator_id }, { headers: HEADERS, timeout: 15000 }),

    // Ambil SMS dari nomor
    getSms: (phone, request_id) =>
        axios.get(`${BASE_V1}/sms/get`, { params: { phone, request_id }, headers: HEADERS, timeout: 15000 }),

    // Kembalikan nomor
    cancelNumber: (phone, request_id) =>
        axios.post(`${BASE_V1}/number/cancel`, { phone, request_id }, { headers: HEADERS, timeout: 10000 }),

    // PPOB — cek rekening/ewallet
    ppobListBank: () =>
        axios.get(`${BASE_V1}/ppob/bank-list`, { headers: HEADERS, timeout: 15000 }),

    ppobCekRekening: (bank_code, account_number) =>
        axios.post(`${BASE_V1}/ppob/check-bank`, { bank_code, account_number }, { headers: HEADERS, timeout: 15000 }),

    // PPOB — cek akun game
    ppobListGame: () =>
        axios.get(`${BASE_V1}/ppob/game-list`, { headers: HEADERS, timeout: 15000 }),

    ppobCekAkun: (account_code, user_id) =>
        axios.post(`${BASE_V1}/ppob/check-game`, { account_code, user_id }, { headers: HEADERS, timeout: 15000 }),
};

module.exports = {
    APIKEY, BASE_V1, BASE_V2, HEADERS, LINE,
    fmtRp, fmtDate, sisaWaktu, stokBadge, errMsg,
    getSaldo, tambahSaldo, kurangiSaldo,
    getSetting, setSetting,
    api,
};
