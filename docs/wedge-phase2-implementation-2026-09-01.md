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

## Phase 2b — the channels (same day, second slice)

### D5 — Founding Neighbor tier, the deadline, the share card, movers, route capture
- **Founding tier** (`services/place/foundingWindow.js`, new): the first **5** verified homes in a geohash-6 cell, taken within **21 days** of the cell's first founder — derived from the permanent Block Founder rows, never stored, so it cannot drift. `getBlockStatus` now returns `founding { is_founding, slot, slots_total, slots_taken, slots_open, window_open, window_ends_at }`; web `FoundersCard` and the iOS rank card show "Founding Neighbor · slot N of 5. Permanent." or "N slots still open · closes in D days". The rank stays unbounded (Block Founder #N) — the tier is the scarce part. The 0% marketplace fee named in v1 is **not** wired: there is no marketplace fee code to exempt yet (only persona 10% and business-entity defaults).
- **The preview stops over-promising.** `placePreviewService.previewDensityLabel(bucket, foundingOpen)`: the anonymous density card prints "Founding Neighbor slots are open here" only while the cell's window genuinely has open slots (`foundingSlotsOpen`, a boolean, never a count); otherwise "Be one of the first verified here". The routed `public.js` reads it in the fan-out.
- **Share card.** `/api/og/place?address=…` (Next `ImageResponse`, edge) renders "What's true about {address}": the aha headline and grade plus flood / wildfire / air / radon chips, straight from the anonymous preview — nothing stored. `/start?address=…` now carries `generateMetadata` (og:image, `summary_large_image`, `noindex`) and the funnel resolves an `?address=` deep link into the preview (first autocomplete suggestion). A "Share this address" link (Web Share, clipboard fallback) sits in the wall bar; the browser URL is never rewritten.
- **Route capture.** `/start?r=<route>` (EDDM cards, invite postcards) is remembered per browser (`rememberFunnelRoute`) and stamped into `meta.route` on every funnel beacon, so route-level CAC reads straight from `FunnelEvent`.
- **Movers first.** The claim wizard's move-in date gains a one-tap "Just moved here"; the Place dashboard shows `JustMovedCard` for ~60 days after a move-in: pickup day, the previous resident's mail, utilities/rebates, districts/schools, meet the block. No new columns (`Home.move_in_date` already existed and is returned by `HOME_DETAIL = '*'`).

### Evidence deletion after review (Phase 1.5 follow-up, closed)
- `services/evidencePurge.js` deletes the S3 object of every claim document on **approve / reject** (`routes/admin.js`) and on **withdrawal** (`routes/homeOwnership.js`), stamping `metadata.purged_at` / `purge_reason` and nulling `storage_ref`; rows stay for the audit trail. Non-S3 refs are skipped; a failed delete is left unstamped for a retention sweep. The privacy promise now says "…and deleted once your claim is decided" on the wall, the claim step, and both residency pages.

### Verification (2b)
- Backend: `tests/unit/foundingWindow.test.js` (5), `tests/unit/evidencePurge.test.js` (3), preview label cases; full suite **262 suites / 4135 tests**, privacy gates OK.
- Web: jest **60 suites / 716 tests**, lint 0 errors, no type errors in any 2b file.
- iOS: `make build` **BUILD SUCCEEDED** (the local simulator set had been emptied mid-session; an iPhone 17 on iOS 26.5 was recreated with `xcrun simctl create`); SwiftLint clean on touched files.

## Open, in priority order
1. **D5 leftovers needing the founder** — agents' closing-gift kit (a "claim invite link" build is small once the kit exists), HOA / PTA / City onboarding, the EDDM drop itself (the route capture is ready), the Camas business walk (then local offers get a surface).
2. **Reconcile the two meters** — one source of truth for "the block": the Nearby door (k-anon 10, unlock 24) vs Block Founders (raw count, 10/10/25, T4). A product call.
3. **Name the thing once** — "Block Founder #N" for the rank and "Founding Neighbor" for the first-5 tier are now consistent; the 10-referral profile badge still says "Founding Neighbor Badge" (`inviteRewardService.js`, iOS/Android ProfileInsightCards) and should be renamed.
4. **0% marketplace fee for Founding Neighbors** — wire when a marketplace fee exists.
5. **Calendar feeds** — permit hearings and council agendas as adapters; confirm the Camas waste schedule and flip those rows to `official`.
6. **Place privacy mirror** (task chip) and a **retention sweep** for any evidence object whose delete failed.
7. **Android** — tabs, residency door, calendar card, founding tier, Just-moved card.
