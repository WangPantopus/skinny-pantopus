# First-launch scope flags (2026-10-01)

For the first launch the founder cut eight features (direction of 2026-09-27; see the "LAUNCH SCOPE" block in the
coordination hub). They are **hidden behind flags, not deleted**: every screen, route, API, job and test is still in the
code, and any feature comes back by switching its flag on. This document says what each flag hides, how to switch one
back on, and the calls that were made while hiding them.

## The switches

One key list is shared by all four codebases. A feature is **off** unless its key is listed; `all` switches every
feature on.

| Key | Cut | What it hides |
|---|---|---|
| `beacon` | 1. Beacon and creator tools | Beacon pages and the Beacons feed, following publishers, audience management and the Audience bell/stream, creator inbox, broadcasts, membership tiers, Beacon push settings |
| `personas` | 2. Personas and identity switching | Persona pages, the identity "Switch"/Identity Center and View-as, persona DMs, the web "Professional" profile (with `open_gigs`) |
| `marketplace` | 3. Marketplace | Listings (browse, detail, create, Snap & sell), offers and trades, My Listings, saved listings, Market chat filter and listing cards, Items on maps, the receipt's Marketplace stats |
| `open_gigs` | 4. Open Gigs marketplace | Posting tasks for bids (every composer, Hire help, Post task, checklist Hire, Ask a neighbor), browse/search/map, bids, offers and counters, task Q&A, My bids, Tasks widgets, the rebook rail. **Kept:** task detail and lifecycle for tasks you are part of, My tasks, payments, tips |
| `public_scheduling` | 5. Public scheduling | Every Scheduling entry, booking pages, event types, availability, team scheduling, My bookings, booking reminders. **Kept:** invoices, packages and payouts screens; the scheduling engine |
| `business_directory` | 6. General business directory | Discover businesses, business search results and filters, the business map layer, the Discover hub (needs #3 and #4 too). **Kept:** business pages by link, creating and running a business |
| `household_extras` | 7. Household extras | Home bills, packages, pets, polls and the family calendar (tiles, tabs, cards, "+" actions, reminders, Today/Hub rows, activity rows, notification toggles). **Kept:** Place bill benchmark and its opt-in, the address calendar, health score, tasks, issues, documents, emergency, access, guests, members |
| `mail_extras` | 8. Mail extras | Writing letters (Compose / Write a letter / Send mail), ceremonial letters, certified mail and e-signing, Family Mail Party, community mail, mail event invitations, translations. **Kept:** the mailbox with postcards, welcome cards and the digest, vacation hold, Mail Day |

A surface that belongs to two cut features shows only when **both** are on.

## Switching a feature back on

List its key (comma-separated, or `all`) in each place, then redeploy / rebuild:

| Codebase | Setting | Where it is read |
|---|---|---|
| Backend | env `LAUNCH_FEATURES` | `backend/utils/featureFlags.js` (`isLaunchFeatureEnabled`) |
| Web | env `NEXT_PUBLIC_LAUNCH_FEATURES` (inlined at build) | `frontend/apps/web/src/lib/featureFlags.ts` (`launchFeatures`) |
| iOS | build setting `PANTOPUS_LAUNCH_FEATURES` (Config/*.xcconfig → Info.plist `PantopusLaunchFeatures`); Debug builds also read the env var | `Pantopus/Core/Environment/LaunchFeatures.swift` |
| Android | `PANTOPUS_LAUNCH_FEATURES` in the build's `.env` or environment (→ BuildConfig) | `app/src/main/java/app/pantopus/android/core/LaunchFeatures.kt` |

Example: `LAUNCH_FEATURES=marketplace` on the backend plus the same key in the web, iOS and Android builds brings the
Marketplace back everywhere. Switch the backend first so notifications and feeds return before the screens do.

Tests run with every feature on (`backend/jest.config.js`, `frontend/apps/web/tests/setup.ts`, and
`LaunchFeatures.overrideForTesting` in the native unit tests), so the kept code stays covered.

## How the hiding works

- **Entry points** (nav items, tabs, menus, tiles, buttons, FAB actions, cards, prompts) check the flag.
- **Direct entry** is turned away: web middleware sends hidden app pages to `/app/place` and hidden public pages to
  `/`; native deep links and pushes into a hidden screen are dropped or land on the existing "not in the app yet"
  placeholder; route guards catch any other stray link.
- **Server-composed content:** notification types only a cut feature produces are not created and are left out of
  lists and badge counts; Hub, Home dashboard, Today/briefing and Home activity feeds leave out cut items; senders that
  exist only for a cut feature (bill and calendar reminders, the no-bid nudge, the urgent-task push, booking reminders)
  are skipped; the AI assistant neither offers nor drafts listings or open tasks.
- **No API route returns 404 for a cut feature:** the clients hide the UI, and shared endpoints serve kept features.

## Calls made while hiding (founder's standing instruction: take the recommended option and record it)

1. **Rebook rail hidden whole** while `open_gigs` is off: its only action, "Rebook", opens the open-task composer
   for the old task's category, and posting it opens the task to every bidder; it does not book the same helper.
   The "rebooking a known crew" that replaces Open Gigs is the repeat Crew Day of the street-organizer design
   (`docs/product/street-organizer-design-2026-09-27.md`), which is not built yet. Rejected: a rail of helpers with
   no action (dead UI under "Rebook a favorite helper"). The 2026-09-27 verification map kept the rail in scope;
   it comes back with `open_gigs`, or with a direct-rebook action once one exists.
2. **Mail of a cut kind reads as plain mail** (certified, ceremonial, community, party invitation): it is mail the user
   received, so only the cut controls (sign, RSVP, translate, Mail Party) are hidden; iOS no longer sends a ceremonial
   letter to its hidden reader.
3. **Discover hub** needs `business_directory`, `open_gigs` and `marketplace`: it is rails of businesses, open tasks
   and listings. People/profile search stays.
4. **Task stepper** reads "Open → Assigned" instead of "Bidding → Bid Selected" and drops "Compare Bids".
5. **Booking reminders** are skipped; the job's completion sweep (scheduling engine state) keeps running.
6. **Invoices, packages and payouts** are never gated, even where they sit under Scheduling routes.
7. **Home activity feeds** (dashboard recent activity, timeline) leave out bill, package, pet, poll and calendar
   records; the Members & Security audit log keeps every row.
8. **Marketing and legal pages** (landing, about, terms, privacy) are unchanged.
9. **The mailbox itself stays**, with My Mail Day, the vault and the Stamps gallery: they cover all received mail
   (stamps are earned from any mail, packages, the vault and mail tasks), not only letters. Only their letter
   controls go (Write a letter, the Stamps dock's "Send mail"). The 2026-09-27 verification map counted Mail Day and
   Stamps as letter-only; switching them off is a small follow-up if wanted.
10. **Bill trends on the Home dashboard stays** (read-only, with the neighborhood benchmark and its opt-in): bills
   stay as the input to bill explanation. Adding, editing and tracking bills is hidden.

## Known limits

- Data created before the cut (an old listing, bid or bill) stays in the database; it is not shown, but it is not
  deleted either.
- Native apps read the switches at build time, so bringing a feature back to phones needs a new app build.
