#!/usr/bin/env python3
"""
Discord Notifier — Sends clip-ready notifications to Discord.

Fires when a clip finishes rendering (or when a clip_spec needs
custom illustration work). Embeds preview link, pop-out summary,
and flags any pop-outs that need manual attention.

Usage:
    python3 tools/pipeline/discord_notify.py \
        --spec output/clips/miami-vlog/clip-04-spec.json \
        --rendered output/clips/miami-vlog/clip-04.mp4 \
        --serve-url "http://localhost:8898/clip-04.mp4"

    # Or just notify about spec needing AI composition:
    python3 tools/pipeline/discord_notify.py \
        --spec output/clips/miami-vlog/clip-04-spec.json \
        --status needs_composition

Env: DISCORD_WEBHOOK_URL (required)
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
from datetime import datetime


WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# Brand colors for embed sidebar
BRAND_EMBED_COLORS = {
    "6fbarber": 0x00C851,      # neon green
    "pieaccounting": 0x6C5CE7, # purple
}


def send_webhook(payload: dict) -> bool:
    """Send a payload to the Discord webhook."""
    if not WEBHOOK_URL:
        print("[discord] DISCORD_WEBHOOK_URL not set — skipping notification")
        print(f"[discord] Would have sent: {json.dumps(payload, indent=2)[:500]}")
        return False

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "IX-Video-Producer/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 204):
                print(f"[discord] Notification sent successfully")
                return True
            else:
                print(f"[discord] Unexpected status: {resp.status}")
                return False
    except Exception as e:
        print(f"[discord] Failed to send: {e}")
        return False


def notify_clip_ready(spec: dict, render_path: str = None, serve_url: str = None):
    """Send a 'clip ready' notification with preview."""
    brand = spec.get("brand", "6fbarber")
    color = BRAND_EMBED_COLORS.get(brand, 0x888888)
    popouts = spec.get("popouts", [])
    duration = spec.get("duration", 0)

    # Pop-out summary
    popout_lines = []
    custom_needed = []
    for p in popouts:
        title = p.get("title", "Untitled")
        ts = p.get("timestamp_seconds", 0)
        popout_lines.append(f"`{ts:.0f}s` — **{title}**")
        if p.get("customRequired"):
            custom_needed.append(p)

    embed = {
        "title": f"🎬 Clip Ready: {spec.get('title', 'Untitled')}",
        "color": color,
        "fields": [
            {"name": "Brand", "value": spec.get("brand", "?"), "inline": True},
            {"name": "Duration", "value": f"{duration:.0f}s", "inline": True},
            {"name": "Pop-Outs", "value": str(len(popouts)), "inline": True},
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "footer": {"text": "IX Video Producer"},
    }

    if serve_url:
        embed["fields"].append({"name": "Preview", "value": f"[Watch]({serve_url})", "inline": False})

    if popout_lines:
        embed["fields"].append({
            "name": "Pop-Out Timeline",
            "value": "\n".join(popout_lines[:8]),
            "inline": False,
        })

    if custom_needed:
        embed["fields"].append({
            "name": "⚠️ Custom Illustration Needed",
            "value": "\n".join([f"Pop-out {p['id']}: **{p['title']}**" for p in custom_needed]),
            "inline": False,
        })

    if render_path:
        file_size = Path(render_path).stat().st_size / (1024 * 1024) if Path(render_path).exists() else 0
        embed["fields"].append({
            "name": "File", "value": f"`{Path(render_path).name}` ({file_size:.1f} MB)", "inline": True,
        })

    payload = {"embeds": [embed]}
    return send_webhook(payload)


def notify_spec_ready(spec: dict):
    """Send a 'spec needs composition' notification."""
    brand = spec.get("brand", "6fbarber")
    color = BRAND_EMBED_COLORS.get(brand, 0x888888)

    embed = {
        "title": f"📋 Clip Spec Ready: {spec.get('title', 'Untitled')}",
        "description": "Clip spec generated. Needs AI composition — custom illustrations will be generated for each pop-out.",
        "color": color,
        "fields": [
            {"name": "Brand", "value": brand, "inline": True},
            {"name": "Duration", "value": f"{spec.get('duration', 0):.0f}s", "inline": True},
            {"name": "Status", "value": spec.get("status", "unknown"), "inline": True},
            {"name": "Transcript Preview", "value": f"```{spec.get('transcript', '')[:200]}...```", "inline": False},
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "footer": {"text": "IX Video Producer"},
    }

    payload = {"embeds": [embed]}
    return send_webhook(payload)


def notify_error(clip_id: str, error_msg: str, brand: str = "6fbarber"):
    """Send an error notification."""
    color = 0xFF4444
    embed = {
        "title": f"❌ Pipeline Error: {clip_id}",
        "description": f"```{error_msg[:1000]}```",
        "color": color,
        "fields": [
            {"name": "Brand", "value": brand, "inline": True},
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "footer": {"text": "IX Video Producer"},
    }
    payload = {"embeds": [embed]}
    return send_webhook(payload)


def notify_sprint_complete(
    scores: dict,
    spend: float,
    budget: float,
    iterations: int,
    patches: int,
    target_score: float = 60.0,
):
    """Send a sprint completion summary to Discord.

    Args:
        scores: dict of {content_type: {"first": float, "latest": float, "delta": float}}
        spend: total session spend in USD
        budget: daily budget cap in USD
        iterations: number of iterations completed
        patches: total config patches applied
        target_score: the minimum passing average score (default 60/80)
    """
    if not scores:
        return False

    # Compute overall average latest score
    latests = [v.get("latest", 0) for v in scores.values() if v.get("latest", 0) > 0]
    overall_avg = sum(latests) / len(latests) if latests else 0
    passed = overall_avg >= target_score

    color = 0x00C851 if passed else 0xFF9900  # green if passed, amber if not

    # Build per-content-type score table
    rows = []
    for ctype, t in sorted(scores.items()):
        delta = t.get("delta", 0)
        latest = t.get("latest", 0)
        emoji = "🚀" if delta >= 5 else "📈" if delta > 0 else "📉"
        status = "✅" if latest >= target_score else "⚠️"
        rows.append(f"{status} `{ctype:16s}` {latest:.1f}/80  {emoji} {'+' if delta >= 0 else ''}{delta:.1f}")

    verdict = "✅ TARGET HIT" if passed else "⚠️ NEEDS MORE ITERATIONS"

    embed = {
        "title": f"🏁 Level 3 Sprint Complete — {verdict}",
        "description": "\n".join(rows) or "No scores recorded.",
        "color": color,
        "fields": [
            {"name": "Overall Average", "value": f"**{overall_avg:.1f} / 80**", "inline": True},
            {"name": "Target", "value": f"{target_score:.0f} / 80", "inline": True},
            {"name": "Iterations", "value": str(iterations), "inline": True},
            {"name": "Config Patches", "value": str(patches), "inline": True},
            {"name": "Spend", "value": f"${spend:.2f} / ${budget:.0f}", "inline": True},
            {
                "name": "Next Step",
                "value": "Run `bash run_production.sh` to generate final polished clips with overlays! 🎬"
                if passed
                else "Review `.learnings/ERRORS.md` and consider another sprint pass.",
                "inline": False,
            },
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "footer": {"text": "ClipQA AutoEvolver · 6FB Content Engine"},
    }

    payload = {"embeds": [embed]}
    return send_webhook(payload)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Send Discord notifications for video pipeline")
    parser.add_argument("--spec", required=True, help="Path to clip_spec.json")
    parser.add_argument("--rendered", help="Path to rendered .mp4")
    parser.add_argument("--serve-url", help="Preview URL")
    parser.add_argument("--status", choices=["ready", "needs_composition", "error"], default="ready")
    parser.add_argument("--error-msg", help="Error message (for status=error)")
    args = parser.parse_args()

    with open(args.spec) as f:
        spec = json.load(f)

    if args.status == "ready":
        notify_clip_ready(spec, args.rendered, args.serve_url)
    elif args.status == "needs_composition":
        notify_spec_ready(spec)
    elif args.status == "error":
        notify_error(spec.get("clipId", "?"), args.error_msg or "Unknown error", spec.get("brand", "6fbarber"))


if __name__ == "__main__":
    main()
