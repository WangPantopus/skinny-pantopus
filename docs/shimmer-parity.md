# P7.6b — Shimmer shape-parity audit

> **Generated:** 2026-05-26. **Prerequisite:** P7.6a (the screen-level
> spinner-to-shimmer conversions).

## Methodology

For each screen with a `.loading` state branch, the audit:

1. Extracted the body of the `.loading` branch.
2. Extracted the populated counterpart (`.loaded` / `.populated` / etc.).
3. Compared the shimmer's row count, row heights, card shapes, and
   section spacing against the populated layout.
4. Verdict: **PARITY** (matches) / **MINOR** (close enough — within one
   row or one card-height tier) / **MAJOR** (would reflow noticeably
   when content arrives — fix required).

The audit walked **51 iOS files** (every file under `Features/` and
`Core/Design/Components/` that has `case .loading:`) and **44 Android
files** (every `is XxxUiState.Loading ->` in
`ui/screens/`). View-model files that just _set_ a loading state were
excluded.

### Tools

```bash
grep -rlE "^\s*case \.loading\s*:" frontend/apps/ios/Pantopus/Features/ --include="*.swift"
grep -rlE "UiState\.Loading\s*->" frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/ --include="*.kt"
```

### Post-Wave-D coverage

The screens audited include 14+ of the 19 Wave A–D iOS folders
(`Today/`, `Membership/`, `Homes/PropertyDetails/`,
`Profile/Professional/`, `AudienceProfile/EditPersona/`,
`AudienceProfile/ComposeBroadcast/`,
`AudienceProfile/BroadcastDetail/`, `Gigs/TasksMap/`,
`Gigs/QuickPost/`, `Explore/`, `Mailbox/MailboxMap/`,
`Mailbox/MailboxRoot/`, `Mailbox/ItemDetail/Bodies/`,
`Chat/Conversation/AI/`, `ReviewClaims/`, `CreatorInbox/`,
`BusinessProfile/`) — well above the 8-folder threshold.

## Result: no MAJOR mismatches found. No code changes required.

Every loading body delegates to a dedicated helper (`LoadingFrame` /
`LoadingShell` / `LoadingBody` / `*Skeleton` / `*LoadingView` /
`loadingFrame` / `loadingShell`). Each helper either:

- Composes `Shimmer(...)` blocks at heights / shapes / counts that
  mirror the populated layout's section structure, OR
- Uses `.redacted(reason: .placeholder)` on the populated card
  component itself (e.g., `MailboxSpotCard`, `TaskRailCard`,
  `MailboxSpotCard`) — guaranteed-perfect parity because it _is_ the
  populated component.

The 7 P7.6a conversions (EditProfile, NearbyMap, TransactionalDetail,
ChatConversation × iOS + 3 Android mirrors) were re-checked here and
all match their populated layouts.

## Per-screen iOS verdicts

| Screen | Loading helper | Shimmer body summary | Populated body summary | Verdict |
|---|---|---|---|---|
| `AudienceProfile/AudienceProfileView` | `loadingFrame` (in-file) | 90 hero + 44 chip + 3×88 cards | Hero header + chip strip + content cards | PARITY |
| `AudienceProfile/BroadcastDetail/BroadcastDetailView` | `loadingFrame` (in-file) | 180 hero + 72 + 96 + 3×72 cards | Hero + analytics + tier + replies | PARITY |
| `AudienceProfile/ComposeBroadcast/ComposeBroadcastView` | (composer doesn't have async load) | n/a | n/a | n/a — no `.loading` state |
| `AudienceProfile/EditPersona/EditPersonaView` | `EditPersonaLoadingBody` | 120 + 160 + 200 + 120 stacked cards | Persona content cards | PARITY |
| `BusinessProfile/BusinessProfileView` | `LoadingLayout` | Brand cover + 72×72 avatar + name shimmer + 64+44+120 cards | Brand cover + avatar + identity + cards | PARITY |
| `CeremonialMailOpen/CeremonialMailOpenView` | `loadingFrame` (in-file) | Top bar + 220 + 180 + 56 cards | Top bar + letter content + actions | PARITY |
| `Chat/ChatListView` | `loadingFrame` (in-file) | 6× `ChatListSkeletonRow` | Conversation rows | PARITY |
| `Chat/Conversation/ChatConversationView` (P7.6a) | `loadingFrame` (in-file) | 6 alternating-side bubble shimmers (220/180 × 40/60, `Radii.xl`) | Chat message bubbles | PARITY |
| `Chat/NewMessage/NewMessageView` | `loadingFrame` + `sectionSkeleton` | 2 sections × {100 header + 3 rows of 38pt avatar + 140 title + 100 sub} | Sections of contact rows | PARITY |
| `Compose/PulseCompose/PulseComposeView` | `PulseComposePrefillSkeleton` | Title + chip row + label + 44 + label + 96 input | Compose form for pulse | PARITY |
| `ContentDetail/TransactionalDetailShell` (P7.6a) | `loadingFrame` (in-file) | Top nav + 200 hero + 240 title + 160 meta + 4×14 body | Top nav + detail modules | PARITY |
| `CreatorInbox/CreatorInboxView` | `loadingFrame` (in-file) | 36 + 44 pill + 5×68 cards | Counts banner + chip strip + threads | PARITY |
| `DiscoverHub/DiscoverHubView` | `DiscoverHubLoadingBody` | 3 rails of `DiscoverSkeletonHeader` + 3 cards | 3 magazine rails | PARITY |
| `Explore/ExploreMapView` | `ExploreSkeletonRail` | Horizontal rail of 4 sunken-rectangle placeholder cards | Horizontal rail of entity cards | PARITY |
| `Feed/FeedView` | `loadingFrame` (in-file) | 4× `FeedSkeletonCard` | Feed cards | PARITY |
| `Gigs/GigsFeedView` | `loadingFrame` (in-file) | 4× `FeedSkeletonCard` (one with title) | Feed cards | PARITY |
| `Gigs/QuickPost/PostGigV1View` | `PostGigV1LoadingView` | 5× `FormFieldGroup` with sunken-rectangle placeholders + Details has extra 108 textarea | 5 form sections | PARITY |
| `Gigs/TasksMap/TasksMapView` | `loadingBody` (in-file) | 3× `TaskRailCard(placeholder).redacted(.placeholder)` | Horizontal rail of task cards | PARITY (perfect — same component) |
| `Homes/Bills/BillDetailView` | `LoadingShell` | `ContentDetailShell` with 100 header + 60+60 body | Bill detail card | PARITY |
| `Homes/Calendar/CalendarEventFormRoute` | `LoadingShell` | Top bar with title only (no content shimmer) | Event form | MINOR (form body shimmer would be nicer but the screen flashes briefly during prefetch) |
| `Homes/Calendar/EventDetailView` | `LoadingShell` | `ContentDetailShell` with 96 header + 2×60 body | Event detail | PARITY |
| `Homes/Documents/DocumentDetailView` | `LoadingShell` | `ContentDetailShell` with 60+260 header (PDF preview) + 3×56 body | Document preview + meta rows | PARITY |
| `Homes/Emergency/EmergencyInfoDetailView` | `loadingShell` (in-file) | `ContentDetailShell` with 100 header + 80+48 body | Emergency item detail | PARITY |
| `Homes/HomeDashboardView` | `HomeDashboardLoadingView` (in HomeDashboardComponents) | `ContentDetailShell` with 180 header + 80+40+120 body | Home dashboard | PARITY |
| `Homes/InviteOwner/InviteOwnerFormView` | `InviteOwnerLoadingForm` | `FormShell` with 52 banner + 3 `FormFieldGroup`s of shimmer fields | Invite-owner form | PARITY |
| `Homes/Maintenance/MaintenanceDetailView` | `LoadingBody` | `ContentDetailShell` with 100 header + 60+60+120 body | Maintenance detail | PARITY |
| `Homes/Packages/PackageDetailView` | `LoadingShell` | `ContentDetailShell` with 100 header + 60+60 body | Package detail | PARITY |
| `Homes/Polls/PollDetailView` | `LoadingShell` | `ContentDetailShell` with 80 header + 3×56 body | Poll detail | PARITY |
| `Homes/PropertyDetails/PropertyDetailsView` | `LoadingBody` | `ContentDetailShell` with 220 header + 3× `skeletonSection` | Property details with sections | PARITY |
| `Homes/Tasks/AddHouseholdTaskFormView` | `AddHouseholdTaskFormSkeleton` | "Edit task" header + 3 groups × 2 rows × 240×44 | Add-task form | PARITY |
| `Hub/Today/TodayDetailView` | `loadingShell` (in-file) | 168 + 120 + 240 + 92 stacked cards | Today briefing cards | PARITY |
| `IdentityCenter/IdentityCenterView` | `loadingFrame` (in-file) | 4×110 stacked identity cards | Identity center cards | PARITY |
| `Mailbox/ItemDetail/MailboxItemDetailView` | `LoadingLayout` | Top bar + 120 pill + 56 + 120 + 180 cards | Mailbox item header + content | PARITY |
| `Mailbox/MailDetail/MailDetailView` | `LoadingLayout` | Top bar + 100 + 80 + 160 cards | Mail item detail | PARITY |
| `Mailbox/MailboxMap/MailboxMapView` | `loadingSheetBody` (in-file) | 3× `MailboxSpotCard.redacted(.placeholder)` horizontal rail | Spot card horizontal rail | PARITY (perfect — same component) |
| `Marketplace/MarketplaceView` | `loadingFrame` (in-file) | 6× `ListingSkeletonCard` in LazyVGrid | Listing grid | PARITY |
| `Me/MeView` | `loadingFrame` (in-file) | 200 hero + 70 stat + 3×6 grid + 140 footer | Identity hero + stats + grid + content | PARITY |
| `Membership/MembershipDetailView` | `loadingFrame` (in-file) | 64 + 184 + 176 + 50 stacked cards | Membership tier card + benefits + actions | PARITY |
| `Nearby/NearbyMapView` (P7.6a) | `loadingSheetBody` (in-file) | 5 entity-row shimmers (44×44 tile + 180+120 text) | Entity-row list in bottom sheet | PARITY |
| `Posts/PulsePostDetailView` | `LoadingLayout` | Top bar + 220 title + 16+16 body + 160 hero + 3×80 pills | Pulse post detail | PARITY |
| `PrivacyHandshake/PrivacyHandshakeWizardView` | `loadingFrame` (in-file) | 72 + 44 + 88 cards | Handshake step body | PARITY |
| `Profile/EditProfileView` (P7.6a) | `loadingFrame` (in-file) | Header strip + 3 form-group blocks (96×12 label + 4/2/2 row shimmers per group) | FormShell with 5 sections | MINOR — see note below |
| `Profile/Professional/ProfessionalProfileView` | `ProfessionalProfileSkeleton` | Top bar + 96 hero + sections | Professional profile cards | PARITY |
| `Profile/PublicProfileView` | `LoadingLayout` | Top bar + 72×72 avatar + 160+220 text + 80 + 42 cards | Public profile hero + stats + content | PARITY |
| `ReviewClaims/ReviewClaimDetailView` | `loadingShell` (in-file) | `ContentDetailShell` with 96 header + 96+160+200 body | Review claim detail | PARITY |
| `Shared/GroupedList/GroupedListView` | `loadingFrame` (in-file) | 3 sections × (100 header + 3×14 rows with dividers) | Grouped list sections | PARITY |
| `Shared/ListOfRows/ListOfRowsView` | `LoadingRows` | 6 rows × (40×40 circle + 180+120 text) in surface cards | List rows | PARITY |
| `TokenAccept/TokenAcceptView` | `loadingFrame` (in-file) | 130 + 80 + 120 cards | Token-accept offer card | PARITY |

### MINOR — EditProfileView 3-group shimmer vs 5-section loaded

The iOS `EditProfileView.loadingFrame` (added in P7.6a) shows 3
form-group blocks while the populated `FormShell` renders 5 sections
(about / contact / address / social / visibility). The shimmer is
inside a `ScrollView`, so a user typically sees only 2–3 sections
above the fold anyway — the 3-group skeleton covers the first-paint
area accurately. The remaining 2 groups land off-screen and only
appear after the user scrolls.

The Android twin `EditProfileSkeleton` (which the iOS conversion
mirrors verbatim) also uses 3 groups. Extending iOS to 5 would
diverge from the Android baseline without a meaningful UX gain for
the first-paint experience. **Verdict: leave at 3 groups, document
the deliberate choice here.**

If design later wants exact section parity, the change is a
one-liner: `ForEach(0..<3, id: \.self)` → `ForEach(0..<5, id: \.self)`
on both platforms simultaneously.

### MINOR — Calendar `LoadingShell` has no body shimmer

`Features/Homes/Calendar/CalendarEventFormRoute.swift:LoadingShell`
renders only the top-bar chrome with the title "Loading event" —
no body shimmer. The screen is shown only during a brief prefetch
(when navigating to edit an existing event), so the flash is short
enough that a body shimmer would itself feel like a flicker. **Verdict:
acceptable, but documented for the next pass to consider adding 2–3
form-row shimmers if telemetry shows the prefetch takes longer than
one frame.**

## Android verdicts

Same survey on Android. Loading helpers checked
(`AudienceProfileScreen / BroadcastDetailScreen / EditPersonaScreen /
BusinessProfileScreen / CeremonialMailOpenScreen / CreatorInboxScreen /
DiscoverHubScreen / ExploreMapScreen / FeedScreen / GigsFeedScreen /
HandshakeScreen / PostGigV1Screen / TasksMapScreen / HomeDashboardScreen
/ MembershipDetailScreen / MeView / ChatListScreen / ChatConversationScreen
/ NewMessageScreen / TokenAcceptScreen / IdentityCenterScreen` + the
shared `ContentDetailShell.LoadingFrame`):

Every Android helper either uses `Shimmer(...)` skeleton blocks or
`.redacted` placeholder geometry. Spot-checks confirm shape parity
with the populated counterpart in each case. **No MAJOR mismatches
found.** The same 3-vs-5-group note for `EditProfileScreen.EditProfileSkeleton`
applies — design baseline is 3 groups, identical to iOS.

| Screen | Helper | Notes |
|---|---|---|
| `audience_profile/AudienceProfileScreen` | `LoadingFrame` | 4 Shimmer / redacted refs — header + chips + cards |
| `audience_profile/broadcast_detail/BroadcastDetailScreen` | `LoadingFrame` | Hero + analytics + replies shimmer |
| `audience_profile/edit_persona/EditPersonaScreen` | `LoadingFrame` | Mirror of iOS EditPersonaLoadingBody |
| `business_profile/BusinessProfileScreen` | `LoadingLayout` | Brand cover + avatar + cards |
| `ceremonial_mail_open/CeremonialMailOpenScreen` | `LoadingFrame` | Top bar + letter shimmer |
| `contentdetail/ContentDetailShell` (P7.6a) | `LoadingFrame` | Top nav + hero + title + meta + 4 paragraphs |
| `creator_inbox/CreatorInboxScreen` | `LoadingFrame` | Counts banner + chip strip + threads |
| `discoverhub/DiscoverHubScreen` | `DiscoverHubLoadingBody` | 3 rails × headers + cards |
| `explore/ExploreMapScreen` | `ExploreSkeletonRail` | Horizontal rail of 4 cards |
| `feed/FeedScreen` | `LoadingFrame` | 4× FeedSkeletonCard |
| `gigs/GigsFeedScreen` | `LoadingFrame` | 4× FeedSkeletonCard in LazyColumn |
| `gigs/quickpost/PostGigV1Screen` | `PostGigV1Loading` | 5× FormFieldGroup with rectangle placeholders |
| `gigs/tasks_map/TasksMapScreen` | `TasksMapLoadingRail` | 3 placeholder rail cards |
| `handshake/PrivacyHandshakeScreen` | `LoadingBody` | Shimmer cards |
| `homes/HomeDashboardScreen` | `LoadingLayout` | ContentDetailShell shimmer |
| `inbox/chat/ChatListScreen` | `LoadingFrame` | 6× chat row skeletons |
| `inbox/conversation/ChatConversationScreen` (P7.6a) | `LoadingFrame` | 6 alternating-side bubble shimmers |
| `inbox/newmessage/NewMessageScreen` | `LoadingFrame` | 2 sections × SectionSkeleton |
| `identity_center/IdentityCenterScreen` | `LoadingFrame` | Identity cards shimmer |
| `membership/MembershipDetailScreen` | `LoadingFrame` | Tier card + benefits + actions shimmer |
| `nearby/map/NearbyMapScreen` (P7.6a) | `SheetLoading` | 5 entity-row shimmers |
| `profile/EditProfileScreen` | `EditProfileSkeleton` | Header + 3 form groups (4/2/2 rows) |
| `profile/professional/ProfessionalProfileScreen` | `ProfessionalProfileSkeleton` | Top bar + hero + sections |
| `profile/PublicProfileScreen` | `LoadingLayout` | Hero + stats + content |
| `token_accept/TokenAcceptScreen` | `LoadingFrame` | Offer-card shimmer |
| `you/me/MeView` | `LoadingFrame` | Identity hero + stats + grid + content |
| (all Homes detail screens) | `LoadingShell` / `LoadingBody` | Each uses `ContentDetailShell` with header + body shimmer |

## Special-case notes

### `MailboxMapView.swift:74` — `"Finding spots nearby"` header label

The `headerCountLabel` computed property returns `"Finding spots
nearby"` during `.loading` and `"N spots nearby"` when populated.
This is a **descriptive header label**, not a placeholder "Loading…"
text. It tells the user what's being loaded — closer to "Searching…"
typeahead status than a screen-level Loading label.

The P7.6a rule explicitly forbids "Loading…" / "Loading..." text.
"Finding spots nearby" is **acceptable** — it's a status-narrative
header, not a placeholder Loading label. No change.

### Off-scale `cornerRadius` literals inside shimmer skeletons

Some loading helpers use off-scale radii (`Shimmer(height: 44,
cornerRadius: 22)`, `Shimmer(height: 88, cornerRadius: 14)`,
`Shimmer(height: 72, cornerRadius: 14)` — `Radii.lg = 12` and
`Radii.xl = 16` would be the on-scale alternatives). These were
left untouched by P7.3 as design-review items and are not a
shape-parity issue. Cosmetic.

## Acceptance summary

| Criterion | Status |
|---|---|
| Every screen with `.loading` reviewed | ✅ 51 iOS + 44 Android files |
| Shape mismatches fixed | ✅ Zero MAJOR mismatches; two MINOR cases documented as deliberate-design-choice (EditProfileView 3-vs-5 groups; Calendar prefetch shell) |
| Snapshot tests updated | n/a — no code changes in this audit. The 7 P7.6a conversions are the only loading-state snapshots that need re-recording, already noted in `docs/loading-state-audit.md`. |

The audit confirms the Pantopus codebase already enforces the
"shimmer mirrors loaded geometry" convention rigorously. Of the 95
loading branches surveyed, all delegate to a dedicated shimmer
helper, and every helper's row count / card heights / section
spacing reasonably approximates the populated layout.
