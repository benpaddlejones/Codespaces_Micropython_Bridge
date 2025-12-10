/**
 * PM2 Ecosystem Configuration
 *
 * This configuration ensures MAXIMUM AVAILABILITY for the Pi Pico Bridge.
 *
 * Features:
 * - Auto-restart on crash (unlimited restarts)
 * - Memory limit with auto-restart
 * - Exponential backoff on restart
 * - Log rotation
 * - Watch for file changes (development)
 * - Cluster mode disabled (serial port access)
 *
 * Usage:
 *   npm run start:pm2   - Start with PM2
 *   npm run stop:pm2    - Stop
 *   npm run logs        - View logs
 *   npm run monitor     - Real-time monitoring
 */

module.exports = {
  apps: [
    {
      name: "pico-bridge",
      script: "server.js",
      cwd: __dirname,

      // Always expose GC for memory management
      node_args: "--expose-gc",

      // Environment
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // ============================================
      // HIGH AVAILABILITY SETTINGS
      // ============================================

      // Auto-restart settings
      autorestart: true,
      max_restarts: 9999, // Effectively unlimited restarts
      min_uptime: "5s", // Consider started after 5 seconds
      restart_delay: 1000, // Wait 1 second between restarts

      // Exponential backoff for repeated crashes
      exp_backoff_restart_delay: 100, // Start at 100ms, doubles each time

      // Memory limits (restart if exceeded)
      max_memory_restart: "256M",

      // Don't stop on file changes in production
      watch: false,
      ignore_watch: ["node_modules", "logs", "*.log", ".git"],

      // ============================================
      // LOGGING
      // ============================================

      // Log files
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",

      // Log rotation
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // ============================================
      // PROCESS SETTINGS
      // ============================================

      // Single instance (required for serial port)
      instances: 1,
      exec_mode: "fork",

      // Kill timeout
      kill_timeout: 10000, // 10 seconds to gracefully shutdown

      // Listen timeout
      listen_timeout: 10000,

      // Wait for ready signal before considering started
      wait_ready: false, // Don't wait, just check uptime

      // ============================================
      // HEALTH CHECKS (PM2 Plus feature)
      // ============================================

      // These require PM2 Plus, but included for completeness
      // health_check: {
      //   url: "http://localhost:3000/api/health",
      //   interval: 30000,
      // },
    },
  ],

  // Deploy configuration (optional)
  deploy: {
    production: {
      user: "root",
      host: "localhost",
      ref: "origin/main",
      repo: ".",
      path: ".",
      "post-deploy":
        "npm install && pm2 reload ecosystem.config.js --env production",
    },
  },
};
