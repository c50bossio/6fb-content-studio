#!/usr/bin/env python3
"""ClipQA AutoEvolver — Self-improving video clip quality loop.

Runs the full content pipeline, audits each generated clip using Claude Vision,
diagnoses defects mapped to specific engine modules, and optionally auto-patches
config.yaml parameters. Tracks improvement across iterations in a cumulative ledger.

Usage:
    # Single iteration on all test corpus videos
    python3 -m pipeline.clip_qa_evolver --iterations 1

    # 5 iterations with auto-config patching
    python3 -m pipeline.clip_qa_evolver --iterations 5 --auto-patch

    # Single video focused debug
    python3 -m pipeline.clip_qa_evolver --video /path/to/video.mp4 --iterations 3

    # Dry run (audit only, no patches)
    python3 -m pipeline.clip_qa_evolver --iterations 1 --dry-run

Env: ANTHROPIC_API_KEY (required for Claude Vision auditing)
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pipeline.config_patcher import DEFECT_PATCH_MAP

# Project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
TOOLS_ROOT = PROJECT_ROOT / "tools"
CONFIG_PATH = TOOLS_ROOT / "clip_extractor" / "config.yaml"
EVOLVER_OUTPUT = PROJECT_ROOT / "output" / ".evolver"

# Claude Vision config
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-sonnet-4-20250514"

# Budget defaults (per Claude Vision audit call)
COST_PER_VISION_CALL = 0.05   # ~$0.05 per 3-image Vision audit
COST_PER_TRANSCRIPTION = 0.10 # ~$0.10 per clip pipeline run (Whisper + reframe)
DEFAULT_DAILY_BUDGET = 20.00  # $20/day default


# ─── QA Rubric ──────────────────────────────────────────────────────

QA_RUBRIC_FULL = """You are a brutal, expert QA auditor for short-form social media video clips.
You are calibrated to the quality level of the IX Content Manager — the AI system that produced
polished 6FB branded content with dark-mode glassmorphic pop-out overlays, animated illustrations,
word-level synced captions, and neon green accents on #121212 backgrounds.

You will be shown 3 screenshots extracted from a generated 45-75 second clip, plus the clip's transcript.

SCREENSHOTS:
- Frame 1 (HOOK): Captured at 0.5 seconds — the viewer's first impression
- Frame 2 (BODY): Captured at the midpoint — core content delivery
- Frame 3 (PAYOFF): Captured 3 seconds before the clip ends — the conclusion

Score EACH of the following dimensions from 0 to 10. Be harsh. A 7 means "good", an 8 means "great", a 10 is "flawless".

DIMENSIONS:
1. frame_composition: Is the subject well-framed? Head not cut off? Appropriate headroom? Body visible? No black bars?
2. face_tracking: Is the camera following the speaker? Is the subject centered or close to center? Any visible jitter or drift?
3. hook_quality: Does the clip start with a scroll-stopping first sentence? Is it bold, surprising, or pattern-interrupting?
4. ending_quality: Does the clip end conclusively? No mid-sentence cuts? Does the last statement feel like a payoff?
5. audio_sync: Based on the transcript, does it seem complete and coherent? Any signs of truncation or repetition?
6. pacing: Is the clip well-paced? Not too much dead air or filler? Not rushing through content?
7. multi_speaker: If multiple people are visible, are they both shown? Can you tell who's speaking? (Score 8 if only one person — N/A)
8. overall_watchability: Holistic gut check — would THIS clip make someone stop scrolling and watch to the end?

For each dimension scoring below 7, provide a specific defect description.

ALSO classify each defect into one of these defect_ids:
- head_cut_off
- too_much_headroom
- camera_jittery
- face_tracking_lost
- crop_too_tight
- crop_too_wide
- multi_speaker_missed
- deadzone_too_sticky
- deadzone_too_loose
- face_position_too_high
- face_position_too_low
- hook_starts_mid_sentence (⚠️ needs code review)
- ending_mid_sentence (⚠️ needs code review)
- dead_air
- content_too_long
- content_too_short
- overlay_timing_off (pop-out appears at wrong moment)
- overlay_missing (key concept had no pop-out visualization)
- caption_desync (word captions out of sync with speech)

Return ONLY valid JSON in this exact schema:
{
  "scores": {
    "frame_composition": 7,
    "face_tracking": 8,
    "hook_quality": 5,
    "ending_quality": 6,
    "audio_sync": 9,
    "pacing": 7,
    "multi_speaker": 8,
    "overall_watchability": 6
  },
  "total_score": 56,
  "defects": [
    {
      "defect_id": "hook_starts_mid_sentence",
      "dimension": "hook_quality",
      "severity": 0.8,
      "description": "Clip starts with 'So basically...' — a weak filler transition, not a hook"
    }
  ],
  "summary": "One sentence overall assessment"
}"""

QA_RUBRIC_RAW = """You are a brutal, expert QA auditor for RAW extracted video clips.
These clips are raw face-tracking reframes — NO overlays, NO captions, NO Remotion compositions.
Judge ONLY what the Python extractor controls: framing, tracking, and clip boundaries.

You will be shown 3 screenshots extracted from a generated 45-75 second clip, plus the clip's transcript.

SCREENSHOTS:
- Frame 1 (HOOK): Captured at 0.5 seconds — the viewer's first impression
- Frame 2 (BODY): Captured at the midpoint — core content delivery
- Frame 3 (PAYOFF): Captured 3 seconds before the clip ends — the conclusion

Score EACH of the following 4 dimensions from 0 to 10. Be harsh. A 7 means "good", an 8 means "great", a 10 is "flawless".

DIMENSIONS:
1. frame_composition: Is the subject well-framed? Head not cut off? Appropriate headroom? Body visible? No black bars?
2. face_tracking: Is the camera following the speaker? Is the subject centered or close to center? Any visible jitter or drift?
3. hook_quality: Does the clip start at a natural sentence boundary? Is the opening statement strong enough to hook a viewer? No mid-sentence starts or filler openings ("So basically...", "And then...")?
4. ending_quality: Does the clip end at a natural sentence boundary? Does the final statement feel conclusive? No mid-sentence cuts, trailing off, or abrupt endings?

NOTE: Do NOT penalize for lack of overlays, captions, animations, or production polish.
These are raw extractions — audio quality, pacing, and watchability are OUT OF SCOPE.

For each dimension scoring below 7, provide a specific defect description.

ALSO classify each defect into one of these defect_ids:
- head_cut_off
- too_much_headroom
- camera_jittery
- face_tracking_lost
- crop_too_tight
- crop_too_wide
- multi_speaker_missed
- deadzone_too_sticky
- deadzone_too_loose
- face_position_too_high
- face_position_too_low
- hook_starts_mid_sentence (⚠️ needs code review)
- ending_mid_sentence (⚠️ needs code review)
- dead_air
- content_too_long
- content_too_short

Return ONLY valid JSON in this exact schema:
{
  "scores": {
    "frame_composition": 7,
    "face_tracking": 8,
    "hook_quality": 5,
    "ending_quality": 6
  },
  "total_score": 26,
  "defects": [
    {
      "defect_id": "hook_starts_mid_sentence",
      "dimension": "hook_quality",
      "severity": 0.8,
      "description": "Clip starts with 'So basically...' — a weak filler transition, not a hook"
    }
  ],
  "summary": "One sentence overall assessment"
}"""

# Backward-compat alias
QA_RUBRIC = QA_RUBRIC_FULL

# Rubric metadata for score normalization
RUBRIC_MODES = {
    "raw": {"rubric": QA_RUBRIC_RAW, "max_score": 40, "dimensions": 4, "label": "Raw Extraction"},
    "full": {"rubric": QA_RUBRIC_FULL, "max_score": 80, "dimensions": 8, "label": "Full Production"},
}


# ─── Frame Extraction ───────────────────────────────────────────────

def extract_frames(video_path: str, timestamps: list[float]) -> list[str]:
    """Extract frames at given timestamps, return list of base64-encoded JPEGs."""
    frames = []
    for ts in timestamps:
        out_path = f"/tmp/evolver_frame_{ts:.1f}.jpg"
        cmd = [
            "ffmpeg", "-y", "-ss", str(ts), "-i", video_path,
            "-vframes", "1", "-q:v", "3", "-vf", "scale=540:-1",
            out_path,
        ]
        subprocess.run(cmd, capture_output=True, timeout=15)
        if Path(out_path).exists():
            with open(out_path, "rb") as f:
                frames.append(base64.standard_b64encode(f.read()).decode("utf-8"))
            os.unlink(out_path)
        else:
            frames.append(None)
    return frames


def get_clip_duration(video_path: str) -> float:
    """Get video duration in seconds using ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return float(result.stdout.strip())
    except Exception:
        return 60.0  # fallback


def _slice_srt(srt_text: str, start: float, end: float) -> str:
    """Extract SRT lines that fall within [start, end] seconds."""
    import re
    lines = []
    for block in re.split(r'\n\n+', srt_text.strip()):
        # Parse SRT timestamp: 00:01:23,456 --> 00:01:25,789
        ts_match = re.search(r'(\d{2}):(\d{2}):(\d{2})[,.](\d{3})', block)
        if not ts_match:
            continue
        h, m, s, ms = ts_match.groups()
        block_time = int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
        if start <= block_time <= end:
            # Extract just the text lines (skip index and timestamp)
            text_lines = [l for l in block.split('\n')[2:] if l.strip()]
            lines.extend(text_lines)
    return ' '.join(lines) if lines else srt_text[:2000]


# ─── Claude Vision Auditor ──────────────────────────────────────────

def audit_clip_with_vision(
    video_path: str,
    transcript: str,
    content_type: str,
    api_key: str,
    rubric_mode: str = "full",
) -> dict:
    """Send clip frames + transcript to Claude Vision for QA audit.

    Extracts 3 frames (hook, body, payoff), sends to Claude with the rubric,
    and returns structured scores + defects.

    rubric_mode: "raw" (4 dims, /40) or "full" (8 dims, /80)
    """
    duration = get_clip_duration(video_path)

    # Extract 3 key frames
    timestamps = [
        0.5,                    # Hook
        duration / 2,           # Body (midpoint)
        max(1.0, duration - 3), # Payoff (3s before end)
    ]
    frames = extract_frames(video_path, timestamps)

    # Build multimodal message
    content_parts = []

    frame_labels = ["HOOK (0.5s)", f"BODY ({duration/2:.0f}s)", f"PAYOFF ({duration-3:.0f}s)"]
    for i, (frame_b64, label) in enumerate(zip(frames, frame_labels)):
        if frame_b64:
            content_parts.append({
                "type": "text",
                "text": f"Frame {i+1} — {label}:",
            })
            content_parts.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": frame_b64,
                },
            })

    content_parts.append({
        "type": "text",
        "text": f"\nContent type: {content_type}\nClip duration: {duration:.1f}s\n\nTranscript:\n{transcript[:3000]}",
    })

    rubric_info = RUBRIC_MODES.get(rubric_mode, RUBRIC_MODES["full"])
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 2000,
        "system": rubric_info["rubric"],
        "messages": [{"role": "user", "content": content_parts}],
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CLAUDE_API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    print(f"    🔍 Auditing with Claude Vision...")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            text = "".join(
                b.get("text", "")
                for b in result.get("content", [])
                if b.get("type") == "text"
            )

        # Parse JSON from response
        import re
        json_match = re.search(r'(\{.*\})', text.strip(), re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
        else:
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())

    except Exception as e:
        print(f"    ⚠️ Vision audit failed: {e}")
        if rubric_mode == "raw":
            fallback_dims = ["frame_composition", "face_tracking", "hook_quality", "ending_quality"]
        else:
            fallback_dims = [
                "frame_composition", "face_tracking", "hook_quality",
                "ending_quality", "audio_sync", "pacing",
                "multi_speaker", "overall_watchability",
            ]
        fallback_total = len(fallback_dims) * 5
        return {
            "scores": {k: 5 for k in fallback_dims},
            "total_score": fallback_total,
            "defects": [{"defect_id": "audit_failed", "dimension": "all", "severity": 1.0,
                         "description": f"Audit failed: {str(e)[:200]}"}],
            "summary": "Audit failed — manual review needed",
        }


# ─── Improvement Ledger ─────────────────────────────────────────────

class ImprovementLedger:
    """Tracks quality scores and patches across iterations."""

    def __init__(self, output_dir: Path = EVOLVER_OUTPUT):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ledger_path = output_dir / "ledger.json"
        self._load()

    def _load(self):
        if self.ledger_path.exists():
            with open(self.ledger_path, "r") as f:
                self.data = json.load(f)
        else:
            self.data = {"iterations": [], "best_scores": {}, "total_patches_applied": 0}

    def _save(self):
        with open(self.ledger_path, "w") as f:
            json.dump(self.data, f, indent=2)

    def record_iteration(
        self,
        iteration_id: int,
        scores_by_type: dict[str, dict],
        defects: list[dict],
        patches_applied: list[str],
        config_version: str = "",
    ):
        entry = {
            "id": iteration_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "config_version": config_version,
            "scores": scores_by_type,
            "defects_found": len(defects),
            "top_defects": [d.get("description", "")[:100] for d in defects[:5]],
            "patches_applied": patches_applied,
        }
        self.data["iterations"].append(entry)
        self.data["total_patches_applied"] += len(patches_applied)

        # Track best scores
        for ctype, score_data in scores_by_type.items():
            avg = score_data.get("avg", 0)
            if ctype not in self.data["best_scores"] or avg > self.data["best_scores"][ctype]:
                self.data["best_scores"][ctype] = avg

        self._save()
        return entry

    def get_improvement_trend(self) -> dict:
        """Calculate improvement between first and last iteration."""
        if len(self.data["iterations"]) < 2:
            return {"status": "need_more_data", "iterations": len(self.data["iterations"])}

        first = self.data["iterations"][0]
        last = self.data["iterations"][-1]

        trends = {}
        for ctype in set(list(first.get("scores", {}).keys()) + list(last.get("scores", {}).keys())):
            first_avg = first.get("scores", {}).get(ctype, {}).get("avg", 0)
            last_avg = last.get("scores", {}).get(ctype, {}).get("avg", 0)
            trends[ctype] = {
                "first": first_avg,
                "latest": last_avg,
                "delta": last_avg - first_avg,
                "improved": last_avg > first_avg,
            }

        return {
            "status": "tracked",
            "iterations_completed": len(self.data["iterations"]),
            "trends": trends,
            "total_patches": self.data["total_patches_applied"],
        }


# ─── Main Orchestrator ──────────────────────────────────────────────

class ClipQAEvolver:
    """Self-improving video pipeline quality loop."""

    def __init__(
        self,
        test_corpus: dict[str, str],
        config_path: str = str(CONFIG_PATH),
        auto_patch: bool = False,
        num_clips: int = 3,
        daily_budget: float = DEFAULT_DAILY_BUDGET,
        rubric_mode: str = "full",
    ):
        self.test_corpus = test_corpus
        self.config_path = config_path
        self.auto_patch = auto_patch
        self.num_clips = num_clips
        self.daily_budget = daily_budget
        self.rubric_mode = rubric_mode
        self.rubric_info = RUBRIC_MODES.get(rubric_mode, RUBRIC_MODES["full"])
        self.ledger = ImprovementLedger()
        self.api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not self.api_key:
            # Fallback: load from .env file
            env_file = PROJECT_ROOT / ".env"
            if env_file.exists():
                with open(env_file) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("ANTHROPIC_API_KEY=") and not line.startswith("#"):
                            self.api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
        self._session_spend = 0.0
        self._score_history: list[float] = []  # avg scores per iteration for convergence

        # Persistent patcher for oscillation tracking across iterations
        self._patcher = None
        if auto_patch:
            from pipeline.config_patcher import ConfigPatcher
            self._patcher = ConfigPatcher(config_path)

        if not self.api_key:
            print("⚠️  ANTHROPIC_API_KEY not set. Audit will fail.")

        print(f"\n  📏 Rubric: {self.rubric_info['label']} ({self.rubric_info['dimensions']} dims, max {self.rubric_info['max_score']})")

        # Estimate cost per iteration
        n_types = len(test_corpus)
        clips_per_iter = n_types * num_clips
        est_cost = clips_per_iter * (COST_PER_VISION_CALL + COST_PER_TRANSCRIPTION)
        max_iters = int(daily_budget / est_cost) if est_cost > 0 else 999
        print(f"\n  💰 Budget: ${daily_budget:.2f}/day")
        print(f"  💰 Est. cost per iteration: ${est_cost:.2f} ({clips_per_iter} clips × ${COST_PER_VISION_CALL + COST_PER_TRANSCRIPTION:.2f})")
        print(f"  💰 Max iterations within budget: ~{max_iters}")

    def run_iteration(self, iteration_id: int) -> dict:
        """One complete Generate → Audit → Diagnose → Patch cycle."""
        # Budget check
        if self._session_spend >= self.daily_budget:
            print(f"\n  🛑 Daily budget exhausted (${self._session_spend:.2f}/${self.daily_budget:.2f}). Stopping.")
            return {"stopped": "budget_exceeded"}

        print(f"\n{'='*70}")
        print(f"  ClipQA AutoEvolver — Iteration {iteration_id}")
        print(f"  💰 Session spend: ${self._session_spend:.2f} / ${self.daily_budget:.2f}")
        print(f"{'='*70}")

        all_scores: dict[str, dict] = {}
        all_defects: list[dict] = []
        all_patches: list[str] = []

        import concurrent.futures

        def process_video_task(content_type: str, video_path: str) -> dict:
            if not Path(video_path).exists():
                return {"status": "skipped", "reason": f"Video not found at {video_path}"}
            
            # 1. GENERATE
            clips = self._generate_clips(video_path, content_type, iteration_id=iteration_id)
            if not clips:
                return {"status": "no_clips"}

            # 2. AUDIT each clip
            local_scores = []
            local_defects = []
            local_spend = 0.0

            for clip_info in clips:
                clip_path = clip_info["path"]
                transcript = clip_info.get("transcript", "")
                if not Path(clip_path).exists():
                    continue

                audit = audit_clip_with_vision(
                    clip_path, transcript, content_type, self.api_key,
                    rubric_mode=self.rubric_mode,
                )
                total = audit.get("total_score", 0)
                local_scores.append(total)
                local_defects.extend(audit.get("defects", []))
                local_spend += COST_PER_VISION_CALL

            return {
                "status": "success",
                "scores": local_scores,
                "defects": local_defects,
                "spend": local_spend
            }

        # Run videos in parallel (3 at a time minimizes CPU bottleneck while keeping GPUs busy)
        print(f"\n🚀 Running 8 pipeline extractions concurrently in AI time...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_map = {
                executor.submit(process_video_task, ct, vp): ct
                for ct, vp in self.test_corpus.items()
            }
            
            for future in concurrent.futures.as_completed(future_map):
                ct = future_map[future]
                try:
                    res = future.result()
                    
                    print(f"\n{'─'*50}")
                    print(f"  Result: {ct.upper()}")
                    
                    if res["status"] == "skipped":
                        print(f"  ⚠️ Skipped: {res['reason']}")
                        continue
                        
                    if res["status"] == "no_clips":
                        print(f"  ⚠️ No clips generated")
                        all_scores[ct] = {"avg": 0, "clips": []}
                        continue
                        
                    if res["status"] == "success":
                        scores = res["scores"]
                        avg = sum(scores) / len(scores) if scores else 0
                        all_scores[ct] = {"avg": round(avg, 1), "clips": scores}
                        all_defects.extend(res["defects"])
                        self._session_spend += res["spend"]
                        
                        print(f"  ✅ Extracted & Audited {len(scores)} clips")
                        print(f"  📉 Average Score: {avg:.1f}/{self.rubric_info['max_score']}")
                        print(f"  🐛 Defects Found: {len(res['defects'])}")
                except Exception as e:
                    print(f"\n⚠️ Pipeline thread failed for {ct}: {e}")

        # 3. DIAGNOSE + PATCH (config only)
        if self.auto_patch and all_defects and self._patcher:
            patches = self._patcher.generate_patches(all_defects)

            if patches:
                print(f"\n{'─'*50}")
                print(f"  🔧 Auto-patching config ({len(patches)} adjustments)")
                print(f"{'─'*50}")
                self._patcher.apply_patches(patches)
                all_patches = self._patcher.get_patch_summary(patches)
            else:
                print("\n  ✅ No config patches needed this iteration.")

            # Report frozen parameters
            frozen = self._patcher.get_frozen_params()
            if frozen:
                print(f"\n  🧊 Frozen parameters ({len(frozen)}):")
                for fp in sorted(frozen):
                    print(f"     - {fp}")

        # 4. REPORT
        entry = self.ledger.record_iteration(
            iteration_id=iteration_id,
            scores_by_type=all_scores,
            defects=all_defects,
            patches_applied=all_patches,
        )

        # Write human-readable report
        self._write_report(iteration_id, all_scores, all_defects, all_patches)

        # Print summary
        print(f"\n{'='*70}")
        print(f"  Iteration {iteration_id} Complete!")
        print(f"{'='*70}")
        max_s = self.rubric_info['max_score']
        for ctype, data in all_scores.items():
            print(f"  {ctype:15s}  avg={data['avg']:5.1f}/{max_s}  clips={data['clips']}")
        print(f"  Defects found: {len(all_defects)}")
        print(f"  Patches applied: {len(all_patches)}")

        # Show improvement trend
        trend = self.ledger.get_improvement_trend()
        if trend.get("status") == "tracked":
            print(f"\n  📈 Improvement Trend ({trend['iterations_completed']} iterations):")
            for ctype, t in trend.get("trends", {}).items():
                delta_str = f"+{t['delta']:.1f}" if t['delta'] >= 0 else f"{t['delta']:.1f}"
                emoji = "📈" if t['improved'] else "📉"
                print(f"    {emoji} {ctype:15s}  {t['first']:.1f} → {t['latest']:.1f}  ({delta_str})")

        # Track overall average score for convergence detection
        if all_scores:
            overall_avg = sum(d["avg"] for d in all_scores.values()) / len(all_scores)
        else:
            overall_avg = 0.0
        self._score_history.append(overall_avg)

        # Convergence status report
        status = self._convergence_status()
        print(f"\n  Convergence: {status}")

        return entry

    def _convergence_status(self) -> str:
        """Classify the convergence state based on recent score history.

        Returns one of:
            "CONVERGING"  — last 3 scores trending up
            "OSCILLATING" — scores alternate up/down
            "PLATEAU"     — scores change by <1 point
            "DIVERGING"   — scores trending down
            "WARMING_UP"  — not enough data yet
        """
        h = self._score_history
        if len(h) < 3:
            return "WARMING_UP (need 3+ iterations)"

        last3 = h[-3:]
        deltas = [last3[i + 1] - last3[i] for i in range(len(last3) - 1)]

        # Plateau: all deltas < 1 point in magnitude
        if all(abs(d) < 1.0 for d in deltas):
            return "PLATEAU"

        # Converging: all deltas positive
        if all(d > 0 for d in deltas):
            return "CONVERGING"

        # Diverging: all deltas negative
        if all(d < 0 for d in deltas):
            return "DIVERGING"

        # Oscillating: alternating signs
        if len(deltas) >= 2 and all(
            deltas[i] * deltas[i + 1] < 0 for i in range(len(deltas) - 1)
        ):
            return "OSCILLATING"

        return "MIXED"

    def should_early_stop(self) -> bool:
        """Early stopping disabled — score variance (~±8 pts) makes the heuristic
        fire prematurely. Sprints always run their full iteration budget."""
        return False

    def _generate_clips(self, video_path: str, content_type: str, iteration_id: int = 0) -> list[dict]:
        """Run the pipeline to generate clips from a source video."""
        output_dir = str(EVOLVER_OUTPUT / f"iter_clips" / content_type)

        # Clean previous iteration's output so pipeline doesn't reuse cached selections
        import shutil
        if Path(output_dir).exists():
            shutil.rmtree(output_dir)
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # ── Transcript cache ─────────────────────────────────────────────────
        # Transcription is the slowest step (~10-15 min/video via WhisperX).
        # The transcript never changes between iterations — only config does.
        # Cache the SRT after the first successful run and reuse it every time.
        cache_dir = EVOLVER_OUTPUT / "transcript_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)

        import hashlib
        video_hash = hashlib.md5(str(video_path).encode()).hexdigest()[:10]
        cached_srt = cache_dir / f"{video_hash}.srt"

        transcript_args = []
        if cached_srt.exists():
            print(f"  📝 Using cached transcript ({cached_srt.name})")
            transcript_args = ["--transcript", str(cached_srt)]
        # ─────────────────────────────────────────────────────────────────────

        cmd = [
            sys.executable, "-m", "pipeline.full_pipeline",
            "--video", video_path,
            "--output", output_dir,
            "--clips", str(self.num_clips),
            "--format", "auto",
            "--content-type", content_type,
            "--no-post",
            "--brand", "6fbarber",
            *transcript_args,
        ]

        print(f"  🎬 Generating {self.num_clips} clips...")

        # Forward env with PYTHONPATH + .env values for subprocess
        env = os.environ.copy()
        env["PYTHONPATH"] = str(TOOLS_ROOT)
        # Inject .env values so the pipeline subprocess gets API keys
        env_file = PROJECT_ROOT / ".env"
        if env_file.exists():
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        env.setdefault(key.strip(), val.strip().strip('"').strip("'"))

        result = subprocess.run(
            cmd, capture_output=True, text=True,
            cwd=str(TOOLS_ROOT),
            env=env,
            timeout=1800,  # 30 min max per video (increased for parallel GPU multiplexing)
        )

        # Persist full stdout/stderr so filter activity is inspectable after the sprint.
        # Evolver uses capture_output=True, which otherwise discards subprocess output.
        log_dir = EVOLVER_OUTPUT / "pipeline_logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / f"iteration_{iteration_id:03d}_{content_type}.log"
        with open(log_path, "w") as lf:
            lf.write(f"# cmd: {' '.join(cmd)}\n# returncode: {result.returncode}\n\n")
            lf.write("=== STDOUT ===\n")
            lf.write(result.stdout or "")
            lf.write("\n=== STDERR ===\n")
            lf.write(result.stderr or "")

        # ── Cache transcript after successful run ────────────────────────────
        if result.returncode == 0 and not cached_srt.exists():
            # Find the generated SRT in the output dir and cache it
            srt_files = list(Path(output_dir).glob("*.srt"))
            if srt_files:
                shutil.copy2(srt_files[0], cached_srt)
                print(f"  📝 Transcript cached for future iterations ({cached_srt.name})")
        # ─────────────────────────────────────────────────────────────────────


        if result.returncode != 0:
            # Show full error for debugging
            stderr_tail = result.stderr[-500:] if result.stderr else "no stderr"
            stdout_tail = result.stdout[-500:] if result.stdout else "no stdout"
            print(f"  ⚠️ Pipeline failed:")
            print(f"     stderr: {stderr_tail}")
            print(f"     stdout: {stdout_tail}")
            return []

        # Find generated clips
        clips = []
        output_path = Path(output_dir)

        # Look for validated_clips.json to get clip metadata
        validated_path = output_path / "validated_clips.json"
        if validated_path.exists():
            with open(validated_path, "r") as f:
                validated = json.load(f)

            for clip_def in validated:
                clip_id = clip_def.get("id", 0)
                title = clip_def.get("title", f"clip-{clip_id:02d}")
                clip_dir = output_path / f"clip-{clip_id:02d}-{title}"

                # Find the rendered video
                for candidate in ["reframed-split.mp4", "reframed-9x16.mp4", "reframed-auto.mp4"]:
                    video_file = clip_dir / candidate
                    if video_file.exists():
                        # Try to load transcript from output dir or cached SRT
                        transcript = ""
                        srt_files = list(output_path.glob("*.srt"))
                        if not srt_files and cached_srt.exists():
                            srt_files = [cached_srt]
                        if srt_files:
                            with open(srt_files[0], "r", encoding="utf-8") as f:
                                full_srt = f.read()
                            # Slice transcript to clip segment
                            clip_start = clip_def.get("start", 0)
                            clip_end = clip_def.get("end", 0)
                            transcript = _slice_srt(full_srt, clip_start, clip_end)

                        clips.append({
                            "path": str(video_file),
                            "title": title,
                            "start": clip_def.get("start", 0),
                            "end": clip_def.get("end", 0),
                            "transcript": transcript,
                        })
                        break

        print(f"  ✅ Found {len(clips)} rendered clips")
        return clips

    def _write_report(
        self,
        iteration_id: int,
        scores: dict,
        defects: list,
        patches: list,
    ):
        """Write a human-readable markdown report card."""
        report_dir = EVOLVER_OUTPUT / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path = report_dir / f"iteration_{iteration_id:03d}.md"

        lines = [
            f"# ClipQA AutoEvolver — Iteration {iteration_id}",
            f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "",
            "## Scores",
            "",
            "| Content Type | Average | Clip Scores |",
            "|:------------|-------:|:-----------|",
        ]

        overall_avg = 0
        count = 0
        for ctype, data in scores.items():
            clip_str = ", ".join(str(s) for s in data.get("clips", []))
            lines.append(f"| {ctype} | {data['avg']:.1f}/{self.rubric_info['max_score']} | {clip_str} |")
            overall_avg += data["avg"]
            count += 1

        if count:
            lines.append(f"| **OVERALL** | **{overall_avg/count:.1f}/{self.rubric_info['max_score']}** | |")

        lines.extend(["", "## Defects Found", ""])
        if defects:
            for d in defects[:15]:
                lines.append(
                    f"- **[{d.get('defect_id', '?')}]** "
                    f"({d.get('dimension', '?')}, severity={d.get('severity', 0):.1f}): "
                    f"{d.get('description', '')}"
                )
        else:
            lines.append("No defects found! 🎉")

        if patches:
            lines.extend(["", "## Config Patches Applied", ""])
            for p in patches:
                lines.append(f"- `{p}`")

        lines.extend(["", "---", f"*Generated by ClipQA AutoEvolver*"])

        with open(report_path, "w") as f:
            f.write("\n".join(lines))

        print(f"  📝 Report saved: {report_path}")

        # Also log defects to .learnings/ for the self-improving-agent skill
        self._log_defects_to_learnings(iteration_id, defects)

    def _log_defects_to_learnings(self, iteration_id: int, defects: list[dict]):
        """Log defects using the self-improving-agent LEARNINGS format.

        This enables defects to persist across sessions and get promoted
        to CLAUDE.md or config rules when they recur >= 3 times.
        """
        learnings_dir = PROJECT_ROOT / ".learnings"
        learnings_dir.mkdir(parents=True, exist_ok=True)
        errors_path = learnings_dir / "ERRORS.md"

        if not defects:
            return

        timestamp = datetime.now(timezone.utc).isoformat()
        date_str = datetime.now().strftime("%Y%m%d")

        entries = []
        for i, defect in enumerate(defects[:10]):  # cap at 10 per iteration
            entry_id = f"ERR-{date_str}-EVO{iteration_id:02d}{i:02d}"
            defect_id = defect.get("defect_id", "unknown")
            dimension = defect.get("dimension", "unknown")
            severity = defect.get("severity", 0.5)
            description = defect.get("description", "No description")

            entries.append(f"""
## [{entry_id}] clip_qa_evolver/{defect_id}

**Logged**: {timestamp}
**Priority**: {"high" if severity >= 0.7 else "medium" if severity >= 0.4 else "low"}
**Status**: pending
**Area**: config

### Summary
AutoEvolver iteration {iteration_id}: {description}

### Error
Defect ID: `{defect_id}`
Dimension: `{dimension}`
Severity: {severity:.2f}

### Context
- Source: ClipQA AutoEvolver iteration {iteration_id}
- Dimension: {dimension}
- Maps to config patch: {defect_id in DEFECT_PATCH_MAP}

### Metadata
- Source: evolver_audit
- Pattern-Key: evolver.{defect_id}
- Tags: clip-qa, auto-evolver, {dimension}

---""")

        # Append to ERRORS.md
        mode = "a" if errors_path.exists() else "w"
        with open(errors_path, mode) as f:
            if mode == "w":
                f.write("# ClipQA AutoEvolver — Error Log\n\n")
                f.write("Structured defect log following the self-improving-agent format.\n")
                f.write("Defects recurring >= 3 times should be promoted to config rules.\n\n---\n")
            f.write("\n".join(entries))

        print(f"  📓 Logged {len(entries)} defects to {errors_path}")


# ─── Test Corpus Discovery ──────────────────────────────────────────

def discover_test_corpus() -> dict[str, str]:
    """Look for sample videos in known IX production locations."""
    corpus = {}

    # --- IX production clips (the gold standard) ---
    ix_root = PROJECT_ROOT
    ix_clips = ix_root / "output" / "clips" / "miami-vlog"

    # The proven source — the IX Content Manager's best clip
    playable = ix_root / "output" / "clips" / "miami-vlog" / "clip-01-v2" / "final-6fb-playable.mp4"
    if playable.exists():
        corpus["vlog"] = str(playable)

    # Check for other IX-produced clips as alternate test subjects
    ix_out = ix_root / "out"
    if ix_out.exists():
        for f in sorted(ix_out.glob("*.mp4")):
            name = f.stem.lower()
            if "dont-rush" in name and "tutorial" not in corpus:
                corpus["tutorial"] = str(f)
            elif "commission" in name and "podcast" not in corpus:
                corpus["podcast"] = str(f)
            elif "fullcap" in name and "product_review" not in corpus:
                corpus["product_review"] = str(f)

    # Check Content Studio upload directory
    content_studio_clips = Path.home() / "Library" / "Application Support" / "6fb-content-studio" / "clips"
    if content_studio_clips.exists():
        for run_dir in sorted(content_studio_clips.iterdir(), reverse=True):
            if run_dir.is_dir():
                for f in run_dir.glob("*.mp4"):
                    if "vlog" not in corpus:
                        corpus["vlog"] = str(f)
                        break

    # Also discover Remotion comp source videos for extra coverage
    for clip_dir in (ix_clips,) if ix_clips.exists() else ():
        for sub in clip_dir.iterdir():
            if sub.is_dir():
                raw = sub / "raw.mp4"
                if raw.exists() and "day_in_the_life" not in corpus:
                    corpus["day_in_the_life"] = str(raw)

    return corpus


# ─── CLI ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ClipQA AutoEvolver — Self-improving video pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--iterations", type=int, default=1, help="Number of evolver iterations to run")
    parser.add_argument("--video", help="Path to a single video (overrides test corpus)")
    parser.add_argument("--content-type", default="vlog", help="Content type for single video mode")
    parser.add_argument("--clips", type=int, default=3, help="Number of clips per video")
    parser.add_argument("--auto-patch", action="store_true", help="Auto-patch config.yaml parameters")
    parser.add_argument("--dry-run", action="store_true", help="Audit only, no patches")
    parser.add_argument("--corpus-file", help="JSON file mapping content_type → video_path")
    parser.add_argument("--budget", type=float, default=DEFAULT_DAILY_BUDGET,
                        help=f"Daily budget cap in USD (default: ${DEFAULT_DAILY_BUDGET:.0f})")
    parser.add_argument("--rubric", choices=["raw", "full"], default="raw",
                        help="QA rubric mode: 'raw' (4 dims, /40) for extraction-only sprints, "
                             "'full' (8 dims, /80) for --compose production runs (default: raw)")
    args = parser.parse_args()

    # Build test corpus
    if args.video:
        test_corpus = {args.content_type: args.video}
    elif args.corpus_file:
        with open(args.corpus_file) as f:
            test_corpus = json.load(f)
    else:
        test_corpus = discover_test_corpus()

    if not test_corpus:
        print("❌ No test videos found. Use --video or --corpus-file to specify.")
        print("   Example: --video /path/to/vlog.mp4 --content-type vlog")
        sys.exit(1)

    print(f"\n📋 Test Corpus ({len(test_corpus)} videos):")
    for ctype, path in test_corpus.items():
        exists = "✅" if Path(path).exists() else "❌"
        print(f"  {exists} {ctype:15s} → {Path(path).name}")

    auto_patch = args.auto_patch and not args.dry_run

    evolver = ClipQAEvolver(
        test_corpus=test_corpus,
        auto_patch=auto_patch,
        num_clips=args.clips,
        daily_budget=args.budget,
        rubric_mode=args.rubric,
    )

    # Run iterations
    for i in range(1, args.iterations + 1):
        result = evolver.run_iteration(i)

        # Early stopping: no meaningful improvement in last 5 iterations
        if evolver.should_early_stop():
            print(f"\n  🛑 Early stopping: average score hasn't improved by >2 points in 5 iterations.")
            break

        if result and result.get("stopped"):
            break

        if i < args.iterations:
            print(f"\n⏳ Cooling down before iteration {i+1}...")
            time.sleep(5)

    # Final trend report
    trend = evolver.ledger.get_improvement_trend()
    if trend.get("status") == "tracked":
        print(f"\n{'='*70}")
        print(f"  FINAL IMPROVEMENT REPORT")
        print(f"{'='*70}")
        for ctype, t in trend.get("trends", {}).items():
            delta = t["delta"]
            emoji = "🚀" if delta >= 5 else "📈" if delta > 0 else "📉"
            print(f"  {emoji} {ctype:15s}  {t['first']:.1f} → {t['latest']:.1f}  ({'+' if delta >= 0 else ''}{delta:.1f})")
        print(f"\n  Total config patches applied: {trend['total_patches']}")

    # ─── Sprint Complete Notification ──────────────────────────────────
    try:
        from pipeline.discord_notify import notify_sprint_complete
        notify_sprint_complete(
            scores=trend.get("trends", {}),
            spend=evolver._session_spend,
            budget=args.budget,
            iterations=args.iterations,
            patches=trend.get("total_patches", 0),
        )
    except Exception as e:
        print(f"\n  [discord] Notification skipped: {e}")


if __name__ == "__main__":
    main()
