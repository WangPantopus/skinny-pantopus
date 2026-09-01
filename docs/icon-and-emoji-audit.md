# P7.5 — Icon and emoji audit

> **Generated:** 2026-05-26. **Tokens cited from:** `docs/token-conventions.md` §5 (iOS `Icon`), §11 (Android `PantopusIconImage`).

## Part A — Icon usage

### Scope and findings

| Platform | Pattern scanned | Hits in feature code |
|---|---|---:|
| iOS | `Image(systemName: "...")` | **0** |
| iOS | `Image("...")` (asset / named image lookup) | **0** |
| Android | `androidx.compose.material.icons.Icons.*` | **0** |
| Android | `androidx.compose.material3.icons.Icons.*` | **0** |
| Android | `painterResource(R.drawable.ic_*)` / `icon_*` | **0** |

### Why the audit is empty: existing guards

Pre-existing verification was already in place when this audit ran:

- **iOS** — `Pantopus/scripts/verify-icons.sh` (wired into `make lint`)
  rejects any `Image(systemName:)` outside the design module.
- **Android** — `VerifyPantopusIconsTask` in `app/build.gradle.kts`
  (wired into `./gradlew check`) rejects direct `Icons.*` and
  `painterResource(R.drawable.ic_lucide_*)` outside `ui/theme/Icons.kt`.

The P7.0 guard layer (`verify-tokens.sh` / `verifyPantopusTokens` added
in this Phase 7 series) covers the token side. Combined, both feature
trees route 100 % of icon rendering through the canonical
`Icon(.<case>, size:, color:)` (iOS) and
`PantopusIconImage(icon = PantopusIcon.<Case>, contentDescription:,
size:, tint:)` (Android) APIs.

### Icon-enum gaps

**No gaps found.** Every icon rendered in feature code maps to an
existing `PantopusIcon` enum case. Confirmation method: the audit found
zero direct-Material / SF Symbol / drawable references, and every
`Icon(.X)` / `PantopusIconImage(icon = PantopusIcon.X)` call resolves to
an enum case that exists in `Core/Design/Icons.swift` (189 cases) and
`ui/theme/Icons.kt` (188 cases).

No `docs/icon-gaps.md` is produced — there is nothing to surface for
icon-system review at this time.

## Part B — Emoji audit

### Scope

- **iOS:** `frontend/apps/ios/Pantopus/Features/` +
  `frontend/apps/ios/Pantopus/Core/Design/Components/` +
  `frontend/apps/ios/Pantopus/App/`.
- **Android:** `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/` +
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/components/`.

Test files and fixtures excluded.

### Pattern

Python regex `[\U0001F300-\U0001FAFF☀-➿\U0001F600-\U0001F64F\U0001F900-\U0001F9FF]`
covering pictographic (`1F300-1FAFF`), dingbats (`2600-27BF`), emoticons
(`1F600-1F64F`), and supplemental symbols (`1F900-1F9FF`).

### Summary

| | iOS | Android |
|---|---:|---:|
| Pre-Pass-2 occurrences | 25 lines | 20 lines |
| Pass-2 removals (`✓` from past-tense CTA / state-pill labels) | **3 lines** | **3 lines** |
| Post-Pass-2 remaining | 22 lines | 17 lines |

### Pass-2 changes applied

| File | Line | Before | After | Why safe |
|---|---:|---|---|---|
| iOS `Features/Mailbox/ItemDetail/MailboxItemDetailView.swift` | 196 | `"Added to wallet ✓"` | `"Added to wallet"` | Past-tense "Added" already conveys completion; CTA's disabled styling comes from `primaryCompleted` flag separately. |
| iOS `Features/Mailbox/ItemDetail/MailboxItemDetailView.swift` | 213 | `"Signed ✓"` | `"Signed"` | Same reasoning. |
| iOS `Features/Mailbox/ItemDetail/Bodies/Components/BidCard.swift` | 74 | `"✓ Locked in"` | `"Locked in"` | Pill already has `Theme.Color.success` tint + `successBg` background when `isAccepted` is true — the green theme is the state cue, the `✓` was redundant visual reinforcement. |
| Android `ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt` | 204 | `"Added to wallet ✓"` | `"Added to wallet"` | Mirror of iOS. |
| Android `ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt` | 221 | `"Signed ✓"` | `"Signed"` | Mirror. |
| Android `ui/screens/mailbox/item_detail/bodies/components/BidCard.kt` | 116 | `"✓ Locked in"` | `"Locked in"` | Mirror. |

Bonus benefit: removes a screen-reader artifact ("checkmark" announced by
VoiceOver / TalkBack between the word and a pause).

### Remaining occurrences — classification

#### Acceptable: code comments (no UI rendering)

| File | Line | Reason |
|---|---:|---|
| iOS `Features/Homes/Documents/DocumentsViewModel.swift` | 339 | `✕` / `◯` in `///` doc comment describing body-line composition. |
| iOS `Features/Shared/SearchList/SearchListShell.swift` | 24, 27, 28 | `🔍` / `✕` / `🕒` in `///` ASCII-art diagram of search-list anatomy. |
| iOS `Features/Compose/PulseCompose/PulseComposeViewModel.swift` | 633 | `★★★☆☆` in `///` doc comment describing rating-row format. |
| iOS `Features/Explore/ExploreMapContent.swift` | 95 | `★` in `// amber — spot "4.8★"` end-of-line comment on `case rating`. |
| Android `ui/screens/compose/pulse/PulseComposeViewModel.kt` | 638 | Mirror of iOS line 633 (kdoc `*` block comment). |

These are documentation only — never rendered. **Acceptable.** No action.

#### Acceptable: heuristic input matching (server-side text classification)

| File | Lines | Reason |
|---|---|---|
| iOS `Features/Mailbox/Vault/VaultListViewModel.swift` | 370, 373, 376, 379, 382, 385 | `raw.contains("📋")`, `raw.contains("🧾")`, `raw.contains("🏥")`, `raw.contains("🏦")`, `raw.contains("💳")`, `raw.contains("✈")`, `raw.contains("📩")` — folder-detection heuristic on incoming mail subject text. Searches user-supplied text for emoji hints. |
| Android `ui/screens/mailbox/vault/VaultListViewModel.kt` | 366–371 | Same heuristic as iOS, formatted as `listOf("📋", "📜", "🏛", ...)` per folder. |

These emoji are pattern-matched against user-supplied text — they are
**never displayed**. The mail subject "🏥 Doctor visit reminder" gets
classified into the Health folder. **Acceptable.** No action.

#### Product-UI strings — DESIGN REVIEW (not auto-replaced)

The remaining hits are real product-UI strings but each requires a
view-level refactor or a protocol change that's beyond mechanical
replacement. They are surfaced here for follow-up.

##### Star ratings (`★` / `☆`)

| File | Lines | Role | Why deferred |
|---|---|---|---|
| iOS `Features/AudienceProfile/EditPersona/EditPersonaSampleData.swift` | 38 | Sample data field `rating: "4.8★"` displayed via `statTile(content.rating, "Avg rating")` and concatenated into an accessibility label. | Refactor needed: change the model field from `String` to `Double` (or strip `★` from sample data) AND update `statTile`/`EditPersonaView` to compose `Text("4.8") + Icon(.star)`. Two-file edit. |
| iOS `Features/Compose/PulseCompose/PulseComposeViewModel.swift` | 638, 639, 804 | `★`/`☆` characters used in `composeRecommendBody` to prefix recommend-post bodies with a `★★★☆☆\n\n` rating row. This format is saved to the backend and parsed back via `decodeRecommendStars`. | **Protocol change.** Replacing the star characters in the saved body would break already-saved posts. Needs a coordinated cross-platform migration. |
| iOS `Features/Explore/ExploreMapSampleData.swift` | 101, 145, 189, 232, 285, 356 | `badge("4.8★", .rating)` — sample-data badge constants displayed on the Explore-map cards. | Refactor needed: badge content currently `String`; would need to become a sum type `BadgeContent.text(String) \| .rating(Double)` so the view can render `Text(value) + Icon(.star)`. |
| Android `ui/screens/audience_profile/edit_persona/EditPersonaSampleData.kt` | 38 | Mirror of iOS `EditPersonaSampleData.swift`. | Same refactor; pair with iOS. |
| Android `ui/screens/compose/pulse/PulseComposeViewModel.kt` | 644, 645, 817 | Mirror of iOS `PulseComposeViewModel`. | Same protocol concern. |
| Android `ui/screens/explore/ExploreMapSampleData.kt` | 96, 140, 184, 221, 274, 352 | Mirror of iOS `ExploreMapSampleData.swift`. | Pair with iOS. |

**Recommended approach** for a follow-up prompt: introduce a typed
`RatingBadge` value (`{ value: Double, source: Stars/Score }`) and a
single `RatingBadgeView`/`@Composable RatingBadge()` that renders
`Text("4.8")` + `Icon(.star, size: 11, color: Theme.Color.warning)`.
The PulseCompose rating-row format is a protocol decision — discuss
with backend/web before changing.

### Wave A–D coverage

The audit hit Wave A–D folders directly:

- iOS: `AudienceProfile/EditPersona/`, `Explore/`,
  `Mailbox/ItemDetail/`, `Mailbox/ItemDetail/Bodies/Components/`,
  `Mailbox/Vault/`, `Compose/PulseCompose/`,
  `Shared/SearchList/` (shared shell), `Homes/Documents/` —
  **8 folders**, meets threshold.
- Android: `audience_profile/edit_persona/`, `explore/`,
  `mailbox/item_detail/`, `mailbox/item_detail/bodies/components/`,
  `mailbox/vault/`, `compose/pulse/` — **6 folders**, plus the 8 iOS
  combined coverage well above threshold.

## Acceptance summary

- ✅ Icon usage audited and mapped — both platforms already 100 %
  routed through the canonical icon API; existing guards keep it that
  way.
- ✅ Emoji audited and classified — every hit categorised as Comment /
  Heuristic-input / Product-UI.
- ✅ Product-UI emoji removed where it could be done without a
  view-level refactor or protocol change — 6 line edits across 4 files.
- ✅ Gaps documented separately — star-rating refactors and the
  PulseCompose protocol concern surfaced in the "DESIGN REVIEW"
  section above; no `docs/icon-gaps.md` because there are no
  icon-enum gaps.
