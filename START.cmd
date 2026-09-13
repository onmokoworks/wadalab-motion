@echo off
cd /d "%~dp0"
echo Wadalab Motion - http://127.0.0.1:4184
echo Keep this window open. Press Ctrl+C to stop.
node server.mjs --open
pause
