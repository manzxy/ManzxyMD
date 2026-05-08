'use strict';

/**
 * info-runtime.js — Runtime & Engine Statistics
 */

const handler = async (m, { reply, isOwn }) => {
    // Memori Stats (Detail)
    const mem = process.memoryUsage();
    const rss = (mem.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(2);
    const external = (mem.external / 1024 / 1024).toFixed(2);
    const arrayBuffer = (mem.arrayBuffers / 1024 / 1024).toFixed(2) || '0.00';

    // Uptime Calculation
    const upSec = Math.floor(process.uptime());
    const d = Math.floor(upSec / 86400);
    const h = Math.floor((upSec % 86400) / 3600);
    const m_ = Math.floor((upSec % 3600) / 60);
    const s = upSec % 60;
    const uptime = `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m_ > 0 ? m_ + 'm ' : ''}${s}s`;

    // Load External Config & Logger
    let configVersion = '2.0';
    let totalErrors = 0;
    
    try {
        const { config } = require('../../../config.js');
        configVersion = config.version || configVersion;
        
        const logger = require('../../core/logger.js');
        totalErrors = Object.values(logger.getErrCount()).reduce((a, b) => a + b, 0);
    } catch (e) {
        // Fallback jika file tidak ditemukan
    }

    let txt = `*〔 RUNTIME MONITOR 〕*\n\n`;
    txt += `⏱️ *Active Time* : ${uptime}\n`;
    txt += `🔴 *Error Logs* : ${totalErrors} Issues\n`;
    txt += `🤖 *Version* : v${configVersion}\n`;
    txt += `🟢 *Engine* : Node ${process.version}\n\n`;

    txt += `*〔 MEMORY ALLOCATION 〕*\n`;
    txt += `💾 *Resident (RSS)* : ${rss} MB\n`;
    txt += `🧠 *Heap (Used)* : ${heapUsed} MB\n`;
    txt += `📊 *Heap (Total)* : ${heapTotal} MB\n`;
    txt += `📦 *External* : ${external} MB\n`;
    txt += `📑 *Buffers* : ${arrayBuffer} MB\n`;

    // Khusus Owner (Session Detail)
    if (isOwn) {
        try {
            const { validateSession } = require('../../lib/sqlite-session.js');
            const sv = validateSession('session/main');
            txt += `\n*〔 SESSION SECURITY 〕*\n`;
            txt += `🔑 *Status* : ${sv.valid ? 'Active ✅' : 'Invalid ❌'}\n`;
            txt += `🔐 *Keys* : ${sv.keyCount ?? '0'} Stored\n`;
        } catch (e) {}
    }

    txt += `\n_© ManzxyMD_`;

    reply(txt);
};

handler.command = ['runtime', 'stats', 'uptime', 'rt'];
handler.tags = ['info'];
handler.limit = false;

handler.fitur = {
    runtime: 'Detail penggunaan memori dan durasi bot aktif',
};

module.exports = handler;