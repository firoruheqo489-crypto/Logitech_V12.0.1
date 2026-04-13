@echo off
setlocal
for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\single-track-flow.ps1" -Mode status %*
