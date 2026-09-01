# Pantopus — Release notes

Newest first. Each tier (T1–T6+) batches a coherent slice of feature work
across iOS, Android, and web. Per-PR detail lives under
`docs/t6-prs/T6-summary.md`, `docs/t5-prs/T5-summary.md`, and their
T1–T4 predecessors.

---

## New-design batch 2 (B-series) — 11 native catch-up screens + 13 primitives · 2026-06-01

**Theme: native catch-up to web + design.** Eleven screens that
post-date the original 44-screen new-design audit shipped on iOS +
Android (web is the reference implementation and already shipped
these). All eleven are now **DONE** — built/reshaped, snapshot-locked,
and parity-verified across both platforms. Per-screen detail lives in
[`docs/new-design-parity-batch2.md`](docs/new-design-parity-batch2.md);
the companion prompt set is
[`docs/claude-code-prompts-batch2.md`](docs/claude-code-prompts-batch2.md)
(the `B`-prefixed set, distinct from the P0–P9.1 series).

### Screens (11)

| Design | Screen | Start → Now | PR |
|---|---|---|---|
| A17.11 | Stamps — postage / stamp-book wallet | BUILD → DONE | #187 (B2.1) |
| A17.12 | Mail task — mail-derived task detail | BUILD → DONE | #186 (B2.2) |
| A17.13 | Translation — auto-translated mail view | BUILD → DONE | #188 (B2.3) |
| A17.14 | Unboxing — scan-first capture flow | BUILD → DONE | #189 (B2.4) |
| A10.6 | Business profile (public) — single-scroll reshape | RESHAPE → DONE | #185 (B3.1) |
| A10.7 | Business owner view + preview-as-neighbor | BUILD → DONE | #191 (B3.2) |
| A10.11 | Earn dashboard (Wallet sibling) | BUILD → DONE | #190 (B4.1) |
| A18.4 | Waiting room (persistent) — reshape | RESHAPE → DONE | #194 (B5.1) |
| A18.5 | View As — identity preview | BUILD → DONE | #192 (B5.2) |
| A19.1 / A19.2 | Privacy + Terms — long-form legal reshape | RESHAPE → DONE | #193 (B6.1) |

### New shared primitives (13, Phase B1)

Token-pure, preview + isolated-snapshot covered, all **consumed** (no
orphans):

- **Postage / capture (B1.1, #178/#179):** `PerforatedStamp` (+ `Postmark`),
  `CameraScanner` (seeded-static viewfinder), `OcrFactsList`.
- **Identity preview (B1.2, #181):** `ViewerPicker`, `RedactionScrim`.
- **Legal (B1.3, #180):** `LegalTOCCard`, `DocMetaStrip`, `BackToTopFab`,
  `LegalSection`.
- **Business (B1.4) + Earn (B1.5, #182):** `BizBannerHeader`, `GalleryStrip`,
  `RatingDistribution`, `MapPreview`, `ProgressRing`.

New accent tokens (named, not hex): `categoryStamps` `#0e7490`,
`categoryTask` `#4f46e5`, `categoryTranslation` family `#be185d`,
`categoryUnboxing` family `#0d9488`, and the business-violet `#6d28d9`
family + category accents — mirroring the `category-party` /
`category-records` precedent.

### Routing

New deep links + routes wired on both platforms (iOS `DeepLinkRouter` +
`HubRoute`/`YouRoute`; Android `ChildRoutes` in `RootTabScreen.kt`):
`pantopus://mailbox/{stamps,tasks/:id,translation,unboxing,earn}`,
`pantopus://businesses/:id`, `pantopus://homes/:id/waiting-room`,
`pantopus://identity/preview`, `pantopus://legal/{privacy,terms}`. B1.6
(#183) pre-staged the routes against a placeholder; each screen prompt
swapped its destination in on landing.

### Quality gates

- **iOS:** `make lint && make test` — CI green on `ios-ci.yml`.
  `verify-icons.sh` green; `verify-tokens.sh` (delta-gated, not a CI gate)
  adds **zero** new flagged sites — all 11 batch-2 folders carry zero hex
  literals and the CI `#RRGGBB` grep is clean.
- **Android:** `./gradlew ktlintCheck detekt test paparazziVerify :app:assembleDebug`
  — CI green on `android-ci.yml`.
- **Snapshot lockfile (B7.1):** 22 design-reference PNGs (11 screens × 2
  states) under
  `frontend/apps/ios/PantopusTests/Features/__snapshots__/new-designs-batch2/`
  + `frontend/apps/android/app/src/test/snapshots/images/new-designs-batch2/`,
  rendered by `render-new-designs-batch2.mjs` and locked by
  `T8ScreensSnapshotTests.swift` / `NewDesignBatch2ScreensSnapshotTest.kt`
  (presence tripwires — file present, > 4 KB, PNG magic). Per-screen render
  suites (Paparazzi / iOS snapshot) lock the implementations separately.
  Regeneration policy: `NEW_DESIGNS_BATCH2.md`.

### Open follow-ups

- Mail-task **list/index** (A17.12 shipped detail only — B-1).
- Live `AVCaptureSession` / CameraX capture for Unboxing (seeded
  viewfinder shipped; live capture deferred — B-5).
- Earn weekly-goal **fidelity**: shipped `ProgressRing` donut vs the
  design's in-hero gradient bar (B-3) — for design review.
- Real machine-translation + TTS for Translation ("Listen" is a stub).
- Stripe-backed Stamps purchase / auto-refill (scoped stubs this batch).

### Reference docs

- [Batch-2 audit](docs/new-design-parity-batch2.md)
- [Batch-2 prompt set](docs/claude-code-prompts-batch2.md)
- [Lockfile regeneration policy](frontend/apps/ios/PantopusTests/Features/Shared/NEW_DESIGNS_BATCH2.md)

---

## Tier 6 — 46 net-new screens + 2 new shared shells · 2026-05-18

**Theme: design-pack closeout.** Forty-six newly designed screens
shipped on iOS + Android (web parity where a web route already
existed). The Tier-6 design pack also forced two **net-new shared
shells** — `MailItemDetailShell` (8-slot A17 mailbox detail) and
`MapListHybridShell` (full-bleed map + 3-detent draggable bottom
sheet) — plus 8 strictly-additive extensions on `ListOfRows`. Two
T5 screens (Bills, My tasks V2) drifted hard enough to justify
dedicated re-skin PRs (T6.0a, T6.0b) before the rest of the tier
landed.

### Screens (46 net-new + 2 re-skins)

The full per-screen table lives in
[`docs/t6-prs/T6-summary.md`](docs/t6-prs/T6-summary.md). High-
level groupings:

| Cluster | Count | Notes |
|---|---|---|
| Drift catch-up reskins | 2 | Bills (T6.0a) + My tasks V2 (T6.0b) |
| Auth (Login refresh + Create acct + Forgot + Reset + Verify + Error) | 6 | T6.1a–c, behind no flag, replaces 1-frame login |
| Tier-1 refreshes | 2 | Hub (T6.2a), Me (T6.2b) — direct cutover per Q12 |
| Settings sub-routes | 6 | Blocked / Password / Verification / Help / Legal index + content / About (T6.2c); Data export + Payments parked at P8.5 |
| Home pillar | 11 | Members / Maintenance / Household tasks / Packages (+ detail + log) / Polls (+ detail) / MyHomes refresh / MyListings / MyBusinesses / Owners / Access codes / Emergency info / Documents / Home calendar (T6.3a–T6.4c) |
| Mailbox A17 | 8 | Shell + root reskin + generic / Booklet / Certified / Community variants + Vault + Ceremonial open + Ceremonial compose refresh (T6.5a–e) |
| Chat + New message | 2 | Chat conversation refresh + New message picker (T6.6b) |
| MapListHybrid | 1 | Shell shipped; Nearby map migrated (T6.6a) |
| Support trains | 2 | Support trains list + Review signups (T6.6c / P26.5) |
| Long-tail leaf refreshes | 9 | Transactional Detail · Content Detail · Beacon (iOS deferred) · Audience hub · Creator Inbox · Identity Center · Privacy Handshake · Token Accept · Status / Wait · Legal · Form / Wizard / ListOfRows / Mailbox archetype demos (T6.6c / P26.9) |

### New shared shells

- **`MailItemDetailShell`** — 8-slot composition powering the four
  A17 mailbox detail variants. Documented per-platform in
  `frontend/apps/{ios,android}/Pantopus/Features/Shared/MailItemDetail/README.md`
  + `frontend/apps/web/src/components/mail-item-detail/README.md`.
- **`MapListHybridShell`** — full-bleed map + draggable bottom
  sheet with 3 absolute-height detents (160 / 296 / 518 pt). Shared
  detent-resolver algorithm + per-platform velocity thresholds.
  Documented per-platform in
  `frontend/apps/{ios,android}/Pantopus/Features/Shared/MapListHybrid/README.md`
  + `frontend/apps/web/src/components/map-list-hybrid/README.md`.

### Additive shell extensions (T6 deltas to `ListOfRows`)

All strictly additive — every T5 / v1 call site compiles unchanged:

- `RowLeading.magicArchetypeTile` (44pt gradient + 18pt sparkles disc)
- `RowModel.archetypeOverline: String?` (10pt magic-violet uppercase)
- `FabVariant.magicCreate` (60pt gradient FAB)
- `FabTint` enum + `FABAction.tint` (per-identity colour-ramp)
- `RowModel.splitWith: SplitStackData?` (Bills split-bill avatar stack)
- `BannerConfig.cta: BannerCTA?` + `BannerConfig.tint: BannerCTATint`
- `RowTrailing.iconActions(primary:secondary:)` (Access codes copy + kebab pair)
- `ListOfRowsDataSource.topBarSubtitle: String?` (2-line top bar)
- `customHeader` view-builder slot on `ListOfRows*` (Home calendar
  month strip) — between chrome and state body.

### Wiring sweep

**Zero** T6-shipped surfaces use `NotYetAvailableView`. Every T6
screen has a real view at its destination. 24 wiring flips landed
across the T6 batch (from `placeholder(label:)` / `NotYetAvailableView`
to real screens). See
[`docs/mobile-wiring-audit.md`](docs/mobile-wiring-audit.md) — "T6
closeout (P27)" § for the full classification + the per-PR delta
table.

### Quality gates

- **iOS:** `make lint && make test` — CI green on `ios-ci.yml`.
- **Android:** `./gradlew ktlintCheck detekt test paparazziVerify :app:assembleDebug`
  — CI green on `android-ci.yml`.
- **Web:** `pnpm -F @pantopus/web lint` clean (0 errors, ~510
  warnings carried over from T5 — same pattern, no new T6
  regressions).
- **Hex-literal grep:** zero matches across all iOS + Android T6
  feature dirs.
- **Snapshot lockfile:** 61 design-reference PNGs under
  `frontend/apps/ios/PantopusTests/__Snapshots__/t6/<slug>-ios.png`
  with `T6ScreensSnapshotTests.swift` asserting file presence +
  non-trivial PNG bytes. Mirrored under
  `docs/screenshots/__snapshots__/t6/`.

### Open follow-ups

- iOS Beacon profile against `/api/personas/:handle`
  (`T6.6c-followup-beacon-ios`)
- Long-tail leaf screen visual-diff baselines
  (`T6.6c-followup-baselines`) — 9 refresh-only screens
- Settings sub-routes Data export + Payments & payouts (P8.5)
- Web parity for home-pillar deep screens (P-after-T7 sweep)
- Hub today reshape backend (`/api/hub` discrete fields)
- Posts archive backend (carried over from T5)
- Bills splits write endpoints (carried over from T5)
- Maintenance + Documents + Emergency PATCH/DELETE
- HomeOwner.share_percentage backend
- Polls composer
- Documents kebab action sheet
- Android `StoreScreenshotsTest` scaffolding (carried over from T5)

### Reference docs

- [PR summary](docs/t6-prs/T6-summary.md)
- [Buildout plan of record](docs/t6-buildout-plan.md)
- [Open-question decision log](docs/t6-open-questions-decisions.md)
- [Parity audit (live)](docs/mobile-parity-audit.md)
- [Wiring audit (live)](docs/mobile-wiring-audit.md)
- [Accessibility audit (current)](docs/a11y-audit-current.md)
- [Cross-platform screenshots](docs/screenshots/README.md)
- [Lighthouse audits (web)](docs/lighthouse-t6/README.md)

---

## Tier 5 — 12 list screens on the shared archetype · 2026-05-16

**Theme: parity at scale.** Twelve newly designed list screens shipped on
iOS, Android, and web, all on top of the shared `ListOfRows` archetype.
The archetype itself was extended additively (`T5.0`) to make the geometry
expressible without breaking any v1 call site. Web kept its 12 routes;
iOS and Android added 9 of the 12 screens that didn't exist on mobile.

### Screens (12)

| # | Screen | iOS path | Android path | Web path |
|---|---|---|---|---|
| 1 | Notifications V2 | `Features/Notifications/NotificationsView.swift` | `ui/screens/notifications/NotificationsScreen.kt` | `(app)/app/notifications` |
| 2 | Bills (list + detail + Add wizard) | `Features/Homes/Bills/BillsListView.swift` | `ui/screens/homes/bills/BillsListScreen.kt` | `(app)/app/homes/[id]/bills` |
| 3 | Pets | `Features/Homes/Pets/PetsListView.swift` | `ui/screens/homes/pets/PetsListScreen.kt` | `(app)/app/homes/[id]/pets` |
| 4 | Connections | `Features/Connections/ConnectionsView.swift` | `ui/screens/connections/ConnectionsScreen.kt` | `(app)/app/connections` |
| 5 | Offers (cross-listing) | `Features/Offers/OffersView.swift` | `ui/screens/offers/OffersScreen.kt` | `(app)/app/offers` |
| 6 | My bids | `Features/MyBids/MyBidsView.swift` | `ui/screens/my_bids/MyBidsScreen.kt` | `(app)/app/my-bids` |
| 7 | My tasks V2 | `Features/MyTasks/MyTasksView.swift` | `ui/screens/my_tasks/MyTasksScreen.kt` | `(app)/app/my-gigs` |
| 8 | My pulse (My posts) | `Features/MyPosts/MyPostsView.swift` | `ui/screens/my_posts/MyPostsScreen.kt` | `(app)/app/my-pulse` |
| 9 | Listing offers (per-listing) | `Features/ListingOffers/ListingOffersView.swift` | `ui/screens/listing_offers/ListingOffersScreen.kt` | `(app)/app/listing-offers` |
| 10 | Discover hub | `Features/DiscoverHub/DiscoverHubView.swift` | `ui/screens/discoverhub/DiscoverHubScreen.kt` | `(app)/app/discover-hub` |
| 11 | Discover businesses | `Features/DiscoverBusinesses/DiscoverBusinessesView.swift` | `ui/screens/discoverbusinesses/DiscoverBusinessesScreen.kt` | `(app)/app/discover` |
| 12 | Review claims | _(web only — admin tier)_ | _(web only — admin tier)_ | `(app)/app/admin/review-claims` |

### Archetype evolution (T5.0)

The shared `ListOfRows` archetype gained — additively — 8 leading
variants, 5 trailing variants, a chip-strip slot, a banner slot, a
listing-context hero slot, two FAB variants beyond the 56pt default
(`secondaryCreate` 52pt, `extendedNav` 48pt pill), a section-style
discriminator (`card` for grouped sections in Discover hub), and a new
`primary25 = #f8fbff` design token wired into `@pantopus/theme`,
`Theme.Color.*` (iOS), and `PantopusColors.*` (Android). Every existing
v1 call site (Notifications v1 / MyHomes / MyClaims / Mailbox) compiles
unchanged.

The contract is documented per-platform in:

- `frontend/apps/ios/Pantopus/Features/Shared/ListOfRows/README.md`
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/shared/list_of_rows/README.md`
- `frontend/apps/web/src/components/list-of-rows/README.md`

### Parity gains

The 12 designs landed in lockstep across iOS + Android + web. Each screen
exposes identical render states, carries identical accessibility / test
identifiers (`testTag` ↔ `accessibilityIdentifier` ↔ `data-testid`), hits
the same backend endpoint with the same query params, and renders the
same row geometry (within platform conventions for status bars / FAB
positioning).

**Documented divergences** (all visual-only or pre-existing platform
conventions):

1. **Notifications tab strip** — iOS / Android use shrink-to-fit chip-row
   tabs; web stretches tabs equal-width (`flex: 1`). Same data, same a11y.
2. **Connections / Pets Add flow** — mobile ships a 3-step Wizard; web
   keeps a single-page modal (fewer screens on web).
3. **Notifications context filter** — web has a legacy
   `all / personal / business` segment; mobile ships the design's 2-tab
   set (All / Unread) without it (per F2).
4. **Discover businesses top-bar action** — sliders icon on iOS / Android;
   web has the same icon but inside a button with an explicit label on
   wide viewports.
5. **Review claims** — web only. Mobile admin tier is a T6 candidate (F9).

Full parity matrix at [`docs/mobile-parity-audit.md`](docs/mobile-parity-audit.md).

### Snapshot lockfile

For every new screen, a design-reference snapshot PNG is checked in:

- iOS: `frontend/apps/ios/PantopusTests/__Snapshots__/t5/<screen>-ios.png`
- Android: `frontend/apps/android/app/src/test/snapshots/t5/<screen>-android.png`
- Web: `frontend/apps/web/tests/visual-regression/__snapshots__/t5/<screen>-web.png`

These are the **visual contract** — generated from the design package via
the static HTML harness at `tools/t5-screenshots/` (kept in `/tmp`, regenerable).
Platform-rendered baselines (the bytes the Mac CI / Android Studio CI / Playwright
visual-regression suite produces) live alongside, named per the framework's
convention, and are committed on first record-CI run for iOS/Android and
already-blessed for web. Drift on any platform fails the snapshot suite on the
next PR.

Side-by-side parity composites for all 12 screens:
`docs/screenshots/parity-<screen>.png`.

### Soak tests (regression hardening)

Per [`docs/soak-tests-t5.md`](docs/soak-tests-t5.md):

- **Web (real run, 60s/screen):** Playwright soak harness scrolls + filters
  + pull-to-refreshes each new page for 60 seconds while sampling Chromium
  Heap (`performance.memory.usedJSHeapSize`) and DOM-node counters every
  500 ms. Recorded into `docs/soak-tests-t5/<screen>-web.csv`. Pass
  criterion: **heap delta ≤ 8 MB and DOM-node delta ≤ 200** across the
  full 60 s.
- **iOS (procedure):** XCTest UI test harness drives the same interaction
  loop in the simulator with the Address Sanitizer + Strict-Concurrency
  diagnostics enabled. Wired in CI but executed on macOS runners only.
  Captured under `docs/soak-tests-t5/<screen>-ios.csv` after each CI run.
- **Android (procedure):** Espresso macrobenchmark + LeakCanary in
  instrumented mode drives the same loop on the Pixel 5 emulator profile.
  CI runs the harness on every PR to `master`; LeakCanary's report is
  attached as an artifact, and the soak run captures
  `am dumpsys meminfo` deltas into `docs/soak-tests-t5/<screen>-android.csv`.

### Lighthouse audits (web)

For each new web page, a Lighthouse audit is recorded under
`docs/lighthouse-t5/<screen>.json` / `.html`. Target scores
(P75 across 3 runs): Performance ≥ 85 · Accessibility ≥ 95 ·
Best Practices ≥ 95 · SEO ≥ 90. See
[`docs/lighthouse-t5/README.md`](docs/lighthouse-t5/README.md) for the
run protocol and the latest summary.

### PR sequence

13 merged PRs (T5.0 prereq + 12 features). Detailed inventory at
[`docs/t5-prs/T5-summary.md`](docs/t5-prs/T5-summary.md).

### Known gaps (out of scope; T6 candidates)

1. **Mobile admin role** — Review claims ships web-only. Mobile lands
   when `me.is_admin` + role-guard infrastructure is added.
2. **`shortlisted` / `your_rank` / `top_price` on bid DTO** — My bids
   `Top bid` / `Shortlisted` / `Outbid` chips degrade to `Pending` until
   the backend prep PR lands (optional decoders already in place; no
   mobile change needed when fields appear).
3. **Posts archive endpoints** — My posts Archive / Restore are
   local-only optimistic. `POST /api/posts/:id/archive` + `/unarchive`
   + `GET /api/posts/me?status=archived` tracked separately.
4. **Bills splits write endpoints + DELETE handler** — splits are
   read-only; detail screen soft-deletes via `PUT { status: "cancelled" }`.
5. **`@pantopus/theme` category accents** — web `discover-businesses/categories.ts`
   inlines 6–7 hex constants for category accent palettes.
   `colors.category.<name>` extension tracked separately.
6. **`me.home.bills` Me-tab tile wiring** — Bills is reachable from the
   Home Dashboard tile; the Me-tab tile falls through to the placeholder.
   Parallel-entry-point cleanup for T6.

— Pantopus engineering · 2026-05-16
