/**
 * ecosystem.config.js — PM2 Config untuk ManzxyMD
 * Jalankan: pm2 start ecosystem.config.js
 */
module.exports = {
    apps: [{
        name:           'manzxymd',
        script:         'index.js',
        interpreter:    'node',
        watch:          false,         // jangan watch — menyebabkan restart loop
        ignore_watch:   ['node_modules', 'session', 'database', '*.log'],
        max_memory_restart: '500M',    // restart jika RAM > 500MB
        restart_delay:  5000,          // tunggu 5 detik sebelum restart
        max_restarts:   10,            // max 10 restart otomatis
        min_uptime:     '10s',         // hitung sebagai crash jika mati < 10 detik
        autorestart:    true,
        exp_backoff_restart_delay: 100,// exponential backoff
        env: {
            NODE_ENV: 'production',
        },
        env_development: {
            NODE_ENV:    'development',
            DEBUG_OWNER: '0',
        },
        error_file:  './logs/pm2-error.log',
        out_file:    './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs:  true,
    }]
};
