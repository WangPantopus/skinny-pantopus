# Bill provenance block (from a photo you took)
id: f10-bill-provenance · platforms: web/ios/android · isNew: False · artboards: 23

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Bill provenance block (from a photo you took) · f10-bill-provenance

TYPE: EXTENSION of "Bill detail".
- iOS and Android: this screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
- Web: the host is the new Bill detail web route (f3-bill-detail-web), drawn earlier in this pack. Attach its artboards, not a product screenshot, and treat them as exact in the same way: keep everything and change only what is listed.
On every platform you are adding one block beneath the bill's facts, and nothing else.

ATTACH: Bill detail on iOS and Android (screenshots); the f3-bill-detail-web artboards (web 1440 and 390, including its "This bill was removed" state); the Bills list with a few rows; the Foundations board (ProvenanceMark, ProvenanceSheet, ThumbnailRail, DestructiveConfirm, InlineUndo, WarmingSkeleton, StatusChip, BillRow, LockedActionRow, InlineErrorRow, OfflineNotice).

PLATFORMS & VIEWPORTS: web 1440x900 (left sidebar) and 390x844; iOS 393x852; Android 412x915.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → place file → Money → Bills → Bill detail. Every arrival lands on this bill, never on a list:
- a Bills list row;
- the home dashboard Bills card, which opens this bill with it highlighted;
- the Today 14-day strip's money row, "Clark Public Utilities · $142.18 · in 3 days · due Fri 23 Oct";
- the bill reminder push on Thu 22 Oct, "Clark PUD due tomorrow" / "Larkspur Loop", which carries no amount;
- the household notification "Sam marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop", which opens the paid state;
- "Added to bills" ("Open the bill") on the photographed mail piece in the Mail tab.
Web URL: /app/homes/{home}/bills/{bill}. Each arrival hands over one bill. The block hands off to the mail piece ("View the photo") and to Confirm what we read, reopened with this bill's values ("Fix what we read").

WHO AND WHEN: Maya Chen, owner of HOME A, at 7:30 AM on Tue 20 Oct 2026 (a fixture delta). She opened the bill from Today. At 6:04 PM the evening before, she scanned it on Mail Day and confirmed what we read.

THE ONE JOB: Show honestly where this bill came from: a machine read a photo and a person confirmed it. Give one place to fix it, view the photo, or delete both.

FIRST FIVE SECONDS:
1. The amount "$142.18" and "in 3 days · due Fri 23 Oct". This is the host headline, unchanged.
2. StatusChip "Upcoming".
3. Below them, the quiet block "From a photo you took · Mon 19 Oct".
The host's Mark paid stays the screen's primary action. Inside the block, "View the photo" leads.

CONTENT (house style fixtures; deltas below, list each on Notes)
- Sam Ortega has bill access: he can add, fix, mark paid and delete bills.
- Alex Kim is a Guest in HOME A without bill access.
Host, unchanged: Clark Public Utilities · $142.18 · due Fri 23 Oct · account ending 4471 · service address 2418 NE Larkspur Loop, Vancouver, WA 98684 · "Added by you · Mon 19 Oct".
Block, Maya took the photo:
- a 56pt stacked thumbnail labelled "2 pages";
- header "From a photo you took · Mon 19 Oct";
- line "We read this from your photo. You confirmed the amount on Mon 19 Oct."
- trailing caption "You added this".
Variants:
- Corrected date (added under the line): "We read Thu 8 Oct, the statement date. You changed it to Fri 23 Oct on Mon 19 Oct."
- Sam took the photo. Every string names Sam, never "you":
  - header "From a photo Sam took · Mon 19 Oct";
  - line "We read this from Sam's photo. Sam confirmed the amount on Mon 19 Oct.";
  - corrected line "We read Thu 8 Oct, the statement date. Sam changed it to Fri 23 Oct on Mon 19 Oct.";
  - the tick mark stays, and its first-occurrence word reads "Sam added this";
  - the host reads "Added by Sam · Mon 19 Oct".
  The header always names the person who took the photo.
- Paid (frame dated Fri 23 Oct): the host reads "Paid by Sam · Thu 22 Oct".
- Overdue (frame dated Mon 26 Oct): "Overdue · was due Fri 23 Oct".
- Photo deleted: the September bill, Clark Public Utilities · $109.60 · Paid, "From a photo you took · Mon 21 Sep", and "The photo was deleted on Sat 17 Oct. The amount you confirmed stays."
- Guest without bill access (Alex): header "From a photo Maya took · Mon 19 Oct".
Worst case: "Washington State Department of Labor & Industries" · $12,480.00 · due Mon 2 Nov, with Sam as the person who took the photo:
- header "From a photo Sam took · Mon 19 Oct";
- line "We read this from Sam's photo. Sam confirmed the amount on Mon 19 Oct.";
- corrected line "We read Mon 12 Oct, the statement date. Sam changed it to Mon 2 Nov on Mon 19 Oct.";
- host "Paid by Sam · Tue 20 Oct";
- the stacked thumbnail reads "12 pages".

LAYOUT & VISUALIZATION
Placement:
- The block is evidence placed beneath the bill's facts, never a banner. It sits below the amount, due date, status and account facts, and above the bill trend card.
- It uses surface.raised with a 1px edge in text.secondary-strength ink or darker (at least 3:1) in both themes. It is one step quieter than the bill facts.

Row 1 is the whole-row target (44pt min). Left to right:
- ThumbnailRail (56pt, radius md);
- the header in bodySmall and the line in caption, both text.secondary;
- trailing: ProvenanceMark S you-added with the caption "You added this" ("Sam added this" in the Sam variant), then a chevron.
Tapping row 1 opens ProvenanceSheet. Row 1 also carries the custom accessibility action "View the photo".

Actions:
- Directly under row 1, two text buttons: "View the photo" and "Fix what we read".
- At the block's foot, set apart by 16pt: "Delete the bill and the photo", which uses the DestructiveConfirm destructive-button style exactly as on the Foundations board. Never red label text.
- On a snapped bill, the host's own remove action opens this same confirm. There is one delete path, not two.

Marks:
- Every committed bill shows the filled mark with the knocked-out tick. A corrected value keeps that mark; only the plain-text history line tells the story.
- Draw no hollow mark in this block, no confidence number, and no "AI" label.

ProvenanceSheet, photo-read variant (a proposed contract addition), titled "Where this fact comes from", in this order:
- mark L plus the legend;
- Authority "Your photo, confirmed by you" (Sam variant: "Sam's photo, confirmed by Sam");
- caption "Confirmed Mon 19 Oct, 6:04 PM";
- the confidence sentence "Read from your photo on Mon 19 Oct. You confirmed the payee, amount and due date." (Sam variant: "Read from Sam's photo on Mon 19 Oct. Sam confirmed the payee, amount and due date."). With a corrected date, add: "You changed the due date on Mon 19 Oct." (Sam variant: "Sam changed the due date on Mon 19 Oct.");
- Covers: "Your household";
- a flat source caption "From your mail snap of Mon 19 Oct" (Sam variant: "From Sam's mail snap of Mon 19 Oct"), not tappable, because "View the photo" is on the block;
- a foot control "Fix what we read". Corrections happen in place; this sheet has no report control and does not offer the public-record "This isn't right" reason list;
- a visible Close.

Degradation:
- A hand-entered bill has no block at all: no empty slot, no "No photo" row.
- Photo deleted: the rail uses its deleted variant (quiet document glyph plus words). "View the photo" and its custom action are removed. "Fix what we read" stays and opens the confirm screen without a photo pane. The delete button reads "Delete the bill".
- Offline: the rail uses its offline variant.
- Loading: the block slot holds WarmingSkeleton at its final height.

Guest host (Alex): title "A household bill", no amount, due line "Due Fri 23 Oct" only if the attached host already shows due dates to guests (otherwise omit it), and no StatusChip. Log this choice on Notes.

INTERACTION, MOTION & HAPTICS
Navigation:
- "View the photo" opens the mail piece; Back returns here.
- "Fix what we read" reopens Confirm what we read with the bill's values. Committing there returns here with the history line updated.
Delete, bill with photo:
- The delete button opens DestructiveConfirm, bill-plus-photo variant. Confirming closes the dialog at once (no deleting progress, because nothing is removed yet) and returns Maya to Bills.
- On Bills, the row collapses in place to InlineUndo "Bill and photo deleted · Undo", which stays until she leaves the screen. A snackbar may echo it, and it stays while a screen reader runs.
- Nothing is removed and no reminder is cancelled until the undo closes. The deleted bill never lingers under Upcoming.
Delete, photo already deleted ("Delete the bill"):
- Use the same flow as the host's remove action for a hand-entered bill. Draw the no-dialog path: return to Bills, where the row collapses to InlineUndo "Bill deleted · Undo".
- If the attached host already confirms removals, draw its confirm instead with title "Delete this bill?", body "The $109.60 bill and its reminders go; the mail record stays in Mail.", buttons "Delete bill" / "Keep it". Log on Notes which one you drew.
- Never reuse the bill-plus-photo body here, because this bill has no photo left.
Arrival, motion and haptics:
- A push or notification arrival lands at the top of the bill and moves focus to the amount. It draws no highlight, because the bill is the whole screen and nothing scrolls. A dashboard Bills card arrival highlights the bill's headline once and fades it within 300ms.
- Reduce Motion: cross-fades only. WarmingSkeleton is static.
- One light haptic tick when a delete is confirmed.
- Android Back and web Escape close the sheet and the confirm.

FOUNDATIONS COMPONENTS USED: ProvenanceMark (you-added; S in the block, L in the sheet) · ProvenanceSheet (proposed photo-read variant: self-fix "Fix what we read", no report control) · ThumbnailRail (56pt, stacked; deleted and offline states) · DestructiveConfirm, new variant "bill + photo" (list it on Notes; its done state is InlineUndo, not the board's S3 status line, because the deletion is held until the undo closes) · InlineUndo ("bill + photo deleted" variant, and the plain removed-row variant "Bill deleted · Undo") · WarmingSkeleton (row skeleton with a 56pt thumbnail slot; shimmer, static under Reduce Motion) · StatusChip (Upcoming, Overdue, Paid) · BillRow (on the Bills list after delete) · LockedActionRow (names who can act) · InlineErrorRow · OfflineNotice.

ACCESSIBILITY
Reading order: host facts, then the block's header, line and mark name, then its actions.
Row 1 is read as one element:
- Maya variant: "From a photo you took, Monday 19 October. We read this from your photo. You confirmed the amount on Monday 19 October. You added this. Opens where this fact comes from."
- Sam variant: "From a photo Sam took, Monday 19 October. We read this from Sam's photo. Sam confirmed the amount on Monday 19 October. Sam added this. Opens where this fact comes from."
- Custom action on row 1: "View the photo" (the visible button stays directly under the row).
Elements:
- The thumbnail is labelled "Photo of the bill, 2 pages" and is never a target by itself.
- Disabled actions stay focusable and read their reason.
- Overdue is stated in words; the error hue appears on the glyph only.
- Confirm focus follows DestructiveConfirm on the Foundations board: the title for screen readers, Keep for the keyboard, never Delete.
AX5: the thumbnail moves above the text, the mark and its caption wrap under the line, and the two text buttons stack full width.

COPY (sentence case)
"From a photo you took · Mon 19 Oct" · "From a photo Sam took · Mon 19 Oct" · "From a photo Maya took · Mon 19 Oct"
"We read this from your photo. You confirmed the amount on Mon 19 Oct."
"We read this from Sam's photo. Sam confirmed the amount on Mon 19 Oct."
"We read Thu 8 Oct, the statement date. You changed it to Fri 23 Oct on Mon 19 Oct."
"We read Thu 8 Oct, the statement date. Sam changed it to Fri 23 Oct on Mon 19 Oct."
"You added this" · "Sam added this" · "View the photo" · "Fix what we read" · "Delete the bill and the photo" · "Delete the bill"
ProvenanceSheet: "Where this fact comes from" · "Your photo, confirmed by you" · "Sam's photo, confirmed by Sam" · "Confirmed Mon 19 Oct, 6:04 PM" · "Read from your photo on Mon 19 Oct. You confirmed the payee, amount and due date." · "You changed the due date on Mon 19 Oct." · "Covers: Your household" · "From your mail snap of Mon 19 Oct" · "Close"
Confirm (bill + photo):
- title "Delete this bill and its photo?"
- body "The $142.18 bill, its reminders and both photo pages go; the mail record stays in Mail."
- buttons "Delete bill and photo" / "Keep them"
"Bill and photo deleted · Undo"
Confirm (bill only, photo already deleted, only if the host confirms removals): title "Delete this bill?" · body "The $109.60 bill and its reminders go; the mail record stays in Mail." · buttons "Delete bill" / "Keep it" · "Bill deleted · Undo"
"The photo was deleted on Sat 17 Oct. The amount you confirmed stays."
"Paid by Sam · Thu 22 Oct"
Notification row: "Sam marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop"
Guest (Alex): "A household bill" · "Only Maya and Sam can see this bill's payee, amount and photo." with LockedActionRow "Maya or Sam can fix or delete this bill."
Error: "We couldn't load where this bill came from. Check your connection, then retry." · "Retry"
Offline: "You're offline. The photo isn't saved on this device." · under each action: "Needs a connection."
Host, deleted since the push: "This bill was removed." · "Go to Bills"
Mail piece after the delete (drawn in its own prompt): "Bill deleted Tue 20 Oct"

EDGE CASES
- The longest payee wraps and never truncates. "$12,480.00" fits the host headline.
- A 12-page piece shows the stacked thumbnail labelled "12 pages".
- Slow network: the host renders first. The block slot keeps its height with WarmingSkeleton, then shows the error row if loading fails.
- Guest Alex sees the guest host ("A household bill", no amount, no StatusChip) and the header "From a photo Maya took · Mon 19 Oct". The thumbnail is replaced by a document glyph, because a photo of a bill shows the amount. All three actions are disabled, and LockedActionRow names Maya and Sam.
- The paid arrival reads as reassurance, and the block is unchanged.
- Overdue: the chip changes and the block stays quiet.
- A reminder push that lands after the bill was deleted shows the host's "This bill was removed." state with "Go to Bills". The block is absent.
- After a bill-and-photo delete, the mail piece loses its "Added to bills" row and shows "Bill deleted Tue 20 Oct" in its place.
- Multi-home: not applicable; the block names people, not homes.
- A saved place (PLACE B) has no bills, so this block never appears there.

INSTEAD OF
- Instead of a banner above the amount, draw a quiet block beneath the facts — because the amount is what people came for.
- Instead of a hollow mark on a corrected bill, draw the tick mark plus a plain history line — because the person confirmed it, and a hollow mark would say they had not.
- Instead of a confidence percentage or an "AI" badge, draw "You confirmed the amount on Mon 19 Oct" — because a score invites doubt about a value already checked.
- Instead of "you" on a bill Sam photographed, name Sam in the header, the line, the correction, the mark's word and the spoken label — because the block exists to say who did what.
- Instead of making the thumbnail open the photo inside the row, keep one row target with a chevron, put "View the photo" directly under it and add it as the row's custom action — because two targets in one row break the whole-row rule.
- Instead of a "No photo" placeholder on a hand-entered bill, draw nothing — because an empty slot reads as missing data.
- Instead of "Paid" for confirming a read, say "confirmed" — because Paid only ever means Mark paid.
- Instead of red label text on the delete button, use the DestructiveConfirm destructive-button style from the Foundations board — because red text fails contrast in dark mode.

DONE WHEN
- On every arrival, the amount is read first and the photo origin second.
- The photo is one tap away, and fixes happen in place.
- Every line in the block names the person who actually took, confirmed or changed it.
- Delete removes bill and photo together, with an undo that has no timer, and the confirm names what goes and what stays; a bill whose photo is already gone never promises to delete photo pages.
- A corrected date never looks unconfirmed.
- A hand-entered bill looks exactly as it does today.
- A push to a deleted bill lands on "This bill was removed.", not an error.
- Alex never sees the amount, even in the host headline.

ARTBOARDS
1. f10-bill-provenance · ios · 01-snapped-confirmed · light — Clark Public Utilities, block beneath the facts, Mark paid in the host.
2. f10-bill-provenance · ios · 02-manual-no-block · light — the same bill entered by hand, no block.
3. f10-bill-provenance · ios · 03-corrected-date · light — tick mark plus the history line; inset: the sheet sentence with "You changed the due date on Mon 19 Oct."
4. f10-bill-provenance · ios · 04-provenance-sheet · light — "Where this fact comes from", photo-read variant at medium detent, Authority, confirmed time, flat source caption, Close.
5. f10-bill-provenance · ios · 05-delete-confirm · light — DestructiveConfirm bill + photo variant, Foundations destructive-button style.
6. f10-bill-provenance · ios · 06-deleted-undo · light — Bills list row collapsed to "Bill and photo deleted · Undo".
7. f10-bill-provenance · ios · 07-photo-deleted · light — September bill, deleted rail, no "View the photo", "Delete the bill".
8. f10-bill-provenance · ios · 07b-photo-deleted-delete · light — after "Delete the bill": Bills row collapsed to "Bill deleted · Undo" (or the host's bill-only confirm if it has one).
9. f10-bill-provenance · ios · 08-paid-by-sam · light — landing from "Sam marked Clark PUD paid" on Fri 23 Oct, reassurance.
10. f10-bill-provenance · ios · 09-overdue · light — Mon 26 Oct, Overdue chip, quiet block.
11. f10-bill-provenance · ios · 10-guest · light — Alex: guest host "A household bill" with no amount and no chip, "From a photo Maya took", document glyph, LockedActionRow.
12. f10-bill-provenance · ios · 11-loading · light — host facts rendered, block slot skeleton at final height.
13. f10-bill-provenance · ios · 12-error · light — InlineErrorRow in the block slot, bill intact.
14. f10-bill-provenance · ios · 13-offline · light — offline rail, disabled actions with reasons.
15. f10-bill-provenance · ios · 14-bill-removed · light — push landing after delete: host "This bill was removed." with "Go to Bills", no block.
16. f10-bill-provenance · android · 15-snapped-confirmed · light — Material version of 01-snapped-confirmed.
17. f10-bill-provenance · web-1440 · 16-snapped-confirmed · light — the f3-bill-detail-web route with the left sidebar.
18. f10-bill-provenance · web-390 · 17-worst-case · light — Labor & Industries, Sam-took header, Sam's line and correction, "Sam added this", paid line.
19. f10-bill-provenance · ios · 18-ax5 · light — AX5 stacking.
20. f10-bill-provenance · ios · 19-greyscale · light — 01-snapped-confirmed in greyscale.
21. f10-bill-provenance · ios · 01-snapped-confirmed · dark — dark twin of 01-snapped-confirmed.
22. f10-bill-provenance · ios · 09-overdue · dark — dark twin of 09-overdue.
23. Notes — the scene dates; Sam Ortega has bill access (can add, fix, mark paid and delete bills); Alex Kim as Guest; "Sam added this" as a proposed ProvenanceMark legend variant and spoken-name variant for a fact another member added; ProvenanceSheet photo-read variant (self-fix "Fix what we read", no report control, Authority "Your photo, confirmed by you") as a proposed contract addition; the new DestructiveConfirm "bill + photo" variant and why its done state is InlineUndo; which delete path 07b draws for a bill whose photo is gone, and the bill-only confirm text; the guest host choice (no amount, no chip, due line only if the host shows it to guests); why a top-of-screen push landing skips the highlight; that f3-bill-detail-web is the web host; handoff line "Web delete must write status 'canceled' so the deleted bill leaves Upcoming."; every invented string (including the Labor & Industries dates, the 6:04 PM confirmed time and "Bill deleted Tue 20 Oct"); assumptions and omitted states.

BATCH PLAN
Turn 1: 1-6, then wait for "continue".
Turn 2: 7-12, then wait for "continue".
Turn 3: 13-18, then wait for "continue".
Turn 4: 19-23.
