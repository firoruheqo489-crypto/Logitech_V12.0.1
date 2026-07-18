const path = require('path');

const defaultPythonExecutable = path.join(
  __dirname,
  '.venv',
  process.platform === 'win32' ? 'Scripts' : 'bin',
  process.platform === 'win32' ? 'python.exe' : 'python',
);
const parserRoot = __dirname;

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
        PYTHON_EXECUTABLE: process.env.PYTHON_EXECUTABLE || defaultPythonExecutable,
        PYTHONPATH: process.env.PYTHONPATH
          ? `${parserRoot}${path.delimiter}${process.env.PYTHONPATH}`
          : parserRoot,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000',
        PYTHON_EXECUTABLE: process.env.PYTHON_EXECUTABLE || defaultPythonExecutable,
        PYTHONPATH: process.env.PYTHONPATH
          ? `${parserRoot}${path.delimiter}${process.env.PYTHONPATH}`
          : parserRoot,
      },
    },
  ],
};
