@echo off
setlocal

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "TOOLCHAIN=%ROOT%\.toolchain"
set "NODE_BIN=%TOOLCHAIN%\node-v24.16.0-win-x64"
set "RUST_BIN=%TOOLCHAIN%\rust-1.96.0-x86_64-pc-windows-gnu\bin"
set "CARGO_HOME=%TOOLCHAIN%\cargo"
set "RUSTUP_HOME=%TOOLCHAIN%\rustup"
set "COREPACK_HOME=%TOOLCHAIN%\corepack"
set "PATH=%NODE_BIN%;%RUST_BIN%;%CARGO_HOME%\bin;%PATH%"

if "%~1"=="" (
  echo LoginTo toolchain is active for this command shell.
  node --version
  npm --version
  pnpm --version
  rustc --version
  cargo --version
  cmd /k
) else (
  %*
)
