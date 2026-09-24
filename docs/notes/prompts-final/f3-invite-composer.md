# Invite someone to your household
id: f3-invite-composer · platforms: web/ios/android · isNew: False · artboards: 22

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Invite someone to your household · f3-invite-composer

TYPE: EXTENSION of the existing designed screen "Invite a co-resident" (the household invitation composer). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
- Web already has all three channels. On web, change these: the role captions and the Guest passes link; the review manifest with its grant list; the reissue review; the single-use link limit and its warning; the equal-height channel slot; "Still sending…"; and the sent panel's link caption.
- iOS sends by email only today. It gains Username and "Share instead" (link and QR), plus everything listed for web.
- Android has Email and Username. It gains the QR code, plus everything listed for web.

ATTACH:
- The current composer on web 1440 (modal), iOS (sheet) and Android (bottom sheet).
- The Members screen behind it on iOS.
- Exports of the Foundations boards 00a–00d.

PLATFORMS & VIEWPORTS:
- iOS 393x852: a sheet with medium and large detents (primary).
- Android 412x915: a modal bottom sheet.
- Web 1440x900: the existing invite modal, 560 wide.
- Web 390x844: a bottom sheet.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → place file for Larkspur Loop → People → Members → Invite.

These open the form with Email selected:
- Members "Invite".
- The Members empty state's "Invite someone".
- The household block's "Invite by email".
- The place file's People row "Add the people you live with".
- The home dashboard Members card's Invite action. This replaces the web dashboard's invite FAB, because the house style allows no FAB.

The household block's "Share a link" opens the form with "Share instead" selected and its warning already showing.

These open directly on the reissue review, not on the form:
- A pending row's Reissue in Members.
- The sender banner's Fix, when only one invitation needs to be sent again.
- The home dashboard's invite entry after the invite-rules change, when an invitation needs reissue.

The web recovery page /app/homes/{id}/invitations also opens this sheet.

Members' "Guest passes" does not open this sheet. It opens the pass screen. The household Guest role is chosen here, with the Guest chip.

What this surface hands on:
- After a send, Members shows a pending row with "Expires in 7 days · Mon 26 Oct" and Resend.
- After a reissue, the Members row states that the old link no longer works.
- The invitee's decision screen shows the same grant list the sender reviewed here.

WHO AND WHEN: Mon 19 Oct, 5:10 PM. Maya Chen is at 2418 NE Larkspur Loop. Priya is moving into the spare room next week. Maya has Priya's email but not her Pantopus username, and she wants Priya to see the pickup day and the bills before she arrives.

THE ONE JOB: Send one household invitation, by whichever channel you have for that person, knowing exactly what they will be able to see.

FIRST FIVE SECONDS: The eye should land on these, in order:
1. The channel chips, with Email selected, and the one recipient field.
2. The role chips, with the capability caption under the selected role.
3. The single primary button, "Review invitation", pinned at the foot of the sheet.

CONTENT: Use the FIXTURES (HOME A; the pending invite to priya@example.com, which expires Mon 26 Oct). The deltas below are for this surface only; list each one on Notes.
- Username field: "@priyar", which resolves to the person row "Priya Raman · @priyar". Not-found example: "@priyra".
- Guest window: "Until Sun 1 Nov 2026".
- Optional note: "You'll see our pickup day and the household calendar. I already added the lease end and the Clark Public Utilities bill."
- Link: pantopus.com/j/7K4M-QD2X.
- Reissue rows: theo.park@example.com and @rgarcia.
- Worst case, drawn in the web-1440 review frame: the 38-character email margaret.oconnor-whitfield@example.com, with the note above at full length.

LAYOUT & VISUALIZATION:

Form, top to bottom:
1. The sheet title, and a ScopeChip "Your household".
2. The channel group: three standard ChoiceChip channel options, "Email", "Username" and "Share instead", all drawn in the same outlined style. Email is selected by default, with its fill and check.
3. ONE recipient slot.
4. Role ChoiceChips, "Member" and "Guest", with the GrantLimitList role caption under them for the selected role.
5. For Guest only, the access row "Until Sun 1 Nov 2026" with a date control.
6. "Add a note (optional)".
7. The sticky primary button, with scroll padding reserved beneath it.

Form rules:
- The form's button is always "Review invitation".
- Switching channel swaps only the recipient slot. Draw the Email, Username and Share instead states at the same total height, with the slot in the same position, so the role chips and the button never move under the thumb.
- Share instead asks for no recipient. The slot holds the exposure warning instead: a full body-size sentence with an info glyph, not a caption. It appears the moment Share instead is chosen, before any review.
- While a username is being looked up, the slot shows the text line "Looking up @priyar…" with no spinner.

Review step: a plain manifest of label/value rows, with no illustration and no celebration.
- Home — 2418 NE Larkspur Loop, Vancouver, WA
- To — priya@example.com. On the link path: "Link — Works once".
- Role offered — Member. Under it, the GrantLimitList role-offered form with its 3 grants. Below the grants, the verify-unlock form: the heading "What needs address verification", two lock rows, and a 44pt "Show 3 more" row that expands the remaining three.
- Access — Starts when accepted · no end date. For Guest: "Until Sun 1 Nov 2026".
- Expires — in 7 days · Mon 26 Oct
- Note — the note text.
- Closing line: "Household access only. This invitation does not grant ownership."
- The review's button is "Send invitation" for Email and Username, and "Create link" for Share instead.

Reissue review:
- The same manifest for theo.park@example.com: To; Role offered with the GrantLimitList; "Expires in 7 days · Mon 26 Oct".
- Above the manifest: "This invitation stopped working when your household's invite rules changed. Members can now see the calendar and bills. Send it again?"
- Primary button: "Reissue".

Sent panel:
- The status line.
- The link in a copyable field.
- A caption under the link naming who it is for.
- A QR block sized to scan across a table, at least 160pt. The QR sits inside the panel and is never the hero.
- "Copy link" and "Share" as a TextActionRow, using the system share sheet only.
- The expiry.
- "Done".

The reissued result and the link-ready panel reuse the sent panel's layout.

The composer has no chart. The active link row itself lives only in Members, not in this sheet.

INTERACTION, MOTION & HAPTICS:
- The review step replaces the form inside the same sheet, with a Back control. It never stacks a second sheet. The review is the confirmation, so there is no separate confirm dialog.
- The email field uses email autocomplete. Paste works everywhere.
- Validation runs when "Review invitation" is tapped and when the person leaves the field, never on every keystroke. The typed value is always kept.
- The username is looked up after typing pauses ("Looking up @priyar…"), and the slot then shows the person row. If nothing is found, an inline error appears under the slot.
- The Guest date opens the platform date picker, with a typed alternative.
- The "Guest passes" link in the Guest caption saves what is typed as a draft, then opens the pass screen.
- Sending locks the form and shows "Sending…" on the button. The sent state appears only after the server confirms.
- "Link copied" is a status message.
- Reissue re-sends on the same channel. The old link stops working, and the result states this, shows the new link and gives the new expiry.
- Offline: the channel and role chips stay enabled, so the form stays editable. Only the send button is disabled, with its reason. This overrides the ChoiceChip board's disabled cell (Notes).
- Motion:
  - The slot cross-fades on a channel change (200ms).
  - The review slides in from the trailing edge (300ms).
  - Under Reduce Motion, both are cross-fades.
- Haptics: one light tick when the send is confirmed, and nothing else.
- Close (on the form and the review) or Done (on the sent panel) is always visible.
- Android Back and web Escape step back from the review, then close the sheet.

FOUNDATIONS COMPONENTS USED:
- ChoiceChip: the channel variant with three options; the role variant. Selected = fill + check, and looks different from focus.
- GrantLimitList: the role caption under the chips (V5 for Member; V5g, corrected, for Guest); the role-offered expansion (V2), followed by the verify-unlock form (V4) with "Show 3 more".
- ScopeChip.
- InviteRow: the reissue row this sheet is opened from. It is not drawn in this sheet.
- LockedActionRow: the variant that names who can act, for a member.
- TextActionRow: Copy link / Share, and the copied state.
- InlineErrorRow: send failed, with the values kept.
- OfflineNotice.

ACCESSIBILITY:
- Reading order: title, scope, channel, recipient, role and its caption, note, then the primary button.
- The three channel chips read as one radio group, with the selected state spoken. The role chips work the same way. The role caption is read after the chips, as a list named "What members can do" or "What guests can do".
- The exposure warning is announced when Share instead is selected.
- The QR has the spoken label "QR code for the invitation link. The link is also below as text."
- These are polite live regions: "Looking up", "Sending", "Invitation sent", "Reissued", "Link copied" and "You're offline".
- Each error is tied to its field, and focus moves to the first error.
- All chips and text actions are 44pt / 48dp / 44px.
- At AX5, the chips become radio rows, manifest labels sit above their values, and the sheet scrolls.
- Focus is never hidden under the sticky button.

COPY:

Form:
- Title "Invite someone to Larkspur Loop".
- Channels: "Email" · "Username" · "Share instead".
- Field labels: "Email address" · "Pantopus username".
- Lookup: "Looking up @priyar…"
- Member caption: "Sees and edits the calendar · Sees bills and who paid · Sees who lives here".
- Guest caption: "Same as Member until Sun 1 Nov · in 13 days", then the line "Need a pass for a visitor or service? Use Guest passes in Share".

Link warnings:
- Single-use link: "The first person who opens this link can join your household until it expires. Send it to one person."
- Approval backend: "Anyone with this link can ask to join. You approve each person in Members."

Buttons: "Review invitation" (form) · "Send invitation" / "Create link" (review) · "Reissue" (reissue review) · "Back" · "Close" (form and review) · "Done" (sent panels).

Sent:
- "Invitation sent to priya@example.com"
- Link caption: "This link is for priya@example.com. Share it only with Priya."
- "Copy link" · "Share" · "Link copied" · "Expires in 7 days · Mon 26 Oct" · "Done"
- Sent by username: "Invitation sent to Priya Raman (@priyar)"

Link ready: "Link ready · Works once" · "Expires in 7 days · Mon 26 Oct" · "You can turn it off in Members."

Errors:
- Username not found: "We can't find @priyra. Check the spelling, or send by email instead."
- Email: "This email address looks incomplete. Check it and try again."
- Already a member: "Priya Raman already lives here."
- Already invited: "You invited this address on Mon 19 Oct. Resend it from Members."
- Send failed: "We couldn't send the invitation. Your details are still here. · Try again"
- Slow send: "Still sending…"

Reissue:
- Reissue line: "This invitation stopped working when your household's invite rules changed. Members can now see the calendar and bills. Send it again?"
- Reissued: "Sent again to theo.park@example.com. The old link no longer works. Expires in 7 days · Mon 26 Oct."
- Link caption: "This link is for theo.park@example.com. Share it only with Theo."

Permission denied: title "Only owners and admins can invite people" · "Maya Chen can invite people here." · "Close".

Offline: "You're offline. You can finish this, but sending needs a connection."

EDGE CASES:
- The long email wraps inside the field and in the manifest.
- The full-length note wraps, and the manifest shows it in full.
- @priyar is already a member: show the inline "Priya Raman already lives here."
- priya@example.com already has a pending invitation: show the inline "You invited this address on Mon 19 Oct. Resend it from Members."
- On a slow network, "Sending…" stays on the button, with no full-screen spinner. After 10s, add "Still sending…".
- A member without invite rights (Sam) who opens a stale link gets the permission-denied frame and no form.
- Link channel: if the backend cannot make links single-use, the manifest line becomes "Whoever joins with this link waits for your OK. They see nothing of the household until you approve." The approval warning is used, and Notes records the dependency.
- Offline: the form stays editable, and only sending is disabled, with its reason.
- Contacts are never imported, there is no bulk invite, and the sender cannot schedule reminder sends.
- The sent panel has no Resend. Resending lives on the Members pending row (say so on Notes).

INSTEAD OF:
- Instead of warning about link exposure in the sent panel, draw the warning in the recipient slot the moment Share instead is chosen — because the decision happens there.
- Instead of a form that grows or reflows per channel, draw three states of equal height — because the button must stay under the thumb.
- Instead of making the QR or link the default, draw Email as the default — because the link is the channel that widens exposure.
- Instead of "Role offered — Member" alone, draw the grant list under it — because the sender is approving what someone else will see of the household's calendar and bills.
- Instead of a bare "Send it again?" for a dead invitation, draw the full review manifest under the reissue line — because the member role now grants more than when the invitation was first sent.
- Instead of a success tick while the request is in flight, draw "Sending…", and show the sent state only after the server confirms.
- Instead of a "Contacts" import or an "Invite 5 people" option, draw one recipient — because each invitation is a separate trust decision.
- Instead of a bare link and QR after an email send, draw the caption naming who the link is for — because a copied link widens exposure just as Share instead does.

DONE WHEN:
- The role explains itself where it is chosen.
- Every manifest, including the reissue manifest, shows the same grant list the invitee reads, and always shows the expiry.
- Every active link shows its expiry.
- iOS has all three channels, and Android has the QR code.
- Switching channels moves nothing below the slot.
- A reissue states that the old link stopped working, and shows the new link and the new expiry.
- Every frame reads correctly in greyscale and at AX5.

ARTBOARDS:
1. f3-invite-composer · ios · 01-email-form · light — Email, priya@example.com, Member with its caption, and the note.
2. f3-invite-composer · ios · 02-share-instead · light — Share instead selected (same chip style as the others), the single-use warning in the slot, and the same height as frame 1.
3. f3-invite-composer · ios · 03-username-guest · light — @priyar resolved, and Guest with the until-row and the Guest passes link. Beside the frame, a slot crop showing "Looking up @priyar…".
4. f3-invite-composer · ios · 04-username-error · light — "We can't find @priyra", with the value kept.
5. f3-invite-composer · ios · 05-review · light — the full manifest: To, the grant list, the verification heading with two lock rows and "Show 3 more", and "Send invitation".
6. f3-invite-composer · ios · 06-sending · light — the form locked, with "Sending…".
7. f3-invite-composer · ios · 07-sent-panel · light — the sent status, the link, the caption naming who it is for, the QR, Copy link, Share, the expiry and Done.
8. f3-invite-composer · ios · 08-link-ready · light — "Link ready · Works once", "Expires in 7 days · Mon 26 Oct", the QR, and the turn-off hint.
9. f3-invite-composer · ios · 09-needs-reissue · light — the review manifest for theo.park@example.com under the reissue line, with the primary button "Reissue".
10. f3-invite-composer · ios · 10-reissued · light — the sent-panel layout: sent again, the old link stopped, the new link with its caption, Copy link / Share, the new expiry, and Done.
11. f3-invite-composer · ios · 11-permission-denied · light — Sam's view: the title, who can invite, and Close.
12. f3-invite-composer · ios · 12-send-error · light — the error row, with all input kept.
13. f3-invite-composer · ios · 13-offline · light — the form editable with the chips enabled, and send disabled with the reason.
14. f3-invite-composer · android · 01-email-form · light — the bottom sheet version.
15. f3-invite-composer · android · 08-link-ready · light — the new Android QR panel, with the expiry.
16. f3-invite-composer · web-1440 · 05-review · light — the review in the 560 modal, with margaret.oconnor-whitfield@example.com and the full note.
17. f3-invite-composer · web-390 · 14-email-error · light — "This email address looks incomplete…"
18. f3-invite-composer · ios · 15-ax5 · light — frame 1 at AX5, with the chips as radio rows.
19. f3-invite-composer · ios · 16-greyscale · light — frame 2 in greyscale.
20. f3-invite-composer · ios · 01-email-form · dark — the dark twin of frame 1.
21. f3-invite-composer · ios · 07-sent-panel · dark — the dark twin of frame 7, with the QR keeping its contrast.
22. f3-invite-composer · ios · 99-Notes · light — the Notes artboard. Include:
  - Invented strings: all the deltas above; the two link captions; "Invitation sent to Priya Raman (@priyar)"; "Looking up @priyar…"; "Still sending…"; the two already-member and already-invited errors.
  - The single-use vs approval dependency, and both warning strings.
  - Resend lives only on the Members row.
  - Members' Guest passes opens the pass screen, not this sheet. Product question: is a household Guest different from a Share guest pass?
  - The shared member grant string leaves out tasks and the pickup day, which members already have. This is a product question for the shared string, not edited here.
  - The member caption uses GrantLimitList V5's middot format. The ChoiceChip board's comma version should follow it.
  - The Guest caption "Same as Member until Sun 1 Nov · in 13 days" is a correction to GrantLimitList V5g, per the research.
  - The review extends GrantLimitList V2 with V4's verification heading and "Show 3 more". This is a proposed extension.
  - Offline keeps the chips enabled, overriding the ChoiceChip board's disabled cell.
  - Foundations crops that show "Send invite", or an InviteRow under the link choice, are superseded here: the form button is "Review invitation", and the active link row lives in Members.
  - "Members" is used as the screen name in three strings. This conflicts with the glossary, so confirm the screen title.
  - Omitted states.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-22.
