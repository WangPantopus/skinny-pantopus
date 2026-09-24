# Confirm this person lives here (owner attestation)
id: f3b-owner-attestation · platforms: web/ios/android · isNew: True · artboards: 25

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Confirm this person lives here · f3b-owner-attestation

TYPE: NEW. This sheet does not exist on any platform yet.

ATTACH: the members roster for HOME A as the owner sees it (the host screen, with a member row's overflow menu open); the Foundations board.

PLATFORMS & VIEWPORTS:
- iOS 393x852: a sheet that opens at the large detent. At default text size, everything down to the buttons is visible without scrolling.
- Android 412x915: a Material 3 bottom sheet.
- Web 1440x900: a centred modal 520px wide.
- Web 390x844: a sheet.
The statement control:
- On iOS, a full-width row at least 44pt tall, with a leading circle that fills with a checkmark when ticked.
- On Android, the M3 Checkbox.
- On web, a native checkbox.
The header close control reads "Not now" only while a decision is open (frames 1, 2, 3, 9, 11, 12 and their platform twins 14, 17, 18, 20, 21, 22, 23). In every other state it reads "Close". The sheet also closes with Back or Escape, returns focus to the control that opened it, and never opens on top of another sheet.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → Larkspur Loop → Members roster. There are four entries:
(1) The pending group row "Sam asked you to confirm he lives here · Review".
(2) "Confirm lives here" in a member row's overflow menu, which the owner can use without a request.
(3) The push. Title "Sam asked you to confirm", body "Does Sam live with you?". It belongs to the Account & security group (invitations and requests to you): on by default, at that group's level (iOS Time Sensitive, Android HIGH), with the hidden-preview placeholder "Request for you". The push lands on this sheet over the roster, never on the dashboard.
(4) The push's NotificationRow twin in the notifications list, "Sam asked you to confirm he lives here · Mon 19 Oct", which opens the same sheet.
The request starts on Sam's phone, from "Ask Maya Chen to confirm" in the "Verify this address" sheet, and reaches Maya when Sam closes that sheet. When Maya's answer commits, Sam's verify sheet and LockedActionRow update:
- Confirmed: Sam gets the in-app row "Maya confirmed you live at Larkspur Loop".
- Didn't confirm: Sam gets the in-app row "Maya didn't confirm your address", and his sheet offers the postcard and document paths.
- If Sam's access has ended, he sees "Your access to Larkspur Loop ended."

WHO AND WHEN: Maya Chen owns HOME A. Sam Ortega joined on Sat 10 Oct through Maya's invitation. He is a household member who is not yet address-verified. At 3:40 PM he tried to message a neighbor and asked Maya to confirm. It is now Mon 19 Oct, 6:10 PM, and Maya taps the push on her iPhone.

THE ONE JOB: Let the person who claimed this address confirm, in one act, that a housemate really lives here, so the housemate has a way to finish address verification.

FIRST FIVE SECONDS: first, the title question ("Does Sam live here?"); second, the person block (name, when he joined, who invited him); third, the checkbox and the consequence line beneath it. The one primary action is "Confirm Sam lives here", which stays disabled until the box is ticked.

CONTENT (fixture deltas only):
- Title: "Does Sam live here?"
- Person block: a 40pt initials avatar "SO", "Sam Ortega", and the caption "Joined Larkspur Loop on Sat 10 Oct 2026 · invited by you". Below it, the address "2418 NE Larkspur Loop, Vancouver, WA 98684" with ScopeChip "Your household".
- Grants, under the heading "Once you confirm, Sam can also", in the same order Sam saw on his verify sheet: "Message your neighbors" · "Get a residency letter". Then "and 3 more" expands in place to "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank", plus the shared caption "Also: claim residency for a program, get alerts when this home's public records change, send postcard invites, print a fridge card, send letters to neighbors from Mail, join as a Founding Neighbor, and show your address on your profile."
- Statement, unticked by default: "I confirm Sam Ortega lives at 2418 NE Larkspur Loop."
- Consequence line, directly beneath the statement, in body text: "This tells Pantopus that Sam lives here. It does not give Sam ownership of this home and does not let Sam remove you. We'll record that you confirmed it, with today's date."
- Buttons: "Confirm Sam lives here" and "Don't confirm".
- Worst case: the name "Maria-Fernanda Castellanos-Whitaker", no avatar photo, and an unknown join date.

LAYOUT & VISUALIZATION: this is one person confirming a fact about one person, not a permissions screen: one person, one statement, one checkbox, two buttons.
- Fixed vertical order: header (Not now or Close, then the title), person block, grant rows, a hairline rule, the checkbox with its consequence line, then the buttons.
- Grant rows use the GrantLimitList success tick (16pt), body text.primary and 44pt rows, with the same strings and order as the verify sheet's "What this unlocks" list. Maya approves the list Sam saw; only the glyph differs, because here the rows are granted.
- The consequence line is the only place that says what confirming does not do. Draw it as plain body text in text.primary, with no box and no warning colour.
- The two buttons are full width and equal size: stacked on phones, side by side on web 1440. Confirm is filled primary.700. Don't confirm is an outlined neutral button, never red.
Degradation:
- Unknown join date: show "joined recently".
- No photo: show the initials monogram.
- Sam's unlock list can't be loaded: show the two default rows with "and 3 more", and the caption "Standard resident unlocks".

INTERACTION, MOTION & HAPTICS:
- The whole checkbox row toggles the box. Ticking it enables Confirm with a 150ms fade.
- "Don't confirm" is always enabled and does not need the box.
- While confirming, the Confirm button shows an inline spinner, and "Confirming…" is announced.
- The result replaces the body with a cross-fade of 300ms or less (static under Reduce Motion). Give one light haptic tick, on Confirm only.
- Both results (confirmed and didn't confirm) show an InlineUndo ("Undo", 44pt) that stays until Maya closes the sheet, with no countdown.
- Sam is told, and his unlock applies, only when the sheet closes, when Maya leaves the screen, or when the app goes to the background. Neither result has a second dialog.
- "Not now" closes the sheet and leaves the request in the roster's pending group, with no new push.

FOUNDATIONS COMPONENTS USED: MemberRow (the person block uses its avatar, name and caption, with no status chip); GrantLimitList (the attestation grants variant, drawn with the verify sheet's heading, two rows and "and 3 more" split, with the success tick); ScopeChip; InlineUndo (the result variants); WarmingSkeleton (row skeleton for the person block and grant rows); PushCopy (the push preview); NotificationRow (the in-app twin, and Sam's result rows); InlineErrorRow; OfflineNotice.

ACCESSIBILITY:
- Reading order: Not now (close), title, person, address, scope, grants heading and rows, checkbox with the consequence line as its hint, Confirm, Don't confirm. Initial focus goes to the title, not to Not now.
- "Not now" is announced as "Not now, close".
- The checkbox reads "I confirm Sam Ortega lives at 2418 NE Larkspur Loop, checkbox, not checked".
- While disabled, Confirm reads "Confirm Sam lives here, dimmed, tick the box first".
- Targets are at least 44pt, 48dp or 44px, with 8dp between the buttons.
- The sheet traps focus and has the unique title "Does Sam live here?".
- Results are announced as status messages. Undo is focusable.
- At AX5 the sheet scrolls, and the buttons stay pinned, with scroll padding above them.

COPY:
- Confirmed: "Confirmed. Sam's address is verified." · "Address confirmed by Maya Chen · Mon 19 Oct 2026" · "Sam can now message your neighbors and get a residency letter. We'll let Sam know when you close this." · "Undo" · "Done".
- Didn't confirm: "You didn't confirm. Sam stays in your household and can still verify by postcard or with a document. We'll let Sam know when you close this." · "Undo" · "Done".
- Sam's in-app rows (drawn in frame 13): "Maya confirmed you live at Larkspur Loop" and "Maya didn't confirm your address".
- Access ended: "Sam no longer has access to Larkspur Loop, so there's nothing to confirm." · "Done".
- Request cancelled by Sam: "Sam cancelled this request. There's nothing to do." · "Done".
- Already verified: "Sam's address is already confirmed." · "Address confirmed by document · Fri 16 Oct 2026" · "Done". Draw no checkbox.
- Request lapsed (push tapped after Mon 26 Oct): "Sam's request ended on Mon 26 Oct. If Sam asks again, you'll see it here." · "Done".
- Permission denied (Priya Raman, after she joins as a Member on Tue 20 Oct, opens a forwarded request link): "Only the owner or an admin of this home can confirm who lives here. Maya Chen can do this." · "Done".
- Error: "We couldn't save your confirmation. Nothing changed. Try again." · "Retry". The box stays ticked.
- Offline: an OfflineNotice line, "You're offline. You can confirm when you're back online." The checkbox and both buttons stay visible and dimmed, each with the caption "Needs a connection."

EDGE CASES:
- The longest name wraps. The title uses the first name only ("Does Maria-Fernanda live here?"); the checkbox sentence uses the full name.
- Several requests at once give one sheet per person, each opened from its own pending row, never stacked.
- If Sam cancels his request while the sheet is open, it switches to the request-cancelled state. If his access ends, it switches to the access-ended state.
- On a slow network, the button spinner and the loading skeleton each show after 1s.
- An admin sees the same sheet as the owner.
- The request lapses on Mon 26 Oct: the pending row disappears, and the push opens the lapsed state.
- The sheet never offers role changes.

INSTEAD OF:
- Instead of a permissions matrix, capability grid or role picker, draw one person, one sentence and one checkbox, because this is one person confirming a fact about one person, not an admin screen.
- Instead of a pre-ticked box, draw it unticked with Confirm disabled, because the owner must make the statement herself.
- Instead of a quiet "Not now" as the only way out, draw "Don't confirm" as an equal button and "Not now" as the header close, because declining is a normal, final answer and putting it off is a different one.
- Instead of red for Don't confirm, draw an outlined neutral button, because declining removes no one.
- Instead of a warning box for the limits, draw the consequence line as plain text under the checkbox, because it must be read, not skimmed.
- Instead of a bare "Verified" on the result, draw "Address confirmed by Maya Chen · Mon 19 Oct 2026", because a badge without a method and date is misread.
- Instead of telling Sam the instant Maya taps, draw Undo on the result and tell Sam on close, because a mis-tap about someone else must be recoverable.
- Instead of "Not now" in the header of a finished state, draw "Close", because nothing is left to put off.

DONE WHEN:
- From the push, Maya can confirm in two taps (tick, then confirm).
- She approves the same list, in the same order, that Sam was shown.
- She can see that confirming gives no ownership.
- Declining is as easy as confirming, and either answer can be undone until she closes the sheet.
- Sam sees the result, confirmed or not, without asking again.
- Every state that cannot be acted on says why and offers Done.

ARTBOARDS:
1. f3b-owner-attestation · ios · 01-request-pending · light — the dense default: Not now in the header, box unticked, Confirm disabled, "and 3 more" closed.
2. f3b-owner-attestation · ios · 02-ticked-grants-expanded · light — box ticked, Confirm enabled, "and 3 more" open with the "Also:" caption.
3. f3b-owner-attestation · ios · 03-confirming · light — the inline spinner.
4. f3b-owner-attestation · ios · 04-confirmed · light — Close in the header; the attributed, dated result with Undo and Done.
5. f3b-owner-attestation · ios · 05-declined · light — Close in the header; "You didn't confirm", Sam stays, Undo and Done.
6. f3b-owner-attestation · ios · 06-access-ended · light — nothing to confirm, Close.
7. f3b-owner-attestation · ios · 07-already-verified · light — method and date, no checkbox, Close.
8. f3b-owner-attestation · ios · 08-permission-denied · light — Priya Raman's view on Tue 20 Oct, naming Maya, Close.
9. f3b-owner-attestation · ios · 09-loading · light — WarmingSkeleton rows for the person block and grants, Not now live.
10. f3b-owner-attestation · ios · 10-request-lapsed-and-cancelled · light — the lapsed line and the cancelled-by-Sam line, side by side, each with Done and Close.
11. f3b-owner-attestation · ios · 11-error · light — InlineErrorRow, box still ticked.
12. f3b-owner-attestation · ios · 12-offline · light — the OfflineNotice line and dimmed controls with reasons.
13. f3b-owner-attestation · ios · 13-entries-and-results · light — the PushCopy preview (Account & security, "Request for you" placeholder), the NotificationRow "Sam asked you to confirm he lives here · Mon 19 Oct" and the roster pending row, each with an arrow to the sheet; below them, Sam's two result NotificationRows.
14. f3b-owner-attestation · web-1440 · 14-request-pending · light — the centred modal, buttons side by side, native checkbox.
15. f3b-owner-attestation · web-1440 · 15-confirmed · light — the result with Undo in the modal, Close in the header.
16. f3b-owner-attestation · web-1440 · 16-permission-denied · light — Priya Raman's view as a member.
17. f3b-owner-attestation · android · 17-request-pending · light — the Material 3 bottom sheet with the M3 Checkbox.
18. f3b-owner-attestation · android · 18-confirming · light — the Android progress state.
19. f3b-owner-attestation · android · 19-declined · light — the Android result with Undo.
20. f3b-owner-attestation · web-390 · 20-request-pending · light — the mobile web sheet.
21. f3b-owner-attestation · ios · 21-request-pending-ax5-worst-case · light — AX5 text with the worst-case fixture ("Does Maria-Fernanda live here?", monogram, "joined recently"), scrolling, pinned buttons.
22. f3b-owner-attestation · ios · 22-request-pending-greyscale · light — frame 1 in greyscale.
23. f3b-owner-attestation · ios · 23-request-pending · dark — the dark twin of frame 1.
24. f3b-owner-attestation · ios · 24-confirmed · dark — the dark twin of frame 4.
25. f3b-owner-attestation · web-1440 · 25-notes · light — Notes, listing:
- the product decision to confirm: owner confirmation counts as address verification and records the address as the source (a proposed addition to the design doc's four methods, needing sign-off before build);
- the release rule: if no other method accepts a non-owner occupant on an already-claimed home, F3b's gate must not ship without this sheet;
- the push strings "Sam asked you to confirm" and "Does Sam live with you?", which replace the flow's "Sam is verifying Maple St";
- the push group, Account & security (invitations and requests to you), on by default, with the placeholder "Request for you"; whether it should use that group's full Time Sensitive / HIGH level is an open decision, but the group itself is the spec;
- that "Not now" is this sheet's close while a decision is open, and "Close" otherwise;
- that the answer commits on close, on leaving the screen, or on backgrounding;
- that after Not now, Sam gets no signal until the request lapses Mon 26 Oct, when his sheet reads "Maya hasn't answered yet" (a deliberate difference from the flow);
- that the grant list uses the verify sheet's two-plus-three split instead of the contract's three-row attestation variant, with the success tick (record on the Foundations board);
- every invented string: "SO", the pending-row text, the NotificationRow text, the push strings, "Request for you", "Once you confirm, Sam can also", the record sentence, "We'll let Sam know when you close this.", "Maya didn't confirm your address", "Sam cancelled this request. There's nothing to do.", "Standard resident unlocks", "joined recently", the lapsed line, "Needs a connection.", Mon 26 Oct, Fri 16 Oct, Tue 20 Oct, 3:40 PM, and Priya Raman as the member viewer;
- other assumptions;
- omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-24, then wait for "continue". Turn 5: 25.
