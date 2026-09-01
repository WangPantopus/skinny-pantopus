# MailItemDetail · Android

The shared shell every mail-item-detail screen on Android ships on
top of. Introduced in T6.5a (P19) to express the **A17 mailbox
archetype** — the 8-slot composition that the four T6 mailbox
variants (Generic / Booklet / Certified / Community) all render
through.

| File | Role |
|---|---|
| `MailItemDetailShell.kt` | The composable shell — wraps the 8 slots in a `LazyColumn`-style scroll with a sticky action bar; renders sticky bottom CTAs when non-empty. |
| `MailItemDetailState.kt` | `MailItemDetailUiState` (Loading / Loaded / Empty / Error), `MailTopBarConfig`, `AIElfStripContent`, `AttachmentsRowContent`, `Attachment.{Pdf, Image, Video, Audio, Link, Other}`. |
| `ChainOfCustodyTimeline.kt` | T6.5c-lifted shared vertical timeline. Re-used by Certified mail and (future) package-delivery / Community RSVP timelines. |

## When to use this shell

Reuse the shell whenever the design is:

> a vertically scrolling mail-item or document detail with up to 8
> stacked sections — top nav, hero card, AI elf strip, key facts,
> body, attachments, sender card, sticky actions.

T6.5b–T6.5d ship 4 mail variants on this shell:
- **A17.1 Generic** — every-default detail.
- **A17.2 Booklet** — `BookletPager` swaps the body slot; primary
  action "Save to Vault".
- **A17.3 Certified** — `CertifiedStampBadge` + `ChainOfCustodyTimeline`
  + `CombinedSenderCarrierCard`; primary action "Acknowledge receipt"
  wired to `PATCH /api/mailbox/:id/ack`.
- **A17.4 Community** — community event card + RSVP chip group;
  primary action posts `POST /api/mailbox/v2/community/rsvp`.

**If a future mail variant doesn't fit the 8 slots**, propose an
additive extension here first (a new optional slot, a sealed
`Attachment` subtype, an additional `MailTopBarConfig.overflow`
item) — never widen an existing slot in a way that breaks v1
callers.

## Anatomy

```
┌────────────────────────────────────────────────┐
│ ◀  ●  CATEGORY  ★  ⋮                           │  TopNav    (required)
├────────────────────────────────────────────────┤
│ ╭──────── Hero card ────────────────────╮      │  Hero      (required slot)
│ │ accent strip · sender · title · excerpt│      │
│ ╰────────────────────────────────────────╯     │
├────────────────────────────────────────────────┤
│ ✨ AI elf · summary · • point • point  · redo │  AIElfStrip(opt)
├────────────────────────────────────────────────┤
│ ╭──── Key facts ──────────────────────╮       │  KeyFacts (required slot)
│ │ ◉ Received · ◉ Expires · ◉ Amount … │       │
│ ╰─────────────────────────────────────╯       │
├────────────────────────────────────────────────┤
│ ╭──── Body ────────────────────────────╮      │  Body     (required slot)
│ │ Paragraph 1.                          │      │
│ │ Paragraph 2.                          │      │
│ ╰───────────────────────────────────────╯     │
├────────────────────────────────────────────────┤
│ [PDF] [IMG] [VID] [AUD] [URL]                  │  Attachments (opt)
├────────────────────────────────────────────────┤
│ ╭──── Sender card ─────────────────────╮      │  Sender   (required slot)
│ │ ⊙  Name · Dept · ✓ Verified           │     │
│ ╰───────────────────────────────────────╯     │
├────────────────────────────────────────────────┤
│ [ Acknowledge receipt ]   [ Forward ]          │  Actions  (sticky bottom)
└────────────────────────────────────────────────┘
```

## Slot contract

Slots in render order (top → bottom):

| # | Slot | Type | Role |
|---|---|---|---|
| 1 | `nav` | `MailTopBarConfig` (required) | back callback + eyebrow trust dot (`.verified` / `.neutral` / `.warning`) + optional bookmark/pin + overflow menu list (Forward / Archive / Mark unread / Delete / Report — variants add or drop items). |
| 2 | `hero` | `@Composable () -> Unit` (required) | accent strip + sender overline + title + excerpt. Variants build the gradient card (verified-green / neutral / warning-amber). |
| 3 | `aiElf` | `AIElfStripContent?` (optional, shell-rendered) | sparkles disc + headline + summary paragraph + bullet list + optional trailing badge + optional redo. |
| 4 | `keyFacts` | `@Composable () -> Unit` (required) | sunken-bg key-value panel. |
| 5 | `body` | `@Composable () -> Unit` (required) | full-text body card or replacement (booklet pager, ceremonial paper). |
| 6 | `attachments` | `AttachmentsRowContent?` (optional, shell-rendered) | list of `Attachment` items with per-kind 36×44 tile colours. |
| 7 | `sender` | `@Composable () -> Unit` (required) | sender card. |
| 8 | `actions` | `@Composable () -> Unit`, sticky bottom | bottom action button row. Auto-hidden when content is `null`. |

## Test tag parity (root container)

Both platforms + web use the same identifier — `mailItemDetailShell`
— plus child tags (see the iOS README for the full list). The same
string lives on iOS (`accessibilityIdentifier`), Android
(`Modifier.testTag`), and web (`data-testid`) so cross-platform UI
tests can mirror.

## Lifecycle states

Every fetchable surface ships **four**:

1. **`Loading`** — shimmer skeleton mirroring the loaded geometry.
2. **`Empty`** — currently unreachable for mail detail; reserved.
3. **`Loaded`** — content rendered through the 8-slot layout.
4. **`Error(message)`** — `ErrorBanner` with `Retry` wired to the
   view-model's `refresh()`.

## See it rendered

The web has `/mail-item-detail-preview` for the designer-facing
sanity check. Locally:
`./gradlew app:installDebug` and navigate the debug menu to
"Mailbox A17 detail · preview" to see the same three configurations
rendered against Paparazzi.

## Snapshot baselines

Paparazzi baselines:
`frontend/apps/android/app/src/test/snapshots/images/app.pantopus.android.ui.screens.shared.mail_item_detail_*` —
one PNG per `MailItemDetailShellSnapshotTest` test case. CI's
`./gradlew paparazziVerify` step diffs against them on every PR.

Design-reference PNGs (the visual contract) live alongside the iOS
baselines under `__snapshots__/t6/` for cross-platform parity.

## Adding a new mail variant

1. **Walk the design.** Confirm the variant fits the 8 slots. If it
   needs a new slot, discuss it first.
2. **Compose** a `MailDetailContent.<variant>Detail` sealed-class
   case that decodes from the `mail.object` JSONB on the wire
   (defensive decode — return null when required fields are missing
   so the generic A17.1 still renders).
3. **Build** a `<Variant>Detail` composable that supplies the 6
   generic slots; reuse the shell's AI-elf-strip + attachments
   rendering.
4. **Wire** the variant dispatch in the existing
   `MailDetailViewModel.kt` — no new endpoint surface unless the
   variant has its own backend route.
5. **Tests.** `MailDetailViewModelTest.kt` covers
   load → loaded / empty / error + variant-specific dispatch.
   Paparazzi snapshot baseline lands via `paparazziRecord`.
6. **Parity audit + wiring audit** rows for the new variant.

## Cross-reference — A17 catalogue

The 4 mail variants this shell powers, mapped to their backend
sources and detail-decoder structs:

| Variant | Android composable | `MailDetailContent` case | Backend object decoder |
|---|---|---|---|
| A17.1 Generic | `ui/screens/mailbox/mail_detail/MailDetailScreen.kt` (default) | `Generic` | `GenericDetailDto` |
| A17.2 Booklet | (same screen + `BookletPager` body slot) | `Booklet` | `BookletDetailDto` |
| A17.3 Certified | (same screen + Certified hero badge + custody timeline) | `Certified` | `CertifiedDetailDto` |
| A17.4 Community | (same screen + community cards) | `Community` | `CommunityDetailDto` |

— Pantopus T6.5a
