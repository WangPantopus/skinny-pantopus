# Gigs/Tasks Native Migration — Gap Analysis & Execution Plan

> **STATUS (2026-06-11): ALL PHASES COMPLETE** — Phases 0–6 shipped on
> `feature/gigs-phase2-map` (PR #246), commits 91250462…136ea95f.
> Deliberately dropped: counter evidence photos (backend doesn't model
> bid attachments). Known follow-ups: Live Activity remote pushes (needs
> APNs token plumbing; current updates are in-app), App Group/widget
> provisioning for release signing, identity chip hides businesses
> without a postable user id.

**Scope:** Gigs/Tasks list view, map view, Post Gig V1, Post Task V2 (Magic Task), plus the
detail/lifecycle surfaces they feed into.
**Baselines compared:**
1. React Native reference: `pantopus/frontend/apps/mobile/` (feature/function/workflow source of truth)
2. New designs: `all-designs 2/` — A11.1 Tasks Map, A13.8 Post Gig V1, A12.8 Post a Task wizard (layout/style source of truth)
3. Targets: `frontend/apps/ios/` (SwiftUI) and `frontend/apps/android/` (Compose)
4. Backend: `backend/` (already supports nearly everything; gaps noted)

Date: 2026-06-10

---

## Part 1 — Where the native apps stand today

Both native apps have the same architecture-level skeleton, with strong test coverage
(iOS: VM tests + UI-test markers; Android: VM tests + Paparazzi snapshots):

| Surface | iOS | Android |
|---|---|---|
| Gigs feed (list) | ✅ `Features/Gigs/GigsFeedView.swift` | ✅ `ui/screens/gigs/GigsFeedScreen.kt` |
| Tasks map | ✅ `Features/Gigs/TasksMap/` | ✅ `ui/screens/gigs/tasks_map/` |
| Gig search | ✅ `Features/Gigs/Search/` | ✅ `GigSearchScreen.kt` |
| Post V2 wizard (6 steps + success) | ✅ `Features/Compose/GigCompose/` | ✅ `ui/screens/compose/gig/` |
| Post V1 legacy form | ✅ `Features/Gigs/QuickPost/` | ✅ `ui/screens/gigs/quickpost/` |
| Gig detail | ✅ `Features/ContentDetail/GigDetailView.swift` (bid, tip, Q&A, mark-delivered) | ✅ `ui/screens/contentdetail/GigDetailScreen.kt` (same set) |
| My tasks / My bids | ✅ | ✅ |

Both consume the real backend (`GET/POST /api/gigs...`) — not mocks — except the specific
stubs called out below.

---

## Part 2 — GAPS vs React Native reference (feature/function/workflow)

### P0 — Broken or stubbed core flows (block "post a gig" end-to-end quality)

| # | Gap | RN reference | iOS today | Android today |
|---|---|---|---|---|
| G1 | **Photo upload pipeline.** Composer photos are placeholder IDs; nothing is uploaded. Backend expects URLs from `POST /api/files/upload`. | `useAttachments` → upload → URLs in `attachments` | placeholder IDs ("until P15.5") | sample tones only, `FilesApi` unwired |
| G2 | **Real AI Magic Draft.** Native "Magic Task" is a local keyword matcher. RN calls `POST /api/ai/draft/gig` (OpenAI structured parse: title/desc/price/category/urgency/tags/schedule/clarifying questions). | `api.magicTask.getMagicDraft` | keyword match | keyword match |
| G3 | **Date/time pickers.** Android one-time schedule taps insert a hard-coded "now+24h" placeholder. | native pickers per platform | DatePicker wired | placeholder ("calendar P18 follow-up") |
| G4 | **Server-side list filtering.** iOS fetches then filters client-side (budget/schedule/posted-within); backend supports `price_min/max`, `deadline`, `schedule_type`, etc. Wasteful + breaks pagination correctness. | server params | client-side | partially server-side |

### P1 — Missing workflows that exist in RN (the marketplace loop)

| # | Gap | Notes |
|---|---|---|
| G5 | **Counter-offer negotiation.** Backend has counter/accept-counter/decline-counter/withdraw-counter. RN exposes full UI in BidPanel + My Bids. Native: none. |
| G6 | **Owner bid management on detail.** RN OffersPanel/OffersPanelV2: list bids with bidder trust info, accept (→ PaymentSheet for paid gigs), reject, counter, comparison view. iOS fetches bids when owner but has no accept/reject/counter UI on detail (only via Mailbox V2 mail item); Android similar. |
| G7 | **Engagement modes (V2).** RN: `instant_accept` / `curated_offers` / `quotes` + `inferEngagementMode()`, InstantAcceptButton, scored offers (`getGigOffersV2`). Native composer collects an "engagement mode"-ish radio but never maps to backend `engagement_mode`; detail has no instant-accept path. |
| G8 | **Task archetype modules.** RN V2 collects per-archetype JSONB modules (delivery pickup/dropoff/items, care details, logistics, pro-services license/insurance/deposit, event shift, remote deliverable, urgent response-window). Backend accepts all of them. Native composer collects none. |
| G9 | **Active-task / completion loop.** RN: worker-ack, start, running-late, ETA tracker (Socket.IO), no-show report/check, confirm-completion with proof, owner confirm → payment capture, tip, review, share. Native: only `mark-completed` (+proof) and tip exist; no worker-ack/start/no-show/ETA/review-on-detail/owner-confirm UI (owner confirm endpoint wired on Android `complete`, minimal UI). |
| G10 | **Reviews.** RN LeaveReviewModal posts ratings + photos; reliability scores shown. Native: LeaveReviewSheet exists in My Bids but submission route marked TBD on iOS; no review display on detail. |
| G11 | **Save/bookmark, share, report.** Endpoints wired in both apps' API layers; UI affordances are placeholders (iOS) or absent (Android). RN has all three + dismiss ("not interested") + hide-category affinity signals. |
| G12 | **Real-time updates.** RN subscribes to `gig:new` (feed banner), `gig:bid-update`, `gig:status-change`, ETA updates. Native apps: no socket integration on gigs surfaces. |
| G13 | **Edit/repost/cancel flows.** RN: edit open gig (`/gig/new?editGigId=`), reopen-bidding, cancel with fee preview (`cancellation-preview`, policy zones), boost with confirmation. Native: cancel + boost endpoints wired, no edit screen, no fee-preview UI, no boost confirmation. |
| G14 | **Change orders & payments surfaces.** RN: change-order create/approve/reject/withdraw, PaymentSection with fees/tip/total, payment retry flows. Native: tip + accept-bid PaymentSheet exist; nothing else. |
| G15 | **Browse enrichments.** RN: BrowseFeed sectioned/curated categories, radius-suggestion banner, urgent badge, featured cards, swipe-to-dismiss rows, support-trains tab, price benchmark. Native: flat list only. |
| G16 | **Identity/persona & guards.** RN: ResidencyGuard, posting-as (personal/home/business; `beneficiary_user_id`), sensitive-action verification before financial steps. Native: none (designs also call for an Identity chip — see D-gaps). |
| G17 | **Map list-sheet parity.** RN map has full list bottom sheet, search-this-area, focus-on-pins, clustering (`buildClusteredPins`). Native maps: horizontal 3-card rail only, no search-this-area, clustering delegated to shell (unverified), no full-list detent content. |
| G18 | **Voice input / inspiration templates.** RN: `useVoiceTask` (mic), TemplateChipsRow inspiration prompts, undo-post toast (10s window via `magicTask.undoTask`), post-confirmation with "notified N helpers". Native: none of these. |

### Backend gaps (small; most parity is frontend work)

| # | Gap |
|---|---|
| B1 | RN's `api.magicTask.magicPost` / `undoTask` / template-library — confirm the native apps can reach equivalents (`/api/ai/draft/gig` exists; undo + templates need verification/porting if missing in this backend copy). |
| B2 | No single endpoint combines geo + archetype + category + engagement filters (apps currently compose params; fine, but verify `find_gigs_nearby_v2` covers all combinations used). |
| B3 | Saved-search alerts don't exist (RN doesn't have them either — "beyond" item). |

---

## Part 3 — GAPS vs the new designs (layout/style)

Design tokens (`colors_and_type.css`) match the existing native theme systems
(`Theme.swift` / `PantopusColors`) — primary #0284C7, neutrals, radii, spacing all align.
The gaps are structural/visual:

### A11.1 — Tasks Map (map + list hybrid)

| # | Design element | iOS | Android |
|---|---|---|---|
| D1 | Floating top pill (back · title "Tasks map" · filter), translucent blur, replacing solid top bar | partial (top pill exists; verify blur/pill geometry) | partial |
| D2 | Category chips: white translucent w/ colored dot when inactive; chip fills with its **category color** when active | partial — verify dot + per-category fill | partial |
| D3 | Pin grammar: confirmed = solid w/ white ring; pending = dashed outline; **active pin pulses** (2-layer animated halo) | missing pulse/pending states | missing |
| D4 | You-are-here disc with soft halo | verify | verify |
| D5 | Empty state: dashed primary **search-radius ring** on map + "0 tasks nearby" header + hero with "Post a task" + "Widen search" buttons | "Widen search" missing | partial (has both CTAs; verify radius ring) |
| D6 | Sheet: 22px top radius, grabber, header "N tasks nearby" + "Sort: Closest ⌄", 40% default detent, three stops | partial — verify detents/copy | partial |
| D7 | TaskRailCard: 240px, category-gradient icon tile, 2-line title, price in primary, "· distance", amber bids pill, scroll-snap + pagination dots (active dot elongated) | mostly there; verify gradient tile + snap | mostly there |
| D8 | Post-task FAB: pill with icon+label, stacked **above** locate/layers controls, primary shadow | verify stacking/order | verify |

### A13.8 — Post Gig V1 (legacy single-screen form)

| # | Design element | iOS | Android |
|---|---|---|---|
| D9 | Top-bar text-button "Post" (no sticky CTA) — V1 ergonomics on purpose | verify | ✅ FormShell |
| D10 | Section overlines (CATEGORY / DETAILS / PAY / WHEN / PHOTOS) | verify | verify |
| D11 | Price type radio: **Flat / Hourly / Free** — both apps lack "Free" | missing Free | missing Free |
| D12 | Server-side validation pattern: red banner "N problems — please fix" + red field borders + inline messages (desc ≥40 chars, price-or-free, date-in-past) | partial | ✅ banner exists; align rules |
| D13 | Photo grid 4-up: dashed "+ Add" tile, "Cover" label on first, × remove, helper caption italics | partial | ✅ mostly |
| D14 | Legacy stamp footer ("gig composer · v1.4.2" monospace) | verify | ✅ |

### A12.8 — Post a Task (Magic wizard, step 1)

| # | Design element | iOS | Android |
|---|---|---|---|
| D15 | **Identity chip** ("PERSONAL · YOU" pill) at top of step | missing | missing |
| D16 | Magic describe card: purple "Magic Task" header strip w/ sparkles tile + live "Parsed" status dot; **parsed-entity highlights** inside the text (purple background spans); mic/image/paperclip tool row; char counter 184/500 | missing (plain textarea) | missing |
| D17 | "Detected category" row: archetype icon tile + "Handyman · Furniture assembly" + **Change** link | partial (chip only) | partial |
| D18 | **Module-prompts card** ("Task details · 4 of 5 filled"): When/Where/Effort/Photos/Budget rows, green check = filled, amber "Add" pill = needed | missing | missing |
| D19 | Engagement-mode segmented tiles (One-time / Recurring / Open-ended w/ icons + subcopy) | partial (radio) | partial |
| D20 | Sticky bottom dual-CTA: ghost "Pick category" + primary "Review & post →" (i.e., design's wizard is **describe-first, 4 steps**: Describe → Fill gaps → Budget & mode → Review; current native wizard is 6 steps category-first) | restructure | restructure |
| D21 | Manual picker frame: "Try Magic Task instead" purple banner, 8 archetype tiles w/ category accent colors + example text, dashed "See all 14 categories", disabled CTA until selection | partial | partial |
| D22 | Wizard chrome: X close, centered title, "1 of 4", segmented progress bar under header | ✅ (6 steps) | ✅ (6 steps) |

**Biggest design deltas:** the wizard step-structure (D20), the Magic describe card with
entity highlights + module prompts (D16/D18), and the map pin/pulse grammar (D3).

---

## Part 4 — Execution plan

Principle: **backend first where stubs block UX, then shared per-feature parity passes
implemented twice (iOS + Android) with snapshot/VM tests, designs as acceptance criteria.**
Phases are ordered so every phase ships a visibly better app.

### Phase 0 — Foundations (unblock everything else)
1. **Photo upload pipeline (G1).** Wire `POST /api/files/upload` (multipart) in both apps;
   composer photo tiles upload on selection (progress + retry + remove), pass returned URLs
   in `attachments`. Add cover-photo ordering (first = cover, per A13).
   - iOS: extend `MultipartUploader` use from DeliveryProofSheet into GigCompose.
   - Android: wire `FilesApi` into `GigComposeViewModel` + `PostGigV1ViewModel`.
2. **Real Magic Draft (G2).** Replace keyword matcher with `POST /api/ai/draft/gig`
   (debounced ≥800ms, ≥3 words, cancel in-flight). Map response → detected category,
   suggested title/desc/price/tags/schedule, clarifying questions → module-prompt rows.
   Keep keyword matcher as offline fallback.
3. **Android native date/time pickers (G3).** Material3 DatePickerDialog + TimePicker;
   remove the +24h placeholder; enforce future-date validation (matches A13 error case).
4. **Server-side filters (G4).** Move iOS feed filtering to query params
   (`price_min/max`, `deadline`, `schedule_type`, `category`, `sort`); keep pagination
   honest (`limit/offset`); Android: audit and complete the same.
5. **Backend check (B1/B2):** verify `/api/ai/draft/gig` response covers archetype +
   modules the designs prompt for; add `undo` window + template-library endpoints if the
   product wants RN's undo-toast parity (recommended Phase 3).

### Phase 1 — List view: design + feature parity
1. Restyle cards/chips/sort/filter to A-series tokens where drifted (both apps are close).
2. Add missing list features from RN: urgent badge, "be first" pill (done), radius
   suggestion banner, saved/bookmark toggle on rows or detail, swipe/long-press dismiss with
   `POST /:id/dismiss` + hide-category, price-benchmark hint in composer.
3. Real-time: socket (or polling fallback) `gig:new` → "N new tasks" banner → refresh.
4. Browse sections (RN BrowseFeed) as a follow-on: sectioned category clusters when no
   filters active; "See all" → flat list.

### Phase 2 — Map view: A11.1 parity
1. Pin grammar: per-category colored pins, confirmed ring vs pending dashed, active-pin
   pulse animation, you-are-here halo (D3/D4).
2. Chips: colored-dot inactive / category-fill active (D2); floating pill bar w/ blur (D1).
3. Sheet: three detents (40% default), grabber, "N tasks nearby" + "Sort: Closest"; rail
   cards w/ gradient icon tile, scroll-snap, elongated pagination dot (D6/D7); expanded
   detent shows full vertical list (RN GigsMapListSheet parity, G17).
4. Map behaviors: "Search this area" on significant region change; clustering at low zoom;
   focus-on-pins; pin↔card selection sync both directions.
5. Empty state: dashed radius ring overlay + "Widen search" (expands radius and refetches) (D5).
6. FAB stack order: Post-task pill above locate/layers (D8).

### Phase 3 — Post Task V2: the Magic wizard (A12.8 + RN parity)
1. **Restructure to describe-first** (D20): Step 1 Describe (Magic card + detected
   archetype + module prompts + engagement tiles, dual CTA), Step 2 Fill gaps (only
   missing modules), Step 3 Budget & mode, Step 4 Review & post. Manual picker as
   alternate Step-1 entry with "Try Magic Task instead" banner (D21).
2. Magic describe card (D16): header strip + parsed status, entity highlights (use AI
   response spans; if backend doesn't return spans, highlight matched keywords), tool row
   (mic = transcribe endpoint `POST /api/ai/transcribe`; image; attachment), 500-char counter.
3. Module-prompts card (D18): When/Where/Effort/Photos/Budget rows w/ filled/needed
   states; tapping a row opens its picker; "4 of 5 filled" counter gates nothing but nudges.
4. Archetype modules (G8): port RN's per-archetype field groups (delivery, care,
   logistics, pro-services, event, remote, urgent) as conditional "Fill gaps" content;
   submit in `CreateGigBody` module fields (backend already accepts).
5. Engagement mode (G7): segmented tiles → map to backend `engagement_mode`
   (instant_accept / curated_offers / quotes) using RN's `inferEngagementMode` rules with
   user override.
6. Identity chip (D15, G16): show active persona; wire posting-as
   (`beneficiary_user_id`) when business/home identity selected.
7. Post-confirmation: "notified N helpers" + undo toast (needs B1 verification) + first-post share prompt.

### Phase 4 — Post Gig V1 polish (A13.8)
1. Add **Free** price type (D11); price-or-free validation.
2. Align validation to design: red banner with problem count, field borders, inline
   messages incl. "Date is in the past", desc ≥ 40 chars (D12).
3. Section overlines, legacy stamp, photo-grid captions (D10/D13/D14).
4. Real photo upload (from Phase 0) + edit-mode (`editGigId`) so V1 doubles as the edit
   screen RN has (G13).

### Phase 5 — Detail & lifecycle: close the marketplace loop
1. Owner bid management on detail (G6): bids list w/ trust capsule, accept (PaymentSheet
   path exists), reject, **counter** (G5); bidder side: accept/decline counter in My Bids.
2. Instant accept (G7): big CTA when `engagement_mode == instant_accept`.
3. Active-task panel (G9): worker-ack, start, running-late, mark-complete w/ proof
   (exists), owner confirm-completion → capture; no-show check/report.
4. Reviews (G10): leave-review post-completion (both roles), display ratings on profiles/bid cards.
5. Save/share/report (G11): wire existing endpoints to real UI; share = `buildGigShareUrl` deep link.
6. Cancel w/ fee preview (G13): `GET /:id/cancellation-preview` → zone/fee sheet before confirm; boost confirmation toast.
7. Change orders + payment section (G14) as a second pass.
8. Real-time on detail (G12): bid/status/payment events refresh; ETA tracker last (needs location-update streaming).

### Phase 6 — "Beyond RN" differentiators
- Saved searches + alerts (B3), smart radius suggestions, offline draft queue,
  rich haptics/transitions (pin pulse, sheet snap), Live Activities (iOS) / ongoing
  notification (Android) for active tasks, widget for "tasks near me".

### Cross-cutting rules for every phase
- Designs are acceptance criteria: build against the JSX frames (exact spacings/colors are
  in `colors_and_type.css`, already mirrored in both token systems).
- Every screen change ships with: VM unit tests (both), Paparazzi snapshots (Android),
  UI-test markers (iOS), and updated sample data.
- No hardcoded hex in features (both repos have CI guards).
- Each phase = one PR per platform off a `claude/<slug>` branch; never push master.

### Suggested sequencing & sizing
| Phase | Size | Parallelizable? |
|---|---|---|
| 0 Foundations | M | iOS/Android in parallel |
| 1 List | M | after 0.4 |
| 2 Map | L | parallel with 1 |
| 3 Wizard V2 | XL | after 0.1/0.2 |
| 4 V1 polish | S | anytime after 0.1 |
| 5 Lifecycle | XL | after 1; split into 5a (bids) / 5b (completion) / 5c (payments) |
| 6 Beyond | ongoing | after 5 |
