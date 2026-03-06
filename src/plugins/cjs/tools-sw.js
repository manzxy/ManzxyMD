/**
 * tools-sw.js — Download Status WhatsApp (Story)
 *
 * ─ COMMAND ───────────────────────────────────────────────────
 *  .sw                    → lihat semua status yang masuk hari ini
 *  .sw 628xxx             → lihat status dari nomor tertentu
 *  .sw dl 628xxx          → download SEMUA media dari nomor
 *  .sw dl 628xxx 1        → download status ke-1 dari nomor
 *  .sw clear              → hapus semua status tersimpan
 *
 * ─ CARA KERJA ────────────────────────────────────────────────
 *  Bot otomatis menyimpan semua status WA yang masuk ke memory.
 *  Status disimpan selama 24 jam lalu auto-hapus.
 *  Bot harus ada di kontak orang tersebut agar bisa melihat SW-nya.
 *
 * ─ CATATAN ───────────────────────────────────────────────────
 *  Owner only — privasi pengguna lain dijaga
 */

'use strict';

const { downloadMediaMessage } = require('@whiskeysockets/baileys');

/* ── Format waktu ── */
function fmtTime(ts) {
    return new Date(ts).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
}

function fmtAge(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return 'baru saja';
    if (m < 60) return `${m} menit lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return `${Math.floor(h / 24)} hari lalu`;
}

/* ── Icon per tipe ── */
const TYPE_ICON = {
    image:    '🖼️',
    video:    '🎥',
    audio:    '🎵',
    document: '📄',
    text:     '💬',
};

/* ── Dapatkan store dari global ── */
function getStore() {
    return global._statusStore || new Map();
}

/* ── Lookup status dari store berdasarkan nomor input ──
 * Store key = nomor WA bersih (628xxx), dijamin bukan LID.
 * User boleh input nomor dengan/tanpa kode negara.
 */
function lookupStore(store, rawInput) {
    if (!rawInput) return { key: null, list: [] };
    const { normalizeNum } = require('../../lib/jid-utils.js');
    const num = normalizeNum(rawInput) || rawInput.replace(/[^0-9]/g, '');
    if (!num) return { key: null, list: [] };

    if (store.has(num)) return { key: num, list: store.get(num) };

    // Coba tanpa kode negara (misal user input 08xxx)
    const alt = num.startsWith('62') ? '0' + num.slice(2) : null;
    if (alt && store.has(alt)) return { key: alt, list: store.get(alt) };

    return { key: null, list: [] };
}

/* ── Handler utama ── */
const handler = async (m, { manzxy, args, reply, isOwn }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    const store = getStore();
    const sub   = (args[0] || '').toLowerCase();

    /* ── .sw clear ── */
    if (sub === 'clear') {
        const total = [...store.values()].reduce((a, v) => a + v.length, 0);
        store.clear();
        return reply(`🗑️ Semua status dihapus dari memory (${total} status).`);
    }

    /* ── .sw dl <nomor> [index] ── */
    if (sub === 'dl' || sub === 'download') {
        const rawNum = (args[1] || '').replace(/[^0-9]/g, '');
        if (!rawNum) return reply('❌ Masukkan nomor.\nContoh: *.sw dl 628xxx*');

        const { key: resolvedKey, list } = lookupStore(store, rawNum);
        const displayNum = resolvedKey || rawNum;
        if (!list.length) return reply(`❌ Tidak ada status tersimpan dari *+${rawNum}*.\n\nBot harus ada di kontak orang tersebut dan status sudah masuk sebelumnya.`);

        // Filter hanya yang punya media
        const mediaList = list.filter(s => s.type !== 'text');
        if (!mediaList.length) {
            return reply(`ℹ️ *+${rawNum}* hanya punya status teks (${list.length} status), tidak ada media untuk didownload.`);
        }

        // Pilih index tertentu atau semua
        const idxArg = args[2] ? parseInt(args[2]) - 1 : null;
        const targets = idxArg !== null
            ? (mediaList[idxArg] ? [mediaList[idxArg]] : null)
            : mediaList.slice(0, 10); // max 10 sekaligus

        if (!targets) return reply(`❌ Nomor status tidak valid. Ada ${mediaList.length} status media dari +${rawNum}.`);

        await reply(`⏳ Mengunduh ${targets.length} status dari *+${displayNum}*...`);

        let ok = 0, fail = 0;
        for (const status of targets) {
            try {
                const buf = await downloadMediaMessage(
                    { message: status.message, key: { remoteJid: 'status@broadcast', id: status.id, participant: status.participant } },
                    'buffer',
                    {},
                    { logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }, reuploadRequest: manzxy.updateMediaMessage }
                );

                const caption = status.caption
                    ? `${TYPE_ICON[status.type]} *Status +${displayNum}*\n📅 ${fmtTime(status.ts)}\n📝 ${status.caption}`
                    : `${TYPE_ICON[status.type]} *Status +${displayNum}*\n📅 ${fmtTime(status.ts)}`;

                if (status.type === 'image') {
                    await manzxy.sendMessage(m.chat, { image: buf, caption }, { quoted: m });
                } else if (status.type === 'video') {
                    await manzxy.sendMessage(m.chat, { video: buf, caption, gifPlayback: false }, { quoted: m });
                } else if (status.type === 'audio') {
                    await manzxy.sendMessage(m.chat, { audio: buf, mimetype: status.mimetype || 'audio/mp4', ptt: false }, { quoted: m });
                } else if (status.type === 'document') {
                    await manzxy.sendMessage(m.chat, {
                        document: buf,
                        mimetype: status.mimetype || 'application/octet-stream',
                        fileName: `status_${rawNum}_${status.ts}.${(status.mimetype || '').split('/')[1] || 'bin'}`,
                        caption,
                    }, { quoted: m });
                }
                ok++;
                // Jeda kecil agar tidak flood
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                fail++;
                // Status mungkin sudah expired di server WA (>24 jam)
            }
        }

        return reply(
            ok > 0
                ? `✅ Berhasil download *${ok}* status${fail > 0 ? `, ${fail} gagal (mungkin sudah expired)` : ''}.`
                : `❌ Semua status gagal didownload. Kemungkinan sudah expired (>24 jam dari posting).`
        );
    }

    /* ── .sw <nomor> — lihat status dari nomor tertentu ── */
    if (sub && /^\d+$/.test(sub)) {
        const rawNum = sub.replace(/[^0-9]/g, '');
        const { key: resolvedKey, list } = lookupStore(store, rawNum);
        const displayNum = resolvedKey || rawNum;

        if (!list.length) {
            return reply(
`❌ Tidak ada status tersimpan dari *+${rawNum}*.

Kemungkinan:
• Bot belum ada di kontak orang ini
• Belum ada status baru sejak bot online
• Status sudah dihapus / expired`
            );
        }

        const mediaCount = list.filter(s => s.type !== 'text').length;
        let txt = `📱 *Status dari +${displayNum}*${rawNum !== displayNum ? ` _(input: ${rawNum})_` : ''}\n`;
        txt += `━━━━━━━━━━━━━━━━\n\n`;
        txt += `📊 Total: ${list.length} | 🖼️ Media: ${mediaCount}\n\n`;

        list.forEach((s, i) => {
            txt += `*${i + 1}.* ${TYPE_ICON[s.type] || '❓'} *${s.type.toUpperCase()}*`;
            if (s.caption) txt += ` — ${s.caption.slice(0, 40)}${s.caption.length > 40 ? '...' : ''}`;
            txt += `\n   🕐 ${fmtAge(s.ts)}\n`;
        });

        txt += `\n💡 Download: *.sw dl ${rawNum}* atau *.sw dl ${rawNum} 1* (per nomor)`;
        return reply(txt);
    }

    /* ── .sw — tampilkan semua pengirim ── */
    if (!sub) {
        if (!store.size) {
            return reply(
`📭 *Belum ada status tersimpan.*

Bot otomatis menyimpan status WA yang masuk.
Syarat: bot harus ada di kontak pengirim.

Coba lagi setelah ada kontak yang update status.`
            );
        }

        // Hitung total & kelompokkan per pengirim
        let txt   = `📊 *Status WA Tersimpan*\n`;
        txt += `━━━━━━━━━━━━━━━━\n\n`;

        let totalAll = 0;
        const sorted = [...store.entries()].sort((a, b) => {
            const latestA = a[1][0]?.ts || 0;
            const latestB = b[1][0]?.ts || 0;
            return latestB - latestA;
        });

        for (const [num, list] of sorted) {
            const mediaCount = list.filter(s => s.type !== 'text').length;
            const textCount  = list.length - mediaCount;
            const latest     = list[0]?.ts || 0;
            totalAll += list.length;

            txt += `📱 *+${num}*\n`;
            txt += `   ${list.length} status`;
            if (mediaCount) txt += ` (${mediaCount} media)`;
            if (textCount)  txt += ` (${textCount} teks)`;
            txt += `\n   🕐 Terbaru: ${fmtAge(latest)}\n\n`;
        }

        txt += `━━━━━━━━━━━━━━━━\n`;
        txt += `📦 Total: *${totalAll}* status dari *${store.size}* kontak\n\n`;
        txt += `*Cara download:*\n`;
        txt += `• *.sw 628xxx* — lihat list status\n`;
        txt += `• *.sw dl 628xxx* — download semua media\n`;
        txt += `• *.sw dl 628xxx 1* — download status ke-1`;

        return reply(txt);
    }

    /* ── Help ── */
    return reply(
`📘 *SW Downloader — Bantuan*

• *.sw* — lihat semua yang ada status hari ini
• *.sw 628xxx* — list status dari nomor tertentu
• *.sw dl 628xxx* — download semua media dari nomor
• *.sw dl 628xxx 2* — download status ke-2 saja
• *.sw clear* — hapus semua dari memory

⚠️ Status tersimpan otomatis selama *24 jam*.
Bot harus ada di kontak pengirim untuk bisa melihat statusnya.`
    );
};

handler.command  = ['sw', 'swdl', 'statuswa'];
handler.tags     = ['owner'];
handler.limit    = false;
handler.owner    = true;

handler.fitur = {
    'sw':       'Download status WA (story) seseorang',
    'swdl':     'Download status WA (story)',
    'statuswa': 'Download status WA (story)',
};

module.exports = handler;
