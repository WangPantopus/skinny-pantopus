# Photographed mail piece (the record, and the photo viewer)
id: f10-mail-piece-photo · platforms: web/ios/android · isNew: False · artboards: 29

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Photographed mail piece (the record, and the photo viewer) · f10-mail-piece-photo

TYPE: EXTENSION of two existing designed screens, "Mailbox drawer list" and "Mail piece detail". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. There is no separate photo viewer screen: the mail piece detail is the viewer.

ATTACH: the current mailbox drawer list and mail piece detail on web 1440, iOS and Android (product screenshots); the f10-mail-day-triage artboards (a "Needs a call" row and a "Reviewed today" row); the f10-extraction-confirm artboards (its photo pane); the Foundations board (ProvenanceMark, ThumbnailRail, DestructiveConfirm, ChoiceChip, ScopeChip, StatusChip, LockedActionRow, OfflineNotice, InlineErrorRow, WarmingSkeleton).

PLATFORMS & VIEWPORTS: web 1440x900 (left sidebar) and 390x844; iOS 393x852; Android 412x915. Portrait and landscape both work.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Mail tab → mailbox drawer → mail piece. Every entry point opens the same piece:
- "See the piece" on a Mail Day row. From "Reviewed today" it hands over a confirmed piece; from "Needs a call" it hands over a piece that is not confirmed yet. Back returns to Mail Day.
- A mailbox drawer row in the Mail tab, including a payee or amount search.
- "View the photo" in the bill provenance block on Bill detail. It hands over the bill's source piece. Back returns to the bill.
- "See the piece" on the Confirm what we read photo pane. It hands over the piece being confirmed. Close returns to Confirm what we read with the values unchanged.
- A row in the "Photos of your mail" card in Mail Day settings. Back returns to the card.
Web: the existing mail piece route under /app/mailbox/. The piece hands off to Bill detail ("Open the bill"), to Confirm what we read ("Confirm what we read", unconfirmed pieces only) and to the privacy card ("Manage mail snaps").

WHO AND WHEN: Maya Chen, owner of HOME A. The scene is Tue 20 Oct 2026 at 7:30 AM, the morning after Mail Day (a fixture delta). Last night at 6:04 PM she scanned the 2-page Clark Public Utilities bill, confirmed what we read and added it to bills. She left the Larkspur Loop HOA letter in "Needs a call". This morning she wants to check the account number printed on page 1 of the Clark Public Utilities bill.

THE ONE JOB: Answer "where did the thing I photographed go?" after triage ends, and be the one place where the photo can be seen and permanently deleted.

FIRST FIVE SECONDS: (1) The letter itself, readable at fit-to-width. (2) The facts: payee, then "$142.18 · in 3 days · due Fri 23 Oct". (3) The row "Added to bills" with its trailing action "Open the bill". Primary action: "Open the bill". "Delete this photo" is present but quieter.

CONTENT (house style fixtures; deltas below, list each on Notes)
Alex Kim is a Guest in HOME A without bill access. Sam Ortega has bill access. Account ending 4471; only the last 4 digits ever appear as text. Photos are kept 90 days after they are taken, then deleted (a stand-in for an undecided product call; flag it on Notes).
Pieces this prompt draws, newest first:
- Clark Public Utilities · 2 pages · $142.18 · due Fri 23 Oct · Added to bills · photographed Mon 19 Oct 6:04 PM by Maya · Paper recycled · photo kept until Sun 17 Jan 2027.
- Larkspur Loop HOA · 1 page · photographed Mon 19 Oct · Not confirmed yet. We read "Larkspur Loop HOA · $285.00 · due Sun 1 Nov". Still in "Needs a call" on Mail Day.
- Comcast · $79.99 · due Mon 2 Nov · Added to bills · photographed Mon 19 Oct.
- NW Natural · $61.08 · was due Fri 16 Oct · Added to bills · Overdue · photographed Mon 5 Oct.
- Riverview Bank statement · Filed, no bill · photographed Wed 30 Sep · photo kept until Tue 29 Dec.
- Clark Public Utilities · $109.60 · Paid · photographed Mon 21 Sep · photo deleted Sat 17 Oct · text record kept.
Digital row, no photo: State Farm · renews Wed 4 Nov · $612.40.
The "Photographed" filter lists exactly the 15 pieces with a stored photo that the "Photos of your mail" card lists (17 photos in 15 pieces), newest first:
Clark Public Utilities · Mon 19 Oct · 2 pages · Comcast · Mon 19 Oct · Larkspur Loop HOA · Mon 19 Oct · Not confirmed yet · Chase statement · Mon 19 Oct · 2 pages · Filed, no bill · NW Natural · Mon 5 Oct · Riverview Bank statement · Wed 30 Sep · Filed, no bill · Waste Connections · Mon 21 Sep · Filed, no bill · Not classified · Sat 12 Sep · City of Vancouver water · Sat 5 Sep · Comcast · Sat 5 Sep · NW Natural · Sat 5 Sep · Larkspur Loop HOA · Mon 31 Aug · Riverview Bank statement · Mon 31 Aug · Filed, no bill · Clark County Treasurer · Mon 24 Aug · Filed, no bill · Not classified · Mon 24 Aug.
A piece whose photo was deleted is not in this filter; it stays in its drawer with the deleted rail.
Bill deleted case: at 7:32 AM on Tue 20 Oct Maya deletes the Clark Public Utilities $142.18 bill and its photo from Bill detail. The mail record stays.
Unconfirmed photo deleted case: at 7:40 AM on Tue 20 Oct Maya deletes the photo of the Larkspur Loop HOA letter.
Worst case: "Washington State Department of Labor & Industries" · $12,480.00 · 12 pages.

LAYOUT & VISUALIZATION
Draw this as a document viewer, not a photo gallery: small print must be legible and zoomable. Draw no carousel and no paging dots.

Image stage. The page sits full-bleed, fit-to-width, on the dark app surface token in both themes (the one scrim exception; state it on Notes). Chrome on the stage uses dark-theme tokens in both themes.
- Top bar: the existing Mail piece detail's navigation. On iOS, the system back chevron titled with the previous screen when the piece was pushed (drawer, Bill detail, the photos card, Mail Day). Close only when it was presented from Confirm what we read. On Android, the Material back arrow (system Back also works). On web, Back. Then the payee as title, and an overflow menu.
- Bottom-right: a zoom cluster of Zoom out · Fit · Zoom in (44pt / 48dp / 44px each) and a "1x" readout.
- Page controls on a multi-page piece: "Previous page" · "Page 1 of 2" · "Next page", centred at the bottom of the stage, above the sheet, 44pt / 48dp / 44px each. They never overlap the zoom cluster.

Facts panel, confirmed piece. It follows the app theme. On native it is a persistent, non-dismissible bottom panel with two detents, peek and medium; it is not a modal sheet, so it has no Close (note this on Notes). On web 1440 it is a 360px right rail, so it never sits on the letterhead. On web 390 it is a bottom panel that opens collapsed to the peek content (about 200px) with a "Show all details" button that expands it to 60% of the viewport; it never covers the zoom cluster. In order:
1. Payee (h3).
2. "$142.18 · in 3 days · due Fri 23 Oct".
3. "Account ending 4471".
4. A 44pt row: ProvenanceMark S you-added, the label "Added to bills", and the trailing action "Open the bill" plus a chevron. Print the words "You added this" once, as a caption under the label.
5. "Photographed Mon 19 Oct 2026 at 6:04 PM by you".
6. "Paper recycled · photo kept until Sun 17 Jan 2027".
7. The audience line with ScopeChip "Your household": "You and Sam can see this photo. Nobody nearby can."
8. The row "Manage mail snaps", captioned "Where these photos are kept".
9. Web only: "Download". It goes through the signed-in download, never a public link.
10. "Delete this photo", which uses the DestructiveConfirm destructive-button style exactly as on the Foundations board. Never red label text, never a red fill.

Peek detent, confirmed piece: the payee, "$142.18 · in 3 days · due Fri 23 Oct", the audience line, and "Delete this photo" as a compact outlined row. A grabber and the button "Show all details" open medium.
Peek detent, piece not confirmed yet: the payee with the hollow ring and "Not confirmed yet", the "Confirm what we read" row, the audience line and "Delete this photo".

Zoom. On zoom, chrome compacts and never hides: the top bar shrinks to a 44pt compact bar and the panel drops to its peek. At 2x on a portrait letter, the top third of the page stays clear of both. A single tap on the page toggles nothing. Chrome stays in the accessibility tree at every zoom level.

Facts panel, piece not confirmed yet (Larkspur Loop HOA). Same positions, different content:
1. Payee as we read it, "Larkspur Loop HOA", with ProvenanceMark S read-from-your-photo (the hollow ring) and the words "Not confirmed yet" beside it once.
2. "We read $285.00 · in 12 days · due Sun 1 Nov" in text.secondary.
3. No "Added to bills" row. In its place, a 44pt row "Confirm what we read" with a chevron. It opens that screen for this piece.
4. Then items 5 to 10 as above, with "photo kept until Sun 17 Jan 2027".
Nothing on this piece looks settled: no tick mark, no status chip.

Drawer list.
- The "Photographed" ChoiceChip and the search field "Search payee or amount" sit above the drawer list in the Mail tab, not inside a drawer. When the chip is on, the list heading reads "Photographed · all drawers". Search matches only confirmed payees and amounts; a read nobody confirmed never matches.
- Photographed rows get a ThumbnailRail (drawer variant, 40x52) and key facts on line 2. Use this one thumbnail treatment everywhere.
- Frame 04 shows that same header with the chip off, and below it the "Bills" drawer: at least six digital rows from the attached screenshot, mixed with these photographed bill pieces:
  - Clark Public Utilities, stacked thumbnail labelled "2 pages", line 2 "$142.18 · in 3 days · due Fri 23 Oct · Added to bills".
  - Larkspur Loop HOA, line 2 "Not confirmed yet · decide on Mail Day", no amount.
  - Comcast, "$79.99 · in 13 days · due Mon 2 Nov · Added to bills".
  - NW Natural with StatusChip "Overdue", "$61.08 · was due Fri 16 Oct".
  - September Clark Public Utilities with StatusChip "Paid", the ThumbnailRail deleted variant (the quiet document glyph), and line 2 "$109.60 · photo deleted Sat 17 Oct".
  - State Farm with the rail collapsed.
  One StatusChip per row at most.
- Frame 05 shows the chip on, the heading "Photographed · all drawers", and the 15 pieces listed in CONTENT. Filed pieces read "Filed, no bill".
- Frame 06 shows the chip on with "142.18" typed: one match, Clark Public Utilities.

States.
- Filed without a bill (Riverview): no bill row and no empty slot.
- Photo deleted, bill kept (September Clark Public Utilities): the stage shows the document glyph and "This photo was deleted Sat 17 Oct. The bill and its amount stay." The facts and the "Added to bills" row remain.
- Photo deleted on a filed piece: the stage line reads "This photo was deleted Tue 20 Oct. The mail record stays."
- Photo deleted on a piece not confirmed yet (Larkspur Loop HOA): the stage shows the document glyph and "This photo was deleted Tue 20 Oct. The mail record stays." The facts keep the hollow ring and "Not confirmed yet". The "Confirm what we read" row stays, captioned "No photo to check against".
- Bill and photo deleted (from Bill detail): the stage shows the document glyph and "This photo was deleted Tue 20 Oct with its bill. The mail record stays." The "Added to bills" row is gone; in its place a plain caption, not a link: "Bill deleted Tue 20 Oct". The payee and "Account ending 4471" stay; the amount line reads "$142.18 · due Fri 23 Oct" (never "was due", which means overdue).

INTERACTION, MOTION & HAPTICS
- Zoom in steps 1x → 2x → 4x; Fit returns to 1x. Double-tap cycles 1x → 2x → 4x → 1x. Pinch is a shortcut only. Previous page and Next page change pages; swipe is a shortcut only.
- Chrome never hides, including while VoiceOver, TalkBack, Switch Control or Full Keyboard Access is on. The panel at peek offers a "Show all details" accessibility action as well as the visible button.
- "Delete this photo" opens DestructiveConfirm: V1 on a piece with a bill, the filed-piece sub-variant on a filed piece, the not-confirmed sub-variant on a piece not confirmed yet. While deleting, the dialog shows "Deleting the photo…". After it finishes, the piece switches to its photo-deleted state and the status line and live region say "Photo deleted. The bill stays." On a piece with no bill, they say "Photo deleted. The mail record stays." Deletion is permanent, so there is no Undo.
- The stage cross-fades in within 200ms. Reduce Motion: zoom jumps without animation and WarmingSkeleton is static.
- Haptics: one light tick when the delete is confirmed.
- Escape closes the viewer on web and returns focus to the row that opened it.

FOUNDATIONS COMPONENTS USED
ProvenanceMark (S you-added on the "Added to bills" row; S read-from-your-photo ring on a piece not confirmed yet) · ThumbnailRail (drawer variant 40x52; stacked "2 pages"; deleted and offline states) · DestructiveConfirm (V1 "Delete this photo?"; filed-piece and not-confirmed sub-variants below; open, deleting and done states) · ChoiceChip (filter "Photographed") · ScopeChip ("Your household") · StatusChip (Overdue, Paid) · LockedActionRow (names who can act) · OfflineNotice · InlineErrorRow · WarmingSkeleton (row and panel).

ACCESSIBILITY
- Reading order: title, facts, bill row, date taken, retention, audience, actions, then the page image and page controls.
- The image is labelled "Photo of Clark Public Utilities bill, page 1 of 2, zoom 1x". Buttons read "Zoom in", "Zoom out", "Fit to screen", "Previous page", "Next page".
- A drawer row is one element: "Clark Public Utilities, 142 dollars 18 cents, due Friday 23 October, in 3 days, added to bills, photographed, 2 pages." The HOA row reads "Larkspur Loop HOA, not confirmed yet, photographed Monday 19 October."
- The "Added to bills" row reads "Added to bills, you added this. Open the bill." The ring reads "not confirmed yet" (a proposed spoken name; see Notes).
- Targets are 44pt / 48dp / 44px, and a thumbnail is never a target on its own.
- Overdue and "Not confirmed yet" are carried by words.
- Confirm focus follows DestructiveConfirm on the Foundations board: the title for screen readers, Keep for the keyboard, never Delete.
- At AX5 the facts panel opens at its medium detent and scrolls, fact pairs stack, and the zoom cluster stays visible.

COPY (sentence case)
"Photographed" · "Photographed · all drawers" · "Search payee or amount" · "No photographed mail matches "212.40"" · "Clear search"
"$142.18 · in 3 days · due Fri 23 Oct" · "Added to bills" · "You added this" · "Open the bill"
"Photographed Mon 19 Oct 2026 at 6:04 PM by you" · "Paper recycled · photo kept until Sun 17 Jan 2027" · "Page 1 of 2" · "Previous page" · "Next page" · "Show all details"
"Not confirmed yet" · "We read $285.00 · in 12 days · due Sun 1 Nov" · "Confirm what we read" · "No photo to check against" · "Not confirmed yet · decide on Mail Day"
"$109.60 · photo deleted Sat 17 Oct"
"You and Sam can see this photo. Nobody nearby can." · "Manage mail snaps" · "Where these photos are kept" · "Download" · "Delete this photo"
Confirm V1 (piece with a bill): title "Delete this photo?" · body "The bill and its amount stay; only the photo is removed." · buttons "Delete photo" / "Keep it" · deleting "Deleting the photo…" · done "Photo deleted. The bill stays."
Confirm, filed-piece sub-variant (filed, no bill): title "Delete this photo?" · body "The mail record stays in Mail; only the photo is removed." · buttons "Delete photo" / "Keep it" · done "Photo deleted. The mail record stays."
Confirm, not-confirmed sub-variant: title "Delete this photo?" · body "The mail record stays in Mail. This piece isn't in bills yet, so you'll type its amount and due date yourself." · buttons "Delete photo" / "Keep it" · done "Photo deleted. The mail record stays."
"This photo was deleted Sat 17 Oct. The bill and its amount stay." · "This photo was deleted Tue 20 Oct. The mail record stays." · "This photo was deleted Tue 20 Oct with its bill. The mail record stays." · "Bill deleted Tue 20 Oct" · "$142.18 · due Fri 23 Oct"
Guest (Alex): "A bill arrived Mon 19 Oct. Only Maya and Sam can see its photo, payee and amount." with LockedActionRow "Maya or Sam can open this photo." · guest drawer row "Bill · photographed Mon 19 Oct"
Expired link: "This photo's secure link expired. Retry to open it again." · "Retry"
Error: "We couldn't load this piece of mail. Check your connection, then retry." · "Retry"
Offline: "You're offline. This photo isn't saved on this device." · under Delete and Download: "Needs a connection."
Empty filter: "No photographed mail yet. Pieces you photograph on Mail Day appear here."

EDGE CASES
- The longest payee wraps to two lines and never truncates. "$12,480.00" fits. A 12-page piece shows "Page 1 of 12".
- 60 photographed pieces paginate the way the existing drawer does.
- Zero matches: "No photographed mail matches "212.40"" and "Clear search". A household with no photos at all shows the empty-filter line in the same slot.
- A read nobody confirmed: search for "285" finds nothing; the HOA piece is found by the filter only.
- Slow network: no indicator under 1s, then a WarmingSkeleton panel skeleton (shimmer; static under Reduce Motion). The key facts arrive before the page image.
- Expired link: a quiet re-fetch with no indicator first; only if that fails, the expired message.
- Guest Alex: list rows read "Bill · photographed Mon 19 Oct" with a document glyph instead of a thumbnail and no payee or amount. A direct link opens the guest state, never a missing-page error.
- Bill deleted: no link row; the caption "Bill deleted Tue 20 Oct" sits in its place.
- Unconfirmed piece with its photo deleted: the "Confirm what we read" row stays, captioned "No photo to check against".
- A saved place (PLACE B) has no photographed mail.

INSTEAD OF
- Instead of a swipeable gallery with paging dots, draw one document with zoom buttons and page buttons — because people come here to read small print.
- Instead of chrome that hides on zoom or tap, draw chrome that compacts and stays — because under VoiceOver a single tap only moves focus, and hidden chrome hides Delete.
- Instead of a confirm that only says the delete is permanent, draw the body that names what stays and what is lost (the bill, the mail record, or the photo you would check a read against) — because people fear losing the bill, and a promise about a bill that does not exist is untrue.
- Instead of settled facts on a piece nobody confirmed, draw the hollow ring, "Not confirmed yet" and a "Confirm what we read" row — because machine reads are unconfirmed until a person commits them.
- Instead of a red "Delete this photo" label, draw the DestructiveConfirm destructive-button style from the Foundations board — because red text fails contrast in dark mode.
- Instead of a broken-image icon, draw the quiet document glyph with the deletion date — because the record still exists.
- Instead of a blurred photo for a guest, draw no photo and a stated reason — because a photo of a bill shows the amount.
- Instead of "Only your household can see this photo", name the people ("You and Sam") — because bill access differs inside a household.

DONE WHEN
- Typing "142.18" finds the Clark Public Utilities piece, and a read nobody confirmed is never found by search.
- Page 1 reads at 2x with its top third clear, and the back control, the audience line and Delete are still visible.
- The bill is one tap away ("Open the bill").
- Maya can delete the photo knowing exactly what stays and what she loses, on a bill piece, a filed piece and a piece not confirmed yet.
- A deleted bill never leaves a link that goes nowhere, and never reads as overdue.
- Every control is reachable with VoiceOver on.
- Alex sees that a bill arrived, and nothing more.

ARTBOARDS
1. f10-mail-piece-photo · ios · 01-piece-with-bill · light — Clark Public Utilities page 1 at fit, back chevron, panel at medium, "Added to bills" row with "Open the bill", page controls.
2. f10-mail-piece-photo · ios · 02-zoomed-2x · light — 2x on the letterhead, 44pt compact bar, peek with facts, audience line and Delete, "2x" readout, top third clear.
3. f10-mail-piece-photo · ios · 03-not-confirmed · light — Larkspur Loop HOA at medium, hollow ring, "Not confirmed yet", "Confirm what we read" row, no bill row; inset: its peek content.
4. f10-mail-piece-photo · web-1440 · 04-drawer-bills · light — filter header with the chip off, Bills drawer below, six digital rows mixed with the photographed bill rows, September row with "Paid".
5. f10-mail-piece-photo · web-1440 · 05-filter-photographed · light — chip on, "Photographed · all drawers", the 15 pieces.
6. f10-mail-piece-photo · web-1440 · 06-filter-search-match · light — "142.18" typed, one match.
7. f10-mail-piece-photo · ios · 07-filed-no-bill · light — Riverview Bank statement, no bill row, kept until Tue 29 Dec.
8. f10-mail-piece-photo · ios · 08-delete-confirm · light — DestructiveConfirm V1 over the Clark Public Utilities piece.
9. f10-mail-piece-photo · ios · 09-delete-confirm-filed · light — Riverview with the filed-piece confirm body.
10. f10-mail-piece-photo · ios · 10-filed-just-deleted · light — Riverview after deleting: glyph, stage line, status line "Photo deleted. The mail record stays."
11. f10-mail-piece-photo · ios · 11-photo-deleted-bill-kept · light — September Clark Public Utilities, glyph, facts and bill row kept.
12. f10-mail-piece-photo · ios · 11b-not-confirmed-photo-deleted · light — Larkspur Loop HOA after deleting: glyph, stage line, hollow ring and "Not confirmed yet", "Confirm what we read" captioned "No photo to check against"; inset: the not-confirmed confirm dialog.
13. f10-mail-piece-photo · ios · 12-bill-and-photo-deleted · light — Clark Public Utilities after the Bill detail delete: no link row, "Bill deleted Tue 20 Oct", "$142.18 · due Fri 23 Oct".
14. f10-mail-piece-photo · ios · 13-guest · light — Alex's view: date, reason, LockedActionRow, no image; inset: the guest drawer row "Bill · photographed Mon 19 Oct" with a document glyph.
15. f10-mail-piece-photo · ios · 14-link-expired · light — expired message with Retry.
16. f10-mail-piece-photo · ios · 15-loading · light — dark stage, WarmingSkeleton panel skeleton (shimmer; static under Reduce Motion).
17. f10-mail-piece-photo · ios · 16-error · light — InlineErrorRow in the panel, nothing cached.
18. f10-mail-piece-photo · ios · 17-offline · light — cached facts, offline line, Delete disabled with its reason.
19. f10-mail-piece-photo · android · 18-piece-with-bill · light — Material persistent bottom panel, back arrow, 48dp zoom cluster.
20. f10-mail-piece-photo · android · 19-drawer-no-match · light — M3 filter chip on, "212.40" typed, no-match line and "Clear search"; inset: the empty-filter line for a household with no photos.
21. f10-mail-piece-photo · web-1440 · 20-piece-right-rail · light — stage plus 360px rail with Download.
22. f10-mail-piece-photo · web-390 · 21-piece-with-bill · light — bottom panel collapsed to peek (about 200px) with "Show all details"; inset: expanded to 60%, zoom cluster uncovered.
23. f10-mail-piece-photo · ios · 22-worst-case · light — Labor & Industries, $12,480.00, "Page 1 of 12".
24. f10-mail-piece-photo · ios · 23-landscape · light — landscape phone, panel at peek.
25. f10-mail-piece-photo · ios · 24-ax5 · light — AX5, medium detent scrolling, stacked facts.
26. f10-mail-piece-photo · ios · 25-greyscale · light — frame 01-piece-with-bill in greyscale.
27. f10-mail-piece-photo · ios · 01-piece-with-bill · dark — dark twin of 01-piece-with-bill.
28. f10-mail-piece-photo · web-1440 · 06-filter-search-match · dark — dark twin of 06-filter-search-match.
29. Notes — the scrim exception; the Tue 20 Oct scene date, the 7:32 AM bill delete and the 7:40 AM HOA photo delete; the 90-day retention stand-in and each "kept until" date; Alex Kim as Guest and Sam Ortega with bill access; every invented string and the 15-piece list; the filed-piece and not-confirmed DestructiveConfirm sub-variants; the "Not confirmed yet" visible word and the proposed spoken name "not confirmed yet" for the read-from-your-photo ring, which differs from the contract's fixed spoken name "on record, not confirmed"; that the Foundations board's Keep-focused default replaces the research's "no default focus" on both confirm buttons, which is safe because Keep is not destructive; that the contract's "text.error" button wording is superseded by the Foundations board's outlined style; that the facts panel is a persistent, non-dismissible panel and so has no Close; that iOS shows Close only when presented from Confirm what we read; handoff note "Web converts HEIC to JPEG before drawing any thumbnail or page"; assumptions and omitted states.

BATCH PLAN
Turn 1: 1-6, then wait for "continue".
Turn 2: 7-12, then wait for "continue".
Turn 3: 13-18, then wait for "continue".
Turn 4: 19-24, then wait for "continue".
Turn 5: 25-29.
