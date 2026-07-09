@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_SCRIPT=%SCRIPT_DIR%repair-local-dashboard-dns-and-verify.ps1"

if not exist "%POWERSHELL_SCRIPT%" (
  echo [repair-dashboard] script not found: "%POWERSHELL_SCRIPT%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [repair-dashboard] failed with exit code %EXIT_CODE%
)

exit /b %EXIT_CODE%
