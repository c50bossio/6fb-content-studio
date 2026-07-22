param(
  [Parameter(Mandatory = $true)][string]$ExpectedPublisherDn
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$unsignedPath = Join-Path $env:RUNNER_TEMP "unsigned-authenticode-negative-test.exe"
Remove-Item -LiteralPath $unsignedPath -Force -ErrorAction SilentlyContinue
Add-Type -TypeDefinition @"
public static class UnsignedAuthenticodeNegativeTest {
  public static void Main() { }
}
"@ -Language CSharp -OutputAssembly $unsignedPath -OutputType ConsoleApplication

# Resolve prerequisites outside the expected-failure block so a missing SDK or
# malformed expected DN cannot masquerade as a successful negative test.
$null = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new($ExpectedPublisherDn)
$signTool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signTool) {
  $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
  $signTool = Get-ChildItem -Path $kitsRoot -File -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Select-Object -First 1
}
if (-not $signTool) { throw "Windows SDK signtool.exe was not found before the negative test" }
$unsignedSignature = Get-AuthenticodeSignature -LiteralPath $unsignedPath
if ($unsignedSignature.Status -ne [System.Management.Automation.SignatureStatus]::NotSigned) {
  throw "Negative-test fixture was unexpectedly signed: $($unsignedSignature.Status)"
}

$rejected = $false
try {
  & "$PSScriptRoot\verify-windows-authenticode.ps1" -Path $unsignedPath -ExpectedPublisherDn $ExpectedPublisherDn
} catch {
  if ($_.Exception.Message -notmatch '^SignTool verification failed for .+ with exit code [1-9]\d*$') {
    throw
  }
  $rejected = $true
  Write-Host "Unsigned Authenticode negative test rejected as expected: $($_.Exception.Message)"
} finally {
  Remove-Item -LiteralPath $unsignedPath -Force -ErrorAction SilentlyContinue
}

if (-not $rejected) { throw "Authenticode verifier accepted an unsigned executable" }
