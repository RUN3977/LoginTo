@echo off
setlocal
cd /d "%~dp0"

echo.
echo Generating LoginTo local app package...
echo.

call tools\with-toolchain.cmd node tools\package-usable-preview.mjs
if errorlevel 1 (
  echo.
  echo Package generation failed. Start LoginTo first with LoginTo-Start.cmd, then try again.
  pause
  exit /b 1
)

echo.
echo Opening dist\LoginTo-usable-preview ...
start "" "dist\LoginTo-usable-preview"
pause
