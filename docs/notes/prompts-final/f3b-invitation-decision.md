# Invitation decision (what you get now vs what needs verification)
id: f3b-invitation-decision · platforms: web/ios/android · isNew: False · artboards: 26

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Invitation decision · f3b-invitation-decision

TYPE: EXTENSION of the existing designed screen "Invitation decision". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed. The changes:
(1) Replace the ownership paragraph with the design doc's two-sentence lead and a GrantLimitList of two lists, headed "What members can do now" and "What needs address verification".
(2) Show the household as a count before acceptance.
(3) Give the accepted state two next steps, Open Home first. Remove the old "Check current Home access" action; the grant list, which stays on screen, replaces it.
(4) Give each dead-invitation case its own frame with one next step.
(5) Make Decline undoable in place.
(6) Make Accept a filled primary.700 button and Decline an outlined button of equal size.
(7) Add the account-mismatch, waiting-for-approval and already-address-verified frames.
(8) On phones, pin the buttons in a bottom action bar.

ATTACH: the current invitation decision screen, signed in, at web 1440 and web 390; the current signed-out (public) invitation screen at web 390; the current iOS and Android invitation decision screens; the current accepted state on web (it shows "Check current Home access" and "Open Home"); the Foundations board.

PLATFORMS & VIEWPORTS: web 1440x900 (a centred content column up to 720px wide, the two lists side by side) and web 390x844; iOS 393x852 (a full-screen view with Close in the navigation bar); Android 412x915 (a Material 3 top app bar with Up). This screen sits outside the tab bar. On every frame of this surface, draw no tab bar.

WHERE IT LIVES & HOW PEOPLE ARRIVE: this screen has no tab of its own. People reach it in these ways:
- A link of the form pantopus.app/invite/… in the invitation email, a text message, a shared link or a QR code. The token is never shown to people.
- "Review" on the LandingBannerSlot on the Place tab ("Maya Chen invited you to Larkspur Loop · Review").
- Manual code entry on web.
- The new-invitation push, which always opens this invitation and never a dashboard.
The previous step hands over only the token. A signed-out person taps Accept, signs up or signs in on the web without installing the app, and returns here with the token kept. If the account she signed in with matches the invitation, the acceptance she started completes and she sees the accepted state. If it doesn't match, she sees the account-mismatch frame instead. Accept hands off to "Open Home" (the Place tab, showing Larkspur Loop). Today then shows its own one-time notice that it now uses Larkspur Loop; that notice belongs to the Today prompt. "Start address verification" opens the "Verify this address" sheet with the invitation reason.

WHO AND WHEN: Priya Raman is moving into the spare room at HOME A. Maya Chen invited her as a Member an hour ago; the invitation went to priya@example.com and expires Mon 26 Oct. It is Mon 19 Oct, 6:10 PM. Priya has no Pantopus account. She opens the email on her Android phone, in a mobile browser, and has not installed the app. The account-mismatch frame is a separate scenario, described in COPY.

THE ONE JOB: Let someone accept household access knowing exactly what it gives and what it does not, then land them somewhere useful.

FIRST FIVE SECONDS: first, who invited her and to where ("Maya Chen invited you to Larkspur Loop"); second, the "What members can do now" list; third, the "What needs address verification" list. The one primary action is "Accept", visible in the bottom action bar without scrolling.

CONTENT (fixture deltas only):
- Manifest, as four plain lines: Home "2418 NE Larkspur Loop, Vancouver, WA 98684" · From "Maya Chen" · Role "Member" · Access "Starts when you accept · no end date". Then the expiry line "Expires in 7 days · Mon 26 Oct" (plain text; draw no chip for it) and the household line "Maya Chen and 1 other live here" (a count only, never names).
- Lead, exact from the design doc, in two sentences: "This invitation gives you household access. To send neighbor messages or get a residency letter, verify the address yourself." The second sentence sits directly above the "What needs address verification" list as its lead-in.
- Heading "What members can do now" (for a Guest: "What guests can do now"). Rows: "Sees and edits the calendar" · "Sees bills and who paid" · "Sees who lives here". These are exactly the rows Maya reviewed in the invite composer.
- Heading "What needs address verification". Rows: "Message your neighbors" · "Get a residency letter" · "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank". Under that list, the disclosure "See everything that needs it" opens the shared line: "Also: claim residency for a program, get alerts when this home's public records change, send postcard invites, print a fridge card, send letters to neighbors from Mail, join as a Founding Neighbor, and show your address on your profile."
- Footnote, exact: "This invitation does not grant ownership."
- Worst case: a 42-character street line, the inviter "Maria-Fernanda Castellanos-Whitaker", the role Guest with "Access until Sun 1 Nov", and the household line "Maya Chen and 7 others live here".

LAYOUT & VISUALIZATION: from top to bottom: the title "Maya Chen invited you to Larkspur Loop", the manifest, the lead's first sentence, the grant list, the lead's second sentence, the limit list with its disclosure, and the footnote.
Buttons:
- On ios, android and web-390, Accept and Decline sit in a bottom action bar pinned above the home indicator, on surface.base with a border.subtle top hairline. The content above reserves scroll padding equal to the bar's height. On the signed-out frames, the caption and the Sign in link sit inside the bar under Accept. In the accepted state, the bar holds Open Home and then Start address verification with its caption.
- At AX5, the bar unpins and the buttons follow the footnote.
- On web-1440, the buttons follow the lists inline.
- Draw frames 1, 2, 4, 6, 7 and 8 at viewport height with the bar visible.
Lists:
- On web 1440 the two lists sit side by side, with the grant list on the left and the second lead sentence heading the right column. On every phone frame, stack them with the grant list first.
- Both lists use the same 44pt row height and the same type (body, text.primary). Each row has a 16pt glyph: a success-coloured tick for grants, and a lock in text.secondary for limits.
- Both lists sit on surface.base. The limit list gets no tint, no border, no banner and no alert icon. Each list has a heading, so the words carry the meaning, not the glyph.
Accepted state: both lists stay on screen. The caption "Verify your address to unlock these" sits directly under the "What needs address verification" list.
Degradation:
- No expiry: show "No expiry".
- Unknown role: show the default Member lists plus the caption "Standard member access".
- Unknown city: show the street line only.
- Unknown inviter: use the title "Someone invited you to Larkspur Loop".
- Unknown household count: drop the household line and leave no blank.

INTERACTION, MOTION & HAPTICS:
- Accept is a filled button in primary.700. Decline is an outlined button of equal width and height, with no confirm dialog.
- Decline switches to the declined state, which shows an InlineUndo ("Declined · Undo", with a 44pt Undo). It stays until Priya leaves the page, with no countdown. Maya is told only after she leaves.
- While accepting, the Accept button shows an inline spinner, and "Joining…" is announced as a status. Draw no full-page spinner.
- The accepted state cross-fades in within 300ms. Under Reduce Motion it appears with no movement.
- Give one light haptic tick, on the accepted state only.
- The disclosure expands in place.
- The verify sheet never opens by itself.

FOUNDATIONS COMPONENTS USED: GrantLimitList (the invitation decision variant with two lists, plus the accepted state with its caption); MemberRow (the collapsed roster line: a count only before acceptance, names after); ScopeChip ("Your household", beside the home line, in the accepted state only); InlineUndo (the declined-ask variant, "Declined · Undo"); WarmingSkeleton (the row skeleton for the manifest and lists); InlineErrorRow; OfflineNotice; LandingBannerSlot and PushCopy (the entry points, drawn on the Notes artboard only).

ACCESSIBILITY:
- Reading order: title, manifest, lead sentence one, grant heading and rows, lead sentence two, limit heading and rows, disclosure, footnote, Accept, Decline.
- Glyphs are decorative. Each list is a group labelled with its heading, e.g. "What needs address verification, 5 items".
- Both lists are body text.primary on surface.base, well above 4.5:1. The lock glyph is text.secondary.
- Buttons are at least 44pt on iOS, 48dp on Android with 8dp gaps, and 44px on web.
- Status messages ("Joining…", "You're in.", "Declined.") are announced without moving focus. Undo is focusable.
- At AX5 the lists wrap, the bar unpins, the buttons stack full width, and the page scrolls.

COPY:
- Signed-out caption under Accept: "You'll make an account next. You don't need the app." Link: "Already have an account? Sign in".
- Accepted: title "You're in."; household line "Maya Chen, Sam Ortega and you live here"; primary "Open Home"; secondary "Start address verification", with the caption under it "Some ways take about a day. Postcards take 5–10 days."
- Declined: InlineUndo "Declined · Undo", then the sentence "When you leave this page, Maya Chen will see that this invitation was declined." Button: "Back to your place" (signed out: "Look up your address").
- Expired: "This invitation expired Mon 26 Oct. Ask Maya Chen to send a new one." Button: "Back to your place".
- Revoked: "Maya Chen cancelled this invitation. If that's a mistake, ask Maya to send a new one." Button: "Back to your place".
- Already used: "This invitation has already been used. If that wasn't you, tell Maya Chen." Button: "Back to your place".
- Policy changed: "This home changed who can invite people. We've told Maya Chen." Button: "Back to your place".
- Already a member: "You're already part of Larkspur Loop." Button: "Open Home".
- Account mismatch (a separate scenario: Priya already has an account as priya.raman@example.com and is signed in with it): "You're signed in as priya.raman@example.com. This invitation went to priya@example.com." Buttons: "Accept as priya.raman@example.com" and "Switch account".
- Joined by link: "Waiting for Maya's OK. You'll see the household once Maya approves." Button: "Back to your place".
- Already address-verified invitee: the limit list's heading reads "Also yours", with tick glyphs.
- Error: "We couldn't load this invitation. Check your connection, then try again." Button: "Retry".
- Offline: an OfflineNotice line, "You're offline. Your invitation is saved. You can accept when you're back online." Accept and Decline stay visible and dimmed, each with the caption "Needs a connection."

EDGE CASES:
- The longest name and street wrap and never truncate.
- For a Guest, the grant list uses the heading "What guests can do now" and adds the caption "Same as Member until Sun 1 Nov".
- A large household reads "Maya Chen and 7 others live here".
- On a slow network, the skeleton shows only after 1s.
- Several invitations are listed on Your places, not here.
- An invitation opened after it expired (Tue 27 Oct) shows the expired frame.
- A signed-out person who taps Accept and then signs in with a different email sees the account-mismatch frame, and the acceptance does not complete.
- An already address-verified person sees the limit list under "Also yours" with tick glyphs. There is no second lead sentence, no verification caption and no Start address verification button. The ownership footnote stays.

INSTEAD OF:
- Instead of a paragraph about ownership, draw the two-sentence lead, two short lists and the one-line footnote, because people skip the paragraph at the one moment consent matters.
- Instead of product names as rows ("Real Rent"), draw verb rows, because a newcomer cannot tell what the names mean.
- Instead of grey text on a sunken panel for the limits, draw the limit rows exactly like the grant rows (body text.primary on base, with the lock glyph in text.secondary), because these rows must be read (text.muted on sunken is 2.31:1).
- Instead of "Verify this address" as the primary action after accepting, draw "Open Home" as primary and verification as a visible secondary, because people accepted in order to use household tools.
- Instead of listing housemates by name before acceptance, draw "Maya Chen and 1 other live here", because a forwarded link must not reveal who lives there.
- Instead of one generic error for dead invitations, draw expired, revoked, already used and policy changed separately, each with one next step.
- Instead of a quiet text link for Decline, or a Decline that tells Maya instantly, draw an equal-size outlined button whose result shows Undo in place, because declining is a normal answer and a mis-tap must be recoverable.
- Instead of buttons below the fold under two lists, draw them in a pinned bottom bar on phones, because the one primary action must be visible in the first five seconds.

DONE WHEN:
- A first-time reader can say what she can do after joining, and what still needs address verification, without opening anything.
- The grant rows match what Maya reviewed in the invite composer, word for word.
- Nothing is styled as a warning.
- Accept is visible without scrolling on every phone frame.
- Accepting lands on Larkspur Loop, not an empty Place tab.
- The verify sheet opens only on tap.
- A decline can be undone until Priya leaves.
- Every dead invitation names the inviter and gives one next step.
- Signed-out acceptance works on mobile web without the app, and a different account never completes it silently.

ARTBOARDS:
1. f3b-invitation-decision · web-390 · 01-offer-signed-out · light — the dense default at viewport height: Priya on mobile web, the two-sentence lead, both lists stacked, and the bottom bar with Accept, Decline, the sign-up caption and the sign-in link.
2. f3b-invitation-decision · ios · 02-offer · light — signed in, at viewport height, stacked lists, Close in the navigation bar, pinned bar.
3. f3b-invitation-decision · web-1440 · 03-offer · light — the lists side by side in a centred column, with the buttons inline.
4. f3b-invitation-decision · android · 04-offer · light — at viewport height, Material 3 top app bar, stacked lists, pinned bar.
5. f3b-invitation-decision · ios · 05-accepting · light — the inline spinner in Accept and "Joining…".
6. f3b-invitation-decision · ios · 06-accepted · light — at viewport height: "You're in.", the named household, and the caption under the limit list; the bar holds Open Home, then Start address verification with its caption.
7. f3b-invitation-decision · web-390 · 07-accepted-after-sign-up · light — at viewport height: Priya back from sign-up with the token kept, acceptance complete, pinned bar.
8. f3b-invitation-decision · android · 08-accepted · light — at viewport height, the accepted state on Android.
9. f3b-invitation-decision · web-1440 · 09-declined · light — "Declined · Undo", the when-you-leave sentence, Back to your place.
10. f3b-invitation-decision · web-1440 · 10-expired · light — expired Mon 26 Oct, ask Maya.
11. f3b-invitation-decision · web-1440 · 11-revoked · light — Maya cancelled it.
12. f3b-invitation-decision · web-1440 · 12-already-used · light — used by someone else.
13. f3b-invitation-decision · web-1440 · 13-policy-changed · light — "We've told Maya Chen."
14. f3b-invitation-decision · web-1440 · 14-already-a-member · light — Open Home.
15. f3b-invitation-decision · web-390 · 15-account-mismatch · light — two accounts, two choices.
16. f3b-invitation-decision · web-390 · 16-waiting-for-approval · light — joined by link, waiting for Maya's OK.
17. f3b-invitation-decision · web-390 · 17-already-address-verified · light — "Also yours" with ticks, no verification lead, caption or button.
18. f3b-invitation-decision · web-1440 · 18-loading · light — the row skeleton in the final slots.
19. f3b-invitation-decision · web-1440 · 19-error · light — InlineErrorRow with Retry.
20. f3b-invitation-decision · ios · 20-offline · light — the saved offer with the OfflineNotice line and dimmed buttons with reasons.
21. f3b-invitation-decision · ios · 21-offer-ax5 · light — AX5 text, wrapped rows, the bar unpinned, stacked buttons after the footnote.
22. f3b-invitation-decision · web-390 · 22-offer-worst-case-guest · light — Guest role, "Maria-Fernanda Castellanos-Whitaker", the 42-character street, "Access until Sun 1 Nov", "What guests can do now", "Same as Member until Sun 1 Nov", "Maya Chen and 7 others live here".
23. f3b-invitation-decision · web-390 · 23-offer-greyscale · light — frame 1 in greyscale; grants and limits are still distinct by glyph and heading.
24. f3b-invitation-decision · web-390 · 24-offer-signed-out · dark — the dark twin of frame 1.
25. f3b-invitation-decision · ios · 25-accepted · dark — the dark twin of frame 6.
26. f3b-invitation-decision · web-1440 · 26-notes · light — Notes, listing:
- the LandingBannerSlot entry;
- the new-invitation push, drawn with PushCopy: title "Maya invited you to join" (24 characters), body "Larkspur Loop · See what you get" (32 characters), in the Account & security group (invitations to you) at iOS Time Sensitive / Android HIGH, on by default, per the brief's notification model, with the hidden-preview placeholder "Invitation" (if the founder wants a lower level, that is an open product decision, not the spec);
- that "Check current Home access" was removed from the accepted state;
- that the verification caption says "5–10 days" instead of the flow's "about a week", to match the verify sheet's chip;
- that the grant heading reads "What members can do now" instead of the flow's "What you get now", because the contract rows are third person; a second-person variant ("See and edit the calendar") would need a contract change;
- that documents and the household mailbox are also shared with members but are not grant rows yet, and neither are household tasks or the pickup day (if they become rows, add them to the shared string set so the composer shows them too);
- that the "Also:" line is the shared string set used by the verify sheet and the owner confirmation sheet, and never says "tier";
- the assumption "Guest grants equal Member grants", to confirm against the home's role permissions before build (otherwise draw Guest's own grant rows from the shared string set);
- the blocking dependency: Start address verification can only be completed if the owner-confirmation path, or another method a non-owner occupant can use on an already-claimed home, exists; otherwise this button leads to a sheet nobody can finish;
- every invented string: "an hour ago", priya.raman@example.com, Maria-Fernanda Castellanos-Whitaker, the "Also:" line, "What members can do now", "What guests can do now", "Also yours", "Look up your address", "Access until Sun 1 Nov", "Same as Member until Sun 1 Nov", "Standard member access", "Some ways take about a day. Postcards take 5–10 days.", "Declined · Undo", the declined sentence, "Needs a connection.", the push strings, "Invitation", and Tue 27 Oct;
- other assumptions;
- omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-24, then wait for "continue". Turn 5: 25-26.
