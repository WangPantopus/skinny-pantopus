# Address verification needed (the locked-action treatment)
id: f3b-locked-action-row · platforms: web/ios/android · isNew: True · frames: 11

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Address verification needed — the locked-action treatment, one reusable row used everywhere.
THIS IS: a NEW reusable component that drops into many existing already-designed Pantopus screens. Design the row once and then show it placed inside three existing hosts without redesigning those hosts.
PLATFORMS + VIEWPORTS: web 1440×900 and 390×844, iOS 393×852, Android 412×915. The row must survive a 320dp column on one line.
WHERE IT LIVES: every attested control across the four tabs — Place (residency letter, Residency Pass, residency claim, fridge cards, Real Rent, Block Founder rank, postcard invites), Nearby (neighbor-message compose), Mail (mail compose), plus the verified badge and the Founding tier CTA. The row REPLACES the control in place; the user reaches it by arriving at the surface, not by navigating anywhere. Its link opens the "Verify this address" sheet with the matching reason string.
THE ONE JOB: tell a household-verified member why an attested action is unavailable, instead of hiding the control or 403-ing after the tap.

CONTENT (exact strings, one per host):
"Address verification needed to send neighbor messages" · "Verify address"
"Address verification needed to request a residency letter" · "Verify address"
"Address verification needed to claim Block Founder rank" · "Verify address"
"Address verification needed to set Real Rent" · "Verify address"
"Address verification needed to send a postcard invite" · "Verify address"
Pending variant, no CTA: "We're checking your postcard code — expected by Sep 19".
Server-disagrees variant: "We couldn't complete that. Your address isn't verified yet." · "Verify address".
Also re-label the iOS My Homes green chip that today reads "Household access" as if it meant verified: it becomes a neutral chip reading "Member · 2418 NW Payne St", success-green removed.

THE VISUALIZATION DECISION: exactly one row, one line: lock glyph → reason → "Verify address" as a quiet inline link on the trailing edge. It must sit correctly in three host shapes without a bespoke variant — (1) directly beneath a disabled primary CTA, (2) as a row inside a list, (3) inside a card header. Draw all three in one component frame at 320dp so the builder can see the single row surviving each. Colour: muted text on the sunken surface with a border-subtle hairline — NOT error-red, NOT warning-amber. This is a capability note, not a failure: red would train people to read the app as broken every time they meet an unlock. The reason always names the specific action, never a generic "verification required". Where a control is disabled, it stays visible and disabled with this row beneath it; nothing is ever present-and-inert.
Degradation: unknown reason → "Address verification needed for this" with the link intact — the link is never dropped; long reasons wrap to a second line before they truncate; the pending variant drops the link rather than offering a start the server would reject.

STATES TO DRAW (each its own frame): address-verified (host unchanged, control live, no row — draw it so the delta is visible); household-verified, locked with reason; legacy member treated as address-verified so nobody loses an unlock (control live, no row); verification pending ("We're checking your postcard code", no CTA); server disagrees with the client gate (honest error row after the tap, never a silent no-op); offline (row present, link disabled with reason).
FRAMES: 6 state frames, plus the 3-host component frame at 320dp, plus the iOS My Homes chip before and after.

WHY IT IS SHAPED THIS WAY: when household verification stops counting as address verification, controls either vanish or 403 with no explanation, and an invited co-resident reads that as the app being broken or the owner blocking them. On Android a tapped control today does literally nothing. The row exists so there is never a dead tap and never a disappearance.

DO NOT: do not hide the control instead of locking it; do not draw this in error-red or with an alert icon; do not put verification status on a person's name in the members roster — the explanation belongs on the ACTION, never as a badge that ranks the people you live with; do not leave a control enabled that will 403.

