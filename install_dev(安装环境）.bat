@echo off
setlocal

echo ========================================
echo   zhubo_sys dev environment install
echo ========================================

where python >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Python not found, please install Python 3.10+
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [FAIL] npm not found, please install Node.js (with npm)
  pause
  exit /b 1
)

echo.
echo [1/5] Python version:
python --version
if errorlevel 1 (
  echo [FAIL] Python not available
  pause
  exit /b 1
)

echo.
echo [2/5] npm version:
npm --version
if errorlevel 1 (
  echo [FAIL] npm not available
  pause
  exit /b 1
)

echo.
echo [3/5] Preparing backend venv...
if not exist "%~dp0backend\.venv\Scripts\python.exe" (
  python -m venv "%~dp0backend\.venv"
  if errorlevel 1 (
    echo [FAIL] Failed to create backend\.venv
    pause
    exit /b 1
  )
)
echo [OK] backend\.venv ready

echo.
echo [4/5] Installing backend dependencies...
"%~dp0backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
  echo [FAIL] Failed to upgrade pip
  pause
  exit /b 1
)
"%~dp0backend\.venv\Scripts\python.exe" -m pip install -r "%~dp0backend\requirements.txt"
if errorlevel 1 (
  echo [FAIL] Failed to install backend deps
  pause
  exit /b 1
)
echo [OK] Backend deps installed

echo.
echo [5/5] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
  echo [FAIL] Failed to install frontend deps
  cd /d "%~dp0"
  pause
  exit /b 1
)
cd /d "%~dp0"
echo [OK] Frontend deps installed

echo.
echo ========================================
echo   Dev environment ready
echo ========================================
echo.
echo Next:
echo 1) Double click start.bat (or "yi jian qi dong.bat")
echo 2) Open http://127.0.0.1:8000
echo.
pause
