"""Fuzzy-match Claude's anchor words to exact SRT timestamps.

Three-tier resolution strategy:
1. Exact substring match in transcript text near estimated time
2. Fuzzy sliding window match using rapidfuzz
3. Fallback to Claude's estimated timestamp

All searches constrained to ±search_window around the estimated time
to prevent false matches on common phrases.
"""

import re
from dataclasses import dataclass
from typing import Optional

from rapidfuzz import fuzz

from .srt_parser import Transcript, TranscriptWord


@dataclass
class AnchorMatch:
    """Result of matching an anchor phrase to transcript timestamps."""

    phrase: str
    matched_words: list[TranscriptWord]
    start_sec: float
    end_sec: float
    confidence: float
    match_method: str  # "exact", "fuzzy", "fallback"


@dataclass
class ResolvedClip:
    """A fully resolved clip with validated timestamps."""

    id: int
    title: str
    start_sec: float
    end_sec: float
    duration_sec: float
    transcript_text: str
    start_anchor: AnchorMatch
    end_anchor: AnchorMatch
    resolution_confidence: float
    warning: str = ""


def _normalize(text: str) -> str:
    """Normalize text for matching: lowercase, collapse whitespace, strip punctuation."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _build_sliding_windows(
    words: list[TranscriptWord],
    window_size: int,
) -> list[tuple[str, list[TranscriptWord]]]:
    """Build all possible sliding windows of N words from word list."""
    windows = []
    for i in range(len(words) - window_size + 1):
        window_words = words[i:i + window_size]
        text = " ".join(w.word for w in window_words)
        windows.append((_normalize(text), window_words))
    return windows


def resolve_anchor(
    transcript: Transcript,
    anchor_phrase: str,
    estimated_time: float,
    search_window: float = 15.0,
    fuzzy_threshold: float = 75.0,
) -> AnchorMatch:
    """Resolve an anchor phrase to exact transcript timestamps.

    Three-tier matching:
    1. Exact: normalized anchor appears as substring in nearby text
    2. Fuzzy: sliding window with rapidfuzz ratio >= threshold
    3. Fallback: use estimated timestamp, low confidence

    Args:
        transcript: Parsed transcript.
        anchor_phrase: 5-8 words from Claude (verbatim from transcript).
        estimated_time: Claude's estimated timestamp in seconds.
        search_window: Search ±N seconds around estimated time.
        fuzzy_threshold: Minimum rapidfuzz ratio for fuzzy match (0-100).

    Returns:
        AnchorMatch with resolved timestamps and confidence.
    """
    # Get words within search window
    window_start = max(0, estimated_time - search_window)
    window_end = estimated_time + search_window
    nearby_words = transcript.words_between(window_start, window_end)

    if not nearby_words:
        # No words in range — pure fallback
        return AnchorMatch(
            phrase=anchor_phrase,
            matched_words=[],
            start_sec=estimated_time,
            end_sec=estimated_time,
            confidence=0.1,
            match_method="fallback",
        )

    anchor_normalized = _normalize(anchor_phrase)
    anchor_word_count = len(anchor_normalized.split())

    # Tier 1: Exact substring match
    for window_size in [anchor_word_count, anchor_word_count + 1, anchor_word_count - 1]:
        if window_size < 1 or window_size > len(nearby_words):
            continue
        windows = _build_sliding_windows(nearby_words, window_size)
        for window_text, window_words in windows:
            if anchor_normalized in window_text or window_text in anchor_normalized:
                return AnchorMatch(
                    phrase=anchor_phrase,
                    matched_words=window_words,
                    start_sec=window_words[0].start_sec,
                    end_sec=window_words[-1].end_sec,
                    confidence=1.0,
                    match_method="exact",
                )

    # Tier 2: Fuzzy match with rapidfuzz
    best_score = 0.0
    best_match: Optional[tuple[str, list[TranscriptWord]]] = None

    for window_size in [anchor_word_count, anchor_word_count + 1, anchor_word_count - 1]:
        if window_size < 1 or window_size > len(nearby_words):
            continue
        windows = _build_sliding_windows(nearby_words, window_size)
        for window_text, window_words in windows:
            score = fuzz.ratio(anchor_normalized, window_text)
            if score > best_score:
                best_score = score
                best_match = (window_text, window_words)

    if best_match and best_score >= fuzzy_threshold:
        _, matched_words = best_match
        return AnchorMatch(
            phrase=anchor_phrase,
            matched_words=matched_words,
            start_sec=matched_words[0].start_sec,
            end_sec=matched_words[-1].end_sec,
            confidence=round(best_score / 100, 3),
            match_method="fuzzy",
        )

    # Tier 3: Fallback to estimated time
    # Find the nearest word to the estimated time
    nearest = min(nearby_words, key=lambda w: abs(w.start_sec - estimated_time))
    return AnchorMatch(
        phrase=anchor_phrase,
        matched_words=[nearest],
        start_sec=nearest.start_sec,
        end_sec=nearest.end_sec,
        confidence=0.3,
        match_method="fallback",
    )


def resolve_all_clips(
    transcript: Transcript,
    clips_data: list[dict],
    search_window: float = 15.0,
    fuzzy_threshold: float = 75.0,
    padding: float = 1.0,
    min_duration: float = 30.0,
    max_duration: float = 120.0,
) -> list[ResolvedClip]:
    """Resolve all clip selections from Claude to exact timestamps.

    Each clip_data dict should contain:
        - id: int
        - title: str (kebab-case)
        - srt_start_words: str (5-8 word anchor)
        - srt_end_words: str (5-8 word anchor)
        - time_start_estimate: float (seconds)
        - time_end_estimate: float (seconds)

    Args:
        transcript: Parsed transcript.
        clips_data: List of clip selection dicts from Claude.
        search_window: ±N seconds search range for anchors.
        fuzzy_threshold: Minimum fuzzy match score (0-100).
        padding: Seconds of breathing room at boundaries.
        min_duration: Minimum clip duration in seconds.
        max_duration: Maximum clip duration in seconds.

    Returns:
        List of ResolvedClip objects, sorted by start time.
    """
    resolved: list[ResolvedClip] = []

    for clip in clips_data:
        clip_id = clip["id"]
        title = clip["title"]

        # Resolve start anchor
        start_anchor = resolve_anchor(
            transcript=transcript,
            anchor_phrase=clip["srt_start_words"],
            estimated_time=clip["time_start_estimate"],
            search_window=search_window,
            fuzzy_threshold=fuzzy_threshold,
        )

        # Resolve end anchor
        end_anchor = resolve_anchor(
            transcript=transcript,
            anchor_phrase=clip["srt_end_words"],
            estimated_time=clip["time_end_estimate"],
            search_window=search_window,
            fuzzy_threshold=fuzzy_threshold,
        )

        # Apply padding
        start_sec = max(0, start_anchor.start_sec - padding)
        end_sec = min(transcript.duration_sec, end_anchor.end_sec + padding)
        duration = round(end_sec - start_sec, 1)

        # Validation warnings
        warnings = []
        if start_anchor.match_method == "fallback":
            warnings.append(f"start anchor fell back to estimate ({start_anchor.confidence:.0%})")
        if end_anchor.match_method == "fallback":
            warnings.append(f"end anchor fell back to estimate ({end_anchor.confidence:.0%})")
        if duration < min_duration:
            warnings.append(f"duration {duration}s below minimum {min_duration}s")
        if duration > max_duration:
            warnings.append(f"duration {duration}s above maximum {max_duration}s")
        if start_sec >= end_sec:
            try:
                est_start_raw = float(clip.get("time_start_estimate", start_sec))
                est_end_raw = float(clip.get("time_end_estimate", end_sec))
            except (TypeError, ValueError):
                est_start_raw = start_sec
                est_end_raw = end_sec
            est_start = max(0.0, est_start_raw - padding)
            est_end = min(transcript.duration_sec, est_end_raw + padding)
            if est_end > est_start:
                start_sec = est_start
                end_sec = est_end
                duration = round(end_sec - start_sec, 1)
                warnings.append("resolved anchors inverted; fell back to estimated range")
            else:
                warnings.append("start >= end (invalid range)")
                continue

        # Combined confidence
        resolution_confidence = round(
            (start_anchor.confidence + end_anchor.confidence) / 2, 3
        )

        # Extract transcript text for this clip
        text = transcript.text_between(start_anchor.start_sec, end_anchor.end_sec)

        resolved.append(ResolvedClip(
            id=clip_id,
            title=title,
            start_sec=round(start_sec, 3),
            end_sec=round(end_sec, 3),
            duration_sec=duration,
            transcript_text=text,
            start_anchor=start_anchor,
            end_anchor=end_anchor,
            resolution_confidence=resolution_confidence,
            warning="; ".join(warnings) if warnings else "",
        ))

    # Return the resolved clips in the exact same array order as input
    # Do NOT sort this chronologically, as it will break the 1:1 zip mapping in the pipeline!

    # Check for overlaps (comprehensive: edge overlap + containment + % overlap)
    for i in range(len(resolved)):
        for j in range(i + 1, len(resolved)):
            a = resolved[i]
            b = resolved[j]
            overlap_start = max(a.start_sec, b.start_sec)
            overlap_end = min(a.end_sec, b.end_sec)
            if overlap_start < overlap_end:
                overlap_sec = round(overlap_end - overlap_start, 1)
                a_duration = a.end_sec - a.start_sec
                b_duration = b.end_sec - b.start_sec
                pct_a = round(overlap_sec / a_duration * 100) if a_duration > 0 else 0
                pct_b = round(overlap_sec / b_duration * 100) if b_duration > 0 else 0

                # Determine severity
                if pct_a >= 80 or pct_b >= 80:
                    severity = "CRITICAL: CONTAINED"
                elif max(pct_a, pct_b) > 15:
                    severity = "CRITICAL: SIGNIFICANT OVERLAP"
                else:
                    severity = "WARNING: minor overlap"

                msg = (f"{severity} — clip {a.id} & clip {b.id} share "
                       f"{overlap_sec}s ({pct_a}% of clip {a.id}, "
                       f"{pct_b}% of clip {b.id})")

                for clip in [a, b]:
                    if clip.warning:
                        clip.warning += f"; {msg}"
                    else:
                        clip.warning = msg

    return resolved


def deduplicate_clips(clips: list[dict], min_gap_sec: float = 10.0) -> list[dict]:
    """Greedy dedup: keep highest-scored clips that don't overlap (with min gap).

    Works on clip dicts with 'start', 'end', and 'total_score' keys
    (the format used after timestamp resolution in the pipeline).

    Args:
        clips: List of clip dicts with start/end seconds and total_score.
        min_gap_sec: Minimum gap between clips to consider them non-overlapping.

    Returns:
        Filtered list with overlapping clips removed (highest score wins).
    """
    sorted_clips = sorted(clips, key=lambda c: c.get("total_score", 0), reverse=True)
    accepted: list[dict] = []
    for clip in sorted_clips:
        clip_start = clip.get("start", clip.get("time_start_estimate", 0))
        clip_end = clip.get("end", clip.get("time_end_estimate", 0))
        overlaps = any(
            clip_start < (a.get("end", a.get("time_end_estimate", 0)) + min_gap_sec)
            and clip_end > (a.get("start", a.get("time_start_estimate", 0)) - min_gap_sec)
            for a in accepted
        )
        if not overlaps:
            accepted.append(clip)
    # Restore chronological order
    return sorted(accepted, key=lambda c: c.get("start", c.get("time_start_estimate", 0)))
