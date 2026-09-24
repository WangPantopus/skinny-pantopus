# Members roster
id: f3-members-roster · platforms: web/ios/android · isNew: False · frames: 10

Use the Pantopus house style, honesty rules and platform specs from the top of this pack.

SCREEN: Members roster
THIS IS: an EXTENSION of the existing designed screen "Members" (the home's Members & Security tab / members list). This already exists and is already designed in the Pantopus design system — open it, keep everything, and change only what is listed below. On web, collapse the standalone members route and the dashboard Members tab into this single surface: there must be exactly one members screen, not two unlinked ones.
PLATFORMS: web 1440×900 and 390×844; iOS 393×852; Android 412×915.
WHERE IT LIVES: Place tab → your claimed home → Members.
HOW THE USER GETS HERE: the home dashboard Members tab; the place file's "People" rows; the "Who lives here with you?" household block; the landing banner "You have 2 invitations".
THE ONE JOB: let every member see who lives here, show honestly how each person was verified, and make the Invite button actually invite.

CONTENT — home "4312 NW Sierra Dr, Camas, WA 98607"; today Wed 16 Sep 2026. Group rows by role:
OWNER — Dana Whitfield (you) · joined Aug 28, 2026
ADMIN — Marcus Ellery · joined Sep 2, 2026
MEMBERS — Priya Raman · joined Sep 9, 2026 / Sam Okonkwo · joined Sep 11, 2026 / Tova Lindgren · joined Sep 14, 2026
GUEST — Jenna Reyes · access until Oct 1, 2026
PENDING INVITES (managers only) — rjmoore@proton.me · sent Sep 9, expires Sep 23 · "Needs reissue — your household's invite rules changed" with a one-tap "Reissue"; @kbeckwith · Member · sent Sep 14, 2026.
Header action "Invite" opens the invite composer. "Add guest" points at the same composer with the Guest role preselected.
Locked-action example to draw inside Sam Okonkwo's row actions: the "Send a neighbor message" control is replaced in place by one quiet row — lock glyph + "Address verification needed to send neighbor messages" + "Verify address".

THE VISUALIZATION DECISION: role groups with an overline group label and one row per person — avatar, name, joined date, overflow. The verification source is NOT a chip beside anybody's name. It appears only where something is actually locked, as a quiet capability caption on the ACTION, never on the person: badging your housemates "Address-verified" vs "Household member" reads as a social ranking of the people you live with rather than a note about what they can do. So the default roster carries no status chips at all; the only verification language on the screen is attached to a control that cannot be used yet, and it always names the reason and offers the path. Pending invites sit in their own group below the people, visually quieter, with the "Needs reissue" row carrying semantic.warning and its action inline on the row — the sender must be able to see and fix what the recipient was told to ask about.

FRAMES (one each): loading (skeleton rows preserving the group structure) · member view — no invite FAB, no role editing, no pending section at all · owner/admin view — full roster plus pending group · empty ("Just you so far" reoffering the household block's invite CTAs) · permission-denied · pending invite · needs reissue · sending / reissuing · error · offline (cached roster, actions disabled).

DO NOT: do not put verification badges or trust chips next to people's names. Do not draw an "Add guest" form that takes a name and an email and confirms success — that screen is being deleted precisely because it never sent anything, and a lying screen one tap from this flow is the specific failure mode here. Do not show the pending-invites group to a plain member, and never render a manage control a member can see but cannot use.
