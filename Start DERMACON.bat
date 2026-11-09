@echo off
title DERMACON 2028 - Server
color 0A
echo =======================================================
echo       STARTING DERMACON 2028 OFFLINE SYSTEM
echo =======================================================
echo.
echo [1/2] Starting Local Database (Docker)...
call npx supabase start
echo.
echo [2/2] Starting Website (Next.js)...
start http://localhost:3000
npm run dev
