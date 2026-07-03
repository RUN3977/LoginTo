@echo off
setlocal
cd /d "%~dp0"
echo Stopping LoginTo local services...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*--user-data-dir=*app-window-*' -and ($_.CommandLine -like '*msedge.exe*' -or $_.CommandLine -like '*chrome.exe*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
for %%P in (4173 4177 4178) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    if not "%%A"=="0" (
      taskkill /PID %%A /F >nul 2>nul
    )
  )
)
echo Done.
pause
