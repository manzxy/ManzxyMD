/**
 * owner-add.js — Manajemen Owner & Premium
 * FIX: @tag LID-safe via jid-utils.extractNum
 */
'use strict';
const db = require('../../lib/database');
const { normalizeNum, extractNum, numToJid } = require('../../lib/jid-utils');

const parseDurasi = (args) => {
    const match = args.find(a => {
        const d = a.toLowerCase();
        return ['perm','permanent','lifetime'].includes(d) || /^\d+[dmh]$/.test(d);
    });
    let ms = 30*24*3600*1000, label = '30 hari', perm = false;
    if (match) {
        const d = match.toLowerCase();
        if (['perm','permanent','lifetime'].includes(d)) { perm = true; label = 'Permanent'; }
        else if (d.endsWith('d') && parseInt(d) > 0) { ms = parseInt(d)*86400000; label = `${parseInt(d)} hari`; }
        else if (d.endsWith('m') && parseInt(d) > 0) { ms = parseInt(d)*30*86400000; label = `${parseInt(d)} bulan`; }
        else if (d.endsWith('h') && parseInt(d) > 0) { ms = parseInt(d)*3600000; label = `${parseInt(d)} jam`; }
    }
    return { ms, label, perm };
};

const fmtDate = ms => new Date(ms).toLocaleDateString('id-ID',{ day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta' });

const notif = async (sock, num, text) => {
    try { await sock.sendMessage(num+'@s.whatsapp.net', { text }); } catch {}
};

const handler = async (m, { manzxy, args, command, reply, isOwn, from, participants: _p = [] }) => {
    if (!isOwn) return reply('❌ Fitur ini khusus owner!');

    // Refresh participants agar LID bisa di-resolve
    let participants = _p;
    if (m.isGroup && from) {
        try {
            const meta = await manzxy.groupMetadata(from);
            if (meta?.participants?.length) participants = meta.participants;
        } catch {}
    }

    switch (command) {

        case 'addowner': {
            const num = extractNum(m, args, participants);
            if (!num) return reply(
                '❌ Format salah. Cara pakai:\n'
                +'• *.addowner 628xxx*\n'
                +'• *.addowner* (reply pesan)\n'
                +'• *.addowner @tag*\n\n'
                +'⚠️ Jika tag tidak terdeteksi, kirim nomor langsung.'
            );
            if (db.hasOwner(num)) return reply(`❌ +${num} sudah owner.`);
            db.addOwner(num);
            reply(`✅ *+${num}* ditambahkan sebagai owner!\nTotal: ${db.getOwners().length}`);
            await notif(manzxy, num, `👑 *Selamat!*\nKamu ditambahkan sebagai *Owner Bot*.\nAkses penuh ke semua fitur.`);
            break;
        }

        case 'delowner': case 'removeowner': {
            const num = extractNum(m, args, participants);
            if (!num) return reply('❌ Masukkan nomor owner yang ingin dihapus.');
            if (!db.hasOwner(num)) return reply(`❌ +${num} bukan owner.`);
            db.delOwner(num);
            reply(`✅ *+${num}* dihapus dari daftar owner.`);
            await notif(manzxy, num, `⚠️ *Pemberitahuan*\nAkses *Owner Bot* kamu dicabut.`);
            break;
        }

        case 'listowner': case 'ownerlist': {
            const list = db.getOwners();
            if (!list.length) return reply('📋 Belum ada owner tambahan.');
            reply(`👑 *Daftar Owner* (${list.length})\n\n` + list.map((n,i)=>`${i+1}. +${n}`).join('\n'));
            break;
        }

        case 'addprem': case 'addpremium': {
            const num = extractNum(m, args, participants);
            if (!num) return reply(
                '❌ Format salah. Cara pakai:\n'
                +'• *.addprem 628xxx*\n'
                +'• *.addprem* (reply)\n'
                +'• *.addprem @tag*\n\n'
                +'Durasi (default 30h): 7d | 1m | 6h | perm\n'
                +'⚠️ Jika tag tidak terdeteksi, kirim nomor langsung.'
            );
            const { ms, label, perm } = parseDurasi(args);
            const exp = perm ? 0 : Date.now() + ms;
            const expLabel = perm ? 'Permanent' : fmtDate(exp);
            db.addPremiumNum(num, exp);
            // Invalidate cache agar isPrem langsung aktif tanpa tunggu 60s
            try { global._invalidatePremCache?.(); } catch {}
            const u = db.getUser(num+'@s.whatsapp.net');
            u.premium = true; u.premiumExpired = exp;
            reply(`✅ *+${num}* ditambahkan premium!\n\n⏳ Durasi: *${label}*\n📅 Expired: *${expLabel}*`);
            await notif(manzxy, num, `💎 *Selamat! Kamu mendapat akses Premium!*\n\n⏳ Durasi: *${label}*\n📅 Expired: *${expLabel}*`);
            break;
        }

        case 'delprem': case 'delpremium': case 'removeprem': {
            const num = extractNum(m, args, participants);
            if (!num) return reply('❌ Masukkan nomor premium yang ingin dihapus.');
            const u = db.getUser(num+'@s.whatsapp.net');
            if (!u.premium && !db.getPremiumList?.().includes(num)) return reply(`❌ +${num} bukan premium.`);
            db.delPremiumNum(num);
            u.premium = false; u.premiumExpired = 0;
            reply(`✅ *+${num}* dihapus dari premium.`);
            await notif(manzxy, num, `⚠️ *Pemberitahuan*\nAkses Premium kamu telah berakhir.`);
            break;
        }

        case 'listprem': case 'premlist': {
            const list = db.getPremiumList?.() || [];
            if (!list.length) return reply('📋 Belum ada pengguna premium.');
            let text = `💎 *Daftar Premium* (${list.length})\n\n`;
            for (const [i, n] of list.entries()) {
                const exp = db.getPremiumExpiry?.(n);
                text += `${i+1}. +${n} — ${!exp ? 'Permanent' : fmtDate(exp)}\n`;
            }
            reply(text.trim());
            break;
        }
    }
};

handler.command  = ['addowner','delowner','removeowner','listowner','ownerlist','addprem','addpremium','delprem','delpremium','removeprem','listprem','premlist'];
handler.tags     = ['owner'];
handler.limit    = false;
handler.owner    = true;
handler.mainOnly = true;
handler.fitur    = {
    'addowner': 'Tambah owner bot',
    'delowner': 'Hapus owner bot',
    'removeowner': 'Hapus owner bot',
    'listowner': 'Daftar semua owner',
    'ownerlist': 'Daftar semua owner',
    'addprem': 'Tambah pengguna premium',
    'addpremium': 'Tambah pengguna premium',
    'delprem': 'Hapus pengguna premium',
    'delpremium': 'Hapus pengguna premium',
    'removeprem': 'Hapus pengguna premium',
    'listprem': 'Daftar semua pengguna premium',
    'premlist': 'Daftar semua pengguna premium',
};
module.exports = handler;
