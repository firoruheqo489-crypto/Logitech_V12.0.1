@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0single-track-flow.ps1" -Mode deploy %*
