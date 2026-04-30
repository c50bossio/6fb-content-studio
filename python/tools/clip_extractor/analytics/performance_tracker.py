"""Performance tracker for clip selection feedback loop.

Tracks clip metadata alongside real engagement data from Zernio,
calculates correlation between internal scoring and actual performance,
and suggests scoring weight adjustments.

Usage:
    tracker = PerformanceTracker(output_dir="output/.analytics")

    # Log a clip when it's created
    tracker.log_clip(
        clip_id="clip-01",
        video_source="miami-vlog",
        brand="6fbarber",
        internal_scores={"hook": 18, "value": 19, "clarity": 18, "share": 19, "complete": 17},
        total_score=91,
        category="tactical",
        duration=58.0,
        title="six-figure-barbershop-minimum-price",
    )

    # Later, after posting, log engagement
    tracker.log_engagement(
        clip_id="clip-01",
        platform="instagram",
        metrics={"views": 1200, "likes": 89, "saves": 42, "shares": 18, "comments": 7},
        posted_at="2026-03-30T12:00:00Z",
    )

    # Analyze and get weight suggestions
    suggestions = tracker.analyze()
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


class PerformanceTracker:
    def __init__(self, output_dir: str = "output/.analytics"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.log_path = self.output_dir / "clip_performance_log.json"
        self.weights_path = self.output_dir / "scoring_weights.json"
        self._load()

    def _load(self):
        """Load existing performance log."""
        if self.log_path.exists():
            with open(self.log_path, "r") as f:
                self.log = json.load(f)
        else:
            self.log = {"clips": [], "experiments": [], "weight_history": []}

    def _save(self):
        """Persist performance log."""
        with open(self.log_path, "w") as f:
            json.dump(self.log, f, indent=2)

    def get_current_weights(self) -> Dict[str, float]:
        """Get current scoring weights. Default is equal (20 each)."""
        if self.weights_path.exists():
            with open(self.weights_path, "r") as f:
                return json.load(f)
        return {
            "hook_strength": 20,
            "value_delivery": 20,
            "clarity": 20,
            "shareability": 20,
            "completeness": 20,
            "version": "v1",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def save_weights(self, weights: Dict[str, float], reason: str = ""):
        """Save updated scoring weights and log the change."""
        weights["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Increment version
        current = self.get_current_weights()
        old_version = current.get("version", "v0")
        version_num = int(old_version.replace("v", "")) + 1
        weights["version"] = f"v{version_num}"

        with open(self.weights_path, "w") as f:
            json.dump(weights, f, indent=2)

        # Log weight change
        self.log["weight_history"].append({
            "from_version": old_version,
            "to_version": weights["version"],
            "weights": {k: v for k, v in weights.items() if k not in ("version", "updated_at")},
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        self._save()

    def log_clip(
        self,
        clip_id: str,
        video_source: str,
        brand: str,
        internal_scores: Dict[str, int],
        total_score: int,
        category: str,
        duration: float,
        title: str,
        weight_version: str = "v1",
    ):
        """Log a clip when it's created (before posting)."""
        entry = {
            "clip_id": clip_id,
            "video_source": video_source,
            "brand": brand,
            "title": title,
            "category": category,
            "duration": duration,
            "internal_scores": internal_scores,
            "total_score": total_score,
            "weight_version": weight_version,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "engagement": {},
            "posted": False,
        }

        # Check for duplicate
        existing = [c for c in self.log["clips"] if c["clip_id"] == clip_id]
        if existing:
            idx = self.log["clips"].index(existing[0])
            self.log["clips"][idx] = entry
        else:
            self.log["clips"].append(entry)

        self._save()
        print(f"[tracker] Logged clip: {clip_id} ({title}) — score {total_score}")

    def log_engagement(
        self,
        clip_id: str,
        platform: str,
        metrics: Dict[str, int],
        posted_at: str = "",
        zernio_post_id: str = "",
    ):
        """Log engagement data for a clip (after posting)."""
        clip = next((c for c in self.log["clips"] if c["clip_id"] == clip_id), None)
        if not clip:
            print(f"[tracker] Warning: clip {clip_id} not found in log")
            return

        clip["posted"] = True
        clip["posted_at"] = posted_at or datetime.now(timezone.utc).isoformat()
        clip["zernio_post_id"] = zernio_post_id
        clip["engagement"][platform] = {
            "metrics": metrics,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

        self._save()
        print(f"[tracker] Logged engagement for {clip_id} on {platform}: {metrics}")

    def analyze(self) -> Dict:
        """Analyze performance data and suggest weight adjustments.

        Returns dict with:
            - correlation: internal score vs engagement
            - top_performers: clips that beat their score prediction
            - underperformers: clips that scored high but performed poorly
            - suggestions: recommended weight changes
        """
        posted_clips = [c for c in self.log["clips"] if c.get("posted") and c.get("engagement")]

        if len(posted_clips) < 3:
            return {
                "status": "insufficient_data",
                "clips_tracked": len(self.log["clips"]),
                "clips_with_engagement": len(posted_clips),
                "message": f"Need at least 3 clips with engagement data. Currently have {len(posted_clips)}.",
            }

        # Calculate engagement scores (normalize across metrics)
        for clip in posted_clips:
            total_engagement = 0
            for platform, data in clip["engagement"].items():
                m = data["metrics"]
                # Weighted engagement: saves/shares worth more than likes
                total_engagement += (
                    m.get("views", 0) * 0.1 +
                    m.get("likes", 0) * 1 +
                    m.get("saves", 0) * 3 +
                    m.get("shares", 0) * 5 +
                    m.get("comments", 0) * 2
                )
            clip["_engagement_score"] = total_engagement

        # Sort by engagement
        posted_clips.sort(key=lambda c: c["_engagement_score"], reverse=True)

        # Find mismatches between internal score and real engagement
        top_performers = []
        underperformers = []

        if len(posted_clips) >= 3:
            median_score = sorted(c["total_score"] for c in posted_clips)[len(posted_clips) // 2]
            median_engagement = sorted(c["_engagement_score"] for c in posted_clips)[len(posted_clips) // 2]

            for clip in posted_clips:
                if clip["total_score"] < median_score and clip["_engagement_score"] > median_engagement:
                    top_performers.append({
                        "clip_id": clip["clip_id"],
                        "title": clip["title"],
                        "internal_score": clip["total_score"],
                        "engagement_score": clip["_engagement_score"],
                        "category": clip["category"],
                        "scores": clip["internal_scores"],
                    })
                elif clip["total_score"] > median_score and clip["_engagement_score"] < median_engagement:
                    underperformers.append({
                        "clip_id": clip["clip_id"],
                        "title": clip["title"],
                        "internal_score": clip["total_score"],
                        "engagement_score": clip["_engagement_score"],
                        "category": clip["category"],
                        "scores": clip["internal_scores"],
                    })

        # Generate weight adjustment suggestions
        suggestions = []
        if top_performers:
            # What do top performers have that underperformers don't?
            for tp in top_performers:
                for up in underperformers:
                    for score_key in tp["scores"]:
                        tp_val = tp["scores"].get(score_key, 0)
                        up_val = up["scores"].get(score_key, 0)
                        if tp_val > up_val + 3:
                            suggestions.append(
                                f"Consider increasing weight for '{score_key}' — "
                                f"top performer '{tp['title']}' scored {tp_val} vs "
                                f"underperformer '{up['title']}' at {up_val}"
                            )

        result = {
            "status": "analyzed",
            "clips_tracked": len(self.log["clips"]),
            "clips_with_engagement": len(posted_clips),
            "top_performers": top_performers,
            "underperformers": underperformers,
            "suggestions": suggestions,
            "current_weights": self.get_current_weights(),
        }

        # Save analysis
        analysis_path = self.output_dir / "latest_analysis.json"
        with open(analysis_path, "w") as f:
            json.dump(result, f, indent=2)

        return result
