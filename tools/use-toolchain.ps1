$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Toolchain = Join-Path $Root ".toolchain"
$NodeBin = Join-Path $Toolchain "node-v24.16.0-win-x64"
$RustBin = Join-Path $Toolchain "rust-1.96.0-x86_64-pc-windows-gnu\bin"
$CargoHome = Join-Path $Toolchain "cargo"
$RustupHome = Join-Path $Toolchain "rustup"
$CorepackHome = Join-Path $Toolchain "corepack"

foreach ($PathToCheck in @($NodeBin, $RustBin)) {
  if (!(Test-Path $PathToCheck)) {
    throw "Missing LoginTo toolchain path: $PathToCheck"
  }
}

$env:CARGO_HOME = $CargoHome
$env:RUSTUP_HOME = $RustupHome
$env:COREPACK_HOME = $CorepackHome
$env:Path = "$NodeBin;$RustBin;$CargoHome\bin;$env:Path"

Write-Host "LoginTo toolchain is active."
Write-Host "node:  $(& node --version)"
Write-Host "npm:   $(& npm --version)"
Write-Host "pnpm:  $(& pnpm --version)"
Write-Host "rustc: $(& rustc --version)"
Write-Host "cargo: $(& cargo --version)"
