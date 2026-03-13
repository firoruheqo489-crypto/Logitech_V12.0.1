module.exports = {
  apps: [
    {
      name: 'mold-gantt-v3',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
    },
  ],
};
