'use strict';

const axios = require('axios');

const API_KEY = '4160c5602a948bf2a31712c9b134daf12c48acc74fd630167fbd88f6e60bb3b6'; // ganti disini

const handler = async (m, { text, reply }) => {
    if (!text) return reply('❌ masukkan url / hash');

    try {
        const res = await axios.get(
            `https://www.virustotal.com/api/v3/urls/${Buffer.from(text).toString('base64')}`,
            {
                headers: {
                    'x-apikey': API_KEY
                }
            }
        );

        const data = res.data.data.attributes.last_analysis_stats;

        reply(
`🔍 *VirusTotal Result*

🟢 Harmless : ${data.harmless}
⚠ Suspicious : ${data.suspicious}
🔴 Malicious : ${data.malicious}
❌ Undetected : ${data.undetected}`
        );

    } catch (e) {
        reply('❌ gagal cek, pastikan api key valid');
    }
};

handler.command = ['vt', 'virustotal'];
handler.tags = ['tools'];
handler.limit = true;

module.exports = handler;