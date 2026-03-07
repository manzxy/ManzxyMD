/**
 * scheduler.js — Group scheduler + adzan tick
 */
'use strict';

const { sleep } = require('./message.js');
const logger    = require('./logger.js');

let _schedSock    = null;
let _schedStarted = false;
const _adzanSent  = {};

function padTime(h, m) { return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0'); }

/* ── Trim _adzanSent agar tidak memory leak ──────────────────── */
function trimAdzanSent() {
    const keys = Object.keys(_adzanSent);
    if (keys.length > 500) keys.slice(0, 300).forEach(k => delete _adzanSent[k]);
}

async function schedulerTick() {
    if (!_schedSock) return;
    const groups = global.db?.groups;
    if (!groups) return;

    const wib  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const nowH = wib.getHours(), nowM = wib.getMinutes(), nowDay = wib.getDay();

    for (const [gid, gd] of Object.entries(groups)) {
        if (!gd?.schedule?.jobs?.length) continue;
        for (const job of gd.schedule.jobs) {
            if (!job.enabled) continue;
            const [jH, jM] = (job.time || '').split(':').map(Number);
            if (jH !== nowH || jM !== nowM) continue;
            if (job.days?.length && !job.days.includes(nowDay)) continue;
            try {
                let msg = '';
                if      (job.action==='close')      { await _schedSock.groupSettingUpdate(gid,'announcement');     msg='🔒 *[AUTO]* Grup ditutup.'; }
                else if (job.action==='open')       { await _schedSock.groupSettingUpdate(gid,'not_announcement'); msg='🔓 *[AUTO]* Grup dibuka.'; }
                else if (job.action==='lockinfo')   { await _schedSock.groupSettingUpdate(gid,'locked');   gd.setinfo=true;  msg='🔏 *[AUTO]* Info dikunci.'; }
                else if (job.action==='unlockinfo') { await _schedSock.groupSettingUpdate(gid,'unlocked'); gd.setinfo=false; msg='🔑 *[AUTO]* Info dibuka.'; }
                else if (job.action==='mute')       { gd.mute=true;  msg='🔇 *[AUTO]* Bot di-mute.'; }
                else if (job.action==='unmute')     { gd.mute=false; msg='🔊 *[AUTO]* Bot di-unmute.'; }
                if (msg) await _schedSock.sendMessage(gid, { text: msg }).catch(()=>{});
            } catch (e) { logger.warn(`[SCHED] ${gid}:`, e.message); }
            await sleep(300);
        }
    }

    // Adzan
    if (!global._adzanKirim || !global._adzanGetJadwal) return;
    const tgl     = wib.toISOString().split('T')[0];
    const nowTime = padTime(nowH, nowM);
    for (const [gid, gd] of Object.entries(groups)) {
        if (!gd?.adzan?.enabled || !gd.adzan.kotaId) continue;
        try {
            const jadwal = await global._adzanGetJadwal(gd.adzan.kotaId, tgl);
            for (const w of ['subuh','dzuhur','ashar','maghrib','isya']) {
                if (jadwal[w] !== nowTime) continue;
                const key = `${gid}_${w}_${tgl}`;
                if (_adzanSent[key]) continue;
                _adzanSent[key] = true;
                await global._adzanKirim(_schedSock, gid, w, jadwal[w], gd.adzan.kotaNama).catch(()=>{});
                await sleep(500);
            }
        } catch {}
    }
    trimAdzanSent();
}

function startScheduler(sock) {
    _schedSock = sock;
    if (_schedStarted) return;
    _schedStarted = true;

    const tick = async () => {
        try { await schedulerTick(); } catch (e) { logger.error('[SCHED]', e.message); }
        const now = new Date();
        setTimeout(tick, (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 500);
    };
    const now = new Date();
    setTimeout(tick, (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 500);
    logger.success('[SCHEDULER] Started');
}

function setSchedulerSock(sock) { _schedSock = sock; }
function getAdzanSent() { return _adzanSent; }

module.exports = { startScheduler, setSchedulerSock, getAdzanSent };
