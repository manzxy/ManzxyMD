/* ================= UTIL ================= */

const { getUser } = require('../../lib/database');
const { normalizeNum, extractTarget } = require('../../lib/jid-utils');



const bar = (val, max, len = 10) => {
    const filled = Math.max(0, Math.min(len, Math.round((val / max) * len)));
    return "█".repeat(filled) + "░".repeat(len - filled);
};

const formatReset = (lastReset) => {
    if (!lastReset) return "-";
    const remain = (lastReset + 12 * 3600000) - Date.now();
    if (remain <= 0) return "Segera";
    const h = Math.floor(remain / 3600000);
    const m = Math.floor((remain % 3600000) / 60000);
    return `${h}j ${m}m`;
};

const formatDate = (ms) => {
    if (!ms) return "-";
    return new Date(ms).toLocaleDateString("id-ID", {
        day: "numeric", month: "short", year: "numeric",
        timeZone: "Asia/Jakarta"
    });
};

const expToNextLevel = (level) => level * level * 100;

const getRank = (level) => {
    if (level >= 50) return "👑 Legenda";
    if (level >= 40) return "💎 Mythic";
    if (level >= 30) return "🔱 Epic";
    if (level >= 20) return "⚔️ Elite";
    if (level >= 10) return "🛡️ Veteran";
    if (level >= 5)  return "⚡ Fighter";
    return "🌱 Pemula";
};

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, args, command, reply, isOwn, isAdmin, from, senderJid, participants: _participants = [] }) => {
    switch (command) {

        case "profile":
        case "profil":
        case "me": {

            // Refresh participants untuk resolve LID
            let participants = _participants;
            if (m.isGroup && from) {
                try {
                    const meta = await manzxy.groupMetadata(from);
                    if (meta?.participants?.length) participants = meta.participants;
                } catch {}
            }

            // Tentukan target JID
            let targetJid = extractTarget(m, args, participants);
            const isSelf  = !targetJid;
            if (isSelf) targetJid = senderJid;

            // Kalau lihat profile orang lain — hanya owner/admin
            if (!isSelf && !isOwn && !isAdmin) {
                return reply("❌ Hanya owner/admin yang bisa melihat profile orang lain.");
            }

            // Ambil data user via getUser() — auto-create & merge defaultUser
            const user = getUser(targetJid);

            const num = normalizeNum(targetJid);

            // Ambil nama dari WA
            let userName = num ? `+${num}` : targetJid;
            try {
                const pp = await manzxy.profilePictureUrl(targetJid, "image");
                // Nama dari contact store (kalau ada)
                userName = user.name || userName;
            } catch {}

            // Ambil foto profil
            let ppUrl = null;
            try {
                ppUrl = await manzxy.profilePictureUrl(targetJid, "image");
            } catch {
                ppUrl = null;
            }

            // ── STATUS ──────────────────────────────────────────────
            // Cek owner dari config (bukan hanya isOwn yg hanya cek sender)
            const { config } = require('../../../config.js');
            const fs_         = require('fs');
            const _ownerList  = (() => {
                try { return JSON.parse(fs_.readFileSync('./database/owner.json', 'utf-8')); } catch { return []; }
            })();
            const targetNum_  = normalizeNum(targetJid);
            const isTargetOwn = [...(_ownerList || []), ...(config?.owner || [])]
                .map(n => String(n).replace(/[^0-9]/g, ''))
                .includes(targetNum_);

            const statusLabel =
                isTargetOwn     ? "👑 Owner"   :
                user.premium    ? "💎 Premium" :
                user.banned     ? "🚫 Banned"  :
                "👤 Free";

            // ── LEVEL & EXP ─────────────────────────────────────────
            const level      = user.level || 1;
            const exp        = user.exp   || 0;
            const expNeeded  = expToNextLevel(level);
            const expBar     = bar(exp, expNeeded, 10);
            const rank       = getRank(level);

            // ── LIMIT ───────────────────────────────────────────────
            const limit      = user.limit ?? 0;
            const limitBar   = bar(limit, 20, 10);
            const limitColor = limit <= 3 ? "🔴" : limit <= 10 ? "🟡" : "🟢";
            const resetIn    = formatReset(user.lastLimitReset);

            // ── WARN ────────────────────────────────────────────────
            const warnData   = user.warn || {};
            const totalWarn  = Object.values(warnData).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);
            const warnGroups = Object.keys(warnData).filter(k => warnData[k]?.length > 0).length;

            // ── RPG STATS ───────────────────────────────────────────
            const stats      = user.stats || {};
            const equipment  = user.equipment || {};
            const inventory  = user.inventory || {};
            const invCount   = Object.keys(inventory).length;

            // ── PREMIUM EXPIRY ──────────────────────────────────────
            const premExpiry = user.premiumExpired
                ? (user.premiumExpired === 0 ? "Permanent" : formatDate(user.premiumExpired))
                : null;

            // ── BUILD OUTPUT ────────────────────────────────────────
            let text = "";
            text += `╔══════════════════════╗\n`;
            text += `  👤 *PROFILE USER*\n`;
            text += `╚══════════════════════╝\n\n`;

            // Info dasar
            text += `📋 *INFO*\n`;
            const genderLabel = user.gender === "pria" ? "♂️ Pria" : user.gender === "wanita" ? "♀️ Wanita" : "-";

            text += `  Nama    : ${user.name || userName}\n`;
            text += `  Nomor   : +${num}\n`;
            text += `  Status  : ${statusLabel}\n`;
            if (user.premium && premExpiry) {
                text += `  Expired : ${premExpiry}\n`;
            }
            text += `  Gender  : ${genderLabel}\n`;
            text += `  Umur    : ${user.age ? user.age + " tahun" : "-"}\n`;
            text += `  Daftar  : ${user.registered ? "✅" : "❌"}\n`;
            text += "\n";

            // Level & EXP
            text += `⚔️ *LEVEL & EXP*\n`;
            text += `  Rank    : ${rank}\n`;
            text += `  Level   : ${level}\n`;
            text += `  EXP     : ${expBar} ${exp}/${expNeeded}\n`;
            text += "\n";

            // RPG Stats
            text += `📊 *STATS*\n`;
            text += `  ❤️  HP       : ${user.health ?? 100}/100\n`;
            text += `  💧 Mana     : ${user.mana ?? 50}/50\n`;
            text += `  ⚡ Stamina  : ${user.stamina ?? 100}/100\n`;
            text += `  💰 Uang     : ${(user.money ?? 0).toLocaleString("id-ID")}\n`;
            text += "\n";

            text += `  ⚔️  STR : ${stats.strength ?? 10}\n`;
            text += `  🛡️  DEF : ${stats.defense  ?? 5}\n`;
            text += `  💨 AGI : ${stats.agility   ?? 5}\n`;
            text += "\n";

            // Equipment
            text += `🎽 *EQUIPMENT*\n`;
            text += `  ⚔️  Senjata : ${equipment.weapon || "Tidak ada"}\n`;
            text += `  🛡️  Armor  : ${equipment.armor  || "Tidak ada"}\n`;
            text += "\n";

            // Inventory
            text += `🎒 *INVENTORY*\n`;
            if (invCount === 0) {
                text += `  Kosong\n`;
            } else {
                const items = Object.entries(inventory).slice(0, 5);
                items.forEach(([item, qty]) => {
                    text += `  • ${item}: ${qty}x\n`;
                });
                if (invCount > 5) text += `  _...dan ${invCount - 5} item lainnya_\n`;
            }
            text += "\n";

            // Limit
            text += `🔋 *LIMIT*\n`;
            text += `  ${limitColor} ${limitBar} *${limit}/20*\n`;
            text += `  Reset    : ${resetIn}\n`;
            text += "\n";

            // Warn
            text += `⚠️ *WARN*\n`;
            if (totalWarn === 0) {
                text += `  Bersih ✅\n`;
            } else {
                text += `  Total  : ${totalWarn} warn di ${warnGroups} grup\n`;
            }

            // Kirim dengan foto profil
            if (ppUrl) {
                await manzxy.sendMessage(m.chat, {
                    image: { url: ppUrl },
                    caption: text
                }, { quoted: m });
            } else {
                await manzxy.sendMessage(m.chat, { text }, { quoted: m });
            }

            break;
        }


    }
};

handler.command = ["profile", "profil", "me"];
handler.tags    = ["info"];
handler.limit    = false;

handler.fitur    = {
    'profile': 'Lihat profil pengguna',
    'profil': 'Lihat profil pengguna',
    'me': 'Lihat profil diri sendiri',
};
module.exports = handler;