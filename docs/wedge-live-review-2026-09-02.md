# Wedge live review — web, iOS, Android (2026-09-02)

Reviewed against a local stack: local Supabase (schema + migrations 030–198),
backend on :8000, web on :3000, iPhone 17 simulator, Android API 34 emulator.
One review account (review@example.com), one verified home in Camas, 25 seeded
Nearby cells, 3 mail items. No cloud project was touched.

## What works end to end

- Web: Place (setup banner, JustMovedCard, pulse, sections), Today, Nearby cell grid
  with the home cell outlined and the 17/24 progress, Mailbox with drawers, privacy mirror.
- iOS: Place, Today briefing, Today detail with the address calendar, Nearby (Apple Maps
  grid), Mail (Mailbox | Messages), privacy mirror.
- Android: login, Place, Today (live NWS weather + "good day to"), Nearby, Mail, privacy mirror.

## Bugs fixed during the review (committed)

1. Address calendar rules seeded twice (backend + supabase mirror folders) showed every
   line twice. Migration 198 dedupes and adds a partial unique index; the service also
   dedupes by kind|date|title so a stray duplicate can never reach a card.
2. Android login crashed on first login after email-only sign-up: Moshi rejected
   `user.name = null`. `AuthenticatedUser` name fields are now nullable; a decoding test
   covers null and missing keys.

## Findings still open (design / UX)

Web
- Mobile web hides the four tabs behind the hamburger; there is no bottom tab bar. The IA
  that native gets on day one is invisible on mobile web.
- The privacy mirror shows the username (`review_c99a41`) when there is no first name.
  Show "A neighbor" or the first name only.
- Place is a long scroll where sparse coverage reads as a wall of "Not available for your
  area yet". Collapse unavailable sections into one "Coverage is expanding" row.
- The aha card ("Just moved in?") is a list, not a hero. Web Today repeats the same
  wildfire-smoke tip three times (summary, banner, signals).
- `/app/homes/:id/calendar` is the household event calendar, not the address calendar;
  the address calendar only lives on the Today detail. Link it from Today on web.
- Three brand marks: green pin (start), blue grid wordmark (web auth), blue house (native auth).
- The web Nearby basemap is blank behind the grid (no tiles offline); the grid still reads.

iOS
- Stale "Your session has expired" banner on first launch of a fresh install.
- "Discard changes?" on an untouched signup form (`isDirty` starts true).
- Today tab is the hub briefing (fake "3 members" copy, lowercase "smoke season" label),
  the real address calendar is one tap deeper.
- Dashboard content scrolls under the status bar.

Android
- Header text overlaps the status bar on the start screen (no top inset).
- Nearby map is blank: no `MAPS_API_KEY` in the debug build, so the cell overlays have no
  basemap. The legend wraps awkwardly at 360dp.
- Mailbox has a ~70dp empty gap above the title.
- Only the "Me" drawer shows on landing; home and business mail need a drawer tap.

## Recommendation

Fix in this order: mobile-web tab bar, mirror name fallback, Android status-bar inset and
Mailbox gap, iOS session banner + signup dirty flag, then the Place coverage collapse.
