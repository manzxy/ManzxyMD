<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=ManzxyMD&fontSize=70&fontColor=fff&animation=twinkling&fontAlignY=38&desc=WhatsApp%20Bot%20Multi-Platform&descAlignY=62&descAlign=50" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=A855F7&center=true&vCenter=true&multiline=true&width=600&height=80&lines=🤖+Bot+WhatsApp+Multi-Session;⚡+Ringan+%7C+Cepat+%7C+Stabil;🔌+Plugin+System+CJS+%2B+ESM" alt="Typing SVG" />

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-Latest-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-CC--BY--NC--4.0-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Termux%20%7C%20VPS%20%7C%20Panel-FF6B35?style=for-the-badge)](.)

<br/>

[![Stars](https://img.shields.io/github/stars/manzxy/ManzxyMD?style=social)](https://github.com/manzxy/ManzxyMD/stargazers)
[![Forks](https://img.shields.io/github/forks/manzxy/ManzxyMD?style=social)](https://github.com/manzxy/ManzxyMD/network/members)
[![Issues](https://img.shields.io/github/issues/manzxy/ManzxyMD)](https://github.com/manzxy/ManzxyMD/issues)

<br/>

> **ManzxyMD** adalah WhatsApp Bot berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) yang ringan, stabil, dan mendukung multi-session (JadiBot).  
> Dibangun ulang dari LingerBase — lebih cepat, lebih hemat RAM, siap jalan di Termux sekalipun.

<br/>

[📦 Download ZIP](#-instalasi) · [📚 Dokumentasi](#-plugin-list) · [💬 Contact](https://wa.me/6288989721627) · [⭐ Star This Repo](https://github.com/manzxy/ManzxyMD)

</div>

---

## ✨ Fitur Unggulan

<table>
<tr>
<td width="50%">

### 🤖 Core
- ✅ Login via **Pairing Code** atau **QR**
- ✅ **Auto-reconnect** dengan exponential backoff
- ✅ **Multi-session** — JadiBot (jalankan banyak nomor)
- ✅ Database **SQLite** (bukan JSON, tidak korup)
- ✅ Plugin system **CJS + ESM** (hot-reload)
- ✅ **LID support** (WhatsApp terbaru)

</td>
<td width="50%">

### ⚡ Performance
- ✅ RAM **80–150 MB** saat idle
- ✅ Startup **< 5 detik** (pairing mode)
- ✅ Plugin cache **30 detik** (hemat I/O)
- ✅ Status store auto-cleanup **24 jam**
- ✅ Optimized untuk **Termux / low-spec**
- ✅ WAL mode SQLite (zero downtime write)

</td>
</tr>
<tr>
<td width="50%">

### 🏪 Monetisasi
- ✅ **SewaBot** — sewa bot ke grup via QRIS
- ✅ **Premium system** — fitur eksklusif
- ✅ **Limit system** — kontrol penggunaan
- ✅ **Auto-payment** via Heroikzre API
- ✅ Auto-join grup setelah bayar

</td>
<td width="50%">

### 🛠️ Developer
- ✅ **Plugin Manager** — tambah/hapus via WA
- ✅ **GitHub Upload** — push SC langsung dari bot
- ✅ **Backup SC** ke Telegram otomatis
- ✅ **Eval & Shell** execution (owner)
- ✅ **Status WA Downloader** — simpan story
- ✅ PM2 ready dengan auto-restart

</td>
</tr>
</table>

---

## 📦 Ukuran File

| Kondisi | Ukuran | Keterangan |
|---------|--------|------------|
| **ZIP Download** | ~517 KB | Source code tanpa dependencies |
| **Setelah `npm install`** | ~250–350 MB | Termasuk `node_modules/` |
| **Saat Running (RAM)** | 80–150 MB | Tanpa JadiBot aktif |
| **Saat Running + JadiBot** | +30–50 MB/bot | Per JadiBot tambahan |
| **Database (bot.db)** | < 5 MB | Tergantung jumlah user/grup |
| **Session WA** | 1–3 MB | Per nomor bot |
| **Log (PM2)** | Var | Auto-rotate di `/logs/` |

---

## 🖥️ Persyaratan Sistem

| Spesifikasi | Minimum | Rekomendasi |
|-------------|---------|-------------|
| **Node.js** | v18.x | v20.x / v22.x |
| **RAM** | 256 MB | 512 MB+ |
| **Storage** | 500 MB | 1 GB+ |
| **OS** | Linux / Android | Ubuntu 20.04+ |
| **Internet** | Stabil | Stabil + uptime tinggi |

---

## 🚀 Instalasi

### 1️⃣ Download & Extract

```bash
# Download ZIP dari GitHub
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O ManzxyMD.zip

# Extract
unzip ManzxyMD.zip && cd ManzxyMD-main

# Install dependencies
npm install
```

> ⚠️ **Jangan clone biasa** — pakai ZIP agar tidak ada masalah git conflict saat update

### 2️⃣ Konfigurasi

Edit file **`config.js`**:

```js
const config = {
    prefa: [".", "#", "!"],          // prefix command (bisa lebih dari 1)
    owner: ['6281234567890'],         // ← WAJIB: nomor HP kamu (format 62xxx)
    ownerLid: [],                     // ← opsional: LID owner (lihat dari log)
    nameBot: "NamaBotmu",            // ← nama bot
    nameOwn: "NamaKamu",             // ← nama owner

    sewabot: {
        enabled: true,
        apikey: "ISI_API_KEY_HEROIKZRE", // ← dari restapi.heroikzre.my.id
        harga: {
            "1bulan":  15000,
            "3bulan":  40000,
            "6bulan":  75000,
            "1tahun":  140000,
        },
    },

    telegram: {
        token:   "BOT_TOKEN_TELEGRAM",   // ← opsional, untuk backup SC
        chat_id: "CHAT_ID_KAMU",
    }
};
```

### 3️⃣ Jalankan

```bash
npm start
```

Bot akan meminta **Pairing Code** → buka WhatsApp → **Perangkat Tertaut → Tautkan dengan Nomor Telepon** → masukkan kode.

---

## 📱 Cara Run — Per Platform

<details>
<summary><b>📱 Termux (Android)</b></summary>

```bash
# Update paket
pkg update && pkg upgrade -y

# Install dependencies
pkg install nodejs git unzip -y

# Download & extract
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O bot.zip
unzip bot.zip && cd ManzxyMD-main

# Install npm packages
npm install

# Edit config dulu
nano config.js

# Jalankan
npm start
```

> 💡 **Tips Termux:** Agar bot tetap jalan saat layar mati → install Termux:Boot atau gunakan `nohup npm start &`

```bash
# Jalankan background di Termux
nohup npm start > logs/output.log 2>&1 &
echo $! > bot.pid

# Hentikan
kill $(cat bot.pid)
```

</details>

<details>
<summary><b>🖥️ VPS / Dedicated Server</b></summary>

```bash
# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs unzip wget

# Download & extract
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O bot.zip
unzip bot.zip && cd ManzxyMD-main

# Install packages
npm install

# Edit config
nano config.js

# Install PM2 (wajib untuk VPS)
npm install -g pm2

# Jalankan dengan PM2
pm2 start ecosystem.config.js

# Auto-start saat reboot VPS
pm2 save && pm2 startup
```

| Perintah PM2 | Fungsi |
|-------------|--------|
| `pm2 start ecosystem.config.js` | Start bot |
| `pm2 stop manzxymd` | Stop bot |
| `pm2 restart manzxymd` | Restart bot |
| `pm2 logs manzxymd` | Lihat log real-time |
| `pm2 monit` | Monitor RAM & CPU |
| `pm2 delete manzxymd` | Hapus dari PM2 |

</details>

<details>
<summary><b>🌐 Panel Hosting (cPanel / Pterodactyl / RunCloud)</b></summary>

**Pterodactyl / Eggs:**
```bash
# Upload ZIP via file manager panel
# Extract di terminal panel
unzip ManzxyMD.zip
cd ManzxyMD-main
npm install

# Set startup command di panel:
node index.js
```

**cPanel Terminal:**
```bash
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip
unzip main.zip && cd ManzxyMD-main
npm install
# Jalankan via Node.js App di cPanel atau terminal
node index.js
```

> ⚠️ Pastikan panel support **Node.js v18+** dan izinkan persistent process

</details>

<details>
<summary><b>🐳 Docker (Opsional)</b></summary>

```dockerfile
# Buat Dockerfile di root folder
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "index.js"]
```

```bash
# Build & run
docker build -t manzxymd .
docker run -d --name bot \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/database:/app/database \
  manzxymd
```

</details>

---

## 📚 Plugin List

> Total: **38 plugin CJS + 1 plugin ESM** | **~100+ command**

### 🤖 AI
| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.brave` | `bravesearch`, `braveai` | Tanya AI Brave Search | All |
| `.sora` | `sora2`, `ttv`, `textovideo` | Chat AI + Text to Video | All |
| `.pixwith` | `pixwithmodel` | Generate gambar AI Pixwith | All |
| `.banana` | `img2img` | Generate gambar AI dari gambar | All |
| `.textreplace` | `tr`, `textedit`, `gantitext` | Edit teks di gambar pakai AI | All |

### 📥 Downloader
| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.ytmp3` | `ytmp4`, `yt` | Download YouTube audio/video | All |
| `.play` | `ytplay` | Cari & download musik YouTube | All |
| `.tiktok` | `tt` | Download video TikTok (no watermark) | All |
| `.fb` | `fbdl`, `facebook` | Download video Facebook | All |
| `.spotify` | `spoti` | Download lagu Spotify | All |
| `.movie` | `film`, `movieku` | Info & download film/series | All |
| `.xv` | `xvideos`, `xvdl` | Download video Xvideos | 💎 Premium |

### 👥 Group Management
| Command | Fungsi | Role |
|---------|--------|------|
| `.tagall` | Tag semua member | Admin |
| `.hidetag` | Tag semua (tersembunyi) | Admin |
| `.kick @tag` | Keluarkan member | Admin |
| `.add 628xxx` | Tambah member | Admin |
| `.promote @tag` | Jadikan admin | Admin |
| `.demote @tag` | Copot admin | Admin |
| `.warn @tag` | Beri peringatan | Admin |
| `.setwarnmax 3` | Batas warn sebelum kick | Admin |
| `.kickall` | Kick semua non-admin | Admin |
| `.mute` / `.unmute` | Bot diam/aktif di grup | Admin |
| `.closegc` / `.opengc` | Tutup/buka grup | Admin |
| `.antilink on/off` | Anti link umum | Admin |
| `.antilinkgc on/off` | Anti link grup WA lain | Admin |
| `.welcome on/off` | Pesan sambutan member baru | Admin |
| `.schedule` | Jadwal otomatis aksi grup | Admin |
| `.adzan on` | Notif waktu sholat otomatis | Admin |
| `.setdesc` | Ganti deskripsi grup | Admin |
| `.namagrup` | Ganti nama grup | Admin |
| `.disappear 7d` | Pesan menghilang otomatis | Admin |
| `.groupinfo` | Info lengkap grup | All |

### ℹ️ Info & Utilitas
| Command | Alias | Fungsi |
|---------|-------|--------|
| `.menu` | `help` | Semua fitur bot |
| `.ping` | `speed`, `cek` | Cek latency & uptime |
| `.status` | — | Status RAM, CPU, uptime |
| `.profile` | `profil`, `me` | Lihat profil pengguna |
| `.owner` | `contact` | Kontak owner bot |
| `.daftar` | `register` | Daftar akun baru |
| `.limit` | `mylimit`, `ceklimit` | Cek sisa limit |
| `.iqc` | `iphonechat`, `iqchat` | Buat quote iPhone-style |

### 🤖 JadiBot (Multi-Session)
| Command | Fungsi | Role |
|---------|--------|------|
| `.jadibot 628xxx` | Daftar jadibot baru (pairing) | All |
| `.jadibot 628xxx qr` | Daftar jadibot pakai QR | All |
| `.stopjadibot 628xxx` | Hentikan jadibot | Owner JB |
| `.startjadibot 628xxx` | Resume jadibot | Owner JB |
| `.myjadibots` | Lihat jadibotku + status | All |
| `.listjadibot` | Lihat semua jadibot aktif | 👑 Owner |
| `.setjadibotlimit 3` | Batas jumlah jadibot per user | 👑 Owner |
| `.deljadibotses 628xxx` | Hapus session jadibot | 👑 Owner |

### 🏪 SewaBot
| Command | Fungsi |
|---------|--------|
| `.sewabot` | Info paket & harga sewa |
| `.sewa 1bulan` | Buat QRIS pembayaran |
| `.perpanjang 1bulan` | Perpanjang masa sewa |
| `.cekpayment` | Verifikasi setelah bayar |
| `.batalpayment` | Batalkan transaksi |
| `.ceksewa` | Cek status sewa grup |
| `.listsewa` | Lihat semua grup sewa *(owner)* |
| `.addsewa @grup` | Aktivasi manual *(owner)* |
| `.delsewa @grup` | Hapus sewa *(owner)* |

### 👑 Owner
| Command | Fungsi |
|---------|--------|
| `.addprem @tag 30d` | Tambah premium (30d/3m/1y/perm) |
| `.delprem @tag` | Hapus premium |
| `.addowner @tag` | Tambah owner bot |
| `.delowner @tag` | Hapus owner |
| `.public` / `.self` | Mode public/self |
| `.restart` | Restart bot |
| `.plugin list` | Lihat semua plugin |
| `.plugin + nama.js` | Upload plugin baru (reply kode) |
| `.plugin - 5` | Hapus plugin nomor 5 |
| `.plugin ? 3` | Lihat isi plugin nomor 3 |
| `.github setup` | Konfigurasi GitHub |
| `.github upload` | Upload semua SC ke GitHub |
| `.github file path` | Upload 1 file ke GitHub |
| `.github folder path` | Upload folder ke GitHub |
| `.github list` | Lihat isi repo GitHub |
| `.github delete path` | Hapus file dari repo |
| `.backupsc` | Backup SC ke Telegram |
| `.sf` | Simpan/edit file server |
| `.sw` | Lihat status WA yang tersimpan |
| `.sw dl 628xxx` | Download media dari status WA |
| `> kode js` | Eval JavaScript |
| `$ command` | Jalankan shell command |

---

## 🔌 Cara Buat Plugin Sendiri

Plugin ManzxyMD bisa ditulis dalam format **CJS** (CommonJS) atau **ESM** (ES Module).

### Format CJS (Rekomendasi)

Buat file `.js` baru di `src/plugins/cjs/`:

```js
'use strict';

/**
 * nama-plugin.js
 * Deskripsi singkat plugin ini
 */

const handler = async (m, { manzxy, args, text, reply, isOwn, isPrem, isAdmin, botAdmin, from, senderJid, user }) => {

    // Contoh: balas dengan teks
    reply(`Halo! Kamu kirim: ${args.join(' ')}`);

    // Contoh: kirim gambar
    // await manzxy.sendMessage(m.chat, { image: { url: 'https://...' }, caption: 'Halo!' }, { quoted: m });

    // Contoh: download & forward media dari quoted
    // if (!m.quoted) return reply('Reply sebuah media dulu!');
    // const buf = await m.quoted.download();
    // await manzxy.sendMessage(m.chat, { image: buf, caption: 'Ini hasilnya' }, { quoted: m });
};

// ── Metadata plugin ───────────────────────────────────────
handler.command  = ['halo', 'salam'];     // command yang direspon
handler.tags     = ['misc'];              // kategori untuk menu
handler.limit    = true;                  // true = potong limit, false = gratis
handler.owner    = false;                 // true = owner only
handler.premium  = false;                 // true = premium only
handler.group    = false;                 // true = hanya di grup
handler.private  = false;                 // true = hanya di private chat
handler.admin    = false;                 // true = hanya admin grup
handler.botAdmin = false;                 // true = bot harus admin

handler.fitur = {
    'halo':  'Balas pesan halo',
    'salam': 'Balas pesan salam',
};

module.exports = handler;
```

### Format ESM (ES Module)

Buat file `.mjs` di `src/plugins/esm/`:

```js
const handler = async (m, { reply, args }) => {
    reply(`ESM Plugin! Args: ${args.join(' ')}`);
};

handler.command = ['esmplugin'];
handler.tags    = ['misc'];
handler.limit   = false;

export default handler;
```

### Parameter yang Tersedia

| Parameter | Tipe | Keterangan |
|-----------|------|------------|
| `m` | Object | Message object (body, chat, sender, quoted, dll) |
| `manzxy` | Socket | Baileys socket — sendMessage, groupMetadata, dll |
| `args` | Array | Argumen setelah command |
| `text` | String | `args.join(' ')` |
| `reply(teks)` | Function | Balas pesan dengan quote |
| `isOwn` | Boolean | Apakah pengirim owner? |
| `isPrem` | Boolean | Apakah pengirim premium? |
| `isAdmin` | Boolean | Apakah pengirim admin grup? |
| `botAdmin` | Boolean | Apakah bot admin di grup? |
| `from` | String | JID chat (grup/private) |
| `senderJid` | String | JID pengirim |
| `senderNum` | String | Nomor pengirim (tanpa @s.whatsapp.net) |
| `user` | Object | Data pengguna dari DB |
| `groupData` | Object | Data grup dari DB |
| `participants` | Array | Daftar member grup |
| `quoted` | Object | Pesan yang di-reply |
| `pushname` | String | Nama WhatsApp pengirim |

### Upload Plugin via Bot

Kamu juga bisa tambah plugin langsung dari WhatsApp tanpa masuk ke server:

```
1. Ketik kode plugin di text editor
2. Kirim sebagai pesan teks biasa ke bot
3. Reply pesan kode tersebut dengan:
   .plugin + namafile.js
4. Plugin langsung aktif tanpa restart!
```

---

## ⚙️ Konfigurasi Lengkap (config.js)

```js
const config = {
    // ── Prefix & Owner ─────────────────────────────────
    prefa:    ['.', '#', '!'],       // prefix command (bisa array atau string)
    owner:    ['6281234567890'],      // nomor owner (bisa lebih dari 1)
    ownerLid: [],                     // LID owner (isi dari log [PV_DEBUG])
    
    // ── Identitas Bot ──────────────────────────────────
    nameBot:   'NamaBot',
    nameOwn:   'NamaOwner',
    version:   '2.0',
    thumbnail: 'https://link-foto-bot.jpg',  // foto thumbnail menu

    // ── SewaBot ────────────────────────────────────────
    sewabot: {
        enabled: true,                      // aktif/nonaktif fitur sewa
        apikey:  'API_KEY_HEROIKZRE',       // dari restapi.heroikzre.my.id
        harga: {
            '1bulan':  15000,               // sesuaikan harga kamu
            '3bulan':  40000,
            '6bulan':  75000,
            '1tahun':  140000,
        },
        paymentTimeout: 15,                 // menit timeout QRIS
    },

    // ── Telegram (opsional, untuk backup SC) ───────────
    telegram: {
        token:   'TOKEN_BOT_TELEGRAM',
        chat_id: 'CHAT_ID',
    },
};

const init = {
    session:    './session',
    customPair: 'KODE_PAIR',  // kode unik untuk pairing (bebas)
    loginMethod: 'pairing',   // 'pairing' atau 'qr'
};
```

---

## 📂 Struktur Folder

```
ManzxyMD/
├── 📄 index.js              — Entry point, koneksi WA utama
├── 📄 manzxy.js             — Handler pesan & routing plugin
├── 📄 config.js             — ✏️ KONFIGURASI UTAMA (edit ini!)
├── 📄 ecosystem.config.js   — Konfigurasi PM2
├── 📄 package.json          — Info & dependencies
│
├── 📁 src/
│   ├── 📁 core/
│   │   ├── logger.js        — Sistem logging berwarna
│   │   ├── media.js         — Handler download/upload media
│   │   └── message.js       — Utils pesan & smsg()
│   │
│   ├── 📁 lib/
│   │   ├── database.js      — SQLite database layer
│   │   ├── jadibot.js       — Engine multi-session JadiBot
│   │   ├── handler.js       — CJS plugin loader
│   │   ├── handle.mjs       — ESM plugin loader
│   │   ├── sqlite-session.js— Session WA ke SQLite
│   │   ├── json-session.js  — Session JadiBot ke JSON
│   │   ├── heroikzrePayment.js — QRIS payment gateway
│   │   └── jid-utils.js     — Utilities JID/LID
│   │
│   └── 📁 plugins/
│       ├── 📁 cjs/          — 38 plugin standar (.js)
│       └── 📁 esm/          — Plugin modern (.mjs)
│
├── 📁 database/             — Data bot (auto-dibuat)
│   └── bot.db               — Database SQLite utama
│
├── 📁 session/              — Session WA (⚠️ jangan dihapus!)
│   ├── session.db           — Session bot utama
│   └── jadibot/             — Session per JadiBot
│
├── 📁 logs/                 — Log PM2
└── 📁 scripts/              — Script migrasi & utilities
```

---

## 🗄️ Database

ManzxyMD menggunakan **SQLite** (bukan JSON) untuk semua penyimpanan data:

| Tabel | Isi |
|-------|-----|
| `users` | Data user: limit, ban, premium, registrasi |
| `groups` | Setelan grup: welcome, antilink, mute, warn |
| `settings` | Konfigurasi global: mode public/self |
| `owners` | Daftar owner tambahan |
| `premium` | Daftar user premium + expired |
| `jadibot_registry` | JadiBot aktif |
| `jadibot_stopped` | JadiBot yang di-stop (session tersimpan) |
| `sewa_groups` | Grup yang sedang sewa bot |
| `sewa_pending` | Transaksi QRIS yang belum dibayar |

> 💾 Database auto-save setiap **10 menit** + saat bot stop

---

## 🐛 Troubleshooting

<details>
<summary><b>Bot tidak merespons command</b></summary>

1. Pastikan prefix benar (default: `.`) — coba `.ping`
2. Cek apakah bot dalam mode `.self` — pakai `.public`
3. Cek log untuk error: `pm2 logs manzxymd`

</details>

<details>
<summary><b>Pairing code tidak muncul</b></summary>

```bash
# Hapus session lama
rm -rf session/
# Restart
npm start
```

</details>

<details>
<summary><b>Error `better-sqlite3` saat npm install</b></summary>

```bash
npm install --build-from-source better-sqlite3
# atau
npm rebuild better-sqlite3
```

Untuk Termux:
```bash
pkg install python make clang -y
npm install
```

</details>

<details>
<summary><b>Bot reconnect terus / tidak stable</b></summary>

Normal jika koneksi tidak stabil. Bot punya auto-reconnect dengan backoff otomatis. Tunggu ±60 detik. Jika terus-terusan:

```bash
# Cek log
pm2 logs manzxymd --lines 50

# Restart bersih
pm2 restart manzxymd
```

</details>

<details>
<summary><b>RAM penuh di Termux / low-spec</b></summary>

1. Kurangi jumlah JadiBot aktif
2. Bot otomatis trim memory setiap 15 menit
3. Tambah swap Android:

```bash
pkg install tsu -y
sudo swapon --all
```

</details>

<details>
<summary><b>Plugin tidak aktif setelah ditambah</b></summary>

```
.plugin reload
```

Atau tunggu 30 detik — plugin auto-reload setiap 30 detik.

</details>

---

## 🔄 Update Bot

```bash
# Download versi terbaru
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O update.zip

# Backup config & session dulu!
cp config.js config.backup.js

# Extract (overwrite file lama)
unzip -o update.zip

# Salin config lama
cp config.backup.js ManzxyMD-main/config.js

# Install/update dependencies
cd ManzxyMD-main && npm install

# Restart
pm2 restart manzxymd
```

> ⚠️ **Jangan overwrite** folder `session/` dan `database/` saat update!

---

## 📄 Dependencies Utama

| Package | Versi | Fungsi |
|---------|-------|--------|
| `@whiskeysockets/baileys` | latest | WhatsApp Web API |
| `better-sqlite3` | ^11.0.0 | Database SQLite |
| `axios` | ^0.24.0 | HTTP requests |
| `fluent-ffmpeg` | ^2.1.3 | Konversi media (sticker, video) |
| `jimp` | ^1.6.0 | Manipulasi gambar |
| `moment-timezone` | ^0.5.34 | Format waktu WIB |
| `chalk` | ^4.1.2 | Warna di terminal |
| `pino` | ^7.0.5 | Logger Baileys |
| `qrcode` | ^1.5.4 | Generate QR |
| `wa-sticker-formatter` | ^1.6.0 | Buat sticker WA |
| `archiver` | ^7.0.1 | ZIP untuk backup |

---

## 📜 Lisensi

```
CC-BY-NC-4.0 — Creative Commons Attribution NonCommercial 4.0

✅ Boleh: digunakan, dimodifikasi, didistribusikan (non-komersial)
❌ Dilarang: dijual, dikomersilkan tanpa izin
⚠️  Wajib: cantumkan kredit / sumber asli
```

---

## 🤝 Kontribusi

1. Fork repo ini
2. Buat branch baru: `git checkout -b fitur-baru`
3. Commit perubahan: `git commit -m 'Tambah fitur X'`
4. Push: `git push origin fitur-baru`
5. Buat Pull Request

---

## 💬 Kontak & Support

<div align="center">

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/6288989721627)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/manzxy)

</div>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

**Made with ❤️ by [Manzxy](https://github.com/manzxy)**  
*Recode from LingerBase — ManzxyMD v2.0*

⭐ **Star repo ini jika bermanfaat!**

</div>
