module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || 'logitech',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'cluster',
      listen_timeout: 15000,
      kill_timeout: 5000,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
