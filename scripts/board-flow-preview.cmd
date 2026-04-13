@echo off
setlocal
if "%~1"=="--" shift
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0single-track-flow.ps1" -Mode preview %*
