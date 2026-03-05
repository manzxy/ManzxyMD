const axios = require("axios");
const { zencf } = require("zencf");

/* ================= CORE ================= */

const HEADERS = {
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
    "content-type": "application/json",
    origin: "https://spotidownloader.com",
    referer: "https://spotidownloader.com/"
};

async function getToken() {
    const { token } = await zencf.turnstileMin(
        "https://spotidownloader.com/en13",
        "0x4AAAAAAA8QAiFfE5GuBRRS"
    );
    const res = await axios.post(
        "https://api.spotidownloader.com/session",
        { token },
        { headers: HEADERS }
    );
    return res.data.token;
}

async function searchSpotify(query, bearer) {
    const res = await axios.post(
        "https://api.spotidownloader.com/search",
        { query },
        { headers: { ...HEADERS, authorization: `Bearer ${bearer}` } }
    );
    return res.data;
}

async function dlSpotify(id, bearer) {
    const res = await axios.post(
        "https://api.spotidownloader.com/download",
        { id },
        { headers: { ...HEADERS, authorization: `Bearer ${bearer}` } }
    );

    const audio = await axios.get(res.data.link, {
        responseType: "arraybuffer",
        headers: {
            "user-agent": HEADERS["user-agent"],
            authorization: `Bearer ${bearer}`,
            origin: HEADERS.origin,
            referer: HEADERS.referer
        }
    });

    return {
        buffer: Buffer.from(audio.data),
        info: res.data
    };
}

async function spotify(input) {
    const bearer = await getToken();

    // Link spotify
    if (/spotify\.com\/track\//i.test(input)) {
        const id = input.split("/track/")[1].split("?")[0];
        return { type: "download", ...(await dlSpotify(id, bearer)) };
    }

    // ID langsung (22 karakter alphanumeric)
    if (/^[a-zA-Z0-9]{22}$/.test(input)) {
        return { type: "download", ...(await dlSpotify(input, bearer)) };
    }

    // Search query
    const results = await searchSpotify(input, bearer);
    return { type: "search", results };
}

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, text, args, command, reply, isOwn, isPrem, senderJid, user }) => {
    switch (command) {

        case "spotify":
        case "spoti": {

            if (!text) return reply(
                `🎵 *Spotify Downloader*\n\n` +
                `Penggunaan:\n` +
                `• *${command} <judul lagu>* — cari & download\n` +
                `• *${command} <link spotify>* — download langsung\n\n` +
                `Contoh:\n` +
                `• *.${command} Night Changes One Direction*\n` +
                `• *.${command} https://open.spotify.com/track/xxx*`
            );

            // Limit sudah dicek dan dikurangi oleh handler utama (manzxy.js)

            try {
                await reply("⏳ Sedang memproses...");

                const result = await spotify(text);

                // ── Hasil pencarian ──────────────────────────────────
                if (result.type === "search") {
                    const items = result.results?.tracks?.items || result.results?.items || [];

                    if (!items.length) return reply("❌ Lagu tidak ditemukan.");

                    // Ambil 5 hasil teratas
                    const top5 = items.slice(0, 5);
                    let listText = `🎵 *Hasil Pencarian Spotify*\n\n`;

                    top5.forEach((item, i) => {
                        const name    = item.name || "Unknown";
                        const artists = item.artists?.map(a => a.name).join(", ") || "Unknown";
                        const id      = item.id || "";
                        listText += `${i + 1}. *${name}*\n   👤 ${artists}\n   🆔 \`${id}\`\n\n`;
                    });

                    listText += `_Gunakan ID atau link untuk download_\nContoh: *.${command} ${top5[0]?.id || "ID_LAGU"}*`;
                    return reply(listText);
                }

                // ── Download berhasil ────────────────────────────────
                const { buffer, info } = result;

                if (!buffer || !buffer.length) return reply("❌ Gagal mengunduh audio.");

                const title   = info?.title   || info?.name   || "Unknown Title";
                const artist  = info?.artist  || info?.artists?.map(a => a.name).join(", ") || "Unknown Artist";
                const album   = info?.album   || "";
                const duration = info?.duration ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}` : "";

                const caption =
                    `🎵 *${title}*\n` +
                    `👤 ${artist}\n` +
                    (album    ? `💿 ${album}\n`    : "") +
                    (duration ? `⏱️ ${duration}\n` : "");

                await manzxy.sendMessage(m.chat, {
                    audio: { stream: require("stream").Readable.from(buffer) },
                    mimetype: "audio/mpeg",
                    fileName: `${title} - ${artist}.mp3`,
                    caption
                }, { quoted: m });

                // Notif sisa limit


            } catch (err) {
                console.error("[SPOTIFY]", err.message);
                reply(`❌ Gagal memproses.\n\n_${err.message}_`);
            }

            break;
        }
    }
};

handler.command   = ["spotify", "spoti"];
handler.tags      = ["downloader"];
handler.limit     = true;
handler.limitCost = 1;

handler.fitur    = {
    'spotify': 'Download lagu Spotify',
    'spoti': 'Download lagu Spotify',
};
module.exports = handler;