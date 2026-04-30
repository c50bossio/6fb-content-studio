#!/usr/bin/env python3
"""
Overlay Matcher — Analyzes transcript segments and generates pop-out specs.

This is the "brain" that reads a clip's transcript, identifies 4-8 key moments
worth visualizing, and outputs a clip_spec.json that the AI composer uses
to generate custom illustrations.

NOT a template matcher. It produces content-aware specs that tell the AI
WHAT to illustrate, not HOW.

Usage:
    python3 tools/pipeline/overlay_matcher.py \
        --transcript output/clips/miami-vlog/clip-04-captions.json \
        --clip-info output/clips/miami-vlog/clip-04-info.json \
        --brand 6fbarber \
        --output output/clips/miami-vlog/clip-04-spec.json

Can also be called as a library:
    from pipeline.overlay_matcher import generate_clip_spec
"""

import json
import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent.parent

# --- Brand data ---

BRAND_META = {
    "6fbarber": {
        "name": "6FB Mentorship",
        "tagline": "Barber business mentorship — systems, pricing, growth",
        "url": "6fbmentorship.com",
        "logo": "logos/6fbarber/logo.png",
        "cta_text": "Log in at 6fbmentorship.com",
        "popout_style": "dark-blur",
    },
    "pieaccounting": {
        "name": "Pie Accounting",
        "tagline": "Accounting made simple for barbers and beauty pros",
        "url": "pieaccounting.com",
        "logo": "logos/pieaccounting/logo.png",
        "cta_text": "Book a call at pieaccounting.com",
        "popout_style": "dark-blur",
    },
}


def load_transcript_segment(transcript_path: str, start_s: float, end_s: float) -> str:
    """Extract transcript text for a clip's time range."""
    path = Path(transcript_path)

    if path.suffix == ".json":
        with open(path) as f:
            data = json.load(f)
        # Handle word-level captions format
        if isinstance(data, list):
            words = [w for w in data if w.get("start", 0) >= start_s and w.get("end", 0) <= end_s]
            # Group into 5-word chunks for timing context
            chunks = []
            for i in range(0, len(words), 5):
                chunk = words[i:i+5]
                t_offset = round(chunk[0].get("start", 0) - start_s, 1)
                text = " ".join(w.get("text", w.get("word", "")) for w in chunk)
                chunks.append(f"[{t_offset}s] {text}")
            return "\n".join(chunks)
            
        elif "segments" in data:
            segments = [s for s in data["segments"] if s["start"] >= start_s and s["end"] <= end_s]
            return "\n".join(f"[{round(s['start'] - start_s, 1)}s] {s['text'].strip()}" for s in segments)

    elif path.suffix == ".srt":
        # Parse SRT
        text_lines = []
        with open(path) as f:
            content = f.read()
        blocks = content.strip().split("\n\n")
        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) >= 3:
                timecode = lines[1]
                start_str = timecode.split(" --> ")[0].strip()
                # Parse HH:MM:SS,mmm
                parts = start_str.replace(",", ".").split(":")
                t = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
                if start_s <= t <= end_s:
                    t_offset = round(t - start_s, 1)
                    text_lines.append(f"[{t_offset}s] " + " ".join(lines[2:]))
        return "\n".join(text_lines)

    elif path.suffix == ".txt":
        with open(path) as f:
            return f.read()

    return ""


# Content-type-specific pop-out guidance
CONTENT_TYPE_GUIDANCE = {
    "vlog": """CONTENT TYPE: VLOG / TALKING HEAD
Focus on conceptual illustrations. Pull real numbers, comparisons, quotes, and strong opinions.
Pop-out ideas: cost breakdowns, before/after comparisons, warning banners, quote cards,
process flows, stat displays. Make each one screenshot-worthy for Instagram Stories.""",
    "tutorial": """CONTENT TYPE: HAIRCUT TUTORIAL
Focus on step labels, tool callouts, guard/blade settings, and technique tips.
Pop-out ideas: numbered steps ("Step 1: Outline"), tool cards ("Andis Fade Master, #1 guard"),
technique tips ("Use the corner of the blade"), before/after comparisons.
Number every step. Show tool names and settings prominently.""",
    "podcast": """CONTENT TYPE: PODCAST / INTERVIEW
Focus on topic labels, key takeaways, guest quotes, and debate points.
Pop-out ideas: topic banners, quote cards with attribution, stat displays,
pro/con comparisons, key insight highlights. Attribute quotes to speakers when possible.""",
    "product_review": """CONTENT TYPE: PRODUCT REVIEW
Focus on product specs, ratings, pros/cons, price comparisons, and verdict.
Pop-out ideas: product spec cards, star ratings (1-5), pros/cons lists,
price vs competitor table, verdict banner (BUY/SKIP/WAIT).
Extract product names, prices, and specific opinions from the transcript.""",
}


def generate_popout_analysis_prompt(
    transcript: str, brand_slug: str, duration_s: float, content_type: str = "vlog"
) -> str:
    """Build the AI prompt for pop-out analysis."""
    brand = BRAND_META.get(brand_slug, BRAND_META["6fbarber"])
    num_popouts = min(8, max(4, int(duration_s / 12)))

    if content_type == "auto":
        type_guidance = """INTELLIGENT CONTENT CLASSIFICATION:
First, automatically classify this transcript into one of these content types, then apply its specific visual strategy for the pop-outs:
- VLOG / TALKING HEAD: Focus on conceptual illustrations, quotes, cost breakdowns, warnings.
- HAIRCUT TUTORIAL: Focus on step numbers, tool callouts (e.g. Andis Fade Master, #1 guard), technique tips.
- PODCAST / INTERVIEW: Focus on topic banners, quote cards with speaker attribution, pro/con debates.
- PRODUCT REVIEW: Focus on product specs, pros/cons, 1-5 star ratings, and BUY/SKIP verdicts."""
    else:
        type_guidance = CONTENT_TYPE_GUIDANCE.get(content_type, CONTENT_TYPE_GUIDANCE["vlog"])

    return f"""Analyze this transcript segment and identify {num_popouts} key moments that deserve
visual pop-out overlays in a short-form video clip.

{type_guidance}

TRANSCRIPT:
---
{transcript}
---

BRAND: {brand['name']} ({brand_slug})
CLIP DURATION: {duration_s:.0f} seconds ({int(duration_s * 30)} frames at 30fps)

For each pop-out, provide:
1. **title**: Short label (2-4 words, ALL CAPS) shown as the ConceptOverlay caption
2. **timestamp_seconds**: When this moment occurs in the clip
3. **concept**: What the illustration should communicate (1 sentence)
4. **visual_direction**: Specific, creative illustration idea — NOT generic.
   Describe the custom SVG/React illustration. Be specific about shapes, icons,
   layout, animations. Think: what would make someone pause and screenshot this?
5. **content_data**: Any specific text, numbers, or lists that should appear
   in the illustration (extracted from the transcript)
6. **mood**: The emotional tone (e.g. "warning", "triumph", "educational", "comparison")

RULES:
- Pop-outs should be spaced at least 8 seconds apart
- First pop-out should appear 2-4 seconds in (not immediately)
- Last pop-out should be a CTA end card for {brand['name']}
- Each illustration should be UNIQUE — no two should use the same visual pattern
- Pull real numbers, real names, real specifics from the transcript
- Think about what would make each pop-out screenshot-worthy on Instagram Stories
- TIMING IS CRITICAL: **Look at the `[XX.Xs]` timestamp bracket next to the sentence you want to emphasize**. Set your `timestamp_seconds` EXACTLY to that bracket number so the graphic appears precisely when the word is spoken! Do NOT guess mathematically.
Output as JSON array:
[
  {{
    "id": 1,
    "title": "EXAMPLE TITLE",
    "timestamp_seconds": 2.0,
    "frame_start": 60,
    "duration_frames": 100,
    "concept": "...",
    "visual_direction": "...",
    "content_data": {{}},
    "mood": "..."
  }}
]
"""


def generate_clip_spec(
    transcript_path: str,
    clip_start: float,
    clip_end: float,
    clip_title: str,
    clip_id: str,
    brand_slug: str,
    video_src: str,
    captions_src: str | None = None,
    output_path: str | None = None,
    content_type: str = "vlog",
    logo_override: str | None = None,
) -> dict:
    """
    Generate a complete clip_spec.json for a clip.

    If AI is available (Claude API key in env), generates smart pop-out
    analysis. Otherwise, creates a skeleton spec for manual pop-out definition.
    """
    duration_s = clip_end - clip_start
    total_frames = int(duration_s * 30)
    brand = BRAND_META.get(brand_slug, BRAND_META["6fbarber"]).copy()
    if logo_override is not None:
        brand["logo"] = logo_override

    # Load transcript
    transcript = load_transcript_segment(transcript_path, clip_start, clip_end)

    spec = {
        "clipId": clip_id,
        "brand": brand_slug,
        "title": clip_title,
        "contentType": content_type,
        "duration": duration_s,
        "totalFrames": total_frames,
        "fps": 30,
        "videoSrc": video_src,
        "captionsSrc": captions_src,
        "transcript": transcript[:2000],
        "popouts": [],
        "sfx": [],
        "cta": {
            "brandName": brand["name"],
            "tagline": brand["tagline"],
            "url": brand["url"],
            "logoSrc": brand["logo"],
            "ctaText": brand["cta_text"],
        },
        "generatedAt": datetime.now().isoformat(),
        "status": "needs_ai_analysis",
    }

    # Try AI analysis if API key available
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key and transcript:
        try:
            prompt = generate_popout_analysis_prompt(transcript, brand_slug, duration_s, content_type)
            spec["_ai_prompt"] = prompt
            spec["status"] = "ai_prompt_ready"
            print(f"[overlay_matcher] AI prompt generated ({len(prompt)} chars)")
            print(f"[overlay_matcher] Transcript: {len(transcript)} chars for {duration_s:.0f}s clip")
        except Exception as e:
            print(f"[overlay_matcher] AI analysis failed: {e}")
            spec["status"] = "needs_manual_popouts"
    else:
        if not transcript:
            print("[overlay_matcher] No transcript found — skeleton spec created")
        else:
            print("[overlay_matcher] No API key — skeleton spec with transcript ready for AI")
        spec["status"] = "needs_manual_popouts"

    # Generate default SFX events based on expected pop-out count
    expected_popouts = min(8, max(4, int(duration_s / 12)))
    spacing = total_frames / (expected_popouts + 1)
    default_starts = [int(spacing * (i + 1)) for i in range(expected_popouts)]

    spec["sfx"] = [
        {"frame": 0, "src": "audio/whoosh-large-sub-384631.mp3", "volume": 0.24},
    ]
    for start in default_starts:
        spec["sfx"].append({
            "frame": max(0, start - 3),
            "src": "audio/whoosh-bamboo-389752.mp3",
            "volume": 0.16,
        })
    spec["sfx"].append({
        "frame": total_frames - 100,
        "src": "audio/pop-402324.mp3",
        "volume": 0.18,
    })

    # Save
    if output_path:
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w") as f:
            json.dump(spec, f, indent=2)
            f.write("\n")
        print(f"[overlay_matcher] Spec written to {out}")

    return spec


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate pop-out overlay specs for a clip")
    parser.add_argument("--transcript", required=True, help="Path to transcript (SRT, JSON, or TXT)")
    parser.add_argument("--start", type=float, default=0, help="Clip start time in seconds")
    parser.add_argument("--end", type=float, required=True, help="Clip end time in seconds")
    parser.add_argument("--title", required=True, help="Clip title (PascalCase)")
    parser.add_argument("--clip-id", required=True, help="Clip identifier")
    parser.add_argument("--brand", default="6fbarber", help="Brand slug")
    parser.add_argument("--video-src", required=True, help="Path to reframed video")
    parser.add_argument("--captions-src", help="Path to word-level captions JSON")
    parser.add_argument("--output", required=True, help="Output clip_spec.json path")
    parser.add_argument("--content-type", default="auto",
                        help="Content type for pop-out style (default: auto)")
    args = parser.parse_args()

    generate_clip_spec(
        transcript_path=args.transcript,
        clip_start=args.start,
        clip_end=args.end,
        clip_title=args.title,
        clip_id=args.clip_id,
        brand_slug=args.brand,
        video_src=args.video_src,
        captions_src=args.captions_src,
        output_path=args.output,
        content_type=args.content_type,
    )


if __name__ == "__main__":
    main()
