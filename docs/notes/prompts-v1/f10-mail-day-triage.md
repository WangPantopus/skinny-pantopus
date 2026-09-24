# Mail Day triage (snap-aware)
id: f10-mail-day-triage · platforms: web/ios/android · isNew: True · frames: 11

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Mail Day triage (snap-aware)
PLATFORMS + VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS: a NEW screen on web (new route /app/mailbox/mail-day — today the Mail nav entry points at the mailbox SETTINGS page, so web has no triage surface at all). On iOS and Android this is an EXTENSION of the existing screens "Mail Day" (MailDayView / MailDayScreen) — they already exist and are already designed in the Pantopus design system; open them, keep everything, and change only what is listed below.
WHERE IT LIVES: Mail tab → Mail Day (the tab's working surface, not its settings).
HOW THE USER GETS HERE: Mail tab nav row; the Mail Day banner in the mailbox layout; the 6:30 pm "Mail Day" push; the Money section of the Place file.
THE ONE JOB: turn tonight's stack of paper and digital mail into a list of decisions the user can finish in one sitting.

CONTENT — draw the DENSEST realistic case, not the happy minimum:
Header: "Mail Day · Wednesday, September 16" with the household chip "2417 NW Astor St, Camas · Your household". Chips: "4 mail days in a row" · "Last scan 7:12 pm yesterday". A PERSISTENT capture affordance in the header (Android: FAB) labelled "Scan today's stack" — present on the populated screen, not only in the empty hero.
NEEDS A CALL (9 rows, in this order):
1 [photo] Clark Public Utilities · Bill · "$184.62 due Oct 2" · Unconfirmed
2 [photo, uploading] "Uploading… 2 of 3"
3 [photo, failed] "Upload failed · Retry"
4 [photo] NW Natural · Bill · "$61.08 due Sep 30" · Unconfirmed
5 Clark County Treasurer · Statement · "Second-half property tax, $2,913.55 due Oct 31"
6 State Farm · Renewal · "Auto policy renews Nov 4 · $612.40"
7 Camas School District · Notice · "Ballot measure, Nov 3 election"
8 Chase · Statement · "Account ending 4471"
9 Waste Connections · Service notice · "Holiday pickup moves to Friday, Nov 27"
REVIEWED TODAY (6), collapsed rows with per-item Undo; the newest reads "Comcast · Recycled · Undo (4s)" with a live countdown, plus "Undo all 6".
Sticky footer overlapping the last rows: "Finish day · 9 left".
Below: "Yesterday: 7 pieces, 3 minutes." and one setup nudge "Turn on the 6:30 pm Mail Day reminder".

THE VISUALIZATION DECISION:
One row archetype for every piece, digital or photographed, so a routing decision and a photographed bill awaiting confirmation share a rhythm. The archetype: an OPTIONAL 56px leading thumbnail rail (absent on digital rows — collapse the rail, never draw an empty grey square), a title line (sender), a second line carrying classification + exactly ONE extracted fact, an OPTIONAL amber unconfirmed state, and a trailing decision control. Unconfirmed uses warningBg with the system's hollow provenance mark — the same mark used on the Today strip and the provenance sheet — never a red error treatment; unconfirmed is not a failure. An uploading row shows determinate progress inside the thumbnail rail only, so the list rhythm never breaks; a failed row swaps the rail for a retry glyph and puts "Retry" inline in the row.
Degradation: with no extracted fact, the second line carries the classification alone — never a blank slot, never a spinner in the row body.

STATES TO DRAW (each its own frame; all 11 on mobile web, then repeat "populated" and "no claimed home" on iOS and Android and "populated" on 1440×900 desktop):
loading · empty (hero + "Scan today's stack") · populated (the dense case above) · mid-upload rows · failed upload with inline retry · error · offline (queued snaps as pending rows) · no claimed home ("Mail snap needs a claimed address", CTA routing onward to the Date sheet, never a dead camera button) · permission-denied (a household member without finance.view sees the piece and the sender, but no payee detail and no amount) · AI unavailable notice · undo window.

WHY IT IS SHAPED THIS WAY (do not optimise away): both native apps put the scan CTA only in the EMPTY hero, so a user with one digital item already queued has no way to snap the stack. The capture affordance must be persistent on all three platforms.

DO NOT: do not draw a percentage, a progress bar or an "inbox zero" meter — nothing here may read as "you are 60% done". Do not style Unconfirmed as an error. Do not hide the capture control inside an overflow menu or an empty state.
