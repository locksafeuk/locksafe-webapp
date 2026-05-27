/**
 * PM2 Ecosystem Config — LockSafe Mac Studio Agent Runner
 *
 * Usage:
 *   pm2 start ecosystem.config.js        # start
 *   pm2 stop locksafe-agents             # stop
 *   pm2 restart locksafe-agents          # restart
 *   pm2 logs locksafe-agents             # live logs
 *   pm2 monit                            # dashboard
 *   pm2 save                             # persist across reboots
 *   pm2 startup                          # generate launchd/systemd startup entry
 */

module.exports = {
  apps: [
    {
      name: "locksafe-agents",

      // tsx runs TypeScript directly — no compile step needed
      script: "npx",
      args: "tsx --tsconfig tsconfig.json --env-file .env.agent-runner scripts/agent-runner.ts",

      // Working directory = locksafe-webapp root
      cwd: __dirname,

      // Don't treat the process as a cluster — one instance only
      instances: 1,
      exec_mode: "fork",

      // Restart policy
      autorestart: true,
      watch: false,               // don't watch files (we want stability, not hot-reload)
      max_restarts: 20,
      min_uptime: "30s",          // must stay up 30s to count as a successful start
      restart_delay: 10_000,      // wait 10s between restarts to let transient errors clear

      // Memory guard — restart if RSS exceeds 2 GB (agents can be memory-hungry)
      max_memory_restart: "2G",

      // Logs
      out_file: "./logs/agents-out.log",
      error_file: "./logs/agents-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Log rotation (requires pm2-logrotate module)
      log_rotate_options: {
        max_size: "50M",
        retain: "7",
      },

      // Environment — all secrets come from .env.agent-runner via --env-file above.
      // The entries here are non-secret overrides / feature flags only.
      env: {
        NODE_ENV: "production",
        AGENTS_ENABLED: "true",
        OLLAMA_RUNTIME_ENABLED: "true",
        OLLAMA_BASE_URL: "http://localhost:11434",

        // Keep Vercel-specific flag explicitly off so the runtime detector
        // doesn't think we're serverless
        VERCEL: "",
        VERCEL_ENV: "",
      },
    },
  ],
};
