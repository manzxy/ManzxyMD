const handler = async (m, { manzxy, isOwn, command, reply }) => {
    if (!isOwn) return reply('⛔ Owner only!');

    if (command === 'public') {
        manzxy.public = true;
        return reply('✅ Bot mode set to *PUBLIC*\n\nSemua orang bisa gunakan bot.');
    }

    if (command === 'self') {
        manzxy.public = false;
        return reply('✅ Bot mode set to *SELF*\n\nHanya owner yang bisa gunakan bot.');
    }
};

handler.command = ['public', 'self'];
handler.tags = ["owner"];
handler.limit    = false;
handler.owner = true;

handler.fitur    = {
    'public': 'Bot bisa dipakai semua orang',
    'self': 'Bot hanya bisa dipakai owner',
};
module.exports = handler;
