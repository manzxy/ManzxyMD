/* ================= UTIL ================= */

const normalizeNumber = (input) => {
    if (!input) return null;
    let num = String(input).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
    if (!num) return null;
    if (num.startsWith("0"))   num = "62" + num.slice(1);
    if (!num.startsWith("62")) num = "62" + num;
    return num;
};

const generateSN = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let sn = "LGR-";
    for (let i = 0; i < 6; i++) sn += chars[Math.floor(Math.random() * chars.length)];
    return sn;
};

const generateUniqueSN = () => {
    const allUsers = global.db?.users || {};
    const usedSNs  = new Set(Object.values(allUsers).map(u => u.sn).filter(Boolean));
    let sn;
    do { sn = generateSN(); } while (usedSNs.has(sn));
    return sn;
};

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, args, command, reply, senderJid }) => {
    const db   = require('../../lib/database');
    const user = db.getUser(senderJid);

    switch (command) {

        /* ─────────────────────────────────────────
           DAFTAR — registrasi: nama | umur | gender
        ───────────────────────────────────────── */
        case "daftar":
        case "register": {

            if (user.registered) {
                return reply(
                    `✅ *Kamu sudah terdaftar!*\n\n` +
                    `👤 Nama  : ${user.name}\n` +
                    `🎂 Umur  : ${user.age} tahun\n` +
                    `📱 Nomor : +${normalizeNumber(senderJid)}\n` +
                    `🔑 SN    : ${user.sn || "-"}\n\n` +
                    `_Gunakan .setname untuk ganti nama_\n` +
                    `_Gunakan .setumur untuk ganti umur_\n` +
                    `_Gunakan .ceksn untuk lihat SN_`
                );
            }

            // Format: .daftar <nama>|<umur>|<gender>
            const rawInput = args.join(" ").trim();

            if (!rawInput) {
                return reply(
                    `📋 *PENDAFTARAN BOT*\n\n` +
                    `Format:\n` +
                    `*.daftar <nama>|<umur>|<gender>*\n\n` +
                    `Contoh:\n` +
                    `*.daftar YogiriMD|20|pria*\n\n` +
                    `📌 Ketentuan:\n` +
                    `• Nama  : 3-25 karakter\n` +
                    `• Umur  : angka (5-100)\n` +
                    `• Gender: pria / wanita`
                );
            }

            const parts  = rawInput.split("|").map(s => s.trim());
            const nama   = parts[0] || "";
            const ageStr = parts[1] || "";
            const gender = (parts[2] || "").toLowerCase();

            // Validasi nama
            if (!nama || nama.length < 3)  return reply("❌ Nama terlalu pendek, minimal 3 karakter.");
            if (nama.length > 25)          return reply("❌ Nama terlalu panjang, maksimal 25 karakter.");
            if (/[<>{}[\]\\/]/.test(nama)) return reply("❌ Nama mengandung karakter yang tidak diizinkan.");

            // Validasi umur
            const age = parseInt(ageStr);
            if (!ageStr || isNaN(age))  return reply("❌ Masukkan umur yang valid.\nContoh: *.daftar Nama|20|pria*");
            if (age < 5 || age > 100)   return reply("❌ Umur harus antara 5 sampai 100 tahun.");

            // Validasi gender
            const validGender = ["pria", "wanita", "laki", "laki-laki", "perempuan", "cewek", "cowok"];
            if (!validGender.includes(gender)) {
                return reply("❌ Gender tidak valid.\nGunakan: *pria* atau *wanita*");
            }
            const genderNorm = ["pria", "laki", "laki-laki", "cowok"].includes(gender) ? "pria" : "wanita";

            // Generate SN
            const sn  = generateUniqueSN();
            const num = normalizeNumber(senderJid);

            // Simpan ke database — user adalah referensi ke global.db.users[senderJid]
            user.registered = true;
            user.name       = nama;
            user.age        = age;
            user.gender     = genderNorm;
            user.sn         = sn;

            // Foto profil
            let ppUrl = null;
            try { ppUrl = await manzxy.profilePictureUrl(senderJid, "image"); } catch {}

            const genderEmoji = genderNorm === "pria" ? "♂️" : "♀️";

            const text =
                `🎉 *Pendaftaran Berhasil!*\n\n` +
                `👤 Nama    : *${nama}*\n` +
                `${genderEmoji} Gender  : ${genderNorm}\n` +
                `🎂 Umur    : *${age} tahun*\n` +
                `📱 Nomor   : +${num}\n` +
                `🔑 SN      : *${sn}*\n\n` +
                `⚠️ *Simpan SN kamu!*\n` +
                `SN dibutuhkan untuk *.unreg* jika ingin hapus registrasi.\n\n` +
                `Ketik *.menu* untuk melihat daftar fitur.`;

            if (ppUrl) {
                await manzxy.sendMessage(m.chat, { image: { url: ppUrl }, caption: text }, { quoted: m });
            } else {
                await manzxy.sendMessage(m.chat, { text }, { quoted: m });
            }

            // Kirim SN via DM kalau di grup
            if (m.isGroup) {
                try {
                    await manzxy.sendMessage(senderJid, {
                        text:
                            `🔑 *Serial Number (SN) kamu*\n\n` +
                            `*${sn}*\n\n` +
                            `Simpan SN ini! Dibutuhkan untuk *.unreg*.`
                    });
                } catch {}
            }

            console.log(`[DAFTAR] +${num} → "${nama}" | Umur: ${age} | Gender: ${genderNorm} | SN: ${sn}`);
            break;
        }

        /* ─────────────────────────────────────────
           CEKSN — lihat SN sendiri (via DM)
        ───────────────────────────────────────── */
        case "ceksn":
        case "mysn": {
            if (!user.registered) return reply(
                "❌ Kamu belum terdaftar.\nGunakan *.daftar* untuk mendaftar."
            );

            if (!user.sn) user.sn = generateUniqueSN();

            try {
                await manzxy.sendMessage(senderJid, {
                    text:
                        `🔑 *Serial Number (SN) kamu*\n\n` +
                        `*${user.sn}*\n\n` +
                        `Jangan bagikan SN ini ke siapapun!\n` +
                        `Gunakan *.unreg <SN>* untuk hapus registrasi.`
                });
                if (m.isGroup) reply("🔑 SN sudah dikirim ke DM kamu.");
            } catch {
                reply(
                    `🔑 *Serial Number (SN) kamu*\n\n` +
                    `*${user.sn}*\n\n` +
                    `Jangan bagikan SN ini ke siapapun!`
                );
            }
            break;
        }

        /* ─────────────────────────────────────────
           SETNAME — ganti nama
        ───────────────────────────────────────── */
        case "setname": {
            if (!user.registered) return reply(
                "❌ Kamu belum terdaftar.\nGunakan *.daftar* terlebih dahulu."
            );

            const nama = args.join(" ").trim();
            if (!nama)             return reply("❌ Masukkan nama baru.\nContoh: *.setname YogiriMD*");
            if (nama.length < 3)   return reply("❌ Nama minimal 3 karakter.");
            if (nama.length > 25)  return reply("❌ Nama maksimal 25 karakter.");
            if (/[<>{}[\]\\/]/.test(nama)) return reply("❌ Nama mengandung karakter yang tidak diizinkan.");

            const oldName = user.name;
            user.name = nama;

            reply(`✅ *Nama diubah!*\n\nSebelum : ${oldName}\nSesudah : *${nama}*`);
            break;
        }

        /* ─────────────────────────────────────────
           SETUMUR — update umur
        ───────────────────────────────────────── */
        case "setumur": {
            if (!user.registered) return reply(
                "❌ Kamu belum terdaftar.\nGunakan *.daftar* terlebih dahulu."
            );

            const age = parseInt(args[0]);
            if (!args[0] || isNaN(age)) return reply("❌ Masukkan umur.\nContoh: *.setumur 20*");
            if (age < 5 || age > 100)   return reply("❌ Umur harus antara 5-100 tahun.");

            const oldAge = user.age;
            user.age = age;

            reply(`✅ *Umur diubah!*\n\nSebelum : ${oldAge} tahun\nSesudah : *${age} tahun*`);
            break;
        }

        /* ─────────────────────────────────────────
           UNREG — hapus registrasi pakai SN
        ───────────────────────────────────────── */
        case "unreg":
        case "unregister": {
            if (!user.registered) return reply("❌ Kamu belum terdaftar.");

            const inputSN = args[0]?.toUpperCase().trim();
            if (!inputSN) return reply(
                `❌ Masukkan SN kamu.\n\n` +
                `Format: *.unreg <SN>*\n` +
                `Contoh: *.unreg LGR-ABC123*\n\n` +
                `_Lihat SN dengan *.ceksn*_`
            );

            if (!user.sn) {
                user.sn = generateUniqueSN();
                return reply(
                    `⚠️ Kamu belum punya SN.\n\n` +
                    `SN baru kamu: *${user.sn}*\n\n` +
                    `Gunakan SN ini untuk *.unreg <SN>*`
                );
            }

            if (inputSN !== user.sn) {
                return reply(`❌ *SN salah!*\n\nGunakan *.ceksn* untuk melihat SN kamu.`);
            }

            const oldName = user.name || "-";
            user.registered = false;
            user.name       = "";
            user.sn         = "";
            user.age        = 0;
            user.gender     = "";

            reply(
                `✅ *Registrasi berhasil dihapus.*\n\n` +
                `Nama lama : ${oldName}\n\n` +
                `_Daftar lagi dengan *.daftar*_`
            );
            break;
        }
    }
};

handler.command = ["daftar", "register", "ceksn", "mysn", "setname", "setumur", "unreg", "unregister"];
handler.tags    = ["info"];
handler.limit    = false;

handler.fitur    = {
    'daftar': 'Daftar akun baru',
    'register': 'Daftar akun baru',
    'ceksn': 'Lihat serial number akun',
    'mysn': 'Lihat serial number akun',
    'setname': 'Ganti nama profil',
    'setumur': 'Ganti umur profil',
    'unreg': 'Hapus registrasi akun',
    'unregister': 'Hapus registrasi akun',
};
module.exports = handler;