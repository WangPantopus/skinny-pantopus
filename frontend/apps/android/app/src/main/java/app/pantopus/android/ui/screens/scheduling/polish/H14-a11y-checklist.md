# Calendarly — H14 Accessibility & Large-Text Checklist (Stream A18)

Cross-cutting accessibility pass over the merged Calendarly surface on
`feature/calendarly-android`. Per the A18 contract this stream **only ships its
own files** (`ui/screens/scheduling/polish/**`): it adds reusable a11y helpers
(`A11yChecklist.kt` → `SchedulingA11y`, `Modifier.a11yMinTapTarget`,
`Modifier.a11yFocusRing`), encodes the contract as testable data
(`SchedulingA11yAudit.findings`), adopts them in its own H15 screen, and **files
Foundation-gap / per-stream follow-ups** for gaps inside other streams' files
rather than editing them (preserving disjoint ownership).

The structured, test-backed version of this report is `A11yChecklist.kt`
(`SchedulingA11yAudit.findings`). Keep the two in sync.

## The contract (from the H14 design)

1. **48dp targets** — every interactive control ≥48dp (Android Material floor;
   iOS uses 44pt), including at the largest font scale. Use
   `Modifier.a11yMinTapTarget()`.
2. **Full slot labels** — each slot button announces `"<date>, <time>,
   available/taken"`, not just the time. Use `SchedulingA11y.slotLabel(...)`.
3. **Timezone affordance** — `"Times shown in <tz>"` is text; a host/viewer
   mismatch is spoken (`"…, host is in Eastern Time"`), never color. Use
   `SchedulingA11y.timezoneLabel(viewer, host)`.
4. **Text, not color alone** — availability, status, and conflicts carry text or
   shape, not just a hue.
5. **Large-text reflow** — dense slot grids collapse to a single stacked list at
   accessibility font scales; day numbers never truncate. Gate columns with
   `SchedulingA11y.slotColumns(fontScale)` (read `LocalDensity`/configuration
   `fontScale`).
6. **Visible focus ring** — focused controls show a ring. Use
   `Modifier.a11yFocusRing(active, accent)`.
7. **Reduce motion** — confetti / pulses are suppressed under reduce-motion. The
   shared `ConfettiSpray` and `HaloCircle` already read `rememberReduceMotion()`.
8. **Test tags** — every routed screen + key control has a stable
   `Modifier.testTag` (mirrors iOS `accessibilityIdentifier`).

## How to apply (each stream applies to its OWN files — no cross-folder edits by A18)

- Verify on an emulator with **large font** (`adb shell settings put system
  font_scale 1.3`); confirm screens reflow and nothing truncates.
- Run **TalkBack**: every slot, chip, toggle, and CTA announces a meaningful
  label; decorative icons pass `contentDescription = null`.
- Confirm every interactive control is ≥48dp at default AND large text.
- Confirm availability/status/conflicts are never color-only.

## What passes today

- **`_shared/SlotPicker.SlotTimeList`** — slots already render as full-width
  grouped rows (Morning / Afternoon / Evening), not a fixed 40×40 grid, so the
  large-text reflow requirement is satisfied for the time column.
- **Shared motion** — `HaloCircle` pulse and `ConfettiSpray` gate on
  `rememberReduceMotion()`.
- **H15 (this stream)** — one real labelled OTP `BasicTextField` behind the
  decorative boxes, ≥48dp targets, visible focus ring, color-independent state,
  full testTag coverage.

## Gaps → Foundation-gap follow-ups (do NOT edit other streams' files)

These all live in Foundation `_shared/` files (owned by A0). A18 files them as
Foundation-gap notes; the one-line fix is adopting the `SchedulingA11y` helpers.

| # | Slug | Surface (owner) | Gap | Suggested fix |
|---|------|-----------------|-----|---------------|
| 1 | `a18-a11y-slotrow-target` | `_shared/SlotPicker.SlotRow` (A0) | Row sets vertical padding only (~44dp); no `minHeight` floor. | Apply `Modifier.a11yMinTapTarget()` (or `heightIn(min = 48.dp)`) to the row. |
| 2 | `a18-a11y-slotrow-label` | `_shared/SlotPicker.SlotRow` (A0) | `contentDescription` is time-only; date + ', available' not announced. | Build the label from `SchedulingA11y.slotLabel(date, time, isAvailable)`. |
| 3 | `a18-a11y-daycell-target` | `_shared/SlotPicker.MonthCalendar.DayCell` (A0) | Day cell is 36dp (disc 34dp), below 48dp. | Apply `Modifier.a11yMinTapTarget()` to the day cell. |
| 4 | `a18-a11y-daycell-label` | `_shared/SlotPicker.MonthCalendar.DayCell` (A0) | No `contentDescription`; availability is an accent dot only. | Add a label appending ', available'/', today'/', unavailable'. |
| 5 | `a18-a11y-timezone-mismatch` | `_shared/TimezonePicker` (A0) | Host/viewer mismatch is not spoken. | Use `SchedulingA11y.timezoneLabel(viewer, host)` for the chip's label. |

All five are one-line adoptions of the helpers in `A11yChecklist.kt`; folding the
helpers into the Foundation `_shared/` components fixes every consumer at once.
