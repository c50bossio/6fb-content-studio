param(
  [Parameter(Mandatory = $true)][string]$SignedArtifactPath,
  [Parameter(Mandatory = $true)][string]$ExpectedPublisherDn
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$source = (Resolve-Path -LiteralPath $SignedArtifactPath -ErrorAction Stop).Path
$tampered = Join-Path $env:RUNNER_TEMP "tampered-authenticode-negative-test.exe"
Copy-Item -LiteralPath $source -Destination $tampered -Force

# Establish that all verifier prerequisites and the source signature work before
# entering the expected-failure block.
& "$PSScriptRoot\verify-windows-authenticode.ps1" -Path $source -ExpectedPublisherDn $ExpectedPublisherDn

$rejected = $false
try {
  $stream = [System.IO.File]::Open($tampered, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  try {
    if ($stream.Length -lt 64) { throw "Signed artifact is too small for the tamper test" }
    $stream.Position = 32
    $original = $stream.ReadByte()
    $stream.Position = 32
    $stream.WriteByte($original -bxor 0xFF)
    $stream.Flush($true)
  } finally {
    $stream.Dispose()
  }

  try {
    & "$PSScriptRoot\verify-windows-authenticode.ps1" -Path $tampered -ExpectedPublisherDn $ExpectedPublisherDn
  } catch {
    if ($_.Exception.Message -notmatch '^SignTool verification failed for .+ with exit code [1-9]\d*$') {
      throw
    }
    $rejected = $true
    Write-Host "Tampered Authenticode negative test rejected as expected: $($_.Exception.Message)"
  }
} finally {
  Remove-Item -LiteralPath $tampered -Force -ErrorAction SilentlyContinue
}

if (-not $rejected) { throw "Authenticode verifier accepted a tampered executable" }
