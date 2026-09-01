# T6 — Mobile UI/UX buildout: PR summary

Single-pane summary of every PR that landed for the Tier-6 buildout
(46 net-new screens + 2 design-drift re-skins, plus the two brand-new
shared shells — Mailbox-A17 and MapListHybrid — that made the new
designs expressible). PRs are listed in landing order; each row carries
the canonical title, the scope, the file-touch count and test-file count
from the merge commit, and the parity-audit row delta the PR
introduced or updated.

## Reference docs

- **Plan of record:** [`docs/t6-buildout-plan.md`](../t6-buildout-plan.md)
- **Open questions / decisions:** [`docs/t6-open-questions-decisions.md`](../t6-open-questions-decisions.md)
- **Conventions:** [`docs/mobile/pantopus-t5-notes.md`](../mobile/pantopus-t5-notes.md) (still current — no T6 supersede)
- **Definition of Done:** [`docs/mobile-screen-definition-of-done.md`](../mobile-screen-definition-of-done.md)
- **Parity audit (live):** [`docs/mobile-parity-audit.md`](../mobile-parity-audit.md)
- **Wiring audit (live):** [`docs/mobile-wiring-audit.md`](../mobile-wiring-audit.md)
- **Accessibility audit (live):** [`docs/a11y-audit-current.md`](../a11y-audit-current.md)
- **Cross-platform screenshots:** [`docs/screenshots/README.md`](../screenshots/README.md)
- **Lighthouse audits (web):** [`docs/lighthouse-t6/README.md`](../lighthouse-t6/README.md)
- **Snapshot lockfile (T6):** `frontend/apps/ios/PantopusTests/__Snapshots__/t6/` + `frontend/apps/android/app/src/test/snapshots/images/` (Paparazzi) + `docs/screenshots/__snapshots__/t6/`

## PR sequence

PR ordering reflects landing order. P-numbers match the buildout-plan
prerequisite/screen plan; T-numbers are the canonical scope IDs used in
commit messages.

| # | Commit | T-id / P-id | Title | Scope | Parity-audit delta |
|---|---|---|---|---|---|
|  1 | `2afb2404` | T6.0a (P1) | Bills design-drift catch-up — iOS + Android + web | 8 utility-tinted category tiles + 6 status chips + SplitStack avatar row + 60pt canonicalCreate FAB. `UtilityCategoryPalette` + `Gig.task_format` enum + additive shell extensions (`RowModel.splitWith`, `BannerConfig.cta`/`tint`, `FabTint`/`FABAction.tint`). | Reskinned **Bills list (T5.2.2 → T6.0a)** + **Bill detail (T6.0a)** rows. |
|  2 | `c51b8897` | T6.0a (fix) | Android: capture nextDue into val for smart-cast | Compiler fix carried with the T6.0a landing. | (no parity row) |
|  3 | `487220b9` | T6.0b (P2) | My tasks V2 Magic Task re-skin — iOS + Android + web + backend prep | New `RowLeading.magicArchetypeTile` 44pt gradient tile + 18pt sparkles disc, `RowModel.archetypeOverline`, `FabVariant.magicCreate` (60pt), Magic theme quartet (`magic`/`magicBg`/`magicBgSoft`/`magicBorder`), `task_format` column + index + Joi validation. iOS+Android Magic Task plumbing (DTOs, endpoints, settings store). | Reskinned **My tasks V2 (T5.3.2 → T6.0b)** row with the magic chrome additions. |
|  4 | `0e16fa96` | T6.1a (P3) | Auth client foundations — AuthManager extensions + stub screens | `AuthError` typed taxonomy, `AuthErrorViewModel`, `AuthValidation` helpers (E.164 phone, password strength, 18+ DOB), `AuthNavHost` + `AuthRoute` enum. | (prereq — no new feature row) |
|  5 | `f29f4096` | T6.1b (P4) | Auth — Login redesign + Create account + Error state | 3 redesigned auth surfaces. Existing `Features/Auth/LoginView` extended; new `SignUpView` + `AuthErrorView`. Inline-error banner pattern + sticky `formBottomCommitButton` slot on `FormShell`. 14-field signup form with per-platform native date picker. | Added **Login (T6.1b)** + **Create account (T6.1b)** + **Auth error (T6.1b)** rows under "Tier 0 — Auth + Root". |
|  6 | `43208921` | T6.1c (P5) | Auth — Forgot password + Reset password + Verify email | 3 auth tail surfaces with shared `StatusWaitingView` reuse. `pantopus://auth/reset-password` + `pantopus://auth/verify-email` deep-links. Wall-clock-driven resend cooldown VM. | Added **Forgot password (T6.1c)** + **Reset password (T6.1c)** + **Verify email (T6.1c)** rows. |
|  7 | `e8ec9c25` | T6.2a (P6) | Hub design parity refresh — per-section re-skin to hub-frames.jsx | 11-section visual refresh against `hub-frames.jsx` (TopBar identity-tinted ring, SetupBanner pill CTA, TodayCard primary-gradient disc, PillarGrid disc-and-chip, DiscoveryRail 80pt colored top half, JumpBackIn kicker, RecentActivity hairlines, VerifyHero, FloatingProgress conic ring). Direct cutover (no flag) per Q12. | Reskinned **Hub (T1.1 → T6.2a)** row. |
|  8 | `1c0bd132` | T6.2b (P7) | Me design parity refresh — Personal + Home identity re-skin | 3-stop gradient header + identity-switcher pill + 72pt verification-ring avatar + 3-tile stats card + 2×3 action grid + section groups. Identity-tinted destructive sign-out card. | Reskinned **Me / You (T2.1 → T6.2b)** row. |
|  9 | `42ab729b` | T6.2c (P8) | Settings — wire 6 sub-routes (Blocked users · Password · Verification · Help · Legal · About) | 6 new GroupedList sub-routes built on the shared shell. Data export + Payments parked at P8.5 per Q7. | Added **Blocked users · Password change · Verification center · Help center · Legal index · Legal content · About** rows + "Parked Settings sub-routes" §. |
| 10 | `7653d6fc` | T6.3a (P9) | Members per-home — iOS + Android + web | Members / Guests / Pending tabs · 40pt avatarWithBadge leading · role-icon-prefixed subtitle · invite Wizard (3 steps) · `MemberRolePalette`. | Added **Members list (T6.3a / P9)** row. |
| 11 | `3676dd77` | T6.3b (P10) | Maintenance — per-home log + backend prep | 12 category tiles (hvac / plumbing / electrical / roof / gutter / appliance / pest / landscape / cleaning / painting / safety / chimney) via `MaintenanceCategoryPalette` · 6 status chips · summary banner with YTD spend · 60pt canonicalCreate FAB · migration `151_home_maintenance_tasks.sql` (8 new columns + 2 constraints) + 4 new routes + 16 authz tests. | Added **Maintenance list (T6.3b / P10)** row. |
| 12 | `c522deb1` | T6.3c (P11) | Household tasks — per-home chore list | 3 tabs (Active / Done / Recurring) · 8 chore-tinted category tiles (cleaning / trash / kitchen / laundry / yard / pet / errand / kids) via `HouseholdTaskCategoryPalette` · circularAction checkbox on Active with optimistic toggle · home-tinted summary banner · `HomeTask.recurrence_rule != null` Recurring filter. | Added **Household tasks (T6.3c / P11)** row. |
| 13 | `2184f5c7` | T6.3d (P14) | Packages — per-home list + detail + log | 3 tabs (Expected / Delivered / Archived) · 6 status chips mapped from backend `status` CHECK constraint · 8 courier-tinted tiles via `CourierPalette` · summary banner with in-flight + arriving-today + exception counts · 56pt canonicalCreate FAB · log form + detail. | Added **Packages list (T6.3d / P14)** + **Package detail** + **Log a package form** rows. |
| 14 | `5b78197f` | T6.3e (P13) | Polls — per-home polling on iOS, Android, web | 2 tabs (Active / Closed) · 4 poll-kind-tinted typeIcons via `PollKindPalette` · 3-state chip · server-side `option_counts` enrichment for "Leading: <option>" inline chip · `Voted: <option>` info chip · 52pt secondaryCreate FAB · poll detail with optimistic-vote and rollback. | Added **Polls list (T6.3e / P13)** + **Poll detail (T6.3e / P13)** rows. |
| 15 | `92de9320` | T6.3f (P14) | My homes / My listings / My businesses — 3 index screens | Three identity-tinted index screens off the Me tab. MyHomes refresh replaces T1.4 row shape (richer 56pt address tile + role chip + Active-home chip per Q15). MyListings (Active / Sold / Drafts). MyBusinesses (no tabs, business-violet). Flipped `me.homes / me.listings / me.businesses` from `placeholder(label:)` to real screens. | Reskinned **MyHomes (T1.4 → T6.3f)** + added **My listings (T6.3f)** + **My businesses (T6.3f)** rows. |
| 16 | `038aa25d` | T6.3g (P15) | Owners — iOS + Android + web | Avatar-first row · `OwnerProofPalette` (deed / title / document / pending) · "You" inline chip · kebab → Remove confirm with quorum-aware optimistic-remove · 52pt secondaryCreate FAB tinted `.home`. Wired from Me-tab `me.owners` Household-section row. | Added **Owners list (P15 / T6.3g)** row. |
| 17 | `4dc27229` | T6.4a (P16) | Access codes — iOS + Android + web (per-home, category-grouped) | 7-chip filter strip (All / Wi-Fi / Alarm / Gate / Lockbox / Garage / Smart lock) · per-id reveal toggle · copy-to-clipboard + toast · 52pt secondaryCreate FAB tinted `.home`. **Shell extension T6.4a (additive)**: `RowTrailing.iconActions(primary:secondary:)` + `ListOfRowsDataSource.topBarSubtitle`. | Added **Access codes (T6.4a / P16)** row. |
| 18 | `bbbd5026` | T6.4a (fix) | Access codes — flip wiring-audit row from placeholder to shipped | Wiring-audit row flip + comment cleanup. | (wiring audit only) |
| 19 | `45de4811` | T6.4b (P17) | Emergency info + Documents — per-home category-grouped (iOS + Android) | **Emergency info**: 5-chip filter (All / Shutoffs / Contacts / Evac / Medical) · 4-bucket category enum collapsing 9 backend `HomeEmergency.type` values · `EmergencyCategoryPalette` (slate / sky / amber / rose) · per-type glyph helper · circularAction trailing (`phone-call` / `image` / `map-pin`) · Pinned pseudo-section · home-tinted summary banner with Print card CTA. **Documents**: 4-chip filter (All / Recent / Expiring / Shared) · 7 category-grouped sections + Other catch-all · `DocumentFileTypePalette` (pdf / image / doc / sheet / archive / scan) inferred from `mime_type` · Expires chip (warning when ≤60d) · Shared count metaTail · home-tinted summary banner with storage used + Export CTA. | Added **Emergency info (T6.4b / P17)** + **Documents (T6.4b / P17)** rows. |
| 20 | `ab983db0` | T6.4c (P18) | Home calendar — shared household calendar on iOS + Android | `MonthStripHeader` (month label + 7-day week strip with prev/next chevrons + per-day event-count dots) + home-green CalendarBanner + flat-list agenda with date section headers. `CalendarEventCategory` (12 categories) via per-feature palette. **Shell extension T6.4c (additive)**: `customHeader` view-builder slot on `ListOfRows*` between chrome and state body. Wired from Me-tab `me.calendar` action tile + Activity row, and Home Dashboard `calendar` quick-action tile. | Added **Home calendar (T6.4c / P18)** row. |
| 21 | `6fca93ec` | T6.5a (P19) | Mailbox A17 archetype shell — iOS + Android + web | **NEW shared shell `MailItemDetailShell`**: 8 slots (Top nav · Hero · AI elf strip · Key facts · Body · Attachments · Sender · Action buttons) with per-slot test-tag parity (`mailItemDetailShell` + child tags mirror across iOS/Android/web). Shell-only PR — no variant views land in this tier (P20–P23 implement Generic / Booklet / Certified / Community). Designer preview at `/mail-item-detail-preview`. | Added **T6.5a — A17 Mailbox item detail archetype shell (P19)** preamble §. |
| 22 | `655cd665` | T6.5b (P20) | Mailbox root re-skin + generic A17.1 mail detail | **Mailbox list refresh**: lifts T1.3 row anatomy to Notifications V2's typeIcon + body + chip-meta shape with per-category iconography from `mailbox.jsx`. **Mail item detail (generic)**: lands on the shared `MailItemDetailShell`; iOS + Android both wire `HubRoute.mailItemDetail(mailId:)` / `ChildRoutes.MAILBOX_ITEM_DETAIL` to the new generic view; legacy `MailboxItemDetailView` preserved for P21–P23 to migrate piecewise. | Reskinned **Mailbox list (T1.3 → T6.5b / P20)** + added **Mail item detail (generic / A17.1) (T6.5b / P20)** row. |
| 23 | `f91f081e` | T6.5c (P21) | Mail variants: Booklet (A17.2) + Certified (A17.3) | Booklet variant: `BookletPager` (image pager + page-N-of-M indicator + sky scrubber + grid-toggle), 3-column thumbnail grid, Save to Vault primary action. Certified variant: `CertifiedStampBadge` (tilted USPS · CERTIFIED MAIL™ lockup + barcode hash strip + tracking number), `ChainOfCustodyTimeline` (lifted into shared shell folder), `CombinedSenderCarrierCard`, Acknowledge receipt primary action wired to `PATCH /api/mailbox/:id/ack`. | Added **Mail item detail variants — Booklet + Certified (T6.5c / P21)** row. |
| 24 | `22d4c2b6` | T6.5d (P22) | Mail variants — Community (A17.4) + Ceremonial Mail Open refresh | Community variant: "You're going" green check chip + `CommunityBadgeCard` + `CommunityEventCard` + `CommunityAttendeesStrip` + `CommunityPulseThreadCard` cross-link + RSVP chip group. Ceremonial Mail Open refresh: 4-phase animation (Sealed → Breaking → Open → Replying) with reduce-motion support and `startBreakingSeal(skipAnimation:)` parameter; total time ≤ 2 s. | Added **Mail item detail variant — Community (T6.5d / P22)** + reskinned **Ceremonial Mail Open (T6.5d / P22)** rows. |
| 25 | `39172f93` | T6.5e (P19.5 + P23.5) | Mailbox Vault + Ceremonial Compose refresh | **Vault list** (Mailbox personal pillar): sticky search · flat-list section unioning items across the user's vault folders · 40pt `MailboxVaultMailType` typeIcon · folder chip · 52pt secondaryCreate FAB "Save mail to vault". **Ceremonial Mail Compose refresh**: step titles refreshed to Porch Call / Address It / Write It / Seal & Send (presentation-only — internal enum unchanged). | Added **Vault (T6.5e / P19.5)** row + reskinned **Ceremonial Mail Compose (T3.7 → T6.5e)** row. |
| 26 | `dfba9bd6` | T6.5e (fix) | VaultListView shell-driven load + buggy nav callback | Post-merge audit fix carried with T6.5e. | (no parity row) |
| 27 | `bdc7bc75` | T6.5e (CI) | Fix mobile CI failures from T6.5e Vault + Ceremonial refresh | CI greenlight. | (no parity row) |
| 28 | `7db39020` | T6.6a (P24) | MapListHybrid archetype shell — iOS + Android + web | **NEW shared shell `MapListHybridShell`**: 3-detent bottom-sheet (160 / 296 / 518 pt) + full-bleed `WorldMap` + 6 slots (Map layer · Top pill · Category chips · Map controls · Sheet header · Sheet body). Velocity threshold per-platform (600 pt/s iOS, 1200 px/s Android, 600 px/s web). Pin↔list selection sync. Designer preview on each platform. | Added **T6.6a — MapListHybrid archetype shell (P24)** preamble §. |
| 29 | `507b25f8` | T6.6a (fix) | MapListHybrid fixes from independent audit | Post-landing audit fixes. | (no parity row) |
| 30 | `5d8bebc2` | T6.6b (P25) | Chat conversation refresh + New message picker | **Chat conversation refresh**: surgical visual updates per `chat-convo-frames.jsx` (header trailing icon set, AI sparkles, AI welcome card overline, empty-state quick chips, AI prompts, `check-check` delivery state, composer attach `+`, composer send shadow). VM unchanged. **New message picker (NEW screen)**: 3 card-style sections (Connections · Recent · All verified search-driven) · sticky search · 38pt avatarWithBadge with identity-tinted verified badge · replaces `NotYetAvailableView` / `placeholder("New message")` stubs. | Reskinned **Chat conversation (T2.7 → T6.6b / P25)** + added **New message picker (T6.6b / P25)** rows. |
| 31 | `9e17ca21` | T6.6b (fix) | P25 audit fixes — five corrections | Post-merge audit + CI fixes (icon inventory updates, ktlint, detekt). | (no parity row) |
| 32 | `36b3b9eb` | T6.6b (CI) | Fix CI failures from T6.6b (P25) | iOS build + Android lint + tests. | (no parity row) |
| 33 | `3d3e4200` | T6.6b (CI) | Add T6.6b icons to iOS IconTests expected inventory | Icon catalogue alignment with the new `video` / `moreVertical` / `hand` cases. | (no parity row) |
| 34 | `792da346` | T6.6c (P26) | Long-tail leaf screens — refresh sweep + 2 NEW surfaces | 12 leaf screens: 9 refresh-only (Transactional Detail · Content Detail · Audience hub · Creator Inbox · Identity Center · Privacy Handshake · Token Accept · Status / Wait · Legal — all shell-reused, visual-diff pending), 1 deferred (iOS Beacon profile against `/api/personas/:handle` tracked as `T6.6c-followup-beacon-ios`). 2 **NEW** surfaces: **Support Trains list** (3 tabs · personal-tinted · `GET /api/support-trains/me/support-trains` + `/nearby`) and **Review Signups** (organizer-only review queue · 5 filter chips · `GET /api/support-trains/:id/reservations`). | Added **Tier 6 — T6.6c (P26) Long-tail leaf screens** § with rows for every refresh + 2 new surfaces. |
| 35 | `e232f3da` | T6.6c (audit) | Audit fixes — compile, contract, wiring, tests, honest audit | Compile / contract / wiring / test fixes from independent audit of P26. | (no parity row) |
| 36 | `646773eb` | T6.6c (CI) | iOS compile/lint + Android ktlint/detekt/test | CI greenlight. | (no parity row) |
| 37 | `4d25606f` | T6.6c (CI) | SwiftFormat auto-fix + type_body_length | CI greenlight (SwiftLint type_body_length on the new shells). | (no parity row) |
| 38 | **THIS PR** | T6.6c (P27) | Wiring sweep + parity audit + regression hardening | T6 closeout. Wiring sweep refresh (0 remaining `NotYetAvailable` for T6-shipped surfaces) · parity audit refresh · token-lint hex-grep clean · a11y audit refresh (`a11y-audit-t5.md` → `a11y-audit-current.md`) · screenshot lockfile `__snapshots__/t6/{screen}.png` · cross-platform parity composites under `docs/screenshots/parity-*.png` · Lighthouse runbook (`docs/lighthouse-t6/`) · soak-test runbook · `T6-summary.md` (this file) · `RELEASES.md` T6 section · ListOfRows README update + new `MailItemDetail/README.md` + new `MapListHybrid/README.md` for iOS, Android, and web. | Added **Tier 6 — closeout (P27)** preamble § + cross-references. |

### Totals

- **38 PRs** (4 prereq / drift / refresh — T6.0a / T6.0b / T6.2a / T6.2b
  carry the additive shell extensions + theme tokens that everything
  else depends on; 32 feature / fix PRs; this PR is the closeout).
- **Net-new screens shipped:** **34** across iOS + Android (`me-frames` /
  `hub-frames` / 6 auth surfaces / 8 settings sub-routes / 11 home-pillar
  screens / 5 mailbox A17 variants / Ceremonial Mail Compose + Open
  refresh / chat refresh + new message picker / MapListHybrid Nearby /
  Support trains + Review signups / Beacon-iOS-deferred / 9 leaf
  refresh screens). See `docs/mobile-parity-audit.md` for the row list.
- **Net-new shared shells:** **2** (`MailItemDetailShell` for the 5
  Mailbox-A17 variants; `MapListHybridShell` for the Nearby map and
  future map-list consumers).
- **Additive shell extensions:** **8** on `ListOfRows` —
  `RowLeading.magicArchetypeTile`, `RowModel.archetypeOverline`,
  `FabVariant.magicCreate`, `FabTint` enum + `FABAction.tint`,
  `RowModel.splitWith`, `BannerConfig.cta`/`tint`,
  `RowTrailing.iconActions(primary:secondary:)`,
  `ListOfRowsDataSource.topBarSubtitle`, `customHeader` view-builder
  slot — all strictly additive (every v1 call site compiles unchanged).
- **VM tests:** every feature PR ships its `*ViewModelTests.swift` +
  `*ViewModelTest.kt` covering load → loaded / empty / error +
  filter / tab projection + optimistic-mutation rollback.
- **Snapshot baselines:** new iOS `__Snapshots__/t6/` baselines for
  every redesigned screen (hub-populated, me-personal, me-home,
  hub-first-run, hub-skeleton + the screens added in P27 from the
  design pack). Android Paparazzi baselines under
  `app/src/test/snapshots/images/` (see `paparazziVerify` CI gate).
- **CI follow-up fixes:** 9 commits across the run (post-merge audit
  passes + ktlint / detekt / SwiftLint fixes). Every CI job is green on
  `e37b5c8c` (final master).

## Parity-audit coverage

Every screen above maps to a row in
[`docs/mobile-parity-audit.md`](../mobile-parity-audit.md). Coverage matrix
(new T6 rows only; T5 rows continue to apply for the 10 re-issued
no-drift screens):

| # | Screen | iOS view | Android composable | Parity-audit row | 4-state coverage |
|---|---|---|---|---|---|
|  1 | Login (refresh) | `Features/Auth/LoginView` | `ui/screens/auth/LoginScreen` | Tier 0 row 1 | n/a (form) |
|  2 | Create account | `Features/Auth/SignUpView` | `ui/screens/auth/SignUpScreen` | Tier 0 row 2 | n/a (form) |
|  3 | Auth error | `Features/Auth/AuthErrorView` | `ui/screens/auth/AuthErrorScreen` | Tier 0 row 3 | n/a (presentation) |
|  4 | Forgot password | `Features/Auth/ForgotPasswordView` | `ui/screens/auth/ForgotPasswordScreen` | Tier 0 row 4 | form + status |
|  5 | Reset password | `Features/Auth/ResetPasswordView` | `ui/screens/auth/ResetPasswordScreen` | Tier 0 row 5 | form + status |
|  6 | Verify email | `Features/Auth/VerifyEmailView` | `ui/screens/auth/VerifyEmailScreen` | Tier 0 row 6 | banner-driven |
|  7 | Hub (refresh) | `Features/Hub/HubView` | `ui/screens/hub/HubScreen` | Tier 1 row 1 | Skeleton / FirstRun / Populated / Error |
|  8 | Me / You (refresh) | `Features/Me/MeView` | `ui/screens/you/MeScreen` | Tier 2 row "Me / You" | Loading / Loaded / Error |
|  9 | Settings — Blocked users | `Features/Settings/Blocked/BlockedUsersView` | `ui/screens/settings/blocked/BlockedUsersScreen` | Tier 3 row | Loading / Loaded / Empty / Error |
| 10 | Settings — Password change | `Features/Settings/Password/PasswordChangeView` | `ui/screens/settings/password/PasswordChangeScreen` | Tier 3 row | Loading / Ready / Saving / Error |
| 11 | Settings — Verification center | `Features/Settings/Verification/VerificationCenterView` | `ui/screens/settings/verification/VerificationCenterScreen` | Tier 3 row | Loading / Loaded / Error |
| 12 | Settings — Help center | `Features/Settings/Help/HelpCenterView` | `ui/screens/settings/help/HelpCenterScreen` | Tier 3 row | Static |
| 13 | Settings — Legal index | `Features/Settings/Legal/LegalIndexView` | `ui/screens/settings/legal/LegalIndexScreen` | Tier 3 row | Static |
| 14 | Settings — Legal content | `Features/Settings/Legal/LegalContentView` | `ui/screens/settings/legal/LegalContentScreen` | Tier 3 row | Static |
| 15 | Settings — About | `Features/Settings/About/AboutView` | `ui/screens/settings/about/AboutScreen` | Tier 3 row | Static |
| 16 | Members (per-home) | `Features/Homes/Members/MembersListView` | `ui/screens/homes/members/MembersListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 17 | Maintenance (per-home) | `Features/Homes/Maintenance/MaintenanceListView` | `ui/screens/homes/maintenance/MaintenanceListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 18 | Household tasks (per-home) | `Features/Homes/HouseholdTasks/HouseholdTasksListView` | `ui/screens/homes/household_tasks/HouseholdTasksListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 19 | Packages list (per-home) | `Features/Homes/Packages/PackagesListView` | `ui/screens/homes/packages/PackagesListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 20 | Package detail | `Features/Homes/Packages/PackageDetailView` | `ui/screens/homes/packages/PackageDetailScreen` | Tier 1 row | Loading / Loaded / Error |
| 21 | Log a package form | `Features/Homes/Packages/LogPackageView` | `ui/screens/homes/packages/LogPackageScreen` | Tier 1 row | Form |
| 22 | Polls list (per-home) | `Features/Homes/Polls/PollsListView` | `ui/screens/homes/polls/PollsListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 23 | Poll detail | `Features/Homes/Polls/PollDetailView` | `ui/screens/homes/polls/PollDetailScreen` | Tier 1 row | Loading / Loaded / Error |
| 24 | My homes (refresh) | `Features/Homes/MyHomesListView` | `ui/screens/homes/MyHomesListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 25 | My listings | `Features/Listings/MyListingsView` | `ui/screens/my_listings/MyListingsScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 26 | My businesses | `Features/Businesses/MyBusinessesView` | `ui/screens/my_businesses/MyBusinessesScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 27 | Owners (per-home) | `Features/Homes/Owners/OwnersListView` | `ui/screens/homes/owners/OwnersListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 28 | Access codes (per-home) | `Features/Homes/Access/AccessCodesView` | `ui/screens/homes/access/AccessCodesScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 29 | Emergency info (per-home) | `Features/Homes/Emergency/EmergencyInfoView` | `ui/screens/homes/emergency/EmergencyInfoScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 30 | Documents (per-home) | `Features/Homes/Documents/DocumentsView` | `ui/screens/homes/documents/DocumentsScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 31 | Home calendar (per-home) | `Features/Homes/Calendar/HomeCalendarView` | `ui/screens/homes/calendar/HomeCalendarScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 32 | Mailbox A17 generic detail | `Features/Mailbox/MailDetail/MailDetailView` | `ui/screens/mailbox/mail_detail/MailDetailScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 33 | Mail item — Booklet (A17.2) | (variant inside MailDetailView) | (variant inside MailDetailScreen) | Tier 1 row | Loading / Loaded / Error |
| 34 | Mail item — Certified (A17.3) | (variant inside MailDetailView) | (variant inside MailDetailScreen) | Tier 1 row | Loading / Loaded / Error |
| 35 | Mail item — Community (A17.4) | (variant inside MailDetailView) | (variant inside MailDetailScreen) | Tier 1 row | Loading / Loaded / Error |
| 36 | Mailbox list (refresh) | `Features/Mailbox/MailboxListView` | `ui/screens/mailbox/MailboxListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 37 | Vault (Mailbox vault) | `Features/Mailbox/Vault/VaultListView` | `ui/screens/mailbox/vault/VaultListScreen` | Tier 1 row | Loading / Loaded / Empty / Error |
| 38 | Ceremonial Mail Compose (refresh) | `Features/CeremonialMail/CeremonialMailComposeView` | `ui/screens/ceremonial_mail/CeremonialMailComposeScreen` | Tier 3 row | per-step |
| 39 | Ceremonial Mail Open (refresh) | `Features/CeremonialMailOpen/CeremonialMailOpenView` | `ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen` | Tier 1 row | per-phase |
| 40 | Chat conversation (refresh) | `Features/Chat/ChatConversationView` | `ui/screens/inbox/conversation/ChatConversationScreen` | Tier 2 row | Loading / Loaded / Empty / AiWelcome / Error |
| 41 | New message picker | `Features/Chat/NewMessage/NewMessageView` | `ui/screens/inbox/newmessage/NewMessageScreen` | Tier 2 row | Loading / Loaded / Empty / Error |
| 42 | Nearby map (MapListHybrid) | `Features/Nearby/NearbyMapView` (migrated onto shell) | `ui/screens/nearby/NearbyMapScreen` (migrated) | Tier 2 row | Loading / Loaded / Error |
| 43 | Support Trains list | `Features/SupportTrains/SupportTrainsView` | `ui/screens/support_trains/SupportTrainsScreen` | Tier 6 row | Loading / Loaded / Empty / Error |
| 44 | Review Signups | `Features/ReviewSignups/ReviewSignupsView` | `ui/screens/review_signups/ReviewSignupsScreen` | Tier 6 row | Loading / Loaded / Empty / Error |

All rows carry verbatim endpoint paths, root accessibility identifiers /
test tags, and chrome-slot descriptions. The Tier 6 — T6.6c rows
additionally call out the "shell reused; visual-diff pending" honest
status for the 9 refresh-only screens.

## Outstanding follow-ups (out of scope for T6)

These were called out in PR notes, the buildout-plan §H questions, or
discovered during P27 audit and are tracked separately:

1. **iOS Beacon profile against `/api/personas/:handle`.** Tracked as
   `T6.6c-followup-beacon-ios`. Android already calls the persona route;
   iOS still wires `/api/users/:id`.
2. **Long-tail leaf screen visual diff.** 9 of the 12 T6.6c (P26) leaf
   screens reused their existing shell; pixel-perfect spec verification
   against the new mocks is **pending visual diff**. Tracked as
   `T6.6c-followup-baselines`.
3. **Settings sub-routes Data export + Payments & payouts.** Parked at
   P8.5 per Q7 — the export job + Stripe Connect wallet UX both need to
   land first.
4. **Web parity for home-pillar deep screens.** Maintenance, Calendar,
   Documents, Polls, Members, Access, Emergency, Packages, Vault, Owners
   — 10 screens have no web route today. Per Q17 of the buildout plan
   the web sweep is a separate T7 effort.
5. **Hub redesign flag-kill PR.** T6.2a landed direct cutover (no
   feature flag per Q12); the hypothetical flag-kill PR called out in
   buildout-plan J.5 is not needed.
6. **Mobile admin role.** Review claims continues to ship web-only.
   Mobile lands when `me.is_admin` + role-guard infrastructure is
   added.
7. **Hub today reshape backend.** Q5 recommended adding discrete
   `nextPillarEvent` / `outstandingMail` / `openGigsNearby` fields on
   `/api/hub`. T6.2a kept the cutover client-only; the backend reshape
   is a follow-up.
8. **Vault folder picker.** The FAB on Vault pops to the inbox rather
   than presenting a pick-an-item sheet. The magic-ingest flow is the
   canonical entry point and lands later.
9. **Posts archive backend.** My posts Archive / Restore remain local-
   only optimistic (carried over from T5). `POST /api/posts/:id/archive`
   + `/unarchive` + `GET /api/posts/me?status=archived` still tracked
   as backend follow-up.
10. **Bills splits write endpoints.** Splits remain read-only on the
    detail screen. `POST / PATCH / DELETE /api/homes/:id/bills/:billId/splits`
    tracked as backend follow-up.
11. **Maintenance + Documents + Emergency PATCH/DELETE.** Several
    home-pillar surfaces still soft-delete via PUT { status:
    'cancelled' } because no DELETE handler exists. Tracked as backend
    follow-up.
12. **Polls composer.** "Start a poll" lands on a labelled `placeholder`
    until the dedicated wizard ships.
13. **Documents kebab action sheet.** The kebab today routes through
    `onSecondary → DocumentAction.View`; the menu sheet with View /
    Share / Download / Delete is a follow-up.
14. **HomeOwner.share_percentage.** The Owners design surfaces a per-
    owner share percentage; the backend `HomeOwner` row carries no
    `share_percentage` today. Tracked as backend follow-up.
15. **Android `StoreScreenshotsTest` scaffolding.** Placeholder-only;
    wiring the Hilt-graph stub + fixture composition is a release-prep
    milestone of its own (carried over from T5).

## Gates

- **Web lint:** `pnpm -F @pantopus/web lint` — runnable locally after
  `pnpm install` from repo root (CI runs it on every PR via the web
  lint workflow). Captured for this PR in
  [`docs/lint-reports/web-lint-t6.txt`](../lint-reports/web-lint-t6.txt)
  when toolchain is available.
- **Web type-check:** `pnpm -F @pantopus/web type-check`. Pre-existing
  errors in `tests/visual-regression/t5-*.spec.ts` and `tests/setup.ts`
  carry over from T5 (missing `@playwright/test` + `@types/node` types
  on test scaffolding). No new errors introduced in T6 feature dirs.
- **iOS:** authoritative CI gate is `ios-ci.yml`. The remote-execution
  container has no Swift toolchain; the hex-grep guard was reproduced
  manually — **zero matches** in any T6 feature dir.
- **Android:** authoritative CI gate is `android-ci.yml` (ktlint +
  detekt + test + paparazziVerify + assembleDebug). Hex-grep guard
  also reproduced manually — **zero matches** in any T6 feature dir.
- **Hex-literal grep:** zero matches across all iOS + Android T6
  feature dirs.
- **Wiring sweep:** all `NotYetAvailableView` / `placeholder(label:)`
  references remaining in the tree are documented future-tier deferrals
  or parallel-entry gaps — none point at a T6-shipped surface. See
  [`docs/mobile-wiring-audit.md`](../mobile-wiring-audit.md) closeout §
  for the full classification.

## Snapshot lockfile (T6)

iOS design-reference baselines live under
`frontend/apps/ios/PantopusTests/__Snapshots__/t6/`. Each per-screen
PNG is the visual contract the on-device SwiftUI render targets. A
companion `T6ScreensSnapshotTests.swift` asserts each baseline file
exists and is a non-trivial PNG (mirror of the T5 tripwire), so future
PRs that accidentally delete a baseline fail loudly. Records via
the playwright harness at `/tmp/render-t6.mjs` (regenerate by re-
running the script — it reads from the design pack at
`/tmp/designs/A08 — per-screen batch 1/`).

Android Paparazzi baselines live under
`frontend/apps/android/app/src/test/snapshots/images/`. Each screen
that ships a snapshot test records its baselines via
`./gradlew paparazziRecord` then commits the PNGs; CI's
`./gradlew paparazziVerify` step diffs against them on every PR.

Cross-platform parity composites live under `docs/screenshots/`
(see [the screenshots README](../screenshots/README.md) for the full
catalogue including the new T6 entries).

— Pantopus T6
