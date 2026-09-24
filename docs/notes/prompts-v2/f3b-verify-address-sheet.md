# Verify this address (one sheet, many callers)
id: f3b-verify-address-sheet · platforms: web/ios/android · isNew: False · artboards: 32

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Verify this address · f3b-verify-address-sheet

TYPE: EXTENSION of the existing designed verify sheets: the web "What this unlocks" verify prompt, and the iOS and Android place verify sheet with its status screens. This screen already exists in the Pantopus design system. The attached screenshots are exact. Keep everything and change only what is listed. It becomes one sheet with many callers, and the caller sets its reason. The changes:
(1) A reason header set by the caller now sits above the unlock list.
(2) The benefit tiles become GrantLimitList verb rows: two rows plus "and 3 more".
(3) The pre-selected method and the single "Start verification" button become four equal method rows. Each row is its own action and has a time chip.
(4) The postcard copy "3–7 days" becomes "5–10 days", and the pending state gains dates, expiry and a late path.
(5) A fourth method, "Ask Maya Chen to confirm", is added, with its request states.
(6) Unavailable methods stay in place with a reason.
(7) The sheet is drawn the same on all three platforms.

ATTACH: the current web verify prompt (its "What this unlocks" list and method picker); the current iOS verify sheet and its status screen; the current Android verify sheet and its status screen; the Place dashboard verify banner on iOS and Android (a caller); the Foundations board.

PLATFORMS & VIEWPORTS:
- iOS 393x852: a sheet with medium and large detents. It opens at the large detent. The medium detent is used only for the single-line states: no method available, and access ended.
- Android 412x915: a Material 3 bottom sheet, opened expanded.
- Web 1440x900: a centred modal 560px wide.
- Web 390x844: a full-height sheet.
On every variant, draw a visible "Close" in the header. The sheet closes with Back or Escape, returns focus to the control that opened it, and never opens on top of another sheet.

WHERE IT LIVES & HOW PEOPLE ARRIVE: the sheet has no tab and no route. It opens over whatever called it. Callers:
- "Verify address" on any LockedActionRow. Place: residency letter, Residency Pass, residency claims, fridge cards, Real Rent, public-record alerts. Nearby: neighbor messages, Block Founder rank, postcard invites, joining as a Founding Neighbor. Mail: letters to neighbors. Profile: the address line.
- "Enter code" on a pending LockedActionRow, which opens this sheet in its postcard-pending state.
- "Start address verification" on the accepted invitation.
- The Place dashboard verify banner.
- The place file's Proof row.
- The members roster's capability caption.
Each caller passes a reason; the body stays the same. When Sam chooses "Ask Maya Chen to confirm" and closes the sheet, Maya gets a push and an in-app row, which open "Confirm this person lives here" on her phone. Her answer (confirmed, didn't confirm, hasn't answered, access ended) comes back to this sheet and to the caller's LockedActionRow.

WHO AND WHEN: Sam Ortega joined HOME A on Sat 10 Oct through Maya Chen's invitation. He is a household member who is not yet address-verified. On Mon 19 Oct at 3:40 PM he taps "Message a neighbor" on Nearby, sees the LockedActionRow and taps "Verify address". Maya opens his request at 6:10 PM. The postcard frames show the other path: Sam chose the postcard on Wed 14 Oct and is waiting for it.

THE ONE JOB: Explain what address verification adds, then start one method, under a header that says why the sheet opened.

FIRST FIVE SECONDS: first, the reason ("To send neighbor messages, we need to confirm you live here."); second, the two unlocks people want most; third, the method rows with their time chips. There is no single primary button. Each method row is the action, and no row is recommended.

CONTENT (fixture deltas only):
- Title: "Verify this address". Address line: "2418 NE Larkspur Loop, Vancouver, WA 98684", with ScopeChip "Your household".
- Reasons, one per caller:
  - "To send neighbor messages, we need to confirm you live here."
  - "To get a residency letter, we need to confirm you live here."
  - After accepting an invitation (e.g. Priya Raman): "You've joined Larkspur Loop. Confirming your address unlocks a few more things."
  - For the banner, the Proof row and the roster: "Confirming you live here unlocks a few more things."
  - Every other LockedActionRow caller uses "To <the action in its reason string>, we need to confirm you live here."
- Unlock list, under the heading "What this unlocks". Two rows show: "Message your neighbors" · "Get a residency letter". Then "and 3 more" expands to "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank", plus the shared caption "Also: claim residency for a program, get alerts when this home's public records change, send postcard invites, print a fridge card, send letters to neighbors from Mail, join as a Founding Neighbor, and show your address on your profile."
- Methods (name · chip · one-line requirement, 60 characters or fewer):
  - "Postcard code" · "5–10 days" · "We mail a code to 2418 NE Larkspur Loop."
  - "Document" · "About 1 day" · "A lease or utility bill with your name on it."
  - "Landlord confirmation" · "1–3 days" · "We email the landlord on the lease."
  - "Ask Maya Chen to confirm" · "Usually same day" · "Maya claimed this address and can confirm."
- Worst case: the longest reason, all five unlocks expanded, and four methods, one of them unavailable with a two-line reason, on iOS at the large detent.

LAYOUT & VISUALIZATION:
Order: the header (title, Close, reason, address, ScopeChip), then the "What this unlocks" heading and list, a hairline, then the method rows.
Unlock rows: the GrantLimitList lock glyph (16pt, text.secondary), body text.primary, 44pt rows, in the same strings and order as the invitation's limit list.
Method rows: each row is at least 64pt tall and is one target. It holds a 24pt leading glyph, the method name (body, text.primary), the one-line requirement (bodySmall, text.secondary) and a right-aligned time chip.
Time chips:
- The chips line up in one column down the stack, so "how fast" reads before any row is read in full.
- Each chip is the StatusChip default (surface.sunken, text.strong, 9.37:1) with a 12pt clock glyph in text.secondary.
- If the server gives no time, the chip reads "Varies" and is never dropped.
Unavailable methods stay in their place. The reason replaces the requirement (text.secondary, never text.muted), and the chip reads "Not available".
Frame 1, exactly:
- Postcard code: available, 5–10 days.
- Document: available, About 1 day.
- Landlord confirmation: Not available, with the reason "Not available for an address someone else has claimed. Only the person on the lease can use this."
- Ask Maya Chen to confirm: available, Usually same day, directly beneath Landlord confirmation.
All four rows are visible at the large detent without scrolling at default text size.
Pending methods: while any method is pending (postcard, document, landlord or a request to Maya), that method's block replaces its row, with its status and no second start. The other methods stay available under the heading "Or verify another way".
Degradation:
- If only Ask is available, show the other methods as unavailable with their reasons, and the Ask row as available.
- If nothing is available, show only the line "No verification method is available for this address yet." and Close, at the medium detent, with no dead link.

INTERACTION, MOTION & HAPTICS:
- Postcard: tapping it shows an inline confirm on the same sheet ("We'll mail a code to 2418 NE Larkspur Loop" · "Send postcard"), then the pending state.
- Document: tapping it shows the choose step, with the full accepted-types line, then "Choose a document". After upload, the row shows the in-review state.
- Landlord confirmation: tapping it shows an inline confirm ("We'll email the landlord on the lease" · "Send request"), then "We emailed your landlord." · "Usually 1–3 days · Sent today at 3:40 PM".
- Ask:
  - Tapping it turns the row into the request block with an InlineUndo ("Request ready · Undo").
  - Maya is notified only when Sam closes the sheet, leaves the screen or backgrounds the app.
  - After that, the request-sent block offers "Cancel request". Cancelling is undoable in place ("Request cancelled · Undo") and tells Maya nothing new; her pending row disappears.
  - After "Maya didn't confirm", the Ask row is absent, and the other methods remain.
- The code field:
  - It is one input for a 6-character code of uppercase letters and digits.
  - It uses the standard keyboard with autocapitalisation, and paste is allowed.
  - After "Check code" is tapped, the button briefly shows "We're checking your code…".
- Close and the detent grabber both work, and dragging is optional.
- Transitions inside the sheet are cross-fades of 300ms or less, and static under Reduce Motion.
- Give one light haptic tick when a request, postcard or landlord email is confirmed as sent (on sheet close for Ask).

FOUNDATIONS COMPONENTS USED: GrantLimitList (the verify sheet unlock list variant: heading, two rows, "and 3 more", lock glyph); StatusChip (default, as the time chip); ScopeChip; InlineUndo ("Request ready · Undo", "Request cancelled · Undo"); LockedActionRow (the caller, frame 19 only); WarmingSkeleton (row skeleton); InlineErrorRow; OfflineNotice.

ACCESSIBILITY:
- Reading order: Close, title, reason, address, scope, the "What this unlocks" heading and rows, then the methods from top to bottom. Initial focus goes to the title.
- Each method row reads as one element, e.g. "Postcard code, 5 to 10 days, we mail a code to your address, button".
- An unavailable row reads its reason and is announced as dimmed.
- The sheet traps focus and has the unique title "Verify this address".
- Status changes ("Request ready", "Request sent", "Postcard on its way", "Maya confirmed") are announced politely. Undo is focusable.
- Targets are at least 44pt, 48dp or 44px.
- At AX5, the chip moves under the method name, and the sheet scrolls with padding under the bottom row.

COPY:
- Request ready (before close): "We'll ask Maya when you close this." · InlineUndo "Request ready · Undo".
- Request sent: "We asked Maya. You'll hear here when she answers." · "Asked today at 3:40 PM" · button "Cancel request" · heading "Or verify another way", then the other methods.
- Request cancelled: InlineUndo "Request cancelled · Undo", then the Ask row returns.
- Maya confirmed: "Maya confirmed you live at Larkspur Loop." · "Address confirmed by Maya Chen · Mon 19 Oct 2026" · "You can now message your neighbors." · "Done".
- Maya didn't confirm: "Maya didn't confirm. You can still verify by postcard or with a document." Postcard and Document follow; the Ask row is absent.
- Maya hasn't answered (the request lapses Mon 26 Oct; shown Tue 27 Oct): the other methods sit first, then the line "Maya hasn't answered yet · Asked Mon 19 Oct", with the button "Ask Maya again" under it.
- Access ended: "Your access to Larkspur Loop ended, so there's nothing to verify here. If that's a mistake, ask Maya Chen." · "Close".
- Postcard confirm: "We'll mail a code to 2418 NE Larkspur Loop" · "Send postcard".
- Postcard pending (Sam, the other path):
  - Heading: "Your postcard is on its way."
  - Dates: "Mailed Wed 14 Oct (5 days ago) · expected by Sat 24 Oct (in 5 days) · code works until Fri 13 Nov (in 25 days)".
  - Instruction: "When it arrives, enter the code below."
  - Field label: "Code from your postcard". Button: "Check code".
  - Late path: "Didn't arrive by Sat 24 Oct? Send a new code", disabled, with the caption "Available after Sat 24 Oct. Your first code will stop working." There is no second start.
- Wrong code: "That code doesn't match. Check the postcard and try again."
- Document choose: "Accepted: a lease, rental agreement or utility bill from the last 90 days, with your name and this address. A Clark Public Utilities bill works." · "Choose a document".
- Document in review: "We're reviewing your document." · "Usually about 1 day · Sent today at 3:40 PM".
- Document rejected: "We couldn't use your document: the name on it doesn't match your account." · "Upload a different document".
- Landlord confirm: "We'll email the landlord on the lease" · "Send request". Landlord pending: "We emailed your landlord." · "Usually 1–3 days · Sent today at 3:40 PM".
- Unavailable for this address type: "Not available for this address: postcards can't be delivered here."
- Unavailable to a non-owner: "Not available for an address someone else has claimed. Only the person on the lease can use this."
- No landlord on file: "Needs a landlord contact on file."
- Error: "We couldn't load the ways to verify. Try again." · "Retry".
- Offline: an OfflineNotice line at the top, "You're offline. You can start verifying when you're back online." Each dimmed row's requirement is replaced by "Needs a connection."

EDGE CASES:
- With the longest reason and street, the header wraps to at most three lines, and then the sheet scrolls.
- A home with no landlord contact on file makes Landlord unavailable, with "Needs a landlord contact on file."
- On a slow network, row skeletons show after 1s.
- If Maya is offline, the request still sends and waits.
- An already address-verified person never sees this sheet: the caller's control is live, and the LockedActionRow is absent.
- An owner verifying their own claim sees no Ask row.
- A person who only has a saved place never reaches this sheet; their caller says "Claim this address first".
- If Sam's access ends while a request is open, the sheet shows the access-ended state.

INSTEAD OF:
- Instead of two sheets (after joining, and after a blocked tap), draw one sheet whose header changes with the reason, because the body must stay identical and the header honest.
- Instead of a progress bar, step counter or percentage, draw method rows with time chips, because nothing here should read as "40% verified".
- Instead of a pre-selected or "Recommended" method with one Start button, draw four equal rows that each start their own method, because the best method depends on the person.
- Instead of hiding a method that doesn't apply, draw it with its reason, because unexplained gaps look like bugs.
- Instead of "3–7 days", draw "5–10 days" and a late path that unlocks after the window, because postcards can be late and people need a next step.
- Instead of info-blue text on an info tint, draw the neutral StatusChip, because info on info is 3.84:1 and the house style keeps text on tints in text.primary.
- Instead of sending Maya a request the instant Sam taps, draw "Request ready · Undo" and send on close, with "Cancel request" afterwards, because anything that notifies another person waits for undo.
- Instead of an endless "pending" after asking Maya, draw request sent, confirmed, didn't confirm, hasn't answered and access ended, each with a next step.
- Instead of "We're checking your code" while the postcard is still in the mail, draw "Your postcard is on its way." with the code field, because the person still has something to do.
- Instead of multi-line requirement paragraphs in the rows, draw one short line per row and put the full document rules on the choose step, because the rows are scanned for speed.

DONE WHEN:
- Sam, who doesn't own the home, sees at least one method he can finish, with an honest time, and all four rows are visible without scrolling at the large detent.
- The header, above the "What this unlocks" heading, says why the sheet opened.
- After asking, he can undo before Maya is told, sees a visible waiting state that he can cancel, and then sees Maya's answer.
- Sam's pending state shows the mailed date, the window, the expiry and a late path that is locked until Sat 24 Oct.
- A rejected document says why.
- No frame shows a percentage or a recommended method.

ARTBOARDS:
1. f3b-verify-address-sheet · ios · 01-non-owner-ask-offered · light — the dense default at the large detent, exactly as specified in LAYOUT.
2. f3b-verify-address-sheet · ios · 02-picker-all-methods · light — four available methods, and the unlock list expanded with the "Also:" caption.
3. f3b-verify-address-sheet · ios · 03-request-ready-undo · light — "Request ready · Undo" in place of the Ask row, before close.
4. f3b-verify-address-sheet · ios · 04-request-sent · light — reopened after close: "We asked Maya", Cancel request, then "Or verify another way".
5. f3b-verify-address-sheet · ios · 05-request-cancelled · light — "Request cancelled · Undo" and the Ask row back.
6. f3b-verify-address-sheet · ios · 06-owner-confirmed · light — the attributed, dated result and Done.
7. f3b-verify-address-sheet · ios · 07-owner-didnt-confirm · light — Postcard and Document offered, no Ask row.
8. f3b-verify-address-sheet · ios · 08-owner-hasnt-answered · light — the other methods first, then the unanswered line and Ask Maya again.
9. f3b-verify-address-sheet · ios · 09-access-ended · light — medium detent: the access-ended line and Close.
10. f3b-verify-address-sheet · ios · 10-postcard-confirm · light — the inline confirm with Send postcard.
11. f3b-verify-address-sheet · ios · 11-postcard-pending · light — "Your postcard is on its way.", dates with relative counts, the code field, the locked late path, then "Or verify another way".
12. f3b-verify-address-sheet · ios · 12-wrong-code · light — the error under the code field.
13. f3b-verify-address-sheet · ios · 13-document-choose · light — the full accepted-types line (90 days, Clark Public Utilities example) and Choose a document.
14. f3b-verify-address-sheet · ios · 14-document-in-review · light — the review waiting state, with other methods under "Or verify another way".
15. f3b-verify-address-sheet · ios · 15-document-rejected · light — the specific reason and Upload a different document.
16. f3b-verify-address-sheet · ios · 16-landlord-sent · light — "We emailed your landlord." with the 1–3 day line, and other methods below.
17. f3b-verify-address-sheet · ios · 17-unavailable-address-type · light — Postcard not available here.
18. f3b-verify-address-sheet · ios · 18-no-method-available · light — medium detent: the single line and Close only.
19. f3b-verify-address-sheet · ios · 19-caller-before-after · light — the Nearby caller before verification (dimmed control plus LockedActionRow) and after it (control live, no row), side by side; the after state is labelled "This sheet never opens in the after state".
20. f3b-verify-address-sheet · ios · 20-loading · light — header plus row skeletons.
21. f3b-verify-address-sheet · ios · 21-error · light — InlineErrorRow with Retry.
22. f3b-verify-address-sheet · ios · 22-offline · light — the OfflineNotice line and dimmed rows reading "Needs a connection."
23. f3b-verify-address-sheet · android · 23-picker-all-methods · light — the Material 3 bottom sheet.
24. f3b-verify-address-sheet · android · 24-non-owner-ask-offered · light — the Android twin of frame 1.
25. f3b-verify-address-sheet · web-1440 · 25-picker-after-joining · light — Priya Raman just accepted; the centred modal with the invitation reason.
26. f3b-verify-address-sheet · web-390 · 26-picker-after-joining · light — the full-height sheet.
27. f3b-verify-address-sheet · web-390 · 27-postcard-pending · light — the full-height pending state.
28. f3b-verify-address-sheet · ios · 28-non-owner-ax5 · light — AX5 text, chips under names, scrolling.
29. f3b-verify-address-sheet · ios · 29-postcard-pending-greyscale · light — frame 11 in greyscale.
30. f3b-verify-address-sheet · ios · 30-non-owner-ask-offered · dark — the dark twin of frame 1.
31. f3b-verify-address-sheet · ios · 31-postcard-pending · dark — the dark twin of frame 11.
32. f3b-verify-address-sheet · web-1440 · 32-notes · light — Notes, listing:
- the reason string per caller;
- what changed from the existing sheets: the reason header, verb rows instead of benefit tiles, four equal method rows instead of a pre-selected method and one Start button, "5–10 days" instead of "3–7 days", the Ask method, and unavailable rows kept in place;
- that the unlock list is rewritten into the shared GrantLimitList verb rows (research: plain verbs), which departs from the design doc's "unchanged" list, and that the current benefit about the mailbox opening is dropped because the household mailbox keeps household semantics;
- that unlock rows use the lock glyph here (still locked for the reader), while the owner confirmation sheet shows the same strings with the success tick (granted by confirming);
- that the iOS sheet opens at the large detent so all four methods show, with medium used only for single-line states;
- that the admin override method is not shown to people;
- that "Ask Maya Chen to confirm" is a proposed fifth way to verify an address (the design doc names four), pending a product decision;
- that Maya is notified only on close, and that Cancel request tells her nothing new;
- that after "didn't confirm" the Ask row is absent, so Sam cannot re-ask repeatedly;
- that the chip uses the neutral StatusChip instead of the per-surface note's primary.700 on info background;
- that the LockedActionRow pending string is "Your postcard is on its way — expected by Sat 24 Oct (in 5 days)", with "Enter code" opening this sheet;
- the assumed code format (6 characters, uppercase letters and digits);
- that the "Also:" line is the shared string set;
- every invented string: Wed 14 Oct, Sat 24 Oct, Fri 13 Nov, Mon 26 Oct, Tue 27 Oct, 3:40 PM, "About 1 day", "1–3 days", "Varies", "Not available", the four requirement lines, the full accepted-types line including "A Clark Public Utilities bill works", "Only the person on the lease can use this.", "Needs a landlord contact on file.", "Or verify another way", "We'll ask Maya when you close this.", "Request ready · Undo", "Cancel request", "Request cancelled · Undo", "Maya hasn't answered yet · Asked Mon 19 Oct", "Ask Maya again", the confirmed and access-ended lines, "You can now message your neighbors.", "No verification method is available for this address yet.", the landlord lines, the in-review lines, the wrong-code and rejected-document text, the address-type reason, the generic reason, "Needs a connection.", and Priya Raman as the just-joined caller;
- other assumptions;
- omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-24, then wait for "continue". Turn 5: 25-30, then wait for "continue". Turn 6: 31-32.
