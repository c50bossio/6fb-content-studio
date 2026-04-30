"""Clip boundary validator.

Validates that clips start and end at natural points:
- Sentence completion (no mid-sentence cuts)
- Silence detection (find natural pauses near boundaries)
- Energy taper (audio drops off = natural conclusion)

Usage:
    from clip_extractor.selection.boundary_validator import validate_and_fix_boundaries

    fixed_clips = validate_and_fix_boundaries(
        clips=clip_list,
        transcript_path="path/to/transcript.srt",
        video_path="path/to/video.mp4",
        search_window=3.0,  # seconds to search for better boundary
    )
"""

import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple


@dataclass
class BoundaryIssue:
    clip_id: int
    issue_type: str  # "incomplete_sentence", "no_silence", "energy_spike"
    boundary: str  # "start" or "end"
    original_time: float
    suggested_time: Optional[float] = None
    description: str = ""


@dataclass
class ValidatedClip:
    id: int
    title: str
    start: float
    end: float
    original_start: float
    original_end: float
    issues_found: List[BoundaryIssue]
    issues_fixed: List[BoundaryIssue]
    valid: bool


def parse_srt(srt_path: str) -> List[dict]:
    """Parse SRT file into list of {start, end, text} entries."""
    entries = []
    with open(srt_path, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = re.split(r"\n\n+", content.strip())
    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            continue

        # Parse timestamp line
        ts_match = re.match(
            r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})",
            lines[1],
        )
        if not ts_match:
            continue

        g = ts_match.groups()
        start = int(g[0]) * 3600 + int(g[1]) * 60 + int(g[2]) + int(g[3]) / 1000
        end = int(g[4]) * 3600 + int(g[5]) * 60 + int(g[6]) + int(g[7]) / 1000
        text = " ".join(lines[2:]).strip()

        entries.append({"start": start, "end": end, "text": text})

    return entries


TRANSITION_WORDS = frozenset({
    "so", "and", "but", "because", "well", "basically", "like", "honestly",
    "also", "right", "yeah", "ok", "okay", "now", "then", "anyway",
    "actually", "um", "uh", "you know", "i mean",
})


def find_speech_gaps(
    srt_entries: List[dict], min_gap: float = 0.5
) -> List[dict]:
    """Find gaps between SRT entries that indicate natural speech pauses.

    Gaps >= min_gap seconds are strong sentence boundary signals, even when
    WhisperX doesn't place punctuation at the boundary. Returns list of
    {time, gap_duration, before_idx, after_idx} sorted by time.
    """
    gaps = []
    for i in range(len(srt_entries) - 1):
        gap = srt_entries[i + 1]["start"] - srt_entries[i]["end"]
        if gap >= min_gap:
            gaps.append({
                "time": srt_entries[i]["end"],
                "resume_time": srt_entries[i + 1]["start"],
                "gap_duration": gap,
                "before_idx": i,
                "after_idx": i + 1,
            })
    return gaps


def _find_nearest_gap(
    gaps: List[dict], timestamp: float, search_window: float, direction: str = "any"
) -> Optional[dict]:
    """Find nearest speech gap within a search window.

    direction: "any" (closest), "before" (gap.time <= timestamp), "after" (gap.time >= timestamp)
    """
    best = None
    best_dist = float("inf")
    for g in gaps:
        if direction == "before" and g["time"] > timestamp:
            continue
        if direction == "after" and g["time"] < timestamp:
            continue
        dist = abs(g["time"] - timestamp)
        if dist <= search_window and dist < best_dist:
            best_dist = dist
            best = g
    return best


def detect_silences(
    video_path: str,
    start_sec: float,
    end_sec: float,
    noise_threshold: float = -30,
    min_duration: float = 0.3,
) -> List[Tuple[float, float]]:
    """Detect silence periods in a video segment using ffmpeg."""
    cmd = [
        "ffmpeg",
        "-ss", str(max(0, start_sec - 1)),
        "-to", str(end_sec + 1),
        "-i", video_path,
        "-af", f"silencedetect=noise={noise_threshold}dB:d={min_duration}",
        "-f", "null",
        "-",
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30
        )
        stderr = result.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []

    silences = []
    starts = re.findall(r"silence_start: ([\d.]+)", stderr)
    ends = re.findall(r"silence_end: ([\d.]+)", stderr)

    # Offset back to absolute time
    offset = max(0, start_sec - 1)
    for s, e in zip(starts, ends):
        abs_start = float(s) + offset
        abs_end = float(e) + offset
        silences.append((abs_start, abs_end))

    return silences


def get_audio_energy(
    video_path: str, timestamp: float, window: float = 1.0
) -> Optional[float]:
    """Get average audio energy (dB) around a timestamp."""
    cmd = [
        "ffmpeg",
        "-ss", str(max(0, timestamp - window / 2)),
        "-t", str(window),
        "-i", video_path,
        "-af", "volumedetect",
        "-f", "null",
        "-",
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=15
        )
        match = re.search(r"mean_volume: ([-\d.]+) dB", result.stderr)
        if match:
            return float(match.group(1))
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return None


def find_sentence_end(
    srt_entries: List[dict], timestamp: float, search_window: float = 3.0
) -> Optional[float]:
    """Find the nearest sentence-ending timestamp within a search window.

    Uses two signals:
    1. Punctuation: SRT text ends with . ? ! (primary)
    2. Speech gaps: >= 0.5s pause between SRT entries (fallback)

    If no punctuation-based boundary is found, falls back to the nearest
    speech gap, which indicates a natural pause in spoken language.
    """
    sentence_endings = re.compile(r"[.!?][\"\']?\s*$")
    best_end = None
    best_distance = float("inf")

    for entry in srt_entries:
        if not sentence_endings.search(entry["text"]):
            continue

        end_time = entry["end"]
        distance = abs(end_time - timestamp)

        if distance <= search_window and distance < best_distance:
            best_distance = distance
            best_end = end_time

    # If no sentence end found, check if the boundary is mid-speech trailing off
    if best_end is None:
        boundary_entry = None
        for entry in srt_entries:
            if entry["start"] <= timestamp <= entry["end"]:
                boundary_entry = entry
                break
            if abs(entry["end"] - timestamp) < 1.0:
                boundary_entry = entry
                break

        if boundary_entry and not sentence_endings.search(boundary_entry["text"]):
            # We're mid-speech — try extending forward to find sentence end
            forward_end = None
            for entry in srt_entries:
                if entry["start"] > timestamp and entry["start"] <= timestamp + search_window:
                    if sentence_endings.search(entry["text"]):
                        forward_end = entry["end"]
                        break

            if forward_end:
                return forward_end

            # No sentence end forward — trim backward to last complete sentence
            backward_end = None
            for entry in reversed(srt_entries):
                if entry["end"] <= timestamp and entry["end"] >= timestamp - search_window:
                    if sentence_endings.search(entry["text"]):
                        backward_end = entry["end"]
                        break

            if backward_end:
                return backward_end

    # Fallback: use speech gaps as sentence boundary signals
    if best_end is None:
        gaps = find_speech_gaps(srt_entries, min_gap=0.5)
        gap = _find_nearest_gap(gaps, timestamp, search_window)
        if gap:
            best_end = gap["time"]

    return best_end


def _is_mid_sentence_start(srt_entries: List[dict], timestamp: float) -> bool:
    """Detect if a timestamp falls mid-sentence in the transcript.

    Checks multiple signals:
    1. The first word at the boundary is lowercase (not a proper noun or "I")
    2. There's no sentence-ending punctuation (.!?) just before this word
    3. The first word is a transition word ("so", "and", "but", etc.)
    4. Exception: a large gap (>= 0.8s) before the boundary suggests a new thought,
       even if lowercase — spoken language doesn't always capitalize after pauses.
    """
    # Find the entry at or just after the timestamp
    boundary_entry = None
    boundary_idx = None
    for i, entry in enumerate(srt_entries):
        if entry["start"] >= timestamp - 0.5:
            boundary_entry = entry
            boundary_idx = i
            break

    if not boundary_entry:
        return False

    text = boundary_entry["text"].strip()
    if not text:
        return False

    first_word = text.split()[0]
    first_word_clean = re.sub(r'^[\"\'\(\[]+', '', first_word)

    if not first_word_clean:
        return False

    # Large gap before this entry = natural thought boundary, not mid-sentence
    if boundary_idx is not None and boundary_idx > 0:
        gap = boundary_entry["start"] - srt_entries[boundary_idx - 1]["end"]
        if gap >= 0.8:
            return False

    starts_lowercase = first_word_clean[0].islower()

    # Check if first word is a transition word (even if capitalized)
    is_transition = first_word_clean.lower().rstrip(",.!?") in TRANSITION_WORDS

    # Check if previous entry lacks sentence-ending punctuation
    no_prior_sentence_end = False
    if boundary_idx is not None and boundary_idx > 0:
        prev_text = srt_entries[boundary_idx - 1]["text"].strip()
        if not re.search(r"[.!?][\"\']?\s*$", prev_text):
            no_prior_sentence_end = True

    # Mid-sentence if: (lowercase + no prior punctuation) OR (transition word + no prior punctuation)
    return (starts_lowercase or is_transition) and no_prior_sentence_end


def find_sentence_start(
    srt_entries: List[dict], timestamp: float, search_window: float = 3.0
) -> Optional[float]:
    """Find the nearest sentence-starting timestamp within a search window.

    Uses two signals:
    1. Punctuation: entry follows one ending with . ? ! (primary)
    2. Speech gaps: entry follows a >= 0.5s pause (secondary)

    Prefers backward search (earlier = more context for the hook), but also
    checks forward within 3s for a cleaner start if backward is too far.
    """
    best_start = None
    best_distance = float("inf")

    # Pre-compute gaps for fallback
    gaps = find_speech_gaps(srt_entries, min_gap=0.5)

    # --- Primary: punctuation-based sentence starts ---
    for i, entry in enumerate(srt_entries):
        is_sentence_start = False
        if i == 0:
            is_sentence_start = True
        elif re.search(r"[.!?][\"\']?\s*$", srt_entries[i - 1]["text"]):
            is_sentence_start = True

        if not is_sentence_start:
            continue

        start_time = entry["start"]
        distance = abs(start_time - timestamp)

        if distance <= search_window and distance < best_distance:
            best_distance = distance
            best_start = start_time

    # If no punctuation-based start found, try gap-based detection
    if best_start is None:
        # Backward: find a gap before the timestamp (new sentence starts after gap)
        gap = _find_nearest_gap(gaps, timestamp, search_window, direction="before")
        if gap:
            best_start = srt_entries[gap["after_idx"]]["start"]
            best_distance = timestamp - best_start

    # If still nothing, extend search backward with doubled window
    if best_start is None and _is_mid_sentence_start(srt_entries, timestamp):
        extended_window = search_window * 2
        for i, entry in enumerate(srt_entries):
            is_sentence_start = False
            if i == 0:
                is_sentence_start = True
            elif re.search(r"[.!?][\"\']?\s*$", srt_entries[i - 1]["text"]):
                entry_text = entry["text"].strip()
                if entry_text and entry_text[0].isupper():
                    is_sentence_start = True

            if not is_sentence_start:
                continue

            start_time = entry["start"]
            if start_time <= timestamp and timestamp - start_time <= extended_window:
                distance = timestamp - start_time
                if distance < best_distance:
                    best_distance = distance
                    best_start = start_time

        # Extended gap-based fallback
        if best_start is None:
            gap = _find_nearest_gap(gaps, timestamp, extended_window, direction="before")
            if gap:
                best_start = srt_entries[gap["after_idx"]]["start"]

    return best_start


@dataclass
class HookValidation:
    """Result of validating a clip's opening hook boundary."""
    clean_start: bool
    original_time: float
    suggested_time: Optional[float] = None
    reason: str = ""


def validate_hook_boundary(
    srt_entries: List[dict],
    start_time: float,
    hook_search_window: float = 8.0,
) -> HookValidation:
    """Validate whether a clip starts at a clean sentence boundary (hook quality).

    The first ~3 seconds determine if viewers stay, so hook boundaries get a wider
    search window than general boundaries.

    Searches both backward (preferred, more context) and forward (up to 5s, if
    backward is too far or unavailable) for a clean sentence start.

    Returns:
        HookValidation with clean_start=True if the hook begins at a sentence start,
        or a suggested_time fix if it doesn't.
    """
    if not _is_mid_sentence_start(srt_entries, start_time):
        return HookValidation(clean_start=True, original_time=start_time)

    # Search backward for a proper sentence start
    backward_start = find_sentence_start(srt_entries, start_time, hook_search_window)
    if backward_start and backward_start < start_time:
        return HookValidation(
            clean_start=False,
            original_time=start_time,
            suggested_time=backward_start,
            reason=f"Hook starts mid-sentence; nearest sentence start at {backward_start:.2f}s",
        )

    # Backward failed — search forward up to 5s for the next clean sentence start
    forward_limit = 5.0
    gaps = find_speech_gaps(srt_entries, min_gap=0.5)
    best_forward = None
    for i, entry in enumerate(srt_entries):
        if entry["start"] <= start_time:
            continue
        if entry["start"] - start_time > forward_limit:
            break
        # Check if previous entry ends a sentence (punctuation or gap)
        is_sentence_start = False
        if i > 0:
            prev_text = srt_entries[i - 1]["text"].strip()
            if re.search(r"[.!?][\"\']?\s*$", prev_text):
                is_sentence_start = True
            else:
                gap = entry["start"] - srt_entries[i - 1]["end"]
                if gap >= 0.5:
                    is_sentence_start = True
        if is_sentence_start:
            best_forward = entry["start"]
            break

    if best_forward:
        return HookValidation(
            clean_start=False,
            original_time=start_time,
            suggested_time=best_forward,
            reason=f"Hook starts mid-sentence; shifted forward to sentence start at {best_forward:.2f}s",
        )

    return HookValidation(
        clean_start=False,
        original_time=start_time,
        reason="Hook starts mid-sentence but no clean sentence start found within window",
    )


def find_nearest_silence(
    silences: List[Tuple[float, float]], timestamp: float, search_window: float = 3.0
) -> Optional[float]:
    """Find the midpoint of the nearest silence period."""
    best_time = None
    best_distance = float("inf")

    for s_start, s_end in silences:
        midpoint = (s_start + s_end) / 2
        distance = abs(midpoint - timestamp)

        if distance <= search_window and distance < best_distance:
            best_distance = distance
            best_time = midpoint

    return best_time


def validate_clip_boundary(
    clip: dict,
    srt_entries: List[dict],
    video_path: str,
    search_window: float = 3.0,
    hook_search_window: float = 8.0,
) -> ValidatedClip:
    """Validate and fix a single clip's boundaries.

    Args:
        clip: Clip dict with {id, title, start, end}
        srt_entries: Parsed SRT entries
        video_path: Path to source video
        search_window: Seconds to search for better boundaries (general)
        hook_search_window: Seconds to search for better START boundaries (hooks).
            Wider than general window because the first ~3s determine viewer retention.
    """
    clip_id = clip.get("id", 0)
    title = clip.get("title", f"clip-{clip_id}")
    start = clip["start"]
    end = clip["end"]
    issues_found = []
    issues_fixed = []

    new_start = start
    new_end = end

    # --- Validate END boundary ---

    # 1. Check sentence completion at end
    end_entry = None
    for entry in srt_entries:
        if abs(entry["end"] - end) < 1.0 or (entry["start"] <= end <= entry["end"]):
            end_entry = entry
            break

    if end_entry and not re.search(r"[.!?][\"\']?\s*$", end_entry["text"]):
        issue = BoundaryIssue(
            clip_id=clip_id,
            issue_type="incomplete_sentence",
            boundary="end",
            original_time=end,
            description=f"Clip ends mid-sentence: '...{end_entry['text'][-40:]}'",
        )

        # Try to find nearest sentence end
        sentence_end = find_sentence_end(srt_entries, end, search_window)
        if sentence_end:
            issue.suggested_time = sentence_end
            new_end = sentence_end
            issues_fixed.append(issue)
        else:
            issues_found.append(issue)

    # 2. Check for silence near end (natural pause)
    silences = detect_silences(video_path, end - search_window, end + search_window)
    if not silences:
        # No natural pause near the end
        issue = BoundaryIssue(
            clip_id=clip_id,
            issue_type="no_silence",
            boundary="end",
            original_time=end,
            description="No natural silence/pause found near clip end",
        )

        # Still try sentence boundary
        if new_end == end:  # Not already fixed
            issues_found.append(issue)
    else:
        # Found silence — prefer silence that's after a sentence end
        silence_time = find_nearest_silence(silences, new_end, search_window)
        if silence_time and abs(silence_time - new_end) > 0.5:
            new_end = silence_time

    # 3. Check audio energy at end (should be tapering, not spiking)
    energy_at_end = get_audio_energy(video_path, end, window=0.5)
    energy_after = get_audio_energy(video_path, end + 1.0, window=0.5)
    if energy_at_end is not None and energy_after is not None:
        if energy_after > energy_at_end + 3:  # Energy rising = mid-thought
            issue = BoundaryIssue(
                clip_id=clip_id,
                issue_type="energy_spike",
                boundary="end",
                original_time=end,
                description=f"Audio energy rising at end ({energy_at_end:.1f}dB → {energy_after:.1f}dB)",
            )
            issues_found.append(issue)

    # --- Validate START boundary (hook) ---
    # Use wider hook_search_window for start boundaries since the first ~3s
    # determine if viewers stay

    # First, use the dedicated hook validator
    hook_result = validate_hook_boundary(srt_entries, start, hook_search_window)
    if not hook_result.clean_start and hook_result.suggested_time is not None:
        issue = BoundaryIssue(
            clip_id=clip_id,
            issue_type="incomplete_sentence",
            boundary="start",
            original_time=start,
            suggested_time=hook_result.suggested_time,
            description=f"Hook: {hook_result.reason}",
        )
        new_start = hook_result.suggested_time
        issues_fixed.append(issue)
    elif not hook_result.clean_start:
        # Fallback: try the original approach with the wider window
        start_entry = None
        for entry in srt_entries:
            if entry["start"] <= start <= entry["end"]:
                start_entry = entry
                break

        if start_entry:
            prev_entries = [e for e in srt_entries if e["end"] <= start_entry["start"]]
            if prev_entries:
                prev = prev_entries[-1]
                if not re.search(r"[.!?][\"\']?\s*$", prev["text"]):
                    sentence_start = find_sentence_start(
                        srt_entries, start, hook_search_window
                    )
                    if sentence_start and sentence_start < start:
                        issue = BoundaryIssue(
                            clip_id=clip_id,
                            issue_type="incomplete_sentence",
                            boundary="start",
                            original_time=start,
                            suggested_time=sentence_start,
                            description="Clip starts mid-sentence (hook fallback)",
                        )
                        new_start = sentence_start
                        issues_fixed.append(issue)
                    else:
                        issues_found.append(BoundaryIssue(
                            clip_id=clip_id,
                            issue_type="incomplete_sentence",
                            boundary="start",
                            original_time=start,
                            description=f"Hook: {hook_result.reason}",
                        ))
    else:
        # Hook is clean, but still check with original logic for edge cases
        start_entry = None
        for entry in srt_entries:
            if entry["start"] <= start <= entry["end"]:
                start_entry = entry
                break

        if start_entry:
            prev_entries = [e for e in srt_entries if e["end"] <= start_entry["start"]]
            if prev_entries:
                prev = prev_entries[-1]
                if not re.search(r"[.!?][\"\']?\s*$", prev["text"]):
                    sentence_start = find_sentence_start(
                        srt_entries, start, hook_search_window
                    )
                    if sentence_start and sentence_start < start:
                        issue = BoundaryIssue(
                            clip_id=clip_id,
                            issue_type="incomplete_sentence",
                            boundary="start",
                            original_time=start,
                            suggested_time=sentence_start,
                            description="Clip starts mid-sentence",
                        )
                        new_start = sentence_start
                        issues_fixed.append(issue)

    # Ensure minimum duration (30s minimum — enough for a complete thought + hook + payoff)
    MIN_CLIP_DURATION = 30.0
    if new_end - new_start < MIN_CLIP_DURATION:
        # Extend to meet minimum, but snap to the nearest sentence end after the minimum
        target_end = new_start + MIN_CLIP_DURATION
        sentence_end = find_sentence_end(srt_entries, target_end, search_window=12.0)
        if sentence_end and sentence_end > new_end:
            new_end = sentence_end
        else:
            # No sentence end found — hard extend to minimum
            new_end = max(new_end, target_end)

    # Level 2: Enforce maximum duration (90s) — trim to nearest sentence end
    MAX_CLIP_DURATION = 90.0
    duration = new_end - new_start
    if duration > MAX_CLIP_DURATION:
        # Try to find a sentence end within the max duration window
        max_end = new_start + MAX_CLIP_DURATION
        sentence_end = find_sentence_end(srt_entries, max_end, search_window=5.0)
        if sentence_end and new_start < sentence_end <= max_end:
            new_end = sentence_end
            issues_fixed.append(BoundaryIssue(
                clip_id=clip_id,
                issue_type="duration_trimmed",
                boundary="end",
                original_time=end,
                suggested_time=new_end,
                description=f"Trimmed from {duration:.0f}s to {new_end - new_start:.0f}s at sentence boundary",
            ))
        else:
            # Hard cap at max duration
            new_end = max_end
            issues_fixed.append(BoundaryIssue(
                clip_id=clip_id,
                issue_type="duration_capped",
                boundary="end",
                original_time=end,
                suggested_time=new_end,
                description=f"Hard-capped from {duration:.0f}s to {MAX_CLIP_DURATION:.0f}s",
            ))


    # Ensure we didn't extend past video duration
    # (caller should clamp to video duration)

    valid = len(issues_found) == 0

    return ValidatedClip(
        id=clip_id,
        title=title,
        start=round(new_start, 2),
        end=round(new_end, 2),
        original_start=start,
        original_end=end,
        issues_found=issues_found,
        issues_fixed=issues_fixed,
        valid=valid,
    )


def validate_and_fix_boundaries(
    clips: List[dict],
    transcript_path: str,
    video_path: str,
    search_window: float = 3.0,
    hook_search_window: float = 8.0,
) -> List[ValidatedClip]:
    """Validate and fix boundaries for a list of clips.

    Args:
        clips: List of clip dicts with {id, title, start, end}
        transcript_path: Path to .srt transcript file
        video_path: Path to source video
        search_window: Seconds to search for better boundaries (general)
        hook_search_window: Seconds to search for better START boundaries (hooks)

    Returns:
        List of ValidatedClip with fixed boundaries
    """
    srt_entries = parse_srt(transcript_path)

    results = []
    for clip in clips:
        validated = validate_clip_boundary(
            clip, srt_entries, video_path, search_window, hook_search_window
        )
        results.append(validated)

        # Print report
        status = "✓ VALID" if validated.valid else "⚠ ISSUES"
        print(f"\n[boundary-validator] Clip {validated.id}: {validated.title} — {status}")

        if validated.start != validated.original_start:
            print(f"  Start: {validated.original_start:.1f}s → {validated.start:.1f}s")
        if validated.end != validated.original_end:
            print(f"  End:   {validated.original_end:.1f}s → {validated.end:.1f}s")

        for issue in validated.issues_fixed:
            print(f"  ✓ Fixed: {issue.description}")

        for issue in validated.issues_found:
            print(f"  ⚠ Unfixed: {issue.description}")

    return results


def validated_to_clip_definitions(validated_clips: List[ValidatedClip]) -> List[dict]:
    """Convert validated clips back to clip definition format for batch reframe."""
    return [
        {
            "id": vc.id,
            "title": vc.title,
            "start": vc.start,
            "end": vc.end,
        }
        for vc in validated_clips
    ]
