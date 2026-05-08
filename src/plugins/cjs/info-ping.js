'use strict';

/**
 * info-ping.js — Enhanced Status & Speed Test
 */

const os = require('os');

const handler = async (m, { manzxy }) => {
    const t0 = Date.now();
    
    // Kirim pesan awal (loading)
    const { key } = await manzxy.sendMessage(m.chat, { text: '🚀 _Calculating system performance..._' }, { quoted: m });
    
    const ping = Date.now() - t0;

    // Statistik Memory
    const mem = process.memoryUsage();
    const rss = (mem.rss / 1024 / 1024).toFixed(2);
    const heap = (mem.heapUsed / 1024 / 1024).toFixed(2);
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

    // Statistik Uptime
    const upSec = Math.floor(process.uptime());
    const h = Math.floor(upSec / 3600);
    const mn = Math.floor((upSec % 3600) / 60);
    const s = upSec % 60;
    const uptime = `${h}h ${mn}m ${s}s`;

    // Informasi OS & Hardware
    const cpu = os.cpus()[0].model;
    const platform = os.platform();
    const arch = os.arch();

    // Status WebSocket & Mode
    const ws = manzxy.ws;
    const wsLabel = ws ? (['🔄 Connecting', '✅ Connected', '⚠️ Closing', '❌ Disconnected'][ws.readyState] || '?') : 'Offline';
    const mode = manzxy.public ? 'Public' : 'Self';

    // Indikator Latency
    const speedIcon = ping < 150 ? '🟢' : ping < 400 ? '🟡' : '🔴';
    const speedNote = ping < 150 ? 'Excellent' : ping < 400 ? 'Good' : 'Poor';

    // Build Response Text
    let txt = `*〔 SYSTEM DASHBOARD 〕*\n\n`;
    txt += `📡 *Network Speed* : ${ping} ms ${speedIcon}\n`;
    txt += `📶 *Quality* : ${speedNote}\n`;
    txt += `⏱️ *Uptime* : ${uptime}\n`;
    txt += `🤖 *Bot Mode* : ${mode}\n`;
    txt += `🌐 *Socket* : ${wsLabel}\n\n`;
    
    txt += `*〔 HARDWARE INFO 〕*\n`;
    txt += `⚙️ *CPU* : ${cpu}\n`;
    txt += `🖥️ *OS* : ${platform} (${arch})\n`;
    txt += `💾 *RAM Usage* : ${rss} MB / ${heap} MB\n`;
    txt += `📊 *Server RAM* : ${freeMem}GB Free / ${totalMem}GB Total\n\n`;
    
    txt += `*〔 ENVIRONMENT 〕*\n`;
    txt += `📦 *Node JS* : ${process.version}\n`;
    txt += `🛠️ *Platform* : ${os.type()} ${os.release()}\n\n`;
    txt += `_@ ManzxyMD_`;

    // Update pesan ke hasil final
    await manzxy.sendMessage(m.chat, { text: txt, edit: key });
};

handler.command = ['ping', 'speed', 'latency', 'p'];
handler.tags = ['info'];
handler.limit = false;

handler.fitur = {
    ping: 'Monitoring kecepatan server dan detail resource bot',
};

module.exports = handler;