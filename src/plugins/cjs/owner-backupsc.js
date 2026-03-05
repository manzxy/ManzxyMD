const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const axios = require("axios");
const FormData = require("form-data");
const { config } = require("../../../config.js");

// FIX: typo Manzxy → manzxy (case-sensitive destructuring)
const handler = async (m, { manzxy, isOwn, reply }) => {
    if (!isOwn) return reply("❌ Owner only.");

    reply("📦 Membuat backup source code...");

    const rootDir = process.cwd();
    const zipName = `backup-${Date.now()}.zip`;
    const zipPath = path.join(rootDir, zipName);

    try {
        // FIX: tunggu archive selesai dulu BARU kirim (pakai Promise bukan event async race)
        await new Promise((resolve, reject) => {
            const output  = fs.createWriteStream(zipPath);
            const archive = archiver("zip", { zlib: { level: 9 } });

            archive.on("error", reject);
            output.on("close", resolve);
            output.on("error", reject);

            archive.pipe(output);
            archive.glob("**/*", {
                cwd: rootDir,
                ignore: [
                    "node_modules/**",
                    "session/**",
                    "backup-*.zip",
                    ".git/**",
                    "database/backup/**"
                ]
            });
            archive.finalize();
        });

        reply("📤 Mengirim ke Telegram...");

        const form = new FormData();
        form.append("chat_id", config.telegram.chat_id);
        form.append("document", fs.createReadStream(zipPath), {
            filename: zipName,
            contentType: "application/zip"
        });

        await axios.post(
            `https://api.telegram.org/bot${config.telegram.token}/sendDocument`,
            form,
            { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity }
        );

        try { fs.unlinkSync(zipPath); } catch {}
        reply("✅ Backup berhasil dikirim ke Telegram.");

    } catch (e) {
        try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {}
        reply("❌ Error backup: " + e.message);
    }
};

handler.command = ["backupsc"];
handler.tags = ["owner"];
handler.limit    = false;
handler.owner = true;

handler.fitur    = {
    'backupsc': 'Backup source code ke Telegram',
};
module.exports = handler;
