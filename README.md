
<div align="center">

<img src="https://c.termai.cc/a160/RfVQey8.jpg" width="180" style="border-radius:50%"/>

# 🤖 ManzxyMD — WhatsApp Bot

**Bot WhatsApp berbasis [Baileys](https://github.com/WhiskeySockets/Baileys)**  
Recode dari [LingerBase](https://github.com/WJayadana/LingerBase) dengan banyak peningkatan

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-Latest-blue)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

</div>

---

## 📋 Daftar Isi

- [Tentang](#tentang)
- [Fitur Utama](#fitur-utama)
- [Persyaratan](#persyaratan)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Cara Login](#cara-login)
- [Struktur Folder](#struktur-folder)
- [Daftar Command](#daftar-command)
- [Sistem Plugin](#sistem-plugin)
- [Sistem Database](#sistem-database)
- [Fitur JadiBot](#fitur-jadibot)
- [Group Scheduler](#group-scheduler)
- [Membuat Plugin](#membuat-plugin)
- [FAQ / Troubleshooting](#faq--troubleshooting)

---

## 📖 Tentang

MT2 adalah WhatsApp Bot yang dikembangkan ulang (recode) dari **[LingerBase](https://github.com/WJayadana/LingerBase)** oleh WJayadana. Recode ini menambahkan banyak fitur dan perbaikan seperti:

- 🚀 **Zero delay** — pesan diproses langsung tanpa antrian
- 🔌 **Dual plugin system** — support CJS (`.js`) & ESM (`.mjs`)
- 💾 **Database JSON** yang kuat dengan auto-save & backup
- 🤖 **JadiBot** — fitur sub-bot dari nomor lain
- 🔒 **Limit system** — berlaku untuk semua role (CJS & ESM)
- 🛡️ **Fitur grup lengkap** — warn, mute, antilink, welcome, dsb

---

## ✨ Fitur Utama

### 🤖 Core Bot
| Fitur | Keterangan |
|---|---|
| Login Pairing Code | Login tanpa scan QR, cukup masukkan kode 8 digit |
| Login QR Code | Scan QR di terminal (konfigurasi `loginMethod: "qr"`) |
| Auto Reconnect | Reconnect otomatis dengan exponential backoff (max 10x) |
| Zero Delay | Pesan diproses dengan `setImmediate` — tidak ada delay buatan |
| Dual Plugin | Support plugin CJS (`.js`) dan ESM (`.mjs`) dalam 1 bot |
| Auto Hot-reload | File plugin di-watch otomatis, reload tanpa restart bot |
| Group Meta Cache | Cache metadata grup 60 detik agar tidak spam API |
| Anti-spam | Cooldown 3 detik per user (bisa diubah) |

### 🏠 Fitur Grup
| Command | Keterangan |
|---|---|
| `.welcome on/off` | Aktifkan pesan sambutan member baru |
| `.setwelcome <teks>` | Custom teks welcome dengan variabel |
| `.setleave <teks>` | Custom teks goodbye |
| `.mute / .unmute` | Buat bot diam di grup (hanya admin yang bisa pakai) |
| `.adminonly on/off` | Hanya admin yang bisa pakai bot di grup |
| `.setinfo on/off` | Lock/unlock edit info grup |
| `.setname <nama>` | Ubah nama grup |
| `.setdesc <deskripsi>` | Ubah deskripsi grup |
| `.setlink` | Tampilkan link undangan grup |
| `.resetlink` | Reset link undangan grup |
| `.warn @member` | Beri peringatan member (auto kick setelah max warn) |
| `.getwarn [@member]` | Lihat daftar warn (semua atau spesifik) |
| `.resetwarn @member` | Reset warn member |
| `.maxwarn <angka>` | Set batas warn sebelum dikick |
| `.antitoxic on/off` | Aktifkan filter kata toxic |
| `.antilinkgc off/delete/warn/kick` | Mode penanganan link grup WA lain |
| `.ephemeral off/1d/7d/90d` | Pesan menghilang otomatis |
| `.promote @member` | Jadikan member sebagai admin |
| `.demote @admin` | Copot admin dari grup |
| `.kickall` | Kick semua member non-admin (owner only) |
| `.groupsetting` | Tampilkan ringkasan semua setelan grup |
| `.tagall` | Tag semua member |
| `.hidetag` | Tag semua member tersembunyi |
| `.kick @member` | Keluarkan member dari grup |
| `.add <nomor>` | Tambahkan member ke grup |
| `.closegc / .opengc` | Kunci/buka akses kirim pesan |
| `.groupinfo` | Info detail grup |
| `.memberlist` | Daftar semua member |
| `.antilink on/off/warn/kick` | Mode antilink umum |
| `.schedule add <jam> <aksi>` | Tambah jadwal otomatis (buka/tutup/mute/dll) |
| `.schedule list` | Lihat semua jadwal grup |
| `.schedule del <no>` | Hapus jadwal |
| `.schedule test <no>` | Uji coba jadwal sekarang |

### 🤖 Fitur JadiBot
| Command | Keterangan |
|---|---|
| `.jadibot <nomor> pairing` | Jadikan nomor lain sebagai bot (via pairing code) |
| `.jadibot <nomor> qr` | Jadikan nomor lain sebagai bot (via QR image) |
| `.myjadibots` | Lihat bot milik kamu sendiri |
| `.listjadibot` | Lihat semua sub-bot aktif *(owner only)* |
| `.stopjadibot <nomor>` | Hentikan sub-bot milikmu & hapus session |

**Batas slot JadiBot:**
| Role | Maks Bot | Keterangan |
|---|---|---|
| 👤 Free | 2 bot | User biasa |
| 💎 Premium | 5 bot | User premium |
| 👑 Owner | Unlimited | Tidak ada batasan |
| 🌐 Global | 20 bot | Total semua user digabung |

### 👑 Fitur Owner
| Command | Keterangan |
|---|---|
| `.public / .self` | Ubah mode bot |
| `.addowner <nomor>` | Tambah owner |
| `.delowner <nomor>` | Hapus owner |
| `.addprem <nomor>` | Tambah user premium |
| `.delprem <nomor>` | Hapus user premium |
| `.ban <nomor>` | Ban user |
| `.unban <nomor>` | Unban user |
| `.sf <path>` | Save/overwrite file plugin |
| `.backupsc` | Backup source code ke Telegram |
| `>` / `=>` | Eval JavaScript (owner only) |
| `$` | Execute shell command (owner only) |

### 📊 Fitur Info & Tools
| Command | Keterangan |
|---|---|
| `.limit` | Cek sisa limit kamu |
| `.mode` | Status mode bot |
| `.ping` | Ping bot |
| `.totalfitur` | Total semua command di bot |
| `.daftar <nama>` | Registrasi akun di bot |
| `.profile` | Lihat profil kamu |
| `.q <teks>` | Buat pesan quote |
| `.toimg` | Konversi sticker ke gambar |
| `.s` | Buat sticker dari gambar/video |
| `.listwarn` | Lihat warn di grup |

### 🔍 Fitur Search & Download
| Command | Keterangan |
|---|---|
| `.tiktok <link>` | Download video TikTok |
| `.yt <link>` | Download YouTube |
| `.fb <link>` | Download Facebook |
| `.spotify <judul>` | Download lagu Spotify |
| `.play <judul>` | Cari & play musik |

### 🤖 Fitur AI
| Command | Keterangan |
|---|---|
| `.ai` / `.banana` | AI chat |
| `.sora` | AI image generation |

---

## ⚙️ Persyaratan

- **Node.js** v18 atau lebih baru
- **npm** v8+
- Koneksi internet stabil
- Nomor WhatsApp aktif (untuk bot)

---

## 🚀 Instalasi

```bash
# Clone atau download source code
git clone https://github.com/manzxy/MaznxyMD.git
cd ManzxyMD

# Install dependencies
npm install

# Jalankan bot
npm start
# atau
node index.js
```

---

## ⚙️ Konfigurasi

Edit file **`config.js`**:

```js
const config = {
    // PREFIX command bot (bisa array atau string)
    prefa: [".", "#", "!"],

    // Nomor owner bot (format: 628xxx tanpa @s.whatsapp.net)
    owner: ['628xxxxxxxxxx'],

    // Nama bot
    nameBot: "NamaBot",

    // Nama owner (untuk display)
    nameOwn: "NamaOwner",

    // Gambar thumbnail (URL)
    thumbnail: "https://example.com/foto.jpg",

    // Backup Telegram (opsional)
    telegram: {
        token: "TOKEN_BOT_TELEGRAM",
        chat_id: "CHAT_ID_TELEGRAM"
    }
};

const init = {
    // Folder penyimpanan session WhatsApp
    session: "./session",

    // Custom pair ID (bebas diisi apa saja)
    customPair: "BOTKU123",

    // Metode login: "pairing" (default) atau "qr"
    loginMethod: "pairing"
};
```

---

## 🔐 Cara Login

### Metode 1: Pairing Code (Rekomendasi)
```bash
node index.js
# Bot akan minta nomor HP
# Masukkan nomor format: 628xxxxxxxxxx
# Kode 8 digit akan muncul di terminal
# Buka WhatsApp → Perangkat Tertaut → Tautkan dengan Nomor Telepon
# Masukkan kode
```

### Metode 2: QR Code
1. Ubah di `config.js`: `loginMethod: "qr"`
2. Jalankan `node index.js`
3. QR muncul di terminal — scan dengan WhatsApp

---

## 📁 Struktur Folder

```
ManzxyMD/
├── index.js              ← Entry point, koneksi WhatsApp
├── manzxy.js             ← Handler utama (limit, cooldown, routing)
├── config.js             ← Konfigurasi bot
├── package.json
│
├── src/
│   ├── core/
│   │   ├── message.js    ← Helper fungsi (smsg, getBuffer, dsb)
│   │   ├── media.js      ← Handler media (download, convert)
│   │   └── logger.js     ← Logger terminal bergaya
│   │
│   ├── lib/
│   │   ├── database.js   ← Database JSON (users, groups, settings)
│   │   ├── handler.js    ← Loader & router plugin CJS
│   │   ├── handle.mjs    ← Loader & router plugin ESM
│   │   ├── system.js     ← Fungsi sistem
│   │   └── exif.js       ← Konversi gambar ke sticker (WebP)
│   │
│   └── plugins/
│       ├── cjs/          ← Plugin format CommonJS (.js)
│       │   ├── group.js
│       │   ├── group-extra.js   ← Fitur grup lengkap
│       │   ├── group-welcome.js
│       │   ├── group-antilink.js
│       │   ├── group-antilinkgc.js
│       │   ├── main-limit.js
│       │   ├── main-daftar.js
│       │   ├── owner-add.js
│       │   ├── owner-jadibot.js ← Fitur jadibot
│       │   ├── owner-mode.js
│       │   ├── owner-sf.js
│       │   ├── owner-backupsc.js
│       │   └── ...
│       │
│       └── esm/          ← Plugin format ES Module (.mjs)
│           ├── info.mjs
│           ├── info-mode.mjs
│           ├── down-tiktok.mjs
│           ├── search-play.mjs
│           └── ...
│
├── database/
│   ├── database.json     ← Data users & groups
│   ├── owner.json        ← Daftar nomor owner
│   ├── premium.json      ← Daftar nomor premium
│   └── backup/           ← Backup otomatis setiap 6 jam
│
├── session/              ← Session WhatsApp (jangan di-share!)
│   ├── creds.json
│   ├── jadibot_628xxx/   ← Session sub-bot (jadibot)
│   └── ...
│
└── temp/                 ← File sementara (auto dibersihkan)
```

---

## 🗄️ Sistem Database

Database disimpan di `database/database.json`. Auto-save setiap 30 detik dan backup setiap 6 jam.

### Struktur Data User
```json
{
  "628xxx@s.whatsapp.net": {
    "limit": 20,
    "premium": false,
    "premiumExpired": 0,
    "banned": false,
    "registered": false,
    "name": "",
    "sn": "LGR-XXXXXX",
    "lastclaim": 0,
    "money": 1000,
    "health": 100,
    "exp": 0,
    "level": 1,
    "lastLimitReset": 1700000000000,
    "warn": {}
  }
}
```

### Struktur Data Grup
```json
{
  "120363xxx@g.us": {
    "welcome": false,
    "welcomeMessage": "",
    "leaveMessage": "",
    "antilink": "off",
    "antilinkgc": "off",
    "mute": false,
    "setinfo": false,
    "adminonly": false,
    "antiToxic": false,
    "warns": {},
    "maxWarn": 3,
    "ephemeral": 0,
    "schedule": {
      "jobs": [
        {
          "id": 1700000000000,
          "time": "22:0",
          "action": "close",
          "days": [],
          "enabled": true,
          "addedBy": "628xxx@s.whatsapp.net",
          "addedAt": 1700000000000
        }
      ]
    }
  }
}
```

> **Field `schedule.jobs[].action`**: `close` | `open` | `lockinfo` | `unlockinfo` | `mute` | `unmute`
> **Field `schedule.jobs[].days`**: Array angka hari `[0-6]` (0=Minggu). Kosong = semua hari.

### Variabel Welcome/Leave
| Variabel | Keterangan |
|---|---|
| `@user` | Mention member baru/keluar |
| `@group` | Nama grup |
| `@desc` | Deskripsi grup |
| `@count` | Jumlah member saat ini |
| `@name` | Nama member |

---

## 🤖 Fitur JadiBot (Detail)

JadiBot memungkinkan kamu menjalankan nomor WhatsApp lain sebagai sub-bot yang sinkron dengan bot utama. Semua plugin bot utama otomatis tersedia di sub-bot.

### Cara Pakai:
```
# Login sub-bot via pairing code (default, lebih mudah)
.jadibot 628123456789 pairing

# Login sub-bot via QR (QR dikirim sebagai gambar ke chat)
.jadibot 628123456789 qr

# Lihat bot milik kamu
.myjadibots

# Lihat semua bot aktif (owner only)
.listjadibot

# Stop bot milikmu
.stopjadibot 628123456789
```

### Sistem Slot & Limit:
| Role | Max Bot | Cara Cek |
|---|---|---|
| 👤 User biasa | **2 bot** | `.myjadibots` |
| 💎 Premium | **5 bot** | `.myjadibots` |
| 👑 Owner | **Unlimited** | `.listjadibot` |
| 🌐 Global | **20 bot total** | `.listjadibot` |

### Catatan:
- Semua user bisa menggunakan `.jadibot`, bukan owner only
- User biasa bisa punya maksimal 2 bot aktif bersamaan
- Premium bisa punya 5 bot aktif bersamaan
- Owner tidak ada batasan, tapi global tetap max 20 bot
- Session sub-bot disimpan di `session/jadibot_<nomor>/`
- Sub-bot punya database & plugin yang sama dengan bot utama
- Jika sub-bot disconnect, akan auto-reconnect dan tetap tercatat milik user yang sama
- Hanya pemilik bot atau owner yang bisa menghentikan sebuah bot
- Jika sub-bot logout, session dihapus otomatis dan slot dibebaskan
- **Auto-resume**: sub-bot otomatis reconnect saat bot utama restart (session tersimpan di `database/jadibot_registry.json`)
- Reconnect dengan exponential backoff — max 10x percobaan sebelum menyerah
- Notifikasi dikirim ke DM owner saat bot connect, logout, atau gagal reconnect

---

## ⏰ Group Scheduler

Jadwalkan aksi grup secara otomatis berdasarkan waktu WIB. Berguna untuk mengelola banyak grup sekaligus — misalnya tutup semua grup jam 22:00 dan buka kembali jam 06:00.

### Aksi yang Tersedia
| Aksi | Keterangan | Butuh Bot Admin |
|---|---|---|
| `close` | Tutup grup (hanya admin bisa kirim) | ✅ Ya |
| `open` | Buka grup (semua bisa kirim) | ✅ Ya |
| `lockinfo` | Kunci edit info grup | ✅ Ya |
| `unlockinfo` | Buka kunci edit info grup | ✅ Ya |
| `mute` | Bot diam di grup ini | ❌ Tidak |
| `unmute` | Bot aktif lagi di grup | ❌ Tidak |

### Cara Pakai
```
# Tambah jadwal tutup grup setiap hari jam 22:00
.schedule add 22:00 close

# Buka grup setiap hari jam 06:00
.schedule add 06:00 open

# Mute bot hanya Senin–Jumat jam 23:00
.schedule add 23:00 mute 1,2,3,4,5

# Unmute kembali jam 05:00 Senin–Jumat
.schedule add 05:00 unmute senin,selasa,rabu,kamis,jumat

# Lock info grup setiap Sabtu & Minggu jam 22:00
.schedule add 22:00 lockinfo sabtu,minggu

# Lihat semua jadwal
.schedule list

# Hapus jadwal nomor 2
.schedule del 2

# Test jadwal nomor 1 sekarang
.schedule test 1

# Aktifkan/nonaktifkan jadwal tanpa hapus
.schedule on 1
.schedule off 1

# Hapus semua jadwal
.schedule clear
```

### Format Hari
| Input | Hari |
|---|---|
| `0` atau `minggu` atau `sun` | Minggu |
| `1` atau `senin` atau `mon` | Senin |
| `2` atau `selasa` atau `tue` | Selasa |
| `3` atau `rabu` atau `wed` | Rabu |
| `4` atau `kamis` atau `thu` | Kamis |
| `5` atau `jumat` atau `fri` | Jumat |
| `6` atau `sabtu` atau `sat` | Sabtu |

Pisahkan dengan koma, contoh: `1,2,3,4,5` atau `senin,selasa,rabu`

### Catatan
- Scheduler berjalan di bot utama, otomatis aktif saat bot nyala
- Waktu menggunakan timezone **WIB (Asia/Jakarta)**
- Maksimal **20 jadwal** per grup
- Aksi `close`, `open`, `lockinfo`, `unlockinfo` membutuhkan **bot jadi admin**
- Scheduler engine tick setiap menit — akurasi ±1 menit
- Jadwal tersimpan di database, tidak hilang walau bot restart
- Gunakan `.schedule test <no>` untuk uji coba aksi tanpa menunggu waktunya

---

## 🔌 Sistem Plugin

Bot mendukung 2 format plugin:

### Plugin CJS (CommonJS) — `src/plugins/cjs/*.js`

```js
const handler = async (m, {
    manzxy, reply, command, args, text,
    isOwn, isPrem, isAdmin, botAdmin,
    from, senderJid, user, groupData,
    participants, groupMetadata
}) => {
    // Logika plugin di sini
    reply("Halo!");
};

handler.command  = ["halo", "hello"];    // command yang ditangani
handler.tags     = ["info"];             // kategori (untuk .totalfitur)
handler.limit    = true;                 // apakah perlu limit?
handler.limitCost = 1;                   // biaya limit (default: 1)
handler.owner    = false;                // khusus owner?
handler.group    = false;                // khusus di grup?

module.exports = handler;
```

### Plugin ESM (ES Module) — `src/plugins/esm/*.mjs`

```js
const handler = async (m, {
    manzxy, reply, command, args, text,
    isOwn, isPrem, isAdmin, botAdmin,
    from, senderJid, user, groupData
}) => {
    reply("Halo dari ESM!");
};

handler.command  = ["haloesm"];
handler.tags     = ["info"];
handler.limit    = true;

export default handler;
```

### Properti Plugin
| Properti | Tipe | Default | Keterangan |
|---|---|---|---|
| `command` | `string\|string[]` | (wajib) | Command yang ditangani |
| `tags` | `string[]` | `["others"]` | Kategori untuk `.totalfitur` |
| `limit` | `boolean` | `false` | Apakah command butuh limit? |
| `limitCost` | `number` | `1` | Berapa limit yang dikurangi |
| `owner` | `boolean` | `false` | Hanya owner yang bisa pakai |
| `group` | `boolean` | `false` | Hanya bisa dipakai di grup |
| `premium` | `boolean` | `false` | Hanya premium yang bisa pakai |

### Object yang Tersedia di Plugin

| Variabel | Tipe | Keterangan |
|---|---|---|
| `manzxy` | Socket | Socket Baileys |
| `m` | Object | Pesan yang masuk |
| `reply(teks)` | Function | Balas pesan |
| `command` | string | Command yang dipakai |
| `args` | string[] | Argumen setelah command |
| `text` | string | Semua argumen digabung |
| `isOwn` | boolean | Apakah pengirim owner? |
| `isPrem` | boolean | Apakah pengirim premium? |
| `isAdmin` | boolean | Apakah pengirim admin grup? |
| `botAdmin` | boolean | Apakah bot admin grup? |
| `from` | string | JID chat |
| `senderJid` | string | JID pengirim |
| `senderNum` | string | Nomor pengirim (tanpa @) |
| `user` | Object | Data user dari database |
| `groupData` | Object | Data grup dari database |
| `participants` | Array | Daftar participant grup |
| `groupMetadata` | Object | Metadata grup |

---

## 💡 Membuat Plugin

### Contoh Plugin Sederhana (CJS)
```js
// src/plugins/cjs/tools-calculator.js

const handler = async (m, { reply, args }) => {
    if (!args[0]) return reply("Format: .calc <ekspresi>\nContoh: .calc 2+2");
    
    try {
        const result = eval(args.join(' ')); // jangan pakai di produksi!
        reply(`🧮 Hasil: ${result}`);
    } catch (e) {
        reply("❌ Ekspresi tidak valid!");
    }
};

handler.command  = ["calc", "kalkulator"];
handler.tags     = ["tools"];
handler.limit    = true;
handler.limitCost = 1;

module.exports = handler;
```

### Contoh Plugin dengan Limit (ESM)
```js
// src/plugins/esm/ai-example.mjs

const handler = async (m, { reply, text, user }) => {
    if (!text) return reply("Kirim pertanyaan!");
    
    // Simulasi AI response
    reply(`🤖 Kamu bertanya: ${text}\n\nSisa limit: ${user.limit}`);
};

handler.command   = ["tanya"];
handler.tags      = ["ai"];
handler.limit     = true;
handler.limitCost = 2; // habiskan 2 limit per penggunaan

export default handler;
```

---

## ❓ FAQ / Troubleshooting

### Bot tidak merespons command
1. Pastikan bot sudah terhubung (status `[CONNECTION] Bot terhubung!`)
2. Cek prefix di `config.js` — default: `.`, `#`, `!`
3. Pastikan mode bot `public` (`.public`) atau kamu adalah owner
4. Cek apakah grup di-mute (`.mute`)

### Error saat install
```bash
# Hapus node_modules dan install ulang
rm -rf node_modules package-lock.json
npm install
```

### Session expired / perlu login ulang
```bash
# Hapus folder session
rm -rf session/
# Restart bot
node index.js
```

### JadiBot tidak bisa login
- Pastikan `qrcode` terinstall untuk mode QR: `npm install qrcode`
- Pastikan nomor sudah aktif di WhatsApp
- Coba mode pairing jika QR tidak berhasil

### Limit tidak terpotong
- Pastikan plugin punya `handler.limit = true`
- User premium & owner bebas limit
- Limit reset setiap 12 jam

### Database corrupt
- Bot akan otomatis restore dari backup terakhir di `database/backup/`
- Backup manual: `> require('./src/lib/database').backup()`

---

## 📝 Lisensi

MIT License — Bebas digunakan, dimodifikasi, dan didistribusikan.

---

## 🙏 Credits

- **Recode by**: Manzxy
- **Original Source**: [LingerBase](https://github.com/WJayadana/LingerBase) by WJayadana
- **WhatsApp Library**: [Baileys](https://github.com/WhiskeySockets/Baileys) by WhiskeySockets
- **Bot Name**: ManzxyMD

---

<div align="center">
Made with ❤️ for the WhatsApp Bot community
</div>
