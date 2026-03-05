/* ============================================================
   ANTILINK PLUGIN
   ============================================================ */

const { getGroup } = require('../../lib/database');

/* ---- Regex ---- */
const REGEX_WA_LINK    = /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i;
const REGEX_GENERAL    = /(?:https?:\/\/|www\.)[^\s]+/gi;
const REGEX_SHORT_LINK = /(?:bit\.ly|tinyurl\.com|s\.id|t\.co|rb\.gy|cutt\.ly)\/[^\s]+/gi;

/* ---- Helpers ---- */
const { normalizeNum } = require('../../lib/jid-utils');

const extractText = (m) => {
    const parts = [];
    if (m.body)    parts.push(m.body);
    if (m.text)    parts.push(m.text);
    if (m.caption) parts.push(m.caption);
    if (m.quoted?.text)    parts.push(m.quoted.text);
    if (m.quoted?.body)    parts.push(m.quoted.body);
    if (m.quoted?.caption) parts.push(m.quoted.caption);
    return parts.join(' ');
};

const containsLink = (text, whitelist = []) => {
    if (!text) return false;
    REGEX_GENERAL.lastIndex    = 0;
    REGEX_SHORT_LINK.lastIndex = 0;

    const allLinks = [
        ...(text.match(REGEX_GENERAL)    || []),
        ...(text.match(REGEX_SHORT_LINK) || []),
    ];

    const nonWhitelisted = allLinks.filter(link =>
        !whitelist.some(d => link.toLowerCase().includes(d.toLowerCase()))
    );

    return REGEX_WA_LINK.test(text) || nonWhitelisted.length > 0;
};

/* ---- Ambil info admin langsung dari groupMetadata ---- */
const getAdminInfo = async (manzxy, chatId) => {
    try {
        const meta         = await manzxy.groupMetadata(chatId);
        const participants = meta.participants || [];

        const getParticipantNum = (p) => {
            if (p.phoneNumber) return normalizeNum(p.phoneNumber);
            return normalizeNum(p.id);
        };

        const botNum = normalizeNum(manzxy.user.id); // strip :deviceId

        const adminParticipants = participants.filter(
            p => p.admin !== null && p.admin !== undefined
        );

        const botAdmin = adminParticipants.some(p => {
            const pNum = getParticipantNum(p);
            return pNum && botNum && pNum === botNum;
        });

        return { participants, adminParticipants, botAdmin };
    } catch (e) {
        console.error('[ANTILINK] getAdminInfo error:', e.message);
        return { participants: [], adminParticipants: [], botAdmin: false };
    }
};

/* ============================================================
   LISTENER — dipanggil tiap pesan masuk di grup
   Tambahkan di handler utama setelah adminonly check:

   const antilinkMod = require("./src/plugins/cjs/antilink.js");
   await antilinkMod.listener(m, { manzxy, isAdmin, isOwn, from });
   ============================================================ */
const listener = async (m, { manzxy, isAdmin, isOwn, botAdmin = false, from }) => {
    try {
        if (!m.isGroup) return;
        if (isAdmin || isOwn) return; // admin & owner bebas

        const chatId    = from || m.chat;
        const groupData = getGroup(chatId);
        const mode      = groupData.antilink || "off";
        if (mode === "off") return;

        const whitelist = groupData.antilinkWhitelist || [];
        const msgText   = extractText(m);
        if (!containsLink(msgText, whitelist)) return;

        // Selalu ambil botAdmin fresh dari groupMetadata pakai phoneNumber
        const { botAdmin } = await getAdminInfo(manzxy, chatId);

        // Sender info
        const senderRaw = m.key.participant || m.sender || '';
        const senderNum = normalizeNum(senderRaw);
        const senderJid = senderRaw.includes('@s.whatsapp.net')
            ? senderRaw
            : senderNum + '@s.whatsapp.net';

        console.log(`[ANTILINK] mode=${mode} | sender=${senderNum} | botAdmin=${botAdmin}`);

        /* ---- Hapus pesan ---- */
        try {
            await manzxy.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: m.key.id,
                    participant: m.key.participant || senderJid
                }
            });
        } catch (e) {
            console.error('[ANTILINK] Gagal hapus pesan:', e.message);
        }

        /* ---- Aksi berdasarkan mode ---- */
        if (mode === "delete") {
            await manzxy.sendMessage(chatId, {
                text: `⚠️ @${senderNum} Pesan mengandung link dan telah dihapus.`,
                mentions: [senderJid]
            });

        } else if (mode === "warn") {
            if (!groupData.antilinkWarn) groupData.antilinkWarn = {};
            groupData.antilinkWarn[senderNum] = (groupData.antilinkWarn[senderNum] || 0) + 1;
            const warnCount = groupData.antilinkWarn[senderNum];
            const maxWarn   = 3;

            if (warnCount >= maxWarn) {
                // Reset warn lalu kick
                groupData.antilinkWarn[senderNum] = 0;

                await manzxy.sendMessage(chatId, {
                    text: `🚫 @${senderNum} Sudah diperingatkan ${maxWarn}x karena kirim link.\n${botAdmin ? 'Member dikick!' : '⚠️ Bot bukan admin, tidak bisa kick.'}`,
                    mentions: [senderJid]
                });

                if (botAdmin) {
                    await manzxy.groupParticipantsUpdate(chatId, [senderJid], "remove")
                        .catch(e => console.error('[ANTILINK] Gagal kick (warn):', e.message));
                }

            } else {
                await manzxy.sendMessage(chatId, {
                    text: `⚠️ @${senderNum} Pesan mengandung link dan telah dihapus.\nPeringatan: ${warnCount}/${maxWarn}`,
                    mentions: [senderJid]
                });
            }

        } else if (mode === "kick") {
            await manzxy.sendMessage(chatId, {
                text: `🚫 @${senderNum} Pesan mengandung link.\n${botAdmin ? 'Member dikick!' : '⚠️ Bot bukan admin, tidak bisa kick.'}`,
                mentions: [senderJid]
            });

            if (botAdmin) {
                await manzxy.groupParticipantsUpdate(chatId, [senderJid], "remove")
                    .catch(e => console.error('[ANTILINK] Gagal kick:', e.message));
            }
        }

    } catch (e) {
        console.error('[ANTILINK LISTENER ERROR]', e.message);
    }
};

/* ============================================================
   COMMAND HANDLER
   ============================================================ */
const handler = async (m, {
    manzxy, text, args, isOwn, command, reply,
    isAdmin, from
}) => {
    if (!m.isGroup) return reply("❌ Fitur ini hanya bisa digunakan di grup.");

    const chatId    = from || m.chat;
    const groupData = getGroup(chatId);

    switch (command) {

        case "antilink": {
            if (!isAdmin && !isOwn)
                return reply("❌ Hanya admin grup yang bisa gunakan fitur ini.");

            if (!args[0]) {
                const status = groupData.antilink || "off";
                const wl     = (groupData.antilinkWhitelist || []).join(', ') || '-';

                // Tampilkan warn counter kalau mode warn
                let warnInfo = '';
                if (status === 'warn' && groupData.antilinkWarn) {
                    const entries = Object.entries(groupData.antilinkWarn)
                        .filter(([, v]) => v > 0);
                    if (entries.length) {
                        warnInfo = '\n\n📋 *Warn aktif:*\n' +
                            entries.map(([num, cnt]) => `• ${num}: ${cnt}/3`).join('\n');
                    }
                }

                return reply(
`⚙️ *Status AntiLink*

Mode     : ${status.toUpperCase()}
Whitelist: ${wl}${warnInfo}

Mode tersedia:
• \`off\`     — nonaktif
• \`delete\`  — hapus pesan saja
• \`warn\`    — hapus + peringatan (kick setelah 3x)
• \`kick\`    — hapus + langsung kick`
                );
            }

            const mode = args[0].toLowerCase();
            if (!['off', 'delete', 'warn', 'kick'].includes(mode))
                return reply("❌ Mode tidak valid.\nGunakan: off / delete / warn / kick");

            groupData.antilink = mode;
            // Reset warn saat ganti mode
            if (mode !== 'warn') groupData.antilinkWarn = {};
            reply(`✅ AntiLink berhasil diset ke *${mode.toUpperCase()}*`);
            break;
        }

        case "antilinkwhitelist":
        case "alwl": {
            if (!isAdmin && !isOwn)
                return reply("❌ Hanya admin grup yang bisa gunakan fitur ini.");

            if (!groupData.antilinkWhitelist) groupData.antilinkWhitelist = [];

            if (!args[0]) {
                const list = groupData.antilinkWhitelist;
                return reply(
`📋 *Whitelist Domain AntiLink*\n\n` +
(list.length ? list.map((d, i) => `${i + 1}. ${d}`).join('\n') : '(kosong)') +
`\n\nGunakan:\n• \`.alwl add youtube.com\`\n• \`.alwl del youtube.com\``
                );
            }

            const sub    = args[0].toLowerCase();
            const domain = args[1];

            if (sub === 'add') {
                if (!domain) return reply("Contoh: .alwl add youtube.com");
                if (groupData.antilinkWhitelist.includes(domain))
                    return reply(`❌ ${domain} sudah ada di whitelist.`);
                groupData.antilinkWhitelist.push(domain);
                reply(`✅ *${domain}* ditambahkan ke whitelist.`);
            } else if (sub === 'del' || sub === 'remove') {
                if (!domain) return reply("Contoh: .alwl del youtube.com");
                const idx = groupData.antilinkWhitelist.indexOf(domain);
                if (idx === -1) return reply(`❌ ${domain} tidak ada di whitelist.`);
                groupData.antilinkWhitelist.splice(idx, 1);
                reply(`✅ *${domain}* dihapus dari whitelist.`);
            } else {
                reply("Sub-command tidak valid.\nGunakan: add / del");
            }
            break;
        }

            }
};

handler.command  = ["antilink", "antilinkwhitelist", "alwl"];
handler.tags     = ["group"];
handler.limit    = false;
handler.listener = listener;

handler.fitur    = {
    'antilink': 'Anti link umum di grup',
    'antilinkwhitelist': 'Whitelist domain dari antilink',
    'alwl': 'Whitelist domain dari antilink',
};
module.exports = handler;