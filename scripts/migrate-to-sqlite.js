#!/usr/bin/env node
/**
 * Jalankan SEKALI untuk migrasi JSON → SQLite:
 *   node scripts/migrate-to-sqlite.js
 */
'use strict';
console.log('\n🔄 MIGRASI JSON → SQLite\n' + '='.repeat(40));
require('../src/lib/database.js');
console.log('\n✅ Selesai! File: database/bot.db');
console.log('File JSON lama direname ke .migrated (aman, bisa dihapus manual)');
console.log('\nSelanjutnya jalankan: node index.js\n');
