# Pantopus next steps

Founder checklist, in build order. Check items off as they ship. Started September 16, 2026.

Sources: the [design docs review](https://claude.ai/code/artifact/09276a14-1587-41be-86ef-54e95505d2d8),
the [idea ledger](https://claude.ai/code/artifact/51f601e7-1e56-416e-b549-fbd036e421ba) (every idea with
effort and priority), and the [Wedge v2 strategy](https://claude.ai/artifact/GLUkeCRhnFZnsj7tRr1L4D).
The implementation design for sections 1–3 and 6 is [docs/first-person-loop-design-2026-09-16.md](docs/first-person-loop-design-2026-09-16.md) (features F1–F12, copy, states, contracts, acceptance, effort).
Rules of the road stay [AGENTS.md](AGENTS.md): verify existing behavior first, extend rather than
rebuild, no parallel tables, preserve screen designs, propose design changes before making them.

## 0. Decisions (made September 16)

- [x] Navigation stays Place · Today · Nearby · Mail; no relabel.
- [x] Density meter: scarcity gates status only, never access (open the Marketplace/Tasks rows with an honest meter, or lower the lock to the k-anon floor of 10 in a test cell).
- [x] Seeder stays as a visibly labeled platform publisher; strip the engagement-question and neighbor-voice prompt lines; exclude from organic metrics.
- [x] General ban stays; a Moment category only with an explicit place attachment, and not before place pages exist.
- [x] No SavedItem / Action / Watch tables; extend `SavedPlace` and `HomeRecordWatch` instead.
- [x] Pilot = available nationwide, observed locally: 30 movers in the seeded metro; paid spend only after week-four return is measured.
- [x] Cash Earn hidden until a balance is withdrawable.
- [x] Address-verified vs household-verified: only postcard, document, landlord or admin verification unlocks attested artifacts and neighbor messaging; an accepted household invite gives household tools only (design doc F3b).
- [x] Write the design doc for the loop (`docs/first-person-loop-design-2026-09-16.md`).
- [ ] Record the seven decisions in `docs/pantopus-product-design-index-2026-09-09.md`, `docs/PROJECT_HANDOFF.md`, and section 13 of the Wedge v2 page (documentation only).

## 1. Hygiene set (about two days, ship before inviting anyone)

- [ ] Coordinate leak: unit test in `backend/tests/unit/feedService.test.js` that a non-author viewer of a home-identity approx-area post gets `effective_latitude/longitude` null or identically jittered; fix in `applyPostLocationPrivacy` (`backend/services/feedService.js:251`).
- [ ] Founding label fails closed: `backend/routes/public.js:557` must not default "slots open" to true on a failed lookup.
- [ ] Hide cash Earn from every user-visible surface (Hub "Earn today" item, earn routes behind a flag) until `EarnTransaction` balances reach the Wallet.
- [ ] Curator label on web, iOS and Android from the existing `origin` field on feed rows ("Pantopus curator · Source: X").
- [ ] Seeder prompt: remove the ENGAGEMENT question (`pantopus-seeder/src/pipeline/humanizer.py:51-55`) and the sports lane's "read like a neighbor" line (`:105`); exclude curator posts from taper and organic metrics.
- [ ] Referral tiers pay something real: bind converted referrals to +1 weekly postcard invite (`WEEKLY_INVITE_CAP` in `backend/services/blockFoundersService.js`); rename the 10-tier "Founding Neighbor Badge" in `inviteRewardService.js` and both native ProfileInsightCards.
- [ ] Collapse the three "Founding Neighbor" names to one (rank, tier, referral badge) and drop or wire the "permanent 0% marketplace fee" promise.

## 2. Bridge and weekly hook (about two weeks)

- [ ] Save sets location: a T1 save writes `UserViewingLocation` (or `resolveLocation` falls back to the newest `SavedPlace`), so Today, the seasonal card and the briefing light up immediately. Aha follow-up copy: "Save this place" at T1, "Claim" at T2+.
- [ ] Three-question first week in the setup checklist (`backend/routes/hub.js`): pickup day, one bill or lease date, the people you live with.
- [ ] Household as the first network: onboarding prompt to invite co-residents; shared visibility of pickup and bills; "Sam marked the water bill paid" push.
- [ ] Verification source split (F3b): `HomeOccupancy.verification_source` address | household | legacy; `isVerifiedResident` false for household; invitation copy updated on three platforms. Ship with the household item above.
- [ ] Night-before pickup push from the address calendar (household-confirmed schedule only).
- [ ] Conditional daily briefing: push only when weather, air or alerts cross a threshold or something is due; keep the fixed time as an opt-in.
- [ ] Important dates in the calendar: lease end and notice deadline, insurance renewal, warranty expiry, HOA dues, with 60/30/7-day reminders.
- [ ] JustMovedCard ticks move from localStorage to the account; add the voter-registration item from Civic data.

## 3. The compare card, October headline (one to two weeks)

- [ ] Signed compare payload (four grades + city + optional first name + expiry; never the address); `/start?vs=` parsing and compare state in `frontend/apps/web/src/app/start/page.tsx`.
- [ ] "Compare with a friend" under the aha card; per-grade "how we know" line (county zone vs parcel).
- [ ] Two-column variant of `/api/og/place`; light and dark.
- [ ] `t0_compare_viewed` funnel event and a column in `GET /api/admin/funnel/summary`.
- [ ] Rotating headline layer from the seasonal engine: October = voter-registration deadline for the November 3 election (Civic data + state deadline table); April/October = tax due and appeal window; January = radon zone + state free-kit link; summer = wildfire and smoke.
- [ ] Same-cell branch on the wall: "N Founding Neighbor slots still open on this block, closes <date>".
- [ ] Positioning line on `/start`, the store listings and the share card: "Nextdoor is what your neighbors say. Pantopus is what's on record about your address."

## 4. Before the pilot (one afternoon plus founder time)

- [ ] Five strangers, ten seconds on `/start`: "What does this do, and why would you type your address?" Fix copy before spending a postcard.
- [ ] Production keys: `CENSUS_API_KEY`, `AIRNOW_API_KEY`, `GOOGLE_CIVIC_API_KEY`, Mapbox incl. `NEXT_PUBLIC_MAPBOX_TOKEN`, `ADMIN_ALERT_EMAIL`; apply migrations 158/195/196.
- [ ] Confirm the Camas waste and council schedules (flip rows to `official`).
- [ ] Rerun the aha audit on the first ten alpha addresses (`backend/tests/audit/ahaAudit.audit.js`); read `/api/admin/funnel/summary`.
- [ ] Verify current Lob and USPS EDDM rate cards before budgeting any drop.
- [ ] Agents' closing-gift kit with a `?r=` route per agent; first HOA conversation; the business walk.
- [ ] Widgets: iOS WidgetKit and Android Glance reading the Today payload ("Recycling Tue · AQI 42 · tax due in 12 days").

## 5. The pilot (mid-October, four weeks)

- [ ] Recruit 30 movers in the seeded metro (agents' kit, welcome postcards to recorded sales, own street first).
- [ ] Define activation: address saved + briefing or widget on + one household fact (pickup day, a bill, or a co-resident) within seven days.
- [ ] Track week-one, week-four and week-eight return among activated users, attributed to trigger (pickup push, conditional briefing, widget, email, compare card, household update, organic). Bar: 40% week-four return.
- [ ] Track spread: k = compare rate × hop rate × reveal rate; rework under 0.3 after two weeks.
- [ ] Watch the cohort that added pickup day and a bill in week one; if they retain and others do not, that is the onboarding.
- [ ] Decide from the numbers: keeper + mail snap next, or another onboarding pass.

## 6. Next, after the pilot's first read

- [ ] Mail and bill snap as the keeper's first job (extends Mail Day and `summarizeMail`; private evidence storage pattern from `homeClaimEvidenceRoutes.js`).
- [ ] Keeper thin persona: name, species, one mood line on Today derived from real obligations; grows with the home file.
- [ ] Appeal-window deadline rows for the 50 largest counties in the address-calendar registry; assessment change from ATTOM if display terms allow.
- [ ] Public bucket-only city founding map from the cells API.
- [ ] Seasonal quarterly card and weekly email digest.
- [ ] Address change watches (generalize `HomeRecordWatch` to ATTOM sales nearby, EPA SDWIS, FEMA revisions).
- [ ] `SavedPlace` snapshot columns (kind, source ref, snapshot, captured version, client request id) and "Save this" on sections.
- [ ] One or two national sections through `placeSectionAdapters` (IMLS library outlets, HRSA sites, USDA markets or SNAP retailers).
- [ ] Home handover: outgoing resident leaves the home file for the incoming one over the existing external-share and membership services.
- [ ] Address QR inbox via the Fridge Card code; keeper chat; draft-and-approve replies.
- [ ] Free-tier home visual (user photo or confirmed Street View reference → stylized illustration, Rive/Lottie keeper, live overlays), "Only you" by default.
- [ ] Density lock change per decision 2; apply the docs' §13.1 / B.7 checklist to `/start`, Today and Nearby as pass criteria for the open UI rows.

## 7. Documentation

- [ ] Wedge v2 page: add a v3 note pointing at the review and ledger; correct radon Zone 2 → Zone 1, the unwired 0% fee, "Android batches later"; record the decisions in section 13.
- [ ] Nationwide doc A.7: cite `pickAha`, `/api/og/place`, `funnelEvents.js`, `JustMovedCard`, `homeClaimEvidenceRoutes.js:17-56`; fix the stale `upload.js:1833` row; cite the Supabase baseline migration instead of `schema.sql`.
- [ ] Design index: "what already shipped Sep 1–2" section; condition "choose the first slice" on the decisions above; mark the v1 brief's navigation as retired.

## Not now (decided)

Bill paying by the keeper · generic shopping and deals · any navigation relabel · the source-discovery engine and new owner-scoped tables · a news feed against Nextdoor · Recent conditions and Moment posts · photoreal 3D homes · per-city permit adapters · nationwide paid acquisition before the pilot.

## Ballot (added September 24)

Plan: [docs/ballot-implementation-plan-2026-09-24.md](docs/ballot-implementation-plan-2026-09-24.md). Visual source: the [Ballot canvas](https://claude.ai/artifact/KCuXBiAYYaX13gpoqUCdmq). P0 is the October edition of sections 2–3 above (voter-registration headline, election dates, voter step), not a parallel track. Everything stays behind `ballot_p0`, which is off.

- [ ] Founder approves the "Proposed, September 24" canvas boards and the pilot (plan §11).
- [x] P0 backend: reference data (Washington verified, others links-only), exact-point governments, `civic_election` extension, `/start` teaser, flag row. On branch `claude/blissful-dijkstra-n8r31h`, not merged.
- [x] P0 web: Place "Your ballot" card, governments view with the peel story, deadline timeline, `/start` teaser, Today card, "Moved this year?" line. On the branch; screenshots checked against the boards.
- [ ] P0 iOS and Android: the same card, view and Today card. Written on the branch; they need CI compilation (`ios-ci`, `android-ci`) and a device pass.
- [ ] Release checks: a person opens every source and link; real Clark County and out-of-state addresses through the real API; device passes.
- [ ] P0.5: one reminder opt-in (at most three per election) and the share card, once the push copy is approved.
- [ ] P1 only if Washington voterInfo coverage checks out against official sample ballots.

## Parallel, unchanged

The three verification workstreams on the 80-row acceptance backlog (`docs/REMAINING_WORK_2026-09-11.md`) continue; this checklist adds no scope to them.
