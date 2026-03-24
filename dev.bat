@echo off
setlocal

cd /d "%~dp0"
set "ROOT=%cd%"

if not defined BACKEND_PORT set "BACKEND_PORT=8000"
if not defined FRONTEND_PORT set "FRONTEND_PORT=3027"

set "API_BASE=http://127.0.0.1:%BACKEND_PORT%"
set "PYTHON_EXE=python"
if exist "%ROOT%\.venv\Scripts\python.exe" set "PYTHON_EXE=%ROOT%\.venv\Scripts\python.exe"

echo Starting backend on http://127.0.0.1:%BACKEND_PORT%
start "AI-PVE Backend" /D "%ROOT%" cmd /k "set PYTHONPATH=%ROOT% && ""%PYTHON_EXE%"" -m uvicorn backend.main:app --host 127.0.0.1 --port %BACKEND_PORT% --reload"

echo Starting frontend on http://127.0.0.1:%FRONTEND_PORT%
start "AI-PVE Frontend" /D "%ROOT%\frontend" cmd /k "set NEXT_PUBLIC_API_BASE=%API_BASE% && npm run dev -- --hostname 127.0.0.1 --port %FRONTEND_PORT%"

echo.
echo Open http://127.0.0.1:%FRONTEND_PORT%
echo Backend health: http://127.0.0.1:%BACKEND_PORT%/api/health
echo.
echo Tip: set BACKEND_PORT or FRONTEND_PORT before running to override defaults.
exit /b 0
