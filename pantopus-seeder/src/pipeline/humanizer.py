"""OpenAI API integration for rewriting raw content into curator tone."""

from __future__ import annotations

import calendar
import logging
import re
from datetime import date

try:
    import openai
except ImportError:
    openai = None  # type: ignore[assignment]

from src.config.constants import MAX_HUMANIZED_LENGTH

HUMANIZER_MODEL = "gpt-5.4-mini"
from src.sources.seasonal import get_active_seasons, is_tip_active

log = logging.getLogger("seeder.pipeline.humanizer")

def _build_system_prompt(region_display_name: str = "") -> str:
    """Build the system prompt, optionally tailored to a specific region."""
    area = region_display_name if region_display_name else "a local community"
    return (
        f"You are a community content curator for a local content platform in {area}. "
        "Your job has TWO parts:\n\n"
        "PART 1 — QUALITY GATE:\n"
        "First, decide if this content is worth sharing with local residents. "
        "Reply with exactly \"SKIP\" (nothing else) if the content is:\n"
        "- Not relevant or useful to people living in the area\n"
        "- Generic national/international news with no local angle\n"
        "- A simple listing, schedule, or standings page with no story\n"
        "- Clickbait, spam, or extremely low quality\n"
        "- About a city/region far away from the target area\n"
        "- Would make users think the app is buggy or low-effort\n\n"
        "PART 2 — WRITE THE POST (only if content passes the quality gate):\n"
        "Write a brief, engaging community update.\n\n"
        "Rules:\n"
        "- 2-3 sentences of factual content, slightly warm tone\n"
        "- Lead with the most actionable information (date, time, location, what to do)\n"
        "- Include specific details from the source\n"
        "- No exclamation marks unless genuinely exciting\n"
        '- No greetings ("Hey neighbors", "Good morning everyone")\n'
        "- No hashtags, no emoji\n"
        "- Never use first-person singular (I, my, me)\n"
        "- Do not editorialize or add information not present in the source\n\n"
        "SEASONAL TIMING: For seasonal posts, never recommend an action for a "
        "calendar window that is already earlier than Today's date. If the source "
        "is only useful for a missed window, reply exactly \"SKIP\".\n\n"
        "ENGAGEMENT: After the main content, add a short casual question on a new line "
        "to invite locals to share their experience or opinion. Keep it natural and "
        "relevant to the topic — not forced or generic. Examples:\n"
        '  "Anyone else notice this?" / "Have you tried this spot?" / '
        '"How are you preparing?" / "What route are you taking instead?"\n\n'
        'End with a source attribution on its own line: "Source: [name]"\n'
        "Do NOT include URLs in the source line — just the source name."
    )


# Keep a default for backward compatibility and tests
SYSTEM_PROMPT = _build_system_prompt()


def _build_sports_system_prompt(scope: str, region_display_name: str = "") -> str:
    """Conversation-first prompt for the Sports topic lane.

    The non-sports prompt tells the model to SKIP content that has no local
    angle — which is the right call for generic news but wrong for the
    national Sports lane (NBA Playoffs, World Cup, etc.). This override
    produces a short conversation starter instead of a news summary.
    """
    area = region_display_name if region_display_name else "a local community"
    if scope == "national":
        locale_note = (
            "This item is for the NATIONAL Sports lane: millions of users across "
            "the US will see the same post. Do NOT reject for lack of local angle.\n"
        )
        flavor_examples = (
            '  "Lakers vs Nuggets tonight. Anyone watching?"\n'
            '  "Chiefs-49ers Super Bowl this Sunday. Any pregame traditions?"\n'
            '  "World Cup quarterfinals start tomorrow. Who\'s your pick?"\n'
        )
    else:
        locale_note = (
            f"This item is for the LOCAL Sports lane in {area}. "
            "Frame the question around local watching, places, or community.\n"
        )
        flavor_examples = (
            '  "Blazers-Timberwolves tonight. Any good spots to watch around Vancouver?"\n'
            '  "Timbers playoff push — who\'s going to the home game?"\n'
            '  "Youth flag football signups are open. Anyone signing their kid up?"\n'
        )

    return (
        f"You are a community content curator for a local content platform. "
        f"{locale_note}\n"
        "PART 1 — QUALITY GATE:\n"
        "Reply exactly \"SKIP\" (nothing else) if the content is:\n"
        "- Clickbait, spam, gambling content, or extremely low quality\n"
        "- A dry standings/schedule dump with no storyline worth talking about\n"
        "- About something that already concluded more than 24 hours ago\n\n"
        "PART 2 — WRITE A CONVERSATION STARTER (not a news summary):\n"
        "Your output must be a short, casual post that invites discussion. "
        "It should read like something a neighbor might say, NOT like ESPN copy.\n\n"
        "Rules:\n"
        "- 1–2 sentences of context + a short question inviting replies\n"
        "- End with a clear question on its own line\n"
        "- Do NOT lead with scores. Final scores are only allowed if they are part "
        "of a question (e.g., \"Warriors just blew a 20-point lead — anyone else watching?\")\n"
        "- No betting/gambling framing\n"
        "- No hashtags, no emoji, no exclamation spam\n"
        "- Never use first-person singular (I, my, me)\n"
        "- Do NOT include a source attribution line for sports posts\n\n"
        "Examples:\n"
        f"{flavor_examples}"
    )

_GREETING_PATTERNS = re.compile(
    r"^\s*(?:hey|hello|hi|good morning|good evening|greetings)\b",
    re.IGNORECASE,
)

# Match first-person "I" followed by a verb/contraction, with both straight
# and curly (Unicode \u2019) apostrophes. The negative lookbehind prevents
# matching words like "AQI" or "AI".
_FIRST_PERSON_PATTERNS = re.compile(
    r"(?<![A-Za-z])"
    r"I"
    r"(?:\s|['\u2019]m|['\u2019]ve|['\u2019]d)"
)


_PNW_KEYWORDS = {"portland", "vancouver", "seattle", "tacoma", "eugene", "salem",
                  "olympia", "bend", "spokane", "boise", "clark_county",
                  "portland_metro", "wa", "or", "id"}


def _is_pnw_region(region: str) -> bool:
    """Check if a region slug likely refers to a Pacific Northwest area."""
    parts = set(region.lower().replace("-", "_").split("_"))
    return bool(parts & _PNW_KEYWORDS)


def _get_current_seasons() -> list[str]:
    """Return names of currently active PNW seasons."""
    today = date.today()
    return [s["name"] for s in get_active_seasons(today.month, today.day)]


_NO_CONTENT_PATTERNS = re.compile(
    r"no\s+(local|relevant|available|update|information|content|news|sports)",
    re.IGNORECASE,
)

_MONTH_RE = (
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"
)
_MONTH_PATTERN = re.compile(rf"\b(?P<month>{_MONTH_RE})\b")
_QUALIFIED_MONTH_PATTERN = re.compile(
    rf"\b(?P<qualifier>[Ee]arly|[Mm]id|[Ll]ate)(?:[-\s]+in\s+|[-\s]+)(?P<month>{_MONTH_RE})\b"
)
_BEFORE_MONTH_PATTERN = re.compile(
    rf"\b[Bb]efore\s+(?:the\s+)?(?P<month>{_MONTH_RE})\b"
)

_MONTH_TO_NUMBER = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _validate_output(text: str) -> str | None:
    """Validate humanized text. Returns None if valid, or a rejection reason."""
    if not text:
        return "empty"

    if len(text) > MAX_HUMANIZED_LENGTH:
        return f"too_long:{len(text)}"

    if text.count("!") > 1:
        return "too_many_exclamations"

    greeting_match = _GREETING_PATTERNS.match(text)
    if greeting_match:
        return f"greeting:{greeting_match.group().strip().lower()}"

    if _FIRST_PERSON_PATTERNS.search(text):
        return "first_person"

    if _NO_CONTENT_PATTERNS.search(text):
        return "no_content_placeholder"

    return None


def _month_number(month_name: str) -> int:
    """Convert a month name or abbreviation to its 1-indexed month number."""
    return _MONTH_TO_NUMBER[month_name.lower()]


def _month_has_passed(month: int, today: date) -> bool:
    """Return whether an unqualified month reference is already behind today."""
    # Winter-season copy can mention the prior December while the current date
    # is January/February; treat that December as elapsed, not eleven months away.
    if today.month in (1, 2) and month >= 11:
        return True
    return month < today.month


def _qualified_month_has_passed(qualifier: str, month: int, today: date) -> bool:
    """Return whether a phrase such as 'early March' is stale."""
    if _month_has_passed(month, today):
        return True
    if month != today.month:
        return False

    qualifier = qualifier.lower()
    if qualifier == "early":
        cutoff_day = 10
    elif qualifier == "mid":
        cutoff_day = 20
    else:
        cutoff_day = calendar.monthrange(today.year, month)[1]

    return today.day > cutoff_day


def _validate_seasonal_timing(text: str, today: date | None = None) -> str | None:
    """Reject seasonal copy that points users at an elapsed calendar window."""
    current = today or date.today()

    for match in _QUALIFIED_MONTH_PATTERN.finditer(text):
        month = _month_number(match.group("month"))
        if _qualified_month_has_passed(match.group("qualifier"), month, current):
            return f"stale_calendar_window:{match.group(0)}"

    for match in _BEFORE_MONTH_PATTERN.finditer(text):
        month = _month_number(match.group("month"))
        if month == current.month or _month_has_passed(month, current):
            return f"stale_calendar_window:{match.group(0)}"

    month_refs = [_month_number(m.group("month")) for m in _MONTH_PATTERN.finditer(text)]
    if month_refs and all(_month_has_passed(month, current) for month in month_refs):
        return "stale_calendar_month"

    return None


def _validate_humanized_text(
    text: str,
    category: str,
    today: date | None = None,
) -> str | None:
    """Validate humanized text, including category-specific safety checks."""
    reason = _validate_output(text)
    if reason is not None:
        return reason

    if category == "seasonal":
        return _validate_seasonal_timing(text, today)

    return None


def humanize(
    raw_title: str,
    raw_body: str | None,
    source_url: str | None,
    source_display_name: str,
    category: str,
    region: str,
    openai_api_key: str,
    region_display_name: str = "",
    scope: str = "local",
) -> tuple[str | None, str | None]:
    """Rewrite raw content into a 2-4 sentence community update post.

    Returns (humanized_text, error_reason). On success error_reason is None.
    On failure humanized_text is None and error_reason explains why.

    For category='sports', a conversation-first prompt is used; `scope` can be
    'national' or 'local' (default 'local') and controls the prompt flavor.
    """
    if openai is None:
        return None, "api_error:openai package not installed"

    today = date.today()
    if category == "seasonal":
        if not is_tip_active(raw_title, today.month, today.day):
            log.info(
                "Seasonal source window gate rejected: %s",
                raw_title[:60],
            )
            return None, "ai_quality_gate:skipped"

        source_timing_reason = _validate_seasonal_timing(
            f"{raw_title}\n{raw_body or ''}",
            today=today,
        )
        if source_timing_reason is not None:
            log.info(
                "Seasonal timing gate rejected (%s): %s",
                source_timing_reason,
                raw_title[:60],
            )
            return None, "ai_quality_gate:skipped"

    today_str = today.isoformat()

    # Include seasonal context only for PNW regions
    season_line = ""
    if _is_pnw_region(region):
        seasons = _get_current_seasons()
        season_str = ", ".join(seasons) if seasons else "none"
        season_line = f"Current PNW season: {season_str}\n"

    display = region_display_name or region
    user_message = (
        f"Category: {category}\n"
        f"Region: {display}\n"
        f"{season_line}"
        f"Today's date: {today_str}\n\n"
        f"Title: {raw_title}\n"
        f"Body: {raw_body or 'Not available'}\n"
        f"Source URL: {source_url or 'Not available'}\n"
        f"Source name: {source_display_name}"
    )

    if category == "sports":
        system_prompt = _build_sports_system_prompt(scope, region_display_name)
    else:
        system_prompt = _build_system_prompt(region_display_name)

    try:
        client = openai.OpenAI(api_key=openai_api_key)
    except Exception as exc:
        return None, f"api_error:{exc}"

    messages = [{"role": "user", "content": user_message}]

    # First attempt
    text, api_err = _call_api(client, messages, system_prompt)
    if api_err:
        return None, api_err

    # AI quality gate — model returns "SKIP" for low-quality content
    if text and text.strip().upper() == "SKIP":
        log.info("AI quality gate rejected: %s", raw_title[:60])
        return None, "ai_quality_gate:skipped"

    reason = _validate_humanized_text(text, category)
    if reason is None:
        return text, None

    # Retry once
    log.info("Humanizer validation failed (%s), retrying: %s", reason, raw_title[:60])
    messages.append({"role": "assistant", "content": text})
    messages.append({
        "role": "user",
        "content": (
            f"The previous output was rejected: {reason}. Please rewrite more concisely, "
            "following all rules strictly. 2-3 sentences maximum, no greetings, no first person, "
            "and no recommendations tied to calendar windows that have already passed."
        ),
    })

    text2, api_err2 = _call_api(client, messages, system_prompt)
    if api_err2:
        return None, api_err2

    reason2 = _validate_humanized_text(text2, category)
    if reason2 is None:
        return text2, None

    return None, f"validation_failed:{reason2}"


def _call_api(client, messages: list[dict], system_prompt: str = "") -> tuple[str | None, str | None]:
    """Call OpenAI and return (text, error). error is None on success."""
    try:
        # Prepend system message to the conversation
        full_messages = [{"role": "system", "content": system_prompt or SYSTEM_PROMPT}]
        full_messages.extend(messages)

        response = client.chat.completions.create(
            model=HUMANIZER_MODEL,
            max_completion_tokens=300,
            messages=full_messages,
        )
        text = (response.choices[0].message.content or "").strip()
        if not text:
            return None, "empty_response"
        return text, None
    except Exception as exc:
        log.warning("OpenAI API error: %s", exc, exc_info=True)
        return None, f"api_error:{exc}"
