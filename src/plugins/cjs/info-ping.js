/* ================= HANDLER ================= */

const handler = async (m, { manzxy, reply }) => {
    const start = Date.now();

    const sent = await manzxy.sendMessage(m.chat, {
        text: "🏓 Pinging..."
    }, { quoted: m });

    const ping = Date.now() - start;

    const uptime  = process.uptime();
    const hours   = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const text =
        `🏓 *Pong!*\n\n` +
        `📶 *Ping    :* ${ping}ms\n` +
        `⏱️ *Uptime  :* ${hours}j ${minutes}m ${seconds}d\n` +
        `🤖 *Status  :* Online ✅`;

    await manzxy.sendMessage(m.chat, {
        text,
        edit: sent.key
    });
};

handler.command = ["ping", "speed", "cek"];
handler.tags    = ["info"];
handler.limit    = false;
handler.help    = ["ping"];

handler.fitur    = {
    'ping': 'Cek latency & uptime bot',
    'speed': 'Cek latency & uptime bot',
    'cek': 'Cek latency & uptime bot',
};
module.exports = handler;