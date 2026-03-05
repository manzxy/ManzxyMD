const axios = require("axios");

/* ================= CORE ================= */

function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|embed|watch|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?]|$)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function resolveId(input) {
    const direct = extractYouTubeId(input);
    if (direct) return direct;

    const res = await axios.get(
        `https://test.flvto.online/search/?q=${encodeURIComponent(input)}`,
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
                origin: "https://v5.ytmp4.is",
                referer: "https://v5.ytmp4.is/"
            }
        }
    );

    if (!res.data?.items?.length) throw new Error("Tidak ada hasil ditemukan.");
    return res.data.items[0].id;
}

async function ytDownload(input, format = "mp4") {
    const youtube_id = await resolveId(input);
    if (!youtube_id) throw new Error("Link atau judul tidak valid.");

    const res = await axios.post(
        "https://ht.flvto.online/converter",
        { id: youtube_id, fileType: format },
        {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
                "Content-Type": "application/json",
                origin: "https://ht.flvto.online",
                referer: `https://ht.flvto.online/button?url=https://www.youtube.com/watch?v=${youtube_id}&fileType=${format}`
            }
        }
    );

    const data = res.data;

    if (format === "mp3") {
        return {
            type: "mp3",
            title: data.title,
            duration: data.duration,
            filesize: data.filesize,
            download: data.link
        };
    }

    if (format === "mp4") {
        if (!Array.isArray(data.formats) || !data.formats.length)
            throw new Error("Format video tidak tersedia.");

        const sorted   = data.formats.sort((a, b) => b.height - a.height);
        const selected = sorted.find(v => v.qualityLabel === "720p") || sorted[0];

        return {
            type: "mp4",
            title: data.title,
            quality: selected.qualityLabel,
            download: selected.url
        };
    }

    throw new Error("Format tidak dikenal: " + format);
}

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, text, args, command, reply, isOwn, isPrem, senderJid, user }) => {
    switch (command) {

        case "ytmp3":
        case "ytmp4":
        case "yt": {

            if (!text) return reply(
                `❌ Masukkan judul atau link YouTube.\n\n` +
                `Contoh:\n` +
                `• *${command} Faded Alan Walker*\n` +
                `• *${command} https://youtu.be/xxx*`
            );



            // Tentukan format
            const format =
                command === "ytmp3" ? "mp3" :
                command === "ytmp4" ? "mp4" :
                (args[0]?.toLowerCase() === "mp3" ? "mp3" : "mp4");

            // Potong arg format dari query kalau pakai command yt
            const query = (command === "yt" && ["mp3", "mp4"].includes(args[0]?.toLowerCase()))
                ? args.slice(1).join(" ")
                : text;

            if (!query) return reply("❌ Masukkan judul atau link setelah format.\nContoh: *.yt mp3 Faded*");

            try {
                await reply("⏳ Sedang memproses...");

                const result = await ytDownload(query, format);
                if (!result) return reply("❌ Gagal mengambil data.");

                if (result.type === "mp3") {
                    await manzxy.sendMessage(m.chat, {
                        audio: { url: result.download },
                        mimetype: "audio/mpeg",
                        fileName: `${result.title}.mp3`
                    }, { quoted: m });

                } else {
                    await manzxy.sendMessage(m.chat, {
                        video: { url: result.download },
                        caption: `🎬 *${result.title}*\n📺 Kualitas: ${result.quality}`,
                        fileName: `${result.title}.mp4`
                    }, { quoted: m });
                }



            } catch (err) {
                console.error("[YT DOWN]", err.message);
                reply("❌ Gagal memproses.\nPastikan link/judul benar dan coba lagi.");
            }

            break;
        }
    }
};

handler.command   = ["ytmp3", "ytmp4", "yt"];
handler.tags      = ["downloader"];
handler.limit     = true;
handler.limitCost = 1;

handler.fitur    = {
    'ytmp3': 'Download audio YouTube',
    'ytmp4': 'Download video YouTube',
    'yt': 'Download YouTube (video/audio)',
};
module.exports = handler;