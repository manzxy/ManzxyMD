const axios = require("axios");
const qs    = require("qs");

/* ================= CORE ================= */

const HEADERS = {
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "origin": "https://y2date.com",
    "referer": "https://y2date.com/facebook-video-downloader/",
    "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "content-type": "application/x-www-form-urlencoded"
};

async function fbdown(url) {
    const payload = qs.stringify({
        url,
        token: "3ecace38ab99d0aa20f9560f0c9703787d4957d34d2a2d42bfe5b447f397e03c"
    });

    const res = await axios.post(
        "https://y2date.com/wp-json/aio-dl/video-data/",
        payload,
        { headers: HEADERS }
    );

    const data = res.data;

    if (!data || data.error) throw new Error(data?.error || "Gagal mengambil data video.");
    if (!data.medias?.length) throw new Error("Tidak ada media yang ditemukan.");

    // Urutkan: HD dulu, lalu SD, lalu lainnya
    const sorted = data.medias.sort((a, b) => {
        const order = { hd: 0, sd: 1 };
        const aQ = (a.quality || "").toLowerCase();
        const bQ = (b.quality || "").toLowerCase();
        return (order[aQ] ?? 99) - (order[bQ] ?? 99);
    });

    return {
        title:  data.title  || "Facebook Video",
        thumb:  data.thumbnail || null,
        medias: sorted
    };
}

/* ================= HANDLER ================= */

const handler = async (m, { manzxy, text, command, reply, isOwn, isPrem, senderJid, user }) => {
    switch (command) {

        case "fb":
        case "fbdl":
        case "facebook": {

            if (!text) return reply(
                `📥 *Facebook Video Downloader*\n\n` +
                `Penggunaan:\n` +
                `• *${command} <link facebook>*\n\n` +
                `Contoh:\n` +
                `• *.${command} https://www.facebook.com/share/r/xxx*\n` +
                `• *.${command} https://fb.watch/xxx*`
            );

            // Validasi URL
            if (!/facebook\.com|fb\.watch|fb\.com/i.test(text))
                return reply("❌ Link tidak valid. Masukkan link Facebook yang benar.");

            // Limit sudah dicek dan dikurangi oleh handler utama (manzxy.js)

            try {
                await reply("⏳ Sedang mengambil video...");

                const result = await fbdown(text);

                // Cari video HD dulu, fallback ke SD
                const hd = result.medias.find(m => m.quality?.toLowerCase() === "hd");
                const sd = result.medias.find(m => m.quality?.toLowerCase() === "sd");
                const best = hd || sd || result.medias[0];

                if (!best?.url) return reply("❌ Tidak ada video yang bisa diunduh.");

                const caption =
                    `📥 *Facebook Video*\n\n` +
                    `📝 ${result.title}\n` +
                    `📺 Kualitas: ${best.quality?.toUpperCase() || "AUTO"}\n` +
                    (hd && sd ? `_HD & SD tersedia_` : "");

                await manzxy.sendMessage(m.chat, {
                    video: { url: best.url },
                    caption
                }, { quoted: m });

                // Kirim versi SD juga kalau tersedia dan beda dari yang terkirim
                if (hd && sd && best === hd) {
                    await manzxy.sendMessage(m.chat, {
                        video: { url: sd.url },
                        caption: `📥 *${result.title}*\n📺 Kualitas: SD`
                    }, { quoted: m });
                }



            } catch (err) {
                console.error("[FBDL]", err.message);
                reply(`❌ Gagal mengunduh video.\n\n_${err.message}_`);
            }

            break;
        }
    }
};

handler.command   = ["fb", "fbdl", "facebook"];
handler.tags      = ["downloader"];
handler.limit     = true;
handler.limitCost = 1;

handler.fitur    = {
    'fb': 'Download video Facebook',
    'fbdl': 'Download video Facebook',
    'facebook': 'Download video Facebook',
};
module.exports = handler;