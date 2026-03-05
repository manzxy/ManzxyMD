const axios = require("axios");
const cheerio = require("cheerio");

/* ================= CORE ================= */

const reqHeaders = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    Origin: "https://savett.cc",
    Referer: "https://savett.cc/en1/download",
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36"
};

async function getToken() {
    const res = await axios.get("https://savett.cc/en1/download");
    return {
        csrf: res.data.match(/name="csrf_token" value="([^"]+)"/)?.[1],
        cookie: res.headers["set-cookie"].map(v => v.split(";")[0]).join("; ")
    };
}

async function fetchHtml(url, csrf, cookie) {
    const res = await axios.post(
        "https://savett.cc/en1/download",
        `csrf_token=${encodeURIComponent(csrf)}&url=${encodeURIComponent(url)}`,
        { headers: { ...reqHeaders, Cookie: cookie } }
    );
    return res.data;
}

function parseResult(html) {
    const $ = cheerio.load(html);

    const stats = [];
    $("#video-info .my-1 span").each((_, el) => stats.push($(el).text().trim()));

    const data = {
        username: $("#video-info h3").first().text().trim(),
        views: stats[0] || null,
        likes: stats[1] || null,
        comments: stats[3] || null,
        duration: $("#video-info p.text-muted").first().text().replace(/Duration:/i, "").trim() || null,
        type: null,
        downloads: { nowm: [], wm: [] },
        mp3: [],
        slides: []
    };

    const slides = $(".carousel-item[data-data]");

    if (slides.length) {
        data.type = "photo";
        slides.each((_, el) => {
            try {
                const json = JSON.parse($(el).attr("data-data").replace(/&quot;/g, '"'));
                if (Array.isArray(json.URL)) {
                    json.URL.forEach(url => data.slides.push({ index: data.slides.length + 1, url }));
                }
            } catch {}
        });
        return data;
    }

    data.type = "video";

    $("#formatselect option").each((_, el) => {
        const label = $(el).text().toLowerCase();
        const raw = $(el).attr("value");
        if (!raw) return;
        try {
            const json = JSON.parse(raw.replace(/&quot;/g, '"'));
            if (!json.URL) return;
            if (label.includes("mp4") && !label.includes("watermark")) data.downloads.nowm.push(...json.URL);
            if (label.includes("watermark")) data.downloads.wm.push(...json.URL);
            if (label.includes("mp3")) data.mp3.push(...json.URL);
        } catch {}
    });

    return data;
}

async function savett(url) {
    const { csrf, cookie } = await getToken();
    const html = await fetchHtml(url, csrf, cookie);
    return parseResult(html);
}

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, text, command, reply }) => {
    switch (command) {

        case "tiktok":
        case "tt": {

            if (!text) return reply(
                `❌ Masukkan link TikTok.\n\n` +
                `Contoh:\n` +
                `• *${command} https://vt.tiktok.com/xxx*`
            );

            try {
                await reply("⏳ Sedang memproses...");

                const result = await savett(text);
                if (!result) return reply("❌ Gagal mengambil data.");

                const caption =
                    `🎵 *${result.username || "TikTok"}*\n\n` +
                    `👁️ *Views    :* ${result.views || "-"}\n` +
                    `❤️ *Likes    :* ${result.likes || "-"}\n` +
                    `💬 *Comments :* ${result.comments || "-"}\n` +
                    `⏱️ *Durasi   :* ${result.duration || "-"}`;

                // ── PHOTO/SLIDESHOW ──────────────────────────────────
                if (result.type === "photo" && result.slides.length) {
                    await reply(caption);
                    for (const slide of result.slides) {
                        await manzxy.sendMessage(m.chat, {
                            image: { url: slide.url },
                            caption: `📸 Slide ${slide.index}/${result.slides.length}`
                        }, { quoted: m });
                    }
                    break;
                }

                // ── VIDEO ────────────────────────────────────────────
                const videoUrl = result.downloads.nowm[0] || result.downloads.wm[0];
                if (!videoUrl) return reply("❌ Link video tidak ditemukan.");

                await manzxy.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    caption,
                    mimetype: "video/mp4"
                }, { quoted: m });

                // ── AUDIO ────────────────────────────────────────────
                const audioUrl = result.mp3[0];
                if (audioUrl) {
                    await manzxy.sendMessage(m.chat, {
                        audio: { url: audioUrl },
                        mimetype: "audio/mpeg",
                        fileName: `${result.username || "tiktok"}.mp3`
                    }, { quoted: m });
                }

            } catch (err) {
                console.error("[TIKTOK]", err.message);
                reply("❌ Gagal memproses.\nPastikan link benar dan coba lagi.");
            }

            break;
        }
    }
};

handler.command   = ["tiktok", "tt"];
handler.tags      = ["downloader"];
handler.limit     = true;
handler.limitCost = 1;

handler.fitur    = {
    'tiktok': 'Download video TikTok',
    'tt': 'Download video TikTok',
};
module.exports = handler;