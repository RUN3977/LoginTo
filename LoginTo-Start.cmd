@echo off
setlocal
cd /d "%~dp0"
echo Starting LoginTo browser preview for debugging...
echo.
echo.
echo Keep this window open while using LoginTo.
echo Close this window or run LoginTo-Stop.cmd to stop the local services.
echo.
call tools\run-terminal-previews.cmd --open
