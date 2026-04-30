"""FFprobe wrapper for extracting video metadata."""

import json
import subprocess
from dataclasses import dataclass


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    duration: float
    total_frames: int
    codec: str


def get_video_info(video_path: str) -> VideoInfo:
    """Extract video metadata using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        "-select_streams", "v:0",
        video_path,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=20)
        data = json.loads(result.stdout)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"ffprobe timed out for {video_path}") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise RuntimeError(f"ffprobe failed for {video_path}: {stderr}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"ffprobe returned invalid JSON for {video_path}") from exc

    streams = data.get("streams") or []
    if not streams:
        raise RuntimeError(f"ffprobe found no video stream in {video_path}")

    stream = streams[0]
    fmt = data.get("format") or {}

    # Parse FPS from r_frame_rate (e.g., "30/1" or "30000/1001")
    fps = _parse_rate(stream.get("r_frame_rate", "30/1"))
    duration = _parse_float(fmt.get("duration", stream.get("duration", 0)), "duration")
    width = _parse_int(stream.get("width"), "width")
    height = _parse_int(stream.get("height"), "height")
    total_frames = _parse_frame_count(stream.get("nb_frames"), duration, fps)
    codec = stream.get("codec_name", "unknown")

    return VideoInfo(
        width=width,
        height=height,
        fps=fps,
        duration=duration,
        total_frames=total_frames,
        codec=codec,
    )


def _parse_rate(value: str) -> float:
    parts = str(value or "30/1").split("/")
    try:
        if len(parts) == 2:
            numerator = float(parts[0])
            denominator = float(parts[1])
            if denominator != 0:
                fps = numerator / denominator
                if fps > 0:
                    return fps
        fps = float(parts[0])
        if fps > 0:
            return fps
    except (TypeError, ValueError):
        pass
    return 30.0


def _parse_float(value: object, field: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Invalid ffprobe {field}: {value!r}") from exc
    if parsed < 0:
        raise RuntimeError(f"Invalid ffprobe {field}: {value!r}")
    return parsed


def _parse_int(value: object, field: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"Invalid ffprobe {field}: {value!r}") from exc
    if parsed <= 0:
        raise RuntimeError(f"Invalid ffprobe {field}: {value!r}")
    return parsed


def _parse_frame_count(value: object, duration: float, fps: float) -> int:
    try:
        frames = int(value)
        if frames > 0:
            return frames
    except (TypeError, ValueError):
        pass
    return max(1, int(duration * fps))
