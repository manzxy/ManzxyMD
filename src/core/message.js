const { proto, delay, getContentType, areJidsSameUser, generateWAMessage } = require("@whiskeysockets/baileys")
const chalk = require('chalk')
const fs = require('fs')
const Crypto = require('crypto')
const axios = require('axios')
const moment = require('moment-timezone')
const { sizeFormatter } = require('human-readable')
const util = require('util')
const Jimp = require('jimp')


const unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000)

exports.unixTimestampSeconds = unixTimestampSeconds

exports.generateMessageTag = (epoch) => {
    let tag = (0, exports.unixTimestampSeconds)().toString();
    if (epoch)
        tag += '.--' + epoch; // attach epoch if provided
    return tag;
}

exports.processTime = (timestamp, now) => {
	return moment.duration(now - moment(timestamp * 1000)).asSeconds()
}

exports.getRandom = (ext) => {
    return `${Math.floor(Math.random() * 10000)}${ext}`
}

exports.getBuffer = async (url, options) => {
	try {
		options ? options : {}
		const res = await axios({
			method: "get",
			url,
			headers: {
				'DNT': 1,
				'Upgrade-Insecure-Request': 1
			},
			...options,
			responseType: 'arraybuffer'
		})
		return res.data
	} catch (err) {
		return err
	}
}

exports.fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

exports.runtime = function(seconds) {
	seconds = Number(seconds);
	var d = Math.floor(seconds / (3600 * 24));
	var h = Math.floor(seconds % (3600 * 24) / 3600);
	var m = Math.floor(seconds % 3600 / 60);
	var s = Math.floor(seconds % 60);
	var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
	var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
	var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
	var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

exports.clockString = (ms) => {
    let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
    let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
    let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
    return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

exports.sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'))
}

exports.getTime = (format, date) => {
	if (date) {
		return moment(date).locale('id').format(format)
	} else {
		return moment.tz('Asia/Jakarta').locale('id').format(format)
	}
}

exports.formatDate = (n, locale = 'id') => {
	let d = new Date(n)
	return d.toLocaleDateString(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	})
}

exports.tanggal = (numer) => {
	myMonths = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
				myDays = ['Minggu','Senin','Selasa','Rabu','Kamis','Jum’at','Sabtu']; 
				var tgl = new Date(numer);
				var day = tgl.getDate()
				bulan = tgl.getMonth()
				var thisDay = tgl.getDay(),
				thisDay = myDays[thisDay];
				var yy = tgl.getYear()
				var year = (yy < 1000) ? yy + 1900 : yy; 
				const time = moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss')
				let d = new Date
				let locale = 'id'
				let gmt = new Date(0).getTime() - new Date('1 January 1970').getTime()
				let weton = ['Pahing', 'Pon','Wage','Kliwon','Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5]
				
				return`${thisDay}, ${day} - ${myMonths[bulan]} - ${year}`
}

exports.formatp = sizeFormatter({
    std: 'JEDEC', //'SI' = default | 'IEC' | 'JEDEC'
    decimalPlaces: 2,
    keepTrailingZeroes: false,
    render: (literal, symbol) => `${literal} ${symbol}B`,
})

exports.jsonformat = (string) => {
    return JSON.stringify(string, null, 2)
}

function format(...args) {
	return util.format(...args)
}

exports.logic = (check, inp, out) => {
	if (inp.length !== out.length) throw new Error('Input and Output must have same length')
	for (let i in inp)
		if (util.isDeepStrictEqual(check, inp[i])) return out[i]
	return null
}

exports.generateProfilePicture = async (buffer) => {
	try {
		const jimp = await Jimp.read(buffer);
		const min = jimp.getWidth();
		const max = jimp.getHeight();
		const size = Math.min(min, max);
		const cropped = jimp.crop(0, 0, size, size);
		const img = await cropped.scaleToFit(720, 720).getBufferAsync(Jimp.MIME_JPEG);
		return { img, preview: img };
	} catch (e) {
		// Fallback: return buffer as-is
		return { img: buffer, preview: buffer };
	}
}

exports.bytesToSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

exports.getSizeMedia = (path) => {
    return new Promise((resolve, reject) => {
        if (/http/.test(path)) {
            axios.get(path)
            .then((res) => {
                let length = parseInt(res.headers['content-length'])
                let size = exports.bytesToSize(length, 3)
                if(!isNaN(length)) resolve(size)
            })
        } else if (Buffer.isBuffer(path)) {
            let length = Buffer.byteLength(path)
            let size = exports.bytesToSize(length, 3)
            if(!isNaN(length)) resolve(size)
        } else {
            reject('error gatau apah')
        }
    })
}

exports.parseMention = (text = '') => {
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
}

exports.getGroupAdm = (participants) => {
    const { forceJid } = require('../lib/jid-utils.js');
    const admins = [];
    for (const i of participants) {
        if (i.admin === 'superadmin' || i.admin === 'admin') {
            // forceJid: LID → resolve → JID bersih; tidak pernah return @lid
            const jid = forceJid(i.id, participants);
            if (jid) admins.push(jid);
        }
    }
    return admins;
};

/**
 * Serialize Message
 * @param {WAConnection} conn 
 * @param {Object} m 
 * @param {store} store 
 */
exports.smsg = (conn, m, store) => {
    if (!m) return m
    let M = proto.WebMessageInfo
    if (m.key) {
        m.id = m.key.id
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup   = m.chat.endsWith('@g.us')
        m.isChannel = m.chat.endsWith('@newsletter') || m.chat.endsWith('@broadcast')
        // FIX: prioritas participantAlt (selalu @s.whatsapp.net), hindari LID
        // FIXED: strip device suffix (:XX) dan handle LID — hasilkan JID bersih selalu
        const _cleanJidFull = (raw) => {
            if (!raw) return null;
            const decoded = conn.decodeJid ? conn.decodeJid(raw) : raw;
            if (!decoded) return null;
            // LID — tidak bisa di-convert, return null agar caller fallback
            if (decoded.includes('@lid') || decoded.includes('@s.lid')) return null;
            // Strip device suffix: '628xxx:20@s.whatsapp.net' → '628xxx@s.whatsapp.net'
            const num = decoded.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            return num ? num + '@s.whatsapp.net' : null;
        };

        if (m.fromMe) {
            // Bot sendiri kirim — pakai user.id bot (strip device suffix)
            m.sender = _cleanJidFull(conn.user.id) || conn.user.id;
        } else if (!m.isGroup) {
            // PV: sender = remoteJid (orang yang chat ke bot)
            const _pvRaw = m.key.remoteJid || '';
            const _pvClean = _cleanJidFull(_pvRaw);
            if (_pvClean) {
                m.sender = _pvClean;
            } else if (_pvRaw.includes('@lid') || _pvRaw.includes('@s.lid')) {
                // LID di PV — resolve via forceJid (semua sumber dicoba)
                const { forceJid } = require('../lib/jid-utils.js');
                const resolved = forceJid(_pvRaw, [], conn);
                // Jika gagal resolve, sender kosong (bukan LID) — manzxy.js akan handle
                m.sender = resolved || '';
            } else {
                m.sender = _pvRaw;
            }
        } else {
            // Grup: participantAlt SELALU @s.whatsapp.net (tidak pernah LID)
            // participant bisa LID → hindari sebagai sumber nomor utama
            const _altJid = m.key.participantAlt;
            if (_altJid && (_altJid.includes('@s.whatsapp.net') || _altJid.includes('@c.us'))) {
                // participantAlt valid — pakai langsung
                m.sender = _cleanJidFull(_altJid) || _altJid;
            } else {
                // Tidak ada participantAlt — coba participant
                const { forceJid } = require('../lib/jid-utils.js');
                const _partRaw = m.participant || m.key.participant || '';
                const _resolved = forceJid(_partRaw, [], conn);
                m.sender = _resolved || '';
            }
        }
        if (m.isGroup) {
            // m.participant = JID bersih anggota yang kirim pesan
            const { forceJid: _fj } = require('../lib/jid-utils.js');
            const _altPart = m.key.participantAlt;
            if (_altPart && (_altPart.includes('@s.whatsapp.net') || _altPart.includes('@c.us'))) {
                m.participant = _cleanJidFull(_altPart) || _altPart;
            } else {
                const _partRaw = m.key.participant || '';
                const _pResolved = _fj(_partRaw, [], conn);
                m.participant = _pResolved || '';
            }
        }
    }
    if (m.message) {
        m.mtype = getContentType(m.message)
        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype])
        
        const messageTypes = {
            conversation: m.message?.conversation,
            imageMessage: m.message?.imageMessage?.caption,
            videoMessage: m.message?.videoMessage?.caption,
            audioMessage: m.message?.audioMessage?.caption,
            stickerMessage: m.message?.stickerMessage?.caption,
            documentMessage: m.message?.documentMessage?.fileName,
            contactMessage: '[Contact]',
            locationMessage: m.message?.locationMessage?.name,
            liveLocationMessage: '[Live Location]',
            extendedTextMessage: m.message?.extendedTextMessage?.text,
            buttonsResponseMessage: m.message?.buttonsResponseMessage?.selectedButtonId,
            listResponseMessage: m.message?.listResponseMessage?.singleSelectReply?.selectedRowId,
            templateButtonReplyMessage: m.message?.templateButtonReplyMessage?.selectedId,
            interactiveResponseMessage: '[Interactive Response]',
            pollCreationMessage: '[Poll Creation]',
            reactionMessage: m.message?.reactionMessage?.text,
            ephemeralMessage: '[Ephemeral]',
            viewOnceMessage: '[View Once]',
            productMessage: m.message?.productMessage?.product?.name
        };

        m.body = messageTypes[m.mtype] || 
                 (m.message?.messageContextInfo ? 
                    (m.message.buttonsResponseMessage?.selectedButtonId || 
                     m.message.listResponseMessage?.singleSelectReply?.selectedRowId || 
                     m.text) : 
                  (m.message?.conversation || m.msg?.caption || m.msg?.text || m.text || ''))
        
        if (typeof m.body !== 'string') m.body = ''
        // FIX: m.msg bisa undefined jika mtype tidak dikenali — guard dengan optional chaining
        let quoted = m.quoted = m.msg?.contextInfo ? m.msg.contextInfo.quotedMessage : null
        m.mentionedJid = m.msg?.contextInfo ? m.msg.contextInfo.mentionedJid : []
        if (m.quoted) {
            let type = Object.keys(m.quoted)[0]
			m.quoted = m.quoted[type]
            if (['productMessage'].includes(type)) {
				type = Object.keys(m.quoted)[0]
				m.quoted = m.quoted[type]
			}
            if (typeof m.quoted === 'string') m.quoted = {
				text: m.quoted
			}
            m.quoted.mtype = type
            m.quoted.id = m.msg?.contextInfo?.stanzaId
			m.quoted.chat = m.msg?.contextInfo?.remoteJid || m.chat
            m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false
			// FIX: quoted.sender anti-LID, prioritas participantAlt
			m.quoted.sender = (() => {
				const _qAlt = m.msg?.contextInfo?.participantAlt;
				if (_qAlt && _qAlt.includes('@s.whatsapp.net')) return _qAlt;
				const _raw386 = m.msg?.contextInfo?.participant || '';
				const d = conn.decodeJid ? conn.decodeJid(_raw386) : (_raw386.split(':')[0] + (_raw386.includes('@') ? '@' + _raw386.split('@')[1] : ''));
				if (!d) return '';
				if (d.includes('@lid') || d.includes('@s.lid')) {
					const { forceJid: _fqj } = require('../lib/jid-utils.js');
					return _fqj(d, [], conn) || '';
				}
				return d;
			})();
			m.quoted.fromMe = m.quoted.sender === (conn.decodeJid ? conn.decodeJid(conn.user?.id || '') : (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net')
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
			m.quoted.mentionedJid = m.msg?.contextInfo ? m.msg.contextInfo.mentionedJid : []
            m.getQuotedObj = m.getQuotedMessage = async () => {
                if (!m.quoted.id) return false
                if (!store) return false
                let q = await store.loadMessage(m.chat, m.quoted.id, conn)
                return exports.smsg(conn, q, store)
            }
            let vM = m.quoted.fakeObj = M.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id
                },
                message: quoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {})
            })

            /**
             * 
             * @returns 
             */
            m.quoted.delete = () => conn.sendMessage(m.quoted.chat, { delete: vM.key })

	   /**
		* 
		* @param {*} jid 
		* @param {*} forceForward 
		* @param {*} options 
		* @returns 
	   */
            m.quoted.copyNForward = (jid, forceForward = false, options = {}) => conn.copyNForward(jid, vM, forceForward, options)

            /**
              *
              * @returns
            */
            m.quoted.download = () => conn.downloadMediaMessage(m.quoted)
        }
    }
    if (m.msg?.url) m.download = () => conn.downloadMediaMessage(m.msg)
    m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || ''
    /**
	* Reply to this message
	* @param {String|Object} text 
	* @param {String|false} chatId 
	* @param {Object} options 
	*/
    m.reply = (text, chatId = m.chat, options = {}) => Buffer.isBuffer(text) ? conn.sendMedia(chatId, text, 'file', '', m, { ...options }) : conn.sendText(chatId, text, m, { ...options })
    /**
	* Copy this message
	*/
	m.copy = () => exports.smsg(conn, M.fromObject(M.toObject(m)))

	/**
	 * 
	 * @param {*} jid 
	 * @param {*} forceForward 
	 * @param {*} options 
	 * @returns 
	 */
	m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => conn.copyNForward(jid, m, forceForward, options)

conn.appendTextMessage = conn.appenTextMessage = async(text, chatUpdate) => {
let messages = await generateWAMessage(m.chat, { text: text, mentions: m.mentionedJid }, {
userJid: conn.user.id,
quoted: m.quoted && m.quoted.fakeObj
})
messages.key.fromMe = areJidsSameUser(m.sender, conn.user.id)
messages.key.id = m.key.id
messages.pushName = m.pushName
if (m.isGroup) messages.participant = m.sender
let msg = {
    ...chatUpdate,
    messages: [proto.WebMessageInfo.fromObject(messages)],
    type: 'append'
}
conn.ev.emit('messages.upsert', msg)
}

    return m
}


