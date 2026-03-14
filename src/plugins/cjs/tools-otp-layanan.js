'use strict';
/* ════════════════════════════════════════════════════════════════
   tools-otp-layanan.js  —  Daftar & Cari Layanan OTP

   Commands:
     .layanan                     → semua layanan (15/hal)
     .layanan <halaman>           → langsung ke halaman
     .layanan cari <nama>         → cari by nama
     .layanan negara <kode>       → negara + harga + stok
     .layanan negara <kode> <hal> → halaman negara
     .layanan info <kode>         → detail + top 5 termurah
     .srv / .services             → alias
════════════════════════════════════════════════════════════════ */

const {
    getSaldo, fmtRp, api, errMsg,
    stokBadge, LINE,
} = require('../../lib/otp-config');

// ──────────────────────────────────────────────────────────────
//  KONSTANTA
// ──────────────────────────────────────────────────────────────
const PER    = 15;            // item per halaman
const CACHE  = 10 * 60_000;  // cache layanan 10 menit

// ──────────────────────────────────────────────────────────────
//  CACHE LAYANAN
// ──────────────────────────────────────────────────────────────
let _svc = null, _svcAt = 0;

async function getServices() {
    if (_svc && Date.now() - _svcAt < CACHE) return _svc;
    const r = await api.getServices();
    if (!r?.data?.success) throw new Error(r?.data?.error?.message || 'Gagal ambil layanan');
    _svc   = r.data.data;
    _svcAt = Date.now();
    return _svc;
}

// ──────────────────────────────────────────────────────────────
//  PAGINATION
// ──────────────────────────────────────────────────────────────
function page(arr, p, per = PER) {
    const total = arr.length;
    const pages = Math.max(1, Math.ceil(total / per));
    p = Math.max(1, Math.min(p || 1, pages));
    return { items: arr.slice((p - 1) * per, p * per), p, pages, total };
}

// ──────────────────────────────────────────────────────────────
//  RENDER HELPERS
// ──────────────────────────────────────────────────────────────
function renderList({ items, p, pages, total }) {
    let t =
        `📱 *DAFTAR LAYANAN OTP*\n` +
        `${LINE}\n` +
        `📄 Hal ${p}/${pages}  •  Total ${total} layanan\n\n`;
    for (const s of items)
        t += `▸ \`[${String(s.service_code).padStart(3, ' ')}]\` ${s.service_name}\n`;
    t +=
        `\n${LINE}\n` +
        `📄 Hal lain   : \`.layanan <hal>\`\n` +
        `🔍 Cari        : \`.layanan cari <nama>\`\n` +
        `🌍 Negara      : \`.layanan negara <kode>\`\n` +
        `ℹ️  Detail      : \`.layanan info <kode>\``;
    return t;
}

function renderSearch(kw, found) {
    if (!found.length) return (
        `🔍 *Hasil: "${kw}"*\n\n❌ Tidak ditemukan.\n\n` +
        `Lihat semua: \`.layanan\``
    );
    let t =
        `🔍 *Hasil: "${kw}"*\n` +
        `${LINE}\n` +
        `✅ ${found.length} layanan ditemukan\n\n`;
    for (const s of found.slice(0, 25))
        t += `▸ \`[${String(s.service_code).padStart(3, ' ')}]\` ${s.service_name}\n`;
    if (found.length > 25) t += `\n_...dan ${found.length - 25} lainnya_\n`;
    t += `\n${LINE}\n🌍 Pilih negara: \`.layanan negara <kode>\``;
    return t;
}

function renderNegara(svcName, { items, p, pages, total }, svcId) {
    let t =
        `🌍 *NEGARA — ${svcName}*\n` +
        `${LINE}\n` +
        `📄 Hal ${p}/${pages}  •  ${total} negara\n\n`;
    for (const c of items) {
        const best  = c.pricelist?.[0];
        const harga = best?.price_format || fmtRp(best?.price || 0);
        const stok  = c.stock_total ?? 0;
        t +=
            `${stokBadge(stok)} *${c.name}* (${c.prefix})\n` +
            `   💰 ${harga}  📦 Stok: ${stok}\n` +
            `   🔢 \`num_id: ${c.number_id}\`  \`prov_id: ${best?.provider_id || '-'}\`\n\n`;
    }
    t +=
        `${LINE}\n` +
        (pages > 1 ? `📄 Hal lain  : \`.layanan negara ${svcId} <hal>\`\n` : '') +
        `📡 Operator  : \`.operator <negara> <prov_id>\`\n` +
        `🛒 Beli      : \`.beli <num_id> <prov_id>\`\n\n` +
        `🟢 >50 stok   🟡 10-50   🔴 1-9   ⬛ habis`;
    return t;
}

function renderInfo(svc, countries) {
    const avail = countries.filter(c => (c.stock_total ?? 0) > 0);
    const top5  = [...avail]
        .sort((a, b) => (a.pricelist?.[0]?.price ?? 9999) - (b.pricelist?.[0]?.price ?? 9999))
        .slice(0, 5);

    let t =
        `📱 *${svc.service_name}*\n` +
        `${LINE}\n` +
        `🔢 Kode       : \`${svc.service_code}\`\n` +
        `🌍 Total Negara: ${countries.length}\n` +
        `✅ Ada Stok    : ${avail.length} negara\n` +
        `❌ Stok Habis  : ${countries.length - avail.length} negara\n\n`;

    if (top5.length) {
        t += `💰 *Top 5 Termurah:*\n`;
        top5.forEach((c, i) => {
            const best = c.pricelist?.[0];
            t +=
                `   ${i + 1}. *${c.name}* — ${best?.price_format || fmtRp(best?.price || 0)}\n` +
                `      📦 Stok ${c.stock_total}  •  \`num_id: ${c.number_id}\`  \`prov_id: ${best?.provider_id || '-'}\`\n`;
        });
    }

    t +=
        `\n${LINE}\n` +
        `🌍 Lihat semua : \`.layanan negara ${svc.service_code}\`\n` +
        `🛒 Beli        : \`.beli <num_id> <prov_id>\``;
    return t;
}

// ──────────────────────────────────────────────────────────────
//  HANDLER
// ──────────────────────────────────────────────────────────────
const handler = async (m, { args, reply, senderJid }) => {
    const sub  = (args[0] || '').toLowerCase().trim();
    const arg1 = args[1] || '';
    const arg2 = args[2] || '';

    // ── .layanan cari <nama> ──────────────────────────────────
    if (sub === 'cari' || sub === 'search' || sub === 'find') {
        const kw = args.slice(1).join(' ').toLowerCase().trim();
        if (!kw) return reply(`❌ Masukkan kata kunci.\nContoh: \`.layanan cari whatsapp\``);

        await reply(`🔍 Mencari "${kw}"...`);
        let svcs;
        try { svcs = await getServices(); }
        catch (e) { return reply(`❌ ${errMsg(e)}`); }

        return reply(renderSearch(kw, svcs.filter(s =>
            s.service_name.toLowerCase().includes(kw)
        )));
    }

    // ── .layanan negara <kode> [hal] ──────────────────────────
    if (sub === 'negara' || sub === 'country' || sub === 'countries') {
        const svcId = parseInt(arg1, 10);
        if (!svcId) return reply(
            `❌ Masukkan kode layanan.\nContoh: \`.layanan negara 1\`\n\nCari kode: \`.layanan cari <nama>\``
        );

        await reply('⏳ Mengambil daftar negara...');

        let svcName = `Layanan #${svcId}`;
        try {
            const svcs = await getServices();
            svcName    = svcs.find(s => s.service_code === svcId)?.service_name || svcName;
        } catch {}

        let countries;
        try { countries = (await api.getCountries(svcId)).data?.data; }
        catch (e) { return reply(`❌ ${errMsg(e)}`); }

        if (!countries?.length) return reply(
            `❌ Tidak ada negara tersedia untuk *${svcName}*.\n\nCoba layanan lain.`
        );

        const hal = Math.max(1, parseInt(arg2 || '1', 10) || 1);
        return reply(renderNegara(svcName, page(countries, hal), svcId));
    }

    // ── .layanan info <kode> ──────────────────────────────────
    if (sub === 'info' || sub === 'detail') {
        const svcId = parseInt(arg1, 10);
        if (!svcId) return reply(`❌ Masukkan kode layanan.\nContoh: \`.layanan info 1\``);

        await reply('⏳ Mengambil info...');
        let svc, countries;
        try {
            const svcs = await getServices();
            svc        = svcs.find(s => s.service_code === svcId);
            countries  = (await api.getCountries(svcId)).data?.data || [];
        } catch (e) { return reply(`❌ ${errMsg(e)}`); }

        if (!svc) return reply(`❌ Layanan kode \`${svcId}\` tidak ditemukan.`);
        return reply(renderInfo(svc, countries));
    }

    // ── .layanan [hal] — daftar semua ─────────────────────────
    await reply('⏳ Mengambil daftar layanan...');
    let svcs;
    try { svcs = await getServices(); }
    catch (e) { return reply(`❌ ${errMsg(e)}`); }

    // .layanan 2  atau  .layanan list 2
    const pArg = sub === 'list' || sub === 'daftar'
        ? parseInt(arg1, 10)
        : parseInt(sub, 10);

    return reply(renderList(page(svcs, pArg > 0 ? pArg : 1)));
};

// ──────────────────────────────────────────────────────────────
//  METADATA
// ──────────────────────────────────────────────────────────────
handler.command = ['layanan', 'srv', 'services'];
handler.tags    = ['rumahotp'];
handler.limit   = false;
handler.fitur   = {
    'layanan':  'Daftar layanan OTP | .layanan cari <nama>',
    'srv':      'Alias .layanan',
    'services': 'Alias .layanan',
};

module.exports = handler;
