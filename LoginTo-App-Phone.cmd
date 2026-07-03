@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting LoginTo phone app window...
echo.
echo Keep this window open while using LoginTo.
echo.

call tools\with-toolchain.cmd node tools\start-terminal-app-windows.mjs --terminal mobile
if errorlevel 1 (
  echo.
  echo LoginTo phone app window failed to start.
  echo.
  pause
  exit /b 1
)
