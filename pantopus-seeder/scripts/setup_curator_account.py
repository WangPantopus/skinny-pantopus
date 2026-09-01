"""One-time script to create the curator user in Supabase Auth and seed seeder_config.

Usage:
    python scripts/setup_curator_account.py
    python scripts/setup_curator_account.py --dry-run
    python scripts/setup_curator_account.py --display-name "Vancouver Local"

Add a new dynamic region:
    python scripts/setup_curator_account.py --add-region seattle_metro \\
        --region-lat 47.6062 --region-lng -122.3321 \\
        --region-display-name "Seattle Metro" \\
        --region-timezone "America/Los_Angeles"
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

# python-dotenv loads .env into os.environ
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass  # Not required if env vars are set another way

from supabase import create_client

# Allow imports from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.config.sources_config import get_sources_for_region  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

DEFAULT_DISPLAY_NAME = "Pantopus Local"
DEFAULT_BIO = (
    "Your neighborhood bot — sharing local news, events, and seasonal tips "
    "for the community. Powered by Pantopus."
)
DEFAULT_USERNAME = "pantopus_local"

# Default regions with their geographic config
DEFAULT_REGIONS: dict[str, dict] = {
    "clark_county": {
        # Clark County, Washington (Vancouver area — not KY/NV/OH etc.)
        "lat": 45.6387,
        "lng": -122.6615,
        "radius_meters": 25000,
        "timezone": "America/Los_Angeles",
        "display_name": "Clark County, WA",
    },
    "portland_metro": {
        "lat": 45.5152,
        "lng": -122.6784,
        "radius_meters": 25000,
        "timezone": "America/Los_Angeles",
        "display_name": "Portland Metro",
    },
}


def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        log.error("Missing required environment variable: %s", name)
        sys.exit(1)
    return val


def setup_curator(*, display_name: str, dry_run: bool) -> None:
    """Create curator account and seed seeder_config rows for default regions."""
    supabase_url = _require_env("SUPABASE_URL")
    service_role_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    curator_email = _require_env("CURATOR_EMAIL")
    curator_password = _require_env("CURATOR_PASSWORD")

    log.info("Supabase URL: %s", supabase_url)
    log.info("Curator email: %s", curator_email)
    log.info("Display name: %s", display_name)
    log.info("Regions: %s", ", ".join(DEFAULT_REGIONS.keys()))

    if dry_run:
        log.info("[DRY RUN] Would create Auth user for %s", curator_email)
        log.info("[DRY RUN] Would update User row: account_type=curator, name=%s", display_name)
        for region, geo in DEFAULT_REGIONS.items():
            sources = get_sources_for_region(region)
            source_ids = [s["source_id"] for s in sources]
            log.info("[DRY RUN] Would create seeder_config for %s at (%.4f, %.4f) with sources: %s",
                     region, geo["lat"], geo["lng"], source_ids)
        log.info("[DRY RUN] No changes made.")
        return

    sb = create_client(supabase_url, service_role_key)

    # Step 1: Create Auth user (or retrieve existing)
    user_id = _create_auth_user(sb, curator_email, curator_password)
    log.info("Auth user ID: %s", user_id)

    # Step 2: Update User table row
    _update_user_row(sb, user_id, display_name, curator_email)
    log.info("User row updated: account_type=curator, name=%s", display_name)

    # Step 3: Create seeder_config rows with geo columns
    for region, geo in DEFAULT_REGIONS.items():
        _create_seeder_config(sb, region, user_id, geo)

    # Step 4: Seed seeder_sources from hardcoded config
    for region in DEFAULT_REGIONS:
        _seed_sources(sb, region)

    # Summary
    print("\n--- Setup Complete ---")
    print(f"  Curator user ID : {user_id}")
    print(f"  Email           : {curator_email}")
    print(f"  Display name    : {display_name}")
    print(f"  Regions         : {', '.join(DEFAULT_REGIONS.keys())}")
    print("---------------------")


def add_region(
    *,
    region: str,
    lat: float,
    lng: float,
    display_name: str,
    timezone: str = "America/Los_Angeles",
    radius_meters: int = 25000,
    google_news_query: str | None = None,
    sports_teams: list[str] | None = None,
    dry_run: bool = False,
) -> None:
    """Add a new dynamic region with Google News and optional sports sources."""
    supabase_url = _require_env("SUPABASE_URL")
    service_role_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")

    log.info("Adding region: %s at (%.4f, %.4f)", region, lat, lng)

    if dry_run:
        log.info("[DRY RUN] Would create seeder_config for %s", region)
        log.info("[DRY RUN] Would create Google News source: '%s'", google_news_query or display_name)
        log.info("[DRY RUN] Would create seasonal source")
        log.info("[DRY RUN] No changes made.")
        return

    sb = create_client(supabase_url, service_role_key)

    # Find existing curator user
    curator_user_id = _find_curator_user_id(sb)
    if not curator_user_id:
        log.error("No curator user found. Run setup_curator_account.py first.")
        sys.exit(1)

    # Create seeder_config row
    geo = {
        "lat": lat,
        "lng": lng,
        "radius_meters": radius_meters,
        "timezone": timezone,
        "display_name": display_name,
    }
    _create_seeder_config(sb, region, curator_user_id, geo)

    # Create default sources for a new region.
    # P1 (critical) and P2 (core) are active by default.
    # P3 (enrichment) and P4 (filler) are created but inactive — enable as community grows.
    query = google_news_query or display_name
    sources = [
        # P1: Critical — always active
        {
            "source_id": f"nws_alerts:{region}",
            "source_type": "nws_alerts",
            "url": f"{lat},{lng}",
            "category": "weather",
            "display_name": "NWS Weather Alerts",
            "region": region,
            "active": True,
            "priority": 1,
        },
        {
            "source_id": f"usgs_earthquakes:{region}",
            "source_type": "usgs_earthquakes",
            "url": f"{lat},{lng}",
            "category": "earthquake",
            "display_name": "USGS Earthquakes",
            "region": region,
            "active": True,
            "priority": 1,
        },
        # P2: Core — always active
        {
            "source_id": f"google_news:{region}",
            "source_type": "google_news",
            "url": query,
            "category": "local_news",
            "display_name": f"Google News ({display_name})",
            "region": region,
            "active": True,
            "priority": 2,
        },
        {
            "source_id": f"seasonal:{region}",
            "source_type": "seasonal",
            "url": None,
            "category": "seasonal",
            "display_name": "Pantopus Seasonal",
            "region": region,
            "active": True,
            "priority": 2,
        },
        # P3: Enrichment — inactive by default for new regions
        {
            "source_id": f"air_quality:{region}",
            "source_type": "air_quality",
            "url": f"{lat},{lng}",
            "category": "air_quality",
            "display_name": "Air Quality (Open-Meteo)",
            "region": region,
            "active": False,
            "priority": 3,
        },
        # P4: Filler — inactive by default
        {
            "source_id": f"on_this_day:{region}",
            "source_type": "on_this_day",
            "url": display_name,
            "category": "history",
            "display_name": "On This Day (Wikipedia)",
            "region": region,
            "active": False,
            "priority": 4,
        },
    ]

    # Add sports team sources if provided (P3 — inactive by default)
    if sports_teams:
        for team_query in sports_teams:
            slug = team_query.lower().replace(" ", "_").replace(",", "")
            sources.append({
                "source_id": f"google_news:{slug}",
                "source_type": "google_news",
                "url": team_query,
                "category": "sports",
                "display_name": f"{team_query} News",
                "region": region,
                "active": False,
                "priority": 3,
            })

    for src in sources:
        try:
            sb.table("seeder_sources").upsert(
                src, on_conflict="source_id,region"
            ).execute()
            log.info("Source upserted: %s for %s", src["source_id"], region)
        except Exception:
            log.exception("Failed to upsert source %s for %s", src["source_id"], region)

    print(f"\n--- Region '{region}' added ---")
    print(f"  Display name  : {display_name}")
    print(f"  Coordinates   : ({lat}, {lng})")
    print(f"  Radius        : {radius_meters}m")
    print(f"  Google News   : '{query}'")
    print(f"  Curator       : {curator_user_id}")
    print("-------------------------------")


def _find_curator_user_id(sb) -> str | None:
    """Find the existing curator user ID from the User table."""
    try:
        result = (
            sb.table("User")
            .select("id")
            .eq("account_type", "curator")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
    except Exception:
        log.exception("Failed to find curator user")
    return None


def _create_auth_user(sb, email: str, password: str) -> str:
    """Create a Supabase Auth user via admin API. Returns the user ID.

    If the user already exists (409 / duplicate), fetches and returns the existing ID.
    """
    try:
        result = sb.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })
        return result.user.id
    except Exception as exc:
        # Handle "already exists" / duplicate — check status code attribute first,
        # fall back to string matching for broader compatibility.
        status = getattr(exc, "status", None) or getattr(exc, "status_code", None) or getattr(exc, "code", None)
        exc_str = str(exc).lower()
        is_duplicate = (
            status in (409, "409")
            or "already" in exc_str
            or "duplicate" in exc_str
        )
        if is_duplicate:
            log.info("Auth user already exists for %s — looking up existing ID", email)
            return _get_existing_user_id(sb, email)
        raise


def _get_existing_user_id(sb, email: str) -> str:
    """Look up an existing Auth user by email."""
    try:
        # admin.list_users returns paginated users; filter by email
        users = sb.auth.admin.list_users()
        for user in users:
            if hasattr(user, "email") and user.email == email:
                return user.id
    except Exception:
        pass

    # Fallback: look up from the User table
    result = (
        sb.table("User")
        .select("id")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["id"]

    log.error("Cannot find existing user for %s", email)
    sys.exit(1)


def _update_user_row(sb, user_id: str, display_name: str, email: str) -> None:
    """Create or update the User table row to mark as curator with proper profile fields."""
    sb.table("User").upsert({
        "id": user_id,
        "email": email,
        "account_type": "curator",
        "name": display_name,
        "username": DEFAULT_USERNAME,
        "bio": DEFAULT_BIO,
    }, on_conflict="id").execute()


def _create_seeder_config(sb, region: str, curator_user_id: str, geo: dict) -> None:
    """Insert or update seeder_config for a region, including geo columns."""
    sources = get_sources_for_region(region)
    source_ids = [s["source_id"] for s in sources]

    row = {
        "region": region,
        "curator_user_id": curator_user_id,
        "active": True,
        "active_sources": source_ids,
        "lat": geo["lat"],
        "lng": geo["lng"],
        "radius_meters": geo.get("radius_meters", 25000),
        "timezone": geo.get("timezone", "America/Los_Angeles"),
        "display_name": geo.get("display_name", region),
    }

    try:
        sb.table("seeder_config").upsert(row, on_conflict="region").execute()
        log.info("seeder_config upserted for %s at (%.4f, %.4f)", region, geo["lat"], geo["lng"])
    except Exception:
        log.exception("Failed to upsert seeder_config for %s", region)
        raise


def _seed_sources(sb, region: str) -> None:
    """Seed seeder_sources table from hardcoded sources_config for a region."""
    sources = get_sources_for_region(region)
    for src in sources:
        row = {
            "source_id": src["source_id"],
            "source_type": src["source_type"],
            "url": src.get("url"),
            "category": src["category"],
            "display_name": src.get("display_name", src["source_id"]),
            "region": region,
            "active": src.get("active", True),
            "priority": src.get("priority", 2),
        }
        try:
            sb.table("seeder_sources").upsert(
                row, on_conflict="source_id,region"
            ).execute()
        except Exception:
            log.exception("Failed to upsert source %s for %s", src["source_id"], region)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set up the Pantopus curator account and seed configuration.",
    )
    parser.add_argument(
        "--display-name",
        default=DEFAULT_DISPLAY_NAME,
        help=f"Display name for the curator (default: {DEFAULT_DISPLAY_NAME})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without making changes",
    )

    # Sub-command for adding new regions
    parser.add_argument(
        "--add-region",
        metavar="REGION_ID",
        help="Add a new dynamic region (e.g., seattle_metro)",
    )
    parser.add_argument("--region-lat", type=float, help="Latitude for new region")
    parser.add_argument("--region-lng", type=float, help="Longitude for new region")
    parser.add_argument("--region-display-name", help="Display name for new region")
    parser.add_argument("--region-timezone", default="America/Los_Angeles", help="Timezone")
    parser.add_argument("--region-radius", type=int, default=25000, help="Radius in meters")
    parser.add_argument("--google-news-query", help="Custom Google News search query")
    parser.add_argument(
        "--sports-teams",
        help="Comma-separated sports team queries (e.g., 'Seattle Seahawks NFL,Seattle Kraken NHL')",
    )

    args = parser.parse_args()

    if args.add_region:
        if not args.region_lat or not args.region_lng:
            parser.error("--add-region requires --region-lat and --region-lng")
        sports = [t.strip() for t in (args.sports_teams or "").split(",") if t.strip()] or None
        add_region(
            region=args.add_region,
            lat=args.region_lat,
            lng=args.region_lng,
            display_name=args.region_display_name or args.add_region.replace("_", " ").title(),
            timezone=args.region_timezone,
            radius_meters=args.region_radius,
            google_news_query=args.google_news_query,
            sports_teams=sports,
            dry_run=args.dry_run,
        )
    else:
        setup_curator(display_name=args.display_name, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
