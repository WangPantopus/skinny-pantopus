# Invitations waiting for you (single-slot landing banner)
id: f3-invite-banner · platforms: web/ios/android · isNew: False · frames: 16

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Invitations waiting for you — the single-slot landing banner.
THIS IS: an EXTENSION of the existing designed Place dashboard / hub landing screen (web Place dashboard status strip, iOS Hub banner slot, Android HubSections banner region). That screen already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. You are adding one banner variant into the banner slot that already holds the "from the card in your mailbox" arrival pill; you are not redesigning the dashboard.
PLATFORMS + VIEWPORTS: web 1440×900 (left sidebar nav) and 390×844 (four-tab bottom bar), iOS 393×852, Android 412×915.
WHERE IT LIVES: Place tab → Place dashboard / hub — the first screen a signed-in user lands on. Reached on every load of that screen, and as the landing target of the "new invitation" push.
THE ONE JOB: make a waiting household invitation — and a dead one the sender must send again — impossible to miss without opening My Homes.

CONTENT (use these exact strings and this density):
- One invite: "Sam Ortega invited you to the Payne St house" · action "Review".
- Multiple: "You have 3 invitations" · "Review".
- Expiring soon: "Sam Ortega invited you to the Payne St house · Expires tomorrow" (today is Wed Sep 16, 2026; expiry Thu Sep 17, 2026).
- Sender twin: "2 invitations need to be sent again" · "Fix".
Homes in play: the Payne St house = 2418 NW Payne St, Camas WA 98607; Maple St = 716 SE Maple St, Vancouver WA 98664. The dashboard behind the banner shows a saved place, no claimed home.

THE VISUALIZATION DECISION: one line. Inviter's NAME first, home second, exactly one action on the trailing edge. Reuse the geometry of the existing mailbox-arrival pill — same height, radius, inset, icon size — so it reads as arrival context rather than a new component. Exactly one banner may ever render: precedence is invite > reissue > setup > verify. Draw the DENSEST case — a user who has an invite pending AND an unclaimed address AND an unverified profile — showing only the invite banner, and place the suppressed setup and verify banners greyed out beside the frame, labelled "suppressed by precedence", so the rule is visible to whoever builds it. Two or more invites collapse to a count line, never a stack of rows, never an avatar cluster. Expiry is a trailing caption on the same line in the warning token, not a badge and not error-red.
Degradation: no inviter name → "Someone invited you to the Payne St house"; no home label → the city, "…to a home in Camas"; fetch failure → the slot renders nothing and the content below does not shift.

STATES TO DRAW (each its own frame): hidden (no invitations — show the dashboard with the slot collapsed); one invite; multiple; expiring soon; needs reissue (sender side); fetch failed (silently empty slot); offline (cached banner, Review disabled with a one-line reason).
FRAMES: all 7 at web 1440×900, then one-invite / multiple / needs-reissue repeated at web 390×844, iOS and Android.

WHY IT IS SHAPED THIS WAY: a brand-new invitee usually owns no home at all and has no reason to open My Homes, so the invitation has to meet them on the screen they actually land on. The sender-side row is what closes the loop — without it the recipient is told to ask someone who can see nothing wrong.

DO NOT: do not draw two banners in the slot in any state; do not draw a "Couldn't load invitations" or error banner — a fetch failure is invisible; do not invent a new card, chip or component when the mailbox pill already defines this slot.

