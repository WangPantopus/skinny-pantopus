"""RSS URLs, API endpoints, and per-region source list definitions.

Source priority levels:
  1 = critical  — safety, weather alerts, earthquakes (always surface first)
  2 = core      — local news, events, seasonal tips (the bread and butter)
  3 = enrichment — community feeds, sports (adds variety)
  4 = filler    — fun extras, lowest priority
"""

from __future__ import annotations

# Each source config is a dict with:
#   source_id:    unique identifier (e.g. 'rss:columbian')
#   source_type:  'rss', 'google_news', 'nws_alerts', etc.
#   url:          feed URL, search query, or 'lat,lng' (None for seasonal)
#   category:     seeder category for fetched items
#   display_name: human-readable name for source attribution
#   priority:     1=critical, 2=core, 3=enrichment, 4=filler

# Clark County, Washington (SW WA; centroid near Vancouver). Coordinates must not be reused for
# other U.S. jurisdictions named "Clark County" (e.g. KY, NV, IN, OH, WI, MO).
CLARK_COUNTY_SOURCES: list[dict] = [
    # --- P1: Critical (safety/weather) ---
    {
        "source_id": "nws_alerts:clark_county",
        "source_type": "nws_alerts",
        # Vancouver, WA area — NWS alerts for this point are Clark County, WA + surrounds.
        "url": "45.6387,-122.6615",
        "category": "weather",
        "display_name": "NWS Weather Alerts (Clark County, WA)",
        "priority": 1,
    },
    # --- P2: Core (local news, events, seasonal) ---
    {
        "source_id": "rss:columbian",
        "source_type": "rss",
        "url": "https://www.columbian.com/feed/",
        "category": "local_news",
        "display_name": "The Columbian",
        "priority": 2,
    },
    {
        "source_id": "google_news:clark_county",
        "source_type": "google_news",
        # Anchor to SW Washington so Google News does not mix in other U.S. Clark Counties.
        "url": (
            "Clark County Washington WA Vancouver Camas Washougal "
            "Battle Ground Ridgefield southwest Washington local news"
        ),
        "category": "local_news",
        "display_name": "Google News (Clark County, WA)",
        "priority": 2,
    },
    {
        "source_id": "rss:camas_washougal",
        "source_type": "rss",
        "url": "https://www.camaspostrecord.com/feed/",
        "category": "local_news",
        "display_name": "Camas-Washougal Post-Record",
        "priority": 2,
    },
    {
        "source_id": "seasonal:pnw",
        "source_type": "seasonal",
        "url": None,
        "category": "seasonal",
        "display_name": "Pantopus Seasonal",
        "priority": 2,
    },
    # --- P3: Enrichment (community, sports) ---
    {
        "source_id": "google_news:trimet",
        "source_type": "google_news",
        "url": "TriMet Portland transit -crime -shooting -election",
        "category": "community_resource",
        "display_name": "TriMet Updates",
        "priority": 3,
    },
    {
        "source_id": "google_news:pdx_airport",
        "source_type": "google_news",
        "url": "PDX airport Portland updates",
        "category": "community_resource",
        "display_name": "PDX Airport Updates",
        "priority": 3,
    },
    {
        "source_id": "google_news:trail_blazers",
        "source_type": "google_news",
        "url": '"Portland Trail Blazers" ("NBA Playoffs" OR playoffs OR Spurs OR "Game 5" OR elimination) -odds -betting -fantasy -player props -DraftKings -FanDuel',
        "category": "sports",
        "display_name": "Trail Blazers News",
        "priority": 3,
    },
    {
        "source_id": "google_news:timbers",
        "source_type": "google_news",
        "url": "Portland Timbers -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Timbers News",
        "priority": 3,
    },
    {
        "source_id": "google_news:thorns",
        "source_type": "google_news",
        "url": "Portland Thorns -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Thorns News",
        "priority": 3,
    },
    {
        "source_id": "google_news:portland_fire",
        "source_type": "google_news",
        "url": "Portland Fire WNBA -wildfire -fire department -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Portland Fire News",
        "priority": 3,
    },
    {
        "source_id": "google_news:winterhawks",
        "source_type": "google_news",
        "url": "Portland Winterhawks -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Winterhawks News",
        "priority": 3,
    },
    # Seattle teams — Clark County users follow PNW pro sports broadly.
    {
        "source_id": "google_news:mariners",
        "source_type": "google_news",
        "url": "Seattle Mariners -odds -betting -fantasy -DraftKings -FanDuel -picks",
        "category": "sports",
        "display_name": "Mariners News",
        "priority": 3,
    },
    {
        "source_id": "google_news:kraken",
        "source_type": "google_news",
        "url": "Seattle Kraken NHL -odds -betting -fantasy -DraftKings -FanDuel",
        "category": "sports",
        "display_name": "Kraken News",
        "priority": 3,
    },
    {
        "source_id": "google_news:sounders",
        "source_type": "google_news",
        "url": "Seattle Sounders -odds -betting -fantasy -DraftKings -FanDuel",
        "category": "sports",
        "display_name": "Sounders News",
        "priority": 3,
    },
    # PNW college — big local conversation drivers during football/basketball season.
    {
        "source_id": "google_news:oregon_ducks",
        "source_type": "google_news",
        "url": "Oregon Ducks football basketball -odds -betting -fantasy -DraftKings -FanDuel -props",
        "category": "sports",
        "display_name": "Oregon Ducks News",
        "priority": 3,
    },
    {
        "source_id": "google_news:oregon_state_beavers",
        "source_type": "google_news",
        "url": "Oregon State Beavers football basketball -odds -betting -fantasy -DraftKings -FanDuel -props",
        "category": "sports",
        "display_name": "Oregon State Beavers News",
        "priority": 3,
    },
    {
        "source_id": "rss:kgw_sports",
        "source_type": "rss",
        "url": "https://www.kgw.com/feeds/syndication/rss/sports",
        "category": "sports",
        "display_name": "KGW Sports",
        "priority": 3,
    },
    {
        "source_id": "google_news:world_cup_portland",
        "source_type": "google_news",
        "url": "FIFA World Cup 2026 Portland Seattle",
        "category": "sports",
        "display_name": "World Cup 2026",
        "priority": 3,
    },
    # Official/publisher sports sources via Google News. Direct RSS from many
    # league sites is unreliable, so scope queries to source-owned domains.
    {
        "source_id": "google_news:nba_official",
        "source_type": "google_news",
        "url": 'site:nba.com "Portland Trail Blazers" OR "NBA Playoffs" OR "NBA Finals" -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "NBA.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:mlb_official",
        "source_type": "google_news",
        "url": 'site:mlb.com "Seattle Mariners" OR "World Series" OR MLB playoffs -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "MLB.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:nfl_official",
        "source_type": "google_news",
        "url": 'site:nfl.com "Seattle Seahawks" OR "Super Bowl" OR "NFL Playoffs" -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "NFL.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:bleacher_report_sports",
        "source_type": "google_news",
        "url": 'site:bleacherreport.com Portland Seattle sports "Trail Blazers" Seahawks Mariners Timbers Thorns -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "Bleacher Report Sports",
        "priority": 3,
    },
    {
        "source_id": "google_news:fox_sports",
        "source_type": "google_news",
        "url": 'site:foxsports.com Portland Seattle sports NBA NFL MLB MLS NWSL -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "FOX Sports",
        "priority": 3,
    },
    {
        "source_id": "google_news:olympics_official",
        "source_type": "google_news",
        "url": 'site:olympics.com Olympics "Team USA" Portland Seattle -odds -betting -fantasy',
        "category": "sports",
        "display_name": "Olympics.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:fifa_official",
        "source_type": "google_news",
        "url": 'site:fifa.com "FIFA World Cup 2026" Seattle Portland Vancouver -odds -betting -fantasy',
        "category": "sports",
        "display_name": "FIFA.com",
        "priority": 3,
    },
    # ESPN league-level feeds — cover every team in each league without
    # relying on team-specific RSS (those have been deprecated by ESPN and
    # by league official sites). Verified reachable 2026-04-22.
    {
        "source_id": "rss:espn_nba",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/nba/news",
        "category": "sports",
        "display_name": "ESPN NBA",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_nfl",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/nfl/news",
        "category": "sports",
        "display_name": "ESPN NFL",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_mlb",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/mlb/news",
        "category": "sports",
        "display_name": "ESPN MLB",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_nhl",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/nhl/news",
        "category": "sports",
        "display_name": "ESPN NHL",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_soccer",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/soccer/news",
        "category": "sports",
        "display_name": "ESPN Soccer",
        "priority": 3,
    },
]

PORTLAND_METRO_SOURCES: list[dict] = [
    # --- P1: Critical (safety/weather) ---
    {
        "source_id": "nws_alerts:portland_metro",
        "source_type": "nws_alerts",
        "url": "45.5152,-122.6784",
        "category": "weather",
        "display_name": "NWS Weather Alerts",
        "priority": 1,
    },
    # --- P2: Core (local news, events, seasonal) ---
    {
        "source_id": "rss:oregonlive_local",
        "source_type": "rss",
        "url": "https://www.oregonlive.com/arc/outboundfeeds/rss/category/portland/",
        "category": "local_news",
        "display_name": "OregonLive",
        "priority": 2,
    },
    {
        "source_id": "rss:kgw_local",
        "source_type": "rss",
        "url": "https://www.kgw.com/feeds/syndication/rss/news/local",
        "category": "local_news",
        "display_name": "KGW News",
        "priority": 2,
    },
    {
        "source_id": "rss:opb_news",
        "source_type": "rss",
        "url": "https://www.opb.org/arc/outboundfeeds/rss/?outputType=xml",
        "category": "local_news",
        "display_name": "OPB",
        "priority": 2,
    },
    {
        "source_id": "seasonal:pnw",
        "source_type": "seasonal",
        "url": None,
        "category": "seasonal",
        "display_name": "Pantopus Seasonal",
        "priority": 2,
    },
    # --- P3: Enrichment (community, sports) ---
    {
        "source_id": "google_news:trimet",
        "source_type": "google_news",
        "url": "TriMet Portland transit -crime -shooting -election",
        "category": "community_resource",
        "display_name": "TriMet Updates",
        "priority": 3,
    },
    {
        "source_id": "google_news:pdx_airport",
        "source_type": "google_news",
        "url": "PDX airport Portland updates",
        "category": "community_resource",
        "display_name": "PDX Airport Updates",
        "priority": 3,
    },
    {
        "source_id": "rss:oregon_metro",
        "source_type": "rss",
        "url": "https://www.oregonmetro.gov/metro-rss-feeds",
        "category": "community_resource",
        "display_name": "Oregon Metro",
        "active": False,
        "priority": 3,
    },
    {
        "source_id": "rss:city_portland",
        "source_type": "rss",
        "url": "https://www.portland.gov/news/rss",
        "category": "community_resource",
        "display_name": "City of Portland",
        "priority": 3,
    },
    {
        "source_id": "google_news:trail_blazers",
        "source_type": "google_news",
        "url": '"Portland Trail Blazers" ("NBA Playoffs" OR playoffs OR Spurs OR "Game 5" OR elimination) -odds -betting -fantasy -player props -DraftKings -FanDuel',
        "category": "sports",
        "display_name": "Trail Blazers News",
        "priority": 3,
    },
    {
        "source_id": "google_news:timbers",
        "source_type": "google_news",
        "url": "Portland Timbers -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Timbers News",
        "priority": 3,
    },
    {
        "source_id": "google_news:thorns",
        "source_type": "google_news",
        "url": "Portland Thorns -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Thorns News",
        "priority": 3,
    },
    {
        "source_id": "google_news:portland_fire",
        "source_type": "google_news",
        "url": "Portland Fire WNBA -wildfire -fire department -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Portland Fire News",
        "priority": 3,
    },
    {
        "source_id": "google_news:winterhawks",
        "source_type": "google_news",
        "url": "Portland Winterhawks -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Winterhawks News",
        "priority": 3,
    },
    {
        "source_id": "google_news:seahawks",
        "source_type": "google_news",
        "url": "Seattle Seahawks -odds -betting -fantasy",
        "category": "sports",
        "display_name": "Seahawks News",
        "priority": 3,
    },
    {
        "source_id": "google_news:mariners",
        "source_type": "google_news",
        "url": "Seattle Mariners -odds -betting -fantasy -DraftKings -FanDuel -picks",
        "category": "sports",
        "display_name": "Mariners News",
        "priority": 3,
    },
    {
        "source_id": "google_news:kraken",
        "source_type": "google_news",
        "url": "Seattle Kraken NHL -odds -betting -fantasy -DraftKings -FanDuel",
        "category": "sports",
        "display_name": "Kraken News",
        "priority": 3,
    },
    {
        "source_id": "google_news:sounders",
        "source_type": "google_news",
        "url": "Seattle Sounders -odds -betting -fantasy -DraftKings -FanDuel",
        "category": "sports",
        "display_name": "Sounders News",
        "priority": 3,
    },
    {
        "source_id": "google_news:oregon_ducks",
        "source_type": "google_news",
        "url": "Oregon Ducks football basketball -odds -betting -fantasy -DraftKings -FanDuel -props",
        "category": "sports",
        "display_name": "Oregon Ducks News",
        "priority": 3,
    },
    {
        "source_id": "google_news:oregon_state_beavers",
        "source_type": "google_news",
        "url": "Oregon State Beavers football basketball -odds -betting -fantasy -DraftKings -FanDuel -props",
        "category": "sports",
        "display_name": "Oregon State Beavers News",
        "priority": 3,
    },
    {
        "source_id": "google_news:world_cup_portland",
        "source_type": "google_news",
        "url": "FIFA World Cup 2026 Portland Seattle",
        "category": "sports",
        "display_name": "World Cup 2026",
        "priority": 3,
    },
    {
        "source_id": "rss:kgw_sports",
        "source_type": "rss",
        "url": "https://www.kgw.com/feeds/syndication/rss/sports",
        "category": "sports",
        "display_name": "KGW Sports",
        "priority": 3,
    },
    # Official/publisher sports sources via Google News. Direct RSS from many
    # league sites is unreliable, so scope queries to source-owned domains.
    {
        "source_id": "google_news:nba_official",
        "source_type": "google_news",
        "url": 'site:nba.com "Portland Trail Blazers" OR "NBA Playoffs" OR "NBA Finals" -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "NBA.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:mlb_official",
        "source_type": "google_news",
        "url": 'site:mlb.com "Seattle Mariners" OR "World Series" OR MLB playoffs -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "MLB.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:nfl_official",
        "source_type": "google_news",
        "url": 'site:nfl.com "Seattle Seahawks" OR "Super Bowl" OR "NFL Playoffs" -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "NFL.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:bleacher_report_sports",
        "source_type": "google_news",
        "url": 'site:bleacherreport.com Portland Seattle sports "Trail Blazers" Seahawks Mariners Timbers Thorns -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "Bleacher Report Sports",
        "priority": 3,
    },
    {
        "source_id": "google_news:fox_sports",
        "source_type": "google_news",
        "url": 'site:foxsports.com Portland Seattle sports NBA NFL MLB MLS NWSL -odds -betting -fantasy -DraftKings -FanDuel -props',
        "category": "sports",
        "display_name": "FOX Sports",
        "priority": 3,
    },
    {
        "source_id": "google_news:olympics_official",
        "source_type": "google_news",
        "url": 'site:olympics.com Olympics "Team USA" Portland Seattle -odds -betting -fantasy',
        "category": "sports",
        "display_name": "Olympics.com",
        "priority": 3,
    },
    {
        "source_id": "google_news:fifa_official",
        "source_type": "google_news",
        "url": 'site:fifa.com "FIFA World Cup 2026" Seattle Portland Vancouver -odds -betting -fantasy',
        "category": "sports",
        "display_name": "FIFA.com",
        "priority": 3,
    },
    # ESPN league-level feeds — see note in CLARK_COUNTY_SOURCES above.
    {
        "source_id": "rss:espn_nba",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/nba/news",
        "category": "sports",
        "display_name": "ESPN NBA",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_nfl",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/nfl/news",
        "category": "sports",
        "display_name": "ESPN NFL",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_mlb",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/mlb/news",
        "category": "sports",
        "display_name": "ESPN MLB",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_nhl",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/nhl/news",
        "category": "sports",
        "display_name": "ESPN NHL",
        "priority": 3,
    },
    {
        "source_id": "rss:espn_soccer",
        "source_type": "rss",
        "url": "https://www.espn.com/espn/rss/soccer/news",
        "category": "sports",
        "display_name": "ESPN Soccer",
        "priority": 3,
    },
]

_REGION_SOURCES: dict[str, list[dict]] = {
    "clark_county": CLARK_COUNTY_SOURCES,
    "portland_metro": PORTLAND_METRO_SOURCES,
}


def get_sources_for_region(region: str) -> list[dict]:
    """Return source configurations for the given region.

    Returns an empty list for unknown regions.
    """
    return list(_REGION_SOURCES.get(region, []))
