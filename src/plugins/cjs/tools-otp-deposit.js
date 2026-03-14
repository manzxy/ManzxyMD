'use strict';
/* ════════════════════════════════════════════════════════════════
   tools-otp-deposit.js  —  Sistem Top Up Saldo via QRIS

   Commands:
     .deposit              → lihat saldo + status pending
     .deposit saldo        → lihat saldo
     .deposit <nominal>    → buat QRIS (min Rp 2.000)
     .deposit cek          → konfirmasi setelah bayar (pakai v2 — dapat info brand/buyer)
     .deposit batal        → batalkan transaksi pending
     .deposit riwayat      → histori 10 transaksi terakhir
     .dep / .topup         → alias

   Catatan:
     - Deposit v1: response QRIS base64 (langsung kirim sebagai gambar)
     - Status v2 : dapat brand_name (DANA, OVO, dll) & buyer_reff
     - Maks 3 pending sekaligus (limit dari rumahotp)
════════════════════════════════════════════════════════════════ */

const {
    getSaldo, tambahSaldo,
    fmtRp, fmtDate, sisaWaktu,
    api, errMsg,
    getSetting, setSetting, LINE,
} = require('../../lib/otp-config');

// ──────────────────────────────────────────────────────────────
//  KONSTANTA
// ──────────────────────────────────────────────────────────────
const MIN = 2_000;
const MAX = 5_000_000;

// ──────────────────────────────────────────────────────────────
//  STORAGE PER USER  (key: dep_pend_<num>  /  dep_hist_<num>)
// ──────────────────────────────────────────────────────────────
const _pk = (n) => `dep_pend_${n}`;
const _hk = (n) => `dep_hist_${n}`;

const getPend  = (n)    => getSetting(_pk(n)) || null;
const setPend  = (n, d) => setSetting(_pk(n), d);
const clrPend  = (n)    => setSetting(_pk(n), null);
const getHist  = (n)    => getSetting(_hk(n)) || [];
const addHist  = (n, d) => {
    const h = getHist(n);
    h.unshift(d);
    setSetting(_hk(n), h.slice(0, 10));
};

// ──────────────────────────────────────────────────────────────
//  STATUS ICON & LABEL
// ──────────────────────────────────────────────────────────────
const STATUS_MAP = {
    success: { icon: '✅', label: 'Berhasil'   },
    pending: { icon: '⏳', label: 'Menunggu'   },
    cancel:  { icon: '🚫', label: 'Dibatalkan' },
    expired: { icon: '❌', label: 'Kedaluwarsa' },
    failed:  { icon: '⛔', label: 'Gagal'       },
};
const st = (s) => STATUS_MAP[s?.toLowerCase()] || { icon: '❓', label: s || '-' };

// ──────────────────────────────────────────────────────────────
//  HANDLER
// ──────────────────────────────────────────────────────────────
const handler = async (m, { manzxy, args, reply, senderJid, senderNum, pushname }) => {
    const sub = (args[0] || '').toLowerCase().trim();

    /* ── .deposit  |  .deposit saldo ─────────────────────────── */
    if (!sub || sub === 'saldo' || sub === 'balance') {
        const saldo = getSaldo(senderJid);
        const pend  = getPend(senderNum);

        let txt =
            `💳 *SALDO KAMU*\n` +
            `${LINE}\n` +
            `👤 ${pushname || senderNum}\n` +
            `📱 +${senderNum}\n\n` +
            `💰 Saldo Aktif : *${fmtRp(saldo)}*\n`;

        if (pend) {
            txt +=
                `\n${LINE}\n` +
                `⏳ *Transaksi Pending*\n` +
                `   💵 Nominal  : ${fmtRp(pend.amount)}\n` +
                `   ✅ Diterima : ${fmtRp(pend.diterima)}\n` +
                `   🆔 ID       : \`${pend.trxId}\`\n` +
                `   ⏰ Sisa     : ${sisaWaktu(pend.expired)}\n\n` +
                `Sudah bayar? *.deposit cek*\n` +
                `Batalkan?   *.deposit batal*`;
        } else {
            txt +=
                `\n${LINE}\n` +
                `💡 Top up: *.deposit <nominal>*\n` +
                `📌 Min: ${fmtRp(MIN)}  •  Maks: ${fmtRp(MAX)}\n\n` +
                `_Contoh: .deposit 10000_`;
        }
        return reply(txt);
    }

    /* ── .deposit riwayat ─────────────────────────────────────── */
    if (sub === 'riwayat' || sub === 'history' || sub === 'log') {
        const hist = getHist(senderNum);
        if (!hist.length) return reply(
            `📋 *Riwayat Deposit*\n\n` +
            `Belum ada transaksi.\n\n` +
            `Mulai top up: *.deposit <nominal>*`
        );

        let txt = `📋 *Riwayat Deposit* (${hist.length} terakhir)\n${LINE}\n\n`;
        hist.forEach((h, i) => {
            const s = st(h.status);
            txt +=
                `${s.icon} *${i + 1}. ${fmtRp(h.amount)}*  (diterima: ${fmtRp(h.diterima || h.amount)})\n` +
                `   🆔 \`${h.trxId}\`\n` +
                `   📅 ${fmtDate(h.createdAt)}\n` +
                (h.brand   ? `   🏦 ${h.brand}\n`  : '') +
                (h.buyer   ? `   👤 ${h.buyer}\n`  : '') +
                `   📊 ${s.label}\n\n`;
        });
        return reply(txt.trim());
    }

    /* ── .deposit cek ─────────────────────────────────────────── */
    if (sub === 'cek' || sub === 'check' || sub === 'konfirmasi') {
        const pend = getPend(senderNum);
        if (!pend) return reply(
            `❌ *Tidak ada transaksi pending.*\n\n` +
            `Buat transaksi baru:\n*.deposit <nominal>*`
        );

        await reply('⏳ Mengecek status pembayaran...');

        let res;
        try {
            // Pakai V2 — dapat info brand_name & buyer_reff
            res = (await api.depositStatusV2(pend.trxId)).data;
        } catch {
            // Fallback ke V1 jika V2 gagal
            try { res = (await api.depositStatusV1(pend.trxId)).data; }
            catch (e) { return reply(`❌ Gagal cek: ${errMsg(e)}`); }
        }

        const d      = res?.data || {};
        const status = (d.status || '').toLowerCase();

        // ✅ SUKSES — kredit saldo ke user
        if (status === 'success') {
            const diterima = d.diterima || pend.diterima || pend.amount;
            const newSaldo = tambahSaldo(senderJid, diterima);

            addHist(senderNum, {
                ...pend,
                status:      'success',
                diterima,
                brand:       d.brand_name || null,
                buyer:       d.buyer_reff || null,
                confirmedAt: Date.now(),
            });
            clrPend(senderNum);

            return reply(
                `✅ *Pembayaran Berhasil!*\n` +
                `${LINE}\n` +
                `💵 Nominal   : ${fmtRp(pend.amount)}\n` +
                `💸 Biaya     : ${fmtRp(d.fee || pend.fee || 0)}\n` +
                `💰 Masuk     : *${fmtRp(diterima)}*\n` +
                `💳 Saldo     : *${fmtRp(newSaldo)}*\n` +
                (d.brand_name ? `🏦 Via       : ${d.brand_name}\n` : '') +
                (d.buyer_reff ? `👤 Pengirim  : ${d.buyer_reff}\n` : '') +
                `🆔 ID        : \`${pend.trxId}\`\n\n` +
                `🎉 Saldo siap digunakan!\n` +
                `📱 Beli OTP: *.layanan cari <nama>*`
            );
        }

        // ❌ CANCEL / EXPIRED
        if (['cancel', 'expired', 'failed'].includes(status)) {
            addHist(senderNum, { ...pend, status, failedAt: Date.now() });
            clrPend(senderNum);
            const s = st(status);
            return reply(
                `${s.icon} *Transaksi ${s.label}*\n\n` +
                `💵 Nominal : ${fmtRp(pend.amount)}\n` +
                `🆔 ID      : \`${pend.trxId}\`\n\n` +
                `Buat baru: *.deposit <nominal>*`
            );
        }

        // ⏳ MASIH PENDING
        return reply(
            `⏳ *Belum Dibayar*\n` +
            `${LINE}\n` +
            `💵 Nominal  : ${fmtRp(pend.amount)}\n` +
            `✅ Diterima : ${fmtRp(pend.diterima || pend.amount)}\n` +
            `🆔 ID       : \`${pend.trxId}\`\n` +
            `⏰ Sisa     : ${sisaWaktu(pend.expired)}\n\n` +
            `Scan QRIS lalu ketik *.deposit cek* lagi.\n` +
            `Batalkan: *.deposit batal*`
        );
    }

    /* ── .deposit batal ───────────────────────────────────────── */
    if (sub === 'batal' || sub === 'cancel') {
        const pend = getPend(senderNum);
        if (!pend) return reply(
            `❌ *Tidak ada transaksi pending.*\n\n` +
            `Buat baru: *.deposit <nominal>*`
        );

        await reply('⏳ Membatalkan...');
        try { await api.depositCancel(pend.trxId); } catch {}

        addHist(senderNum, { ...pend, status: 'cancel', canceledAt: Date.now() });
        clrPend(senderNum);

        return reply(
            `🚫 *Transaksi Dibatalkan*\n` +
            `${LINE}\n` +
            `💵 Nominal : ${fmtRp(pend.amount)}\n` +
            `🆔 ID      : \`${pend.trxId}\`\n\n` +
            `Buat baru: *.deposit <nominal>*`
        );
    }

    /* ── .deposit <nominal> — Buat transaksi QRIS ─────────────── */
    const nominal = parseInt((args[0] || '').replace(/\D/g, ''), 10);

    if (!nominal || nominal < MIN || nominal > MAX) return reply(
        `❌ *Nominal tidak valid!*\n` +
        `${LINE}\n` +
        `📌 Minimal  : *${fmtRp(MIN)}*\n` +
        `📌 Maksimal : *${fmtRp(MAX)}*\n\n` +
        `*Cara pakai:*\n` +
        `• \`.deposit 5000\`    → top up Rp 5.000\n` +
        `• \`.deposit 50000\`   → top up Rp 50.000\n` +
        `• \`.deposit 100000\`  → top up Rp 100.000\n\n` +
        `*Command lain:*\n` +
        `• \`.deposit saldo\`   → cek saldo\n` +
        `• \`.deposit cek\`     → konfirmasi bayar\n` +
        `• \`.deposit batal\`   → batalkan pending\n` +
        `• \`.deposit riwayat\` → histori transaksi`
    );

    // Cek pending aktif
    const pend = getPend(senderNum);
    if (pend) return reply(
        `⚠️ *Masih ada transaksi pending!*\n` +
        `${LINE}\n` +
        `💵 Nominal  : ${fmtRp(pend.amount)}\n` +
        `✅ Diterima : ${fmtRp(pend.diterima || pend.amount)}\n` +
        `🆔 ID       : \`${pend.trxId}\`\n` +
        `⏰ Sisa     : ${sisaWaktu(pend.expired)}\n\n` +
        `✅ Sudah bayar? → *.deposit cek*\n` +
        `🚫 Batalkan?    → *.deposit batal*`
    );

    await reply(`⏳ Membuat QRIS ${fmtRp(nominal)}...`);

    let res;
    try { res = (await api.depositCreateV1(nominal)).data; }
    catch (e) { return reply(`❌ *Gagal membuat transaksi!*\n\n${errMsg(e)}`); }

    if (!res?.success || !res?.data) return reply(
        `❌ *Response tidak valid dari server.*\n\n` +
        `${String(JSON.stringify(res)).slice(0, 200)}`
    );

    const d = res.data;

    // Simpan pending
    setPend(senderNum, {
        trxId:     d.id,
        amount:    nominal,
        fee:       d.currency?.fee || 0,
        diterima:  d.currency?.diterima || nominal,
        expired:   d.expired,
        createdAt: Date.now(),
        status:    'pending',
    });

    const caption =
        `🧾 *QRIS Dibuat!*\n` +
        `${LINE}\n` +
        `👤 ${pushname || senderNum}\n\n` +
        `💵 Nominal   : *${fmtRp(nominal)}*\n` +
        `💸 Biaya     : ${fmtRp(d.currency?.fee || 0)}\n` +
        `✅ Diterima  : *${fmtRp(d.currency?.diterima || nominal)}*\n` +
        `🏪 Merchant  : ${d.merchant || 'RumahOTP Payment'}\n` +
        `🆔 ID        : \`${d.id}\`\n` +
        `⏰ Expired   : ${fmtDate(d.expired)}\n` +
        `⏱️ Sisa      : ${sisaWaktu(d.expired)}\n\n` +
        `${LINE}\n` +
        `📲 *Scan QRIS di bawah lalu bayar!*\n\n` +
        `Setelah bayar → *.deposit cek*\n` +
        `Batalkan      → *.deposit batal*`;

    // Kirim QRIS sebagai gambar (base64 → Buffer)
    if (d.qr?.startsWith('data:image')) {
        const buf = Buffer.from(d.qr.split(',')[1], 'base64');
        return manzxy.sendMessage(m.chat, { image: buf, caption }, { quoted: m });
    }

    // Fallback jika bukan base64
    return reply(caption);
};

// ──────────────────────────────────────────────────────────────
//  METADATA
// ──────────────────────────────────────────────────────────────
handler.command = ['deposit', 'dep', 'topup'];
handler.tags    = ['rumahotp'];
handler.limit   = false;
handler.fitur   = {
    'deposit': 'Top up saldo via QRIS | .deposit <nominal>',
    'dep':     'Alias .deposit',
    'topup':   'Alias .deposit',
};

module.exports = handler;
