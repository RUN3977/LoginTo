@echo off
setlocal
cd /d "%~dp0.."
set "LOGINTO_DESKTOP_PORT=%LOGINTO_DESKTOP_PORT%"
if "%LOGINTO_DESKTOP_PORT%"=="" set "LOGINTO_DESKTOP_PORT=4173"
".toolchain\node-v24.16.0-win-x64\node.exe" apps\desktop\scripts\dev-server.mjs
