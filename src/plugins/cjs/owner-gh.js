/**
 * owner-github.js — Upload file/folder/SC ke GitHub
 *
 * ─ COMMAND ───────────────────────────────────────────────────
 *  .github setup <token> <user/repo>  → simpan token & repo
 *  .github status                     → info repo & config
 *  .github upload                     → upload SC bot (exclude node_modules/session)
 *  .github file <path>                → upload 1 file spesifik
 *  .github folder <path>              → upload seluruh folder
 *  .github delete <path>              → hapus file dari repo
 *  .github list [path]                → lihat isi folder di repo
 *
 * ─ CARA PAKAI ────────────────────────────────────────────────
 *  1. Buat GitHub token: github.com → Settings → Developer → Tokens (classic)
 *     Centang scope: repo (full)
 *  2. .github setup ghp_xxx... username/namaRepo
 *  3. .github upload  ← upload otomatis semua SC
 *
 * ─ CATATAN ───────────────────────────────────────────────────
 *  - Pakai GitHub REST API → tidak perlu git CLI
 *  - File besar (>25MB) di-skip otomatis
 *  - Upload paralel (5 file sekaligus) untuk lebih cepat
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const axios = require('axios');

/* ── DB config — simpan token & repo di database bot ── */
const DB_KEY_TOKEN = '_github_token';
const DB_KEY_REPO  = '_github_repo';
const DB_KEY_BRANCH = '_github_branch';

function getDb() {
    return require('../../lib/database.js');
}

function getGithubConfig() {
    try {
        const db = getDb();
        const token  = db.getSetting(DB_KEY_TOKEN);
        const repo   = db.getSetting(DB_KEY_REPO);
        const branch = db.getSetting(DB_KEY_BRANCH) || 'main';
        return { token, repo, branch, ok: !!(token && repo) };
    } catch {
        return { ok: false };
    }
}

function saveGithubConfig(token, repo, branch = 'main') {
    const db = getDb();
    db.setSetting(DB_KEY_TOKEN, token);
    db.setSetting(DB_KEY_REPO, repo);
    db.setSetting(DB_KEY_BRANCH, branch);
}

/* ── GitHub API client ── */
function ghApi(token) {
    return axios.create({
        baseURL: 'https://api.github.com',
        headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'ManzxyMD-Bot',
        },
        timeout: 30_000,
    });
}

/* ── Cek apakah file sudah ada di repo (untuk ambil SHA) ── */
async function getFileSha(api, repo, branch, filePath) {
    try {
        const res = await api.get(`/repos/${repo}/contents/${filePath}?ref=${branch}`);
        return res.data?.sha || null;
    } catch {
        return null; // file belum ada
    }
}

/* ── Upload 1 file ke GitHub ── */
async function uploadFile(api, repo, branch, localPath, repoPath, message) {
    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
    const stat = fs.statSync(localPath);
    if (stat.size > MAX_SIZE) return { ok: false, reason: 'file_terlalu_besar' };

    const content = fs.readFileSync(localPath);
    const b64 = content.toString('base64');
    const sha = await getFileSha(api, repo, branch, repoPath);

    const body = {
        message: message || `update: ${repoPath}`,
        content: b64,
        branch,
    };
    if (sha) body.sha = sha; // update jika sudah ada

    await api.put(`/repos/${repo}/contents/${repoPath}`, body);
    return { ok: true };
}

/* ── Hapus file dari GitHub ── */
async function deleteFile(api, repo, branch, repoPath, message) {
    const sha = await getFileSha(api, repo, branch, repoPath);
    if (!sha) return { ok: false, reason: 'tidak_ada' };
    await api.delete(`/repos/${repo}/contents/${repoPath}`, {
        data: { message: message || `delete: ${repoPath}`, sha, branch },
    });
    return { ok: true };
}

/* ── Kumpulkan semua file dari folder rekursif ── */
const IGNORE_ALWAYS = [
    'node_modules', '.git', 'session', 'logs',
    'backup-*.zip', '*.db', '*.log', '.env',
];

function shouldIgnore(relPath) {
    const parts = relPath.replace(/\\/g, '/').split('/');
    const name  = parts[parts.length - 1];

    // Folder/file yang selalu di-skip
    for (const ig of IGNORE_ALWAYS) {
        if (ig.includes('*')) {
            // Glob sederhana: backup-*.zip → regex
            const pat = new RegExp('^' + ig.replace(/\*/g, '.*') + '$');
            if (pat.test(name)) return true;
        } else {
            if (parts.includes(ig) || name === ig) return true;
        }
    }
    return false;
}

function collectFiles(dir, base = '') {
    const result = [];
    if (!fs.existsSync(dir)) return result;

    for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const relPath  = base ? `${base}/${entry}` : entry;

        if (shouldIgnore(relPath)) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            result.push(...collectFiles(fullPath, relPath));
        } else {
            if (stat.size <= 25 * 1024 * 1024) { // skip > 25MB
                result.push({ local: fullPath, repo: relPath, size: stat.size });
            }
        }
    }
    return result;
}

/* ── Upload banyak file dengan concurrency limit ── */
async function uploadBatch(api, repo, branch, files, onProgress) {
    const CONCURRENCY = 5;
    let done = 0, failed = 0, skipped = 0;

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const chunk = files.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
            chunk.map(f => uploadFile(api, repo, branch, f.local, f.repo, `bot: update ${f.repo}`))
        );
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value?.ok) done++;
            else if (r.value?.reason === 'file_terlalu_besar') skipped++;
            else failed++;
        }
        if (onProgress) onProgress(done, failed, skipped, files.length);
        // Jeda kecil agar tidak rate-limit GitHub
        await new Promise(r => setTimeout(r, 200));
    }
    return { done, failed, skipped };
}

/* ── Format size ── */
function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ════════════════════════════════════════════════════════
   HANDLER
   ════════════════════════════════════════════════════════ */
const handler = async (m, { manzxy, args, reply, isOwn }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    const sub = (args[0] || '').toLowerCase();

    /* ── .github setup <token> <user/repo> [branch] ── */
    if (sub === 'setup') {
        const token  = args[1];
        const repo   = args[2];
        const branch = args[3] || 'main';

        if (!token || !repo) {
            return reply(
`❌ Format salah!

*.github setup <token> <user/repo> [branch]*

Contoh:
*.github setup ghp_xxxx manzxy/botku main*

📌 Cara buat token:
github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
Centang scope: *repo* (full access)`
            );
        }

        // Validasi token & repo dengan cek API
        reply('⏳ Mengecek token & repo...');
        try {
            const api = ghApi(token);
            const res = await api.get(`/repos/${repo}`);
            const info = res.data;
            saveGithubConfig(token, repo, branch);
            return reply(
`✅ *GitHub berhasil dikonfigurasi!*

📦 Repo   : *${repo}*
🌿 Branch : *${branch}*
⭐ Stars  : ${info.stargazers_count}
🔒 Visib  : ${info.private ? 'Private' : 'Public'}

Sekarang bisa pakai:
• *.github upload* — upload semua SC bot
• *.github file <path>* — upload 1 file
• *.github folder <path>* — upload folder`
            );
        } catch (e) {
            const msg = e.response?.status === 401
                ? 'Token tidak valid atau expired.'
                : e.response?.status === 404
                ? 'Repo tidak ditemukan. Pastikan format: username/namaRepo'
                : e.message;
            return reply(`❌ Gagal: ${msg}`);
        }
    }

    /* ── Semua command di bawah butuh config ── */
    const cfg = getGithubConfig();

    /* ── .github status ── */
    if (sub === 'status' || sub === 'info') {
        if (!cfg.ok) {
            return reply(
`⚠️ GitHub belum dikonfigurasi.

Gunakan: *.github setup <token> <user/repo>*`
            );
        }
        try {
            const api = ghApi(cfg.token);
            const res = await api.get(`/repos/${cfg.repo}`);
            const info = res.data;
            const sizeKb = info.size;
            return reply(
`📊 *GitHub Config*

📦 Repo      : *${cfg.repo}*
🌿 Branch    : *${cfg.branch}*
🔒 Visib     : ${info.private ? '🔒 Private' : '🌐 Public'}
⭐ Stars     : ${info.stargazers_count}
💾 Ukuran    : ${sizeKb > 1024 ? (sizeKb/1024).toFixed(1)+' MB' : sizeKb+' KB'}
📝 Deskripsi : ${info.description || '-'}
🔗 URL       : ${info.html_url}`
            );
        } catch (e) {
            return reply(`❌ Gagal cek repo: ${e.message}`);
        }
    }

    if (!cfg.ok) {
        return reply('⚠️ GitHub belum dikonfigurasi.\n\n*.github setup <token> <user/repo>*');
    }

    const api    = ghApi(cfg.token);
    const repo   = cfg.repo;
    const branch = cfg.branch;

    /* ── .github upload — upload seluruh SC bot ── */
    if (sub === 'upload' || sub === 'sc') {
        const rootDir = process.cwd();
        reply('📂 Mengumpulkan file...');

        const files = collectFiles(rootDir);
        const totalSize = files.reduce((a, f) => a + f.size, 0);

        await reply(
`📦 *Siap upload SC ke GitHub*

📁 Total file : *${files.length}*
💾 Total size : *${fmtSize(totalSize)}*
📦 Repo       : *${repo}*
🌿 Branch     : *${branch}*

⏳ Mulai upload... (ini butuh waktu)`
        );

        let lastNotif = Date.now();
        const { done, failed, skipped } = await uploadBatch(
            api, repo, branch, files,
            (done, failed, skipped, total) => {
                // Update progres setiap 10 detik
                if (Date.now() - lastNotif > 10_000) {
                    lastNotif = Date.now();
                    const pct = Math.round((done + failed + skipped) / total * 100);
                    manzxy.sendMessage(m.chat, {
                        text: `⏳ Upload progress: ${done + failed + skipped}/${total} (${pct}%)\n✅ OK: ${done} | ❌ Gagal: ${failed} | ⏭️ Skip: ${skipped}`
                    }, { quoted: m }).catch(() => {});
                }
            }
        );

        return reply(
`${failed === 0 ? '✅' : '⚠️'} *Upload Selesai!*

✅ Berhasil : *${done}* file
❌ Gagal    : *${failed}* file
⏭️ Di-skip  : *${skipped}* file (>25MB)

🔗 ${`https://github.com/${repo}/tree/${branch}`}`
        );
    }

    /* ── .github file <localPath> [repoPath] ── */
    if (sub === 'file') {
        const localRel = args[1];
        if (!localRel) return reply('❌ Masukkan path file.\nContoh: *.github file config.js*');

        const localAbs = path.resolve(process.cwd(), localRel);
        if (!fs.existsSync(localAbs) || !fs.statSync(localAbs).isFile()) {
            return reply(`❌ File tidak ditemukan: *${localRel}*`);
        }

        const repoPath = (args[2] || localRel).replace(/\\/g, '/');
        reply(`⏳ Mengupload *${localRel}*...`);

        try {
            const result = await uploadFile(api, repo, branch, localAbs, repoPath, `update: ${repoPath}`);
            if (!result.ok && result.reason === 'file_terlalu_besar') {
                return reply(`❌ File terlalu besar (>25MB), tidak bisa upload ke GitHub.`);
            }
            return reply(
`✅ *File berhasil diupload!*

📄 File   : *${repoPath}*
🔗 Link   : https://github.com/${repo}/blob/${branch}/${repoPath}`
            );
        } catch (e) {
            return reply(`❌ Gagal upload: ${e.response?.data?.message || e.message}`);
        }
    }

    /* ── .github folder <localPath> [repoPrefix] ── */
    if (sub === 'folder' || sub === 'dir') {
        const localRel = args[1];
        if (!localRel) return reply('❌ Masukkan path folder.\nContoh: *.github folder src/plugins*');

        const localAbs = path.resolve(process.cwd(), localRel);
        if (!fs.existsSync(localAbs) || !fs.statSync(localAbs).isDirectory()) {
            return reply(`❌ Folder tidak ditemukan: *${localRel}*`);
        }

        const repoPrefix = (args[2] || localRel).replace(/\\/g, '/');
        const files = collectFiles(localAbs).map(f => ({
            ...f,
            repo: `${repoPrefix}/${f.repo}`,
        }));

        if (!files.length) return reply(`❌ Folder kosong atau semua file di-skip.`);

        reply(`⏳ Upload *${files.length}* file dari *${localRel}*...`);

        const { done, failed, skipped } = await uploadBatch(api, repo, branch, files, null);

        return reply(
`${failed === 0 ? '✅' : '⚠️'} *Upload Folder Selesai!*

📁 Folder   : *${localRel}*
✅ Berhasil : *${done}* file
❌ Gagal    : *${failed}* file
⏭️ Di-skip  : *${skipped}* file

🔗 https://github.com/${repo}/tree/${branch}/${repoPrefix}`
        );
    }

    /* ── .github delete <repoPath> ── */
    if (sub === 'delete' || sub === 'del' || sub === 'rm') {
        const repoPath = args[1]?.replace(/\\/g, '/');
        if (!repoPath) return reply('❌ Masukkan path file di repo.\nContoh: *.github delete src/plugins/cjs/test.js*');

        reply(`⏳ Menghapus *${repoPath}* dari repo...`);

        try {
            const result = await deleteFile(api, repo, branch, repoPath);
            if (!result.ok) return reply(`❌ File tidak ditemukan di repo: *${repoPath}*`);
            return reply(`✅ *File berhasil dihapus dari repo!*\n\n🗑️ *${repoPath}*`);
        } catch (e) {
            return reply(`❌ Gagal hapus: ${e.response?.data?.message || e.message}`);
        }
    }

    /* ── .github list [path] ── */
    if (sub === 'list' || sub === 'ls') {
        const repoPath = args[1] || '';
        try {
            const res = await api.get(`/repos/${repo}/contents/${repoPath}?ref=${branch}`);
            const items = Array.isArray(res.data) ? res.data : [res.data];

            const dirs  = items.filter(i => i.type === 'dir').map(i => `📁 ${i.name}`);
            const files = items.filter(i => i.type === 'file').map(i => `📄 ${i.name} (${fmtSize(i.size)})`);

            const list = [...dirs, ...files].join('\n');
            const folderLabel = repoPath || '/ (root)';

            return reply(
`📂 *Isi Repo: ${folderLabel}*

${list || '(kosong)'}

🔗 https://github.com/${repo}/tree/${branch}/${repoPath}`
            );
        } catch (e) {
            const msg = e.response?.status === 404
                ? 'Path tidak ditemukan di repo.'
                : e.message;
            return reply(`❌ Gagal list: ${msg}`);
        }
    }

    /* ── Help ── */
    return reply(
`📘 *GitHub Plugin — Bantuan*

*Setup:*
• *.github setup <token> <user/repo>* — konfigurasi awal

*Upload:*
• *.github upload* — upload seluruh SC bot
• *.github file config.js* — upload 1 file
• *.github folder src/plugins* — upload 1 folder

*Lainnya:*
• *.github list* — lihat isi root repo
• *.github list src/plugins* — lihat isi folder
• *.github delete config.js* — hapus file dari repo
• *.github status* — info repo & konfigurasi

📌 Token: github.com → Settings → Developer settings → Tokens (classic) → scope: *repo*`
    );
};

handler.command  = ['github', 'gh'];
handler.tags     = ['owner'];
handler.limit    = false;
handler.owner    = true;

handler.fitur = {
    'github': 'Upload file/folder/SC ke GitHub',
    'gh':     'Upload file/folder/SC ke GitHub',
};

module.exports = handler;