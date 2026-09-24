# Bill provenance block (from a photo you took)
id: f10-bill-provenance · platforms: web/ios/android · isNew: False · frames: 9

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Bill provenance block — "From a photo you took"
THIS IS: an EXTENSION. The host is the existing screen "Bill detail" (web /app/homes/[id]/bills/[billId], iOS BillDetailView, Android BillDetailScreen). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. You are adding one card inside it, nothing else.
PLATFORMS / VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
WHERE IT LIVES: Place tab → Money → Bills → Bill detail. Users also land here from the Today 14-day strip's money row, from a bill reminder push, and from a mail piece's "Added to bills" link in the Mail tab.
THE ONE JOB: Show this bill's origin honestly — a machine read a photograph and a human confirmed it — and put correcting it, looking at it and deleting it in one place.

CONTENT (exact strings, real density)
Already on the screen, unchanged: Clark PUD · $142.18 · Due Oct 12, 2026 · account ending 4471 · 2416 NE Ingle Rd, Camas WA 98607 · status chip "Due in 9 days" · "Added by Sam · Oct 3".
The new block, beneath all of that:
  Header row: "From a photo you took · Oct 3" with a small portrait thumbnail of a folded utility bill at the left.
  Line: "We read this from your photo. You confirmed the amount on Oct 3."
  Quiet actions in this order: "View the photo" (→ the mail piece photo viewer), "Fix what we read" (→ the extraction review screen, re-opened).
  At the block's foot, the destructive action: "Delete the bill and the photo". Its confirm reads "This removes the bill and the photograph. Nothing else changes." On confirm the bill disappears from Upcoming immediately with an "Bill and photo deleted · Undo" snackbar.

THE VISUALIZATION DECISION
A subordinate evidence block, never a banner. It sits BELOW the amount, due date and status chip — the number is what the user came for. Draw it on surface.raised with a border.subtle hairline, one step quieter than the bill facts: 56×72 thumbnail at radii.md on the left, two lines at bodySmall and caption to its right, actions as text buttons underneath. Provenance is the system's SHAPE, not a number: FILLED-WITH-TICK = you confirmed it (the default here), HOLLOW = read but not confirmed. Tapping the mark opens the shared "Where this comes from" sheet. State the confirmation as a state — "You confirmed this" — never as a confidence percentage, because a score invites distrust of a value the person has already personally checked. For a low-confidence extraction the mark stays hollow and one extra line appears: "We weren't sure about the due date. You changed it on Oct 3." — uncertainty attaches to the field that had it, never to the bill as a whole.
Degradation: a hand-entered bill gets NO block — no empty slot, no "No photo" row, no grey placeholder. A bill whose photo was deleted keeps the block, draws the mark at thumbnail size where the image was, and reads "The photo was deleted on Oct 9. The amount you confirmed stays."

STATES TO DRAW (one frame each)
1. Created by snap, confirmed (default). 2. Created manually — the same bill detail with the block absent. 3. Low-confidence extraction. 4. Photo deleted, bill kept. 5. Paid — "Paid by Sam · Oct 9"; landing here from a reminder must read as reassurance, block unchanged. 6. Overdue — due Oct 12, today Oct 19, status chip in error, block still quiet. 7. Permission-denied — a member without finance.view sees the block and its date but payee and amount are hidden, and "Fix what we read" plus delete are disabled with the reason stated on the row. 8. Error loading the block (bill still renders). 9. Offline — thumbnail not cached, mark drawn at thumbnail size, "Photo not available offline", actions disabled.

DO NOT
Do not draw a confidence percentage, match score, star rating or "AI" badge anywhere in this block. Do not promote it to a banner above the amount. Do not leave an empty provenance slot on a hand-entered bill. Do not use the word "Paid" for the act of confirming an extraction. Do not write a delete confirm that says only "This can't be undone" — name exactly which two things go and which one stays.
