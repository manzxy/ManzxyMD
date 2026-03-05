const { getBuffer } = require("../../core/message.js");
const { normalizeNum } = require('../../lib/jid-utils');

/* ================= UTIL ================= */

// normalizeNumber → normalizeNum dari jid-utils

const resolveNum = (p) => {
    if (p.phoneNumber) return normalizeNum(p.phoneNumber);
    return normalizeNum(p.id);
};

const formatDate = (ts) => {
    if (!ts) return "Tidak diketahui";
    const d = new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
    return d.toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
        timeZone: "Asia/Jakarta"
    });
};

const formatDateTime = (ts) => {
    if (!ts) return "Tidak diketahui";
    const d = new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
    return d.toLocaleString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZone: "Asia/Jakarta"
    });
};

const bar = (val, max, len = 10) => {
    const filled = Math.round((val / max) * len);
    return "█".repeat(Math.max(0, filled)) + "░".repeat(Math.max(0, len - filled));
};

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, command, reply, isAdmin, isOwn, from, participants, groupMetadata, groupData }) => {
    switch (command) {

        case "groupinfo":
        case "ginfo":
        case "infogroup": {
            if (!m.isGroup) return reply("❌ Khusus grup!");

            try {
                // Pastikan metadata tersedia
                const meta = groupMetadata || await manzxy.groupMetadata(from);
                const pp   = participants || meta.participants || [];

                // ── Klasifikasi member ──────────────────────────────
                const admins    = pp.filter(p => p.admin === "admin");
                const superAdmins = pp.filter(p => p.admin === "superadmin");
                const allAdmins = pp.filter(p => p.admin);
                const members   = pp.filter(p => !p.admin);

                const totalMember = pp.length;
                const totalAdmin  = allAdmins.length;
                const totalMember_ = members.length;

                // ── Info dasar ──────────────────────────────────────
                const groupName    = meta.subject        || "Tidak ada nama";
                const groupDesc    = meta.desc           || "Tidak ada deskripsi";
                const groupOwner   = meta.owner          || meta.subjectOwner || null;
                const createdAt    = meta.creation       || meta.subjectTime  || null;
                const inviteCode   = meta.inviteCode     || null;
                const ephemeral    = meta.ephemeralDuration || 0;
                const isLocked     = meta.announce       || false; // hanya admin bisa kirim
                const isRestricted = meta.restrict       || false; // hanya admin bisa edit info
                const memberAddMode = meta.memberAddMode || null;
                const joinApproval  = meta.joinApprovalMode || null;

                // ── Data dari database ──────────────────────────────
                // groupData sudah merupakan hasil getGroup(from) dari handler utama
                const { getGroup } = require('../../lib/database');
                const gdata = groupData || getGroup(from);
                const warnCount  = Object.values(gdata.warns || {}).reduce((a, v) => a + v.length, 0);
                const warnUsers  = Object.keys(gdata.warns || {}).filter(k => gdata.warns[k].length > 0).length;

                // ── Format teks ─────────────────────────────────────
                const ownerDisp = groupOwner
                    ? `+${normalizeNum(groupOwner)}`
                    : "Tidak diketahui";

                const epheLabel =
                    !ephemeral          ? "Off" :
                    ephemeral === 86400  ? "24 jam" :
                    ephemeral === 604800 ? "7 hari" :
                    ephemeral === 7776000 ? "90 hari" :
                    `${ephemeral} detik`;

                // Progress bar member
                const memberBar = bar(totalMember, 1024, 12);

                // List admin (max 10 tampil)
                let adminList = "";
                allAdmins.slice(0, 10).forEach((p, i) => {
                    const num  = resolveNum(p);
                    const role = p.admin === "superadmin" ? "👑" : "🛡️";
                    adminList += `  ${role} +${num || "unknown"}\n`;
                });
                if (allAdmins.length > 10) adminList += `  _...dan ${allAdmins.length - 10} admin lainnya_\n`;

                const text =
`╔══════════════════════╗
  📋 *GROUP INFO DETAIL*
╚══════════════════════╝

🏷️ *Nama Grup*
  ${groupName}

🆔 *Group ID*
  \`${from}\`

📝 *Deskripsi*
  ${groupDesc.length > 200 ? groupDesc.slice(0, 200) + "..." : groupDesc}

━━━━━━━━━━━━━━━━━━━━━━

👥 *Statistik Member*
  ${memberBar} ${totalMember}/1024
  👤 Member  : ${totalMember_}
  🛡️ Admin   : ${totalAdmin}
  👑 Creator : 1

📅 *Dibuat*
  ${formatDateTime(createdAt)}
  Oleh: ${ownerDisp}

━━━━━━━━━━━━━━━━━━━━━━

⚙️ *Pengaturan Grup*
  🔒 Kirim pesan : ${isLocked     ? "Admin only" : "Semua member"}
  ✏️  Edit info   : ${isRestricted ? "Admin only" : "Semua member"}
  ⏱️  Pesan hilang: ${epheLabel}
  🚪 Join approval: ${joinApproval === "on" ? "Aktif" : "Nonaktif"}
  👋 Add member  : ${memberAddMode === "admin_add" ? "Admin only" : "Semua member"}

━━━━━━━━━━━━━━━━━━━━━━

🛡️ *Daftar Admin* (${totalAdmin})
${adminList.trimEnd()}

━━━━━━━━━━━━━━━━━━━━━━

🤖 *Fitur Bot*
  🔗 Antilink   : ${gdata.antilink  || "off"}
  🔕 Mute       : ${gdata.mute       ? "ON" : "OFF"}
  👋 Welcome    : ${gdata.welcome    ? "ON" : "OFF"}
  🔒 AdminOnly  : ${gdata.adminonly  ? "ON" : "OFF"}
  ⚠️  Total Warn : ${warnCount} warn (${warnUsers} user)
${inviteCode ? `\n🔗 *Link Invite*\n  https://chat.whatsapp.com/${inviteCode}` : ""}`;

                // Kirim dengan foto profil grup kalau ada
                try {
                    const ppUrl = await manzxy.profilePictureUrl(from, "image");
                    await manzxy.sendMessage(m.chat, {
                        image: { url: ppUrl },
                        caption: text
                    }, { quoted: m });
                } catch {
                    // Grup tidak punya foto profil
                    await manzxy.sendMessage(m.chat, {
                        text
                    }, { quoted: m });
                }

            } catch (err) {
                console.error("[GINFO]", err.message);
                reply(`❌ Gagal mengambil info grup.\n\n_${err.message}_`);
            }

            break;
        }

        /* ─────────────────────────────────────────
           MEMBER LIST
        ───────────────────────────────────────── */
        case "memberlist":
        case "listmember": {
            if (!m.isGroup) return reply("❌ Khusus grup!");
            if (!isAdmin && !isOwn) return reply("❌ Khusus admin grup!");

            const meta = groupMetadata || await manzxy.groupMetadata(from);
            const pp   = participants  || meta.participants || [];

            let text = `👥 *Member List — ${meta.subject}*\n`;
            text += `Total: *${pp.length} orang*\n\n`;

            let no = 1;
            for (const p of pp) {
                const num  = resolveNum(p);
                const role = p.admin === "superadmin" ? "👑" : p.admin ? "🛡️" : "👤";
                text += `${no}. ${role} +${num || "unknown"}\n`;
                no++;
            }

            // Kalau terlalu panjang, kirim sebagai dokumen teks
            if (text.length > 4000) {
                const buf = Buffer.from(text, "utf-8");
                await manzxy.sendMessage(m.chat, {
                    document: buf,
                    mimetype: "text/plain",
                    fileName: `memberlist-${meta.subject}.txt`
                }, { quoted: m });
            } else {
                reply(text);
            }

            break;
        }
    }
};

handler.command = ["groupinfo", "ginfo", "infogroup", "memberlist", "listmember"];
handler.tags    = ["group"];
handler.limit    = false;

handler.fitur    = {
    'groupinfo': 'Info lengkap grup',
    'ginfo': 'Info lengkap grup',
    'infogroup': 'Info lengkap grup',
    'memberlist': 'Daftar semua member grup',
    'listmember': 'Daftar semua member grup',
};
module.exports = handler;