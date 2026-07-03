@echo off
setlocal
cd /d "%~dp0"
echo Running LoginTo usable preview acceptance...
echo.
call tools\with-toolchain.cmd node tools\accept-usable-preview.mjs
if errorlevel 1 (
  echo.
  echo Acceptance failed. Check:
  echo   .tmp\loginto-usable-preview-acceptance.md
  echo.
  pause
  exit /b 1
)
echo.
echo Acceptance passed.
echo Opening .tmp\loginto-usable-preview-acceptance.md
start "" ".tmp\loginto-usable-preview-acceptance.md"
echo.
pause
