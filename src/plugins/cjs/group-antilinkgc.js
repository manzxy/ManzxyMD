/* ================= UTIL ================= */

// normalizeNumber → jid-utils

const resolveNum = (jid, participants = []) => {
    const targetNum = normalizeNum(jid);
    for (const p of participants) {
        const pNum =
            (p.phoneNumber ? normalizeNum(p.phoneNumber) : null) ||
            normalizeNum(p.id);
        if (pNum && pNum === targetNum) return pNum;
    }
    return targetNum;
};

// Deteksi semua jenis link grup WA
const GC_LINK_REGEX = /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/gi;

const containsGCLink = (text) => {
    if (!text) return false;
    return GC_LINK_REGEX.test(text);
};

// Reset lastIndex setelah test()
const hasGCLink = (text) => {
    if (!text) return false;
    GC_LINK_REGEX.lastIndex = 0;
    return GC_LINK_REGEX.test(text);
};

const extractGCLinks = (text) => {
    if (!text) return [];
    GC_LINK_REGEX.lastIndex = 0;
    return text.match(GC_LINK_REGEX) || [];
};

/* ================= WARN HELPER ================= */

const { getGroup } = require('../../lib/database');

const MAX_WARN_GC = 3;

const getGCWarn = (groupJid, userJid) => {
    const gdata = getGroup(groupJid);
    return gdata.antilinkWarn[userJid] || 0;
};

const setGCWarn = (groupJid, userJid, count) => {
    const gdata = getGroup(groupJid);
    if (count <= 0) {
        delete gdata.antilinkWarn[userJid];
    } else {
        gdata.antilinkWarn[userJid] = count;
    }
};

/* ================= LISTENER (dipanggil dari handler utama) ================= */
// Ini berbeda dari command plugin — ini listener pasif yang jalan tiap pesan masuk
// Dipanggil dari: main handler sebelum switch command

const listener = async (m, { manzxy, isAdmin, isOwn, botAdmin = false, from, participants = [] }) => {
    if (!m.isGroup) return;
    if (isAdmin || isOwn) return; // admin & owner bebas kirim link gc

    // Ambil data grup via getGroup() — auto-create dan merge defaultGroup
    const gdata = getGroup(from);
    if (!gdata.antilinkgc || gdata.antilinkgc === "off") return;

    // Ambil teks dari semua jenis pesan
    const text =
        m.body ||
        m.text ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption ||
        m.message?.documentMessage?.caption ||
        "";

    if (!hasGCLink(text)) return;

    const mode      = gdata.antilinkgc; // "delete" | "warn" | "kick"
    const senderJid = m.sender || m.key?.participant || m.key?.remoteJid;
    const senderNum = resolveNum(senderJid, participants);
    const disp      = senderNum ? `+${senderNum}` : senderJid;

    // Hapus pesan
    try {
        await manzxy.sendMessage(from, { delete: m.key });
    } catch (e) {
        console.error("[ANTILINKGC] Gagal hapus pesan:", e.message);
    }

    if (mode === "delete") {
        await manzxy.sendMessage(from, {
            text:
                `🔗 *Anti Link Grup*\n\n` +
                `👤 ${disp} mengirim link grup WA dan telah dihapus.`
        }, { quoted: m });

    } else if (mode === "warn") {
        const prev     = getGCWarn(from, senderJid);
        const newCount = prev + 1;
        setGCWarn(from, senderJid, newCount);

        if (newCount >= MAX_WARN_GC) {
            await manzxy.sendMessage(from, {
                text:
                    `🔗 *Anti Link Grup — WARN ${newCount}/${MAX_WARN_GC}*\n\n` +
                    `👤 ${disp} mengirim link grup WA.\n` +
                    `🚫 Sudah mencapai batas warn, *dikick dari grup!*`
            });
            setGCWarn(from, senderJid, 0);
            if (botAdmin) {
                try {
                    await manzxy.groupParticipantsUpdate(from, [senderJid], "remove");
                } catch (e) {
                    console.error("[ANTILINKGC] Gagal kick:", e.message);
                }
            } else {
                await manzxy.sendMessage(from, { text: "⚠️ Bot bukan admin, tidak bisa kick." });
            }
        } else {
            await manzxy.sendMessage(from, {
                text:
                    `🔗 *Anti Link Grup — WARN ${newCount}/${MAX_WARN_GC}*\n\n` +
                    `👤 ${disp} mengirim link grup WA dan telah dihapus.\n` +
                    `_${MAX_WARN_GC - newCount} warn lagi sebelum dikick._`
            });
        }

    } else if (mode === "kick") {
        if (botAdmin) {
            await manzxy.sendMessage(from, {
                text:
                    `🔗 *Anti Link Grup*\n\n` +
                    `👤 ${disp} mengirim link grup WA.\n` +
                    `🚫 *Dikick dari grup!*`
            });
            try {
                await manzxy.groupParticipantsUpdate(from, [senderJid], "remove");
            } catch (e) {
                console.error("[ANTILINKGC] Gagal kick:", e.message);
            }
        } else {
            await manzxy.sendMessage(from, {
                text:
                    `🔗 *Anti Link Grup*\n\n` +
                    `👤 ${disp} mengirim link grup WA.\n` +
                    `⚠️ Bot bukan admin — tidak bisa kick.\nAktifkan mode *delete* jika bot bukan admin.`
            });
        }
    }
};

/* ================= COMMAND HANDLER ================= */

const handler = async (m, { manzxy, args, command, reply, isAdmin, isOwn, from, participants }) => {
    if (!m.isGroup) return reply("❌ Khusus grup!");
    if (!isAdmin && !isOwn) return reply("❌ Khusus admin grup!");

    const gdata = getGroup(from);

    switch (command) {

        /* ─────────────────────────────────────────
           ANTILINKGC — toggle on/off/mode
        ───────────────────────────────────────── */
        case "antilinkgc": {
            const sub = args[0]?.toLowerCase();

            if (!sub) {
                const cur = gdata.antilinkgc || "off";
                return reply(
                    `🔗 *Anti Link Grup*\n\n` +
                    `Status : *${cur.toUpperCase()}*\n\n` +
                    `Mode tersedia:\n` +
                    `• *.antilinkgc off* — nonaktif\n` +
                    `• *.antilinkgc delete* — hapus pesan saja\n` +
                    `• *.antilinkgc warn* — hapus + warn (kick di warn ke-${MAX_WARN_GC})\n` +
                    `• *.antilinkgc kick* — hapus + langsung kick`
                );
            }

            const valid = ["off", "delete", "warn", "kick"];
            if (!valid.includes(sub)) {
                return reply(
                    `❌ Mode tidak valid.\n\n` +
                    `Pilihan: *off | delete | warn | kick*`
                );
            }

            gdata.antilinkgc = sub;

            const emoji = { off: "❌", delete: "🗑️", warn: "⚠️", kick: "🚫" };
            reply(
                `${emoji[sub]} *Anti Link Grup: ${sub.toUpperCase()}*\n\n` +
                (sub === "off"    ? "Fitur dinonaktifkan." :
                 sub === "delete" ? "Link grup akan dihapus otomatis." :
                 sub === "warn"   ? `Link grup akan dihapus dan diberi warn. Kick otomatis di warn ke-${MAX_WARN_GC}.` :
                 sub === "kick"   ? "Link grup akan dihapus dan pengirim langsung dikick." : "")
            );
            break;
        }

        /* ─────────────────────────────────────────
           RESETWARN ANTILINKGC
        ───────────────────────────────────────── */
        case "resetwarnlinkgc":
        case "resetlinkwarn": {
            if (!gdata.antilinkWarn || !Object.keys(gdata.antilinkWarn).length)
                return reply("📋 Tidak ada warn antilink di grup ini.");

            const count = Object.keys(gdata.antilinkWarn).length;
            gdata.antilinkWarn = {};
            reply(`✅ Semua warn antilink direset.\nTotal dihapus: *${count} user*`);
            break;
        }

        /* ─────────────────────────────────────────
           LIST WARN ANTILINKGC
        ───────────────────────────────────────── */
        case "listwarnlinkgc": {
            const warns   = gdata.antilinkWarn || {};
            const entries = Object.entries(warns).filter(([, v]) => v > 0);

            if (!entries.length) return reply("📋 Tidak ada warn antilink di grup ini.");

            entries.sort((a, b) => b[1] - a[1]);

            let text = `🔗 *Warn Anti Link Grup*\n`;
            text += `Total: *${entries.length} user*\n\n`;

            entries.forEach(([jid, count], i) => {
                const bar = "🟥".repeat(count) + "⬜".repeat(Math.max(0, MAX_WARN_GC - count));
                const num = resolveNum(jid, participants);
                text += `${i + 1}. +${num || jid}\n   ${bar} *${count}/${MAX_WARN_GC}*\n\n`;
            });

            reply(text.trim());
            break;
        }
    }
};

handler.command = ["antilinkgc", "resetwarnlinkgc", "resetlinkwarn", "listwarnlinkgc"];
handler.tags    = ["group"];
handler.limit    = false;

// Export listener juga supaya bisa dipanggil dari handler utama
handler.listener = listener;

handler.fitur    = {
    'antilinkgc': 'Anti link WA grup lain',
    'resetwarnlinkgc': 'Reset warn antilink GC member',
    'listwarnlinkgc': 'Lihat warn antilink GC',
};
module.exports = handler;