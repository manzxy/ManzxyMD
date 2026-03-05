const axios = require("axios");
const cheerio = require("cheerio");
const crypto = require("crypto");
const fs = require("fs");
const FormData = require("form-data");
const path = require("path");

const handler = async (m, { manzxy, text, args, isOwn, isPrem, command, reply }) => {

    switch (command) {

        /* ================= NANANA IMG2IMG ================= */

        case "nanana":
        case "img2img": {

            if (!m.quoted || !/image/.test(m.quoted.mimetype || "")) {
                return reply("Reply gambar dengan command:\n.nanana promptnya");
            }

            if (!text) return reply("Masukkan promptnya.");

            const delay = ms => new Promise(res => setTimeout(res, ms));

            function genxfpid() {
                const p1 = crypto.randomBytes(16).toString('hex');
                const p2 = crypto.randomBytes(32).toString('hex');
                return Buffer.from(`${p1}.${p2}`).toString('base64');
            }

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
                'Accept-Language': 'id-ID,id;q=0.9',
                'origin': 'https://nanana.app',
                'referer': 'https://nanana.app/en'
            };

            try {

                reply("⏳ Membuat akun & memproses gambar...");

                /* ========= AUTO AUTH ========= */
                const username = crypto.randomBytes(6).toString('hex');
                const email = `${username}@akunlama.com`;

                await axios.post(
                    'https://nanana.app/api/auth/email-otp/send-verification-otp',
                    { email, type: 'sign-in' },
                    { headers: { ...headers, 'Content-Type': 'application/json' } }
                );

                let mailKey, mailRegion;

                while (true) {
                    const inbox = await axios.get(
                        `https://akunlama.com/api/v1/mail/list?recipient=${username}`
                    );

                    if (Array.isArray(inbox.data) && inbox.data.length > 0) {
                        mailKey = inbox.data[0].storage.key;
                        mailRegion = inbox.data[0].storage.region;
                        break;
                    }

                    await delay(3000);
                }

                const mailHtml = await axios.get(
                    `https://akunlama.com/api/v1/mail/getHtml?region=${mailRegion}&key=${mailKey}`
                );

                const $ = cheerio.load(mailHtml.data);
                const textBody = $('body').text();
                const otp = textBody.match(/\b\d{6}\b/)[0];

                const signin = await axios.post(
                    'https://nanana.app/api/auth/sign-in/email-otp',
                    { email, otp },
                    { headers: { ...headers, 'Content-Type': 'application/json' } }
                );

                const cookie = signin.headers['set-cookie']
                    ?.map(c => c.split(';')[0])
                    .join('; ') || '';

                const authHeaders = {
                    ...headers,
                    'Cookie': cookie,
                    'x-fp-id': genxfpid()
                };

                /* ========= DOWNLOAD IMAGE ========= */
                const media = await m.quoted.download();
                const tempPath = `./database/tmp_${Date.now()}.jpg`;
                fs.writeFileSync(tempPath, media);

                /* ========= UPLOAD ========= */
                const form = new FormData();
                form.append('image', fs.createReadStream(tempPath));

                const upload = await axios.post(
                    'https://nanana.app/api/upload-img',
                    form,
                    { headers: { ...authHeaders, ...form.getHeaders() } }
                );

                const uploadUrl = upload.data.url;

                /* ========= CREATE JOB ========= */
                const job = await axios.post(
                    'https://nanana.app/api/image-to-image',
                    { prompt: text, image_urls: [uploadUrl] },
                    { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
                );

                const jobId = job.data.request_id;

                let result;

                do {
                    await delay(5000);
                    const cek = await axios.post(
                        'https://nanana.app/api/get-result',
                        { requestId: jobId, type: 'image-to-image' },
                        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
                    );
                    result = cek.data;
                } while (!result.completed);

                const finalImg = result.data.images[0].url;

                await manzxy.sendMessage(m.chat, {
                    image: { url: finalImg },
                    caption: "✅ Selesai diproses."
                }, { quoted: m });

                fs.unlinkSync(tempPath);

            } catch (err) {
                console.log(err);
                reply("❌ Gagal memproses.");
            }
        }
        break;

    }
};

handler.command = ["banana", "img2img"];
handler.tags = ["ai"];
handler.limit = true;

handler.fitur    = {
    'banana': 'Generate gambar AI (img2img)',
    'img2img': 'Generate gambar AI dari gambar',
};
module.exports = handler;