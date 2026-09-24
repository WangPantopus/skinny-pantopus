# Invitations waiting for you (landing banner)
id: f3-invite-banner · platforms: web/ios/android · isNew: False · artboards: 28

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Invitations waiting for you (landing banner) · f3-invite-banner

TYPE: EXTENSION of the existing designed screen "Place tab landing". That is Your places for someone with no claimed home, and the place file for someone with a home. This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

You are adding two things, without redesigning the page:
- The invitation variants of LandingBannerSlot, in the existing single banner slot. That slot already holds the "from the card in your mailbox" arrival pill.
- One "Invitations waiting for you" section on Your places.

ATTACH:
- Your places on iOS, Android and web 1440, with one saved place and the mailbox-arrival pill visible.
- The place file on iOS.
- The setup and verify banners as they look today.
- A household notifications row on iOS.
- Exports of the Foundations boards 00a–00d.

PLATFORMS & VIEWPORTS: iOS 393x852 (primary), Android 412x915, web 1440x900 (left sidebar) and 390x844 (bottom tab bar).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → the top of the Place tab landing.

Assumption A1 (blocking, Notes): with an invitation waiting, a cold start opens Place. If Today stays the first screen, Today draws no banner, and the invitation reaches the person through the push and the in-app notification row.

Recipient entry points:
- A new invitation arrives as a push in the Account & security group (Time Sensitive on iOS, HIGH on Android, on by default). The push opens that invitation's decision screen directly. If the invitation has since expired, been used or been cancelled, the push lands on its row in the Your places list, which states why.
- The in-app notification row "Maya Chen invited you to Larkspur Loop" always exists, even with push off, and opens the decision screen.
- An invitation email opened on a signed-in phone opens the decision screen, not this banner.

Sender entry points: the reissue banner appears here, and an in-app notification row carries the same line.

Where each action leads:
- One invitation: "Review" opens that invitation's decision screen.
- Two or more: "Review" opens Your places, scrolled to "Invitations waiting for you", the lasting list where people decide.
- Sender "Fix" with two or more dead invitations opens Members, scrolled to the reissue rows. Each Reissue there opens the Invite composer's reissue review.
- Sender "Fix" with exactly one dead invitation opens the Invite composer's reissue review for it directly.

WHO AND WHEN:
- Recipient: Mon 19 Oct, 6:10 PM. Priya Raman signed up yesterday. Before moving in, she saved 2418 NE Larkspur Loop as a saved place. She has claimed nothing and verified nothing. Maya Chen invited her at 5:10 PM. Priya opens Pantopus and, under assumption A1, lands on Place. She never opens a homes list.
- Sender: Maya Chen owns Larkspur Loop. Two invitations she sent last week stopped working when the household's invite rules changed.

THE ONE JOB: Make a waiting invitation, and a dead one the sender must send again, impossible to miss on the Place landing, and give both a lasting place to decide.

FIRST FIVE SECONDS: The eye should land on these, in order:
1. The inviter's name, at the start of the banner.
2. The home label.
3. The single trailing action, "Review" (or "Fix" for a sender).
Nothing else on the page changes.

CONTENT: Use the FIXTURES (Maya Chen; HOME A, label "Larkspur Loop"; the pending invite to priya@example.com, which expires Mon 26 Oct). The deltas below are for this surface only; list each one on Notes.

Who holds what, per frame:
- Frames 1, 4, 9 and 10: Priya holds only Maya's invitation.
- Frames 3, 12 and 13: Priya holds Maya's and Rosa's invitations, plus Dana's dead ones.
- Count-banner frames (2, 16, 20, 22): Sam Ortega, a member at Larkspur Loop, whose landing is the place file. He holds two live invitations; their rows are not drawn.

The recipient: Priya Raman, who holds the saved place "Larkspur Loop · Saved place · Only you".

Invitation rows:
- Live row 1: Maya Chen · Larkspur Loop, Vancouver · Member · expires in 7 days · Mon 26 Oct.
- Live row 2: Rosa Delgado · Fircrest Dr, Camas · Guest · expires in 3 days · Thu 22 Oct. (Not Jordan Lee: his Birchfield Ct place is unclaimed, so he cannot invite.)
- Dead row that stopped working: Dana · a home in Camas. This also shows the fallback when a home has no label.
- Dead-row variants, all Dana's: expired Sun 18 Oct; cancelled; already used.

Other deltas:
- Expiring frame only: Maya's invitation expires Tue 20 Oct.
- Sender rows: theo.park@example.com and @rgarcia.
- Offline time: "as of 5:52 PM".
- Notification times: the invitation at 5:10 PM; the sender reissue at 9:00 AM.
- Worst case: the inviter "Alexandria Montgomery-Ramirez" (29 characters) with a long home label. The banner wraps to two lines, keeps the name whole, and keeps the action trailing its first line.

LAYOUT & VISUALIZATION:

The banner:
- Use LandingBannerSlot, with the exact geometry of the existing mailbox pill: same height, radius and inset, and a 16pt leading glyph.
- One sentence with the actor's name first, and one trailing 44pt action.
- Only one banner is ever shown. Follow the full precedence ladder on the Foundations board: invite > reissue > claim receipt > compare arrival > mailbox arrival > sync merge > setup > verify > founding-meter preview.
- Dense frame: Priya has an invitation AND an unclaimed saved place AND an unverified profile. Show only the invitation banner. Outside the device frame, draw the suppressed setup and verify banners greyed, labelled "suppressed by precedence".

The count banner:
- The count includes only live invitations not hidden by Not now.
- Two or more collapse into one count line. Never draw stacked rows or an avatar cluster.
- With only dead invitations, there is no banner, but the section still shows.
- After Not now on one of two invitations, the banner shows the remaining one as a single invite.

The expiring banner uses the LandingBannerSlot expiring variant:
- Line 1: "Maya Chen invited you to Larkspur Loop", with Review.
- Line 2: the caption "Expires tomorrow · Tue 20 Oct" in text.primary.
- The warning glyph replaces the envelope.
- Use the two-line shape.
- No badge, no warning-coloured text, no error red.

The sender banner is LandingBannerSlot's sender-reissue variant, not an InviteRow.

The "Invitations waiting for you" section:
- It sits on Your places, directly under the title in the slot's position, above the saved places.
- One row per invitation, using InviteRow's received variant:
  - Line 1: the inviter's name first, then the home and city.
  - Line 2: role · expiry in words.
  - A trailing "Review".
- Dead rows stay listed. Each has a StatusChip where a date applies, its reason, and who can fix it. Dead rows have no Review.
- With no invitations at all, the section is absent. Never draw an empty box.

On Your places, the banner and the section never repeat each other:
- With one live invitation and no other rows to list, draw the banner only, and no section.
- With two or more invitations, or any dead or Not now row, draw the section only, and no invite or count banner on that screen.
- The count banner appears on the place file, the landing for someone with a home. There, Review opens Your places scrolled to the section.

Section states:
- Loading: WarmingSkeleton rows.
- Error, reached from a push or from Review: the InlineErrorRow "We couldn't load your invitations. · Retry". It is never shown on a plain landing, and it never takes down the rest of Your places.
- Offline: cached rows, with each Review disabled and its reason under it.

Fetch timing:
- On a cold load, the slot and the section wait for the invitations call during the page's WarmingSkeleton.
- If the call returns after the page has painted, the invitation banner enters once, as LandingBannerSlot defines. It replaces any lower banner already in the slot, and content moves down once, in 300ms or less. Under Reduce Motion there is no animation.
- Only a failed or empty fetch guarantees no shift. In that case the invite and reissue banners are skipped, and the next banner by precedence renders (for Priya, the mailbox pill).

Missing data:
- No inviter name: "Someone invited you to Larkspur Loop".
- No home label: "a home in Camas" (the city).

The banner has no chart.

INTERACTION, MOTION & HAPTICS:
- The action is the only target on the banner. The whole banner is never a hidden second target.
- The banner has no close glyph. It leaves when the invitation is accepted, declined or expires.
- The banner never opens as a modal and never opens the decision screen by itself.

Live list rows:
- The overflow holds "Not now" and "Decline".
- Not now hides that invitation from the banner until a new invitation arrives. The row stays in the list.
- Decline collapses the row to InlineUndo "Declined · Maya Chen will see this · Undo". The decline reaches the sender only after the Undo closes (when Priya leaves the screen).

Dead list rows: the overflow holds only "Remove". Remove uses InlineUndo and sends nothing.

Motion:
- The banner fades in with the page (200ms). A late banner enters as described under Fetch timing.
- Under Reduce Motion, nothing fades or slides.
- Arriving at the list from "Review" scrolls once and fades a highlight on the section. Accessibility focus moves there.

Haptics: none.

FOUNDATIONS COMPONENTS USED:
- LandingBannerSlot: the one-invite, one-invite-degraded, count, expiring, sender-reissue and offline variants.
- InviteRow, received variant. It is new: inviter first, home and city, role · expiry, trailing Review. List it on Notes as a proposed addition to the Foundations board.
- ScopeChip: Priya's saved place, unchanged.
- StatusChip: "Expired Sun 18 Oct", on the expired row only.
- InlineUndo.
- WarmingSkeleton: section rows.
- InlineErrorRow: the list error.
- NotificationRow: the recipient invitation row and the sender reissue row.
- OfflineNotice.
- FreshnessLine.
- PushCopy: the invitation push, a proposed variant.

ACCESSIBILITY:
- The banner is role=status when it appears, and never takes focus. It reads as one sentence, then its action: "Maya Chen invited you to Larkspur Loop. Review, button."
- Expiry is spoken in words: "Expires tomorrow, Tuesday 20 October."
- Review and Fix are 44pt / 48dp / 44px.
- Offline, the action stays focusable and is read with its reason: "Review, unavailable, You're offline. Review opens when you're back."
- In the list, each row is one element, with Review as its default action. Not now, Decline and Remove are custom actions, and are also visible in the overflow.
- "Declined" is a polite status message.
- At AX5, the banner wraps to as many lines as it needs, and the action moves below the sentence, left-aligned and at least 44pt tall.
- The suppressed-banner and fetch annotations sit outside the device frame and are not part of the UI.

COPY:

Banners:
- "Maya Chen invited you to Larkspur Loop" · "Review"
- "You have 2 invitations" · "Review"
- "You have 9 invitations" · "Review"
- Expiring: line 1 "Maya Chen invited you to Larkspur Loop" · "Review"; line 2 "Expires tomorrow · Tue 20 Oct"
- "2 invitations need to be sent again" · "Fix"
- "1 invitation needs to be sent again" · "Fix"
- Degraded: "Someone invited you to Larkspur Loop" · "Review"

Offline:
- FreshnessLine at the top of the page: "You're offline · as of 5:52 PM".
- Caption under the banner: "You're offline. Review opens when you're back." For the sender: "You're offline. Fix opens when you're back."

List:
- Heading: "Invitations waiting for you"
- "Maya Chen · Larkspur Loop, Vancouver" · "Member · expires in 7 days · Mon 26 Oct" · "Review"
- "Rosa Delgado · Fircrest Dr, Camas" · "Guest · expires in 3 days · Thu 22 Oct" · "Review"
- Stopped working: "Dana · a home in Camas" · "Stopped working when this home changed who can invite. We've told Dana."
- Expired: chip "Expired Sun 18 Oct" · "Ask Dana to send a new one"
- Cancelled: "Dana cancelled this invitation · Ask Dana if you still need one"
- Used: "Already used · Ask Dana for a new one"
- Overflow on live rows: "Not now" · "Decline". On dead rows: "Remove".
- "Declined · Maya Chen will see this · Undo" · "Removed · Undo"
- List error: "We couldn't load your invitations. · Retry"
- List offline, under each Review: "You're offline. Review opens when you're back."

Push (proposed PushCopy variant):
- Title: "Maya Chen invited you" (21 characters).
- Body: "Larkspur Loop · expires Mon 26 Oct" (34 characters).
- Hidden-preview placeholder: "Household invitation".
- Android public version: "Pantopus · Household invitation".

Notification rows:
- Recipient: "Maya Chen invited you to Larkspur Loop" · "Today · 5:10 PM".
- Sender: "2 invitations need to be sent again" · "Today · 9:00 AM". There is no home label, because Maya has one home.

EDGE CASES:
- The long name wraps and is never truncated.
- Nine invitations still show one count line: "You have 9 invitations".
- No invitations: the next banner by precedence shows, or none.
- Fetch failure: no invite banner and no error banner. The next banner by precedence shows, and nothing shifts.
- A late fetch: the banner enters once and content moves down once. It is never deferred to the next load.
- A push or Review that reaches a list that fails to load shows the list's InlineErrorRow. The rest of Your places stays usable.
- Offline: the cached banner stays visible, and Review is disabled with its reason.
- A sender who can no longer invite never sees Fix. Members shows them who can.
- Priya has a saved place, so the setup banner would qualify, but it stays suppressed while an invitation is waiting.
- Only dead invitations: no banner; the section alone explains each one.

INSTEAD OF:
- Instead of two or three stacked banners, draw one banner, with the greyed suppressed ones outside the frame — because pile-up hides the one that matters.
- Instead of an "Invitations" card on My Homes, draw the banner on the Place landing plus the list on Your places — because a new invitee has no home and never opens My Homes.
- Instead of a "Couldn't load invitations" banner on the landing, draw the next banner by precedence and keep the layout still — because a broken banner on the landing page reads as a broken app.
- Instead of a new card style, draw the mailbox pill's geometry — so the banner reads as arrival context.
- Instead of red or amber text for expiry, draw "Expires tomorrow · Tue 20 Oct" in text.primary as a second line with a warning glyph — because warning hues fail contrast as text.
- Instead of a "Remove" that silently hides a live invitation, draw "Not now" and "Decline" — because declining should be cheap and final, and the sender should learn the outcome.
- Instead of "Review" or "Fix" opening a list for a single item, draw it opening that item directly — because one invitation needs no list.
- Instead of a banner and a section both showing the same invitation on Your places, draw only one of them — so there is one primary action on screen.

DONE WHEN:
- A person with no home sees their invitation the first time they open Place, without opening any homes list, even when the invitations call returns late.
- Two or more invitations lead to a lasting list, on every platform, showing inviter, home, city, role and expiry.
- Every dead invitation states why and who can fix it.
- A sender learns that invitations died, and can reach each fix in one tap per row.
- Only one banner ever renders, and it never repeats the section on the same screen.
- A failed fetch leaves no trace on the landing.
- Every frame reads correctly in greyscale.

ARTBOARDS:
1. f3-invite-banner · ios · 01-densest-one-invite · light — Priya's Your places with the invitation banner and no section. The suppressed setup and verify banners are greyed outside the frame.
2. f3-invite-banner · ios · 02-count · light — Sam's place file with "You have 2 invitations".
3. f3-invite-banner · ios · 03-invitations-list · light — Priya's Your places, section only: Maya's and Rosa's rows, Dana's stopped-working row, and the overflow open on a live row (Not now, Decline). Annotated outside the frame: "count banner not drawn here: the section is on screen".
4. f3-invite-banner · ios · 04-expiring · light — the two-line expiring banner, "Expires tomorrow · Tue 20 Oct", with the warning glyph.
5. f3-invite-banner · ios · 05-sender-reissue · light — Maya's place file with "2 invitations need to be sent again · Fix".
6. f3-invite-banner · ios · 06-hidden · light — no invitations: the slot shows the next banner by precedence, the mailbox pill.
7. f3-invite-banner · ios · 07-late-arrival · light — two stacked frames: before (mailbox pill in the slot) and after (the invitation banner has replaced it). Annotated: "content moved down once, 300 ms or less; Reduce Motion: no animation".
8. f3-invite-banner · ios · 08-fetch-failed · light — identical to frame 6, annotated outside the frame: "invitations fetch failed: no invite banner, nothing shifts".
9. f3-invite-banner · ios · 09-offline · light — FreshnessLine at the top, the cached banner with Review disabled, and the offline caption.
10. f3-invite-banner · ios · 10-degraded-name · light — "Someone invited you to Larkspur Loop".
11. f3-invite-banner · ios · 11-push · light — the lock-screen push, plus the hidden-preview version.
12. f3-invite-banner · ios · 12-list-dead-rows · light — the expired (chip), cancelled and used rows, and Maya's row collapsed to the Declined InlineUndo.
13. f3-invite-banner · ios · 13-list-loading-error-offline · light — three stacked crops of the section: skeleton rows; "We couldn't load your invitations. · Retry" (reached from a push); and offline rows with Review disabled and the reason.
14. f3-invite-banner · ios · 14-notification-rows · light — the recipient invitation row and the sender reissue row, both with "Today" dates.
15. f3-invite-banner · web-1440 · 01-densest-one-invite · light — the web version of frame 1, with the sidebar.
16. f3-invite-banner · web-1440 · 02-count · light — the web version of frame 2, on the place file.
17. f3-invite-banner · web-1440 · 05-sender-reissue · light — the web version of frame 5.
18. f3-invite-banner · web-1440 · 03-invitations-list · light — the web version of frame 3.
19. f3-invite-banner · web-390 · 01-densest-one-invite · light — frame 1 at 390, with "Alexandria Montgomery-Ramirez" and a long home label wrapped to two lines.
20. f3-invite-banner · web-390 · 02-count · light — frame 2 at 390.
21. f3-invite-banner · android · 01-densest-one-invite · light — the Material 3 version of frame 1.
22. f3-invite-banner · android · 02-count · light — the Material 3 version of frame 2, with a second device showing "You have 9 invitations".
23. f3-invite-banner · android · 03-invitations-list · light — the Material 3 version of frame 3.
24. f3-invite-banner · ios · 15-ax5 · light — frame 1 at AX5, with the action below the sentence, left-aligned.
25. f3-invite-banner · ios · 16-greyscale · light — frame 4 in greyscale.
26. f3-invite-banner · ios · 01-densest-one-invite · dark — the dark twin of frame 1.
27. f3-invite-banner · ios · 03-invitations-list · dark — the dark twin of frame 3.
28. f3-invite-banner · ios · 99-Notes · light — the Notes artboard. Include:
  - Invented strings: Priya Raman, Rosa Delgado, Fircrest Dr, Alexandria Montgomery-Ramirez, the dead-row variants and their captions, the list error and offline strings, and the 9:00 AM time.
  - The fixture delta for Sam Ortega as a count-banner recipient.
  - The full precedence ladder lives on the Foundations board.
  - The fetch rules: a late arrival moves content once; failed or empty moves nothing.
  - The rule that the banner and the section never repeat each other, and the count rules.
  - Not now vs Decline behaviour, and the held decline.
  - Fix on a single dead invitation opens the composer's reissue review directly.
  - Proposed Foundations additions: the InviteRow received variant; a PushCopy invitation variant ("Maya Chen invited you" / "Larkspur Loop · expires Mon 26 Oct" / placeholder "Household invitation" / Android "Pantopus · Household invitation").
  - The sender banner is LandingBannerSlot's sender-reissue variant. The InviteRow board's crop of this surface should be corrected.
  - BLOCKING question A1: "With an invitation waiting, does a cold start open Place or Today? If Today, only the push and the notification row carry the invitation."
  - Omitted states.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-24, then wait for "continue". Turn 5: 25-28.
