#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

OS_NAME="$(uname -s)"
ARCH_NAME="$(uname -m)"
if [[ "$OS_NAME" != "Darwin" || "$ARCH_NAME" != "arm64" ]]; then
  echo "This runtime builder currently supports macOS arm64 only." >&2
  exit 1
fi

RUNTIME_ID="darwin-arm64"
VENV_DIR="$ROOT_DIR/python/.build-venv"
BUILD_DIR="$ROOT_DIR/python/build"
DIST_DIR="$ROOT_DIR/python/dist"
RUNTIME_DIR="$ROOT_DIR/python/runtime/$RUNTIME_ID"
TOOLS_DIR="$ROOT_DIR/python/tools"
MACOS_CONSTRAINTS="$TOOLS_DIR/clip_extractor/requirements-macos-arm64.lock"
FFMPEG_STATIC="$(node -p "require('ffmpeg-static')")"
FFPROBE_STATIC="$(node -p "require('ffprobe-static').path")"

if [[ ! -x "$FFMPEG_STATIC" ]]; then
  FFMPEG_STATIC="$(command -v ffmpeg || true)"
fi

if [[ ! -x "$FFPROBE_STATIC" ]]; then
  FFPROBE_STATIC="$(command -v ffprobe || true)"
fi

if [[ ! -x "$FFMPEG_STATIC" ]]; then
  echo "ffmpeg binary not found. Install ffmpeg or run npm install with a compatible ffmpeg-static package." >&2
  exit 1
fi

if [[ ! -x "$FFPROBE_STATIC" ]]; then
  echo "ffprobe binary not found. Install ffmpeg or run npm install with a compatible ffprobe-static package." >&2
  exit 1
fi

"$PYTHON_BIN" -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip 'setuptools<82' wheel
"$VENV_DIR/bin/python" -m pip install --constraint "$MACOS_CONSTRAINTS" pyinstaller
"$VENV_DIR/bin/python" -m pip install --constraint "$MACOS_CONSTRAINTS" -r "$TOOLS_DIR/clip_extractor/requirements.txt"
"$VENV_DIR/bin/python" -m pip check

MLX_METALLIB="$("$VENV_DIR/bin/python" - <<'PY'
import importlib.util
from pathlib import Path

spec = importlib.util.find_spec("mlx")
if spec and spec.submodule_search_locations:
    candidate = Path(next(iter(spec.submodule_search_locations))) / "lib" / "mlx.metallib"
    if candidate.exists():
        print(candidate)
PY
)"

if [[ -z "$MLX_METALLIB" ]]; then
  echo "mlx.metallib was not found in the macOS runtime environment." >&2
  echo "Refusing to build a pipeline runtime without MLX Metal support." >&2
  exit 1
fi

rm -rf "$BUILD_DIR" "$DIST_DIR" "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR/bin" "$RUNTIME_DIR/pipeline"

"$VENV_DIR/bin/pyinstaller" \
  --noconfirm \
  --clean \
  --onedir \
  --name 6fb-pipeline \
  --distpath "$DIST_DIR" \
  --workpath "$BUILD_DIR" \
  --specpath "$BUILD_DIR" \
  --paths "$TOOLS_DIR" \
  --exclude-module torch \
  --exclude-module torchvision \
  --exclude-module torchaudio \
  --exclude-module tensorflow \
  --exclude-module jax \
  --hidden-import clip_extractor.__main__ \
  --collect-all mediapipe \
  --collect-all cv2 \
  --collect-all mlx \
  --collect-all mlx_whisper \
  --collect-all tiktoken \
  --collect-all huggingface_hub \
  --add-data "$MLX_METALLIB:mlx/lib" \
  --add-data "$TOOLS_DIR/clip_extractor/config.yaml:clip_extractor" \
  --add-data "$TOOLS_DIR/clip_extractor/models:clip_extractor/models" \
  "$TOOLS_DIR/pipeline/full_pipeline.py"

cp -R "$DIST_DIR/6fb-pipeline" "$RUNTIME_DIR/pipeline/"
cp "$FFMPEG_STATIC" "$RUNTIME_DIR/bin/ffmpeg"
cp "$FFPROBE_STATIC" "$RUNTIME_DIR/bin/ffprobe"
chmod +x "$RUNTIME_DIR/pipeline/6fb-pipeline/6fb-pipeline" "$RUNTIME_DIR/bin/ffmpeg" "$RUNTIME_DIR/bin/ffprobe"

cat > "$RUNTIME_DIR/runtime.json" <<JSON
{
  "platform": "$RUNTIME_ID",
  "pipelineBinary": "pipeline/6fb-pipeline/6fb-pipeline",
  "ffmpeg": "bin/ffmpeg",
  "ffprobe": "bin/ffprobe",
  "builtAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
JSON

(cd "$ROOT_DIR" && node scripts/assert-packaged-runtime.cjs "$RUNTIME_ID")

echo "Pipeline runtime built at $RUNTIME_DIR"
