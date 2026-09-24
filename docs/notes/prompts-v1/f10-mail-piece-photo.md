# Photographed mail piece (record + photo viewer)
id: f10-mail-piece-photo · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Photographed mail piece — the record, and the photo viewer
PLATFORMS + VIEWPORTS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS: an EXTENSION of two existing Pantopus screens — the mailbox drawer list and the mail piece detail. Both already exist and are already designed in the Pantopus design system: open them, keep everything, and change only what is listed below. There is no separate photo viewer screen — the mail piece detail IS the viewer.
WHERE IT LIVES: Mail tab → mailbox drawer → mail piece.
HOW THE USER GETS HERE: "See the piece" on a Mail Day row; the mailbox drawer; "View the photo" in a bill's provenance block; the mail-snap privacy card's list of snaps.
THE ONE JOB: answer "where did the thing I photographed go?" after triage ends — and be the one place the image can be looked at and permanently deleted.

CONTENT:
DRAWER LIST additions — a "Photographed" filter chip and search that matches payee or amount (typing "184.62" matches). Rows gain a 40×52 thumbnail and extracted key facts:
  Clark Public Utilities · $184.62 · due Oct 2 · Added to bills [thumb]
  NW Natural · $61.08 · due Sep 30 · Filed [thumb]
  Clark County Treasurer · $2,913.55 · due Oct 31 [thumb]
  State Farm · renews Nov 4 · $612.40 [no photo — collapse the rail]
  Comcast · photo deleted Sep 12 · text record kept [quiet placeholder glyph, never a broken-image icon]
PIECE DETAIL — the full-bleed zoomable image; "Photographed Sep 16, 2026 at 7:24 pm"; "Only your household can see this photo. Nobody nearby can."; the cross-link "Added to bills · $184.62 due Oct 2 →"; an authenticated "Download" on web only; and one destructive "Delete this photo" whose confirm reads "Delete this photo? The bill and its amount stay; only the photo is removed."

THE VISUALIZATION DECISION:
A DOCUMENT viewer, not a photo gallery. Small-print legibility and pinch-zoom beat swiping between items — there is no carousel and no paging dots. Image opens fit-to-width on a dark scrim (this surface stays dark in the light theme too; it is the one place the light palette does not apply). 1x fit, double-tap to 2x, pinch to 4x. At 2x on a portrait letter the chrome must not obscure the top third — the header and the bottom panel auto-hide on the first zoom or tap and return on a single tap. The facts panel is a bottom sheet on native and a right rail on desktop, so it never sits on the letterhead.

STATES TO DRAW (each its own frame; detail states at 393×852, plus both list frames at 1440×900):
list: photographed filter off · photographed filter on with an amount search active
detail: photographed with a confirmed bill · photographed, filed without a bill (no bill cross-link, no empty slot) · photo deleted, text record kept · signed URL expired (transparent re-fetch shimmer, then an honest "This photo's link expired" with Retry) · permission-denied (the piece and its dates stay visible; payee and amount are replaced by a stated reason, and the image itself does not open — a photograph of a bill IS the amount) · loading · error · offline ("You're offline. This photo isn't saved on this device." with the cached key facts still readable).

WHY IT IS SHAPED THIS WAY (do not optimise away): merging the viewer into the mail piece keeps one object with two durable homes — the record in Mail and the obligation in the bill — cross-linked both ways. Without a viewer the privacy promise (private storage, authenticated download, deletable) is unfalsifiable from inside the product: a photo uploaded, read by a model, and never seen or removed by the person who took it.

DO NOT: do not build a swipeable photo gallery or carousel. Do not let persistent chrome overlay the top third of the letter at 2x. Do not let the delete confirm say only "This can't be undone" — it must name what survives.
