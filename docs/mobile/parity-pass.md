# Mobile Parity Verification Pass (Part 2B / Block J)

**Date:** 2026-06-02
**Scope:** Three structural-parity checks across iOS (`frontend/apps/ios/Pantopus`)
and Android (`frontend/apps/android/app/src/main/java/app/pantopus/android`).
**Mode:** Report-only + small corrective edits where a field/behavior is missing.

## Result summary

| # | Check | iOS | Android | Verdict | Edits |
|---|-------|-----|---------|---------|-------|
| 1 | Mailbox categories → built detail variant | ✅ all 9 | ✅ all 9 | **PASS** | none |
| 2 | Add-Home "Find" (find-by-address) step | ✅ discrete view | ✅ folded into wizard | **PASS** | none |
| 3 | Chat AI as a conversation mode (A15.3) | ✅ `Chat/Conversation/AI/*` | ✅ `inbox/conversation/ai/*` | **PASS** | none |

**No code changes were required.** Every category, field, and identifier the three
checks call for is already present and equivalent on both platforms. The only
repo change in this block is committing the design pack into `docs/design/new/`
(Part 5 item 2). Because no app code changed, no platform rebuild is required
(see [Verification](#verification)).

---

## CHECK 1 — Mailbox categories → built detail variant

**Claim under test.** RN shipped separate routes
`mailbox/{booklet,certified,community,coupon,gig,memory,package,party,records}`.
Native implements these as per-category variants of one shared mail-detail
screen. Confirm **each** RN category maps to a built variant on both platforms.

### RN category enumeration

The RN web app's category routes live under
`frontend/apps/web/src/app/(app)/app/mailbox/`. Filtering out the
non-category feature routes (`booklet`-vs-`vacation/travel/tasks/earn/…`),
the nine ceremonial categories called out by the block are all present:

`booklet`, `certified`, `community`, `coupon`, `gig`, `memory`, `package`,
`party`, `records`.

(The web folder also contains `counter`, `map`, `stamps`, `vault`,
`unboxing`, `disambiguate`, `translation`, `tasks`, `earn`, `vacation`,
`travel`, `settings`, `_legacy_detail`, `_components`, `[drawer]` — these are
mailbox *features/utilities*, not item categories, and are out of scope for
this check. Each has its own native screen under `Features/Mailbox/*` /
`ui/screens/mailbox/*`.)

### Live detail screen = `MailDetail` (the A17 "Variants" archetype)

Both platforms route a tapped mail item to **`MailDetailView` / `MailDetailScreen`**,
which dispatches by `MailItemCategory` to a dedicated variant layout:

- iOS route binding: `Features/Root/HubTabRoot.swift:1247` (`case .mailItemDetail`)
  and `Features/Root/YouTabRoot.swift:855` both construct `MailDetailView(...)`.
- Android route binding: `ui/screens/root/RootTabScreen.kt:2325` (`MAILBOX_ITEM_DETAIL`
  nav route) constructs `MailDetailScreen(...)`.

> Note: the route is *named* `mailItemDetail` / `MAILBOX_ITEM_DETAIL` for
> historical reasons, but the view it renders is `MailDetail*`, not the
> `MailboxItemDetail*` legacy archetype (see observation below).

### Per-category variant mapping (both platforms)

iOS dispatch — `Features/Mailbox/MailDetail/MailDetailView.swift` (`switch content.category`, lines 94–113).
Android dispatch — `ui/screens/mailbox/mail_detail/MailDetailScreen.kt` (`when` block, lines 221–314).

| RN category | iOS variant (`MailDetail/Variants/`) | Android variant (`mail_detail/variants/`) | Mapped |
|-------------|--------------------------------------|-------------------------------------------|--------|
| booklet   | `BookletDetailLayout`   | `BookletDetailLayout`   | ✅ / ✅ |
| certified | `CertifiedDetailLayout` | `CertifiedDetailLayout` | ✅ / ✅ |
| community | `CommunityDetailLayout` | `CommunityDetailLayout` | ✅ / ✅ |
| coupon    | `CouponDetailLayout`    | `CouponDetailLayout`    | ✅ / ✅ |
| gig       | `GigMailDetailLayout`   | `GigDetailLayout`       | ✅ / ✅ |
| memory    | `MemoryDetailLayout`    | `MemoryDetailLayout`    | ✅ / ✅ |
| package   | `PackageDetailLayout`   | `PackageDetailLayout`   | ✅ / ✅ |
| party     | `PartyDetailLayout`     | `PartyDetailLayout`     | ✅ / ✅ |
| records   | `RecordsDetailLayout`   | `RecordsDetailLayout`   | ✅ / ✅ |
| *(other 12 enum cases)* | `GenericMailDetailLayout` (fallback) | `GenericMailDetailLayout` (fallback) | ✅ / ✅ |

All nine RN categories resolve to a dedicated, built variant on **both**
platforms. No category falls through to the generic fallback. The
`MailItemCategory` enum itself (`ItemDetail/MailItemCategory.swift` /
`item_detail/MailItemCategory.kt`) carries all nine cases (plus 11 extended
categories and a `.general` fallback) with matching accent/icon/label tokens.

> Android nuance: each `when` branch is guarded by its projected content being
> non-null (e.g. `category == Booklet && booklet != null`). This is graceful
> degradation, not a missing variant — for an item of that category the
> projection is populated, so the dedicated layout renders. A malformed
> payload degrades to `GenericMailDetailLayout`, matching iOS's behavior when
> a variant's required slots are absent.

### Verdict: **PASS** — no missing variant, no edit needed.

### Observation (no action — out of scope)

A second, **parallel** detail archetype exists: `MailboxItemDetailView` /
`MailboxItemDetailScreen` with `ItemDetail/Bodies/` (iOS) /
`item_detail/bodies/` (Android). It is **not wired into navigation on either
platform** — the only references to `MailboxItemDetailView(` /
`MailboxItemDetailScreen(` are an iOS `#Preview` and the Android composable's
own definition. Its category dispatch is intentionally narrower (iOS
`MailboxItemDetailView.categoryBody`, lines 149–186, renders concrete bodies
for package/coupon/booklet/certified/community/gig/memory and
`MailItemPlaceholderBody` → `NotYetAvailableView` for the rest; Android's
`CategoryBody` in `MailboxItemDetailScreen.kt` mirrors this). Because this
archetype is dead relative to the live `MailDetail` path, its narrower
coverage does **not** affect the check. Recommend a future cleanup pass to
remove the legacy `MailboxItemDetail*` archetype (and the orphaned
`item_detail/bodies/PartyBody.kt` & `RecordsBody.kt` on Android) — tracked as
an observation here, **not** actioned in this report-only block.

---

## CHECK 2 — Add-Home "Find" (find-by-address) step

**Claim under test.** iOS has a discrete `AddHomeFindStepView`; Android folds
the find-by-address step into `AddHomeWizardScreen`. Confirm the
find-by-address step exists and behaves equivalently (same inputs, same
result).

### Structure

- iOS: `Features/Homes/AddHome/AddHomeFindStepView.swift` — discrete file,
  `struct AddressStep` (A12.1 search-first entry step).
- Android: `ui/screens/homes/add_home/AddHomeWizardScreen.kt` — private
  `@Composable AddressStep` (line 138), folded into the wizard file.

Both belong to the same four-step wizard with an identical step model
(`AddHomeSteps.swift` / `AddHomeSteps.kt`):
`Address → Confirm → Role → Review → Success`, `PROGRESS_TOTAL = 4`, with the
same one-indexed "N of M" readout.

### Inputs (same on both)

| Input / affordance | iOS (`AddressStep`) | Android (`AddressStep`) |
|--------------------|---------------------|-------------------------|
| Headline | "Where do you live?" | "Where do you live?" |
| Subcopy | "Pick your address to start. You'll verify it next." | identical |
| Address search field | `AddHomeSearchField` | search `Row` |
| Autocomplete dropdown | `AddHomeAutocompleteDropdown` | autocomplete list |
| Use current location | `UseCurrentLocationPill` | current-location button |
| Nearby homes list | `NearbyHomesSection` | `NearbyHomesSection` |
| Manual fallback | `ManualFallbackRow` / `ManualAddressButton` | manual fallback / button |

### Result (same on both)

Selecting a candidate (autocomplete, nearby, current location, or manual)
populates `AddHomeAddressFields {street, unit, city, state, zipCode}` with an
identical `isComplete` rule, and advances to the `Confirm` step. The role enum
(`AddHomeRole {owner, tenant, householdMember}`) and form snapshot
(`AddHomeFormState`) are byte-for-byte equivalent in shape and persistence
intent (iOS `@SceneStorage`; Android `SavedStateHandle`).

### Shared identifier contract (verbatim on both)

`addHomeSearchField`, `addHomeSearchInput`, `addHome_clearSearch`,
`addHome_useCurrentLocation`, `addHome_nearby_<id>`,
`addHome_autocomplete_<index>`, `addHome_manualFallback`,
`addHome_addAddressManually`
(iOS `.accessibilityIdentifier(...)`, Android `Modifier.testTag(...)`).

### Verdict: **PASS** — find-by-address step present and equivalent; no field or
behavior missing; no edit needed.

---

## CHECK 3 — Chat AI assistant as a conversation mode (A15.3)

**Claim under test.** The AI assistant conversation mode is present and
equivalent on both platforms (iOS `Chat/Conversation/AI/*`; Android
`inbox/conversation/ai/*`) and matches the A15.3 AI Assistant design as a
**conversation mode**, not a standalone screen.

### Design reference

`Chat_conversation/A15.3 - AI Assistant.html`. The native components cite
A15.3 directly in their headers.

### It is a conversation *mode*, not a standalone screen

Both platforms model AI as a case of the conversation-mode enum, rendered by
the shared conversation screen:

- iOS: `ChatConversationMode { dm, aiAssistant, creatorThread, fanThread }`
  (`Chat/Conversation/ChatConversationContent.swift:19`). The conversation
  view branches on `mode == .aiAssistant`
  (`ChatConversationView.swift:219`, `:844`, `:879`).
- Android: `ChatConversationMode { Dm, AiAssistant, CreatorThread, FanThread }`
  (`inbox/conversation/ChatConversationContent.kt:15`). The conversation
  screen branches on `conversationMode == ChatConversationMode.AiAssistant`
  (`ChatConversationScreen.kt:227`, `:270`, `:315`).

### Equivalent components & data

| Element | iOS | Android |
|---------|-----|---------|
| AI avatar | `ChatAIAvatar` (`AI/ChatAIAvatar.swift`) | `ChatAiAvatar` (`ai/AiComponents.kt`) |
| Capability chip | `AICapabilityChip` | `AiCapabilityChip` |
| Inline estimate card | `AIEstimateCard` | `AiEstimateCard` |
| Welcome card | `aiWelcomeCard` (`ChatConversationView.swift:353`) | `AiWelcomeFrame` (`ChatConversationScreen.kt:1275`) |
| Beta pill | `betaPill` (`:844`) | `BetaPill()` (`:315`, `:384`) |
| Prompt-chip model | `ChatPromptChip` | `ChatPromptChip` |
| Estimate model | `ChatEstimate` | `ChatEstimate` |
| AI reply message | `aiReply(text:, estimate:)` | `AiReply(text, estimate)` |
| Send-on-tap | `sendCapabilityPrompt(_:)` | `sendCapabilityPrompt(chip)` |

Default capability chips match exactly (`price` "Price a task", `draft`
"Draft a Pulse post", `mail` "Summarize mail", `neighbor` "Find a neighbor"),
as do the empty-state chips (`intro`, `gig`, `listing`) and the AI composer
placeholder ("Ask Pantopus AI…").

### Shared identifier contract (verbatim on both)

`chatAIWelcomeCard` (iOS `ChatConversationView.swift:386`; Android
`ChatConversationScreen.kt:1296`) and `chatAICapability_<id>` (iOS
`AICapabilityChip.swift:46`; Android `AiComponents.kt:84`).

### Verdict: **PASS** — AI is a conversation mode, present and equivalent on both
platforms, matching A15.3; no edit needed.

---

## Edits made

None. All three checks passed with no missing field, behavior, category, or
identifier. Consistent with the block's "fix only if … missing" guidance and
"no large refactors" constraint, no corrective code was written. (One future
cleanup is noted as an observation under CHECK 1 but is explicitly out of
scope for this report-only pass.)

## Verification

No application code was modified, so the iOS (`xcodegen` + build,
`swiftformat`/`swiftlint`) and Android (`assembleDebug` + `detekt`
`ktlintCheck`) build/lint gates are not triggered by this block. The only
filesystem change is the design-pack copy into `docs/design/new/` plus this
report under `docs/mobile/`. Existing snapshot/contract tests already pin the
verified surfaces, e.g.:

- `ios/PantopusTests/Features/Mailbox/PartyDetailLayoutSnapshotTests.swift`,
  `ios/PantopusTests/Features/Mailbox/MailDetail/RecordsDetailSnapshotTests.swift`
- `android/.../mailbox/mail_detail/PartyDetailSnapshotTest.kt`,
  `android/.../mailbox/mail_detail/CeremonialVariantsSnapshotTest.kt`
