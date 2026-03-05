/**
 * main-sewabot.js — Sistem Sewa Bot untuk Grup
 *
 * FLOW:
 *   1. User ketik .sewabot → lihat paket & harga
 *   2. User ketik .sewa <paket> → bot kirim QRIS
 *   3. User bayar → ketik .cekpayment
 *   4. Bot minta link grup → user kirim link
 *   5. Bot join grup otomatis & aktif selama masa sewa
 *   6. Bot keluar otomatis saat expired
 *
 * Commands user:
 *   .sewabot          → info paket & harga
 *   .sewa <paket>     → buat transaksi QRIS
 *   .cekpayment       → verifikasi bayar, minta link grup
 *   .perpanjang <p>   → perpanjang masa sewa grup
 *   .ceksewa          → status sewa grup milikku
 *
 * Commands owner:
 *   .listsewa         → semua grup yang disewa
 *   .addsewa <link/id> <paket> → aktivasi manual
 *   .delsewa <groupJid>        → hapus sewa + bot keluar
 */
'use strict';

const { config }  = require('../../../config.js');
const db          = require('../../lib/database.js');
const { createPaymentMessage, checkPaymentMessage, deletePaymentMessage } = require('../../lib/heroikzrePayment.js');
const { normalizeNum } = require('../../lib/jid-utils.js');

/* ── Helpers ─────────────────────────────────────────────── */
const fmtRp  = n  => `Rp ${Number(n).toLocaleString('id-ID')}`;
const fmtTgl = ms => new Date(ms).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
});
const sisaStr = expiredAt => {
    if (!expiredAt || expiredAt === -1) return 'Permanent';
    const sisa = expiredAt - Date.now();
    if (sisa <= 0) return '⛔ Expired';
    const d = Math.floor(sisa / 86400000);
    const h = Math.floor((sisa % 86400000) / 3600000);
    return `${d} hari ${h} jam`;
};

/* Ekstrak invite code dari link WA group */
const parseGroupLink = (text) => {
    const m = (text || '').match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
};

/* ── Config sewabot dari config.js ───────────────────────── */
const getCfg    = () => config.sewabot || {};
const getApikey = () => getCfg().apikey || '';
const getHarga  = () => getCfg().harga  || { '1bulan': 15000, '3bulan': 40000, '6bulan': 75000 };
const getDurasi = () => getCfg().durasi || {
    '1bulan': 30  * 24 * 3600 * 1000,
    '3bulan': 90  * 24 * 3600 * 1000,
    '6bulan': 180 * 24 * 3600 * 1000,
};
const getTimeout = () => (getCfg().paymentTimeout || 15) * 60 * 1000;

const infoHarga = () =>
    Object.entries(getHarga()).map(([p, h]) => `  ✦ *${p}* → *${fmtRp(h)}*`).join('\n');

/* ══════════════════════════════════════════════════════════
   HANDLER
   ══════════════════════════════════════════════════════════ */
const handler = async (m, { manzxy, args, command, reply, isOwn, senderJid }) => {

    const cfg = getCfg();
    if (!cfg.enabled && !isOwn) return reply('⛔ Fitur sewabot belum diaktifkan.');

    /* ── Tangkap link grup yang dikirim langsung (tanpa command) ──
     * Berlaku ketika user dalam state waitLink tapi kirim link
     * tanpa prefix/command apapun (hanya link saja).
     * Ini dipanggil jika body bukan command tetapi ada link WA.
     */
    if (!command) {
        const linkCode = parseGroupLink(m.body || '');
        if (linkCode) {
            const pending = db.sewaPendingGet(senderJid);
            if (pending?.step === 'waitLink') {
                await _joinAndActivate(manzxy, senderJid, linkCode, pending, reply);
                return;
            }
        }
        return; // bukan command dan bukan link waitLink — abaikan
    }

    switch (command) {

        /* ══════════ INFO HARGA ══════════ */
        case 'sewabot':
        case 'infosewa': {
            const teks =
                `🏪 *SEWABOT — ${config.nameBot || 'Bot'}*\n` +
                `${'━'.repeat(30)}\n\n` +
                `📦 *Paket Tersedia:*\n${infoHarga()}\n\n` +
                `${'━'.repeat(30)}\n` +
                `💳 Pembayaran via *QRIS otomatis*\n\n` +
                `📌 *Cara Sewa:*\n` +
                `  1. Ketik *.sewa <paket>*\n` +
                `     Contoh: *.sewa 1bulan*\n` +
                `  2. Scan QRIS yang dikirim bot\n` +
                `  3. Ketik *.cekpayment*\n` +
                `  4. Kirim *link grup* yang ingin disewa\n` +
                `  5. Bot otomatis join & aktif di grup!\n\n` +
                `🔄 Perpanjang : *.perpanjang <paket>*\n` +
                `📊 Cek status : *.ceksewa*\n` +
                `❌ Batal trx  : *.batalpayment*\n\n` +
                `_Hubungi owner jika ada kendala._`;

            await manzxy.sendMessage(m.chat, { text: teks }, { quoted: m });
            break;
        }

        /* ══════════ SEWA — buat QRIS ══════════ */
        case 'sewa': {
            const paket = args[0]?.toLowerCase();
            const harga = getHarga();

            if (!paket || !harga[paket]) {
                return reply(
                    `❌ Paket tidak valid!\n\n` +
                    `📦 *Paket tersedia:*\n${infoHarga()}\n\n` +
                    `Contoh: *.sewa 1bulan*`
                );
            }

            const apikey = getApikey();
            if (!apikey || apikey === 'HEROIKZRE_API_KEY_KAMU') {
                return reply('⚠️ Sistem pembayaran belum dikonfigurasi.\nHubungi owner.');
            }

            // Cek pending lama
            const existing = db.sewaPendingGet(senderJid);
            if (existing && existing.step !== 'waitLink') {
                const elapsed = Date.now() - (existing.ts || 0);
                if (elapsed < getTimeout()) {
                    const sisa = Math.ceil((getTimeout() - elapsed) / 60000);
                    return reply(
                        `⏳ *Masih ada transaksi pending!*\n\n` +
                        `🧾 ID: \`${existing.idtrx}\`\n` +
                        `📦 Paket: *${existing.paket}*\n` +
                        `⌛ Sisa: *${sisa} menit*\n\n` +
                        `Ketik *.cekpayment* untuk verifikasi.`
                    );
                }
                db.sewaPendingDel(senderJid);
            }

            await reply(`⏳ Membuat transaksi *${paket}* (${fmtRp(harga[paket])})...`);

            const result = await createPaymentMessage(apikey, harga[paket]);
            if (!result.status) {
                return reply(`❌ Gagal membuat pembayaran.\n_${result.message}_\n\nCoba lagi beberapa saat.`);
            }

            // Simpan pending ke DB (persistent, tidak hilang restart)
            db.sewaPendingSet(senderJid, {
                step:        'waitPayment',
                idtrx:       result.idtrx,
                amount:      result.amount,
                base_amount: result.base_amount || harga[paket],
                paket,
                durasi:      getDurasi()[paket],
                ts:          Date.now(),
            });

            const teks =
                `💳 *PEMBAYARAN SEWABOT*\n` +
                `${'━'.repeat(30)}\n\n` +
                `📦 Paket  : *${paket}*\n` +
                `💰 Harga  : *${fmtRp(harga[paket])}*\n` +
                `📦 Total  : *${fmtRp(result.amount)}*\n` +
                `🧾 ID Trx : \`${result.idtrx}\`\n\n` +
                `${'━'.repeat(30)}\n` +
                `📷 *Scan QRIS di bawah ini*\n\n` +
                `⚠️ *Setelah bayar, ketik:*\n` +
                `*.cekpayment*\n\n` +
                `❌ Batalkan: *.batalpayment*\n` +
                `⏱️ Berlaku *${getCfg().paymentTimeout || 15} menit*`;

            await manzxy.sendMessage(m.chat, {
                image:   { url: result.qris_url },
                caption: teks,
            }, { quoted: m });
            break;
        }

        /* ══════════ PERPANJANG ══════════ */
        case 'perpanjang': {
            const paket = args[0]?.toLowerCase();
            const harga = getHarga();

            if (!paket || !harga[paket]) {
                return reply(`❌ Paket tidak valid!\n\n${infoHarga()}\n\nContoh: *.perpanjang 1bulan*`);
            }

            // Cari grup milik sender yang aktif
            const semuaSewa = db.sewabotGetAll();
            const grupsewa  = semuaSewa.filter(s => s.ownerJid === senderJid && db.sewabotIsActive(s.groupJid));

            if (!grupsewa.length) {
                return reply(`❌ Kamu tidak punya sewa grup aktif.\n\nMulai sewa: *.sewabot*`);
            }

            const apikey = getApikey();
            if (!apikey || apikey === 'HEROIKZRE_API_KEY_KAMU') {
                return reply('⚠️ Sistem pembayaran belum dikonfigurasi.');
            }

            await reply(`⏳ Membuat transaksi perpanjang *${paket}* (${fmtRp(harga[paket])})...`);

            const result = await createPaymentMessage(apikey, harga[paket]);
            if (!result.status) {
                return reply(`❌ Gagal membuat pembayaran.\n_${result.message}_`);
            }

            db.sewaPendingSet(senderJid, {
                step:        'waitPayment',
                isPerpanjang: true,
                idtrx:       result.idtrx,
                amount:      result.amount,
                base_amount: result.base_amount || harga[paket],
                paket,
                durasi:      getDurasi()[paket],
                ts:          Date.now(),
            });

            await manzxy.sendMessage(m.chat, {
                image:   { url: result.qris_url },
                caption:
                    `💳 *PERPANJANG SEWABOT*\n${'━'.repeat(30)}\n\n` +
                    `📦 Paket : *${paket}*\n` +
                    `💰 Total : *${fmtRp(result.amount)}*\n` +
                    `🧾 ID Trx: \`${result.idtrx}\`\n\n` +
                    `📷 *Scan QRIS di bawah*\n\n` +
                    `Setelah bayar: *.cekpayment*`,
            }, { quoted: m });
            break;
        }

        /* ══════════ CEK PAYMENT ══════════ */
        case 'cekpayment':
        case 'verifypayment':
        case 'bayar': {
            const pending = db.sewaPendingGet(senderJid);

            // Step: waitLink — user sudah bayar, tinggal kirim link
            if (pending?.step === 'waitLink') {
                // Cek apakah ada link di pesan ini
                const linkCode = parseGroupLink(m.body || '');
                if (!linkCode) {
                    return reply(
                        `✅ *Pembayaran berhasil!*\n\n` +
                        `📨 Sekarang kirim *link grup* yang ingin disewa:\n\n` +
                        `Format: https://chat.whatsapp.com/xxxxxx\n\n` +
                        `_Bot akan otomatis join dan aktif di grup tersebut._`
                    );
                }

                // Ada link sekaligus di pesan cekpayment — langsung proses
                await _joinAndActivate(manzxy, senderJid, linkCode, pending, reply);
                break;
            }

            if (!pending || pending.step !== 'waitPayment') {
                return reply(`❌ *Tidak ada transaksi pending.*\n\nMulai sewa: *.sewa <paket>*`);
            }

            // Cek apakah expired
            const elapsed = Date.now() - (pending.ts || 0);
            if (elapsed > getTimeout()) {
                db.sewaPendingDel(senderJid);
                return reply(`⌛ Transaksi expired.\n\nBuat transaksi baru: *.sewa ${pending.paket}*`);
            }

            await reply('⏳ Mengecek status pembayaran...');

            const result = await checkPaymentMessage(getApikey(), pending.idtrx);

            if (result.status === 'sukses') {
                // Update step ke waitLink
                db.sewaPendingSet(senderJid, { ...pending, step: 'waitLink' });

                if (pending.isPerpanjang) {
                    // Perpanjang: langsung update semua grup milik sender
                    const semuaSewa = db.sewabotGetAll();
                    const grupsewa  = semuaSewa.filter(s => s.ownerJid === senderJid);
                    let updated = 0;
                    for (const s of grupsewa) {
                        const newExp = db.sewabotIsActive(s.groupJid)
                            ? s.expiredAt + pending.durasi
                            : Date.now() + pending.durasi;
                        db.sewabotSave(s.groupJid, { ...s, expiredAt: newExp, paket: pending.paket });
                        updated++;
                    }
                    db.sewaPendingDel(senderJid);
                    return reply(
                        `✅ *Perpanjang Berhasil!*\n\n` +
                        `📦 Paket : *${pending.paket}*\n` +
                        `🔄 Diperbarui: *${updated} grup*\n\n` +
                        `Ketik *.ceksewa* untuk cek status.`
                    );
                }

                // Cek apakah ada link grup di pesan yang sama dengan .cekpayment
                const _linkInMsg = parseGroupLink(m.body || '');
                if (_linkInMsg) {
                    // Ada link sekaligus — langsung join tanpa menunggu pesan berikutnya
                    await _joinAndActivate(manzxy, senderJid, _linkInMsg,
                        { ...pending, step: 'waitLink' }, reply);
                    break;
                }

                return reply(
                    `✅ *Pembayaran Berhasil!*\n\n` +
                    `📨 *Kirim link grup* yang ingin disewa:\n\n` +
                    `Format: https://chat.whatsapp.com/xxxxxx\n\n` +
                    `_Bot akan otomatis join dan aktif di grup tersebut._`
                );

            } else if (result.status === 'pending') {
                const sisa = Math.max(0, Math.ceil((getTimeout() - elapsed) / 60000));
                return reply(
                    `⏳ *Pembayaran belum diterima*\n\n` +
                    `🧾 ID: \`${pending.idtrx}\`\n` +
                    `⌛ Sisa: *${sisa} menit*\n\n` +
                    `Pastikan sudah scan & bayar QRIS.`
                );

            } else if (result.status === 'expired') {
                db.sewaPendingDel(senderJid);
                return reply(`⌛ Transaksi expired.\n\nBuat baru: *.sewa ${pending.paket}*`);

            } else {
                return reply(`❌ Gagal cek pembayaran.\n\n${result.text || 'Coba lagi.'}`);
            }
        }

        /* ══════════ USER KIRIM LINK GRUP (setelah bayar) ══════════ */
        case 'linkgrup':
        case 'joinbot': {
            const pending = db.sewaPendingGet(senderJid);
            if (!pending || pending.step !== 'waitLink') {
                return reply(`❌ Tidak ada sesi yang menunggu link grup.\n\nLakukan *.sewa <paket>* terlebih dahulu.`);
            }

            const linkCode = parseGroupLink(args[0] || m.body || '');
            if (!linkCode) {
                return reply(
                    `❌ Link tidak valid!\n\n` +
                    `Format: https://chat.whatsapp.com/xxxxxx\n\n` +
                    `Contoh: *.linkgrup https://chat.whatsapp.com/AbCdEf123456*`
                );
            }

            await _joinAndActivate(manzxy, senderJid, linkCode, pending, reply);
            break;
        }

        /* ══════════ BATAL PAYMENT ══════════ */
        case 'batalpayment':
        case 'cancelpayment':
        case 'cancelsewa': {
            const pending = db.sewaPendingGet(senderJid);

            if (!pending) {
                return reply(
                    `❌ *Tidak ada transaksi pending.*\n\n` +
                    `Mulai sewa: *.sewa <paket>*`
                );
            }

            // Jika sudah di step waitLink (sudah bayar), tidak bisa dibatalkan via API
            if (pending.step === 'waitLink') {
                return reply(
                    `⚠️ *Pembayaran sudah diterima!*\n\n` +
                    `Transaksi tidak bisa dibatalkan karena pembayaran sudah masuk.\n\n` +
                    `Kirim link grup kamu untuk aktivasi:\n` +
                    `https://chat.whatsapp.com/xxxxxx`
                );
            }

            const apikey = getApikey();
            if (!apikey || apikey === 'HEROIKZRE_API_KEY_KAMU') {
                // Tidak ada API key — hapus lokal saja
                db.sewaPendingDel(senderJid);
                return reply(
                    `✅ *Transaksi dibatalkan.*\n\n` +
                    `🧾 ID: \`${pending.idtrx}\`\n\n` +
                    `_Catatan: Pembatalan hanya di sisi bot. Jika sudah bayar, hubungi owner._`
                );
            }

            await reply('⏳ Membatalkan transaksi...');

            // Hapus dari API Heroikzre
            const result = await deletePaymentMessage(
                apikey,
                pending.amount || pending.base_amount,
                pending.idtrx
            );

            // Hapus dari DB lokal bagaimanapun hasilnya
            db.sewaPendingDel(senderJid);

            if (result.status) {
                return reply(
                    `✅ *Transaksi Berhasil Dibatalkan!*\n\n` +
                    `🧾 ID    : \`${pending.idtrx}\`\n` +
                    `📦 Paket : *${pending.paket}*\n` +
                    `💰 Nominal: *${fmtRp(pending.base_amount || pending.amount)}*\n\n` +
                    `_QRIS sudah tidak aktif._\n\n` +
                    `Buat transaksi baru: *.sewa ${pending.paket}*`
                );
            } else {
                // API gagal tapi sudah dihapus lokal
                return reply(
                    `⚠️ *Transaksi dihapus dari bot.*\n\n` +
                    `🧾 ID: \`${pending.idtrx}\`\n\n` +
                    `_Catatan: Gagal konfirmasi ke server pembayaran (${result.text || 'server error'}).\n` +
                    `Jika sudah terlanjur bayar, hubungi owner dengan ID transaksi di atas._`
                );
            }
        }

        /* ══════════ CEK STATUS SEWA ══════════ */
        case 'ceksewa':
        case 'statusewa':
        case 'mysewa': {
            const semuaSewa = db.sewabotGetAll();
            const milikku   = semuaSewa.filter(s => s.ownerJid === senderJid);

            if (!milikku.length) {
                return reply(`❌ *Kamu belum punya sewa grup.*\n\nInfo paket: *.sewabot*`);
            }

            let teks = `📊 *STATUS SEWA KAMU* (${milikku.length} grup)\n${'━'.repeat(30)}\n\n`;
            for (const s of milikku) {
                const aktif = db.sewabotIsActive(s.groupJid);
                teks +=
                    `${aktif ? '✅' : '❌'} *${s.groupName || s.groupJid}*\n` +
                    `   📦 Paket  : ${s.paket}\n` +
                    `   📅 Exp    : ${fmtTgl(s.expiredAt)}\n` +
                    `   ⏳ Sisa   : ${sisaStr(s.expiredAt)}\n\n`;
            }
            teks += `Perpanjang: *.perpanjang <paket>*`;

            await reply(teks.trim());
            break;
        }

        /* ══════════ OWNER: LIST SEWA ══════════ */
        case 'listsewa':
        case 'sewalist': {
            if (!isOwn) return reply('⛔ Owner only!');
            const all = db.sewabotGetAll();
            if (!all.length) return reply('📋 Belum ada grup yang disewa.');

            const now     = Date.now();
            const aktif   = all.filter(s => s.expiredAt === -1 || now < s.expiredAt);
            const expired = all.filter(s => s.expiredAt !== -1 && now >= s.expiredAt);

            let teks =
                `🏪 *DAFTAR SEWABOT* (${all.length} grup)\n` +
                `${'━'.repeat(30)}\n\n` +
                `✅ *Aktif (${aktif.length}):*\n`;
            for (const s of aktif) {
                teks += `  • ${s.groupName || s.groupJid}\n    +${normalizeNum(s.ownerJid)} | ${s.paket} | exp: ${fmtTgl(s.expiredAt)}\n`;
            }
            if (expired.length) {
                teks += `\n❌ *Expired (${expired.length}):*\n`;
                for (const s of expired.slice(0, 5)) {
                    teks += `  • ${s.groupName || s.groupJid}\n    +${normalizeNum(s.ownerJid)} | ${s.paket}\n`;
                }
            }
            await reply(teks.trim());
            break;
        }

        /* ══════════ OWNER: AKTIVASI MANUAL ══════════ */
        case 'addsewa': {
            if (!isOwn) return reply('⛔ Owner only!');

            // .addsewa <link/groupJid> <paket> <ownerNum>
            const linkOrJid = args[0] || '';
            const paket     = (args[1] || '1bulan').toLowerCase();
            const ownerNum  = args[2] ? args[2].replace(/[^0-9]/g, '') : normalizeNum(senderJid);

            if (!linkOrJid) {
                return reply('❌ Format: *.addsewa <link/groupJid> <paket> [ownerNum]*');
            }

            const durMs    = getDurasi()[paket] || getDurasi()['1bulan'];
            const newExp   = Date.now() + durMs;
            const ownerJid = ownerNum + '@s.whatsapp.net';

            // Coba join dulu jika ada link
            const linkCode = parseGroupLink(linkOrJid);
            let groupJid   = linkOrJid.includes('@g.us') ? linkOrJid : null;
            let groupName  = '';

            if (linkCode && !groupJid) {
                try {
                    await reply('⏳ Mencoba join grup...');
                    groupJid = await manzxy.groupAcceptInvite(linkCode);
                    const meta = await manzxy.groupMetadata(groupJid).catch(() => null);
                    groupName = meta?.subject || '';
                } catch (e) {
                    return reply(`❌ Gagal join grup: ${e.message}`);
                }
            }

            if (!groupJid) return reply('❌ Link atau Group JID tidak valid.');

            db.sewabotSave(groupJid, {
                groupJid, groupName,
                ownerJid,
                paket,
                expiredAt:   newExp,
                activatedAt: Date.now(),
            });

            reply(
                `✅ *Sewa manual diaktifkan!*\n\n` +
                `📦 Grup   : ${groupName || groupJid}\n` +
                `👤 Owner  : +${ownerNum}\n` +
                `📋 Paket  : ${paket}\n` +
                `📅 Exp    : ${fmtTgl(newExp)}`
            );
            break;
        }

        /* ══════════ OWNER: HAPUS SEWA ══════════ */
        case 'delsewa':
        case 'removesewa': {
            if (!isOwn) return reply('⛔ Owner only!');
            const groupJid = args[0];
            if (!groupJid) return reply('❌ Masukkan Group JID.\nFormat: *.delsewa <groupJid>*');

            const sewa = db.sewabotGet(groupJid);
            db.sewabotDelete(groupJid);

            // Keluar dari grup
            try { await manzxy.groupLeave(groupJid); } catch {}

            reply(`✅ Sewa *${sewa?.groupName || groupJid}* dihapus.\nBot sudah keluar dari grup.`);
            break;
        }
    }
};

/* ═══════════════════════════════════════════════════════
   HELPER: Join group & aktivasi sewa
   ═══════════════════════════════════════════════════════ */
async function _joinAndActivate(manzxy, senderJid, linkCode, pending, reply) {
    await reply('⏳ Mencoba join grup...');

    let groupJid, groupName;
    try {
        groupJid  = await manzxy.groupAcceptInvite(linkCode);
        const meta = await manzxy.groupMetadata(groupJid).catch(() => null);
        groupName  = meta?.subject || '';
    } catch (e) {
        // Mungkin sudah ada di grup
        if (e.message?.includes('already') || e.message?.includes('already a member')) {
            // Coba ambil dari groupMetadata via invite
            try {
                const info = await manzxy.checkGroupInvite(linkCode).catch(() => null);
                if (info?.id) {
                    groupJid  = info.id;
                    groupName = info.subject || '';
                }
            } catch {}
        }
        if (!groupJid) {
            return reply(`❌ Gagal join grup: ${e.message}\n\nPastikan link valid dan bot belum di-ban dari grup.`);
        }
    }

    // Simpan sewa
    const newExp = Date.now() + pending.durasi;
    db.sewabotSave(groupJid, {
        groupJid,
        groupName,
        ownerJid:    senderJid,
        paket:       pending.paket,
        expiredAt:   newExp,
        activatedAt: Date.now(),
    });

    // Hapus pending
    db.sewaPendingDel(senderJid);

    // Kirim pesan selamat datang di grup
    try {
        await manzxy.sendMessage(groupJid, {
            text:
                `✅ *Bot Sewabot Aktif!*\n\n` +
                `📦 Paket   : *${pending.paket}*\n` +
                `📅 Expired : *${new Date(newExp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}*\n\n` +
                `Ketik *.menu* untuk lihat semua fitur.\n` +
                `_Bot aktif hingga ${new Date(newExp).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}._`
        });
    } catch {}

    await reply(
        `🎉 *Bot Berhasil Join & Aktif!*\n\n` +
        `📌 Grup    : *${groupName || groupJid}*\n` +
        `📦 Paket   : *${pending.paket}*\n` +
        `📅 Expired : *${new Date(newExp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })}*\n\n` +
        `Bot sudah aktif di grup kamu!\n` +
        `Cek status: *.ceksewa*`
    );
}

/* Export helper untuk interceptor di manzxy.js */
handler._joinAndActivate = _joinAndActivate;

handler.command = [
    'sewabot', 'infosewa',
    'sewa',
    'perpanjang',
    'cekpayment', 'verifypayment', 'bayar',
    'batalpayment', 'cancelpayment', 'cancelsewa',
    'linkgrup', 'joinbot',
    'ceksewa', 'statusewa', 'mysewa',
    'listsewa', 'sewalist',
    'addsewa',
    'delsewa', 'removesewa',
];
handler.tags  = ['info'];
handler.limit    = false;
handler.fitur = {
    'sewabot':      'Info harga & cara sewa bot ke grupmu',
    'sewa':         'Mulai sewa bot untuk grupmu via QRIS',
    'perpanjang':   'Perpanjang masa sewa bot',
    'cekpayment':   'Verifikasi pembayaran QRIS',
    'batalpayment': 'Batalkan transaksi QRIS yang belum dibayar',
    'linkgrup':     'Kirim link grup setelah bayar',
    'ceksewa':      'Cek status sewa grup aktif',
    'listsewa':     '[Owner] Lihat semua grup sewa',
    'addsewa':      '[Owner] Aktivasi sewa manual',
    'delsewa':      '[Owner] Hapus sewa + bot keluar grup',
};
module.exports = handler;
