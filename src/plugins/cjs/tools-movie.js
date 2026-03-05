/* ============================================================
   MOVIEKU PLUGIN
   Scraper film dari movieku.fit

   Commands:
     .movie <judul>   → Info film + link download rapi
     .film <judul>    → Alias
     .movieku <judul> → Alias

   Contoh:
     .movie naruto
     .film avengers endgame
   ============================================================ */

const axios   = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/* ── Scraper ─────────────────────────────────────────────── */
async function MovieKu(query) {
    const searchRes = await axios.get(
        `https://movieku.fit/?s=${encodeURIComponent(query)}`,
        { headers: HEADERS, timeout: 12000 }
    );
    const $s = cheerio.load(searchRes.data);

    const results = [];
    $s('.los article.box').each((i, el) => {
        const art     = $s(el);
        const link    = art.find('a.tip');
        const title   = link.attr('title') || link.find('h2.entry-title').text().trim();
        const url     = link.attr('href');
        const img     = art.find('img').attr('src');
        const quality = art.find('.quality').text().trim();
        const year    = title.match(/\((\d{4})\)/)?.[1] || '';
        if (title && url) results.push({ title, url, img, quality, year });
    });

    if (!results.length) return null;
    const first = results[0];

    const detailRes = await axios.get(first.url, { headers: HEADERS, timeout: 12000 });
    const $d = cheerio.load(detailRes.data);

    const detail = {
        title:     first.title,
        url:       first.url,
        image:     first.img,
        quality:   first.quality,
        synopsis:  $d('.synops .entry-content p').first().text().trim(),
        genres:    [],
        release:   '',
        duration:  '',
        country:   '',
        rating:    '',
        downloads: [],
        others:    results.slice(1, 5),
    };

    $d('.data li').each((i, el) => {
        const text = $d(el).text();
        if (text.includes('Genre:'))    $d(el).find('a').each((j, a) => detail.genres.push($d(a).text().trim()));
        else if (text.includes('Release:'))  detail.release  = text.replace('Release:', '').trim();
        else if (text.includes('Duration:')) detail.duration = text.replace('Duration:', '').trim();
        else if (text.includes('Country:'))  detail.country  = text.replace('Country:', '').trim();
        else if (text.includes('Rating:'))   detail.rating   = text.replace('Rating:', '').trim();
    });

    $d('#smokeddl .smokeurl p').each((i, el) => {
        const quality = $d(el).find('strong').text().replace(':', '').trim();
        const links   = [];
        $d(el).find('a').each((j, a) => {
            const provider = $d(a).text().trim();
            const url      = $d(a).attr('href');
            if (provider && url) links.push({ provider, url });
        });
        if (quality && links.length) detail.downloads.push({ quality, links });
    });

    return detail;
}

/* ── Provider icon ───────────────────────────────────────── */
function providerIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('mega'))       return '☁️';
    if (n.includes('mediafire'))  return '🔥';
    if (n.includes('google'))     return '🔵';
    if (n.includes('uptobox'))    return '📦';
    if (n.includes('acefile'))    return '📁';
    if (n.includes('gdrive'))     return '🔵';
    if (n.includes('zippyshare')) return '🗜️';
    return '🔗';
}

/* ── Format pesan ────────────────────────────────────────── */
function formatMessage(d) {
    let txt = `🎬 *${d.title}*\n`;
    txt += '─'.repeat(32) + '\n';
    if (d.rating)        txt += `⭐ Rating   : *${d.rating}*\n`;
    if (d.quality)       txt += `📺 Kualitas : *${d.quality}*\n`;
    if (d.release)       txt += `📅 Rilis    : ${d.release}\n`;
    if (d.duration)      txt += `⏱️  Durasi   : ${d.duration}\n`;
    if (d.country)       txt += `🌏 Negara   : ${d.country}\n`;
    if (d.genres.length) txt += `🎭 Genre    : ${d.genres.join(', ')}\n`;

    if (d.synopsis) {
        const syn = d.synopsis.length > 300
            ? d.synopsis.slice(0, 300) + '...'
            : d.synopsis;
        txt += `\n📝 *Sinopsis*\n${syn}\n`;
    }

    if (d.downloads.length) {
        txt += `\n📥 *Link Download*\n`;
        for (const dl of d.downloads) {
            txt += `\n┌ *${dl.quality}*\n`;
            dl.links.forEach((l, i) => {
                const icon   = providerIcon(l.provider);
                const prefix = i === dl.links.length - 1 ? '└' : '├';
                txt += `${prefix} ${icon} ${l.provider}\n  ${l.url}\n`;
            });
        }
    } else {
        txt += `\n_Tidak ada link download tersedia._\n`;
    }

    if (d.others?.length) {
        txt += `\n🔍 *Hasil Pencarian Lain:*\n`;
        d.others.forEach((r, i) => {
            txt += `${i + 1}. ${r.title}${r.year ? ' (' + r.year + ')' : ''} — ${r.quality}\n`;
        });
    }

    txt += `\n🌐 ${d.url}`;
    return txt;
}

/* ── Handler ─────────────────────────────────────────────── */
const handler = async (m, { args, reply, manzxy, from }) => {
    const query = args.join(' ').trim();
    if (!query) return reply('❓ Masukkan judul film.\nContoh: *.movie avengers*');

    await manzxy.sendMessage(from, { text: `🔍 Mencari *${query}*...` }, { quoted: m });

    let detail;
    try {
        detail = await MovieKu(query);
    } catch (e) {
        return reply(`❌ Gagal: ${e.message}`);
    }

    if (!detail) return reply(`❌ Film *${query}* tidak ditemukan.`);

    const text = formatMessage(detail);

    // Kirim dengan poster sebagai thumbnail (jpegThumbnail)
    if (detail.image) {
        try {
            const imgBuf = await axios.get(detail.image, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: HEADERS,
            });
            const thumb = Buffer.from(imgBuf.data);
            await manzxy.sendMessage(from, {
                text,
                contextInfo: {
                    externalAdReply: {
                        title:           detail.title,
                        body:            detail.quality || 'MovieKu',
                        thumbnailUrl:    detail.image,
                        mediaType:       1,
                        renderLargerThumbnail: true,
                        showAdAttribution: false,
                    }
                }
            }, { quoted: m });
            return;
        } catch {}
    }

    await manzxy.sendMessage(from, { text }, { quoted: m });
};

handler.command = ['movie', 'film', 'movieku'];
handler.tags    = ['downloader'];
handler.limit   = true;

handler.fitur    = {
    'movie': 'Cari info film & series',
    'film': 'Cari info film & series',
    'movieku': 'Cari info film & series',
};
module.exports = handler;