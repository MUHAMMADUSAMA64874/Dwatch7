@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Python 3 is not installed or not on PATH.
  pause
  exit /b 1
)

python -c "import bleak, websockets" >nul 2>&1
if errorlevel 1 (
  echo Missing Python dependencies.
  echo Install them with: pip install -r requirements.txt
  pause
  exit /b 1
)

python dashboard_server.py
if errorlevel 1 pause
