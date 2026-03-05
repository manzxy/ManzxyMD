const { getGroup } = require('../../lib/database')

let handler = async (m, { reply, isAdmin, isOwn, args, command }) => {

    if (!m.isGroup) return reply("❌ Hanya untuk group!")

    if (!isAdmin && !isOwn)
        return reply("❌ Fitur ini hanya untuk admin!")

    const group = getGroup(m.chat)

    // FIX: gunakan args dari handleData — jangan parse m.body manual (bisa crash kalau m.body undefined)
    const input = args[0]?.toLowerCase()

    if (!input) {
        return reply(
`📢 *WELCOME STATUS*

Status : ${group.welcome ? "🟢 Aktif" : "🔴 Nonaktif"}

Gunakan:
.welcome on
.welcome off`
        )
    }

    if (input === "on") {
        group.welcome = true
        return reply("✅ Welcome berhasil diaktifkan!")
    }

    if (input === "off") {
        group.welcome = false
        return reply("❌ Welcome berhasil dimatikan!")
    }

    reply("Gunakan on / off")
}

handler.command = ["welcome"]
handler.tags = ["group"]
handler.limit    = false;
handler.group = true

handler.fitur    = {
    'welcome': 'Aktifkan/nonaktifkan pesan sambutan',
};
module.exports = handler
