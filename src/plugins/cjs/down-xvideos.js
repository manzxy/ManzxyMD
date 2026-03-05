/**
 * down-xvideos.js — Download video Xvideos
 * API: https://api.deline.web.id/downloader/xvideos?url=<link>
 *
 * ⚠️  Fitur dewasa — khusus premium & owner, bisa di grup & PV.
 */
'use strict';

const axios = require('axios');

const API_BASE = 'https://api.deline.web.id/downloader/xvideos';

const isXvideosUrl = (url) =>
    /xvideos\.com\/(video\.|prof-video-click\/)/.test(url || '');

const handler = async (m, { manzxy, args, reply, from, isOwn, isPrem, user }) => {
    const url = args[0];
    if (!url) return reply(
        '❌ Masukkan link Xvideos!\n\n' +
        'Contoh:\n*.xv https://www.xvideos.com/video.xxxxx/judul*'
    );
    if (!isXvideosUrl(url)) return reply(
        '❌ Link tidak valid.\nPastikan link dari *xvideos.com*.'
    );

    await reply('⏳ Mengambil video...');

    let data;
    try {
        const res = await axios.get(API_BASE, {
            params: { url },
            timeout: 20_000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' },
        });

        if (!res.data?.status || !res.data?.result) {
            return reply('❌ Gagal mengambil video. Coba link lain.');
        }
        data = res.data.result;
    } catch (e) {
        return reply(`❌ Error: ${e.message}`);
    }

    const title  = data.title || 'Unknown';
    const thumb  = data.thumb || data.videos?.thumb || '';
    const videos = data.videos?.videos || {};
    const high   = videos.high || '';
    const low    = videos.low  || '';
    const dlUrl  = high || low;

    if (!dlUrl) return reply('❌ Tidak ada link video yang bisa diunduh.');

    const caption =
        `🎬 *${title}*\n\n` +
        `📺 Kualitas: ${high ? '360p (High)' : '240p (Low)'}\n` +
        `🔗 Source: ${data.source || url}`;

    try {
        // Kirim sebagai video langsung
        await manzxy.sendMessage(from, {
            video: { url: dlUrl },
            caption,
            mimetype: 'video/mp4',
        }, { quoted: m });
    } catch {
        // Fallback: kirim link saja jika video terlalu besar
        await reply(
            `${caption}\n\n` +
            `⬇️ *Download langsung:*\n${dlUrl}` +
            (low && low !== dlUrl ? `\n\n📉 *Versi Low:*\n${low}` : '')
        );
    }
};

handler.premium   = true;   // khusus premium
handler.command   = ['xv', 'xvideos', 'xvdl'];
handler.tags      = ['downloader'];
handler.limit     = true;
handler.limitCost = 2;
handler.fitur     = {
    'xv':      'Download video Xvideos (khusus premium)',
    'xvideos': 'Download video Xvideos (khusus premium)',
    'xvdl':    'Download video Xvideos (khusus premium)',
};
module.exports = handler;
