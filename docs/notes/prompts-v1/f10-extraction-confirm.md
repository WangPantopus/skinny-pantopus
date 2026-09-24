# Confirm what we read (extraction review)
id: f10-extraction-confirm · platforms: web/ios/android · isNew: True · frames: 11

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Confirm what we read (extraction review)
PLATFORMS + VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS: a NEW full-screen screen — not a sheet. It is one step in a capture → confirm → next loop running over Mail Day, and it is re-openable later from any Unconfirmed row.
WHERE IT LIVES: Mail tab → Mail Day → confirm.
HOW THE USER GETS HERE: upload completion in the capture tray (auto-advance, showing "Piece 3 of 5"); tapping any Unconfirmed row on Mail Day.
THE ONE JOB: turn the machine's guess into the user's confirmed fact before anything reaches bills, the calendar or a reminder.

CONTENT (use these exact values):
Photo: a portrait Clark Public Utilities bill, pinned. Step counter "Piece 3 of 5". Classification: "Bill · Electric". Editable fields, each showing what was read and each independently correctable:
  Payee — Clark Public Utilities (confident)
  Amount — $184.62 (confident)
  Due date — October 2, 2026 (UNCERTAIN)
  Account ending — 4471 (UNCERTAIN)
  Kind — Electric (confident)
Controls, one per field type: text with recent-payee suggestions; a decimal pad with a currency prefix; the native date control (must accept dates ~2 years out); a 4-digit numeric field; and the same glyph-tile kind grid the Date sheet uses. A "Remind me" row — 60 / 30 / 7 / 1 days, 7 selected — identical to the Date sheet's control, with the small leader line back to the due date so the reminder reads as visibly earlier than the event.
Two explicit commits of near-equal weight: "Add to bills" (primary) and "Just file it". On success: "Added to your calendar. We'll remind you 7 days before."
Duplicate-suspected banner copy: "You already have Clark Public Utilities · $184.62 · due Oct 2 on this list." with Keep both / Replace.

THE VISUALIZATION DECISION:
Photo BESIDE fields, never photo-then-fields — the user is proofreading, so the source and the extracted value must be on screen together. Desktop: photo pane left ~55%, fields right ~45%, each scrolling independently. Phone: the photo is a PINNED pane occupying the top ~42% of the viewport while the fields scroll beneath it; it never scrolls away. Tapping a field scrolls and zooms the pinned pane to the OCR region that value came from and outlines that region with a 2px focus-border rectangle. Where OCR returns no boxes, the pane stays at fit-to-width and no rectangle is drawn — do not invent a highlight.
Confidence is expressed PER FIELD and only as the system's provenance marks: a hollow mark beside Due date and Account ending, a filled mark on the confident fields. Never a number, a bar or a single score.

STATES TO DRAW (each its own frame; all 11 at 393×852, then repeat "extracted, low confidence" and "permission-denied" on desktop and Android):
extracting · extracted, high confidence · extracted, low confidence (uncertain fields flagged, commits still available) · AI unavailable → same screen, blank fields, "We couldn't read this one automatically" · unreadable photo → Retake or enter manually · duplicate suspected · permission-denied (a member can "Just file it"; "Add to bills" is disabled with the reason stated on the control) · no claimed home → routed to the Date sheet · saving · error (every typed value preserved) · offline.

WHY IT IS SHAPED THIS WAY (do not optimise away): the original "editable chips (Due Oct 12 · $142 · Clark PUD · Confirm)" is the worst choice here — a currency, a date and a payee each want a different keyboard and a different control, and a chip row hides which value the model was unsure about. Chips survive only as the collapsed summary line on the Mail Day row. Done five times per stack, this is a screen, not a sheet.

DO NOT: do not draw a single confidence percentage, meter or "87% sure" badge. Do not use a chip row as the editing interface. Never use the word "Paid" anywhere on this screen. Do not collapse the photo behind a tap-to-expand.
