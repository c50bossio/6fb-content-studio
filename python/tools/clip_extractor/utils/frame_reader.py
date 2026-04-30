"""OpenCV-based frame extraction with adaptive sampling."""

from typing import Generator

import cv2
import numpy as np


def read_frames(
    video_path: str,
    sample_rate: int = 6,
    start_frame: int = 0,
    end_frame: int | None = None,
) -> Generator[tuple[int, np.ndarray], None, None]:
    """Yield (frame_index, frame) tuples at the given sample rate.

    Args:
        video_path: Path to the video file.
        sample_rate: Process every Nth frame. 1 = every frame.
        start_frame: First frame to read.
        end_frame: Last frame to read (None = read to end).

    Yields:
        (frame_index, frame_bgr) tuples for sampled frames.
    """
    if sample_rate <= 0:
        raise ValueError("sample_rate must be greater than 0")
    if start_frame < 0:
        raise ValueError("start_frame must be greater than or equal to 0")
    if end_frame is not None and end_frame < start_frame:
        raise ValueError("end_frame must be greater than or equal to start_frame")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if end_frame is None:
            end_frame = total

        frame_idx = start_frame
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        while frame_idx < end_frame:
            ret, frame = cap.read()
            if not ret:
                break

            if (frame_idx - start_frame) % sample_rate == 0:
                yield frame_idx, frame

            frame_idx += 1
    finally:
        cap.release()


def extract_single_frame(video_path: str, frame_index: int) -> np.ndarray:
    """Extract a single frame from a video file."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ret, frame = cap.read()
        if not ret:
            raise RuntimeError(f"Cannot read frame {frame_index} from {video_path}")
        return frame
    finally:
        cap.release()


def interpolate_positions(
    sampled: dict[int, tuple[float, float]],
    total_frames: int,
    method: str = "cubic",
) -> dict[int, tuple[float, float]]:
    """Interpolate crop positions for frames between samples.

    Args:
        sampled: {frame_index: (x, y)} for sampled frames.
        total_frames: Total number of frames in the video.
        method: "linear", "cubic", or "nearest".

    Returns:
        {frame_index: (x, y)} for ALL frames.
    """
    if not sampled:
        return {}
    if total_frames <= 0:
        return {}
    if method not in {"linear", "cubic", "nearest"}:
        raise ValueError("method must be one of: linear, cubic, nearest")

    indices = sorted(sampled.keys())
    xs = np.array([sampled[i][0] for i in indices])
    ys = np.array([sampled[i][1] for i in indices])

    all_frames = np.arange(total_frames)

    if method == "nearest" or len(indices) < 2:
        index_array = np.array(indices)
        positions = np.searchsorted(index_array, all_frames, side="left")
        positions = np.clip(positions, 0, len(index_array) - 1)
        previous = np.maximum(positions - 1, 0)
        use_previous = (
            np.abs(all_frames - index_array[previous])
            <= np.abs(index_array[positions] - all_frames)
        )
        nearest = np.where(use_previous, previous, positions)
        interp_x = xs[nearest]
        interp_y = ys[nearest]
    elif method == "cubic" and len(indices) >= 4:
        from scipy.interpolate import interp1d

        fx = interp1d(indices, xs, kind="cubic", fill_value="extrapolate")
        fy = interp1d(indices, ys, kind="cubic", fill_value="extrapolate")
        interp_x = fx(all_frames)
        interp_y = fy(all_frames)
    else:
        # Linear fallback
        interp_x = np.interp(all_frames, indices, xs)
        interp_y = np.interp(all_frames, indices, ys)

    return {int(f): (float(interp_x[f]), float(interp_y[f])) for f in all_frames}
