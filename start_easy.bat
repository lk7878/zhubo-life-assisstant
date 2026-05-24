@echo off
setlocal enableextensions
title zhubo_sys easy start

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "PORT=8000"

echo ========================================
echo zhubo_sys easy start
echo ========================================

REM ---- Pick Python (prefer backend\.venv) ----
if exist "%BACKEND_DIR%\.venv\Scripts\python.exe" (
  set "PYTHON_EXE=%BACKEND_DIR%\.venv\Scripts\python.exe"
) else (
  set "PYTHON_EXE=python"
)

call "%PYTHON_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Python not available. Run install_dev bat first.
  pause
  exit /b 1
)

REM ---- [1/4] Free port 8000 if any process is still listening ----
echo [1/4] Releasing port %PORT% if occupied ...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo   - Killing stale process PID %%P
  taskkill /F /PID %%P >nul 2>&1
)

REM ---- [2/4] Build frontend so latest UI is served ----
if exist "%FRONTEND_DIR%\package.json" (
  where npm >nul 2>&1
  if not errorlevel 1 (
    echo [2/4] Building frontend ...
    pushd "%FRONTEND_DIR%"
    call npm run build
    if errorlevel 1 (
      echo   [WARN] Frontend build failed, will still try to start backend.
    )
    popd
  ) else (
    echo [2/4] npm not found, skip frontend build.
  )
) else (
  echo [2/4] frontend\package.json not found, skip build.
)

REM ---- [3/4] Start backend in a new window (via TEMP helper bat) ----
echo [3/4] Starting backend from source ...
set "RUNNER=%TEMP%\_zhubo_run_backend.bat"
> "%RUNNER%" echo @echo off
>> "%RUNNER%" echo title zhubo backend
>> "%RUNNER%" echo cd /d "%BACKEND_DIR%"
>> "%RUNNER%" echo "%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port %PORT%
>> "%RUNNER%" echo echo.
>> "%RUNNER%" echo echo Backend stopped. Press any key to close.
>> "%RUNNER%" echo pause

start "" "%RUNNER%"

REM ---- [4/4] Wait for backend then open browser ----
echo [4/4] Waiting for backend on port %PORT% ...
set /a _retry=0
:WAIT_BACKEND
set /a _retry+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/api/health' -UseBasicParsing -TimeoutSec 1).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto BACKEND_READY
if %_retry% GEQ 20 goto BACKEND_TIMEOUT
timeout /t 1 /nobreak >nul
goto WAIT_BACKEND

:BACKEND_READY
echo   - Backend is ready.
start "" "http://127.0.0.1:%PORT%"
echo.
echo ========================================
echo   Service is running. URLs to share:
echo ========================================
echo   Local  : http://127.0.0.1:%PORT%
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo   LAN    : http://%%b:%PORT%
)
echo.
echo Tip: If LAN colleagues cannot reach the URL above, run setup_lan.bat
echo      once as Administrator to open Windows Firewall port %PORT%.
echo.
echo Close the "zhubo backend" window to stop the service.
goto END

:BACKEND_TIMEOUT
echo [WARN] Backend did not respond within 20s. Check the backend window for errors.
start "" "http://127.0.0.1:%PORT%"

:END
echo.
pause
