/* ================= UTIL ================= */

const normalizeNumber = (input) => {
    if (!input) return null;
    let num = String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
    if (!num) return null;
    if (num.startsWith("0"))   num = "62" + num.slice(1);
    if (!num.startsWith("62")) num = "62" + num;
    return num;
};

const formatReset = (lastReset) => {
    if (!lastReset) return "Tidak diketahui";
    const next   = lastReset + 12 * 60 * 60 * 1000;
    const remain = next - Date.now();
    if (remain <= 0) return "Segera";
    const h = Math.floor(remain / 3600000);
    const m = Math.floor((remain % 3600000) / 60000);
    return `${h} jam ${m} menit`;
};

const bar = (val, max, len = 10) => {
    const filled = Math.max(0, Math.min(len, Math.round((val / max) * len)));
    return "█".repeat(filled) + "░".repeat(len - filled);
};

/* ================= HANDLER ================= */

const { getUser } = require('../../lib/database');

// FIX: tambah isPrem dari handleData (mencakup premium.json + DB)
const handler = async (m, { reply, isOwn, isPrem, senderJid }) => {
    const user = getUser(senderJid);

    const DEFAULT_LIMIT = 20;
    const lim = user.limit ?? 0;

    // FIX: gunakan isPrem dari handler (sudah cek premium.json + DB + config.owner)
    // bukan hanya user.premium dari DB saja
    const isPremium = isPrem || user.premium || false;
    const expiredAt = user.premiumExpired || 0;

    const progress = bar(lim, DEFAULT_LIMIT);

    const expLabel = !expiredAt
        ? "Permanent"
        : new Date(expiredAt).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
            timeZone: "Asia/Jakarta"
        });

    let text = `┌─────────────────────\n`;
    text += `│ 📊 *INFO LIMIT*\n`;
    text += `├─────────────────────\n`;
    text += `│ 👤 : +${normalizeNumber(senderJid)}\n`;
    text += `│ 💎 Status : ${
        isOwn ? "👑 Owner"
        : isPremium ? "💎 Premium"
        : "👤 Free"
    }\n`;

    if (isPremium && !isOwn) {
        text += `│ 📅 Expired: ${expLabel}\n`;
    }

    text += `├─────────────────────\n`;

    if (isOwn || isPremium) {
        text += `│ 🔋 Limit  : ∞ *Unlimited*\n`;
        text += `│ ℹ️  Kamu bebas menggunakan\n`;
        text += `│    semua fitur tanpa batas!\n`;
    } else {
        const warna = lim <= 3 ? "🔴" : lim <= 10 ? "🟡" : "🟢";
        text += `│ 🔋 Limit  : ${warna} ${progress} *${lim}/${DEFAULT_LIMIT}*\n`;
        text += `│ ⏱️  Reset  : ${formatReset(user.lastLimitReset)}\n`;
        text += `├─────────────────────\n`;
        text += `│ 💡 *Tips*\n`;

        if (lim <= 5) {
            text += `│ Limit kamu hampir habis!\n`;
            text += `│ Tunggu reset tiap 12 jam.\n`;
        } else {
            text += `│ Gunakan limit dengan bijak.\n`;
            text += `│ Reset otomatis tiap 12 jam.\n`;
        }
    }

    text += `└─────────────────────`;

    reply(text);
};

handler.command = ["limit", "mylimit", "ceklimit"];
handler.tags    = ["info"];
handler.limit    = false;

handler.fitur    = {
    'limit': 'Cek sisa limit command',
    'mylimit': 'Cek sisa limit command',
    'ceklimit': 'Cek sisa limit command',
};
module.exports = handler;
