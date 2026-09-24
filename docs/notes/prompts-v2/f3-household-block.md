# Who lives here with you (household block)
id: f3-household-block · platforms: web/ios/android · isNew: False · artboards: 23

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Who lives here with you (household block) · f3-household-block

TYPE: EXTENSION of the existing designed screens "Your place file" (its People section) and "Home dashboard". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. You add one card. It is the same card in both hosts, and one dismissal covers both.

ATTACH: (1) Your place file, People section, on iOS and web-1440, with the "Verify this address to send neighbor messages" banner visible above People. (2) Your place file, T1 frame for PLACE B. (3) Home dashboard, web-1440, owner view. (4) The Foundations board rows for FactRow, MemberRow, InviteRow, NotificationAsk, PushCopy and InlineUndo.

PLATFORMS & VIEWPORTS: iOS 393x852 · Android 412x915, plus one frame with the card in a 320dp-wide column · web 390x844 and 1440x900.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → Your place file → People section. Both native apps open on Place, and there is no Home tab. A card that lived only on the Home dashboard would reach only a minority of new residents, so the place file is the main host. The place file header above the card already names the home ("2418 NE Larkspur Loop"), so the card does not repeat it.
Ways in:
- (a) Scrolling the place file. No navigation is needed.
- (b) The mirror on the Home dashboard: Place → Larkspur Loop → Home dashboard (web /app/homes/:id/dashboard).
- (c) The Members roster's empty state "Just you at Larkspur Loop · Invite someone", which offers the ask again.
- (d) Today's first-week row "Next: add the people you live with →". It opens Place, scrolls once to this card, fades a one-time highlight and moves focus to the title. With Reduce Motion, it jumps to the card and the highlight is static.
There is no push and no deep link of its own, and the card never opens by itself.
When the card shows: the full card shows only to someone who can invite people, and only while exactly one person is active in the home. It never shows after a second person joins, or after "Just me". The viewer's own 7-day window (counted from the viewer's own start date, never the owner's move-in date) only decides whether a member who cannot invite sees the read-only line (frame 08).
Hand-offs (flow 04, step 1 → 2):
- "Invite by email" opens the invite composer on Email (a web modal, the iOS wizard, the Android bottom sheet). Email is offered first.
- "Share a link" opens the same composer on Link. The composer's existing link warning appears before any link exists.
- The composer returns here in the sent state (frame 06) or the link state (frame 07).

WHO AND WHEN:
- Fixture delta for this surface: Maya's address was not yet verified on Mon 5 Oct. She confirmed it by postcard before TODAY. So frames 01–07 and 16–18 (Mon 5 and Tue 6 Oct) show the verify banner above People (on the dashboard, frame 17, at the top of the dashboard above the card). Frames 08 and 09 show no verify banner.
- Frames 01–03, 06, 07 and 16–18: Maya Chen, owner of HOME A, on the couch scrolling the Place tab, Mon 5 Oct 2026, 6:10 PM. She joined HOME A on Thu 1 Oct. Nobody else has joined or been invited.
- Frames 04–05: the same place file on Maya's next visit, Tue 6 Oct.
- Frame 08: Sam Ortega on Tue 13 Oct, three days after he joined on Sat 10 Oct through Maya's invitation.
- Frame 09: Maya on TODAY (Mon 19 Oct). Sam has joined, and Priya's invitation is pending.
- Frame 10: Jordan Lee at PLACE B on TODAY.

THE ONE JOB: Ask a new resident once who else lives here, and make inviting them take two taps on the screen they actually see.

FIRST FIVE SECONDS: First the title "Who lives here with you?". Second, the sentence saying what gets shared and what never does. Third, the filled "Invite by email" button, which is the single primary action. The verify banner above stays the loudest element on the screen.

CONTENT (exact strings):
- Title: "Who lives here with you?"
- Body, one paragraph: "Add the people you live with. They see the same pickup day, calendar and bills. Nothing about your home is shared with anyone else."
- Primary: "Invite by email". Secondary: "Share a link". Declines: "Just me" and "Not now".
- Host banner above (draw it unchanged where the frame date shows it): "Verify this address to send neighbor messages".
- Deltas this surface adds (list each on Notes): the invitee sam.ortega@example.com; Sam's invitation sent Mon 5 Oct and expiring Mon 19 Oct (invitations last 14 days); Priya's invitation sent Mon 12 Oct (the fixture gives its expiry, Mon 26 Oct); the frame dates Mon 5 Oct, Tue 6 Oct and Tue 13 Oct; the join dates Thu 1 Oct (Maya) and Sat 10 Oct (Sam); Maya's postcard confirmation before TODAY.
- Worst case: the card in a 320dp column, with the full body wrapping to five lines and the place file header "2418 NE Larkspur Loop" visible above it.

LAYOUT & VISUALIZATION: Draw a two-button block, not a hero.
- Use one card on surface.raised with radius lg and shadow sm. In dark mode, give it a visible card edge.
- Give it no accent fill, no illustration and no avatar placeholders, because nobody exists to draw yet.
- Stack the content in this order: the title (h3); the body (bodySmall, text.secondary, wrapping and never cut off); the two buttons, "Invite by email" (filled, primary.700) and "Share a link" (outlined).
- Button arrangement: side by side only when the card's content width is 360 or more (the web-1440 dashboard and the web-1440 place file). On iOS 393, Android 412, web-390 and the 320dp column, stack them full width with "Invite by email" on top.
- Last line: "Just me" and "Not now" as two text buttons, left-aligned, 8dp apart. Both use the secondary button's label size and weight in text.strong. They must not look greyed or muted, because declining is a real answer.
- The card must not out-shout the banner above it. The banner keeps its tint and glyph; the card has neither.
- Degraded states: if the member count cannot load, draw no card and put the People section's InlineErrorRow in its place. At T1, draw the FactRow not-at-this-tier variant instead of the card: label "Add the people you live with", value "Claim this address first", both in text.secondary (never text.muted), with no chevron and no action.

INTERACTION, MOTION & HAPTICS:
- "Just me": the card collapses in place to InlineUndo "Just you, then. · Undo". The choice is saved on the server, synced to every device and also hides the dashboard mirror. Undo has no timer and stays until Maya leaves the screen. On her next visit, People shows the MemberRow empty variant "Just you at Larkspur Loop · Invite someone" (frame 04). That is a finished state, with no badge and no "missing" count.
- "Not now": the card collapses to a quiet FactRow missing variant, "Add the people you live with · Add" (frame 05). The card never comes back by itself.
- Email sent state (frame 06): the card becomes an InviteRow: recipient "sam.ortega@example.com", caption "Member · sent Mon 5 Oct · Expires Mon 19 Oct", the inline "Resend" (44pt) and the overflow menu (Cancel, Extend). Below it sits a NotificationAsk card row:
  - Sentence: "Hear when someone joins, marks a bill paid or changes the calendar? These arrive quietly, except a bill you still need to pay soon." This is exactly what the Household activity group sends: joins, leaves, bills marked paid and calendar edits. All arrive quietly with no sound, except a bill marked paid for someone who still sees it as unpaid and due within 3 days.
  - Buttons: "Turn on" and "Not now". This row's "Not now" closes the slot for good and never asks again; the switch stays available in Notifications settings under Household activity. Draw a small caption under the buttons: "You can change this in Notifications settings."
  - A PushCopy tray preview inset, captioned "You'll get:", showing title "Your invite was accepted" (24 characters) and body "Larkspur Loop" (13 characters). Annotate beside it: "When the app knows the person's name, the title reads 'Sam joined your household' (25 characters). The in-app row reads 'Sam joined Larkspur Loop — can see the calendar and bills'. Never show an email address in a notification."
  - "Turn on" is the card row's forward action (the contract's "Yes"). It turns on Household activity and fires the OS prompt directly if notifications have never been asked. There is never a second "Yes". The row then reads "Household updates on · Undo", and the Undo stays until Maya leaves the screen.
- Link state (frame 07): the card becomes the InviteRow link variant, "Invite link · Works once · Turn off link". Annotate beside it: a person who joins by link appears as the awaiting-approval InviteRow "Waiting for your OK · Approve / Remove" and sees no household data until Maya approves.
- Notification denied: on iOS, the ask reads "Notifications are off for Pantopus · Open Settings". On Android, if the prompt was denied once, "Turn on" asks again once. If Android has blocked notifications, the ask reads "Notifications are off for Pantopus · Open Settings".
- Collapse is a height change plus a cross-fade of 200ms or less. With Reduce Motion, it is a cross-fade only.
- Haptics: none on this card. The light confirm tick belongs to the composer's Send.
- Every action is a plain tap. Nothing uses swipe-to-dismiss.

FOUNDATIONS COMPONENTS USED: FactRow (missing; not-at-this-tier; declined) · MemberRow (collapsed roster line; empty) · InlineUndo (declined ask) · InviteRow (pending with Resend; link active; awaiting approval) · NotificationAsk (card row; iOS denied; Android denied once; Android blocked) · PushCopy (tray preview inset, household variant) · LockedActionRow (names who can act) · InlineErrorRow · OfflineNotice · WarmingSkeleton (row skeleton at the card's final height) · ScopeChip (host header only).

ACCESSIBILITY:
- Reading order: People heading, title, body, Invite by email, Share a link, Just me, Not now.
- Rule for this card: every spoken label starts with the visible label.
- Spoken labels: "Invite by email. Invite someone who lives here", "Share a link. Invite someone with a link", "Just me. No one else lives here", "Not now". On the NotificationAsk row: "Turn on. Household updates" and "Not now".
- Polite live-region announcements: "Just you, then. Undo available", "Invitation sent" and "Household updates on".
- Targets: 44pt, 48dp or 44px, with 8dp gaps.
- At AX5, every button is full width and stacked, and the body wraps.
- The primary button stands out by its fill and position, never by hue alone.

COPY: Every string above, plus:
- Offline caption: "You're offline. You can invite people when you're back."
- Error row (in the People section, not the card): "We couldn't load who lives here · Retry".
- Failed save, next visit: "We couldn't save \"Just me\" · Retry".
- Read-only line, with the viewer first as "You": in Sam's view "You and Maya live here · View"; in Maya's view "You and Sam live here · View". For a member who cannot invite, add LockedActionRow "Maya can invite people here".

EDGE CASES:
- A 320dp column: frame 02.
- T1 (PLACE B): no invite appears anywhere (frame 10).
- An invitation is pending and nobody has joined yet: show only the InviteRow, with no card.
- Many residents: "You, Sam, Priya and 2 others live here · View".
- Offline: all four buttons are disabled, keep their reason and stay focusable.
- Slow network: show the skeleton only after 1s.
- Permission variant: a member who cannot manage people sees no invite buttons, even inside their own 7-day window. They see the read-only line instead (frame 08).
- An admin who joins a home that already has two people: no card, only the read-only line.
- Failed save of "Just me": keep "Just you, then. · Undo" and retry quietly, with no toast. The decline is also held on this device, so the card never comes back here. If the save still hasn't gone through on the next visit, show one InlineErrorRow in the card's place: "We couldn't save \"Just me\" · Retry". Never show the full card again.

INSTEAD OF:
- Instead of a full-bleed onboarding hero, modal or coach mark, draw one quiet card in the People section, because asks belong inline, where they get completed.
- Instead of ghost avatars or an illustration, draw text and buttons only, because there is nobody to show yet.
- Instead of a greyed, shrunken "Just me", draw it at full label weight next to "Not now", because living alone is a complete answer.
- Instead of cutting the body to fit, let it wrap, because the privacy sentence is why people agree to invite.
- Instead of a permanent "Just me", draw Undo plus the roster's "Invite someone", because a mis-tap must not be a dead end.
- Instead of re-showing the full card after a failed save, draw one InlineErrorRow, because re-asking someone who declined is nagging.
- Instead of a notification preview with an email address or a promise of "no sound" for everything, draw the 24-character tray preview and the sentence naming what the group sends, because lock screens are public and bill updates can make a sound.
- Instead of giving the dashboard copy its own dismissal, share one dismissal, because two dismissals drift apart.
- Instead of a grey T1 row in text.muted, draw it in text.secondary, because people must be able to read it.

DONE WHEN: Maya sees the ask on Place without navigating. "Invite by email" reaches the composer in one tap. "Just me" is as easy to hit as Invite, can be undone, and ends with no nag. The card appears once per home per person and never after someone joins. Sam never sees invite buttons. A pending invitation is always visible to the owner. The notification ask says truthfully what it turns on, and its preview fits the 30-character title rule with no email address. The privacy sentence survives 320dp intact. Every frame reads in greyscale.

ARTBOARDS:
1. f3-household-block · ios · 01-visible · light — Maya's place file on Mon 5 Oct with the verify banner above and the full card with stacked buttons. Annotate the arrival from Today: scroll once, fading highlight, focus on the title.
2. f3-household-block · android · 02-visible-320-column · light — the card in a 320dp column under the "2418 NE Larkspur Loop" header, with a five-line body and stacked buttons.
3. f3-household-block · ios · 03-just-me-undo · light — "Just you, then. · Undo" in place of the card.
4. f3-household-block · ios · 04-after-just-me · light — the next visit after "Just me": the MemberRow empty variant "Just you at Larkspur Loop · Invite someone".
5. f3-household-block · ios · 05-after-not-now · light — the next visit after "Not now": the FactRow "Add the people you live with · Add".
6. f3-household-block · ios · 06-invite-sent-ask · light — the InviteRow for sam.ortega@example.com with Resend and overflow, plus the NotificationAsk row with its full sentence, "Turn on" / "Not now", the settings caption and the "You'll get:" tray preview "Your invite was accepted" / "Larkspur Loop" with its annotation.
7. f3-household-block · ios · 07-link-active · light — the InviteRow "Invite link · Works once · Turn off link", annotated with the "Waiting for your OK · Approve / Remove" row that follows.
8. f3-household-block · ios · 08-member-read-only · light — Sam on Tue 13 Oct: "You and Maya live here · View" plus LockedActionRow "Maya can invite people here". No verify banner above.
9. f3-household-block · ios · 09-collapsed-roster · light — Maya on TODAY: "You and Sam live here · View" plus the InviteRow "priya@example.com" with the caption "Member · sent Mon 12 Oct · Expires Mon 26 Oct" and Resend (shown to managers only). No ask card and no verify banner.
10. f3-household-block · ios · 10-t1-saved-place · light — Jordan at PLACE B with "Saved place · Only you": the FactRow "Add the people you live with / Claim this address first" in text.secondary, with no chevron and no action.
11. f3-household-block · ios · 11-loading · light — a row skeleton at the card's real height.
12. f3-household-block · android · 12-error · light — no card, and the People section's InlineErrorRow "We couldn't load who lives here · Retry".
13. f3-household-block · android · 13-offline · light — the buttons disabled with the offline caption.
14. f3-household-block · ios · 14-save-failed · light — two phone frames side by side, each labelled: "This visit" (the undo line kept, no toast, annotated quiet retry) and "Next visit" (the InlineErrorRow "We couldn't save \"Just me\" · Retry").
15. f3-household-block · android · 15-notifications-denied · light — two phone frames side by side, each labelled: "Denied once" ("Turn on" asks again) and "Blocked" ("Notifications are off for Pantopus · Open Settings").
16. f3-household-block · web-1440 · 16-place-file · light — Maya on Mon 5 Oct: the verify banner, then the place file People section with the two buttons side by side.
17. f3-household-block · web-1440 · 17-dashboard-mirror · light — Maya on Mon 5 Oct: the same card on the Home dashboard under the verify banner, with no floating button.
18. f3-household-block · web-390 · 18-visible · light — the place file on mobile web on Mon 5 Oct, with the verify banner and stacked buttons.
19. f3-household-block · ios · 19-ax5 · light — frame 01 at AX5.
20. f3-household-block · ios · 20-greyscale · light — frame 01 in greyscale.
21. f3-household-block · ios · 01-visible · dark — the dark twin of frame 01.
22. f3-household-block · ios · 06-invite-sent-ask · dark — the dark twin of frame 06.
23. Notes — list the following:
- Assumptions: invitations last 14 days. Maya's address was unverified on Mon 5 Oct and confirmed by postcard before TODAY, which matches the Foundations board. The "Turn on" button is the NotificationAsk card row's forward action, the contract's "Yes"; it switches on the whole Household activity group. This row's "Not now" is the permanent close, with the setting kept in Notifications settings, so no separate "No thanks" is drawn. The tray preview body uses "Larkspur Loop" as the home label. The full card shows only to someone who can invite, and only while exactly one person is active; the 7-day window only governs the read-only line for members who cannot invite. The read-only line uses the MemberRow collapsed form with the viewer first as "You" ("You and Maya live here · View"), replacing v1's "You and 2 others live here". The card does not name the home because the place file and dashboard headers above it already do. The join dates Thu 1 Oct and Sat 10 Oct take precedence over the Foundations MemberRow specimen dates (Mon 12 Oct / Tue 13 Oct), which are only a specimen. A failed save keeps the collapsed undo line, then shows an InlineErrorRow, instead of keeping the full card; this deliberately changes the v1 rule "keep the card", so that someone who declined is never asked again.
- Every invented string: the frame dates, sam.ortega@example.com, the sent and expiry dates, the postcard confirmation, the NotificationAsk sentence, "You can change this in Notifications settings.", "Turn on. Household updates", the tray preview "Your invite was accepted" / "Larkspur Loop", "Sam joined your household", "Sam joined Larkspur Loop — can see the calendar and bills", "Household updates on", the offline, error and failed-save lines, the read-only lines and the many-residents line.
- Omitted states: none drawn separately for the reissue InviteRow, which belongs to the Members roster.

BATCH PLAN: Turn 1: artboards 1–6, then wait for "continue". Turn 2: 7–12, then wait for "continue". Turn 3: 13–18, then wait for "continue". Turn 4: 19–23.
