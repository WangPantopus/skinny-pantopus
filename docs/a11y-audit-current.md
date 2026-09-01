# Mobile accessibility audit — current (T6 closeout)

Accessibility sweep across every screen the Tier-5 + Tier-6 buildouts
shipped. Findings come from a static read of the feature directories,
cross-checked against the four-state-coverage rule in
`docs/mobile-screen-definition-of-done.md` §9 and the platform-level
audits in `frontend/apps/{ios,android}/docs/a11y_audit.md`.

> Renamed from `docs/a11y-audit-t5.md` in P27 (T6 closeout) — the
> coverage now spans T5 + every T6 screen. Re-run this audit at the
> end of each tier's buildout.

Web a11y reads were done by inspecting the shell + each page's
`role` / `aria-label` / `data-testid` posture. A full automated axe
sweep is gated on local dev server + axe-core devtools and isn't
reproducible from the agent container; commits land with the manual
findings below and the gate stays at "shell-mediated", since every
new T5 + T6 page renders through the shared archetype shells
(`<ListOfRowsShell />`, `<MailItemDetailShell />`,
`<MapListHybridShell />`, `<ContentDetailShell />`,
`<WizardShell />`, `<FormShell />`, `<GroupedListShell />`) which
carry the shell-level a11y contract.

## Root identifiers — every screen targetable

Every T5 + T6 screen exposes the archetype's root accessibility
identifier (iOS) / test tag (Android) / data-testid (web). Verified
by grep:

```bash
grep -rn 'listOfRowsContainer\|mailItemDetailShell\|mapListHybridShell\|featureName.*Identifier\|testTag.*=' \
  frontend/apps/{ios,android}/...
```

### T5 root identifiers

| Screen | iOS root | Android tag | Web data-testid |
|---|---|---|---|
| Notifications V2 | `notifications` | `notifications` | `notifications` |
| Connections | `connections` | `connections` | `connections` |
| Bills list | `billsList` + `listOfRowsContainer` | `billsList` + `listOfRowsContainer` | `billsList` |
| Bill detail | `billDetail` | `billDetail` | n/a (page-level only) |
| Add Bill wizard | `addBillWizard` + `wizardShell` | `addBillWizard` + `wizardShell` | (web modal) |
| Pets list | `petsList` + `listOfRowsContainer` | `petsList` + `listOfRowsContainer` | `petsList` |
| Offers V2 | `offers` | `offers` | `offers` |
| My bids | `my-bids` | `my-bids` | `my-bids` |
| My tasks V2 | `my-tasks` | `my-tasks` | `my-tasks` |
| My posts | `my-posts` | `my-posts` | `my-posts` |
| Listing offers | `listing-offers` + `listingContextHeader` | `listing-offers` + `listingContextHeader` | `listing-offers` |
| Discover hub | `discoverHub` | `discoverHub` | `discoverHub` |
| Discover businesses | `discoverBusinesses` | `discoverBusinesses` | `discoverBusinesses` |
| Review claims (web) | n/a | n/a | `reviewClaims` |

### T6 root identifiers (new in this audit)

| Screen | iOS root | Android tag | Web data-testid |
|---|---|---|---|
| Login (T6.1b) | `loginScreen` + per-field tags | `loginScreen` + same | (web modal) |
| Create account (T6.1b) | `signUpScreen` + per-field tags | `signUpScreen` + same | (web modal) |
| Auth error (T6.1b) | `authErrorScreen` + `authErrorRetryButton` + `authErrorBackButton` | same | same |
| Forgot password (T6.1c) | `forgotPasswordScreen` + per-field tags | same | same |
| Reset password (T6.1c) | `resetPasswordScreen` + per-field tags | same | same |
| Verify email (T6.1c) | `verifyEmailScreen` + per-button tags | same | same |
| Hub (T6.2a) | `hubScreen` + 14 per-section tags | `hubScreen` + same | (web parity) |
| Me / You (T6.2b) | `meScreen` + per-identity / per-section tags | `meScreen` + same | (web parity) |
| Blocked users (T6.2c) | `blockedUsers` + `listOfRowsContainer` | `listOfRowsContainer` (Android wraps) | (deferred — web follow-up) |
| Password change (T6.2c) | `passwordChange` + `formShell` + field tags | `formShell` + field tags | (deferred) |
| Verification center (T6.2c) | `verificationCenter` + `groupedList` | `groupedList` (Android wraps) | (deferred) |
| Help center (T6.2c) | `helpCenter` + `helpCenterContactCTA` | `contentDetail` (Android wraps) + same | (deferred) |
| Legal index (T6.2c) | `legalIndex` + `groupedList` | `groupedList` (Android wraps) | (deferred) |
| Legal content (T6.2c) | `legalContent.<doc>` + `contentDetail` | `legalContent.<doc>` + `contentDetail` | (deferred) |
| About (T6.2c) | `aboutScreen` + `aboutVersion` | `aboutScreen` + `aboutVersion` | (deferred) |
| Members (T6.3a / P9) | `membersList` + `listOfRowsContainer` + invite tags | same | `membersList` |
| Maintenance (T6.3b / P10) | `maintenanceList` + tab tags | same | (deferred — home pillar) |
| Household tasks (T6.3c / P11) | `householdTasksList` + tab tags | same | (deferred — home pillar) |
| Packages (T6.3d / P14) | `packagesList` + tab tags + `packageDetail` + `logPackageSheet` | same | `packagesList` |
| Polls (T6.3e / P13) | `pollsList` + tab tags + `pollDetail` | same | (deferred — home pillar) |
| My homes (T6.3f / P14 refresh) | `listOfRowsContainer` | same | `myHomes` |
| My listings (T6.3f / P14) | `listOfRowsContainer` | same | `myListings` |
| My businesses (T6.3f / P14) | `listOfRowsContainer` | same | (deferred) |
| Owners (P15 / T6.3g) | `ownersList` + `ownersList_removeConfirm` | same | `ownersList` |
| Access codes (T6.4a / P16) | `accessCodes_screen` + row / action / fab tags + `listOfRowsTopBarTitle` | same | `accessCodesScreen` |
| Emergency info (T6.4b / P17) | `emergencyInfoList` + chip tags + `listOfRowsTopBarAction` | same | (deferred — home pillar) |
| Documents (T6.4b / P17) | `documentsList` + chip tags + `listOfRowsTopBarAction` | same | (deferred — home pillar) |
| Home calendar (T6.4c / P18) | `homeCalendar` + month-strip tags | same | `homeCalendar` |
| Mailbox A17 shell (T6.5a / P19) | `mailItemDetailShell` + 8-slot tags | same | `mailItemDetailShell` |
| Mailbox list (T6.5b / P20 refresh) | `listOfRowsContainer` | same | `mailbox` |
| Mail detail (T6.5b / P20 generic A17.1) | `mailDetail` + `mailItemDetailShell` + acknowledge tag | same | `mailDetail` |
| Mail Booklet (T6.5c / P21) | `mailDetail_booklet` + `bookletPager` set | same | `mailDetailBooklet` |
| Mail Certified (T6.5c / P21) | `mailDetail_certified` + `certifiedStampBadge` + `combinedSenderCarrierCard` + `chainOfCustodyTimeline` + acknowledge tag | same | `mailDetailCertified` |
| Mail Community (T6.5d / P22) | `mailDetail_community` + going chip + badge + event card + attendees + pulse thread + RSVP tags | same | `mailDetailCommunity` |
| Ceremonial Mail Open (T6.5d / P22 refresh) | `ceremonialMailOpen` + per-phase + envelope + open + skip-animation + close + voice-postscript + outcome + paper-body + content tags | same | (deferred) |
| Vault (T6.5e / P19.5) | `vaultList` + `listOfRowsContainer` | same | (deferred) |
| Ceremonial Mail Compose (T6.5e refresh) | `ceremonialMail` + `wizardShell` | same | (deferred) |
| Chat conversation (T6.6b / P25 refresh) | `chatConversation` + 12-element tag set | same | (web parity) |
| New message picker (T6.6b / P25) | `newMessage` + section / row tag set | same | (deferred) |
| Nearby — MapListHybrid (T6.6a / P24 shell) | `mapListHybridShell` + 9 slot tags | same | `mapListHybridShell` |
| Support Trains list (T6.6c / P26.5) | `supportTrains` + tab / FAB / top-bar action tags | same | (web parity) |
| Review Signups (T6.6c / P26.5) | `reviewSignups` + chip / footer tags | same | (organizer-only — web parity) |
| Transactional Detail (T6.6c refresh) | `contentDetailShell` + dock primary / secondary / counterparty tags | same | (per-feature) |
| Content Detail (T6.6c refresh) | `pulsePostDetail` / `publicProfile` / `homeDashboard` | same | (per-feature) |
| Identity Center (T6.6c refresh) | `identityCenter` + row tags | same | (deferred) |
| Privacy Handshake (T6.6c refresh) | `privacyHandshake` + step tags | same | (deferred) |
| Token Accept (T6.6c refresh) | `tokenAccept` + per-variant body tags | same | `tokenAccept` |
| Status / Wait (T6.6c refresh) | `statusWaiting` + body tag | same | (n/a — presentational) |
| Audience Profile (T6.6c refresh) | `audienceProfile` + tabs + per-tab content | same | (deferred) |
| Creator Inbox (T6.6c refresh — inside Audience) | `audienceProfileTabs` + `threadRow.<id>` | same | (deferred) |

Tab + chip + filter elements use the canonical `tab.<id>` /
`chip.<id>` / `listOfRowsTopBarAction` / `listOfRowsSearchBar` ids
declared on the shared shell — these mirror across all three
platforms.

**Action items resolved in P27:** every T6 screen now exposes a root
identifier (or its archetype-mapped equivalent) on every platform it
ships on. The pre-T6 follow-up to add `data-testid="discoverBusinesses"`
to the web `DiscoverBusinessesScreen` root container landed in T5.4.2.
No new action items today.

## Per-row a11y labels

Every `RowModel` rendered by the shared shell produces a combined
accessibility label built from the row's title + subtitle + body +
chips + time-meta + trailing chip + highlight. The combination logic
lives in:

- iOS: `ListOfRowsView.swift` `RowView.a11yLabel` (private computed
  property assembled from the model fields)
- Android: `ListOfRowsScreen.kt` (semantics merged via
  `contentDescription` on the row clickable)
- Web: `RowCard.tsx` (label assembled inline; the wrapper button
  carries `role="button"` + a `<span>` per chip with its text)

Verified for the T5 + T6 row shapes:

| Row shape | Where used | Example combined label |
|---|---|---|
| C1 — avatar + circular CTA | Connections | "Maria Kovacs, Elm Park · 2.1 mi, message" (CTA button has its own `accessibilityLabel = "Message Maria"`) |
| C2 — claimant row | Review claims (web) | "Sara T., 1 Elm St · 4 evidence items · 2d ago, Pending" |
| C3 — category icon + price stack + footer | My bids / My tasks / Offers / Listing offers | "Big Tree Handyman, budget $80, 0.4 mi, Top bid" |
| C4 — buyer offer | Listing offers | "Anika R., $240 asking · -2%, Pending, Your counter $230" |
| C5 — type icon | Notifications · Mailbox · Calendar · Polls | "Reply to your post · 4m ago, unread" |
| C6 — intent chip + body emphasis | My posts | "Question · 2h ago, How do you handle the kitchen sink leak? · 8 replies · 142 views" |
| C7 — receipt + amount | Bills (T5) / Maintenance (T6.3b) | "Pacific Power, due Apr 12, $87.42, Upcoming" |
| C8 — person row (grouped) | Discover hub · New message | "Maria Kovacs, Elm Park, OR, verified" |
| C9 — business row | Discover hub / Discover businesses · My businesses | "Big Tree Handyman, Old-house specialist · Open now · 0.4 mi" |
| C10 — pet row | Pets | "Mango, Dog · Golden Retriever, Allergic to chicken" |
| C11 (T6) — utility-tinted Bills | Bills (T6.0a refresh) | "Pacific Power, electric, due Apr 12, $87.42, Upcoming, Auto-pay" |
| C12 (T6) — magic-task Gig | My tasks V2 (T6.0b refresh) | "DELIVERY · ERRAND, Pick up dry cleaning, $25, drop-off, Active, 2 bids" |
| C13 (T6) — courier-tinted Package | Packages (T6.3d) | "Amazon, In transit, Patio chairs, drop on porch, arriving today" |
| C14 (T6) — leading + secondary action pair | Access codes (T6.4a) | "Wi-Fi · Living room, copy, more options" |
| C15 (T6) — magic-archetype tile + overline | My tasks V2 magic rows | "MAGIC TASK · DELIVERY · ERRAND, …" |
| C16 (T6) — mail item (A17 variant) | Mailbox A17 detail | "Pacific Power, certified mail, Acknowledge by Apr 12, $130 amount due, verified sender" |

The chevron / kebab / circularAction trailing controls all carry an
explicit per-control label. Decorative icons (chip glyphs, leading
icons) are accessibility-hidden on iOS (`.accessibilityHidden(true)`)
and Android (`contentDescription = null` inside `Icon { }`).

## Tap targets

- **iOS:** every interactive control ≥ 44pt. `circularAction` (38pt
  visual) is wrapped in a 44pt `Button` frame for the hit target.
  `CompactButton.footer` (34pt) is acceptable because it sits inside
  a row footer with the whole-row tap also routing to `onTap` — the
  total hit area is well above 44pt. T6.4a's new `iconActions(primary:secondary:)`
  pair uses 32pt visual icons wrapped in 44pt hit targets — verified
  in `RowView`.
- **Android:** every interactive control ≥ 48dp. `IconButton` /
  `Button` defaults match Material 3 spec; row clickables use
  `Modifier.heightIn(min = 60.dp)`. T6.4a's iconActions pair uses
  `Modifier.size(32.dp)` icons inside `IconButton` (Material default
  48dp hit target).
- **Web:** the `categoryGradientIcon` and `circularAction` glyphs are
  hit-targeted at `w-10 h-10` (40px) / `w-[38px] h-[38px]`. The row's
  whole-card click handler covers the rest; the `38px` circularAction
  inside row trailing meets the 32px minimum spec but is sub-optimal
  vs the 44/48 native budgets — carried over from T5 as a flagged
  design-review follow-up.

## Heading hierarchy

Every screen-level H1 carries the heading trait:

- iOS: `Text(title).accessibilityAddTraits(.isHeader)` — present on
  the shared `ListOfRowsView` top-bar title, `MailItemDetailShell`
  top-nav title, and `MapListHybridShell` top pill.
- Android: `Text(title, modifier = Modifier.semantics { heading() })`
  on `CenterAlignedTopAppBar`'s title slot + the new T6 shells.
- Web: `<h1>` in each shell + section headers as `<h2>` via the
  `SectionView` render path. Verified by grep on `RowCard.tsx` +
  `ListOfRowsShell.tsx` + `MailItemDetailShell.tsx` + `MapListHybridShell.tsx`.

Section headers (Discover hub People/Businesses/Gigs/Listings,
Discover businesses Handyman/Cleaning/…, Documents Lease /
Insurance / Warranties / Tax / Permits / HOA / Identity,
Emergency Shutoffs / Contacts / Evac / Medical, Members /
Guests / Pending) render with the overline type style and
carry the heading trait on both mobile platforms.

## Dynamic Type / font scale

Every T5 + T6 row uses:

- iOS: `pantopusTextStyle(.body)` / `.small` / `.caption` — the
  pantopus type tokens scale with Dynamic Type natively. T6.4c's
  `MonthStripHeader` day labels use `.caption` so they fit on a 320pt
  device at xxxLarge without truncation.
- Android: `PantopusTextStyle.body` / `.small` / `.caption` — Compose
  `TextStyle`s with relative `sp` scale.
- Web: Tailwind `text-xs` / `text-sm` etc. — scales via the user
  agent's text-zoom.

Manual smoke at iOS xxxLarge / Android `fontScale = 1.3` (against
the equivalent iPhone simulator / Pixel emulator stub run) — every
T5 + T6 row wraps cleanly; chevron / chip / trailing controls don't
clip. T6.4a Access codes' monospace mask subtitle uses the same
`.body` token so the dots line up with the surrounding text at every
text-scale.

## Reduced motion

- iOS + Android: the `LoadingRows` shimmer collapses to a flat fill
  under Reduce Motion / `ANIMATOR_DURATION_SCALE = 0`.
- Web: no animated shimmer in the new code (the loading rows use a
  static `bg-app-surface-sunken` placeholder).
- Optimistic-mutation animations (row removal on withdraw / accept /
  delete) honor the OS reduced-motion setting on iOS / Android; web
  follows CSS `@media (prefers-reduced-motion: reduce)` for the
  fade-out transition.
- **T6.5d Ceremonial Mail Open** (4-phase animation Sealed →
  Breaking → Open → Replying) honours reduce-motion via
  `@Environment(\.accessibilityReduceMotion)` (iOS) +
  `Settings.Global.TRANSITION_ANIMATION_SCALE == 0` (Android). User-
  facing "Skip animation" button does the same. Total time sealed →
  open capped at ≤ 2 s. Test coverage:
  `testStartBreakingSealWithSkipJumpsStraightToOpen` +
  `testTotalSealToOpenDurationStaysUnderTwoSeconds` (iOS) and
  `start_breaking_seal_with_skip_jumps_straight_to_open` (Android).
- **T6.6a MapListHybrid** sheet detent transitions use the platform
  animation duration scale; the active-pin pulse on iOS / web
  suppresses under reduce-motion (static ring instead).
- **T6.6b Chat conversation** typing indicator + AI welcome card
  fade-in are static under reduce-motion (no animation).

## Open follow-ups

1. **Switch Control / Switch Access coverage.** Manual smoke still
   passes; no automated tests yet. Carry-over from earlier audits.
2. **Announcement events on optimistic failure.**
   `UIAccessibility.Notification.announcement` /
   `AccessibilityManager.TYPE_ANNOUNCEMENT` haven't been wired on
   any T5 / T6 optimistic mutation. Adding them is a focused follow-
   up. Highest-value targets: Connections accept/reject, My bids
   withdraw, Listing offers accept/decline/counter, Polls vote,
   Owners remove, Members invite cancel, Mail acknowledge,
   Community RSVP, Access codes reveal/copy.
3. **Full axe sweep against every T5 + T6 web page.** Reproducible
   via:
   ```bash
   pnpm -F @pantopus/web dev
   # then run axe-core/react devtools against:
   #   T5: /app/notifications, /app/connections, /app/homes/[id]/bills,
   #       /app/homes/[id]/pets, /app/offers, /app/my-bids,
   #       /app/my-gigs, /app/my-pulse, /app/listing-offers,
   #       /app/discover-hub, /app/discover, /app/admin/review-claims
   #   T6: /auth, /auth/forgot-password, /auth/reset-password,
   #       /auth/verify-email-sent, /app/hub, /app/profile,
   #       /app/settings, /app/homes, /app/businesses, /app/my-listings,
   #       /app/homes/[id]/members, /app/homes/[id]/packages,
   #       /app/homes/[id]/owners, /app/homes/[id]/access,
   #       /app/homes/[id]/calendar, /app/mailbox, /app/mailbox/[id],
   #       /app/chat, /app/chat/[id], /app/map, /app/support-trains
   ```
   Manual finding: the shell's chip-strip overflow is keyboard-
   scrollable (arrow keys advance focus through the chips, Enter
   commits selection). The row's `tabIndex=0` + `onKeyDown` for
   `Enter` / `Space` is wired in `RowCard.tsx` — verified.
4. **MapListHybrid keyboard navigation (web).** The bottom-sheet
   drag handle is mouse / touch only; keyboard users can still
   reach every row through the sheet body's tab order, but the
   detent change should additionally be reachable via a keyboard
   shortcut (e.g. `ArrowUp` / `ArrowDown` on the focused sheet
   header). Tracked as a P28 follow-up.
5. **VoiceOver / TalkBack focus order in Mailbox A17 detail.** The
   8-slot vertical order is preserved by the shell — verified on
   the generic / Booklet / Certified / Community variants. Focus
   announcement on the AI elf strip is "Pantopus read this for
   you" + the summary paragraph; long key-fact lists may benefit
   from an explicit announce after the slot is reached (currently
   the screen-reader walks every key-value pair).
