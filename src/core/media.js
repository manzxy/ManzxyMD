const fs = require('fs');
const path = require('path');
const FileType = require('file-type');
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

/**
 * Media utility class to handle common Baileys media operations
 */
class MediaHandler {
    constructor(sock, utils) {
        this.sock = sock;
        this.utils = utils; // Should contain getBuffer, getSizeMedia
    }

    async getFile(PATH, save) {
        let res;
        const { getBuffer, getSizeMedia } = this.utils;
        
        let data = Buffer.isBuffer(PATH) ? PATH : 
                   /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : 
                   /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : 
                   fs.existsSync(PATH) ? fs.readFileSync(PATH) : 
                   typeof PATH === 'string' ? PATH : Buffer.alloc(0);

        const type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' };
        const filename = path.join(process.cwd(), 'temp', `${Date.now()}.${type.ext}`);
        
        if (data && save) {
            if (!fs.existsSync(path.dirname(filename))) fs.mkdirSync(path.dirname(filename), { recursive: true });
            await fs.promises.writeFile(filename, data);
        }

        return { res, filename, size: await getSizeMedia(data), ...type, data };
    }

    async downloadMediaMessage(message) {
        const quoted = message.msg || message;
        const mime = quoted.mimetype || '';
        const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
        
        const stream = await downloadContentFromMessage(message, messageType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    }

    async downloadAndSaveMediaMessage(message, filename, attachExtension = true) {
        const buffer = await this.downloadMediaMessage(message);
        const type = await FileType.fromBuffer(buffer);
        const trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
        
        if (!fs.existsSync(path.dirname(trueFileName))) fs.mkdirSync(path.dirname(trueFileName), { recursive: true });
        await fs.promises.writeFile(trueFileName, buffer);
        return trueFileName;
    }
}

module.exports = MediaHandler;
