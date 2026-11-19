@echo off
title University Journal Archive Dev
cd /d "%~dp0"

echo  University Journal Archive Dev Servers
echo  Server ^> http://localhost:4000
echo  Client ^> http://localhost:5173
echo  Press Ctrl+C to stop both.
echo.

npm run dev
