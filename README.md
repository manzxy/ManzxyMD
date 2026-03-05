<div align="center">

```
╔══════════════════════════════════╗
  ✦  M A N Z X Y M D  ✦
  WhatsApp Bot Framework
  Baileys v6 + SQLite
╚══════════════════════════════════╝
```

**Stabil • Ringan • Multi-platform • Anti-mati**

</div>

---

## 📋 Daftar Isi

- [Persyaratan Sistem](#-persyaratan-sistem)
- [Instalasi di VPS / Linux](#-instalasi-di-vps--linux)
- [Instalasi di Panel (Pterodactyl)](#-instalasi-di-panel-pterodactyl)
- [Instalasi di Termux (Android)](#-instalasi-di-termux-android)
- [Konfigurasi Bot](#-konfigurasi-bot)
- [Cara Menjalankan](#-cara-menjalankan)
- [Login WhatsApp](#-login-whatsapp)
- [Menjalankan dengan PM2](#-menjalankan-dengan-pm2-rekomendasi)
- [Sistem Sewa Bot ke Grup](#-sistem-sewa-bot-ke-grup)
- [Plugin Manager](#-plugin-manager)
- [Perintah Penting](#-perintah-penting)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)

---

## ✅ Persyaratan Sistem

| Komponen | Minimum | Rekomendasi |
|----------|---------|-------------|
| **Node.js** | v18.x | **v20 LTS** |
| **RAM** | 256 MB | 512 MB+ |
| **Storage** | 500 MB | 1 GB+ |
| **OS** | Linux/Windows/macOS/Android | Ubuntu 22.04 |
| **Internet** | Stabil | Stabil + low latency |

> ⚠️ **PENTING:** Node.js versi di bawah v18 **tidak didukung**. Selalu cek dulu dengan `node -v`.

---

## 🖥️ Instalasi di VPS / Linux

### Langkah 1 — Install Node.js v20

```bash
# Update sistem
apt update && apt upgrade -y

# Install curl jika belum ada
apt install -y curl git

# Install Node.js v20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verifikasi
node -v   # → v20.x.x
npm -v    # → 10.x.x
```

> Untuk **CentOS/RHEL/Fedora**:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
> yum install -y nodejs
> ```

### Langkah 2 — Upload & Extract SC

```bash
# Upload via SCP dari PC ke VPS
scp manzkymd.zip user@ip-vps:/root/

# Di VPS, extract
cd /root
unzip manzkymd.zip
cd manzkymd

# Atau clone via git
git clone <repo-url> manzkymd
cd manzkymd
```

### Langkah 3 — Install Dependencies

```bash
npm install
```

> Jika ada error saat `npm install`, coba:
> ```bash
> npm install --legacy-peer-deps
> ```

### Langkah 4 — Konfigurasi

```bash
nano config.js
# Isi owner number, bot name, dll
# Ctrl+S untuk save, Ctrl+X untuk keluar
```

### Langkah 5 — Jalankan

```bash
node index.js
```

---

## 🖥️ Instalasi di Panel (Pterodactyl)

Panel hosting seperti **Pterodactyl**, **Pelican**, **NodeJS Shared Hosting**, dll.

### Setup di Pterodactyl

1. **Buat Server Baru:**
   - Pilih egg: `Node.js` (atau upload egg khusus WA bot)
   - Node.js version: `20` atau `latest`
   - Startup command: `node index.js`
   - RAM: minimal 256 MB

2. **Upload SC:**
   - Buka **File Manager** di panel
   - Upload file `manzkymd.zip`
   - Klik kanan → **Unarchive** / **Extract**
   - Pastikan `index.js` ada di root folder server

3. **Install Dependencies:**
   - Buka **Console** di panel
   - Jalankan: `npm install`

4. **Konfigurasi:**
   - Buka `config.js` di File Manager
   - Edit owner, nama bot, dll
   - Save

5. **Start Server:**
   - Klik tombol **Start** di panel
   - Lihat log di **Console** untuk pairing code

### Panel Alternatif (Koyeb, Railway, Render)

```bash
# Startup command di platform:
node index.js

# Environment variables (opsional):
NODE_ENV=production
```

> ⚠️ Beberapa platform gratis (Render free tier, dll) akan **sleep** jika tidak ada traffic. Gunakan VPS untuk bot yang harus jalan 24/7.

---

## 📱 Instalasi di Termux (Android)

### Langkah 1 — Setup Termux

Download Termux dari **F-Droid** (bukan Play Store — versi Play Store outdated).
Link: https://f-droid.org/packages/com.termux/

```bash
# Update Termux
pkg update && pkg upgrade -y

# Install packages yang diperlukan
pkg install nodejs git unzip -y

# Verifikasi
node -v   # harus v18+
```

### Langkah 2 — Upload SC ke Termux

**Via Bluetooth/USB/File Manager:**
```bash
# Aktifkan akses storage
termux-setup-storage

# Copy dari download
cp ~/storage/downloads/manzkymd.zip ~/
cd ~
unzip manzkymd.zip
cd manzkymd
```

**Via Git:**
```bash
git clone <repo-url> manzkymd
cd manzkymd
```

### Langkah 3 — Install & Jalankan

```bash
npm install
nano config.js   # edit konfigurasi
node index.js
```

### Langkah 4 — Bot Tetap Jalan di Background

Gunakan **tmux** agar bot tidak mati saat Termux ditutup:

```bash
# Install tmux
pkg install tmux -y

# Buat session baru
tmux new -s manzxy

# Jalankan bot di dalam tmux
node index.js

# Untuk keluar dari tmux TANPA matiin bot:
# Tekan: Ctrl + B, lalu D

# Untuk kembali ke tmux:
tmux attach -t manzxy

# Lihat semua session:
tmux ls

# Hapus session:
tmux kill-session -t manzxy
```

> 💡 **Tips Termux:** Aktifkan **"Acquire Wakelock"** di notifikasi Termux agar bot tidak dimatikan Android saat layar mati.

---

## ⚙️ Konfigurasi Bot

Edit file **`config.js`**:

```js
const config = {
    // ── Prefix command (bisa lebih dari satu)
    prefa: ["."],              // contoh multiple: [".", "!", "#"]

    // ── Nomor owner (format internasional, tanpa tanda +)
    owner: ['6281234567890'],  // ← WAJIB DIISI NOMOR KAMU

    // ── LID owner — biasanya tidak perlu diisi
    // Jika bot tidak mengenali kamu sebagai owner, cek log untuk LID
    ownerLid: [],

    // ── Info bot
    nameBot:  "NamaBot",       // nama bot yang ditampilkan
    nameOwn:  "NamaMu",        // nama owner
    version:  "2.0",
    thumbnail: "https://link-foto.jpg",   // foto thumbnail menu (URL)

    // ── Telegram backup (opsional — isi jika mau auto-backup ke Telegram)
    telegram: {
        token:   "",           // kosongkan jika tidak pakai
        chat_id: ""
    },

    // ══════════════════════════════════════════════
    // 🏪 SEWABOT — sistem sewa bot ke grup
    // Daftar API key: https://restapi.heroikzre.my.id
    // ══════════════════════════════════════════════
    sewabot: {
        enabled: true,         // false = nonaktifkan
        apikey:  "ISI_API_KEY_DI_SINI",
        harga: {
            "1bulan":  15000,  // Rp 15.000
            "3bulan":  40000,  // Rp 40.000
            "6bulan":  75000,  // Rp 75.000
            "1tahun":  140000, // Rp 140.000
        },
        durasi: {
            "1bulan":  30  * 24 * 3600 * 1000,
            "3bulan":  90  * 24 * 3600 * 1000,
            "6bulan":  180 * 24 * 3600 * 1000,
            "1tahun":  365 * 24 * 3600 * 1000,
        },
        paymentTimeout: 15,    // QRIS berlaku X menit
    },
};

const init = {
    session: "./session",
    customPair: "KODEPAIRMU",  // bebas diubah, 4-8 karakter

    // "pairing" = login pakai kode (rekomendasi)
    // "qr"      = login pakai scan QR
    loginMethod: "pairing",
};
```

---

## ▶️ Cara Menjalankan

### Opsi 1: Node langsung (testing)

```bash
node index.js
```

Bot akan berjalan di foreground. Jika terminal ditutup, bot mati.

### Opsi 2: Nohup (background sederhana)

```bash
# Jalankan di background
nohup node index.js > logs/output.log 2>&1 &

# Lihat PID
echo $!

# Lihat log
tail -f logs/output.log

# Stop bot
kill $(pgrep -f "node index.js")
```

### Opsi 3: PM2 (REKOMENDASI untuk VPS/production)

Lihat bagian [PM2 di bawah](#-menjalankan-dengan-pm2-rekomendasi).

---

## 🔁 Menjalankan dengan PM2 (Rekomendasi)

PM2 adalah process manager yang membuat bot:
- ✅ Otomatis restart jika crash
- ✅ Tetap jalan setelah terminal/SSH ditutup
- ✅ Auto-start saat VPS reboot
- ✅ Monitoring RAM/CPU

### Install PM2

```bash
npm install -g pm2
```

### Jalankan Bot

```bash
# Cara 1: pakai ecosystem.config.js (sudah tersedia)
pm2 start ecosystem.config.js

# Cara 2: langsung
pm2 start index.js --name manzxymd
```

### Perintah PM2 Harian

```bash
pm2 status              # lihat status semua proses
pm2 logs manzxymd       # lihat log realtime
pm2 logs manzxymd --lines 100  # lihat 100 baris log terakhir
pm2 restart manzxymd    # restart bot
pm2 stop manzxymd       # stop bot
pm2 start manzxymd      # start bot (sudah ada di PM2 list)
pm2 delete manzxymd     # hapus dari PM2 list
pm2 monit               # monitor interaktif (CPU + RAM)
```

### Auto-start Saat Server Reboot

```bash
# Jalankan ini SEKALI setelah pertama kali setup PM2
pm2 startup

# Ikuti instruksi yang muncul (biasanya ada command sudo yang perlu dijalankan)
# Contoh output:
# [PM2] To setup the Startup Script, copy/paste the following command:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Setelah jalankan command itu, simpan konfigurasi saat ini:
pm2 save
```

### Konfigurasi PM2 (`ecosystem.config.js`)

File ini sudah ada di SC. Pengaturan penting:

```js
module.exports = {
    apps: [{
        name: 'manzxymd',
        script: 'index.js',
        max_memory_restart: '500M',  // restart jika RAM > 500MB
        max_restarts: 10,            // max 10 restart otomatis
        restart_delay: 5000,         // tunggu 5 detik sebelum restart
        // ...
    }]
};
```

Untuk VPS RAM kecil (256MB), turunkan `max_memory_restart` ke `'200M'`.

---

## 🔑 Login WhatsApp

### Metode 1: Pairing Code (Default, Rekomendasi)

1. Jalankan bot: `node index.js` atau `pm2 start ecosystem.config.js`
2. Tunggu prompt: `[LOGIN] Nomor HP (628xxx):`
3. Ketik nomor HP format internasional: `628123456789`
4. Bot tampilkan **8-digit pairing code** di terminal
5. Di WhatsApp:
   - **Setelan** → **Perangkat Tertaut** → **Tautkan Perangkat**
   - Pilih **"Tautkan dengan Nomor Telepon"**
   - Masukkan kode 8 digit
6. Tunggu 10-30 detik → bot kirim notifikasi "Bot Aktif"

### Metode 2: QR Code

1. Edit `config.js`:
   ```js
   loginMethod: "qr"
   ```
2. Jalankan bot → scan QR yang muncul di terminal
3. QR berlaku 3 menit

### Session Tersimpan Otomatis

Setelah login berhasil, session tersimpan di folder `session/main/`.
Bot tidak perlu login ulang saat restart (kecuali session corrupt/logout).

> ⚠️ **JANGAN** hapus folder `session/` kecuali memang ingin login ulang dari awal.
>
> ✅ Backup session secara berkala dengan perintah `.backupsc` di chat.

---

## 🏪 Sistem Sewa Bot ke Grup

Bot bisa **join ke grup orang lain** setelah mereka bayar via QRIS.

### Setup Sewabot

1. Daftar di https://restapi.heroikzre.my.id untuk dapat API key
2. Isi `apikey` di `config.js` bagian `sewabot`
3. Set harga sesuai keinginan

### Alur Sewa (dari sisi user)

```
1. User ketik: .sewabot
   → Bot tampilkan info paket & harga

2. User ketik: .sewa 1bulan
   → Bot kirim gambar QRIS + keterangan nominal

3. User bayar QRIS via aplikasi bank/e-wallet

4. User ketik: .cekpayment
   → Bot verifikasi ke API
   → Jika berhasil: bot minta link grup

5. User kirim link grup:
   https://chat.whatsapp.com/AbCdEf123456

6. Bot otomatis join grup + kirim pesan sambutan
   → Bot aktif di grup selama masa sewa
```

### Perpanjang Sewa

```
User ketik: .perpanjang 1bulan
→ Bot kirim QRIS baru
→ Bayar → .cekpayment
→ Masa sewa ditambah dari tanggal expired lama
```

### Bot Keluar Otomatis

Saat sewa expired:
- Bot kirim notif ke grup: "Masa sewa berakhir"
- Bot kirim notif ke owner sewa via DM
- Bot keluar dari grup secara otomatis

### Commands Sewabot

| Command | Akses | Fungsi |
|---------|-------|--------|
| `.sewabot` | Semua | Info paket & cara sewa |
| `.sewa <paket>` | Semua | Buat QRIS pembayaran |
| `.cekpayment` | Semua | Verifikasi pembayaran |
| `.linkgrup <link>` | Semua | Kirim link grup setelah bayar |
| `.perpanjang <paket>` | Semua | Perpanjang sewa |
| `.ceksewa` | Semua | Status sewa aktif milikku |
| `.listsewa` | Owner | Semua grup yang disewa |
| `.addsewa <link> <paket>` | Owner | Aktifkan manual |
| `.delsewa <groupJid>` | Owner | Hapus sewa + bot keluar |

---

## 🔌 Plugin Manager

Tambah, update, atau hapus plugin **langsung dari WhatsApp** tanpa perlu akses server.

### Cara Pakai Dasar

```
.plugin              → info + daftar semua command
.plugin list         → semua plugin CJS + ESM
.plugin list cjs     → CJS saja
.plugin list esm     → ESM saja
.plugin reload       → force reload semua cache
```

### Tambah Plugin Baru

1. Kirim kode plugin sebagai **pesan biasa** di chat dengan bot
2. **Reply** pesan kode tersebut dengan:
   ```
   .plugin + namafile.js
   ```
3. Plugin **langsung aktif** tanpa restart bot!

**Contoh:**
```
.plugin + tools-kalkulator.js      → CJS plugin
.plugin + tools-api.mjs esm        → ESM plugin
```

### Timpa Plugin yang Sudah Ada

Cukup kirim kode baru dan `.plugin + namafile.js` — file lama **langsung ditimpa**.
Tidak perlu hapus dulu.

### Format Plugin CJS (CommonJS)

```js
'use strict';

const handler = async (m, {
    manzxy, args, text, reply,
    isOwn, isPrem, senderJid, senderNum,
    from, command
}) => {
    // kode plugin di sini
    reply('Halo dari plugin!');
};

handler.command  = ['hello'];       // command(s)
handler.tags     = ['misc'];        // kategori menu
handler.limit    = false;           // pakai limit? true/false
handler.owner    = false;           // owner only?
handler.premium  = false;           // premium only?
handler.group    = false;           // grup only?
handler.private  = false;           // private only?

handler.fitur = {
    'hello': 'Sapaan dari plugin',  // deskripsi di menu
};

module.exports = handler;
```

### Flag Handler Tersedia

| Flag | Nilai | Fungsi |
|------|-------|--------|
| `handler.owner` | `true` | Hanya owner bot |
| `handler.premium` | `true` | Hanya premium/owner |
| `handler.group` | `true` | Hanya di grup |
| `handler.private` | `true` | Hanya di private chat |
| `handler.admin` | `true` | Hanya admin grup |
| `handler.botAdmin` | `true` | Bot harus jadi admin |
| `handler.limit` | `true` | Potong limit user |
| `handler.limitCost` | number | Berapa limit dipotong (default: 1) |
| `handler.mainOnly` | `true` | Hanya dari bot utama (bukan jadibot) |

### Commands Plugin Manager

| Command | Fungsi |
|---------|--------|
| `.plugin list` | Semua plugin |
| `.plugin list cjs` / `esm` | Filter tipe |
| `.plugin + nama.js` | Tambah/timpa CJS |
| `.plugin + nama.mjs esm` | Tambah/timpa ESM |
| `.plugin - <nomor>` | Hapus CJS |
| `.plugin - <nomor> esm` | Hapus ESM |
| `.plugin ? <nomor>` | Lihat isi CJS |
| `.plugin ? <nomor> esm` | Lihat isi ESM |
| `.plugin reload` | Force reload cache |

---

## 📝 Perintah Penting

### Perintah Owner

| Command | Fungsi |
|---------|--------|
| `.restart` | Restart bot |
| `.shutdown` | Matikan bot |
| `.plugin list` | Kelola plugin |
| `.addprem @tag` | Tambah premium |
| `.delprem @tag` | Hapus premium |
| `.addowner @tag` | Tambah owner |
| `.delowner @tag` | Hapus owner |
| `.ban @tag` | Ban user |
| `.unban @tag` | Unban user |
| `.backupsc` | Backup session ke Telegram |
| `.jadibot <nomor>` | Buat bot baru |
| `.listjadibot` | Lihat semua jadibot |
| `.stopjadibot <nomor>` | Stop jadibot |
| `.listsewa` | Semua grup sewa |

### Perintah Grup (Admin)

| Command | Fungsi |
|---------|--------|
| `.welcome on/off` | Aktifkan/matikan welcome |
| `.setwelcome <teks>` | Atur teks welcome |
| `.mute` / `.unmute` | Diam/aktif di grup |
| `.adminonly on/off` | Mode admin only |
| `.antilink on/off` | Anti link |
| `.warn @tag` | Peringatkan user |
| `.kick @tag` | Kick member |
| `.add <nomor>` | Tambah member |

### Perintah Umum

| Command | Fungsi |
|---------|--------|
| `.menu` | Tampilkan menu |
| `.ping` | Cek kecepatan bot |
| `.limit` | Cek sisa limit |
| `.daftar` | Daftar akun |
| `.ceksewa` | Status sewa bot di grupmu |

---

## 🛠️ Troubleshooting

### ❌ Bot tidak proses pesan sama sekali (stuck)

**Gejala:** Bot online di WA, tapi tidak membalas pesan apapun.

**Penyebab paling umum:** Session signal key corrupt atau incompatible logger.

**Solusi:**
```bash
# 1. Stop bot
pm2 stop manzxymd
# atau: Ctrl+C jika node langsung

# 2. Hapus session dan login ulang
rm -rf session/
node index.js
# atau pm2 start ecosystem.config.js
```

---

### ❌ Error: `Cannot find module '...'`

```bash
# Hapus node_modules dan install ulang
rm -rf node_modules
npm install
```

---

### ❌ Bot disconnect terus / reconnect loop

**Kemungkinan penyebab:**
1. Koneksi internet tidak stabil
2. WA mendeteksi spam → throttle koneksi
3. Session corrupt

**Solusi:**
```bash
# Cek log untuk detail kode disconnect
pm2 logs manzxymd

# Jika error 440 (multidevice conflict):
# → Buka WA di HP → Perangkat Tertaut → hapus perangkat lama

# Jika error 403 (banned):
rm -rf session/
# Gunakan nomor baru

# Jika error loggedOut/401:
rm -rf session/
node index.js
```

---

### ❌ `SQLITE_BUSY` atau database locked

```bash
# Stop bot
pm2 stop manzxymd

# Hapus file WAL yang stuck
rm -f database/*.db-shm database/*.db-wal

# Start ulang
pm2 start manzxymd
```

---

### ❌ RAM terus naik / memory leak

Bot sudah dilengkapi memory cleanup otomatis setiap 10 menit.

Jika tetap naik, gunakan PM2 dengan `max_memory_restart`:
```js
// ecosystem.config.js
max_memory_restart: '300M'  // turunkan sesuai RAM VPS
```

---

### ❌ Owner tidak dikenali / command owner tidak jalan

**Langkah debug:**
1. Pastikan nomor di `config.js` sudah benar:
   ```js
   owner: ['6281234567890']  // tanpa +, tanpa strip
   ```
2. Jalankan dengan debug mode:
   ```bash
   DEBUG_OWNER=1 node index.js
   ```
   Lihat output `[OWNER CHECK]` di terminal untuk detail.

3. Jika WA kamu pakai LID (nomor tidak terdeteksi), cek log:
   ```
   [PV_DEBUG] rawJid: 208843271364847@lid
   ```
   Copy LID tersebut ke `config.js`:
   ```js
   ownerLid: ['208843271364847@lid']
   ```

---

### ❌ Bot tidak bisa join grup (sewabot)

**Kemungkinan:**
- Link grup expired → minta user generate link baru (`.resetlink` di grup)
- Bot di-ban dari grup → tidak bisa join
- Link sudah dipakai terlalu banyak

**Solusi owner manual:**
```
.addsewa <groupJid> 1bulan 628xxx
```

---

### ❌ Jadibot tidak muncul setelah restart

Bot utama **otomatis resume** semua jadibot 6 detik setelah koneksi open.
Jika tidak resume:
```
.startjadibot 628xxx   (dari chat dengan bot utama)
```

---

### ❌ Plugin tidak aktif setelah di-.plugin +

Coba:
```
.plugin reload
```

Jika masih tidak aktif, cek apakah kode plugin punya syntax error dengan mengirimnya ke [validator JS online](https://jshint.com).

---

## ❓ FAQ

**Q: Apakah bot bisa jalan 24/7 di HP biasa (non-root)?**
A: Ya, pakai Termux + tmux. Tapi HP harus tetap menyala, dan aktifkan "Acquire Wakelock" di Termux.

**Q: Berapa maksimal jadibot aktif bersamaan?**
A: Default: 2 (free), 5 (premium), 20 (global). Bisa diubah di `.setjadibotlimit`.

**Q: Apakah data user tersimpan saat bot restart?**
A: Ya, semua data disimpan di SQLite (`database/bot.db`) — permanen.

**Q: Bagaimana cara backup session?**
A: Ketik `.backupsc` di chat dengan bot (perlu konfigurasi Telegram token).
   Atau backup manual: compress dan download folder `session/`.

**Q: Bot tiba-tiba logout sendiri, kenapa?**
A: Kemungkinan WA mendeteksi aktivitas mencurigakan, atau kamu login di perangkat lain.
   Solusi: hindari spam command, gunakan bot secara wajar.

**Q: Apakah bisa pakai lebih dari 1 nomor owner?**
A: Ya, tambahkan nomor di `config.js`:
   ```js
   owner: ['6281234567890', '6287654321098']
   ```
   Atau gunakan `.addowner @tag` dari chat.

---

## 📁 Struktur Folder

```
manzxymd/
│
├── index.js              ← Entry point utama
├── manzxy.js             ← Message handler & middleware
├── config.js             ← KONFIGURASI BOT (edit di sini)
├── ecosystem.config.js   ← Config PM2
├── package.json
│
├── session/              ← ⚠️ Session WA (JANGAN dihapus)
│   └── main/             ← Session bot utama (SQLite)
│   └── jadibot/          ← Session jadibot (JSON per folder)
│       └── 628xxx/
│
├── database/             ← Data users, groups, settings
│   └── bot.db            ← SQLite database utama
│
├── logs/                 ← Log output PM2
│
└── src/
    ├── core/
    │   ├── logger.js         ← Logger berwarna
    │   ├── message.js        ← Utilitas pesan Baileys
    │   └── media.js          ← Handler download/upload media
    │
    ├── lib/
    │   ├── database.js       ← SQLite DB manager
    │   ├── handler.js        ← CJS plugin loader (mtime cache)
    │   ├── handle.mjs        ← ESM plugin loader (mtime cache)
    │   ├── jadibot.js        ← Multi-bot engine
    │   ├── jid-utils.js      ← LID/JID resolution utilities
    │   ├── sqlite-session.js ← Baileys session di SQLite
    │   ├── json-session.js   ← Baileys session JSON (jadibot)
    │   ├── exif.js           ← Sticker metadata handler
    │   └── heroikzrePayment.js ← Payment QRIS API
    │
    └── plugins/
        ├── cjs/              ← Plugin CommonJS (.js)  ← TAMBAH DI SINI
        └── esm/              ← Plugin ES Module (.mjs) ← ATAU DI SINI
```

---

## 🔒 Tips Keamanan

1. **Jangan share session** ke siapapun — session = akses penuh ke WA kamu
2. **Backup session** secara berkala
3. **Jangan aktifkan mode public** di bot yang punya eval/shell command
4. **Batasi owner** hanya ke nomor yang dipercaya
5. **Gunakan HTTPS** jika mengekspos bot ke API publik

---

<div align="center">

**ManzxyMD** dibuat dengan ❤️ oleh **Manzxy**

*Jika ada bug, laporkan via WhatsApp/Telegram*

</div>
