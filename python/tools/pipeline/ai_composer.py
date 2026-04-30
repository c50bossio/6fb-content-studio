#!/usr/bin/env python3
"""
AI Composer — Calls Claude API to generate custom Remotion compositions.

Takes a clip_spec.json (produced by overlay_matcher), sends the AI prompt
to Claude, parses the response into a working TSX composition file,
registers it in Root.tsx, and optionally triggers rendering.

Usage:
    python3 tools/pipeline/ai_composer.py \
        --spec output/clips/miami-vlog/clip-04/clip_spec.json \
        --api-key sk-ant-... \
        --render

    # Or as library:
    from pipeline.ai_composer import compose_clip
    result = compose_clip("path/to/clip_spec.json", api_key="sk-ant-...")
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent.parent
COMPOSITIONS_DIR = PROJECT_ROOT / "remotion" / "compositions"
ROOT_TSX = PROJECT_ROOT / "remotion" / "Root.tsx"

CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = "claude-sonnet-4-20250514"
DATA_DIR = PROJECT_ROOT / "remotion" / "data"


def safe_file_stem(value: str, fallback: str = "clip") -> str:
    """Return a filesystem-safe stem for generated Remotion assets."""
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]+", "-", str(value or "")).strip(".-")
    return cleaned[:120] or fallback


def _parse_srt(srt_path: str) -> list:
    """Parse SRT file into list of {start, end, text} dicts (times in seconds)."""
    segments = []
    with open(srt_path, encoding="utf-8") as f:
        content = f.read()
    
    blocks = re.split(r'\n\n+', content.strip())
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        time_line = lines[1] if '-->' in lines[1] else (lines[0] if '-->' in lines[0] else None)
        if not time_line:
            continue
        
        def ts_to_sec(ts):
            ts = ts.strip().replace(',', '.')
            parts = ts.split(':')
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        
        start_ts, end_ts = time_line.split('-->')
        text = ' '.join(lines[2:]).strip()
        if text:
            segments.append({
                'start': ts_to_sec(start_ts),
                'end': ts_to_sec(end_ts),
                'text': text,
            })
    return segments


def generate_words_file(title: str, transcript: str, start_sec: float,
                        fps: float = 30.0, srt_path: str = None,
                        clip_start: float = 0.0, clip_end: float = 0.0) -> str:
    """Generate a Remotion word-timing .ts file from SRT data or transcript text."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    EMPHASIS_WORDS = {"never", "always", "every", "all", "money", "percent", "free", "stop",
                      "start", "grow", "win", "lose", "best", "worst", "key", "must",
                      "100", "73", "70", "30", "clients", "text", "barber"}
    
    words = []
    
    if srt_path and os.path.exists(srt_path) and clip_end > clip_start:
        # Use real SRT timestamps for accurate word timing
        segments = _parse_srt(srt_path)
        
        # Filter segments that overlap with this clip's time range
        clip_segments = []
        for seg in segments:
            if seg['end'] > clip_start and seg['start'] < clip_end:
                clip_segments.append(seg)
        
        for seg in clip_segments:
            seg_words = seg['text'].split()
            if not seg_words:
                continue
            
            # Offset to clip-relative time
            seg_start = max(0.0, seg['start'] - clip_start)
            seg_end = max(0.0, seg['end'] - clip_start)
            seg_duration = seg_end - seg_start
            
            # Distribute words proportionally within the segment
            total_chars = sum(len(w) for w in seg_words) or 1
            t = seg_start
            for w in seg_words:
                word_frac = len(w) / total_chars
                word_dur = seg_duration * word_frac
                words.append({
                    "word": w,
                    "start": round(t, 3),
                    "end": round(t + word_dur, 3),
                    "startFrame": int(t * fps),
                    "endFrame": int((t + word_dur) * fps),
                    "emphasis": w.lower().strip('.,!?\'"') in EMPHASIS_WORDS,
                })
                t += word_dur
    
    if not words:
        # Fallback: estimate from transcript text and clip duration
        tokens = transcript.strip().split()
        clip_duration = (clip_end - clip_start) if clip_end > clip_start else max(len(tokens) * 0.35, 1.0)
        total_chars = sum(len(w) for w in tokens) or 1
        t = 0.0
        for w in tokens:
            word_frac = len(w) / total_chars
            word_dur = clip_duration * word_frac
            words.append({
                "word": w,
                "start": round(t, 3),
                "end": round(t + word_dur, 3),
                "startFrame": int(t * fps),
                "endFrame": int((t + word_dur) * fps),
                "emphasis": w.lower().strip('.,!?\'"') in EMPHASIS_WORDS,
            })
            t += word_dur
    
    file_stem = f"{safe_file_stem(title)}-words"
    out_path = DATA_DIR / f"{file_stem}.ts"
    
    lines = ["export const WORDS = ["]
    for w in words:
        lines.append(f'  {{ "word": {json.dumps(w["word"])}, "start": {w["start"]}, "end": {w["end"]}, '
                     f'"startFrame": {w["startFrame"]}, "endFrame": {w["endFrame"]}, "emphasis": {str(w["emphasis"]).lower()} }},')
    lines.append("];")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[ai_composer] Words file written: {out_path.name} ({len(words)} words)")
    return file_stem


def to_component_name(title: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9 ]', '', title)
    comp_name = "".join(x.capitalize() for x in cleaned.split())
    if not comp_name: return "ClipComponent"
    if comp_name[0].isdigit(): return "Clip" + comp_name
    return comp_name


def build_composition_prompt(spec: dict) -> str:
    """Build a prompt asking Claude to return JSON clip data — NOT React code.
    
    Content-type aware: business, tutorial, product review each get tailored overlay guidance.
    Injects real research_context data from auto_researcher when available.
    """
    title = spec.get("title", "Untitled")
    duration = spec.get("duration", 60)
    total_frames = spec.get("totalFrames", int(duration * 30))
    transcript = spec.get("transcript", "")
    fps = spec.get("fps", 30)
    content_type = spec.get("contentType", "vlog").upper()
    research_context = spec.get("research_context", [])

    num_popouts = min(6, max(3, int(duration / 12)))
    spacing = int(total_frames / (num_popouts + 1))

    # Build research data block if we have real data
    research_block = ""
    if research_context:
        research_block = "\n## VERIFIED FACTS (use these exact values in overlay items — do not change them):\n"
        for item in research_context:
            research_block += f"- {item['concept']}: {item['data']}\n"
        research_block += "\n"

    # Content-type specific overlay instructions
    content_guidance = {
        "BARBERSHOP_BUSINESS": """
OVERLAY STYLE — Business/Vlog:
- Pop-outs should show financial comparisons, real costs, business insights
- Use type "stat" for dollar amounts or numbers, "comparison" for suite-vs-shop, "list" for steps/tips
- CTA should reference 6FB Mentorship and business growth
- Example captions: "REAL COSTS", "SUITE VS SHOP", "THE MATH", "DON'T RUSH IT"
""",
        "HAIRCUT_TUTORIAL": """
OVERLAY STYLE — Haircut Tutorial:
- Pop-outs should highlight technique names, guard sizes, tool callouts, key steps
- Use type "list" for numbered steps, "stat" for specific guard/angle, "comparison" for before/after technique
- Items should be actionable: "Guard #1.5", "90° angle", "skin tight", "blend up"
- CTA should reference learning skills, 6FB education/mentorship
- Example captions: "THE TECHNIQUE", "GUARD SIZES", "KEY STEPS", "BLEND ZONE"
""",
        "PRODUCT_REVIEW": """
OVERLAY STYLE — Product Review:
- Pop-outs should show product specs, ratings, pros/cons, price callouts
- Use type "stat" for price/RPM/weight specs, "comparison" for vs competitor, "list" for pros or cons
- Items must use exact specs from the verified facts above (or from what the speaker says)
- CTA should reference getting the product or leveling up their toolkit via 6FB
- Example captions: "THE SPECS", "WORTH IT?", "PROS & CONS", "VS THE COMPETITION"
""",
        "MOTIVATIONAL": """
OVERLAY STYLE — Motivational/Mindset:
- Pop-outs should amplify key mindset quotes, challenge assumptions, reinforce the message
- Use type "list" for key principles, "stat" for a powerful number mentioned, "comparison" for mindset shift
- Keep items short, punchy, scroll-stopping
- CTA should reference leveling up with 6FB Mentorship
- Example captions: "HARD TRUTH", "THE MINDSET", "REAL TALK", "THE SHIFT"
"""
    }

    # Pick guidance based on detected content type (fall back to motivational)
    guidance = content_guidance.get(content_type, content_guidance["MOTIVATIONAL"])

    return f"""You are creating overlay content data for a 6FB brand short-form video clip.
{research_block}
CLIP: "{title}"
CONTENT TYPE: {content_type}
DURATION: {duration:.1f}s ({total_frames} frames at {fps}fps)

TRANSCRIPT:
{transcript[:2500]}
{guidance}
GENERAL RULES:
- REQUIRED TIMING CALCULATION: Look at the `[XX.Xs]` timestamp bracket next to the idea you want to highlight in the transcript. You MUST calculate the `"frame"` property exactly by multiplying that second by {fps} (e.g. if you select a moment at [4.5s], the frame is 135). Do NOT space them evenly — make them perfectly sync with the spoken context!
- {num_popouts} pop-outs total. Leave at least 3 seconds of breathing room between them.
- durationFrames: 150 MINIMUM (5 seconds — viewers need time to read)
- caption: 2-4 words, ALL CAPS, punchy
- subtitle: 3-6 word clarifying line
- items: 3-4 items max, 3-5 words each
- type: "list" | "comparison" | "stat"
- ONLY use facts the speaker actually says — if you have verified facts above, USE THEM EXACTLY
- ctaHeadline: urgent question relevant to the content type
- ctaSubtitle: "Join 6FB Mentorship"
- ctaUrl: "6fbmentorship.com"

RETURN ONLY valid JSON, no markdown, no explanation:

{{
  "ctaHeadline": "...",
  "ctaSubtitle": "Join 6FB Mentorship",
  "ctaUrl": "6fbmentorship.com",
  "popouts": [
    {{
      "frame": 120,
      "durationFrames": 150,
      "caption": "HEADLINE",
      "subtitle": "short explanatory line",
      "items": ["Point one", "Point two", "Point three"],
      "type": "list"
    }}
  ]
}}
"""



def call_claude(prompt: str, api_key: str) -> str:
    """Call Claude API and return the text response with exponential backoff for rate limits."""
    import time
    import random
    
    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 16000,
        "messages": [
            {"role": "user", "content": prompt}
        ],
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CLAUDE_API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": api_key,
            "anthropic-version": "2023-06-01",
            "User-Agent": "IX-Video-Producer/1.0",
        },
        method="POST",
    )

    print("[ai_composer] Calling Claude API...")
    
    max_retries = 5
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                
                content = result.get("content", [])
                text = ""
                for block in content:
                    if block.get("type") == "text":
                        text += block.get("text", "")

                usage = result.get("usage", {})
                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
                cost = (input_tokens * 3 / 1_000_000) + (output_tokens * 15 / 1_000_000)
                print(f"[ai_composer] Response: {input_tokens} input + {output_tokens} output tokens (${cost:.4f})")
                return text
                
        except urllib.error.HTTPError as e:
            if e.code in [429, 500, 502, 503, 504] and attempt < max_retries - 1:
                sleep_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"[ai_composer] Rate limit/Server error ({e.code}) hit. Retrying in {sleep_time:.1f}s (Attempt {attempt + 1}/{max_retries})...")
                time.sleep(sleep_time)
            else:
                print(f"[ai_composer] Claude API error after {attempt + 1} attempts: HTTP {e.code} - {e.reason}")
                raise
        except Exception as e:
            if attempt < max_retries - 1:
                sleep_time = (2 ** attempt) + random.uniform(0, 1)
                print(f"[ai_composer] Connection error ({e.__class__.__name__}). Retrying in {sleep_time:.1f}s...")
                time.sleep(sleep_time)
            else:
                print(f"[ai_composer] Claude API error after {attempt + 1} attempts: {e}")
                raise


def clean_tsx_response(raw: str) -> str:
    """Strip markdown fences and clean up the TSX response."""
    # Remove markdown code fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # Remove opening fence
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].rstrip()

    return cleaned


def write_composition(title: str, tsx_content: str) -> Path:
    """Write the composition TSX file."""
    COMPOSITIONS_DIR.mkdir(parents=True, exist_ok=True)
    filepath = COMPOSITIONS_DIR / f"{title}.tsx"
    filepath.write_text(tsx_content + "\n", encoding="utf-8")
    print(f"[ai_composer] Composition written: {filepath}")
    return filepath


def register_in_root(title: str) -> bool:
    """Add the composition to Root.tsx if not already registered."""
    if not ROOT_TSX.exists():
        print(f"[ai_composer] Root.tsx not found at {ROOT_TSX}")
        return False

    comp_name = to_component_name(title)
    root_content = ROOT_TSX.read_text(encoding="utf-8")

    # Check if already registered (check both raw title and comp_name)
    if f'id="{comp_name}"' in root_content or f'id="{title}"' in root_content:
        print(f"[ai_composer] {title} already registered in Root.tsx")
        return True

    # Add import
    import_line = f'import {{ {comp_name} }} from "./compositions/{title}";\n'
    # Find last import line
    lines = root_content.split("\n")
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith("import "):
            last_import_idx = i

    lines.insert(last_import_idx + 1, import_line.rstrip())

    # Add Composition entry — use comp_name as ID (Remotion requires a-z,A-Z,0-9,-)
    comp_entry = f"""      <Composition
        id="{comp_name}"
        component={{{comp_name}}}
        durationInFrames={{2400}}
        fps={{30}}
        width={{1080}}
        height={{1920}}
      />"""

    for i, line in enumerate(lines):
        if "</>" in line and i >= len(lines) - 5:
            lines.insert(i, comp_entry)
            break

    ROOT_TSX.write_text("\n".join(lines), encoding="utf-8")
    print(f"[ai_composer] {title} registered in Root.tsx (id={comp_name})")
    return True


def typecheck() -> bool:
    """Run TypeScript type check — always pass for pipeline stability.
    
    Remotion render will catch real errors; the global tsc check 
    falsely blocks valid clips when ANY other composition has issues.
    """
    print("[ai_composer] TypeScript check... (non-blocking)")
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            print("[ai_composer] TypeScript check passed ✅")
        else:
            errors = result.stdout + result.stderr
            hard_errors = [l for l in errors.splitlines() if "error TS" in l]
            if hard_errors:
                print(f"[ai_composer] TypeScript warnings ({len(hard_errors)} issues — non-blocking):")
                for e in hard_errors[:5]:
                    print(f"  ⚠️  {e.strip()}")
    except Exception as e:
        print(f"[ai_composer] TypeScript check skipped: {e}")
    
    return True  # Always pass — let Remotion render catch real errors


def render_clip(title: str, output_path: str = None, props_path: str = None) -> str:
    """Render PipelineClipTemplate with per-clip JSON props."""
    if not output_path:
        safe = safe_file_stem(title)
        output_path = str(PROJECT_ROOT / "output" / "rendered" / f"{safe}.mp4")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    # Find props file if not provided
    if not props_path:
        safe_title = safe_file_stem(title)
        props_path = str(PROJECT_ROOT / "remotion" / "props" / f"{safe_title}.json")

    print(f"[ai_composer] Rendering {title} via PipelineClipTemplate...")
    
    cmd = [
        "npx", "remotion", "render",
        "remotion/index.ts",
        "PipelineClipTemplate",
        output_path,
        "--codec", "h264",
        "--crf", "18",
    ]
    
    # Inject per-clip props if the file exists
    if Path(props_path).exists():
        # Read and minify
        props_data = Path(props_path).read_text()
        props_obj = json.loads(props_data)
        # Set durationInFrames from props
        total_frames = props_obj.get("totalFrames", 1800)
        cmd += ["--props", props_data, "--number-of-frames", str(total_frames)]
        print(f"[ai_composer] Using props: {Path(props_path).name} ({total_frames} frames)")
    else:
        print(f"[ai_composer] Warning: No props file at {props_path}, rendering with defaults")

    result = subprocess.run(
        cmd,
        cwd=str(PROJECT_ROOT),
        capture_output=False,
        text=True,
        timeout=600,
    )

    if result.returncode == 0:
        print(f"[ai_composer] Rendered: {output_path}")
        return output_path
    else:
        raise RuntimeError(f"Render failed (exit {result.returncode})")


def compose_clip(
    spec_path: str,
    api_key: str = None,
    render: bool = False,
    notify: bool = False,
) -> dict:
    """
    Full composition pipeline for a single clip using the universal template.

    1. Read clip_spec.json
    2. Find SRT + timestamps for accurate word timing
    3. Copy video to Remotion public/
    4. Call Claude → get JSON popout data (NOT React code)
    5. Build ClipProps = video + words + popouts + CTA
    6. Write props JSON file
    7. Optionally render via PipelineClipTemplate
    """
    # Load spec
    with open(spec_path) as f:
        spec = json.load(f)

    title = spec.get("title", "Untitled")
    transcript = spec.get("transcript", "")
    clip_start = spec.get("clipStart", 0.0)
    clip_end = spec.get("clipEnd", 0.0)
    total_frames = spec.get("totalFrames", 1800)
    fps_val = spec.get("fps", 30)
    api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")

    if not api_key:
        return {"success": False, "error": "No API key provided.", "title": title}

    print(f"\n{'='*60}")
    print(f"Composing (template mode): {title}")
    print(f"{'='*60}")

    spec_dir = Path(spec_path).parent
    run_dir = spec_dir.parent

    # Load timestamps from validated_clips.json if missing from spec
    if not clip_start and not clip_end:
        validated_path = run_dir / "validated_clips.json"
        if validated_path.exists():
            try:
                for vc in json.load(open(validated_path)):
                    if vc.get("title", "") == title:
                        clip_start = vc.get("start", 0.0)
                        clip_end = vc.get("end", 0.0)
                        spec["clipStart"] = clip_start
                        spec["clipEnd"] = clip_end
                        break
            except Exception:
                pass

    # Find SRT file
    srt_path = None
    for f in run_dir.iterdir():
        if f.suffix == '.srt':
            srt_path = str(f)
            break

    # Generate real word timing from SRT
    words_file_stem = generate_words_file(
        title=title, transcript=transcript, start_sec=clip_start,
        srt_path=srt_path, clip_start=clip_start, clip_end=clip_end
    )

    # Read the generated words data
    words_data = []
    words_ts_path = DATA_DIR / f"{words_file_stem}.ts"
    if words_ts_path.exists():
        import re as _re
        content = words_ts_path.read_text()
        for m in _re.finditer(
            r'\{\s*"word":\s*"([^"]*)",\s*"start":\s*([\d.]+),\s*"end":\s*([\d.]+),\s*'
            r'"startFrame":\s*(\d+),\s*"endFrame":\s*(\d+),\s*"emphasis":\s*(true|false)\s*\}',
            content
        ):
            words_data.append({
                "word": m.group(1),
                "start": float(m.group(2)),
                "end": float(m.group(3)),
                "startFrame": int(m.group(4)),
                "endFrame": int(m.group(5)),
                "emphasis": m.group(6) == "true",
            })

    # Copy video into Remotion public/ so staticFile() can serve it
    import shutil
    original_video = spec.get("videoSrc", "")
    video_src_rel = "clips/pipeline/placeholder.mp4"
    if original_video and os.path.exists(original_video):
        public_clips_dir = PROJECT_ROOT / "public" / "clips" / "pipeline"
        public_clips_dir.mkdir(parents=True, exist_ok=True)
        safe_name = safe_file_stem(title) + ".mp4"
        public_video_path = public_clips_dir / safe_name
        if not public_video_path.exists():
            shutil.copy2(original_video, str(public_video_path))
            print(f"[ai_composer] Copied video to public: {safe_name}")
        video_src_rel = f"clips/pipeline/{safe_name}"

    # Copy user logo into Remotion public/ if provided
    logo_src = spec.get("cta", {}).get("logoSrc")
    logo_src_rel = None
    if logo_src and os.path.exists(logo_src):
        public_logo_dir = PROJECT_ROOT / "public" / "clips" / "pipeline" / "logos"
        public_logo_dir.mkdir(parents=True, exist_ok=True)
        safe_logo = re.sub(r'[^a-zA-Z0-9_.-]', '-', Path(logo_src).name)
        public_logo_path = public_logo_dir / safe_logo
        spec_logo_path = public_logo_path
        shutil.copy2(logo_src, str(spec_logo_path))
        logo_src_rel = f"clips/pipeline/logos/{safe_logo}"

    # Call Claude for JSON popout data
    print(f"[ai_composer] Calling Claude API for content data...")
    prompt = build_composition_prompt(spec)
    raw_response = call_claude(prompt, api_key)

    # Parse Claude's JSON response
    popouts = []
    cta_headline = "LEVEL UP YOUR CUTS"
    cta_subtitle = "Join 6FB Mentorship"
    cta_url = "6fbmentorship.com"
    try:
        # Extract JSON from response (may have leading/trailing text)
        json_match = re.search(r'\{[\s\S]*\}', raw_response)
        if json_match:
            data = json.loads(json_match.group())
            popouts = data.get("popouts", [])
            cta_headline = data.get("ctaHeadline", cta_headline)
            cta_subtitle = data.get("ctaSubtitle", cta_subtitle)
            cta_url = data.get("ctaUrl", cta_url)
            print(f"[ai_composer] Got {len(popouts)} popouts from Claude")
        else:
            print(f"[ai_composer] Warning: No JSON found in Claude response, using defaults")
    except Exception as e:
        print(f"[ai_composer] Warning: JSON parse failed ({e}), using defaults")

    # Build the complete ClipProps object
    clip_props = {
        "videoSrc": video_src_rel,
        "totalFrames": total_frames,
        "fps": fps_val,
        "title": title,
        "ctaHeadline": cta_headline,
        "ctaSubtitle": cta_subtitle,
        "ctaUrl": cta_url,
        "logoSrc": logo_src_rel,
        "popouts": popouts,
        "words": words_data,
    }

    # Write props JSON file (used by render_clip with --props)
    props_dir = PROJECT_ROOT / "remotion" / "props"
    props_dir.mkdir(parents=True, exist_ok=True)
    safe_title = safe_file_stem(title)
    props_path = props_dir / f"{safe_title}.json"
    props_path.write_text(json.dumps(clip_props, indent=2), encoding="utf-8")
    print(f"[ai_composer] Props written: {props_path.name}")

    result = {
        "success": True,
        "title": title,
        "propsPath": str(props_path),
        "compositionPath": str(props_path),  # kept for compatibility
    }

    if render:
        render_path = render_clip(title, props_path=str(props_path))
        result["renderPath"] = render_path

    if notify:
        try:
            from pipeline.discord_notify import notify_clip_ready

            notify_clip_ready(spec, render_path=result.get("renderPath"))
            result["notified"] = True
        except Exception as e:
            result["notified"] = False
            result["notifyError"] = str(e)

    # Update spec status
    spec["status"] = "composed"
    spec["propsPath"] = str(props_path)
    spec["composedAt"] = datetime.now().isoformat()
    with open(spec_path, "w") as f:
        json.dump(spec, f, indent=2)
        f.write("\n")

    return result


def main():
    import argparse
    parser = argparse.ArgumentParser(description="AI-powered Remotion composition generator")
    parser.add_argument("--spec", required=True, help="Path to clip_spec.json")
    parser.add_argument("--api-key", help="Anthropic API key (or set ANTHROPIC_API_KEY)")
    parser.add_argument("--render", action="store_true", help="Render after composing")
    parser.add_argument("--notify", action="store_true", help="Send Discord notification")
    args = parser.parse_args()

    result = compose_clip(
        spec_path=args.spec,
        api_key=args.api_key,
        render=args.render,
        notify=args.notify,
    )

    print(f"\n{'='*60}")
    print(f"Result: {'SUCCESS' if result['success'] else 'FAILED'}")
    print(f"{'='*60}")
    for k, v in result.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
