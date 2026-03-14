'use strict';
/* ════════════════════════════════════════════════════════════════
   tools-otp-cekrek.js  —  Cek Rekening, E-wallet & Akun Game

   Commands:
     .cekrek <bank_code> <nomor>         → cek rekening/ewallet
     .cekrekening <bank_code> <nomor>    → alias
     .cekgame <kode_game> <user_id>      → cek akun game
     .cekakun <kode_game> <user_id>      → alias
     .listbank                           → daftar bank/ewallet
     .listgame                           → daftar game

   Contoh:
     .cekrek dana 081234567890
     .cekrek mandiri 1234567890
     .cekgame freefire 123456789
     .listbank
════════════════════════════════════════════════════════════════ */

const { api, errMsg, LINE } = require('../../lib/otp-config');

const handler = async (m, { args, reply, command }) => {
    const isGame = command === 'cekgame' || command === 'cekakun';
    const kode   = (args[0] || '').toLowerCase();
    const nomor  = args[1] || '';

    /* ── .listbank ─────────────────────────────────────────── */
    if (command === 'listbank' || command === 'daftarbank') {
        await reply('⏳ Mengambil daftar bank...');
        let res;
        try { res = (await api.ppobListBank()).data; }
        catch (e) { return reply(`❌ ${errMsg(e)}`); }

        const data    = res?.data || [];
        const banks   = data.filter(b => b.type === 'bank');
        const wallets = data.filter(b => b.type !== 'bank');

        let t = `🏦 *BANK & E-WALLET TERSEDIA*\n${LINE}\n\n`;
        if (banks.length) {
            t += `🏦 *Bank*\n`;
            banks.forEach(b => t += `   ▸ \`${b.bank_code}\` — ${b.bank_name}\n`);
            t += '\n';
        }
        if (wallets.length) {
            t += `💳 *E-Wallet*\n`;
            wallets.forEach(b => t += `   ▸ \`${b.bank_code}\` — ${b.bank_name}\n`);
        }
        t += `\n${LINE}\nCek rekening: \`.cekrek <kode> <nomor>\``;
        return reply(t);
    }

    /* ── .listgame ─────────────────────────────────────────── */
    if (command === 'listgame' || command === 'daftargame') {
        await reply('⏳ Mengambil daftar game...');
        let res;
        try { res = (await api.ppobListGame()).data; }
        catch (e) { return reply(`❌ ${errMsg(e)}`); }

        const data = res?.data || [];
        if (!data.length) return reply('❌ Tidak ada data.');

        let t = `🎮 *GAME TERSEDIA*\n${LINE}\n\n`;
        data.forEach(g => t += `▸ \`${g.account_code}\` — ${g.account_name}\n`);
        t += `\n${LINE}\nCek akun: \`.cekgame <kode> <user_id>\`\nTop up: \`.ppob beli <kode> <user_id>\``;
        return reply(t);
    }

    /* ── .cekrek / .cekgame ────────────────────────────────── */
    if (!kode || !nomor) {
        if (isGame) return reply(
            `🎮 *CEK AKUN GAME*\n` +
            `${LINE}\n` +
            `Format: \`.cekgame <kode_game> <user_id>\`\n\n` +
            `*Contoh:*\n` +
            `• \`.cekgame freefire 123456789\`\n\n` +
            `Daftar game: \`.listgame\`\n` +
            `Top up    : \`.ppob beli <kode> <user_id>\``
        );

        return reply(
            `💳 *CEK REKENING / E-WALLET*\n` +
            `${LINE}\n` +
            `Format: \`.cekrek <kode_bank> <nomor>\`\n\n` +
            `*Contoh:*\n` +
            `• \`.cekrek dana 081234567890\`\n` +
            `• \`.cekrek mandiri 1234567890\`\n` +
            `• \`.cekrek ovo 081234567890\`\n\n` +
            `Daftar bank: \`.listbank\``
        );
    }

    await reply(`⏳ Mengecek ${isGame ? 'akun' : 'rekening'}...`);

    let res;
    try {
        res = isGame
            ? (await api.ppobCekAkun(kode, nomor)).data
            : (await api.ppobCekRekening(kode, nomor)).data;
    } catch (e) { return reply(`❌ *Gagal cek!*\n\n${errMsg(e)}`); }

    const d = res?.data || {};

    if (!res?.success || d.status !== 'valid') return reply(
        `❌ *${isGame ? 'Akun' : 'Rekening'} Tidak Valid!*\n\n` +
        `${isGame ? '🎮 Game  ' : '🏦 Bank  '} : ${kode.toUpperCase()}\n` +
        `🔢 Nomor : ${nomor}\n\n` +
        `_Pastikan kode dan nomor benar._\n` +
        `${isGame ? 'Daftar game: .listgame' : 'Daftar bank: .listbank'}`
    );

    return reply(
        `✅ *${isGame ? 'Akun Game' : 'Rekening'} Valid!*\n` +
        `${LINE}\n` +
        `${isGame ? '🎮 Game  ' : '🏦 Bank  '} : ${kode.toUpperCase()}\n` +
        `🔢 Nomor  : ${d.account_number}\n` +
        `👤 Nama   : *${d.account_name}*\n\n` +
        `${LINE}\n` +
        (isGame
            ? `Top up: \`.ppob beli <kode> ${nomor}\``
            : `Top up saldo: \`.ppob beli <kode> ${nomor}\``)
    );
};

handler.command = ['cekrek', 'cekrekening', 'cekgame', 'cekakun', 'listbank', 'daftarbank', 'listgame', 'daftargame'];
handler.tags    = ['rumahotp'];
handler.limit   = false;
handler.fitur   = {
    'cekrek':      'Cek nama rekening/ewallet | .cekrek <bank> <nomor>',
    'cekrekening': 'Alias .cekrek',
    'cekgame':     'Cek nama akun game | .cekgame <kode_game> <user_id>',
    'cekakun':     'Alias .cekgame',
    'listbank':    'Daftar bank & ewallet yang tersedia',
    'listgame':    'Daftar game yang bisa dicek akunnya',
};

module.exports = handler;
