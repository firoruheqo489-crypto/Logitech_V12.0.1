@echo off
setlocal
cd /d "%~dp0\.."
pnpm.cmd run dev:dashboard:local
