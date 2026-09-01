"""Lambda handler for real-time weather and AQI alert checking.

Triggered every 10 minutes by EventBridge.  Checks Apple WeatherKit
weather alerts (with NOAA fallback) and AirNow AQI for each active
user geohash, compares against AlertNotificationHistory to find new
alerts, and sends push notifications to affected users via the Node
backend.
"""

from __future__ import annotations

import base64
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import jwt

from src.config.secrets import get_briefing_secrets, BriefingSecrets
from src.utils.supabase_errors import is_missing_table_error, log_missing_table_once
from src.utils.coordinates import parse_valid_coordinates

logging.basicConfig(level=logging.INFO, force=True)
log = logging.getLogger("seeder.handlers.alert_checker")

FETCH_TIMEOUT_S = 10
WEATHERKIT_TIMEOUT_S = 4
SEND_TIMEOUT_S = 30
AQI_UNHEALTHY_THRESHOLD = 101  # AQI >= 101 triggers notification
NOAA_USER_AGENT = "(Pantopus, admin@pantopus.app)"

# ── WeatherKit config ──────────────────────────────────────────
WEATHERKIT_BASE_URL = "https://weatherkit.apple.com/api/v1"
WEATHERKIT_JWT_LIFETIME_S = 3600       # 1 hour
WEATHERKIT_JWT_REFRESH_S = 50 * 60     # Refresh at 50 minutes
WEATHERKIT_BACKOFF_S = 5 * 60          # Avoid repeated slow calls during provider incidents
WEATHERKIT_TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}
_cached_wk_jwt: str | None = None
_cached_wk_jwt_expires_at: float = 0
_weatherkit_disabled_until: float = 0
_weatherkit_disabled_reason: str | None = None

# ── Pure-Python geohash encoder (replaces ngeohash C-extension) ──
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def _geohash_encode(lat: float, lng: float, precision: int = 5) -> str:
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    bits = 0
    hash_val = 0
    is_lng = True
    result: list[str] = []
    while len(result) < precision:
        if is_lng:
            mid = (lng_range[0] + lng_range[1]) / 2
            if lng >= mid:
                hash_val = (hash_val << 1) | 1
                lng_range[0] = mid
            else:
                hash_val <<= 1
                lng_range[1] = mid
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if lat >= mid:
                hash_val = (hash_val << 1) | 1
                lat_range[0] = mid
            else:
                hash_val <<= 1
                lat_range[1] = mid
        is_lng = not is_lng
        bits += 1
        if bits == 5:
            result.append(_BASE32[hash_val])
            bits = 0
            hash_val = 0
    return "".join(result)


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Alert checker Lambda entry point."""
    try:
        return _run(event, context)
    except Exception:
        log.exception("Alert checker handler failed with unhandled exception")
        return {"error": "unhandled_exception"}


def _run(event: dict[str, Any], context: Any) -> dict[str, Any]:
    start_ms = time.monotonic_ns() // 1_000_000
    try:
        secrets = get_briefing_secrets()
    except Exception:
        log.exception("Failed to load or validate briefing secrets")
        return {"error": "secrets_load_failed"}

    try:
        from supabase import create_client
        supabase = create_client(secrets.supabase_url, secrets.supabase_service_role_key)
    except Exception:
        log.exception("Failed to initialize Supabase client")
        return {"error": "supabase_init_failed"}

    # 1. Get unique user locations (geohash → list of user_ids)
    geohash_users = _get_user_geohashes(supabase)
    if not geohash_users:
        log.info("No users with locations found")
        return {"geohashes_checked": 0, "alerts_found": 0, "users_notified": 0}

    stats = {
        "geohashes_checked": len(geohash_users),
        "weather_alerts_found": 0,
        "aqi_alerts_found": 0,
        "users_notified": 0,
        "push_errors": 0,
        "weatherkit_fallbacks": 0,
        "weatherkit_backoff_skips": 0,
    }

    # 2. For each geohash, check weather alerts and AQI
    for geohash, user_data in geohash_users.items():
        lat = user_data["lat"]
        lng = user_data["lng"]
        user_ids = user_data["user_ids"]

        try:
            # Check weather alerts (WeatherKit → NOAA fallback)
            weather_count = _check_weather_alerts(
                supabase, secrets, geohash, lat, lng, user_ids, stats,
            )
            stats["weather_alerts_found"] += weather_count

            # Check AQI
            aqi_count = _check_aqi_alerts(
                supabase, secrets, geohash, lat, lng, user_ids, stats,
            )
            stats["aqi_alerts_found"] += aqi_count
        except Exception:
            log.exception("Error checking alerts for geohash=%s", geohash)

    # 3. Cleanup expired history entries
    _cleanup_expired(supabase)

    elapsed_ms = time.monotonic_ns() // 1_000_000 - start_ms
    stats["latency_ms"] = elapsed_ms

    _publish_metrics(stats)

    log.info(
        "Alert checker complete: geohashes=%d weather_alerts=%d aqi_alerts=%d notified=%d errors=%d latency=%dms",
        stats["geohashes_checked"],
        stats["weather_alerts_found"],
        stats["aqi_alerts_found"],
        stats["users_notified"],
        stats["push_errors"],
        elapsed_ms,
    )

    return stats


# ── Get user geohashes ──────────────────────────────────────────


def _get_user_geohashes(supabase) -> dict[str, dict]:
    """Get unique geohash5 → {lat, lng, user_ids} from HomeOccupancy + Home coords.

    Groups users by the geohash of their primary home, so we only check
    NOAA/AQI once per geographic area.
    """
    try:
        # Get all active home occupancies with home coordinates
        result = (
            supabase.table("HomeOccupancy")
            .select("user_id, home_id, home:home_id(map_center_lat, map_center_lng)")
            .eq("is_active", True)
            .execute()
        )
        rows = result.data or []
    except Exception:
        log.exception("Failed to query home occupancies for geohashes")
        return {}

    geohash_map: dict[str, dict] = {}

    for row in rows:
        home = row.get("home")
        if not home:
            continue
        lat = home.get("map_center_lat")
        lng = home.get("map_center_lng")
        if lat is None or lng is None:
            continue

        parsed = parse_valid_coordinates(lat, lng)
        if parsed is None:
            continue
        lat, lng = parsed
        gh = _geohash_encode(lat, lng, 5)

        if gh not in geohash_map:
            geohash_map[gh] = {"lat": lat, "lng": lng, "user_ids": []}
        geohash_map[gh]["user_ids"].append(row["user_id"])

    # Deduplicate user_ids per geohash
    for gh in geohash_map:
        geohash_map[gh]["user_ids"] = list(set(geohash_map[gh]["user_ids"]))

    log.info("Found %d unique geohashes from %d occupancies", len(geohash_map), len(rows))
    return geohash_map


# ── WeatherKit helpers ──────────────────────────────────────────


def _weatherkit_available(secrets: BriefingSecrets) -> bool:
    """Return True if all WeatherKit credentials are configured."""
    return bool(
        secrets.weatherkit_key_id
        and secrets.weatherkit_team_id
        and secrets.weatherkit_service_id
        and secrets.weatherkit_private_key
    )


def _weatherkit_backoff_active() -> bool:
    """Return True when WeatherKit is temporarily disabled after failures."""
    return time.time() < _weatherkit_disabled_until


def _weatherkit_backoff_remaining_s() -> int:
    return max(0, int(_weatherkit_disabled_until - time.time()))


def _disable_weatherkit_temporarily(reason: str) -> None:
    """Disable WeatherKit briefly so one outage does not stall every geohash."""
    global _weatherkit_disabled_until, _weatherkit_disabled_reason
    _weatherkit_disabled_until = time.time() + WEATHERKIT_BACKOFF_S
    _weatherkit_disabled_reason = reason


def _get_weatherkit_jwt(secrets: BriefingSecrets) -> str | None:
    """Generate or return cached WeatherKit ES256 JWT."""
    global _cached_wk_jwt, _cached_wk_jwt_expires_at

    if _cached_wk_jwt and time.time() < _cached_wk_jwt_expires_at:
        return _cached_wk_jwt

    try:
        # Support base64-encoded PEM
        raw_key = secrets.weatherkit_private_key
        if "-----BEGIN" not in raw_key:
            raw_key = base64.b64decode(raw_key).decode("utf-8")

        now = int(time.time())
        token = jwt.encode(
            {"iss": secrets.weatherkit_team_id, "sub": secrets.weatherkit_service_id, "iat": now, "exp": now + WEATHERKIT_JWT_LIFETIME_S},
            raw_key,
            algorithm="ES256",
            headers={"kid": secrets.weatherkit_key_id, "id": f"{secrets.weatherkit_team_id}.{secrets.weatherkit_service_id}"},
        )
        _cached_wk_jwt = token
        _cached_wk_jwt_expires_at = time.time() + WEATHERKIT_JWT_REFRESH_S
        return token
    except Exception:
        log.warning("Failed to generate WeatherKit JWT", exc_info=True)
        return None


def _fetch_weatherkit_alerts(
    lat: float, lng: float, secrets: BriefingSecrets,
) -> list[dict] | None:
    """Fetch weather alerts from Apple WeatherKit.

    Returns a list of normalised alert dicts (same shape as NOAA features)
    or None if WeatherKit is unavailable/fails.
    """
    if _weatherkit_backoff_active():
        log.info(
            "WeatherKit backoff active (%ss remaining, reason=%s); using NOAA fallback for %.4f,%.4f",
            _weatherkit_backoff_remaining_s(),
            _weatherkit_disabled_reason or "unknown",
            lat,
            lng,
        )
        return None

    token = _get_weatherkit_jwt(secrets)
    if not token:
        return None

    url = f"{WEATHERKIT_BASE_URL}/weather/en/{lat:.4f}/{lng:.4f}?dataSets=weatherAlerts&country=US"
    try:
        resp = httpx.get(url, timeout=WEATHERKIT_TIMEOUT_S, headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        })
        if resp.status_code != 200:
            if resp.status_code in WEATHERKIT_TRANSIENT_STATUS_CODES:
                _disable_weatherkit_temporarily(f"http_{resp.status_code}")
            log.warning(
                "WeatherKit API returned %d for %.4f,%.4f; using NOAA fallback",
                resp.status_code,
                lat,
                lng,
            )
            return None

        data = resp.json()
        wk_alerts = data.get("weatherAlerts", {}).get("alerts", [])

        # Normalise to the same shape the NOAA path expects.
        # Preserve detailsUrl and source per Apple WeatherKit attribution requirements.
        severity_map = {"extreme": "Extreme", "severe": "Severe", "moderate": "Moderate", "minor": "Minor"}
        features = []
        for a in wk_alerts:
            severity_raw = (a.get("severity") or "").lower()
            features.append({
                "properties": {
                    "id": a.get("id") or a.get("detailsUrl") or "",
                    "event": a.get("description") or a.get("eventType") or "Weather Alert",
                    "severity": severity_map.get(severity_raw, "Unknown"),
                    "headline": a.get("description") or "",
                    "instruction": "",
                    "expires": a.get("expireTime") or "",
                    "ends": a.get("expireTime") or "",
                    "details_url": a.get("detailsUrl") or "",
                    "source": a.get("source") or "",
                },
            })
        log.info("WeatherKit returned %d alerts for %.4f,%.4f", len(features), lat, lng)
        return features
    except httpx.TimeoutException:
        _disable_weatherkit_temporarily("timeout")
        log.warning(
            "WeatherKit timed out for %.4f,%.4f after %ss; using NOAA fallback",
            lat,
            lng,
            WEATHERKIT_TIMEOUT_S,
        )
        return None
    except httpx.TransportError as exc:
        _disable_weatherkit_temporarily(exc.__class__.__name__)
        log.warning(
            "WeatherKit network error for %.4f,%.4f (%s); using NOAA fallback",
            lat,
            lng,
            exc.__class__.__name__,
        )
        return None
    except Exception:
        log.warning("WeatherKit response handling failed for %.4f,%.4f", lat, lng, exc_info=True)
        return None


# ── NOAA fallback ──────────────────────────────────────────────


def _fetch_noaa_alerts(lat: float, lng: float, geohash: str, stats: dict) -> list[dict] | None:
    """Fetch weather alerts from NOAA (fallback). Returns features list or None."""
    try:
        url = f"https://api.weather.gov/alerts/active?point={lat:.4f},{lng:.4f}"
        resp = httpx.get(url, timeout=FETCH_TIMEOUT_S, headers={
            "Accept": "application/geo+json",
            "User-Agent": NOAA_USER_AGENT,
        })
        if resp.status_code != 200:
            log.warning("NOAA API returned %d for geohash=%s", resp.status_code, geohash)
            stats["push_errors"] += 1
            return None

        data = resp.json()
        return data.get("features", [])
    except Exception:
        log.warning("NOAA fetch failed for geohash=%s", geohash, exc_info=True)
        stats["push_errors"] += 1
        return None


# ── Weather alert checking ──────────────────────────────────────


def _check_weather_alerts(
    supabase, secrets: BriefingSecrets,
    geohash: str, lat: float, lng: float,
    user_ids: list[str], stats: dict,
) -> int:
    """Fetch weather alerts (WeatherKit first, NOAA fallback), send push for new ones."""
    features = None

    # 1. Try Apple WeatherKit first
    if _weatherkit_available(secrets):
        was_backing_off = _weatherkit_backoff_active()
        features = _fetch_weatherkit_alerts(lat, lng, secrets)
        if features is None:
            stats["weatherkit_fallbacks"] = stats.get("weatherkit_fallbacks", 0) + 1
            if was_backing_off:
                stats["weatherkit_backoff_skips"] = stats.get("weatherkit_backoff_skips", 0) + 1

    # 2. Fall back to NOAA
    if features is None:
        features = _fetch_noaa_alerts(lat, lng, geohash, stats)

    if features is None:
        return 0

    new_alert_count = 0

    for feature in features:
        props = feature.get("properties", {})
        alert_id = props.get("id") or feature.get("id") or ""
        if not alert_id:
            continue

        severity = (props.get("severity") or "").lower()
        # Only notify for moderate+ severity
        if severity not in ("moderate", "severe", "extreme"):
            continue

        # Check if already sent for this geohash
        if _already_notified(supabase, "weather", alert_id, geohash):
            continue

        # New alert — send push
        headline = props.get("headline") or props.get("event") or "Weather Alert"
        event = props.get("event") or "Weather Alert"
        instruction = (props.get("instruction") or "")[:200]
        expires = props.get("expires") or props.get("ends") or ""
        details_url = props.get("details_url") or ""
        alert_source = props.get("source") or ""

        title = f"⚠️ {event}"
        body = headline
        if alert_source:
            # Apple WeatherKit requires displaying the issuing agency
            body = f"{headline} — {alert_source}"
        elif instruction:
            body = f"{headline} — {instruction}"
        # Cap body length for push
        if len(body) > 200:
            body = body[:197] + "..."

        push_data = {
            "alertId": alert_id,
            "severity": severity,
            "route": "/hub",
        }
        if details_url:
            push_data["detailsUrl"] = details_url
        if alert_source:
            push_data["source"] = alert_source

        sent = _send_alert_push(secrets, user_ids, title, body, "weather", push_data)

        # Record in history
        _record_notification(supabase, "weather", alert_id, geohash, severity, headline, sent, expires)

        new_alert_count += 1
        stats["users_notified"] += sent
        log.info("Weather alert sent: event=%s severity=%s geohash=%s users=%d", event, severity, geohash, sent)

    return new_alert_count


# ── AQI alert checking ──────────────────────────────────────────


def _check_aqi_alerts(
    supabase, secrets: BriefingSecrets,
    geohash: str, lat: float, lng: float,
    user_ids: list[str], stats: dict,
) -> int:
    """Check AirNow AQI, send push if it spikes above threshold."""
    api_key = os.environ.get("AIRNOW_API_KEY") or ""
    # Try to get from secrets if not in env
    if not api_key:
        try:
            from src.config.secrets import get_secrets
            seeder_secrets = get_secrets()
            api_key = getattr(seeder_secrets, "airnow_api_key", "")
        except Exception:
            pass

    if not api_key:
        return 0  # AQI checking requires API key

    try:
        params = {
            "format": "application/json",
            "latitude": str(lat),
            "longitude": str(lng),
            "distance": "25",
            "API_KEY": api_key,
        }
        resp = httpx.get(
            "https://www.airnowapi.org/aq/observation/latLong/current/",
            params=params,
            timeout=FETCH_TIMEOUT_S,
        )
        if resp.status_code != 200:
            log.warning("AirNow API returned %d for geohash=%s", resp.status_code, geohash)
            stats["push_errors"] += 1
            return 0

        observations = resp.json()
        if not isinstance(observations, list) or not observations:
            return 0
    except Exception:
        log.warning("AirNow fetch failed for geohash=%s", geohash, exc_info=True)
        stats["push_errors"] += 1
        return 0

    # Find the worst AQI reading
    worst = max(observations, key=lambda o: o.get("AQI", 0))
    aqi_val = worst.get("AQI", 0)

    if aqi_val < AQI_UNHEALTHY_THRESHOLD:
        return 0

    # Build a unique alert_id for this AQI spike (date + geohash + threshold bucket)
    bucket = "unhealthy" if aqi_val < 151 else "very_unhealthy" if aqi_val < 201 else "hazardous"
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    alert_id = f"aqi_{today_str}_{bucket}"

    if _already_notified(supabase, "aqi", alert_id, geohash):
        return 0

    category_name = worst.get("Category", {}).get("Name", "Unhealthy")
    pollutant = worst.get("ParameterName", "PM2.5")

    title = f"Air Quality Alert — AQI {aqi_val}"
    body = f"Air quality is {category_name.lower()} ({pollutant}). Consider limiting outdoor activity."

    sent = _send_alert_push(secrets, user_ids, title, body, "aqi", {
        "alertId": alert_id,
        "aqi": aqi_val,
        "category": category_name,
        "route": "/hub",
    })

    expires = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
    _record_notification(supabase, "aqi", alert_id, geohash, bucket, f"AQI {aqi_val} — {category_name}", sent, expires)

    stats["users_notified"] += sent
    log.info("AQI alert sent: aqi=%d category=%s geohash=%s users=%d", aqi_val, category_name, geohash, sent)

    return 1


# ── Shared helpers ──────────────────────────────────────────────


def _already_notified(supabase, alert_type: str, alert_id: str, geohash: str) -> bool:
    """Check if this alert was already sent for this geohash."""
    try:
        result = (
            supabase.table("AlertNotificationHistory")
            .select("id")
            .eq("alert_type", alert_type)
            .eq("alert_id", alert_id)
            .eq("geohash", geohash)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "alert dedup", exc)
        else:
            log.warning("Dedup check failed", exc_info=True)
        return False  # Allow send on dedup failure (better to double-notify than miss)


def _record_notification(
    supabase, alert_type: str, alert_id: str, geohash: str,
    severity: str, headline: str, users_notified: int, expires: str,
) -> None:
    """Record that this alert was sent for this geohash."""
    try:
        supabase.table("AlertNotificationHistory").insert({
            "alert_type": alert_type,
            "alert_id": alert_id,
            "geohash": geohash,
            "severity": severity,
            "headline": headline,
            "users_notified": users_notified,
            "expires_at": expires or None,
        }).execute()
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "alert dedup writes", exc)
        else:
            log.warning("Failed to record alert notification", exc_info=True)


def _send_alert_push(
    secrets: BriefingSecrets, user_ids: list[str],
    title: str, body: str, alert_type: str, data: dict,
) -> int:
    """Call the Node backend to send push notifications to users."""
    try:
        url = f"{secrets.pantopus_api_base_url}/api/internal/briefing/alert-push"
        resp = httpx.post(
            url,
            json={
                "userIds": user_ids,
                "title": title,
                "body": body,
                "alertType": alert_type,
                "data": data,
            },
            headers={
                "Content-Type": "application/json",
                "x-internal-api-key": secrets.internal_api_key,
            },
            timeout=SEND_TIMEOUT_S,
        )
        if resp.status_code == 200:
            result = resp.json()
            return result.get("sent", 0)
        else:
            log.warning("Alert push API returned %d: %s", resp.status_code, resp.text[:200])
            return 0
    except Exception:
        log.exception("Alert push API call failed")
        return 0


def _cleanup_expired(supabase) -> None:
    """Delete expired alert history entries."""
    try:
        result = (
            supabase.table("AlertNotificationHistory")
            .delete()
            .filter("expires_at", "not.is", "null")
            .lt("expires_at", datetime.now(timezone.utc).isoformat())
            .execute()
        )
        count = len(result.data) if result.data else 0
        if count:
            log.info("Purged %d expired alert history entries", count)
    except Exception as exc:
        if is_missing_table_error(exc, "AlertNotificationHistory"):
            log_missing_table_once(log, "AlertNotificationHistory", "alert history cleanup", exc)
        else:
            log.warning("Failed to purge expired alert history", exc_info=True)


# ── CloudWatch metrics ──────────────────────────────────────────


def _publish_metrics(stats: dict) -> None:
    try:
        import boto3
        env = os.environ.get("ENVIRONMENT", "production")
        cw = boto3.client("cloudwatch")
        cw.put_metric_data(
            Namespace=f"Pantopus/Alerts/{env}",
            MetricData=[
                {"MetricName": "AlertGeohashesChecked", "Value": stats.get("geohashes_checked", 0), "Unit": "Count"},
                {"MetricName": "WeatherAlertsFound", "Value": stats.get("weather_alerts_found", 0), "Unit": "Count"},
                {"MetricName": "AqiAlertsFound", "Value": stats.get("aqi_alerts_found", 0), "Unit": "Count"},
                {"MetricName": "UsersNotified", "Value": stats.get("users_notified", 0), "Unit": "Count"},
                {"MetricName": "WeatherKitFallbacks", "Value": stats.get("weatherkit_fallbacks", 0), "Unit": "Count"},
                {"MetricName": "AlertCheckerLatencyMs", "Value": stats.get("latency_ms", 0), "Unit": "Milliseconds"},
            ],
        )
    except Exception:
        log.warning("Failed to publish CloudWatch alert metrics", exc_info=True)
