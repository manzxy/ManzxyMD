/* ============================================================
   ADZAN PLUGIN
   
   Commands (admin/owner grup):
     .adzan on <kota>    → Aktifkan notif adzan di grup ini
     .adzan off          → Nonaktifkan notif adzan
     .adzan status       → Lihat status & jadwal hari ini
     .adzan kota <nama>  → Ganti kota
     .adzan test <waktu> → Test kirim notif (subuh/dzuhur/ashar/maghrib/isya)
   
   Contoh:
     .adzan on Jakarta
     .adzan on Surabaya
     .adzan on Bandung
   ============================================================ */

const axios  = require('axios');
const path   = require('path');
const fs     = require('fs');
const { getGroup, saveGroup } = require('../../lib/database');

/* ── Nama & emoji waktu sholat ── */
const WAKTU_INFO = {
    subuh:   { label: 'Subuh',   emoji: '🌙', key: 'fajr'    },
    terbit:  { label: 'Terbit',  emoji: '🌅', key: 'sunrise', notif: false },
    dzuhur:  { label: 'Dzuhur',  emoji: '☀️',  key: 'dhuhr'   },
    ashar:   { label: 'Ashar',   emoji: '🌤️', key: 'asr'     },
    maghrib: { label: 'Maghrib', emoji: '🌇', key: 'maghrib'  },
    isya:    { label: 'Isya',    emoji: '🌃', key: 'isha'     },
};

/* ── Audio adzan URL (CDN publik) ── */
const AUDIO_ADZAN = {
    subuh:   'https://www.islamcan.com/audio/adhan/azan1.mp3',
    dzuhur:  'https://www.islamcan.com/audio/adhan/azan1.mp3',
    ashar:   'https://www.islamcan.com/audio/adhan/azan1.mp3',
    maghrib: 'https://www.islamcan.com/audio/adhan/azan1.mp3',
    isya:    'https://www.islamcan.com/audio/adhan/azan1.mp3',
};

/* ── Cache jadwal adzan per kota per hari ── */
const _jadwalCache = {}; // { 'Jakarta_2026-02-24': { subuh: '04:32', ... } }

/* ── Ambil ID kota dari MyQuran API ── */
async function getCityId(kota) {
    const url = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(kota)}`;
    const res = await axios.get(url, { timeout: 8000 });
    const data = res.data?.data;
    if (!data || !data.length) throw new Error(`Kota "${kota}" tidak ditemukan`);
    return { id: data[0].id, nama: data[0].lokasi };
}

/* ── Ambil jadwal sholat ── */
async function getJadwal(kotaId, tanggal) {
    const cacheKey = `${kotaId}_${tanggal}`;
    if (_jadwalCache[cacheKey]) return _jadwalCache[cacheKey];

    const [y, m, d] = tanggal.split('-');
    const url = `https://api.myquran.com/v2/sholat/jadwal/${kotaId}/${y}/${m}/${d}`;
    const res = await axios.get(url, { timeout: 8000 });
    const j = res.data?.data?.jadwal;
    if (!j) throw new Error('Gagal ambil jadwal');

    const result = {
        subuh:   j.subuh,
        terbit:  j.terbit,
        dzuhur:  j.dzuhur,
        ashar:   j.ashar,
        maghrib: j.maghrib,
        isya:    j.isya,
    };

    _jadwalCache[cacheKey] = result;
    // Hapus cache lama (> 2 hari)
    const keys = Object.keys(_jadwalCache);
    if (keys.length > 20) delete _jadwalCache[keys[0]];

    return result;
}

/* ── Format teks notif adzan ── */
function buildNotifText(waktu, jam, kota) {
    const info    = WAKTU_INFO[waktu];
    const doa     = waktu === 'subuh'
        ? '_Allahu Akbar Allahu Akbar..._\n_Hayya \'alash shalah..._\n_Ash-shalatu khairum minan-nawm..._'
        : '_Allahu Akbar Allahu Akbar..._\n_Hayya \'alash shalah..._\n_Hayya \'alal falah..._';

    return `${info.emoji} *Waktu ${info.label} telah tiba*

🕌 Kota    : *${kota}*
🕐 Pukul   : *${jam} WIB*

${doa}

_Segera tunaikan sholat ${info.label} 🤲_`;
}

/* ── Kirim notif adzan ke grup ── */
async function kirimAdzan(sock, gid, waktu, jam, kotaNama) {
    const teks = buildNotifText(waktu, jam, kotaNama);

    // Kirim teks dulu
    await sock.sendMessage(gid, { text: teks }).catch(() => {});

    // Kirim audio adzan
    const audioUrl = AUDIO_ADZAN[waktu];
    if (audioUrl) {
        try {
            const audioRes = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const buffer = Buffer.from(audioRes.data);
            await sock.sendMessage(gid, {
                audio:    buffer,
                mimetype: 'audio/mp4',
                ptt:      false,
            }).catch(() => {});
        } catch (e) {
            console.error('[ADZAN] Gagal kirim audio:', e.message);
        }
    }
}

/* ── Expose ke global untuk dipanggil schedulerTick ── */
global._adzanKirim = kirimAdzan;
global._adzanGetJadwal = getJadwal;

/* ── Handler command ── */
const handler = async (m, { manzxy, args, reply, isOwn, isAdmin, from, senderJid }) => {
    const sub  = (args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    const gd = getGroup(from);
    if (!gd.adzan) gd.adzan = { enabled: false, kotaId: null, kotaNama: null };

    /* ── .adzan on <kota> ── */
    if (sub === 'on') {
        if (!rest) return reply(`❌ Masukkan nama kota.\nContoh: *.adzan on Jakarta*`);
        reply(`⏳ Mencari kota *${rest}*...`);
        try {
            const { id, nama } = await getCityId(rest);
            gd.adzan.enabled  = true;
            gd.adzan.kotaId   = id;
            gd.adzan.kotaNama = nama;
            saveGroup(from, gd);

            // Test ambil jadwal hari ini
            const now    = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
            const tgl    = now.toISOString().split('T')[0];
            const jadwal = await getJadwal(id, tgl);

            let txt = `✅ *Notif Adzan Aktif!*\n\n`;
            txt += `🕌 Kota    : *${nama}*\n`;
            txt += `📅 Hari ini : ${now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;
            txt += `*Jadwal Sholat:*\n`;
            txt += `🌙 Subuh   : *${jadwal.subuh}*\n`;
            txt += `🌅 Terbit  : *${jadwal.terbit}*\n`;
            txt += `☀️  Dzuhur  : *${jadwal.dzuhur}*\n`;
            txt += `🌤️ Ashar   : *${jadwal.ashar}*\n`;
            txt += `🌇 Maghrib : *${jadwal.maghrib}*\n`;
            txt += `🌃 Isya    : *${jadwal.isya}*\n\n`;
            txt += `_Bot akan kirim notif + audio adzan otomatis setiap waktu sholat._`;
            reply(txt);
        } catch (e) {
            reply(`❌ ${e.message}`);
        }
        return;
    }

    /* ── .adzan off ── */
    if (sub === 'off') {
        gd.adzan.enabled = false;
        saveGroup(from, gd);
        return reply(`🔕 Notif adzan *dinonaktifkan* di grup ini.`);
    }

    /* ── .adzan kota <nama> ── */
    if (sub === 'kota') {
        if (!rest) return reply(`❌ Masukkan nama kota.\nContoh: *.adzan kota Surabaya*`);
        reply(`⏳ Mencari kota *${rest}*...`);
        try {
            const { id, nama } = await getCityId(rest);
            gd.adzan.kotaId   = id;
            gd.adzan.kotaNama = nama;
            saveGroup(from, gd);
            reply(`✅ Kota diubah ke *${nama}*.`);
        } catch (e) {
            reply(`❌ ${e.message}`);
        }
        return;
    }

    /* ── .adzan status ── */
    if (sub === 'status' || !sub) {
        const enabled  = gd.adzan?.enabled;
        const kotaNama = gd.adzan?.kotaNama;
        const kotaId   = gd.adzan?.kotaId;

        let txt = `🕌 *Status Adzan Grup*\n\n`;
        txt += `Status : ${enabled ? '✅ Aktif' : '🔕 Nonaktif'}\n`;
        txt += `Kota   : ${kotaNama || '-'}\n\n`;

        if (enabled && kotaId) {
            try {
                const now    = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
                const tgl    = now.toISOString().split('T')[0];
                const jadwal = await getJadwal(kotaId, tgl);
                txt += `*Jadwal Hari Ini:*\n`;
                txt += `🌙 Subuh   : *${jadwal.subuh}*\n`;
                txt += `🌅 Terbit  : *${jadwal.terbit}*\n`;
                txt += `☀️  Dzuhur  : *${jadwal.dzuhur}*\n`;
                txt += `🌤️ Ashar   : *${jadwal.ashar}*\n`;
                txt += `🌇 Maghrib : *${jadwal.maghrib}*\n`;
                txt += `🌃 Isya    : *${jadwal.isya}*\n`;
            } catch {
                txt += `_(Gagal ambil jadwal hari ini)_\n`;
            }
        }

        txt += `\n*Commands:*\n`;
        txt += `• *.adzan on <kota>* — aktifkan\n`;
        txt += `• *.adzan off* — nonaktifkan\n`;
        txt += `• *.adzan kota <nama>* — ganti kota\n`;
        txt += `• *.adzan test <waktu>* — test kirim notif`;
        return reply(txt);
    }

    /* ── .adzan test <waktu> ── */
    if (sub === 'test') {
        const w = rest.toLowerCase();
        if (!WAKTU_INFO[w]) return reply(`❌ Waktu tidak valid.\nPilihan: subuh / dzuhur / ashar / maghrib / isya`);
        const kotaNama = gd.adzan?.kotaNama || 'Jakarta';
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const jam = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        reply(`🔔 Mengirim test notif *${w}*...`);
        await kirimAdzan(manzxy, from, w, jam, kotaNama);
        return;
    }

    return reply(`❓ Sub-command tidak dikenal.\nKetik *.adzan status* untuk bantuan.`);
};

handler.command  = ['adzan'];
handler.tags     = ['islami'];
handler.limit    = false;
handler.group    = true;
handler.admin    = true; // hanya admin/owner grup

handler.fitur    = {
    'adzan': 'Notifikasi waktu sholat otomatis',
};
module.exports = handler;
