# Verify this address (one sheet, many callers)
id: f3b-verify-address-sheet · platforms: web/ios/android · isNew: True · frames: 15

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Verify this address — one sheet, many callers, parameterised by WHY it opened.
THIS IS: a NEW sheet. Web has a verify prompt component but no host; iOS and Android have only an inline verify banner and need the sheet itself. Design it once.
PLATFORMS + VIEWPORTS: iOS 393×852 sheet with medium and large detents; Android 412×915 bottom sheet; web 1440×900 centred modal and 390×844 full-height sheet.
WHERE IT LIVES: not a tab of its own — it opens over whatever called it: the Place tab (Place dashboard verify banner, the place file's Proof row, the members roster capability caption), the invitation-accepted screen, and any locked attested control anywhere in the app.
THE ONE JOB: explain what address verification adds and start one method, with a header that names the reason you are here.

CONTENT (exact, dense):
Header reason strings, one per caller: "To send neighbor messages, we need to confirm you live here." / "You've joined the Payne St house. Confirming your address unlocks a few more things." Address line under it: 2418 NW Payne St, Camas WA 98607.
Unlock list, two shown then collapsed: "Send neighbor messages", "Request a residency letter", then "and 3 more" expanding to "Show a Residency Pass", "Set Real Rent", "Claim Block Founder rank".
Method rows, each with an ETA chip and one requirement line:
- "Postcard code" · "5–7 days" · "We mail a code to 2418 NW Payne St. Enter it when it arrives."
- "Document" · "About 1 day" · "A lease or utility bill from the last 90 days with your name at this address — a Clark PUD bill works."
- "Landlord confirmation" · "1–3 days" · "We email the landlord on the lease. Needs a landlord contact on file."
- "Ask Sam Ortega to confirm" · "Usually same day" · "Sam claimed this address, so they can confirm you live here."
Pending state: "We're checking your postcard code — mailed Sep 12, expected by Sep 19."

THE VISUALIZATION DECISION: unlock list first, capped at the two things people actually want, the remainder behind one "and 3 more" disclosure — never a five-item wall. Method rows below, each a single row with a leading glyph, the method name, the requirement line as secondary text and the ETA as a right-aligned chip in the info token. The chips are the point: they turn the decision into "how fast" rather than "what is this", so the ETA column must align down the whole stack and be readable before any row is read in full. No method is visually recommended; nothing is primary. An unavailable method stays in the list, greyed, with its reason replacing its requirement line ("Not available for an address someone else has claimed") and, where relevant, the owner-attestation row pulled directly beneath it as the offered path.
Degradation: no ETA from the server → the chip reads "Varies", never disappears; no methods at all → one line, "No verification method is available for this address yet", and the sheet offers the attestation path or closes cleanly.

STATES TO DRAW (each its own frame): loading methods; method picker (all four); a method unavailable for this address type; a method unavailable to a non-owner occupant, with the owner-attestation path offered; verification already pending (status, never a second start); already address-verified — draw the CALLER surface with the sheet not opening and a caption "this sheet never opens in this state"; error; offline.
FRAMES: all 8 on iOS; method picker, pending, non-owner-blocked on Android; method picker and pending at both web viewports.

WHY IT IS SHAPED THIS WAY: the obvious mistake is two sheets — one for "you just accepted" and one for "you tried to do a thing". One sheet plus a reason parameter keeps the body identical everywhere and the header honest.

DO NOT: do not draw a progress bar, a step counter or a percentage — nothing here should read as "you are 40% verified"; do not rank or recommend one method; do not hide an unavailable method instead of explaining it.

