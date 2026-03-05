/* ============================================================
   GROUP SCHEDULER PLUGIN
   Jadwalkan aksi grup otomatis berdasarkan waktu WIB

   Commands:
     .schedule                          → Panduan & status
     .schedule add <jam> <aksi> [hari] → Tambah jadwal
     .schedule list                     → Lihat semua jadwal
     .schedule del <no>                 → Hapus jadwal
     .schedule clear                    → Hapus semua jadwal
     .schedule on <no>                  → Aktifkan jadwal
     .schedule off <no>                 → Nonaktifkan jadwal
     .schedule test <no>                → Test jalankan jadwal sekarang

   Aksi tersedia:
     close     → Tutup grup (hanya admin bisa kirim)
     open      → Buka grup (semua bisa kirim)
     lockinfo  → Kunci edit info grup
     unlockinfo→ Buka kunci edit info grup
     mute      → Bot diam di grup ini
     unmute    → Bot aktif lagi

   Format hari (opsional, pisah koma, default=semua hari):
     Angka  : 0=Min 1=Sen 2=Sel 3=Rab 4=Kam 5=Jum 6=Sab
     Nama   : minggu/senin/selasa/rabu/kamis/jumat/sabtu

   Contoh:
     .schedule add 22:00 close
     .schedule add 06:00 open
     .schedule add 23:00 mute 1,2,3,4,5
     .schedule add 05:30 unmute senin,selasa,rabu,kamis,jumat
     .schedule add 22:00 lockinfo sabtu,minggu
   ============================================================ */

const { getGroup } = require('../../lib/database');

const VALID_ACTIONS = ['close', 'open', 'lockinfo', 'unlockinfo', 'mute', 'unmute'];

const DAY_MAP = {
    '0': 0, 'minggu': 0, 'min': 0, 'sun': 0, 'sunday': 0,
    '1': 1, 'senin': 1,  'sen': 1, 'mon': 1, 'monday': 1,
    '2': 2, 'selasa': 2, 'sel': 2, 'tue': 2, 'tuesday': 2,
    '3': 3, 'rabu': 3,   'rab': 3, 'wed': 3, 'wednesday': 3,
    '4': 4, 'kamis': 4,  'kam': 4, 'thu': 4, 'thursday': 4,
    '5': 5, 'jumat': 5,  'jum': 5, 'fri': 5, 'friday': 5,
    '6': 6, 'sabtu': 6,  'sab': 6, 'sat': 6, 'saturday': 6,
};

const DAY_LABEL  = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_FULL   = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const ACTION_LABEL = {
    close:      '🔒 Tutup grup',
    open:       '🔓 Buka grup',
    lockinfo:   '🔏 Lock info grup',
    unlockinfo: '🔑 Unlock info grup',
    mute:       '🔇 Mute bot',
    unmute:     '🔊 Unmute bot',
};

const ACTION_NEED_BOTADMIN = ['close', 'open', 'lockinfo', 'unlockinfo'];

function parseTime(str) {
    const m = /^(\d{1,2}):(\d{2})$/.exec((str || '').trim());
    if (!m) return null;
    const h = parseInt(m[1]), min = parseInt(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return { h, m: min };
}

function parseDays(str) {
    if (!str || !str.trim()) return [];
    const parts = str.split(',');
    const result = [];
    for (const p of parts) {
        const key = p.trim().toLowerCase();
        if (key in DAY_MAP) {
            const d = DAY_MAP[key];
            if (!result.includes(d)) result.push(d);
        }
    }
    return result.sort((a, b) => a - b);
}

function formatDays(days) {
    if (!days || !days.length) return 'Setiap hari';
    return days.map(d => DAY_LABEL[d]).join(', ');
}

function padTime(h, m) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Eksekusi aksi — dipanggil dari scheduler engine di index.js juga dari .schedule test
async function executeAction(sock, groupJid, action, gd) {
    const results = { action, success: false, msg: '' };
    try {
        if (action === 'close') {
            await sock.groupSettingUpdate(groupJid, 'announcement');
            gd.mute = false; // tutup bukan mute bot
            results.success = true;
            results.msg = '🔒 Grup ditutup — hanya admin yang bisa kirim pesan.';
        } else if (action === 'open') {
            await sock.groupSettingUpdate(groupJid, 'not_announcement');
            results.success = true;
            results.msg = '🔓 Grup dibuka — semua member bisa kirim pesan.';
        } else if (action === 'lockinfo') {
            await sock.groupSettingUpdate(groupJid, 'locked');
            gd.setinfo = true;
            results.success = true;
            results.msg = '🔏 Info grup dikunci — hanya admin yang bisa edit.';
        } else if (action === 'unlockinfo') {
            await sock.groupSettingUpdate(groupJid, 'unlocked');
            gd.setinfo = false;
            results.success = true;
            results.msg = '🔑 Info grup dibuka — semua member bisa edit.';
        } else if (action === 'mute') {
            gd.mute = true;
            results.success = true;
            results.msg = '🔇 Bot di-mute — bot tidak akan merespons di grup ini.';
        } else if (action === 'unmute') {
            gd.mute = false;
            results.success = true;
            results.msg = '🔊 Bot di-unmute — bot kembali aktif di grup ini.';
        }
    } catch (e) {
        results.success = false;
        results.msg = `❌ Gagal: ${e.message}`;
    }
    return results;
}

// Expose ke global supaya bisa dipanggil scheduler engine
global.scheduleExecuteAction = executeAction;

const handler = async (m, {
    manzxy, args, command, reply,
    isOwn, isAdmin, botAdmin,
    from, groupData
}) => {
    if (!m.isGroup) return reply('❌ Command ini khusus di grup!');
    if (!isAdmin && !isOwn) return reply('❌ Hanya admin grup yang bisa mengatur jadwal!');

    const gd = groupData || getGroup(from);
    if (!gd.schedule || typeof gd.schedule !== 'object') gd.schedule = { jobs: [] };
    if (!Array.isArray(gd.schedule.jobs)) gd.schedule.jobs = [];

    const sub = (args[0] || '').toLowerCase();

    // ── Tanpa sub → panduan & status ──────────────────────────
    if (!sub) {
        const jobs = gd.schedule.jobs;
        const active = jobs.filter(j => j.enabled).length;

        let txt = `⏰ *GROUP SCHEDULER*\n`;
        txt += `━━━━━━━━━━━━━━━━━━\n\n`;
        txt += `📊 Status: ${jobs.length ? `${active} aktif / ${jobs.length} total jadwal` : 'Belum ada jadwal'}\n\n`;
        txt += `📌 *Sub-command:*\n`;
        txt += `• \`.schedule add <jam> <aksi> [hari]\` — tambah jadwal\n`;
        txt += `• \`.schedule list\` — lihat semua jadwal\n`;
        txt += `• \`.schedule del <no>\` — hapus jadwal\n`;
        txt += `• \`.schedule clear\` — hapus semua jadwal\n`;
        txt += `• \`.schedule on <no>\` — aktifkan jadwal\n`;
        txt += `• \`.schedule off <no>\` — nonaktifkan jadwal\n`;
        txt += `• \`.schedule test <no>\` — uji coba jadwal sekarang\n\n`;
        txt += `⚡ *Aksi tersedia:*\n`;
        for (const [k, v] of Object.entries(ACTION_LABEL)) {
            const needAdmin = ACTION_NEED_BOTADMIN.includes(k) ? ' *(bot harus admin)*' : '';
            txt += `  • \`${k}\` — ${v}${needAdmin}\n`;
        }
        txt += `\n📅 *Format hari* (opsional, pisah koma, default=semua):\n`;
        txt += `  \`1,2,3,4,5\` atau \`senin,selasa,rabu,kamis,jumat\`\n\n`;
        txt += `💡 *Contoh:*\n`;
        txt += `\`.schedule add 22:00 close\`\n`;
        txt += `\`.schedule add 06:00 open\`\n`;
        txt += `\`.schedule add 23:00 mute 1,2,3,4,5\``;
        return reply(txt);
    }

    // ── ADD ────────────────────────────────────────────────────
    if (sub === 'add' || sub === 'tambah') {
        const timeStr   = args[1];
        const actionStr = (args[2] || '').toLowerCase();
        const daysStr   = args.slice(3).join(',').trim() || args[3] || '';

        if (!timeStr || !actionStr) {
            return reply(
`❌ Format salah!

*.schedule add <jam> <aksi> [hari]*

Contoh:
• \`.schedule add 22:00 close\`
• \`.schedule add 06:00 open 1,2,3,4,5\`
• \`.schedule add 23:00 mute senin,jumat\``
            );
        }

        const time = parseTime(timeStr);
        if (!time) return reply(`❌ Format jam salah!\n\nGunakan format HH:MM, contoh: *22:00* atau *06:30*`);

        if (!VALID_ACTIONS.includes(actionStr)) {
            return reply(`❌ Aksi *${actionStr}* tidak valid!\n\nAksi tersedia:\n${VALID_ACTIONS.map(a => `• \`${a}\``).join('\n')}`);
        }

        if (ACTION_NEED_BOTADMIN.includes(actionStr) && !botAdmin) {
            return reply(`❌ Aksi *${actionStr}* butuh bot jadi admin grup dulu!`);
        }

        const days = parseDays(daysStr);

        // Cek duplikat jam+aksi
        const timeKey = `${time.h}:${time.m}`;
        const isDup = gd.schedule.jobs.some(j => j.time === timeKey && j.action === actionStr);
        if (isDup) {
            return reply(`⚠️ Jadwal *${padTime(time.h, time.m)} WIB — ${actionStr}* sudah ada!\n\nGunakan *.schedule list* untuk lihat jadwal.`);
        }

        if (gd.schedule.jobs.length >= 20) {
            return reply(`❌ Maksimal *20 jadwal* per grup!\n\nHapus jadwal lama dulu dengan *.schedule del <no>*`);
        }

        gd.schedule.jobs.push({
            id:      Date.now(),
            time:    timeKey,
            action:  actionStr,
            days,
            enabled: true,
            addedBy: m.sender,
            addedAt: Date.now(),
        });

        // Sort berdasarkan waktu
        gd.schedule.jobs.sort((a, b) => {
            const [ah, am] = a.time.split(':').map(Number);
            const [bh, bm] = b.time.split(':').map(Number);
            return (ah * 60 + am) - (bh * 60 + bm);
        });

        const needBotAdmin = ACTION_NEED_BOTADMIN.includes(actionStr);
        return reply(
`✅ *Jadwal berhasil ditambahkan!*

⏰ Waktu : *${padTime(time.h, time.m)} WIB*
⚡ Aksi  : *${ACTION_LABEL[actionStr]}*
📅 Hari  : *${formatDays(days)}*
${needBotAdmin ? '\n⚠️ Pastikan bot selalu jadi admin untuk aksi ini.' : ''}
Lihat semua jadwal: *.schedule list*`
        );
    }

    // ── LIST ───────────────────────────────────────────────────
    if (sub === 'list' || sub === 'ls' || sub === 'daftar') {
        const jobs = gd.schedule.jobs;
        if (!jobs.length) {
            return reply(`📋 Belum ada jadwal di grup ini.\n\nTambahkan dengan: *.schedule add <jam> <aksi>*`);
        }

        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const todayDay = now.getDay();
        const todayMin = now.getHours() * 60 + now.getMinutes();

        let txt = `📋 *JADWAL GRUP* (${jobs.length}/20)\n`;
        txt += `━━━━━━━━━━━━━━━━━━\n\n`;

        jobs.forEach((job, i) => {
            const [h, mi] = job.time.split(':').map(Number);
            const jobMin  = h * 60 + mi;
            const runsToday = !job.days.length || job.days.includes(todayDay);
            const upcoming  = runsToday && jobMin > todayMin;

            const badge = !job.enabled ? '⏸️' : upcoming ? '🔜' : '🟢';

            txt += `${i + 1}. ${badge} *${padTime(h, mi)} WIB* — ${ACTION_LABEL[job.action] || job.action}\n`;
            txt += `   📅 ${formatDays(job.days)}\n`;
            if (!job.enabled) txt += `   _(nonaktif)_\n`;
            txt += `\n`;
        });

        txt += `━━━━━━━━━━━━━━━━━━\n`;
        txt += `💡 Hapus: *.schedule del <no>* | Test: *.schedule test <no>*`;
        return reply(txt);
    }

    // ── DEL ────────────────────────────────────────────────────
    if (sub === 'del' || sub === 'hapus' || sub === 'remove') {
        const jobs = gd.schedule.jobs;
        if (!jobs.length) return reply('📋 Tidak ada jadwal untuk dihapus.');

        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= jobs.length) {
            return reply(`❌ Nomor tidak valid! Masukkan angka 1–${jobs.length}`);
        }

        const [removed] = jobs.splice(idx, 1);
        const [h, mi]   = removed.time.split(':').map(Number);
        return reply(`✅ Jadwal *${padTime(h, mi)} — ${ACTION_LABEL[removed.action]}* berhasil dihapus!`);
    }

    // ── CLEAR ──────────────────────────────────────────────────
    if (sub === 'clear' || sub === 'reset') {
        const count = gd.schedule.jobs.length;
        if (!count) return reply('📋 Tidak ada jadwal untuk dihapus.');
        gd.schedule.jobs = [];
        return reply(`✅ Semua *${count} jadwal* berhasil dihapus!`);
    }

    // ── ON/OFF ─────────────────────────────────────────────────
    if (sub === 'on' || sub === 'off') {
        const jobs = gd.schedule.jobs;
        if (!jobs.length) return reply('📋 Tidak ada jadwal.');

        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= jobs.length) {
            return reply(`❌ Masukkan nomor jadwal 1–${jobs.length}`);
        }

        jobs[idx].enabled = (sub === 'on');
        const [h, mi] = jobs[idx].time.split(':').map(Number);
        const icon = sub === 'on' ? '✅' : '⏸️';
        const word = sub === 'on' ? 'diaktifkan' : 'dinonaktifkan';
        return reply(`${icon} Jadwal *${padTime(h, mi)} — ${ACTION_LABEL[jobs[idx].action]}* ${word}!`);
    }

    // ── TEST ───────────────────────────────────────────────────
    if (sub === 'test' || sub === 'coba') {
        const jobs = gd.schedule.jobs;
        if (!jobs.length) return reply('📋 Tidak ada jadwal. Tambah dulu dengan *.schedule add*');

        const idx = parseInt(args[1]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= jobs.length) {
            return reply(`❌ Masukkan nomor jadwal 1–${jobs.length}`);
        }

        const job = jobs[idx];
        if (ACTION_NEED_BOTADMIN.includes(job.action) && !botAdmin) {
            return reply(`❌ Bot harus jadi admin untuk test aksi *${job.action}*!`);
        }

        await reply(`⏳ Menjalankan jadwal *${ACTION_LABEL[job.action]}* sekarang...`);
        const result = await executeAction(manzxy, from, job.action, gd);
        return reply(result.msg || (result.success ? '✅ Berhasil!' : '❌ Gagal.'));
    }

    return reply(`❓ Sub-command *${sub}* tidak dikenal.\n\nKetik *.schedule* untuk lihat panduan.`);
};

handler.command  = ['schedule', 'jadwal', 'sched'];
handler.tags     = ['group'];
handler.group    = true;
handler.limit    = false;

handler.fitur    = {
    'schedule': 'Jadwal otomatis aksi grup',
    'jadwal': 'Jadwal otomatis aksi grup',
    'sched': 'Jadwal otomatis aksi grup',
};
module.exports = handler;
