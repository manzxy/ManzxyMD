const fs = require('fs');

const config = {
    prefa: [".", "#", "!"],
    owner: ['6288989721627'],
    // LID owner — isi dengan LID kamu (lihat dari log [PV_DEBUG])
    // LID kamu: 208843271364847@lid
    ownerLid: ['208843271364847@lid'],
    thumbnail: "https://c.termai.cc/a160/RfVQey8.jpg",
    nameBot: "Yogiri",
    nameOwn: "Manzxy",
    version: "2.0",

    // ══════════════════════════════════════════════
    // 💳 QRISMU PAYMENT CONFIG
    // Daftar & ambil key di https://www.qrismu.app
    // publicKey  = X-API-Key  (QRMU_live_xxxx)
    // secretKey  = untuk HMAC-SHA256 signature
    // webhookUrl = opsional, endpoint notif bayar
    // ══════════════════════════════════════════════
    qrismu: {
        publicKey:  '',   // ganti dengan public key kamu
        secretKey:  '',              // ganti dengan secret key kamu
        webhookUrl: '',                             // opsional
    },

    // ══════════════════════════════════════════════
    // 🏪 SEWABOT CONFIG
    // ══════════════════════════════════════════════
    sewabot: {
        enabled:    true,                          // aktifkan/nonaktifkan fitur sewa
        apikey:     "",      // API key heroikzre
        harga: {
            "1bulan":  15000,   // Rp 15.000 / bulan
            "3bulan":  40000,   // Rp 40.000 / 3 bulan
            "6bulan":  75000,   // Rp 75.000 / 6 bulan
            "1tahun":  140000,  // Rp 140.000 / tahun
        },
        // Durasi dalam ms per paket
        durasi: {
            "1bulan":  30  * 24 * 3600 * 1000,
            "3bulan":  90  * 24 * 3600 * 1000,
            "6bulan":  180 * 24 * 3600 * 1000,
            "1tahun":  365 * 24 * 3600 * 1000,
        },
        // Timeout cek pembayaran (menit)
        paymentTimeout: 15,
    },

    // 🔥 TELEGRAM BACKUP CONFIG
    telegram: {
        token: "8231389821:AAEAQ63yZR1GlbULy0mAxJWf0kSoSqbg_rM",
        chat_id: "8115232554"
    }
};

const mess = {
    owner: "⛔ Owner Only!",
    premium: "💎 Premium Only!",
    admin: "🛡️ Admin Grup Only!",
    botAdmin: "🤖 Bot harus jadi admin!",
    group: "📢 Khusus di Grup!",
    private: "🔒 Khusus di Private Chat!",
};

const init = {
    session: "./session",
    customPair: "MANZKENX",

    // ── LOGIN METHOD ─────────────────────────────────────────────────
    // "pairing" = login dengan pairing code (default)
    // "qr"      = login dengan scan QR di terminal
    loginMethod: "pairing"
};

// config tidak perlu auto-reload — manzxy.js selalu require fresh tiap request

module.exports = { config, init, mess };
