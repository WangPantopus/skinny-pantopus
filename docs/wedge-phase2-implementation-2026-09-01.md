# Wedge Phase 2 — "Prize & loop" implementation record · 2026-09-01

Implements the first slice of Phase 2 of the repositioning plan ("The
Pantopus Wedge" v2, decisions D3–D6), after four PRs from the old
repository were ported onto this master (362 → 358 → 357 → 351/352 →
353 → 268). PR 353 ("Place: Waves 1–5") changed the Phase 2 board, so
this record starts with the reconciliation.

## Reconciliation: what PR 353 already delivered against D3–D6

| Decision | Status after 353 | Evidence |
|---|---|---|
| **D3** two verification doors | **Not delivered.** 353 added six new *reasons* to verify (Residency Pass, Fridge Card, Block Founder, Real Rent, rate watch) and consolidated the T4 gate into `utils/homePermissions.isVerifiedResident`, but no residency document door, no review alert, and the web "Upload a document" method routed renters into the **ownership** claim flow (`claim_type: 'owner'` hardcoded), where the rental firewall blocked them. | `VerifyPromptSheet.tsx`, `claim-owner/evidence/page.tsx:92`, `utils/homeSecurityPolicy.js` |
| **D4** prize reframe | **Two of three outcomes.** Proof of residence = residency letter (pre-existing) + Residency Pass + Block Founder rank (353). "Kill the junk" only in its digital half (Unlisted, data brokers). Local business offers: nothing. The *framing* on the verify sheets and the ceremony still advertised the pre-353 trio. | `routes/residencyClaims.js`, `routes/unlisted.js`, `services/blockFoundersService.js` |
| **D5** channels | **Engine delivered, channels not.** Lob invite postcards with sanitizers, 90-day recipient dedup, permanent opt-out, unbounded permanent ranks, three unlock meters — all built. Missing: movers, agents' kit, HOA/PTA/City units, share card, first-5 + 21-day deadline, EDDM route QR. Note: invites run on `homeOutboundLimiter` (20/h) + a 3/week cap, **not** `postcardLimiter`. | `routes/blockFounders.js`, `middleware/rateLimiter.js:90-125` |
| **D6** address calendar | **Not delivered.** Both clients shipped a "Trash & recycling — coming soon" placeholder row. `civic_election` (next election + `days_until`) and `alerts` are adjacent. | `TodayDetail.tsx:595`, `PlaceTodayDetailContent.swift:77` |

Three things the reconciliation surfaced that are decisions, not bugs:
1. **Two meters on one substrate.** The Nearby door meter (`GET /api/neighborhood/meter`, geohash-6, k-anon floor 10, unlock 24) and the Block Founders meters (`GET /api/homes/:id/block-founders`, same cell, 10/10/25, T4-only, raw count) read the same `NeighborhoodPreview` table with different thresholds and privacy rules.
2. **Three "Founding Neighbors".** A 10-referral profile badge (`inviteRewardService.js`), 353's unbounded permanent Block Founder rank, and the Phase 1.5 density label *"Founding Neighbor slots are open here"* which promises slots the rank system never rations.
3. **The Scout page's privacy claim** ("we did not tell anyone you looked") was fixed by 353 itself; keep that discipline for anything new on the anonymous surfaces.

## What shipped in this slice

### D3 — Two verification doors, equal billing
- **Backend.** `utils/homeSecurityPolicy.canSubmitResidencyClaim` — a residency-claim eligibility check without the owner-only gates (no rental firewall, no challenge routing, no owner quota; keeps active/frozen checks, a 5-per-30-days cap, the rejection cooldown, and one active residency claim per user per home, returned so evidence can attach). `routes/homeOwnership.js` branches on `claim_type === 'resident'`: opaque response like the owner path, an unverified occupancy becomes **`pending_doc`** (the Waiting Room reads "Document under review"; provisional access is never demoted), and the founder is emailed. `services/adminAlerts.js` (new): one email per claim to `ADMIN_ALERT_EMAIL` with a link to `/app/admin/review-claims`, city but never the address in the subject; no-op when unset. Admin approval needs no change — `routes/admin.js` already handles `claim_type='resident'` and ends in `attach({method:'admin_override'})` → verified.
- **Fraud parity for the fast door.** `routes/upload.js`: the evidence upload limiter is now keyed per **user** and runs after auth (20 per 15 min); the duplicate-hash check is widened from per-claim to **per-home** ("This document has already been submitted for this address.").
- **Web.** New `/app/homes/[id]/verify-residency` (+ `/submitted`): `claim_type 'resident'`, documents = utility bill / lease / government ID, no challenge routing, honest latency copy ("a person reviews it, usually within hours"). `VerifyPromptSheet`: **document door first**, postcard "3–7 days. Yours to keep.", landlord third; default = document; footer prices both doors. Waiting Room's "Upload proof" and both landlord-flow fallbacks route to the residency door. `claim-owner/evidence` stays for owners.
- **iOS.** `PlaceVerifyFlow.swift`: methods are `document · mail · landlord` (the "match property records" mock is gone); the sheet's Start now pushes the **real** screens (`.verifyResidency` wizard, `.postcardVerification`, `.verifyLandlord`) instead of the simulated status view, which remains for previews only.

### D4 — The prize, framed
- Verify-sheet benefits (web + iOS) and the verified ceremony rows now name the unlocks that exist: **proof you live here** (badge, residency letter, Residency Pass), **your mailbox and your rank** (mailbox, permanent Block Founder number), **what only verified neighbors see** (Real Rent, neighbor messages, Fridge Card, rate watch). Local offers and physical junk-mail suppression remain open (below).

### D6 — The address calendar (the one build inside the freeze)
- **Registry.** Migration `195_address_calendar_rules.sql` (mirrored to `supabase/migrations/20260901000002_…`): `AddressCalendarRule` — scoped rules (`state` / `county` / `city` / `home`), RFC 5545 `rrule` + `dtstart`, `lead_days`, `source`, and an honest `confidence` (`official` | `unverified`). Seeded: Washington property-tax dates (official, RCW 84.56.020), Camas council + garbage + recycling defaults (**unverified** until confirmed with the city).
- **Service.** `services/addressCalendarService.js` expands rules with the `rrule` package into the next 14 days for a home; **narrowest scope wins per kind** (a household's pickup day replaces the city default); `needs_pickup_day` flags a city default. `setPickupDay` / `clearPickupDay` write home-scoped rules.
- **Section + route.** `address_calendar` is a Band A section in the `today` group (serializer, shared types, iOS DTOs). `routes/addressCalendar.js`: `GET /api/homes/:id/calendar`, `PUT|DELETE /api/homes/:id/calendar/pickup-day` (any active member).
- **The push.** `usefulnessEngine.generateAddressCalendarSignals` turns events inside their lead window into briefing signals — a pickup or tax date scores above the interrupt bar (`COST_OF_INACTION.address_calendar = 0.60`), a council meeting or hearing stays a quiet line; the orchestrator fetches the calendar alongside the internal context for the Hub, the morning and the evening briefing, and `address_calendar` counts as a primary signal.
- **Web.** `presentation.tsx` config ("At this address"); `TodayDetail` renders `AddressCalendarCard` (dated list, unconfirmed hedge, **pickup-day picker** that invalidates the dashboard query) in place of the placeholder row.
- **iOS.** DTOs, `AddressCalendarEndpoints` (in `HomesEndpoints.swift` to avoid a pbxproj entry), `PlacePresentation` config/format, and an `AddressCalendarCard` with the same picker in `PlaceTodayDetailContent.swift`.

## Verification
- Backend: `tests/unit/residencyDoor.test.js` (7), `tests/unit/addressCalendar.test.js` (14, incl. the briefing signals), hub suite stubbed for the calendar; full suite **259 suites / 4125 tests passed**, 1 payments test flaky under load and green alone; all privacy gates OK.
- Web: jest 60 suites / 716 tests; lint 0 errors; no type errors in any Phase 2 file (the new pages are null-safe by construction).
- iOS: `make build` (from `frontend/apps/ios`) **BUILD SUCCEEDED**; SwiftLint clean on touched files (length directives on the two presentation files that grow by design).

## Open, in priority order
1. **D5 channels** — first-5 Founding Neighbor tier + 21-day slot deadline on top of the Block Founder rank (and make the Phase 1.5 density label conditional on open slots); the share card; "Just moved?" at claim; EDDM route capture on `/start?r=`; the agents' closing-gift kit and HOA/City onboarding are founder work with a small "claim invite link" build.
2. **Reconcile the two meters** — one source of truth for "the block": pick the Block Founders thresholds or the door's, and one privacy rule.
3. **Name the thing once** — "Block Founder #N" for the rank; retire or rename the 10-referral badge.
4. **D4 leftovers** — local offers need supply (the Camas walk) before a surface; physical junk-mail suppression (DMAchoice/OptOutPrescreen guidance) can join Unlisted.
5. **Calendar feeds** — Clark County permit hearings and Camas council agendas as adapters; confirm the Camas waste schedule and flip those rows to `official`.
6. **Evidence deletion after review** and the Place privacy mirror (task chips from Phase 1.5).
7. **Android** — port the tab IA, the residency door, and the calendar card.
