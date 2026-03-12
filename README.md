<div align="center">

![ManzxyMD](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=ManzxyMD&fontSize=70&fontColor=fff&animation=twinkling&fontAlignY=38&desc=WhatsApp%20Bot%20Multi-Platform&descAlignY=62&descAlign=50)

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=A855F7&center=true&vCenter=true&multiline=true&width=600&height=80&lines=🤖+Bot+WhatsApp+Multi-Session;⚡+Ringan+%7C+Cepat+%7C+Stabil;🔌+Plugin+System+CJS+%2B+ESM)](https://github.com/manzxy/ManzxyMD)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-Latest-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-CC--BY--NC--4.0-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Termux%20%7C%20VPS%20%7C%20Panel-FF6B35?style=for-the-badge)](https://github.com/manzxy/ManzxyMD)

[![Stars](https://img.shields.io/github/stars/manzxy/ManzxyMD?style=social)](https://github.com/manzxy/ManzxyMD/stargazers)
[![Forks](https://img.shields.io/github/forks/manzxy/ManzxyMD?style=social)](https://github.com/manzxy/ManzxyMD/network/members)
[![Issues](https://img.shields.io/github/issues/manzxy/ManzxyMD)](https://github.com/manzxy/ManzxyMD/issues)

> **ManzxyMD** adalah WhatsApp Bot berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) yang ringan, stabil, dan mendukung multi-session (JadiBot).
> Dibangun ulang dari LingerBase — lebih cepat, lebih hemat RAM, siap jalan di Termux sekalipun.

[📦 Download ZIP](#-instalasi) · [📚 Plugin List](#-plugin-list) · [💬 Contact](https://wa.me/6288989721627) · [⭐ Star This Repo](https://github.com/manzxy/ManzxyMD)

</div>

---

## ✨ Fitur Unggulan

|  |  |
|--|--|
| 🤖 **Core** <br>✅ Login via **Pairing Code** atau **QR** <br>✅ **Auto-reconnect** dengan exponential backoff <br>✅ **Multi-session** — JadiBot (banyak nomor sekaligus) <br>✅ Database **SQLite WAL mode** (tidak korup, atomic write) <br>✅ Plugin system **CJS + ESM** (hot-reload tiap 30 detik) <br>✅ **LID support** penuh (WhatsApp versi terbaru) <br>✅ **MessageCounterError auto-recovery** (clear keys + reconnect) | ⚡ **Performance** <br>✅ RAM **80–150 MB** saat idle <br>✅ Startup **< 5 detik** (pairing mode) <br>✅ Plugin cache **30 detik** (hemat I/O disk) <br>✅ Status store auto-cleanup **tiap 24 jam** <br>✅ Optimized untuk **Termux / low-spec VPS** <br>✅ WAL + mmap + debounced DB save (2 detik batching) <br>✅ Memory auto-trim **tiap 15 menit** |
| 🏪 **Monetisasi** <br>✅ **SewaBot** — sewa bot ke grup via QRIS (Heroikzre) <br>✅ **Premium system** — fitur eksklusif per user <br>✅ **Limit system** — kuota command harian per user <br>✅ **Deposit & Saldo** — top up Rupiah via QRIS per user <br>✅ **Virtual Number OTP** — beli nomor via RumahOTP API <br>✅ Auto-join grup setelah pembayaran sukses <br>✅ Auto-expire premium & sewa otomatis | 🛠️ **Developer Friendly** <br>✅ **Plugin Manager** — upload/hapus plugin via WA langsung <br>✅ **GitHub Integration** — push file/folder/SC ke repo <br>✅ **Backup SC** otomatis ke Telegram via Bot API <br>✅ **Eval & Shell** — exec JS & bash dari WA (owner) <br>✅ **Status WA Downloader** — simpan story orang lain <br>✅ **Post Status WA** — upload konten ke story bot <br>✅ PM2 ready dengan `ecosystem.config.js` |

---

## 📦 Ukuran & Resource

| Kondisi | Ukuran | Keterangan |
|---------|--------|------------|
| **ZIP Download** | ~517 KB | Source code tanpa `node_modules` |
| **Setelah `npm install`** | ~250–350 MB | Termasuk semua dependencies |
| **RAM saat idle** | 80–150 MB | Tanpa JadiBot aktif |
| **RAM + JadiBot aktif** | +30–50 MB/bot | Per JadiBot yang berjalan |
| **Database (bot.db)** | < 5 MB | Tergantung jumlah user & grup |
| **Session WA** | 1–3 MB | Per nomor (bot utama atau JadiBot) |
| **Log PM2** | Varies | Auto-rotate di `/logs/` |

---

## 🖥️ Persyaratan Sistem

| Spesifikasi | Minimum | Rekomendasi |
|-------------|---------|-------------|
| **Node.js** | v18.x | v20.x / v22.x LTS |
| **RAM** | 256 MB | 512 MB+ |
| **Storage** | 500 MB | 1 GB+ |
| **OS** | Linux / Android (Termux) | Ubuntu 20.04+ |
| **Internet** | Stabil | Uptime tinggi, low latency |

---

## 🚀 Instalasi

### 1️⃣ Download & Extract

```bash
# Download ZIP dari GitHub
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O ManzxyMD.zip

# Extract
unzip ManzxyMD.zip && cd ManzxyMD-main

# Install semua dependencies
npm install
```

> ⚠️ **Jangan clone via git biasa** jika tidak paham git conflict — pakai ZIP lebih aman saat update.

### 2️⃣ Konfigurasi

Edit file **`config.js`**:

```javascript
const config = {
    // ── Prefix & Identity ──────────────────────────────────────
    prefa:    ['.', '#', '!'],          // prefix command (bisa array atau string)
    owner:    ['6281234567890'],         // ← WAJIB: nomor HP kamu (format 62xxx, tanpa +)
    ownerLid: [],                        // ← LID owner (isi dari log [PV_DEBUG] jika perlu)
    nameBot:  'NamaBotmu',              // ← nama bot
    nameOwn:  'NamaKamu',              // ← nama owner
    version:  '8.0',
    thumbnail: 'https://link-foto-bot.jpg', // URL foto thumbnail di menu (opsional)

    // ── SewaBot ────────────────────────────────────────────────
    sewabot: {
        enabled: true,
        apikey:  'ISI_API_KEY_HEROIKZRE',  // dari restapi.heroikzre.my.id
        harga: {
            '1bulan':  15000,   // harga dalam Rupiah (bebas diubah)
            '3bulan':  40000,
            '6bulan':  75000,
            '1tahun':  140000,
        },
        paymentTimeout: 15,  // menit timeout QRIS sebelum expired
    },

    // ── Telegram (opsional, untuk backup SC) ───────────────────
    telegram: {
        token:   'BOT_TOKEN_TELEGRAM',  // token dari @BotFather
        chat_id: 'CHAT_ID',             // chat ID tujuan backup
    },
};

const init = {
    session:     './session',        // path folder session WA
    customPair:  'KODE_PAIR_BEBAS',  // kode unik untuk pairing (bebas diisi apa saja)
    loginMethod: 'pairing',          // 'pairing' atau 'qr'
};

module.exports = { config, init };
```

### 3️⃣ Jalankan

```bash
npm start
```

Bot akan meminta **Pairing Code 8 digit** → buka WhatsApp → **Perangkat Tertaut → Tautkan dengan Nomor Telepon** → masukkan kode.

---

## 📱 Panduan Per Platform

<details>
<summary>📱 <b>Termux (Android)</b> — klik untuk expand</summary>

### Install Dependencies

```bash
# Update repository Termux
pkg update && pkg upgrade -y

# Install Node.js, git, unzip
pkg install nodejs git unzip -y

# Install tools untuk build native modules (wajib untuk better-sqlite3)
pkg install python make clang -y
```

### Download & Jalankan

```bash
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O bot.zip
unzip bot.zip && cd ManzxyMD-main
npm install
nano config.js   # edit konfigurasi
npm start
```

### Jalankan di Background (layar mati tetap jalan)

```bash
# Mulai bot di background
nohup npm start > logs/output.log 2>&1 &
echo $! > bot.pid
echo "Bot berjalan — PID: $(cat bot.pid)"

# Lihat log real-time
tail -f logs/output.log

# Stop bot background
kill $(cat bot.pid)
```

### Tips Termux

- Install **Termux:Boot** dari F-Droid → bot auto-start saat HP reboot
- Aktifkan **Acquire Wakelock** di notifikasi Termux → Android tidak matikan proses
- Jika RAM < 512MB, batasi JadiBot aktif (1–2 saja)
- Tambah swap jika sering OOM: `pkg install tsu -y && sudo swapon --all`

</details>

<details>
<summary>🖥️ <b>VPS / Dedicated Server (Ubuntu/Debian)</b> — klik untuk expand</summary>

### Install Node.js v20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs unzip wget build-essential python3

# Verifikasi
node --version   # pastikan v20.x
npm --version
```

### Download & Setup

```bash
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O bot.zip
unzip bot.zip && cd ManzxyMD-main
npm install
nano config.js
```

### Jalankan dengan PM2 (Rekomendasi untuk VPS)

```bash
# Install PM2 secara global
npm install -g pm2

# Start bot
pm2 start ecosystem.config.js

# Auto-start saat VPS reboot
pm2 save
pm2 startup
# Ikuti instruksi yang tampil — biasanya copy-paste 1 command sebagai root
```

### Referensi Perintah PM2

| Perintah | Fungsi |
|----------|--------|
| `pm2 start ecosystem.config.js` | Start bot |
| `pm2 stop manzxymd` | Stop bot |
| `pm2 restart manzxymd` | Restart bot |
| `pm2 reload manzxymd` | Graceful reload tanpa downtime |
| `pm2 logs manzxymd` | Lihat log real-time |
| `pm2 logs manzxymd --lines 100` | Lihat 100 baris log terakhir |
| `pm2 monit` | Dashboard monitor RAM & CPU |
| `pm2 list` | Lihat semua proses PM2 |
| `pm2 delete manzxymd` | Hapus dari daftar PM2 |
| `pm2 save` | Simpan daftar proses PM2 |

</details>

<details>
<summary>🌐 <b>Panel Hosting (Pterodactyl / cPanel)</b> — klik untuk expand</summary>

### Pterodactyl

```bash
# Upload ZIP via File Manager panel
# Lalu buka terminal panel:
unzip ManzxyMD.zip && cd ManzxyMD-main
npm install
```

Set **Startup Command** di panel:
```
node index.js
```

### cPanel → Node.js App

```bash
# Upload ZIP via cPanel File Manager, lalu extract
# Atau via terminal SSH:
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip
unzip main.zip && cd ManzxyMD-main
npm install
```

Di **cPanel → Setup Node.js App:**
- Application root: `ManzxyMD-main`  
- Application startup file: `index.js`
- Node.js version: `18+` atau `20+`

> ⚠️ Pastikan hosting support **persistent background process** (shared hosting biasa tidak support)

</details>

<details>
<summary>🐳 <b>Docker</b> — klik untuk expand</summary>

Buat `Dockerfile` di root folder:

```dockerfile
FROM node:20-alpine

# Install dependencies build (untuk better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

CMD ["node", "index.js"]
```

```bash
# Build image
docker build -t manzxymd .

# Run container dengan volume (session & database persist)
docker run -d \
  --name manzxybot \
  --restart unless-stopped \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/database:/app/database \
  -v $(pwd)/logs:/app/logs \
  manzxymd

# Lihat log
docker logs -f manzxybot

# Stop
docker stop manzxybot

# Update (rebuild)
docker stop manzxybot && docker rm manzxybot
docker build -t manzxymd . && docker run -d ...
```

</details>

---

## 📚 Plugin List

> **41 plugin CJS + ESM** | **130+ command aktif** | Plugin auto-reload tiap 30 detik tanpa restart

---

### 🤖 AI — Kecerdasan Buatan

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.brave <pertanyaan>` | `bravesearch`, `braveai` | Tanya AI Brave Search | All |
| `.sora <pertanyaan>` | `sora2` | Chat dengan AI Sora | All |
| `.ttv <deskripsi>` | `textovideo` | Generate video dari teks (Text to Video AI) | All |
| `.pixwith <prompt>` | — | Generate gambar AI Pixwith dari teks | All |
| `.pixwithmodel` | `pixwithmodels` | Lihat semua model Pixwith yang tersedia | All |
| `.banana <prompt>` | `img2img` | Generate gambar AI dari gambar (reply foto) | All |
| `.textreplace <teks baru>` | `tr`, `textedit`, `gantitext` | Ganti teks di dalam gambar pakai AI (reply foto) | All |

> 💡 `.pixwith` dan `.banana` butuh reply gambar sebagai referensi. `.sora` bisa dipakai chat biasa.

---

### 📥 Downloader — Unduh Media

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.ytmp3 <url/judul>` | `yt` | Download audio YouTube dalam format MP3 | All |
| `.ytmp4 <url/judul>` | `yt` | Download video YouTube dalam format MP4 | All |
| `.play <judul lagu>` | `ytplay` | Cari lagu di YouTube lalu download langsung | All |
| `.tiktok <url>` | `tt` | Download video TikTok tanpa watermark | All |
| `.fb <url>` | `fbdl`, `facebook` | Download video dari Facebook | All |
| `.spotify <url>` | `spoti` | Download lagu dari Spotify | All |
| `.movie <judul>` | `film`, `movieku` | Cari info film/series + link download | All |
| `.xv <url>` | `xvideos`, `xvdl` | Download video Xvideos | 💎 Premium |

> 💡 `.yt` bisa untuk audio maupun video, bot akan tanya format terlebih dulu.

---

### 🖼️ Tools — Alat Bantu

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.hd` | — | Perjelas/upscale gambar **2x** (reply foto, via iloveimg) | All |
| `.hdr` | — | Perjelas/upscale gambar **HDR 4x** (reply foto, via iloveimg) | All |
| `.iqc` | `iphonechat`, `iqchat` | Buat screenshot percakapan bergaya iPhone | All |
| `.sw <628xxx>` | `swdl`, `statuswa` | Download status WA / story milik seseorang | All |
| `.postsw` | `uploadsw`, `swpost`, `storysend` | Post foto/video/audio/teks sebagai Status WA bot (reply media) | 👑 Owner |
| `.swgc` | `swgroup`, `swtogrup` | Forward status WA orang lain otomatis ke grup | 👑 Owner |

> 💡 `.hd` dan `.hdr` — reply foto, bot akan kirim balik foto yang sudah diperjelas. `.hdr` lebih tajam tapi proses lebih lama.

---

### 👥 Group Management — Kelola Grup

#### Anggota & Moderasi

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.tagall` | — | Tag semua member grup sekaligus | Admin |
| `.hidetag` | — | Tag semua member tanpa terlihat di pesan | Admin |
| `.totag` | — | Forward pesan + tag semua member | Admin |
| `.kick @tag` | — | Keluarkan member dari grup | Admin |
| `.add 628xxx` | — | Tambahkan nomor ke dalam grup | Admin |
| `.kickall` | — | Kick semua member yang bukan admin | Admin |

#### Hak Akses Admin

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.promote @tag` | `jadmin` | Jadikan member sebagai admin grup | Admin |
| `.demote @tag` | `unadmin` | Copot jabatan admin dari member | Admin |

#### Pengaturan Grup

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.closegc` | — | Tutup grup — hanya admin bisa kirim pesan | Admin |
| `.opengc` | — | Buka grup — semua member bisa kirim pesan | Admin |
| `.mute` | — | Bot diam di grup ini (tidak merespons command) | Admin |
| `.unmute` | — | Bot aktif kembali merespons command | Admin |
| `.namagrup <nama baru>` | `gantinama` | Ganti nama/judul grup | Admin |
| `.setdesc <teks>` | `setdescgc` | Ganti deskripsi/info grup | Admin |
| `.setinfo` | `lockinfo` | Kunci atau buka edit info grup | Admin |
| `.setlink` | `linkgc`, `getlink` | Tampilkan link undangan grup | Admin |
| `.resetlink` | `revokelink` | Reset link undangan (link lama tidak berlaku) | Admin |
| `.disappear <1d/7d/90d>` | `setttl`, `ephemeral` | Atur pesan otomatis menghilang | Admin |
| `.groupsetting` | `setelan`, `grupinfo` | Lihat semua setelan grup saat ini | Admin |

#### Sistem Warn (Peringatan)

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.warn @tag` | — | Beri 1 peringatan ke member | Admin |
| `.getwarn @tag` | — | Lihat jumlah warn satu member | Admin |
| `.warnlist` | `listwarn` | Lihat semua warn seluruh member grup | Admin |
| `.resetwarn @tag` | — | Hapus semua warn milik member | Admin |
| `.unwarn @tag` | — | Hapus 1 warn terakhir member | Admin |
| `.setwarnmax <angka>` | `maxwarn` | Atur batas warn sebelum auto-kick | Admin |

> 💡 Default `maxwarn` = 3. Jika member melampaui batas warn, bot otomatis kick.

#### Pesan Otomatis & Event

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.welcome on/off` | — | Aktifkan/nonaktifkan pesan sambutan member baru | Admin |
| `.setwelcome <teks>` | — | Atur teks pesan sambutan custom | Admin |
| `.setleave <teks>` | — | Atur teks pesan perpisahan member keluar | Admin |
| `.adzan on/off` | — | Aktifkan notifikasi waktu sholat 5 waktu (WIB/WITA/WIT) | Admin |
| `.schedule` | `jadwal`, `sched` | Atur jadwal otomatis aksi di grup (tag, pesan, dll) | Admin |

#### Anti-Spam & Keamanan

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.antilink on/off` | — | Anti link eksternal umum (bit.ly, youtube, dll) | Admin |
| `.antilinkwhitelist <domain>` | `alwl` | Tambah domain ke whitelist antilink | Admin |
| `.antilinkgc on/off` | — | Anti link grup WhatsApp lain | Admin |
| `.resetwarnlinkgc @tag` | `resetlinkwarn` | Reset warn antilink-gc untuk member | Admin |
| `.listwarnlinkgc` | — | Lihat daftar warn antilink-gc di grup | Admin |
| `.antitoxic on/off` | — | Filter dan hapus kata-kata kasar otomatis | Admin |

#### Info Grup

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.groupinfo` | `ginfo`, `infogroup` | Info lengkap grup: deskripsi, jumlah member, admin | All |
| `.memberlist` | `listmember` | Daftar semua member beserta nomor WA | All |

---

### ℹ️ Info & Utilitas

| Command | Alias | Fungsi | Role |
|---------|-------|--------|------|
| `.menu` | `help` | Tampilkan semua fitur bot dikelompokkan per kategori | All |
| `.ping` | `speed`, `cek` | Cek latency response dan uptime bot | All |
| `.status` | — | Info sistem: RAM terpakai, CPU, uptime, versi Node | All |
| `.profile` | `profil`, `me` | Lihat profil lengkap: level, EXP, saldo, limit | All |
| `.owner` | `contact` | Tampilkan nomor & info kontak owner bot | All |
| `.daftar <nama> <umur>` | `register` | Daftar akun baru (nama, umur, gender) | All |
| `.setname <nama baru>` | — | Ganti nama profil | All |
| `.setumur <umur>` | — | Ganti umur profil | All |
| `.unreg` | `unregister` | Hapus registrasi akun (reset data profil) | All |
| `.ceksn` | `mysn` | Lihat serial number unik akun kamu | All |
| `.limit` | `mylimit`, `ceklimit` | Cek sisa limit command hari ini | All |

---

### 💰 Deposit & Saldo

Sistem saldo Rupiah per user — terpisah dari sistem RPG. Digunakan untuk membeli virtual number OTP via RumahOTP.

| Command | Fungsi | Keterangan |
|---------|--------|------------|
| `.deposit` | Lihat saldo Rupiah kamu | |
| `.dep` | Alias `.deposit` | |
| `.topup` | Alias `.deposit` | |
| `.deposit saldo` | Lihat saldo Rupiah kamu | |
| `.deposit <nominal>` | Top up saldo via QRIS (minimal Rp 2.000) | Bot kirim QR Code + info nominal |
| `.deposit cek` | Cek & konfirmasi pembayaran setelah bayar QRIS | Saldo otomatis bertambah jika sukses |
| `.deposit batal` | Batalkan transaksi deposit yang masih pending | Hanya bisa dibatalkan sebelum bayar |
| `.deposit riwayat` | Lihat histori 10 transaksi deposit terakhir | |

> 💡 **QRIS dikirim sebagai gambar** — scan langsung dari WA pakai aplikasi m-banking atau e-wallet.

---

### 📱 Virtual Number OTP — RumahOTP

Beli nomor telepon virtual untuk keperluan verifikasi OTP aplikasi (WhatsApp, Telegram, Instagram, dll). Saldo Rupiah dipotong otomatis saat order berhasil dibuat.

#### Layanan

| Command | Alias | Fungsi |
|---------|-------|--------|
| `.layanan` | `srv`, `services` | Daftar semua layanan OTP (15 per halaman) |
| `.layanan list <halaman>` | — | Halaman tertentu (contoh: `.layanan list 2`) |
| `.layanan cari <nama>` | — | Cari layanan berdasarkan nama (contoh: `.layanan cari whatsapp`) |
| `.layanan negara <kode>` | — | Lihat daftar negara + harga + stok untuk layanan tertentu |
| `.layanan info <kode>` | — | Info detail layanan + negara dengan harga termurah |

#### Operator

| Command | Alias | Fungsi |
|---------|-------|--------|
| `.operator <negara> <provider_id>` | `op` | Cek daftar operator tersedia sebelum order |

> Contoh: `.operator Indonesia 3837`

#### Order Nomor

| Command | Alias | Fungsi | Keterangan |
|---------|-------|--------|------------|
| `.beli <number_id> <provider_id>` | `order`, `buy` | Beli nomor virtual OTP | Saldo terpotong otomatis |
| `.beli <number_id> <provider_id> <operator_id>` | — | Beli dengan operator tertentu | Opsional |
| `.beli cek` | — | Cek status order & OTP yang sudah masuk | Ulangi sampai OTP muncul |
| `.beli selesai` | — | Tandai order sebagai selesai (completed) | Lakukan setelah pakai OTP |
| `.beli ulang` | — | Minta kirim ulang OTP (set status received) | Jika OTP tidak datang |
| `.beli batal` | — | Batalkan order aktif | Saldo dikembalikan jika belum pakai |
| `.beli riwayat` | — | Lihat histori 10 order terakhir | |

#### 💡 Flow Lengkap Beli OTP

```
Step 1 — Top up saldo:
  .deposit 10000
  → Scan QRIS yang dikirim bot
  → Setelah bayar: .deposit cek

Step 2 — Cari layanan:
  .layanan cari whatsapp
  → Catat service_code (misal: 1)

Step 3 — Lihat negara & harga:
  .layanan negara 1
  → Lihat number_id, provider_id, harga, stok

Step 4 — (Opsional) Cek operator:
  .operator Indonesia 3837
  → Pilih operator_id yang diinginkan

Step 5 — Beli nomor:
  .beli 340437 3837
  (atau dengan operator: .beli 340437 3837 2)
  → Bot konfirmasi: nomor, harga, saldo tersisa

Step 6 — Masukkan nomor ke aplikasi:
  Daftarkan nomor virtual tersebut di WA/Telegram/Instagram/dll

Step 7 — Tunggu & cek OTP:
  .beli cek
  → Ulangi setiap 30 detik sampai OTP muncul

Step 8 — Selesai:
  .beli selesai
```

---

### 🤖 JadiBot — Multi-Session

Jalankan banyak nomor WhatsApp sekaligus dari satu bot utama. Setiap user bisa punya JadiBot sendiri.

| Command | Fungsi | Role |
|---------|--------|------|
| `.jadibot <628xxx>` | Daftar JadiBot baru via Pairing Code | All |
| `.jadibot <628xxx> qr` | Daftar JadiBot baru via QR Code | All |
| `.stopjadibot <628xxx>` | Hentikan JadiBot (session tersimpan, bisa di-resume) | Owner JB |
| `.startjadibot <628xxx>` | Resume JadiBot yang pernah di-stop | Owner JB |
| `.myjadibots` | Lihat semua JadiBot milikmu beserta status | All |
| `.listjadibot` | Lihat semua JadiBot aktif dari semua user | 👑 Owner |
| `.deljadibotses <628xxx>` | Hapus session JadiBot secara permanen | 👑 Owner |
| `.setjadibotlimit <role> <angka>` | Atur batas jumlah JadiBot per role (free/premium/global) | 👑 Owner |
| `.jadibotlimit` | Lihat batas JadiBot yang berlaku saat ini | All |
| `.setjadibotnews <channel_id>` | Set newsletter/channel WA yang auto-difollow JadiBot baru | 👑 Owner |
| `.jadibotnews` | Lihat info newsletter/channel JadiBot | All |

> 💡 JadiBot yang di-stop tidak kehilangan session — bisa di-resume kapan saja dengan `.startjadibot`.

---

### 🏪 SewaBot — Monetisasi Grup

Sistem sewa bot ke grup lain menggunakan QRIS otomatis via Heroikzre API.

| Command | Fungsi | Role |
|---------|--------|------|
| `.sewabot` | Tampilkan info paket, harga, dan cara sewa | All |
| `.sewa <paket>` | Buat QRIS pembayaran sewa (contoh: `.sewa 1bulan`) | All |
| `.perpanjang <paket>` | Perpanjang masa sewa grup yang aktif | All |
| `.cekpayment` | Cek & verifikasi pembayaran QRIS yang sudah dibayar | All |
| `.batalpayment` | Batalkan transaksi QRIS yang belum dibayar | All |
| `.linkgrup` | Kirim link grup setelah konfirmasi pembayaran sukses | All |
| `.ceksewa` | Cek status sewa grup ini: aktif/expired, sisa hari | All |
| `.listsewa` | Lihat semua grup yang sedang sewa (lengkap) | 👑 Owner |
| `.addsewa @grup <durasi>` | Aktivasi sewa manual tanpa QRIS | 👑 Owner |
| `.delsewa @grup` | Hapus sewa + bot keluar dari grup | 👑 Owner |

> 💡 Harga sewa dikonfigurasi di `config.js` — bebas atur sesuai kebijakanmu sendiri.

---

### 👑 Owner — Manajemen Bot

#### User & Premium Management

| Command | Alias | Fungsi |
|---------|-------|--------|
| `.addowner @tag` | — | Tambah owner bot tambahan |
| `.delowner @tag` | `removeowner` | Hapus owner dari daftar |
| `.listowner` | `ownerlist` | Tampilkan semua owner bot |
| `.addprem @tag <durasi>` | `addpremium` | Tambah premium (30d / 3m / 6m / 1y / perm) |
| `.delprem @tag` | `delpremium`, `removeprem` | Cabut premium dari user |
| `.listprem` | `premlist` | Tampilkan semua user premium + expired |
| `.public` | — | Bot bisa dipakai semua orang |
| `.self` | — | Bot hanya bisa dipakai owner |

#### Plugin Manager

| Command | Fungsi |
|---------|--------|
| `.plugin list` | Lihat daftar semua plugin CJS & ESM yang terpasang |
| `.plugin + <namafile.js>` | Upload plugin baru (reply pesan kode teks) |
| `.plugin - <nomor>` | Hapus plugin berdasarkan nomor dari `.plugin list` |
| `.plugin ? <nomor>` | Lihat isi/kode plugin tertentu |
| `.plugin reload` | Reload ulang semua plugin tanpa restart bot |
| `.plugins` | Alias `.plugin` |

#### GitHub Integration

| Command | Fungsi |
|---------|--------|
| `.github setup` | Konfigurasi token GitHub & nama repo |
| `.github upload` | Upload semua source code ke GitHub sekaligus |
| `.github file <path>` | Upload 1 file tertentu ke GitHub |
| `.github folder <path>` | Upload seluruh isi folder ke GitHub |
| `.github list <path>` | Lihat isi direktori di repo GitHub |
| `.github delete <path>` | Hapus file dari repo GitHub |
| `.gh` | Alias cepat untuk `.github` |

#### Server & Session

| Command | Alias | Fungsi |
|---------|-------|--------|
| `.restart` | — | Restart bot (PM2 auto-restart) |
| `.shutdown` | `matiin` | Matikan bot (perlu start manual dari panel/terminal) |
| `.clearkeys` | `fixsession` | Clear signal keys — fix MessageCounterError / session corrupt |
| `.backupsc` | — | Zip semua source code dan kirim ke Telegram |
| `.sf <path>` | — | Baca atau edit file di server langsung via WA |
| `> <kode js>` | — | Eval/jalankan kode JavaScript secara langsung |
| `$ <command>` | — | Jalankan shell command di server |

---

## 🔌 Cara Buat Plugin Sendiri

Semua plugin di ManzxyMD menggunakan format **CJS (CommonJS)** — sama seperti plugin bawaan.

### Template Plugin Lengkap

Buat file `.js` baru di `src/plugins/cjs/`:

```javascript
/* ============================================================
   tools-contoh.js — Plugin contoh ManzxyMD

   Commands:
     .halo <nama>   → Balas dengan sapaan
     .info          → Tampilkan info

   Contoh penggunaan:
     .halo Budi
     .info
   ============================================================ */

'use strict';

/**
 * Semua parameter yang tersedia dari manzxy.js
 */
const handler = async (m, {
    manzxy,       // Baileys socket — sendMessage, groupMetadata, updateProfilePicture, dll
    command,      // String: command yang diketik user (tanpa prefix)
    args,         // Array: argumen setelah command ['arg1', 'arg2', ...]
    text,         // String: args.join(' ') — semua argumen dalam 1 string
    usedPrefix,   // String: prefix yang digunakan user (. # atau !)
    reply,        // Function (teks) → balas pesan dengan quote otomatis
    isOwn,        // Boolean: apakah pengirim owner?
    isPrem,       // Boolean: apakah pengirim premium?
    isAdmin,      // Boolean: apakah pengirim admin di grup?
    isBotAdmin,   // Boolean: apakah bot sendiri admin di grup?
    botAdmin,     // Boolean: alias isBotAdmin
    isGroup,      // Boolean: apakah pesan dari grup?
    from,         // String: JID chat tujuan (grup JID atau private JID)
    senderJid,    // String: JID pengirim (format: 628xxx@s.whatsapp.net)
    senderNum,    // String: nomor pengirim saja (tanpa @s.whatsapp.net)
    pushname,     // String: nama WhatsApp pengirim
    user,         // Object: data user dari database (limit, saldo, level, dll)
    groupData,    // Object: data grup dari database (welcome, antilink, dll)
    participants, // Array: [{id, admin}] — semua member grup
    quoted,       // Object | null: pesan yang di-reply user (jika ada)
    mime,         // String: mimetype pesan quoted (image/jpeg, video/mp4, dll)
    notel,        // String: nomor telepon owner (dari config)
}) => {

    // ── Guard: Validasi argumen ─────────────────────────────────
    if (!text) return reply(
        `❌ Format salah!\n\nContoh:\n${usedPrefix}${command} NamaMu`
    );

    // ── Contoh 1: Balas teks biasa ──────────────────────────────
    reply(`👋 Halo, *${text}*! Saya ${pushname} bot-nya kamu.`);

    // ── Contoh 2: Kirim gambar via URL ─────────────────────────
    // await manzxy.sendMessage(from, {
    //     image: { url: 'https://example.com/foto.jpg' },
    //     caption: `Halo *${text}*!`,
    // }, { quoted: m });

    // ── Contoh 3: Download & proses media dari quoted ───────────
    // if (!m.quoted) return reply('❌ Reply sebuah foto dulu!');
    // if (!m.quoted.mimetype?.startsWith('image')) return reply('❌ Harus reply foto!');
    // const buf = await m.quoted.download();
    // await manzxy.sendMessage(from, {
    //     image: buf,
    //     caption: 'Ini hasil proses gambarmu!',
    // }, { quoted: m });

    // ── Contoh 4: Kirim video ───────────────────────────────────
    // await manzxy.sendMessage(from, {
    //     video: { url: 'https://...' },
    //     caption: 'Video dari bot',
    //     gifPlayback: false,
    // }, { quoted: m });

    // ── Contoh 5: Kirim sticker ─────────────────────────────────
    // await manzxy.sendMessage(from, {
    //     sticker: buf,
    // }, { quoted: m });

    // ── Contoh 6: Kirim audio ───────────────────────────────────
    // await manzxy.sendMessage(from, {
    //     audio: { url: 'https://...' },
    //     mimetype: 'audio/mpeg',
    //     ptt: false, // true = voice note
    // }, { quoted: m });

    // ── Contoh 7: Mention user di grup ─────────────────────────
    // await manzxy.sendMessage(from, {
    //     text: `Halo @${senderNum}!`,
    //     mentions: [senderJid],
    // }, { quoted: m });

    // ── Contoh 8: Cek role user ─────────────────────────────────
    // if (!isOwn) return reply('❌ Command ini khusus owner bot!');
    // if (!isPrem) return reply('❌ Command ini khusus member premium!\nUpgrade premium: .sewabot');
    // if (!isAdmin) return reply('❌ Kamu harus admin grup untuk pakai ini!');
    // if (!isBotAdmin) return reply('❌ Bot harus dijadikan admin grup dulu!');

    // ── Contoh 9: Akses data user dari DB ──────────────────────
    // const saldo = user.saldo ?? 0;
    // const limit = user.limit ?? 0;
    // const level = user.level ?? 1;
    // reply(`Saldo kamu: Rp ${saldo.toLocaleString('id-ID')}\nLimit: ${limit}\nLevel: ${level}`);

    // ── Contoh 10: HTTP Request dengan axios ────────────────────
    // const axios = require('axios');
    // const { data } = await axios.get('https://api.example.com/data', {
    //     params: { query: text },
    //     timeout: 10000,
    // });
    // reply(JSON.stringify(data, null, 2));
};

// ── Metadata Plugin ───────────────────────────────────────────
handler.command  = ['halo', 'info'];   // command yang direspon (tanpa prefix)
handler.tags     = ['tools'];          // kategori untuk .menu
handler.limit    = true;               // true = potong 1 limit setiap command
handler.owner    = false;              // true = hanya owner yang bisa pakai
handler.premium  = false;             // true = hanya premium/owner yang bisa pakai
handler.group    = false;             // true = hanya bisa dipakai di grup
handler.private  = false;             // true = hanya bisa dipakai di chat pribadi
handler.admin    = false;             // true = hanya admin grup yang bisa pakai
handler.botAdmin = false;             // true = bot harus jadi admin grup

// Deskripsi tiap command — tampil di .menu
handler.fitur = {
    'halo': 'Balas dengan sapaan personal',
    'info': 'Tampilkan info detail bot',
};

module.exports = handler;
```

### Upload Plugin via Bot (Tanpa Masuk Server)

```
Langkah:
1. Tulis kode plugin di text editor / Notepad
2. Paste seluruh kode ke dalam chat WA dengan bot
3. Reply pesan kode tersebut dan kirim:
   .plugin + namafile.js
4. Plugin langsung aktif tanpa perlu restart!
5. Verifikasi: .plugin list
```

### Kategori Plugin (Tags) untuk `.menu`

| Tag | Dipakai oleh | Keterangan |
|-----|-------------|------------|
| `ai` | ai-*.js | Plugin kecerdasan buatan |
| `downloader` | down-*.js | Plugin download media |
| `tools` | tools-*.js, maker-*.js | Plugin alat bantu |
| `group` | group-*.js | Plugin manajemen grup |
| `info` | info-*.js | Plugin informasi bot |
| `main` | main-*.js | Plugin inti (limit, daftar, sewa) |
| `owner` | owner-*.js | Plugin khusus owner |
| `rumahotp` | tools-otp-*.js | Plugin virtual number OTP |
| `misc` | Lain-lain | Plugin tak berkategori |

---

## ⚙️ Konfigurasi Lengkap (`config.js`)

```javascript
const config = {

    // ── Prefix & Identity ──────────────────────────────────────
    prefa:    ['.', '#', '!'],      // prefix command (array — bisa 1 atau lebih)
    owner:    ['6281234567890'],     // nomor owner (bisa array lebih dari 1)
    ownerLid: [],                    // LID owner — isi jika WA kamu pakai LID mode
                                    // Cara cari: lihat log [PV_DEBUG] saat bot start
    nameBot:  'ManzxyMD',           // nama bot ditampilkan di .menu
    nameOwn:  'Manzxy',             // nama owner ditampilkan di .menu
    version:  '8.0',
    thumbnail: 'https://...',        // URL foto thumbnail untuk .menu (opsional)

    // ── SewaBot ────────────────────────────────────────────────
    sewabot: {
        enabled:        true,              // aktifkan/nonaktifkan fitur sewa
        apikey:         'API_KEY_HEROIKZRE',  // dari restapi.heroikzre.my.id
        paymentTimeout: 15,                // menit timeout QRIS sebelum expired
        harga: {
            '1bulan':  15000,  // harga dalam Rupiah — bebas diubah
            '3bulan':  40000,
            '6bulan':  75000,
            '1tahun':  140000,
        },
    },

    // ── Telegram Backup ────────────────────────────────────────
    telegram: {
        token:   'BOT_TOKEN',    // token dari @BotFather di Telegram
        chat_id: 'CHAT_ID',      // chat ID / group ID tujuan backup
    },
};

// Konfigurasi koneksi WA
const init = {
    session:     './session',        // path folder penyimpanan session WA
    customPair:  'MANZXYMD2025',     // kode pairing unik (bebas isi apa saja)
    loginMethod: 'pairing',          // metode login: 'pairing' atau 'qr'
};

module.exports = { config, init };
```

---

## 📂 Struktur Folder Lengkap

```
ManzxyMD/
│
├── 📄 index.js                    — Entry point (init koneksi WA + load core)
├── 📄 manzxy.js                   — Message handler utama, routing semua plugin
├── 📄 config.js                   — ✏️ KONFIGURASI UTAMA — edit file ini
├── 📄 ecosystem.config.js         — Konfigurasi PM2 (nama proses, restart policy)
├── 📄 package.json                — Info project & daftar dependencies
├── 📄 package-lock.json           — npm lock file
│
├── 📁 src/
│   │
│   ├── 📁 core/                   — Modul inti bot (dipecah dari index.js)
│   │   ├── connection.js          — Koneksi WA, session recovery, auto-reconnect
│   │   ├── scheduler.js           — Scheduler grup, notif adzan otomatis
│   │   ├── store.js               — In-memory store + LID→JID mapping
│   │   ├── cleanup.js             — Cleanup session/memory tiap 15 menit
│   │   ├── logger.js              — Terminal logger berwarna (info/warn/error)
│   │   ├── media.js               — Helper download/upload/convert media
│   │   └── message.js             — smsg() serializer + getTime/tanggal utils
│   │
│   ├── 📁 lib/                    — Library & utilities
│   │   ├── database.js            — SQLite database layer (WAL, debounced save)
│   │   ├── jadibot.js             — Engine multi-session JadiBot
│   │   ├── handler.js             — CJS plugin loader + hot-reload 30 detik
│   │   ├── handle.mjs             — ESM plugin loader
│   │   ├── sqlite-session.js      — Session WA → SQLite (integrity check + WAL)
│   │   ├── json-session.js        — Session JadiBot → JSON file per nomor
│   │   ├── heroikzrePayment.js    — QRIS payment gateway (SewaBot)
│   │   └── jid-utils.js           — forceJid() centralized, LID blocker
│   │
│   └── 📁 plugins/
│       ├── 📁 cjs/                — 41 plugin standar CommonJS (.js)
│       │   │
│       │   ├── [AI]
│       │   ├── ai-banana.js           — img2img AI (generate gambar dari gambar)
│       │   ├── ai-brave.js            — Brave Search AI (tanya apa saja)
│       │   ├── ai-pixwith.js          — Pixwith AI image gen + model list
│       │   ├── ai-sora.js             — Sora AI chat + Text to Video
│       │   ├── ai-textreplace.js      — Ganti teks dalam gambar pakai AI
│       │   │
│       │   ├── [Downloader]
│       │   ├── down-fb.js             — Download video Facebook
│       │   ├── down-spot.js           — Download lagu Spotify
│       │   ├── down-tiktok.js         — Download TikTok no watermark
│       │   ├── down-xvideos.js        — Download Xvideos (premium only)
│       │   ├── down-yt.js             — Download YouTube audio/video
│       │   ├── search-play.js         — Cari & download musik YouTube
│       │   │
│       │   ├── [Group]
│       │   ├── group.js               — tagall, hidetag, kick, add, closegc
│       │   ├── group-adzan.js         — Notif waktu sholat 5 waktu
│       │   ├── group-antilink.js      — Anti link eksternal + whitelist
│       │   ├── group-antilinkgc.js    — Anti link WA grup lain
│       │   ├── group-extra.js         — Fitur grup lengkap (warn, mute, dll)
│       │   ├── group-info.js          — groupinfo, memberlist
│       │   ├── group-scheduler.js     — Jadwal otomatis aksi grup
│       │   ├── group-welcome.js       — Pesan sambutan/perpisahan
│       │   │
│       │   ├── [Info]
│       │   ├── core.js                — Menu bot (scan semua plugin otomatis)
│       │   ├── info-owner.js          — Tampilkan kontak owner
│       │   ├── info-ping.js           — Ping latency + uptime
│       │   ├── info-profile.js        — Profil user lengkap
│       │   ├── info-status.js         — Status sistem RAM/CPU/uptime
│       │   │
│       │   ├── [Main]
│       │   ├── main-daftar.js         — Registrasi akun (nama, umur, gender)
│       │   ├── main-limit.js          — Sistem limit command harian
│       │   ├── main-sewabot.js        — SewaBot + QRIS via Heroikzre
│       │   ├── maker-iqc.js           — Buat gambar quote iPhone-style
│       │   │
│       │   ├── [JadiBot]
│       │   ├── jadibot.js             — Multi-session engine + management
│       │   │
│       │   ├── [Owner]
│       │   ├── owner-add.js           — Manajemen owner & premium user
│       │   ├── owner-backupsc.js      — Backup source code ke Telegram
│       │   ├── owner-github.js        — Upload SC/file/folder ke GitHub
│       │   ├── owner-mode.js          — Mode public/self
│       │   ├── owner-p.js             — Plugin Manager (upload/hapus/reload)
│       │   ├── owner-restart.js       — Restart, shutdown, clearkeys
│       │   ├── owner-sf.js            — Edit file server via WA
│       │   │
│       │   ├── [Tools]
│       │   ├── tools-hd.js            — Perjelas gambar 2x/4x (HD/HDR upscale)
│       │   ├── tools-movie.js         — Cari & download film/series
│       │   ├── tools-poststatus.js    — Post konten ke Status WA bot
│       │   ├── tools-sw.js            — Download Status WA orang lain
│       │   ├── tools-swgc.js          — Forward Status WA ke grup
│       │   │
│       │   └── [RumahOTP]
│       │       ├── tools-otp-deposit.js  — Top up saldo via QRIS
│       │       ├── tools-otp-layanan.js  — Daftar & cari layanan OTP
│       │       ├── tools-otp-operator.js — Cek operator tersedia
│       │       └── tools-otp-order.js    — Beli & kelola order OTP
│       │
│       └── 📁 esm/                — Plugin ES Module (.mjs) — format modern
│
├── 📁 database/                   — Data bot (auto-dibuat saat pertama run)
│   └── bot.db                     — SQLite database utama
│
├── 📁 session/                    — ⚠️ JANGAN DIHAPUS!
│   ├── session.db                 — Session WA bot utama
│   └── jadibot/                   — Session per JadiBot
│       └── 628xxx/                — Folder session per nomor JadiBot
│
├── 📁 logs/                       — Log PM2 (auto-rotate)
└── 📁 scripts/                    — Script utilitas & migrasi database
```

---

## 🗄️ Database Schema (SQLite)

ManzxyMD menggunakan **SQLite dengan WAL mode** — jauh lebih cepat, stabil, dan tidak korup dibanding JSON.

### Tabel & Fungsinya

| Tabel | Isi | Auto-Save |
|-------|-----|-----------|
| `users` | Data per JID user | Debounced 2 detik |
| `groups` | Setelan per grup | Debounced 2 detik |
| `settings` | Key-value global (pending deposit, order, mode bot) | Immediate |
| `owners` | Daftar owner tambahan (di luar config.js) | Immediate |
| `premium` | User premium + timestamp expired | Immediate |
| `jadibot_registry` | JadiBot aktif (restored saat restart) | Immediate |
| `jadibot_stopped` | JadiBot di-stop, session masih ada | Immediate |
| `jadibot_limits` | Batas JadiBot per role (free/premium/global) | Immediate |

### Struktur Data User

```javascript
// Data default setiap user baru
{
    // ── Sistem ──────────────────────────────────
    limit:          20,       // sisa limit command hari ini (reset tiap 12 jam)
    lastLimitReset: 0,        // Unix timestamp reset limit terakhir
    banned:         false,    // user di-ban oleh owner?
    warn:           {},       // {grupJID: jumlahWarn}

    // ── Premium ─────────────────────────────────
    premium:        false,
    premiumExpired: 0,        // Unix timestamp expired premium

    // ── Registrasi ──────────────────────────────
    registered: false,
    name:       '',
    sn:         '',           // serial number unik
    age:        0,
    gender:     '',

    // ── Saldo Deposit (untuk OTP) ───────────────
    saldo:      0,            // saldo Rupiah — top up via .deposit

    // ── RPG Stats (terpisah dari saldo OTP) ─────
    exp:        0,
    level:      1,
    money:      1000,         // mata uang RPG (beda dari saldo Rupiah)
    health:     100,
    mana:       50,
    stamina:    100,
    stats:      { strength: 10, defense: 5, agility: 5 },
    inventory:  {},
    equipment:  { weapon: null, armor: null },
    cooldown:   { adventure: 0, daily: 0, hunt: 0, mine: 0 },
    lastclaim:  0,
}
```

### Struktur Data Grup

```javascript
// Data default setiap grup baru
{
    welcome:          false,  // aktif/nonaktif pesan sambutan
    welcomeMessage:   '',     // teks pesan sambutan custom
    leaveMessage:     '',     // teks pesan perpisahan custom
    antilink:         'off',  // 'off' / 'on' / 'kick'
    antilinkWhitelist:[],     // domain yang diizinkan
    antilinkWarn:     {},     // {jid: jumlahWarn}
    antilinkgc:       'off',
    mute:             false,  // bot diam di grup ini?
    setinfo:          false,  // edit info dikunci?
    adminonly:        false,
    antiToxic:        false,
    warns:            {},     // {jid: jumlahWarn}
    maxWarn:          3,      // batas warn sebelum auto-kick
    ephemeral:        0,      // durasi pesan menghilang (detik) — 0 = mati
    schedule:         { jobs: [] }, // jadwal otomatis
}
```

---

## 🐛 Troubleshooting

<details>
<summary><b>❌ Bot tidak merespons command apapun</b></summary>

Cek secara berurutan:

1. **Prefix benar?** Default `.` → coba ketik `.ping`
2. **Mode self aktif?** Ketik `.public` dari nomor owner
3. **Bot masih jalan?** Cek terminal: `pm2 logs manzxymd --lines 20`
4. **Nomor owner benar?** Format wajib `628xxx` (tanpa `+` atau spasi) di `config.js`
5. **LID issue?** Jika baru update WA, ownerLid mungkin perlu diisi. Lihat log `[PV_DEBUG]`

```bash
pm2 logs manzxymd --lines 50
```

</details>

<details>
<summary><b>❌ Pairing Code tidak muncul / gagal scan QR</b></summary>

```bash
# Hapus session lama
rm -rf session/

# Restart
npm start
# atau
pm2 restart manzxymd
```

Pastikan:
- Nomor WA aktif dan tidak terhubung ke perangkat lain yang konflik
- Koneksi internet stabil saat pairing
- `customPair` di `init` sudah diisi (bukan kosong)

</details>

<details>
<summary><b>❌ Error `better-sqlite3` saat npm install</b></summary>

```bash
# Solusi 1: Build dari source
npm install --build-from-source better-sqlite3

# Solusi 2: Rebuild saja
npm rebuild better-sqlite3

# Solusi 3 (Termux):
pkg install python make clang -y
npm install

# Solusi 4 (Ubuntu/Debian):
sudo apt-get install -y build-essential python3-dev
npm install
```

</details>

<details>
<summary><b>❌ Bot terus reconnect / tidak stabil</b></summary>

Normal jika koneksi internet tidak stabil. Bot punya auto-reconnect dengan exponential backoff (maksimal 5 kali, cooldown 60 detik antar reconnect).

Jika terus-terusan reconnect:

```bash
# 1. Lihat error spesifik di log
pm2 logs manzxymd --lines 100

# 2. Coba fix session via WA — ketik ke bot:
.clearkeys

# 3. Atau restart bersih
pm2 restart manzxymd

# 4. Jika session corrupt total, pair ulang
rm -rf session/ && npm start
```

</details>

<details>
<summary><b>❌ MessageCounterError / Bad MAC / decrypt failed</b></summary>

Error session WA yang umum setelah update WA atau jaringan buruk. Bot sudah punya **auto-recovery** — otomatis clear signal keys dan reconnect.

Jika auto-recovery tidak cukup:

```
1. Dari WA — ketik ke bot:
   .clearkeys
   (atau .fixsession — sama saja)

2. Atau dari terminal:
   rm -rf session/creds.json session/app-state-sync-*
   pm2 restart manzxymd
```

</details>

<details>
<summary><b>❌ RAM penuh di Termux / VPS low-spec</b></summary>

1. Kurangi jumlah JadiBot aktif (`.stopjadibot`)
2. Bot otomatis trim memory tiap 15 menit — tunggu saja
3. Tambah swap di **Android**:
   ```bash
   pkg install tsu -y && sudo swapon --all
   ```
4. Tambah **swap file** di VPS:
   ```bash
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   ```

</details>

<details>
<summary><b>❌ Plugin tidak aktif setelah ditambah</b></summary>

```
# Dari WA:
.plugin reload

# Atau tunggu 30 detik — plugin auto-reload otomatis setiap 30 detik
# Atau restart bot:
pm2 restart manzxymd
```

Checklist plugin yang valid:
- File ada di `src/plugins/cjs/` dengan ekstensi `.js`
- Ada `module.exports = handler` di baris terakhir
- `handler.command` sudah diisi (array atau string)
- Tidak ada syntax error (coba `node src/plugins/cjs/namafile.js` untuk cek)

</details>

<details>
<summary><b>❌ Deposit / Order OTP error</b></summary>

**Cek bertahap:**

1. **API Key belum diisi** — buka `tools-otp-deposit.js`, isi `APIKEY` yang benar
2. **ETIMEDOUT** — VPS tidak bisa reach `rumahotp.com`, cek firewall atau DNS
3. **Saldo tidak cukup** — top up dulu: `.deposit <nominal>`
4. **Order aktif masih ada** — selesaikan dulu: `.beli cek` → `.beli selesai` atau `.beli batal`

```bash
# Test koneksi ke RumahOTP dari VPS
curl -s "https://www.rumahotp.com/api/v1" \
  -H "x-apikey: API_KEY_KAMU" | head -c 200
```

</details>

---

## 🔄 Update Bot

```bash
# 1. Backup config & data penting dulu
cp config.js config.backup.js

# 2. Download versi terbaru
wget https://github.com/manzxy/ManzxyMD/archive/refs/heads/main.zip -O update.zip

# 3. Extract — SKIP folder session dan database
unzip -o update.zip

# 4. Restore config lama
cp config.backup.js ManzxyMD-main/config.js

# 5. Update dependencies
cd ManzxyMD-main && npm install

# 6. Restart bot
pm2 restart manzxymd
```

> ⚠️ **JANGAN overwrite** folder `session/` dan `database/` saat update — data user & session WA akan hilang permanen!

---

## 📄 Dependencies Lengkap

| Package | Versi | Fungsi |
|---------|-------|--------|
| `@whiskeysockets/baileys` | latest | WhatsApp Web API — inti koneksi WA |
| `better-sqlite3` | ^11.0.0 | Database SQLite synchronous (WAL mode) |
| `axios` | ^0.24.0 | HTTP client untuk semua API call |
| `fluent-ffmpeg` | ^2.1.3 | Konversi video/audio (sticker, MP3) |
| `jimp` | ^1.6.0 | Manipulasi & proses gambar |
| `cheerio` | latest | HTML parsing untuk scraping |
| `form-data` | latest | Upload multipart/form-data |
| `sharp` | latest | Proses gambar resolusi tinggi |
| `moment-timezone` | ^0.5.34 | Format waktu Indonesia (WIB/WITA/WIT) |
| `chalk` | ^4.1.2 | Warna di terminal output |
| `pino` | ^7.0.5 | Logger minimal untuk Baileys |
| `qrcode` | ^1.5.4 | Generate QR Code untuk pairing |
| `wa-sticker-formatter` | ^1.6.0 | Buat sticker WhatsApp dari gambar/video |
| `archiver` | ^7.0.1 | Zip file untuk backup source code |
| `node-cron` | latest | Scheduler task berkala (adzan, cleanup) |

---

## 📜 Lisensi

```
Creative Commons Attribution NonCommercial 4.0 International
(CC-BY-NC-4.0)

✅ BOLEH:
   - Digunakan untuk keperluan pribadi
   - Dimodifikasi sesuai kebutuhan
   - Didistribusikan ulang secara non-komersial
   - Dibuat turunan / fork

❌ DILARANG:
   - Dijual atau dikomersilkan tanpa izin tertulis dari pemilik
   - Menghapus kredit atau sumber asli
   - Mengklaim sebagai karya sendiri

⚠️  WAJIB:
   - Cantumkan kredit: "Based on ManzxyMD — github.com/manzxy"
   - Sertakan link ke repo ini
```

---

## 🤝 Cara Berkontribusi

Kontribusi selalu disambut hangat! Cara berkontribusi:

```bash
# 1. Fork repo ini di GitHub (tombol Fork di kanan atas)

# 2. Clone fork kamu
git clone https://github.com/USERNAME/ManzxyMD.git
cd ManzxyMD

# 3. Buat branch baru untuk fitur / bug fix
git checkout -b feat/nama-fitur
# atau
git checkout -b fix/nama-bug

# 4. Buat perubahan, lalu commit
git add .
git commit -m "feat: tambah plugin tools-contoh"
# atau
git commit -m "fix: perbaiki error di group-welcome"

# 5. Push ke fork kamu
git push origin feat/nama-fitur

# 6. Buat Pull Request di GitHub
```

### Panduan Kontribusi

- Ikuti format plugin yang ada — lihat `src/plugins/cjs/ai-pixwith.js` sebagai referensi terbaik
- Tambahkan komentar header yang jelas di tiap plugin
- Pastikan plugin sudah ditest sebelum PR
- Satu PR = satu fitur atau satu bug fix
- Tulis deskripsi PR yang jelas

---

## 🤗 Credits & Terima Kasih

- **[WJayadana](https://github.com/WJadayana)** — Pemilik & pembuat LingerBase (base awal ManzxyMD)
- **[WhiskeySockets](https://github.com/WhiskeySockets/Baileys)** — Library Baileys yang luar biasa
- **[Claude AI](https://claude.ai)** — Pembantu fix bug, refactor arsitektur, & develop fitur baru
- **Keluarga & teman-teman** yang sudah support dari awal 🙏
- **Semua yang sudah ⭐ star & fork repo ini!**

---

## 💬 Kontak & Support

Butuh bantuan setup? Ada bug atau pertanyaan?

[![WhatsApp](https://img.shields.io/badge/WhatsApp-Chat_Langsung-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/6288989721627)
[![GitHub](https://img.shields.io/badge/GitHub-@manzxy-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/manzxy)
[![Issues](https://img.shields.io/badge/Bug_Report-Open_Issue-red?style=for-the-badge&logo=github)](https://github.com/manzxy/ManzxyMD/issues/new)

---

<div align="center">

![Footer](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer)

**Made with ❤️ by [Manzxy](https://github.com/manzxy)**

*Recode from [LingerBase](https://github.com/WJayadana/LingerBase) — ManzxyMD v8.0*

⭐ **Jika bot ini bermanfaat, tolong kasih bintang di repo ini!** ⭐

</div>
