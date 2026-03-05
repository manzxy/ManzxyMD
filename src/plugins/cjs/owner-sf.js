const fs = require("fs")
const path = require("path")

const handler = async (m, { text, args, isOwn, reply }) => {

  if (!isOwn) return reply("❌ Owner only!")

  if (!args[0])
    return reply("Format:\n.sf path/namafile.js\n\nReply atau kirim kode.")

  const inputPath = args[0]

  // Ambil kode
  let code = ""

  if (m.quoted && m.quoted.text) {
    code = m.quoted.text
  } else {
    code = m.text.split("\n").slice(1).join("\n")
  }

  if (!code)
    return reply("Tidak ada kode untuk disimpan.")

  try {

    const baseDir = process.cwd()
    const resolvedPath = path.resolve(baseDir, inputPath)

    // Cegah keluar dari root project
    if (!resolvedPath.startsWith(baseDir)) {
      return reply("❌ Path tidak valid.")
    }

    const folder = path.dirname(resolvedPath)

    if (!fs.existsSync(folder))
      fs.mkdirSync(folder, { recursive: true })

    const fileExists = fs.existsSync(resolvedPath)

    // 🔥 OVERWRITE LANGSUNG
    fs.writeFileSync(resolvedPath, code)

    reply(`✅ File berhasil ${fileExists ? "ditimpa (overwrite)" : "dibuat"}!

📁 ${inputPath}
📦 ${(Buffer.byteLength(code) / 1024).toFixed(2)} KB`)

  } catch (err) {
    console.log(err)
    reply("❌ Gagal menyimpan file.")
  }
}

handler.command = ["sf"]
handler.tags = ["owner"]
handler.limit    = false;
handler.owner = true

handler.fitur    = {
    'sf': 'Simpan/edit file server langsung',
};
module.exports = handler