@echo off
setlocal
cd /d "%~dp0"
if not exist ".tmp" mkdir ".tmp"
echo Opening LoginTo local data folder:
echo %CD%\.tmp
start "" "%CD%\.tmp"
