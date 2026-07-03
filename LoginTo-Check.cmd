@echo off
setlocal
cd /d "%~dp0"

echo.
echo Checking LoginTo desktop, phone, and tablet local services...
echo.

call tools\with-toolchain.cmd node tools\check-terminal-previews.mjs
if errorlevel 1 (
  echo.
  echo LoginTo local service check failed.
  echo Start LoginTo with LoginTo.cmd, then run this check again.
  echo.
  pause
  exit /b 1
)

echo.
echo LoginTo local services are reachable.
echo.
pause
