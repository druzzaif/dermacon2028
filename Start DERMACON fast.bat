@echo off
cd /d "%~dp0"
title DERMACON - Fast Server
color 0A
echo =======================================================
echo       DERMACON - FAST MODE (production build)
echo =======================================================
echo.
echo Stopping any old copy of the app on port 3000...
call npx kill-port 3000 >nul 2>&1
echo.
echo [1/3] Starting Local Database (Docker)...
call npx supabase start
echo.
echo [2/3] Building the app (about a minute, only needed after code changes)...
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Scroll up to see the error.
  pause
  exit /b 1
)
echo.
echo [3/3] Starting the app on http://localhost:3000 ...
rem Open the browser a few seconds after the server starts
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
call npm start
pause
