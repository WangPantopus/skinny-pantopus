# Claude Code prompt set — Pantopus mobile new-design build-out (batch 2)

> **Companion to `docs/new-design-parity-batch2.md`.** Each prompt is a
> single Claude Code session producing one mergeable PR. Copy any one
> `----`-delimited block into a fresh session in the monorepo root.
>
> **17 prompts total**, ordered to respect dependencies. The `B` prefix
> never collides with the P0–P9.1 set in `docs/claude-code-prompts.md`.
> Run sequentially by default; **B1.x primitives can run in parallel with
> each other**, and the screen prompts can run in parallel once their
> primitive prerequisite has merged.

---

## How to use this document

**Each prompt is self-contained.** It includes the context Claude Code
needs (paths, design references, conventions, acceptance criteria) so you
don't have to brief the session manually.

**Recommended workflow per prompt:**
1. Open a fresh Claude Code session in the monorepo root.
2. Paste the prompt body (the `----`-delimited block).
3. Let Claude Code run; review the PR it produces.
4. Merge, then move to the next prompt.

**If you hit a tricky one,** ask Claude Code to first produce a plan before
writing any code; the prompt's acceptance criteria become the plan's
success rubric.

---

## Universal conventions (every prompt assumes these)

Identical to `docs/claude-code-prompts.md` § "Universal conventions" — read
that section once per session. In short:

- **Layout.** iOS source `frontend/apps/ios/Pantopus/` (features
  `Features/<Area>/`, components `Core/Design/Components/`, snapshots
  `PantopusTests/Features/<Area>/`). Android source
  `frontend/apps/android/app/src/main/java/app/pantopus/android/` (screens
  `ui/screens/<area_snake>/`, components `ui/components/`, snapshots
  `app/src/test/java/app/pantopus/android/ui/screens/<area>/`).
- **Tokens only.** Spacing `Spacing.s0…s16`, Radii `Radii.xs…pill`, type
  `PantopusTextStyle.{h1…overline}`, colors `Theme.Color.<token>` (iOS) /
  `Theme.color.<token>` (Android). No raw hex except documented
  category-accent palettes and shimmer stops; new accents land as **named
  tokens** in `Colors.swift` / `Color.kt`.
- **Identity pillars.** Personal sky `primary600`/`personalBg`; Home green
  `home`/`homeBg`; Business violet `business`/`businessBg`.
- **Parity.** Every prompt ships **both platforms in the same PR** — same
  state machine, same loading/empty/populated/error states, word-for-word
  identical copy, identical primitive names.
- **Loading + cleanliness (DoD).** Read
  `docs/mobile-screen-definition-of-done.md`. Loading uses shimmer
  skeletons, never a "Loading…" spinner. No `TODO`, no dead controls, no
  `print()`/`Log` placeholders. One snapshot per designed state (iOS
  `pantopusSnapshot`; Android paparazzi).
- **Perf.** Respect `frontend/apps/{ios,android}/docs/perf_budgets.md`.
  Heavy primitives (the `PerforatedStamp` mask, `CameraScanner` preview,
  `MapPreview` draw) must call out the budget in acceptance and stay
  **static/seeded in snapshots**; animate only in production and honor
  `reduceMotion`.
- **Routing.** Every new screen wires through `Core/Routing/DeepLinkRouter.swift`
  (iOS) + the Android nav equivalent; new `HubRoute`/`YouRoute` cases live in
  `Features/Root/{HubTabRoot,YouTabRoot}.swift`.
- **Verify.** After each prompt run `frontend/apps/ios/Pantopus/scripts/
  verify-tokens.sh` + `verify-icons.sh` (iOS) and `./gradlew detekt`
  (Android).

### Batch-2-specific deltas (verified in B0 — see audit "Drift & environment findings")

- **`verify-tokens.sh` is delta-gated, not absolute.** It currently flags
  **73 pre-existing call-sites** and is **not** a CI gate (CI runs
  `swiftlint --strict` + `swiftformat --lint` + a narrow `#RRGGBB` grep).
  Your acceptance bar is **zero NEW** flagged sites vs that baseline. Since
  the script scans `Core/Design/Components` + `ui/components`, **new
  primitives must be fully tokenized**.
- **Build/snapshot tooling is CI-only.** The cloud Linux env has no
  Xcode/Swift and no Android SDK, so the iOS snapshot target, `detekt`,
  `paparazzi`, and `assembleDebug` **only run in CI** (`ios-ci.yml` /
  `android-ci.yml`). Author the snapshots/tests; expect them to record &
  verify on the runners. Locally you can run the two iOS grep guards.
- **Android route consts live in `ui/screens/root/RootTabScreen.kt`** (the
  `ChildRoutes` object), **not** `core/routing` (which holds only
  `DeepLinkRouter.kt`).
- **New accent tokens** (Stamps `#0e7490` `categoryStamps`, Task `#4f46e5`
  `categoryTask`, Translation `#be185d` `categoryTranslation`, Unboxing
  `#0d9488` `categoryUnboxing`, business-violet `#6d28d9` family) land as
  named tokens, mirroring the `category-party` / `category-records`
  precedent.
- **Design refs are vendored** under `docs/designs/A{10,17,18,19}/` (the
  `*.jsx` files are the spec). Read the matching
  `docs/new-design-parity-batch2.md` entry before starting.

---

## Sequencing (17 prompts)

| Phase | Prompts | Produces |
|---|---|---|
| **B0** | 1 | Vendor new design packs + audit verification (no app code) — **done** |
| **B1** | 5 | 13 shared primitives (postage/capture · preview · legal · business · earn) |
| **B2** | 4 | Mailbox screens: Stamps · Mail task · Translation · Unboxing |
| **B3** | 2 | Business: A10.6 reshape · A10.7 owner view |
| **B4** | 1 | A10.11 Earn |
| **B5** | 2 | A18.4 Waiting room (reshape) · A18.5 View As |
| **B6** | 1 | A19.1 Privacy + A19.2 Terms (reshape) |
| **B7** | 1 | Snapshot lockfile + parity-doc status update |

**Dependency rules:** B1.x can all run in parallel. B2.1 needs B1.1
(`PerforatedStamp`). B2.4 needs B1.1 (`CameraScanner` + `OcrFactsList`).
B3.1 needs B1.4. B3.2 needs B3.1 (+ B1.4). B4.1 needs B1.5. B5.2 needs B1.2.
B6.1 needs B1.3. B7 runs last.

---

# Phase B0 — Prep *(completed)*

----
You are starting the Pantopus mobile "new-design batch 2" build-out — the
screens that post-date docs/new-design-parity.md (A17.11–A17.14, A10.6,
A10.7, A10.11, A18.4, A18.5, A19.1, A19.2).

Do this grounding pass and report back. Do NOT modify any source files.

1. Read docs/new-design-parity.md and docs/claude-code-prompts.md
   end-to-end — house style, status legend, shells, per-PR cadence.
2. Read docs/new-design-parity-batch2.md (Part A) — per-screen slot
   inventory for this batch.
3. Vendor the new design source into docs/designs/A{17,10,18,19}/ (stamps/
   tasks/translation/unboxing; A10.6/7/11 + business-frames/
   business-owner-frames/earn-frames; View As + waiting-room; new A19 dir
   with Privacy + Terms + legal-frames + colors_and_type). Confirm every
   screen has matching HTML + JSX.
4. Confirm reusable primitives exist on BOTH platforms (BalanceHero,
   StrengthMeter, EmptyState, HaloCircle, DateSpan, AvatarWithIdentityRing,
   SegmentedProgressBar + the GroupedListView / ContentDetailShell /
   MailDetailView+MailItemDetailShell / FormShell / WizardShell shells).
5. Confirm routing seams (HubRoute/YouRoute mailbox cases + DeepLinkRouter;
   Android ChildRoutes; Status factories; Legal LegalContentView/Index).
6. Verify tooling: iOS verify-tokens.sh + verify-icons.sh, Android detekt,
   iOS snapshot target builds, paparazzi runs.

Output: any drift between this audit and the codebase, and a go/no-go for
Phase B1.
----

> **B0 outcome (recorded):** GO. Designs vendored; primitives/shells/routing
> seams confirmed; drift D1–D6 logged in the audit. Key caveats carried
> forward: `verify-tokens.sh` is delta-gated (73-site baseline, not a CI
> gate); build/snapshot/detekt/paparazzi are CI-only in the cloud env;
> Android route consts live in `RootTabScreen.kt`.

---

# Phase B1 — Shared primitives

Each B1 prompt adds primitives to `Core/Design/Components/` (iOS) and
`ui/components/` (Android) with SwiftUI previews / `@Preview`s + isolated
snapshot tests. **No screen changes.** Primitives must be token-pure (they
are scanned by `verify-tokens.sh`).

----
**B1.1 — Postage & capture primitives (A17.11 / A17.14 / A17.13)**

Add three shared primitives used by the mailbox build-out. iOS in
Core/Design/Components/, Android in ui/components/. Both platforms, same PR,
identical names. Read docs/new-design-parity-batch2.md (§A17) and the
vendored specs docs/designs/A17/{stamps,unboxing}.jsx before starting.

1. PerforatedStamp (+ Postmark) — a postage-stamp primitive (used by A17.11):
   - A rounded stamp tile with a perforated edge (the dotted-notch border the
     `--ink/--pf/--gap` CSS mask produces in stamps.jsx). Accepts ink color
     (token), an artwork slot, a denomination/series caption, and a `used`
     flag that overlays a Postmark cancellation ring ("PANTOPUS / USED").
   - PERF: the perforation mask is the heavy draw. Render it statically; if
     you animate anything (e.g. a shimmer on the featured stamp) gate it on
     production + reduceMotion. Call out the per-frame budget in acceptance.
2. CameraScanner (used by A17.14) — a viewfinder primitive:
   - Dark capture frame with corner framing brackets, a glowing scan line, an
     overlay label slot ("Item detected" / "live · rear camera"), and a
     control deck with a shutter button + filmstrip thumbnail rail slot.
   - In production it backs onto AVCaptureSession (iOS) / CameraX (Android)
     with a camera-permission prompt and a still-frame fallback; in
     previews/snapshots it renders a SEEDED static frame (no live camera).
     The scan-line animates in production only, honoring reduceMotion.
3. OcrFactsList (used by A17.14 + A17.13's facts) — label/value rows read off
   a document:
   - A card of rows (icon + label + value, value optionally monospace, with
     an optional trailing tag e.g. "2-yr"), plus a header with an
     edit/locked affordance ("Tap to edit" ↔ "Saved" + lock icon).

Acceptance: token-pure (new inks land as named tokens — categoryStamps
#0e7490, categoryUnboxing #0d9488); SwiftUI previews + @Previews covering
used/unused stamp, permission-granted/denied scanner, edit/locked facts;
isolated snapshot per state on both platforms; verify-tokens.sh adds ZERO
new flagged sites; verify-icons.sh green.
----

----
**B1.2 — Identity-preview primitives (A18.5)**

Add two shared primitives used by "View as". iOS Core/Design/Components/,
Android ui/components/. Both platforms, same PR, identical names. Read
docs/new-design-parity-batch2.md (§A18.5) and docs/designs/A18/
view-as-frames.jsx.

1. ViewerPicker — an audience-chip selector:
   - An eye-icon header ("Preview your profile as") above a SINGLE FLAT
     horizontal-scroll row of audience chips (icon + label). Each chip:
     idle (surface) vs active (filled primary600 + shadow). The chip set is
     data-driven; selecting one emits the chosen viewer. (Do NOT group the
     chips into sections — the design is a flat row; grouping is implicit in
     the icon set.)
2. RedactionScrim — a field-redaction overlay:
   - Wraps a field row. `visible` shows the value + a blue eye glyph;
     `hidden` replaces it with a repeating-linear-gradient blur/redaction bar
     + italic "Hidden" + lock icon; `partial` renders a shorter bar. Tones
     follow info (primary*) vs restricted (warning*) per the design.

Acceptance: token-pure; previews covering each chip state + visible/hidden/
partial scrims; isolated snapshot per state on both platforms;
verify-tokens.sh ZERO new; verify-icons.sh green. Touch targets ≥44pt/48dp;
chips carry stable testTag/accessibilityIdentifier "viewAs_chip_<viewer>".
----

----
**B1.3 — Legal scaffold primitives (A19.1 / A19.2)**

Add three shared primitives for the long-form legal archetype. iOS
Core/Design/Components/, Android ui/components/. Both platforms, same PR,
identical names. Read docs/new-design-parity-batch2.md (§A19) and
docs/designs/A19/legal-frames.jsx.

1. LegalTOCCard — a collapsible table of contents:
   - "Jump to section" card with a list icon (primary600). Expanded: rows of
     00-padded number chips (primary50 bg / primary700 text) + section title,
     each tappable to scroll to that section. Collapsed: a single summary row
     ("{n} sections") + chevron. Emits a section index on tap; exposes
     open/onToggle.
2. DocMetaStrip — a sunken "last updated · version" strip:
   - appSurfaceMuted (#f3f4f6) background, clock icon + "Last updated: {date}
     · Version {v}" in appTextSecondary.
3. BackToTopFab — a scroll-to-top FAB:
   - Bottom-right arrow-up button on a sunken surface; `visible` fades it in
     (the screen wires it to a scrollTop > ~220 threshold) and tapping
     smooth-scrolls to top.

Acceptance: token-pure; previews covering expanded/collapsed TOC, the meta
strip, and visible/hidden FAB; isolated snapshot per state on both
platforms; primary-tinted heading helper (numbered H2 at primary700) may
live alongside or in the screen — your call, justify in the commit;
verify-tokens.sh ZERO new; verify-icons.sh green.
----

----
**B1.4 — Business-profile primitives (A10.6 / A10.7)**

Add four shared primitives used by the business surfaces. iOS
Core/Design/Components/, Android ui/components/. Both platforms, same PR,
identical names. Read docs/new-design-parity-batch2.md (§A10.6) and
docs/designs/A10/business-frames.jsx.

1. BizBannerHeader — cover banner + overlapping circular logo:
   - A gradient cover banner (~116pt) with a 68pt rounded logo overlapping by
     -30pt, a business-violet VerifBadge corner mark (#6d28d9), name + handle
     (primary700) + map-pin locality + a chip row. Supports a `transparent`
     top-bar mode (floating circular controls over the banner) and optional
     EditFab overlays for owner mode (camera on banner, pencil on logo).
2. GalleryStrip — horizontal photo rail (116×92 tiles, last tile "+N more";
   owner mode adds a leading dashed "Add" tile + per-tile edit badge).
3. RatingDistribution — 5-bar review histogram (big average + star row +
   5→1 bars; star tint #f59e0b as a named token).
4. MapPreview — static map + identity pin:
   - A static street map image with a tinted location pin + an
     address/service-area caption + a "Directions" affordance. Vendor
     docs/designs/A10/assets/business-map.png (or render a seeded token-pure
     street-grid placeholder à la FuzzMap if you prefer not to ship a PNG —
     justify in the commit). PERF: static draw; no live map tiles in
     snapshots.

Acceptance: business-violet family (#6d28d9 / #ede9fe / #5b21b6) + category
accents (catCleaning #16a34a, catHandyman #ea580c, catPet #dc2626) + star
#f59e0b land as NAMED tokens; previews covering owner/public banner,
populated/empty gallery, full/sparse histogram, map with pin; isolated
snapshot per state on both platforms; verify-tokens.sh ZERO new;
verify-icons.sh green.
----

----
**B1.5 — Earn momentum primitive (A10.11)**

Add the weekly-goal momentum bar used by Earn. iOS Core/Design/Components/,
Android ui/components/. Both platforms, same PR, identical names. Read
docs/new-design-parity-batch2.md (§A10.11, incl. the ProgressRing
correction) and docs/designs/A10/earn-frames.jsx.

GoalProgressBar — a horizontal goal-progress bar:
   - A rounded track with a gradient fill (teal→green #5eead4 → #34d399) sized
     by progress (thisWeek / goal), a caption ("{pct}% to your $200 weekly
     goal" / "$X to go") and an empty variant ("Set a weekly goal"). It
     renders ON the dark EarnHero so it must read against a primary800→600
     gradient. NOTE: the design uses a BAR, not a donut ring — if extending
     the existing SegmentedProgressBar gets you there cleanly, do that and
     justify in the commit instead of adding a new file.

Acceptance: gradient stops land as named tokens (or documented shimmer-style
stops); previews covering empty / mid / near-complete on a dark hero
background; isolated snapshot per state on both platforms; verify-tokens.sh
ZERO new; verify-icons.sh green.
----

---

# Phase B2 — Mailbox screens

All four are standalone screens reusing the existing A17 archetype chrome
(top header row, white card stack, AI "Elf" strip, sticky action bar). **Do
NOT add them to the `MailItemCategory` enum.** Each gets a route + deep link,
a view-model with loading/empty/populated/error states, sample data, and a
snapshot per designed frame. Read the matching audit entry + JSX first.

----
**B2.1 — A17.11 Stamps (mailbox/stamps.tsx) · BUILD**

Build the Stamps / postage stamp-book wallet screen on both platforms.
Depends on B1.1 (PerforatedStamp). Read docs/new-design-parity-batch2.md
(§A17.11) and docs/designs/A17/{A17.11 Stamps.html, stamps.jsx}.

Targets: iOS Features/Mailbox/Stamps/MailStampsView.swift (+ ViewModel,
Content, SampleData, Components/); Android ui/screens/mailbox/stamps/
MailStampsScreen.kt (+ VM, content, sample-data, components/).

Frames (snapshot each): populated (StampsNav teal #0e7490 dot · BookHero
with balance ring "8 stamps left / Never expires" · Sheet 4-col grid of 12
with first 4 postmarked · WalletRail of other owned designs with ink-tinted
qty pills · UsageHistory · StampsElf "Pantopus checked your stamps / ~2
stamps per week / ~4 weeks of postage / Express low — 3 left" · IssuerCard
"Pantopus Post · Verified issuer" · buy-more bar) · empty ("No stamps yet" +
"You'll need a stamp to send mail to a neighbor…" + "Buy stamps" + starter
book "$4.80 / Get book").

Web ref: api.mailboxV2P3.getStamps() (earned | locked view modes). Wire the
endpoint helper + DTOs per DoD §6/§7; sample data drives snapshots.

Acceptance: four DoD states; word-for-word copy above; reuse PerforatedStamp
(+ Postmark for used stamps); StampsActions chips (Auto-refill/Gift/Send
mail/Archive) and "Buy more stamps" wired (route or backend, no dead taps);
route .mailStamps (iOS) / ChildRoutes.MAIL_STAMPS = "mailbox/stamps"
(Android) + pantopus://mailbox/stamps; verify-tokens.sh ZERO new;
verify-icons.sh green; snapshots on both platforms; parity (same states,
copy, testTags).
----

----
**B2.2 — A17.12 Mail task (mailbox/tasks.tsx) · BUILD**

Build the mail-derived task DETAIL screen on both platforms (the web
mailbox/tasks list is out of scope — note it as a follow-up). Read
docs/new-design-parity-batch2.md (§A17.12) and docs/designs/A17/{A17.12 Mail
task.html, tasks.jsx}.

Targets: iOS Features/Mailbox/Tasks/MailTaskView.swift (+ VM/content/sample/
Components); Android ui/screens/mailbox/tasks/MailTaskScreen.kt.

Frames (snapshot each): open (TaskNav indigo #4f46e5 · TaskHero with
checkbox + title "Submit written comment on the 412 Elm St rezoning" + 1-of-3
progress + "Due tomorrow · Fri May 30 · 5:00 PM" chip · DueCard calendar
block + SNOOZE row [This evening / Tomorrow AM / Pick a time] · Checklist 3
steps · SourceMail "Open original mail" · DelegateHint "Hand this off" ·
actions [Mark done / Snooze / Delegate / Calendar] · TaskElf "Pantopus made
this task for you / Closes Fri 5:00 PM / Draft ready") · done (title
struck-through + progress 100% + done chip "Done May 28 · 4:12 PM" ·
CompletionCard "What got filed · Confirmation #C-8841" · NextUp "Pay
Riverside Linen — $642.50" · TaskElf "Submitted — nice work / Confirmation
#C-8841 / Hearing Jun 3, 6 PM" · actions [Reopen task / View confirmation /
Archive]).

Acceptance: four DoD states; word-for-word copy; "Mark done" performs the
optimistic mutation (open→done) with rollback on failure; snooze/delegate/
source-mail taps route or mutate (no dead taps); route .mailTask(id:) /
ChildRoutes.MAIL_TASK = "mailbox/tasks/{id}" + pantopus://mailbox/tasks/:id;
endpoint + DTOs per DoD; verify-tokens.sh ZERO new; verify-icons.sh green;
snapshots both platforms; parity.
----

----
**B2.3 — A17.13 Translation (mailbox/translation.tsx) · BUILD**

Build the auto-translated mail view on both platforms (pushed from a mail
item's "Translate" action; applies to any mail type — NOT a category
variant). Read docs/new-design-parity-batch2.md (§A17.13) and
docs/designs/A17/{A17.13 Translation.html, translation.jsx}.

Targets: iOS Features/Mailbox/Translation/MailTranslationView.swift; Android
ui/screens/mailbox/translation/MailTranslationScreen.kt.

Frames (snapshot each): machine (TransNav rose #be185d · LangBadge "Spanish
(Mexico) → English · Auto-detected · 98% match" · ViewToggle [Translated /
Original / Side by side], active = Side by side · SideBySide serif
paragraph-aligned letter with glossary-term highlight #fce7f3/#9d174d ·
Glossary "Translator notes" · SenderCard "Lucía Herrera · Verified neighbor"
· TransElf "Pantopus translated this letter / 2 translator notes / Listen in
either language" · actions [Confirm translation / Edit / Language / Listen /
Archive]) · confirmed (ConfirmBanner "Translation confirmed" · ViewToggle
active = Translated · ReadingView clean English on paper #fdf9f4 · TransElf
"Both versions saved / Reply in English" · primary "Reply to Lucía").

Web ref: mailbox/translation/page.tsx (?id=mailId → fetch + translate). Wire
endpoint + DTOs.

Acceptance: four DoD states; word-for-word copy; "Confirm translation"
performs machine→confirmed transition (optimistic, rollback on failure);
ViewToggle switches the body view; "Reply to Lucía" routes to compose; route
.mailTranslation(id:) / ChildRoutes.MAIL_TRANSLATION = "mailbox/translation/
{id}" + pantopus://mailbox/translation/:id; verify-tokens.sh ZERO new;
verify-icons.sh green; snapshots both platforms; parity.
----

----
**B2.4 — A17.14 Unboxing (mailbox/unboxing.tsx) · BUILD**

Build the scan-first capture flow on both platforms. Depends on B1.1
(CameraScanner + OcrFactsList). Read docs/new-design-parity-batch2.md
(§A17.14) and docs/designs/A17/{A17.14 Unboxing.html, unboxing.jsx}.

Targets: iOS Features/Mailbox/Unboxing/MailUnboxingView.swift; Android
ui/screens/mailbox/unboxing/MailUnboxingScreen.kt.

Frames (snapshot each): classified (UnboxNav teal #0d9488 · StateChip "New
capture" [replaces the usual TrustChip — self-capture] · CameraScanner
viewfinder + ThumbStrip filmstrip [UNIT/BOX/RECEIPT/LABEL + Add] ·
DrawerSuggestion "Home › Warranties & Receipts · 96% match" + ALTS re-route
radios + "Choose another drawer" · OcrFactsList [Product "Breville Barista
Express" / Serial mono / Purchased / Warranty until + "2-yr" tag] · UnboxElf
"Pantopus sorted this unboxing / Best match: Home (96%) / 2-year warranty" ·
primary "Confirm — file to Home") · filed (StateChip "Filed" · FiledBanner
"Filed to Home › Warranties" + Undo · FiledShots "4 photos saved · Originals
kept in your Vault" · OcrFactsList locked [Saved + lock] · ScanNext "Scan the
next item" · UnboxElf "Filed — here's what I set up / Product registered /
Warranty reminder / 4 photos saved" · primary "View in Home drawer").

Acceptance: four DoD states; word-for-word copy; camera permission prompt +
still fallback in production, seeded static viewfinder in snapshots
(scan-line animates production-only, reduceMotion-aware — call out the perf
budget); "Confirm — file to Home" performs classified→filed (optimistic,
rollback) and Undo reverses it; drawer re-route radios select; ScanNext
restarts capture; route .mailUnboxing / ChildRoutes.MAIL_UNBOXING =
"mailbox/unboxing" + pantopus://mailbox/unboxing; verify-tokens.sh ZERO new;
verify-icons.sh green; snapshots both platforms; parity.
----

---

# Phase B3 — Business surfaces

----
**B3.1 — A10.6 Business profile (business/[username].tsx) · RESHAPE**

Reshape the public business profile from the existing tabbed/violet-band
layout to the single-scroll sectioned design on both platforms. Depends on
B1.4. Read docs/new-design-parity-batch2.md (§A10.6) and docs/designs/A10/
{A10.6 Business profile.html, business-frames.jsx}.

Existing: iOS Features/BusinessProfile/{BusinessProfileView,Content,
ViewModel}.swift; Android ui/screens/business_profile/{BusinessProfileScreen,
Content,ViewModel}.kt. Keep the data models (BusinessHoursRow,
BusinessServiceRow, BusinessReviewCard, BusinessAddress); rebuild the layout.

Frames (snapshot each): populated/open/verified (FrameBizPopulated — Marlow &
Co. Cleaning: BizBannerHeader [transparent top bar, floating controls] ·
"Open now" chip · StatStrip 4.9 / 340 jobs / ~20m · About + trust chips
[Bonded & insured / 3 team members / Since 2019] · Hours expandable ·
MapPreview "Based near 5th & Birch · Exact address shared after booking ·
Serves Elm Park & Cedar Heights — within 4 mi · Directions" · CategoryRow ·
Services priced rows · GalleryStrip "Recent work" · RatingDistribution + a
ReviewCard · sticky ActionBar [Book / Contact]) · secondary/newly-claimed +
closed (FrameBizNew — Tide Pool Pet Care: "Closed · opens 8 AM" chip · "Just
opened on Pantopus" note · empty StatStrip —/0/New · EmptyBlock "No photos
yet" · EmptyBlock "No reviews yet · Be the first to hire Tide Pool" + "Hire to
review" · ActionBar [Call / Contact] + note "Closed now — messages answered
at 8 AM").

Acceptance: four DoD states; word-for-word copy; reuse BizBannerHeader /
GalleryStrip / RatingDistribution / MapPreview; the `open` flag drives Hours
status label+color; both action-bar variants wired (no dead taps); preserve
the existing route + pantopus://business/:username deep link; verify-tokens.sh
ZERO new; verify-icons.sh green; snapshots both platforms; parity. The render
must be reusable by B3.2's preview mode — keep the body a parametrized
composable/view (data in, no owner chrome).
----

----
**B3.2 — A10.7 Business owner view (businesses/[id]/index.tsx) · BUILD**

Build the single-business owner dashboard + preview-as-neighbor on both
platforms. Depends on B3.1 (reuses its public render) and B1.4. Read
docs/new-design-parity-batch2.md (§A10.7) and docs/designs/A10/{A10.7
Business (owner view).html, business-owner-frames.jsx}.

Targets: iOS Features/Businesses/Owner/BusinessOwnerView.swift (+ VM/content/
Components); Android ui/screens/businesses/owner/BusinessOwnerScreen.kt.

Frames (snapshot each): owner/edit (FrameOwnerEdit — OwnerTopBar "Business +
Owner view" · OwnerLiveBar "Page is live · Edited 3d ago · View as neighbor"
· OwnerHeader = BizBannerHeader + EditFabs · InsightsStrip "This week · Views
1.2k +18% / Saves 84 +6% / Contacts 23" · ProfileStrength = StrengthMeter
"Profile strength · One step from a complete page · 92%" + checklist w/ "Add"
· ManageServices + "Add a service" · ManageGallery + dashed "Add" tile ·
OwnerReview reply composer ["Marlow & Co. replied" / "Reply"] · ActionBar
[Preview / Edit page]) · preview-as-neighbor (FramePreviewPublic — the EXACT
B3.1 public render of Marlow & Co. wrapped in a dark PreviewBar "Previewing
as a neighbor · This is exactly what the public sees · Exit").

Acceptance: four DoD states; word-for-word copy; preview mode re-renders the
SAME data through B3.1's public body (owner and public stay identical);
"View as neighbor"/"Preview" navigate to the preview frame, "Exit" pops back;
"Edit page" routes to EditBusinessPageView (A13.10); reuse StrengthMeter for
profile strength; route .businessOwner(id:) / ChildRoutes.BUSINESS_OWNER =
"businesses/{id}" + pantopus://businesses/:id, reached from MyBusinessesView
rows; verify-tokens.sh ZERO new; verify-icons.sh green; snapshots both
platforms; parity.
----

---

# Phase B4 — Earn

----
**B4.1 — A10.11 Earn (mailbox/earn.tsx) · BUILD**

Build the Earn dashboard (a Wallet sibling — earnings-in vs withdrawals) on
both platforms. Depends on B1.5 (GoalProgressBar). Read
docs/new-design-parity-batch2.md (§A10.11) and docs/designs/A10/{A10.11
Earn.html, earn-frames.jsx}.

Targets: iOS Features/Earn/EarnView.swift (sibling to Wallet/) + VM/content/
sample/Components; Android ui/screens/earn/EarnScreen.kt.

Frames (snapshot each): populated/active-earner (EarnHero = BalanceHero
framed for earnings: dark primary800→600 gradient · "Available to cash out
$312.40 · USD" · glass card "This week $148 / Lifetime $4,920 · 64 tasks" ·
GoalProgressBar "{pct}% to your $200 weekly goal" · WaysToEarn [Browse open
tasks · 28 near you · up to $140 today / Refer a neighbor +$10 / Offer a
service] · EarningsList grouped by day [paid green / "Pending" pill +
"clears…"] · PayoutSettings "Chase checking •••• 7421 · Instant payout · 1–3
minutes · Manage" + "Auto cash out · Every Friday · cleared balance" toggle ·
TaxDocsRow "Tax documents · YTD earnings $4,920 · 1099 available mid-Jan" ·
sticky CashOutCTA "Cash out $312.40") · empty/new (EarnHero zeros + "Set a
weekly goal" · WaysToEarn · EmptyEarnings "Start earning by completing tasks
· Your paid tasks land here…" · PayoutEmpty "Add a payout method · Link a
bank" + "Add bank" · NO taxes row · sticky BrowseCTA "Browse open tasks" +
gate "Cash out unlocks after your first paid task.").

Acceptance: four DoD states; word-for-word copy; reuse BalanceHero (framed
for earnings) + GoalProgressBar; the `empty`/no-bank gating drives the
payout/earnings/CTA swap and omits Taxes; "Cash out"/"Browse open tasks"/
"Add bank"/"Manage" all wired (no dead taps); route .earn /
ChildRoutes.EARN = "mailbox/earn" + pantopus://mailbox/earn; endpoint + DTOs
per DoD; verify-tokens.sh ZERO new; verify-icons.sh green; snapshots both
platforms; parity.
----

---

# Phase B5 — Status / waiting / preview

----
**B5.1 — A18.4 Waiting room (homes/[id]/waiting-room.tsx) · RESHAPE**

Build the persistent "waiting for approval" room on both platforms — the
room a claimant returns to repeatedly while a home claim is under review.
Reuses the existing Status halo/timeline pieces but is NOT the one-shot
underReview factory. Read docs/new-design-parity-batch2.md (§A18.4) and
docs/designs/A18/{Waiting for Approval.html, waiting-room-frames.jsx}.

Targets: iOS Features/Homes/WaitingRoom/HomeWaitingRoomView.swift (reuse
HaloCircle + TimelineStepper from Status); Android ui/screens/homes/
waiting_room/HomeWaitingRoomScreen.kt.

Frames (snapshot each): active-wait (TopBar with a BACK ARROW [not a close X]
+ a notifications BELL · INFO-toned HaloCircle [blue, pulsing — review isn't
done, so not success green] · headline "Under review" · body "Pantopus is
checking your documents against county records. You'll get a push the moment
we decide." · AddressRow "418 Linden Ave · Apt 3B · CLM-4F2A" [mono ref] ·
Timeline Submitted[done, Oct 24] → Under review[current, Started 9h ago] →
Approved[pending] · ETA pill "Decision usually within 24–48 hours" · "Manage
this claim" InlineActions [Update evidence / Cancel claim] · dock [View claim
/ Back to home]) · more-info-requested/review-paused (WARNING-toned halo ·
headline "We need one more thing" · body "Your utility bill is older than 90
days. Upload one from the last 60 days to continue the review." · reviewer
note card "Note from reviewer · Maya K. — …" · paused Timeline [Under review
= "Action needed" with alert-circle] · warning ETA "Paused · respond within 7
days" · Update evidence elevated to primary · Cancel claim destructive).

Acceptance: four DoD states; word-for-word copy; halo pulse animates
production-only + reduceMotion-aware (static in snapshots — call out the
budget); "Update evidence" routes to the re-upload flow, "Cancel claim" is
destructive with confirm; back arrow + bell wired; route
.homeWaitingRoom(homeId:) / ChildRoutes.HOME_WAITING_ROOM = "homes/{homeId}/
waiting-room" + pantopus://homes/:id/waiting-room, reachable from the home
card; verify-tokens.sh ZERO new; verify-icons.sh green; snapshots both
platforms; parity.
----

----
**B5.2 — A18.5 View As (identity/preview.tsx) · BUILD**

Build the "View as" identity preview on both platforms. Depends on B1.2
(ViewerPicker + RedactionScrim). Read docs/new-design-parity-batch2.md
(§A18.5) and docs/designs/A18/{View As.html, view-as-frames.jsx}.

Targets: iOS Features/IdentityCenter/ViewAs/IdentityPreviewView.swift;
Android ui/screens/identity_center/view_as/IdentityPreviewScreen.kt.

Frames (snapshot each): connection-viewer (ViewerPicker active=Connection ·
PreviewBanner "Viewing as a connection · This is what they see · Live"
[info-toned] · PreviewRender of the profile: ProfileHead + 3 VBadges
[Address/ID/Phone verified] + all 5 FieldVA visible [Location "Maple Heights
· 2 blocks away" / Member since "March 2023 · 2 yrs" / Rating "4.9 · 38
reviews" / Mutual connections "6 neighbors in common" / Contact "Available on
request"] + shared-history strip "You completed 2 tasks together. Connections
see your shared history." · PrivacyFooter "Connections see more because
you've interacted before. · Manage privacy") · public-viewer (active=Public ·
PreviewBanner "Viewing as the public · Most details are hidden" [restricted,
amber] · abbreviated name "Dana O." · 1 VBadge on + 2 locked · partial
Location + two fields RedactionScrim "Hidden" · restricted strip "Exact
address, contacts, and connections stay private to the public." ·
PrivacyFooter "Anyone not connected to you sees only this minimal card. ·
Manage privacy").

Audience chips (flat scroll row): Public · Persona audience · Neighbor ·
Connection · Household · Gig participant.

Acceptance: four DoD states; word-for-word copy; picking a chip re-renders
the ENTIRE live profile (banner tone + badges + field redaction); there is
NO primary CTA / sticky dock — the rendered card IS the output (only the
TopBar Edit pill + the inline "Manage privacy" link → A14.7 are
interactive); route .identityPreview / ChildRoutes.IDENTITY_PREVIEW =
"identity/preview" + pantopus://identity/preview, reached from Identity
Center; verify-tokens.sh ZERO new; verify-icons.sh green; snapshots both
platforms; parity.
----

---

# Phase B6 — Legal

----
**B6.1 — A19.1 Privacy + A19.2 Terms (legal/{privacy,terms}.tsx) · RESHAPE**

Reshape the two long-form legal docs from plain block lists to the new TOC +
meta-strip + back-to-top archetype on both platforms. ONE scaffold, both
docs, in the same PR. Depends on B1.3 (LegalTOCCard + DocMetaStrip +
BackToTopFab). Read docs/new-design-parity-batch2.md (§A19) and
docs/designs/A19/{A19.1 Privacy Policy.html, A19.2 Terms of Service.html,
legal-frames.jsx}.

Existing: iOS Features/Settings/Legal/{LegalContentView,LegalIndexView}.swift;
Android ui/screens/settings/legal/LegalScreens.kt (LegalContentScreen +
LegalIndexScreen). Rebuild the viewer; keep the index entry.

Shared scaffold: LGTopBar (back + centered title + share) · DocMetaStrip ·
LegalTOCCard (collapsible) · numbered primary-tinted H2 sections (id-anchored,
TOC scroll target) · H3 / P / dotted Bullets / bold defined terms ·
ContactFooter card · BackToTopFab (fades in past scrollTop > ~220).

Frames per doc (snapshot each): entry (top of doc, TOC EXPANDED, no FAB) ·
mid-scroll (TOC COLLAPSED to "{n} sections", BackToTopFab VISIBLE).

A19.1 Privacy — title "Privacy policy"; meta "Last updated October 1, 2025 ·
v3.2"; footer privacy@pantopus.com ("Questions about this policy?"); sections
(verbatim, in order): Overview · Information we collect · How we use it ·
Identity pillars & privacy · Sharing & disclosure · Your rights & controls ·
Data retention · Children & teens · International transfers · Changes to this
policy.

A19.2 Terms — title "Terms of service"; meta "Last updated February 14, 2026
· v5.0"; footer legal@pantopus.com ("Questions about these terms?"); sections
(verbatim, in order): Acceptance of these terms · Eligibility & accounts ·
Identity pillars · Acceptable use · Content & licenses · Tokens, invites &
access · Payments & gigs · Termination · Disclaimers · Limitation of
liability · Governing law & disputes · Changes to these terms.

Acceptance: store the full section bodies as structured data mirrored
word-for-word from the web copy (apps/web legal pages are authoritative) so
iOS + Android stay identical; TOC tap scrolls to the section; TOC
collapse/expand works; BackToTopFab threshold + smooth scroll-to-top work;
share is chrome; routes LegalContentView/LegalContentScreen reached from
Settings → Help & legal + pantopus://legal/privacy & pantopus://legal/terms;
verify-tokens.sh ZERO new; verify-icons.sh green; snapshots both platforms
(4 total: privacy×2 + terms×2); parity.
----

---

# Phase B7 — Snapshot lockfile + parity-doc update

----
**B7.1 — Snapshot lockfile + batch-2 parity status update**

Close out batch 2 on both platforms. Read docs/new-design-parity-batch2.md
and docs/claude-code-prompts-batch2.md.

1. Snapshot lockfile: add the batch-2 designed-state PNG baselines under the
   iOS __snapshots__/new-designs/ tree + a T-style tripwire test that fails
   if a batch-2 screen's render drifts, and the Android paparazzi equivalents
   (record with ./gradlew paparazziRecord on the runner). Cover every frame
   shipped by B2–B6 (one per designed state).
2. Parity-doc status update: flip each B2–B6 screen's Status in
   docs/new-design-parity-batch2.md from BUILD/RESHAPE to BUILT/RESHAPED with
   the prompt id + per-platform notes (mirroring how docs/new-design-parity.md
   annotates DONE/BUILT screens), and resolve the open questions B-1…B-5 with
   the decisions taken.
3. Confirm the 13 B1 primitives are all consumed (no orphaned primitive) and
   that verify-tokens.sh still adds ZERO new flagged sites vs the B0 baseline.

Acceptance: snapshot tripwires on both platforms; parity doc reflects final
state; no orphan primitives; verify-tokens.sh ZERO new; verify-icons.sh
green; CI green on ios-ci.yml + android-ci.yml.
----

---

*End of batch-2 prompt set. Source audit: `docs/new-design-parity-batch2.md`.*
