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

## Findings from the review, and what was done (second pass, same day)

Web
- Mobile web now has a bottom tab bar (`MobileTabBar`, Place · Today · Nearby · Mail) below
  the md breakpoint; floating buttons lift above it via `--fab-lift`. Fixed.
- The privacy mirror never falls back to a username: `neighborFacingName` returns the first
  name or nothing, so the card reads "A resident". Fixed on the shared serializer (all three
  clients).
- Place folds two or more empty sections in a group into one "Coverage is expanding here"
  row that names them. Fixed.
- Today no longer repeats the seasonal tip: the summary skips `seasonal` signals, the green
  banner yields to the signal card, and the label is sentence case ("Smoke season"). Fixed.
- Still open: three brand marks (design call); the household calendar route is not the
  address calendar (product call); the web Nearby basemap needs tiles online.

iOS
- The "session expired" banner clears on dismiss (`AuthManager.sessionEndReason` reset), so
  it does not come back on the next login screen. Fixed.
- Sign-up asks "Discard changes?" only once someone has typed (`SignUpViewModel.hasInput`). Fixed.
- The Place dashboard paints the app background behind the status bar. Fixed.
- Still open: the Today tab is the hub briefing (product call).

Android
- Nested top app bars (list-of-rows, My businesses, Resources) no longer add a second
  status-bar inset on top of the root Scaffold's; the Mailbox title sits where it should. Fixed.
- The signed-out start screen pads the status bar. Fixed.
- Still open: `MAPS_API_KEY` for the Nearby basemap (founder); the legend wraps at 360dp.

## Design pass in code (same day, after the review)

Built directly on web, SwiftUI and Compose from the prompts in
`docs/claude-design-prompts-2026-09-02.md`; only the brand mark is left for
Claude Design.

- **Start page** (all three): brand and a quiet country label in the top bar;
  headline; the address field and button; then the privacy proof line
  ("Neighbors see a first name and a street. Never your house number.") and a
  static, labeled example card in the dashboard's row grammar. Web goes
  two-column at `lg` and shows "From the card in your mailbox" on `/start?r=`.
- **First-week card** (all three; new on iOS): a header band in the home tint
  with a progress bar, one-line payoffs, a check per step, "Set your pickup
  day" ticking itself from the calendar, a one-line retired state at five of
  five, and "Not new here" to dismiss. iOS now decodes `move_in_date` and reads
  the home detail next to the intelligence.
- **Android Nearby**: legend in two columns at every width; when the build has
  no Maps key the card draws the 5×5 cells flat on the app surface instead of
  a blank map.
- **Today tab**: iOS gets its own screen (`AddressTodayTabView`) for the
  primary place — weather, good-day chips, the address calendar, air, alerts,
  sun — with a claim card when there is no place; the hub briefing stays
  behind the morning-push deep link. The content order and the "At this
  address" label match on iOS and Android, and the "Coming soon" block is gone
  from both.
