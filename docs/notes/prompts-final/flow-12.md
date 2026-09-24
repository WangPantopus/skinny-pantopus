# Dead invitation: sender reissue, recipient accepts
id: flow-12 · platforms: ios/web-390/web-1440 · artboards: 34

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-12 · Dead invitation → sender reissue → recipient accepts

TYPE: NEW (storyboard). Every screen in this journey already has its own designed project. This project lays those screens out as one connected loop between two people: a recipient who hits an invitation that died when the household's invite rules changed, a sender who learns about it and fixes it, and the recipient accepting the fresh invitation. Do not redesign any screen. Where an attached export exists, place it exactly and change only the recast deltas listed for that frame. Where no export exists, redraw the frame faithfully from the description given here, in the house style, and mark it with a small "REDRAWN" tag in its caption. Where this storyboard draws a string that no prompt defines, mark it with a small "PROPOSED" tag. Where a branch needs a fixture that contradicts the main story, label the branch "ALTERNATE SCENARIO".

ARTBOARD NAMING: storyboard projects put "storyboard" in the platform slot of the house-style pattern, so every artboard here is named "flow-12 · storyboard · <NN-state> · light", including the last one, "flow-12 · storyboard · 06-notes · light".

ATTACH (exported artboards, by exact name):
- Foundations board (prompt 00): LandingBannerSlot (one-invite, count, sender-reissue, offline variants), InviteRow (needs-reissue, pending, declined; the expired row is the pending variant with an expired caption, since component-contract.md defines no expired variant), NotificationRow, PushCopy, GrantLimitList, InlineUndo, InlineErrorRow, OfflineNotice rows.
- f3b-invitation-decision · web-1440 · 13-policy-changed · light (F01 reference, B01)
- f3b-invitation-decision · ios · 02-offer · light (F12)
- f3b-invitation-decision · ios · 06-accepted · light (F13)
- f3b-invitation-decision · web-390 · 01-offer-signed-out · light (B10)
- f3b-invitation-decision · web-390 · 07-accepted-after-sign-up · light (B10)
- f3b-invitation-decision · web-390 · 15-account-mismatch · light (B11)
- f3b-invitation-decision · web-1440 · 10-expired · light (reference for B12)
- f3b-invitation-decision · web-1440 · 09-declined · light (B13)
- f3-invite-banner · ios · 03-invitations-list · light (row reference for F02's "Stopped working" dead row; B07, recast)
- f3-invite-banner · ios · 06-hidden · light (reference for F02's mailbox pill)
- f3-invite-banner · ios · 14-notification-rows · light (F03; B08 recovery)
- f3-invite-banner · ios · 05-sender-reissue · light (F04)
- f3-invite-banner · ios · 09-offline · light (reference for B05)
- f3-invite-banner · ios · 11-push · light (F10)
- f3-invite-banner · ios · 01-densest-one-invite · light (F11)
- f3-invite-banner · ios · 08-fetch-failed · light (B02, B08)
- f3-members-roster · ios · 03-pending-states · light (reference for F05, F09, F15, B12, B13)
- f3-members-roster · ios · 02-member-view · light (B03, recast)
- f3-invite-composer · ios · 09-needs-reissue · light (F06, recast)
- f3-invite-composer · ios · 06-sending · light (F07 reference)
- f3-invite-composer · ios · 10-reissued · light (F08, recast)
- f3-invite-composer · ios · 11-permission-denied · light (B03)
- f3-invite-composer · ios · 12-send-error · light (B04)
- f1-today-tab · ios · 14-after-join · light (F14, recast)
No export exists for: the policy-changed decision frame at iOS size (F01), Priya's Your places section holding only her dead row (F02), Members with exactly this household's two dead rows (F05, F09, F15), the reissue send in progress for this recipient (F07), the replaced-old-link frame (B09), and the expired and declined frames at iOS size (B12, B13). Redraw these faithfully from the descriptions below.
Recast rule: the composer's reissue exports use theo.park@example.com. In F06–F08, swap the recipient to priya@example.com and the caption name to Priya, and, in F08, the link, which becomes pantopus.com/j/9R2T-HB6W. Change nothing else. theo.park@example.com stays in this story as the second dead invitation.

PERSONA & SITUATION (fixtures; these replace flows-spec's Tova/Dana/Sierra Dr)
- Maya Chen, owner of HOME A, 2418 NE Larkspur Loop, Vancouver, WA 98684 (label "Larkspur Loop"), on her iPhone (iOS 393x852). Sam Ortega is a member. The household has no admin. Maya confirmed the Tuesday pickup on Sat 3 Oct 2026, so it carries the tick; for Priya the tick's word is "Added by your household" (same fixture delta as flow-04; see flow-04 H6).
- Priya Raman (priya@example.com) is moving into the spare room. She made a Pantopus account on Sun 18 Oct and saved 2418 NE Larkspur Loop as a saved place ("Larkspur Loop · Saved place · Only you"). She has claimed nothing and verified nothing. She uses an iPhone (iOS 393x852).
- History (draw as a small timeline strip on the journey map):
  - Mon 12 Oct: Maya invited priya@example.com and theo.park@example.com by email, with the old 14-day expiry (Mon 26 Oct). These are the only two dead invitations in the main story.
  - Wed 14 Oct: the household's invite rules changed in the permissions migration. Members can now see the calendar and bills. Both pending invitations stopped working (INVITE_POLICY_CHANGED). On Mon 19 Oct neither has reached its expiry; the policy-changed state wins over expiry whenever both would apply.
  - Sun 18 Oct: Priya signs up and saves Larkspur Loop.
- This journey's timeline (print the time on every frame's caption):
  - Mon 19 Oct, 9:00 AM: Priya taps the old link in the Mon 12 Oct email. In the same minute, that first dead-link hit creates the in-app row about dead invitations in Maya's list. There is no push, so Maya first sees it at 6:10 PM.
  - 6:10 PM (TODAY): Maya opens Place and fixes Priya's invitation.
  - 6:14 PM: the reissue sends, and Priya gets the new-invitation push.
  - 6:15 PM: Priya accepts, and Maya's roster updates.
  - 6:16 PM: Priya opens Today.
  - The reissued invitation expires in 7 days, Mon 26 Oct, which matches the fixture.

GOAL: Neither person gets stuck. Maya learns that an invitation died and fixes it in one tap per row. Priya gets a fresh working invitation without hunting for the email, and accepts knowing what she gets.

§5 METRIC: Activation (co-resident added within 7 days). §5 computes activation per user by query within 7 days of t1_account_created: a SavedPlace or Home, plus briefing or widget on, plus one household fact, one of which is a second active occupant. Priya's account was created Sun 18 Oct, so her window runs to Sun 25 Oct. Joining on Mon 19 Oct gives her the Home and the household fact (Maya and Sam are active occupants, and the household's pickup rule applies). She still needs the briefing or the widget, and no frame here shows her turning either on (see H13 and the Notes activation gap). Maya's window closed Thu 8 Oct, so the reissue moves Priya's activation, not Maya's. Every day an invitation sits dead eats into the recipient's 7-day window. That is why the sender's fix must be one tap. session_open triggers: F01 is 'email' (requires the email link to carry src=email; see flow-04 H3). F04 is 'organic'. F10→F12 is 'push'. F11 is 'organic'. No event records a dead-invitation hit or a reissue (see Notes).

THE HAPPY PATH
Each step gives the platform, surface id and state, what the person does, what the screen shows, what is carried to the next step, and the moment of truth (MoT), which is drawn as a callout in the margin lane.

F01 · Priya · iOS · f3b-invitation-decision · policy changed (REDRAWN at iOS from web-1440 · 13-policy-changed) · Mon 19 Oct, 9:00 AM
- Does: taps "Review" in Maya's Mon 12 Oct email while signed in on her phone. The link opens the app.
- Shows: full-screen view, Close in the navigation bar, no tab bar. "This home changed who can invite people. We've told Maya Chen." One button: "Back to your place". No manifest and no lists.
- Carries: the dead-invitation signal to Maya (her row is created this minute), and Priya back to her Place landing.
- MoT: "She is not asked to chase someone who can see nothing wrong. We already told Maya."

F02 · Priya · iOS · f3-invite-banner · Your places, section only, dead row (REDRAWN; row from 03-invitations-list, pill from 06-hidden) · 9:00 AM
- Does: lands on Your places.
- Shows: title, then the banner slot holding the mailbox pill exactly as f3-invite-banner · ios · 06-hidden draws it (there is no invitation banner, because only a dead invitation exists, so the slot shows the next banner by precedence). Then the section "Invitations waiting for you" with one dead row, drawn from the "Stopped working" row in f3-invite-banner · ios · 03-invitations-list and recast from Dana: "Maya Chen · Larkspur Loop, Vancouver" · "Stopped working when this home changed who can invite. We've told Maya Chen." There is no Review, and the overflow holds "Remove". Below it sits her saved place "Larkspur Loop · Saved place · Only you".
- Carries: nothing yet. The row is her lasting record while she waits.
- MoT: "The dead invitation stays explained where she lands, with who is fixing it."

[TIME GAP · "Same minute · Mon 19 Oct, 9:00 AM · the row is created in Maya's list" · the lane switches to Maya]

F03 · Maya · iOS · f3-invite-banner · 14-notification-rows (sender row) · row created Mon 19 Oct, 9:00 AM · first seen 6:10 PM (no push; see H2)
- Shows: the NotificationRow "2 invitations need to be sent again" / "Today · 9:00 AM", with no home label because Maya has one home. No push is drawn (no sender push copy exists; see H2). Draw this frame as an inset beside F04, joined by a dotted line labelled "seen when she opens the app, 6:10 PM".
- MoT: "The sender has a record even before she opens Place."

[TIME GAP · "Nine hours later · Mon 19 Oct, 6:10 PM (TODAY)"]

F04 · Maya · iOS · f3-invite-banner · 05-sender-reissue · 6:10 PM
- Does: opens Place. Her landing is the place file for Larkspur Loop. She taps "Fix".
- Shows: the single LandingBannerSlot "2 invitations need to be sent again · Fix" in the mailbox pill's geometry. Nothing else on the place file changes.
- Carries: Fix with 2 or more dead invitations opens Members, scrolled to the reissue rows.
- MoT: "Only one banner shows, by precedence (invite > reissue > claim receipt > compare arrival > mailbox arrival > sync merge > setup > verify > founding-meter preview)."

F05 · Maya · iOS · f3-members-roster · Pending group, needs reissue (REDRAWN from 03-pending-states for this household) · 6:11 PM
- Does: taps "Reissue" on Priya's row.
- Shows:
  - OWNER "Maya Chen (you)" and MEMBERS "Sam Ortega" above.
  - The Pending group with caption "Only you and admins see this." and two InviteRows in the needs-reissue variant, each with the warning glyph, "Needs reissue — your household's invite rules changed" in text.primary, and a trailing "Reissue":
    - "priya@example.com" · "Member · sent Mon 12 Oct" (highlighted once, focus here)
    - "theo.park@example.com" · "Member · sent Mon 12 Oct"
  - No expiry on dead rows.
- Carries: Priya's invitation record, into the composer's reissue review.
- MoT: "One tap per row."

F06 · Maya · iOS · f3-invite-composer · 09-needs-reissue (recast to priya@example.com) · 6:12 PM
- Does: reads the manifest, taps "Reissue".
- Shows:
  - The reissue line: "This invitation stopped working when your household's invite rules changed. Members can now see the calendar and bills. Send it again?"
  - The manifest: To "priya@example.com"; Role offered "Member" with the three grant rows ("Sees and edits the calendar" · "Sees bills and who paid" · "Sees who lives here"), then "What needs address verification" with two lock rows and "Show 3 more"; "Expires in 7 days · Mon 26 Oct".
  - Primary button "Reissue", plus Back and Close.
- Carries: the new grant list and expiry, which F12 must repeat.
- MoT: "The sender sees what the new invitation grants, because the member role now grants more than when she first sent it."

F07 · Maya · iOS · f3-invite-composer · sending (REDRAWN crop from 06-sending) · 6:13 PM
- Shows: the manifest locked, and the button reading "Sending…" with no full-screen spinner.
- MoT: "No success tick until the server confirms."

F08 · Maya · iOS · f3-invite-composer · 10-reissued (recast) · 6:14 PM
- Does: taps "Done".
- Shows: "Sent again to priya@example.com. The old link no longer works. Expires in 7 days · Mon 26 Oct.", the new link in a copyable field reading pantopus.com/j/9R2T-HB6W (the domain follows whichever form wins flow-04's H3), the caption "This link is for priya@example.com. Share it only with Priya.", the QR block, "Copy link" · "Share", "Done". One light haptic tick, belonging to the Reissue confirm.
- Carries: a new token to Priya by email (same channel), the new-invitation push, and the in-app row. The old token is invalidated.
- MoT: "The old link stops working, and the new expiry is stated."

F09 · Maya · iOS · f3-members-roster and place file after the fix (REDRAWN, two crops side by side) · 6:14 PM
- Shows:
  - Members: Priya's row now reads "priya@example.com" · "Sent again · The old link no longer works · Expires in 7 days · Mon 26 Oct", with Resend. theo.park@example.com is still "Needs reissue".
  - Place file: the banner now reads "1 invitation needs to be sent again · Fix". Annotate: "Fix with one dead invitation opens the composer's reissue review directly".
- MoT: "The count drops as she fixes, and the remaining fix is still one tap away."

[TIME GAP · "Seconds later · Mon 19 Oct, 6:14 PM" · the lane switches to Priya]

F10 · Priya · iOS · ext:os-push-tray · f3-invite-banner · 11-push · 6:14 PM
- Shows: the lock-screen push from the Account & security group (Time Sensitive), title "Maya Chen invited you" (21 characters), body "Larkspur Loop · expires Mon 26 Oct" (34 characters). Beside it, the hidden-preview version "Household invitation".
- Does: taps it. Arrow label: "push tap → the invitation, directly".
- MoT: "The push opens the invitation itself, never a dashboard or a list."

F11 · Priya · iOS · f3-invite-banner · 01-densest-one-invite (the no-notifications path, stacked directly under F10 in the same column) · 6:14 PM
- Shows: Your places with the single banner "Maya Chen invited you to Larkspur Loop · Review". The dead row is gone and no section shows (one live invitation, nothing else to list). The suppressed setup and verify banners are greyed outside the frame and labelled "suppressed by precedence".
- Does: taps "Review". Arrow label: "organic open → Review".
- MoT: "The recipient does not need to find the email again."

F12 · Priya · iOS · f3b-invitation-decision · 02-offer · 6:15 PM
- Does: reads and taps "Accept".
- Shows, in the designed order:
  - Title "Maya Chen invited you to Larkspur Loop".
  - Manifest: Home "2418 NE Larkspur Loop, Vancouver, WA 98684" · From "Maya Chen" · Role "Member" · Access "Starts when you accept · no end date". Then "Expires in 7 days · Mon 26 Oct" and "Maya Chen and 1 other live here".
  - Lead sentence 1: "This invitation gives you household access."
  - "What members can do now", with the three rows.
  - Lead sentence 2, directly above the limit list as its lead-in: "To send neighbor messages or get a residency letter, verify the address yourself."
  - "What needs address verification", with the five verb rows ("Message your neighbors" · "Get a residency letter" · "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank") and "See everything that needs it".
  - "This invitation does not grant ownership."
  - The pinned bar with "Accept" and "Decline".
- Carries: acceptance of the new token.
- MoT: "The grant list matches what Maya reviewed in F06, word for word."

F13 · Priya · iOS · f3b-invitation-decision · 06-accepted · 6:15 PM
- Does: taps "Open Home".
- Shows: "You're in.", "Maya Chen, Sam Ortega and you live here", ScopeChip "Your household", the lists kept, the caption "Verify your address to unlock these", and the bar with "Open Home" and "Start address verification" plus its caption "Some ways take about a day. Postcards take 5–10 days." One light haptic tick, belonging to the Accept confirm.
- Carries: Priya becomes a member. Beside F13, a small stub (not on the F13→F14 arrow) carries the end cap "the rest of Priya's first evening continues in flow-04 · storyboard · 04-first-open".
- MoT: "Verification is offered, not pushed."

F15 · Maya · iOS · f3-members-roster after acceptance (REDRAWN) · 6:15 PM
- Placement: in its own column between F13 and F14, labelled "Maya's screen, 6:15 PM", so the lane stays in time order. The F13→F14 arrow runs beneath it.
- Shows: "Priya Raman" under MEMBERS, caption "joined Mon 19 Oct 2026", with no chip. Priya's pending row has cross-faded out. theo.park@example.com still reads "Needs reissue — your household's invite rules changed · Reissue".
- MoT: "An accepted invitee appears in her group with no status chip, and her pending row is gone."

F14 · Priya · iOS · f1-today-tab · 14-after-join (recast) · 6:16 PM
- Shows:
  - The notice "Larkspur Loop is now shared with your household." (PROPOSED same-address join notice, replacing the export's "Today now uses Larkspur Loop because you joined this household.", which implies an address switch; see H10) with "See your places" and "Dismiss".
  - Chip "Your household" (it was "Saved place · Only you" this morning).
  - PickupCard "Maya · Tuesday, confirmed Sat 3 Oct 2026", with the tick and "Added by your household" (recast delta: the export reads "confirmed 3 Oct 2026"; the weekday is added, see H11).
  - No FirstWeekRow. Whatever the export draws in the briefing card's slot stays as placed (see H13).
- MoT: "Same address, new scope, and the change is said out loud."

LAYOUT
- Each happy-lane artboard is a left-to-right lane of iPhone frames at 50% scale. Failure lanes may also hold web-390 and web-1440 frames at 50%, for branches that happen in a browser; label each such frame's person tag "PRIYA · laptop" or "PRIYA · mobile web".
- Above each frame, draw a caption with three lines:
  1. Frame id and time, e.g. "F05 · Mon 19 Oct, 6:11 PM".
  2. The source artboard name, or "REDRAWN · from …", followed by any PROPOSED or ALTERNATE SCENARIO tag.
  3. A plain-text person tag: "PRIYA · iPhone" or "MAYA · iPhone". Never tag people by colour alone.
- Between frames, draw arrows labelled with the trigger: "old email link (Mon 12 Oct)" (into F01), "Back to your place" (F01→F02), "in-app row created, 9:00 AM" (F02→F03), "organic open, 6:10 PM" (F03→F04), "tap Fix" (F04→F05), "tap Reissue" (F05→F06), "tap Reissue (confirm)" (F06→F07), "server confirms" (F07→F08), "Done" (F08→F09), "push, 6:14 PM" (F08→F10), "push tap" (F10→F12), "tap Review" (F11→F12), "tap Accept" (F12→F13), "invitee accepted (Maya's screen updates)" (F13→F15), "tap Open Home → (dashboard, see flow-04 F10) → tap Today tab" (F13→F14, pin H11).
- Draw time jumps as a labelled vertical gap band on surface.sunken with text.strong, always with weekday, date and time.
- F10 and F11 share one column. F10 is on top, labelled "with notifications". F11 is below it, labelled "without notifications". Both arrows converge on F12.
- Across the top of each lane artboard, draw a margin lane of MoT callouts, each on surface.raised with the overline "MOMENT OF TRUTH".
- Failure branches sit below the happy lane on 02 and 03, and on their own artboard (04b) for lane 04. Each branch starts with a dashed arrow from the frame it leaves (on 04b, from a small thumbnail of that frame), labelled with the condition, shows its frames at 50%, and ends with a solid arrow to the frame where it rejoins, or with an end cap labelled "ends here". When a branch happens on another device than the frame it rejoins, label the rejoin arrow with the device ("on her iPhone later", "on web").
- Draw the handoff checks as numbered pins (H1 …) on the arrows concerned.
- Arrows, pins and callouts use text.secondary ink and border.strong, with no semantic colour outside the frames. The storyboard background is surface.app.

FAILURE BRANCHES
Lane 02 (dead link), below the happy lane on 02-dead-link:
- B01 · Priya is signed out, on a laptop (web-1440). f3b-invitation-decision · web-1440 · 13-policy-changed shows the same message and "Back to your place", placed as is. There is no token to preserve, because the invitation is dead. Annotate the button: "signed out, she has no place to go back to; the decision prompt has no signed-out variant of policy-changed (compare 'Look up your address' on declined); see H14". Rejoin arrow labelled "on her iPhone later, once the reissue lands" → F10 (push) or F11 (banner).
- B02 · Invitations fetch failed on Priya's landing. f3-invite-banner · ios · 08-fetch-failed shows the mailbox pill, no invite or error banner, and nothing shifts. Annotate: "invitations fetch failed: no invite banner, nothing shifts". Recovery: the next load, or the F10 push, or the in-app row. Rejoins F12.
Lane 03 (sender fix), below the happy lane on 03-sender-fix:
- B03 · The sender has no manage rights. ALTERNATE SCENARIO, outside the main story's count of two: in this branch only, Sam was an admin when he sent one extra invitation on Mon 12 Oct and is now a member (fixture delta). That invitation is not one of Maya's two dead rows, so H3 still holds for the main story.
  - f3-members-roster · ios · 02-member-view, recast: remove Jordan Park and the dense-roster rows so the roster shows only Maya Chen, Sam Ortega and (after F13) Priya Raman; no Pending group; no Invite; and the line "Maya Chen can invite people here." (the prompt's no-admin line, replacing the export's "Maya Chen or Jordan Park can invite people here.").
  - Arrow labelled "Sam opens a stale composer link (from his Mon 12 Oct invitation)" → f3-invite-composer · ios · 11-permission-denied: "Only owners and admins can invite people" · "Maya Chen can invite people here." · "Close". (f3-invite-composer: a member without invite rights who opens a stale link gets this frame.)
  - Annotate: "A sender who can no longer invite never sees Fix." Ends here; Maya's lane is the fix.
- B04 · The reissue send fails. f3-invite-composer · ios · 12-send-error: "We couldn't send the invitation. Your details are still here. · Try again". Recovery: Try again → rejoins F07.
- B05 · Maya is offline (REDRAWN from f3-invite-banner · ios · 09-offline, sender variant). FreshnessLine "You're offline · as of 5:52 PM". The banner "2 invitations need to be sent again · Fix" has Fix disabled, with the caption "You're offline. Fix opens when you're back." Recovery: back online → rejoins F04.
- B06 · Only one dead invitation (annotation). The banner "1 invitation needs to be sent again · Fix" → the composer's reissue review directly, skipping Members. Rejoins F06.
Lane 04 (recipient accepts), on 04b-recipient-failures:
- B07 · Multiple invitations. Priya also holds Rosa Delgado's invitation. f3-invite-banner · ios · 03-invitations-list, recast: remove Dana's dead rows (Maya's dead row has been replaced by the reissue), so the frame shows Your places with the section only and no banner: "Maya Chen · Larkspur Loop, Vancouver" · "Member · expires in 7 days · Mon 26 Oct" · "Review", and "Rosa Delgado · Fircrest Dr, Camas" · "Guest · expires in 3 days · Thu 22 Oct" · "Review", with the overflow (Not now, Decline) open. The count banner "You have 2 invitations" appears only on a place-file landing, so it is not drawn here. Recovery: Review on Maya's row → rejoins F12.
- B08 · Fetch failed at Mon 19 Oct, 7:30 PM, with no push opened. f3-invite-banner · ios · 08-fetch-failed shows no banner and nothing shifts. Recovery: the in-app row "Maya Chen invited you to Larkspur Loop" / "Today · 6:14 PM" (from 14-notification-rows) → rejoins F12. If the list itself fails when reached from Review or from a push for an expired invitation, it shows "We couldn't load your invitations. · Retry". (A push for a live invitation opens the decision screen directly, never the list.)
- B09 · Priya taps the OLD Mon 12 Oct email link after the reissue (REDRAWN, PROPOSED; no prompt defines this frame). The decision layout with no lists: "This link was replaced by a newer invitation from Maya Chen." with the button "Review the new invitation". Recovery: → rejoins F12. Flag as H5.
- B10 · Priya opens the new email on a signed-out browser (web-390).
  - f3b-invitation-decision · web-390 · 01-offer-signed-out, with "Already have an account? Sign in".
  - Then sign in (she already has an account), with the token kept.
  - Then f3b-invitation-decision · web-390 · 07-accepted-after-sign-up, captioned "07-accepted-after-sign-up (drawn after sign-up; placed as the sign-in twin; same layout, caption unchanged)".
  - Rejoin arrow labelled "on web" → F14 (Today is the same composition on web).
- B11 · Signed in with a different account (web-390). ALTERNATE SCENARIO: in this branch only, Priya also has a second account, priya.raman@example.com (fixture delta; the main story has her single account under priya@example.com). f3b-invitation-decision · web-390 · 15-account-mismatch: "You're signed in as priya.raman@example.com. This invitation went to priya@example.com." with "Accept as priya.raman@example.com" / "Switch account". The acceptance does not complete silently. Rejoin arrow labelled "on web (the web-390 twin is 07-accepted-after-sign-up)" → F13.
- B12 · The reissued invitation also expires. Gap band "Eight days later · Tue 27 Oct": Priya opens it. f3b-invitation-decision, expired (REDRAWN at iOS from web-1440 · 10-expired): "This invitation expired Mon 26 Oct. Ask Maya Chen to send a new one." · "Back to your place". Maya's Members crop: the pending InviteRow with the expired caption "priya@example.com · Member · Expired Mon 26 Oct · Resend". Recovery: Resend → "Expires in 7 days · Tue 3 Nov" → rejoins F10.
- B13 · Priya declines (Mon 19 Oct, 6:15 PM). f3b-invitation-decision, declined (REDRAWN at iOS from web-1440 · 09-declined): InlineUndo "Declined · Undo", "When you leave this page, Maya Chen will see that this invitation was declined.", "Back to your place". Maya's Members crop: StatusChip "Declined · Mon 19 Oct" with Remove only. Ends here. Undo before leaving rejoins F12.

HANDOFF CHECKS (draw each as a pin and list them all on the handoff-checks artboard)
- H1 · F01 and F03 must agree that the sender was told. The decision screen says "We've told Maya Chen.", but no prompt says what event creates Maya's row: Priya's tap, or the migration itself. This storyboard assumes the first dead-link hit creates one row, in the same minute, that summarises all dead invitations ("2 invitations …", Mon 19 Oct, 9:00 AM). If rows are batched or delayed, the "We've told" sentence must still be true when it is shown.
- H2 · F03 and F04 must agree on how the sender hears. There is an in-app row and a banner, but no sender push copy or group is defined anywhere, so Maya first sees the 9:00 AM row at 6:10 PM. If Maya never opens the app, nothing reaches her. Record whether a push (Account & security?) is intended.
- H3 · F04, F05 and F09 must agree on the dead count. The banner reads "2 invitations need to be sent again" and Members shows exactly two needs-reissue rows, both sent by Maya on Mon 12 Oct. After one reissue, the banner reads "1 invitation needs to be sent again" and Members shows one. B03's extra invitation belongs to an alternate scenario and is not counted.
- H4 · F05, F06 and F08 must agree on the reissue wording. The roster row says "Needs reissue — your household's invite rules changed". The composer line says "This invitation stopped working when your household's invite rules changed. …". The result says "Sent again to priya@example.com. The old link no longer works. Expires in 7 days · Mon 26 Oct." and the roster row says "Sent again · The old link no longer works · Expires in 7 days · Mon 26 Oct". The F08 announcement is "Sent again", matching the visible text.
- H5 · F08 and B09 must agree on what the old link shows after a reissue. The composer says the old link stops working, but the decision screen has no "replaced" frame. A replaced link must not show "policy changed" again (a loop) or "already used" (false).
- H6 · F06 and F12 must agree on the grant list, the lock list and "Mon 26 Oct", row for row.
- H7 · F02 and F11 must agree on replacement. The reissued invitation must replace Priya's dead row in "Invitations waiting for you". If the dead row stayed listed, f3-invite-banner's rule (any dead row means section only) would suppress the F11 banner.
- H8 · F10 and the decision screen's Notes must agree on the new-invitation push. f3-invite-banner gives "Maya Chen invited you" / "Larkspur Loop · expires Mon 26 Oct" / placeholder "Household invitation". f3b-invitation-decision Notes gives "Maya invited you to join" / "Larkspur Loop · See what you get" / placeholder "Invitation". Both put it in Account & security at Time Sensitive / HIGH. This storyboard draws the banner's version. One must be retired. This also closes flows-spec's gap "The new-invitation push has no defined copy or landing": the landing is the decision screen, directly.
- H9 · F11 and the app's cold start must agree. f3-invite-banner assumption A1 (blocking) is that a cold start with an invitation waiting opens Place. If Today opens first (ux-research-brief §2.5), F11 is never seen, and only F10 and the in-app row carry the invitation.
- H10 · F02/F11 and F14 must agree on the saved place. Priya saved the same address as a saved place. After joining, Today's chip changes to "Your household". No prompt says whether her "Larkspur Loop · Saved place · Only you" row is retired, merged or kept (see the flows-spec handoff gap on the duplicate SavedPlace row). f1-today-tab defines only the address-switch notice ("Today now uses Larkspur Loop because you joined this household."); it has no same-address or different-address join notice. This storyboard draws the PROPOSED "Larkspur Loop is now shared with your household."
- H11 · F13 and F14 must agree with flow-04: "Open Home" lands on the Home dashboard in flow-04's storyboard, while f3b-invitation-decision says the Place tab. The F13→F14 hop passes through that landing, which this storyboard does not draw. Today's pickup mark is the tick (Maya confirmed Sat 3 Oct; see flow-04 H6), with the date "Sat 3 Oct 2026" (the export omits the weekday).
- H12 · F05 and F09 must agree on expiry display. A needs-reissue row shows no expiry. A reissued row shows the new expiry. The original Mon 12 Oct invitations carried the old 14-day expiry, Mon 26 Oct, so at the 9:00 AM tap the invitation was policy-changed, not expired; the policy-changed state wins whenever both apply. The fixture's pending invite "priya@example.com, expires Mon 26 Oct" is the reissued one, and by coincidence it shares the original's date.
- H13 · F01, F12, F14 and §5 must agree. Priya's 7-day window ends Sun 25 Oct, the day before the invitation expires, so an invitation accepted on its last day can still miss her activation window. Joining gives her the Home and the household fact, but only the briefing card or the widget completes activation: confirm whether f1-today-tab · 14-after-join draws the briefing opt-in card in F14's scroll, and in which state (it must be never-asked for Priya, not the granted HOME A state). Also confirm that the email link F01 opens carries src=email, so the open counts as session_open trigger 'email' (see flow-04 H3).
- H14 · B01 and f3b-invitation-decision must agree on signed-out buttons. The decision prompt gives a signed-out variant ("Look up your address") only for the declined state. Policy-changed and expired show only "Back to your place", which a signed-out person on a laptop cannot use.

ACCESSIBILITY IN THE JOURNEY (draw as a thin annotation row under each lane)
- Focus landing after each transition:
  - F01: focus on the message sentence (the screen's heading).
  - F01→F02: focus on the Your places title. The dead row reads as one element: "Maya Chen, Larkspur Loop, Vancouver. Stopped working when this home changed who can invite. We've told Maya Chen. Remove, action available."
  - F04: the banner is role=status on appearance and never takes focus. It is read "2 invitations need to be sent again. Fix, button."
  - F04→F05: the scroll-once highlight also moves focus to the first needs-reissue row (Priya's).
  - F05→F06: focus on the composer title.
  - F06→F07: focus stays on the locked manifest, and "Sending" is announced.
  - F08: "Sent again" is announced, and focus stays on the result line.
  - F08→F09: focus returns to Priya's row in Members.
  - F10→F12 and F11→F12: focus on the title "Maya Chen invited you to Larkspur Loop".
  - F12→F13: "Joining…" then "You're in." are announced without moving focus.
  - F15: "Priya Raman joined" is announced politely on Maya's screen, without moving focus.
  - F14: the notice is read once.
- Offline reasons are read with their action: "Fix, unavailable, You're offline. Fix opens when you're back."
- Expiry is spoken in words: "Expires in 7 days, Monday 26 October."
- The no-notifications path is drawn explicitly. Priya: F11's banner and the in-app row. Maya: F03's in-app row and F04's banner (her only path; see H2).
- Every frame must read in greyscale. The needs-reissue state is carried by its words and glyph, never by colour.

INSTEAD OF
- Instead of flows-spec's username invite to a signed-out Tova, draw an email invite to Priya, who already has an account and a saved place, because that matches f3-invite-banner's recipient and the fixture's priya@example.com.
- Instead of an invitations list "no prompt draws", use f3-invite-banner · ios · 03-invitations-list, which now draws it.
- Instead of "You have 3 invitations" on Your places, draw the section only, because the banner and the section never repeat on the same screen.
- Instead of a sender push nobody has specified, draw the in-app row and the banner, and pin H2.
- Instead of an unexplained lag between Priya's tap and Maya's row, put both in the same minute (9:00 AM), because "We've told Maya Chen." must already be true.
- Instead of Fix opening a list for one item, show Fix opening the reissue review directly when only one invitation is dead (B06).
- Instead of letting the old link fall into a generic error, draw the proposed "replaced" frame (B09) and mark it PROPOSED.
- Instead of the address-switch join notice at an address Priya already saved, draw the proposed same-address notice and mark it PROPOSED (H10).
- Instead of colour-coding people or states, use text tags and the existing glyphs.

DONE WHEN
- The founder can follow Priya's dead link, through Maya's fix, to Priya's first Today in Larkspur Loop without leaving the storyboard, with every frame named by its source artboard or marked REDRAWN.
- All six flows-spec steps have a callout, recast to Maya, Priya and Larkspur Loop: dead link, sender banner, roster Reissue, composer reissued, recipient landing, accept.
- All five flows-spec failure branches are drawn (B07, B02/B08, B10, B03, and H8 for the push), each with recovery and a rejoin arrow or end cap. The added branches B01, B04–B06, B09 and B11–B13 are drawn too. B03 and B11 carry the ALTERNATE SCENARIO label.
- Every handoff check H1–H14 is pinned and listed.
- Every time jump is labelled with weekday, date and time, every frame prints its time, the happy lane reads in time order, and all relative counts are true for the frame's date.
- Only one banner ever appears per frame, and it never repeats a section on the same screen.
- Every lane reads in greyscale.

ARTBOARDS
1. flow-12 · storyboard · 01-journey-map · light — drawn late, from the finished lanes: the history strip (Mon 12 Oct invites → Wed 14 Oct rules change → Sun 18 Oct Priya signs up), then F01–F15 as thumbnails on the Mon 19 Oct timeline (9:00 AM → 6:16 PM), with person tags, time gaps, branch stubs B01–B13 and H-pins. A legend explains REDRAWN, PROPOSED, ALTERNATE SCENARIO, MoT, H-pin, dashed branch and solid rejoin. A summary line states the goal and the §5 metric.
2. flow-12 · storyboard · 02-dead-link · light — F01–F02 (Priya, 9:00 AM), MoT callouts, failure lane B01–B02 below, pins H1, H7, H13, H14. About 4 frames.
3. flow-12 · storyboard · 03-sender-fix · light — F03 (as an inset beside F04) and F04–F09 (Maya, row created 9:00 AM, then 6:10–6:14 PM), failure lane B03–B06 below, pins H1–H4, H12. About 13 frames.
4. flow-12 · storyboard · 04-recipient-accepts · light — F10, F11, F12, F13, F15, F14 in that time order (Priya 6:14–6:15 PM, Maya's roster at 6:15 PM, Priya's Today at 6:16 PM), with F10/F11 stacked in one column; stubs to 04b; pins H6, H8–H11, H13; the flow-04 end-cap stub beside F13. About 6 frames plus the accessibility row.
5. flow-12 · storyboard · 04b-recipient-failures · light — B07–B13, each leaving from a thumbnail of its source frame, with web-390 frames for B10 and B11; pin H5. About 11 frames.
6. flow-12 · storyboard · 05-handoff-checks · light — H1–H14 as a numbered checklist. Each item shows its two frame thumbnails side by side, the two conflicting strings quoted, and the value this storyboard drew. Where one side of a check exists only in another prompt (for example H8, H9, H10, H14), use a quoted-string card naming that prompt in place of a thumbnail.
7. flow-12 · storyboard · 06-notes · light — list:
- The recast from flows-spec: Tova Lindgren → Priya Raman; Dana Whitfield → Maya Chen; 4312 NW Sierra Dr → Larkspur Loop; the username invite → an email invite; "a week later" → Mon 12 Oct to Mon 19 Oct.
- Fixture deltas and invented strings:
  - The Mon 12 Oct invitations with the old 14-day expiry, Mon 26 Oct (which follow f3-household-block and f3-member-home-dashboard; flow-04's storyboard instead has Priya's invitation sent Mon 19 Oct, 5:10 PM, as a separate scenario). The policy-changed state wins over expiry.
  - The Wed 14 Oct rules change (from f3-members-roster).
  - Priya's Sun 18 Oct sign-up and saved place (from f3-invite-banner).
  - Maya's Tuesday pickup confirmed Sat 3 Oct 2026, with the tick and "Added by your household" for Priya (same delta as flow-04; see flow-04 H6).
  - The times 9:00 AM (Priya's tap and Maya's row, same minute; first seen 6:10 PM), 6:10, 6:11, 6:12, 6:13, 6:14, 6:15 (accept and Maya's roster), 6:16 PM, 7:30 PM; the Tue 27 Oct gap.
  - Priya's dead-row caption "Stopped working when this home changed who can invite. We've told Maya Chen." (recast from Dana's row in 03-invitations-list), and the mailbox pill in F02's slot.
  - The recast composer strings for priya@example.com, the new link pantopus.com/j/9R2T-HB6W, and the "Sent again" announcement.
  - "1 invitation needs to be sent again · Fix" on Maya's place file.
  - The proposed B09 frame "This link was replaced by a newer invitation from Maya Chen." / "Review the new invitation".
  - The proposed same-address join notice "Larkspur Loop is now shared with your household." on F14.
  - Sam as a former admin with one extra invitation and the stale composer link (B03, alternate scenario, not part of the count of 2), and the B03 roster recast: Jordan Park and the dense-roster rows removed, line "Maya Chen can invite people here."
  - Priya's second account priya.raman@example.com (B11, alternate scenario; the main story has one account under priya@example.com).
  - B10's 07-accepted-after-sign-up placed after a sign-in, as the sign-in twin, with its caption unchanged; the prompt draws no separate accepted-after-sign-in frame.
  - Rosa Delgado's invitation (from f3-invite-banner), and B07's recast with Dana's dead rows removed.
  - The Tue 27 Oct open and the Tue 3 Nov expiry; "Declined · Mon 19 Oct".
  - "Sat 3 Oct 2026" on F14 (the weekday added to the export's "confirmed 3 Oct 2026").
- Assumptions: the first dead-link hit creates Maya's summary row in the same minute (H1); a reissue replaces the recipient's dead row (H7); the reissue uses the original channel (email) and also sends the push and the in-app row; a cold start with an invitation waiting opens Place (f3-invite-banner A1, blocking).
- Activation gap: no frame shows Priya turning on the briefing or the widget before Sun 25 Oct, so this storyboard does not show her activation completing. Whether 14-after-join draws the briefing opt-in card, and in which state, is open (H13).
- Component contract gaps: component-contract.md's InviteRow variants (pending · expiring · needs reissue · declined · link active · awaiting approval) have no expired variant, so B12 draws the pending row with an expired caption; record whether to add a variant. The contract's LandingBannerSlot ladder (invite > reissue > compare arrival > mailbox arrival > setup > verify) lags the 9-step ladder in f3-invite-banner that F04 quotes.
- Signed-out gap: the decision prompt has no signed-out variant of policy-changed or expired (H14).
- Instrumentation questions: §5 has no FunnelEvent for a dead-invitation hit or a reissue, so time-to-reissue, which drives the recipient's activation window, cannot be measured. session_open meta.kind has no invitation value. F01 counts as trigger 'email' only if the email link carries src=email (see flow-04 H3; H13).
- Omitted: web-1440, Android and dark twins of every happy-lane frame; theo.park@example.com's own recipient journey; the Guest role; Priya's life after F14 (see flow-04's storyboard); the Open Home landing between F13 and F14 (see flow-04 F10).

BATCH PLAN: Turn 1: artboards 2–3 (02-dead-link, 03-sender-fix; about 17 frames, most placed from exports), then wait for "continue". Turn 2: artboards 4–5 (04-recipient-accepts, 04b-recipient-failures; about 17 frames), then wait. Turn 3: artboard 1 (the journey map, drawn from the finished lanes) and artboard 6 (handoff checks), then wait for "continue". Turn 4: artboard 7 (notes). Turns are sized by frame load, not artboard count, so no lane or list is truncated.
