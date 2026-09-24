# Mail Day triage (snap-aware)
id: f10-mail-day-triage · platforms: web/ios/android · isNew: True · artboards: 24

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Mail Day · f10-mail-day-triage

TYPE: Web: NEW screen (a new page at /app/mailbox/mail-day; web has no triage page today, and the Mail Day nav item currently opens the Mail Day settings page). iOS and Android: EXTENSION of the existing designed screen "Mail Day". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed: the header capture button, the audience line, the photographed row, the decision control, the in-place undo, the footer padding, and the states below. Also, on the native screens: remove the streak chip and put the caption "Last scan today, 6:04 PM" in its place; remove the Scan more card (the header button replaces it); replace the setup nudge with the NotificationAsk card row; add the "Mail Day settings" link; replace "Undo (4s)" with a static "Undo".

ATTACH: iOS Mail Day (populated, and the empty hero with "Scan today's stack"); Android Mail Day (same two); web Mail tab with the mailbox nav and the Mail Day banner.

PLATFORMS & VIEWPORTS: web 1440x900 and 390x844; iOS 393x852; Android 412x915. Web gets the full state set because it is new. Native frames show the extension changes.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Mail tab → Mail Day, the tab's working page. Settings become a "Mail Day settings" link inside it. Entry points:
- The Mail Day item in the mailbox nav. On web it now points to this page; without that, the feature is invisible on web.
- The Mail Day banner in the mailbox layout.
- The 6:30 PM Mail Day push.
- The Money section of the Place file.
- The iOS Today "Scan mail" chip, now active. It switches to Mail → Mail Day, then runs the same checks and the scanner as "Scan today's stack".
- Deep links /app/mailbox/mail-day and pantopus://mailbox/mailday.

People also come back here from two places:
- The capture tray, after "Done (4)". One new photographed row appears per piece, uploading or being read. If a piece was already read when Done was tapped, Confirm what we read opens at once instead. Otherwise Maya lands here, and when the first read finishes, a polite status line appears under the header: "1 piece ready to check · Check now". Nothing opens on its own after she has acted on this screen.
- Confirm what we read. The row now reads "Added to bills" or "Filed" and stays in Needs a call until the paper is decided.

This screen hands off to:
- the system document scanner, then the capture tray, from "Scan today's stack". On web the button opens the Today's stack modal or sheet directly.
- Confirm what we read, from "Confirm what we read" and "Check now".
- the mail piece, from "See the piece".
- the Date sheet (create mode, Bill kind), from the no-claimed-home notice.
- Mail snaps: privacy and storage, from its link.

WHO AND WHEN: Maya Chen at HOME A, Mon 19 Oct 2026, 6:10 PM. HOME A has three people: Maya and Sam Ortega, who can see bills, and Alex Kim, a guest with access until Sun 1 Nov, who cannot see bill photos or amounts. At 6:04 PM Maya scanned tonight's stack: 4 pieces, from Clark Public Utilities, City of Vancouver water, Larkspur Loop HOA and Chase. No piece had been read when she tapped Done, so she landed here. Now two pieces have been read and neither is confirmed yet. The water bill is still uploading, and one Chase page failed to upload. Five digital pieces also wait for a decision. Six pieces are already decided, two of them from a scan at lunch (12:40 PM). At 6:12 PM she taps "Confirm what we read" on row 1.

THE ONE JOB: Turn tonight's stack of paper and digital mail into decisions Maya can finish in one sitting.

FIRST FIVE SECONDS:
1) The header "Mail Day · Mon 19 Oct".
2) The first Needs a call row: the Clark Public Utilities photo with the ring mark, "$142.18 · due date needs a check", and the filled "Confirm what we read".
3) The "Finish day" footer.
Primary action: "Confirm what we read" on row 1. It is the only filled control in view.

CONTENT (house style fixtures, plus these changes)
Bills before tonight: the bills list holds only Comcast (added from the 12:40 PM scan). Clark Public Utilities ($142.18 due Fri 23 Oct), City of Vancouver water ($84.00 due Wed 28 Oct) and the HOA dues ($285 due Sun 1 Nov) become the fixture bills only once they are confirmed tonight. Nothing on this screen shows them as bills yet.

Header: "Mail Day · Mon 19 Oct" · "2418 NE Larkspur Loop" · ScopeChip "Your household" · audience line "Only you and Sam can see these photos. Alex sees that mail arrived, not the photos or amounts." · caption "Last scan today, 6:04 PM" · outlined "Scan today's stack" with a camera glyph · link "Mail Day settings". No streak chip anywhere.
Status line, under the header in frame 1: "2 pieces ready to check · Check now".

NEEDS A CALL (9). Put one legend line under the heading, once: "○ Read from your photo, not confirmed · ✓ You added this". Rows, in this order:
1. [photo, ring mark] Clark Public Utilities · Bill · "$142.18 · due date needs a check" · filled "Confirm what we read" · text button "Decide"
2. [photo, upload ring 60%] Photo of your mail · "2 pages" · "1 of 2 uploaded, 60%"
3. [photo, retry glyph] Photo of your mail · "3 pages · 2 of 3 uploaded" · InlineErrorRow "Page 3 didn't upload" · "Retry page 3 of 3" (this is the Chase statement; it has not been read, so its sender is not shown)
4. [photo, ring mark] Larkspur Loop HOA · Bill · "$285.00 · due in 13 days · Sun 1 Nov" · outlined "Confirm what we read" · text button "Decide"
5. Clark County Treasurer · Statement · "Property tax 2nd half · due in 14 days · Mon 2 Nov" · "Decide"
6. State Farm · Renewal · "Auto policy renews in 16 days · Wed 4 Nov" · "Decide"
7. Clark County Elections · Notice · "Voters' pamphlet · election in 15 days · Tue 3 Nov" · "Decide"
8. Capital One · Statement · "Account ending 2290" · "Decide"
9. Waste Connections · Service notice · "Holiday pickup schedule" · "Decide"
No row carries the words "Not confirmed"; the legend says it once.

REVIEWED TODAY (6) is collapsed to one line: "Reviewed today · 6" with "Show" and "Undo all 6". The expanded rows are:
- "Comcast · Added to bills · Paper recycled · Photo kept · Undo"
- "Coupon mailer · Paper recycled · Photo deleted · Undo"
- "Sam Ortega · Letter · Passed to Sam · Undo"
- "Previous resident · Returned to sender · Undo"
- "Fred Meyer · Ad · Recycled · Undo"
- "USPS · Change of address confirmed · Filed · Undo"

Sticky footer: outlined "Finish day" with the caption "9 still need a call. They'll be here tomorrow."
Below the list: "Yesterday: 7 pieces, 3 minutes.", the links "Mail Day settings" and "Mail snaps: privacy and storage", and one NotificationAsk card row: "Get a Mail Day reminder at 6:30 PM?" · "Yes" · "Not now" · "No thanks".
Worst case: 40 pieces in Needs a call (show 20, then "Show 20 more"); the sender "Washington State Department of Labor & Industries" wraps to two lines; the amount is "$12,480.00".

LAYOUT & VISUALIZATION
Button weight, on every populated frame: the only filled control in view is "Confirm what we read" on the first unconfirmed row.
- "Scan today's stack" is outlined, with a camera glyph and its label. On native it is a labelled top app bar or toolbar text action. It is filled only in the empty hero.
- "Finish day" is outlined. It becomes filled only when Needs a call is empty and at least one piece was added today.
- With zero pieces there is no Finish day footer; the hero's "Scan today's stack" is the only filled control.

Every piece, digital or photographed, uses one row archetype, in this order:
- ThumbnailRail (56pt, triage variant). It collapses completely on digital rows; never draw an empty square.
- Title line: the sender, in bodyMedium.
- Line 2: the kind plus exactly one fact, in bodySmall text.secondary. The fact is the chip summary of the read, never an editor. When a read field is flagged, the fact names what needs checking ("$142.18 · due date needs a check") instead of showing a doubtful date.
- An optional provenance line.
- A trailing 44pt decision button.

Not confirmed rows (light): ProvenanceMark S in its read-from-your-photo variant (ring) on the thumbnail corner, a warningBg fill with a 2px warning left border, text.primary for all words, and the "Confirm what we read" button. Never red, because a read waiting for a check is not a failure.
Not confirmed rows (dark): surface raised #1E293B, the same 2px warning left border, text primary. No tinted fill.

Uploading: a determinate ring inside the rail, with its value as text. The row body keeps its rhythm.
Failed: the InlineErrorRow upload variant inside the row, with a retry glyph in the rail.
No read yet: line 2 carries "Photo of your mail" and the page count only. Never draw a blank, a spinner or $0.00.

After a confirm: line 2 shows the confirmed fact ("$142.18 · due in 4 days · Fri 23 Oct"). The mark becomes you-added (tick), with "Added to bills" or "Filed", and "Decide" becomes the trailing button. A row leaves Needs a call only when it is decided.

"Decide" expands the row in place into a list of full-width 48pt action buttons, with no radio dots, each a verb phrase:
- Photographed rows: "Recycle paper, keep photo" · "Recycle paper, delete photo" · "Keep paper, keep photo" · "Keep paper, delete photo", plus "See the piece".
- Digital rows: "File" · "Recycle" · "Pass to Sam" · "Return to sender".
- On an unconfirmed photographed row, "Decide" files the piece without a bill as part of the decision.
One tap commits. The decided row collapses in place inside Needs a call to one line, for example "Clark Public Utilities · Paper recycled · Photo kept · Undo" (InlineUndo, 44pt Undo), and stays there until Maya leaves the screen. On her next visit it is listed under Reviewed today, and the count updates ("Reviewed today · 7").

Web 1440 has four parts, left to right: a 240px left sidebar; the 220px mailbox nav with "Mail Day" selected; a list column that fills the remaining space (about 620px); a 300px right column holding the recap, the reminder card and the two links. Use 24px gutters between columns. The footer sticks to the list column.

Web 390 and native use a single column. The recap, "Mail Day settings" and "Mail snaps: privacy and storage" sit together below the list. The header action stays reachable at every scroll position. On iOS and Android it is a labelled top app bar action, never an icon alone and never a floating button.

When data is missing:
- no photos: the rail is absent;
- no fact: line 2 shows the kind only;
- a first Mail Day: no recap.

INTERACTION, MOTION & HAPTICS
"Scan today's stack" first checks for a claimed home and bill access. Then it opens the system scanner, and the tray opens over this screen when the scanner returns. On web it opens the Today's stack modal or sheet directly.

On native, a swipe on a row may reveal the same decisions as a shortcut. "Decide" and the accessibility custom actions are the full path.

In the Decide list, Tab moves between the buttons; Enter or a tap commits. After a commit, focus moves to the next Needs a call row, and a polite status reads "Recycled paper, kept photo. Undo is on the row." A snackbar may echo it, but it never replaces the row's Undo.

"Undo" stays on every decided row until "Finish day". If Finish day is never tapped, the day finishes itself at the next Mail Day date (the following morning).

"Finish day" collapses the page to its finished state. Undecided rows stay listed under "Needs a call · for tomorrow". After Finish day, a status line reads "Day finished · Undo" until Maya leaves the screen; after that, decisions (including photo deletions) are final.

"Check now" in the status line opens Confirm what we read for the first read piece.

Motion: a decided row collapses in place over 200ms; under Reduce Motion it cross-fades. Upload rings fill without looping.
Haptics: one light tick on "Finish day" only.

FOUNDATIONS COMPONENTS USED: ThumbnailRail (triage row) · ProvenanceMark (read-from-your-photo, you-added, legend line) · ScopeChip (chip plus the named-audience line) · InlineUndo (triage decision, "Undo all 6", "Day finished · Undo") · InlineErrorRow (upload failed, load failed) · OfflineNotice (queued writes) · FreshnessLine · WarmingSkeleton (row skeleton) · LockedActionRow (names who can act) · NotificationAsk (card row) · DateSheet (create mode, Bill kind, reached from the no-claimed-home notice).

ACCESSIBILITY
Reading order: header, audience line, scan button, status line, legend, Needs a call rows top to bottom, Reviewed today, footer, recap and links.

Each row is one element. Row 1 reads: "Clark Public Utilities, bill, 142 dollars 18 cents, due date needs a check, read from your photo, not confirmed. Actions: Confirm what we read, Decide, See the piece." After a confirm it reads "…due in 4 days, Friday 23 October, you added this." A collapsed decided row reads "Clark Public Utilities, paper recycled, photo kept. Action: Undo."

Row 3's button speaks "Retry page 3 of 3 of this piece". Upload rings announce "1 of 2 uploaded, 60 percent". Status changes are polite live regions.

The Decide options are plain buttons in a list, never a radio group, so moving through them with arrow keys, Tab or a switch never commits anything.

Targets are 44pt / 48dp / 44px. Not confirmed is carried by the ring shape, the legend, the left border and the Confirm button, not by amber.

The list has scroll padding equal to the footer height, so a focused row is never under the footer.

At AX5 and 200%, the rail stays 56pt, the text wraps, and the trailing button drops below the text.

COPY
Buttons and links: "Scan today's stack" · "Confirm what we read" · "Decide" · "See the piece" · "Retry" · "Retry page 3 of 3" · "Undo" · "Undo all 6" · "Finish day" · "Mail Day settings" · "Mail snaps: privacy and storage" · "Check now" · "Show" · "Show 20 more".
Decide options: "Recycle paper, keep photo" · "Recycle paper, delete photo" · "Keep paper, keep photo" · "Keep paper, delete photo" · "File" · "Recycle" · "Pass to Sam" · "Return to sender".
Status lines: "2 pieces ready to check · Check now" · "1 piece ready to check · Check now" · "Recycled paper, kept photo. Undo is on the row." · "Day finished · Undo".
Upload failed: "Upload failed · Retry" (single page) · "Page 3 didn't upload" (inside a multi-page row).

Finished. Never write "all caught up" or "all your mail".
- (a) Nothing left: "Day finished. Every piece you added today has a decision." This line replaces the Finish day footer.
- (b) Some left: "Day finished. 9 pieces still need a call. They'll be here tomorrow."

Empty (the web and native hero): "No mail added today" / "When the mail comes, scan the stack and decide each piece here." / filled "Scan today's stack".
Error: "We couldn't load today's mail. Check your connection, then retry." · "Retry".
Offline: "You're offline · as of 6:02 PM". On queued photo rows: "Will upload when you're back online". On queued decisions: "Will save when you're back online".
Reading unavailable: "We can't read photos right now. Your photos are saved. Add the amount and due date yourself."
No claimed home: "Mail snap needs a claimed address" / "Bills live with a claimed home. You can still add a due date for yourself." / "Add a due date" / "Claim this address". "Add a due date" replaces the notice with the Date sheet; the two are never stacked.
Limited access: "Only Maya and Sam can add bills here." and "Only Maya and Sam can see bill senders, amounts and photos."
Photo not kept: "Photo not kept".

EDGE CASES
- Longest sender: it wraps to two lines, and "$12,480.00" still fits beside it.
- 40 pieces: the list pages at 20.
- Zero pieces: show the empty hero with its filled "Scan today's stack" as the only scan button and no Finish day footer. The header scan action appears only once the hero scrolls out of view or the list has any item.
- Loading: under 1s, show nothing. On a cold load past about 2s, show row skeletons in their final slots.
- Load failure: the header and the scan button stay live.
- Offline: cached rows stay readable, and decisions queue.
- No claimed home (Jordan Lee at PLACE B, "Saved place · Only you"): the scan button opens the notice instead of a camera.
- Guest without bill access (Alex Kim's own view), photographed rows and money rows:
  - The rail collapses; no thumbnail and no glyph.
  - Line 2 reads "Bill · photographed today", with no sender or amount.
  - "File" is the only decision, with the LockedActionRow "Only Maya and Sam can add bills here." There is no "Confirm what we read".
  - Alex's "Scan today's stack" opens the tray's guest-check notice the first time.
- Everyone in the household can see bills (no guest): the audience line reads "Only your household can see these photos: you and Sam."
- Photos set not to be kept (Mail snaps privacy toggle "Keep the photo after we read it" is off): Decide offers only "Recycle paper" and "Keep paper", and the row reads "Photo not kept".
- More than one home: the header reads "Larkspur Loop · Your household".

INSTEAD OF
- Instead of the scan button only in the empty hero, draw it in the header on every populated state, because anyone with one piece already queued otherwise has no way to scan.
- Instead of three filled buttons, draw one filled row action ("Confirm what we read"), with the scan button and "Finish day" outlined, because one primary action tells Maya where to start.
- Instead of "Comcast · Recycled · Undo (4s)" with a countdown, draw a static "Undo" that lasts until Finish day, because a timed undo fails people who need more time.
- Instead of a decided row vanishing into a collapsed section, draw it collapsed in place with its Undo, because a first-time user must see where it went and how to get it back.
- Instead of radio dots for Decide, draw verb-phrase action buttons, because one tap commits and arrow keys must never decide.
- Instead of "Not confirmed" printed on every row, draw the legend once plus the ring, border and Confirm button per row, because a word repeated 40 times stops being read.
- Instead of a progress bar or a streak chip, draw the plain count in the footer caption and "Last scan today, 6:04 PM", because a completion bar or a streak turns mail into a score.
- Instead of "$0.00" or an empty grey box on a failed read, draw "Photo of your mail", because a plausible zero gets approved.

DONE WHEN:
- A person with digital mail already queued can scan from any scroll position.
- Every photographed read looks not confirmed until it is checked, without the word repeating on every row.
- No piece leaves Needs a call without a decision on both the paper and the photo, and a decided row stays visible with Undo in place.
- Every decided row can be undone until Finish day, with no countdown.
- The finished line never claims more than was decided.
- Maya's view names who sees the photos, and a guest never sees a sender, amount or photo they cannot access.
- Web is reachable from the Mail nav, and the 1440 layout fits without overflow.
- Only one filled control is in view on every frame.

ARTBOARDS
1. f10-mail-day-triage · web-390 · 01-populated-dense · light — the 9 + 6 case above, with the audience line, the status line "2 pieces ready to check · Check now" under the header, the legend, and the footer overlapping.
2. f10-mail-day-triage · web-1440 · 01-populated-dense · light — 240 sidebar, 220 mailbox nav, fluid list column, 300 right column, 24px gutters.
3. f10-mail-day-triage · ios · 01-populated-dense · light — the extension of the attached screen: no streak chip, no Scan more card, a labelled toolbar action.
4. f10-mail-day-triage · android · 01-populated-dense · light — a labelled top app bar action, no floating button.
5. f10-mail-day-triage · web-390 · 02-decide-open · light — row 1 after "Added to bills" ("$142.18 · due in 4 days · Fri 23 Oct", tick), with Decide expanded into the five photographed action buttons.
6. f10-mail-day-triage · web-390 · 02b-just-decided · light — row 1 collapsed in place, "Clark Public Utilities · Paper recycled · Photo kept · Undo", focus on row 2, the polite status visible, footer caption "8 still need a call."
7. f10-mail-day-triage · web-390 · 03-just-scanned · light — 6:06 PM, back from the tray: four photo rows uploading or unread, and no status line yet.
8. f10-mail-day-triage · web-390 · 04-reviewed-expanded · light — scrolled to the bottom: six Undo rows, "Undo all 6", the recap, both links, and the footer padding visible.
9. f10-mail-day-triage · web-390 · 05-day-finished · light — variant (b) after Finish day with 9 undecided listed under "Needs a call · for tomorrow", and "Day finished · Undo".
10. f10-mail-day-triage · web-390 · 06-empty · light — the hero with the only filled "Scan today's stack"; no header scan action and no Finish day footer.
11. f10-mail-day-triage · web-390 · 07-loading · light — row skeletons in their final slots (cold load past 2s).
12. f10-mail-day-triage · web-390 · 08-error · light — InlineErrorRow, with the header live.
13. f10-mail-day-triage · web-390 · 09-offline · light — queued rows reading "Will upload when you're back online" and "Will save when you're back online".
14. f10-mail-day-triage · web-390 · 10-reading-unavailable · light — the notice, plus photo rows showing the kind only.
15. f10-mail-day-triage · web-390 · 11-no-claimed-home · light — Jordan Lee, with the notice that is replaced by the Date sheet.
16. f10-mail-day-triage · web-390 · 12-limited-access · light — Alex Kim's own view: collapsed rails, "File" only, LockedActionRow.
17. f10-mail-day-triage · ios · 11-no-claimed-home · light — the native notice.
18. f10-mail-day-triage · android · 06-empty · light — the existing hero; the top app bar shows no scan action until the hero scrolls away.
19. f10-mail-day-triage · ios · 13-ax5 · light — the dense case at AX5, with wrapped rows and buttons below text.
20. f10-mail-day-triage · android · 14-font-200 · light — the dense case at 200%.
21. f10-mail-day-triage · web-390 · 15-greyscale · light — frame 1 in greyscale; the ring, the legend, the left border and the Confirm button carry "not confirmed".
22. f10-mail-day-triage · ios · 01-populated-dense · dark — the dark twin of frame 3; not-confirmed rows on surface raised with the warning left border, no tint.
23. f10-mail-day-triage · web-390 · 02-decide-open · dark — the dark twin of frame 5.
24. f10-mail-day-triage · web-1440 · 99-notes · light — Notes:
- Every invented string: Larkspur Loop HOA; Capital One 2290; Clark County Treasurer · Statement; State Farm · Renewal · "Auto policy renews in 16 days · Wed 4 Nov"; Clark County Elections · Notice · "Voters' pamphlet · election in 15 days · Tue 3 Nov"; Waste Connections · Service notice · "Holiday pickup schedule"; Chase; Alex Kim as a guest with access until Sun 1 Nov; the reviewed senders; the Comcast and coupon rows coming from a 12:40 PM scan; "Yesterday: 7 pieces, 3 minutes."; "Get a Mail Day reminder at 6:30 PM?"; the Mail Day push copy "Mail Day tonight" / "Scan and sort today's mail"; "due date needs a check"; "Page 3 didn't upload"; "Retry page 3 of 3"; "Photo not kept"; the status lines; the Decide verb phrases; "Day finished · Undo"; the audience line.
- The storyboard: bills before tonight hold only Comcast. Nothing had been read when Maya tapped Done (4) at 6:06 PM, so she landed here (frame 7). By 6:10 two pieces are read (frame 1). Page 3 of the Chase piece (page 8 in the tray) is still failed. She opens Confirm from row 1 at 6:12 PM, then decides it (frames 5 and 6).
- The retry is spoken "of this piece", not "of the Chase letter", because the piece has not been read yet.
- Finished variant (a), drawn as a small inset.
- The Mail Day push is triage-only. Bill reminders come from the separate home reminders job and are never stacked into it.
- Open decision: which notification group the Mail Day push belongs to.
- Open decision: the exact label of the read-from-your-photo mark variant (shared with f10-extraction-confirm); it is pending on the Foundations board.
- Proposed Foundations addition: the named-audience sentence form for photos (shared with the tray).
- Shared F10 wording with the capture tray: "Upload failed · Retry" and "Will upload when you're back online".
- Any omitted state.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait. Turn 3: 13-18, then wait. Turn 4: 19-24.
