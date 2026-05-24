@echo off
REM =====================================================================
REM  zhubo_sys daily backup
REM  - Copies SQLite DB with timestamp
REM  - Zips files/ and uploads/ with timestamp
REM  - Deletes backup files older than 30 days
REM  - Intended to be invoked by Windows Task Scheduler (see setup_lan.bat)
REM    but can also be double-clicked manually for an ad-hoc backup.
REM =====================================================================
setlocal enableextensions

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "BACKUP_DIR=%ROOT_DIR%backups"
set "DB_FILE=%BACKEND_DIR%\zhubo_sys.db"
set "FILES_DIR=%BACKEND_DIR%\files"
set "UPLOADS_DIR=%BACKEND_DIR%\uploads"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM ---- Timestamp YYYYMMDD_HHMMSS via PowerShell (locale-independent) ----
for /f "usebackq tokens=*" %%t in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"`) do set "TS=%%t"

echo [%TS%] zhubo_sys backup starting...
echo   target: %BACKUP_DIR%

REM ---- 1) DB ----
if exist "%DB_FILE%" (
  copy /Y "%DB_FILE%" "%BACKUP_DIR%\zhubo_sys_%TS%.db" >nul
  if errorlevel 1 (
    echo   [WARN] failed to copy DB
  ) else (
    echo   [OK]   DB    -^> zhubo_sys_%TS%.db
  )
) else (
  echo   [SKIP] DB not found: %DB_FILE%
)

REM ---- 2) files/ ----
if exist "%FILES_DIR%" (
  powershell -NoProfile -Command ^
    "if ((Get-ChildItem '%FILES_DIR%' -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) { Compress-Archive -Path '%FILES_DIR%\*' -DestinationPath '%BACKUP_DIR%\files_%TS%.zip' -Force }"
  if exist "%BACKUP_DIR%\files_%TS%.zip" (
    echo   [OK]   files -^> files_%TS%.zip
  ) else (
    echo   [SKIP] files/ is empty
  )
) else (
  echo   [SKIP] files/ not found
)

REM ---- 3) uploads/ ----
if exist "%UPLOADS_DIR%" (
  powershell -NoProfile -Command ^
    "if ((Get-ChildItem '%UPLOADS_DIR%' -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) { Compress-Archive -Path '%UPLOADS_DIR%\*' -DestinationPath '%BACKUP_DIR%\uploads_%TS%.zip' -Force }"
  if exist "%BACKUP_DIR%\uploads_%TS%.zip" (
    echo   [OK]   uploads -^> uploads_%TS%.zip
  ) else (
    echo   [SKIP] uploads/ is empty
  )
) else (
  echo   [SKIP] uploads/ not found
)

REM ---- 4) Prune backups older than 30 days ----
echo   pruning files older than 30 days...
powershell -NoProfile -Command ^
  "Get-ChildItem -LiteralPath '%BACKUP_DIR%' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; Write-Host ('   [DEL]  ' + $_.Name) }"

echo [%TS%] zhubo_sys backup done.
exit /b 0
