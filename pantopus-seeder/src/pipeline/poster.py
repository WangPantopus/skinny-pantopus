"""Posts humanized content to the Pantopus API as the curator account."""

from __future__ import annotations

import logging

import httpx

from src.config.constants import CATEGORY_TO_POST_TYPE, CATEGORY_TO_PURPOSE

log = logging.getLogger("seeder.pipeline.poster")

POST_ENDPOINT = "/api/posts"
_REQUEST_TIMEOUT = 30  # seconds


def authenticate_curator(supabase_client, email: str, password: str) -> str | None:
    """Sign in as the curator via Supabase Auth and return an access token.

    Returns None on any failure. Never raises.
    """
    try:
        result = supabase_client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
        token = result.session.access_token
        log.info("Curator authenticated successfully")
        return token
    except Exception:
        log.error("Failed to authenticate curator", exc_info=True)
        return None


def post_to_pantopus(
    api_base_url: str,
    access_token: str,
    content: str,
    category: str,
    region_lat: float | None,
    region_lng: float | None,
    media_urls: list[str] | None = None,
    media_types: list[str] | None = None,
    audience: str = "nearby",
    topic: str | None = None,
    sports_scope: str | None = None,
    post_metadata: dict | None = None,
) -> tuple[str | None, str | None]:
    """POST content to the Pantopus API as the curator.

    Returns (post_id, error_reason). On success error_reason is None.
    On failure post_id is None. Never raises.

    audience:
        'nearby' (default) — uses region_lat/region_lng as the target
        'national' — country-scoped (US); the backend stamps
                     distribution_targets=['country:US']. No lat/lng needed.
    topic / sports_scope / post_metadata:
        Optional sports-topic metadata (Phase 1). `topic='sports'` flips the
        post into the Sports lane; `post_metadata` may include event_key,
        team_tag, league, is_game_thread, is_watch_prompt, fresh_until.
    """
    post_type = CATEGORY_TO_POST_TYPE.get(category, "local_update")
    purpose = CATEGORY_TO_PURPOSE.get(category, "local_update")

    url = f"{api_base_url.rstrip('/')}{POST_ENDPOINT}"

    body: dict = {
        "content": content,
        "postType": post_type,
        "purpose": purpose,
        "visibility": "public",
        "audience": audience,
    }

    # National posts are country-scoped by the backend; do not send coords.
    # Any other audience (nearby, neighborhood, etc.) requires them.
    if audience != "national":
        body["latitude"] = region_lat
        body["longitude"] = region_lng

    # Sports topic lane
    if topic:
        body["topic"] = topic
    if sports_scope:
        body["sportsScope"] = sports_scope
    if post_metadata:
        body["postMetadata"] = dict(post_metadata)

    # Alert posts require safetyAlertKind
    if post_type == "alert":
        alert_kind_map = {
            "weather": "weather_damage",
            "safety": "public_safety",
            "air_quality": "public_safety",
            "earthquake": "public_safety",
        }
        body["safetyAlertKind"] = alert_kind_map.get(category, "public_safety")

    if media_urls:
        body["mediaUrls"] = media_urls
        body["mediaTypes"] = media_types or ["image"] * len(media_urls)

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    log.info("Posting to %s with token prefix %s...", url, access_token[:20])
    log.info("Request body: %s", {k: v for k, v in body.items() if k != "content"})

    try:
        response = httpx.post(url, json=body, headers=headers, timeout=_REQUEST_TIMEOUT)
    except Exception as exc:
        log.warning("Network error posting to Pantopus: %s", exc)
        return None, f"network_error:{exc}"

    if 200 <= response.status_code < 300:
        try:
            data = response.json()
            # Handle both {id: ...} and {post: {id: ...}} patterns
            post_id = data.get("id") or data.get("post", {}).get("id")
            if post_id:
                log.info("Posted successfully: post_id=%s", post_id)
                return str(post_id), None
            log.warning("Post created but no ID in response: %s", data)
            return None, "no_post_id_in_response"
        except Exception:
            log.warning("Post created but failed to parse response")
            return None, "invalid_response_json"

    if 400 <= response.status_code < 500:
        log.warning(
            "API rejected post (%d): %s", response.status_code, response.text[:200]
        )
        return None, f"api_rejected:{response.status_code}:{response.text[:200]}"

    if response.status_code >= 500:
        log.error("API server error (%d)", response.status_code)
        return None, f"api_server_error:{response.status_code}"

    return None, f"unexpected_status:{response.status_code}"
