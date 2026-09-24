# Home dashboard, member read-only view
id: f3-member-home-dashboard · platforms: web/ios/android · isNew: False · frames: 7

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

THIS IS AN EXTENSION of the existing screen "Home dashboard" - this already exists and is already designed in the Pantopus design system - open it, keep everything, and change only what is listed below.

PLATFORMS: web 1440x900 and 390x844, iOS 393x852, Android 412x915.

WHERE IT SITS: Place tab -> your place file -> "this home" -> home dashboard. Also reached from My Homes and from household notification deep links (/homes/:id).

THE ONE JOB: give an invited co-resident a dashboard that is useful and readable without manage permissions.

CONTENT: viewer is Sam Okafor, a member (not owner) of "Maple St", 1428 NE Maple St, Camas WA 98607, owner Dana Whitfield; today is Sep 16 2026. After the permissions migration a member holds members.view, calendar.view, calendar.edit and finance.view, so three cards appear for the first time. Members card: "3 people live here" - Dana Whitfield (Owner), Sam Okafor (You), Priya Raman (Member). Calendar card: "Garbage + recycling - Wed Sep 17" and "Clark County property tax, 2nd half - Oct 31". Bills card: "6 upcoming - $2,233.48", rows "Clark PUD $84.00 - due Sep 20" and "City of Camas Water/Sewer/Storm $137.40 - due Sep 25". The three existing cards stay: Today card (memberCount now reads "3 people live here" - it was forced blank for members before), Tasks card "2 open", Documents & Security card. Locked action row copy: lock glyph + "Address verification needed to send neighbor messages" + "Verify address". Revoked copy: "Your access to Maple St ended." + "Back to your place".

THE VISUALIZATION DECISION: design ONE read-only card variant and apply it to all six cards - not a per-card improvisation. Header, body and density are pixel-identical to the owner variant; the only difference is the footer action row, which collapses from the owner's control cluster (Add bill / Mark paid / Invite / Manage) to a single quiet "View" affordance, right-aligned. Draw the owner card and the member card side by side in one frame so the diff is visibly exactly one row. No manage FAB for members. Every manage control a member can see is either absent entirely or disabled with the lock row stating the reason underneath it - never present-and-inert. Keep the home identity accent (#16A34A) and the existing card order; do not re-rank cards for members.

WHY (do not optimise this away): Android's silent early return on canPerform is the specific failure being fixed - a member taps a visible control and literally nothing happens, which reads as a broken app rather than a permission.

STATES TO DRAW, each its own frame:
1. Loading - card-shaped skeletons in place.
2. Member view - six read-only cards, no FAB, single "View" per card.
3. Owner/admin view - for the one-row diff.
4. Access revoked mid-session.
5. Verification-required CTA row present on the card that needs it.
6. Error.
7. Offline.

DO NOT: do not invent a different read-only treatment per card; do not hide Members, Calendar or Bills from members to "keep it simple" - they are the entire point of the migration; do not show a greyed manage button with no reason attached; do not add a "Request access" flow that does not exist.
