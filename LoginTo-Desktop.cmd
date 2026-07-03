@echo off
setlocal
cd /d "%~dp0"

echo.
echo Starting LoginTo desktop app window...
echo.

call tools\with-toolchain.cmd node tools\start-desktop-native-shell.mjs
if errorlevel 1 (
  echo.
  echo Desktop app window failed to start. Check:
  echo   .tmp\desktop-native-shell.out.log
  echo   .tmp\desktop-native-shell.err.log
  echo.
  pause
  exit /b 1
)

echo.
echo LoginTo desktop app window is ready.
echo.
pause
