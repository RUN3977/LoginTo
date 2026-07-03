@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting LoginTo tablet app window...
echo.
echo Keep this window open while using LoginTo.
echo.

call tools\with-toolchain.cmd node tools\start-terminal-app-windows.mjs --terminal tablet
if errorlevel 1 (
  echo.
  echo LoginTo tablet app window failed to start.
  echo.
  pause
  exit /b 1
)
