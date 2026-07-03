@echo off
setlocal
cd /d "%~dp0"
set "LOGINTO_DESKTOP_STORAGE_KIND=sqlite"
set "LOGINTO_DESKTOP_SQLITE_VAULT_PATH=%CD%\.tmp\desktop-shell-preview.sqlite"
echo Starting LoginTo app windows with desktop SQLite storage...
echo.
echo Desktop vault database:
echo %LOGINTO_DESKTOP_SQLITE_VAULT_PATH%
echo.
call "%~dp0LoginTo-App-Windows.cmd" %*
