@echo off
echo Starting DERMACON 2028 Database...
call npx supabase start
echo.
echo Starting DERMACON 2028 Website...
start http://localhost:3000
npm run dev
