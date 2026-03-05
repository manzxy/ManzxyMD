/* ============================================================
   JADIBOT PLUGIN v5

   .jadibot <nomor> [qr|pairing]  → Daftar/jalankan bot
   .startjadibot <nomor>          → Resume bot yang di-stop
   .stopjadibot <nomor>           → Stop bot (session tetap)
   .deljadibotses <nomor>         → Hapus session (owner)
   .listjadibot                   → Semua bot aktif+stopped (owner)
   .myjadibots                    → Bot milikku
   .setjadibotlimit <tipe> <val>  → Atur slot (owner)
   .jadibotlimit                  → Info limit
   .setjadibotnews <id|off>       → Set newsletter yang difollow jadibot (owner)
   .jadibotnews                   → Lihat newsletter aktif (owner)
   ============================================================ */

'use strict';

const normalizeNumber = (input) => {
    if (!input) return null;
    let num = String(input).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (!num) return null;
    if (num.startsWith('0'))   num = '62' + num.slice(1);
    if (!num.startsWith('62')) num = '62' + num;
    return (num.length >= 10 && num.length <= 15) ? num : null;
};

const getLimits = () => global.jadibotLimits || { free: 2, premium: 5, global: 20 };

/* ── normalizeNewsletterJid ─────────────────────────────────
 * Terima berbagai format input:
 *   120363422841562761@newsletter  → langsung
 *   120363422841562761             → tambah @newsletter
 *   https://whatsapp.com/channel/0029Vb...  → ambil invite code, tidak bisa convert
 */
function normalizeNewsletterJid(input) {
    const s = String(input || '').trim();
    if (s.endsWith('@newsletter')) return s;
    if (/^\d{15,}$/.test(s)) return s + '@newsletter';
    return null;
}

/* ======================================================
   HANDLER
   ====================================================== */
const handler = async (m, { manzxy, args, command, reply, isOwn, isPrem, isBotSelf, senderJid }) => {

    const bots      = global.jadiBotSockets || new Map();
    const senderNum = normalizeNumber(senderJid);

    // SECURITY: nomor bot sendiri tidak bisa buat jadibot (prevent self-loop)
    if (isBotSelf) {
        return reply('⛔ Nomor bot tidak bisa menjalankan command jadibot.');
    }

    /* ─── SETJADIBOTNEWS — set newsletter ID (owner) ────────── */
    if (command === 'setjadibotnews') {
        if (!isOwn) return reply('⛔ *Owner Only!*');

        const input = (args[0] || '').trim();

        // .setjadibotnews off → hapus semua
        if (input.toLowerCase() === 'off' || input === '-') {
            if (global.setJadibotNewsletters) global.setJadibotNewsletters([]);
            return reply('✅ Newsletter jadibot *dinonaktifkan*.\n\nBot tidak akan auto-follow newsletter manapun.');
        }

        if (!input) {
            const current = global.getJadibotNewsletters ? global.getJadibotNewsletters() : [];
            return reply(
`📰 *JADIBOT NEWSLETTER CONFIG*

Format:
_.setjadibotnews <newsletter_jid>_
_.setjadibotnews off_ — nonaktifkan

Newsletter aktif: ${current.length ? current.map(id => `\n• \`${id}\``).join('') : '*tidak ada*'}

Contoh:
_.setjadibotnews 120363422841562761@newsletter_

💡 Newsletter JID bisa dilihat dari:
• *.jadibotnews* — info detail`
            );
        }

        const newsJid = normalizeNewsletterJid(input);
        if (!newsJid) {
            return reply(
`❌ Format newsletter JID tidak valid!

Format yang diterima:
• \`120363422841562761@newsletter\`
• \`120363422841562761\` (angka saja)

Contoh: _.setjadibotnews 120363422841562761@newsletter_`
            );
        }

        // Simpan (single newsletter — replace)
        if (global.setJadibotNewsletters) global.setJadibotNewsletters([newsJid]);

        return reply(
`✅ *Newsletter JadiBot diset!*

📰 ID: \`${newsJid}\`

Setiap jadibot baru akan otomatis follow newsletter ini setelah connect.
Bot yang sudah aktif perlu di-restart untuk apply.

Nonaktifkan: _.setjadibotnews off_`
        );
    }

    /* ─── JADIBOTNEWS — lihat newsletter aktif (owner) ──────── */
    if (command === 'jadibotnews') {
        if (!isOwn) return reply('⛔ *Owner Only!*');
        const ids = global.getJadibotNewsletters ? global.getJadibotNewsletters() : [];
        if (!ids.length) {
            return reply(
`📰 *Newsletter JadiBot*

Status: *Tidak aktif*

Set newsletter: _.setjadibotnews <id>@newsletter_`
            );
        }
        let text = `📰 *Newsletter JadiBot*\n\nStatus: *Aktif*\n\n`;
        ids.forEach((id, i) => { text += `${i + 1}. \`${id}\`\n`; });
        text += `\nNonaktifkan: _.setjadibotnews off_`;
        return reply(text);
    }

    /* ─── JADIBOTLIMIT ──────────────────────────────────────── */
    if (command === 'jadibotlimit') {
        if (!isOwn) return reply('⛔ *Owner Only!*');
        const lim = getLimits();
        return reply(
`⚙️ *JADIBOT LIMIT*

👤 Free    : *${lim.free} bot*
💎 Premium : *${lim.premium} bot*
🌐 Global  : *${lim.global} bot*

Ubah: _.setjadibotlimit <free|premium|global> <angka>_`
        );
    }

    /* ─── SETJADIBOTLIMIT ───────────────────────────────────── */
    if (command === 'setjadibotlimit') {
        if (!isOwn) return reply('⛔ *Owner Only!*');
        const tipe = (args[0] || '').toLowerCase();
        const val  = parseInt(args[1]);
        if (!['free', 'premium', 'global'].includes(tipe) || isNaN(val) || val < 0)
            return reply('❓ _.setjadibotlimit <free|premium|global> <angka>_');
        global.jadibotLimits = getLimits();
        const old = global.jadibotLimits[tipe];
        global.jadibotLimits[tipe] = val;
        if (global.saveJadibotLimits) global.saveJadibotLimits();
        return reply(`✅ Limit *${tipe}*: *${old}* → *${val}*`);
    }

    /* ─── LISTJADIBOT ───────────────────────────────────────── */
    if (command === 'listjadibot') {
        if (!isOwn) return reply('⛔ *Owner Only!*\n\nGunakan *.myjadibots* untuk bot kamu.');
        const stopped = global.loadStoppedJadibots ? global.loadStoppedJadibots() : {};
        const lim     = getLimits();
        if (!bots.size && !Object.keys(stopped).length)
            return reply(`📋 *Belum ada JadiBot*\nSlot global: *0/${lim.global}*`);

        let text = `📋 *DAFTAR JADIBOT*\n`;
        text    += `Aktif: *${bots.size}* | Stop: *${Object.keys(stopped).length}* | Max: *${lim.global}*\n`;
        text    += `━━━━━━━━━━━━━━━━━━\n\n`;
        let i    = 1;

        for (const [num, e] of bots.entries()) {
            const role = e.ownerRole === 'owner' ? '👑' : e.ownerRole === 'premium' ? '💎' : '👤';
            text += `${i++}. *+${num}*\n`;
            text += `   ${e.connected ? '🟢 Online' : '🟡 Connecting...'} | ${e.method === 'qr' ? '📷 QR' : '🔗 Pairing'}\n`;
            text += `   ${role} Owner: +${e.ownerNum || '?'}\n\n`;
        }
        for (const [num, info] of Object.entries(stopped)) {
            const role = info.ownerRole === 'owner' ? '👑' : info.ownerRole === 'premium' ? '💎' : '👤';
            const t    = info.stoppedAt
                ? new Date(info.stoppedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                : '-';
            text += `${i++}. *+${num}*\n   🔴 Stopped\n   ${role} +${info.ownerNum || '?'}\n   _${t}_\n   *.startjadibot ${num}*\n\n`;
        }
        text += `━━━━━━━━━━━━━━━━━━`;
        return reply(text);
    }

    /* ─── MYJADIBOTS ────────────────────────────────────────── */
    if (command === 'myjadibots') {
        const stopped   = global.loadStoppedJadibots ? global.loadStoppedJadibots() : {};
        const lim       = getLimits();
        const maxSlot   = isOwn ? '∞' : isPrem ? lim.premium : lim.free;
        const myActive  = [...bots.entries()].filter(([, e]) => e.ownerNum === senderNum);
        const myStopped = Object.entries(stopped).filter(([, i]) => i.ownerNum === senderNum);
        const total     = myActive.length + myStopped.length;

        if (!total) return reply(`🤖 *BOT KAMU*\n\nBelum ada bot.\nSlot: *0/${maxSlot}*\n\n*.jadibot <nomor>* — tambah`);

        let text = `🤖 *BOT KAMU* (${total}/${maxSlot})\n━━━━━━━━━━━━━━━━━━\n\n`;
        myActive.forEach(([num, e], idx) => {
            text += `${idx + 1}. *+${num}*\n   ${e.connected ? '🟢 Online' : '🟡 Connecting...'} | ${e.method === 'qr' ? '📷 QR' : '🔗 Pairing'}\n\n`;
        });
        myStopped.forEach(([num], idx) => {
            text += `${myActive.length + idx + 1}. *+${num}* 🔴 Stopped\n   *.startjadibot ${num}*\n\n`;
        });
        text += `━━━━━━━━━━━━━━━━━━\n*.stopjadibot <nomor>* — stop | *.startjadibot <nomor>* — resume`;
        return reply(text);
    }

    /* ─── STOPJADIBOT ───────────────────────────────────────── */
    if (command === 'stopjadibot') {
        const number = normalizeNumber(args[0]);
        if (!number) return reply(`❓ Format: *.stopjadibot <nomor>*`);

        if (!bots.has(number)) {
            const stopped = global.loadStoppedJadibots ? global.loadStoppedJadibots() : {};
            if (stopped[number]) return reply(`ℹ️ *+${number}* sudah di-stop.\n\nResume: *.startjadibot ${number}*`);
            return reply(`❌ Bot *+${number}* tidak ditemukan.`);
        }

        const e = bots.get(number);
        if (!isOwn && e.ownerNum !== senderNum) return reply(`⛔ Bukan pemilik bot *+${number}*!`);

        const ok = global.stopJadiBot ? await global.stopJadiBot(number) : false;
        return ok
            ? reply(
`✅ *JadiBot +${number} dihentikan!*

Session tersimpan dengan aman.
▸ Resume  : *.startjadibot ${number}*
▸ Hapus   : *.deljadibotses ${number}*`
              )
            : reply(`❌ Gagal stop bot *+${number}*.`);
    }

    /* ─── STARTJADIBOT ──────────────────────────────────────── */
    if (command === 'startjadibot') {
        const number = normalizeNumber(args[0]);
        if (!number) return reply(`❓ Format: *.startjadibot <nomor>*\n\nCek: *.myjadibots*`);

        if (bots.has(number)) {
            const e = bots.get(number);
            if (e.ownerNum !== senderNum && !isOwn) return reply(`⛔ Bukan milik kamu!`);
            return reply(`ℹ️ *+${number}* sudah aktif! ${e.connected ? '🟢 Online' : '🟡 Connecting...'}`);
        }

        const stopped = global.loadStoppedJadibots ? global.loadStoppedJadibots() : {};
        if (stopped[number] && stopped[number].ownerNum !== senderNum && !isOwn)
            return reply(`⛔ Bot *+${number}* bukan milik kamu!`);
        if (!global.resumeJadiBot) return reply('❌ Fitur resume tidak tersedia. Restart bot.');

        await reply(`⏳ *Merestart JadiBot +${number}...*\n_Session ditemukan — tidak perlu pairing ulang._`);
        const result = await global.resumeJadiBot(number, m.chat);
        if (!result.ok) return reply(
`❌ *Gagal resume +${number}*

${result.reason}

Hapus session: *.deljadibotses ${number}*
Daftar ulang : *.jadibot ${number}*`
        );
    }

    /* ─── DELJADIBOTSES ─────────────────────────────────────── */
    if (command === 'deljadibotses') {
        if (!isOwn) return reply('⛔ *Owner Only!*');
        const number = normalizeNumber(args[0]);
        if (!number) return reply(`❓ Format: *.deljadibotses <nomor>*\n⚠️ Session dihapus permanen!`);
        if (bots.has(number)) return reply(`⚠️ Bot masih aktif!\nStop dulu: *.stopjadibot ${number}*`);
        if (!global.deleteJadibotSession) return reply('❌ Fungsi tidak tersedia.');
        await global.deleteJadibotSession(number);
        return reply(`🗑️ Session *+${number}* dihapus.\nDaftar ulang: *.jadibot ${number}*`);
    }

    /* ─── JADIBOT (main command) ────────────────────────────── */
    if (command === 'jadibot') {
        const rawNum = args[0];
        const method = ['qr', 'pairing'].includes((args[1] || '').toLowerCase())
            ? args[1].toLowerCase() : 'pairing';
        const lim    = getLimits();

        /* Info jika tanpa argumen */
        if (!rawNum) {
            const maxSlot = isOwn ? '∞' : isPrem ? lim.premium : lim.free;
            const myN     = [...bots.values()].filter(e => e.ownerNum === senderNum).length;
            const stopped = global.loadStoppedJadibots ? global.loadStoppedJadibots() : {};
            const myStopN = Object.values(stopped).filter(i => i.ownerNum === senderNum).length;
            const newsIds = global.getJadibotNewsletters ? global.getJadibotNewsletters() : [];

            return reply(
`🤖 *JADIBOT*

Slot kamu  : *${myN + myStopN}/${maxSlot}*
Slot global: *${bots.size}/${lim.global}*
Newsletter : *${newsIds.length ? newsIds.join(', ') : 'tidak ada'}*

*Format:*
_.jadibot <nomor> [pairing|qr]_

*Contoh:*
_.jadibot 628123456789_
_.jadibot 628123456789 qr_

*Perintah lain:*
*.myjadibots*           — bot kamu
*.stopjadibot <nomor>*  — stop
*.startjadibot <nomor>* — resume`
            );
        }

        const number = normalizeNumber(rawNum);
        if (!number || number.length < 10) return reply('❌ Nomor tidak valid!\nContoh: *628123456789*');

        /* Auto-resume jika ada di stopped */
        const stopped = global.loadStoppedJadibots ? global.loadStoppedJadibots() : {};
        if (stopped[number]) {
            const info = stopped[number];
            if (info.ownerNum !== senderNum && !isOwn) return reply(`⛔ Bot *+${number}* bukan milik kamu!`);
            if (!global.resumeJadiBot) return reply('❌ Fitur tidak tersedia.');
            await reply(`⏳ *Merestart JadiBot +${number}...*\n✔️ Session ditemukan — langsung aktif!\n_Tunggu notif "Bot Aktif"._`);
            const result = await global.resumeJadiBot(number, m.chat);
            if (!result.ok) return reply(`❌ *Gagal resume*\n${result.reason}\n\nHapus: *.deljadibotses ${number}*`);
            return;
        }

        /* Cek sudah aktif */
        if (bots.has(number)) {
            const e = bots.get(number);
            if (e.ownerNum === senderNum)
                return reply(`⚠️ *+${number}* sudah aktif!\n${e.connected ? '🟢 Online' : '🟡 Connecting...'}\n\n*.stopjadibot ${number}* — stop dulu`);
            return reply(`⚠️ *+${number}* sudah digunakan orang lain!`);
        }

        /* Slot checks */
        if (bots.size >= lim.global)
            return reply(`⛔ Slot global penuh! (*${bots.size}/${lim.global}*)\nTunggu ada bot yang dihentikan.`);

        const myBots    = [...bots.values()].filter(e => e.ownerNum === senderNum);
        const maxAllowed = isOwn ? Infinity : isPrem ? lim.premium : lim.free;
        if (myBots.length >= maxAllowed)
            return reply(`⛔ *Slot kamu penuh!* (${myBots.length}/${maxAllowed})\n*.stopjadibot <nomor>* — stop salah satu dulu`);

        if (!global.startJadiBot) return reply('❌ Fitur tidak tersedia. Restart bot.');

        const ownerRole = isOwn ? 'owner' : isPrem ? 'premium' : 'free';
        const maxSlot   = isOwn ? '∞' : isPrem ? lim.premium : lim.free;
        const newsIds   = global.getJadibotNewsletters ? global.getJadibotNewsletters() : [];

        await reply(
`⏳ *Memulai JadiBot +${number}...*

Metode     : ${method === 'qr' ? '📷 QR Code' : '🔗 Pairing Code'}
Slot kamu  : ${myBots.length + 1}/${maxSlot}
Slot global: ${bots.size + 1}/${lim.global}
Newsletter : ${newsIds.length ? newsIds.join(', ') : '-'}

${method === 'pairing'
    ? '📩 Kode dikirim dalam beberapa detik.\n_WA → Perangkat Tertaut → Tautkan dengan Nomor_\n\n⚠️ Setelah masukkan kode, *TUNGGU* notif "Bot Aktif".\n_Jangan panik jika tidak langsung — proses bisa 30–90 detik._'
    : '📷 QR dikirim sebagai gambar.\n_Scan dari WA target dalam 3 menit._'
}`
        );

        global.startJadiBot(number, method, m.chat, {
            ownerNum:  senderNum,
            ownerJid:  senderJid,
            ownerRole,
        }).catch(async e => {
            console.error('[JADIBOT]', e.message);
            await reply(`❌ Error: ${e.message}`).catch(() => {});
        });
    }
};

handler.command = [
    'jadibot',
    'listjadibot',
    'stopjadibot',
    'myjadibots',
    'startjadibot',
    'deljadibotses',
    'setjadibotlimit',
    'jadibotlimit',
    'setjadibotnews',
    'jadibotnews',
];
handler.tags     = ['jadibot'];
handler.limit    = false;
handler.mainOnly = true;  // hanya bisa dipakai dari bot utama, tidak dari jadibot

handler.fitur    = {
    'jadibot': 'Buat jadibot baru',
    'listjadibot': 'Lihat semua jadibot aktif (owner)',
    'stopjadibot': 'Stop jadibot (session disimpan)',
    'myjadibots': 'Lihat jadibotmu + status',
    'startjadibot': 'Resume jadibot yang di-stop',
    'deljadibotses': 'Hapus session jadibot (owner)',
    'setjadibotlimit': 'Atur batas jumlah jadibot',
    'jadibotlimit': 'Lihat batas jumlah jadibot',
    'setjadibotnews': 'Set newsletter auto-follow jadibot',
    'jadibotnews': 'Info newsletter jadibot',
};
module.exports = handler;
