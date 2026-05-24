@echo off
REM =====================================================================
REM  zhubo_sys LAN setup (one-time, requires Administrator)
REM  - Opens Windows Firewall TCP port 8000 inbound for the whole LAN
REM  - Registers a daily 03:00 backup task pointing to backup_daily.bat
REM =====================================================================
setlocal enableextensions
title zhubo_sys LAN setup

REM ---- Require Administrator ----
NET FILE 1>NUL 2>NUL
if errorlevel 1 (
  echo ========================================
  echo   This script must be run as Administrator
  echo ========================================
  echo.
  echo Please right-click setup_lan.bat and choose
  echo "Run as administrator", then try again.
  echo.
  pause
  exit /b 1
)

set "ROOT_DIR=%~dp0"
set "BACKUP_BAT=%ROOT_DIR%backup_daily.bat"
set "PORT=8000"
set "RULE_NAME=zhubo_sys"
set "TASK_NAME=zhubo_sys_daily_backup"

echo.
echo [1/2] Configuring Windows Firewall (TCP %PORT% inbound) ...
netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% profile=any
if errorlevel 1 (
  echo   [FAIL] failed to add firewall rule.
  pause
  exit /b 1
)
echo   [OK] firewall rule "%RULE_NAME%" added.

echo.
echo [2/2] Registering daily backup task at 03:00 ...
if not exist "%BACKUP_BAT%" (
  echo   [FAIL] backup_daily.bat not found next to this script.
  echo          Expected at: %BACKUP_BAT%
  pause
  exit /b 1
)
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1
schtasks /Create /TN "%TASK_NAME%" ^
  /TR "\"%BACKUP_BAT%\"" ^
  /SC DAILY /ST 03:00 ^
  /RU SYSTEM /RL HIGHEST /F
if errorlevel 1 (
  echo   [FAIL] failed to register scheduled task.
  pause
  exit /b 1
)
echo   [OK] task "%TASK_NAME%" runs every day at 03:00.

echo.
echo ========================================
echo   LAN setup completed
echo ========================================
echo.
echo What changed:
echo   - Windows Firewall now allows inbound TCP %PORT%
echo   - A daily backup task is scheduled at 03:00
echo     (Backup output: %ROOT_DIR%backups\)
echo.
echo Next steps:
echo   1. Run start_easy.bat to start the service (host=0.0.0.0)
echo   2. Find your LAN IP from the printed URLs (or run ipconfig)
echo   3. Share http://YOUR-LAN-IP:%PORT% with your colleagues
echo   4. To run an ad-hoc backup right now, just double-click backup_daily.bat
echo.
pause
