# Confirm this person lives here (owner attestation)
id: f3b-owner-attestation · platforms: web/ios/android · isNew: True · frames: 15

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Confirm this person lives here — owner attestation.
THIS IS: a NEW sheet. Nothing like it exists on any platform.
PLATFORMS + VIEWPORTS: iOS 393×852 sheet (medium detent, content must fit without scrolling), Android 412×915 bottom sheet, web 1440×900 centred modal and 390×844 sheet.
WHERE IT LIVES: Place tab → the home's members roster → a member row's overflow menu. Also opened by the push "Dana Whitfield is verifying this address" and from the verify sheet's "Ask Sam Ortega to confirm you live here" path on the other person's device.
THE ONE JOB: let the person who claimed this address vouch, in one act, that a co-resident really lives here — so that co-resident has a completable route to address verification.

CONTENT (exact, dense):
Title "Does Dana live here?" Subject block: "Dana Whitfield · joined the Payne St house on Sep 3, 2026 · invited by you". Address "2418 NW Payne St, Camas WA 98607".
What confirming grants, three ticked rows: "Send neighbor messages", "Request a residency letter", "Claim Block Founder rank".
The attestation checkbox, unticked by default: "I confirm Dana Whitfield lives at 2418 NW Payne St." Consequence line directly beneath, plain: "This tells Pantopus that Dana is a resident here. It does not give Dana ownership of this home and does not let Dana remove you."
Actions: "Confirm" (disabled until the box is ticked) and "Not now".
Confirmed state: "Confirmed. Dana's address is verified." with the date "Sep 16, 2026".
Permission-denied state: "Only the owner or an admin of this home can confirm a resident. Ask Sam Ortega."

THE VISUALIZATION DECISION: one person, one statement, one checkbox, two buttons — deliberately a vouching act, not a permissions screen. Vertical order is fixed: avatar and name block → the three ticked grant rows → a hairline rule → the checkbox with its consequence line → the two buttons. The grant rows use the same tick glyph and row height as the invitation decision screen's "what you get now" column, so the owner recognises they are approving exactly the list the other person was shown. The consequence line is the only place that says what confirming does NOT do, and it is body text under the checkbox, not a warning box. "Not now" is a quiet text button, never destructive red — declining is a normal, repeatable outcome.
Degradation: unknown join date → "joined recently"; no avatar → the initials monogram already in the system; if the requesting member's unlock list can't be resolved, show the three default rows with the caption "Standard resident unlocks".

STATES TO DRAW (each its own frame): request pending (the ask, box unticked, Confirm disabled); confirming; confirmed; declined; the owner has revoked this member's access since the request; already address-verified (nothing to confirm — status line, no checkbox); permission-denied (viewer is a member, not owner or admin); error; offline (read-only, both actions disabled with the reason).
FRAMES: all 9 on iOS; request pending, confirmed, permission-denied at web 1440×900; request pending, confirming, declined on Android.

WHY IT IS SHAPED THIS WAY: if postcard, document and landlord flows all require the owner, every locked control in the product leads to a sheet nobody can complete — which is worse than hiding the control. This sheet is the path that makes "never hide, always explain, always offer the path" true for a co-resident on a home someone else claimed.

DO NOT: do not draw a permissions matrix, capability grid or role selector — this is a vouch, not an admin screen; do not pre-tick the checkbox; do not style "Not now" as a destructive action; do not imply the owner is granting ownership or that declining removes the person from the household.

