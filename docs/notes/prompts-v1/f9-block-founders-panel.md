# Block Founders (rank vs tier, slot meter, postcard allowance)
id: f9-block-founders-panel · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Block Founders panel — rank vs tier, slot meter, postcard allowance
PLATFORMS: web 1440×900 desktop and 390×844 mobile web; iOS 393×852; Android 412×915.
THIS IS: an EXTENSION of the existing designed screen "Block Founders" (web BlockDetail, iOS PlaceBlockFoundersSection, Android PlaceBlockFoundersContent). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. It MOVES from Place > Your block to the Nearby tab; also draw Place > Your block reduced to a single pointer row reading "Your block · NW Lacamas Dr, 2300–2500 block" with a chevron to Nearby.
WHERE IT LIVES: Nearby tab → Block Founders, directly under the Invite rewards card and above the cells map.
HOW THE USER GETS HERE: Nearby tab; the Place > Your block pointer row; tier 3 on the Invite rewards card; the Verified success screen's "See your block" CTA.
THE ONE JOB: give each thing one name — rank is permanent, tier is scarce — and make this week's earned postcard allowance visible before the user spends it.

CONTENT (exact strings):
Rank badge: "Block Founder #3 · permanent". Tier line: "Founding Neighbor · slot 2 of 5 · closes in 6 days" (window opened Sep 1, 2026, closes Tue Sep 22, 2026).
Roster, block "NW Lacamas Dr, 2300–2500 block, Camas WA 98607": #1 Marisol T., verified Jun 2, 2026 · #2 Ken A., verified Jul 18, 2026 · #3 You, verified Sep 2, 2026.
Invite composer: allowance counter ABOVE the field — "4 of 6 invites left this week · +1 earned from a referral", then "Resets Monday, Sep 21". Cap is 3 base plus 1 per converted referral, maximum 3 earned; this user has 3 converted, so 6. Field label "Neighbor's mailing address", filled with "2455 NW Lacamas Dr, Camas WA 98607". Button "Send postcard invite".
Send error: "Couldn't send to 2455 NW Lacamas Dr — the postal service returned that address as undeliverable. Nothing was taken from your allowance." Rate-limited: "One more postcard in 12 minutes — this keeps a block from getting papered in an afternoon." Exhausted: "0 of 6 invites left this week · resets Monday, Sep 21".

THE VISUALIZATION DECISION:
Rank and tier must be two visibly different shapes, because today both names sit in one paragraph and a rename nobody can perceive changes nothing. Rank: a squared badge (radius 8) on surface.sunken, a large numeral 3, overline "BLOCK FOUNDER", caption "permanent" — no countdown, no meter, nothing depleting. Tier: a warning-tinted countdown pill (radius pill) reading "closes in 6 days", sitting directly above a 5-SEGMENT slot meter — always exactly five segments so the denominator is visible, 2 filled primary.600, 3 hollow with a border.strong outline — plus a thin 21-day depletion bar beneath showing 15 of 21 elapsed. Five abstract segments, never four; the four qualitative density dots on the T0 preview mean something else and users will read one as the other.
Allowance: six small postcard glyphs in a row above the field — 2 flat grey (spent), 3 border.strong outlines (base), 1 primary outline with a "+" corner (earned) — so base and earned are separable at a glance, and the glyph is obviously not the slot meter. Today the earned count exists only inside the post-send toast, so a user earns an invite and learns of it after spending one; this counter is why the panel moved.
Degrade: window closed or zero slots → no pill, no meter, no line, silently. Slot lookup failed → render the whole tier block not at all; an empty meter reads as five open, which is the false promise.

STATES TO DRAW (one frame each): T4 verified with rank + tier · T3 unverified teaser (roster visible, no slot promise, "Verify your address to claim a rank") · founding window closed · no founders yet · allowance remaining · allowance exhausted with reset day named · send error · rate-limited · loading · error.

DO NOT: do not give rank and tier the same chip shape, colour or radius, and never let both sit in one sentence. Do not put the allowance under the send button or in a post-send toast.
