const os = require("os")

let handler = async (m, { manzxy, reply }) => {
    const used = process.memoryUsage()
    const cpus = os.cpus()
    const cpu = cpus[0].model
    const uptime = process.uptime()
    const { runtime } = require("../../core/message.js")

    let teks = `📊 *BOT STATUS*\n\n`
    teks += `💻 *CPU*: ${cpu}\n`
    teks += `📂 *RAM*: ${(used.rss / 1024 / 1024).toFixed(2)} MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n`
    teks += `⏳ *Uptime*: ${runtime(uptime)}\n`
    teks += `🤖 *Mode*: ${manzxy.public ? 'Public' : 'Self'}\n`
    teks += `📱 *Platform*: ${os.platform()} ${os.release()}`

    reply(teks)
}

handler.command = ['status']
handler.tags = ['info']
handler.limit    = false;
handler.fitur    = {
    'status': 'Status sistem: RAM, CPU, uptime',
};
module.exports = handler