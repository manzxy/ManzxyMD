/**
 * group-extra.js — Fitur grup tambahan
 * FIX: LID-safe via jid-utils
 */
'use strict';
const { getGroup } = require('../../lib/database');
const { normalizeNum, extractTarget } = require('../../lib/jid-utils');

const handler = async (m, { manzxy, args, text, command, reply, isOwn, isAdmin, botAdmin, from, participants=[], groupMetadata, groupData }) => {
    if (!m.isGroup) return reply('❌ Khusus di grup!');
    const gd = groupData || getGroup(from);

    switch (command) {
        case 'mute':   if (!isAdmin&&!isOwn) return reply('❌ Admin only!'); gd.mute=true;  return reply('🔇 Grup di-mute! Bot tidak akan merespons member biasa.');
        case 'unmute': if (!isAdmin&&!isOwn) return reply('❌ Admin only!'); gd.mute=false; return reply('🔊 Grup di-unmute!');

        case 'setinfo': case 'lockinfo': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            const v = args[0]?.toLowerCase();
            if (v==='on')  { await manzxy.groupSettingUpdate(from,'announcement');     gd.setinfo=true;  return reply('🔒 Info grup dikunci!'); }
            if (v==='off') { await manzxy.groupSettingUpdate(from,'not_announcement'); gd.setinfo=false; return reply('🔓 Info grup dibuka!'); }
            return reply(`⚙️ Lock info: *${gd.setinfo?'ON 🔒':'OFF 🔓'}*\n\nGunakan: *.setinfo on/off*`);
        }

        case 'namagrup': case 'gantinama': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            if (!text) return reply('❓ Masukkan nama baru!\nContoh: *.setname Nama Grup*');
            try { await manzxy.groupUpdateSubject(from, text); return reply(`✅ Nama grup diubah ke:\n*${text}*`); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'setdesc': case 'setdescgc': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            if (!text) return reply('❓ Masukkan deskripsi baru!');
            try { await manzxy.groupUpdateDescription(from, text); return reply('✅ Deskripsi berhasil diupdate!'); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'setlink': case 'linkgc': case 'getlink': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            try { const c = await manzxy.groupInviteCode(from); return reply(`🔗 *Link Grup*\n\nhttps://chat.whatsapp.com/${c}\n\n_Gunakan *.resetlink* untuk reset._`); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'resetlink': case 'revokelink': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            try { const c = await manzxy.groupRevokeInvite(from); return reply(`✅ Link direset!\n\nhttps://chat.whatsapp.com/${c}`); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'setwelcome': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!text) return reply('📝 *Set Welcome*\nFormat: *.setwelcome <pesan>*\nVariabel: @user @group @name @count\nKetik *.setwelcome reset* untuk default.');
            if (text.toLowerCase()==='reset') { gd.welcomeMessage=''; return reply('✅ Welcome message direset!'); }
            gd.welcomeMessage = text;
            return reply('✅ Welcome message disimpan!');
        }

        case 'setleave': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!text) return reply('📝 *Set Leave*\nFormat: *.setleave <pesan>*\nVariabel: @user @group @name');
            if (text.toLowerCase()==='reset') { gd.leaveMessage=''; return reply('✅ Leave message direset!'); }
            gd.leaveMessage = text;
            return reply('✅ Leave message disimpan!');
        }

        case 'warn': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            const target = extractTarget(m, args, participants);
            if (!target) return reply('❓ Reply/mention member yang ingin di-warn.\n⚠️ Jika @tag tidak terdeteksi (LID), pakai reply saja.');
            const reason = (m.mentionedJid?.length ? args.slice(1) : args).join(' ') || 'Tidak ada alasan';
            if (!gd.warns) gd.warns = {};
            if (!gd.warns[target]) gd.warns[target] = [];
            gd.warns[target].push({ reason, by: m.sender, at: Date.now() });
            const tot = gd.warns[target].length, max = gd.maxWarn||3;
            let msg = `⚠️ *WARN!*\n\n👤 Member: @${normalizeNum(target)}\n📋 Alasan: ${reason}\n🔢 Warn: *${tot}/${max}*`;
            if (tot >= max) {
                msg += `\n\n🚨 *Warn maximal! Dikick!*`;
                try { await manzxy.groupParticipantsUpdate(from,[target],'remove'); } catch(e){ msg+=`\n❌ Gagal kick: ${e.message}`; }
                gd.warns[target] = [];
            }
            return manzxy.sendMessage(from,{text:msg,mentions:[target]},{quoted:m});
        }

        case 'getwarn': case 'warnlist': case 'listwarn': {
            const target = extractTarget(m, args, participants);
            if (target) {
                const ws = (gd.warns||{})[target]||[];
                if (!ws.length) return reply(`✅ Tidak ada warn.`);
                let t = `⚠️ *Warn* @${normalizeNum(target)} (${ws.length}/${gd.maxWarn||3})\n\n`;
                ws.forEach((w,i)=>{ t+=`${i+1}. ${w.reason}\n   📅 ${new Date(w.at).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta'})}\n`; });
                return manzxy.sendMessage(from,{text:t,mentions:[target]},{quoted:m});
            }
            const all = Object.entries(gd.warns||{}).filter(([,w])=>w.length>0);
            if (!all.length) return reply('✅ Tidak ada warn di grup ini.');
            let t = `⚠️ *Semua Warn*\n\n`;
            all.forEach(([jid,w])=>{ t+=`• @${normalizeNum(jid)}: ${w.length}/${gd.maxWarn||3}\n`; });
            return manzxy.sendMessage(from,{text:t,mentions:all.map(([j])=>j)},{quoted:m});
        }

        case 'resetwarn': case 'unwarn': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            const target = extractTarget(m, args, participants);
            if (!target) {
                if (args[0]?.toLowerCase()==='all') { gd.warns={}; return reply('✅ Semua warn direset!'); }
                return reply('❓ Reply/mention member.\nReset semua: *.resetwarn all*');
            }
            if (!gd.warns) gd.warns={};
            gd.warns[target]=[];
            return manzxy.sendMessage(from,{text:`✅ Warn @${normalizeNum(target)} direset!`,mentions:[target]},{quoted:m});
        }

        case 'setwarnmax': case 'maxwarn': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            const v = parseInt(args[0]);
            if (isNaN(v)||v<1||v>20) return reply('❌ Masukkan angka 1-20!');
            gd.maxWarn = v;
            return reply(`✅ Max warn diubah ke *${v}x*`);
        }

        case 'antitoxic': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            const v = args[0]?.toLowerCase();
            if (v==='on')  { gd.antiToxic=true;  return reply('✅ Anti Toxic aktif!'); }
            if (v==='off') { gd.antiToxic=false; return reply('❌ Anti Toxic nonaktif.'); }
            return reply(`⚙️ Anti Toxic: *${gd.antiToxic?'ON ✅':'OFF ❌'}*\n\n*.antitoxic on/off*`);
        }

        case 'setttl': case 'disappear': case 'ephemeral': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            const map = {'off':0,'0':0,'1d':86400,'24h':86400,'7d':604800,'1w':604800,'90d':7776000,'3m':7776000};
            const v = args[0]?.toLowerCase();
            if (!v||!(v in map)) return reply('⏱️ Pilihan: *.ephemeral off/1d/7d/90d*');
            try { await manzxy.groupToggleEphemeral(from,map[v]); return reply(`✅ Pesan menghilang diatur ke *${v}*`); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'promote': case 'jadmin': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            const t = extractTarget(m,args,participants);
            if (!t) return reply('❓ Reply/mention member yang ingin dipromote.');
            try { await manzxy.groupParticipantsUpdate(from,[t],'promote'); return manzxy.sendMessage(from,{text:`👑 @${normalizeNum(t)} dijadikan admin!`,mentions:[t]},{quoted:m}); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'demote': case 'unadmin': {
            if (!isAdmin&&!isOwn) return reply('❌ Admin only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            const t = extractTarget(m,args,participants);
            if (!t) return reply('❓ Reply/mention admin yang ingin di-demote.');
            try { await manzxy.groupParticipantsUpdate(from,[t],'demote'); return manzxy.sendMessage(from,{text:`🔽 @${normalizeNum(t)} dicopot dari admin!`,mentions:[t]},{quoted:m}); }
            catch (e) { return reply(`❌ Gagal: ${e.message}`); }
        }

        case 'kickall': {
            if (!isOwn) return reply('⛔ Owner only!');
            if (!botAdmin) return reply('❌ Bot harus jadi admin!');
            const targets = (participants||[]).filter(p=>!p.admin);
            if (!targets.length) return reply('✅ Tidak ada member biasa.');
            await reply(`⚠️ Kick *${targets.length} member*...`);
            let n=0;
            for (const p of targets) { try { await manzxy.groupParticipantsUpdate(from,[p.id],'remove'); n++; } catch{} await new Promise(r=>setTimeout(r,500)); }
            return reply(`✅ Berhasil kick *${n}/${targets.length}*!`);
        }

        case 'groupsetting': case 'setelan': case 'grupinfo': {
            return reply(
`⚙️ *SETELAN GRUP*\n${groupMetadata?.subject||from}\n${'━'.repeat(20)}
👋 Welcome   : ${gd.welcome?'🟢 ON':'🔴 OFF'}
🚪 Leave     : ${gd.leaveMessage?'🟢 Custom':'🔵 Default'}
🔗 Antilink  : ${gd.antilink||'off'}
🔗 AntilinkGC: ${gd.antilinkgc||'off'}
🔇 Mute      : ${gd.mute?'🟢 ON':'🔴 OFF'}
🔒 AdminOnly : ${gd.adminonly?'🟢 ON':'🔴 OFF'}
🔒 Lock Info : ${gd.setinfo?'🟢 ON':'🔴 OFF'}
☣️ Anti Toxic: ${gd.antiToxic?'🟢 ON':'🔴 OFF'}
⚠️ Max Warn  : ${gd.maxWarn||3}x kick
${'━'.repeat(20)}`);
        }
    }
};

handler.command = ['mute','unmute','setinfo','lockinfo','namagrup','gantinama','setdesc','setdescgc','setlink','linkgc','getlink','resetlink','revokelink','setwelcome','setleave','warn','getwarn','warnlist','listwarn','resetwarn','unwarn','setwarnmax','maxwarn','antitoxic','setttl','disappear','ephemeral','promote','jadmin','demote','unadmin','kickall','groupsetting','setelan','grupinfo'];
handler.tags  = ['group'];
handler.limit    = false;
handler.group = true;
handler.fitur    = {
    'mute': 'Bot diam di grup ini',
    'unmute': 'Bot aktif kembali di grup',
    'setinfo': 'Kunci/buka edit info grup',
    'lockinfo': 'Kunci edit info grup',
    'namagrup': 'Ganti nama grup',
    'gantinama': 'Ganti nama grup',
    'setdesc': 'Ganti deskripsi grup',
    'setlink': 'Tampilkan link undangan grup',
    'linkgc': 'Tampilkan link undangan grup',
    'getlink': 'Tampilkan link undangan grup',
    'resetlink': 'Reset link undangan grup',
    'revokelink': 'Reset link undangan grup',
    'setwelcome': 'Atur pesan sambutan custom',
    'setleave': 'Atur pesan perpisahan custom',
    'warn': 'Beri peringatan member',
    'getwarn': 'Lihat warn satu member',
    'warnlist': 'Lihat semua warn di grup',
    'listwarn': 'Lihat semua warn di grup',
    'resetwarn': 'Hapus warn member',
    'unwarn': 'Hapus 1 warn terakhir member',
    'setwarnmax': 'Atur batas warn sebelum kick',
    'maxwarn': 'Atur batas warn sebelum kick',
    'antitoxic': 'Filter kata-kata kasar',
    'setttl': 'Atur pesan menghilang otomatis',
    'disappear': 'Atur pesan menghilang otomatis',
    'ephemeral': 'Atur pesan menghilang otomatis',
    'promote': 'Jadikan member sebagai admin',
    'jadmin': 'Jadikan member sebagai admin',
    'demote': 'Copot admin dari jabatan',
    'unadmin': 'Copot admin dari jabatan',
    'kickall': 'Kick semua member non-admin',
    'groupsetting': 'Lihat semua setelan grup',
    'setelan': 'Lihat semua setelan grup',
    'grupinfo': 'Lihat semua setelan grup',
};
module.exports = handler;
