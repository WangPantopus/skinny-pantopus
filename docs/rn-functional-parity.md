# RN → native functional parity sweep

> Read-only audit of the React Native app (`pantopus/frontend/apps/mobile`) against the native iOS and
> Android implementations. Generated 2026-08-06. **Separate axis from the design audit** — this asks
> only: *what can a user do in RN that they cannot do natively?*

---

## CURRENT BRANCH HANDOFF — 150/150 closed; full CI chain green (2026-08-18)

> This block supersedes the 2026-08-13 handoff. That note described an uncommitted, red Wave D
> worktree on branch `claude/rn-parity-high-severity-fixes`. Since then the tree was committed as
> `c1c03ca2` and merged into `claude/rn-native-parity-audit-fixes` via PR #350, so **the worktree is
> clean** and nothing needs preserving. Every number below was re-measured on 2026-08-17, not carried
> forward.

### What this branch is trying to finish

Close the 150 RN → native functional gaps on **both iOS and Android**, using React Native as the
behaviour oracle, the A-series designs as the layout oracle, and `backend/app.js` plus the mounted
router as the endpoint-contract oracle. Functional parity, not visual redesign. Marketplace/Listings,
styling/copy-only differences, dead RN code and debug-only screens stay out of scope. A finding is
closed only when both platforms have live data, a production entry point/call site, honest
loading/empty/error/populated states, and a green compile/test gate.

### Verified state — 2026-08-18

Everything below was run locally against this tree, matching the CI job definitions.

| Gate | Result |
|---|---|
| iOS build + test target (`build-for-testing`) | **BUILD SUCCEEDED** |
| iOS `PantopusTests` | **3,418 tests, 168 skipped, 0 failures** |
| SwiftLint | **0 errors** (warnings only, as on master) |
| Android `ktlintCheck` | **BUILD SUCCESSFUL** |
| Android `detekt` | **BUILD SUCCESSFUL** |
| Android `:app:lintDebug` | **BUILD SUCCESSFUL** |
| Android `test` + `paparazziVerify` | **BUILD SUCCESSFUL** — 3,382 tests |
| Android `:app:assembleDebug`, `verifyPantopusIcons` | **BUILD SUCCESSFUL** |
| Raw-hex guard over `ui/screens` | clean |
| Route reachability (`android-routes.py`) | 38/38 routes registered **and** navigated |

**PR #349 CI: all nine checks green** — Backend Tests, Seeder Tests, Web Type-check & Lint,
Lint (SwiftLint + SwiftFormat), Tests on iPhone 16 / 16 Pro / SE, Android "Lint, test, assemble",
and Instrumented tests (emulator). Android CI had been red since before this handoff: at the
pre-session commit its instrumented job died at `:app:compileDebugKotlin`, which hid a
`NoWhenBranchMatchedException` in `AddHomeWizardScreenTest` (a relaxed mock repository never stubbed
the `propertySuggestions` call the ATTOM lookup added, so it returned a value matching neither
`NetworkResult` case). `gate.sh` now compiles the instrumented source set too — it was the last one
that could rot unnoticed.

**ktlint and detekt had both been red on this branch and nobody knew** — the gate never ran them, and
`master` passes both. At the previous commit this branch carried 144 ktlint violations and 72 detekt
violations. ktlint was resolved with `ktlintFormat` plus one property rename; detekt was resolved by
fixing the genuine defects (two `ImplicitDefaultLocale` mileage bugs, one dead parameter) and applying
the repo's own file-level `@file:Suppress` convention — already used by 950 of 1,311 Kotlin files —
for the structural rules on the remaining 58.

### Finding accounting after a per-finding both-platform re-audit

The 31 findings the old handoff listed as outstanding were re-audited individually against both
platforms, then every claimed-complete one was adversarially re-checked. That pass moved the numbers
in both directions:

| | Count |
|---|---:|
| High severity | 64 / 64 closed |
| Medium/low Wave A — homes (`b0c18b60`) | 18 / 18 closed |
| Medium/low Wave B — mailbox + gigs, committed half (`28cf1ca9`) | 18 / 23 closed |
| Medium/low Wave C — tabs/social + creator/biz (`9b23bb6f`) | 19 / 19 closed |
| Medium/low re-audited (the old "31 outstanding") | **16 closed**, 15 still open |
| Tier 1 — six one-platform gaps | 6 / 6 closed |
| Tier 2 — Android Earnings & Spending | 1 / 1 closed |
| Tier 3 — skills, Gigs tab, AI bio, Portfolio, Reviews tab, Family Mail Party | 6 / 6 closed |
| Tier 4 — resend-verification + invite-code link | 2 / 2 closed |
| **Closed total** | **150 / 150** |
| **Genuinely open** | **0** |

The old count of 119 was pessimistic. Wave D landed more than its checkpoint claimed, and three of the
five "deferred" Wave B findings turned out to be complete or nearly so.

**Corrections to the previous handoff's list of six incomplete Wave D findings:**

- `recentLocations` is **closed** — Wave C's viewing-location work does satisfy it. Reclassified.
- Machine translation and the package-help request form, both listed as deferred Wave B, are **closed**.
- Professional pricing/service-area/categories, professional verification start, show-email/show-phone,
  the payments History tab, partial withdrawal, the wallet frozen flag, lifetime totals, the Connect
  tri-state, the Payouts scaffold, the pending-release breakdown, the app-lock setup prompt and the
  muted/hidden filter layer are all **closed on both platforms**.

### Findings status

Ordered by the sequence they should be worked in. Effort is per finding, both platforms.

**Tier 1 — CLOSED 2026-08-18.** All six were one-platform gaps; each is now implemented and
compile-gated on both platforms. Kept here with what was actually built, for review:

1. **Gig live-status share link — Android UI only.** Endpoint, repository, `canShareLiveStatus()` and
   `shareLiveStatus()` all exist (`GigDetailViewModel.kt:829-856`). Missing: the overflow entry in the
   `buildList` at `GigDetailScreen.kt:181`, and a `LaunchedEffect` collecting `liveStatusEvents` to copy
   the URL and toast. Mirror `GigDetailView.swift:226-239`. **S**
2. **v2 scored offers — Android presentation only.** `GigsV2Api`/`GigsV2Repository`/`fetchOwnerBids`
   fallback all present. Missing: pass `rankings` into `GigOwnerBidsPanel` (`GigLifecyclePanels.kt:315`,
   call site :110) and render `trustLine` + the `isRecommended` "BEST MATCH" pill, matching
   `GigLifecycleSections.swift:123-140`. **S**
3. **Pull-to-refresh on Payments — Android only.** Wallet has it
   (`WalletScreen.kt:184`); `ui/screens/settings/payments/` has zero refresh wiring. Add a `refreshing`
   StateFlow to `PaymentsViewModel` and a `PullToRefreshBox` around the loaded frame. iOS has both. **S**
4. **Remove-card confirmation — now missing on iOS, not Android.** The finding has inverted since it
   was written. Android gained a real `AlertDialog` naming the last4 (`PaymentsScreen.kt:225-278`).
   iOS's `confirmationDialog` at `PaymentsView.swift:56-64` is the *action menu*, and its "Remove Card"
   item fires the DELETE immediately (`PaymentsView.swift:87-89`). Add a second confirmation step. **S**
5. **Relationship-driven Connect control — Android reads it but never renders it.** The endpoint,
   repository and `PublicProfileViewModel.kt:604-634` are all correct, but no composable consumes
   `_connection`; the control is dead code. Bind it in the public-profile chrome. iOS is complete. **S**
6. **`SensitiveScreenGuard` on Payments — Android only.** `grep 'SensitiveScreenGuard('` returns the
   definition plus exactly one call site (`WalletScreen.kt:179`). Wrap `PaymentsScreen` the same way.
   Separately, both platforms still lack the action-level re-verify before Stripe Connect
   onboarding / continue-setup / open-dashboard that the withdraw path already has. **S**

**Tier 2 — CLOSED 2026-08-18. Was absent on Android, built on iOS**

7. **Earnings & Spending summary — Android.** iOS is complete end to end
   (`EarningsEndpoints.swift`, `PaymentsEarningsDTOs.swift`, `PaymentsViewModel.fetchEarnings`).
   Android has nothing: no endpoint, DTO, repository or card. Note `GET api/mailbox/earnings/summary`
   is a *different* capability — do not reuse it. **M**

**Tier 3 — CLOSED 2026-08-18. Was absent or orphaned on both platforms**

8. **Edit-profile skills editor.** iOS declares `updateSkills` (`ProfileTabsEndpoints.swift:93`) with
   zero callers; Android has no `PUT /api/users/skills` at all. Neither Edit Profile collects skills. **M**
9. **Public-profile Gigs tab.** iOS has `ProfileGigsViewModel` + `ProfileGigsSection`, unmounted.
   Android's `GigsApi.kt:76-91` has no `user_id` param and `GigsTabContent()` is a hard-coded
   "No recent gigs" stub. **M**
10. **Generate bio with AI.** `POST /api/ai/draft/post` is wired on neither platform; both Edit Profile
    bio fields are plain text editors. **M**
11. **Portfolio tab + add/delete.** iOS has endpoints, uploader, ViewModel and a full section with add
    sheet, filters, delete confirm and viewer — with zero call sites. Android has nothing (the
    professional editor's `PortfolioLink` is a different, sample-data-backed capability). **L**
12. **Public-profile gig Reviews tab.** iOS has the full stack unmounted; Android has no
    `GET /api/reviews/user/:userId` route at all. **L**
13. **Family Mail Party.** Both platforms have the complete network layer — all six routes, all DTOs,
    a repository, a Hilt provider — and **zero consumers on either side**. Everything above the network
    layer is missing: ViewModels, discover list, live session view, routes, entry affordances. This is
    the single largest remaining item. **L**

**Tier 4 — both closed**

Finding 15 (resend verification): the iOS 403 mapping is fixed and covered by a regression test, so
the button can actually render.

Finding 14 (invite code from a `/join/:code` link) is now closed too. The owner confirmed on
2026-08-18 that **`pantopus.com` is the product domain**, which was the one thing blocking it. Both
apps now claim it:

- iOS `Pantopus.entitlements` gained `applinks:pantopus.com` and `applinks:www.pantopus.com`. The
  `.app` entries stay — iOS verifies each domain independently, so an unserved one costs nothing and
  links already shared keep resolving.
- Android's `autoVerify` filter now lists `pantopus.com` / `www.pantopus.com`, and `pantopus.app`
  moved to a **separate filter without `autoVerify`**. That split is deliberate: `minSdk` is 26, and
  below API 31 App Links verification is all-or-nothing across every `autoVerify`'d host, so leaving
  an unserved `.app` in the same filter would have silently broken verification for `.com`.
- Both clients' gig share links moved from `pantopus.app/gigs/<id>` to `pantopus.com/gigs/<id>` — a
  share link on an unclaimed domain has the same defect the invite link had. `DOWNLOAD_URL` /
  `downloadURLString` stay on `pantopus.app`: those are store landing pages, not deep links.
- Neither router needed a change — both resolve on path segments and are host-agnostic. New tests on
  both platforms pin the HTTPS `/join/<code>` and `/gigs/<id>` forms so this cannot regress.

14. **Invite code from a `/join/:code` link.** The nav/DTO plumbing is genuinely built and symmetric on
    both platforms, but the capability cannot fire in production. See *Production bugs found* below;
    fix those first, then re-verify. **S once unblocked**
15. **Resend verification email — iOS gate is unsatisfiable.** Android is closed. On iOS the button's
    render condition can never be true. See *Production bugs found*. **S**

### Production bugs found while auditing (not in the original 150)

Each was confirmed by reading the cited source, not inferred.

1. **~22% of invite codes hard-fail registration.** Codes are minted as
   `crypto.randomBytes(6).toString('base64url').slice(0, 8)` (`backend/routes/users.js:2872`, retry
   `:2890`) — the base64url alphabet includes `-` and `_` — while `registerSchema` requires
   `Joi.string().alphanum()` (`backend/routes/users.js:724`) and `backend/middleware/validate.js:66-90`
   400s the whole request. `(62/64)^8 ≈ 0.776`, so roughly one invite code in 4.5 blocks account
   creation instead of crediting a referral. The code comment above the generator even says
   "8-char alphanumeric". Fix at the generator (restrict the alphabet) rather than at the schema.
2. **Invite links can never open either app.** The invite URL is `https://pantopus.com/join/<code>` —
   built identically by the backend (`users.js:2867,2899,2908`), iOS (`MeViewModel.swift:69`) and
   Android (`MeViewModel.kt:80`). Neither app claims that host: iOS `Pantopus.entitlements` declares
   only `applinks:pantopus.app` / `www.pantopus.app`, and `AndroidManifest.xml:61-67` autoVerifies the
   same two `.app` hosts. The only way to reach the join wiring today is hand-typing
   `pantopus://join/<code>`.
3. **`/join/*` is absent from the AASA.** `frontend/apps/web/public/.well-known/apple-app-site-association`
   lists `/invite/*` but no `/join/*`, so even on a host iOS did claim, a join link would go to Safari.
   Android's filter is host-wide, making the HTTPS half of this capability Android-only.
4. **iOS never surfaces "Resend verification email".** `APIClient.swift:254` throws `APIError.forbidden`
   for 403 *before* the generic `400..<500` case, discarding the body. `mapSignInError`
   (`AuthManager+ErrorMapping.swift:12-20`) has no `.forbidden` case, so it falls to `.unknown` →
   "Something went wrong. Please try again." `LoginView.swift:487` gates the button on the copy
   containing "verify", so it never renders. The doc comment at `LoginView.swift:485` asserts the 403
   maps to `.serverError(_)`; it does not. One-line fix: add
   `case .forbidden: .serverError("Please verify your email before signing in.")`.
5. **The map filter sheet renders two Distance sections, on both platforms.** Wave B added
   `distance` / `deadline` / `archetype` chips to `GigFilterCriteria.toSections()`. `MapFilterCriteria`
   already contributes its own range-slider `distance` section and then appends `gig.toSections()`
   (`MapFilterSheet.kt:88`, mirrored on iOS), so the sheet now contains two sections with
   `id == "distance"`. `fromSections` survives it only because it discriminates on control type. This
   is what `MapFilterCriteriaTest` / `MapFilterSheetTests` are actually catching — the assertion is not
   merely stale. Decide whether the map sheet should exclude the gig-level distance chips (recommended)
   and then update both suites.
6. **`ProfileTabsEndpoints.updateSkills`, and the whole Family Mail Party network layer on both
   platforms, are declared with zero call sites.** Symmetric across platforms, so `xplatform.sh` will
   not flag them; only the reachability check will.

### Repairs landed on the working tree (uncommitted)

Five files, 30 insertions, 5 deletions — the minimum needed to turn both gates green:

- `BeaconIdentityBlock.kt` — add the missing `androidx.compose.ui.draw.alpha` import and define the
  `DISABLED_ALPHA` constant the code already referenced (it existed nowhere in the tree).
- `WalletScreen.kt` — add eleven missing imports (`PullToRefreshBox`, `rememberCoroutineScope`,
  `BasicTextField`, `KeyboardOptions`, `KeyboardType`, `TextStyle`, `SolidColor`,
  `SensitiveScreenGuard`, `rememberSensitiveActionGuard`, `AppLockManager`, `kotlinx.coroutines.launch`).
- `Payments/EarningsDTOs.swift` → `Payments/PaymentsEarningsDTOs.swift`, and its
  `EarningsSummaryResponse` renamed to `PaymentsEarningsResponse`. The previous handoff described this
  as a duplicate *filename*; it was also a duplicate *public type* — `Mailbox/EarningsDTOs.swift:16`
  already owns `EarningsSummaryResponse` in the same module, and `EarnViewModel` decodes the mailbox
  shape through it. Renaming the file alone would have produced a redeclaration error.
- `PaymentsViewModel.swift` — the one call site follows the rename.
- `WalletViewModel.swift` — `parseWithdrawAmount` returned `Result<Int, String>`, which cannot compile
  because `String` does not conform to `Error`. Replaced with a `WithdrawAmount` enum carrying the same
  two cases, matching `GigDetailViewModel.RemindWorkerOutcome`, which solved this exact problem earlier.
- Four Android test files (`GigDetailSaveViewModelTest`, `GigTipViewModelTest`, `OffersViewModelTest`,
  `PublicProfileViewModelTest`) updated for constructor parameters added by Waves B and D.

### The gate itself was the root cause — fix this before the next wave

**`gate.sh` compiles `:app:compileDebugKotlin` and `make build` only. Neither touches a test source
set.** The Android unit-test target has not compiled since **Wave B (`28cf1ca9`)**, which added
`gigsV2Repo` to `GigDetailViewModel` and `gigsRepo` to `OffersViewModel` without updating their tests;
Wave D then added `connections` to `PublicProfileViewModel`. **Waves B, C and D therefore landed with
no Android unit test having run at all** — the same failure mode the high-severity pass hit on iOS and
recorded as fixed. The recorded "Android 3,264 green" applies only to the high-severity pass.

Also broken for any checkout at a different path:

- `gate.sh`, `reachability.sh`, `waveb-audit.sh`, `endpoint-parity.sh`, `xplatform.sh` and all twelve
  `wf-*.js` hardcode `ROOT=/Users/yingpengwang/pantopus/native/pantopus`, which does not exist here.
  Make them derive the root from `git rev-parse --show-toplevel`.
- `gate.sh` sets `JAVA_HOME` to a `temurin-17.jdk` that is not installed; this machine has `zulu-17.jdk`.
- Android needs `ANDROID_HOME` or `local.properties` (gitignored); without it Gradle fails at
  configuration with "SDK location not found", *before* any Kotlin compiles — which reads like a
  compile failure but is not one.

Add `:app:compileDebugUnitTestKotlin` (or the full `testDebugUnitTest`) and the iOS test target to the
gate before starting Tier 1.

### Recommended order

1. Repair the gate: derive `ROOT` from git, correct `JAVA_HOME`, document the `ANDROID_HOME`
   requirement, and add both test targets. Commit the five-file compile repair with it.
2. Fix the six current test failures. Two of them (map filter distance) need the product decision above;
   the four iOS `PaymentsViewModelTests` failures come from Wave D's new earnings/spending/connect
   requests hitting an unstubbed fake that 599s — stub the new paths.
3. Tier 1 (findings 1-6): six small one-platform gaps. Compile-gate and test after each pair.
4. The five production bugs above, which are cheap and user-visible, then re-verify findings 14 and 15.
5. Tier 2, then Tier 3 in the order listed. Family Mail Party last — it is the only one that needs a
   full feature build on both platforms.
6. Final branch checks: both full unit suites, SwiftLint, `verifyPantopusIcons`, route reachability,
   endpoint parity, and a per-finding review of all 86 medium/low items. `reachability.sh` diffs
   `master...HEAD` and `endpoint-parity.sh` was written for the 64 high findings — extend its checklist
   to the medium/low endpoints rather than assuming it covers them.

Working instructions live in `docs/_parity-work/BRIEF.md` and `docs/_parity-work/BRIEF-MEDIUM.md`.

---

## STATUS — all 64 high-severity findings closed (2026-08-11)

Branch `claude/rn-parity-high-severity-fixes`. Every high finding below was implemented on **both**
platforms, in six waves, each compile-gated before the next started:

| Wave | Cluster | Findings | Commit |
|---|---|---|---|
| 1 | homes-a + homes-b | 16 | `81d4f6d0` |
| 2 | mailbox | 10 | `ebbb1c07` |
| 3 | gigs + money | 10 | `8fcb7ae0` |
| 4 | tabs-social | 10 | `d59be020` |
| 5 | auth-settings | 7 | `27a6a0e3` |
| 6 | creator-biz | 11 | `c44bb907` |

**Verification performed:** iOS `make build` and Android `:app:compileDebugKotlin` green after every
wave; SwiftLint clean; `verifyPantopusIcons` clean; **both unit suites green — iOS 3139 tests, Android
3264 tests, zero failures**; all 33 new Android routes confirmed to have both a `composable(...)`
registration *and* a production navigation call site; every endpoint the findings required confirmed
present on both platforms.

**Bugs found in existing code while doing this** (not in the original audit):

- Every Support Train endpoint targeted `/api/support-trains/*`, which does not exist — the router
  mounts at `/api/activities/support-trains` (`backend/app.js:404`). All nine pre-existing helpers were
  hitting 404s on both platforms.
- The privacy DTOs carried fields absent from the route's Joi schema, and that validator runs
  `allowUnknown: false` — every `PATCH /api/privacy/settings` would have 400'd.
- `CeremonialMailOpen` read `stationeryTheme` from the wrong level of `object_payload`, so theme / ink /
  voice always fell back to defaults.
- Two Support Train DTOs decoded a capitalised Supabase alias instead of the lowercase `user` object the
  handlers actually return.
- The **iOS test target was not compiling** — a test used `httpBodyData()` without declaring the
  `fileprivate` copy each test file carries — so the entire iOS unit suite had been silently not
  running. Fixed; it now runs and passes.

**Known caveats, stated plainly:**

- `verifyPantopusTokens` is red, but it was already red on `master` (406 distinct violations there). This
  branch adds ~24 more, all `size = N.dp` on `PantopusIconImage`, matching the pervasive codebase idiom —
  there is no icon-size token to use instead. Not fixed, to avoid making new code inconsistent with old.
- Waves 3 and 5 lost their adversarial audit agents to session limits, and the final adversarial review
  wave failed outright for the same reason. The mechanical verification above was run by hand instead;
  a full per-finding adversarial re-verify has **not** been done.
- `BusinessInvoicesEndpoints.receivedInvoices` (the paged list) is declared on both platforms with no UI
  caller yet — symmetric across platforms, and groundwork for a received-invoices list.

The detailed medium (73) and low (13) entries below retain the original audit wording. Their current
branch status is tracked in the handoff block above; do not infer completion from an endpoint/helper or
screen existing without its opposite-platform implementation, production call site and verification.

---

## Headline (original audit, 2026-08-06)

**142 RN routes reviewed. 38 fully migrated. 150 gaps (64 high / 73 medium / 13 low).**

That is **27% route-level functional parity**, against a plan that describes the migration as "~90% done".
The 90% figure is defensible for *screens that exist* — the design audit found 165 of 326 frames already
matching, and whole feature areas (Mailbox root, mail-detail variants, Bills, Packages, Pets, Polls) are
faithful or richer than RN. What is missing is **secondary actions and network wiring**: the screen is
there, the button is not, or the button is there and calls nothing.

Scope excluded by instruction: Marketplace/Listings surfaces, styling/copy, dead RN code, debug screens.

| Cluster | Migrated / Reviewed |
|---|---|
| homes-a | 4 / 18 |
| homes-b | 4 / 18 |
| mailbox | 1 / 24 |
| gigs | 3 / 12 |
| tabs-social | 8 / 24 |
| auth-settings | 8 / 20 |
| creator-biz | 9 / 22 |
| money | 1 / 4 |

| Gap kind | Count |
|---|---|
| missing-action | 63 |
| missing-endpoint | 45 |
| missing-state | 26 |
| missing-route | 13 |
| one-platform-only | 3 |

---

## The pattern that matters

Three failure modes account for most of the 64 high findings:

1. **Screens wired to sample data instead of the API.** The Home dashboard never calls
   `GET /api/homes/:id/dashboard` — its hero stats are hardcoded. Received-invoice detail is
   fixture-only. iOS Mailbox Map and Vacation Hold have no network at all while Android wires both.
2. **Dead controls.** "Delete Account" renders with a chevron and does nothing. Notification settings
   persist nothing — every toggle is lost on navigation. "Change tier" and "Request a refund" route to
   placeholders. Ownership transfer is hard-gated behind a flag that is never set true.
3. **Whole capabilities absent.** Business page editor, catalog CRUD, Stripe Connect, invoicing, and
   verification have no native surface at all. Neither does universal search, guest-pass management,
   the owner claim-review queue, or Community mail.

---

## High-severity findings (64)


### homes-a

- **[missing-endpoint]** The native Home dashboard never calls GET /api/homes/:id/dashboard — its hero stats and overview (upcoming/activity/emergency) are hardcoded sample constants, so a user sees fake counts ("4 Packages / 2 Access codes / 7 Tasks") instead of their household's real data.  
  RN `src/app/homes/[id]/index.tsx:66-90` · endpoint `GET /api/homes/:id/dashboard (backend/routes/home.js:6224)`
  iOS: Pantopus/Features/Homes/HomeDashboardViewModel.swift:167-181 + :200-213 — stats literal "4"/"2"/"7"; content() at :201-213 uses HomeDashboardSampleData.populatedQuickActions / .populatedOverview. Only HomesEndpoints.detail + publicProfile are fetched (:145-162).  
  Android: app/src/main/java/app/pantopus/android/ui/screens/homes/HomeDashboardViewModel.kt:226-232 and :244-249 — same literal HomeHeroStat("packages","4"…); :275-277 uses HomeDashboardSampleData.populatedQuickActions/.populatedOverview.
- **[missing-endpoint]** The whole Home Intelligence stack — health-score ring, seasonal checklist with Complete/Skip/Generate/Hire-help actions, and the property-value card — is absent natively. Neither app calls any of the four endpoints.  
  RN `src/app/homes/[id]/index.tsx:251-283 (via src/hooks/useHomeIntelligence.ts)` · endpoint `GET /api/homes/:id/health-score (home.js:7482); GET /api/homes/:id/seasonal-checklist (:7504) + PATCH /:id/seasonal-checklist/:itemId (:7577); GET /api/homes/:id/property-value; GET /api/homes/:id/bill-trends (:7596)`
  iOS: not found — grep for "health-score", "seasonal-checklist", "property-value", "bill-trends" over Pantopus/Core/Networking returns nothing.  
  Android: not found — same grep over app/src/main/java/app/pantopus/android/data returns nothing.
- **[missing-action]** "Delete Home" (trash icon on rows where can_delete_home is true, with a confirm alert warning it removes the home for all members) has no native counterpart — DELETE /api/homes/:id is called by neither app, so an owner can never delete a home from the phone.  
  RN `src/app/homes/index.tsx:110-126, :249-252` · endpoint `DELETE /api/homes/:id (packages/api/src/endpoints/homes.ts:172)`
  iOS: not found — HomesEndpoints.swift has no `.delete` on "/api/homes/{id}"; MyHomesListViewModel.swift:137-153 builds rows with only `.chevron` trailing and no kebab menu.  
  Android: not found — HomesApi.kt has no @DELETE("api/homes/{id}"); MyHomesListViewModel.kt:143-158 same chevron-only row.
- **[missing-action]** Change a member's role (swap-horizontal icon per row → action sheet of assignable roles) is absent natively; the endpoint is never called, so an owner/admin cannot promote or demote a household member.  
  RN `src/app/homes/[id]/members/index.tsx:93-116` · endpoint `POST /api/homes/:id/members/:userId/role (packages/api/src/endpoints/homeIam.ts:147-153)`
  iOS: not found — MembersListViewModel.swift kebab menu only offers Remove (:29, :191, :218); HomesEndpoints.swift has no role endpoint.  
  Android: not found — MembersListViewModel.kt mirrors it; HomeMembersApi.kt:43 only has @DELETE("api/homes/{id}/members/{userId}").
- **[missing-endpoint]** The Members screen's "Requests" tab — pending household-access requests from people who used the claim flow's "ask verified owner" path, with Invite / Decline buttons — does not exist natively. Requests silently pile up server-side with no way to act on them.  
  RN `src/app/homes/[id]/members/index.tsx:62, :145-195, :321-379` · endpoint `GET /api/homes/:id/household-access-requests; POST …/:requestId/approve; POST …/:requestId/reject (packages/api/src/endpoints/homes.ts:489-508)`
  iOS: not found — MembersListViewModel.swift:74-79 exposes only Members / Guests / Pending(invites) tabs; no "household-access-requests" string anywhere in Pantopus/.  
  Android: not found — MembersListViewModel.kt:267-269 same three tabs; no such string under app/src/main/java.
- **[missing-route]** The "Find or Add Home" discovery screen (search public-preview homes by address, tap a result to start an ownership claim, empty-state "add missing home" CTA, and a manual invite-code entry box) has no native equivalent. GET /api/homes/discover is called by neither app, and the 409-blocked claim path in evidence.tsx routes users here with no destination natively.  
  RN `src/app/homes/find.tsx (whole route, reachable from claim-owner/evidence.tsx:210)` · endpoint `GET /api/homes/discover (backend/routes/home.js:2297); GET /api/homes/invitations/token/:token`
  iOS: not found — no screen for homes discovery; grep "homes/discover" over Pantopus/ returns nothing. Invite tokens are accepted only via deep link (RootTabView.swift:121 TokenAcceptView).  
  Android: not found — same; TokenAcceptScreen at RootTabScreen.kt:3724 is deep-link-only, no manual code field.
- **[missing-action]** The "Ask a verified owner to add me" option on the claim-start screen (shown when the home already has a verified owner and you are not a member) is missing natively, so a non-member has no way to request household access from the owners.  
  RN `src/app/homes/[id]/claim-owner/index.tsx:30-35, :76-91` · endpoint `POST /api/homes/:id/request-household-from-owner (packages/api/src/endpoints/homes.ts:~520)`
  iOS: not found — ClaimOwnership/Steps/ClaimStartStep.swift renders only a requirements card + "why we ask"; no method picker and no such endpoint in Pantopus/Core/Networking.  
  Android: not found — ui/screens/homes/claim_ownership/ClaimOwnershipWizardScreen.kt mirrors iOS; no such endpoint under data/.
- **[missing-state]** The residency-verification variant of the evidence flow (verificationType=residency → claim_type 'resident', lease/utility-bill/tax-bill document options) is absent natively. The "Upload documents to verify residency" strip on the homes list (index.tsx:262-283) therefore has no native destination and pending residents cannot complete verification.  
  RN `src/app/homes/[id]/claim-owner/evidence.tsx:33-37, :92-95, :162-165` · endpoint `POST /api/homes/:id/ownership-claims with claim_type='resident'`
  iOS: not found — ClaimOwnershipSteps.swift:23-45 hardcodes two slots (idv + deed); ClaimOwnershipWizardViewModel.swift:229 always sends SubmitClaimRequest(method:"doc_upload") with no claim_type. Grep "residency" over Features/Homes returns nothing.  
  Android: not found — ClaimOwnershipWizardViewModel.kt:217 same SubmitClaimRequest(method = "doc_upload"); no residency path.
- **[missing-state]** Add Home never handles the "address already claimed" outcome natively. RN reads checkAddress status HOME_FOUND_CLAIMED → shows AddressClaimedModal → confirm → submits a residency claim against the existing home instead of creating a duplicate. Native ignores the status and always POSTs /api/homes, creating a duplicate home row.  
  RN `src/app/homes/new.tsx:275-287 (src/components/homes/useHomeForm.ts:592-620, :465)` · endpoint `POST /api/homes/check-address → HOME_FOUND_CLAIMED; POST /api/homes/:id/residency-claims`
  iOS: Pantopus/Features/Homes/AddHome/AddHomeWizardViewModel.swift:326-347 stores addressCheck but :350-377 submit() unconditionally calls HomesEndpoints.create; grep HOME_FOUND_CLAIMED returns nothing.  
  Android: ui/screens/homes/add_home/AddHomeWizardViewModel.kt:383 same unconditional CreateHomeRequest; grep HOME_FOUND_CLAIMED returns nothing.
- **[missing-endpoint]** RN's Maintenance screen is the HomeIssue tracker — list, "Report Issue" create, status transitions, dismiss. Native's Maintenance screen is a different backend collection (maintenance tasks). Neither native app ever calls /api/homes/:id/issues, so a resident cannot report or view home issues.  
  RN `src/app/homes/[id]/maintenance.tsx:36, :53, :65, :75` · endpoint `GET/POST /api/homes/:id/issues, PUT /api/homes/:id/issues/:issueId (backend/routes/home.js:4386, :4420, :4462) — distinct table (HomeIssue) from /:id/maintenance (:4695)`
  iOS: Pantopus/Features/Homes/Maintenance/MaintenanceListViewModel.swift uses HomesEndpoints.maintenance (HomesEndpoints.swift:231) only; no "/issues" path in Pantopus/Core/Networking.  
  Android: ui/screens/homes/maintenance/MaintenanceListViewModel.kt:159 repo.getHomeMaintenance; HomesApi.kt has no api/homes/{id}/issues route.

### homes-b

- **[missing-state]** Postcard code entry is permanently locked on both native apps: the delivery stage is derived from a sample helper that returns `.inTransit` for every real home id (only ids literally containing the substring "delivered" unlock), and the code field + Verify CTA are gated on `stage == .delivered`. A user who has the postcard in hand can never submit the 6-digit code, so `POST /api/homes/:id/verify-postcard` is unreachable in production. RN lets the user type the code at any time and also offers an explicit "I already have a code" escape hatch (verify-postcard.tsx:146-152).  
  RN `src/app/homes/[id]/verify-postcard.tsx:64-91,145-152` · endpoint `POST /api/homes/:id/verify-postcard`
  iOS: Pantopus/Features/Homes/VerifyLandlord/Postcard/PostcardVerificationViewModel.swift:84-89 (`stage(for:)`), :148-150 (`isCodeInputUnlocked`), :161-163 (`primaryCTAEnabled`)  
  Android: app/src/main/java/app/pantopus/android/ui/screens/homes/verify_landlord/postcard/PostcardVerificationViewModel.kt:67-71 (`stage(homeId)`), :93 (`isCodeInputUnlocked`), :97-98 (`primaryCtaEnabled`)
- **[missing-route]** Entire home-owner claim review surface is absent from both native apps. A home owner cannot see incoming ownership claims or residency claims on their home, cannot approve/reject/flag them, and cannot use the relationship-resolution actions (invite as owner / continue review / flag unknown person). Native has a ReviewClaims feature but it is admin-scoped (AdminEndpoints `/api/admin/claims*`), not the per-home owner surface.  
  RN `src/app/homes/[id]/owners/review-claim.tsx:1-508` · endpoint `GET /api/homes/:id/ownership-claims, GET /api/homes/:id/ownership-claims/compare, POST /api/homes/:id/ownership-claims/:claimId/review, POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship, GET /api/homes/:id/claims, POST /api/homes/:id/claim/:claimId/approve, POST /api/homes/:id/claim/:claimId/reject`
  iOS: not found — HomesEndpoints.swift only declares POST ownership-claims (:94), POST evidence (:104), GET my-ownership-claims (:118), DELETE claim (:124). No list/compare/review/resolve-relationship. Features/ReviewClaims/* uses AdminEndpoints (ReviewClaimsViewModel.swift:127,138).  
  Android: not found — HomesApi.kt:160-202 declares the same four claim endpoints only; ui/screens/review_claims/* is admin-scoped.
- **[missing-endpoint]** The per-home security-policy screen (privacy mask level, owner claim policy, member attach policy) has no native equivalent and neither app ever calls `/api/homes/:id/security`. The native screen labelled "Security" is a different feature entirely — 9 client-side privacy toggles against `/api/homes/:id/privacy`. Users cannot set discoverability/stealth mode, open-vs-review owner claims, or the member attach policy, and the "change requires owner approval" (quorum `pending`) response state is dropped.  
  RN `src/app/homes/[id]/settings/security.tsx:27-134` · endpoint `GET /api/homes/:id/security, PATCH /api/homes/:id/security`
  iOS: Pantopus/Features/Homes/Settings/Security/HomeSecurityViewModel.swift:84-87,104-110 — uses HomePrivacyEndpoints get/update (`/api/homes/:id/privacy`). No reference to privacy_mask_level / owner_claim_policy / member_attach_policy anywhere in the target.  
  Android: app/src/main/java/app/pantopus/android/ui/screens/homes/settings/security/* — same privacy-toggle screen; grep for privacy_mask_level / owner_claim_policy / member_attach_policy returns nothing.
- **[missing-endpoint]** The tenant↔landlord approval flow never made it across. RN reads landlord/lease status and renders five distinct states (approved / denied+reason / pending+cancel / landlord-on-file → Request Approval / no-landlord → alternative paths), and submits a request with move-in date + message. The native "Verify landlord" wizard collects landlord/PM details client-side, discards them, and only fires `POST /api/homes/:id/request-postcard`. No native code calls any `/api/v1/tenant/*` route, so a tenant cannot request landlord approval, see the landlord's verification tier, check pending status, or cancel a pending request.  
  RN `src/app/homes/[id]/verify-landlord/index.tsx:34-53,196-310 and verify-landlord/details.tsx:24-40` · endpoint `GET /api/v1/tenant/home/:homeId/status, POST /api/v1/tenant/request-approval, POST /api/v1/tenant/request/:leaseId/cancel`
  iOS: Pantopus/Features/Homes/VerifyLandlord/VerifyLandlordWizardViewModel.swift:8-16,203,229 — "details collected in the form have no backend representation … so they stay client-side"; grep for `v1/tenant` in Pantopus/ returns nothing.  
  Android: app/src/main/java/app/pantopus/android/ui/screens/homes/verify_landlord/VerifyLandlordWizardViewModel.kt:62-65,200 — same comment; grep for `v1/tenant` in app/src/main returns nothing.
- **[missing-route]** Guest-pass management is missing. RN lists Active and Past passes with time-remaining, revokes a pass, and fires the OS share sheet with the pass link right after creation. Natively only the create form exists (AddGuestForm); the list and revoke calls are declared in the networking layer but never invoked from any screen, and there is no share-the-link affordance. A user can issue a guest pass but can never see it again or revoke it from the app.  
  RN `src/app/homes/[id]/share.tsx:37-90,152-190` · endpoint `GET /api/homes/:id/guest-passes, DELETE /api/homes/:id/guest-passes/:passId`
  iOS: Create only: Pantopus/Features/Homes/Guests/AddGuestFormViewModel.swift (reachable via HubTabRoot.swift:2271-2276). `HomesEndpoints.listGuestPasses` (Core/Networking/Endpoints/HomesEndpoints.swift:567) and `revokeGuestPass` (:582) have zero call sites outside the endpoint file.  
  Android: Create only: ui/screens/homes/guests/AddGuestFormViewModel.kt:207. `HomeGuestPassesRepository.list` (data/homes/HomeGuestPassesRepository.kt:31) and `.revoke` (:37) have zero UI call sites.
- **[missing-action]** Ownership transfer cannot be completed natively. Both apps hard-gate the commit behind `recipientIsBackendBacked`, which defaults to false and is never set true by any production path — the CTA reads "Transfer ownership unavailable" and the recipient shown is hardcoded sample data (Maya Fortune). There is also no in-app entry point: TransferOwnership is only pushed from the deep-link handler, while RN exposes a sticky "Transfer Ownership" button on the Owners list. RN identifies the recipient by `buyer_email` (works for non-users); native only supports `buyer_user_id`.  
  RN `src/app/homes/[id]/owners/transfer.tsx:24-63 and owners/index.tsx:116-123` · endpoint `POST /api/homes/:id/owners/transfer`
  iOS: Pantopus/Features/Homes/Owners/Transfer/TransferOwnershipViewModel.swift:81 (recipient = sample), :103 (canCommit requires recipientIsBackendBacked), :120 ("Transfer ownership unavailable"), :290 (TransferOwnerRequest(buyerUserId:)). Entry point only at Features/Root/HubTabRoot.swift:671-676 (deep link); OwnersListViewModel.swift has no transfer action.  
  Android: ui/screens/homes/owners/transfer/TransferOwnershipViewModel.kt:49 (recipientIsBackendBacked = false), :67, :82, :310 (TransferOwnerRequest(buyerUserId)). Entry point only at ui/screens/root/RootTabScreen.kt:1709-1714 (deep link); OwnersListViewModel.kt has no transfer action.

### mailbox

- **[missing-action]** RN's Mailbox has a Compose FAB that opens the 4-step compose flow (Porch Call → Address It → Write It → Seal & Send). Both native apps ship the equivalent CeremonialMail wizard but it is reachable ONLY from a debug-gated menu row, so in a release build no user can compose mail from the Mailbox at all.  
  RN `src/app/mailbox/compose.tsx:1-253 (entry: src/app/mailbox/index.tsx:300-307)` · endpoint `POST /api/mailbox/send (compose recipients: GET /api/mailbox/compose/recipients, GET /api/mailbox/compose/home-context/:homeId)`
  iOS: Pantopus/Features/Mailbox/MailboxRoot/MailboxRootViewModel.swift:117-126 — the only FAB on the Mailbox root is `.scanLine` → map. CeremonialMailWizardView is pushed only from Pantopus/Features/Root/YouTabRoot.swift:749 (`case "me.debug.openCeremonialMail"`), whose row is inside `#if DEBUG` (Pantopus/Features/Me/MeViewModel.swift:116-121).  
  Android: ui/screens/mailbox/mailbox_root/MailboxRootScreen.kt:83-88 — FAB → onOpenMap. CEREMONIAL_MAIL is navigated only from ui/screens/you/YouScreen.kt:239 `"me.debug.openCeremonialMail" -> if (BuildConfig.DEBUG) onOpenCeremonialMail()`.
- **[missing-action]** RN polls pending mail-routing on the Mailbox root and shows an 'N items need routing' banner that opens the disambiguation queue. Neither native app ever calls GET /api/mailbox/v2/pending, and the ported Disambiguate form is only reachable from a DEBUG dialog that requires typing a mail id — so a user can never resolve mis-routed mail.  
  RN `src/app/mailbox/index.tsx:65-70,176-188 + src/app/mailbox/disambiguate.tsx:26,38` · endpoint `GET /api/mailbox/v2/pending → POST /api/mailbox/v2/resolve`
  iOS: No `/api/mailbox/v2/pending` endpoint exists (Pantopus/Core/Networking/Endpoints/MailboxV2Endpoints.swift has drawers/drawer/item/action/package/resolve/community-rsvp/translate/p3Tasks only). DisambiguateMailFormView is presented only at Pantopus/Features/Root/YouTabRoot.swift:506-512 behind `me.debug.disambiguate`.  
  Android: data/mailbox/MailboxRepository.kt:133-134 defines `pending()` but no ViewModel calls it. DisambiguateMailFormScreen route (ui/screens/root/RootTabScreen.kt:2965-2969) is navigated only from YouScreen.kt:236 `if (BuildConfig.DEBUG)`.
- **[missing-route]** Entire Community mail route missing natively: neighborhood/civic feed with type filter chips, pull-to-refresh, four reaction types, RSVP-to-event, and flag-for-review. Native only has an RSVP button inside the community mail-detail variant.  
  RN `src/app/mailbox/community.tsx:1-228 (entry: src/app/mailbox/index.tsx:240)` · endpoint `GET /api/mailbox/v2/p3/community/feed, POST /p3/community/react, POST /p3/community/rsvp, POST /p3/community/flag`
  iOS: not found — no screen or endpoint referencing `p3/community/feed`, `/react`, or `/flag`. Only MailboxV2Endpoints.swift:81 `POST /api/mailbox/v2/community/rsvp` exists (used by MailDetailViewModel.setRsvp).  
  Android: not found — same. MailboxV2Api.kt exposes only `api/mailbox/v2/community/rsvp`.
- **[missing-route]** Entire Home Records route missing natively: linked home assets with room filter chips, per-asset mail drill-down, and the 'Auto-detect assets' scan that mines recent mail for appliance/warranty mentions. Native's RecordsDetailLayout is only a mail-detail body variant, not this asset hub.  
  RN `src/app/mailbox/records.tsx:1-342 (entry: src/app/mailbox/index.tsx:238)` · endpoint `GET /api/mailbox/v2/p3/records/assets, GET /p3/records/asset/:id/mail, POST /p3/records/auto-detect, GET /p3/records/suggestions, POST /p3/records/link, DELETE /p3/records/unlink/:id`
  iOS: not found — no reference to `p3/records` anywhere. Pantopus/Features/Mailbox/MailDetail/Variants/RecordsDetailLayout.swift is a per-mail body, not the asset index.  
  Android: not found — no reference to `p3/records`. ui/screens/mailbox/mail_detail/variants/RecordsDetailLayout.kt is the mail-body variant only.
- **[missing-endpoint]** RN's Earn drawer is a paid-offer wall: list offers, open an offer (dwell-timed, with a daily-cap rate-limit message), close it to bank the reward, save an offer, and reveal its promo code. Native's Earn screen is a completely different surface (earnings summary/history), so none of the offer-engagement actions or the earn balance exist.  
  RN `src/app/mailbox/earn.tsx:29-93 (entry: src/app/mailbox/index.tsx:86-88)` · endpoint `GET /api/mailbox/v2/earn/offers, GET /earn/balance, POST /earn/open, POST /earn/close/:offerId, POST /earn/save/:offerId, POST /earn/reveal/:offerId`
  iOS: Pantopus/Features/Mailbox/Earn/EarnViewModel.swift:88-107 calls only MailboxEndpoints.earningsSummary()/earningsHistory() (`/api/mailbox/earnings/*`). No `v2/earn/offers|balance|open|close|save|reveal`.  
  Android: ui/screens/mailbox/earn/EarnViewModel.kt uses the same earnings endpoints; data/mailbox/MailboxRepository.kt:165-166 defines `earnBalance()` but nothing calls it, and no offers endpoints exist at all.
- **[missing-action]** RN has a mail-task LIST with a create-task form (title/description/priority), a show-completed toggle, complete/reopen tap, and 'Convert to neighbor gig'. Native only ports the single-task DETAIL screen — there is no task list, no way to create a task from a mail item, and no convert-to-gig.  
  RN `src/app/mailbox/tasks.tsx:47,59-90,99,115-123 (entry: src/app/mailbox/detail.tsx:221-227)` · endpoint `POST /api/mailbox/v2/p3/tasks/from-mail, POST /p3/tasks/:taskId/to-gig`
  iOS: Pantopus/Features/Mailbox/MailTask/MailTaskViewModel.swift:72 fetches `p3Tasks()` then selects one task by id; MailboxV2Endpoints.swift has no `tasks/from-mail` or `:id/to-gig`. MailDetailView exposes only `onOpenExtractedTask` (HubTabRoot.swift:1533-1537) for tasks that already exist.  
  Android: ui/screens/mailbox/mail_task/MailTaskViewModel.kt mirrors iOS; MailboxV2Api.kt has only `api/mailbox/v2/p3/tasks` (GET) and `p3/tasks/{id}` (PATCH). No from-mail / to-gig.
- **[missing-endpoint]** RN's Unboxing flow persists: record a condition photo, save the warranty/manual doc to the vault, and post an assembly/help gig. Both native Unboxing screens are pure sample-fixture state machines — capture/confirm/undo only mutate in-memory fixtures and no unboxing data ever reaches the backend.  
  RN `src/app/mailbox/unboxing.tsx:28,36,47 (entry: src/app/mailbox/package.tsx:183)` · endpoint `POST /api/mailbox/v2/p2/package/:mailId/unboxing, POST /p2/package/:mailId/save-warranty, POST /p2/package/:mailId/gig`
  iOS: Pantopus/Features/Mailbox/Unboxing/UnboxingViewModel.swift:45,71-120 — every action projects `UnboxingSampleData`; the VM holds no APIClient. Route also carries no mail id (YouTabRoot.swift:2196).  
  Android: ui/screens/mailbox/unboxing/UnboxingViewModel.kt:30,51,76 — same sample-only fixture; RootTabScreen.kt:4220-4225 comments that OCR/classification/vault upload are out of scope.
- **[missing-route]** RN auto-redirects any mail carrying a stationery theme from the generic detail into the ceremonial open experience (envelope tap-to-open, voice postscript playback, ceremonial action buttons). Native ports the CeremonialMailOpen screen but nothing routes to it in production — mail detail never checks for stationery, so received personal letters always land on the plain detail screen.  
  RN `src/app/mailbox/detail.tsx:43-49 + src/app/mailbox/open.tsx:1-812` · endpoint `GET /api/mailbox/v2/item/:id (object_payload.payload.stationeryTheme)`
  iOS: MailDetailViewModel.swift/MailDetailProjection.swift never inspect `stationeryTheme`; CeremonialMailOpenView is presented only from the debug sheet at Pantopus/Features/Root/YouTabRoot.swift (`me.debug.openCeremonialMailOpen`, MeViewModel.swift:122-127).  
  Android: ui/screens/mailbox/mail_detail/MailDetailViewModel.kt has no stationery branch; CEREMONIAL_MAIL_OPEN is navigated only from the BuildConfig.DEBUG dialog in ui/screens/you/YouScreen.kt:240,454.
- **[one-platform-only]** iOS Mailbox Map and Vacation Hold are sample-fixture screens with no network at all; Android wires both to the real backend. Android is right. On iOS a user cannot see real map pins or actually schedule/cancel a mail hold — the 'Start hold' UI changes local state only.  
  RN `src/app/mailbox/maps.tsx:115,136-146,155 and src/app/mailbox/vacation.tsx:57,78,99` · endpoint `GET /api/mailbox/v2/p3/vacation/status, POST /p3/vacation/start, POST /p3/vacation/cancel, GET /p3/map/pins`
  iOS: Pantopus/Features/Mailbox/MailboxMap/MailboxMapViewModel.swift:33 seeds `MailboxMapSampleData.spots` (no APIClient); Pantopus/Features/Mailbox/Vacation/VacationHoldViewModel.swift:46,48,99,112 only swaps `VacationHoldSampleData` modes — the file's own comment concedes 'persistence lands later'.  
  Android: CORRECT — data/mailbox/MailboxRepository.kt:168-182 wires vacationStatus/startVacation/cancelVacation and mapPins; ui/screens/mailbox/vacation/VacationHoldViewModel.kt:28-32 documents iOS as the lagging platform.
- **[missing-action]** RN's mail detail renders a per-category action row (bill → Pay/Remind/File/Forward/Dispute; legal → File Now/Forward/Remind; notice → Acknowledge/Share with Household/Create Task/File; promo → Save Offer/Dismiss) and posts each to the mail-action endpoint, with pay/sign suppressed for unknown senders. Native's detail exposes only Acknowledge + Move-to-vault; the action endpoint is defined but has no production caller.  
  RN `src/app/mailbox/detail.tsx:56-72,188-208 (CATEGORY_ACTIONS in src/components/mailbox/constants.ts:25-33)` · endpoint `POST /api/mailbox/v2/item/:id/action`
  iOS: Pantopus/Features/Mailbox/MailDetail/Variants/GenericMailDetailLayout.swift:499,535,545-547 — only `onAck` and `onMove` are wired; the other secondary tiles are `Button(action: {})`. MailboxV2Endpoints.swift:38-41 defines the action endpoint but nothing calls it.  
  Android: data/mailbox/MailboxRepository.kt:106-109 `itemAction` is called only from ui/screens/mailbox/item_detail/MailboxItemDetailViewModel.kt:339,418, and that screen is not routed — RootTabScreen.kt:2856-2874 renders MailDetailScreen for MAILBOX_ITEM_DETAIL, so MailboxItemDetailScreen is dead code.

### gigs

- **[missing-state]** The Tasks feed has no pagination on either native app — RN infinite-scrolls (`onEndReached` → `fetchGigsPage(page+1)`, PAGE_SIZE 15, `hasMore`), native issues one `GET /api/gigs?limit=20&offset=0` and never requests another page, so tasks 21+ are unreachable in flat-list mode.  
  RN `src/app/(tabs)/gigs.tsx:273-278` · endpoint `GET /api/gigs (page/offset)`
  iOS: Pantopus/Features/Gigs/GigsFeedViewModel.swift:343-370 `fetchFlat()` hard-codes `limit: 20`, never passes `offset`; no loadMore/hasMore anywhere in the file  
  Android: app/src/main/java/app/pantopus/android/ui/screens/gigs/GigsFeedViewModel.kt:572 `fetchFlat()` — same, no loadMore/offset
- **[missing-route]** Whole route missing: "Ask a neighbor for help with this package" (Hold Package / Put Inside / Sign for Me / Help Assemble / Custom) creates a gig pre-filled from a mailbox package. Reachable from mailbox/package.tsx:204 and mailbox/tasks.tsx:236. Neither native app calls any `/api/mailbox/v2/p2/package/*` route.  
  RN `src/app/mailbox/gig.tsx:49-56` · endpoint `POST /api/mailbox/v2/p2/package/:mailId/gig`
  iOS: not found (grep 'v2/p2/package' over Pantopus/ = 0 hits)  
  Android: not found (grep 'v2/p2/package' over app/src/main = 0 hits)
- **[missing-action]** Pro-service composer module absent from both native composers — a user cannot set requires_license, license_type, requires_insurance, scope_description, deposit_required or deposit_amount when posting a pro/quote task, so the gig detail's "Professional Requirements" section (which native renders) can never be populated from a native post.  
  RN `src/app/gig-v2/new.tsx:336-343` · endpoint `POST /api/gigs/magic-post (draft.requires_license, license_type, requires_insurance, scope_description, deposit_required, deposit_amount)`
  iOS: Pantopus/Features/Compose/GigCompose/GigDraftQueue.swift:213 — `case "pro_service_quote", "general": return nil` (no module); no requires_license/scope_description string anywhere in Pantopus/  
  Android: app/src/main/java/app/pantopus/android/ui/screens/compose/gig/GigComposeModules.kt:68-75 `GigComposeModuleFields` when-block has no `pro_service_quote` branch; no requires_license/scope_description anywhere in app/src/main
- **[missing-action]** Delivery composer module is reduced to a shopping-items list natively — pickup_address, pickup_notes, dropoff_address, dropoff_notes and delivery_proof_required cannot be entered, so a delivery/errand task posted from native has no pickup or drop-off location even though both native gig-detail screens render a "Delivery Route" module from those fields.  
  RN `src/app/gig-v2/new.tsx:320-333 (components/.../DeliveryModule.tsx)` · endpoint `POST /api/gigs/magic-post (draft.pickup_address, dropoff_address, pickup_notes, dropoff_notes, delivery_proof_required)`
  iOS: Pantopus/Features/Compose/GigCompose/GigDraftQueue.swift:212,220 map delivery → `.items` only; `pickupAddress` appears only as a read field (GigDetailViewModel.swift:1338)  
  Android: app/src/main/java/app/pantopus/android/ui/screens/compose/gig/GigComposeModules.kt:73 `"delivery_errand" -> ItemsModuleFields(...)`; ItemsModuleFields (line 313) renders only a SHOPPING LIST
- **[missing-action]** Assigned worker has no "Can't Make It" affordance natively — RN lets the worker unassign themselves, release the payment hold and reopen the task for bids. Natively an assigned worker who can no longer do the job has no exit path at all (only the poster can cancel).  
  RN `src/components/gig-detail/useCompletionFlow.ts:279-297 (rendered by src/app/gig/[id].tsx:1279 CompletionFlow)` · endpoint `POST /api/gigs/:gigId/worker-release`
  iOS: not found (grep 'worker-release' over Pantopus/ = 0 hits)  
  Android: not found (grep 'worker-release' over app/src/main = 0 hits)
- **[missing-action]** Poster has no "Replace Worker" affordance natively — RN unassigns the current worker, releases the payment hold and reopens bidding before work starts. Natively the poster's only option is a full cancel (with cancellation fees), which is a different outcome.  
  RN `src/components/gig-detail/useCompletionFlow.ts:219-236` · endpoint `POST /api/gigs/:gigId/reopen-bidding`
  iOS: not found (grep 'reopen-bidding' over Pantopus/ = 0 hits); GigDetailView.swift:276-299 overflow offers only "Report task" + "Cancel task"  
  Android: not found (grep 'reopen-bidding' over app/src/main = 0 hits)
- **[missing-state]** Gig detail has no "your existing bid" state natively. RN loads the viewer's own bid and shows Update bid / Withdraw bid / Accept counter / Decline counter inline; native never calls `/api/gigs/:gigId/my-bid`, has no viewer-bid field on GigDTO, and its only bidder action is placeBid — so a user who already bid sees the same "Place bid" CTA and must leave for My Bids to change or pull it.  
  RN `src/components/gig-detail/BidPanel.tsx:106,224,251,268,292 (rendered by src/app/gig/[id].tsx:1304)` · endpoint `GET /api/gigs/:gigId/my-bid; PUT /api/gigs/:gigId/bids/:bidId; DELETE /api/gigs/:gigId/bids/:bidId; POST .../counter/accept|decline`
  iOS: Pantopus/Features/ContentDetail/GigDetailViewModel.swift:518 has only `placeBid`; no `my-bid`, `viewerBid`, `updateBid` or `withdrawBid` reference in Features/ContentDetail/  
  Android: app/src/main/java/app/pantopus/android/ui/screens/contentdetail/GigDetailViewModel.kt — same; no my-bid endpoint in GigsApi.kt

### tabs-social

- **[missing-action]** A helper cannot sign up for (reserve) a Support Train slot, cancel a reservation, reveal the delivery address, mark delivered, or confirm delivery on native — the detail screen is read-only on both platforms.  
  RN `src/app/support-trains/[id].tsx:342,402 (+ components/support-trains/ReserveSheet.tsx)` · endpoint `POST /api/activities/support-trains/:id/slots/:slotId/reserve, .../reservations/:rid/cancel, .../reveal-address, .../deliver, .../confirm`
  iOS: ios/Pantopus/Features/SupportTrains/Detail/SupportTrainDetailViewModel.swift:87-110 — only SupportTrainsEndpoints.detail; no reserve path exists in ios/Pantopus/Core/Networking/Endpoints/SupportTrainsEndpoints.swift (8 routes total). SupportTrainReservationsStore.swift:1-13 explicitly says the reservation PATCH "lands separately".  
  Android: android/.../data/api/services/SupportTrainsApi.kt — same 8 routes; no reserve/cancel/reveal/deliver/confirm.
- **[missing-action]** Organizer管理 actions absent natively: pause / resume / unpublish / archive / delete the train, add or remove co-organizers, add or edit or cancel individual slots, send an open-slots nudge, and gift-fund enable/contribute. Native Manage supports only "send update" and "complete".  
  RN `src/app/support-trains/[id]/manage.tsx:147,164,182,211,227,240,269,302,701-777` · endpoint `POST .../:id/pause|resume|unpublish|archive, DELETE .../:id, POST/DELETE .../:id/organizers, PATCH .../:id/slots/:slotId, POST .../:id/nudge, POST .../:id/fund/*`
  iOS: ios/Pantopus/Features/SupportTrains/Manage/ManageTrainViewModel.swift:306-390 — only postUpdate + complete.  
  Android: android/.../ui/screens/support_trains/manage/ManageTrainViewModel.kt — same two actions.
- **[missing-route]** The universal search screen (tabs All / Tasks / People / Beacons / Businesses / Homes, fanning out to five search endpoints) has no native equivalent; the drawer's "Search" row lands on gig-only search instead.  
  RN `src/app/discover.tsx:35-40,109-114` · endpoint `GET /api/identity-search (searchProfiles), GET /api/homes/discover, GET /api/businesses/discover, GET /api/users/search, GET /api/gigs/search`
  iOS: not found — ios/Pantopus/Features/Root/HubTabRoot.swift:599 maps NavigationDrawerDestination.search -> HubRoute.gigSearch. No endpoint file references identity-search or homes/discover.  
  Android: not found — android/.../ui/screens/root/RootTabScreen.kt:4547 maps NavigationDrawerDestination.Search -> ChildRoutes.GIG_SEARCH.
- **[missing-state]** The Pulse tab's Nearby / Connections surface toggle is missing natively — the `surface=connections` feed (posts from people you are connected to) is unreachable on both platforms.  
  RN `src/constants/feed.ts:6-14; src/components/feed/FeedSurfaceTabs.tsx:19-33` · endpoint `GET /api/posts/feed?surface=connections`
  iOS: ios/Pantopus/Features/Feed/FeedSurface.swift:16-20 — enum has only `pulse` (place) and `beacons` (personas); FeedView.swift has no surface switcher.  
  Android: android/.../ui/screens/feed/FeedSurface.kt — same two-case enum.
- **[missing-action]** Feed post cards natively expose only tap + one reaction. Save/bookmark, repost, share, report, author-delete, "not helpful", "mark solved", and "dismiss seeded fact" are all unavailable from the feed row (some exist only after opening the post detail; not-helpful/solve/seeded exist nowhere).  
  RN `src/components/feed/FeedScreen.tsx:196-215; src/hooks/useFeedData.ts:126,140,173,187,194,202,209` · endpoint `POST /api/posts/:id/save, /share, /report, DELETE /api/posts/:id, POST /api/posts/:id/not-helpful, PATCH /api/posts/:id/solve, POST /api/posts/seeded/:factId/dismiss`
  iOS: ios/Pantopus/Features/Feed/FeedView.swift:302-313 — PulsePostCard wired with onTap/onPrimaryReaction/onRSVP only. No endpoint exists for not-helpful/solve/seeded (grep over ios/Pantopus returns nothing).  
  Android: android/.../ui/screens/feed/pulse/PulsePostCard.kt + PulseFeedViewModel.kt — same reduced action set; PostsApi.kt has no not-helpful/solve/seeded routes.
- **[missing-endpoint]** Feed preferences (hide deals / hide alerts / politics visibility per surface) and mute-user / mute-business / mute-topic are unreachable natively — the preferences gear on the Pulse header has no counterpart.  
  RN `src/components/feed/FeedScreen.tsx:324-328; src/components/feed/FeedPreferencesSheet.tsx:33,41` · endpoint `GET+PUT /api/posts/feed-preferences; POST+DELETE /api/posts/mute; POST /api/posts/mute/topic; POST /api/posts/hide/:id`
  iOS: not found — no reference to feed-preferences, posts/mute, or posts/hide anywhere under ios/Pantopus.  
  Android: not found — same; PostsApi.kt has none of these routes.
- **[missing-endpoint]** The Pulse feed's List/Map toggle (viewport map of post pins with clustering, "search this area", recenter) does not exist natively, and the multi-layer marker endpoint it uses is never called — the native Explore map only draws gigs and listings, so post / business / home pins are absent everywhere.  
  RN `src/components/feed/FeedHeader.tsx:35-52; src/hooks/feed/useFeedMap.ts:52` · endpoint `GET /api/posts/map?layers=posts,tasks,offers,businesses,homes`
  iOS: ios/Pantopus/Features/Feed/FeedView.swift — no map mode; ios/Pantopus/Features/Explore/ExploreMapViewModel.swift:202,205 uses only GigsEndpoints.inBounds + ListingsEndpoints.inBounds.  
  Android: android/.../ui/screens/feed/FeedScreen.kt — no map mode; explore VM mirrors iOS.
- **[missing-action]** The Hub "Discover" section's filter tabs (Tasks / People / Businesses / Posts) are missing natively — the discovery request is hardcoded to filter=gigs, so a user can never see nearby people, businesses, or posts from the Hub. The "Explore Map" and "Find Businesses" header links are also gone (only "See all" remains).  
  RN `src/app/(tabs)/index.tsx:138,332,499-510; src/components/hub/HubDiscovery.tsx:9-14` · endpoint `GET /api/hub/discovery?filter=people|businesses|posts`
  iOS: ios/Pantopus/Features/Hub/HubViewModel.swift:77 — `HubEndpoints.discovery(filter: "gigs", limit: 10)` hardcoded; HubView.swift:66-72 has only onSeeAll.  
  Android: android/.../ui/screens/hub/HubViewModel.kt:78 calls repo.discovery() with the default filter; HubScreen.kt:134-142 has only onSeeAll.
- **[missing-action]** Notifications natively has only All/Unread tabs: the "Read" filter is gone, long-press to delete a notification is gone (endpoint never called), and the Personal/Audience (Beacon) zone split plus its ?context= entry point from the Hub megaphone is absent, so audience-context notifications cannot be isolated.  
  RN `src/app/notifications.tsx:56,231-238,259,296-314` · endpoint `DELETE /api/notifications/:id; GET /api/notifications?context=personal|platform|audience; POST /api/notifications/read-all with {contexts:[…]}`
  iOS: ios/Pantopus/Features/Notifications/NotificationsViewModel.swift:176-177 (two tabs), no delete method; ios/Pantopus/Core/Networking/Endpoints/NotificationsEndpoints.swift has no DELETE and no context query.  
  Android: android/.../ui/screens/notifications/NotificationsViewModel.kt:184-185 (two tabs); android/.../data/api/services/NotificationsApi.kt has no delete and no context param.
- **[missing-action]** Connections natively drops the "Sent" and "Blocked" tabs and the per-row "Remove" (disconnect) and "Unblock" actions. A user cannot see or manage outbound connection requests at all, and cannot disconnect an existing connection.  
  RN `src/app/connections.tsx:16-21,70-82,126-148` · endpoint `GET /api/relationships/requests/sent; GET /api/relationships/blocked; DELETE /api/relationships/:id; POST /api/relationships/:id/unblock`
  iOS: ios/Pantopus/Features/Connections/ConnectionsViewModel.swift:112-121 (All/Neighbors/Pending only); RelationshipsEndpoints.swift defines only list/pending/sendRequest/accept/reject.  
  Android: android/.../ui/screens/connections/ConnectionsViewModel.kt:298-303 (same three tabs); RelationshipsApi.kt has the same five routes.

### auth-settings

- **[missing-action]** "Delete Account" is a dead row on both native platforms — the row renders with a chevron and a "Permanent. 30-day grace period." subtext but tapping it does nothing, so a user can never delete their account in-app. RN opens AccountDeleteSheet, requires a biometric re-auth (useSensitiveActionGuard), then calls DELETE /api/users/account and logs out.  
  RN `src/app/settings.tsx:330 (also src/app/settings/privacy.tsx:688)` · endpoint `DELETE /api/users/account`
  iOS: Pantopus/Features/Settings/Privacy/PrivacyViewModel.swift:274 declares the row; tapRow() at :84-92 explicitly no-ops ("Download / What we collect / Delete open dedicated flows in a later prompt"). The endpoint constant exists but is never used: Core/Networking/Endpoints/SettingsEndpoints.swift:72. HelpCenterView.swift:142 tells users to email support instead.  
  Android: app/src/main/java/app/pantopus/android/ui/screens/settings/SettingsViewModels.kt:875 declares the row; onTapRow() at :677-683 no-ops with the same comment. No DELETE /api/users/account anywhere in app/src/main.
- **[missing-endpoint]** The native Notifications settings screen persists nothing — every toggle/chip flips local state only and is lost on navigation. RN loads GET /api/hub/preferences and debounce-saves PUT /api/hub/preferences, covering morning/evening briefing enable + send time, weather/AQI/home-reminder/gig-update/mail-summary alerts, quiet hours (start/end), and briefing location mode (primary_home | viewing_location | device_location). None of those preferences exist natively in any form.  
  RN `src/app/settings/notification-preferences.tsx:43-75` · endpoint `GET /api/hub/preferences, PUT /api/hub/preferences (never called by either native app)`
  iOS: Pantopus/Features/Settings/Notifications/NotificationSettingsViewModel.swift:13-16 — "Backend persistence is out of scope for P7.5 … every chip / toggle flips local state only"; toggleRow/toggleChannel at :83-99 mutate in-memory dicts only.  
  Android: app/src/main/java/app/pantopus/android/ui/screens/settings/SettingsViewModels.kt:324-336 — NotificationSettingsViewModel takes no repository at all (@Inject constructor() : ViewModel()) and seeds from NotificationCatalog.seed().
- **[missing-endpoint]** Search-privacy controls are unreachable natively. RN exposes "Find me in search" (everyone | mutuals | nobody) and a "Find me by real name" switch, each optimistically PATCHing /api/privacy/settings with rollback on failure. Native ships the DTOs and repository methods but no screen ever calls them, and its Privacy screen's radios/toggles are pure local state.  
  RN `src/app/settings/privacy.tsx:151-191` · endpoint `GET /api/privacy/settings, PATCH /api/privacy/settings (defined natively, never invoked)`
  iOS: Endpoints exist at Core/Networking/Endpoints/SettingsEndpoints.swift:17,22 — zero call sites (`grep 'SettingsEndpoints\.'` outside its own file returns nothing). Pantopus/Features/Settings/Privacy/PrivacyViewModel.swift:12-16 says persistence is out of scope; selectRadio()/toggleRow() at :114-122 only mutate local vars.  
  Android: app/src/main/java/app/pantopus/android/data/privacy/PrivacyRepository.kt:21 defines updateSettings(); no caller in app/src/main. SettingsViewModels.kt PrivacySettingsViewModel only calls privacy.blocks().
- **[missing-action]** No native way to set or change your profile photo. RN has a "Change photo" button that requests photo-library permission, opens the picker with cropping, and multipart-uploads to /api/upload/profile-picture, then refreshes the session user. Neither native Edit Profile screen has any avatar affordance and neither app ever hits the endpoint.  
  RN `src/app/profile/edit.tsx:75-106, 219` · endpoint `POST /api/upload/profile-picture (never called by either native app)`
  iOS: Pantopus/Features/Profile/EditProfileView.swift + EditProfileView+Fields.swift contain no photo picker; EditProfileViewModel.swift:23-51 enumerates all 17 editable fields and avatar is not among them. MultipartUploader.swift only implements post-media, listing-media, chat-media, ai-media, files/upload.  
  Android: app/src/main/java/app/pantopus/android/ui/screens/profile/EditProfileScreen.kt has no image picker; EditProfileViewModel.kt:37-62 field enum has no avatar. UploadApi.kt has no profile-picture route.
- **[missing-endpoint]** A user who has not already got a professional profile can never turn professional mode on natively, and a user who has one can never turn it off. RN's screen has three modes (create/view/edit) with "Enable professional mode" (POST /api/professional/profile), "Disable" behind a destructive confirm (DELETE /api/professional/profile/me), and re-enable via PATCH is_active:true. Native only ever reads and PATCHes an existing profile.  
  RN `src/app/professional.tsx:139-195` · endpoint `POST /api/professional/profile and DELETE /api/professional/profile/me (never called by either native app)`
  iOS: Pantopus/Core/Networking/Endpoints/ProfessionalEndpoints.swift:13-37 declares only GET profile/me, PATCH profile/me, GET verification/status, GET /:username. No create/delete.  
  Android: app/src/main/java/app/pantopus/android/data/api/services/ProfessionalApi.kt:11-24 — exactly three methods: profileMe, updateProfileMe, verificationStatus.
- **[missing-endpoint]** Username-based profile links resolve to the wrong endpoint natively. RN's profile screen branches on isUuid(): UUIDs go to /api/users/id/:id, handles go to /api/users/username/:username. Both native deep-link routers accept `u/:handle` and `user/:handle` and map them to Destination.user(id:), but the profile loader only ever calls /api/users/id/<value>, so a shared pantopus://u/mariak (or https://pantopus.com/u/mariak) link lands on an error state.  
  RN `src/app/u/[username].tsx:1-7 → src/app/user/[id].tsx:56-57` · endpoint `GET /api/users/username/:username (never called by either native app)`
  iOS: Router accepts the alias at Core/Routing/DeepLinkRouter.swift:339-341 (case "user", "users", "u"); the only fetch is PublicProfileEndpoints.profile(id:) = GET /api/users/id/:id at Core/Networking/Endpoints/PostsEndpoints.swift:170-175, used by PublicProfileViewModel.swift:361-363.  
  Android: Router accepts it at app/src/main/java/app/pantopus/android/core/routing/DeepLinkRouter.kt:465-468; PublicProfileViewModel.kt:134 documents "Loads GET /api/users/id/:id" as the only path.
- **[missing-action]** You cannot follow (or unfollow) an ordinary neighbor from a native profile. RN's Follow/Following button calls POST/DELETE /api/users/:id/follow. Native routes every Follow tap into the persona privacy-handshake wizard, and when the profile has no Beacon handle it shows the toast "Following isn't available from this profile yet." — which is the case for all Local (non-persona) profiles.  
  RN `src/app/user/[id].tsx:184-199, 532, 569` · endpoint `POST /api/users/:id/follow, DELETE /api/users/:id/follow (never called by either native app)`
  iOS: Pantopus/Features/Profile/PublicProfileViewModel.swift:291-299 (follow() guards on canOpenHandshake) and :314 (handshakeUnavailableMessage). FollowingEndpoints.swift only covers /api/personas/*.  
  Android: app/src/main/java/app/pantopus/android/ui/screens/profile/PublicProfileViewModel.kt:677 (HANDSHAKE_UNAVAILABLE_MESSAGE) — same behaviour.

### creator-biz

- **[missing-endpoint]** Beacon (persona) create + edit is completely non-functional natively. RN creates/updates the persona and uploads avatar/banner; both native Edit-Persona screens render a hard-coded sample fixture and never persist. `POST /api/personas`, `PATCH /api/personas/:id` and `POST /api/upload/persona-media/:id` are called by zero native code on either platform (grep for `path: "/api/personas` and `api/personas` in the endpoint layers returns only me/audience/posts/tiers/follow/dms reads). The iOS "Create your Beacon" empty-state CTA pushes `.editPersona(personaId: EditPersonaSampleData.personaId)` — i.e. straight into the fixture. A user cannot create a Beacon, change handle/display name/bio/category/audience label/audience mode/public links, or set an avatar or banner.  
  RN `src/app/identity/persona.tsx:451-484` · endpoint `POST /api/personas, PATCH /api/personas/:id, POST /api/upload/persona-media/:id`
  iOS: Pantopus/Features/AudienceProfile/EditPersona/EditPersonaViewModel.swift:38-50 (load() returns EditPersonaSampleData, no API); entry point Pantopus/Features/Root/HubTabRoot.swift:1677-1679  
  Android: app/src/main/java/app/pantopus/android/ui/screens/audience_profile/edit_persona/EditPersonaViewModel.kt:57-78 (falls back to EditPersonaSampleData; no save path — EditPersonaScreen.kt:1446 "Save" button is inert)
- **[missing-route]** The whole block-based business Page editor has no native equivalent. RN loads page blocks, adds blocks from a picker, reorders (move up/down), deletes, toggles a preview mode, saves a draft revision and publishes it. Native's `PageEditor` feature is a business-profile field editor (name/description/hours/gallery), not a page-block builder — `/api/businesses/:id/pages/:pageId/blocks`, `.../draft`, `.../publish` and `.../revisions` appear nowhere in either native app.  
  RN `src/app/businesses/[id]/page-editor.tsx:62-193` · endpoint `GET/PUT /api/businesses/:id/pages/:pageId/blocks, POST /api/businesses/:id/pages/:pageId/publish, GET/POST .../revisions[/:rev/restore]`
  iOS: not found (Pantopus/Features/Businesses/PageEditor/EditBusinessPageViewModel.swift only calls BusinessesEndpoints.business/updateBusiness/publishBusiness/locationHours/catalogItems)  
  Android: not found (ui/screens/businesses/page_editor/EditBusinessPageViewModel.kt — same profile-field scope)
- **[missing-action]** Business catalog is read-only natively. RN can create/rename/delete catalog categories, create/edit/delete catalog items, and drag-reorder items. Both native apps only call `GET /api/businesses/:id/catalog/items`; no POST/PATCH/DELETE catalog endpoint exists in either endpoint layer. An owner cannot add or price a single service/product from the native apps.  
  RN `src/app/businesses/[id]/index.tsx:313 (CatalogTab) → src/components/business/tabs/CatalogTab.tsx:40-179` · endpoint `POST/DELETE /api/businesses/:id/catalog/categories[/:catId], POST/PATCH/DELETE /api/businesses/:id/catalog/items[/:itemId], POST /api/businesses/:id/catalog/items/reorder`
  iOS: Pantopus/Core/Networking/Endpoints/BusinessesEndpoints.swift:56 (catalogItems GET only); Features/Businesses/OwnerDashboard/BusinessOwnerView.swift:433 "Add a service" has no create call behind it  
  Android: app/src/main/java/app/pantopus/android/data/api/services/BusinessesApi.kt:80 (`@GET api/businesses/{businessId}/catalog/items` only)
- **[missing-endpoint]** Persona DM threads can be listed but never opened, read, or replied to natively. RN reads a thread and sends into it, and a fan can open a brand-new thread (which burns one message-thread quota and surfaces the 402 quota-exhausted / 403 blocked / no_membership states). Both native apps call only `GET /api/personas/:id/dms/threads`; `GET .../threads/:threadId`, `POST .../threads` and `POST .../threads/:threadId/messages` are called by neither. Tapping a creator-inbox row instead pushes the generic chat conversation using `counterpartyUserId ?? row.id`, and the persona DM serializer deliberately carries no user_id — so the fallback pushes a membership id as a user id.  
  RN `src/app/audience/inbox/[membershipId].tsx:1-116 and src/app/audience/membership/[personaId]/inbox.tsx:70-95 (via src/components/audience/PersonaDmThreadView.tsx:47-77)` · endpoint `GET /api/personas/:id/dms/threads/:threadId, POST /api/personas/:id/dms/threads, POST /api/personas/:id/dms/threads/:threadId/messages`
  iOS: Pantopus/Features/CreatorInbox/CreatorInboxViewModel.swift:80-90 (conversationDestination falls back to the row/membership id); Core/Networking/Endpoints/AudienceProfileEndpoints.swift:65-69 (threads list only)  
  Android: ui/screens/creator_inbox/CreatorInboxViewModel.kt:60-70 (`row.counterpartyUserId ?: row.id`); data/api/services/AudienceProfileApi.kt:63-67 (threads list only)
- **[missing-endpoint]** Stripe Connect for a business is entirely absent natively. RN can read the connected account, start onboarding, refresh an expired account link, and open the Stripe express dashboard. Grepping both native apps for `stripe` in the networking layer returns zero endpoints. An owner cannot get paid through the native apps.  
  RN `src/app/businesses/[id]/index.tsx:352 (PaymentsTab) → src/components/business/tabs/PaymentsTab.tsx:23-54` · endpoint `POST /api/businesses/:id/stripe/connect, GET /api/businesses/:id/stripe/account, POST /api/businesses/:id/stripe/refresh-link, POST /api/businesses/:id/stripe/dashboard-link`
  iOS: not found  
  Android: not found
- **[missing-endpoint]** Business invoicing has no native surface. RN lists invoices (paged), creates an invoice, and voids one. No `invoice` endpoint exists in either native networking layer.  
  RN `src/app/businesses/[id]/index.tsx:350 (InvoicesTab) → src/components/business/tabs/InvoicesTab.tsx:49-105` · endpoint `GET /api/businesses/:id/invoices, POST /api/businesses/:id/invoices, PATCH /api/businesses/:id/invoices/:invoiceId {status:'void'}`
  iOS: not found  
  Android: not found
- **[missing-endpoint]** Business verification and private/legal data are unreachable natively. RN reads verification status, uploads verification evidence, and reads/updates the business private record (legal name, EIN, registered address). Native renders a verification badge on the dashboard but has no endpoint to advance verification or edit the private record.  
  RN `src/app/businesses/[id]/index.tsx:362 (LegalTab) → src/components/business/tabs/LegalTab.tsx:44-98` · endpoint `GET /api/businesses/:id/verify/status, POST /api/businesses/:id/verify/upload-evidence, POST /api/businesses/:id/verify/self-attest, GET/PATCH /api/businesses/:id/private`
  iOS: not found (Core/Networking/Endpoints/BusinessesEndpoints.swift has no /verify or /private path)  
  Android: not found (data/api/services/BusinessesApi.kt has no /verify or /private path)
- **[missing-endpoint]** Custom business Pages (the multi-page CMS) do not exist natively: no create page, no delete page, no revision history, no restore-revision. Consequently the `b/:username/:slug` universal link also degrades — RN redirects it to `/business/:username?pageSlug=slug`, while iOS DeepLinkRouter.swift:344-347 drops the slug segment and lands on the plain business profile.  
  RN `src/app/businesses/[id]/index.tsx:322 (PagesTab) → src/components/business/tabs/PagesTab.tsx:37-96` · endpoint `POST /api/businesses/:id/pages, DELETE /api/businesses/:id/pages/:pageId, GET /api/businesses/:id/pages/:pageId/revisions, POST .../revisions/:revision/restore`
  iOS: not found; deep-link truncation at Pantopus/Core/Routing/DeepLinkRouter.swift:344-347  
  Android: not found; deep-link case at core/routing/DeepLinkRouter.kt:469
- **[missing-action]** On the fan membership screen, "Change tier" and "Request a refund" are dead buttons natively — both platforms route them to a placeholder destination. RN opens a tier picker that upgrades (immediate) or downgrades (scheduled at period end), and files an SLA-missed refund request. Only cancel is wired natively. RN's "Open inbox" CTA (with the remaining message-thread quota footnote) also has no native counterpart.  
  RN `src/app/audience/membership/[personaId]/index.tsx:106-176` · endpoint `POST /api/personas/:id/membership/upgrade, POST /api/personas/:id/membership/downgrade, POST /api/personas/:id/membership/refund-request`
  iOS: Pantopus/Features/Root/YouTabRoot.swift:1011-1020 (onChangeTier / onRequestRefund → .placeholder); Features/Membership/MembershipDetailViewModel.swift:14-17 explicitly defers them  
  Android: ui/screens/root/RootTabScreen.kt:4303 wiring into ui/screens/membership/MembershipDetailScreen.kt:58-61 (onChangeTier / onUpdatePayment / onRequestRefund default to no-op lambdas)
- **[missing-action]** Media attached to a Beacon update is silently dropped at publish on both platforms. Both native compose screens let the user pick a photo/video (`attachMedia`) and render a preview, but the publish body is `{body, visibility, target_tier_rank}` only — there is no upload leg and no `media` field. RN uploads Live Photos before the post and regular media after it, supports up to 9 items, and offers camera capture (native offers library pick only, single item).  
  RN `src/app/identity/broadcast.tsx:107-145` · endpoint `POST /api/broadcast/channels/:channelId/messages (media[] param), POST /api/upload/post-media`
  iOS: Pantopus/Features/AudienceProfile/ComposeBroadcast/ComposeBroadcastViewModel.swift:131-146 (publish sends PublishUpdateBody without media) vs :214-221 attachMedia  
  Android: ui/screens/audience_profile/compose_broadcast/ComposeBroadcastViewModel.kt:133-147 (realPublish) + data/api/models/audience/AudienceProfileDtos.kt:183-187 (PublishUpdateBody has no media field)
- **[missing-action]** "Post as this business" is missing natively. RN's owner dashboard has a floating composer that publishes a business-authored post into the neighborhood feed (permission-gated to owner/admin/editor via `access.role_base`). Neither native owner dashboard has a compose affordance or the endpoint.  
  RN `src/app/businesses/[id]/index.tsx:74-82, 373-410` · endpoint `POST /api/businesses/:businessId/posts`
  iOS: not found (Features/Businesses/OwnerDashboard/BusinessOwnerView.swift has edit/preview/services/gallery/team only)  
  Android: not found (ui/screens/businesses/owner_dashboard/BusinessOwnerScreen.kt)

### money

- **[missing-endpoint]** Received-invoice detail + pay is fixture-only on both platforms. RN reads the real invoice (GET /api/businesses/invoices/{id}) and pays it (POST .../pay then POST .../confirm). Neither native app calls any /api/businesses/invoices/* endpoint — both render a hardcoded invoice ('Holiday lighting · install + takedown', $642.85, 'Brightside Outdoor') and the Pay CTA is permanently disabled with 'This invoice can't be paid yet.'  
  RN `src/app/invoice/[id].tsx:41,54,56` · endpoint `GET /api/businesses/invoices/{id}, POST /api/businesses/invoices/{id}/pay, POST /api/businesses/invoices/{id}/confirm`
  iOS: Pantopus/Features/ContentDetail/InvoiceDetailViewModel.swift:55-57 (load() → Self.fixture), :63-68 (payNow guards on checkoutRequest); the only caller, Features/Root/HubTabRoot.swift:1865, constructs InvoiceDetailViewModel(invoiceId:) with no checkoutRequest, so payNow always returns .declined  
  Android: ui/screens/contentdetail/InvoiceDetailViewModel.kt:86-91 (load() → Projection.fixture), :103-110 (checkoutRequest null unless gigId or listingId+offerId nav args are supplied; the invoices/{invoiceId} route in RootTabScreen.kt:1210 supplies neither)
- **[missing-endpoint]** The Transaction History tab is gone. RN lists every payment/payout with type, status, counterparty and tip/payout iconography from GET /api/payments/history. Neither native app calls that endpoint anywhere; both hardcode an 'No transactions yet' empty block into the Payments screen's Activity section, so it can never populate.  
  RN `src/components/payments/HistoryTab.tsx:26 (reached via src/app/settings/payments.tsx:64)` · endpoint `GET /api/payments/history`
  iOS: Pantopus/Features/Settings/Payments/PaymentsViewModel.swift:184-187 — liveFrame() sets activity: .empty(title: "No transactions yet", body: "Hires and sales will appear here.") unconditionally; no PaymentsEndpoints helper for /api/payments/history exists (Core/Networking/Endpoints/PaymentsEndpoints.swift)  
  Android: ui/screens/settings/payments/PaymentsMapper.kt:15-27 — liveFrame() sets activity = PaymentsActivity.Empty(...) unconditionally; data/api/services/PaymentsApi.kt has no history method
- **[missing-action]** An onboarded seller cannot open their Stripe Express dashboard. RN shows an 'Open Stripe Dashboard' button whenever the Connect account is onboarded. Both native apps implement openDashboard(), but it is only wired to the PayoutMethodCard's 'Manage' control, and the live mapper always sets payoutMethod = null, so that card never renders outside previews — the action is unreachable in the shipped app.  
  RN `src/components/payments/PayoutsTab.tsx:106-123, 192-195` · endpoint `POST /api/payments/connect/dashboard`
  iOS: Pantopus/Features/Wallet/WalletViewModel.swift:223-234 (openDashboard) but makeContent sets payoutMethod: nil at :266; WalletView.swift:87-96 renders the Payout-method section only `if let payoutMethod = content.payoutMethod`  
  Android: ui/screens/wallet/WalletViewModel.kt:142-152 (openDashboard) but WalletMapper.kt:43 sets payoutMethod = null; WalletScreen.kt:454-460 renders it only under `content.payoutMethod?.let`

---

## Medium (73) and low (13)

- **[medium·missing-endpoint·homes-a]** The Members screen's "Audit Log" tab (who did what to the household, actor → target, timestamped) has no native equivalent; the endpoint is never called.
- **[medium·missing-endpoint·homes-a]** Native never fetches the caller's per-home access record, so home surfaces are not permission-gated. RN hides the Tasks / Bills / Deliveries / Maintenance / Documents / Access-&-Secrets cards when the
- **[medium·missing-state·homes-a]** The home security-state banner is absent natively. RN surfaces claim_window (with the deadline date and an "invite co-owner" CTA), review_required, disputed and frozen states at the top of the dashboa
- **[medium·missing-state·homes-a]** The Home Calendar natively shows only home events. RN's month grid additionally plots task due dates, bill due dates and package expected-delivery dates (colour-coded by type), so on native a user can
- **[medium·missing-state·homes-a]** Claim submission drops the backend's routing_classification. RN warns "Another claim is pending" (parallel_claim) and "Verified household exists" (challenge_claim) before submitting, and when a strong
- **[medium·missing-action·homes-a]** The evidence uploader's document-type picker is gone natively. RN lets the claimant declare which of five ownership documents they are uploading (deed / closing disclosure / property tax statement / t
- **[medium·missing-action·homes-a]** The Add Home wizard's Details step is missing natively: nickname, home type, bedrooms, bathrooms, sqft, lot sqft, year built and description, pre-filled from an ATTOM public-records lookup. Native's f
- **[medium·missing-action·homes-a]** The Add Home wizard's Setup step — add Wi-Fi / gate / alarm access secrets during home creation, including a camera QR scanner that parses a WIFI: barcode into SSID + password — has no native equivale
- **[medium·missing-action·homes-a]** The Home dashboard FAB offers six one-tap creates in RN (Add Task, Track Bill, Track Package, Add Pet, Create Poll, Send Mail to this home). Natively the FAB has three entries and two of them — "Log a
- **[medium·missing-action·homes-a]** Emergency Info is read-only for phone numbers natively: RN has a persistent "Emergency? Call 911" banner that dials, and every stored contact's phone number is a tap-to-dial row. Neither native app op
- **[medium·missing-state·homes-b]** RN's Verification Center branches on `verification_status` from the home-access endpoint and renders six states (pending_postcard, provisional_bootstrap, pending_approval, pending_doc, provisional + c
- **[medium·missing-action·homes-b]** No way to close a poll to further votes or delete it. RN shows Close and Delete actions on every active poll card. Both native apps declare the update-poll endpoint but no view model or screen ever ca
- **[medium·missing-action·homes-b]** Household tasks cannot be deleted on either platform. RN has a trash affordance on every task row. Both apps declare the DELETE endpoint but nothing calls it — the only row action is the done toggle.
- **[medium·missing-action·homes-b]** A completed task cannot be re-opened. RN's checkbox toggles both directions (done → open). Natively the Done tab renders a non-interactive status chip as the row trailing, and the Active tab filters o
- **[medium·missing-action·homes-b]** A home cannot be renamed on either platform. RN's settings screen has an inline nickname editor that PATCHes the home. Native home settings is navigation-only (`tapRow` just routes; `toggleRow`/`selec
- **[medium·missing-state·homes-b]** Failure states of postcard verification are collapsed. RN surfaces `attempts_remaining` when it drops to ≤3, and on "expired"/"Too many" it routes the user back to the request step to get a fresh code
- **[medium·missing-route·mailbox]** Entire Family Mail Party route missing natively: start/join a live co-opening session, discover active sessions, send live reactions, assign a mail item to a household member, and decline into solo op
- **[medium·missing-action·mailbox]** RN's package dashboard can share the delivery ETA with the household, create a neighbor gig to catch the package, and report a package issue. Native's package detail overflow shows 'Report issue' (and
- **[medium·missing-endpoint·mailbox]** RN Stamps has a second 'Themes' view where the user browses seasonal mailbox themes and applies an unlocked one; the stamp collection itself is loaded from the backend. Native's Stamps screen is a sam
- **[medium·missing-route·mailbox]** RN's Mail Day has a Settings sub-view (gear from the summary header): daily-digest toggle, delivery-time, sound type picker, quiet-hours, and per-category notification switches, persisted via PATCH. N
- **[medium·missing-route·mailbox]** Entire Mail Memory route missing natively: 'On This Day' resurfaced mail with per-memory dismiss, and 'Year in Mail' with a year stepper and a share-card generator.
- **[medium·missing-action·mailbox]** RN's Vault searches the whole archive server-side ('Search sender, amount, date…') and has drawer tabs to switch the vault between personal/home/business. Native filters only the rows already fetched 
- **[medium·missing-action·mailbox]** RN's booklet viewer can save the booklet to a vault folder and download the PDF (with size reported). Both native booklet layouts render 'Save to Vault', 'Share', 'PDF' and 'Archive' buttons that are 
- **[medium·missing-action·mailbox]** After acknowledging certified mail RN offers a '⬇ Proof' button that fetches and saves the legal delivery proof. Native's certified layout has no proof affordance — its four secondary tiles (Pay/Calen
- **[medium·missing-endpoint·mailbox]** RN fetches a real machine translation and renders the returned translated text, detected language and translator notes, with a retry on failure. Both native translation screens render a hard-coded sam
- **[medium·missing-route·mailbox]** RN has a package-help request form (pick help type, add notes/offer, submit) that posts a gig tied to the mail item and then deep-links into the created gig. Neither native app has this form or calls 
- **[medium·missing-action·gigs]** The Offers & bids screen is read-only natively. RN's Received tab has Accept (with Stripe PaymentSheet authorization) and Reject per pending bid; the Sent tab has Withdraw. Both native Offers view-mod
- **[medium·missing-action·gigs]** Gig Q&A loses three actions natively: upvote a question, pin/unpin an answer (poster), and delete a question. Native only supports ask + answer.
- **[medium·missing-endpoint·gigs]** "Rebook a favorite helper" rail is absent natively — RN shows a horizontal card row of past completed tasks with their worker and a one-tap Rebook CTA that prefills the composer. Neither native app ca
- **[medium·missing-action·gigs]** Three feed filters exist only in RN: distance ("Under 1 mi / 3 mi / 5 mi" → max_distance + includeRemote=false), deadline ("Today" / "This Week" → deadline), and task archetype (Quick Help / Delivery 
- **[medium·missing-action·gigs]** Poster cannot nudge a worker who hasn't started. RN has a "Remind worker" action with a server-driven cooldown (`next_allowed_at` / `sent_at` handling). Absent from both native gig-detail lifecycle se
- **[medium·missing-action·gigs]** Poster cannot withdraw a counter-offer they already sent. RN renders a "Withdraw counter" button on countered bids; native supports counter/accept-counter/decline-counter but never the poster-side wit
- **[medium·missing-action·gigs]** Editing a posted task natively can only change 8 fields. RN's edit form (`/gig/new?editGigId=`) prefills and PATCHes cancellation_policy, is_urgent, tags, deadline, estimated_duration and items[] as w
- **[medium·missing-action·gigs]** An owner cannot close/delete a still-open task natively. RN branches: open → DELETE /api/gigs/:id ("Close Gig", removes it), otherwise → POST /cancel. Native's overflow only ever offers "Cancel task" 
- **[medium·missing-endpoint·gigs]** The urgent/instant-accept live fulfillment stepper is missing natively: RN polls the task's fulfillment status and lets the helper advance it (on_the_way → arrived → working → done). Neither native ap
- **[medium·missing-endpoint·gigs]** "Share live status" is missing natively — RN mints a time-limited public status link for an in-progress task and copies it to the clipboard. Native's only share is the static universal link (ShareLink
- **[medium·missing-action·tabs-social]** On the "Beacons you follow" list, the per-row notification-level bell (All / Highlights / Off) and long-press multi-select with bulk unfollow are missing natively; only mark-seen, mute, and single unf
- **[medium·missing-endpoint·tabs-social]** The Monthly Receipt card on the profile tab (earnings, neighbors helped, share sheet, auto-expand from the monthly_receipt notification) has no native counterpart and its endpoint is never called.
- **[medium·missing-endpoint·tabs-social]** Invite / referral progress (referral count, unlocked features, next unlock) and the shareable invite code are not surfaced anywhere natively.
- **[medium·missing-endpoint·tabs-social]** Post detail's "Nearby Providers" card (organically matched local businesses with rating/NEW badge, help tooltip, tap-through to the business profile) is missing natively.
- **[medium·missing-endpoint·tabs-social]** Morning/Evening Briefing deep links (push notification carries a briefing delivery id and kind) resolve to a specific stored briefing in RN; natively the Today screen always refetches the generic /api
- **[medium·missing-endpoint·tabs-social]** Three Hub behaviours are dropped: rebookable-gig cards injected into "Jump back in" (never fetched), the neighbor-density milestone banner and its dismiss, and the server-driven statusItems action str
- **[medium·missing-action·tabs-social]** The Pulse type-filter chip row loses four filters: Alerts, Deals, Wins, and Guide. Native collapses alert/neighborhood_win into a single "Announce" chip and has no deal or visitor_guide filter, so tho
- **[medium·missing-endpoint·tabs-social]** The Sports topic lane on the Nearby feed — topic chip row, For You / Local / Event / Watch mode chips, the active-event module with "start a thread", and the sports starter prompts that pre-fill the c
- **[medium·missing-state·tabs-social]** Pre-post safety precheck is dropped: RN calls precheck before opening/submitting the composer and renders cooldown (rate-limited / restricted), visitor, and suggestion nudges. Native compose submits b
- **[medium·missing-action·tabs-social]** The Nearby feed's viewing-location switcher (ContextBar — switch between home, saved places, recent locations) and the radius-suggestion banner (apply / dismiss when nothing is nearby) are missing nat
- **[medium·missing-action·auth-settings]** On the signed-out auth surfaces the Terms of Service and Privacy Policy are not readable. RN renders them as individually tappable links (that deliberately do not toggle the checkbox) pushing /legal/t
- **[medium·missing-endpoint·auth-settings]** The portfolio surface has no native equivalent: no Portfolio tab on the public profile, no add/delete portfolio item. RN lists items via GET /api/files/portfolio[/:userId], filters by media type, uplo
- **[medium·missing-endpoint·auth-settings]** Skills cannot be edited natively. RN's Edit Profile has an add-skill input and tap-to-remove chips, saved with PUT /api/users/skills alongside the profile PATCH. Native Edit Profile has no skills fiel
- **[medium·missing-action·auth-settings]** No Gigs tab on the native public profile. RN shows the user's gigs (GET /api/gigs?user_id=…&limit=20) as a tab with rows that deep-link into /gig/:id. Native profiles expose only Posts and About.
- **[medium·missing-endpoint·auth-settings]** The gig-review surface on a profile is absent natively. RN has a Reviews tab with a count badge, an average/total header, a worker | poster | all filter driven by received_as, and a full-screen viewer
- **[medium·missing-action·auth-settings]** Professional pricing, service area and categories cannot be edited natively. RN's professional editor writes categories[], pricing_meta.hourly_rate/currency and service_area.city/state/radius_km via P
- **[medium·missing-endpoint·auth-settings]** Cannot start professional verification natively. RN has a "Start verification" CTA on the professional profile calling POST /api/professional/verification/start with a tier. Both native apps read GET 
- **[medium·missing-action·auth-settings]** An unverified user who tries to sign in is dead-ended natively. RN detects a "verify" login error and reveals a "Resend verification email" link on the login screen (POST /api/users/resend-verificatio
- **[medium·missing-state·auth-settings]** "Show Email on Profile" and "Show Phone on Profile" have no native equivalent. RN persists them with the rest of the settings Save via PATCH /api/users/profile { showEmail, showPhone }. Neither native
- **[medium·missing-endpoint·auth-settings]** The combined payments + payouts history tab is missing natively. RN's Payments & Payouts screen has four tabs (Wallet · Payment methods · Payouts · History); the History tab calls GET /api/payments/hi
- **[medium·missing-state·auth-settings]** An invite code from a /join/:code link never reaches the native sign-up form. RN redirects a signed-out user to /(auth)/register?invite_code=CODE, pre-fills it and sends it as invite_code on register.
- **[medium·missing-state·auth-settings]** Native profiles do not know the existing relationship, so the connection controls are one-way. RN reads GET /api/users/:id/relationship (none | pending_sent | pending_received | connected | blocked, p
- **[medium·missing-action·creator-biz]** Mute / unmute an audience member is not exposed natively. RN's per-member sheet offers Mute ("they stay subscribed but stop getting notified") and Unmute, mapping to the same PATCH the native apps alr
- **[medium·missing-state·creator-biz]** The audience list is not paginated natively, so an audience larger than one server page is silently truncated. RN pages with limit=50 / offset and an onEndReached loader (src/hooks/usePersonaAudienceL
- **[medium·missing-action·creator-biz]** The audience sort control is missing natively. RN's header button cycles four sorts (recent / tenure / tier / alpha) and passes `sort` to the list endpoint. iOS's endpoint builder even declares a `sor
- **[medium·missing-action·creator-biz]** Blocking a follower from the Beacon followers list has no native equivalent. RN's followers tab exposes Approve / Remove / Block per row with a confirm alert. Native's audience management supports app
- **[medium·missing-action·creator-biz]** Three capabilities of the create-business wizard are absent natively: (1) the Logo step — RN uploads a logo right after create; neither native app has any business-media upload (grep for `uploadBusine
- **[medium·missing-endpoint·creator-biz]** The business-side inbox is missing natively. RN lists the rooms addressed to the business identity and the neighborhood posts matched to the business's categories. Native only has the customer-facing 
- **[medium·missing-action·creator-biz]** The founding-business offer banner and its claim CTA exist only in RN. RN fetches the founding-offer status on dashboard load and lets an eligible owner claim a numbered founding slot (with a dismiss 
- **[medium·missing-state·creator-biz]** Destructive audience actions lose the undo window natively. RN removes the row optimistically, shows a 5-second "Tap to undo" toast, and only fires the PATCH after the window closes (reverting the row
- **[medium·missing-action·money]** No partial withdrawal. RN gives the user an amount field (decimal-pad), validates against available balance, and posts that amount. Both native apps post the entire available balance with no amount in
- **[medium·missing-endpoint·money]** The 'Earnings & Spending' summary (TOTAL EARNED / TOTAL SPENT, including funds still in review) is absent. RN fetches both figures; neither native app has an endpoint helper or call site for either ro
- **[medium·missing-state·money]** Money surfaces lose their identity check. RN wraps both Wallet and Payments & Payouts in SensitiveScreenGuard (biometric/device-credential before content renders, with a 5-minute grace) and re-verifie
- **[medium·missing-state·money]** The wallet `frozen` flag is decoded but ignored natively. RN computes canWithdraw = hasWallet && !wallet.frozen && balance > 0 and renders a disabled CTA. Both native apps gate only on payoutsEnabled 
- **[medium·missing-action·money]** Pull-to-refresh is gone from the Wallet and Payments screens on both platforms. RN has a RefreshControl on the wallet route and on all four payments tabs; the only way to re-read balance/methods nativ
- **[medium·missing-state·money]** Lifetime totals are dropped. RN shows 'Total Earned' (lifetime_received) and 'Withdrawn' (lifetime_withdrawals) next to the balance. Both native apps decode these fields and never read them — the hero
- **[medium·one-platform-only·money]** Removing a saved card is unconfirmed on Android. RN shows a destructive confirmation Alert naming the last4 before detaching; iOS mirrors this with a confirmationDialog. Android fires the DELETE strai
- **[low·missing-action·homes-b]** The co-owner invite "fast track" toggle is missing natively. RN exposes it and defaults it ON; both native forms send only email/phone and let `fastTrack` fall back to its `false` default, so every na
- **[low·missing-action·homes-b]** Vet contact information cannot be entered for a pet. RN's add-pet form has a "Vet name / phone" field and the expanded pet card shows it. Native Add/Edit Pet only collects species, name, breed, photo 
- **[low·one-platform-only·gigs]** The Tasks tab's feed-scope segmentation is absent on both natives: RN has All / Tasks / Support Trains chips that mix nearby Support Trains into the gig feed (GET /api/support-trains/nearby), plus "My
- **[low·missing-endpoint·gigs]** The v2 scored-offers endpoint is never called by either native app. RN uses it for owners of curated_offers/quotes gigs (ranked offer cards) and falls back to plain /bids on failure; native always use
- **[low·missing-action·gigs]** "Share this task to the feed" is missing natively — RN's gig detail opens a PostTargetPicker + PostComposerModal that creates a feed post (with purpose, visibility, tags, media) referencing the task. 
- **[low·missing-endpoint·auth-settings]** The "Generate bio with AI" button on Edit Profile has no native counterpart. RN builds a prompt from name/skills/tagline/city and calls POST /api/ai/draft/post, dropping the result into the bio field.
- **[low·missing-endpoint·creator-biz]** Broadcast read receipts are never sent natively. RN marks a broadcast message read when it scrolls into view on the public Beacon profile, which is what feeds the creator's read-count analytics on the
- **[low·missing-state·money]** Connect account status detail is collapsed to a binary. RN distinguishes three states — connected (with CARD PAYMENTS / PAYOUTS Enabled-Disabled tiles), 'Account verification in progress' with a Conti
- **[low·missing-state·money]** The Payments screen's Payouts section is a static 'not connected' scaffold on both platforms — it always renders the 'Stripe Connect / Connect' chip, 'Payout method — Add after connecting Stripe' and 
- **[low·missing-state·money]** The pending-release breakdown is collapsed. RN renders separate 'In review' and 'Releasing soon' dollar lines from the same endpoint; both native apps use only total_pending_cents plus a combined coun
- **[low·missing-state·money]** Context-level: RN has a persisted per-user app-lock setup-prompt state ('pending' / 'enabled' / 'declined') and a post-login layer that offers to turn on biometric protection once, then remembers the 
- **[low·missing-state·money]** Context-level: RN's PantopusProvider keeps a client-side mute/hide layer (mutedEntities for users and businesses, hiddenPostIds) that filters feed content instantly after a mute/hide action, before an
- **[low·missing-state·money]** Context-level: RN hydrates and exposes `recentLocations` from GET /api/location (recently used viewing places, with radius and source id) so the place switcher can offer recents. Neither native app de
