/**
 * owner-p.mjs — ESM Plugin Manager (deprecated — unified di CJS owner-p.js)
 * 
 * Semua fungsi plugin manager sekarang ada di .plugin (CJS)
 * yang sudah support CJS + ESM sekaligus.
 * File ini hanya sebagai redirect.
 */
export default async function pluginManagerEsmRedirect(m, { reply }) {
    return reply(
        `ℹ️ *Plugin Manager sudah disatukan!*\n\n` +
        `Gunakan *.plugin* untuk kelola CJS & ESM.\n\n` +
        `• *.plugin list* — semua plugin\n` +
        `• *.plugin + nama.js* — tambah/timpa CJS\n` +
        `• *.plugin + nama.mjs esm* — tambah/timpa ESM\n` +
        `• *.plugin - <nomor> esm* — hapus ESM\n` +
        `• *.plugin ? <nomor> esm* — lihat isi ESM`
    );
}

pluginManagerEsmRedirect.command  = ['pluginesm'];
pluginManagerEsmRedirect.tags     = ['owner'];
pluginManagerEsmRedirect.owner    = true;
pluginManagerEsmRedirect.mainOnly = true;
pluginManagerEsmRedirect.fitur    = {
    'pluginesm': 'Plugin ESM (gunakan .plugin untuk unified)',
};
