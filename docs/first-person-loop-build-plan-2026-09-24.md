# First-person loop — build plan

**Date:** 24 Sep 2026. **Checked against:** `origin/master` `630bc49b5`. Every file path in this plan resolves on that
commit (0 unresolved).
**Reads with:** the design doc [`first-person-loop-design-2026-09-16.md`](first-person-loop-design-2026-09-16.md)
(what to build and why), the founder checklist [`NEXT_STEPS.md`](../NEXT_STEPS.md), the Claude Design
[prompt pack](https://claude.ai/artifact/FukRC9qWmAVRUomVC53F1B), the exported designs in `docs/design/exports/`,
and the settled rulings in [`docs/design/foundations/README.md`](design/foundations/README.md).

---

## 0. What this is, and what it is not

This is a **map**: one row per design, giving its feature, the backend work it waits on, the exact files it changes
on each platform, and the order to build it in. It is written so the coordinator can pull a slice into a stream.

It is **not a tracker**. Progress stays where it already lives: `NEXT_STEPS.md` for the loop, and each stream's
status file and the coordination hub for work in flight (AGENTS.md: no duplicate tracking systems).

Per the founder's 23 Sep direction, **new tables and large new features go to the coordinator** before a stream
starts them. Every slice below marks its escalation points with **Escalate**.

---

## At a glance — new screens vs changes to current screens

Every design is exported as finished HTML in `docs/design/exports/<prompt-id>/`. Of the 59:

| What it is | Count | What building it means |
| --- | --- | --- |
| **New screen** | 5 | A new route or view on each platform |
| **New sheet** | 10 | A new sheet or modal over an existing screen |
| **New widget** | 2 | New home-screen widget code (iOS and Android) |
| New part in a current screen | 14 | Add a card, row or section to a screen that ships |
| Redesign of a current screen | 26 | Change a screen that ships, in place |
| Copy change on a current screen | 2 | Change wording only |

**17 are new** (screens, sheets, widgets) and **42 change something that already ships**.

Two platform exceptions: `f9-block-founders-panel` and `f9-invite-rewards-card` are redesigns on iOS and Android but **new on web**, which has no Block Founders or referral UI today. `f3-bill-detail-web` is a new screen on web only; iOS and Android already have a bill detail.

Where a prompt's own "TYPE" line disagrees with the label here, the label here is what gets built. For example, the pickup card's prompt says NEW because it draws the card from scratch, but the card goes into the current Today screen.


### New screens — 5

Screens that do not exist in the app today. Built from scratch, with a new route or view on each platform listed.

| Design | Name | Platforms | Slice | Finished design |
| --- | --- | --- | --- | --- |
| `x-place-file` | Your place file | Web/iOS/Android | 4 | `docs/design/exports/x-place-file/` |
| `f3-bill-detail-web` | Bill detail (new web route) | Web | 7 | `docs/design/exports/f3-bill-detail-web/` |
| `f8-compare-reveal` | Compare reveal (a third funnel step) | Web | 8 | `docs/design/exports/f8-compare-reveal/` |
| `f10-extraction-confirm` | Confirm what we read (extraction review) | Web/iOS/Android | 12 | `docs/design/exports/f10-extraction-confirm/` |
| `f10-mail-day-triage` | Mail Day triage (snap-aware) | Web/iOS/Android | 12 | `docs/design/exports/f10-mail-day-triage/` |

### New sheets — 10

New bottom sheets or modals that open over an existing screen.

| Design | Name | Platforms | Slice | Finished design |
| --- | --- | --- | --- | --- |
| `x-provenance-sheet` | Where this fact comes from (provenance sheet + "This isn't right") | Web/iOS/Android | 2 | `docs/design/exports/x-provenance-sheet/` |
| `f1-add-place-sheet` | Add a place (signed-in address search + save) | Web/iOS/Android | 3 | `docs/design/exports/f1-add-place-sheet/` |
| `f4-notification-primer` | Notification permission primer | iOS/Android | 5 | `docs/design/exports/f4-notification-primer/` |
| `x-date-sheet` | The Date sheet (one sheet, three modes, ten kinds) | Web/iOS/Android | 6 | `docs/design/exports/x-date-sheet/` |
| `f3b-owner-attestation` | Confirm this person lives here (owner attestation) | Web/iOS/Android | 7 | `docs/design/exports/f3b-owner-attestation/` |
| `f3b-verify-address-sheet` | Verify this address (one sheet, many callers) | Web/iOS/Android | 7 | `docs/design/exports/f3b-verify-address-sheet/` |
| `f8-compare-sheet` | Compare with a friend (mint + consent) | Web | 8 | `docs/design/exports/f8-compare-sheet/` |
| `f7-widget-howto-sheet` | Add the widget (how-to, with a live preview) | iOS/Android | 10 | `docs/design/exports/f7-widget-howto-sheet/` |
| `f10-snap-capture-tray` | Snap capture tray (batch session) | Web/iOS/Android | 12 | `docs/design/exports/f10-snap-capture-tray/` |
| `f11-keeper-naming` | Give your place a keeper (naming) | Web/iOS/Android | 13 | `docs/design/exports/f11-keeper-naming/` |

### New widgets — 2

Home-screen widget and its gallery entry (iOS and Android only).

| Design | Name | Platforms | Slice | Finished design |
| --- | --- | --- | --- | --- |
| `f7-today-widget` | Today at your address (home-screen widget, three sizes) | iOS/Android | 10 | `docs/design/exports/f7-today-widget/` |
| `f7-widget-gallery` | Widget gallery entry (name, description, preview) | iOS/Android | 10 | `docs/design/exports/f7-widget-gallery/` |

### New parts inside current screens — 14

A new card, row or section added to a screen that already ships. The rest of that screen stays as it is.

| Design | Name | Platforms | Slice | Finished design |
| --- | --- | --- | --- | --- |
| `f4-briefing-optin-card` | Briefing opt-in (morning + night-before, one card) | Web/iOS/Android | 5 | `docs/design/exports/f4-briefing-optin-card/` |
| `f4-today-pickup-card` | Tomorrow's pickup card (push landing + confirm/correct) | Web/iOS/Android | 5 | `docs/design/exports/f4-today-pickup-card/` |
| `f5-today-calendar-strip` | Next 14 days at this address (strip + rows) | Web/iOS/Android | 6 | `docs/design/exports/f5-today-calendar-strip/` |
| `f3-household-block` | Who lives here with you (household block) | Web/iOS/Android | 7 | `docs/design/exports/f3-household-block/` |
| `f3-invite-banner` | Invitations waiting for you (landing banner) | Web/iOS/Android | 7 | `docs/design/exports/f3-invite-banner/` |
| `f3b-locked-action-row` | Address verification needed (the locked-action treatment) | Web/iOS/Android | 7 | `docs/design/exports/f3b-locked-action-row/` |
| `f8-compare-arrival-header` | Compare arrival header on /start | Web | 8 | `docs/design/exports/f8-compare-arrival-header/` |
| `f8-scale-strips` | The four-layer reading instrument (scale strips) | Web/iOS/Android | 8 | `docs/design/exports/f8-scale-strips/` |
| `f6-place-section-details` | Place section details: risk instrument, free radon kits, registration deadline | Web/iOS/Android | 9 | `docs/design/exports/f6-place-section-details/` |
| `f9-invite-rewards-card` | Invite rewards (what a join actually pays) | Web/iOS/Android | 11 | `docs/design/exports/f9-invite-rewards-card/` |
| `f10-bill-provenance` | Bill provenance block (from a photo you took) | Web/iOS/Android | 12 | `docs/design/exports/f10-bill-provenance/` |
| `f10-bill-trend` | Bill trend vs the going rate | Web/iOS/Android | 12 | `docs/design/exports/f10-bill-trend/` |
| `f10-mail-snap-privacy` | Mail snaps: privacy and storage | Web/iOS/Android | 12 | `docs/design/exports/f10-mail-snap-privacy/` |
| `f11-keeper-strip` | Keeper strip on Today | Web/iOS/Android | 13 | `docs/design/exports/f11-keeper-strip/` |

### Redesigns of current screens — 26

Screens that already ship and change. Edit the existing screen file in place; never add a parallel screen.

| Design | Name | Platforms | Slice | Finished design |
| --- | --- | --- | --- | --- |
| `f9-curator-chip` | From Pantopus chip + 'Why am I seeing this?' | Web/iOS/Android | 1 | `docs/design/exports/f9-curator-chip/` |
| `f9-earn-removal` | Earn entries removed + a calm landing for old links | Web/iOS/Android | 1 | `docs/design/exports/f9-earn-removal/` |
| `f9-founding-meter-preview` | Founding slots meter in the address preview (honest, fails closed) | Web/iOS/Android | 1 | `docs/design/exports/f9-founding-meter-preview/` |
| `f9-privacy-mirror` | What neighbors see (user-scoped, with 'Where your posts appear') | Web/iOS/Android | 1 | `docs/design/exports/f9-privacy-mirror/` |
| `f1-claim-receipt` | Claimed — what came with you | Web/iOS/Android | 3 | `docs/design/exports/f1-claim-receipt/` |
| `f1-email-verify-handoff` | Email verification handoff carrying the held address | Web | 3 | `docs/design/exports/f1-email-verify-handoff/` |
| `f1-save-confirmation` | Saved — Today now uses this address | Web/iOS/Android | 3 | `docs/design/exports/f1-save-confirmation/` |
| `f1-today-air-band` | Air quality band (and the alert landing) | Web/iOS/Android | 3 | `docs/design/exports/f1-today-air-band/` |
| `f1-today-tab` | Today (one composition, both payloads) | Web/iOS/Android | 3 | `docs/design/exports/f1-today-tab/` |
| `f1-your-places` | Your places (and which one Today uses) | Web/iOS/Android | 3 | `docs/design/exports/f1-your-places/` |
| `f4-notification-settings` | Notifications settings (one switch per kind) | Web/iOS/Android | 5 | `docs/design/exports/f4-notification-settings/` |
| `f3-bills-list` | Bills list (member read-only + payer attribution) | Web/iOS/Android | 7 | `docs/design/exports/f3-bills-list/` |
| `f3-household-calendar` | Household calendar | Web/iOS/Android | 7 | `docs/design/exports/f3-household-calendar/` |
| `f3-household-notifications` | Household activity notifications (rows, channel, routing) | Web/iOS/Android | 7 | `docs/design/exports/f3-household-notifications/` |
| `f3-invite-composer` | Invite someone to your household | Web/iOS/Android | 7 | `docs/design/exports/f3-invite-composer/` |
| `f3-member-home-dashboard` | Home dashboard, member view | Web/iOS/Android | 7 | `docs/design/exports/f3-member-home-dashboard/` |
| `f3-members-roster` | Members roster | Web/iOS/Android | 7 | `docs/design/exports/f3-members-roster/` |
| `f3b-invitation-decision` | Invitation decision (what you get now vs what needs verification) | Web/iOS/Android | 7 | `docs/design/exports/f3b-invitation-decision/` |
| `f8-native-share-compare` | Share + compare actions on the native address preview | iOS/Android | 8 | `docs/design/exports/f8-native-share-compare/` |
| `f8-og-compare-card` | Compare share card (OG image) | Web | 8 | `docs/design/exports/f8-og-compare-card/` |
| `f8-seasonal-aha` | Rotating seasonal aha card | Web/iOS/Android | 8 | `docs/design/exports/f8-seasonal-aha/` |
| `f6-home-basics-rows` | Home basics: move-in date + restore the moving checklist | Web/iOS/Android | 9 | `docs/design/exports/f6-home-basics-rows/` |
| `f7-widget-tap-landing` | Widget tap landing (attribution + forced refresh) | iOS/Android | 10 | `docs/design/exports/f7-widget-tap-landing/` |
| `f9-block-founders-panel` | Block Founders (rank vs tier, slot meter, postcard allowance) | Web/iOS/Android | 11 | `docs/design/exports/f9-block-founders-panel/` |
| `f9-nearby-cells-map` | Cells map detail (3-join unlock, split counts) | Web/iOS/Android | 11 | `docs/design/exports/f9-nearby-cells-map/` |
| `f10-mail-piece-photo` | Photographed mail piece (the record, and the photo viewer) | Web/iOS/Android | 12 | `docs/design/exports/f10-mail-piece-photo/` |

### Copy changes on current screens — 2

Wording only; no layout change.

| Design | Name | Platforms | Slice | Finished design |
| --- | --- | --- | --- | --- |
| `f9-verification-promise-copy` | Verification promise lists (one name per thing, no withdrawn fee promise) | Web/iOS/Android | 1 | `docs/design/exports/f9-verification-promise-copy/` |
| `f8-positioning-copy` | Positioning line and contrast line in the hero | Web/iOS/Android | 8 | `docs/design/exports/f8-positioning-copy/` |

---

## 1. Rules for building from the designs

1. **Presentation comes from the design, behaviour and data come from the design doc.** Where a design shows
   something no endpoint returns, the design doc's backend section decides what gets built; the design decides only
   how it looks. The prompt (`docs/notes/prompts-final/<id>.md`) carries the exact copy, states and accessibility
   spec the drawing only implies, so read the prompt with the export.
2. **Extend in place.** 39 of the 59 designs change a screen that already ships. Change that screen's file (Appendix
   A names it); never add a parallel screen. The founder accepting a design in Claude Design is the approval
   AGENTS.md asks for; the build PR should link the export and say so.
3. **Foundations before screens.** Every screen is assembled from the 36 shared components (§3). Building a screen
   before its components exist means drawing them ad hoc, which is exactly the drift the Foundations prevent.
4. **Verify end to end on all three platforms**, through the real caller, API and persistence, and compare against
   the exported artboards (`tools/export-render/render-frames.mjs` renders them). No new unit tests (founder, 23 Sep):
   the per-feature test lists in the design doc predate that direction. Update an existing test only when a change
   intentionally alters what it asserts.
5. **Read the token, never the hex.** The AA-corrected palette, three themes (Light, Dark, Dark · iOS),
   `radius-2xl` for cards and sheets, and `primary.700` for buttons and links are settled
   (`docs/design/foundations/README.md`).

---

## 2. Where things stand on master

### Backend: almost none of F1–F12 is built

Checked by searching `origin/master` for each feature's defining change:

| Feature | Defining change | On master |
| --- | --- | --- |
| F1 | `resolveLocation` reads `SavedPlace`; save upserts prefs and clears the hub cache | not built |
| F2 | setup checklist re-keyed (`pickup_day`, `important_date`, `household`) | not built |
| F3 | `member` role gets `members.view`, `calendar.view`, `calendar.edit`, `finance.view`; `bill_paid`, `task_completed`, `home_event_created` notifications; received invitations rendered | not built (`getHomeInvitations()` still has zero callers on web) |
| F3b | `HomeOccupancy.verification_source` | not built |
| F4 | tomorrow-pickup evening signal; evening interrupt gate | not built |
| F5 | new date kinds; `saved_place` calendar scope | not built |
| F6 | `just_moved_done`; election-deadline seeds | not built |
| F7 | Today widget, iOS and Android | not built (only "Tasks near me" exists) |
| F8 | signed compare token; `t0_compare_viewed`, `session_open` | not built |
| F10 | `extractMailFromImage` | not built |
| F11 | keeper | not built |
| F12 | `tax_appeal` seeds | not built |

### F9 hygiene: still open in source

Source inspection, not a reproduced defect:

- **Coordinate leak.** `applyPostLocationPrivacy` now uses keyed jitter, but through `applyLocationPrecision`, which
  rewrites only `latitude`/`longitude`. `backend/services/feedService.js:199` still copies `effective_latitude` and
  `effective_longitude` through verbatim, so non-authors appear to receive raw coordinates. Confirm with the existing
  post-privacy contract test before repairing.
- **Founding label fails open.** `backend/routes/public.js:557` still defaults to `true` on a failed lookup.
- **Cash Earn still shown.** `backend/routes/hub.js` pushes the `inbox_offers` "Earn today" item with no
  `EarnTransaction` gate.
- **Seeder engagement prompt** still present at `pantopus-seeder/src/pipeline/humanizer.py:51`.
- **Curator `origin`** is not declared on the web `Post` type or the native DTOs.

### Designs

All 59 screens and 14 journeys are exported to `docs/design/exports/<id>/`. Sessions 1–2 (17 screens) are verified
in [`docs/design/exports/VERIFICATION.md`](design/exports/VERIFICATION.md), several with a fix pass still open.
Sessions 3–7 (42 screens) and all journeys are exported but not yet verified. Appendix A gives the status per design.
**Verify a design before building from it**; the fix passes are drawing defects, but some touch substance
(for example "Sam's view provenance wrong" on the place file).

### Corrections to the design doc's code facts

- Android **does** have a saved-places client (`data/api/services/SavedPlacesApi.kt`, `ui/screens/saved_places/`).
  F1's 3-day Android estimate was for building one; drop it.
- `backend/services/homePermissions.js` is at `backend/utils/homePermissions.js`, and `usefulnessEngine.js` is at
  `backend/services/context/usefulnessEngine.js`.
- Web already ships `components/home/BillTrendChart.tsx`, so the bill-trend design extends it.
- Web has no Block Founders or referral UI; the natives do. Those two designs are new on web.
- The founder's 22 Sep rulings change F1: **the claimed home always drives Today**, and the viewing-location and
  device-location modes retire. The design doc's `saved_place` step still applies to people with no home.

---

## 3. Phase 0 — the 36 Foundations components in code

Build these first, once per platform, from the handoff packs in `docs/design/foundations/`: props, variant and state
keys, tokens, contrast, and the rules each must enforce in code.

| Board | Components | Web | iOS | Android |
| --- | --- | --- | --- | --- |
| 00a Marks, captions, chips | ProvenanceMark, SourceCaption, ScopeChip, FreshnessLine, OfflineNotice, StatusChip, KindGlyph, AddressChip, ChoiceChip | `components/archetypes/primitives/` (ProvenanceMark, SourceCaption, FreshnessLine next to `archetypes/place/primitives.tsx`) | `Core/Design/Components/` | `ui/components/` |
| 00b Data instruments | ScaleStrip, AqiBand, FourteenDayStrip, YearBand, SlotMeter, PublicPointMap, FactCount | same | same | same |
| 00c Rows and lists | DateRow, FactRow, FirstWeekRow, BillRow, MemberRow, InviteRow, NotificationRow, TextActionRow, LockedActionRow, GrantLimitList, InlineErrorRow, ThumbnailRail | same | same | same |
| 00d States and asks | QuietDayReceipt, WarmingSkeleton, InlineUndo, DestructiveConfirm, LandingBannerSlot, NotificationAsk, PushCopy, ReminderLeadControl | same | same | same |

**Order inside Phase 0.** 00a first: the other boards embed its marks and chips. Then 00b and 00c, then 00d, which
reuses 00c's rows (`NotificationRow`, `InlineErrorRow`, `TextActionRow`) and 00a's `ChoiceChip`.

**Three migrations to sequence first.** Two implementations of the same row diverge, so these replace shipped ones
rather than sit beside them (`docs/design/foundations/00c/HANDOVER.md` §3):
`BillRow` over `StatusChipRow`, `MemberRow` over `AvatarKebabRow`, and `FirstWeekRow` over `ProgressSegments`
(never on the same surface). The other overlaps ship side by side: the Foundations version governs whatever the pack
draws or changes, the shipped one everything else.

**Extend, don't duplicate** (00d reconciliation): `WarmingSkeleton` extends `ShimmerLine` and `ShimmerBlock`,
`DestructiveConfirm` extends `BottomSheet` with a non-dismissible path, and the lead and time chips are `ChoiceChip`.
The one genuinely new component is `OperationProgress` (the deleting bar).

**Making the design-system cards code-generated.** Once a component exists in the web components folder, the
`tools/design-system` build regenerates its card: re-export it from `tools/design-system/src/entry.tsx`, add a
guideline at `content/components/<Name>.md` and a preview in `content/previews.mjs`. That replaces the 36
hand-published cards and closes the risk of a rebuild dropping their section links.

---

## 4. The slices, in build order

The order follows the design doc §6, with the shared sheets pulled forward because nine screens embed them.
For each slice: the backend work, what to escalate, the designs, what it depends on, and when it is done.
Appendix A has the exact files per design.

### Slice 1 — F9 hygiene · `NEXT_STEPS.md` §1 · ship before inviting anyone

- **Backend:** coordinate leak in `backend/services/feedService.js` (rewrite `effective_*` for non-authors, after the
  distance calculations at the call sites that read them); founding fail-closed in `backend/routes/public.js:557`
  and the `foundingOpen = true` defaults in `backend/services/placePreviewService.js`; Earn gate in
  `backend/routes/hub.js`; seeder prompt lines in `pantopus-seeder/src/pipeline/humanizer.py`; curator exclusion
  from organic counts; referral tier rewards in `backend/services/blockFoundersService.js` and
  `backend/services/inviteRewardService.js`.
- **Escalate:** none for the fixes themselves. The privacy mirror becoming user-scoped needs its API to accept a
  saved place.
- **Designs:** `f9-privacy-mirror`, `f9-curator-chip`, `f9-earn-removal`, `f9-verification-promise-copy`,
  `f9-founding-meter-preview`.
- **Done when:** a non-author never receives `effective_*` at full precision on list, map, saved posts or post
  detail; a failed founding lookup shows no slot line; someone who never earned sees no Earn entry and
  `pantopus://mailbox/earn` lands on the mailbox.

### Slice 2 — Shared sheets · needed by nine screens

- **Backend:** `ProvenanceSheet` reads existing source and as-of data. Its "This isn't right" report has **no
  endpoint or storage today**, and §5's honesty counter depends on it. `DateSheet`'s pickup kind works with the
  existing pickup routes; its other kinds wait on Slice 6.
- **Escalate:** the report endpoint and wherever reports are stored (**new table**).
- **Designs:** `x-provenance-sheet`, `x-date-sheet`.
- **Done when:** every source caption on Today and Place opens the sheet for its fact; a report is received,
  acknowledged with a check-by date, and its outcome shows in place (flow-11).

### Slice 3 — F1 save sets location · `NEXT_STEPS.md` §2

- **Backend:** `backend/services/context/locationResolver.js` — the claimed home always drives Today (founder,
  22 Sep); for someone with no home, the newest `SavedPlace` becomes a resolver source, confidence 0.60; retire the
  viewing-location and device-location modes. `backend/routes/savedPlaces.js` — on save, upsert
  `UserNotificationPreferences` and call `clearHubTodayCache`. **One Today:** emit the `address_calendar` section on
  the hub payload so every platform renders one composition (the web type union lacks `address_calendar`, which is
  why the pickup signal shows a Sparkles icon today). Persist the pending place server-side at registration, so email
  verification on another device keeps it.
- **Escalate:** retiring two location modes changes behaviour for existing users.
- **Designs:** `f1-today-tab`, `f1-today-air-band`, `f1-your-places`, `f1-add-place-sheet`, `f1-save-confirmation`,
  `f1-email-verify-handoff`, `f1-claim-receipt`.
- **Depends on:** Phase 0; Slice 2 for the source captions.
- **Done when:** a new account that saves a place sees weather, air, alerts and the seasonal card on Today in one
  request, with `location.source === 'saved_place'`; someone with a home is unaffected; removing the last saved place
  returns Today to "Today starts with a place" (flow-01, flow-14).
- **Note:** `f1-claim-receipt` needs a T1→T3 carry-over step that no migration provides today: saved-place dates,
  keeper and first-week ticks would otherwise be lost on claim.

### Slice 4 — F2 the place file and first week · `NEXT_STEPS.md` §2

- **Backend:** re-key the setup checklist in `backend/routes/hub.js` (`save_place`, `pickup_day`, `important_date`,
  `household`). Persist ticks and dismissals on the account (Slice 10's `just_moved_done` pattern; a user-preferences
  row at T1). The place file has no single endpoint: compose it from existing reads first.
- **Escalate:** none unless a place-file endpoint needs its own table.
- **Designs:** `x-place-file` — the Place tab's first screen (founder, 22 Sep). It absorbs `SetupBanner` and
  `JustMovedCard`, which today mount only after a home exists or on `/app/hub`, which is not a tab.
- **Done when:** someone with only a saved place sees the place file as the Place tab, with the first-week row and no
  completion fraction; the Address row opens Your places; with no place saved, Your places' empty state is the tab.

### Slice 5 — F4 night-before pickup and the conditional briefing · `NEXT_STEPS.md` §2

- **Backend:** `backend/services/context/eveningBriefingService.js` gains the tomorrow-pickup signal and the morning
  interrupt gate (`low_signal_day`); `backend/services/context/providerOrchestrator.js`; `alert_checker.py` includes
  saved-place users; `internalBriefing.js` reminder channel.
- **Escalate:** the evening gate reduces pushes for everyone. Announce it.
- **Designs:** `f4-today-pickup-card`, `f4-notification-primer`, `f4-briefing-optin-card`,
  `f4-notification-settings` (one switch per kind; each Nearby switch its own Android channel and iOS category).
- **Depends on:** Slice 3 (the pickup card lands on the one Today).
- **Done when:** with a pickup rule for tomorrow and the evening briefing on, one push arrives at the evening time with
  the pickup headline, carrying the unconfirmed caveat when the rule is `unverified`; a quiet day records
  `low_signal_day` and sends nothing; with notifications off, the same card is on Today (flow-02, flow-10).

### Slice 6 — F5 important dates · `NEXT_STEPS.md` §2

- **Backend:** one forward migration extending `AddressCalendarRule` kinds (`lease_end`, `lease_notice`,
  `insurance_renewal`, `warranty_end`, `hoa_dues`, `tax_appeal`), adding the `saved_place` scope with its partial
  unique index, and widening `lead_days` to 0–60; saved-place calendar routes; `PUT /api/homes/:id/calendar/dates/:kind`;
  `backend/services/addressCalendarService.js` (`SCOPE_RANK` needs `saved_place`, `hasHouseholdPickup` must match
  it); `home_reminders.py` date pass with lead, day-before and day-of reminders.
- **Escalate:** schema change (new kinds, new scope, widened constraint).
- **Designs:** `f5-today-calendar-strip` (and the rest of `x-date-sheet`).
- **Depends on:** Slices 2 and 3.
- **Done when:** someone with only a saved place sets a pickup day and a lease date and sees both on Today; reminders
  fire at the lead, the day before and the day of, once each (flow-03).

### Slice 7 — F3 household, with F3b verification source · `NEXT_STEPS.md` §2

- **Backend:** forward migration adding `member` permissions (`members.view`, `calendar.view`, `calendar.edit`,
  `finance.view`), following `20260912050000_home_member_task_defaults.sql`; `bill_paid`, `task_completed` and
  `home_event_created` notifications in `backend/routes/home.js` and `backend/services/notificationService.js`;
  **F3b** `HomeOccupancy.verification_source` (`address` | `household` | `legacy`) with the gate in
  `backend/utils/homePermissions.js` and the writers in `occupancyAttachService.js` and `act_on_home_invitation`.
  Ship F3b with F3, so the easier invite never widens attested unlocks.
- **Escalate:** permission policy (member defaults, and pending invites returning `INVITE_POLICY_CHANGED`); security
  policy (verification source and the attested-surface gate).
- **Designs:** `f3-members-roster` (replaces the Invite button that routes to `add-guest`, which makes no API call and
  toasts success), `f3-invite-composer`, `f3-invite-banner`, `f3b-invitation-decision`, `f3b-verify-address-sheet`,
  `f3b-owner-attestation`, `f3b-locked-action-row`, `f3-household-block`, `f3-member-home-dashboard`,
  `f3-household-calendar` (the web page exists; give it an entry point), `f3-bill-detail-web` (new route),
  `f3-bills-list` (fix the `cancelled`/`canceled` delete status), `f3-household-notifications`.
- **Also:** Android `core/routing/DeepLinkRouter.kt` sends every new `/homes/:id` link to the dashboard; add the bills,
  calendar and privacy branches here.
- **Done when:** an invited member lists co-residents, edits the calendar and reads bills with no role change; marking
  a bill paid produces exactly one `bill_paid` per other verified member; a household-verified member cannot mint a
  residency letter or message neighbours until they verify the address (flow-04, flow-12).
- **Open question to settle first:** does any verification method accept a non-owner occupant on a home someone else
  has already claimed? If not, owner attestation is a prerequisite for F3b.

### Slice 8 — F8 compare card and seasonal headline · `NEXT_STEPS.md` §3

- **Backend:** `POST /api/public/compare-card` and `GET /api/public/compare-card/:token` with an HMAC keyring following
  `backend/utils/homePostcardCodeMaterial.js` (env `COMPARE_CARD_KEYS_JSON`); `pickAha` gains the seasonal headline
  in `backend/services/placePreviewService.js`; `cellFoundingWindow` exposes `{open, slots_open, ends_at}`;
  funnel migration adding `t0_compare_viewed` and `session_open`; `funnelEvents.js` and `funnelReport.js`.
- **Escalate:** token signing and keys (security); the funnel CHECK migration.
- **Designs:** `f8-scale-strips`, `f8-compare-sheet`, `f8-compare-arrival-header`, `f8-compare-reveal` (new funnel
  step), `f8-og-compare-card`, `f8-native-share-compare`, `f8-seasonal-aha`, `f8-positioning-copy`.
- **Note:** the compare instrument shows each hazard on its authority's own scale, replacing the design doc's letter
  grades. The token payload changes accordingly.
- **Done when:** a compare link opened in a fresh browser shows the sender's column and, after an address, both
  columns and the recipient's aha, with `t0_compare_viewed` and `t0_aha_viewed` sharing an `anon_id`; a tampered token
  shows the expired banner; the OG image without `vs` is unchanged (flow-05).
- **Measurement gap:** neither native app emits funnel events today, so the pilot's spread metric is web-only until
  they do.

### Slice 9 — F6 just moved, move-in date and civic · `NEXT_STEPS.md` §2

- **Backend:** migration adding `HomeOccupancy.just_moved_done` and `just_moved_dismissed_at`;
  `PATCH /api/homes/:id/just-moved`; a move-in date is never collected today, so add it; the place-sections route
  must accept a saved place (founder, 23 Sep); state-scoped `election_deadline` seed rows (`unverified` until checked).
- **Escalate:** schema; the seeded deadlines' accuracy (legal).
- **Designs:** `f6-home-basics-rows`, `f6-place-section-details`.
- **Done when:** ticks made on web appear on iOS; the voter step shows the seeded deadline for the home's state with
  its source, and never claims to know registration status (flow-13).

### Slice 10 — F7 widgets · `NEXT_STEPS.md` §4

- **Backend:** none. Both apps write a snapshot the widget reads; widgets never call the API.
- **Escalate:** none.
- **Designs:** `f7-today-widget`, `f7-widget-gallery`, `f7-widget-howto-sheet`, `f7-widget-tap-landing`.
- **Note:** `WidgetSnapshotStore` is hard-typed to the gig snapshot on both platforms. iOS parses `src=widget` but
  drops it, and Android does not parse it.
- **Done when:** after one Today open, the widget shows pickup, air and next date; a day later "tomorrow" becomes
  "today" without opening the app; with no place, the placeholder shows (flow-07).

### Slice 11 — Pilot surfaces · Nearby

- **Designs:** `f9-nearby-cells-map`, `f9-block-founders-panel`, `f9-invite-rewards-card` (the last two are new on web).
- **Depends on:** Slice 1's referral tier rewards.

### Slice 12 — F10 mail snap · `NEXT_STEPS.md` §6 · after the pilot's first read

- **Backend:** multipart image on `POST /api/mailbox/v2/mailday/items` (`backend/routes/mailDay.js`);
  `agentService.extractMailFromImage`; the `pay` action creating a `HomeBill`; `composeForHome` merging unpaid bills.
- **Escalate:** storing bill photos (privacy, retention period — no sourced default exists).
- **Designs:** `f10-mail-day-triage` (new on web; wires the natives' no-op "Scan today's stack"),
  `f10-snap-capture-tray`, `f10-extraction-confirm`, `f10-mail-piece-photo`, `f10-bill-provenance`,
  `f10-bill-trend` (extend web `BillTrendChart.tsx`), `f10-mail-snap-privacy`.
- **Done when:** photo, confirmed fields, bill on the calendar, reminder, marked paid, under Paid — on all three
  platforms, and the manual path completes the same journey with AI unavailable (flow-08).

### Slice 13 — F11 keeper · after the pilot

- **Backend:** mood computed in `GET /api/hub` from existing bills, tasks and calendar; storage in
  `HomePreference.settings` (and a saved-place equivalent). The hub's mail counts were broken and swallowed; confirm
  they are fixed before the mood reads them.
- **Escalate:** the illustration budget (species × moods × widget variants).
- **Designs:** `f11-keeper-strip`, `f11-keeper-naming`.
- **Done when:** the keeper's mood always derives from a record, never nags, and opens only from a tap (flow-09).

### Slice 14 — F12 appeal windows and radon kits

Data only (`tax_appeal` seeds for the largest counties; the per-state radon program map in
`backend/services/placeSectionAdapters.js`). No designs of its own; it feeds the Date sheet and the seasonal aha.

---

## 5. Migrations, in order

All forward-only, mirrored into both migration directories per the repo convention, each **escalated** before a stream
starts it:

1. Slice 6 — `AddressCalendarRule` kinds, `saved_place` scope and index, `lead_days` 0–60, user-preferences `settings`.
2. Slice 7 — `member` permission defaults; `HomeOccupancy.verification_source` with its backfill.
3. Slice 8 — `funnelevent_type_check` gains `t0_compare_viewed` and `session_open`.
4. Slice 9 — `HomeOccupancy.just_moved_done`, `just_moved_dismissed_at`; move-in date if not already a column.
5. Slice 2 — the report store behind "This isn't right" (shape to be decided).
6. Slices 9 and 14 — data-only seeds (`election_deadline`, `tax_appeal`).

The migration policy still applies: an unmerged branch's migrations must sort after master's newest.

---

## 6. Journeys: which slices each one proves

Use each storyboard as the end-to-end acceptance script for its slices, on all three platforms.

| Journey | Proves |
| --- | --- |
| flow-01 stranger to activated | Slices 3, 4, 5 |
| flow-02 weekly pickup loop | Slices 5, 6 |
| flow-03 lease date to reminder | Slice 6 |
| flow-04 invite a co-resident | Slice 7 |
| flow-05 compare card | Slice 8 |
| flow-06 saved place to claim | Slice 3 (claim receipt), Slice 6 (dates carried) |
| flow-07 widget | Slice 10 |
| flow-08 mail snap to paid | Slice 12 |
| flow-09 keeper first open | Slice 13 |
| flow-10 air alert for a saved place | Slice 5 |
| flow-11 "This isn't right" | Slice 2 |
| flow-12 dead invitation | Slice 7 |
| flow-13 mover's civic deadline | Slices 8, 9 |
| flow-14 web saver installs the app | Slices 3, 4 |

---

## Appendix A — every design, its slice and its files

Status comes from `docs/design/exports/VERIFICATION.md`. "What it is" matches the at-a-glance section; bold marks something new. Each design links to its finished HTML export. Paths are abbreviated: `web/` = `frontend/apps/web/src/`,
`ios/` = `frontend/apps/ios/Pantopus/`, `android/` = `frontend/apps/android/app/src/main/java/app/pantopus/android/`.
Slice codes: F9 = Slice 1, X = Slice 2 (shared sheets), P = Slice 11 (pilot).

| Slice | Design | What it is | Design status | Web | iOS | Android | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F9 | `f9-curator-chip`<br>[export](design/exports/f9-curator-chip/) | Redesign of a current screen | exported, not yet verified | `web/components/feed/PostCard.tsx` | `ios/Features/Feed/Pulse/PulsePostCard.swift` | `android/ui/screens/feed/pulse/PulsePostCard.kt` | Declare `origin` on web Post, iOS FeedPostDTO, Android FeedPostDto |
| F9 | `f9-earn-removal`<br>[export](design/exports/f9-earn-removal/) | Redesign of a current screen | exported, not yet verified | `web/components/mailbox/MailboxNav.tsx` | `ios/Features/Mailbox/Earn/EarnView.swift`<br>`ios/Features/Root/HubTabRoot.swift`<br>`ios/Features/Root/YouTabRoot.swift`<br>`ios/Core/Routing/DeepLinkRouter.swift` | `android/ui/screens/mailbox/earn/EarnScreen.kt`<br>`android/ui/screens/root/RootTabScreen.kt`<br>`android/core/routing/DeepLinkRouter.kt` | Gate is data-driven in backend/routes/hub.js (`inbox_offers`) |
| F9 | `f9-founding-meter-preview`<br>[export](design/exports/f9-founding-meter-preview/) | Redesign of a current screen | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` | WallBar lives in StartFunnel.tsx; backend/routes/public.js:557 must fail closed |
| F9 | `f9-privacy-mirror`<br>[export](design/exports/f9-privacy-mirror/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/privacy/page.tsx` | `ios/Features/Place/PlacePrivacyMirrorView.swift` | `android/ui/screens/place/privacy/PlacePrivacyMirrorScreen.kt` | Re-scope from home-gated to user-scoped |
| F9 | `f9-verification-promise-copy`<br>[export](design/exports/f9-verification-promise-copy/) | Copy change on a current screen | exported, not yet verified | `web/components/place/VerifyPromptSheet.tsx`<br>`web/components/place/verify-residency/VerifyResidency.tsx`<br>`web/components/homes/invitations/AuthenticatedInvitationPage.tsx`<br>`web/app/invite/[token]/page.tsx` | `ios/Features/Homes/VerifyLandlord/Postcard/PostcardVerificationView.swift`<br>`ios/Features/TokenAccept/HomeInvitationDecisionView.swift` | `android/ui/screens/homes/verify_landlord/postcard/PostcardVerificationScreen.kt`<br>`android/ui/screens/token_accept/HomeInvitationDecisionScreen.kt` | Copy only |
| X | `x-provenance-sheet`<br>[export](design/exports/x-provenance-sheet/) | **New sheet** | verified · fix pass open | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx`<br>`web/components/place/detail/PlaceSectionDetail.tsx`<br>`web/components/place/detail/RiskDetail.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift`<br>`ios/Features/Place/Detail/PlaceRiskDetailContent.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt`<br>`android/ui/screens/place/detail/PlaceRiskBlockDetailContent.kt` | New sheet; opened from every source caption |
| F1 | `f1-add-place-sheet`<br>[export](design/exports/f1-add-place-sheet/) | **New sheet** | verified · fix pass open | `web/components/place/SavedPlaceContext.tsx` | `ios/Features/Place/Launch/PendingPlaceView.swift`<br>`ios/Core/Networking/Endpoints/SavedPlacesEndpoints.swift` | `android/ui/screens/saved_places/SavedPlacesScreen.kt`<br>`android/ui/screens/saved_places/SavedPlacesContent.kt`<br>`android/ui/screens/saved_places/SavedPlacesActionSheet.kt` | New signed-in sheet; offline disabled (founder) |
| F1 | `f1-claim-receipt`<br>[export](design/exports/f1-claim-receipt/) | Redesign of a current screen | verified | `web/app/(app)/app/homes/new/page.tsx`<br>`web/components/place/VerifiedSuccess.tsx` | `ios/Features/Homes/ClaimOwnership/ClaimOwnershipWizardView.swift` | `android/ui/screens/homes/claim_ownership/ClaimOwnershipWizardScreen.kt` | Needs the T1→T3 carry-over (no migration step exists) |
| F1 | `f1-email-verify-handoff`<br>[export](design/exports/f1-email-verify-handoff/) | Redesign of a current screen | verified · fix pass open | `web/app/(auth)/verify-email-sent/page.tsx` | `ios/Features/Auth/Screens/VerifyEmailView.swift`<br>`ios/Features/Status/VerifyEmailLandingView.swift` | `android/ui/screens/auth/verify_email/VerifyEmailScreen.kt`<br>`android/ui/screens/status/verify_email/VerifyEmailLandingScreen.kt` | Pending place must persist server-side at register time |
| F1 | `f1-save-confirmation`<br>[export](design/exports/f1-save-confirmation/) | Redesign of a current screen | verified · fix pass open | `web/components/place/SavedPlaceContext.tsx`<br>`web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PendingPlaceView.swift`<br>`ios/Core/Networking/Endpoints/SavedPlacesEndpoints.swift`<br>`ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/saved_places/SavedPlacesScreen.kt`<br>`android/ui/screens/saved_places/SavedPlacesContent.kt`<br>`android/ui/screens/saved_places/SavedPlacesActionSheet.kt`<br>`android/ui/screens/place/launch/PlaceLaunchScreen.kt` |  |
| F1 | `f1-today-air-band`<br>[export](design/exports/f1-today-air-band/) | Redesign of a current screen | verified · fix pass open | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | Alert push landing |
| F1 | `f1-today-tab`<br>[export](design/exports/f1-today-tab/) | Redesign of a current screen | verified · fix pass open | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | One Today per platform; merges the hub and intelligence payloads |
| F1 | `f1-your-places`<br>[export](design/exports/f1-your-places/) | Redesign of a current screen | verified | `web/components/place/SavedPlaceContext.tsx` | `ios/Features/Place/Launch/PendingPlaceView.swift`<br>`ios/Core/Networking/Endpoints/SavedPlacesEndpoints.swift` | `android/ui/screens/saved_places/SavedPlacesScreen.kt`<br>`android/ui/screens/saved_places/SavedPlacesContent.kt`<br>`android/ui/screens/saved_places/SavedPlacesActionSheet.kt` | Opens from the place file's Address row |
| F2 | `x-place-file`<br>[export](design/exports/x-place-file/) | **New screen** | verified · fix pass open | `web/app/(app)/app/place/page.tsx`<br>`web/components/place/PlaceDashboard.tsx`<br>`web/components/place/PlaceDashboardView.tsx`<br>`web/components/hub/SetupBanner.tsx`<br>`web/components/place/JustMovedCard.tsx`<br>`web/components/place/SavedPlaceContext.tsx` | `ios/Features/Place/PlaceDashboardView.swift`<br>`ios/Features/Place/PlaceDashboardViewModel.swift`<br>`ios/Features/Place/Launch/PendingPlaceView.swift`<br>`ios/Core/Networking/Endpoints/SavedPlacesEndpoints.swift` | `android/ui/screens/place/PlaceDashboardScreen.kt`<br>`android/ui/screens/place/PlaceDashboardViewModel.kt`<br>`android/ui/screens/saved_places/SavedPlacesScreen.kt`<br>`android/ui/screens/saved_places/SavedPlacesContent.kt`<br>`android/ui/screens/saved_places/SavedPlacesActionSheet.kt` | New screen: the Place tab's first screen (founder, 22 Sep); absorbs SetupBanner + JustMovedCard |
| F4 | `f4-briefing-optin-card`<br>[export](design/exports/f4-briefing-optin-card/) | New part in a current screen | verified · fix pass open | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | Moves the opt-in onto Today (it is Settings-only on iOS today) |
| F4 | `f4-notification-primer`<br>[export](design/exports/f4-notification-primer/) | **New sheet** | verified · fix pass open | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | Primer after a pickup day is first saved from the Date sheet (founder, 23 Sep) |
| F4 | `f4-notification-settings`<br>[export](design/exports/f4-notification-settings/) | Redesign of a current screen | verified · fix pass open | `web/app/(app)/app/settings/notifications/page.tsx` | `ios/Features/Settings/Notifications/NotificationSettingsView.swift` | `android/ui/screens/settings/NotificationSettingsViewModel.kt` | One switch per kind; Nearby switches are their own Android channel / iOS category (founder) |
| F4 | `f4-today-pickup-card`<br>[export](design/exports/f4-today-pickup-card/) | New part in a current screen | verified · fix pass open | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | Push landing for the night-before pickup |
| F5 | `f5-today-calendar-strip`<br>[export](design/exports/f5-today-calendar-strip/) | New part in a current screen | verified · fix pass open | `web/components/place/detail/AddressCalendarCard.tsx`<br>`web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/detail/PlaceTodayDetailContent.kt`<br>`android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt` |  |
| F5 | `x-date-sheet`<br>[export](design/exports/x-date-sheet/) | **New sheet** | verified · fix pass open | `web/components/place/detail/AddressCalendarCard.tsx`<br>`web/app/(app)/app/place/page.tsx`<br>`web/components/place/PlaceDashboard.tsx`<br>`web/components/place/PlaceDashboardView.tsx` | `ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Place/PlaceDashboardView.swift`<br>`ios/Features/Place/PlaceDashboardViewModel.swift` | `android/ui/screens/place/detail/PlaceTodayDetailContent.kt`<br>`android/ui/screens/place/PlaceDashboardScreen.kt`<br>`android/ui/screens/place/PlaceDashboardViewModel.kt` | New sheet; one component for all ten kinds |
| F3 | `f3-bill-detail-web`<br>[export](design/exports/f3-bill-detail-web/) | **New screen** | exported, not yet verified | (new route — no bill-shaped destination on web) | `ios/Features/Homes/Bills/BillDetailView.swift` | `android/ui/screens/homes/bills/BillDetailScreen.kt` | New web route |
| F3 | `f3-bills-list`<br>[export](design/exports/f3-bills-list/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/bills/page.tsx` | `ios/Features/Homes/Bills/BillsListView.swift` | `android/ui/screens/homes/bills/BillsListScreen.kt` | Fix delete status cancelled→canceled |
| F3 | `f3-household-block`<br>[export](design/exports/f3-household-block/) | New part in a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/dashboard/page.tsx`<br>`web/app/(app)/app/place/page.tsx`<br>`web/components/place/PlaceDashboard.tsx`<br>`web/components/place/PlaceDashboardView.tsx` | `ios/Features/Homes/HomeDashboardView.swift`<br>`ios/Features/Place/PlaceDashboardView.swift`<br>`ios/Features/Place/PlaceDashboardViewModel.swift` | `android/ui/screens/homes/HomeDashboardScreen.kt`<br>`android/ui/screens/place/PlaceDashboardScreen.kt`<br>`android/ui/screens/place/PlaceDashboardViewModel.kt` |  |
| F3 | `f3-household-calendar`<br>[export](design/exports/f3-household-calendar/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/calendar/page.tsx`<br>`web/components/home/HouseholdCalendar.tsx`<br>`web/app/(app)/app/homes/[id]/dashboard/page.tsx` | `ios/Features/Homes/Calendar/HomeCalendarView.swift`<br>`ios/Features/Homes/HomeDashboardView.swift` | `android/ui/screens/homes/calendar/HomeCalendarScreen.kt`<br>`android/ui/screens/homes/HomeDashboardScreen.kt` | Web calendar page exists but has no link to it |
| F3 | `f3-household-notifications`<br>[export](design/exports/f3-household-notifications/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/notifications/page.tsx` | `ios/Features/Notifications/NotificationsView.swift`<br>`ios/Core/Routing/DeepLinkRouter.swift` | `android/ui/screens/notifications/NotificationsScreen.kt`<br>`android/core/routing/DeepLinkRouter.kt` | Android router sends new links to the dashboard today |
| F3 | `f3-invite-banner`<br>[export](design/exports/f3-invite-banner/) | New part in a current screen | exported, not yet verified | `web/app/(app)/app/homes/page.tsx`<br>`web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Homes/MyHomesListView.swift`<br>`ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/homes/MyHomesListScreen.kt`<br>`android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | Renders GET /api/homes/invitations (zero callers today) |
| F3 | `f3-invite-composer`<br>[export](design/exports/f3-invite-composer/) | Redesign of a current screen | exported, not yet verified | `web/components/home/InviteMemberModal.tsx` | `ios/Features/Homes/Members/InviteMemberWizardView.swift` | `android/ui/screens/homes/members/InviteMemberWizardSheet.kt`<br>`android/ui/screens/homes/members/HomeInvitationSenderContent.kt` | iOS gains username + link channels |
| F3 | `f3-member-home-dashboard`<br>[export](design/exports/f3-member-home-dashboard/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/dashboard/page.tsx` | `ios/Features/Homes/HomeDashboardView.swift` | `android/ui/screens/homes/HomeDashboardScreen.kt` |  |
| F3 | `f3-members-roster`<br>[export](design/exports/f3-members-roster/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/members/page.tsx` | `ios/Features/Homes/Members/MembersListView.swift`<br>`ios/Features/Homes/Members/MembersListViewModel.swift` | `android/ui/screens/homes/members/MembersListScreen.kt`<br>`android/ui/screens/homes/members/MembersListViewModel.kt` | Replaces the dead add-guest Invite |
| F3b | `f3b-invitation-decision`<br>[export](design/exports/f3b-invitation-decision/) | Redesign of a current screen | exported, not yet verified | `web/components/homes/invitations/AuthenticatedInvitationPage.tsx`<br>`web/app/invite/[token]/page.tsx` | `ios/Features/TokenAccept/HomeInvitationDecisionView.swift` | `android/ui/screens/token_accept/HomeInvitationDecisionScreen.kt` |  |
| F3b | `f3b-locked-action-row`<br>[export](design/exports/f3b-locked-action-row/) | New part in a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/dashboard/page.tsx`<br>`web/app/(app)/app/homes/[id]/bills/page.tsx`<br>`web/app/(app)/app/homes/[id]/calendar/page.tsx`<br>`web/components/home/HouseholdCalendar.tsx` | `ios/Features/Homes/HomeDashboardView.swift`<br>`ios/Features/Homes/Bills/BillsListView.swift`<br>`ios/Features/Homes/Calendar/HomeCalendarView.swift` | `android/ui/screens/homes/HomeDashboardScreen.kt`<br>`android/ui/screens/homes/bills/BillsListScreen.kt`<br>`android/ui/screens/homes/calendar/HomeCalendarScreen.kt` | Applied wherever an attested action is locked |
| F3b | `f3b-owner-attestation`<br>[export](design/exports/f3b-owner-attestation/) | **New sheet** | exported, not yet verified | `web/app/(app)/app/homes/[id]/members/page.tsx` | `ios/Features/Homes/Members/MembersListView.swift`<br>`ios/Features/Homes/Members/MembersListViewModel.swift` | `android/ui/screens/homes/members/MembersListScreen.kt`<br>`android/ui/screens/homes/members/MembersListViewModel.kt` | New sheet |
| F3b | `f3b-verify-address-sheet`<br>[export](design/exports/f3b-verify-address-sheet/) | **New sheet** | exported, not yet verified | `web/components/place/VerifyPromptSheet.tsx`<br>`web/components/place/verify-residency/VerifyResidency.tsx` | `ios/Features/Homes/VerifyLandlord/Postcard/PostcardVerificationView.swift` | `android/ui/screens/homes/verify_landlord/postcard/PostcardVerificationScreen.kt` |  |
| F8 | `f8-compare-arrival-header`<br>[export](design/exports/f8-compare-arrival-header/) | New part in a current screen | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` |  |
| F8 | `f8-compare-reveal`<br>[export](design/exports/f8-compare-reveal/) | **New screen** | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` | New funnel step |
| F8 | `f8-compare-sheet`<br>[export](design/exports/f8-compare-sheet/) | **New sheet** | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` | New sheet |
| F8 | `f8-native-share-compare`<br>[export](design/exports/f8-native-share-compare/) | Redesign of a current screen | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` | iOS has no share control on the preview today |
| F8 | `f8-og-compare-card`<br>[export](design/exports/f8-og-compare-card/) | Redesign of a current screen | exported, not yet verified | `web/app/api/og/place/route.tsx` | — | — |  |
| F8 | `f8-positioning-copy`<br>[export](design/exports/f8-positioning-copy/) | Copy change on a current screen | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` | One constant per platform; homepage hero keeps its serif |
| F8 | `f8-scale-strips`<br>[export](design/exports/f8-scale-strips/) | New part in a current screen | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx`<br>`web/components/place/detail/PlaceSectionDetail.tsx`<br>`web/components/place/detail/RiskDetail.tsx`<br>`web/app/api/og/place/route.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift`<br>`ios/Features/Place/Detail/PlaceRiskDetailContent.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt`<br>`android/ui/screens/place/detail/PlaceRiskBlockDetailContent.kt` |  |
| F8 | `f8-seasonal-aha`<br>[export](design/exports/f8-seasonal-aha/) | Redesign of a current screen | exported, not yet verified | `web/app/start/page.tsx`<br>`web/components/place/StartFunnel.tsx`<br>`web/components/archetypes/place/AhaCard.tsx` | `ios/Features/Place/Launch/PlaceLaunchView.swift`<br>`ios/Features/Place/Launch/PlacePreviewBody.swift` | `android/ui/screens/place/launch/PlaceLaunchScreen.kt` |  |
| F6 | `f6-home-basics-rows`<br>[export](design/exports/f6-home-basics-rows/) | Redesign of a current screen | verified | `web/app/(app)/app/homes/[id]/settings/page.tsx`<br>`web/components/home/settings/HomeSettingsTab.tsx` | `ios/Features/Homes/Settings/HomeSettingsView.swift` | `android/ui/screens/homes/settings/HomeSettingsScreen.kt` | Adds move-in date (never collected today) |
| F6 | `f6-place-section-details`<br>[export](design/exports/f6-place-section-details/) | New part in a current screen | verified | `web/components/place/detail/PlaceSectionDetail.tsx`<br>`web/components/place/detail/RiskDetail.tsx` | `ios/Features/Place/Detail/PlaceRiskDetailContent.swift` | `android/ui/screens/place/detail/PlaceRiskBlockDetailContent.kt` | Place-sections route must accept a saved place (founder, 23 Sep) |
| F7 | `f7-today-widget`<br>[export](design/exports/f7-today-widget/) | **New widget** | exported, not yet verified | — | `ios/PantopusWidgets/PantopusWidgetsBundle.swift`<br>`ios/Core/Widgets/WidgetSnapshotStore.swift`<br>(new) PantopusWidgets/TodayWidget.swift + Core/Widgets/TodayWidgetSnapshot.swift | `android/data/widget/WidgetSnapshotStore.kt`<br>(new) widget/TodayWidgetProvider.kt + res/layout + res/xml | New widget |
| F7 | `f7-widget-gallery`<br>[export](design/exports/f7-widget-gallery/) | **New widget** | exported, not yet verified | — | `ios/PantopusWidgets/PantopusWidgetsBundle.swift`<br>`ios/Core/Widgets/WidgetSnapshotStore.swift`<br>(new) PantopusWidgets/TodayWidget.swift + Core/Widgets/TodayWidgetSnapshot.swift | `android/data/widget/WidgetSnapshotStore.kt`<br>(new) widget/TodayWidgetProvider.kt + res/layout + res/xml | New |
| F7 | `f7-widget-howto-sheet`<br>[export](design/exports/f7-widget-howto-sheet/) | **New sheet** | exported, not yet verified | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | New sheet |
| F7 | `f7-widget-tap-landing`<br>[export](design/exports/f7-widget-tap-landing/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift`<br>`ios/Core/Routing/DeepLinkRouter.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt`<br>`android/core/routing/DeepLinkRouter.kt` | Parse `src=widget` (iOS drops it today) |
| P | `f9-block-founders-panel`<br>[export](design/exports/f9-block-founders-panel/) | Redesign of a current screen | exported, not yet verified | (none on web today — new)<br>`web/app/(app)/app/nearby/page.tsx`<br>`web/app/(app)/app/nearby/NearbyCellsMap.tsx` | `ios/Features/Place/Detail/PlaceBlockFoundersSection.swift`<br>`ios/Features/Neighborhood/NearbyCellsMapCard.swift` | `android/ui/screens/place/detail/PlaceBlockFoundersContent.kt`<br>`android/ui/screens/nearby/NearbyCells.kt` |  |
| P | `f9-invite-rewards-card`<br>[export](design/exports/f9-invite-rewards-card/) | New part in a current screen | exported, not yet verified | (none on web today — new)<br>`web/app/(app)/app/nearby/page.tsx`<br>`web/app/(app)/app/nearby/NearbyCellsMap.tsx` | `ios/Features/Me/ProfileInsightCards.swift`<br>`ios/Features/Neighborhood/NearbyCellsMapCard.swift` | `android/ui/screens/you/me/ProfileInsightCards.kt`<br>`android/ui/screens/nearby/NearbyCells.kt` | New card |
| P | `f9-nearby-cells-map`<br>[export](design/exports/f9-nearby-cells-map/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/nearby/page.tsx`<br>`web/app/(app)/app/nearby/NearbyCellsMap.tsx` | `ios/Features/Neighborhood/NearbyCellsMapCard.swift` | `android/ui/screens/nearby/NearbyCells.kt` |  |
| F10 | `f10-bill-provenance`<br>[export](design/exports/f10-bill-provenance/) | New part in a current screen | exported, not yet verified | (new route — no bill-shaped destination on web) | `ios/Features/Homes/Bills/BillDetailView.swift` | `android/ui/screens/homes/bills/BillDetailScreen.kt` |  |
| F10 | `f10-bill-trend`<br>[export](design/exports/f10-bill-trend/) | New part in a current screen | exported, not yet verified | `web/components/home/BillTrendChart.tsx` | `ios/Features/Homes/Bills/BillDetailView.swift` | `android/ui/screens/homes/bills/BillDetailScreen.kt` | Web already ships BillTrendChart.tsx: extend it |
| F10 | `f10-extraction-confirm`<br>[export](design/exports/f10-extraction-confirm/) | **New screen** | exported, not yet verified | `web/app/(app)/app/mailbox/page.tsx`<br>(new Mail Day page — web has settings only) | `ios/Features/Mailbox/MailDay/MailDayView.swift`<br>`ios/Features/Mailbox/MailDay/Components/MailboxEmptyHero.swift` | `android/ui/screens/mailbox/mail_day/MailDayScreen.kt`<br>`android/ui/screens/mailbox/mail_day/components/MailboxEmptyHero.kt` | New screen |
| F10 | `f10-mail-day-triage`<br>[export](design/exports/f10-mail-day-triage/) | **New screen** | exported, not yet verified | `web/app/(app)/app/mailbox/page.tsx`<br>(new Mail Day page — web has settings only) | `ios/Features/Mailbox/MailDay/MailDayView.swift`<br>`ios/Features/Mailbox/MailDay/Components/MailboxEmptyHero.swift` | `android/ui/screens/mailbox/mail_day/MailDayScreen.kt`<br>`android/ui/screens/mailbox/mail_day/components/MailboxEmptyHero.kt` | New screen on web; wires the no-op "Scan today's stack" CTA on natives |
| F10 | `f10-mail-piece-photo`<br>[export](design/exports/f10-mail-piece-photo/) | Redesign of a current screen | exported, not yet verified | `web/app/(app)/app/mailbox/[drawer]/[item_id]/page.tsx` | `ios/Features/Mailbox/ItemDetail/MailboxItemDetailView.swift` | `android/ui/screens/mailbox/item_detail/MailboxItemDetailScreen.kt` |  |
| F10 | `f10-mail-snap-privacy`<br>[export](design/exports/f10-mail-snap-privacy/) | New part in a current screen | exported, not yet verified | `web/app/(app)/app/homes/[id]/settings/page.tsx`<br>`web/components/home/settings/HomeSettingsTab.tsx` | `ios/Features/Homes/Settings/HomeSettingsView.swift` | `android/ui/screens/homes/settings/HomeSettingsScreen.kt` |  |
| F10 | `f10-snap-capture-tray`<br>[export](design/exports/f10-snap-capture-tray/) | **New sheet** | exported, not yet verified | `web/app/(app)/app/mailbox/page.tsx`<br>(new Mail Day page — web has settings only) | `ios/Features/Mailbox/MailDay/MailDayView.swift`<br>`ios/Features/Mailbox/MailDay/Components/MailboxEmptyHero.swift` | `android/ui/screens/mailbox/mail_day/MailDayScreen.kt`<br>`android/ui/screens/mailbox/mail_day/components/MailboxEmptyHero.kt` | New sheet; iOS SystemCameraPicker, Android CameraX |
| F11 | `f11-keeper-naming`<br>[export](design/exports/f11-keeper-naming/) | **New sheet** | exported, not yet verified | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` | New sheet |
| F11 | `f11-keeper-strip`<br>[export](design/exports/f11-keeper-strip/) | New part in a current screen | exported, not yet verified | `web/app/(app)/app/hub/today/page.tsx`<br>`web/components/place/detail/TodayDetail.tsx`<br>`web/components/hub/HubTodayCard.tsx` | `ios/Features/Place/Detail/AddressTodayTabView.swift`<br>`ios/Features/Place/Detail/PlaceTodayDetailContent.swift`<br>`ios/Features/Hub/Today/TodayDetailView.swift` | `android/ui/screens/place/today/TodayTabScreen.kt`<br>`android/ui/screens/place/today/TodayTabViewModel.kt`<br>`android/ui/screens/place/detail/PlaceTodayDetailContent.kt` |  |

Regenerate this table with
`TREE=<file listing of origin/master> python3 tools/export-render/gen_build_plan.py`
(`git ls-tree -r --name-only origin/master > tree.txt`). It flags any path that no longer resolves with ⚠.
