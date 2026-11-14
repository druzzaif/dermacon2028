@echo off
cd /d "%~dp0"
title DERMACON - Fast Dev Server
color 0A
echo =======================================================
echo       DERMACON - FAST MODE (hot reload)
echo =======================================================
echo.
echo [1/2] Starting Local Database (Docker)...
call npx supabase start
echo.
echo [2/2] Starting the fast development server on http://localhost:3000 ...
echo Fast Refresh is enabled; code changes appear without rebuilding the production app.
call npm run dev
pause
