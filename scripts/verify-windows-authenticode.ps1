param(
  [Parameter(Mandatory = $true)][string[]]$Path,
  [Parameter(Mandatory = $true)][string]$ExpectedPublisherDn
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-CanonicalDistinguishedName([string]$DistinguishedName) {
  $name = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new($DistinguishedName)
  return $name.Decode([System.Security.Cryptography.X509Certificates.X500DistinguishedNameFlags]::UseCommas)
}

function Find-SignTool {
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
  $candidate = Get-ChildItem -Path $kitsRoot -File -Filter "signtool.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $candidate) { throw "Windows SDK signtool.exe was not found" }
  return $candidate.FullName
}

$expectedCanonicalDn = Get-CanonicalDistinguishedName $ExpectedPublisherDn
$signTool = Find-SignTool
$codeSigningOid = "1.3.6.1.5.5.7.3.3"

foreach ($requestedPath in $Path) {
  $resolvedPath = (Resolve-Path -LiteralPath $requestedPath -ErrorAction Stop).Path
  $file = Get-Item -LiteralPath $resolvedPath -ErrorAction Stop
  if (-not $file.PSIsContainer -and $file.Length -le 0) { throw "Signed artifact is empty: $($file.Name)" }
  if ($file.PSIsContainer) { throw "Signed artifact path is a directory: $($file.Name)" }

  & $signTool verify /pa /all /tw /v $resolvedPath
  if ($LASTEXITCODE -ne 0) { throw "SignTool verification failed for $($file.Name) with exit code $LASTEXITCODE" }

  $signature = Get-AuthenticodeSignature -LiteralPath $resolvedPath
  if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
    throw "Invalid Authenticode signature for $($file.Name): $($signature.Status)"
  }
  if ($signature.SignatureType -ne [System.Management.Automation.SignatureType]::Authenticode) {
    throw "Unexpected signature type for $($file.Name): $($signature.SignatureType)"
  }
  if (-not $signature.SignerCertificate) { throw "Missing signer certificate for $($file.Name)" }
  if (-not $signature.TimeStamperCertificate) { throw "Missing trusted timestamp for $($file.Name)" }

  $actualCanonicalDn = Get-CanonicalDistinguishedName $signature.SignerCertificate.Subject
  if ($actualCanonicalDn -ne $expectedCanonicalDn) {
    throw "Unexpected signer subject for $($file.Name)"
  }

  $ekuExtension = $signature.SignerCertificate.Extensions | Where-Object {
    $_.Oid.Value -eq "2.5.29.37"
  } | Select-Object -First 1
  if (-not $ekuExtension) { throw "Missing enhanced key usage for $($file.Name)" }
  $enhancedKeyUsage = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]$ekuExtension
  $hasCodeSigningEku = $enhancedKeyUsage.EnhancedKeyUsages | Where-Object { $_.Value -eq $codeSigningOid }
  if (-not $hasCodeSigningEku) { throw "Missing code-signing EKU for $($file.Name)" }

  Write-Host "Verified Authenticode: $($file.Name)"
  Write-Host "Signer subject: $($signature.SignerCertificate.Subject)"
  Write-Host "Signer thumbprint: $($signature.SignerCertificate.Thumbprint)"
  Write-Host "Timestamp thumbprint: $($signature.TimeStamperCertificate.Thumbprint)"
}
