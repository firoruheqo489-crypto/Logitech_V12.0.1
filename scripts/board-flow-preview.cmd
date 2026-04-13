@echo off
setlocal
for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
if "%~1"=="--" shift
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\single-track-flow.ps1" -Mode preview %*
