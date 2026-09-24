# Inviting a co-resident: send, accept, first open, locked action, owner confirmation
id: flow-04 · platforms: ios/android/web-390/web-1440 · artboards: 58

Use the Pantopus house style pasted above and the Foundations components, by exact name. This project is a journey storyboard.

JOURNEY: flow-04 · Inviting a co-resident through acceptance, first open, the locked action, and owner confirmation

TYPE: NEW (storyboard). Every screen in this journey already has its own designed project. This project lays those screens out as one connected sequence across two people and three platforms. It shows what is carried from frame to frame, what each person sees at each moment of truth, and where each failure branch goes and rejoins. Do not redesign any screen. Where an attached export exists, place it exactly and change only the recast deltas listed for that frame. Where no export exists, redraw the frame faithfully from the description given here, in the house style, and mark it with a small "REDRAWN" tag in its caption. Where this storyboard draws a string that no prompt defines, mark it with a small "PROPOSED" tag in that frame's caption. Where a branch needs a fixture that contradicts the main story, label the branch "ALTERNATE SCENARIO".

ARTBOARD NAMING: storyboard projects put "storyboard" in the platform slot of the house-style pattern, so every artboard here is named "flow-04 · storyboard · <NN-state> · light", including the last one, "flow-04 · storyboard · 08-notes · light".

ATTACH (exported artboards, by exact name):
- Foundations board (prompt 00): GrantLimitList, LockedActionRow, InviteRow, MemberRow, NotificationRow, PushCopy, InlineUndo, LandingBannerSlot, ScopeChip, StatusChip, OfflineNotice, InlineErrorRow rows.
- f3-members-roster · ios · 01-owner-dense · light (layout reference for F01, F05, F23)
- f3-members-roster · ios · 03-pending-states · light (row reference for B02a, B02b, B04, B05)
- f3-members-roster · ios · 04-person-detail-owner · light (reference for F23)
- f3-household-block · ios · 01-visible · light (B03 inset)
- f3-household-block · ios · 08-member-read-only · light (reference for B10)
- f3-invite-composer · ios · 01-email-form · light (F02)
- f3-invite-composer · ios · 05-review · light (F03; reference for the B02a and B02b review frames)
- f3-invite-composer · ios · 07-sent-panel · light (F04)
- f3-invite-composer · ios · 02-share-instead · light (B02a; reference for B02b)
- f3-invite-composer · ios · 08-link-ready · light (B02a; reference for B02b)
- f3-invite-composer · ios · 12-send-error · light (B01)
- f3b-invitation-decision · web-390 · 01-offer-signed-out · light (F07)
- f3b-invitation-decision · web-390 · 07-accepted-after-sign-up · light (F09)
- f3b-invitation-decision · web-1440 · 09-declined · light (reference for B05)
- f3b-invitation-decision · web-1440 · 10-expired · light (reference for B04)
- f3b-invitation-decision · web-1440 · 13-policy-changed · light (B08 thumbnail)
- f3b-invitation-decision · web-390 · 15-account-mismatch · light (B06)
- f3b-invitation-decision · web-390 · 16-waiting-for-approval · light (B02b)
- f3b-invitation-decision · ios · 20-offline · light (reference for B07)
- f3-member-home-dashboard · web-390 · 10-member-view · light (F10, recast)
- f3-member-home-dashboard · ios · 04-access-revoked · light (B11, recast)
- f1-today-tab · ios · 14-after-join · light (reference for F11)
- f4-briefing-optin-card · web-390 · 01-never-asked · light (reference for F11's briefing card slot; slot 10 in f1-today-tab)
- f3-household-calendar · web-390 · 16-agenda-dense · light (F11a, recast)
- f3-household-calendar · ios · 02-member-can-edit · light (reference for F11a's member legend and live "Add an event")
- f3-household-calendar · ios · 03-create-event-sheet · light (reference for F12)
- f3-household-calendar · ios · 04-saved-highlight · light (reference for F13)
- f3-household-notifications · ios · 05-read-later · light (reference for F14)
- f3b-locked-action-row · android · 12-locked-nearby-compose · light (F15)
- f3b-locked-action-row · ios · 03-address-verified-live · light (reference for F24)
- f3b-locked-action-row · ios · 05-pending-postcard · light (reference for B13)
- f3b-verify-address-sheet · android · 24-non-owner-ask-offered · light (F16, recast)
- f3b-verify-address-sheet · ios · 03-request-ready-undo · light (reference for F17)
- f3b-verify-address-sheet · ios · 04-request-sent · light (reference for F18)
- f3b-verify-address-sheet · ios · 05-request-cancelled · light (reference for B14)
- f3b-verify-address-sheet · ios · 06-owner-confirmed · light (reference for the F24 inset)
- f3b-verify-address-sheet · ios · 07-owner-didnt-confirm · light (reference for B15)
- f3b-verify-address-sheet · ios · 08-owner-hasnt-answered · light (reference for B16)
- f3b-verify-address-sheet · ios · 09-access-ended · light (reference for B17)
- f3b-verify-address-sheet · ios · 11-postcard-pending · light (reference for B13)
- f3b-owner-attestation · ios · 01-request-pending · light (F20, recast)
- f3b-owner-attestation · ios · 02-ticked-grants-expanded · light (F21, recast)
- f3b-owner-attestation · ios · 04-confirmed · light (F22, recast)
- f3b-owner-attestation · ios · 05-declined · light (B15, recast)
- f3b-owner-attestation · ios · 06-access-ended · light (B17, recast)
- f3b-owner-attestation · ios · 13-entries-and-results · light (reference for F19)
No export exists for: the invitation email (F06), the register page (F08), the Android and web-390 versions of screens drawn only on iOS (F11, F12, F13, F17, F18, F24), the lock-screen push on Maya's iPhone as a full frame (F19), the Members roster at this exact household size (F01, F05, F23), the Share-instead review frames with "Create link" (B02a, B02b), and the approval-backend versions of the share and link-ready frames (B02b). Redraw these faithfully from the descriptions below.
Recast rule: every attached export about Sam Ortega as the person verifying (the locked row, verify sheet and owner attestation) is recast here to Priya Raman. Swap the name, initials ("PR"), pronoun, dates and times exactly as listed per frame. Change nothing else.

PERSONA & SITUATION (fixtures; these replace flows-spec's Dana/Sam/Maple St)
- Maya Chen, owner of HOME A, 2418 NE Larkspur Loop, Vancouver, WA 98684 (label "Larkspur Loop"). Joined Thu 1 Oct 2026. Address confirmed by postcard before TODAY. Uses an iPhone (iOS 393x852). She has one home, so her NotificationRows carry no place label.
- Sam Ortega, member of HOME A since Sat 10 Oct 2026. He appears only as a name in this journey.
- Priya Raman is moving into the spare room. Email priya@example.com. She has no Pantopus account at the start. She reads email on her Android phone and accepts in the mobile browser (web 390x844) without installing the app. She installs the Android app (412x915) on Monday night and signs in, so from Tue 20 Oct she uses Android. No frame shows that install.
- Pickup at HOME A: garbage every Tuesday, recycling every other Tuesday (next Tue 20 Oct), Waste Connections, carts out by 6:30 AM. Maya confirmed the pickup day on Sat 3 Oct, so it carries the you-added tick. For Priya, the tick's word is "Added by your household".
- Timeline (print the time on every frame's caption):
  - Mon 19 Oct, 5:10 PM: Maya sends the invitation (one hour before TODAY). It expires in 7 days, on Mon 26 Oct.
  - Mon 19 Oct, 6:10 PM (TODAY): Priya opens the email. At 6:11 PM she reads the offer, taps Accept and starts sign-up. At 6:12 PM she creates her account and the acceptance commits (the join time). From 6:13 to 6:20 PM she looks around and adds an event.
  - Tue 20 Oct, 8:15 AM: Priya, now on the Android app, taps Message a neighbor and taps "Ask Maya Chen to confirm". At 8:16 AM she closes the sheet, and only then is the request sent to Maya. At 8:17 AM she reopens the sheet from the Nearby row's "View request".
  - Tue 20 Oct, 12:30 PM: Maya taps the push and confirms. The answer commits at 12:31 PM, when she taps Done.
  - Tue 20 Oct, 1:05 PM: Priya opens Nearby and the control is live.

GOAL: Maya adds Priya in two taps. Priya joins knowing what access she gets, lands somewhere useful, and has a way to finish address verification when she tries to message a neighbor. The round trip, a request to Maya and an answer back to Priya, is visible end to end.

§5 METRIC: Activation, via one household fact: a second active occupant. §5 computes activation by query within 7 days of t1_account_created. That requires a SavedPlace or Home, briefing or widget on, and one household fact. Priya's account is created Mon 19 Oct, so her window closes Mon 26 Oct. Joining gives her the Home and the household fact on day 0. She still needs the briefing or the widget, and no frame in this storyboard shows her turning either on (see Handoff check H14). Maya's own window closed Thu 8 Oct, so this journey does not move Maya's activation. The journey also serves the flow's Honesty aim: nothing may imply an address-verified action for a household-verified member. §5's honesty counter covers only pickup pushes. Record on Notes that this honesty aim is not instrumented. session_open triggers: F07 is trigger 'email', which requires the email link to carry src=email (see H3). F15 is 'organic'. F20 is 'push' (kind not in the enum; see Notes). F24 is 'organic'.

THE HAPPY PATH
Each step gives the platform, surface id and state, what the person does, what the screen shows, what is carried to the next step, and the moment of truth (MoT), which is drawn as a callout in the margin lane.

F01 · Maya · iOS · f3-members-roster · owner view (REDRAWN from 01-owner-dense, reduced to this household) · Mon 19 Oct, 5:10 PM
- Does: from Place → place file → People ("You and Sam live here · View") she opens Members and taps "Invite".
- Shows: header "Members" with the one primary button "Invite". OWNER: "Maya Chen (you)", caption "joined Thu 1 Oct 2026". MEMBERS: "Sam Ortega", caption "joined Sat 10 Oct 2026", with the disclosure row "What can members do?". No Pending group, no chips on names.
- Carries: home id and label "Larkspur Loop"; the composer opens with Email selected.
- MoT: "The invite lives where she manages people, and it is the only primary action on the screen." Margin note: the first-week card "Who lives here with you?" does not show today, because a second person (Sam) is already active. See B03.

F02 · Maya · iOS · f3-invite-composer · 01-email-form · 5:10 PM
- Does: types priya@example.com, keeps Member, adds the note, taps "Review invitation".
- Shows: title "Invite someone to Larkspur Loop", ScopeChip "Your household", channel chips "Email" (selected) · "Username" · "Share instead". Field "Email address" holds priya@example.com. Role chips "Member" (selected) · "Guest". Caption: "Sees and edits the calendar · Sees bills and who paid · Sees who lives here". Note: "You'll see our pickup day and the household calendar. I already added the lease end and the Clark Public Utilities bill." Sticky button "Review invitation".
- Carries: recipient, role Member, note text, and the shared grant string set.
- MoT: "The role explains itself where she chooses it."

F03 · Maya · iOS · f3-invite-composer · 05-review · 5:10 PM
- Does: reads the manifest, taps "Send invitation".
- Shows these rows:
  - Home: 2418 NE Larkspur Loop, Vancouver, WA
  - To: priya@example.com
  - Role offered: Member, with the three grant rows, then the heading "What needs address verification" with "Message your neighbors", "Get a residency letter" and the row "Show 3 more"
  - Access: Starts when accepted · no end date
  - Expires: in 7 days · Mon 26 Oct
  - Note
  - Closing line: "Household access only. This invitation does not grant ownership."
- Carries: the exact grant and lock lists and the expiry Mon 26 Oct, which F07 must repeat word for word.
- MoT: "Maya approves exactly what Priya will read, built from one shared string set." Draw a thin connector from this manifest to F07's two lists, labelled "same strings".

F04 · Maya · iOS · f3-invite-composer · 07-sent-panel · 5:10 PM
- Does: reads the sent state, taps "Done".
- Shows: "Invitation sent to priya@example.com" (a status), the link field pantopus.com/j/7K4M-QD2X, caption "This link is for priya@example.com. Share it only with Priya.", the QR block, "Copy link" · "Share", "Expires in 7 days · Mon 26 Oct", "Done". One light haptic tick, on the Send invitation confirm.
- Carries: the invitation token, which goes by email to Priya, and the pending row, which goes to Members.
- MoT: "'Sent' appears only after the server confirms, and it is announced as a status."

F05 · Maya · iOS · f3-members-roster · owner view with Pending (REDRAWN) · 5:11 PM
- Does: lands back on Members.
- Shows: F01, plus a Pending group last. Caption "Only you and admins see this." InviteRow "priya@example.com", caption "Member · sent Mon 19 Oct · Expires in 7 days · Mon 26 Oct", inline "Resend", overflow.
- Carries: nothing to Priya. This row is Maya's lasting record.
- MoT: "The pending invitation is visible, with its expiry and a one-tap Resend."

[TIME GAP · "One hour later · Mon 19 Oct, 6:10 PM (TODAY)" · the lane switches to Priya]

F06 · Priya · Android · ext:email-client · invitation email (REDRAWN; no export) · 6:10 PM
- Does: opens the email and taps "Review".
- Shows: a generic Android mail app with no real client branding. From "Pantopus", received 5:10 PM. Subject "Maya Chen invited you to Larkspur Loop on Pantopus". Body:
  - "Maya Chen invited you to join the household at Larkspur Loop, Vancouver, WA."
  - Maya's note as a quoted block (see H2).
  - "As a member you:" then the three grant rows, verbatim.
  - "This invitation expires Mon 26 Oct."
  - Button "Review".
  - Footer "If you weren't expecting this, you can ignore it."
  No household names other than the inviter, and no street number. Tag the frame PROPOSED (every email string is invented; listed on Notes).
- Carries: the token in the link to the decision screen, which opens in the mobile browser.
- MoT: "The email names the inviter and the home, and says what joining gives."

F07 · Priya · web-390 · f3b-invitation-decision · 01-offer-signed-out · 6:10 PM (opened), Accept tapped 6:11 PM
- Does: reads, taps "Accept" at 6:11 PM.
- Shows:
  - Title "Maya Chen invited you to Larkspur Loop".
  - Manifest: Home "2418 NE Larkspur Loop, Vancouver, WA 98684" · From "Maya Chen" · Role "Member" · Access "Starts when you accept · no end date". Then "Expires in 7 days · Mon 26 Oct" and "Maya Chen and 1 other live here".
  - Lead: "This invitation gives you household access."
  - The list "What members can do now", with the three rows.
  - "To send neighbor messages or get a residency letter, verify the address yourself."
  - The list "What needs address verification": "Message your neighbors" · "Get a residency letter" · "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank", then "See everything that needs it".
  - Footnote "This invitation does not grant ownership."
  - Pinned bar: "Accept" (filled) and "Decline" (outlined, same size), the caption "You'll make an account next. You don't need the app." and the link "Already have an account? Sign in".
- Carries: the token, preserved into registration.
- MoT: "The grant comes first, and the limits read as a list. A forwarded link shows a count, never housemates' names."

F08 · Priya · web-390 · ext:register · sign-up with invite token kept (REDRAWN; no export; PROPOSED strings) · 6:11 PM (opened), account created 6:12 PM
- Does: creates an account in the browser and taps "Create account" at 6:12 PM.
- Shows: title "Create an account to join Larkspur Loop". Context line "Maya Chen invited you. You'll come back to the invitation next." Email field pre-filled with priya@example.com (editable), password field, button "Create account", link "Already have an account? Sign in". No app-install prompt, no permission ask.
- Carries: the token and her new account, which returns to the same decision screen with the acceptance she started.
- MoT: "The token survives sign-up and brings her back to the invitation, not to an empty Place tab."

F09 · Priya · web-390 · f3b-invitation-decision · 07-accepted-after-sign-up · 6:12 PM (the acceptance commits at this minute)
- Does: reads "You're in.", taps "Open Home".
- Shows: "You're in.", "Maya Chen, Sam Ortega and you live here", ScopeChip "Your household", both lists still on screen, and the caption "Verify your address to unlock these" under the limit list. The bar holds "Open Home" (primary), then "Start address verification" with the caption "Some ways take about a day. Postcards take 5–10 days."
- Carries: role Member and HomeOccupancy for Larkspur Loop, joined 6:12 PM. Today now resolves to Larkspur Loop.
- MoT: "Verification is offered, not pushed. The verify sheet does not open by itself."

F10 · Priya · web-390 · f3-member-home-dashboard · 10-member-view (recast to Priya) · 6:13 PM
- Does: looks around the home.
- Shows the six cards in the owner's order, with these deltas:
  - Today card: "3 people live here" and "Recycling and garbage tomorrow", plus the permission-limited KeeperStrip "Ollie".
  - Members card: heading "3 people live here", with "Maya Chen · Owner · joined Thu 1 Oct", "Sam Ortega · Member · joined Sat 10 Oct", "Priya Raman · You · joined Mon 19 Oct". The footer is the LockedActionRow "Maya can invite people here" with a quiet "View".
  - Calendar card: legend "● Official · ○ On record, not confirmed · ✓ Added by your household". The pickup row is recast to the confirmed day: "Recycling and garbage", line 2 "Tomorrow · Confirmed by Maya" (PROPOSED; tag it in the caption), with the tick. Footer "Add an event" · "Open calendar".
  - Bills card: "3 upcoming · $306.17 through Mon 2 Nov", caption "Everyone at Larkspur Loop can see these", footer "Maya can add bills and mark them paid here" · "View".
  - The Today card's neighbor-message action carries "Address verification needed to send neighbor messages · Verify address".
  - No verify banner at the top.
- Carries: Priya taps the Today tab next, and comes back here in F11a for "Open calendar".
- MoT: "The dashboard is useful read-only. No control is visible but inert."

F11 · Priya · web-390 · f1-today-tab · after-join (REDRAWN at web-390 from ios · 14-after-join) · 6:14 PM
- Does: opens Today for the first time.
- Shows:
  - The pinned slot holds the two-line notice "Today now uses Larkspur Loop because you joined this household." with "See your places" and "Dismiss".
  - Chip "Your household".
  - PickupCard "Maya · Tuesday, confirmed Sat 3 Oct 2026", with the tick and its word "Added by your household" (the weekday is a recast delta; the export reads "confirmed 3 Oct 2026").
  - The confirmed PickupCard lines as f1-today-tab defines them: "Recycling and garbage tomorrow" · "Bins out tonight — curbside by 6:30 AM".
  - No FirstWeekRow. The briefing opt-in card sits in its own slot (slot 10) at the bottom of the scroll, placed from f4-briefing-optin-card · web-390 · 01-never-asked and recast to Priya: it is in its never-asked state, not the granted HOME A state with "7:00 AM · Change" and "6:00 PM · Change" that f1-today-tab's CONTENT describes for Maya (see H14). Priya does not tap it in this storyboard.
  - Bottom tab bar: Place · Today · Nearby · Mail.
- Carries: Priya taps the Place tab next, which returns to the dashboard (F10), and taps "Open calendar" on its Calendar card.
- MoT: "The switch in Today's address is explained, not silent, and the household's confirmed pickup day shows straight away."

F11a · Priya · web-390 · f3-household-calendar · 16-agenda-dense (recast to Priya's member view) · 6:18 PM
- Does: arrives from the dashboard's Calendar card "Open calendar" and taps "Add an event".
- Shows: the agenda as placed, with these deltas taken from ios · 02-member-can-edit: the member legend "● Official · ○ On record, not confirmed · ✓ Added by your household", "Add an event" live, the voter row in its not-done state, and "Added by Maya" last lines. The pickup rows are recast from hollow "Waste Connections · city schedule" to Maya's confirmed Tuesday with the tick (see H6). Beside the frame, a small crop of F10's Calendar card footer "Add an event" · "Open calendar", labelled "entry: dashboard Calendar card".
- Carries: the create-event sheet opens with ScopeChip "Your household".
- MoT: "A member reaches the calendar from the dashboard in one tap, and the add control is live."

F12 · Priya · web-390 · f3-household-calendar · create-event sheet (REDRAWN from ios · 03-create-event-sheet) · 6:19 PM
- Does: fills "Chimney sweep", Sat 14 Nov, 9:00 AM, "Does not repeat", and taps "Save event".
- Shows: the create-event sheet with those values, header ScopeChip "Your household", the footer "Everyone in this household will see this.", and the buttons "Save event" and a visible Close.
- Carries: the event, to the agenda and to Maya's notifications.
- MoT: "A member can edit the calendar without asking, and the sheet says who will see it."

F13 · Priya · web-390 · f3-household-calendar · saved highlight (REDRAWN from ios · 04-saved-highlight) · 6:20 PM
- Shows:
  - The confirmation "Saved to your household calendar."
  - "November 2026 · 6 items".
  - The Sat 14 Nov row "Chimney sweep · 9:00 AM" · "in 26 days · Sat 14 Nov" · "You added this · Does not repeat", highlighted once, with the tick.
  - Legend "● Official · ○ On record, not confirmed · ✓ Added by your household".
- Carries: home_event_created goes to Maya as one quiet row.
- MoT: "'Saved to your household calendar.' is true, because the row is right there."

F14 · Maya · iOS · f3-household-notifications · list (REDRAWN from 05-read-later with these two rows) · 6:20 PM
- Shows the TODAY overline, and under it two unread NotificationRows, newest first. Rows under TODAY show a bare time, as the notifications prompt draws them:
  - PR avatar, "Priya added Chimney sweep" / "in 26 days · Sat 14 Nov at 9:00 AM · 6:20 PM"
  - PR avatar, "Priya joined Larkspur Loop" / "Can see the calendar and bills · 6:12 PM"
  No place label on either row: Maya has one home, and the NotificationRow contract shows place labels only to readers with more than one place (record this choice on Notes). No push is drawn, because Household activity is off until Maya turns it on.
- MoT: "The owner learns about the join and the edit, quietly, with the actor's name first."

[TIME GAP · "Next morning · Tue 20 Oct, 8:15 AM · Priya installed Pantopus on Android last night and signed in"]

F15 · Priya · Android · f3b-locked-action-row · 12-locked-nearby-compose (recast to Priya) · 8:15 AM
- Does: on Nearby, taps "Message a neighbor".
- Shows: the control dimmed in its usual place. Beneath it, the LockedActionRow: the reason "Address verification needed to send neighbor messages" in bodySmall text.secondary on base, no fill, and "Verify address" as the primary.700 inline link. The tap scrolls the row into view, moves focus to it, fades a 300ms highlight and makes a TalkBack announcement.
- Carries: the reason "send neighbor messages", into the verify sheet header.
- MoT: "She gets an explanation and a path, not a 403 or a dead tap. The reason is readable: text.secondary on base, not text.muted on sunken."

F16 · Priya · Android · f3b-verify-address-sheet · 24-non-owner-ask-offered (recast) · 8:15 AM
- Does: taps "Ask Maya Chen to confirm".
- Shows:
  - Header: "Verify this address", Close, the reason "To send neighbor messages, we need to confirm you live here.", "2418 NE Larkspur Loop, Vancouver, WA 98684", ScopeChip "Your household".
  - "What this unlocks": "Message your neighbors" · "Get a residency letter" · "and 3 more".
  - Four equal method rows with time chips:
    - "Postcard code" · "5–10 days" · "We mail a code to 2418 NE Larkspur Loop."
    - "Document" · "About 1 day" · "A lease or utility bill with your name on it."
    - "Landlord confirmation" · "Not available" · "Not available for an address someone else has claimed. Only the person on the lease can use this."
    - "Ask Maya Chen to confirm" · "Usually same day" · "Maya claimed this address and can confirm."
- Carries: the request draft.
- MoT: "At least one method she can finish is shown, with an honest time. Nothing is recommended."

F17 · Priya · Android · f3b-verify-address-sheet · request ready (REDRAWN from ios · 03-request-ready-undo) · tapped 8:15 AM, closed 8:16 AM
- Shows: "We'll ask Maya when you close this." and InlineUndo "Request ready · Undo" in place of the Ask row.
- Does: taps Close at 8:16 AM. The request is sent to Maya only at that moment. One light haptic tick at that moment, following f3b-verify-address-sheet ("on sheet close for Ask"), because for Ask the close is when the request is confirmed as sent. Pin H20 on this frame: the house style's "one light tick on confirm only" reading would put no tick here.
- Carries: the attestation request (requester Priya, reason, unlock list), sent 8:16 AM.
- MoT: "Nothing reaches Maya until Priya has had the chance to undo."

F18 · Priya · Android · f3b-verify-address-sheet · request sent, reopened after close (REDRAWN from ios · 04-request-sent), plus a Nearby crop · 8:17 AM
- Does: back on Nearby, taps "View request" on the locked row, which reopens the sheet.
- Shows: "We asked Maya. You'll hear here when she answers." · "Asked today at 8:16 AM" · "Cancel request" · heading "Or verify another way" with Postcard code and Document. Beside it, the Nearby crop she tapped from: the dimmed control, and the LockedActionRow in its request-pending form "We asked Maya to confirm you live here · View request" (PROPOSED, see H10).
- MoT: "The request is a visible state, so she doesn't tap again or give up."

[TIME GAP · "Four hours later · Tue 20 Oct, 12:30 PM" · the lane switches to Maya]

F19 · Maya · iOS · ext:os-push-tray · lock screen (REDRAWN from f3b-owner-attestation · ios · 13-entries-and-results) · push delivered Tue 20 Oct, 8:16 AM, tapped 12:30 PM
- Shows: the push from the Account & security group, title "Priya asked you to confirm" (26 characters), body "Does Priya live with you?" (25 characters). Beside it, the hidden-preview version "Request for you".
- Does: taps it at 12:30 PM.
- MoT: "The push lands on the confirmation sheet, never on the dashboard."

F20 · Maya · iOS · f3b-owner-attestation · 01-request-pending (recast) · 12:30 PM
- Shows:
  - Header close "Not now". Title "Does Priya live here?".
  - Avatar "PR", "Priya Raman", caption "Joined Larkspur Loop on Mon 19 Oct 2026 · invited by you". The address, and ScopeChip "Your household".
  - Heading "Once you confirm, Priya can also", with "Message your neighbors" · "Get a residency letter" · "and 3 more" (success ticks).
  - The statement, unticked: "I confirm Priya Raman lives at 2418 NE Larkspur Loop."
  - The consequence line: "This tells Pantopus that Priya lives here. It does not give Priya ownership of this home and does not let Priya remove you. We'll record that you confirmed it, with today's date."
  - "Confirm Priya lives here" (disabled) and "Don't confirm" (outlined).
- MoT: "She approves the same unlock list, in the same order, that Priya was shown."

F21 · Maya · iOS · f3b-owner-attestation · 02-ticked-grants-expanded (recast) · 12:30 PM
- Does: ticks the box and taps "Confirm Priya lives here". This tap is the confirm, and it carries one light haptic tick.
- Shows: the box ticked, Confirm enabled, and "and 3 more" open with "Show your Residency Pass" · "Share what you pay in rent (Real Rent)" · "Earn a Block Founder rank" and the "Also:" caption.
- MoT: "Two taps from the push: tick, then confirm."

F22 · Maya · iOS · f3b-owner-attestation · 04-confirmed (recast) · 12:31 PM
- Does: taps "Done" at 12:31 PM.
- Shows: header "Close", "Confirmed. Priya's address is verified.", "Address confirmed by Maya Chen · Tue 20 Oct 2026", "Priya can now message your neighbors and get a residency letter. We'll let Priya know when you close this.", "Undo", "Done". No second haptic on Done.
- Carries: verification_source address with method owner confirmation, dated Tue 20 Oct 2026, to Priya's gate, row and sheet.
- MoT: "A mis-tap about someone else can be undone until she closes the sheet."

F23 · Maya · iOS · f3-members-roster · owner view after close (REDRAWN) · 12:31 PM
- Shows: MEMBERS lists "Sam Ortega" ("joined Sat 10 Oct 2026") and "Priya Raman" ("joined Mon 19 Oct 2026"), with no chip, badge or tick on either name. No Pending group. Inset: Priya's person detail sheet with "Confirmed by Maya Chen · Tue 20 Oct 2026".
- MoT: "The roster does not rank housemates by how they were verified."

[TIME GAP · "Half an hour later · Tue 20 Oct, 1:05 PM" · the lane switches to Priya]

F24 · Priya · Android · f3b-locked-action-row · address-verified live (REDRAWN from ios · 03-address-verified-live) · 1:05 PM
- Shows: Nearby with the one-time result line "Maya confirmed you live at Larkspur Loop" above the now-live "Message a neighbor", and no locked row. Inset 1: the standalone NotificationRow (drawn outside a list, no overline) "Maya confirmed you live at Larkspur Loop" / "Today · 12:31 PM" (see H21). Inset 2: the verify sheet result (from ios · 06-owner-confirmed): "Maya confirmed you live at Larkspur Loop." · "Address confirmed by Maya Chen · Tue 20 Oct 2026" · "You can now message your neighbors." · "Done".
- MoT: "The result reaches the requester, and the unlock is immediate."

LAYOUT
- Each lane artboard is a left-to-right lane of device frames at 50% scale. Web-390 and phones use their own sizes; no web-1440 frames are in the happy path. Failure lanes may use web-390 and web-1440 frames where a branch happens on the web.
- Above each frame, draw a caption with three lines:
  1. Frame id and time, e.g. "F07 · Mon 19 Oct, 6:10 PM".
  2. The source artboard name, e.g. "f3b-invitation-decision · web-390 · 01-offer-signed-out", or "REDRAWN · from …", followed by any PROPOSED or ALTERNATE SCENARIO tag.
  3. A person tag in plain text: "MAYA · iPhone" or "PRIYA · Android / mobile web". Never tag people by colour alone.
- Between frames, draw arrows labelled with the trigger, in this order: "tap Invite" (F01→F02), "tap Review invitation" (F02→F03), "tap Send invitation" (F03→F04), "Done" (F04→F05), "email link on another device" (F05→F06), "tap Review" (F06→F07), "tap Accept, 6:11 PM" (F07→F08), "Create account, 6:12 PM → back with token" (F08→F09), "tap Open Home" (F09→F10), "tap Today tab" (F10→F11), "tap Place tab → dashboard Calendar card → Open calendar" (F11→F11a), "tap Add an event" (F11a→F12), "tap Save event" (F12→F13), "in-app row (no push)" (F13→F14), "tap Message a neighbor" (F14→F15, across the time gap), "tap Verify address" (F15→F16), "tap Ask Maya Chen to confirm" (F16→F17), "Close → request sent, 8:16 AM · then View request on Nearby, 8:17 AM" (F17→F18), "push, 8:16 AM" (F17→F19, across the time gap), "push tap, 12:30 PM → sheet over Members" (F19→F20), "tick + Confirm" (F20→F21), "Confirm → result" (F21→F22), "Done → answer commits, Priya is told" (F22→F23), "organic open" (F23→F24).
- Draw time jumps as a labelled vertical gap band on surface.sunken with text.strong, e.g. "Next morning · Tue 20 Oct, 8:15 AM".
- Across the top of each lane artboard, draw a margin lane of MoT callouts. Each callout is a short card on surface.raised with the overline "MOMENT OF TRUTH", aligned above its frame.
- Each happy lane's failure branches sit on their own failure artboard (02b, 03b, 06b) or, for lanes 04 and 05, below the happy lane. Each branch starts with a dashed arrow from the frame it leaves (on a split artboard, from a small thumbnail of that frame), labelled with the condition. It shows its frames at 50% and ends with a solid arrow back to the frame where it rejoins, labelled "rejoins F09" and so on, or with an end cap labelled "ends here". A branch that moves time forward carries its own gap band with weekday, date and time.
- Draw the handoff checks that touch a lane as small numbered pins (H1, H2 …) on the arrows between the two frames concerned.
- Arrows, pins and callouts use text.secondary ink and border.strong. Use no semantic colour except the existing glyphs inside the frames. The storyboard background is surface.app.

FAILURE BRANCHES
Lane 02 (send), drawn on 02b-send-failures:
- B01 · Send failed. f3-invite-composer · ios · 12-send-error: "We couldn't send the invitation. Your details are still here. · Try again". Recovery: Try again → rejoins F04.
- B02a · Maya picks "Share instead", single-use backend (Mon 19 Oct, 5:10 PM).
  - f3-invite-composer · ios · 02-share-instead shows the single-use warning at the point of choice: "The first person who opens this link can join your household until it expires. Send it to one person."
  - Then the review (REDRAWN from 05-review for the link path): the To row reads "Link — Works once", the rest of the manifest as F03, and the button "Create link".
  - Then 08-link-ready: "Link ready · Works once" · "Expires in 7 days · Mon 26 Oct" · "You can turn it off in Members."
  - Then a Members crop with the InviteRow "Invite link · Works once · Expires in 7 days · Mon 26 Oct · Turn off link".
  - Recovery: Priya opens the link → rejoins F07.
- B02b · Maya picks "Share instead", approval backend (the backend cannot make links single-use; an alternative to B02a, never on the same link).
  - Share instead (REDRAWN from 02-share-instead) with the approval warning: "Anyone with this link can ask to join. You approve each person in Members."
  - Then the review (REDRAWN from 05-review) with the manifest line "Whoever joins with this link waits for your OK. They see nothing of the household until you approve." and the button "Create link".
  - Then the link panel (REDRAWN from 08-link-ready without the "Works once" tag; the composer defines no approval-backend link-ready string, so tag PROPOSED and list on Notes): "Link ready" · "Expires in 7 days · Mon 26 Oct" · "You can turn it off in Members."
  - Then Priya's side: f3b-invitation-decision · web-390 · 16-waiting-for-approval ("Waiting for Maya's OK. You'll see the household once Maya approves.").
  - Then a Members crop with the awaiting-approval row "Priya Raman · Waiting for your OK · Approve / Remove" plus "Priya sees no household data until you approve."
  - Recovery: Approve → InlineUndo "Priya Raman added · Undo" → rejoins F10.
- B03 · Earlier path inset (not a failure). f3-household-block · ios · 01-visible, captioned "Mon 5 Oct: Maya alone. The first-week card is where the first invitation (Sam) started. It never shows once a second person is active." Above it, a MoT callout recast from flows-spec step 1: "Mon 5 Oct: the ask is on the Place tab where Maya actually lands. 'Just me' is a real button of equal weight." Ends here.
Lane 03 (accept), drawn on 03b-accept-failures:
- B04 · Expired. Priya, still signed out with no account, opens the email on Tue 27 Oct (gap band "One week later · Tue 27 Oct"). f3b-invitation-decision, expired (REDRAWN at web-390 from web-1440 · 10-expired): "This invitation expired Mon 26 Oct. Ask Maya Chen to send a new one." · "Look up your address" (fixture delta: the export's "Back to your place" is the signed-in button; the signed-out button follows the declined state's variant; see H19). Beside it, Maya's Members crop: "priya@example.com · Member · Expired Mon 26 Oct · Resend". Recovery: Resend → the caption becomes "Member · sent Tue 27 Oct · Expires in 7 days · Tue 3 Nov" → rejoins F06 (a new email).
- B05 · Priya declines. f3b-invitation-decision, declined (REDRAWN at web-390 from web-1440 · 09-declined): InlineUndo "Declined · Undo", "When you leave this page, Maya Chen will see that this invitation was declined.", "Look up your address" (signed out). Beside it, Maya's Members crop: "priya@example.com", StatusChip "Declined · Mon 19 Oct", Remove only, no Resend. Ends here. Undo before leaving rejoins F07.
- B06 · Account mismatch. ALTERNATE SCENARIO: in this branch only, Priya already has an account as priya.raman@example.com (fixture delta; the main story has her with no account). f3b-invitation-decision · web-390 · 15-account-mismatch: "You're signed in as priya.raman@example.com. This invitation went to priya@example.com." with "Accept as priya.raman@example.com" / "Switch account". Recovery: Accept as … → rejoins F09. Switch account → sign in → rejoins F07.
- B07 · Offline at accept. f3b-invitation-decision, offline (REDRAWN at web-390 from ios · 20-offline): "You're offline. Your invitation is saved. You can accept when you're back online." Accept and Decline are dimmed, each with "Needs a connection." The token is kept. Recovery: back online → Accept → rejoins F09.
- B08 · The invite rules changed before she accepted (this branch assumes the rules changed between 5:10 and 6:10 PM on Mon 19 Oct; see Notes). A thumbnail of f3b-invitation-decision · web-1440 · 13-policy-changed ("This home changed who can invite people. We've told Maya Chen."), with an end cap "continues in flow-04's sibling storyboard flow-12 (drawn there under its own fixture)". Pin H19 here too: the export's "Back to your place" has no signed-out variant.
Lane 04 (first open), drawn below the happy lane on 04-first-open:
- B09 · Priya had already saved another place. B09 draws the PROPOSED different-address notice "Today now uses Larkspur Loop. Mom's place is still saved." (her saved place "Mom's place · Washougal, WA"); f1-today-tab defines no different-address notice. The frame is REDRAWN from F11 with only the notice changed, and tagged PROPOSED. Rejoins F11a.
- B10 · The household block inside Priya's 7-day window. The place file People section (REDRAWN from f3-household-block · ios · 08-member-read-only) shows the read-only line "You, Maya and Sam live here · View" (PROPOSED; tag it in the caption) and the LockedActionRow "Maya can invite people here", with no invite card. Rejoins F11a.
- B11 · Access revoked later. f3-member-home-dashboard · ios · 04-access-revoked (recast): "Your access to Larkspur Loop ended." / "Your saved places and private dates stay with you." / "Go to your places". Ends here.
Lane 05 (locked and ask), drawn below the happy lane on 05-locked-and-ask:
- B12 · Android silent no-op (anti-pattern). Beside F15, draw a struck-through ghost frame labelled "NOT THIS: visible control, tap does nothing (canPerform early return)", with an arrow to F15 labelled "the dimmed control stays tappable and brings the reason into focus". This is an annotation, not UI.
- B13 · Priya picks Postcard code instead (Tue 20 Oct, 8:15 AM).
  - The inline confirm "We'll mail a code to 2418 NE Larkspur Loop" · "Send postcard".
  - Then the pending state (REDRAWN at Android from ios · 11-postcard-pending): "Your postcard is on its way." · "Mailed Tue 20 Oct (today) · expected by Fri 30 Oct (in 10 days) · code works until Thu 19 Nov (in 30 days)" · field "Code from your postcard" · "Check code" · the disabled late path "Didn't arrive by Fri 30 Oct? Send a new code" with "Available after Fri 30 Oct. Your first code will stop working."
  - A Nearby crop (from locked-action-row ios · 05-pending-postcard): "Your postcard is on its way — expected by Fri 30 Oct (in 10 days)" · "Enter code". No second start.
  - Gap band "One week later · Tue 27 Oct, 7:40 PM · the postcard arrived".
  - Recovery: the code is checked Tue 27 Oct, 7:40 PM → rejoins F24, with the result line reading "Address confirmed by postcard · Tue 27 Oct 2026" (PROPOSED; tag it in the caption).
- B14 · Priya cancels. The sheet (REDRAWN at Android from ios · 05-request-cancelled) shows InlineUndo "Request cancelled · Undo" and the Ask row back. Maya is told nothing new, and her pending row disappears. Rejoins F16.
Lane 06 (confirm and result), drawn on 06b-attest-failures:
- B15 · Maya taps "Don't confirm" (Tue 20 Oct, 12:30 PM). f3b-owner-attestation · ios · 05-declined (recast): "You didn't confirm. Priya stays in your household and can still verify by postcard or with a document. We'll let Priya know when you close this." · "Undo" · "Done". Then Priya's side (REDRAWN at Android from verify ios · 07-owner-didnt-confirm): the NotificationRow "Maya didn't confirm your address" and the sheet "Maya didn't confirm. You can still verify by postcard or with a document.", with Postcard code and Document only and no Ask row. Recovery: Postcard code → joins B13.
- B16 · Maya taps "Not now". The sheet closes, and a Members crop keeps the Pending row "Priya asked you to confirm where they live · Review" (PROPOSED neutral string, pin H16). No new push is sent. The request lapses Tue 27 Oct. Gap band "Eight days later · Wed 28 Oct": Priya's sheet (REDRAWN at Android from verify ios · 08-owner-hasnt-answered) shows the other methods first, then "Maya hasn't answered yet · Asked Tue 20 Oct" and "Ask Maya again". If Maya opens the old push after the lapse, she sees "Priya's request ended on Tue 27 Oct. If Priya asks again, you'll see it here." · "Done". Recovery: Ask Maya again → rejoins F17.
- B17 · Access ended while the request was open. f3b-owner-attestation · ios · 06-access-ended (recast): "Priya no longer has access to Larkspur Loop, so there's nothing to confirm." · "Done". Priya's sheet (REDRAWN at Android from verify ios · 09-access-ended), at the medium detent: "Your access to Larkspur Loop ended, so there's nothing to verify here. If that's a mistake, ask Maya Chen." · "Close". Joins B11.

HANDOFF CHECKS (draw each as a pin on the storyboard and list them all on the handoff-checks artboard; each must hold, or the Notes must record the conflict)
- H1 · F03 and F07 must agree on the grant and lock strings, row for row and in order. Also on "Expires … Mon 26 Oct". Also on the access line: the composer reads "Starts when accepted · no end date" and the decision screen reads "Starts when you accept · no end date". Record the wording drift on Notes.
- H2 · F02 and F06/F07 must agree on where Maya's note appears. The composer collects the note, but neither the decision screen nor any prompt shows it to Priya. Draw the note in F06's email body as a quoted block, and flag on Notes that f3b-invitation-decision has no slot for it.
- H3 · F04 and F06/F07 must agree on the link form. The composer shows pantopus.com/j/7K4M-QD2X, and the decision screen describes pantopus.app/invite/…. One domain must win. Also: for F07 to count as session_open trigger 'email', the link in the email must carry src=email; the copy-link and QR forms in F04 must not carry it.
- H4 · F06 and F07 must agree on the invitation line "Maya Chen invited you to Larkspur Loop". The email is not specified in any prompt.
- H5 · F09 and F10 must agree on where "Open Home" lands, and on which onboarding rule governs an invited joiner's first landing. f3b-invitation-decision says the Place tab showing Larkspur Loop. f3-member-home-dashboard says the Home dashboard. ux-research-brief §2.5 says "Today is the first screen." (and f3-invite-banner assumption A1 says a cold start with an invitation waiting opens Place). This storyboard draws the dashboard, on this rule: an explicit button's named destination ("Open Home") governs the landing right after acceptance, and brief §2.5 governs cold app starts, so Priya's first Android open on Tue 20 Oct would land on Today. The founder must confirm this rule or pick one. Also, F09's "Maya Chen, Sam Ortega and you live here" and F10's "3 people live here" must count the same people.
- H6 · F10, F11, F11a and F13 must agree on the pickup day's provenance. f1-today-tab 14 draws "Maya · Tuesday, confirmed 3 Oct 2026" with the tick. f3-member-home-dashboard and f3-household-calendar draw the same pickup as hollow "Waste Connections · city schedule". The recast fixture says Maya confirmed Tuesday, so all of them show the tick. Their word for Priya is "Added by your household", never "You added this". The date must carry its weekday: "Sat 3 Oct 2026".
- H7 · F05, f3-household-block frame 09 and f3-member-home-dashboard frame 11 must agree on Priya's sent date and invitation length. The composer and roster say "sent Mon 19 Oct · Expires in 7 days · Mon 26 Oct". The household block and dashboard say "sent Mon 12 Oct · Expires Mon 26 Oct" (14 days). This storyboard uses 7 days.
- H8 · F13 and F14 must agree on the event. f3-household-calendar has "Sam added 'Chimney sweep' for Sat 14 Nov" at 9:00 AM. f3-household-notifications has "Maya added Chimney sweep" / "in 19 days · Sat 7 Nov at 9:00 AM · 5:30 PM · Larkspur Loop". Recast here to Priya, Sat 14 Nov, 9:00 AM: "Priya added Chimney sweep" / "in 26 days · Sat 14 Nov at 9:00 AM · 6:20 PM", without the place label because Maya has one home. The row format also differs between the calendar prompt ("Priya added 'Chimney sweep' for Sat 14 Nov") and the notifications prompt (title plus caption). This storyboard draws the notifications format and records the calendar prompt's version.
- H9 · F09, F14 and the join row must agree on the format and time. f3-household-notifications shows "Priya joined Larkspur Loop" / "Can see the calendar and bills · Wed 21 Oct, 4:20 PM" (its later, EARLIER-group frame). f3-household-block annotates "Sam joined Larkspur Loop — can see the calendar and bills" and the push "Sam joined your household". The join here is Mon 19 Oct, 6:12 PM, the minute F09 commits, so F14's row, under the TODAY overline, reads "Can see the calendar and bills · 6:12 PM".
- H10 · F18 and the Nearby LockedActionRow must agree on the request-pending state. f3b-locked-action-row says the row "reads the matching status from the verify sheet" but gives no string for a request to the owner. "We asked Maya to confirm you live here · View request" is proposed here. Its "View request" is also the control that reopens the sheet (F17→F18).
- H11 · F16, F20/F21 and F07 must agree on the unlock list. The decision screen shows 5 rows plus the "Also:" line. The verify sheet and the attestation show 2 rows, then "and 3 more", then the "Also:" line, in the same order. Only the glyph differs (lock vs success tick).
- H12 · F17/F19 must agree on the push. Title "Priya asked you to confirm", body "Does Priya live with you?", group Account & security, placeholder "Request for you", delivered on Close at 8:16 AM. This supersedes flows-spec's "Sam is verifying Maple St". Priya's result has no push copy in any prompt; only an in-app row exists. Record whether a push is intended.
- H13 · F22, F23 and F24 must agree on the attribution: "Address confirmed by Maya Chen · Tue 20 Oct 2026" in the attestation result and the verify sheet result, and "Confirmed by Maya Chen · Tue 20 Oct 2026" in the roster detail. The in-app row has no period ("Maya confirmed you live at Larkspur Loop"), and the sheet line has one.
- H14 · F11 and §5 activation must agree. f1-today-tab 14 removes the FirstWeekRow for a joined member, so the only path to briefing or widget within Priya's 7 days is the briefing opt-in card in its own slot. Confirm that the card is drawn in 14-after-join (its artboard description says only "full-length scroll"). If the 14-after-join export shows the card, it may show the granted HOME A state ("7:00 AM · Change" / "6:00 PM · Change") from f1-today-tab's CONTENT; recast it to the never-asked state of f4-briefing-optin-card · web-390 · 01-never-asked for Priya. Also decide whether the web-390 card's "Yes", which opens the browser's permission dialog for browser push, counts toward daily_briefing_enabled or evening_briefing_enabled. No frame shows Priya turning on the briefing or the widget before Mon 26 Oct, including on the Android app she installs Monday night.
- H15 · B11 and f3-members-roster must agree on the revoked copy. The roster says "Your saved places and private dates are still yours." / "Go to Your places". The dashboard says "Your saved places and private dates stay with you." / "Go to your places".
- H16 · F19, F20 and B16 must agree on the Pending row string. The source prompts use "Priya asked you to confirm she lives here · Review", which needs a pronoun Pantopus does not hold. This storyboard draws the neutral proposal "Priya asked you to confirm where they live · Review", marked PROPOSED, and records the pronoun version on Notes.
- H17 · F07 and B08 must agree on the invitation push group and copy. f3b-invitation-decision Notes gives "Maya invited you to join" / "Larkspur Loop · See what you get". f3-invite-banner gives "Maya Chen invited you" / "Larkspur Loop · expires Mon 26 Oct". Not drawn in this flow (Priya has no app on Mon). Drawn and pinned in flow-12 (H8); still open.
- H18 · F09 and the verify sheet must agree on the reason if Priya taps "Start address verification" instead: "You've joined Larkspur Loop. Confirming your address unlocks a few more things." The caption "Some ways take about a day. Postcards take 5–10 days." must match the sheet's chips.
- H19 · B04, B08 and f3b-invitation-decision must agree on signed-out buttons. The decision prompt gives a signed-out variant ("Look up your address") only for the declined state. Expired and policy-changed show only "Back to your place", which a signed-out person without a place cannot use. This storyboard draws "Look up your address" on B04; the prompt needs signed-out variants for expired, revoked, already used, policy changed and joined by link.
- H20 · F16→F17 (pin on that arrow) must agree on the haptic at Close. f3b-verify-address-sheet says: "Give one light haptic tick when a request, postcard or landlord email is confirmed as sent (on sheet close for Ask)." The house-style reading used in an earlier draft of this storyboard was "one light tick on confirm only, and Close is not a confirm", which puts no tick on Close. This storyboard draws the verify sheet's value: one light tick at 8:16 AM when Close sends the request. The founder must confirm that Close-to-send counts as a confirm.
- H21 · F14, F24 and the no-notifications path must agree on the same-day NotificationRow time form. f3-household-notifications groups rows under a TODAY overline with a bare time ("6:20 PM"). f3-invite-banner · 14-notification-rows prints "Today · h:mm" ("Today · 9:00 AM"). This storyboard draws the bare time inside the notifications list (F14) and "Today · h:mm" only on rows drawn standalone, outside a list (F24 inset 1 and the no-notifications path rows). One convention should win.

ACCESSIBILITY IN THE JOURNEY (draw as a thin annotation row under each lane)
- Focus landing after each transition:
  - F01→F02: focus on the sheet title "Invite someone to Larkspur Loop".
  - F02→F03: focus on the review's first manifest row. On a validation error, focus moves to the first error.
  - F03→F04: focus stays on the sent status line.
  - F04→F05: focus returns to the "Invite" button, and the new Pending row is announced.
  - F05→F06: cross-device. The mail app opens at its own reading position; there is no focus handoff between Maya's phone and Priya's.
  - F06→F07: focus on the title "Maya Chen invited you to Larkspur Loop".
  - F07→F08: focus on the register title "Create an account to join Larkspur Loop".
  - F08→F09: focus on "You're in."
  - F09→F10: focus on the dashboard header.
  - F10→F11: focus on the notice, which is read once.
  - F11→F11a: focus on the agenda's month heading.
  - F11a→F12: focus on the sheet title.
  - F12→F13: focus moves to the highlighted Sat 14 Nov row.
  - F15: focus moves to the LockedActionRow.
  - F15→F16: focus on the sheet title "Verify this address".
  - F16→F17: focus moves to the InlineUndo "Request ready · Undo", and the ready line "We'll ask Maya when you close this." is read.
  - F17 close: focus returns to "Message a neighbor".
  - F18 (reopened from "View request"): focus on "We asked Maya."
  - F19→F20: focus on the title "Does Priya live here?", not on "Not now".
  - F21→F22: focus moves to the result line "Confirmed. Priya's address is verified."
  - F22 close: focus returns to Priya's row in Members.
  - F23→F24: cross-device, organic open. Focus on the result line above the live control, which is read once.
- Announcements (polite, no focus move):
  - "Invitation sent"
  - "Joining…" then "You're in."
  - "Saved to your household calendar."
  - The TalkBack announcement "Address verification needed to send neighbor messages"
  - "Request ready", "Request sent", "Confirming…", "Confirmed. Priya's address is verified.", "Maya confirmed you live at Larkspur Loop"
  - "Declined" (B05) and "You're offline" (B07)
- The no-notifications path, drawn as a dotted alternate arrow:
  - If Maya has notifications off, the request reaches her through the Members Pending row "Priya asked you to confirm where they live · Review" and the standalone NotificationRow "Priya asked you to confirm where they live" / "Today · 8:16 AM" (both PROPOSED, H16, H21). Both open F20.
  - Priya's result needs no push. It shows as the in-app row and on Nearby itself (F24).
  - Household activity is off by default, so F14 is in-app only.
- Every arrow's trigger is also a visible control. No step is gesture-only.
- Every frame must read in greyscale. Person tags are text, and MoT callouts are text.

INSTEAD OF
- Instead of starting at the first-week household card, start at Members → Invite, because the card never shows once Sam is active. Show the card only as the B03 inset, with step 1's moment of truth above it.
- Instead of one lane per person, draw one time-ordered lane with person tags and labelled time gaps, because the handoffs between people are the point.
- Instead of reusing Sam's name from the attestation and verify exports, recast every string to Priya, because the fixture's joiner in this flow is Priya.
- Instead of the hollow "city schedule" pickup row on the dashboard and calendar, draw Maya's confirmed Tuesday with the tick, because the fixture says she confirmed it. Flag the prompts that disagree (H6).
- Instead of an arrow from Today straight into the create-event sheet, draw the hop through the dashboard's Calendar card and the agenda (F11a), because "Add an event" does not live on Today.
- Instead of mixing the single-use and approval link backends in one branch, draw them as B02a and B02b, each with its own warning, because the roster treats them as alternative backends.
- Instead of flows-spec's "We're checking your postcard code — expected by …" with no action, draw "Your postcard is on its way — expected by Fri 30 Oct (in 10 days) · Enter code", because the designed row supersedes it.
- Instead of "in place of the control", draw the dimmed control with the row beneath, because the designed locked row supersedes the flow's wording.
- Instead of an endless pending after asking Maya, draw each answer's frame: confirmed, didn't confirm, hasn't answered, access ended.
- Instead of a gendered pending string, draw the neutral proposal and mark it PROPOSED (H16).
- Instead of compressing open, review, sign-up and acceptance into one minute, spread them across 6:10–6:12 PM, because nobody reads an offer and makes an account in the same minute.
- Instead of colour-coding people or states, use text tags and the existing glyphs.
- Instead of inventing new screens for gaps, redraw from the nearest export and mark the gap as a handoff check.

DONE WHEN
- The founder can follow Maya's send to Priya's live Message a neighbor control without leaving the storyboard, with every frame named by its source artboard or marked REDRAWN, and every invented string tagged PROPOSED in its frame.
- Every moment of truth from flows-spec steps 2–18 has a callout on the happy lane, and step 1's moment of truth has a callout above the B03 inset, all recast to Maya, Priya and Larkspur Loop.
- All twelve flows-spec failure branches are drawn (B04, B08, B05, B06, B02a/B02b, B15/B16, B17 with B11, B13, B12, B09, B10, B07), each with its recovery surface and a rejoin arrow or an end cap. The added branches B01, B03 and B14 are drawn too. B06 carries the ALTERNATE SCENARIO label.
- Every handoff check H1–H21 is pinned on its arrow and listed on the handoff-checks artboard.
- Every time jump is labelled with weekday, date and time, every printed time agrees with the timeline (email opened 6:10 PM; Accept tapped 6:11 PM; account created and join committed 6:12 PM; request sent 8:16 AM; confirm committed 12:31 PM), and all relative counts are true for the frame's date.
- No frame shows a verification chip on a person, a warning-coloured limit, a percentage or a recommended method.
- Every lane reads in greyscale.

ARTBOARDS
1. flow-04 · storyboard · 01-journey-map · light — drawn late, from the finished lanes: the whole journey as a strip of F01–F24 thumbnails (including F11a) on one timeline (Mon 19 Oct 5:10 PM → Tue 20 Oct 1:05 PM), with the person tags, time gaps, branch stubs B01–B17 (with B02a and B02b) and the H-pins. A legend explains REDRAWN, PROPOSED, ALTERNATE SCENARIO, MoT, H-pin, dashed branch and solid rejoin. A summary line states the goal and the §5 metric.
2. flow-04 · storyboard · 02-send · light — F01–F05 (Maya, iOS, 5:10–5:11 PM), MoT callouts, stubs to 02b, pins H1, H3, H7. About 5 frames.
3. flow-04 · storyboard · 02b-send-failures · light — B01, B02a (four frames and crops), B02b (five frames and crops) and the B03 inset with its step 1 MoT callout, each leaving from a thumbnail of its source frame. About 11 frames.
4. flow-04 · storyboard · 03-accept · light — F06–F09 (Priya, Android mail, then web-390, 6:10–6:12 PM), MoT callouts, stubs to 03b, pins H1–H5, H17, H18. About 4 frames.
5. flow-04 · storyboard · 03b-accept-failures · light — B04–B08, including Maya's Members crops, pin H19. About 7 frames.
6. flow-04 · storyboard · 04-first-open · light — F10, F11, F11a, F12, F13, F14 (Priya web-390, then Maya iOS, 6:13–6:20 PM), failure lane B09–B11 below, pins H5, H6, H8, H9, H14, H15, H21. About 9 frames.
7. flow-04 · storyboard · 05-locked-and-ask · light — time gap, then F15–F18 plus the Nearby crop (Priya, Android, Tue 20 Oct, 8:15–8:17 AM), failure lane B12–B14 below, pins H10, H11, H18, H20. About 10 frames.
8. flow-04 · storyboard · 06-attest-and-result · light — time gap, then F19–F24 with F23's inset and F24's two insets (Maya iOS 12:30–12:31 PM, then Priya Android 1:05 PM), stubs to 06b, pins H11, H12, H13, H16, H21. About 9 frames.
9. flow-04 · storyboard · 06b-attest-failures · light — B15–B17 with both sides of each branch, and the dotted no-notifications path, pins H16, H21. About 8 frames.
10. flow-04 · storyboard · 07-handoff-checks · light — H1–H21 as a numbered checklist. Each item shows its two frame thumbnails side by side, the two conflicting strings quoted, and the value this storyboard drew. Where one side of a check exists only in another prompt (for example H5, H7, H9, H15, H19, H20, H21), use a quoted-string card naming that prompt in place of a thumbnail.
11. flow-04 · storyboard · 08-notes · light — list:
- The recast from flows-spec: Dana → Maya, Sam Okafor → Priya Raman, Maple St → Larkspur Loop, Sep dates → Oct dates, and "6 upcoming" bills → "3 upcoming · $306.17 through Mon 2 Nov".
- Every invented string and fixture delta (each is also tagged PROPOSED in its frame where it is a string):
  - The email subject, body, quoted note, footer and received time.
  - The register title, context line and pre-filled email.
  - Priya installing the Android app Monday night (no frame).
  - The times 5:11 PM; 6:10 (email opened), 6:11 (Accept tapped), 6:12 (account created, acceptance and join committed), 6:13, 6:14, 6:18, 6:19, 6:20 PM; 8:15 (tap Ask), 8:16 (Close, request sent), 8:17 AM (sheet reopened); 12:30, 12:31, 1:05 PM.
  - Maya's pickup confirmation on Sat 3 Oct 2026 (weekday added to the f1-today-tab export).
  - "Tomorrow · Confirmed by Maya" (F10); the F11a member-view and ticked-pickup recast of 16-agenda-dense; F11's briefing card recast to the never-asked state.
  - "Priya added Chimney sweep" / "in 26 days · Sat 14 Nov at 9:00 AM · 6:20 PM"; "Priya joined Larkspur Loop" / "Can see the calendar and bills · 6:12 PM"; no place label on Maya's rows because she has one home (NotificationRow contract).
  - The same-day row format: f3-household-notifications draws a TODAY overline with bare times under it (it prints a full date only in its later Wed 21 Oct frame), and F14 follows it. f3-invite-banner · 14-notification-rows uses "Today · h:mm", and the standalone rows on F24 and the no-notifications path follow it. H21 records the two conventions.
  - The push "Priya asked you to confirm" / "Does Priya live with you?".
  - "PR"; "Joined Larkspur Loop on Mon 19 Oct 2026 · invited by you"; "Once you confirm, Priya can also"; the recast consequence line; "Confirm Priya lives here"; "Confirmed. Priya's address is verified."; the recast declined, access-ended and lapsed lines.
  - "Address confirmed by Maya Chen · Tue 20 Oct 2026"; "Confirmed by Maya Chen · Tue 20 Oct 2026"; "Asked today at 8:16 AM"; "Maya hasn't answered yet · Asked Tue 20 Oct"; "Today · 12:31 PM".
  - The postcard dates Tue 20 Oct / Fri 30 Oct / Thu 19 Nov; the code checked Tue 27 Oct, 7:40 PM, and the result line "Address confirmed by postcard · Tue 27 Oct 2026"; the lapse date Tue 27 Oct; the Wed 28 Oct reopen; B04's Tue 27 Oct open and the Tue 3 Nov expiry; "Look up your address" on B04 (signed-out delta, H19).
  - B02a's link-path review ("Link — Works once", "Create link"); B02b's approval-backend frames and the unlabelled "Link ready" panel (no designed approval-backend link-ready string); "Priya Raman added · Undo"; "Priya sees no household data until you approve."; "Priya Raman · Waiting for your OK".
  - B06's alternate account priya.raman@example.com (alternate scenario; the main story has Priya with no account).
  - "Mom's place · Washougal, WA" and the different-address notice "Today now uses Larkspur Loop. Mom's place is still saved." (f1-today-tab defines only "Birchfield Ct is now your home · See what moved" and "Today now uses Larkspur Loop because you joined this household.").
  - "You, Maya and Sam live here · View".
  - The proposed "We asked Maya to confirm you live here · View request"; the pronoun string "Priya asked you to confirm she lives here · Review" from the source prompts, and the neutral proposal "Priya asked you to confirm where they live · Review" that this storyboard draws.
- Assumptions:
  - Email confirmation during F08 is skipped because the invitation link proved the address. If the auth provider requires it, the f1-email-verify-handoff interstitial appears between F08 and F09 and must return with the token. This is a product question.
  - Owner confirmation counts as address verification (a proposed fifth method; sign-off needed before build).
  - After "Not now", Priya gets no signal until the lapse.
  - Household activity is off for Maya.
  - Haptics: this storyboard puts light ticks on Send invitation (F04), on the Close that sends the Ask request (F17, following f3b-verify-address-sheet) and on Confirm (F21). The verify-sheet prompt disagrees with the house-style reading that Close is not a confirm (H20).
  - "Open Home" lands on the dashboard; brief §2.5's "Today is the first screen" is read as governing cold app starts only (H5).
  - B08 assumes the household's invite rules changed between 5:10 and 6:10 PM on Mon 19 Oct. flow-12 draws the same branch under its own fixture (invitation sent Mon 12 Oct, rules changed Wed 14 Oct, Priya with an account since Sun 18 Oct on an iPhone).
- Activation gap: no frame shows Priya turning on the briefing or the widget before Mon 26 Oct, so this storyboard does not show her activation completing (H14).
- Instrumentation questions: session_open meta.kind has no value for an invitation or a confirmation request. The email link needs src=email for F07 to count as 'email'; the copy-link and QR forms should not carry it (H3). Whether the web briefing card's browser-push Yes sets daily_briefing_enabled or evening_briefing_enabled (H14). §5's honesty counter covers only pickup pushes, so the flow's honesty aim (no implied address-verified action) is not instrumented.
- Superseded flows-spec wording: step 12 "in place of the control"; the postcard-pending string with no CTA; "Sam is verifying Maple St"; "What you get now" (now "What members can do now"); "about a week" (now "Postcards take 5–10 days"); "You and 2 others live here" (now names with "You" first).
- Omitted: web-1440 and dark twins of every frame; the document and landlord paths beyond their rows; the Guest role; Sam's own journey; Priya's Android install and any briefing or widget opt-in.

BATCH PLAN: Turn 1: artboards 2–3 (02-send, 02b-send-failures; about 16 frames), then wait for "continue". Turn 2: artboards 4–5 (03-accept, 03b-accept-failures; about 11 frames), then wait. Turn 3: artboard 6 (04-first-open; about 9 frames), then wait. Turn 4: artboard 7 (05-locked-and-ask; about 10 frames), then wait. Turn 5: artboards 8–9 (06-attest-and-result, 06b-attest-failures; about 17 frames), then wait. Turn 6: artboard 1 (the journey map, drawn from the finished lanes) and artboard 10 (handoff checks), then wait for "continue". Turn 7: artboard 11 (notes). Turns are sized by frame load, not artboard count, so no lane or list is truncated.
