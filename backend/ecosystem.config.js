/**
 * PM2 Ecosystem Config — TechnoElevate Backend
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js                     # start with clustering
 *   pm2 start ecosystem.config.js --env production    # production mode
 *   pm2 save && pm2 startup                           # auto-start on server reboot
 *   pm2 monit                                         # real-time monitoring
 *   pm2 logs techno-elevate                           # view logs
 *   pm2 reload techno-elevate                         # zero-downtime reload
 */

module.exports = {
  apps: [
    {
      name: 'techno-elevate',
      script: 'server.js',

      // Cluster mode: one instance per CPU core (max 4 for a typical 4-core server)
      // Use 'max' to use all available cores
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',

      // Auto-restart if memory exceeds 500 MB
      max_memory_restart: '500M',

      // Wait before restarting after a crash
      restart_delay: 2000,
      max_restarts: 10,

      // Environment — development
      env: {
        NODE_ENV: 'development',
        PORT: 6000,
      },

      // Environment — production (used with --env production flag)
      env_production: {
        NODE_ENV: 'production',
        PORT: 6000,
      },

      // Log config
      out_file:   './logs/pm2-out.log',
      error_file: './logs/pm2-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Watch (disabled in production — use pm2 reload for deploys)
      watch: false,

      // Graceful shutdown — allow in-flight requests to complete
      kill_timeout: 5000,
      listen_timeout: 10000,

      // Source map support for better stack traces
      source_map_support: false,
    },
  ],
};
