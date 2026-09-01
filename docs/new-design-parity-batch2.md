# New-design parity audit — Pantopus mobile (batch 2)

> **Continuation of `docs/new-design-parity.md`.** Maps the screens in the
> second design hand-off (the frames that post-date the original 38-screen
> audit) to their iOS and Android implementation files and grades each
> against the new design. Output is a worklist, not code.
>
> The original audit stops at A17.10 / A10.10 / A18.3 and has **no A19**
> section. Everything here is net-new relative to it. The companion prompt
> set is `docs/claude-code-prompts-batch2.md`; its prompts use a **`B`
> prefix** so they never collide with the P0–P9.1 set.
>
> **What this batch is.** The web app is the reference implementation and
> already ships nearly all of these (`apps/web/src/app/(app)/app/mailbox/
> {stamps,tasks,translation,unboxing}`, `…/homes/[id]/waiting-room`,
> `…/legal/{privacy,terms}`, the business surfaces, `…/mailbox/earn`). The
> two native apps (iOS Swift/SwiftUI + Android Kotlin/Compose, freshly
> migrated off Expo) have not caught up. So this batch is almost entirely
> **native catch-up to web + design, mirrored across both platforms** —
> the same cadence the P-set followed.
>
> **Sources of truth:**
> - Design HTML/JSX packs at `docs/designs/A{10,17,18,19}/…` (the `*.jsx`
>   files are the real spec; the `.html` files are thin iframe wrappers).
>   Vendored in prompt **B0**.
> - iOS: `frontend/apps/ios/Pantopus/Features/…`
> - Android: `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/…`
> - Reference patterns: `docs/new-design-parity.md`,
>   `docs/claude-code-prompts.md`, `docs/mobile-screen-definition-of-done.md`,
>   `frontend/apps/{ios,android}/docs/perf_budgets.md`.
>
> **Status legend** (same as the prior audit):
> - **BUILD** — no implementation file exists; net-new screen.
> - **RESHAPE** — file exists but layout / slot vocabulary diverges from the
>   new design enough that we must rebuild substantial regions (not just
>   swap tokens).
> - **POLISH** — file exists, structure matches; only per-state visuals /
>   copy need refresh.
> - **MATCH** — already at design.
> - **DONE** — shipped on **both** platforms, snapshot-locked, parity-verified.
>   Each DONE entry carries its prompt id + merged PR + the files that landed
>   (mirroring how `docs/new-design-parity.md` annotates completed screens).
>
> **✅ Batch closed out (B7.1).** All 11 screens below are **DONE** on iOS +
> Android. Every designed state is locked by the batch-2 snapshot lockfile —
> iOS `PantopusTests/Features/Shared/T8ScreensSnapshotTests.swift` (+ baselines
> under `PantopusTests/Features/__snapshots__/new-designs-batch2/`) and Android
> `…/ui/screens/shared/NewDesignBatch2ScreensSnapshotTest.kt` (+
> `app/src/test/snapshots/images/new-designs-batch2/`), rendered by
> `render-new-designs-batch2.mjs`. 22 rows (11 screens × 2 designed states).
> See `NEW_DESIGNS_BATCH2.md` for the regeneration policy. Tooling: iOS
> `verify-icons.sh` green; the CI `#RRGGBB` hex grep over `Pantopus/Features` is
> clean and all 11 batch-2 folders carry **zero** hex literals (new accents are
> named tokens) and **zero off-scale values** (flagged spacing/type in batch-2
> files use on-scale values via the raw `.padding()`/`.font(.system())` API form
> — `verify-tokens.sh` is delta-gated, not a CI gate, per drift D5; this lockfile
> PR touches no scanned source so adds **zero** new flagged sites). Android
> detekt green on `android-ci.yml`. The 13 B1 primitives are all consumed (no
> orphans). Full closeout detail at the foot of this doc.
>
> **Path prefixes** (table cells are relative to these):
> - iOS — `frontend/apps/ios/Pantopus/Features/`
> - Android — `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/`

---

## Summary

| Status | Count | Now |
|---|---:|---:|
| BUILD (start) | 7 | → DONE |
| RESHAPE (start) | 4 | → DONE |
| POLISH | 0 | — |
| MATCH | 0 | — |
| **DONE (shipped both platforms, locked)** | — | **11** |
| **Total screens audited** | **11** | **11** |

iOS and Android sit at the same structural parity for every screen below
(both were scaffolded from the same plan), so each grade is symmetric
across both platforms unless the per-screen note says otherwise.

| Design | Path (logical) | What it is | Start | Grade |
|---|---|---|---|---|
| A17.11 | `mailbox/stamps.tsx` | Postage / stamp-book wallet | BUILD | **DONE** · B2.1 · [#187] |
| A17.12 | `mailbox/tasks.tsx` | Mail-derived task detail | BUILD | **DONE** · B2.2 · [#186] |
| A17.13 | `mailbox/translation.tsx` | Auto-translated mail view | BUILD | **DONE** · B2.3 · [#188] |
| A17.14 | `mailbox/unboxing.tsx` | Scan-first capture flow (camera) | BUILD | **DONE** · B2.4 · [#189] |
| A10.6 | `business/[username].tsx` | Public business profile | RESHAPE | **DONE** · B3.1 · [#185] |
| A10.7 | `businesses/[id]/index.tsx` | Business owner view (+ preview-as-neighbor) | BUILD | **DONE** · B3.2 · [#191] |
| A10.11 | `mailbox/earn.tsx` | Earn dashboard (Wallet sibling) | BUILD | **DONE** · B4.1 · [#190] |
| A18.4 | `homes/[id]/waiting-room.tsx` | Persistent "waiting for approval" room | RESHAPE | **DONE** · B5.1 · [#194] |
| A18.5 | `identity/preview.tsx` | "View as" identity preview | BUILD | **DONE** · B5.2 · [#192] |
| A19.1 | `legal/privacy.tsx` | Privacy Policy (long-form) | RESHAPE | **DONE** · B6.1 · [#193] |
| A19.2 | `legal/terms.tsx` | Terms of Service (same archetype) | RESHAPE | **DONE** · B6.1 · [#193] |

[#185]: https://github.com/WangPantopus/pantopus/pull/185
[#186]: https://github.com/WangPantopus/pantopus/pull/186
[#187]: https://github.com/WangPantopus/pantopus/pull/187
[#188]: https://github.com/WangPantopus/pantopus/pull/188
[#189]: https://github.com/WangPantopus/pantopus/pull/189
[#190]: https://github.com/WangPantopus/pantopus/pull/190
[#191]: https://github.com/WangPantopus/pantopus/pull/191
[#192]: https://github.com/WangPantopus/pantopus/pull/192
[#193]: https://github.com/WangPantopus/pantopus/pull/193
[#194]: https://github.com/WangPantopus/pantopus/pull/194

---

## A.0 — Net-new design files vs the repo's tracked design snapshot

Diffing the repo's vendored `docs/designs/` against the new drop confirms
which screens are genuinely new:

- `docs/designs/A17/` ended at A17.10 → **A17.11–A17.14 are new**.
- `docs/designs/A10/` had 1,2,3,4,5,8,9,10 → **A10.6, A10.7, A10.11 are new**.
- `docs/designs/A18/` had Claim/Verification/Email/Waiting → **A18.5 View As
  is new**; A18.4's waiting-room frames were already vendored but never
  graded or built natively, so it is in scope here.
- There was **no `docs/designs/A19/`** → **A19.1 + A19.2 are a new archetype**.

Everything else in the drop (A03, A08 list screens, A09, A11 maps, A12
wizards, A13 forms, A14 settings, A15 chat, A21 beacon profiles, A22
creator hub) maps to existing native features and is covered by
`docs/new-design-parity.md` — not part of this batch.

---

## A.1 — Shared primitives required before screen work (Phase B1)

These primitives the new designs depend on do **not** exist yet in
`Core/Design/Components/` (iOS) or `ui/components/` (Android). They unblock
multiple screens and land first.

**Confirmed already-present and reusable** (do not rebuild): `BalanceHero`,
`StrengthMeter`, `EmptyState`, `HaloCircle`, `DateSpan`,
`AvatarWithIdentityRing`, `SegmentedProgressBar`, plus the
`GroupedListView` / `ContentDetailShell` / `MailDetailView` +
`MailItemDetailShell` / `FormShell` / `WizardShell` shells.

| Primitive | iOS path | Android path | Used by | B-prompt |
|---|---|---|---|---|
| `PerforatedStamp` (+ `Postmark`) | `Core/Design/Components/PerforatedStamp.swift` | `ui/components/PerforatedStamp.kt` | A17.11 | B1.1 |
| `CameraScanner` (viewfinder + shutter + filmstrip) | `Core/Design/Components/CameraScanner.swift` | `ui/components/CameraScanner.kt` | A17.14 | B1.1 |
| `OcrFactsList` (label/value rows read off a doc) | `Core/Design/Components/OcrFactsList.swift` | `ui/components/OcrFactsList.kt` | A17.14, A17.13 | B1.1 |
| `ViewerPicker` (audience-chip selector) | `Core/Design/Components/ViewerPicker.swift` | `ui/components/ViewerPicker.kt` | A18.5 | B1.2 |
| `RedactionScrim` (blur/lock overlay for hidden fields) | `Core/Design/Components/RedactionScrim.swift` | `ui/components/RedactionScrim.kt` | A18.5 | B1.2 |
| `LegalTOCCard` (collapsible table of contents) | `Core/Design/Components/LegalTOCCard.swift` | `ui/components/LegalTOCCard.kt` | A19.1, A19.2 | B1.3 |
| `DocMetaStrip` (Last-updated + version) | `Core/Design/Components/DocMetaStrip.swift` | `ui/components/DocMetaStrip.kt` | A19.1, A19.2 | B1.3 |
| `BackToTopFab` | `Core/Design/Components/BackToTopFab.swift` | `ui/components/BackToTopFab.kt` | A19.1, A19.2 | B1.3 |
| `BizBannerHeader` (cover banner + circular logo overlap) | `Core/Design/Components/BizBannerHeader.swift` | `ui/components/BizBannerHeader.kt` | A10.6, A10.7 | B1.4 |
| `GalleryStrip` (horizontal photo rail) | `Core/Design/Components/GalleryStrip.swift` | `ui/components/GalleryStrip.kt` | A10.6, A10.7 | B1.4 |
| `RatingDistribution` (5-bar review histogram) | `Core/Design/Components/RatingDistribution.swift` | `ui/components/RatingDistribution.kt` | A10.6, A10.7 | B1.4 |
| `MapPreview` (static map + identity pin) | `Core/Design/Components/MapPreview.swift` | `ui/components/MapPreview.kt` | A10.6, A10.7 | B1.4 |
| `GoalProgressBar` *(was "ProgressRing")* | `Core/Design/Components/GoalProgressBar.swift` | `ui/components/GoalProgressBar.kt` | A10.11 | B1.5 |

> **⚠ Primitive correction (verified against `earn-frames.jsx`).** The brief
> listed a donut **`ProgressRing`** for A10.11. The Earn design actually
> renders weekly-goal momentum as a **horizontal gradient bar** (`#5eead4 →
> #34d399`) inside the dark `EarnHero`; the concentric rings behind the
> balance are **decorative background only**. B1.5 therefore ships a
> tokenized **`GoalProgressBar`** (or extends the existing
> `SegmentedProgressBar`), **not** a donut. A donut ring is deferred unless a
> second consumer needs it — note that `MailDay`'s `DayHeader` already has a
> 56pt ring shape to extract if one is ever required (see open question B-3).

---

## A17 — Mailbox (four standalone screens, **not** `MailItemCategory` variants)

The web routes confirm shape: `stamps` / `tasks` / `translation` /
`unboxing` are their **own routes**, not item-detail renders. They reuse
the A17 archetype chrome that already exists in the Mailbox feature — top
header row (`TrustChip` + `CategoryChip` with a per-screen accent dot +
relative-time string), white card stack, an **AI "Elf" strip** (gradient
`#f0f9ff → #e0f2fe`, border `#bae6fd`, sparkles + headline + 3 icon
bullets), and a sticky action bar — but **each is its own screen with its
own route**. None should be added to the `MailItemCategory` enum.

Per-screen accents (the nav-eyebrow dot **and** the `CategoryChip` dot):
Stamps `#0e7490` (teal) · Task `#4f46e5` (indigo) · Translation `#be185d`
(rose) · Unboxing `#0d9488` (teal). New accents land as named tokens in
`Colors.swift` / `Color.kt`; the shared Elf-strip gradient is a strong
token target.

### A17.11 — Stamps (`mailbox/stamps.tsx`) · DONE (B2.1 · #187, iOS + Android)
- **Status: DONE (B2.1 · #187, both platforms).** Snapshot-locked
  (`a17-11-stamps-{populated,empty}`). **iOS:** `Features/Mailbox/Stamps/`
  — `StampsView` + `StampsViewModel` + `StampsContent` + `StampsSampleData` +
  `Components/{StampBookHero, StampSheet, WalletRail, UsageHistoryRow}`. **Android:**
  `ui/screens/mailbox/stamps/` — `StampsScreen` + VM + Content + SampleData +
  `components/{StampBookHero, StampSheet, WalletRail, UsageHistoryRow}`. Reuses
  the B1.1 `PerforatedStamp` (+ `Postmark`) primitive; perforation mask seeded
  static in snapshots. `categoryStamps` teal `#0e7490` landed as a named token.
  Route `.mailStamps` / `ChildRoutes.STAMPS = "mailbox/stamps"` +
  `pantopus://mailbox/stamps`. Backed by `getStamps()` (earned | locked); buy /
  auto-refill are scoped stubs per the brief (no Stripe).
- **iOS:** **MISSING** — no Stamps view. The `MailItemCategory` enum has 20
  cases (`package`…`records`) and no `stamps`; the "Stamps" string hits are
  `CertifiedStampBadge` etc.
- **Android:** **MISSING** — same.
- **Proposed target:** iOS `Mailbox/Stamps/MailStampsView.swift`
  (+ `MailStampsViewModel`, `MailStampsContent`, `MailStampsSampleData`,
  `Components/`); Android `mailbox/stamps/MailStampsScreen.kt` (+ VM,
  content, sample-data, `components/`).
- **Web reference:** `apps/web/.../mailbox/stamps/page.tsx` → `earned |
  locked` view modes off `api.mailboxV2P3.getStamps()` (backend endpoint
  exists).
- **Design entry:** `MailStampsScreen({ state })`, `state ∈ {populated,
  empty}`.
- **Designed frames:** **populated** (`BookHero` + `Sheet` grid + `WalletRail`
  + `UsageHistory` + `StampsElf` + `IssuerCard` + buy-more bar) · **empty**
  (`EmptyStamps` — "No stamps yet" + starter-book offer).
- **Slots** (design identifiers): `StampsNav` (teal `#0e7490` dot, eyebrow
  "Stamps") · `Stamp` (= the `PerforatedStamp` primitive: `--ink/--pf/--gap`
  CSS mask + optional `PostMark` cancellation overlay) · `ForeverArt` /
  `MiniArt` engraved artwork · `BookHero` (featured stamp + balance ring "8
  stamps left" + "Never expires") · `Sheet` (4-col grid of 12 stamps; first
  4 postmarked, used ink `#94a3b8`) · `WalletRail`/`WalletTile` (other owned
  designs; qty pill tinted by each ink — Express `#be123c`, Civic `#4338ca`,
  Spring `#4d7c0f`, Business `#b45309`) · `UsageHistory` (sends w/ tiny stamp
  chits) · `IssuerCard` ("Pantopus Post", "Verified issuer") · `StampsElf` ·
  `StampsActions`/`StChip`.
- **Signature copy:** headers "In this book" / "Other stamps you own" /
  "Usage history" / "From"; CTA **"Buy more stamps"**; chips Auto-refill /
  Gift / Send mail / Archive; empty "No stamps yet" + "You'll need a stamp to
  send mail to a neighbor…" + "Buy stamps" + starter book "$4.80" / "Get
  book"; Elf "Pantopus checked your stamps" / "~2 stamps / week" / "~4 weeks
  of postage" / "Express low — 3 left".
- **Build dependencies:** `PerforatedStamp` (+ `Postmark`) — **perf**: the
  perforation mask is the heavy draw; seed it static in snapshots, animate
  only in production, honor `reduceMotion`.

### A17.12 — Mail task (`mailbox/tasks.tsx`) · DONE (B2.2 · #186, iOS + Android)
- **Status: DONE (B2.2 · #186, both platforms).** Snapshot-locked
  (`a17-12-mail-task-{open,done}`). **iOS:** `Features/Mailbox/MailTask/` —
  `MailTaskView` + `MailTaskViewModel` + `MailTaskContent` + `MailTaskContentViews`
  + `MailTaskSampleData` + `Components/{TaskCard, DueSnoozeCard, SubtaskChecklist,
  SourceMailCard, NextUpCard}`. **Android:** `ui/screens/mailbox/mail_task/`
  (mirror, `MailTaskScreen` + the same component set). `categoryTask` indigo
  `#4f46e5` landed as a named token. "Mark done" runs the optimistic open→done
  mutation with rollback; snooze / calendar / view-confirmation / archive chips
  toast (scoped stubs). Route `.mailTask(taskId:)` / `ChildRoutes.MAIL_TASK =
  "mailbox/tasks/{taskId}"` + `pantopus://mailbox/tasks/:id`. (The mail-task
  **list** stays a follow-up — see resolved open question B-1.)
- **iOS / Android:** **MISSING** (`MailTask` → 0 hits).
- **Proposed target:** iOS `Mailbox/Tasks/MailTaskView.swift` (+ VM/content/
  sample/Components); Android `mailbox/tasks/MailTaskScreen.kt`.
- **Web reference:** `apps/web/.../mailbox/tasks/page.tsx` is a **list**
  (`useTasks`, `useCreateTaskFromMail`, `useEscalateTaskToGig`). The A17.12
  design is the single **task detail** — build the detail screen; the list is
  a separate, lower-priority concern (note it, do not build here).
- **Design entry:** `MailTaskScreen({ state })`, `state ∈ {open, done}`.
- **Designed frames:** **open** (hero + `DueCard` + `Checklist` + `SourceMail`
  + `DelegateHint` + actions) · **done** (`CompletionCard` "What got filed" +
  `Checklist` all-checked + `NextUp` suggestion + reopen/archive actions).
- **Slots:** `TaskNav` (indigo `#4f46e5` dot, eyebrow "Task") · `PriorityFlag`
  (High `#b91c1c` / Med `#92400e` / Low) · `TaskHero` (accent strip, checkbox,
  title struck-through when done, 1-of-3 progress, due chip) · `DueCard`
  (MAY/30/FRI calendar block + reminder + `SNOOZE` row: This evening /
  Tomorrow AM / Pick a time) · `Checklist` (3 `STEPS`, success-green checks) ·
  `SourceMail` (originating mail, accent `#f97316`, "Open original mail") ·
  `DelegateHint` (overlapping avatars + "Hand this off") · `CompletionCard`/
  `SummaryRow` (mono confirmation) · `NextUp` (green `#16a34a`) · `TaskElf`.
- **Signature copy:** title "Submit written comment on the 412 Elm St
  rezoning"; due "Due tomorrow · Fri May 30 · 5:00 PM"; CTA **"Mark done"** →
  done **"Reopen task"**; Elf-open "Pantopus made this task for you" /
  "Closes Fri 5:00 PM" / "Draft ready"; Elf-done "Submitted — nice work" /
  "Confirmation #C-8841" / "Hearing Jun 3, 6 PM"; NextUp "Pay Riverside Linen
  — $642.50".

### A17.13 — Translation (`mailbox/translation.tsx`) · DONE (B2.3 · #188, iOS + Android)
- **Status: DONE (B2.3 · #188, both platforms).** Snapshot-locked
  (`a17-13-translation-{machine,confirmed}`). iOS `Features/Mailbox/Translation/`
  and Android
  `ui/screens/mailbox/translation/` ship the full screen (View/Screen + ViewModel
  + Content/UiState + SampleData + `Components/`: LanguageBadge, ViewToggle,
  SideBySide, TranslatorNotes). Machine ↔ confirmed transition is optimistic with
  rollback; ViewToggle (Translated/Original/Side by side) swaps the body; "Listen"
  stubs to a toast (real TTS deferred); "Confirm translation" posts to
  `POST /api/mailbox/v2/p3/translate` (`MailboxV2Endpoints.translate` /
  `MailboxV2Api.translate`). Reached from a mail item's **Translate** overflow
  action on the generic detail variant + `pantopus://mailbox/translation?id=`
  (routes were pre-staged in B1.6 and swapped off the placeholder here). New
  `categoryTranslation` token family (pink-700 `#be185d` / bg `#fce7f3` / ink
  `#9d174d` / paper `#fdf9f4` / paper-ink `#3a2f2a`) landed on both platforms.
  Snapshot tripwires per state (machine / confirmed) on both platforms.
- **Proposed target:** iOS `Mailbox/Translation/MailTranslationView.swift`;
  Android `mailbox/translation/MailTranslationScreen.kt`.
- **Web reference:** `apps/web/.../mailbox/translation/page.tsx` takes `?id=`
  (a `mailId`), fetches the item, translates it. Pushed from a mail item's
  **Translate** action — build it standalone (translation applies to any mail
  type; **not** a category variant).
- **Design entry:** `MailTranslationScreen({ state })`, `state ∈ {machine,
  confirmed}`.
- **Designed frames:** **machine** (`LangBadge` + `ViewToggle(side)` +
  `SideBySide` + `Glossary` + actions) · **confirmed** (`ConfirmBanner` +
  `ViewToggle(translated)` + `ReadingView` clean reading on paper `#fdf9f4` +
  "Reply" action).
- **Slots:** `TransNav` (rose `#be185d` dot) · `LangBadge`/`LangPill` ("ES →
  EN", "Auto-detected · 98% match" → "Confirmed translation") · `ViewToggle`
  (segmented: Translated / Original / **Side by side**) · `SideBySide`
  (serif, paragraph-aligned, `<mark>` highlight `#fce7f3`/`#9d174d` on glossary
  terms) · `ReadingView` (clean English on paper) · `Glossary` ("Translator
  notes", term + kind pill + note) · `SenderCard` (Lucía Herrera, "Verified
  neighbor" identity-personal pill) · `TransElf`.
- **Signature copy:** "Spanish (Mexico) → English"; toggle "Translated /
  Original / Side by side"; CTA **"Confirm translation"** → confirmed banner
  "Translation confirmed" + **"Reply to Lucía"**; Elf-machine "Pantopus
  translated this letter" / "2 translator notes" / "Listen in either
  language"; Elf-confirmed "Both versions saved" / "Reply in English".
- **Build dependencies:** `OcrFactsList` is **not** used here (translation has
  no facts grid); the glossary is a bespoke list. Side-by-side and reading
  views are layout, not new primitives.

### A17.14 — Unboxing (`mailbox/unboxing.tsx`) · DONE (B2.4 · #189, iOS + Android)
- **Status: DONE (B2.4 · #189, both platforms).** Snapshot-locked
  (`a17-14-unboxing-{classified,filed}`). **iOS:** `Features/Mailbox/Unboxing/`
  — `UnboxingView` + `UnboxingViewModel` + `UnboxingContent` + `UnboxingSampleData`
  + `Components/{CaptureFilmstrip, DrawerSuggestionCard, FiledSummary}`. **Android:**
  `ui/screens/mailbox/unboxing/` (mirror). Reuses B1.1 `CameraScanner` +
  `OcrFactsList`; viewfinder is **seeded static** in snapshots (scan-line animates
  production-only, `reduceMotion`-aware). `categoryUnboxing` teal `#0d9488` landed
  as a named token. "Confirm — file to Home" runs classified→filed (optimistic,
  Undo reverses); drawer re-route radios + ScanNext live. Route `.mailUnboxing` /
  `ChildRoutes.MAIL_UNBOXING = "mailbox/unboxing"` + `pantopus://mailbox/unboxing`.
- **iOS:** **MISSING** (`Unboxing` → 1 incidental hit, no camera/capture
  screen). **Android:** **MISSING**.
- **Proposed target:** iOS `Mailbox/Unboxing/MailUnboxingView.swift`; Android
  `mailbox/unboxing/MailUnboxingScreen.kt`.
- **Web reference:** `apps/web/.../mailbox/unboxing/page.tsx` (capture flow,
  optional `?id`).
- **Design entry:** `MailUnboxingScreen({ state })`, `state ∈ {classified,
  filed}`.
- **Designed frames:** **classified** (`Viewfinder` live camera + `ThumbStrip`
  filmstrip + `DrawerSuggestion` + `ExtractedFacts` + confirm) · **filed**
  (`FiledBanner` + `FiledShots` "Originals kept in your Vault" +
  `ExtractedFacts(locked)` + `ScanNext`).
- **Slots:** `UnboxNav` (teal `#0d9488` dot) · `StateChip` (replaces the usual
  TrustChip — self-capture: "New capture" → "Filed") · `Viewfinder` (= the
  `CameraScanner` primitive: dark frame, framing brackets, glowing scan line,
  shutter deck) · `ThumbStrip`/`FiledShots` (filmstrip UNIT/BOX/RECEIPT/LABEL
  + "Add" tile) · `DrawerSuggestion` ("Home › Warranties & Receipts" 96% match
  + `ALTS` re-route radios + "Choose another drawer") · `ExtractedFacts` (=
  the `OcrFactsList` primitive: Product / Serial mono / Purchased / Warranty
  until + "2-yr" tag; "Tap to edit" → "Saved" + lock when filed) ·
  `FiledBanner` ("Filed to Home › Warranties" + Undo) · `ScanNext` · `UnboxElf`.
- **Signature copy:** headers "Captured" / "File into" (Suggested by Pantopus)
  / "Or re-route to" / "Read from your scans"; CTA **"Confirm — file to
  Home"** → **"View in Home drawer"**; `ScanNext` "Scan the next item"; Elf
  "Pantopus sorted this unboxing" / "Best match: Home (96%)" / "2-year
  warranty" → "Filed — here's what I set up" / "Product registered" /
  "Warranty reminder" / "4 photos saved".
- **Build dependencies:** `CameraScanner` + `OcrFactsList`. **Perf:** the
  viewfinder preview must stay **static/seeded** in snapshots and animate
  (scan-line) only in production, honoring `reduceMotion`. Camera permission
  + a still-frame fallback are required for a real capture; the design's
  "live" feed is decorative striping — wire a real `AVCaptureSession` /
  CameraX preview behind it in production, seeded in tests.

---

## A10 — Detail: content

### A10.6 — Business profile (public) (`business/[username].tsx`) · DONE (B3.1 · #185, iOS + Android)
- **Status: DONE (B3.1 · #185, both platforms).** Snapshot-locked
  (`a10-6-business-profile-{populated,new}`). Reshaped from the tabbed/violet-band
  layout to the single-scroll sectioned design. **iOS:** `Features/BusinessProfile/`
  — `BusinessProfileView` + `Content` + `ViewModel` + `SampleData` +
  `Components/{ActionBar, CategoryRow, EmptyBlock, HoursTable, ServicesList,
  StatStrip}`. **Android:** `ui/screens/business_profile/` (mirror). Reuses B1.4/B1.5
  `BizBannerHeader` / `GalleryStrip` / `RatingDistribution` / `MapPreview` and the
  business-violet `#6d28d9` family + category accents as named tokens; the `open`
  flag drives the Hours status label/color. The body is a parametrized
  composable/view reused by B3.2's preview mode. Existing route +
  `pantopus://business/:username` preserved.
- **iOS:** `BusinessProfile/{BusinessProfileView, BusinessProfileContent,
  BusinessProfileViewModel}.swift` exist.
- **Android:** `business_profile/{BusinessProfileScreen, BusinessProfileContent,
  BusinessProfileViewModel}.kt`.
- **Why RESHAPE, not POLISH:** the existing surface is a **tabbed** profile
  (`.services` / `.reviews` tabs) over a violet identity band. A10.6 is a
  **single-scroll sectioned** profile: `BizBannerHeader` (cover banner +
  overlapping 68px circular logo at `-30` margin + violet `VerifBadge`
  `#6d28d9`), category chips, "Recent work" `GalleryStrip`, `MapPreview` with
  service area, a `RatingDistribution` summary, a Message + Save `ActionBar`,
  and a **secondary frame** (newly-claimed + closed: `EmptyBlock`s, closed
  status pill, limited actions). The data models (`BusinessHoursRow`,
  `BusinessServiceRow`, `BusinessReviewCard`, `BusinessAddress`) are reusable;
  the layout / header / empty-state are not.
- **Design entries:** `FrameBizPopulated` (open, verified — Marlow & Co.
  Cleaning) and `FrameBizNew` (newly-claimed + closed — Tide Pool Pet Care).
  Two hand-authored frames; the `open` boolean on `Hours` drives status
  label + color.
- **Slots:** `BTopBar({transparent})` (floating circular controls over banner)
  · `BizHeader` · `StatStrip` (4.9 / 340 jobs / ~20m → —/0/"New") ·
  `CategoryRow`/`Chip` (per-category accents: cleaning `#16a34a`, handyman
  `#ea580c`, pet `#dc2626`) · `Hours` (status header success/warning-tinted +
  expandable day rows) · `AddressMap` (= `MapPreview`, `business-map.png`,
  violet store pin, "Directions") · `Services` (priced rows) · `Gallery` (=
  `GalleryStrip`, 116×92 tiles, "+N more") · `RatingSummary` (=
  `RatingDistribution`, avg + `Stars` + 5→1 bars in `#f59e0b`) · `ReviewCard` ·
  `ActionBar` (sticky dual-button + optional `note`) · `EmptyBlock`.
- **Signature copy:** headers About / Hours / Service area / Services / Recent
  work / Reviews; chips "Open now" / "Closed · opens 8 AM"; CTA **"Book"** +
  **"Contact"** (new-business: **"Call"** + "Contact"); new-business note
  "Just opened on Pantopus"; empties "No photos yet" / "No reviews yet · Be
  the first to hire Tide Pool" + "Hire to review"; closed bar note "Closed now
  — messages answered at 8 AM".
- **Build dependencies:** `BizBannerHeader`, `GalleryStrip`,
  `RatingDistribution`, `MapPreview` (+ vendored `business-map.png`, see
  drift D4).
- **Routing:** `BusinessProfileView` / `BusinessProfileScreen`, reached from
  business search / discover and the `pantopus://business/:username` deep link.

### A10.7 — Business owner view (`businesses/[id]/index.tsx`) · DONE (B3.2 · #191, iOS + Android)
- **Status: DONE (B3.2 · #191, both platforms).** Snapshot-locked
  (`a10-7-business-owner-{edit,preview}`). **iOS:** `Features/Businesses/OwnerDashboard/`
  — `BusinessOwnerView` + `Content` + `ViewModel` + `SampleData` +
  `Components/{OwnerHeader, InsightTiles, ProfileStrengthCard, ReviewReplyComposer,
  PreviewBar}`. **Android:** `ui/screens/businesses/owner_dashboard/` (mirror).
  Preview mode re-renders the **same data through B3.1's public body** (owner ↔
  public stay identical); "View as neighbor" / "Preview" navigate to the preview
  frame, "Exit" pops back; "Edit page" routes to `EditBusinessPageView` (A13.10);
  reuses the existing `StrengthMeter` for profile strength. Route
  `.businessOwner(businessId:)` / `ChildRoutes.BUSINESS_OWNER = "businesses/{businessId}"`
  + `pantopus://businesses/:id`, reached from `MyBusinessesView` rows.
- **iOS:** `Businesses/` has `MyBusinessesView` (list), `CreateBusiness/`
  (wizard), `PageEditor/EditBusinessPageView` (A13.10). **No single-business
  owner dashboard.** **Android:** same.
- **Proposed target:** iOS `Businesses/Owner/BusinessOwnerView.swift`
  (+ VM/content/Components); Android `businesses/owner/BusinessOwnerScreen.kt`.
- **Design entries:** `FrameOwnerEdit` (owner dashboard) and
  `FramePreviewPublic` (the exact A10.6 public render wrapped in a preview
  bar). Both reuse the A10.6 primitives over a shared `MARLOW` data const.
- **Slots** (owner-only): `OwnerTopBar` ("Business" + violet "Owner view"
  sub-label + chart/settings actions) · `OwnerLiveBar` ("Page is live" +
  "Edited 3d ago" + **"View as neighbor"** eye button) · `OwnerHeader`
  (`BizBannerHeader` + `EditFab` overlays: camera on banner, pencil on logo) ·
  `InsightsStrip` ("This week" tiles: Views 1.2k +18% / Saves 84 +6% /
  Contacts 23) · `ProfileStrength` (= existing `StrengthMeter`: "Profile
  strength · One step from a complete page · 92%" + checklist w/ "Add") ·
  `ManageServices` (rows + "Add a service") · `ManageGallery` (rail + leading
  dashed "Add" tile + per-tile edit) · `OwnerReview` (review-reply composer:
  "Marlow & Co. replied" violet left-border, or a "Reply" button) ·
  `PreviewBar` (dark `#1f2937`: "Previewing as a neighbor · This is exactly
  what the public sees · Exit").
- **Signature copy:** "Owner view"; "Page is live · Edited 3d ago"; "View as
  neighbor"; "This week" / Views / Saves / Contacts; "Profile strength · One
  step from a complete page · 92%"; edit affordances "Edit" / "Manage" / "2 to
  reply" / "Add a service"; owner `ActionBar` **"Preview"** + **"Edit page"**;
  preview bar "Previewing as a neighbor / This is exactly what the public sees
  / Exit".
- **Reuse:** the A10.6 render (B1.4 + B3.1) for **preview mode**;
  `EditBusinessPageView` (A13.10) for the **edit entry**; `StrengthMeter`
  (existing) for profile strength.
- **Routing:** new `.businessOwner(id:)` (iOS) / `ChildRoutes.BUSINESS_OWNER`
  (Android) reached from `MyBusinessesView` rows + `pantopus://businesses/:id`;
  "View as neighbor" / "Preview" navigate to `FramePreviewPublic`, whose
  "Exit" pops back. (Owner↔preview is **navigation between two frames**, not a
  runtime toggle.)

### A10.11 — Earn (`mailbox/earn.tsx`) · DONE (B4.1 · #190, iOS + Android)
- **Status: DONE (B4.1 · #190, both platforms).** Snapshot-locked
  (`a10-11-earn-{populated,empty}`). **iOS:** `Features/Mailbox/Earn/` — `EarnView`
  + `EarnViewModel` + `EarnContent` + `EarnSampleData` + `Components/{WeeklyGoalCard,
  WaysToEarnRow, EarningsRow, PayoutSettingsCard, EarnTaxDocsRow}`. **Android:**
  `ui/screens/mailbox/earn/` (mirror). Reuses `BalanceHero` framed for earnings.
  The `empty`/no-bank gating drives the payout / earnings / CTA swap and omits the
  Taxes row; Cash out / Browse open tasks / Add bank / Manage all wired. Route
  `.earn` / `ChildRoutes.EARN = "mailbox/earn"` + `pantopus://mailbox/earn` — sits
  beside Wallet (see resolved B-2).
  > **⚠ Goal-momentum fidelity (B-3 follow-up).** B1.5 shipped the goal indicator
  > as **`ProgressRing`** (a 64pt donut on a `WeeklyGoalCard` surface card below the
  > hero), **not** the audit-recommended in-hero gradient **bar** the design renders
  > ("74% to your $200 weekly goal · $52 to go" inside `EarnHero`). Implementation
  > is consistent iOS↔Android and snapshot-locked, but the locked **design**
  > baseline (`a10-11-earn-populated`) shows the bar — so this is a known
  > design-vs-implementation diff for design review, not a lockfile failure.
- **iOS:** `Wallet/` exists (A10.10); **no Earn**. **Android:** same. Web's
  `mailbox/earn` / `wallet` just `redirect()` to payments — there is **no
  standalone Earn surface anywhere yet**.
- **Proposed target:** iOS `Earn/EarnView.swift` (sibling to `Wallet/`);
  Android `earn/EarnScreen.kt`.
- **Design entries:** `FrameEarnPopulated` (active earner) and `FrameEarnEmpty`
  (new, no earnings). The `empty` boolean drives the shared `EarnHero` and
  swaps earnings / payout / CTA slots.
- **Designed frames:** **populated** (dark `EarnHero` $312.40 + weekly-goal
  momentum + `WaysToEarn` + `EarningsList` + `PayoutSettings` + `TaxDocsRow`;
  sticky `CashOutCTA`) · **empty** (`EarnHero empty` zeros + "Set a weekly
  goal" + `WaysToEarn` + `EmptyEarnings` + `PayoutEmpty`; sticky `BrowseCTA`
  with cash-out-gating note, **no taxes row**).
- **Slots:** `EarnHero` (reuse `BalanceHero` framed for *making* money:
  gradient `primary800→700→600`, "Available to cash out" + USD pill, glass
  card "This week" / "Lifetime (N tasks)", **`GoalProgressBar`** teal→green
  `#5eead4→#34d399` — *a bar, not a ring*) · `WaysToEarn` ("Browse open tasks
  · 28 near you · up to $140 today" / "Refer a neighbor · +$10" / "Offer a
  service", violet `#7c3aed`) · `EarningsList`/`EarnRow` (grouped by day; paid
  green vs "Pending" pill `#92400e` + "clears …") · `PayoutSettings`/`Toggle`
  ("Chase checking •••• 7421 · Instant payout · 1–3 minutes · Manage"; "Auto
  cash out · Every Friday · cleared balance" green toggle) · `PayoutEmpty`
  (dashed "Add a payout method" + "Add bank") · `TaxDocsRow` ("Tax documents ·
  YTD earnings $4,920 · 1099 available mid-Jan") · `EmptyEarnings` (dashed,
  `hand-coins`).
- **Signature copy:** overlines "Ways to earn" / "Recent earnings" / "Payout
  settings" / "Taxes"; CTA **"Cash out"** (+ amount) / empty **"Browse open
  tasks"** + gate "Cash out unlocks after your first paid task."; empty-list
  "Start earning by completing tasks · Your paid tasks land here…".
- **Build dependencies:** reuse `BalanceHero` (framed for earnings); **B1.5
  `GoalProgressBar`** (see primitive correction above).
- **Routing:** new `.earn` (iOS) / `ChildRoutes.EARN = "mailbox/earn"`
  (Android) + `pantopus://mailbox/earn`. Sits beside Wallet (earnings-in vs
  withdrawals) — see open question B-2.

---

## A18 — Status / waiting / preview

### A18.4 — Waiting for approval (`homes/[id]/waiting-room.tsx`) · DONE (B5.1 · #194, iOS + Android)
- **Status: DONE (B5.1 · #194, both platforms).** Snapshot-locked
  (`a18-4-waiting-room-{active,more-info}`). **iOS:** `Features/Status/WaitingRoom/`
  — `WaitingRoomView` + `WaitingRoomViewModel` + `WaitingRoomContent` +
  `WaitingRoomComponents`. **Android:** `ui/screens/status/waiting_room/`
  (`WaitingRoomScreen` + VM + Content). Persistent room (back arrow + bell, **not**
  the one-shot `underReview` factory); reuses `HaloCircle` (info-pulse + warning
  tones) + the `TimelineStepper`. Halo pulse animates production-only,
  `reduceMotion`-aware, static in snapshots. "Update evidence" routes to re-upload;
  "Cancel claim" is destructive with confirm. Route `.homeWaitingRoom(homeId:)` /
  `ChildRoutes.HOME_WAITING_ROOM = "homes/{homeId}/waiting-room"` +
  `pantopus://homes/:id/waiting-room`.
- **iOS:** `Status/{StatusWaitingView, StatusWaitingContent}.swift` exist with
  factories `claimSubmitted` / `underReview` / `checkYourEmail` / `resetLinkSent`
  / `passwordReset`. **Android:** `status/StatusWaitingContent.kt` mirror.
- **Why RESHAPE:** the one-shot `underReview` factory is the starting point,
  but A18.4 is the **persistent waiting room** — reachable from the home card
  any time, with a **back arrow (not a close X)** and a **notifications bell**,
  an **info-toned halo (blue, pulsing — review isn't done, so not success
  green)**, a distinct **"more info requested · review paused"** secondary
  state, and richer body (reviewer note, Update-evidence / Cancel-claim
  actions) the factory doesn't cover.
- **Proposed target:** iOS `Homes/WaitingRoom/HomeWaitingRoomView.swift`
  (reuses `Status` halo/timeline pieces); Android
  `homes/waiting_room/HomeWaitingRoomScreen.kt`.
- **Design entries:** `FrameWaitingRoomActive` (halo `kind="info"`, timeline
  current = Under review) and `FrameWaitingRoomMoreInfo` (halo `kind="warning"`,
  `TimelineWR paused`).
- **Slots:** `TopBarWR` (`kind='back'` chevron + `bell` trailing) ·
  `HaloCircleWR` (info = `primary*` rings + two `haloPulse` rings; warning =
  static amber) · `TimelineWR` (Submitted → Under review → Approved; progress
  bar `lineWidth` 0/33/66%; current node pulses or shows `alert-circle` when
  paused; done nodes success `#16A34A`) · `AddressRowWR` (home-icon pill +
  monospace claim ref) · reviewer-note card (warning) · `InlineActionsWR`
  (2-col; Update-evidence `file-plus-2` tone `primary` + Cancel-claim
  `x-circle` tone `danger`) · `StickyDockWR` (primary `View claim` + secondary
  `Back to home`).
- **Signature copy:** title "Waiting for approval"; headline "Under review" →
  "We need one more thing"; body "Pantopus is checking your documents against
  county records…" → "Your utility bill is older than 90 days…"; timeline
  "Submitted (Oct 24) · Under review (Started 9h ago / Action needed) ·
  Approved"; address "418 Linden Ave · Apt 3B · CLM-4F2A"; ETA "Decision
  usually within 24–48 hours" → "Paused · respond within 7 days"; reviewer
  note "Note from reviewer · Maya K. — …"; section "Manage this claim" /
  "Update evidence" / "Cancel claim"; dock "View claim" / "Back to home".
- **Build dependencies:** reuse `HaloCircle` (info-pulse + warning tones) and
  the existing `TimelineStepper`. **Perf:** halo pulse animates in production
  only; static in snapshots; honor `reduceMotion`.
- **Routing:** new `.homeWaitingRoom(homeId:)` (iOS) /
  `ChildRoutes.HOME_WAITING_ROOM = "homes/{homeId}/waiting-room"` (Android) +
  `pantopus://homes/:id/waiting-room`, reached from the home card while a
  claim is under review.

### A18.5 — View As (`identity/preview.tsx`) · DONE (B5.2 · #192, iOS + Android)
- **Status: DONE (B5.2 · #192, both platforms).** Snapshot-locked
  (`a18-5-view-as-{connection,public}`). **iOS:** `Features/IdentityCenter/ViewAs/`
  — `ViewAsView` + `ViewAsViewModel` + `ViewAsContent` + `ViewAsSampleData`.
  **Android:** `ui/screens/identity_center/view_as/` (mirror). Reuses B1.2
  `ViewerPicker` (flat scroll row) + `RedactionScrim`. Picking a chip re-renders the
  **entire** live profile (banner tone + badges + field redaction); there is **no
  primary CTA / sticky dock** — the rendered card is the output (only the TopBar
  Edit pill + inline "Manage privacy" → A14.7 are interactive). Chips
  `viewAs_chip_<viewer>`. Route `.identityPreview` / `ChildRoutes.IDENTITY_PREVIEW =
  "identity/preview"` + `pantopus://identity/preview`, reached from Identity Center.
- **iOS:** `IdentityCenter/` + `IdentitySwitcherSheet` exist, but **no "View
  as" preview** (`ViewAs` → 0 real hits). **Android:** same.
- **Proposed target:** iOS `IdentityCenter/ViewAs/IdentityPreviewView.swift`;
  Android `identity_center/view_as/IdentityPreviewScreen.kt`.
- **Design entries:** `FrameViewAsConnection` (rich render, banner tone
  `info`) and `FrameViewAsPublic` (heavily redacted, tone `restricted`) — the
  two endpoints of the same picker.
- **Slots:** `ChipRowVA` (= the `ViewerPicker` primitive: eye-icon header +
  **single flat horizontal-scroll row** of audience chips; active chip filled
  `p600` + shadow) · `PreviewBannerVA` ("Viewing as {x}" + **Live** badge;
  info `p50/p100/p700` vs restricted `warningBg/warningLight/#92400E`) ·
  `PreviewRenderVA` (bordered "screen-within-screen" card) · `ProfileHeadVA`
  (avatar + verified tag + identity pill personal/home) · `VBadge`
  (verification pill: on `successBg`/`#047857`, off `lock` greyed) · `FieldVA`
  (= guarded by the `RedactionScrim` primitive: visible shows value + blue
  `eye`; `hidden` renders a `repeating-linear-gradient` blur bar + italic
  "Hidden" + `lock`; `partial` = shorter bar) · `PrivacyFooterVA`
  (`shield-check` + body ending in bold **Manage privacy** link).
- **Audience set** (`VIEWERS` const, 6 chips): `Public` (globe) · `Persona
  audience` (megaphone) · `Neighbor` (map-pin) · `Connection` (user-check) ·
  `Household` (home) · `Gig participant` (briefcase). **⚠ Correction:** the
  brief described these as "grouped under Persona/Personal/Home audiences" —
  the design renders them as a **single flat scroll row**, grouping is only
  implicit in the icon/label set. Build the flat row.
- **Signature copy:** title "View as"; "Preview your profile as"; chips as
  above; banner "Viewing as a connection / the public" + "This is what they
  see / Most details are hidden" + "Live"; fields Location / Member since /
  Rating / Mutual connections / Contact (redacted = "Hidden"); badges "Address
  verified / ID verified / Phone verified / Verified neighbor"; footer
  "Connections see more because you've interacted before." / "Anyone not
  connected to you sees only this minimal card." + "Manage privacy".
- **State machine:** picking a chip re-renders the **entire** live profile
  (banner tone, badges, field redaction). **There is NO primary action /
  sticky dock — the rendered card IS the output.** Only nav affordances: the
  TopBar `Edit` pill and the inline "Manage privacy" link (→ A14.7 Privacy).
- **Routing:** new `.identityPreview` (iOS) / `ChildRoutes.IDENTITY_PREVIEW =
  "identity/preview"` (Android) + `pantopus://identity/preview`, reached from
  Identity Center.

---

## A19 — Legal / static (new archetype)

A19.1 and A19.2 share **one scaffold**; the two frames per doc differ only in
scroll state (**entry** = top of doc, TOC expanded; **mid-scroll** = TOC
collapsed, back-to-top FAB visible). No FAB-nav, no tab bar. **Do both
together** — same archetype, only the slot content changes.

### A19.1 — Privacy Policy (`legal/privacy.tsx`) · DONE (B6.1 · #193) · A19.2 — Terms of Service (`legal/terms.tsx`) · DONE (B6.1 · #193)
- **Status: DONE (B6.1 · #193, both platforms, both docs).** Snapshot-locked
  (`a19-1-privacy-{top,reading}` + `a19-2-terms-{top,reading}` — 4 rows). One
  scaffold, both docs. **iOS:** `Features/Settings/Legal/` — rebuilt
  `LegalContentView` + `LegalDocuments` (structured section bodies) + the kept
  `LegalIndexView`; plus the B1.3 primitives `Core/Design/Components/{LegalTOCCard,
  LegalSection}` (with `DocMetaStrip` + `BackToTopFab`). **Android:**
  `ui/screens/settings/legal/LegalScreens.kt` (rebuilt viewer; kept index). Section
  bodies stored as structured data mirrored word-for-word from the web copy so iOS
  + Android stay identical (Privacy "Last updated October 1, 2025 · v3.2", 10
  sections; Terms "Last updated February 14, 2026 · v5.0", 12 sections). TOC tap
  scrolls to section; collapse/expand works; `BackToTopFab` fades in past
  `scrollTop > 220`; **share is chrome**. Reached from Settings → Help & legal +
  `pantopus://legal/privacy` & `pantopus://legal/terms`.
- **iOS:** `Settings/Legal/{LegalContentView, LegalIndexView}.swift` render a
  simple block list (`LegalContentView(document: .privacy)` has Overview /
  visibility / analytics blocks). **Android:** `settings/legal/LegalScreens.kt`
  (`LegalContentScreen` + `LegalIndexScreen`; TOC = a grouped list of docs;
  viewer is a plain block list).
- **Why RESHAPE:** neither has the **in-document collapsible TOC card**, the
  **meta strip** (Last updated · version), the **back-to-top FAB**, or the new
  **10/12-section** structure with primary-tinted numbered headings.
- **Design entries:** `FramePrivacyTop` / `FramePrivacyReading` and
  `FrameTermsTop` / `FrameTermsReading`. Doc + scroll state are internal React
  state (entry = `tocOpen=true, showTop=false`; mid-scroll = `tocOpen=false,
  showTop=true`, `showTop` threshold `scrollTop > 220`).
- **Shared scaffold slots:** `LGTopBar({title})` (back + centered title +
  `share`) · `MetaStrip` (= `DocMetaStrip`: sunken `#f3f4f6`, `clock` +
  "Last updated: … · Version …") · `TOCCard({items, open, onToggle})` (=
  `LegalTOCCard`: "Jump to section", `list` icon `primary600`; collapsed shows
  "{n} sections"; rows `href="#sec-{i}"` with `00`-padded chips `primary50`/
  `primary700`) · `H2({n})` (primary-tinted `#0369a1`, `id="sec-{n}"`, mono
  number tag `#0284c7`) · `H3` / `P` / `DT` (bold defined term) · `Bullets`
  (dotted list, 5px `primary600` bullet) · `ContactFooter({email, label})`
  ("Contact us" card, `primary50`/`primary100`, `mailto:`) · `BackToTop` (=
  `BackToTopFab`: bottom-right `arrow-up`, fades in on scroll, smooth
  scroll-to-top).
- **A19.1 Privacy sections** (verbatim, in order): 1. Overview · 2. Information
  we collect · 3. How we use it · 4. Identity pillars & privacy · 5. Sharing &
  disclosure · 6. Your rights & controls · 7. Data retention · 8. Children &
  teens · 9. International transfers · 10. Changes to this policy. **Meta:**
  "Last updated October 1, 2025 · v3.2". **Footer:** `privacy@pantopus.com`,
  "Questions about this policy?".
- **A19.2 Terms sections** (verbatim, in order): 1. Acceptance of these terms ·
  2. Eligibility & accounts · 3. Identity pillars · 4. Acceptable use · 5.
  Content & licenses · 6. Tokens, invites & access · 7. Payments & gigs · 8.
  Termination · 9. Disclaimers · 10. Limitation of liability · 11. Governing
  law & disputes · 12. Changes to these terms. **Meta:** "Last updated February
  14, 2026 · v5.0". **Footer:** `legal@pantopus.com`, "Questions about these
  terms?".
- **Interactions:** TOC row → in-page scroll to `#sec-{n}`; collapse/expand
  toggles `tocOpen` (collapsed shows a summary count row); `BackToTopFab` fades
  in past `scrollTop > 220` and smooth-scrolls to 0; `share` is chrome only.
- **Build dependencies:** `LegalTOCCard`, `DocMetaStrip`, `BackToTopFab`
  (B1.3). The full section bodies should be stored as structured data (the web
  copy is authoritative — mirror it word-for-word so the two platforms stay
  identical).
- **Routing:** `LegalContentView` / `LegalContentScreen`, reached from Settings
  → Help & legal → Privacy policy / Terms, and `pantopus://legal/privacy` /
  `pantopus://legal/terms`.

---

## Drift & environment findings (from prompt B0 verification)

These were confirmed against the live codebase during B0 and should be
honored by every later B-prompt.

- **D1 — these docs were net-new.** Neither `new-design-parity-batch2.md` nor
  `claude-code-prompts-batch2.md` existed before this pass; they are created
  in the B0 follow-up (this file + its companion).
- **D2 — Android `ChildRoutes` location.** It lives in
  `ui/screens/root/RootTabScreen.kt`, **not** `core/routing` (only
  `DeepLinkRouter.kt` is under `core/routing`). New route consts go in
  `RootTabScreen.kt`; deep-link parsing goes in `DeepLinkRouter.kt`.
- **D3 — `waiting-room-frames.jsx` was already vendored** and was refreshed in
  B0 to the latest hand-off (React prop rename `ref` → `claimRef`).
- **D4 — `MapPreview` needs a static map asset.** A10.6/A10.7 reference
  `assets/business-map.png` (not vendored by B0, which copied only the
  prompt-listed files). B1.4 must either vendor that PNG or render a seeded
  token-pure street-grid placeholder (matching the `FuzzMap` approach).
- **D5 — `verify-tokens.sh` baseline is non-zero (73 call-sites).** It is
  wired into iOS `make lint` but **not** into CI; CI enforces only
  `swiftlint --strict` + `swiftformat --lint` + a narrow `#RRGGBB` grep over
  `Pantopus/Features`. The script flags 14 hex / 47 spacing / 2 radii / 10
  typography pre-existing literals. **Enforce "zero NEW" as a delta vs this
  73-site baseline**, not an absolute exit-0. New primitives land in
  `Core/Design/Components` + `ui/components`, which the script **does** scan —
  so a sloppy primitive *will* raise the count.
- **D6 — build/snapshot verification is CI-only in the cloud env.** The
  managed Linux execution environment has **no Xcode/Swift** and **no Android
  SDK**, so the iOS snapshot target, `xcodebuild`, `./gradlew detekt`,
  `paparazzi`, and `assembleDebug` **cannot run in-session** — they validate
  on `ios-ci.yml` (macos-15) and `android-ci.yml`. Only `verify-icons.sh` and
  `verify-tokens.sh` (grep guards) run locally here.

---

## Open questions for product / design — RESOLVED (B7.1)

- **B-1 — Mail task list (A17.12). ✅ Resolved: detail only.** B2.2 (#186)
  shipped just the **task detail** (`open` / `done`). The mail-derived tasks
  **list/index** is confirmed a separate, later item — not in this batch.
  Tracked as a follow-up; out of scope here.
- **B-2 — Earn vs Wallet (A10.11 vs A10.10). ✅ Resolved: both exist,
  distinct.** Native ships **both** — `Earn` (earnings-in) via
  `pantopus://mailbox/earn` and `Wallet` (withdrawals/balance, A10.10) keeping
  its entry. The native `Earn` surface is the canonical home (web still
  `redirect()`s to payments). Mirrors the P5.2 Wallet-vs-Payments split.
- **B-3 — `GoalProgressBar` vs `ProgressRing`. ⚠ Resolved against the audit
  recommendation — shipped a `ProgressRing` donut.** B1.5 (#182) shipped
  **`ProgressRing`** (a generic donut: track circle + trimmed accent arc +
  centre label) under `Core/Design/Components` / `ui/components`, and A10.11's
  `WeeklyGoalCard` consumes it as a 64pt green goal ring on a surface card. This
  **diverges** from the design's in-hero gradient **bar** (the audit's "ship a
  bar, not a donut" correction was not followed). The divergence is consistent
  across iOS↔Android and snapshot-locked on the implementation side; the locked
  **design** baseline (`a10-11-earn-populated`) still shows the bar. **Flagged
  for design review** as a fidelity follow-up (either re-skin `WeeklyGoalCard` to
  the in-hero bar, or bless the ring and re-cut the design pack with sign-off per
  `NEW_DESIGNS_BATCH2.md`). `ProgressRing` being generic means a second consumer
  (profile strength, task completion) can reuse it, so it is not orphaned.
- **B-4 — New accent tokens. ✅ Resolved: named tokens, confirmed naming.**
  Landed as named tokens on both platforms (iOS asset-catalog `Category/*` +
  `Theme.Color`, Android `PantopusColors`): `categoryStamps` `#0e7490`,
  `categoryTask` `#4f46e5`, the `categoryTranslation` family (`#be185d` + bg /
  ink / paper / paper-ink), `categoryUnboxing` (+ Dark/Bg/Border), and the
  business-violet `#6d28d9` family + category accents (B1.4/B1.5). No raw hex in
  any batch-2 screen folder (verify-tokens confirms; the 14 remaining hex flags
  are all pre-existing in batch-1 `MailThumb.swift`).
- **B-5 — Camera capture scope (A17.14). ✅ Resolved: seeded viewfinder now,
  live capture deferred.** B2.4 (#189) ships the **decorative seeded
  viewfinder** (static framing + striping, scan-line animates production-only,
  `reduceMotion`-aware, static in snapshots). The real `AVCaptureSession` /
  CameraX preview + camera-permission prompt + still-frame fallback are deferred
  to a production capture follow-up; the `CameraScanner` primitive (B1.1) is
  shaped to back onto them without a screen rewrite.

---

## Batch-2 closeout (B7.1) — what landed

- **Snapshot lockfile (this PR).** `render-new-designs-batch2.mjs` renders the
  11 in-scope design HTMLs into **22 platform-neutral baseline PNGs** (11 screens
  × 2 designed states), written byte-identically to both
  `frontend/apps/ios/PantopusTests/Features/__snapshots__/new-designs-batch2/`
  and `frontend/apps/android/app/src/test/snapshots/images/new-designs-batch2/`.
  Presence tripwires lock them: iOS `T8ScreensSnapshotTests.swift`, Android
  `NewDesignBatch2ScreensSnapshotTest.kt` (both mirror the batch-1
  `NewDesignScreens*` rigs — file present, > 4 KB, PNG magic bytes; no Android
  SDK / Xcode needed). Regeneration policy in `NEW_DESIGNS_BATCH2.md`.
- **B1 primitives — all consumed (no orphans).** `PerforatedStamp`/`Postmark`
  (A17.11), `CameraScanner` + `OcrFactsList` (A17.14 + A17.13 facts),
  `ViewerPicker` + `RedactionScrim` (A18.5), `LegalTOCCard` + `DocMetaStrip` +
  `BackToTopFab` + `LegalSection` (A19), `BizBannerHeader` + `GalleryStrip` +
  `RatingDistribution` + `MapPreview` (A10.6/7), `ProgressRing` (A10.11, see B-3).
- **Tooling.** iOS `verify-icons.sh` green; `verify-tokens.sh` is delta-gated
  (per drift D5, not a CI gate) and this PR touches no scanned source, so adds
  **zero** new flagged sites; the CI `#RRGGBB` hex grep over `Pantopus/Features`
  is clean and all 11 batch-2 folders carry **zero** hex literals; flagged
  spacing/typography in batch-2 files use **on-scale** values via the raw
  `.padding()`/`.font(.system())` API form (a style nit, not off-scale values).
  Android `detekt` validates green on `android-ci.yml` (CI-only — no Android SDK
  in the cloud env, per drift D6). Primary CTAs, back-nav, and state mutations
  are wired; residual no-op affordances are design-blessed top-bar chrome
  (bookmark / share / more) plus the Stamps/Unboxing quick-action chip rows
  (scoped stubs, no Stripe/system hooks this batch).

---

*End of batch-2 audit — closed out by B7.1. Companion prompt set:
`docs/claude-code-prompts-batch2.md`.*
