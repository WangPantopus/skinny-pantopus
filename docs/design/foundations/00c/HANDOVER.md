# Foundations 00c — Rows and lists · engineering handoff

**Suggested path:** `docs/design/foundations-00c-handoff.md`
**Source of truth:** the Pantopus Foundations 00c canvas — 61 artboards, twelve components × five boards (`01-anatomy`, `02-grid`, `03-ax5-200-greyscale`, `04-in-context`, `05-grid · dark`) plus `00c · Notes`.
**Published as cards:** the Pantopus design system, section *Foundations 00c*, one `components/<Name>/` folder each.
**Status:** drawn and reviewed; not in code. Nothing in `frontend/apps/web/src/components` implements these yet, so `tools/design-system/build.mjs` does not generate their cards — and does not remove them, because its publish plan lists only the files it generates.

---

## 1. How to read these specs

- **Tokens, not hexes.** Every colour below is a token name from `project/tokens.json`. The board was drawn against the house-style palette, which predates the September 2026 AA correction; where a ratio is quoted here it has been recomputed against the current token. Do not port a hex from the artboards.
- **Three platforms, one geometry.** Sizes are given in pt. Read them as pt on iOS, dp on Android and px on the web unless a line says otherwise.
- **Targets are absolute.** 44pt on iOS, 48dp on Android, 44px on the web, with 8dp between adjacent targets. A visual smaller than its target is normal; a target smaller than the minimum is a bug.
- **Every cell was drawn.** The variant × state grid in each spec is exhaustive: if a pair is listed it exists on `02-grid`, and if it is not listed it was deliberately not drawn. Counts are given so you can check a Storybook matrix against the board.
- **Four passes per component.** Each was checked at AX5 / 200%, in greyscale, in dark, and in context inside a real screen crop. A component that only works at default size in light has not met the spec.
- **Copy is part of the component.** The strings below are the drawn strings. Where a string was invented for the board rather than taken from a product contract it is marked *(board string)* and needs product sign-off before it ships.

## 2. Rules that bind all twelve

1. **State is stated in words.** Status, freshness, locked reasons and errors all name the condition in text on a neutral fill. Hue may appear on a glyph; it is never the only signal. Every cell was verified in greyscale.
2. **The row is the target, not the ornament.** Marks, glyphs, chips, thumbnails and unread dots are never tappable. Where a row carries a text action, the action is its own button and the row stops being a target — there are no nested targets anywhere in this set.
3. **Missing is an invitation, locked is information, offline is neither, and only a real failure gets the error hue.** Four distinct treatments; do not collapse them into one "problem" style.
4. **Nothing is counted.** No score, percentage, fraction or progress denominator. Upload progress is "Uploading 2 of 3"; the first-week pointer is "Next: <step> →".
5. **Nothing silently disappears.** A failed row keeps its slot and order. A read notification keeps its empty dot column. A row the viewer may not see renders as nothing — never a greyed placeholder, which leaks that something exists.
6. **Attribution is a name, not a face.** Verification is shown on actions, never on a person's name.
7. **Highlight is not focus.** Arrival highlight is a wash plus a leading bar; focus is a 2px ring offset 2px outside the target. They must be visually distinct.

## 3. Migration order and the shipped components

Nine of the twelve overlap something already in the system. The rule agreed with the product owner:

> The Foundations version governs anything the Pantopus prompt pack draws or changes — the surfaces listed per component below. The shipped component governs every surface the pack leaves untouched, until the Foundations version is migrated in code.

Three are genuine conflicts and should be sequenced first, because two implementations of the same row will diverge:

| Order | Foundations | Shipped | Why it is a conflict |
| --- | --- | --- | --- |
| 1 | `BillRow` | `StatusChipRow` | Different anatomy (no icon tile, a payer attribution line) and a different interaction contract (no one-tap mark-paid). |
| 2 | `MemberRow` | `AvatarKebabRow` | The shipped row renders a verified badge and a role chip that this design forbids. |
| 3 | `FirstWeekRow` | `ProgressSegments` | `ProgressSegments` prints a denominator; this row forbids one. They must not co-occur. |

The remaining six are style differences that can live side by side: `LockedActionRow`/`LockedCard`, `InlineErrorRow`/`ErrorState`, `FactRow`/`KeyFactsPanel`, `NotificationRow`/`StatusDot`, `TextActionRow`/`TextButton`, `ThumbnailRail`/`IconTile`. `DateRow`, `InviteRow` and `GrantLimitList` have no shipped equivalent.

---

## 4. Component specifications

### 4.1 DateRow

One dated fact in a list. The row grammar is shared by the 14-day strip, the calendar agenda, the place-file Dates section and reminder rows.

**Geometry** — minimum 56pt; padding 16pt horizontal, 12pt vertical; `app-surface`. Leading `KindGlyph` 24pt line icon, 2pt stroke, `app-text-strong`, top-aligned with the title, 12pt gap. Title body 16/24/400 `app-text`, wraps and never truncates. Line 2 caption 12/16/400 `app-text-secondary`. Optional coverage chip in `ScopeChip` geometry (24pt pill, `app-surface-sunken`, label 13/18/600, 12pt glyph). Trailing `ProvenanceMark` 16pt, ring stroke ≥1.5px, `app-text-secondary` (7.49:1 on `app-surface`), 8pt from the text, vertically centred, not a target. Recurrence rows carry a 2px `color-identity-home` leading edge at full row height and a final caption line.

**Variants (10)** — `pickup-both`, `pickup-garbage`, `holiday-moved`, `deadline-voter`, `deadline-notice`, `deadline-tax`, `conditional-rule`, `reminder`, `reminder-approx`, `money`.
**States (6)** — `default`, `highlighted-arrival`, `highlighted-decayed`, `focused`, `done`, `permission-hidden`. **26 cells drawn.**

**Copy** — deadlines name the action ("Tell your landlord in writing by Mon 1 Mar 2027"); received-by deadlines say "must arrive by"; dates are spelled with the weekday, never numeric; beyond tomorrow the relative count leads ("in 7 days · Mon 26 Oct"), and conditional rules are exempt; source captions carry a scope word; pickup titles are exactly "Recycling and garbage" or "Garbage only"; holiday moves read "moved to Fri 27 Nov"; done reads "You marked this done" and stays Only you. Recurrence captions: "Every year", "Every month", "Does not repeat" *(board strings)*.

**Accessibility** — one element, one target. Spoken: "<title>, <line 2 as shown>, <authority, scope>, <mark name>". The label speaks only the dates shown, so "Tomorrow" is spoken with no absolute date. Custom actions: Edit · Remind me · Where this comes from · Mark done.

**Platforms** — identical, except web adds a trailing row menu button (20px ellipsis, 44px target) after the mark, holding the four custom actions.

**Never** — a generic calendar icon for every row; overdue red on a passed annual date; a greyed placeholder for a row the viewer cannot see; a numeric date.

**Drawn for** — f5-today-calendar-strip, f3-household-calendar, f3-household-notifications, f7-today-widget, x-place-file, x-date-sheet.
**Shipped counterpart** — `FileChevronRow` (tinted 36px icon disc + chevron). No migration conflict; DateRow is additive.
**Board** — `00c · DateRow · 01-anatomy` (file `Main.dc.html`), `02-grid`, `03-ax5-200-greyscale`, `04-in-context`, `05-grid · dark`.

---

### 4.2 FactRow

One row per fact in the place file and in settings: known, missing, or not available at this tier.

**Geometry** — minimum 56pt; 16pt horizontal padding; `app-surface`; content vertically centred. Label bodySmall 14/20/400 `app-text-secondary` above the value in body 16/24/400 `app-text`. `ProvenanceMark` 16pt `app-text-secondary`, 8pt after the value, not a target. Trailing element is either a 16pt chevron or a text action in bodySmallMedium 14/20/500 `color-link`. The disclosure row "More you can add (5)" is a 44pt chevron row.

**Variants (16)** — `known-flood`, `known-pickup-unconfirmed`, `known-pickup-confirmed`, `known-pickup-saved-place`, `missing-dates`, `missing-frequency`, `not-at-tier`, `done-ask`, `declined-undo`, `declined-later`, `declined-skip`, `permission-disabled`, `receipt`, `reports-checking`, `reports-fixed`, `reports-no-change`.
**States (4)** — `default`, `focused`, `loading`, `offline`. **25 cells drawn.**

**The target rule (the most-missed part of this spec)** — a chevron row is one target and one spoken element. A row with a text action exposes that button separately and the row is *not* a target. A row with neither (`not-at-tier`, the three `reports-*`) is not a target at all.

**Copy** — the approved asks are "Set your pickup day", "Add one date that matters", "Add the people you live with"; "Not set" in `app-text-secondary`; hazard values put the plain meaning first ("Zone X — minimal flood hazard"); declines are neutral ("Just me", "Skipped"); offline reasons open with "You're offline".

**Accessibility** — known rows merge label and value: "Flood zone, Zone X, minimal flood hazard, official." Asks read as text then a verb-first button. The undo line is `role="status"` and focusable. The skeleton announces once as "Loading". A disabled offline action carries its reason as a hint.

**Never** — a red X or red text for a missing fact; a score, percentage or "3 of 6"; more than three promoted asks per screen; hiding a not-at-tier fact.

**Drawn for** — f1-today-tab, f3-household-block, f4-notification-settings, f6-home-basics-rows, f9-verification-promise-copy, x-place-file.
**Shipped counterpart** — `KeyFactsPanel`. Different container and purpose; both can ship.
**Open** — the `reports-*` variants are a dead end: a status chip with no chevron, no action and no target. Decide what a report row does before building them.

---

### 4.3 FirstWeekRow

The single pointer on Today to the next first-week step.

**Geometry** — 48pt at default sizes (12 + 24 + 12); padding 16pt horizontal, 12pt vertical; `app-surface`. Step text bodyMedium 16/24/500 `app-text`, with the arrow part of the link. Dismiss is a 16pt close glyph in `app-text-secondary` inside a 44pt / 48dp target, 8dp from the link target. If the step text wraps the row grows and dismiss stays top-aligned — including at AX5 / 200%, which overrides the usual "controls move below" rule.

**Variants (3)** — `next-pickup`, `next-widget`, `hidden`. **States (4)** — `default`, `focused-link`, `focused-dismiss`, `dismissed`. **7 cells drawn.**

**The bounded set** — Save (already done) · Pickup day · Reminder or widget · One date or person. Only steps reachable at the current tier count; verify, profile and photo are never steps. The row shows for seven days, matching the activation window.

**Copy** — name only the next step, sentence case, verb first. Step strings: "set your pickup day", "put today on your home screen", "add one date that matters" *(board strings for the latter two)*. Never a count or a fraction.

**Accessibility** — the row is one link ("Next: set your pickup day. Link."). Dismiss is a separate button, "Dismiss next step", also offered as a custom action on the link. Undo is `role="status"` and focusable.

**Never** — "3 of 6" or any denominator; counting verify, profile or photo; a checklist card.

**Drawn for** — f1-today-tab, f4-briefing-optin-card, x-place-file.
**Shipped counterpart** — `ProgressSegments`. **Conflict:** the two must not appear on the same surface.

---

### 4.4 BillRow

A household bill with payer attribution, so two people don't pay the same bill.

**Geometry** — 68pt when line 1 fits on one line (12 + 24 + 20 + 12), **92pt when line 1 wraps**; padding 12pt vertical, 16pt horizontal; `app-surface`; the whole row opens bill detail. **Nothing in this row truncates.** Line 1 left: provider, bodyMedium 16/24/500 `app-text`, wrapping to a second line, with `StatusChip` following it inline and wrapping with it (24pt pill, `app-surface-sunken`, captionMedium 12/16/500 `app-text-strong`, semantic hue on the leading glyph only). Line 1 right: amount, bodyMedium 16/24/500, tabular figures, one right-aligned column, **on its own line**, top-aligned with the provider's first line and never reflowed with it. Line 2 is its own flex line so that due date and attribution stay paired whatever line 1 does: due date left, bodySmall 14/20/400 `app-text-secondary`; attribution right, same style. Overflow: 20pt ellipsis in a 44pt / 48dp target, 8dp from the row target, with a matching spacer on line 2. List header: bodySmall 14/20/500 `app-text-strong`.

**Variants (9)** — `manage`, `member-overflow`, `member-no-overflow`, `only-me`, `former-member`, plus four chip variants `chip-upcoming`, `chip-due-today`, `chip-overdue`, `chip-paid`.
**States (7)** — `default`, `highlighted-arrival`, `focused`, `highlighted-decayed`, `marked-paid`, `permission-denied`, `offline`. **15 cells drawn.**

**Overflow items** — Mark paid · I paid this · Paid a different amount · Skip this month. Native menus (iOS pull-down, Android M3 `DropdownMenu`, web menu button with keyboard support); each item is also a custom action. A single shared offline reason sits under the whole item group, not under each item. At AX5 / 200% the overflow stays top-trailing.

**Copy** — "marked paid", never "paid"; "Paid by <first name> · <weekday day month>"; future dates beyond tomorrow add the relative count, past dates show the date only; a former member reads "Sam (no longer here)"; the header names who can see, because finance access differs. Never monitoring language.

**Accessibility** — merged label: "Clark Public Utilities, 142 dollars 18 cents, due Friday 23 October, upcoming." The marked-paid state is a live region with a focusable Undo.

**Never** — a one-tap "Mark paid" on the row or the dashboard; an avatar without a name; a budget meter; truncating anything, including the provider.

**Drawn for** — f3-bills-list, f3-bill-detail-web, f3-member-home-dashboard, f10-mail-piece-photo.
**Shipped counterpart** — `StatusChipRow`. **Conflict, migrate first.**
**Resolved** — line 1 was truncating on every fixture (at 393pt the text column is 309pt and line 1 needs ~361pt with the chip and amount). The decision is that line 1 wraps: the provider wraps, the chip follows it, the amount keeps its own line, and the row grows to 92pt. Build the two lines as separate flex rows, or line 2 will unpair when line 1 wraps.

---

### 4.5 MemberRow

A person in the household. No trust badge, no status badge.

**Geometry** — 56pt minimum; padding 16pt horizontal, 8pt vertical (8 + 40 + 8); `app-surface`. Avatar 40pt initials circle, `app-surface-sunken` with initials in label 13/18/600 `app-text-strong`, neutral with no identity hue, decorative. Name body 16/24/400 `app-text`. Caption 12/16/400 `app-text-secondary`. Group heading overline 11/16/600 caps +0.5 `app-text-secondary`: OWNER · ADMINS · MEMBERS · GUESTS. Group disclosure is a 44pt row with a chevron under its heading; OWNER has none. Overflow 44pt / 48dp.

**Variants (8)** — `owner`, `admin`, `member`, `guest`, `you`, `roster-line`, `roster-count`, `empty`. **States (4)** — `default`, `focused`, `loading`, `offline`. **13 cells drawn.**

**Overflow** — Change role · Confirm lives here · Remove; on the viewer's own row the single item is "Leave <home>". One shared offline reason per item group. At AX5 / 200% the overflow stays top-trailing. The avatar grows 40pt → 48pt at AX5 / 200%.

**Copy** — roles are Owner, Admin, Member, Guest, never "resident". Before someone accepts, show a count and not a name: "Maya Chen and 1 other live here". Group disclosures: "What can members do?" / "What can admins do?" / "What can guests do?" *(board strings)*.

**Never** — a "Verified" or "Household member" chip; a check-badge on the avatar; names for someone who has not accepted.

**Drawn for** — f3-members-roster, f3-member-home-dashboard, f3-household-block, f3b-owner-attestation, f3b-invitation-decision, x-place-file.
**Shipped counterpart** — `AvatarKebabRow`. **Conflict, migrate second.**
**Open** — the viewer's own row lands at ~88pt, not the 72pt the anatomy states, because the confirmation caption needs ~280pt in a 257pt column. Shortening it to "Confirmed by postcard · Thu 15 Oct 2026" holds 72pt.

---

### 4.6 InviteRow

A pending invitation or invite link, with its expiry and a one-tap fix.

**Geometry** — 56pt minimum, inside a "PENDING" group (overline 11/16/600 `app-text-secondary`) that only managers see. **No avatar on any variant.** Leading glyph 16pt `app-text-secondary` — mail by default, a warning glyph on `needs-reissue`, a link glyph on `link-active`; hue on the glyph only. Line 1 recipient bodySmall 14/20/400 `app-text`. Line 2 caption 12/16/400 `app-text-secondary`, running the full text width under the trailing controls and wrapping at a middot. "Resend" text button bodySmallMedium 14/20/500 `color-link`, trailing, aligned to line 1, 44pt target. Overflow 44pt / 48dp holding Cancel · Extend, 8dp after Resend.

**Variants (7)** — `pending-email`, `pending-username`, `expiring`, `needs-reissue`, `declined`, `link-active`, `awaiting-approval`. **States (4)** — `default`, `focused`, `sending`, `offline`. **14 cells drawn.**

**Copy** — the expiry shows on every pending invite and every active link; only `awaiting-approval` omits it, because its link is already used. Dates show the weekday; beyond tomorrow the relative count leads. The link warning "Works once" appears at the point of choice. Every email is @example.com. Each offline reason names the action it blocks. A successful resend announces "Invitation resent"; the visible word is "Sent".

**Accessibility** — "Invitation to priya@example.com, member, expires in 7 days, Monday 26 October. Resend. Button." Overflow items are also custom actions; disabled offline actions stay in the tree with their reason as a hint.

**Never** — "Remind them" on a declined invite (offer only Remove); a real email domain; a warning-tinted expiring row.

**Drawn for** — f3-members-roster, f3-invite-composer, f3-invite-banner, x-place-file.
**Shipped counterpart** — none. Nearest is `AvatarKebabRow`, which always draws an avatar.
**Known deviation** — offline reasons sit full-width under the row rather than directly under each trailing button, because they run 45–58 characters. `TextActionRow` and `LockedActionRow` place theirs correctly; revisit if the strings shorten.

---

### 4.7 NotificationRow

The in-app twin of every push. Tapping it lands on the exact object.

**Geometry** — minimum 64pt; padding 12pt vertical, 16pt leading before the dot column and 16pt trailing; `app-surface`; the whole row is the target. Dot column: a fixed 12pt column holding a 6pt unread dot in `color-link`, spoken "Unread"; read rows keep the empty column so text never shifts. It is not a provenance mark and not a target. Avatar 28pt initials circle, `app-surface-sunken` with label 13/18/600 `app-text-strong`; system rows have no avatar and their text keeps the same leading alignment. Line 1 body 16/24/400 `app-text`, a sentence with the actor first. Line 2 caption 12/16/400 `app-text-secondary`: date and time, then a home label only for readers with more than one home, then for reminders a trailing `ProvenanceMark`. A grouped row is a chevron disclosure expanding to individual rows, indented to the text column, without avatars; the chevron is part of the row target.

**Variants (10)** — `bill-paid`, `task-completed`, `event-created`, `date-reminder`, `bill-reminder`, `member-joined`, `member-left`, `grouped`, `gone-target`, `multi-home`.
**States (6)** — `unread`, `read`, `focused`, `push-off`, `offline`, `landing`. **21 cells drawn.**

**Copy** — amounts in-app only, never in a push. "marked paid", not "paid"; actor first. Dates show the weekday, relative count first beyond tomorrow. A landing whose object is gone says "That bill was removed."

**Accessibility** — merged label with "Unread" first. Reminder rows end with the mark name. Grouped: "Sam marked 3 bills paid, collapsed, button". The push-off banner reads as text then "Turn on. Button."

**Never** — bold text or a tinted background for unread; landing on a generic list when the object exists (land on the object, with its row in `highlighted-arrival`); an avatar on system rows.

**Drawn for** — f3-household-notifications, f4-notification-settings.
**Shipped counterpart** — `StatusDot`; do not substitute it for the unread dot.
**Open** — the bill-reminder variant is drawn with the YOU ADDED mark, but the bill behind it is a real utility bill on record. The hollow "on record, not confirmed" mark is probably the truthful one. Decide before implementing.

---

### 4.8 TextActionRow

Tertiary actions that spread the product — share, compare, outbound links.

**Geometry (share pair)** — two text buttons side by side, bodySmallMedium 14/20/500 `color-link`, no fill and no border, a 44pt / 48dp / 44px target each, 8dp apart, over a caption in 12/16/400 `app-text-secondary` stating what the card reveals.
**Geometry (outbound)** — a bordered row, 48pt minimum, `radius-md`, padding 12pt vertical and 16pt horizontal, with a **1px `app-text-secondary` edge** (a border token is 1.24:1 and fails as an only edge). Destination text bodySmall 14/20 `app-text`, trailing 16pt external-link glyph in `app-text-secondary`, drawn as a vector — the literal ↗ character appears nowhere. The whole row is the target.

**Variants (3)** — `share-compare`, `outbound-test-kits`, `outbound-votewa`. **States (6)** — `idle`, `minting`, `copied`, `cancelled`, `offline`, `focused`. **16 cells drawn.**

**Copy** — V1 buttons start with a verb; outbound rows name the destination as the contract gives it. "Compare with a friend", never "challenge" or "vs". Offline reasons open with "You're offline". The privacy caption is a *(board string)* and needs product sign-off.

**Accessibility** — links name their destination and that they leave: "Check or update at VoteWA, opens in browser". "Link copied" is a status message. The minting button announces "Making a link" and cannot be re-activated.

**Platforms** — only the system share sheet is used: iOS supplies `LPLinkMetadata`, Android supplies `EXTRA_TITLE` to the system chooser, web uses the browser share and falls back to copying the link. System UI is never redrawn.

**Never** — these actions inside the sticky footer; an app-drawn Android chooser; filled or bordered buttons for share and compare.

**Drawn for** — f8-native-share-compare, f8-compare-sheet, f8-compare-reveal, f8-seasonal-aha, f6-place-section-details.
**Shipped counterpart** — `TextButton` (style) and `StickyFooter` (the placement this must avoid).
**Fixture gap** — the radon `SourceCaption` in the in-context crop carries an invented as-of date, because the house fixture gives "EPA, county-wide" with no age. Replace it when the real map date is confirmed.

---

### 4.9 LockedActionRow

Replaces or accompanies an unavailable control. It states the reason and the path forward.

**Geometry** — minimum 44pt; padding 12pt vertical, 16pt horizontal. A 1px `app-border-subtle` hairline above the row is decoration only, never the only edge. Leading glyph 16pt `app-text-secondary`: a lock on every variant except `pending`, which uses a clock, because pending is not a lock. Reason bodySmall 14/20/400, either `app-text-strong` on `app-surface-sunken` (9.37:1) or `app-text-secondary` on `app-surface` (7.49:1) — never `app-text-muted`. The reason wraps to two lines before anything truncates. Trailing link bodySmallMedium 14/20/500 `color-link`, a 44pt target spanning the row height. The disabled button above it: 44pt / 48dp / 44px high, `radius-md`, full content width, `app-surface-sunken` fill, `app-text-strong` label, **kept focusable**; tapping it opens the same reason.

**Variants (8)** — `under-cta`, `list-row-sunken`, `list-row-base`, `card-header`, `pending`, `server-refused`, `names-who-can-act`, `not-at-tier`. **States (4)** — `locked`, `focused`, `pending`, `offline`. **17 cells drawn.**

**Copy** — the pattern is "Address verification needed to <specific action>", with any extra context as a second sentence. Never a generic "Verification required". When someone else can act, name them ("Maya can add bills here"). Dates beyond tomorrow carry the relative count. Before a claim, use "Claim this address first" — verification means nothing before a claim.

**Accessibility** — the link names its destination ("Verify address, opens Verify this address"). The disabled button is exposed with its reason as a hint. The offline link is exposed as dimmed with its reason as a hint.

**Never** — red or amber colouring; `app-text-muted` for the reason or the disabled link; a present but inert control with no explanation.

**Drawn for** — f3b-locked-action-row, f3b-invitation-decision, f3-members-roster, f3-member-home-dashboard, f3-bills-list, f3-bill-detail-web, f3-household-calendar, f10-bill-provenance, f10-extraction-confirm, f6-home-basics-rows, f9-block-founders-panel, f11-keeper-strip, x-place-file, x-date-sheet. *(The widest reach of the twelve — build this one early.)*
**Shipped counterpart** — `LockedCard` (whole card) and `VerifyBanner` (screen top). Both can ship alongside.
**Known deviation** — the server-refused reason runs to three lines at 393pt, past the stated two-line wrap. Either shorten the string or accept three lines and update the spec.

---

### 4.10 GrantLimitList

Two scannable lists — what you get now, and what needs address verification — from one shared string set.

**Geometry** — headings label 13/18/600 `app-text-strong`; the grant list always first. Grant row 44pt: a 16pt bare stroke check in the success hue (a stroke, never a disc, so it cannot be read as the YOU ADDED mark), a 12pt gap, and the verb phrase in body 16/24/400 `app-text`. Limit row 44pt: a 16pt lock glyph in `app-text-secondary`, the same gap and the same type. Both lists use identical type and row height. Two columns 24pt apart on web 1440; stacked on mobile.

**The role picker** — `ChoiceChip`: a 32pt pill inside a 44pt / 48dp target, padding 0 12, label 13/18/600. Selected is `color-primary-50` fill **plus** a 1px `color-primary-700` outline **plus** a leading check — the fill alone is about 1.07:1 and invisible as a shape. Unselected is a 1px `app-text-secondary` edge with an `app-text-strong` label. The focus ring is distinct from selection. At AX sizes the chips become full-width radio rows.

**Variants (6)** — `invitation-decision`, `role-offered`, `attestation`, `verify-unlock`, `role-caption-member`, `role-caption-guest`. **States (3)** — `default`, `focused`, `accepted`. **15 cells drawn.**

**Copy** — every row is a verb phrase; use the string set exactly; never a bare product name ("Share what you pay in rent (Real Rent)", not "Real Rent"). Overflow folds behind "Show 3 more", a 44pt button whose spoken name matches the visible label *(board string)*.

**Accessibility** — each list has a real heading, or an accessible name where no heading is visible. The check and lock glyphs are decorative; the heading carries the meaning. Rows read as list items. Chips are spoken with their selected state.

**Never** — a warning box around the limits; bare product names; `app-text-muted` on sunken for locked rows.

**Drawn for** — f3b-invitation-decision, f3b-owner-attestation, f3b-verify-address-sheet, f3-invite-composer, f3-members-roster, f9-verification-promise-copy.
**Shipped counterpart** — none; composes the shipped `ChoiceChip`.

---

### 4.11 InlineErrorRow

A partial failure in one component. It names what failed and keeps everything else live.

**Geometry** — sits in the failed component's own slot and height and keeps its position in the list; minimum 44pt; padding 12pt vertical, 16pt horizontal. Leading glyph 16pt: an exclamation mark in a circle, in the error hue — **glyph only**; the message stays `app-text`. Message bodySmall 14/20/400, specific and blameless. Trailing "Retry" bodySmallMedium 14/20/500 `color-link`, 44pt target. Surface is `app-surface`; `color-error-bg` **only** when a write failed, and on that fill nothing uses `app-text-secondary`. The error-on-error-bg pair measures 6.89:1 with the current token.

**Variants (5)** — `provider-unreachable`, `carry-failed`, `upload-failed`, `save-failed`, `fail-closed`. **States (3)** — `failed`, `focused`, `retrying`. **11 cells drawn.**

**Accessibility** — a polite live-region announcement when the row appears. Retry names its own target: "Retry air quality" / "Retry moving your water-heater warranty" / "Retry upload" / "Retry saving pickup day". The retrying state announces "Retrying". The fail-closed variant announces nothing, because nothing is rendered.

**Never** — "Oops, something went wrong"; hiding a failed row among successful ones or dropping it; an error row for a fail-closed component (draw nothing — a broken meter must never promise a slot); clearing the field on a failed save.

**Drawn for** — f1-today-tab, f1-claim-receipt, f4-briefing-optin-card, f4-notification-settings, f6-home-basics-rows, f10-mail-day-triage, f10-snap-capture-tray, f10-bill-trend, f11-keeper-naming, f11-keeper-strip.
**Shipped counterpart** — `ErrorState` (whole screen), `ValidatedField` (one field), `Toast` (transient). All three can ship alongside.

---

### 4.12 ThumbnailRail

The optional leading photo slot on mail rows and in the capture queue.

**Geometry** — all `radius-md`. Triage 56×56pt · drawer 40×52pt · privacy list 32×32pt, each 12pt before the row text. **No photo: the rail collapses** and the text moves to the leading margin — never an empty square.
**Uploading** — a determinate ring inside the thumbnail, 2pt stroke, `color-primary-700` on an `app-border-strong` track (4.03:1), plus "Uploading 2 of 3" beside the row in caption 12/16 `app-text-secondary`. The ring stays inside the thumbnail at the leading edge so it never sits under or next to the Delete target.
**Failed** — a 16pt retry glyph in `app-text-strong` centred on an `app-surface-sunken` thumbnail, plus `InlineErrorRow`'s upload-failed variant as the row caption.
**Deleted** — a quiet 16pt document glyph in `app-text-secondary` on an `app-surface-sunken` thumbnail, plus "photo deleted Mon 12 Oct" in caption 12/16 `app-text-secondary`.
**Selected** — a `color-primary-50` fill behind the row plus a leading bare-stroke check, and below it a visible action row of three text buttons — Retake · Delete · Same letter as previous — each a 44pt / 48dp target, 8dp apart.

**Variants (5)** — `triage`, `drawer`, `privacy`, `queue`, `no-photo`. **15 cells drawn.**

**Copy** — "Photo of your mail" for the stored image, never "scan" or "document". Progress reads "Uploading 2 of 3", with no percentage.

**Accessibility** — the thumbnail is part of the row element, not a separate target: "Clark Public Utilities, bill, photo, uploading 2 of 3". All three actions are visible buttons and also custom actions; nothing is long-press-only or hover-only. Upload progress is a polite live region.

**Platforms** — web converts HEIC to JPEG before rendering; iOS and Android render natively. The photo does not theme in dark: it is image content, not chrome.

**Never** — a broken-image icon; the progress ring under or near the Delete target; an empty square when there is no photo; a percentage beside the ring.

**Drawn for** — f10-mail-day-triage, f10-snap-capture-tray, f10-mail-piece-photo, f10-mail-snap-privacy, f10-bill-provenance.
**Shipped counterpart** — `IconTile` is not a substitute; `ShimmerBlock` is the loading shape elsewhere.
**Note** — the drawn photo content is a neutral envelope on a grey table with no legible name, address or amount, so nothing can leak from a specimen or a screenshot.

---

## 5. Contrast: what the board's quoted ratios get wrong

The house-style token block is a snapshot taken before the design system's September 2026 AA correction, so ratios quoted from it measure retired hexes. Seven were recomputed. Use this table, not the artboard captions, when reviewing a build.

| Pair | Quoted | Actual | Verdict |
| --- | --- | --- | --- |
| `app-text-secondary` on `app-bg` | 4.83:1 | **7.49:1** | passes, better than claimed |
| `color-error` on `color-error-bg` | 4.41:1 | **6.89:1** | passes, better than claimed |
| `color-identity-home` on dark base | 5.42:1 | **3.56:1** | passes at 3:1 (graphic); 5.42 measured `color-brand-check`, a different token |
| `color-success` on dark base | 4.74:1 | **3.26:1** | passes at 3:1 (graphic) |
| `color-error` on dark base | 3.70:1 | **2.55:1** | **fails** — use the dark error value (6.45:1) |
| `color-error` on dark raised | 3.03:1 | **1.94:1** | **fails** — use the dark error value (5.29:1) |
| `color-warning` on dark base | 5.60:1 | **2.85:1** | **fails** — use the dark warning value (10.69:1) |

The cause: the semantic inks were darkened to pass on light surfaces, which costs them contrast on dark. The system already ships correct dark values for all four semantic hues, so **code that reads the token gets this right automatically** — the failures only appear where a hex was hard-coded from the board. Two consequences for implementation:

1. Never hard-code a semantic hex. `var(--color-error)` resolves to the light value in light and the dark value in dark; the board's "keep the light value on dark" rule was written against the older, lighter hexes and is superseded.
2. The warning correction is **approved for dark surfaces only**; the light value is unchanged. That is already what the token encodes, so reading `var(--color-warning)` is the whole implementation.

One more system-level issue these components sit on: in the web Dark theme `app-surface-sunken` equals `app-surface`, so sunken chips, wells and skeletons lose their edge. Six of the twelve rely on a sunken fill to carry shape (BillRow's chip, MemberRow's avatar, LockedActionRow's disabled button, ThumbnailRail's placeholder thumbnails, FactRow's skeleton, GrantLimitList's unselected chip). Until that token is separated, give each a 1px `app-border` hairline in dark, as the published previews do.

## 6. Open decisions

**Settled** — both former blockers are decided; build to these:

- **BillRow line 1 wraps to two lines and never truncates** (§4.4). The provider wraps, the chip follows it, the amount keeps its own line, the row grows to 92pt.
- **The warning ink correction applies to dark surfaces only** (§5). The light value is unchanged. Nothing to hard-code — read the token.

**Open** — build to the spec as written, revisit after:

1. MemberRow's own row is ~88pt against a stated 72pt (§4.5).
2. NotificationRow's bill reminder may be carrying the wrong provenance mark (§4.7).
3. LockedActionRow's server-refused reason runs to three lines (§4.9).
4. FactRow's three `reports-*` variants have no interaction (§4.2).
5. InviteRow's offline reasons are placed full-width rather than per-action (§4.6).
6. **Card radius.** The project decision was 20px (`radius-2xl`); several component messages asked for `radius-lg` (12px) for their cards, and both appear on the board. The published cards use the house `radius-2xl` except where a component explicitly specified `radius-lg`. Settle this once, globally.
7. Board 00a still inks its own artboards with the retired `#6B7280`, `#DC2626` and `#059669`. Cards on both boards name tokens and are unaffected; only the drawings disagree.

## 7. Acceptance checklist per component

A component is done when all of the following hold. This is the same set the board checked, so a reviewer can compare against the artboards directly.

- [ ] Every variant × state cell in §4 renders, and no extra states were invented.
- [ ] No hard-coded hex. Every colour resolves through a token, and the component renders correctly in Light, Dark and Dark · iOS.
- [ ] Greyscale pass: every state is distinguishable with colour removed.
- [ ] AX5 (iOS) and 200% (Android/web): text reflows, nothing truncates, and targets stay at or above the minimum. Where the spec overrides the usual reflow (BillRow and MemberRow keep the overflow top-trailing; FirstWeekRow keeps dismiss top-aligned), it does so.
- [ ] Targets: 44pt / 48dp / 44px with 8dp between neighbours; the target rule in §4.2 is honoured; no nested targets.
- [ ] Screen reader: the spoken pattern in §4 matches, custom actions are registered on both native platforms, live regions announce once, and disabled controls stay in the tree with their reason as a hint.
- [ ] Copy matches the strings in §4 exactly; any *(board string)* has product sign-off.
- [ ] Offline behaviour matches, including which controls stay enabled.
- [ ] The shipped counterpart is untouched, and the surfaces it still owns are unchanged.

## 8. What is not in this pack

- **Screen layouts.** These are row and list components only. The surfaces named under *Drawn for* are specified in the Pantopus prompt pack, not here.
- **The nine Foundations 00a components** — ProvenanceMark, SourceCaption, ScopeChip, FreshnessLine, OfflineNotice, StatusChip, KindGlyph, AddressChip, ChoiceChip — which these compose. They have their own handoff and their own cards in the design system, and none of them is in code yet either. Several components here cannot be built until their 00a dependency is: DateRow needs `KindGlyph` and `ProvenanceMark`, BillRow needs `StatusChip`, GrantLimitList needs `ChoiceChip`.
- **The seven Foundations 00b data instruments**, published separately.
- **The eight Foundations 00d components** (QuietDayReceipt, WarmingSkeleton, InlineUndo, DestructiveConfirm, LandingBannerSlot, NotificationAsk, PushCopy, ReminderLeadControl), published separately. Two of them are dependencies here: `InlineUndo` is the undo line in FactRow's declined states, FirstWeekRow's dismissed state and BillRow's marked-paid state, and `WarmingSkeleton` is the loading state in FactRow and MemberRow. Both were drawn as 00c's own before 00d specified them; **00d is the source for both**, and any disagreement should be resolved in its favour.
- **PickupCard**, which is not a Foundations component — it is designed in the `f4-today-pickup-card` screen prompt.
