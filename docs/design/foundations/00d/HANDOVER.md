# Foundations 00d — handoff

States, feedback and asks. Eight components, 45 artboards, drawn on the Foundations 00d specimen board before any screen was designed.

This file is written to be committed into `skinny-pantopus`, so that `tools/design-system/build.mjs` can generate the eight cards from real code instead of the hand-written placeholders now sitting in the design system. Until that happens the cards in the system carry `Source: Foundations board 00d` in place of a repo path, and nothing imports them.

Everything below was verified against the board on 22 Sep 2026. Fixture date TODAY on the board is **Mon 19 Oct 2026**.

**The eight:** QuietDayReceipt, WarmingSkeleton, InlineUndo, DestructiveConfirm, LandingBannerSlot, NotificationAsk, PushCopy, ReminderLeadControl.

---

## A. Reconciliation — settled

Nine shipped components overlap the 00d specimens, and four of this board's rows belong to Foundations 00c. Nothing shipped was renamed or edited. The precedence rule, until each is migrated in code:

> **The Foundations version governs anything the Pantopus prompt pack draws or changes. The shipped component stays as it is everywhere the pack leaves untouched.**

### A.1 The shipped components

| # | 00d component | Shipped | Decision |
| --- | --- | --- | --- |
| 1 | WarmingSkeleton | `ShimmerLine` | **Extend.** Add a block-level band at 30% width and a four-pass stop; keep the 16px bar geometry. The dark fill becomes `app-border-strong` on dark raised, since `app-surface-sunken` equals `app-surface` there. |
| 2 | WarmingSkeleton | `ShimmerBlock` | **Extend.** Keep the free-size className API; add the instrument sizes as presets (strip 361×40, year band 361×120, scale strip 4×48, bill trend 12×16) and the `replaced-progressively` state. |
| 3 | DestructiveConfirm | `BottomSheet` | **Extend.** Add a non-dismissible path so `deleting` can suppress Escape, Back, the scrim and swipe. The 40% black backdrop becomes `app-text` at 40%. |
| 4 | DestructiveConfirm | `ModalShell` | **Separate.** Stays for forms. Its emerald-600 submit (3.77:1) and title-case "Go Back" do not belong on a destructive confirm — and are worth fixing on `ModalShell` regardless. |
| 5 | DestructiveConfirm | `ProgressSegments` | **Not reused.** The `deleting` bar is a determinate operation over a real loss, not a wizard stepper; house invariant 6 forbids dressing it as a completion score. Build a separate `OperationProgress` — the one new component this batch asks for. |
| 6 | InlineUndo | `Toast` | **Separate.** `Toast` keeps the confirmations there is nothing to undo. Its warning fill at 1.73:1 in dark still wants fixing. |
| 7 | InlineUndo | `TextButton` | **Shared style** on `color-link` (5.93:1), not `color-primary-600` (4.10:1), reached through 00c's `TextActionRow`. |
| 8 | LandingBannerSlot | `InfoNote` | **Separate.** A slot with a nine-source queue against a static note inside a card; the overlap is visual, not functional. |
| 9 | NotificationAsk, ReminderLeadControl | `Chip` | **Collapsed into `ChoiceChip`** (Foundations 00a) — referenced, not redrawn. `ChoiceChip` already carries the `color-primary-50` fill with its 1px `color-primary-700` outline and leading check, the `disabled` state with a reason caption, and the full-width row fallback below ~360px. `Chip` states a status and is never selectable. |

**What 00a is adding:** the passed-lead form on `ChoiceChip`'s `disabled` state — the date in words ("Tue 13 Oct 2026 · passed") plus the nearest working lead ("Use 7 days instead"). That is the only thing ReminderLeadControl needs beyond what `ChoiceChip` already has.

### A.2 The rows belong to Foundations 00c

Four places on this board draw a row, and 00c owns all four:

| Where | 00c component |
| --- | --- |
| QuietDayReceipt's failed check item | `InlineErrorRow` at `provider-unreachable` |
| QuietDayReceipt's `briefing-settings-row` | `NotificationRow` |
| NotificationAsk's blocked-notification row | `NotificationRow` |
| InlineUndo's Undo / Retry action | `TextActionRow` |

**What 00c needs to add:**

- **`InlineErrorRow`** — a **check-item placement**: the alert glyph in the receipt's existing mark column, the row keeping the list's own height and alignment rather than the component's own 44pt slot. And a **no-retry form** for `widget-one-liner`, where there is no room for an action. Its "16pt alert glyph" should be pinned to the **triangle**, since R13 forbids the alert-circle.
- **`NotificationRow`** — a **settings variant**: no dot column, a trailing control, a last-sent caption ("Last sent Wed 14 Oct, 6:00 PM"). And an **`os-blocked` state** distinct from `push-off`: `push-off` is the person turning notifications off in the app, while `os-blocked` means Android has blocked them, so "Your phone will ask next." is false and the row must carry "Open Settings".
- **`TextActionRow`** — an **`undo` variant**: one text button, trailing, inside the row it changed, with the states `pending`, `undone` and `committed`. This breaks that component's placement rule — actions on the page surface under the content card, never competing with the primary control — and breaks it deliberately: an undo belongs in the row it changed, and for those few seconds it *is* the most important control on the screen. Worth settling as a rule of its own rather than an exception.

## B. What each component needs in the repo

Each entry gives the props the card documents, the variant and state keys as published, and the decisions the code has to carry.

### QuietDayReceipt — `00d-01`

- **Variants:** `today-full`, `widget-one-liner`, `briefing-settings-row`, `strip-empty`, `year-band-empty`, `checkitem-with-time`
- **States:** `all-ticked`, `one-pending`, `one-failed`
- Four check items: weather, air, alerts, your calendar. A checked item may carry its reading time.
- Three marks: tick (checked), **three 3pt rounded squares** (pending), alert **triangle** (failed). No disc, no ring, no alert-circle — R13.
- Failed item: message in `bodySmall` `app-text` on the row, 12pt below the tick row, plus "Retry" at 44pt.
- Widget radius 24 (`radius-3xl`). At AX sizes the widget is text only, 20/28 cap, three lines max in 306×126pt.
- Spoken label names the heading, every item and the time.

### WarmingSkeleton — `00d-02`

- **Variants:** `section-skeleton`, `row-skeleton`, `instrument-skeleton-strip`, `instrument-skeleton-year-band`, `instrument-skeleton-scale-strip`, `instrument-skeleton-bill-trend`, `panel-skeleton`
- **States:** `shimmer`, `static`, `replaced-progressively` (`panel-skeleton` has no third state)
- Window 1–10s. Under 1s show nothing new and keep the old content.
- One band per block, 30% of block width, 1.2s per pass, four passes (4.8s), then static. This is the 5s idle-loop rule, not the 300ms transition rule.
- Filled shapes, never frame-only. Shapes sit on `app-surface` cards, not on the app ground.
- Dark: `app-surface-sunken` equals `app-surface`, so shapes take `app-border-strong` on dark raised.
- Reduce Motion: no band; replacements cross-fade.
- No skeleton at all for fail-closed surfaces: founding meter, Earn row, LandingBannerSlot.
- Geometry drawn: V1 pickup card internal spacing 16 / 42 / 16 / 20 / 4 / 14 / 24 / 44 / 16 to reach 196pt exactly; V1 air band 96×12pt label bar beside a 217×12pt track, centred in a 48pt row; V3b year band has a 48pt lane-label gutter, a 24pt month header and four 24pt lanes, cells 22.42pt; V4 panel 361×240pt in a 361pt card, 120×14pt caption bar, 282pt total.
- At AX5 and Android 200% each bar takes the R17 point size of the text it replaces; the KindGlyph square and the avatar scale 2×; the strip stays 40pt because it is graphic, not type.

### InlineUndo — `00d-03`

- **Variants:** `removed-row`, `declined-ask`, `triage-decision`, `undo-all`, `bill-and-photo-deleted`, `fan-out-hold`
- **States:** `pending-undo`, `undone`, `committed`
- Lives in the row it changed. Stays until you leave the screen; no timer.
- Household-notifying writes hold their fan-out until undo closes. Pending shows "No notification sent"; committed names who saw it.
- Restore highlight is **fill only**, never selection (which always adds outline plus a mark). Dark: line 2 switches to `#E5E7EB` and "Just me" is underlined on primary.900, because `#94A3B8` (3.69:1) and `#38BDF8` (4.42:1) both fail there.
- Announce "Restored"; never draw it.
- Due dates use the house relative form ("Due in 4 days · Fri 23 Oct"). The paid attribution then needs its own right-aligned line 3 at 329pt.
- `fan-out-hold` (V6) is a sixth variant the contract does not list; it comes from the contract's own anatomy rule.

### DestructiveConfirm — `00d-04`

- **Variants:** `one-photo`, `all-photos`, `keeper`, `leave-home-sheet`
- **States:** `open`, `deleting`, `done`
- No red fill and no red text. Both labels `bodyMedium` 16/24/500 `app-text`; hue on the destructive button's border and glyph only.
- `deleting` ignores Escape, Back, the scrim and swipe. Close stays visible, disabled and focusable, with its reason written out.
- Progress: "Deleting 5 of 17…", announced every five items. Not a completion score.
- Android dialog 364dp (not 312dp) so "Delete photo" fits side by side at 154dp halves. The V4 pair stacks: "Leave this home" needs ~178dp.
- AX5 turns V1 into a sheet and it gains Close; Android 200% stays a dialog and does not.
- Scrim `app-text` at 40% in both themes; over dark app it composites to `#080D1D`.
- Glyphs: trash for deletes, Lucide `log-out` for leaving (nothing is deleted).
- `web-390`'s "Delete photo" at 151px is the tightest one-line fit on the board; anything longer stacks.

### LandingBannerSlot — `00d-05`

- **Variants:** `one-invite`, `count`, `expiring`, `sender-reissue`, `expired-compare-link`, `sync-merge`, `claim-receipt`
- **States:** `hidden`, `shown`, `offline`
- Never two banners. Nine sources compete; the proposed order is on artboard 01 and is **not** yet confirmed (the contract ladder omits sync merge, the claim receipt and the founding-meter preview, and does not place V5).
- `hidden` = 0pt and the first section stays put. A pending fetch reserves no height, so an arriving banner shifts content once — only pending, failed or empty is guaranteed not to.
- Shape follows width: one line takes the pill, two lines take `radius-2xl`. V1 needs ~387pt and so wraps at 361pt; on web-1440's 640px column it fits one line and takes the pill.
- V5 runs three lines (72 characters over ~240pt) and is the tallest banner on the board.
- `expired-compare-link` and `claim-receipt` keep their actions live offline.
- Fallback geometry, used because the mailbox-arrival pill screenshot never arrived: 44pt min height, radius pill, 16pt/12pt padding, `app-surface` on `app-bg`, `shadow-sm`, 1px `app-border` as decoration.

### NotificationAsk — `00d-06`

- **In-app variants:** `card-row`, `time-chips`
- **Sheets:** `primer-ios`, `primer-android`, `primer-ios-household`, `primer-android-household`, `ios-denied`, `android-denied-once`, `android-blocked`
- **States:** `never-asked`, `granted`, `declined`, `os-blocked`, `save-status`
- Entry points: after the first confirmed pickup, or the first household activity from Mail. Never on launch.
- The filled button is iOS-only. `ios-denied` has no Continue. `android-blocked` drops "Your phone will ask next.", which is false once Android has blocked the app.
- `os-blocked` is a settings-row specimen outside the grid; it lives on `f4-notification-settings`.
- Detents: ~514pt for the pickup primer, ~538pt for the household primer. The household body is allowed 4 lines even when it wraps to 3.
- Time chips follow `ChoiceChip`. Spoken: "6:00 PM, selected, 2 of 4."
- The OS permission dialog is never drawn. No web NotificationAsk is drawn — web push is out of scope.

### PushCopy — `00d-07`

- **Variants:** `unconfirmed-pickup`, `confirmed-pickup`, `air-time-sensitive`, `air-below-threshold`, `bill-marked-paid`, `household-roll-up`, `date-reminder`, `hidden-preview`
- **States:** `collapsed`, `expanded`, `lock-screen-public`
- Title 30 characters, body 40. The character ruler is 8pt per character at every text size, because it measures the limit, not the rendered width — at AX5 a title runs ~700pt over a 240pt ruler.
- Levels: pickup Active, **never** Time Sensitive. Air Time Sensitive at AQI ≥ 151, Active below. So the Android air group holds two channels (one HIGH, one DEFAULT); every other group holds one.
- Body names the place, dropping "· `<street>`" for someone with a single place.
- `lock-screen-public` says the category and nothing else: no address, no sender, no amount.
- `bill_paid` is Active only for members who still see the bill unpaid and due within 3 days; the fixture bill is 4 days out, so V5 is drawn Passive.
- V8 carries four specimens per cell (the public forms); V8 S2 is the one cell with no specimen.

### ReminderLeadControl — `00d-08`

- **Variants:** `date-sheet`, `extraction-confirm`, `lease-notice`
- **States:** `default`, `lead-passed`, `disabled`
- Leads 30 days / 7 days / day before / day of. The lease variant counts back from the **notice deadline**, not the lease end.
- Selection: fill + 1px `color-primary-700` outline + check. Never a circle, at any text size — the large-text rows take a check where a platform would put a radio.
- A passed lead is disabled, states the date in words ("Tue 13 Oct 2026 · passed") and offers the nearest working lead ("Use 7 days instead"). **The passed-lead rule is this board's invention; the contract gives none.**
- No date on file: whole control disabled, "Add the date first to set reminders."
- Tick dates use the absolute form; the relative count is dropped because the timeline shows the relation.
- Three layouts: one row → 2×2 grid at AX2 and Android 150% → four full-width rows. Nothing truncates.
- The one-day specimen sits in its own row below each grid so the grid stays at 1× within 1600px.

---

## C. Open decisions

Eight that change drawn work. The full list is 85 numbered items in the `00d · Notes` artboard.

1. **Card radius.** The 00d prompts say `radius-lg` 12; the design system ships cards and sheets at `radius-2xl` 20. The board drew 12 because component prompts are literal. 59 later surfaces inherit whichever wins.
2. **Red destructive label.** The contract asks for a red label; the house style keeps semantic hues on glyphs and borders. The board followed the house style. A red label needs a dark error token — `#DC2626` is 3.70:1 on dark base.
3. **"Yes".** The notification card row has "Yes / Not now". "Yes" is not a verb, and the glossary pairs "Not now" with a lasting decline the contract does not offer. Add "No thanks"? Replace "Yes" with "Remind me"?
4. **Push action case.** The contract says title case ("That's My Day"); the research brief and the house style say sentence case. The board followed the contract.
5. **"Open Settings"** keeps a capital S against the same rule.
6. **14-day lease lead.** The fixture's lease reminder is Mon 15 Feb 2027, 14 days before the deadline; the contract's leads are 60 / 30 / 7 / 1. The board drew 30 days (Sat 30 Jan 2027). Add a 14-day option, or change the fixture?
7. **Primer or inline row.** The contract asks for a primer sheet after the first pickup; research brief §2.8 asks inline after the first "That's my day" and goes straight to the OS dialog.
8. **Skeleton threshold.** The contract says 1–10s, the brief ~2–10s: skeleton or nothing between 1 and 2 seconds? And do still-waiting skeletons keep shimmering once the first replacement lands?

Smaller ones, each recorded on the board: "Just you, then." vs "Just me, then." (3.1); "synced" is a glossary-forbidden freshness word kept as the contract string (5.2); the added `air-below-threshold` variant and its invented title (7.5); "Recycling + garbage" in a body rather than a title (7.6); whether V2/V5/V6/V7 bodies should carry a source (7.10); web push scope (6.7).

---

## D. Accessibility figures, and one correction to make

Every ratio printed on the board was recomputed and is correct **as printed**. But the board was drawn against the house-style palette, which still carries the pre-correction `#6B7280` (`app-text-secondary`) and `#9CA3AF` (`app-text-muted`). The design system corrected both in September 2026. Re-measure against the token before quoting a figure into code.

- `color-primary-50` has no hex in the house style or the system README. The board draws `#F0F9FF` (standard sky-50). Two anatomy figures depend on it: `app-text-secondary` on it is printed 4.54:1 but computes 4.49:1 at `#F0F9FF`, which suggests the shipped ramp is slightly darker. Four cells per theme are a one-line fix either way.
- A `color-primary-50` fill on its own is ~1.07:1 — invisible as a shape. This is why selection is always fill **plus** outline **plus** a mark.
- Dark: `#94A3B8` is 3.69:1 and `#38BDF8` is 4.42:1 on primary.900, so both fail there; `#E5E7EB` and an underline replace them.
- Dark: `#DC2626` is 3.70:1 on dark base and 3.03:1 on dark raised, so it stays on borders and glyphs.
- Dark: `app-border` → `#1F2937` is 1.00:1 on dark raised, so those hairlines are dropped.
- Dark: `app-surface-sunken` equals `app-surface`, and the dark app → dark base step is 1.13:1, so review aids and fallbacks use dark base with a 1px `#374151` edge.
- **Greyscale collisions:** `app-text-secondary` and `color-error` resolve to the same grey (both 4.83:1), and so do `app-text-secondary` and `color-warning`. Glyph shape and words are the only cues in greyscale — which is why the destructive confirm and the expiry banner are built the way they are.

**Board token assumptions to confirm or replace with published dark tokens:** dark `app-text-strong` `#F1F5F9`, `app-text-muted` `#64748B`, `app-text-inverse` `#111827`, `app-border-strong` `#374151`. Dark selection is a primary.900 fill with a `#38BDF8` border and check, everywhere.

---

## E. Invented strings

Everything below was written for the board and is not in a contract. Review before shipping.

- **Board chrome (all eight):** "host illustrative, not a spec" · "Not this" · "Draw this" · each "Not applicable: `<reason>`" · "key: `<key>`" · "Reads without colour: `<cue>`" · "web-1440 crop" · "Also consumed by:" · the callout key texts.
- **QuietDayReceipt:** "air · 7:00 AM" · the S1–S3 spoken labels · "Retry air quality" (spoken) · "Last sent Wed 14 Oct, 6:00 PM" · "Birchfield Ct".
- **WarmingSkeleton:** "Loading" (spoken) · "Owner" (MemberRow caption) · the bar sizes and bill-trend column heights.
- **InlineUndo:** "Dad's place" · the f3-household-block strings · "Offer", "Voter guide", "Flyer", "Kept", "Recycled", "Clark County Elections", "Waste Connections" · the four due-date lines · "Paid by Maya · Mon 19 Oct" · "6 pieces sorted" · "Clark Public Utilities marked paid" · "Sam sees this after you leave this screen." · "No notification sent" · the spoken "Restored" lines.
- **DestructiveConfirm:** every string under VARIANTS and STATES, plus "Close" and "Close is available when this finishes." · the spoken progress lines.
- **LandingBannerSlot:** every string under VARIANTS and STATES · the two spoken expiry lines.
- **NotificationAsk:** "Yes fires the OS prompt directly." · "Appears only after an action that shows the purpose" · "Retry" · "Close" · "Pickup reminders on this phone" · "Household updates on this phone" · "now" · the household body's last sentence · "Put Today on your home screen" · "Add the widget" · "Notifications are off for Pantopus. These rows still update inside the app." · "Opens the Notifications page for Pantopus in Settings." · "Opens the notification settings for Pantopus." · the spoken "6:00 PM, selected, 2 of 4."
- **PushCopy:** "Sensitive groups: AQI 118" · "now" · "Time Sensitive" as a word inside the illustration · "Date reminder" · the four Android public forms · "Larkspur Loop" as the V6 body · "Time Sensitive at AQI 151 or above" · "Today 6:10 PM" · "Never Time Sensitive for pickup."
- **ReminderLeadControl:** "Remind me" · the four "`<N>` days before" forms · "Day before" · "Day of" · "passed" · "Tue 13 Oct 2026 · passed" · "Water-heater warranty ends" · "Water bill due" · "Notice deadline" · "Lease ends — reminders count back from the notice deadline" · the two passed-lead lines · "Use 30 days instead" · "Use 7 days instead" · "Suggested" · "Add the date first to set reminders." · "We'll also remind you on the day."

---

## F. Fixtures and assumptions

TODAY = **Mon 19 Oct 2026**. Every date on the board was checked against it, including the RCW 1.12.070 shift from Sat 31 Oct to Mon 2 Nov, the 30-day lease notice (Wed 31 Mar 2027 → Mon 1 Mar 2027), and all sixteen ReminderLeadControl lead dates.

- **QuietDayReceipt:** Jordan's last briefing was Wed 14 Oct, 6:00 PM. IN CONTEXT uses PLACE B, because HOME A has pickup Tue 20 Oct and its Monday evening is not quiet.
- **WarmingSkeleton:** the V3a window runs Mon 19 Oct – Sun 1 Nov, so Comcast and the property-tax second half (both Mon 2 Nov) fall outside it.
- **InlineUndo:** viewer Maya Chen at HOME A. The Blairmont rental and Dad's place are Maya's saved places (Only you).
- **DestructiveConfirm:** Sam Ortega leaves in V4; Ollie is HOME A's keeper; HOME A has 17 mail photos.
- **LandingBannerSlot:** Priya is the invitee for V1–V3, invite expires Mon 26 Oct. V3 is viewed on Sun 25 Oct; everything else on TODAY.
- **PushCopy:** V3's AQI 176 at 4:00 PM is the contract's example, not the fixture reading. "Today 6:10 PM" is invented and carries no weekday because it is TODAY.
- **ReminderLeadControl:** the S2 starting dates (Sat 16 Jan 2027 warranty; the misread Sun 22 Nov 2026 water bill) are invented so the chosen leads were still ahead before the edit. Tick x-positions 54, 180, 307 are layout choices.
- **NotificationAsk:** primers are for HOME A (Maya), so the tray shows "Larkspur Loop". "Couldn't save" is drawn after Maya picked 7:00 PM.
- Specimens render in the browser's system-ui stack; no webfont is loaded on the canvas, so letterfit is indicative, not exact.

---

## G. Published specimen counts

| Component | Light | Dark |
| --- | --- | --- |
| QuietDayReceipt | 23 | 12 |
| WarmingSkeleton | 24 | 20 |
| InlineUndo | 20 | 18 |
| DestructiveConfirm | 17 | 12 |
| LandingBannerSlot | 28 | 25 |
| NotificationAsk | 17 | 13 |
| PushCopy | 46 + 4 levels | 46 |
| ReminderLeadControl | 16 | 9 |

Published names follow `<Component> / <variant-key> / <state-key> / <platform> / <light|dark>`. Platforms drawn: `ios`, `android`, `web-1440`, `web-390`, plus the text-size keys `ios-ax5`, `ios-ax2`, `android-200`, `android-150` and `ios-ax-widget`.

Never published, on every component: the greyscale copies, the "Not applicable" cells, the IN CONTEXT crops, and every "Not this" / "Draw this" thumbnail.

---

## H. Dependencies

Six of the eight R15 dependencies have been published since the board was drawn and their fallback boxes are now stale: `KindGlyph` (Foundations 00a), `AqiBand`, `FourteenDayStrip`, `YearBand`, `ScaleStrip` (Data instruments), `MemberRow` (Foundations 00c). WarmingSkeleton's `replaced-progressively` state and QuietDayReceipt's `strip-empty` and `year-band-empty` variants can be redrawn against real specimens.

Still pending, drawn as fallback boxes and not blocking:

- **The Pantopus app icon** — a 20pt fallback tile in every PushCopy tray and every NotificationAsk primer tray.
- **PickupCard** — 361×196pt, in the WarmingSkeleton 01 loaded review aid and the NotificationAsk 07 primer crop. Not a Foundations component; designed in the `f4-today-pickup-card` screen prompt.

Attachments that never arrived and were worked around: the mailbox-arrival pill screenshot (LandingBannerSlot — anatomy 1 fallback geometry used throughout; if the real pill differs, every specimen shifts) and the three optional hub-v2-skeleton tone screenshots (no layout was taken from them in any case).
