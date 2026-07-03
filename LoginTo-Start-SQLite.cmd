@echo off
setlocal
cd /d "%~dp0"
set "LOGINTO_DESKTOP_STORAGE_KIND=sqlite"
set "LOGINTO_DESKTOP_SQLITE_VAULT_PATH=%CD%\.tmp\desktop-shell-preview.sqlite"
echo Starting LoginTo browser preview with desktop SQLite storage...
echo.
echo Desktop vault database:
echo %LOGINTO_DESKTOP_SQLITE_VAULT_PATH%
echo.
echo Keep this window open while using LoginTo.
echo Close this window or run LoginTo-Stop.cmd to stop the local services.
echo.
call tools\run-terminal-previews.cmd --open
