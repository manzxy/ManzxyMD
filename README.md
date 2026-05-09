<div align="center">

![ManzxyMD](https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=ManzxyMD&fontSize=70&fontColor=fff&animation=twinkling&fontAlignY=38&desc=WhatsApp%20Bot%20Multi-Platform&descAlignY=62&descAlign=50)

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=A855F7&center=true&vCenter=true&multiline=true&width=600&height=80&lines=🤖+Bot+WhatsApp+Multi-Session;⚡+Ringan+%7C+Cepat+%7C+Stabil;🛡️+Anti-Reconnect+Storm)](https://github.com/manzxy/ManzxyMD)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-Latest-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-CC--BY--NC--4.0-blue?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Termux%20%7C%20VPS%20%7C%20Panel-FF6B35?style=for-the-badge)](https://github.com/manzxy/ManzxyMD)

[![Stars](https://img.shields.io/github/stars/manzxy/ManzxyMD?style=social)](https://github.com/manzxy/ManzxyMD/stargazers)
[![Forks](https://img.shields.io/github/forks/manzxy/ManzxyMD?style=social)](https://github.com/manzxy/ManzxyMD/network/members)

> **ManzxyMD v2.1** adalah WhatsApp Bot berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) yang ringan, stabil, dan mendukung multi-session (JadiBot).
> Dibangun dengan fokus pada stabilitas koneksi — tidak ada reconnect storm, tidak ada lag server.

[📦 Download ZIP](#-instalasi) · [💬 Contact](https://wa.me/6288989721627) · [⭐ Star This Repo](https://github.com/manzxy/ManzxyMD)

</div>

---

## ✨ Fitur Unggulan

|  |  |
|--|--|
| 🤖 **Core** <br>✅ Login via **Pairing Code** atau **QR** <br>✅ **Auto-reconnect** exponential backoff (maks 60s) <br>✅ **Circuit breaker** — pause otomatis jika gagal berulang <br>✅ **Multi-session** — JadiBot (banyak nomor sekaligus) <br>✅ Database **SQLite WAL mode** (tidak korup, atomic write) <br>✅ Plugin system **CJS + ESM** (hot-reload tiap 60 detik) <br>✅ **LID support** penuh (WhatsApp versi terbaru) <br>✅ **MessageCounterError auto-recovery** (clear keys + reconnect) | ⚡ **Performance** <br>✅ RAM **80–150 MB** saat idle <br>✅ Startup **< 5 detik** (pairing mode) <br>✅ Plugin cache **60 detik** (hemat I/O disk) <br>✅ Status store auto-cleanup **tiap 6 jam** <br>✅ Optimized untuk **Termux / low-spec VPS** <br>✅ WAL + 32MB mmap + 16MB cache (query stabil) <br>✅ Memory auto-trim **tiap 10 menit** |
| 🛡️ **Anti-Ban** <br>✅ **Throttle sendMessage** — delay antar pesan (konfigurabel) <br>✅ **Rate limit per user** — 10 cmd / 10 detik via DB <br>✅ **markOnlineOnConnect: false** — tidak broadcast online <br>✅ **Self-mode** toggle: `.self` / `.public` <br>✅ **autoRead** opsional (off by default — lebih aman) | 🔁 **Stability v2.1** <br>✅ **Circuit breaker** — stop reconnect storm ke server WA <br>✅ **Double-reconnect guard** — `_closeHandled` flag <br>✅ **`_reconnecting` guard** — tidak ada dua proses reconnect barengan <br>✅ **Heartbeat** 10 menit / threshold 3x / start delay 60s <br>✅ **Bad MAC level 0** — clear keys saja, tidak reconnect |

---

## 🔁 Changelog Stability (v2.1)

| Masalah | Fix |
|---|---|
| Reconnect terus tanpa henti, server lag | **Circuit breaker**: pause 3 menit jika gagal ≥5x / 2 menit |
| WS close + connection.update keduanya trigger reconnect | **`_closeHandled` flag** — hanya satu yang diproses |
| Dua proses reconnect jalan barengan | **`_reconnecting` guard** |
| Heartbeat terlalu sensitif → false positive reconnect | Interval 10 menit, threshold 3x, delay start 60s |
| Bad MAC langsung reconnect meski tidak perlu | Level 0 hanya clear signal keys — tidak putus koneksi |
| Backoff maks 30s, counter reset → backoff pendek terus | Backoff maks 60s, counter tidak pernah reset |
| Kode 440 tunggu 15s — terlalu singkat | Naik ke 30s agar instance lain sempat mati |
| JadiBot retry linear sampai 15x | Exponential backoff (maks 90s), stop di 10x |
| SQLite busy_timeout 15s | Naik ke 30s — toleran VPS lambat |
| WAL checkpoint tiap 20 menit | Tiap 10 menit — WAL tidak bloat |

---

## 📦 Ukuran & Resource

| Kondisi | RAM | Keterangan |
|---------|-----|------------|
| Idle | 80–150 MB | Tanpa JadiBot aktif |
| + JadiBot | +30–50 MB/bot | Per nomor yang aktif |
| ZIP source | ~220 KB | Tanpa `node_modules` |
| Setelah install | ~250–350 MB | Termasuk dependencies |

---

## 🖥️ Persyaratan Sistem

| | Minimum | Rekomendasi |
|---|---------|-------------|
| **Node.js** | v18.x | v20.x / v22.x LTS |
| **RAM** | 256 MB | 512 MB+ |
| **Storage** | 500 MB | 1 GB+ |
| **OS** | Linux / Termux | Ubuntu 20.04+ |

---

## 📦 Instalasi

```bash
# 1. Clone
git clone https://github.com/manzxy/ManzxyMD
cd ManzxyMD

# 2. Install
npm install

# 3. Edit config
nano config.js

# 4. Jalankan
node index.js

# Atau pakai PM2 (VPS):
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

---

## ⚙️ Konfigurasi (`config.js`)

```js
const config = {
    owner:   ['628xxxx'],    // nomor owner — wajib diisi
    nameBot: 'ManzxyMD',
    nameOwn: 'Manzxy',

    selfMode:       false,   // true = owner only | false = semua orang
                             // toggle live: .self / .public

    antiBan:        true,    // throttle pesan keluar
    antiBanDelay:   800,     // ms jeda antar pesan — naikkan ke 1500+ jika banyak grup

    autoRead:       false,   // auto centang biru — matikan untuk keamanan
    presenceOnline: false,   // broadcast online — matikan untuk hemat

    sewabot: {
        enabled: true,
        apikey:  'APIKEY_HEROIKZRE',
        harga: { '1bulan': 15000, '3bulan': 40000, '6bulan': 75000, '1tahun': 140000 },
    },

    telegram: { token: 'BOT_TOKEN', chat_id: 'CHAT_ID' },
};
```

---

## 🔧 Perintah Owner

| Command | Fungsi |
|---------|--------|
| `.self` / `.public` | Toggle mode bot |
| `.mode` | Cek mode saat ini |
| `.ping` | Status & latency |
| `.runtime` | RAM & uptime |
| `.restart` | Restart bot |
| `.errlog` | 10 error terakhir |
| `.totalfitur` | Semua plugin aktif |
| `.clearkeys` | Fix Bad MAC manual |
| `> kode` | Eval JS |
| `=> kode` | Eval JS async |
| `$ perintah` | Exec bash |
| `.sf upload` | Upload plugin via WA |
| `.github push` | Push ke GitHub |

---

## 🤖 Auto-Fix System

| Error | Aksi |
|-------|------|
| Bad MAC / MessageCounterError (jarang) | Clear signal keys — **tidak** reconnect |
| Bad MAC berulang >8x / 5 menit | Clear semua keys kecuali creds + reconnect |
| Bad MAC berulang >20x / 5 menit | Delete session + alert owner |
| Heartbeat gagal 3x berturut | Reconnect (zombie connection) |
| Gagal reconnect ≥5x / 2 menit | Circuit breaker — pause 3 menit |
| Stream error / ECONNRESET | Cleanup + reconnect setelah 5s |
| Error berulang >5x / 5 menit | Alert WA ke owner |

---

## 🔌 Cara Tambah Plugin

Buat file di `src/plugins/cjs/nama-plugin.js`:

```js
'use strict';

const handler = async (m, { reply, isOwn, isAdmin, manzxy }) => {
    reply('Hello dari plugin baru!');
};

handler.command   = ['hello', 'hi'];
handler.tags      = ['tools'];
handler.limit     = true;
handler.limitCost = 1;
handler.owner     = false;
handler.group     = false;
handler.private   = false;

handler.fitur = {
    'hello': 'Sapa pengguna',
};

module.exports = handler;
```

> ⚠️ **Penting:** Helper/config bersama wajib di `src/lib/` — jangan di `src/plugins/` (cache 30 detik, tidak reliable untuk shared state).

Hot-reload otomatis tiap **60 detik** — tidak perlu restart.

---

## 📁 Struktur

```
ManzxyMD/
├── index.js              # Entry point + banner
├── manzxy.js             # Message handler utama
├── config.js             # Config ⬅ edit di sini
├── ecosystem.config.js   # PM2
├── src/
│   ├── core/
│   │   ├── connection.js # WA socket + circuit breaker + reconnect
│   │   ├── cleanup.js    # Memory/WAL/tmp cleanup
│   │   ├── logger.js     # Logger v5 + AI monitor
│   │   ├── message.js    # smsg parser
│   │   ├── store.js      # In-memory store
│   │   └── scheduler.js  # Cron
│   ├── lib/
│   │   ├── database.js        # SQLite ORM
│   │   ├── handler.js         # CJS plugin loader
│   │   ├── handle.mjs         # ESM plugin loader
│   │   ├── jadibot.js         # JadiBot engine
│   │   ├── sqlite-session.js  # Session WAL
│   │   └── json-session.js    # Session JadiBot
│   └── plugins/
│       ├── cjs/          # ← tambah plugin di sini
│       └── esm/
└── session/              # Auto-created
```

---

## ❓ FAQ

**Q: Bot terus reconnect / log spam connecting?**
> Circuit breaker otomatis pause 3 menit jika gagal ≥5x dalam 2 menit. Double-trigger dari WS close + connection.update sudah diguard dengan `_closeHandled` flag.

**Q: Bad MAC terus muncul walau `.clearkeys`?**
> Auto-fix bertahap: level 0 (jarang) hanya clear keys, level 1 (>8x) clear semua, level 2 (>20x) delete session + alert owner. Jika level 2 sudah jalan dan masih terjadi, lakukan pairing ulang.

**Q: Server lag / CPU tinggi saat bot nyala?**
> Penyebab biasa: reconnect storm (sekarang sudah ada circuit breaker), heartbeat terlalu sering (sekarang 10 menit), atau WAL SQLite bloat (checkpoint tiap 10 menit). Pastikan `antiBan: true` dan `antiBanDelay` tidak terlalu rendah.

**Q: JadiBot gagal reconnect terus?**
> Exponential backoff — setelah 10x gagal, JadiBot masuk `stopped`. Resume dengan `.startjadibot nomor`.

**Q: Mode self balik public setelah reconnect?**
> Sudah diperbaiki — mode disimpan ke `global._botPublic`, di-restore otomatis setiap reconnect.

---
---

## 🙏 Thanks To / Credits

| Credit | Keterangan |
|--------|------------|
| [WJayadana](https://github.com/WJayadana) | Creator original / base original |
| [Manzxy](https://github.com/manzxy) | Recode + Rename |
| [Claude](https://claude.ai) | Fix bug, optimasi, dan penambahan fitur |
| [WhiskeySockets](https://github.com/WhiskeySockets/Baileys) | Library Baileys |
| [Node.js](https://nodejs.org) | Runtime JavaScript |

---

<div align="center">

**ManzxyMD v2.1** · Dibuat dengan ❤️ oleh [Manzxy](https://wa.me/6288989721627)

[![WhatsApp](https://img.shields.io/badge/Contact-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/6288989721627)

</div>
