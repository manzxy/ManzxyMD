'use strict';
/* ════════════════════════════════════════════════════════════════
   tools-otp-operator.js  —  Cek Operator Seluler Tersedia

   Commands:
     .operator <negara> <provider_id>   → daftar operator
     .op <negara> <provider_id>         → alias

   Contoh:
     .operator Indonesia 3837
     .operator Thailand 2887

   Catatan:
     - negara & provider_id dari .layanan negara <kode>
     - operator_id 1 = "any" (semua operator, default)
     - operator_id dipakai di .beli <num_id> <prov_id> <op_id>
════════════════════════════════════════════════════════════════ */

const { api, errMsg, LINE } = require('../../lib/otp-config');

const handler = async (m, { args, reply }) => {
    const country    = args[0];
    const providerId = args[1];

    if (!country || !providerId) return reply(
        `📡 *CEK OPERATOR OTP*\n` +
        `${LINE}\n` +
        `Format: \`.operator <negara> <provider_id>\`\n\n` +
        `*Contoh:*\n` +
        `• \`.operator Indonesia 3837\`\n` +
        `• \`.operator Thailand 2887\`\n` +
        `• \`.operator China 2300\`\n\n` +
        `_negara & provider_id dari:_\n` +
        `\`.layanan negara <kode>\`\n\n` +
        `Setelah dapat operator_id:\n` +
        `\`.beli <num_id> <prov_id> <op_id>\``
    );

    if (isNaN(parseInt(providerId, 10))) return reply(
        `❌ *provider_id harus angka!*\n\n` +
        `Contoh: \`.operator Indonesia 3837\`\n` +
        `Ambil dari: \`.layanan negara <kode>\``
    );

    await reply(`⏳ Mengambil operator untuk *${country}*...`);

    let res;
    try { res = (await api.getOperators(country, providerId)).data; }
    catch (e) { return reply(`❌ *Gagal!*\n\n${errMsg(e)}`); }

    const ops = res?.data || [];

    if (!ops.length) return reply(
        `❌ *Tidak ada operator tersedia*\n` +
        `${LINE}\n` +
        `🌍 Negara     : ${country}\n` +
        `🔧 Provider ID: \`${providerId}\`\n\n` +
        `Gunakan op_id \`1\` (any) saat beli:\n` +
        `\`.beli <num_id> ${providerId} 1\``
    );

    let t =
        `📡 *OPERATOR — ${country}*\n` +
        `${LINE}\n` +
        `🔧 Provider ID : \`${providerId}\`\n` +
        `📊 ${ops.length} operator tersedia\n\n`;

    for (const op of ops)
        t += `▸ \`[${op.id}]\` ${op.name}\n`;

    t +=
        `\n${LINE}\n` +
        `_ID \`1\` = "any" → pilih otomatis_\n\n` +
        `*Beli dengan operator tertentu:*\n` +
        `\`.beli <num_id> ${providerId} <op_id>\`\n\n` +
        `*Beli tanpa pilih operator (default):*\n` +
        `\`.beli <num_id> ${providerId}\``;

    return reply(t);
};

handler.command = ['operator', 'op'];
handler.tags    = ['rumahotp'];
handler.limit   = false;
handler.fitur   = {
    'operator': 'Cek operator tersedia | .operator <negara> <prov_id>',
    'op':       'Alias .operator',
};

module.exports = handler;
