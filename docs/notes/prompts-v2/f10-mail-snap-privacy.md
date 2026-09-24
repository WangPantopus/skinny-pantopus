# Mail snaps: privacy and storage
id: f10-mail-snap-privacy · platforms: web/ios/android · isNew: False · artboards: 23

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Mail snaps: privacy and storage · f10-mail-snap-privacy

TYPE: EXTENSION of the existing designed screen "Mail Day settings". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. You are adding one card, "Photos of your mail". On web it goes in the settings column. On iOS and Android it goes in the Mail Day settings stack, not in notification settings.

ATTACH: Mail Day settings on web 1440 (settings column), iOS and Android; the f10-mail-day-triage artboards (Mail Day with its settings row); the Foundations board (ThumbnailRail, DestructiveConfirm, ScopeChip, LockedActionRow, InlineErrorRow, OfflineNotice, FreshnessLine, WarmingSkeleton).

PLATFORMS & VIEWPORTS: web 1440x900 (left sidebar; card measure 720px max) and 390x844; iOS 393x852; Android 412x915.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Mail tab → Mail Day → settings. Entry points:
- Web: the "Mail snap settings" link on the Mail Day page.
- Native: the settings row on the Mail Day screen.
- "Manage mail snaps" on a photographed mail piece.
- "Where does this photo go?" on the Confirm what we read screen.
- The privacy mirror's "What we store" row.
Arrivals from a link scroll once to this card, fade a highlight within 300ms, and move focus to the card title. Each list row opens that mail piece, where one photo can be deleted; Back returns here.
Journey: someone who photographed a bank statement by mistake comes here, finds it in the list, opens it and deletes that photo, or deletes all of them. Their bills survive either way.

WHO AND WHEN: Maya Chen, owner of HOME A, on Tue 20 Oct 2026 at 7:30 AM (a fixture delta: the morning after last night's Mail Day). On Wed 30 Sep she photographed a Riverview Bank statement by mistake. Now she wants to see which photos exist and who can see them.

THE ONE JOB: One place to understand where photos of your mail are kept, who can see them, and to delete them.

FIRST FIVE SECONDS: (1) the title "Photos of your mail" with ScopeChip "Your household"; (2) the three-row "What we keep / Who can see them / How to delete" grid; (3) the list of photos. There is no single primary button. The toggle is the main control, and the destructive action comes last.

CONTENT (fixture deltas only; list each on Notes):
- Sam Ortega has bill access. Alex Kim is a Guest in HOME A without bill access.
- 17 photos in 15 pieces, 41.3 MB. A piece with several pages is one row. First 8 rows, newest first (10 photos, 25.1 MB):
  - Clark Public Utilities · Mon 19 Oct · 2 pages · 4.8 MB
  - Comcast · Mon 19 Oct · 1.9 MB
  - Larkspur Loop HOA · Mon 19 Oct · 1.9 MB · Not confirmed yet
  - Chase statement · Mon 19 Oct · 2 pages · 4.4 MB · Filed, no bill
  - NW Natural · Mon 5 Oct · 2.1 MB
  - Riverview Bank statement · Wed 30 Sep · 4.2 MB · Filed, no bill
  - Waste Connections · Mon 21 Sep · 2.2 MB · Filed, no bill
  - Not classified · Sat 12 Sep · 3.6 MB
  - then "Show all 15 pieces"
- The other 7 pieces (7 photos, 16.2 MB), shown when expanded: City of Vancouver water · Sat 5 Sep · 2.0 MB · Comcast · Sat 5 Sep · 1.8 MB · NW Natural · Sat 5 Sep · 2.1 MB · Larkspur Loop HOA · Mon 31 Aug · 1.9 MB · Riverview Bank statement · Mon 31 Aug · 3.9 MB · Filed, no bill · Clark County Treasurer · Mon 24 Aug · 2.6 MB · Filed, no bill · Not classified · Mon 24 Aug · 1.9 MB.
- Exactly 1 listed piece is not in bills and not filed yet: Larkspur Loop HOA · Mon 19 Oct (Not confirmed yet). This drives the delete-all confirm body.
- Retention is an open product decision. Draw the default as bounded: each photo is kept 90 days, then deleted. "90 days" is a stand-in. On every artboard, attach a small Notes callout ("Placeholder: retention period not decided") to each string that contains it. Frame 05 draws the other option (keeping photos is off by default).
- Default-off option fixture (frames 05 and 06b only, scene Mon 19 Oct 6:10 PM): 3 photos in 2 pieces, 6.7 MB, both waiting to be read: Clark Public Utilities · Mon 19 Oct · 2 pages · 4.8 MB and Comcast · Mon 19 Oct · 1.9 MB.
- Worst case: 240 photos in 190 pieces · 1.2 GB, and the payee "Washington State Department of Labor & Industries" · 12 pages.

LAYOUT & VISUALIZATION: A trust surface, not a preferences grid. One column in this fixed order:
1. Title and ScopeChip "Your household".
2. The explainer (body, two sentences).
3. The grid. Three label/value rows (label in label style, value in body). Each value ends with a link to the control that changes it. Maya's view:
   - "What we keep": "The photo, plus the payee, amount, due date and last 4 account digits we read from it. Full account numbers saved as text: None. The photo itself shows your full account number." Link: "Change what we keep" (moves focus to the toggle).
   - "Who can see them": "You and Sam. Alex sees that a piece arrived, not the photo or the amount. People nearby: None." Link: "Manage who can see bills" (opens the household members screen).
   - "How to delete": "One photo: open it below. All photos: use Delete all mail snaps at the end of this card." Link: "Go to Delete all" (moves focus to the button).
4. The single toggle "Keep the photo after we read it". Its consequence line sits directly beneath it and changes with the toggle; it is never a static helper.
5. The count line.
6. The list. Each row: ThumbnailRail (privacy variant, 32pt), payee, date and size, with a "Filed, no bill", "Not confirmed yet" or "2 pages" tag where it applies. The whole row is the target and opens the piece. The list is always shown on the card, never behind a disclosure; after 8 rows, "Show all 15 pieces" expands the rest in place. Rows have no checkboxes and no per-row delete.
7. "Delete all mail snaps", which uses the DestructiveConfirm destructive-button style exactly as on the Foundations board, and is never above the list. It is never a filled slab and never red label text.
- Write "None" as the word, never as a dash.
- Show no reminder or notification preferences on this card.

"What we keep" value variants:
- Frames with photos kept (01 to 04, 06, 07, 10 to 13, 15 to 18): the value above.
- Frame 05, default-off option: "The payee, amount, due date and last 4 account digits we read. The photo is deleted once we've read it. Full account numbers saved as text: None."
- Zero photos (frames 08 and 09): "Photos: None right now. The payee, amount, due date and last 4 account digits of bills you confirmed stay with those bills."

Who-row variants:
- Frames 01 to 12 and 15 to 18: the Alex-named who-row above.
- Frame 13, a household where everyone has bill access: "You and Sam. People nearby: None."
- Template for a household with an unnamed person lacking bill access (listed on Notes, not drawn): "You and Sam. Anyone else in your household without bill access sees that a piece arrived, not the photo or the amount. People nearby: None."
- If Sam had no bill access (listed on Notes, not drawn): "You. Sam sees that a piece arrived, not the photo or the amount. People nearby: None."

Guest view (Alex), same order with guest copy:
- The guest explainer: "We read the photo to suggest a payee, amount and due date. Maya or Sam confirms before anything is saved."
- "What we keep": the photos-kept value, with no link.
- "Who can see them": "Maya and Sam. You see that a piece arrived, not the photo or the amount. People nearby: None." No link.
- "How to delete": "Maya or Sam can delete these photos." No link.
- The toggle, disabled, with LockedActionRow "Maya or Sam can delete these photos. Maya can change this setting."
- No count line, no list, no delete button.

INTERACTION, MOTION & HAPTICS:
- The toggle changes the consequence line at once, and the change is announced. Turning it off never deletes existing photos. A line appears under the consequence: "These 17 were taken while the setting was on. Each is still deleted 90 days after it was taken."
- "Delete all mail snaps" opens DestructiveConfirm V2. Because a listed piece is not in bills yet, Maya's confirm uses the unconfirmed sub-variant (body below). In the default-off option, the confirm uses the waiting-to-be-read body.
- Deleting follows the board's S2: the dialog stays open over the card, the title stays, the body becomes "Deleting 10 of 17…" with a 4pt progress bar, both buttons are hidden, and Back, Escape and swipe do nothing. The live region reads progress at 5, 10 and 15.
- Done follows S3: the dialog closes and the card shows the status line "17 photos deleted. The bills and their amounts stay." (16pt check glyph, bodySmall text.primary) above the zero state.
- Deletion is permanent, so there is no Undo.
- Reduce Motion: no row collapse animation; states cross-fade; the list WarmingSkeleton is static (it shimmers otherwise). One light haptic tick on confirming the delete.
- Back or Escape closes the confirm while it is open (S1).

FOUNDATIONS COMPONENTS USED: ScopeChip ("Your household") · ThumbnailRail (privacy list, 32pt; offline state) · DestructiveConfirm (V2 "Delete all 17 photos?"; unconfirmed sub-variant and waiting-to-be-read sub-variant below; open, deleting and done states as on the board) · WarmingSkeleton (row skeleton) · LockedActionRow (names who can act) · InlineErrorRow · OfflineNotice · FreshnessLine.

ACCESSIBILITY:
- Reading order follows the fixed order above.
- Each grid row reads as one element, label then value, with its link as a separate focusable item.
- Each list row reads as one element: "Riverview Bank statement, photographed Wednesday 30 September, 4.2 megabytes, filed, no bill. Opens the photo."
- The toggle speaks its label, its state and the consequence line.
- Targets are 44pt / 48dp / 44px, and thumbnails are never separate targets.
- Progress and results are polite live regions.
- Confirm focus follows DestructiveConfirm on the Foundations board: the title for screen readers, Keep for the keyboard, never Delete.
- At AX5 the grid stacks label above value, list rows stack payee above date and size, and the toggle label wraps above the switch.
- No meaning depends on colour; the delete button reads by its words and trash glyph.

COPY (sentence case):
- "Photos of your mail"
- Explainer: "We read the photo to suggest a payee, amount and due date. You confirm before anything is saved."
- Guest explainer: "We read the photo to suggest a payee, amount and due date. Maya or Sam confirms before anything is saved."
- "What we keep" · "Who can see them" · "How to delete" · "Change what we keep" · "Manage who can see bills" · "Go to Delete all"
- "The photo itself shows your full account number."
- "Keep the photo after we read it"
- On: "We keep each photo for 90 days so you can check it, then delete it. The payee, amount, due date and last 4 account digits stay."
- Off: "We read the photo, then delete it. Only the payee, amount, due date and last 4 account digits stay."
- "These 17 were taken while the setting was on. Each is still deleted 90 days after it was taken."
- "17 photos in 15 pieces · 41.3 MB · each kept 90 days, then deleted" · "Show all 15 pieces" · "Show fewer"
- Default-off option: "3 photos in 2 pieces · 6.7 MB · deleted after we read them" · tag "Waiting to be read" · "What we keep": "The payee, amount, due date and last 4 account digits we read. The photo is deleted once we've read it. Full account numbers saved as text: None."
- "Delete all mail snaps"
- Confirm V2, unconfirmed sub-variant (drawn on frame 06): title "Delete all 17 photos?" · body "The bills and their amounts stay; only the photos are removed. 1 piece isn't in bills yet, so you'll type its amount and due date yourself." · buttons "Delete 17 photos" / "Keep them"
- Confirm V2, waiting-to-be-read sub-variant (drawn on frame 06b): title "Delete all 3 photos?" · body "The 2 pieces waiting to be read won't be read; their mail records stay." · buttons "Delete 3 photos" / "Keep them"
- Confirm V2 base body, when every listed piece is already in bills or filed (listed on Notes, not drawn): "The bills and their amounts stay; only the photos are removed."
- "Deleting 10 of 17…"
- "17 photos deleted. The bills and their amounts stay."
- Zero: "No mail snaps stored. Photos you take on Mail Day will be listed here." · "What we keep": "Photos: None right now. The payee, amount, due date and last 4 account digits of bills you confirmed stay with those bills."
- Reading off: "Reading photos is off for now. You can still photograph a piece of mail and type the payee, amount and due date yourself."
- Frame 13 who-row: "You and Sam. People nearby: None."
- Guest view (Alex): "Maya and Sam. You see that a piece arrived, not the photo or the amount. People nearby: None." · "Maya or Sam can delete these photos." · LockedActionRow "Maya or Sam can delete these photos. Maya can change this setting."
- Error: "We couldn't load your mail snaps. Check your connection, then retry." · "Retry"
- Offline: "You're offline · list as of Mon 19 Oct, 9:40 PM" · on the toggle and delete: "Needs a connection."

EDGE CASES:
- 240 photos in 190 pieces: the card shows 8 rows and "Show all 190 pieces". The count line reads "240 photos in 190 pieces · 1.2 GB · each kept 90 days, then deleted".
- Long payee: wraps and never truncates.
- Zero photos: the list and the delete button are absent (not disabled). The "What we keep" row reads "Photos: None right now. The payee, amount, due date and last 4 account digits of bills you confirmed stay with those bills."
- Slow network: the explainer, grid and toggle render at once, and the list slot shows WarmingSkeleton rows.
- Error: the explainer, grid and toggle still render, and the error row sits in the list slot.
- Reading off (this deployment does not read photos): the toggle still works, and the notice sits under the explainer.
- A piece not confirmed yet loses the photo pane in Confirm what we read once its photo is deleted; the confirm body says so in plain words.
- Permission:
  - A guest without bill access (Alex) sees the guest view described above.
  - A saved place has no mail snaps, so the card is absent.
- Multi-home: when someone has more than one home, the chip uses the named variant, "Larkspur Loop · Your household".
- A 2-page piece counts as 2 photos and 1 row, tagged "2 pages". A 12-page piece is one row tagged "12 pages".

INSTEAD OF:
- Instead of stacked settings toggles, draw paragraph → grid → one toggle with its consequence → count → list → delete — because this card exists to build trust, not to hold settings.
- Instead of a "View snaps" disclosure or a count chip, show the list on the card — because people must see a mistaken bank statement before they can remove it.
- Instead of "Everyone in this household can see them", name who sees what, from the viewer's side — because bill access differs within a household.
- Instead of keeping photos with no stated end, state the period in the consequence and count lines — because the photos show full account numbers.
- Instead of a disabled delete button when nothing is stored, draw no button — because a destructive control with nothing to act on only alarms people.
- Instead of a confirm that only says it cannot be undone or that the bills stay, name what stays and what is lost for pieces not in bills yet — because that is the fear, and a promise about a bill that does not exist is untrue.
- Instead of "What we keep: None" when photos are gone, say the photos are gone and the confirmed bill facts stay — because a trust card must never understate what is stored.
- Instead of a red-labelled or red-filled delete button, use the DestructiveConfirm destructive-button style from the Foundations board — because red text fails contrast in dark mode.

DONE WHEN: Maya can find the Riverview Bank statement without leaving the card. She can tell exactly who can see it and how long it is kept, and she can delete it, or all 17 photos, knowing her bills stay and knowing the one piece not in bills yet will need typing. Every count agrees: 17 photos, 15 pieces, 15 rows when expanded. A card with zero photos has no destructive control and still says what is kept. Alex, a guest, is told in his own terms what he can and cannot see, and is never pointed at a control he cannot use. No reminder settings appear on the card.

ARTBOARDS:
1. f10-mail-snap-privacy · web-1440 · 01-photos-kept · light — settings column, full card at 720px, 8 rows plus "Show all 15 pieces".
2. f10-mail-snap-privacy · ios · 02-photos-kept · light — same card in the Mail Day settings stack.
3. f10-mail-snap-privacy · ios · 03-all-pieces-open · light — list expanded to 15 rows with "Show fewer".
4. f10-mail-snap-privacy · ios · 04-photos-off-after-on · light — toggle off, off consequence, "These 17 were taken…" line.
5. f10-mail-snap-privacy · ios · 05-default-off-option · light — product option: toggle off from the start, 2 pieces waiting to be read, default-off "What we keep" value, no carry-over line, "deleted after we read them" count.
6. f10-mail-snap-privacy · ios · 06-delete-all-confirm · light — DestructiveConfirm V2 unconfirmed sub-variant open over the card ("1 piece isn't in bills yet…").
7. f10-mail-snap-privacy · ios · 06b-delete-all-unconfirmed · light — the default-off option's confirm: "Delete all 3 photos?", "The 2 pieces waiting to be read won't be read; their mail records stay."
8. f10-mail-snap-privacy · ios · 07-deleting · light — DestructiveConfirm V2 in S2, "Deleting 10 of 17…", buttons hidden.
9. f10-mail-snap-privacy · ios · 08-deleted · light — status line "17 photos deleted. The bills and their amounts stay." above the zero state, zero "What we keep" value.
10. f10-mail-snap-privacy · ios · 09-zero-snaps · light — no list, no delete button, "Photos: None right now…" value.
11. f10-mail-snap-privacy · ios · 10-reading-off · light — "Reading photos is off for now…" notice, toggle working.
12. f10-mail-snap-privacy · ios · 11-loading · light — explainer, grid and toggle rendered, list slot skeleton.
13. f10-mail-snap-privacy · ios · 12-error · light — error row in the list slot.
14. f10-mail-snap-privacy · ios · 13-no-guest-household · light — Maya's view where everyone has bill access: "You and Sam. People nearby: None."
15. f10-mail-snap-privacy · ios · 14-guest-view · light — Alex's view: guest explainer, guest grid, disabled toggle, LockedActionRow, no list.
16. f10-mail-snap-privacy · ios · 15-offline · light — cached list, disabled controls with reasons.
17. f10-mail-snap-privacy · android · 16-photos-kept · light — Material switch and list.
18. f10-mail-snap-privacy · web-390 · 17-worst-case · light — 240 photos in 190 pieces, "Washington State Department of Labor & Industries".
19. f10-mail-snap-privacy · ios · 18-ax5 · light — AX5 stacking.
20. f10-mail-snap-privacy · ios · 19-greyscale · light — 02-photos-kept in greyscale.
21. f10-mail-snap-privacy · web-1440 · 01-photos-kept · dark — dark twin of 01-photos-kept.
22. f10-mail-snap-privacy · ios · 07-deleting · dark — dark twin of 07-deleting, dialog on dark base.
23. Notes — the undecided retention period and default (every 90-day string listed); the Tue 20 Oct scene date and the Mon 19 Oct 6:10 PM default-off scene; Sam Ortega with bill access and Alex Kim as Guest; every invented string, the full 15-piece list, sizes and the 240/190 worst case; the DestructiveConfirm V2 unconfirmed and waiting-to-be-read sub-variants, and the base body used when every piece is in bills or filed; proposed V2 body for a future revision: "Your bills, their amounts and your mail records stay; only the photos are removed.", because 8 of the 15 pieces have no bill; that deleting the photo of a piece not confirmed yet removes its photo pane in Confirm what we read; the who-row template for an unnamed person without bill access and the Sam-without-bill-access who-row; that "Maya can change this setting" assumes only the owner changes home settings; the "Reading photos is off for now" wording for a deployment without photo reading; the multi-home chip variant; assumptions and omitted states.

BATCH PLAN:
Turn 1: 1-6, then wait for "continue".
Turn 2: 7-12, then wait for "continue".
Turn 3: 13-18, then wait for "continue".
Turn 4: 19-23.
