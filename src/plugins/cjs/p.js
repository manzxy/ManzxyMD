// profile-canvas.js
const Jimp = require('jimp');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Asumsi path ke util dan database
const { getUser } = require('../../lib/database');
const { normalizeNum, extractTarget } = require('../../lib/jid-utils');

/* ================= UTIL FUNCTIONS ================= */

const bar = (val, max, len = 10) => {
    const filled = Math.max(0, Math.min(len, Math.round((val / max) * len)));
    return "█".repeat(filled) + "░".repeat(len - filled);
};

const formatReset = (lastReset) => {
    if (!lastReset) return "N/A";
    const remain = (lastReset + 12 * 3600000) - Date.now();
    if (remain <= 0) return "Segera";
    const h = Math.floor(remain / 3600000);
    const m = Math.floor((remain % 3600000) / 60000);
    return `${h}j ${m}m`;
};

const formatDate = (ms) => {
    if (!ms) return "N/A";
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

// Fungsi untuk membuat gambar profil
async function createProfileImage(userData, targetJid, manzxy) {
    const WIDTH = 900;
    const HEIGHT = 600;
    const PADDING = 40;

    // Load custom fonts (pastikan font ada di folder assets/fonts)
    // Contoh: 'sans.fnt' adalah font bitmap default Jimp
    const fontBig    = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall  = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

    // Path ke file background default atau gambar lain
    const defaultBgPath = path.join(__dirname, '../../assets/images/default_profile_bg.png'); // Pastikan ada gambar ini
    let backgroundImage;

    // Coba load background default, jika tidak ada, buat warna solid
    try {
        backgroundImage = await Jimp.read(defaultBgPath);
        backgroundImage.resize(WIDTH, HEIGHT);
        backgroundImage.opacity(0.8); // Sedikit transparan
    } catch (e) {
        console.warn("Default background not found, creating solid background.", e.message);
        backgroundImage = new Jimp(WIDTH, HEIGHT, '#282c34'); // Warna background default
    }

    // Buat gambar utama
    const image = new Jimp(WIDTH, HEIGHT, '#282c34'); // Warna latar belakang default jika tidak ada gambar
    image.composite(backgroundImage, 0, 0); // Gabungkan background ke gambar utama

    // 1. Ambil foto profil
    let ppUrl = null;
    try {
        ppUrl = await manzxy.profilePictureUrl(targetJid, "image");
    } catch {
        ppUrl = "https://i.ibb.co/ryXzW7W/default-pp.jpg"; // URL PP default jika tidak ada
    }

    let avatar;
    try {
        const { data: ppBuffer } = await axios.get(ppUrl, { responseType: 'arraybuffer' });
        avatar = await Jimp.read(ppBuffer);
        avatar.resize(150, 150); // Ukuran avatar
        avatar.circle(); // Bentuk lingkaran
    } catch (e) {
        console.error("Failed to load avatar, using placeholder.", e.message);
        avatar = new Jimp(150, 150, '#cccccc'); // Placeholder avatar abu-abu
        avatar.circle();
    }
    
    // Posisi avatar
    const avatarX = PADDING;
    const avatarY = PADDING;
    image.composite(avatar, avatarX, avatarY);

    // Tambahkan border pada avatar
    const borderSize = 8;
    const borderColor = 0xFFFFFFFF; // Putih
    const avatarBorder = new Jimp(avatar.bitmap.width + borderSize * 2, avatar.bitmap.height + borderSize * 2, borderColor);
    avatarBorder.circle();
    avatarBorder.composite(avatar, borderSize, borderSize);
    image.composite(avatarBorder, avatarX - borderSize, avatarY - borderSize);


    // 2. Nama Pengguna
    const userName = userData.name || `+${normalizeNum(targetJid)}`;
    image.print(fontBig, avatarX + avatar.bitmap.width + PADDING, avatarY + 10, {
        text: userName,
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, WIDTH - (avatarX + avatar.bitmap.width + PADDING * 2), fontBig.options.textHeight);

    // 3. Status (Owner, Premium, Banned, Free)
    const { config } = require('../../../config.js'); // Pastikan path ini benar
    let ownerList = [];
    try {
        const rawOwner = JSON.parse(fs.readFileSync('./database/owner.json', 'utf-8'));
        ownerList = Array.isArray(rawOwner) ? rawOwner : Object.values(rawOwner).filter(v => typeof v === 'string');
    } catch {
        ownerList = [];
    }

    const targetNum = normalizeNum(targetJid).replace(/[^0-9]/g, '');
    const combinedOwners = [...ownerList, ...(config.owner || [])].map(v => String(v).replace(/[^0-9]/g, ''));
    const isTargetOwn = combinedOwners.includes(targetNum);

    let statusText = "";
    let statusColor = Jimp.cssColorToHex("#ffffff"); // Default putih
    if (isTargetOwn) {
        statusText = "👑 Owner";
        statusColor = Jimp.cssColorToHex("#FFD700"); // Emas
    } else if (userData.premium) {
        statusText = "💎 Premium";
        statusColor = Jimp.cssColorToHex("#00BFFF"); // Biru terang
    } else if (userData.banned) {
        statusText = "🚫 Banned";
        statusColor = Jimp.cssColorToHex("#FF4500"); // Oranye merah
    } else {
        statusText = "👤 Free User";
        statusColor = Jimp.cssColorToHex("#90EE90"); // Hijau muda
    }

    // Tulis status di bawah nama
    image.print(fontMedium, avatarX + avatar.bitmap.width + PADDING, avatarY + 10 + fontBig.options.textHeight + 10, {
        text: statusText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, WIDTH - (avatarX + avatar.bitmap.width + PADDING * 2), fontMedium.options.textHeight);
    // Mengubah warna teks status (Jimp tidak langsung support warna per print, harus buat font baru atau pakai mask)
    // Untuk kemudahan, kita anggap font putih, lalu overlay shape warna di bawahnya jika ingin warna-warni

    // --- BARIS KEDUA (Level, EXP, Rank) ---
    const secondRowY = avatarY + avatar.bitmap.height + PADDING * 0.8;
    const level = userData.level || 1;
    const exp = userData.exp || 0;
    const expNeeded = expToNextLevel(level);
    const rank = getRank(level);

    image.print(fontMedium, PADDING, secondRowY, `Level: ${level} (${rank})`, WIDTH - PADDING * 2, fontMedium.options.textHeight);
    
    const expBarWidth = WIDTH - PADDING * 2;
    const expBarHeight = 20;
    const expBarY = secondRowY + fontMedium.options.textHeight + 10;
    
    // Background bar
    image.composite(await new Jimp(expBarWidth, expBarHeight, '#555555'), PADDING, expBarY);
    // Filled bar
    const expProgress = Math.min(1, exp / expNeeded);
    image.composite(await new Jimp(expBarWidth * expProgress, expBarHeight, '#00FF00'), PADDING, expBarY);
    
    image.print(fontSmall, PADDING + 5, expBarY + (expBarHeight - fontSmall.options.textHeight) / 2, `${exp}/${expNeeded} EXP`, expBarWidth - 10, fontSmall.options.textHeight);


    // --- BARIS KETIGA (Limit, Money, Warn) ---
    const thirdRowY = expBarY + expBarHeight + PADDING;

    // Limit
    const limit = userData.limit ?? 0;
    const limitColor = limit <= 3 ? "#FF4500" : limit <= 10 ? "#FFFF00" : "#00FF00";
    image.print(fontMedium, PADDING, thirdRowY, `Limit: ${limit}/20`, WIDTH / 2 - PADDING, fontMedium.options.textHeight);
    image.print(fontSmall, PADDING, thirdRowY + fontMedium.options.textHeight + 5, `Reset: ${formatReset(userData.lastLimitReset)}`, WIDTH / 2 - PADDING, fontSmall.options.textHeight);

    // Money
    image.print(fontMedium, WIDTH / 2 + PADDING, thirdRowY, `💰 Uang: ${(userData.money ?? 0).toLocaleString("id-ID")}`, WIDTH / 2 - PADDING, fontMedium.options.textHeight);

    // Warn
    const warnData = userData.warn || {};
    const totalWarn = Object.values(warnData).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);
    const warnGroups = Object.keys(warnData).filter(k => Array.isArray(warnData[k]) && warnData[k].length > 0).length;
    image.print(fontMedium, PADDING, thirdRowY + fontMedium.options.textHeight * 2 + 10, `⚠️ Warn: ${totalWarn} (${warnGroups} grup)`, WIDTH - PADDING * 2, fontMedium.options.textHeight);


    // --- Kaki (Premium Expired) ---
    if (userData.premium && userData.premiumExpired !== 0) {
        image.print(fontSmall, PADDING, HEIGHT - PADDING - fontSmall.options.textHeight, `Premium Expired: ${formatDate(userData.premiumExpired)}`, WIDTH - PADDING * 2, fontSmall.options.textHeight);
    } else if (userData.premiumExpired === 0) {
        image.print(fontSmall, PADDING, HEIGHT - PADDING - fontSmall.options.textHeight, `Premium: Permanent`, WIDTH - PADDING * 2, fontSmall.options.textHeight);
    }


    return image.getBufferAsync(Jimp.MIME_PNG);
}

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, args, command, reply, isOwn, isAdmin, from, senderJid, participants: _participants = [] }) => {
    switch (command) {
        case "profilecanvas":
        case "pcanvas":
        case "mek": { // 'mek' for me canvas, mirip 'me'
            let participants = _participants;
            if (m.isGroup && from) {
                try {
                    const meta = await manzxy.groupMetadata(from);
                    if (meta?.participants?.length) participants = meta.participants;
                } catch {}
            }

            let targetJid = extractTarget(m, args, participants);
            const isSelf  = !targetJid;
            if (isSelf) targetJid = senderJid;

            if (!isSelf && !isOwn && !isAdmin) {
                return reply("❌ Hanya owner/admin yang bisa melihat profile orang lain.");
            }

            await reply("_Membuat gambar profil, mohon tunggu..._");

            try {
                const user = getUser(targetJid);
                const profileBuffer = await createProfileImage(user, targetJid, manzxy);
                
                await manzxy.sendMessage(m.chat, {
                    image: profileBuffer,
                    caption: `Ini dia profil ${isSelf ? "kamu" : "pengguna"}!`
                }, { quoted: m });

            } catch (error) {
                console.error("[PROFILE_CANVAS_ERROR]", error);
                reply("❌ Gagal membuat gambar profil. Pastikan semua dependensi dan aset tersedia.");
            }
            break;
        }
    }
};

handler.command = ["profilecanvas", "pcanvas", "mek"];
handler.tags    = ["info"];
handler.limit   = false; // Bisa diatur true jika mau pakai limit

handler.fitur = {
    'profilecanvas': 'Lihat profil pengguna dengan tampilan canvas',
    'pcanvas': 'Lihat profil pengguna dengan tampilan canvas',
    'mek': 'Lihat profil diri sendiri dengan tampilan canvas',
};

module.exports = handler;