param(
  [Parameter(Mandatory = $true)][string]$Tag,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$ReleaseId
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-BoundedRetry([scriptblock]$Operation, [string]$Description) {
  $lastError = $null
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try { return & $Operation } catch {
      $lastError = $_
      if ($attempt -eq 3) { break }
      $delay = [Math]::Pow(2, $attempt)
      Write-Warning "$Description failed on attempt $attempt; retrying in $delay seconds"
      Start-Sleep -Seconds $delay
    }
  }
  throw "$Description failed after 3 attempts: $($lastError.Exception.Message)"
}

if ($Tag -notmatch '^v\d+\.\d+\.\d+$') { throw "Invalid release tag: $Tag" }
$repository = $env:GITHUB_REPOSITORY
if ([string]::IsNullOrWhiteSpace($repository)) { throw "GITHUB_REPOSITORY is required" }

$headers = @{
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
  "User-Agent" = "6fb-content-studio-release-verifier"
}
if (-not [string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  $headers.Authorization = "Bearer $($env:GH_TOKEN)"
}

if (-not [string]::IsNullOrWhiteSpace($ReleaseId)) {
  if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) { throw "GH_TOKEN is required to download a draft release" }
  $releaseUri = "https://api.github.com/repos/$repository/releases/$ReleaseId"
} else {
  $releaseUri = "https://api.github.com/repos/$repository/releases/tags/$Tag"
}

$release = Invoke-BoundedRetry {
  Invoke-RestMethod -Method Get -Uri $releaseUri -Headers $headers -TimeoutSec 30
} "Release metadata download"

if ($release.tag_name -ne $Tag) { throw "Release tag mismatch: $($release.tag_name)" }
if (-not [string]::IsNullOrWhiteSpace($ReleaseId) -and -not $release.draft) { throw "Expected a draft release" }
if ([string]::IsNullOrWhiteSpace($ReleaseId) -and $release.draft) { throw "Public release lookup returned a draft" }

$version = $Tag.TrimStart('v')
$expectedNames = @(
  "6FB-Content-Studio-Setup-$version.exe",
  "6FB-Content-Studio-$version.exe",
  "6FB-Content-Studio-Setup-$version.exe.blockmap",
  "latest.yml"
)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

foreach ($name in $expectedNames) {
  $matches = @($release.assets | Where-Object { $_.name -eq $name })
  if ($matches.Count -ne 1) { throw "Expected exactly one release asset named $name, found $($matches.Count)" }
  $asset = $matches[0]
  if ($asset.size -le 0) { throw "Release asset is empty: $name" }
  $destination = Join-Path $OutputDirectory $name

  if (-not [string]::IsNullOrWhiteSpace($ReleaseId)) {
    $downloadHeaders = $headers.Clone()
    $downloadHeaders.Accept = "application/octet-stream"
    $downloadUri = $asset.url
  } else {
    $downloadHeaders = @{
      Accept = "application/octet-stream"
      "User-Agent" = "6fb-content-studio-release-verifier"
    }
    $downloadUri = $asset.browser_download_url
  }

  Invoke-BoundedRetry {
    Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -Method Get -Uri $downloadUri -Headers $downloadHeaders -OutFile $destination -UseBasicParsing -TimeoutSec 300
  } "Asset download for $name" | Out-Null

  $file = Get-Item -LiteralPath $destination
  if ($file.Length -ne $asset.size) { throw "Downloaded size mismatch for $name" }
  $sha256 = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
  $digestProperty = $asset.PSObject.Properties["digest"]
  if ($digestProperty -and $digestProperty.Value -and $digestProperty.Value -ne "sha256:$sha256") {
    throw "Downloaded digest mismatch for $name"
  }
  Write-Host "Downloaded Windows release asset: $name ($($file.Length) bytes, sha256:$sha256)"
}
