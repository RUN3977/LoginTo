@echo off
setlocal
cd /d "%~dp0"
echo This will stop LoginTo local services and archive the current .tmp data.
echo Your archived data will be moved to .tmp-archives.
echo.
choice /C YN /N /M "Continue? [Y/N] "
if errorlevel 2 (
  echo Reset cancelled.
  pause
  exit /b 0
)
echo.
echo Stopping LoginTo local services...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*--user-data-dir=*app-window-*' -and ($_.CommandLine -like '*msedge.exe*' -or $_.CommandLine -like '*chrome.exe*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*node.exe tools/start-terminal-previews.mjs*' -or $_.CommandLine -like '*node.exe*tools*start-terminal-previews.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo.
call tools\with-toolchain.cmd node tools\reset-preview-state.mjs --yes
if errorlevel 1 (
  echo.
  echo Reset failed. Close any LoginTo window or terminal using LoginTo files and try again.
  pause
  exit /b 1
)
echo.
echo Reset complete. Double-click LoginTo.cmd to start with fresh local data.
echo.
pause
