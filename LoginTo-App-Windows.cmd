@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting LoginTo desktop, phone, and tablet app windows...
echo.
echo Keep this window open while using LoginTo.
echo Close this window or run LoginTo-Stop.cmd to stop the local services.
echo.

call tools\with-toolchain.cmd node tools\start-terminal-app-windows.mjs
if errorlevel 1 (
  echo.
  echo LoginTo app windows failed to start.
  echo.
  pause
  exit /b 1
)
