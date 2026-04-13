@echo off
setlocal
for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
if "%~1"=="--" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\single-track-flow.ps1" -Mode preview %2 %3 %4 %5 %6 %7 %8 %9
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\scripts\single-track-flow.ps1" -Mode preview %*
)
