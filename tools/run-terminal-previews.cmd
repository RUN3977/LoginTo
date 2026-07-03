@echo off
setlocal
cd /d "%~dp0\.."
set "PATH=%CD%\.toolchain\node-v24.16.0-win-x64;%CD%\.toolchain\cargo\bin;%PATH%"
".toolchain\node-v24.16.0-win-x64\node.exe" "tools\start-terminal-previews.mjs" %*
