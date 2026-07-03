@echo off
setlocal
cd /d "%~dp0"
echo Generating LoginTo readiness report...
echo.
call tools\with-toolchain.cmd node tools\create-readiness-report.mjs
if errorlevel 1 (
  echo.
  echo LoginTo readiness report has warnings. Check:
  echo   .tmp\loginto-readiness-report.md
  echo.
  pause
  exit /b 1
)
echo.
echo Opening .tmp\loginto-readiness-report.md
start "" ".tmp\loginto-readiness-report.md"
echo.
pause
