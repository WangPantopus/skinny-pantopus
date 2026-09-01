# MailItemDetail · iOS

The shared shell every mail-item-detail screen on iOS ships on top of.
Introduced in T6.5a (P19) to express the **A17 mailbox archetype** —
the 8-slot composition that the four T6 mailbox variants (Generic /
Booklet / Certified / Community) all render through.

| File | Role |
|---|---|
| `MailItemDetailShell.swift` | The view shell — wraps the 8 slots in a scroll container with sticky action bar; renders sticky bottom CTAs when non-empty. |
| `MailItemDetailState.swift` | `MailItemDetailUiState` (loading / loaded / empty / error), `MailTopBarConfig`, `AIElfStripContent`, `AttachmentsRowContent`, `Attachment(.pdf / .image / .video / .audio / .link / .other)`. |
| `ChainOfCustodyTimeline.swift` | T6.5c-lifted shared vertical timeline. Re-used by Certified mail and (future) package-delivery / Community RSVP timelines. |

## When to use this shell

Reuse the shell whenever the design is:

> a vertically scrolling mail-item or document detail with up to 8
> stacked sections — top nav, hero card, AI elf strip, key facts,
> body, attachments, sender card, sticky actions.

T6.5b–T6.5d ship 4 mail variants on this shell:
- **A17.1 Generic** — every-default detail (no booklet pager, no
  certified stamp, no community card).
- **A17.2 Booklet** — `BookletPager` swaps the body slot; thumbnail-
  grid mode; primary action is "Save to Vault".
- **A17.3 Certified** — `CertifiedStampBadge` on the hero; emphasis on
  key-fact rows; `ChainOfCustodyTimeline` + `CombinedSenderCarrierCard`;
  primary action is "Acknowledge receipt".
- **A17.4 Community** — "You're going" check chip; `CommunityBadgeCard`
  + `CommunityEventCard` + `CommunityAttendeesStrip` +
  `CommunityPulseThreadCard`; primary action is the RSVP chip group.

**If a future mail variant doesn't fit the 8 slots**, propose an
additive extension here first (a new optional slot, a sealed
`Attachment` case, an additional `MailTopBarConfig.overflow` item) —
never widen an existing slot in a way that breaks v1 callers.

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
| 2 | `hero` | generic `View` slot (required) | accent strip + sender overline + title + excerpt. Variants build the gradient card (verified-green / neutral / warning-amber). |
| 3 | `aiElf` | `AIElfStripContent?` (optional, shell-rendered) | sparkles disc + headline + summary paragraph + bullet list + optional trailing badge + optional redo. |
| 4 | `keyFacts` | generic `View` slot (required) | sunken-bg key-value panel with icon + label + value items. |
| 5 | `body` | generic `View` slot (required) | full-text body card or replacement (booklet pager, ceremonial paper). |
| 6 | `attachments` | `AttachmentsRowContent?` (optional, shell-rendered) | list of `Attachment` items with per-kind 36×44 tile colours. |
| 7 | `sender` | generic `View` slot (required) | sender card (avatar + dept + verification kind + proof). |
| 8 | `actions` | generic `View` slot, sticky bottom | bottom action button row. Auto-hidden when nil. |

## Test tag parity (root container)

Both platforms + web use the same identifier — `mailItemDetailShell`
— plus child tags:

| Tag | Wraps |
|---|---|
| `mailItemDetail_topBar` | top-nav wrapper |
| `mailItemDetail_eyebrow` | eyebrow trust dot |
| `mailItemDetail_back` | back chevron |
| `mailItemDetail_trailingAction` | bookmark / pin trailing action |
| `mailItemDetail_overflow` | overflow menu button |
| `mailItemDetail_overflowItem_<id>` | per-overflow-menu-item |
| `mailItemDetail_hero` | hero slot wrapper |
| `mailItemDetail_aiElf` | AI elf strip wrapper |
| `mailItemDetail_aiElfBadge` | optional trailing badge inside AI elf |
| `mailItemDetail_aiElfRedo` | redo affordance inside AI elf |
| `mailItemDetail_keyFacts` | key-facts slot wrapper |
| `mailItemDetail_body` | body slot wrapper |
| `mailItemDetail_attachments` | attachments row wrapper |
| `mailItemDetail_attachment_<id>` | per-attachment tile |
| `mailItemDetail_sender` | sender slot wrapper |
| `mailItemDetail_actions` | sticky action bar wrapper |

The same string lives on iOS (`accessibilityIdentifier`), Android
(`Modifier.testTag`), and web (`data-testid`) so cross-platform UI
tests can mirror.

## Lifecycle states

Every fetchable surface ships **four**:

1. **`.loading`** — shimmer skeleton mirroring the loaded geometry.
2. **`.empty`** — currently unreachable for mail detail (mail items
   either exist or 404 to an error); reserved for future inbox-zero
   states.
3. **`.loaded`** — content rendered through the 8-slot layout.
4. **`.error(message:)`** — `ErrorBanner` with `Retry` wired to
   `viewModel.refresh()`.

## See it rendered

The web has a `/mail-item-detail-preview` route that renders three
example configurations (every slot supplied · required slots only ·
nil-skipping) so the designer can sanity-check spacing, trust dot,
AI elf, and attachments tiles. Run `pnpm -F @pantopus/web dev`,
navigate to `http://localhost:3000/mail-item-detail-preview`.

## Snapshot baselines

Design-reference PNGs (the visual contract):
`frontend/apps/ios/PantopusTests/__Snapshots__/t6/<screen>-ios.png` —
includes `mail-item-generic.png`, `booklet.png`, `certified.png`,
`community.png`, `mail-detail.png`.

Drift on the design reference is caught by `T6ScreensSnapshotTests.swift`
(file-presence + non-trivial PNG assertions, same tripwire as T5).

## Adding a new mail variant

1. **Walk the design.** Confirm the variant fits the 8 slots. If it
   needs a new slot, discuss it first — the bar is the same as
   `ListOfRows` (two screens of demand before adding a slot).
2. **Compose** a `MailDetailContent.<variant>Detail` case that
   decodes from the `mail.object` JSONB on the wire (defensive
   decode — return nil when required fields are missing so the
   generic A17.1 still renders).
3. **Build** a `<Variant>Detail` view that supplies the 6 generic
   slots; reuse the shell's AI-elf-strip + attachments rendering.
4. **Wire** the variant dispatch in the existing
   `MailDetailViewModel` — no new endpoint surface unless the
   variant has its own backend route.
5. **Tests.** `MailDetailViewModelTests.swift` covers
   load → loaded / empty / error + variant-specific dispatch.
   Snapshot baseline lands in `T6ScreensSnapshotTests.swift`.
6. **Parity audit + wiring audit** rows for the new variant.

The longer doc-of-record for the archetype is in
`docs/t6-buildout-plan.md` §E.1 and `docs/mobile-parity-audit.md`
"T6.5a — A17 Mailbox item detail archetype shell (P19)" preamble.

## Cross-reference — A17 catalogue

The 4 mail variants this shell powers, mapped to their backend
sources and detail-decoder structs:

| Variant | iOS view file | `MailDetailContent` case | Backend object decoder |
|---|---|---|---|
| A17.1 Generic | `Features/Mailbox/MailDetail/MailDetailView.swift` (default) | `.generic` | `GenericDetailDTO` (best-effort field-by-field) |
| A17.2 Booklet | (same view + `BookletPager` body slot) | `.booklet` | `BookletDetailDTO` (pages[], pageMode initial) |
| A17.3 Certified | (same view + Certified hero badge + custody timeline) | `.certified` | `CertifiedDetailDTO` (tracking, postmark, ackBy) |
| A17.4 Community | (same view + community cards) | `.community` | `CommunityDetailDTO` (event, attendees, rsvp) |

— Pantopus T6.5a
