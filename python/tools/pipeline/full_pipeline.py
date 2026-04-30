#!/usr/bin/env python3
"""Full IX Content Pipeline — End-to-end clip production.

Chains: Transcribe → Select → Validate → Reframe → Analyze → Compose → Render → Notify

Usage:
    python tools/pipeline/full_pipeline.py \\
        --video "path/to/video.mp4" \\
        --brand 6fbarber \\
        --clips 5 \\
        --no-post

    # With existing transcript:
    python tools/pipeline/full_pipeline.py \\
        --video "path/to/video.mp4" \\
        --transcript "path/to/transcript.srt" \\
        --brand 6fbarber \\
        --clips 3

    # With AutoResearcher experiment:
    python tools/pipeline/full_pipeline.py \\
        --video "path/to/video.mp4" \\
        --brand 6fbarber \\
        --experiment
"""

import argparse
import json
import os
import subprocess
import sys
import time
import yaml
from pathlib import Path
from datetime import datetime, timezone

def _project_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent.parent


PROJECT_ROOT = _project_root()
TOOLS_ROOT = PROJECT_ROOT / "tools"
SUBPROCESS_CWD = TOOLS_ROOT if TOOLS_ROOT.exists() else PROJECT_ROOT
sys.path.insert(0, str(TOOLS_ROOT))


def _dispatch_frozen_module() -> None:
    """Let the frozen pipeline binary service internal `-m clip_extractor` calls."""
    if not getattr(sys, "frozen", False):
        return
    if len(sys.argv) >= 3 and sys.argv[1] == "-m" and sys.argv[2] == "clip_extractor":
        from clip_extractor.__main__ import main as clip_extractor_main

        sys.argv = [sys.argv[0], *sys.argv[3:]]
        clip_extractor_main()
        raise SystemExit(0)


_dispatch_frozen_module()

from clip_extractor.selection.boundary_validator import (
    validate_and_fix_boundaries,
    validated_to_clip_definitions,
    parse_srt,
)
from clip_extractor.analytics.performance_tracker import PerformanceTracker
from pipeline.overlay_matcher import generate_clip_spec
from pipeline.discord_notify import notify_clip_ready, notify_spec_ready, notify_error
from pipeline.ai_composer import compose_clip


def transcribe(video_path: str, output_dir: str, method: str = "auto") -> str:
    """Transcribe video to SRT format.

    Methods:
        auto — try mlx-whisper (Metal GPU, fastest), fall back to whisper CLI
        mlx — MLX Whisper on Apple Silicon Metal GPU (~15x realtime on M3 Max)
        whisper — OpenAI Whisper CLI (slow on CPU)
        api — IX Toolkit cloud API (requires internet)
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Check for existing transcript
    existing_srt = list(output_dir.glob("*.srt"))
    if existing_srt:
        print(f"[pipeline] Found existing transcript: {existing_srt[0]}")
        return str(existing_srt[0])

    print("[pipeline] Transcribing video...")
    start_time = time.time()

    # Try MLX Whisper first (Metal GPU, ~15x realtime on M3 Max)
    if method in ("auto", "mlx"):
        try:
            import mlx_whisper

            print("[pipeline] Using MLX Whisper (Metal GPU)...")
            result = mlx_whisper.transcribe(
                video_path,
                path_or_hf_repo="mlx-community/whisper-small-mlx",
                word_timestamps=True,
            )

            # Convert to SRT format
            video_name = Path(video_path).stem
            srt_path = output_dir / f"{video_name}.srt"

            segments = result.get("segments", [])
            with open(srt_path, "w", encoding="utf-8") as f:
                for i, seg in enumerate(segments, 1):
                    start_ts = _format_srt_time(seg["start"])
                    end_ts = _format_srt_time(seg["end"])
                    text = seg["text"].strip()
                    f.write(f"{i}\n{start_ts} --> {end_ts}\n{text}\n\n")

            # ── Save word-level timestamps (used by caption generator in Step 6) ──
            _save_word_timestamps(result, str(output_dir), video_name)

            elapsed = time.time() - start_time
            speed = float(segments[-1]["end"]) / elapsed if segments else 0
            print(f"[pipeline] Transcription complete in {elapsed:.1f}s ({speed:.1f}x realtime): {srt_path}")
            return str(srt_path)

        except ImportError:
            if method == "mlx":
                raise RuntimeError("mlx-whisper not installed. Run: pip install mlx-whisper")
            print("[pipeline] mlx-whisper not available, falling back to whisper CLI...")

    # Fallback: whisper CLI
    if method in ("auto", "whisper"):
        cmd = [
            "whisper", video_path,
            "--model", "small",
            "--output_format", "srt",
            "--output_dir", str(output_dir),
            "--language", "en",
        ]
        print(f"[pipeline] Using Whisper CLI (CPU — this may be slow)...")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"[pipeline] Whisper failed: {result.stderr[:200]}")
            raise RuntimeError("Transcription failed")

        srt_files = list(output_dir.glob("*.srt"))
        if not srt_files:
            raise RuntimeError("No SRT file produced")

        elapsed = time.time() - start_time
        print(f"[pipeline] Transcription complete in {elapsed:.0f}s: {srt_files[0]}")
        return str(srt_files[0])

    elif method == "api":
        raise NotImplementedError(
            "IX Toolkit API requires video upload. Use mlx or whisper for local files."
        )

    else:
        raise ValueError(f"Unknown transcription method: {method}")


def _format_srt_time(seconds: float) -> str:
    """Format seconds to SRT timestamp: HH:MM:SS,mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _save_word_timestamps(result: dict, output_dir: str, video_name: str) -> str | None:
    """Extract word-level timestamps from MLX Whisper result and save as words.json.

    Format: [{"word": str, "start": float, "end": float}, ...]
    This is consumed by generate_captions_for_clip in Step 6.
    """
    words = []
    for seg in result.get("segments", []):
        seg_words = seg.get("words", [])
        if seg_words:
            for w in seg_words:
                word_text = w.get("word", "").strip()
                if word_text:
                    words.append({
                        "word": word_text,
                        "start": round(w.get("start", seg["start"]), 3),
                        "end":   round(w.get("end",   seg["end"]),   3),
                    })
        else:
            # No word-level data — split segment text and interpolate
            text_words = seg.get("text", "").strip().split()
            if text_words:
                dur = (seg["end"] - seg["start"]) / len(text_words)
                for i, word in enumerate(text_words):
                    words.append({
                        "word":  word,
                        "start": round(seg["start"] + i * dur, 3),
                        "end":   round(seg["start"] + (i + 1) * dur, 3),
                    })

    if not words:
        return None

    words_path = Path(output_dir) / f"{video_name}_words.json"
    with open(words_path, "w") as f:
        json.dump(words, f, indent=2)
    print(f"[pipeline] Saved {len(words)} word timestamps → {words_path.name}")
    return str(words_path)


ACTION_WORDS = [
    'clipper', 'razor', 'product', 'tool', 'guard', 'blade', 'trimmer',
    'showing', 'look at', 'watch this', 'see how', 'check this',
    'hold it', 'this right here', 'scissor', 'comb', 'detailer',
]


def _generate_context_hints(srt_path: str) -> list[dict]:
    """Scan SRT transcript for action words indicating tools/objects.

    Returns timestamp ranges where the crop should widen to show more context.
    Each hint has start_sec and end_sec (expanded ±3s around the match).
    """
    import re as _re

    SRT_TS = _re.compile(
        r'(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})'
    )

    def to_sec(ts: str) -> float:
        ts = ts.replace(",", ".")
        h, m, s = ts.split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)

    hints = []
    try:
        with open(srt_path, encoding="utf-8") as f:
            content = f.read()
        blocks = content.strip().split("\n\n")
        for block in blocks:
            lines = block.strip().splitlines()
            if len(lines) < 3:
                continue
            m = SRT_TS.search(lines[1])
            if not m:
                continue
            seg_start, seg_end = to_sec(m.group(1)), to_sec(m.group(2))
            text = " ".join(lines[2:]).lower()
            for word in ACTION_WORDS:
                if word in text:
                    hints.append({
                        "start_sec": max(0, seg_start - 3.0),
                        "end_sec": seg_end + 3.0,
                        "trigger": word,
                    })
                    break  # One hint per segment is enough
    except Exception:
        pass  # Non-critical — crop works fine without hints

    # Merge overlapping hints
    if not hints:
        return []
    hints.sort(key=lambda h: h["start_sec"])
    merged = [hints[0]]
    for h in hints[1:]:
        if h["start_sec"] <= merged[-1]["end_sec"]:
            merged[-1]["end_sec"] = max(merged[-1]["end_sec"], h["end_sec"])
        else:
            merged.append(h)
    return merged


def _interpolate_words_from_srt(srt_path: str, clip_start: float, clip_end: float) -> list:
    """Fallback: parse SRT segments and interpolate per-word timings."""
    import re as _re
    SRT_TS = _re.compile(
        r'(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})'
    )

    def to_sec(ts: str) -> float:
        ts = ts.replace(",", ".")
        h, m, s = ts.split(":")
        return int(h) * 3600 + int(m) * 60 + float(s)

    words = []
    try:
        with open(srt_path, encoding="utf-8") as f:
            content = f.read()
        blocks = content.strip().split("\n\n")
        for block in blocks:
            lines = block.strip().splitlines()
            if len(lines) < 3:
                continue
            m = SRT_TS.search(lines[1])
            if not m:
                continue
            seg_start, seg_end = to_sec(m.group(1)), to_sec(m.group(2))
            if seg_end < clip_start or seg_start > clip_end:
                continue
            text = " ".join(lines[2:]).strip()
            seg_words = text.split()
            if not seg_words:
                continue
            dur = (seg_end - seg_start) / len(seg_words)
            for i, word in enumerate(seg_words):
                w_start = seg_start + i * dur
                w_end   = w_start + dur
                if w_start >= clip_start - 0.1 and w_end <= clip_end + 0.1:
                    words.append({"word": word, "start": round(w_start - clip_start, 3), "end": round(w_end - clip_start, 3)})
    except Exception as e:
        print(f"  ⚠️  SRT word interpolation failed: {e}")
    return words


def generate_captions_for_clip(
    words_json_path: str | None,
    srt_path: str,
    clip_start: float,
    clip_end: float,
    output_path: str,
) -> str | None:
    """Build a captions.json for one clip's time range.

    Tries word-level words.json first (accurate), falls back to SRT
    interpolation if word timestamps aren't available.

    Returns the output_path on success, None on failure.
    """
    try:
        if words_json_path and Path(words_json_path).exists():
            with open(words_json_path) as f:
                all_words = json.load(f)
            clip_words = [
                {"word": w["word"],
                 "start": round(w["start"] - clip_start, 3),
                 "end": round(w["end"] - clip_start, 3)}
                for w in all_words
                if w.get("start", 0) >= clip_start - 0.1
                and w.get("end",   0) <= clip_end   + 0.1
            ]
        else:
            clip_words = _interpolate_words_from_srt(srt_path, clip_start, clip_end)

        if not clip_words:
            print(f"  ⚠️  No caption words found for [{clip_start:.1f}s → {clip_end:.1f}s]")
            return None

        with open(output_path, "w") as f:
            json.dump(clip_words, f, indent=2)
        print(f"  📝 Captions: {len(clip_words)} words → {Path(output_path).name}")
        return output_path

    except Exception as e:
        print(f"  ⚠️  Caption generation failed: {e}")
        return None


def parse_transcript(srt_path: str, output_dir: str) -> str:
    """Parse SRT into formatted transcript using clip_extractor."""
    output_path = Path(output_dir) / "formatted_transcript.txt"

    cmd = [
        sys.executable, "-m", "clip_extractor", "select", "parse",
        "--transcript", str(Path(srt_path).resolve()),
        "--output", str(Path(output_path).resolve()),
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        cwd=str(SUBPROCESS_CWD),
    )

    if result.returncode != 0:
        print(f"[pipeline] Parse failed: {result.stderr[:200]}")
        raise RuntimeError("Transcript parsing failed")

    print(result.stdout.strip())
    return str(output_path)


def batch_reframe(
    video_path: str,
    clips: list,
    output_dir: str,
    aspect_ratio: str = "9x16",
) -> list:
    """Batch reframe clips using clip_extractor."""
    # Write clip definitions
    clips_path = Path(output_dir) / "validated_clip_definitions.json"
    with open(clips_path, "w") as f:
        json.dump({"clips": clips}, f, indent=2)

    cmd = [
        sys.executable, "-m", "clip_extractor", "batch",
        "--video", str(Path(video_path).resolve()),
        "--clips", str(clips_path.resolve()),
        "--output", str(Path(output_dir).resolve()),
        "--format", aspect_ratio,
    ]

    print(f"\n[pipeline] Batch reframing {len(clips)} clips to {aspect_ratio}...")
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        cwd=str(SUBPROCESS_CWD),
    )

    # Show subprocess output
    if result.stdout:
        print(result.stdout)

    if result.returncode != 0:
        print(f"[pipeline] ⚠️  clip_extractor batch failed (exit {result.returncode})")
        print(f"[pipeline] stderr tail: {result.stderr[-400:]}")
        print(f"[pipeline] Falling back to per-clip center-crop extraction...")
        return []   # Caller will handle via fallback path

    # Find output files — check both the requested format and split (auto-routed)
    outputs = []
    for clip in clips:
        clip_dir = Path(output_dir) / f"clip-{clip['id']:02d}-{clip['title']}"
        # Try requested format first, then auto-routed formats as fallbacks
        candidate_names = [
            f"reframed-{aspect_ratio}.mp4",
            "reframed-split.mp4",
            "reframed-9x16.mp4",
        ]
        reframed = None
        for name in candidate_names:
            candidate = clip_dir / name
            if candidate.exists():
                reframed = candidate
                break
        if reframed and reframed.exists():
            outputs.append({
                "clip_id": clip["id"],
                "title": clip["title"],
                "path": str(reframed),
            })

    return outputs


def _fallback_center_crop(
    video_path: str,
    clips: list,
    output_dir: str,
    aspect_ratio: str = "9x16",
) -> list:
    """Emergency fallback: extract clips with a static center crop via FFmpeg.

    Used when face-tracking batch_reframe fails (e.g. no face detected, encoder
    gets zero frames). Produces a watchable clip — not perfectly framed, but
    something the QA scorer can evaluate and improve upon.
    """
    import shutil
    if not shutil.which("ffmpeg"):
        print("[fallback] ffmpeg not found — cannot produce fallback clips")
        return []

    # Target dimensions for the aspect ratio
    DIMS = {
        "9x16": ("iw*9/16", "ih"),        # vertical center crop
        "1x1":  ("ih",       "ih"),         # square center crop
        "4x5":  ("iw*4/5",  "ih"),
        "split": ("iw*9/16", "ih"),
        "auto":  ("iw*9/16", "ih"),
    }
    cw, ch = DIMS.get(aspect_ratio, DIMS["9x16"])

    outputs = []
    for clip in clips:
        clip_dir = Path(output_dir) / f"clip-{clip['id']:02d}-{clip['title']}"
        clip_dir.mkdir(parents=True, exist_ok=True)
        out_path = clip_dir / f"reframed-{aspect_ratio}.mp4"

        start = clip.get("start", 0)
        duration = clip.get("end", start + 30) - start
        if duration <= 0:
            continue

        # Center crop filter: crop to target ratio, then scale to 1080x1920
        vf = f"crop={cw}:{ch}:(iw-({cw}))/2:(ih-({ch}))/2,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-i", str(video_path),
            "-t", str(duration),
            "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(out_path),
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 10000:
            print(f"[fallback] ✅ clip-{clip['id']:02d} center-crop ok ({duration:.1f}s)")
            outputs.append({"clip_id": clip["id"], "title": clip["title"], "path": str(out_path)})
        else:
            print(f"[fallback] ❌ clip-{clip['id']:02d} failed: {result.stderr[-200:]}")

    return outputs


def _find_srt_segment_at(srt_segments: list, timestamp: float) -> tuple:
    """Find the SRT segment index at or nearest to a timestamp.

    Handles the common case where the timestamp falls in a gap between segments
    (WhisperX timestamps often have small gaps). Returns (index, segment) or
    (None, None) if no segment is close enough.
    """
    # Exact containment
    for i, seg in enumerate(srt_segments):
        if seg["start"] <= timestamp <= seg["end"]:
            return i, seg

    # Falls in gap — find nearest segment within 1s
    best_i, best_seg, best_dist = None, None, float("inf")
    for i, seg in enumerate(srt_segments):
        # Check distance to segment start and end
        dist_to_start = abs(seg["start"] - timestamp)
        dist_to_end = abs(seg["end"] - timestamp)
        d = min(dist_to_start, dist_to_end)
        if d < best_dist and d < 1.0:
            best_dist = d
            best_i = i
            best_seg = seg

    return best_i, best_seg


def _apply_hook_quality_gate(clips: list, srt_segments: list, search_window: float = 8.0) -> int:
    """Ensure each clip starts at a clean sentence boundary.

    If the first word of a clip is mid-sentence (lowercase, no sentence-ending
    punctuation before it, or is a transition word), fix using three strategies:
    1. Search backward for the previous sentence boundary (punctuation)
    2. Search backward for a speech gap >= 0.5s (natural pause)
    3. Search forward up to 3s for the next clean sentence start

    Prefers backward (more context), but uses forward if backward would extend
    clip by more than 5s or if no backward boundary found.

    Returns the number of clips adjusted.
    """
    import re
    fixes = 0
    transition_words = {"so", "and", "but", "because", "well", "basically",
                        "like", "honestly", "also", "right", "yeah", "ok",
                        "okay", "now", "then", "anyway", "actually"}
    # Phrase-level transitions that start uppercase ("You know…", "I mean…")
    # and would otherwise slip past the lowercase-only is_mid_sentence check.
    transition_phrases = {"you know", "i mean", "i think"}

    for clip in clips:
        start = clip["start"]
        clip_end = clip["end"]
        # Find the SRT segment at or nearest to the clip start
        i, seg = _find_srt_segment_at(srt_segments, start)
        if i is not None and seg is not None:
            text = seg["text"].strip()
            if text:
                first_word = text.split()[0] if text.split() else ""
                first_word_clean = re.sub(r'^[\"\'\(\[]+', '', first_word)

                is_mid_sentence = (
                    first_word_clean
                    and first_word_clean[0].islower()
                    and first_word_clean.lower() not in ("i",)
                )
                is_transition = first_word_clean.lower().rstrip(",.!?") in transition_words

                words_list = text.split()
                first_two_clean = " ".join(w.lower().rstrip(',.!?"\'\"') for w in words_list[:2]) if len(words_list) >= 2 else ""
                is_transition_phrase = first_two_clean in transition_phrases

                # Exception: large gap before this segment = natural boundary
                if i > 0:
                    gap = seg["start"] - srt_segments[i - 1]["end"]
                    if gap >= 0.8:
                        continue  # Not mid-sentence, gap indicates new thought

                if is_mid_sentence or is_transition or is_transition_phrase:
                    # --- Strategy 1: Search backward for punctuation boundary ---
                    best_backward = None
                    for j in range(i - 1, -1, -1):
                        prev_seg = srt_segments[j]
                        if start - prev_seg["end"] > search_window:
                            break
                        prev_text = prev_seg["text"].strip()
                        if prev_text and re.search(r'[.!?][\s"\']*$', prev_text):
                            if j + 1 < len(srt_segments):
                                best_backward = srt_segments[j + 1]["start"]
                            break

                    # --- Strategy 2: Search backward for speech gap ---
                    best_gap_backward = None
                    for j in range(i, 0, -1):
                        gap = srt_segments[j]["start"] - srt_segments[j - 1]["end"]
                        if start - srt_segments[j]["start"] > search_window:
                            break
                        if gap >= 0.5:
                            best_gap_backward = srt_segments[j]["start"]
                            break

                    # --- Strategy 3: Search forward for next sentence start ---
                    best_forward = None
                    forward_limit = 5.0  # Don't skip more than 5s of content
                    for j in range(i + 1, len(srt_segments)):
                        fwd_seg = srt_segments[j]
                        if fwd_seg["start"] - start > forward_limit:
                            break
                        # Check if previous segment ends with punctuation
                        if j > 0:
                            prev_text = srt_segments[j - 1]["text"].strip()
                            if prev_text and re.search(r'[.!?][\s"\']*$', prev_text):
                                best_forward = fwd_seg["start"]
                                break
                        # Check for gap before this segment
                        gap = fwd_seg["start"] - srt_segments[j - 1]["end"]
                        if gap >= 0.5:
                            best_forward = fwd_seg["start"]
                            break

                    # --- Choose best fix ---
                    chosen = None

                    # Prefer backward punctuation if within 5s
                    if best_backward is not None and start - best_backward <= 5.0:
                        chosen = best_backward
                    # Fall back to backward gap
                    elif best_gap_backward is not None and start - best_gap_backward <= 5.0:
                        chosen = best_gap_backward
                    # Fall back to backward punctuation even if >5s
                    elif best_backward is not None:
                        chosen = best_backward
                    # Use forward if backward options are too far or missing
                    elif best_forward is not None:
                        chosen = best_forward
                    # Last resort: backward gap even if far
                    elif best_gap_backward is not None:
                        chosen = best_gap_backward

                    if chosen is not None and chosen != start:
                        direction = "backward" if chosen < start else "forward"
                        # Ensure minimum 25s clip after adjustment
                        if clip_end - chosen >= 25.0:
                            clip["start"] = chosen
                            fixes += 1
                            print(f"  🎯 Hook gate: clip {clip['id']} start shifted {direction} {start:.1f}s → {chosen:.1f}s (was mid-sentence)")
    return fixes


def _snap_clips_to_sentences(clips: list, sentence_blocks, min_duration: float = 25.0) -> int:
    """Snap clip start/end to sentence boundaries derived from word-level SRT.

    For each clip:
    - If start falls inside a sentence block, snap start to that block's start_sec.
    - If end falls inside a sentence block, snap end to that block's end_sec.

    Uses TranscriptBlock objects from srt_parser._group_into_sentences(), which
    splits on .!? punctuation or speech gaps >= 1.5s. More reliable than the
    subtitle-block quality gates because boundaries are word-precise.

    min_duration: skip adjustment if resulting clip would be shorter than this.
    Returns count of clips adjusted.
    """
    if not clips or not sentence_blocks:
        return 0

    # Convert TranscriptBlock objects to plain dicts once
    sentences = [{"start": b.start_sec, "end": b.end_sec} for b in sentence_blocks]

    fixes = 0
    for clip in clips:
        orig_start = clip["start"]
        orig_end = clip["end"]
        new_start = orig_start
        new_end = orig_end

        # Snap start: find the sentence containing clip start, move to its beginning
        for s in sentences:
            if s["start"] < orig_start < s["end"]:
                new_start = s["start"]
                break

        # Snap end: find the sentence containing clip end, move to its conclusion
        for s in sentences:
            if s["start"] < orig_end < s["end"]:
                new_end = s["end"]
                break

        if (new_start != orig_start or new_end != orig_end) and (new_end - new_start >= min_duration):
            clip["start"] = new_start
            clip["end"] = new_end
            fixes += 1
            print(
                f"  📐 Sentence snap: clip {clip['id']} "
                f"{orig_start:.1f}-{orig_end:.1f}s → {new_start:.1f}-{new_end:.1f}s"
            )

    return fixes


def _apply_ending_quality_gate(clips: list, srt_segments: list, search_window: float = 8.0) -> int:
    """Ensure each clip ends at a complete sentence.

    If the transcript at the clip's end doesn't have sentence-ending punctuation,
    fix using three strategies:
    1. Extend forward to next sentence end (punctuation)
    2. Extend forward to next speech gap >= 0.5s (natural pause)
    3. Trim backward to last complete sentence or speech gap

    Returns the number of clips adjusted.
    """
    import re
    fixes = 0
    max_duration = 90.0
    # Relaxed from 25.0 so the backward-trim strategy can recover clips whose
    # last clean sentence end falls earlier than 25s. A 15s clip with a clean
    # ending scores better than a 30s clip with a broken ending.
    min_duration = 15.0

    for clip in clips:
        end = clip["end"]
        start = clip["start"]
        seg_idx, seg = _find_srt_segment_at(srt_segments, end)
        if seg_idx is None:
            continue

        text = seg["text"].strip()

        # Already ends at sentence boundary?
        if text and re.search(r'[.!?][\s"\']*$', text):
            continue

        # Also check: does the clip end at a speech gap?
        if seg_idx + 1 < len(srt_segments):
            gap_after = srt_segments[seg_idx + 1]["start"] - seg["end"]
            if gap_after >= 0.8 and abs(end - seg["end"]) < 0.5:
                continue  # Ending at a natural pause is fine

        # --- Strategy 1: Extend forward to next sentence end (punctuation) ---
        best_end = None
        for j in range(seg_idx, len(srt_segments)):
            fwd_seg = srt_segments[j]
            if fwd_seg["end"] - end > search_window:
                break
            fwd_text = fwd_seg["text"].strip()
            if fwd_text and re.search(r'[.!?][\s"\']*$', fwd_text):
                candidate = fwd_seg["end"]
                if candidate - start <= max_duration:
                    best_end = candidate
                break

        # --- Strategy 2: Extend forward to next speech gap ---
        if best_end is None:
            for j in range(seg_idx + 1, len(srt_segments)):
                if srt_segments[j]["start"] - end > search_window:
                    break
                if j > 0:
                    gap = srt_segments[j]["start"] - srt_segments[j - 1]["end"]
                    if gap >= 0.5:
                        candidate = srt_segments[j - 1]["end"]
                        if candidate - start <= max_duration and candidate > end:
                            best_end = candidate
                        break

        # --- Strategy 3: Trim backward to last sentence end or gap ---
        if best_end is None:
            # Try punctuation first
            for j in range(seg_idx - 1, -1, -1):
                bwd_seg = srt_segments[j]
                if end - bwd_seg["end"] > search_window:
                    break
                bwd_text = bwd_seg["text"].strip()
                if bwd_text and re.search(r'[.!?][\s"\']*$', bwd_text):
                    candidate = bwd_seg["end"]
                    if candidate - start >= min_duration:
                        best_end = candidate
                    break

            # Try gap-based trim
            if best_end is None:
                for j in range(seg_idx, 0, -1):
                    if end - srt_segments[j]["start"] > search_window:
                        break
                    gap = srt_segments[j]["start"] - srt_segments[j - 1]["end"]
                    if gap >= 0.5:
                        candidate = srt_segments[j - 1]["end"]
                        if candidate - start >= min_duration:
                            best_end = candidate
                        break

        if best_end is not None and best_end != end:
            direction = "extended" if best_end > end else "trimmed"
            clip["end"] = best_end
            fixes += 1
            print(f"  🎯 Ending gate: clip {clip['id']} end {direction} {end:.1f}s → {best_end:.1f}s (was mid-sentence)")
    return fixes


FILLER_WORDS = frozenset({
    "um", "uh", "uh-huh", "yeah", "like", "basically",
    "right", "ok", "okay", "so", "well", "anyway",
    "actually", "literally", "honestly", "obviously",
})

_HOOK_BLOCKLIST = frozenset({
    "and", "but", "so", "because", "well", "like", "honestly",
    "also", "then", "anyway", "actually", "um", "uh",
})
_HOOK_BLOCKLIST_PHRASES = frozenset({
    "you know", "i mean", "i think", "just started",
})


def _filter_filler_hook_clips(
    clips: list, srt_segments: list, min_remaining: int = 1,
    word_entries: list | None = None,
) -> int:
    """Remove clips whose hooks still start with filler/conjunction words
    after _apply_hook_quality_gate() has already tried (and failed) to fix them.
    Only removes if at least min_remaining clips would be left.

    When word_entries (word-level transcript) is provided, locates the exact
    first word at clip["start"] — more accurate than the segment-containing-start
    lookup, which can misread the first word of a multi-sentence segment.
    Falls back to segment-based lookup when word_entries is absent.

    Returns count removed.
    """
    removed = 0
    i = 0
    while i < len(clips):
        clip = clips[i]

        first_word = ""
        first_two = ""
        match_source = "segment"
        if word_entries:
            cs = clip["start"]
            # Require the word to overlap or start within 20ms of cs
            start_idx = next(
                (k for k, w in enumerate(word_entries)
                 if w.get("end", 0) >= cs and w.get("start", 0) >= cs - 0.02),
                None,
            )
            if start_idx is not None and start_idx < len(word_entries):
                w1 = word_entries[start_idx].get("word", "").strip().lower().rstrip(',.!?"\'\"')
                w2 = word_entries[start_idx + 1].get("word", "").strip().lower().rstrip(',.!?"\'\"') if start_idx + 1 < len(word_entries) else ""
                first_word = w1
                first_two = f"{w1} {w2}".strip()
                match_source = "word-level"

        if not first_word:
            seg = next(
                (s for s in srt_segments if s["start"] <= clip["start"] < s["end"]),
                None,
            )
            if seg is None:
                i += 1
                continue
            words = seg["text"].strip().split()
            first_word = words[0].lower().rstrip(",.!?") if words else ""
            first_two = " ".join(words[:2]).lower().rstrip(",.!?")
            match_source = "segment"

        if first_word in _HOOK_BLOCKLIST or first_two in _HOOK_BLOCKLIST_PHRASES:
            if len(clips) - removed > min_remaining:
                print(f"  ❌ [hook-filter] Removed clip {clip['id']}: hook starts with '{first_two}' ({match_source})")
                clips.pop(i)
                removed += 1
                continue
        i += 1
    return removed


def _filter_incomplete_ending_clips(
    clips: list, srt_segments: list, min_remaining: int = 1,
) -> int:
    """Remove clips whose endings still fall mid-sentence after
    _apply_ending_quality_gate() has tried (and failed) to fix them.

    A clip's ending is considered a "complete thought" when any of:
      - the segment containing clip["end"] ends in terminal punctuation AND
        clip["end"] lands within 0.3s of the segment's end (otherwise the
        clip cuts mid-segment and the segment's punctuation doesn't apply)
      - it's the last segment in the transcript
      - clip["end"] is near a segment boundary followed by a >=1.5s pause
        (matches srt_parser's own sentence-boundary threshold) AND the next
        segment starts with an uppercase word

    Only removes if at least min_remaining clips would be left.
    Returns count removed.
    """
    import re
    removed = 0
    i = 0
    while i < len(clips):
        clip = clips[i]
        seg_idx, seg = _find_srt_segment_at(srt_segments, clip["end"])
        if seg is None:
            i += 1
            continue

        text = seg["text"].strip()
        ends_clean = bool(re.search(r'[.!?][\s"\']*$', text))
        near_seg_end = abs(seg["end"] - clip["end"]) <= 0.3

        complete_thought = False
        if ends_clean and near_seg_end:
            complete_thought = True
        elif seg_idx is None or seg_idx + 1 >= len(srt_segments):
            complete_thought = True  # last segment in the transcript
        elif near_seg_end:
            next_seg = srt_segments[seg_idx + 1]
            gap = next_seg["start"] - seg["end"]
            next_text = next_seg["text"].strip()
            next_starts_upper = bool(next_text) and next_text[0].isupper()
            if gap >= 1.5 and next_starts_upper:
                complete_thought = True

        if text and not complete_thought:
            if len(clips) - removed > min_remaining:
                print(f"  ❌ [ending-filter] Removed clip {clip['id']}: ends mid-sentence with '{text[-40:]}'")
                clips.pop(i)
                removed += 1
                continue
        i += 1
    return removed


def _compute_dead_air_score(clip_start: float, clip_end: float, srt_segments: list) -> dict:
    """Analyze a clip's SRT segments for dead air, filler density, and silence.

    Returns dict with speech_ratio, filler_ratio, max_silence, is_dead_air.
    """
    duration = clip_end - clip_start
    if duration <= 0:
        return {"speech_ratio": 0, "filler_ratio": 0, "max_silence": duration, "is_dead_air": True}

    relevant = [s for s in srt_segments
                if s["end"] > clip_start and s["start"] < clip_end]

    if not relevant:
        return {"speech_ratio": 0, "filler_ratio": 0, "max_silence": duration, "is_dead_air": True}

    # Speech time within clip bounds
    speech_time = sum(
        min(s["end"], clip_end) - max(s["start"], clip_start)
        for s in relevant
    )
    speech_ratio = speech_time / duration

    # Filler word ratio
    all_words = []
    for s in relevant:
        all_words.extend(s["text"].lower().split())
    filler_count = sum(1 for w in all_words if w.strip(".,!?\"'()") in FILLER_WORDS)
    filler_ratio = filler_count / len(all_words) if all_words else 0

    # Max silence gap within clip
    sorted_segs = sorted(relevant, key=lambda s: s["start"])
    max_silence = max(0, sorted_segs[0]["start"] - clip_start)
    for i in range(len(sorted_segs) - 1):
        gap = sorted_segs[i + 1]["start"] - sorted_segs[i]["end"]
        max_silence = max(max_silence, gap)
    max_silence = max(max_silence, clip_end - sorted_segs[-1]["end"])

    is_dead_air = speech_ratio < 0.60 or max_silence > 5.0 or filler_ratio > 0.25

    return {
        "speech_ratio": round(speech_ratio, 3),
        "filler_ratio": round(filler_ratio, 3),
        "max_silence": round(max_silence, 1),
        "is_dead_air": is_dead_air,
    }


def run_pipeline(
    video_path: str,
    brand: str = "6fbarber",
    num_clips: int = 5,
    transcript_path: str = None,
    output_dir: str = None,
    no_post: bool = True,
    run_experiment: bool = False,
    aspect_ratio: str = "9x16",
    compose: bool = False,
    notify: bool = False,
    content_type: str = "vlog",
    logo_override: str = None,
    studio_export: bool = False,
    user_email: str = None,
):
    """Run the full content pipeline end-to-end."""
    # Studio export requires compose (needs rendered clips)
    if studio_export and not compose:
        print("[pipeline] ⚠️  --studio-export requires --compose (need rendered clips). Enabling --compose.")
        compose = True

    # 'auto' is handled by the clip extractor's intelligent format router.
    # It will analyze face cluster density and pick '9x16' (solo) or 'split' (multi-person).
    # Only normalize truly unknown values as a safety net.
    if aspect_ratio not in ("9x16", "1x1", "4x5", "split", "auto"):
        aspect_ratio = "9x16"

    video_name = Path(video_path).stem.lower().replace(" ", "-")
    if not output_dir:
        output_dir = str(PROJECT_ROOT / "output" / "clips" / video_name)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Load clip extractor config for tunable thresholds
    _config_path = PROJECT_ROOT / "clip_extractor" / "config.yaml" if getattr(sys, "frozen", False) else TOOLS_ROOT / "clip_extractor" / "config.yaml"
    with open(_config_path, "r") as _f:
        config = yaml.safe_load(_f)

    print("=" * 60)
    print("IX Content Pipeline")
    print("=" * 60)
    print(f"  Video:    {video_path}")
    print(f"  Brand:    {brand}")
    print(f"  Clips:    {num_clips}")
    print(f"  Format:   {aspect_ratio}")
    print(f"  Post:     {'No (dry run)' if no_post else 'Yes'}")
    print(f"  Output:   {output_dir}")
    if run_experiment:
        print(f"  Mode:     AutoResearcher experiment")
    print("=" * 60)

    tracker = PerformanceTracker(str(output_path / ".analytics"))

    total_steps = 9 if compose else 5
    if studio_export:
        total_steps += 1

    # --- Step 1: Transcribe ---
    print(f"\n📝 Step 1/{total_steps}: Transcription")
    if transcript_path:
        srt_path = transcript_path
        print(f"[pipeline] Using provided transcript: {srt_path}")
    else:
        srt_path = transcribe(video_path, output_dir)

    # --- Step 2: Parse transcript ---
    print(f"\n📋 Step 2/{total_steps}: Parsing transcript")
    formatted_path = parse_transcript(srt_path, output_dir)

    # Generate context hints from transcript (action words that indicate tools/objects)
    context_hints = _generate_context_hints(srt_path)
    if context_hints:
        hints_path = output_path / "context_hints.json"
        with open(hints_path, "w") as f:
            json.dump(context_hints, f, indent=2)
        print(f"[pipeline] Generated {len(context_hints)} context hints for wider crop during tool/object discussion")

    # --- Step 3: Clip selection ---
    print(f"\n🎯 Step 3/{total_steps}: AI clip selection")
    print("[pipeline] Clip selection requires AI analysis of the transcript.")
    print(f"[pipeline] Transcript ready at: {formatted_path}")
    print(f"[pipeline] Request: Select the top {num_clips} clips for {brand}.")

    # Check if clip selections already exist
    selections_path = output_path / "clip_selections.json"
    if selections_path.exists():
        print(f"[pipeline] Found existing selections: {selections_path}")
        with open(selections_path) as f:
            selections = json.load(f)
        clips_raw = selections.get("selections", [])
    else:
        print("[pipeline] 🧠 Generating clip selections via Anthropic API...")
        from pipeline.ai_composer import call_claude
        
        with open(formatted_path, "r", encoding="utf-8") as f:
            transcript_text = f.read()

        # ── Video Planner Drop Zone integration ─────────────────────────────
        plan_topic = os.environ.get("PLAN_TOPIC", "")
        plan_drop_zones_raw = os.environ.get("PLAN_DROP_ZONES", "")
        drop_zones = []
        if plan_drop_zones_raw:
            try:
                drop_zones = json.loads(plan_drop_zones_raw)
                print(f"[pipeline] 📋 Video Plan linked: '{plan_topic}' — {len(drop_zones)} Drop Zones detected")
                for dz in drop_zones:
                    print(f"           🟢 {dz.get('label')} @ {dz.get('timestamp')}–{dz.get('endTimestamp')}")
            except Exception:
                drop_zones = []

        drop_zone_section = ""
        if drop_zones:
            dz_lines = "\n".join(
                f"  - {dz.get('label', 'DROP ZONE')}: {dz.get('timestamp')} – {dz.get('endTimestamp')}"
                for dz in drop_zones
            )
            drop_zone_section = (
                f"\n\n🎯 VIDEO PLAN DROP ZONES (HIGHEST PRIORITY):\n"
                f"This video was recorded using a structured plan for: \"{plan_topic}\"\n"
                f"The creator intentionally placed high-impact moments at these timestamps:\n"
                f"{dz_lines}\n"
                f"MUST include clips from these regions if the content is strong. "
                f"Give clips starting within 15s of a Drop Zone +8 to +10 bonus points."
            )


        prompt = f"""You are a master social media content strategist for the brand '{brand}'.
Analyze this video transcript and identify highly engaging, viral clip boundaries for 30-60 second shorts.
ABSOLUTE MAXIMUM: 60 seconds. Clips over 60 seconds will be REJECTED.

CRITICAL REQUIREMENTS FOR EACH CLIP:
1. STRONG HOOK (first 3 seconds): The clip MUST start on a bold, attention-grabbing statement — 
   a surprising number, a controversial claim, a rhetorical question, or a pattern interrupt.
   NEVER start mid-sentence.
   CRITICAL NEGATIVE CONSTRAINT: DO NOT start the clip with transition words. 
   Reject any sentence that starts with: "So", "And", "But", "Because", "Well", "Basically", "Like", "Honestly", "You know", "I mean".
   Reject any clip that starts in the MIDDLE of a train of thought — if understanding the clip requires hearing what came before, it's NOT a valid hook.
   The first words the viewer hears must make them STOP scrolling. Test: would this first sentence work as a cold open with zero context?

2. STRONG FINISH (last 3 seconds): The clip MUST end on a memorable payoff — 
   a punchline, a call-to-action moment, a revelation, or a statement that reinforces the core message.
   NEVER end mid-thought or mid-sentence. The last words should feel conclusive.

3. HIGH-VALUE CONTENT: The clip body must contain actionable advice, a surprising insight, 
   a real number/result, or an emotionally resonant story beat.

Phase 2 - QA Audit:
Before you write your JSON output, internally critique your selected hooks. Ask yourself: "Is this first sentence actually a hook? Will they scroll away?". If the hook starts mid-thought or uses a boring transition word, adjust the start boundary to find the true pattern interrupt or replace the clip entirely. ONLY output clips that pass this rigorous QA audit!

Filter criteria:
- Look for controversial, highly educational, or intensely motivational statements.
- Each clip must have a "total_score" rating from 0 to 100 on how engaging it is. (Pass QA requires 85+)
- Each clip MUST be between 30-60 seconds. Score any clip over 60s as 0.
- Selected clips MUST NOT overlap — enforce at least 15 seconds between the end of one clip and the start of the next.
- Prioritize clips with natural setup → buildup → payoff structure.
- Provide verbatim 5-word quotes for both the exact Start and End of each segment.{drop_zone_section}

CRITICAL: Do NOT output any conversational text, pleasantries, or your internal critique. You must ONLY output pure JSON exactly in this schema:
{{
  "selections": [
    {{
      "id": 1,
      "title": "A highly clickable title (5-8 words, no clickbait)",
      "srt_start_words": "the exact five words of...",
      "srt_end_words": "...the final five words stated",
      "time_start_estimate": 0.0,
      "time_end_estimate": 60.0,
      "category": "EDUCATIONAL",
      "total_score": 92,
      "hook_preview": "first 10 words of clip",
      "payoff_preview": "last 10 words of clip"
    }}
  ]
}}

Transcript (with timestamps):
{transcript_text}"""
        
        try:
            import re
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            raw_response = call_claude(prompt, api_key)
            cleaned = raw_response.strip()
            
            # Find the JSON block using regex to ignore any conversational padding
            json_match = re.search(r'(\{.*\})', cleaned, re.DOTALL)
            if json_match:
                cleaned = json_match.group(1)
            else:
                if cleaned.startswith("```json"): cleaned = cleaned[7:]
                elif cleaned.startswith("```"): cleaned = cleaned[3:]
                if cleaned.endswith("```"): cleaned = cleaned[:-3]
            
            selections = json.loads(cleaned.strip())
            
            # Formally Resolve the text quotes into exact SRT Timestamps
            from clip_extractor.selection.srt_parser import load_transcript
            from clip_extractor.selection.timestamp_resolver import resolve_all_clips
            
            ts_transcript = load_transcript(srt_path, fps=30.0)
            resolved_objects = resolve_all_clips(
                transcript=ts_transcript,
                clips_data=selections.get("selections", []),
                search_window=60.0,
                fuzzy_threshold=70.0
            )
            
            # Map the resolved seconds back into the payload strictly by ID
            resolved_dict_list = []
            
            # Create a lookup mapping for foolproof resolution
            resolution_map = {r.id: r for r in resolved_objects}
            
            for s in selections.get("selections", []):
                matched_r = resolution_map.get(s.get("id"))
                if matched_r:
                    s["start"] = matched_r.start_sec
                    s["end"] = matched_r.end_sec
                    resolved_dict_list.append(s)
                
            selections["selections"] = resolved_dict_list

            with open(selections_path, "w") as f:
                json.dump(selections, f, indent=2)
            
            clips_raw = selections.get("selections", [])
            print(f"  ✅ [pipeline] Claude returned {len(clips_raw)} valid highlights")
        except Exception as e:
            print(f"[pipeline] ⚠️  Claude extraction failed: {e}")
            return {"status": "failed", "error": str(e)}

    # --- Step 4: Validate boundaries ---
    print(f"\n✅ Step 4/{total_steps}: Boundary validation")

    # DYNAMIC SCORING: Extract ALL clips above 85% retention threshold.
    # Note: If a Video Plan was linked, Claude already received the Drop Zone
    # context in its prompt — no artificial score manipulation needed here.
    _min_score = config.get("selection", {}).get("scoring", {}).get("min_total_score", 85)
    qualified_clips = [c for c in clips_raw if c.get("total_score", 0) >= _min_score]
    qualified_clips.sort(key=lambda x: x.get("total_score", 0), reverse=True)

    
    if not qualified_clips and clips_raw: 
        # Fallback if nothing hit 85% to at least grab the best one rather than failing
        print(f"[pipeline] ⚠️  No clips hit the {_min_score}+ score threshold. Falling back to the best available clip.")
        best_clip = max(clips_raw, key=lambda x: x.get("total_score", 0))
        qualified_clips = [best_clip]

    print(f"[pipeline] Filtering complete: Found {len(qualified_clips)} clips exceeding the Viral Retention threshold.")

    # Deduplicate overlapping clips (greedy: highest score wins, min 10s gap)
    from clip_extractor.selection.timestamp_resolver import deduplicate_clips
    pre_dedup_count = len(qualified_clips)
    qualified_clips = deduplicate_clips(qualified_clips, min_gap_sec=10.0)
    if len(qualified_clips) < pre_dedup_count:
        print(f"[pipeline] Dedup: removed {pre_dedup_count - len(qualified_clips)} overlapping clip(s), {len(qualified_clips)} remaining")

    # --- Dead air filter ---
    srt_segments_for_filter = parse_srt(srt_path)
    pre_filter_count = len(qualified_clips)
    filtered_clips = []
    for clip in qualified_clips:
        da = _compute_dead_air_score(clip.get("start", 0), clip.get("end", 60), srt_segments_for_filter)
        if da["is_dead_air"]:
            print(f"  ⚠️  Dead air: clip {clip.get('id')} rejected "
                  f"(speech={da['speech_ratio']:.0%}, filler={da['filler_ratio']:.0%}, "
                  f"silence={da['max_silence']}s)")
        else:
            filtered_clips.append(clip)
    if filtered_clips:
        if len(filtered_clips) < pre_filter_count:
            print(f"[pipeline] Dead air filter: removed {pre_filter_count - len(filtered_clips)} clip(s), "
                  f"{len(filtered_clips)} remaining")
        qualified_clips = filtered_clips
    elif qualified_clips:
        print(f"[pipeline] Dead air filter: all clips flagged — keeping best one")
        qualified_clips = [max(qualified_clips, key=lambda c: c.get("total_score", 0))]

    clips_for_validation = []
    for c in qualified_clips:
        clips_for_validation.append({
            "id": c["id"], 
            "title": c["title"], 
            "start": c.get("start", 0), 
            "end": c.get("end", 60)
        })

    validated = validate_and_fix_boundaries(
        clips=clips_for_validation,
        transcript_path=srt_path,
        video_path=video_path,
        search_window=5.0,  # Level 2 fix: wider search (was 3.0) for better sentence boundary matching
    )

    fixed_clips = validated_to_clip_definitions(validated)

    # Second dedup pass: boundary validation can extend clips, creating new near-overlaps
    score_lookup = {c.get("id", i): c.get("total_score", 0) for i, c in enumerate(qualified_clips)}
    dedup_input = [
        {**fc, "total_score": score_lookup.get(fc["id"], 0)}
        for fc in fixed_clips
    ]
    pre_dedup2 = len(dedup_input)
    dedup_output = deduplicate_clips(dedup_input, min_gap_sec=10.0)
    if len(dedup_output) < pre_dedup2:
        print(f"[pipeline] Post-validation dedup: removed {pre_dedup2 - len(dedup_output)} clip(s) that became too close after boundary adjustment")
        # Keep only the surviving clips in both lists
        surviving_ids = {c["id"] for c in dedup_output}
        fixed_clips = [fc for fc in fixed_clips if fc["id"] in surviving_ids]
        validated = [v for v in validated if v.id in surviving_ids]
        qualified_clips = [qc for qc in qualified_clips if qc.get("id") in surviving_ids]

    # --- Hook and ending quality gates ---
    srt_segments = parse_srt(srt_path)
    from clip_extractor.selection.srt_parser import load_transcript as _load_transcript
    ts_transcript = _load_transcript(srt_path, fps=30.0)
    hook_win = config.get("selection", {}).get("hook_search_window_sec", 8.0)
    ending_win = config.get("selection", {}).get("ending_search_window_sec", 5.0)
    hook_fixes = _apply_hook_quality_gate(fixed_clips, srt_segments, search_window=hook_win)
    ending_fixes = _apply_ending_quality_gate(fixed_clips, srt_segments, search_window=ending_win)
    if hook_fixes or ending_fixes:
        print(f"[pipeline] Quality gates: {hook_fixes} hook(s) fixed, {ending_fixes} ending(s) fixed")

    # Build word-level entries for precise hook detection
    _word_entries = None
    try:
        _word_entries = [{"word": w.word, "start": w.start_sec, "end": w.end_sec} for w in ts_transcript.words]
    except Exception as e:
        print(f"[pipeline] word-level transcript fallback (using segments): {e}")

    # Reject clips with unfixable filler hooks
    rejected = _filter_filler_hook_clips(fixed_clips, srt_segments, word_entries=_word_entries)
    if rejected:
        print(f"[pipeline] Hook filter: removed {rejected} clip(s) with filler hooks")

    # Reject clips with unfixable mid-sentence endings
    rejected_endings = _filter_incomplete_ending_clips(fixed_clips, srt_segments)
    if rejected_endings:
        print(f"[pipeline] Ending filter: removed {rejected_endings} clip(s) with incomplete endings")

    # --- Sentence boundary snapping (supplemental pass) ---
    snap_fixes = _snap_clips_to_sentences(fixed_clips, ts_transcript.blocks)
    if snap_fixes:
        print(f"[pipeline] Sentence snapping: {snap_fixes} clip(s) snapped to sentence boundaries")

    # Save validated definitions
    validated_path = output_path / "validated_clips.json"
    with open(validated_path, "w") as f:
        json.dump(fixed_clips, f, indent=2)

    # Report boundary fixes
    fixes = sum(1 for v in validated if v.start != v.original_start or v.end != v.original_end)
    issues = sum(1 for v in validated if not v.valid)
    print(f"\n[pipeline] Validation: {fixes} boundaries fixed, {issues} unresolved issues")

    # --- Step 5: Batch reframe ---
    print(f"\n🎬 Step 5/{total_steps}: Face-tracking reframe")
    outputs = batch_reframe(video_path, fixed_clips, output_dir, aspect_ratio)

    # If face-tracking failed entirely, fall back to center-crop so QA has something to score
    if not outputs:
        print(f"[pipeline] ⚠️  Face-tracking produced no outputs — using center-crop fallback")
        outputs = _fallback_center_crop(video_path, fixed_clips, output_dir, aspect_ratio)
        if outputs:
            print(f"[pipeline] ✅ Fallback produced {len(outputs)} clips — scores will be low but improvable")
        else:
            print(f"[pipeline] ❌ Fallback also failed — skipping reframe step")

    # --- Track clips ---
    for clip_raw, clip_fixed in zip(qualified_clips, fixed_clips):
        tracker.log_clip(
            clip_id=f"{video_name}-{clip_fixed['id']:02d}",
            video_source=video_path,
            brand=brand,
            internal_scores=clip_raw.get("scores", {}),
            total_score=clip_raw.get("total_score", 0),
            category=clip_raw.get("category", "unknown"),
            duration=clip_fixed["end"] - clip_fixed["start"],
            title=clip_fixed["title"],
        )

    # --- Steps 6-9: Composition pipeline (if --compose) ---
    clip_specs = []

    if compose:
        print(f"\n🎨 Step 6/{total_steps}: Pop-out analysis + Captions")

        # Locate word-level timestamps saved during transcription
        _words_json = output_path / f"{video_name}_words.json"
        words_json_path = str(_words_json) if _words_json.exists() else None
        if words_json_path:
            print(f"  ✅ Word timestamps available → enabling per-clip captions")
        else:
            print(f"  ⚠️  No word timestamps found — captions will use SRT interpolation")

        for clip_raw, clip_fixed, clip_output in zip(
            qualified_clips, fixed_clips, outputs
        ):
            clip_dir = Path(clip_output["path"]).parent

            # ── Generate word-level captions for this clip ──
            captions_src = generate_captions_for_clip(
                words_json_path=words_json_path,
                srt_path=srt_path,
                clip_start=clip_fixed["start"],
                clip_end=clip_fixed["end"],
                output_path=str(clip_dir / "captions.json"),
            )

            spec = generate_clip_spec(
                transcript_path=srt_path,
                clip_start=clip_fixed["start"],
                clip_end=clip_fixed["end"],
                clip_title=clip_fixed["title"],
                clip_id=f"{video_name}-{clip_fixed['id']:02d}",
                brand_slug=brand,
                video_src=clip_output["path"],
                captions_src=captions_src,   # ← now passing real word captions
                output_path=str(clip_dir / "clip_spec.json"),
                content_type=content_type,
                logo_override=logo_override,
            )
            clip_specs.append(spec)
            cap_status = f"✅ {Path(captions_src).name}" if captions_src else "⚠️ No captions"
            print(f"  📋 {clip_fixed['title']}: spec generated ({spec['status']}) | captions: {cap_status}")

        print(f"\n🎨 Step 6.5/{total_steps}: Market Intel AutoResearch (parallel)")
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if api_key:
            from pipeline.auto_researcher import get_ecosystem_research
            from concurrent.futures import ThreadPoolExecutor, as_completed as _as_completed

            def _research_one(spec):
                spec_path = str(Path(spec.get('videoSrc', '')).parent / "clip_spec.json")
                try:
                    if os.path.exists(spec_path):
                        with open(spec_path, 'r') as f:
                            data = json.load(f)
                        transcript = data.get("transcript", "")
                        if transcript:
                            research_data = get_ecosystem_research(transcript, api_key)
                            data["research_context"] = research_data
                            with open(spec_path, 'w') as f:
                                json.dump(data, f, indent=2)
                            return spec['title'], len(research_data)
                except Exception as e:
                    print(f"  ❌ AutoResearch failed for {spec.get('title','?')}: {e}")
                return spec.get('title','?'), 0

            with ThreadPoolExecutor(max_workers=3) as pool:
                futs = {pool.submit(_research_one, s): s for s in clip_specs}
                for fut in _as_completed(futs):
                    title, n = fut.result()
                    print(f"  ✅ Research: {title} ({n} facts found)")


        print(f"\n🖌️  Step 7/{total_steps}: AI composition (parallel)")
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if api_key:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            # Resolve all spec paths first
            spec_tasks = []
            for idx, spec in enumerate(clip_specs):
                spec_path = str(Path(spec.get('videoSrc', '')).parent / "clip_spec.json")
                if not Path(spec_path).exists():
                    for output in outputs:
                        candidate = Path(output["path"]).parent / "clip_spec.json"
                        if candidate.exists() and spec["title"] in str(candidate.parent):
                            spec_path = str(candidate)
                            break
                spec_tasks.append((idx, spec, spec_path))
            
            total_to_compose = len(spec_tasks)
            print(f"  ⚡ Composing {total_to_compose} clips in parallel...")
            print(f"[PROGRESS] 70 Composing {total_to_compose} clips in parallel...")
            sys.stdout.flush()
            
            # Run all Claude API calls concurrently (I/O-bound, threading is perfect)
            compose_results = [None] * total_to_compose
            def _compose_one(task):
                idx, spec, sp = task
                try:
                    result = compose_clip(spec_path=sp, api_key=api_key)
                    return idx, result
                except Exception as e:
                    return idx, {"success": False, "title": spec["title"], "error": str(e)}
            
            with ThreadPoolExecutor(max_workers=5) as pool:
                futures = {pool.submit(_compose_one, t): t for t in spec_tasks}
                done_count = 0
                for future in as_completed(futures):
                    idx, result = future.result()
                    compose_results[idx] = result
                    done_count += 1
                    status = "✅" if result.get("success") else "❌"
                    print(f"  {status} [{done_count}/{total_to_compose}] {result.get('title', '?')[:45]}")
                    pct = 70 + int((done_count / total_to_compose) * 20)
                    print(f"[PROGRESS] {pct} {done_count}/{total_to_compose} composed")
                    sys.stdout.flush()
        else:
            print("[pipeline] No API key — skipping AI composition")
            print("[pipeline] Set ANTHROPIC_API_KEY or use Content Studio with your key")
            compose_results = []

        # --- Step 8: Render (parallel, 2 workers to avoid CPU thrash) ---
        print(f"\n🎞️  Step 8/{total_steps}: Remotion render")
        successful_compositions = [r for r in compose_results if r and r.get("success")]
        if successful_compositions:
            from pipeline.ai_composer import render_clip as do_render
            from concurrent.futures import ThreadPoolExecutor, as_completed
            
            # Build render tasks
            render_tasks = []
            for comp in successful_compositions:
                title = comp.get("title", "")
                clip_out_dir = None
                for out in outputs:
                    if title in out.get("path", ""):
                        clip_out_dir = str(Path(out["path"]).parent)
                        break
                render_dest = str(Path(clip_out_dir) / "rendered_composition.mp4") if clip_out_dir else None
                render_tasks.append((title, render_dest))
            
            total_renders = len(render_tasks)
            print(f"  ⚡ Rendering {total_renders} clips (2 parallel)...")
            print(f"[PROGRESS] 91 Rendering {total_renders} clips...")
            sys.stdout.flush()
            
            def _render_one(task):
                title, dest = task
                try:
                    path = do_render(title, output_path=dest)
                    return title, path, None
                except Exception as e:
                    return title, None, str(e)
            
            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = {pool.submit(_render_one, t): t for t in render_tasks}
                done_count = 0
                for future in as_completed(futures):
                    title, path, err = future.result()
                    done_count += 1
                    if path:
                        print(f"  ✅ [{done_count}/{total_renders}] {title[:40]}")
                    else:
                        print(f"  ❌ [{done_count}/{total_renders}] {title[:40]}: {err}")
                    pct = 91 + int((done_count / total_renders) * 7)
                    print(f"[PROGRESS] {pct} {done_count}/{total_renders} rendered")
                    sys.stdout.flush()
        else:
            print("[pipeline] No compositions to render")

        # --- Step 8.5: Thumbnail extraction ---
        print(f"\n🖼️  Step 8.5/{total_steps}: Generating thumbnails")
        import subprocess as _sp
        for comp in successful_compositions if successful_compositions else []:
            title = comp.get("title", "")
            clip_out_dir = None
            for out in outputs:
                if title in out.get("path", ""):
                    clip_out_dir = str(Path(out["path"]).parent)
                    break
            if not clip_out_dir:
                continue
            video_path = Path(clip_out_dir) / "rendered_composition.mp4"
            thumb_path = Path(clip_out_dir) / "thumbnail.jpg"
            if video_path.exists() and not thumb_path.exists():
                try:
                    # Extract frame at 0.5 seconds as thumbnail
                    _sp.run([
                        "ffmpeg", "-y", "-ss", "0.5", "-i", str(video_path),
                        "-vframes", "1", "-q:v", "3",
                        "-vf", "scale=540:960",
                        str(thumb_path)
                    ], capture_output=True, timeout=15)
                    if thumb_path.exists():
                        print(f"  ✅ Thumbnail: {title[:40]}")
                    else:
                        print(f"  ⚠️  Thumbnail failed (ffmpeg): {title[:40]}")
                except Exception as e:
                    print(f"  ⚠️  Thumbnail failed: {e}")

        # --- Step 8.7: Studio export (if --studio-export) ---
        if studio_export:
            export_step = 10 if studio_export else 9
            print(f"\n📤 Step 8.7/{total_steps}: Studio export")
            try:
                from pipeline.studio_export import export_to_studio
                # Gather rendered clip data for export
                export_clips = []
                for comp, clip_fixed in zip(
                    successful_compositions if successful_compositions else [],
                    fixed_clips,
                ):
                    title = comp.get("title", clip_fixed["title"])
                    clip_out_dir = None
                    for out in outputs:
                        if title in out.get("path", ""):
                            clip_out_dir = str(Path(out["path"]).parent)
                            break
                    if not clip_out_dir:
                        continue
                    # Get transcript for caption
                    transcript_text = ""
                    for s in srt_segments:
                        if s["start"] >= clip_fixed["start"] and s["end"] <= clip_fixed["end"]:
                            transcript_text += s["text"].strip() + " "
                    export_clips.append({
                        "id": clip_fixed["id"],
                        "clipId": f"{video_name}-{clip_fixed['id']:02d}",
                        "title": title,
                        "transcript": transcript_text.strip(),
                        "path": str(Path(clip_out_dir) / "rendered_composition.mp4"),
                    })

                if export_clips:
                    result = export_to_studio(
                        output_dir=output_dir,
                        clips=export_clips,
                        user_email=user_email,
                        dry_run=False,  # Studio export runs independently of --no-post
                    )
                    print(f"  📤 Studio export: {result.get('uploaded', 0)} uploaded, {result.get('pushed', 0)} pushed")
                    if result.get("errors"):
                        for err in result["errors"]:
                            print(f"  ⚠️  {err}")
                else:
                    print("  ⚠️  No rendered compositions available for studio export")
            except ImportError:
                print("  ⚠️  studio_export module not found — skipping")
            except Exception as e:
                print(f"  ⚠️  Studio export failed: {e}")

        # --- Step 9: Discord notification ---
        if notify:
            print(f"\n📣 Step 9/{total_steps}: Discord notification")
            for spec in clip_specs:
                try:
                    notify_spec_ready(spec)
                    print(f"  ✅ Notified: {spec['title']}")
                except Exception as e:
                    print(f"  ⚠️  Notification failed for {spec['title']}: {e}")
        else:
            print(f"\n📣 Step 9/{total_steps}: Discord notification (skipped — use --notify)")


    # --- Summary ---
    print("\n" + "=" * 60)
    print("Pipeline Complete!")
    print("=" * 60)
    for output in outputs:
        print(f"  ✅ {output['title']}: {output['path']}")

    if clip_specs:
        print(f"\n  📋 Clip specs generated: {len(clip_specs)}")
        for spec in clip_specs:
            print(f"     {spec['clipId']}: {spec['status']}")

    if no_post:
        print(f"\n  📁 All clips saved to: {output_dir}")
        print("  🚫 --no-post: Nothing was published")
    else:
        print("\n  📤 Ready for distribution via Zernio")

    return {
        "status": "complete",
        "clips": outputs,
        "output_dir": output_dir,
        "validated_clips": validated_path,
        "clip_specs": [s.get("clipId") for s in clip_specs] if clip_specs else [],
    }


def main():
    parser = argparse.ArgumentParser(
        description="IX Content Pipeline — End-to-end clip production",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --video video.mp4 --brand 6fbarber --clips 3 --no-post
  %(prog)s --video video.mp4 --transcript transcript.srt --brand 6fbarber
  %(prog)s --video video.mp4 --brand 6fbarber --experiment
        """,
    )

    parser.add_argument("--video", required=True, help="Path to source video")
    parser.add_argument("--research", action="store_true", help="Enable AutoResearcher Market Intel integration")
    parser.add_argument("--brand", default="6fbarber", help="Brand slug")
    parser.add_argument("--clips", type=int, default=5, help="Number of clips to select")
    parser.add_argument("--transcript", help="Path to existing .srt transcript")
    parser.add_argument("--output", help="Output directory")
    parser.add_argument("--format", default="9x16", help="Aspect ratio (9x16, 1x1, 4x5)")
    parser.add_argument("--no-post", action="store_true", default=True, help="Don't post (default)")
    parser.add_argument("--post", action="store_true", help="Post to Zernio")
    parser.add_argument("--experiment", action="store_true", help="Run as AutoResearcher experiment")
    parser.add_argument("--compose", action="store_true", help="Run composition pipeline (Steps 6-9)")
    parser.add_argument("--notify", action="store_true", help="Send Discord notifications")
    parser.add_argument("--content-type", default="auto",
                        help="Content type for pop-out style (default: auto)")
    parser.add_argument("--logo-override", help="Absolute path to custom brand logo")
    parser.add_argument("--no-logo", action="store_true", help="Disable logo usage entirely")
    parser.add_argument("--studio-export", action="store_true",
                        help="Export rendered clips to Content Manager studio queue")
    parser.add_argument("--user-email", help="User email for Content Manager studio queue")

    args = parser.parse_args()

    run_pipeline(
        video_path=args.video,
        brand=args.brand,
        num_clips=args.clips,
        transcript_path=args.transcript,
        output_dir=args.output,
        no_post=not args.post,
        run_experiment=args.experiment,
        aspect_ratio=args.format,
        compose=args.compose,
        notify=args.notify,
        content_type=args.content_type,
        logo_override=None if args.no_logo else args.logo_override,
        studio_export=args.studio_export,
        user_email=args.user_email,
    )


if __name__ == "__main__":
    import multiprocessing

    multiprocessing.freeze_support()
    main()
