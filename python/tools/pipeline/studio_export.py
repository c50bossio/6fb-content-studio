#!/usr/bin/env python3
"""
Studio Export — Uploads rendered clips to Zernio CDN and pushes to Content Manager.

Takes rendered clips from the pipeline output directory, uploads video + thumbnail
to the Zernio CDN via presigned URLs, then pushes metadata to the Content Manager
studio queue for scheduling.

Usage:
    python -m tools.pipeline.studio_export \
        --output-dir output/clips/miami-vlog \
        --user-email user@example.com \
        --dry-run

    # Or as library:
    from pipeline.studio_export import export_to_studio
    result = export_to_studio("output/clips/miami-vlog", clips, user_email="user@example.com")

Env:
    ZERNIO_API_KEY  — Zernio/Late API key for CDN uploads (required)
    STUDIO_API_KEY  — Content Manager studio push key (required)
"""

import json
import mimetypes
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

ZERNIO_BASE_URL = "https://getlate.dev/api/v1"


def _load_env_key(name: str) -> str:
    """Load an API key from environment, with .env fallback."""
    val = os.environ.get(name, "")
    if val:
        return val

    # Try .env file in project root
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{name}=") and not line.startswith("#"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def upload_to_cdn(file_path: str, content_type: str = None) -> dict:
    """Upload a file to Zernio CDN via presigned URL.

    1. POST /media/presign with filename + contentType
    2. PUT to the returned uploadUrl with file binary
    3. Return { publicUrl, uploadUrl, success }
    """
    api_key = _load_env_key("ZERNIO_API_KEY")
    if not api_key:
        return {"success": False, "error": "ZERNIO_API_KEY not set in environment or .env"}

    path = Path(file_path)
    if not path.exists():
        return {"success": False, "error": f"File not found: {file_path}"}

    if not content_type:
        content_type, _ = mimetypes.guess_type(str(path))
        if not content_type:
            content_type = "application/octet-stream"

    filename = path.name

    # Step 1: Get presigned URL
    presign_payload = json.dumps({
        "filename": filename,
        "contentType": content_type,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{ZERNIO_BASE_URL}/media/presign",
        data=presign_payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "IX-Video-Producer/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            presign_data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        return {"success": False, "error": f"Presign failed: HTTP {e.code} {e.reason} {body}"}
    except Exception as e:
        return {"success": False, "error": f"Presign request failed: {e}"}

    upload_url = presign_data.get("uploadUrl", "")
    public_url = presign_data.get("publicUrl", "")

    if not upload_url:
        return {"success": False, "error": f"No uploadUrl in presign response: {presign_data}"}

    # Step 2: PUT file binary to upload URL
    file_data = path.read_bytes()
    put_req = urllib.request.Request(
        upload_url,
        data=file_data,
        headers={
            "Content-Type": content_type,
        },
        method="PUT",
    )

    try:
        with urllib.request.urlopen(put_req, timeout=300) as resp:
            if resp.status not in (200, 201, 204):
                return {"success": False, "error": f"Upload PUT returned {resp.status}"}
    except urllib.error.HTTPError as e:
        return {"success": False, "error": f"Upload PUT failed: HTTP {e.code} {e.reason}"}
    except Exception as e:
        return {"success": False, "error": f"Upload PUT failed: {e}"}

    print(f"[studio_export] Uploaded {filename} -> {public_url}")
    return {"success": True, "publicUrl": public_url, "uploadUrl": upload_url}


def push_to_studio(
    clip_data: dict,
    media_url: str,
    thumbnail_url: str = None,
    user_email: str = None,
    content_manager_url: str = "https://content.6fbmentorship.com/apps/content",
) -> dict:
    """Push a clip to Content Manager's studio queue.

    POST {content_manager_url}/api/studio/push
    Headers: x-api-key from STUDIO_API_KEY env var
    """
    studio_key = _load_env_key("STUDIO_API_KEY")
    if not studio_key:
        return {"success": False, "error": "STUDIO_API_KEY not set in environment or .env"}

    # Build caption from first 2 sentences of transcript
    transcript = clip_data.get("transcript", "")
    caption = _first_n_sentences(transcript, 2)

    payload = {
        "title": clip_data.get("title", "Untitled Clip"),
        "caption": caption,
        "mediaUrls": [media_url],
        "mediaType": "VIDEO",
        "studioItemId": clip_data.get("clipId", clip_data.get("id", "")),
        "source": "studio",
    }

    if thumbnail_url:
        payload["thumbnailUrl"] = thumbnail_url

    if user_email:
        payload["userEmail"] = user_email

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{content_manager_url}/api/studio/push",
        data=data,
        headers={
            "x-api-key": studio_key,
            "Content-Type": "application/json",
            "User-Agent": "IX-Video-Producer/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            print(f"[studio_export] Pushed to studio: {clip_data.get('title', '?')}")
            return {"success": True, "response": result}
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        return {"success": False, "error": f"Studio push failed: HTTP {e.code} {e.reason} {body}"}
    except Exception as e:
        return {"success": False, "error": f"Studio push failed: {e}"}


def export_to_studio(
    output_dir: str,
    clips: list,
    user_email: str = None,
    content_manager_url: str = "https://content.6fbmentorship.com/apps/content",
    dry_run: bool = False,
) -> dict:
    """Upload rendered clips to CDN and push to Content Manager.

    For each clip:
    1. Find rendered composition file (rendered_composition.mp4)
    2. Find thumbnail (thumbnail.jpg)
    3. Upload both to CDN
    4. Build studio push payload
    5. POST to studio push API

    Returns: { uploaded: int, pushed: int, skipped: int, errors: list, queue_status: list }
    """
    results = {
        "uploaded": 0,
        "pushed": 0,
        "skipped": 0,
        "errors": [],
        "queue_status": [],
    }

    output_path = Path(output_dir)
    if not output_path.exists():
        results["errors"].append(f"Output directory not found: {output_dir}")
        return results

    for clip in clips:
        title = clip.get("title", "Untitled")
        clip_id = clip.get("clipId", clip.get("id", ""))

        # Find clip output directory — matches full_pipeline.py pattern:
        # clip-{id:02d}-{title}/rendered_composition.mp4
        clip_dir = _find_clip_dir(output_path, clip)
        if not clip_dir:
            print(f"[studio_export] Skipping {title}: no clip directory found")
            results["skipped"] += 1
            continue

        video_path = clip_dir / "rendered_composition.mp4"
        thumb_path = clip_dir / "thumbnail.jpg"

        if not video_path.exists():
            print(f"[studio_export] Skipping {title}: no rendered_composition.mp4")
            results["skipped"] += 1
            continue

        if dry_run:
            thumb_status = "found" if thumb_path.exists() else "missing"
            size_mb = video_path.stat().st_size / (1024 * 1024)
            print(f"[studio_export] [DRY RUN] Would upload {title}")
            print(f"  Video: {video_path} ({size_mb:.1f} MB)")
            print(f"  Thumbnail: {thumb_status}")
            print(f"  Would push to {content_manager_url}/api/studio/push")
            results["queue_status"].append({
                "title": title,
                "clipId": clip_id,
                "status": "dry_run",
                "videoPath": str(video_path),
            })
            results["uploaded"] += 1
            results["pushed"] += 1
            continue

        # Upload video to CDN
        print(f"[studio_export] Uploading video: {title}")
        video_result = upload_to_cdn(str(video_path), "video/mp4")
        if not video_result.get("success"):
            error = f"Video upload failed for {title}: {video_result.get('error')}"
            print(f"[studio_export] {error}")
            results["errors"].append(error)
            continue

        media_url = video_result["publicUrl"]
        results["uploaded"] += 1

        # Upload thumbnail if exists
        thumbnail_url = None
        if thumb_path.exists():
            print(f"[studio_export] Uploading thumbnail: {title}")
            thumb_result = upload_to_cdn(str(thumb_path), "image/jpeg")
            if thumb_result.get("success"):
                thumbnail_url = thumb_result["publicUrl"]
            else:
                print(f"[studio_export] Thumbnail upload failed (continuing): {thumb_result.get('error')}")

        # Push to studio queue
        push_result = push_to_studio(
            clip_data=clip,
            media_url=media_url,
            thumbnail_url=thumbnail_url,
            user_email=user_email,
            content_manager_url=content_manager_url,
        )

        if push_result.get("success"):
            results["pushed"] += 1
            results["queue_status"].append({
                "title": title,
                "clipId": clip_id,
                "status": "pushed",
                "mediaUrl": media_url,
                "thumbnailUrl": thumbnail_url,
            })
        else:
            error = f"Studio push failed for {title}: {push_result.get('error')}"
            print(f"[studio_export] {error}")
            results["errors"].append(error)

    print(f"[studio_export] Done: {results['uploaded']} uploaded, "
          f"{results['pushed']} pushed, {results['skipped']} skipped, "
          f"{len(results['errors'])} errors")
    return results


def get_queue_status(
    user_email: str,
    content_manager_url: str = "https://content.6fbmentorship.com/apps/content",
    limit: int = 20,
) -> list:
    """Check status of items in the studio queue."""
    studio_key = _load_env_key("STUDIO_API_KEY")
    if not studio_key:
        print("[studio_export] STUDIO_API_KEY not set — cannot check queue status")
        return []

    params = f"?limit={limit}"
    if user_email:
        params += f"&userEmail={urllib.parse.quote(user_email)}"

    url = f"{content_manager_url}/api/studio/queue{params}"

    req = urllib.request.Request(
        url,
        headers={
            "x-api-key": studio_key,
            "User-Agent": "IX-Video-Producer/1.0",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data if isinstance(data, list) else data.get("items", data.get("data", []))
            print(f"[studio_export] Queue status: {len(items)} items")
            return items
    except urllib.error.HTTPError as e:
        print(f"[studio_export] Queue status check failed: HTTP {e.code} {e.reason}")
        return []
    except Exception as e:
        print(f"[studio_export] Queue status check failed: {e}")
        return []


# --- Internal helpers ---

def _first_n_sentences(text: str, n: int = 2) -> str:
    """Extract the first N sentences from text."""
    if not text:
        return ""
    sentences = []
    current = ""
    for char in text:
        current += char
        if char in ".!?" and len(current.strip()) > 5:
            sentences.append(current.strip())
            current = ""
            if len(sentences) >= n:
                break
    if current.strip() and len(sentences) < n:
        sentences.append(current.strip())
    return " ".join(sentences)


def _find_clip_dir(output_path: Path, clip: dict) -> Path | None:
    """Find the clip's output directory within the output path.

    Matches the full_pipeline.py pattern: clip-{id:02d}-{title}/
    Falls back to searching for the title in directory names.
    """
    clip_id = clip.get("id", clip.get("clipId", ""))
    title = clip.get("title", "")

    # Try exact pattern: clip-01-Title
    if clip_id:
        pattern_id = int(clip_id) if isinstance(clip_id, (int, float)) else 0
        if pattern_id > 0:
            expected = output_path / f"clip-{pattern_id:02d}-{title}"
            if expected.exists():
                return expected

    # Fallback: search for directory containing the title
    if title and output_path.is_dir():
        for d in sorted(output_path.iterdir()):
            if d.is_dir() and title in d.name:
                return d

    # Fallback: if clip has a path hint
    spec_path = clip.get("specPath", clip.get("path", ""))
    if spec_path:
        spec_dir = Path(spec_path).parent
        if spec_dir.exists() and (spec_dir / "rendered_composition.mp4").exists():
            return spec_dir

    return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Upload rendered clips to CDN and push to Content Manager")
    parser.add_argument("--output-dir", required=True, help="Path to pipeline output directory")
    parser.add_argument("--user-email", help="User email for studio queue")
    parser.add_argument("--content-manager-url", default="https://content.6fbmentorship.com/apps/content",
                        help="Content Manager base URL")
    parser.add_argument("--dry-run", action="store_true", help="Log actions without making API calls")
    parser.add_argument("--clips-json", help="Path to clips JSON file (default: scan output dir for clip_spec.json files)")
    args = parser.parse_args()

    # Load clips from JSON or discover from output directory
    clips = []
    if args.clips_json:
        with open(args.clips_json) as f:
            clips = json.load(f)
            if not isinstance(clips, list):
                clips = clips.get("clips", [clips])
    else:
        # Discover clip specs from output directory
        output_path = Path(args.output_dir)
        for spec_file in sorted(output_path.rglob("clip_spec.json")):
            try:
                with open(spec_file) as f:
                    spec = json.load(f)
                spec["specPath"] = str(spec_file)
                clips.append(spec)
            except Exception as e:
                print(f"[studio_export] Failed to load {spec_file}: {e}")

    if not clips:
        print("[studio_export] No clips found. Provide --clips-json or ensure output dir has clip_spec.json files.")
        sys.exit(1)

    print(f"[studio_export] Found {len(clips)} clips to export")

    result = export_to_studio(
        output_dir=args.output_dir,
        clips=clips,
        user_email=args.user_email,
        content_manager_url=args.content_manager_url,
        dry_run=args.dry_run,
    )

    print(f"\n{'='*50}")
    print(f"Studio Export Summary")
    print(f"{'='*50}")
    print(f"  Uploaded: {result['uploaded']}")
    print(f"  Pushed:   {result['pushed']}")
    print(f"  Skipped:  {result['skipped']}")
    print(f"  Errors:   {len(result['errors'])}")
    if result["errors"]:
        for err in result["errors"]:
            print(f"    - {err}")


if __name__ == "__main__":
    main()
