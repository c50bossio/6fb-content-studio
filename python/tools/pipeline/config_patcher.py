"""Config Patcher — Safe, bounded, reversible config.yaml adjustments.

Maps diagnosed clip defects to specific config parameter tweaks.
Each patch is bounded (min/max limits), reversible (old value logged),
and tracked in the improvement ledger.

Usage:
    patcher = ConfigPatcher("tools/clip_extractor/config.yaml")
    patches = patcher.generate_patches(defects)
    patcher.apply_patches(patches)
    patcher.rollback()  # undo last patch set
"""

import copy
import json
import math
import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# Defect-to-config mapping with safe bounds
# Each entry: (yaml_path, direction, step, min_val, max_val)
DEFECT_PATCH_MAP = {
    "head_cut_off": {
        # top_pct oscillated and is frozen. Instead reduce vertical deadzone so the
        # tracker follows downward face movement faster, keeping headroom intact.
        "param": "deadzone.vertical_threshold_pct",
        "direction": "decrease",
        "step": 0.005,
        "min": 0.005,
        "max": 0.15,
        "description": "Reduce vertical deadzone so tracker follows face movement faster",
    },
    "too_much_headroom": {
        "param": "crop.padding.top_pct",
        "direction": "decrease",
        "step": 0.03,
        "min": 0.05,
        "max": 0.50,
        "description": "Decrease headroom above face",
    },
    "camera_jittery": {
        "param": "smoothing.kalman.process_noise",
        "direction": "decrease",
        "step_factor": 0.5,  # multiply by 0.5 (halve)
        "min": 0.001,  # relaxed from 0.003 — was stuck at floor
        "max": 0.1,
        "description": "Reduce Kalman process noise for smoother tracking",
    },
    "face_tracking_lost": {
        # Remapped from detection.face.min_confidence (was stuck at 0.45 floor).
        # Lower measurement_noise → filter trusts face measurements more →
        # snaps back to face faster when tracking recovers after occlusion.
        "param": "smoothing.kalman.measurement_noise",
        "direction": "decrease",
        "step_factor": 0.75,
        "min": 0.02,
        "max": 0.2,
        "description": "Lower Kalman measurement noise for more responsive face tracking",
    },
    # face_padding_pct locked at 1.105 — optimal value determined by sprint analysis.
    # crop_too_tight re-routed to bottom_pct (avoids conflict with frozen top_pct/y_target).
    "crop_too_tight": {
        "param": "crop.padding.bottom_pct",
        "direction": "increase",
        "step": 0.03,
        "min": 0.10,
        "max": 0.80,
        "description": "Increase bottom padding to widen crop frame around face",
    },
    "multi_speaker_missed": {
        # Lower switch_threshold so the tracker yields to the active speaker sooner.
        # mode:primary stays — split_screen layout is the wrong fix for in-car podcasts;
        # easier switching within primary mode is less disruptive and still recoverable.
        "param": "speakers.switch_threshold",
        "direction": "decrease",
        "step": 0.02,
        "min": 0.01,
        "max": 0.5,
        "description": "Lower speaker-switch threshold so tracker yields to active speaker sooner",
    },
    "deadzone_too_sticky": {
        "param": "deadzone.threshold_pct",
        "direction": "decrease",
        "step": 0.01,
        "min": 0.01,
        "max": 0.15,
        "description": "Reduce deadzone to allow more responsive tracking",
    },
    "deadzone_too_loose": {
        "param": "deadzone.threshold_pct",
        "direction": "increase",
        "step": 0.01,
        "min": 0.01,
        "max": 0.15,
        "description": "Increase deadzone to reduce camera drift",
    },
    "ending_mid_sentence": {
        "param": "selection.ending_search_window_sec",
        "direction": "increase",
        "step": 1.0,
        "min": 3.0,
        "max": 25.0,
        "description": "Widen ending search window to find complete sentence endings",
    },
    "hook_starts_mid_sentence": {
        "param": "selection.hook_search_window_sec",
        "direction": "increase",
        "step": 1.0,
        "min": 5.0,
        "max": 30.0,
        "description": "Widen hook search window to find clean sentence starts",
    },
    "face_position_too_high": {
        "param": "crop.face_position.y_target",
        "direction": "increase",
        "step": 0.03,
        "min": 0.25,
        "max": 0.55,
        "description": "Move face target lower in frame",
    },
    "face_position_too_low": {
        "param": "crop.face_position.y_target",
        "direction": "decrease",
        "step": 0.03,
        "min": 0.25,
        "max": 0.55,
        "description": "Move face target higher in frame",
    },
}

# Defects that require code review, not config patches.
# These are boundary/content/overlay issues that config.yaml changes cannot fix.
NON_PATCHABLE_DEFECTS = frozenset({
    "dead_air",
    "content_too_long",
    "content_too_short",
    "overlay_timing_off",
    "overlay_missing",
    "caption_desync",
})


def _get_nested(d: dict, path: str) -> Any:
    """Get a value from a nested dict using dot notation."""
    keys = path.split(".")
    for key in keys:
        if not isinstance(d, dict) or key not in d:
            return None
        d = d[key]
    return d


def _set_nested(d: dict, path: str, value: Any):
    """Set a value in a nested dict using dot notation."""
    keys = path.split(".")
    for key in keys[:-1]:
        if key not in d:
            d[key] = {}
        d = d[key]
    d[keys[-1]] = value


class ConfigPatch:
    """A single config parameter adjustment."""

    def __init__(
        self,
        param_path: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        defect_id: str,
    ):
        self.param_path = param_path
        self.old_value = old_value
        self.new_value = new_value
        self.reason = reason
        self.defect_id = defect_id
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "param": self.param_path,
            "old": self.old_value,
            "new": self.new_value,
            "reason": self.reason,
            "defect": self.defect_id,
            "timestamp": self.timestamp,
        }

    def __repr__(self):
        return f"{self.param_path}: {self.old_value} → {self.new_value} ({self.reason})"


class ConfigPatcher:
    """Safe, bounded config.yaml patcher with rollback support."""

    def __init__(self, config_path: str):
        self.config_path = Path(config_path)
        self.history_dir = self.config_path.parent / ".config_history"
        self.history_dir.mkdir(parents=True, exist_ok=True)

        with open(self.config_path, "r") as f:
            self.config = yaml.safe_load(f)

        self._patch_history: list[list[ConfigPatch]] = []
        # Oscillation detection: list of (param_path, direction, iteration)
        self._direction_history: list[tuple[str, str, int]] = []
        self._frozen_params: set[str] = set()
        self._iteration_counter: int = 0

    def generate_patches(self, defects: list[dict]) -> list[ConfigPatch]:
        """Generate config patches from a list of diagnosed defects.

        Args:
            defects: List of dicts with at least {"defect_id": str, "severity": float}

        Returns:
            List of ConfigPatch objects ready to apply.
        """
        self._iteration_counter += 1
        self.detect_oscillations()

        patches = []
        seen_params = set()  # avoid conflicting patches to the same param

        for defect in defects:
            defect_id = defect.get("defect_id", "")
            try:
                severity = float(defect.get("severity", 0.5))
            except (TypeError, ValueError):
                severity = 0.5
            if not math.isfinite(severity):
                severity = 0.5
            severity = max(0.0, min(1.0, severity))

            # Skip non-patchable defects (need code review, not config changes)
            if defect_id in NON_PATCHABLE_DEFECTS:
                continue

            if defect_id not in DEFECT_PATCH_MAP:
                continue

            mapping = DEFECT_PATCH_MAP[defect_id]
            param_path = mapping["param"]

            # Skip if we already have a patch for this parameter
            if param_path in seen_params:
                continue

            # Skip frozen parameters (oscillation detected)
            if param_path in self._frozen_params:
                print(f"  [patcher] Skipping frozen param: {param_path}")
                continue

            current_value = _get_nested(self.config, param_path)
            if current_value is None:
                print(f"  ⚠️ [patcher] Config key not found: {param_path}")
                continue

            # Calculate new value
            if "step_factor" in mapping:
                # Multiplicative adjustment
                if mapping["direction"] == "decrease":
                    new_value = current_value * mapping["step_factor"]
                else:
                    new_value = current_value / mapping["step_factor"]
            else:
                # Additive adjustment (scale by severity)
                step = mapping["step"] * severity
                if mapping["direction"] == "increase":
                    new_value = current_value + step
                else:
                    new_value = current_value - step

            # Clamp to bounds
            new_value = max(mapping["min"], min(mapping["max"], new_value))

            # Round to avoid floating point noise
            if isinstance(current_value, float):
                new_value = round(new_value, 6)

            # Skip if no meaningful change
            if abs(new_value - current_value) < 1e-6:
                continue

            patches.append(ConfigPatch(
                param_path=param_path,
                old_value=current_value,
                new_value=new_value,
                reason=mapping["description"],
                defect_id=defect_id,
            ))
            seen_params.add(param_path)

            # Record direction for oscillation detection
            self._direction_history.append(
                (param_path, mapping["direction"], self._iteration_counter)
            )

        return patches

    def apply_patches(self, patches: list[ConfigPatch]) -> None:
        """Apply patches to config.yaml and save a backup."""
        if not patches:
            print("  [patcher] No patches to apply.")
            return

        # Save backup
        backup_name = f"config_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.yaml"
        backup_path = self.history_dir / backup_name
        with open(backup_path, "w") as f:
            yaml.dump(self.config, f, default_flow_style=False)
        print(f"  [patcher] Backup saved: {backup_path}")

        # Apply patches
        for patch in patches:
            _set_nested(self.config, patch.param_path, patch.new_value)
            print(f"  ✅ [patcher] {patch}")

        # Write updated config
        with open(self.config_path, "w") as f:
            yaml.dump(self.config, f, default_flow_style=False)

        self._patch_history.append(patches)
        print(f"  [patcher] Applied {len(patches)} patches to {self.config_path}")

    def rollback(self) -> bool:
        """Undo the last set of patches."""
        if not self._patch_history:
            print("  [patcher] Nothing to roll back.")
            return False

        last_patches = self._patch_history.pop()
        for patch in last_patches:
            _set_nested(self.config, patch.param_path, patch.old_value)
            print(f"  ↩️ [patcher] Rolled back: {patch.param_path} → {patch.old_value}")

        with open(self.config_path, "w") as f:
            yaml.dump(self.config, f, default_flow_style=False)

        print(f"  [patcher] Rolled back {len(last_patches)} patches")
        return True

    def detect_oscillations(self, window: int = 5) -> set[str]:
        """Check for parameters patched in opposing directions within the last `window` iterations.

        If a parameter has been patched with both "increase" and "decrease" directions
        within the window, it is frozen to prevent infinite oscillation.

        Returns:
            Set of newly frozen parameter paths.
        """
        cutoff = self._iteration_counter - window
        recent = [
            (param, direction)
            for param, direction, iteration in self._direction_history
            if iteration > cutoff
        ]

        # Group directions by param
        param_directions: dict[str, set[str]] = {}
        for param, direction in recent:
            param_directions.setdefault(param, set()).add(direction)

        newly_frozen = set()
        for param, directions in param_directions.items():
            if "increase" in directions and "decrease" in directions:
                if param not in self._frozen_params:
                    self._frozen_params.add(param)
                    newly_frozen.add(param)
                    print(f"  [patcher] Oscillation detected — freezing: {param}")

        return newly_frozen

    def get_frozen_params(self) -> set[str]:
        """Return the set of currently frozen parameter paths."""
        return set(self._frozen_params)

    def get_patch_summary(self, patches: list[ConfigPatch]) -> list[str]:
        """Human-readable summary of patches for the ledger."""
        return [f"{p.param_path}: {p.old_value} → {p.new_value}" for p in patches]
