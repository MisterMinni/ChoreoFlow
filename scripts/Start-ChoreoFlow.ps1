param([ValidateSet('web','iphone')][string]$Target = 'web')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath 'node_modules')) {
  Write-Host 'Bitte einmal npm ci im Projektordner ausführen.'
  exit 1
}
& npm.cmd run "dev:$Target"
exit $LASTEXITCODE
