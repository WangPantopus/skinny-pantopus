# Invitation decision (what you get now vs what needs verification)
id: f3b-invitation-decision · platforms: web/ios/android · isNew: False · frames: 19

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Invitation decision — what you get now vs what needs address verification.
THIS IS: an EXTENSION of the existing designed invitation screen (web /invite/[token], both the authenticated and public variants; iOS HomeInvitationDecisionView; Android HomeInvitationDecisionScreen). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below: replace the ownership paragraph with the two-column grant/limit list, and add the accepted state's next-step actions.
PLATFORMS + VIEWPORTS: web 1440×900 and 390×844, iOS 393×852, Android 412×915.
WHERE IT LIVES: reached from outside the four tabs by token deep link — an invite link in email or SMS, the "Review" action on the Place-tab invite banner, or manual invite-code entry. On accept it hands off into the Place tab.
THE ONE JOB: let someone accept household access understanding exactly what it does and does not give them, then land them somewhere useful.

CONTENT (exact, dense):
Home "the Payne St house", 2418 NW Payne St, Camas WA 98607. Inviter "Sam Ortega". Offered role "Member". Access window "Starts Sep 18, 2026 · no end date". Expiry "This invitation expires Sep 25, 2026". Actions "Accept" / "Decline".
WHAT YOU GET NOW (ticked rows): the household calendar — add and edit; bills — see every bill and who paid it; tasks; who lives here; the household's pickup day (Tuesday, Waste Connections).
WHAT NEEDS ADDRESS VERIFICATION (locked rows): a residency letter; your Residency Pass; neighbor messages; Real Rent; Block Founder rank.
Accepted state: headline "You're in.", primary "Verify this address", secondary "Open Home", tertiary text link "Not now".
Blocked state copy: "This home changed who can invite people. Ask Sam Ortega to send it again."

THE VISUALIZATION DECISION: two short scannable columns side by side on desktop, stacked on mobile with the grant column FIRST and visually heavier. Left/top column = tick glyph rows in the success token; right/bottom column = lock glyph rows in the muted text token on the sunken surface — same row height, same type size, so the limits read as a list and not as a warning block. Lead with the grant: the limits never get a coloured banner, a border or an alert icon. The header keeps home, inviter, role, access window and expiry as a plain four-line manifest above the columns. On accept, the columns stay on screen and the locked column gains a single caption "Verify your address to unlock these" directly above the primary CTA, so the CTA points at something the user has already read.
Degradation: no expiry on the invite → a row reading "No expiry"; an unresolvable role capability set → render the two columns from the default Member grant with the caption "Standard member access"; unknown city → show the street line only, never a blank.

STATES TO DRAW (each its own frame): loading; offer; accepting; accepted (with verify next step); declined; expired; revoked; already a member; INVITE_POLICY_CHANGED blocked with the reason; signed-out variant (token preserved through register and returned here); error; offline.
FRAMES: all 12 at web 1440×900; offer + accepted repeated at web 390×844; offer, accepting, accepted on iOS; offer, accepted on Android.

WHY IT IS SHAPED THIS WAY: the current ownership sentence reads as legalese, which is exactly why it gets skipped at the one moment consent matters. Do NOT auto-present the verify sheet on accept — that turns a welcome into a nag; verification is the success screen's primary CTA with a "Not now" that costs nothing.

DO NOT: do not write a paragraph anywhere on this screen; do not style the locked column as an error, warning or disclaimer; do not imply the invitee gains any ownership of the home; do not auto-open the verification sheet.

