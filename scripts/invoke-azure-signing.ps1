param(
  [Parameter(Mandatory = $true)][string]$ArtifactPath,
  [Parameter(Mandatory = $true)][string]$Endpoint,
  [Parameter(Mandatory = $true)][string]$AccountName,
  [Parameter(Mandatory = $true)][string]$ProfileName,
  [Parameter(Mandatory = $true)][string]$ExpectedPublisherDn
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$resolvedArtifact = (Resolve-Path -LiteralPath $ArtifactPath -ErrorAction Stop).Path
if ([System.IO.Path]::GetExtension($resolvedArtifact) -ne ".exe") {
  throw "Azure Artifact Signing accepts only EXE files in this release path"
}
if ($Endpoint -notmatch '^https://[a-z0-9.-]+\.codesigning\.azure\.net/?$') {
  throw "Invalid Azure Artifact Signing endpoint"
}

Import-Module TrustedSigning -RequiredVersion 0.5.8 -ErrorAction Stop

$signingParameters = @{
  Endpoint = $Endpoint
  CodeSigningAccountName = $AccountName
  CertificateProfileName = $ProfileName
  Files = $resolvedArtifact
  FileDigest = "SHA256"
  TimestampRfc3161 = "http://timestamp.acs.microsoft.com"
  TimestampDigest = "SHA256"
  EnhancedKeyUsage = "1.3.6.1.5.5.7.3.3"
  Timeout = 300
  BatchSize = 0
  ExcludeEnvironmentCredential = $true
  ExcludeWorkloadIdentityCredential = $true
  ExcludeManagedIdentityCredential = $true
  ExcludeSharedTokenCacheCredential = $true
  ExcludeVisualStudioCredential = $true
  ExcludeVisualStudioCodeCredential = $true
  ExcludeAzureCliCredential = $false
  ExcludeAzurePowerShellCredential = $true
  ExcludeAzureDeveloperCliCredential = $true
  ExcludeInteractiveBrowserCredential = $true
}

Invoke-TrustedSigning @signingParameters | Out-Host

# TrustedSigning 0.5.8 can classify a SignTool warning exit as successful.
# Verify every exact artifact immediately so electron-builder cannot advance on
# a missing, invalid, wrongly issued, or untimestamped signature.
& "$PSScriptRoot\verify-windows-authenticode.ps1" `
  -Path $resolvedArtifact `
  -ExpectedPublisherDn $ExpectedPublisherDn
