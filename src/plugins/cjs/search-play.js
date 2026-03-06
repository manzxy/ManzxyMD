const yts = require("yt-search");

/* ================= CORE ================= */

const API_BASE = "https://a.ymcdn.org";

const reqHeaders = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.0",
    "Accept": "application/json",
    "Referer": "https://ytmp3.mobi/en8/"
};

async function convert(url, format = "mp3") {
    const id = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (!id) throw new Error("Invalid URL");

    const rnd = () => Math.random();

    const initRes = await fetch(`${API_BASE}/api/v1/init?p=y&23=1llum1n471&_=${rnd()}`, { headers: reqHeaders });
    const { convertURL } = await initRes.json();

    const startRes = await fetch(`${convertURL}&v=${id}&f=${format}&_=${rnd()}`, { headers: reqHeaders });
    let data = await startRes.json();

    if (data.redirect) {
        const redirRes = await fetch(`${data.redirectURL}&v=${id}&f=${format}&_=${rnd()}`, { headers: reqHeaders });
        data = await redirRes.json();
    }

    while (true) {
        const statusRes = await fetch(data.progressURL, { headers: reqHeaders });
        const status = await statusRes.json();

        if (status.error) throw new Error(status.error);
        if (status.progress >= 3) return { title: status.title, url: data.downloadURL };

        await new Promise(r => setTimeout(r, 1000));
    }
}

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, text, command, reply }) => {
    switch (command) {

        case "play":
        case "ytplay": {

            if (!text) return reply(
                `❌ Masukkan judul atau link YouTube.\n\n` +
                `Contoh:\n` +
                `• *${command} Faded Alan Walker*\n` +
                `• *${command} https://youtu.be/xxx*`
            );

            try {
                await reply("⏳ Sedang mencari...");

                const r = await yts(text);
                const v = r.videos[0];
                if (!v) return reply("❌ Tidak ada hasil ditemukan.");

                const caption =
                    `🎵 *${v.title}*\n\n` +
                    `👤 *Author :* ${v.author.name}\n` +
                    `👁️ *Views :* ${v.views}\n` +
                    `⏱️ *Durasi :* ${v.timestamp}\n` +
                    `🔗 *Link :* ${v.url}\n\n` +
                    `> Mengirim audio...`;

                await manzxy.sendMessage(m.chat, {
                    image: { url: v.thumbnail },
                    caption
                }, { quoted: m });

                const result = await convert(v.url, "mp3");

                await manzxy.sendMessage(m.chat, {
                    audio: { url: result.url },
                    mimetype: "audio/mpeg",
                    fileName: `${result.title || v.title}.mp3`
                }, { quoted: m });

            } catch (err) {
                console.error("[PLAY]", err.message);
                reply("❌ Gagal memproses.\nPastikan judul benar dan coba lagi.");
            }

            break;
        }
    }
};

handler.command   = ["play", "ytplay"];
handler.tags      = ["downloader"];
handler.limit     = true;
handler.limitCost = 1;

handler.fitur    = {
    'play': 'Cari & download musik YouTube',
    'ytplay': 'Cari & download musik YouTube',
};
module.exports = handler;