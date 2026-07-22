Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$ArgumentList
  )
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Native command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
  }
}

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PythonBin = if ($env:PYTHON_BIN) { $env:PYTHON_BIN } else { "python" }

$IsWindowsHost = $env:OS -eq "Windows_NT"
if (-not $IsWindowsHost) {
  Write-Error "This runtime builder supports Windows x64 only."
  exit 1
}

$Arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($Arch -ne "AMD64") {
  Write-Error "This runtime builder supports Windows x64 only. Detected: $Arch"
  exit 1
}

$RuntimeId = "win32-x64"
$VenvDir = Join-Path $RootDir "python/.build-venv-$RuntimeId"
$BuildDir = Join-Path $RootDir "python/build"
$DistDir = Join-Path $RootDir "python/dist"
$RuntimeDir = Join-Path $RootDir "python/runtime/$RuntimeId"
$ToolsDir = Join-Path $RootDir "python/tools"
$RuntimeBinDir = Join-Path $RuntimeDir "bin"
$RuntimePipelineDir = Join-Path $RuntimeDir "pipeline"

Push-Location $RootDir
try {
  $FfmpegStatic = (Invoke-NativeCommand -FilePath "node" -ArgumentList @("-p", "require('ffmpeg-static')") | Out-String).Trim()
  $FfprobeStatic = (Invoke-NativeCommand -FilePath "node" -ArgumentList @("-p", "require('ffprobe-static').path") | Out-String).Trim()

  if ([string]::IsNullOrWhiteSpace($FfmpegStatic) -or -not (Test-Path $FfmpegStatic -PathType Leaf)) {
    Write-Error "ffmpeg-static binary not found. Run npm install first."
    exit 1
  }

  if ([string]::IsNullOrWhiteSpace($FfprobeStatic) -or -not (Test-Path $FfprobeStatic -PathType Leaf)) {
    Write-Error "ffprobe-static binary not found. Run npm install first."
    exit 1
  }

  Invoke-NativeCommand $PythonBin -m venv $VenvDir
  $VenvPython = Join-Path $VenvDir "Scripts/python.exe"
  $VenvPyinstaller = Join-Path $VenvDir "Scripts/pyinstaller.exe"

  Invoke-NativeCommand $VenvPython -m pip install --upgrade pip "setuptools<82" wheel
  Invoke-NativeCommand $VenvPython -m pip install pyinstaller
  Invoke-NativeCommand $VenvPython -m pip install -r (Join-Path $ToolsDir "clip_extractor/requirements.txt")
  Invoke-NativeCommand $VenvPython -m pip check

  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $BuildDir, $DistDir, $RuntimeDir
  New-Item -ItemType Directory -Force $RuntimeBinDir, $RuntimePipelineDir | Out-Null

  $PyinstallerArgs = @(
    "--noconfirm", "--clean", "--onedir", "--name", "6fb-pipeline",
    "--distpath", $DistDir, "--workpath", $BuildDir, "--specpath", $BuildDir,
    "--paths", $ToolsDir,
    "--exclude-module", "torch", "--exclude-module", "torchvision",
    "--exclude-module", "torchaudio", "--exclude-module", "tensorflow",
    "--exclude-module", "jax", "--hidden-import", "clip_extractor.__main__",
    "--collect-all", "mediapipe", "--collect-all", "cv2",
    "--collect-all", "faster_whisper", "--collect-all", "ctranslate2",
    "--collect-all", "tokenizers", "--collect-all", "av",
    "--collect-all", "huggingface_hub",
    "--add-data", "$ToolsDir/clip_extractor/config.yaml;clip_extractor",
    "--add-data", "$ToolsDir/clip_extractor/models;clip_extractor/models",
    "$ToolsDir/pipeline/full_pipeline.py"
  )
  Invoke-NativeCommand $VenvPyinstaller @PyinstallerArgs

  Copy-Item -Recurse -Force (Join-Path $DistDir "6fb-pipeline") $RuntimePipelineDir
  Copy-Item -Force $FfmpegStatic (Join-Path $RuntimeBinDir "ffmpeg.exe")
  Copy-Item -Force $FfprobeStatic (Join-Path $RuntimeBinDir "ffprobe.exe")

  $RuntimeJson = [ordered]@{
    platform = $RuntimeId
    pipelineBinary = "pipeline/6fb-pipeline/6fb-pipeline.exe"
    ffmpeg = "bin/ffmpeg.exe"
    ffprobe = "bin/ffprobe.exe"
    builtAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  } | ConvertTo-Json

  $RuntimeJsonPath = Join-Path $RuntimeDir "runtime.json"
  $Utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($RuntimeJsonPath, $RuntimeJson, $Utf8NoBom)
  Write-Host "Pipeline runtime built at $RuntimeDir"
} finally {
  Pop-Location
}
