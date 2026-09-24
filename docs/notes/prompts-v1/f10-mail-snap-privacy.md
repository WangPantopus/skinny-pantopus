# Mail snaps: privacy and storage
id: f10-mail-snap-privacy · platforms: web/ios/android · isNew: False · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Mail snaps — privacy and storage
THIS IS: an EXTENSION. The host is the existing "Mail Day settings" surface (the settings column on web; the Mail Day setup/settings stack on iOS and Android — NOT the notifications settings page, which is briefing-only). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. You are adding one card.
PLATFORMS / VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
WHERE IT LIVES: Mail tab → Mail Day → settings. Also reached from the mail piece photo viewer's "Manage mail snaps" action and from the privacy mirror's "What we store" row.
THE ONE JOB: One place to understand where photographs of your mail live, and to delete all of them.

CONTENT (exact strings, real density)
Card title "Photos of your mail".
Explainer paragraph, verbatim: "We read the photo to suggest a payee, amount and due date. You confirm before anything is saved. Photos stay private to this home." Second line: "Everyone in this household can see them: you and Sam Reyes."
One toggle: "Keep the photo after we read it" — ON consequence line "We keep the photo so you can check it later.", OFF consequence line "We read the photo, then delete it. Only the payee, amount and due date stay."
Count line: "17 photos · 41.3 MB".
Then the list itself, each row a 32pt thumbnail + payee + date + size, tappable into the mail piece:
  Clark PUD · Oct 3, 2026 · 2.4 MB
  Cascade Natural Gas · Oct 1, 2026 · 2.1 MB
  City of Camas Utilities · Sep 28, 2026 · 3.0 MB
  Xfinity · Sep 26, 2026 · 1.9 MB
  Riverview Bank statement · Sep 24, 2026 · 4.2 MB · Filed, no bill
  Clark County Assessor · Sep 22, 2026 · 2.8 MB · Filed, no bill
  Waste Connections · Sep 19, 2026 · 2.2 MB
  Not classified · Sep 12, 2026 · 3.6 MB
  "Show all 17"
Foot: "Delete all mail snaps". Confirm: "Delete all 17 photos? The bills and the amounts you confirmed stay. Only the photographs are removed." Buttons "Delete 17 photos" / "Keep them".

THE VISUALIZATION DECISION
A trust surface, not a preferences grid. Fixed vertical order, one column, max 720px measure on desktop: plain-language paragraph → the single toggle with its consequence line directly beneath it (the consequence changes when the toggle changes; it is never a static helper string) → the count and size line → the LIST of what exists → the destructive action last. Listing the snaps is both the finder and the honest precondition for deleting them: the reason this card exists is that someone photographed a bank statement by mistake and needs to see it before they can remove it, and the alternative today is hunting each bill and deleting it one at a time. So the list is on the surface, expanded, not hidden behind a "View snaps" disclosure. Rows carry no checkboxes and no per-row delete — deletion of one photo happens on the mail piece; this card owns "all of them". Keep the destructive action in text.error on surface.base with a border, never a filled red slab, and never above the list.

STATES TO DRAW (one frame each)
1. Photos kept — the default, toggle on, full 8-row list plus "Show all 17". 2. Photos off — toggle off, consequence line swapped, the existing 17 still listed with an explanatory line "These 17 were taken while the setting was on." 3. Deleting — inline progress "Deleting 17 photos… 9 done", list dimmed, toggle disabled. 4. Deleted — "17 photos deleted. Your bills and amounts are unchanged." and the card in its zero state. 5. Zero snaps — "No mail snaps stored. Photos you take on Mail Day will be listed here." with the destructive button ABSENT entirely, not disabled. 6. Extraction unavailable — "Reading photos is turned off on this deployment. You can still photograph a piece of mail; we won't suggest a payee or an amount." toggle still functional. 7. Error — "We couldn't load your mail snaps" with Retry; the explainer and the toggle still render.

DO NOT
Do not draw this as a settings list of stacked toggle rows. Do not hide the snap list behind a disclosure or a count chip. Do not bolt reminder or notification preferences onto this card. Do not show a destructive button when there are zero photos. Do not write a confirm that says "This cannot be undone" without also saying what survives.
