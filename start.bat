@echo off
setlocal enabledelayedexpansion

REM Check if Python and dependencies are available
python - <<END
import subprocess, sys
try:
    import bleak, websockets
    print("Python dependencies are installed.")
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install -r requirements.txt")
    sys.exit(1)
END

REM Launch the dashboard server
python dashboard_server.py