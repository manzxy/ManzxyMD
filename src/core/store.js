/**
 * store.js — In-memory Baileys store + LID→JID cache
 */
'use strict';

/* ── LID global map ──────────────────────────────────────────── */
global._lidToJidMap = global._lidToJidMap || {};

/* ── In-memory store ─────────────────────────────────────────── */
function makeStore() {
    const contacts = {}, messages = {}, chats = {};

    return {
        contacts, messages, chats,

        bind(ev) {
            ev.on('contacts.upsert', list => {
                for (const ct of list) {
                    contacts[ct.id] = { ...(contacts[ct.id] || {}), ...ct };
                    if (!ct.id?.includes('@lid')) continue;
                    const { resolveLid } = require('../lib/jid-utils.js');
                    const jid = resolveLid(ct.id, [ct]);
                    if (jid) global._lidToJidMap[ct.id] = jid;
                }
            });

            ev.on('contacts.update', list => {
                for (const u of list) {
                    if (!u.id) continue;
                    contacts[u.id] = { ...(contacts[u.id] || {}), ...u };
                    if (u.id.includes('@lid')) {
                        const { resolveLid } = require('../lib/jid-utils.js');
                        const jid = resolveLid(u.id, [u]);
                        if (jid) global._lidToJidMap[u.id] = jid;
                    }
                }
            });

            ev.on('chats.upsert',  l => { for (const c of l) chats[c.id] = { ...(chats[c.id] || {}), ...c }; });
            ev.on('chats.update',  l => { for (const u of l) if (u.id) chats[u.id] = { ...(chats[u.id] || {}), ...u }; });

            ev.on('messages.upsert', ({ messages: msgs }) => {
                for (const m of msgs) {
                    const jid = m.key?.remoteJid;
                    if (!jid) continue;
                    if (!messages[jid]) messages[jid] = [];
                    messages[jid].push(m);
                    if (messages[jid].length > 20) messages[jid].shift();
                    // Kumpulkan LID → JID dari setiap pesan masuk
                    if (m.key?.participant?.includes('@lid') && m.key.participantAlt?.includes('@s.whatsapp.net'))
                        global._lidToJidMap[m.key.participant] = m.key.participantAlt;
                    if (jid?.includes('@lid') && m.key?.remoteJidAlt?.includes('@s.whatsapp.net')) {
                        const n = m.key.remoteJidAlt.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
                        if (n.length >= 10 && n.length <= 15)
                            global._lidToJidMap[jid] = n + '@s.whatsapp.net';
                    }
                }
            });
        },

        loadMessage: (jid, id) => (messages[jid] || []).find(m => m.key?.id === id) || null,
    };
}

const store = makeStore();
module.exports = store;
