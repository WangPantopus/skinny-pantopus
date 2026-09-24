# End-to-end flows (journeys that connect the surfaces)

---

## flow-01 — Stranger to activated: /start fact → save → account → verify on another device → Today → primer → first pickup night
- **Persona:** Maya Chen, 34. She moved into a rental at 1402 NE 3rd Ave, Camas, 5 days ago. She looks the address up on her work laptop at lunch and reads personal email on her iPhone at home.
- **Goal:** See one true fact about the new address, keep it without retyping anything, and have Pantopus tell her the night before her first bin day. That meets the §5 activation definition (saved + briefing or widget + one household fact) within 7 days.
- **Platforms:** web/ios/android
- **Moves metric:** Activation (saved + briefing or widget + one household fact within 7 days); secondarily Week-four return attributed to trigger=push.
- **Why a storyboard:** This flow crosses eight surfaces owned by four features (F8, F1, F4, F5), and it breaks in the gaps between them. Examples: an address held on the server but described as device-local, a primer that asks again after a Yes, and a confirmation dropped at T1. No single prompt covers register → verify on another device → Today → permission. The critique rated this path a blocker.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f8-positioning-copy | default (hero, contrast line under the lede) | She lands on /start from a search result, reads 'See what's true about your address.' and types 1402 NE 3rd Ave into the field above the fold. | Nothing before the preview asks for an account, location permission or notification permission. The field is the first interactive element. |
| 2 | f8-seasonal-aha | seasonal deadline (Oct 8), per-method copy | The headline card shows 'Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington.', the in-person line, the source 'Washington Secretary of State' and a date chip. She notices the source. | The fact is specific to this month and this state, shows its source, and is fully readable signed out. |
| 3 | f8-scale-strips | all four present, risk-detail size inside the preview's Band-A | She scrolls through Flood, Wildfire, Air today and Radon. Each is on its own authority's scale with a word, a number and a caption in the form 'authority · scope · as-of'. | No grade or verdict appears. Radon reads 'county-wide estimate', so it is not a claim about her apartment. |
| 4 | ext:start-wallbar | sticky wall, T0 | She taps 'Keep this address handy', and the wall explains: 'Today and a night-before pickup reminder run on it.' | The account ask arrives only at the moment she wants to keep something, and it names the benefit in one line. |
| 5 | ext:register | register form carrying the preview | She creates an account with her email on the laptop and submits. | The server stores 1402 NE 3rd Ave against the unverified account at register time. The address does not depend on the laptop's localStorage. |
| 6 | f1-email-verify-handoff | 1 · sent, address named (with the proposed code field and hold length) | She sees the 'Check your email' page with the pinned chip '1402 NE 3rd Ave, Camas, WA 98607' and 'Only you will see this.'. Below it are a paste-enabled 6-digit code field, 'Resend the link' with a spam-folder hint, and a line stating how long the address is held. | She can finish on the laptop by pasting the code. The copy says the place is already held, so she doesn't read the next step as a wall she must clear before anything is saved. |
| 7 | ext:email-client | verification email opened on iPhone Mail that evening | She ignores the code and taps the link on her phone. | The link works on any device and does not send her to a login screen first. |
| 8 | f1-email-verify-handoff | 3 · verified on a different device | She reads 'Saved 1402 NE 3rd Ave to your account.' with the same chip, then moves straight on. | The phone frame is pixel-identical to the same-device frame. Nothing about it looks like recovery. |
| 9 | f1-save-confirmation | 3 · saved | She sees 'Saved privately', a tick, and one line saying Today now runs on this address. The primary action is 'See Today'. She taps it. | The single sentence names what changed. The privacy caption says 'Only you'. There is no celebration. |
| 10 | f1-today-tab | 3 · warming → 4 · saved place with chip | Content-shaped skeletons fill in their final slots as weather, air, alerts and the calendar land. The location row reads '1402 NE 3rd Ave · Saved place · Only you'. | 'Nothing needs your attention today' never appears before every provider has returned. There is no welcome carousel, no coach marks and no permission prompt at first launch. |
| 11 | f4-today-pickup-card | unverified city rule | She reads 'Recycling and garbage tomorrow', the hollow mark and 'City schedule, not yet confirmed'. It matches the bins she saw on the curb, so she taps 'That's my day'. | The confirmation holds at T1: the source row flips to 'You · Tuesday' and the caveat disappears. This depends on the SCOPE_RANK saved_place fix. A toast that fades while the city caveat keeps showing would count as a failure here. |
| 12 | f4-notification-primer | default, entered from first 'That's my day' (native only) | On the iOS app (installed from the wall, see flow-14) she sees the real night-before notification drawn as an in-app illustration: 'Unconfirmed: pickup tomorrow' before she confirms, 'Recycling + garbage tomorrow' after. Under it: 'Continue' and 'Your phone will ask next.' | The purpose is concrete because she just confirmed a day. The primer does not imitate the system alert, and the button does not say 'Yes' or 'Allow'. |
| 13 | ext:os-permission-dialog | iOS one-time notification prompt | She taps Allow. | The one-shot grant is spent here, in context, and not at cold launch. |
| 14 | f4-briefing-optin-card | one on / one off | Back on Today, the night-before row reads '6:00pm · Change'. The morning row still asks. | The on state matches what the OS actually allows. The time she never chose is shown so she can change it. |
| 15 | f5-today-calendar-strip | ready, T1 | She taps the '+ Add a date' row at the foot of the strip. | The ask sits inside the section it fills. The first-week summary row names this as the next step and shows no fraction. |
| 16 | x-date-sheet | create → saved (lease ends, scope saved_place) | She picks Lease ends, types the date, sets the notice rule, and sees 'Only you will see this.' The save confirmation is announced as a status message. | She is now activated: saved + briefing + one date. The activation query and the Today first-week row agree on this. |
| 17 | ext:os-push-tray | Monday 6:00 PM evening briefing, confirmed rule | She receives 'Recycling + garbage tomorrow' with the body 'Bins out tonight · 3rd Ave' (street label only). | The push fires on her confirmed day, and only once. No house number appears on the lock screen. |
| 18 | f1-today-tab | 11 · arrived from a push, briefing pinned | She taps the push and the pickup card is pinned at the top. session_open{trigger:push,kind:pickup} is recorded. | The push lands on the exact card. With Today already open at 6 PM, the card is highlighted and no banner appears. |

**Failure branches:**
- Verification link opened on a device with no session and the server holds no draft (hold expired). f1-save-confirmation should show a selectable row '1402 NE 3rd Ave, Camas — Save it' when the server still has the address. The blank 'Street address' field is only for 'nothing was ever held'.
- Verification link expired. f1-email-verify-handoff frame 6 still shows the chip with 'We're still holding 1402 NE 3rd Ave' and 'Send a new link'.
- Mail app opens the link in an in-app browser with no cookies. It must land on the saved state, not on /login.
- expectedUserId mismatch (a different account is signed in on the phone). f1-save-confirmation frame 6 refuses to save and offers 'Preview it on this account'.
- A cold geohash returns partial results. The f1-today-tab partial frame names the provider that failed, offers Retry, and makes no all-clear claim.
- No city pickup rule exists for the address. f4-today-pickup-card shows the demoted 'Set your pickup day' line, which opens x-date-sheet. Pickup is never pushed without a day she set herself.
- Maya never installs a native app. Web has no primer: the night-before row on f4-briefing-optin-card asks for browser permission directly, or she relies on Today and email. The flow must still reach activation through the widget-less path (briefing on web or an email trigger).
- iOS OS prompt denied. The card falls back to one neutral line plus a single widget offer (flow-07). No amber nag appears on Today.
- Android declined once. The primer shows 'Continue' again, which re-fires the system dialog. Declined twice means blocked: only 'Open Settings' is offered. 'Not now' on Android never fires the system dialog.
- 'That's my day' save error. The card keeps the hollow mark and shows an inline retry. The primer must not open for a confirmation that failed.
- Address outside Clark County. The preview works nationwide, so the save must succeed with a line naming which layers exist there. f1-add-place-sheet currently refuses the address instead.

---

## flow-02 — Weekly pickup loop: push or no push, confirm, correct with 'Not my schedule', holiday move
- **Persona:** Luis Ortega, 41. He lives at 6519 NE 51st St, unincorporated Vancouver (Clark County), where recycling is every other week on his garbage day. He tapped 'Not now' on the first notification ask and opens the app on Sunday evenings out of habit.
- **Goal:** Know every week, with or without notifications, whether it is a garbage-only or a garbage-plus-recycling night. Fix a wrong city guess once so it stays fixed.
- **Platforms:** ios/android/web
- **Moves metric:** Honesty (zero pushes on a guessed schedule without the caveat; 'not my schedule' reports resolved) and Week-four return by trigger (push vs organic).
- **Why a storyboard:** The loop runs across Today, the pickup card, the provenance sheet, the Date sheet, the strip, the widget and the push tray, and the prompts disagree on where 'Not my schedule' leads. The notifications-off path and the holiday move exist in no prompt at all. This is the only weekly return trigger the pilot has.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f1-today-tab | 4 · saved place, organic open (notifications off) | He opens Today on Monday evening with no push. The pickup card sits directly under the location row. | The in-app card exists without a push. This is design rule 4, and it needs the single Today composition on both native apps. |
| 2 | f4-today-pickup-card | unverified city rule | He reads 'Recycling and garbage tomorrow', the hollow mark and 'Clark County solid-waste service map · not yet confirmed'. He knows recycling is next week, not tomorrow, so he taps 'Not my schedule'. | Both actions carry equal weight. The source is named, and it is the county map, not the City of Camas. |
| 3 | x-provenance-sheet | 2 · on record, unconfirmed → reason picker (schedule-type reasons) | He sees the hollow mark drawn large, 'Clark County solid-waste service map · Read 12 Aug 2026', and reasons tailored to a schedule. The lead action is 'Set my pickup day'. Under it is an optional checkbox: 'Also tell us the county map looks wrong'. | Fixing it himself is the first path. The report does not end the flow. |
| 4 | x-date-sheet | create with pickup day, recurrence branch open | He picks garbage on Tuesday, weekly. For recycling he picks every other week and enters 'Next recycling — Tue 27 Oct'. A read-only preview shows 'Tue 27 Oct · Tue 10 Nov · Tue 24 Nov', with the Thanksgiving-week move applied if the calendar is published. | The date anchor is explicit and he can check it. Recycling is never inferred from the garbage day. |
| 5 | f4-today-pickup-card | confirmed just now | The card now reads 'Garbage only tomorrow' with the source row 'You · Tuesday'. The caveat is gone. | His correction shows in the pixels immediately and survives a reload. If the county rule still renders, that is the SCOPE_RANK blocker. |
| 6 | x-provenance-sheet | 6 · report submitted | If he ticked the checkbox, he sees 'Reported Oct 19. We'll check it against Clark County Public Works by Oct 26 and tell you here.' | The receipt says when and where the outcome will appear. §5's honesty counter reads this report. |
| 7 | f5-today-calendar-strip | ready, user-entered rule | Tuesdays now carry a garbage glyph with a tick. Alternate Tuesdays add the recycling glyph. | Combined days look different from garbage-only days. Strip cells are not tap targets; list rows are. |
| 8 | f7-today-widget | fresh (if placed) | The widget hero changes from a hollow mark to a tick on the next snapshot write. | The confirm action rewrites the snapshot at once, so the widget never keeps showing the hollow guess. |
| 9 | f4-briefing-optin-card | never asked → Yes on night-before row | Now that the schedule is right, he taps Yes on 'The night before pickup?'. | The card's Yes goes straight to the OS dialog. He does not get a second primer asking Yes again. |
| 10 | ext:os-push-tray | following Monday 6:00 PM, confirmed garbage+recycling night | He receives 'Recycling + garbage tomorrow' with the body 'Bins out tonight · curbside by 6:30 AM'. | One push a night, with bins named, set-out time taken from the source, and no house number. |
| 11 | f4-today-pickup-card | moved for a holiday (proposed state) | In Thanksgiving week the card reads 'Garbage moves to Friday this week', shows a struck-through Thursday ghost, and cites 'Waste Connections 2026 holiday schedule'. The push fires Thursday evening, not Wednesday. | The push follows the moved day. Sending 'bins out tonight' on the usual evening would be a lie, whatever mark it carries. |
| 12 | f1-today-tab | 6 · quiet day with receipt line | On a night with no pickup, Today reads 'Nothing needs your attention today' with four ticked checks, and no push arrives. | The receipt shows only when every check succeeded, so the silence reads as finished work, not a broken app. |

**Failure branches:**
- The saved_place rule is dropped by applyPrecedence. The card keeps showing the county day after he confirms. This is a hard blocker: do not push unverified pickups to T1 until it is fixed.
- Push arrives while Today is open. There is no banner; the pickup card is highlighted instead.
- iOS Scheduled Summary holds the push. f4-notification-settings shows 'Pickup reminders may arrive with your summary', and the card on Today stays the guarantee.
- OS notifications denied later. f4-notification-settings shows the denied banner and 'Open Settings', which opens the Pantopus notification page, not the app's root settings. Today shows no amber line unless an in-app switch is on while the OS blocks it.
- Android 'Not now' on the primer must not spend a system-dialog denial.
- He taps 'That's My Day' as a notification action from the tray. The rule is confirmed in the background and the widget snapshot is rewritten without opening the app.
- Report failed. x-provenance-sheet frame 7 keeps the chosen reason and offers retry. The self-fix still applies.
- Holiday data for 2027 is not yet published. Marks after the last published calendar are drawn as projected, never as confirmed.
- He confirms a day, then a household member (T3) confirms a different day. The household rule wins and the row shows who set it.
- Offline. The card's actions are disabled with a reason, and the last content stays with 'Updated 2h ago'.

---

## flow-03 — Lease date from entry to the 60-day reminder to done
- **Persona:** Priya Raman, 29. She rents at The Blairmont, Vancouver, and her lease ends Wed 31 Mar 2027. It requires 30 days' written notice. She has a saved place only (T1) and her lease PDF open in another tab.
- **Goal:** Type the lease end once, be told early enough to act, and mark it handled so the reminders stop.
- **Platforms:** web/ios/android
- **Moves metric:** Activation (one important date) and Week-four/annual return with trigger=push, kind=date.
- **Why a storyboard:** This is the loop's annual-return promise, and it spans months and four surfaces: the Date sheet, the place file, the tray and the landing. The v1 fixtures put the reminder on or after the notice deadline. No prompt draws the reminder push, its landing for a date outside the strip, or what 'done' looks like.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | x-place-file | 3 · T1 saved place, Dates category with a missing row | She opens the Place tab and sees the year band with empty 'You' lanes and a missing row, 'When does your lease end?', with an 'Add date' button. | The missing fact reads as an invitation, not a failure. The count has no denominator. |
| 2 | x-date-sheet | create, Lease ends tile | She taps the Lease ends tile and types 03/31/2027 into a typeable field. Android opens in keyboard input mode; iOS uses the compact picker with a month/year jump. The field shows 'Wed 31 Mar 2027'. | A date 18 months away takes two or three taps, not paging through a calendar. |
| 3 | x-date-sheet | create, lease notice question (proposed) | She answers 'How much notice does your lease require?' with 30 days (options: 20 WA minimum / 30 / 60 / other, plus 'check your lease'). The sheet creates a linked row, 'Notice deadline · Mon 1 Mar 2027'. | The deadline she has to act on becomes its own row, with its weekday shown. |
| 4 | x-date-sheet | create, Remind me | She picks 60 days before the lease end. The leader line shows the whole series with real dates: Sat 30 Jan 2027 (60 days), Sun 28 Feb (day before the notice deadline) and Mon 1 Mar (notice day). The reminder copy names the action. | The control shows every reminder that will fire, and the 60-day reminder lands 30 days before the notice deadline, so it is still actionable. |
| 5 | x-date-sheet | saved | She reads 'Saved to your calendar. Only you.' as a status message. The footer says 'Only you will see this.' | The scope is stated at the moment of input. |
| 6 | x-place-file | T1, dates known | The year band 'You' lane gains two tick markers (Mar and Mar 1, grouped by month on a phone), and the Dates rows show both dates. | A date months beyond the 14-day window is visible and editable. Today it is otherwise invisible until 14 days out. |
| 7 | f1-today-tab | 4 · saved place | Today's first-week row moves to its next ask, or disappears if all steps are done. | The Today row and the place file agree on what counts as done. |
| 8 | ext:os-push-tray | Sat 30 Jan 2027 7:00 AM (morning briefing slot), date reminder | She receives 'Lease notice due Mon 1 Mar' with the body 'Tell your landlord in writing · Blairmont' and a 'Done' action. | The copy names the action and the deadline. The push is Active/DEFAULT urgency and shows no house number. |
| 9 | f5-today-calendar-strip | reminder deep link (rule highlighted) — or x-place-file Dates row when the date is outside the 14-day window | She taps the push. The app opens on the notice-deadline row with focus moved to it, then opens x-date-sheet in view-mine mode. | The landing shows the exact rule even though it is 30 days out, beyond the strip. The 14-day strip cannot host it. |
| 10 | x-date-sheet | view-mine (edit / remind / delete) + proposed 'Mark done' | She emails her landlord, then taps 'I gave notice' (mark done). | Marking done cancels the Feb 28 and Mar 1 reminders and says so: 'We won't remind you again about this.' |
| 11 | x-place-file | T1, row done | The Notice deadline row goes quiet with a tick. Lease ends stays as a fact. | Done rows recede; nothing is celebrated. |

**Failure branches:**
- The lead is longer than the time left (for example, a 60-day lead on a date 15 days away). The sheet suggests the nearest possible lead, e.g. 'That's already passed — remind 7 days before (Thu 24 Sep)?', instead of blocking.
- Collision. A lease end is already set. The warning shows the existing row's title and date. At T3 the options are Replace, Add as a separate calendar event, or Cancel; at T1 the limit is stated before she types.
- The notice deadline falls on a weekend. The sheet suggests acting on the Friday before.
- She doesn't know the exact day. 'Not sure of the day' saves month and year with an 'about' treatment, and the reminder fires at the start of the month.
- Notifications off. The 60-day reminder has no in-app twin until the date enters the 14-day strip, so the place file year band and a Today 'coming up' row must carry it.
- The lead_days CHECK is still 0–30 on the backend. A 60-day choice fails to save; the error must keep her input.
- She claims the address before January (flow-06). The rule moves to home scope, and her 'Only you' choice must hold unless she shares it.
- She taps the reminder after deleting the rule. The landing falls back with 'That date was removed' and never shows a blank screen.
- Household member without calendar.edit (T3). Fields are visible but disabled, with the reason stated.
- Offline. Save is disabled with 'You're offline'.

---

## flow-04 — Inviting a co-resident through acceptance, first open, the locked action, and owner attestation
- **Persona:** Dana Whitfield, 38, claimed and postcard-verified 1428 NE Maple St, Camas (owner). Sam Okafor, 32, her housemate, has no Pantopus account and reads email on a Pixel. Sam moved in Sep 3.
- **Goal:** Dana adds Sam in two taps. Sam joins knowing what access he gets, lands somewhere useful, and has a way to complete verification when he tries to message a neighbor.
- **Platforms:** web/ios/android
- **Moves metric:** Activation (one household fact: a second active occupant) and Honesty (no attested action implied for household-verified members).
- **Why a storyboard:** It runs across two people, two devices, email, registration and nine surfaces. The completable path depends on a push to the other person and a result coming back, and no single prompt shows that round trip. The critique rated the non-owner verification dead end a blocker.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f3-household-block | 2 · visible (place file People section) | Dana sees 'Who lives here with you?' and the privacy sentence, and taps 'Invite by email'. | The ask is on the Place tab where she actually lands. 'Just me' is a real button of equal weight. |
| 2 | f3-invite-composer | form (Email, default) | She types sam.okafor@example.com and picks Member. Under it she reads the caption 'Sees and edits the calendar, sees bills and who paid, sees who lives here'. | The role explains itself where she chooses it. |
| 3 | f3-invite-composer | review / confirm | The manifest lists Home, Role offered (with the same grant list Sam will see), Access and 'Expires Sep 30, 2026'. She sends. | The sender approves exactly what the invitee will read, built from one shared string. |
| 4 | f3-invite-composer | sent + recovery panel | She reads 'Invitation sent to sam.okafor@example.com' with a link and a QR code as a fallback. | 'Sent' is announced as a status. The roster shows a pending row with 'Expires Sep 30 · Resend'. |
| 5 | ext:email-client | invitation email on Android | Sam reads 'Dana Whitfield invited you to Maple St on Pantopus' and taps Review. | The email names the inviter and the home and says what joining gives. |
| 6 | f3b-invitation-decision | signed-out variant → offer | On mobile web Sam sees the manifest, 'Dana Whitfield and 1 other live here' (a count, no names), the column 'What you get now' and the column 'What needs address verification' written as verbs ('Message your neighbors' …). | The grant comes first, and the limits read as a list. A forwarded link does not expose the household's names. |
| 7 | ext:register | register with invite token preserved | Sam creates an account without installing the app. | The token survives registration and brings him back to the decision screen, not to an empty Place tab. |
| 8 | f3b-invitation-decision | accepted | He taps Accept and reads 'You're in.' The primary button is 'Open Home'; the secondary is 'Start address verification — postcards take about a week'. | Verification is offered, not pushed. The verify sheet does not open automatically. |
| 9 | f1-today-tab | 5 · claimed home (first open after accept) + one-time notice (proposed) | Today reads 'Today now uses Maple St · because you joined this household' with a link to Your places. The pickup card shows 'Dana · Wednesday, confirmed'. | The switch in Today's address is explained, not silent. He sees the household's confirmed day straight away. |
| 10 | f3-member-home-dashboard | 2 · member view | He opens the home and sees Members '3 people live here', the Calendar card and the Bills card '6 upcoming', each with a quiet 'View'. | The dashboard is useful read-only. No control is visible but inert. |
| 11 | f3-household-calendar | member with calendar.edit | He adds 'Chimney sweep · Sat Nov 14'. | The T3 toast 'Saved to your household calendar' is true. Dana later receives one quiet home_event_created row. |
| 12 | f3b-locked-action-row | household-verified, locked with reason (Nearby neighbor-message compose) | In Nearby he taps Message a neighbor and sees 'Address verification needed to send neighbor messages · Verify address' in place of the control. | He gets an explanation, not a 403 or a dead tap. The text meets contrast (not text.muted on sunken). |
| 13 | f3b-verify-address-sheet | method unavailable to a non-owner occupant, owner-attestation offered | The header reads 'To send neighbor messages, we need to confirm you live here.' Postcard and document show their requirements; landlord is greyed with a reason. 'Ask Dana Whitfield to confirm · Usually same day' is offered. He taps it. | At least one method he can finish is shown, with an honest estimated time. |
| 14 | f3b-verify-address-sheet | request sent / attestation pending (proposed) | He reads 'We asked Dana. You'll hear here when she answers.' | The request is a visible state, so he doesn't tap again or give up. |
| 15 | ext:os-push-tray | Dana's phone, household update | Dana receives 'Sam is verifying Maple St' and taps it. | The push lands on the attestation sheet, not on the dashboard. |
| 16 | f3b-owner-attestation | request pending → confirming → confirmed | Dana reads 'Does Sam live here?', the grant rows, and the consequence line 'does not give Sam ownership'. She ticks the box and confirms. | She approves the same unlock list Sam was shown. |
| 17 | f3b-locked-action-row | address-verified (control live) | Sam gets an in-app row, 'Dana confirmed you live at Maple St', and the compose control is live. | The result reaches the requester, and the unlock is immediate. |
| 18 | f3-members-roster | owner/admin view | Dana sees Sam under Members with a quiet caption. There is no status chip on the person. The pending row is gone. | The roster does not rank housemates by how they were verified. |

**Failure branches:**
- The invitation expired. f3b-invitation-decision shows 'This invitation expired Sep 30. Ask Dana Whitfield to send a new one.', and the roster offers a one-tap Resend.
- INVITE_POLICY_CHANGED after the permissions migration. See flow-12.
- Sam declines. The decision frame says 'Dana will see that this invitation was declined'. The roster row reads 'Declined · Sep 16' with Remove only.
- Sam is signed in with a different email than the invite. The page states the mismatch and offers to accept anyway or switch accounts.
- Dana chose 'Share a link'. The exposure warning appears when she picks it. A person who joins by link waits in 'Waiting for Dana's OK' and sees no household data until approved.
- Dana declines the attestation or taps 'Not now'. Sam's sheet must show 'Dana didn't confirm' with the postcard path, not an endless pending state.
- Dana has revoked Sam's access since the request. The attestation shows that state, and Sam's dashboard shows 'Your access to Maple St ended.'
- Postcard pending. The locked row reads 'We're checking your postcard code — expected by …' with no CTA. A late-arrival path is enabled only after the expected window.
- Android canPerform early return. A visible control does nothing. The row must replace the control; a silent no-op is a failure.
- Sam already has a saved place and Today silently switches to Maple St. The one-time notice (step 9) is required.
- The household block keeps showing for Sam because of the 'within 7 days of occupancy start' trigger. It must show the read-only 'You and 2 others live here'.
- Offline at accept. Accept is disabled with a reason, and the token is kept.

---

## flow-05 — Compare card: sender mints → friend opens on a phone → reveal → friend sends their own
- **Persona:** Maya Chen, 34 (sender, from flow-01), on mobile web. Jordan Lee, 36, is her friend. He just moved to 6207 NE 42nd Ave, Vancouver, and opens the link in iMessage on an iPhone during his commute.
- **Goal:** Maya shares the readings, not her address. Jordan sees hers, types his own address, sees both on one instrument, and sends his back.
- **Platforms:** web/ios/android
- **Moves metric:** Spread (k = compare rate × hop × reveal ≥ 0.3) and Honesty (zero cards read as a claim about a neighbour's home).
- **Why a storyboard:** The flow passes from the sender's sheet to a third-party messenger unfurl, a stranger's phone, and back again, and each surface was prompted with a different sender, different strings and different freshness labels. The spread metric is measured across exactly these hand-offs.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f8-seasonal-aha | seasonal deadline (T0 preview) | Maya reads her preview and taps the tertiary 'Compare with a friend' under the aha card. | The spread action is there but does not outrank the save CTA. |
| 2 | f8-compare-sheet | 1 · idle (link pre-minted on open) | She sees the card preview at 1.91:1 with the city and the four strips, then 'This card shows readings and your city, never your address. Anyone with the link can see this card until {exp}.' | She reads the consent before any link exists or is sent. |
| 3 | f8-compare-sheet | 2 · name field shown | She turns on 'Show my first name', types Maya, and the preview updates to 'Maya · Camas, WA'. The link is re-minted in the background. | The preview shows exactly what the token will contain and nothing more. |
| 4 | f8-compare-sheet | 7 · share sheet opened | She taps Share. navigator.share is called synchronously and she picks Jordan in Messages. | No network wait sits between the tap and the share, so transient activation holds. |
| 5 | f8-og-compare-card | 1 · vs valid, first name shown (in an iMessage bubble) | Jordan sees the unfurl: the image, and under it the title 'What's on record at Maya's place. Yours?' | The title line, not text inside the image, carries the question. The image is readable at bubble size and never renders as a broken image. |
| 6 | f8-compare-arrival-header | 7 · below 640px, collapsed sender strip | He sees a one-line text strip, 'Maya · Camas, WA · Flood X · Wildfire Moderate · Air on Sep 12 · 42 · Radon Zone 1 ›', above an address field that already has focus. | The field is in the first viewport, and nothing blocks typing while the token verifies. |
| 7 | f8-compare-arrival-header | 2 · valid, sender named → typing | He types 6207 NE 42nd Ave and taps 'See your place'. | The contrast line sits below the field, and the privacy proof line is visible. |
| 8 | f8-compare-reveal | 1 · loading → 2 · both revealed | He sees one table in fixed order (Flood · Wildfire · Air · Radon). Each row has one track with Maya's filled mark and his ringed 'You' mark. The Flood and Wildfire rows are tagged 'Different band'. | Nothing ranks one home against the other: no arrows, no winner, no re-sorting. Air shows both dates. |
| 9 | f8-compare-reveal | 2 · both revealed, recipient aha below the divider | Below a quiet divider he reads his own aha, 'Zone AE — 1% chance of flooding each year (about 1 in 4 over 30 years) · FEMA', followed by a neutral next step, 'What Zone AE means · FEMA'. | The more serious reading comes with an authority's action, not with alarm. |
| 10 | x-provenance-sheet | 1 · official (flood payload, 'Covers: area zone') | He taps the Flood row and reads the method, the effective date, and 'Only FEMA can change this' with a LOMA link. | The whole row is the tap target, and disputes go to the authority. |
| 11 | f8-compare-sheet | 9 · reciprocal variant | He taps 'Send yours back', leaves the name toggle off, and taps 'Send my card'. The card is minted from the address he just typed. | It is clear which address's readings the new card carries, and his address still never appears. |
| 12 | f8-og-compare-card | 2 · vs valid, no first name | Maya receives 'A place in Vancouver, WA · Yours?' in the same thread. | The loop closes. t0_compare_viewed and t0_aha_viewed share one anon_id. |
| 13 | ext:start-wallbar | sticky wall after reveal | Jordan taps 'Keep this address handy' and continues into flow-01 from step 5. | The wall offers saving, and makes no claim or Founding promise unless founding_open is true. |

**Failure branches:**
- Expired or tampered token. f8-compare-arrival-header frame 4 shows a quiet banner and the ordinary hero, and the OG card falls back to the generic card, never an error image in the chat.
- Jordan's address fails to geocode. f8-compare-reveal frame 4 keeps Maya's marks and retries inline; the funnel does not reset.
- Unsupported region. Maya's column stays and one line explains the gap.
- Both marks fall in the same band on every row, the most common case. The marks merge and read 'Same band'.
- Jordan already has an account (signed-in viewer). The header swaps Sign in for Save this address. Where that button goes (the add-place sheet or the save confirmation) is currently undefined.
- The sender used native. The card is anonymous and the caption says so. Native sends are not counted in spread until the native funnel emitter exists.
- Share cancelled or no targets (AbortError). The sheet returns to ready with 'Copy link' visible, not an error.
- Rate limited. The sheet shows distinct copy with a time estimate.
- Token verification offline. Decodable chips render, or the expired banner; a spinner never hangs.
- Same geohash-6. The Founding same-block line describes the block's slots and never says 'you two are on the same block'.
- Jordan has the iOS app installed. The link opens web /start (no universal link defined), so the native funnel is bypassed.

---

## flow-06 — Saved place → claim → claim receipt with what carried over
- **Persona:** Maya Chen, 34 (flows 01 and 09). Three weeks after saving 1402 NE 3rd Ave, she decides to claim it: she wants to add her roommate and use Mail Day. She has a confirmed pickup day, two dates and (phase 2) a keeper named Ollie.
- **Goal:** Upgrade the bookmark to a home without losing anything she typed, and decide for herself whether her dates become visible to the household.
- **Platforms:** web/ios/android
- **Moves metric:** Week-four return (retention of invested facts) and Honesty (no silent scope change).
- **Why a storyboard:** The critique found that no feature owns this promotion. Data keyed to the saved place, the Today chip, the saved-places row, the widget label, the keeper and a privacy change all shift at once across seven surfaces. It is the most likely path for a mover and the moment of maximum investment.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f1-your-places | 3 · single place, overflow open | She opens Your places and taps 'Claim this address' on the row marked 'Used for Today'. | Claiming is a deliberate, separate action, never the default path of a CTA labelled 'Preview' or 'Save'. |
| 2 | ext:claim-verify-flow | existing claim flow, postcard method chosen | She requests a postcard. | The flow says what happens to her saved-place data. The pending state is visible on the place file Proof row. |
| 3 | x-place-file | 3 · T1 with Proof row pending (proposed) | The Proof row reads 'Postcard mailed Sep 20 · expected Sep 25–Oct 1 · code expires Oct 20'. | The time range has a real upper bound, and 'send a new code' stays disabled until that window has passed. |
| 4 | ext:claim-verify-flow | code entry → success | She enters the code from the postcard. | The server copies saved_place rules and preferences to home scope in the same transaction. |
| 5 | f1-claim-receipt | all four carried (dense) | Under the existing success headline she reads 'Your pickup day, 2 dates and Ollie came with you.' and a manifest row for each item with its value. Each date row shows 'Only you → Household (pending)'. | The counts in the sentence match the rows, and nothing is shared yet. |
| 6 | f1-claim-receipt | consent block (conditional copy) | She reads 'Share the 2 dates you entered with the people who live here?' with two peer buttons. She taps 'Keep them private to me'. | Leaving the screen without choosing keeps the dates private. The choice can be undone later. |
| 7 | f1-claim-receipt | household-visibility consent declined | The date rows show the private glyph on both sides of the arrow. The closing line reads 'Today now uses this home.' | The receipt states the result of her choice as a fact. |
| 8 | f1-today-tab | 5 · claimed home, no chip | Today shows the same sections in the same order. The 'Saved place · Only you' chip is gone, and the pickup card now reads 'You · Tuesday' at home scope. | The change reads as 'more sections appeared', with no re-layout and nothing lost. |
| 9 | f1-your-places | 6 · row already claimed | She sees one row for 1402 NE 3rd Ave, now with the home glyph and 'Today always uses your home'. There is no duplicate saved row. | The retired SavedPlace row does not show up as a second copy of the same address. |
| 10 | x-place-file | 2 · T3 claimed home + one-time receipt banner + persistent 'What moved when you claimed' row (proposed) | She sees the banner once, and later finds the same manifest under Place → 'What moved when you claimed'. | The receipt can be found again. Money, People and Proof now show real asks. |
| 11 | x-date-sheet | view-mine at home scope with per-date visibility control (proposed) | She opens Renters insurance and sees 'Visible to: Only you · Household'. She switches it to Household. | The decline from step 6 can be reversed one date at a time, as easily as she gave it. |
| 12 | f7-today-widget | fresh | The widget label stays '3rd Ave · Camas' and the marks update on the next snapshot. | The claim rewrites the widget snapshot, so no stale scope lingers. |
| 13 | f11-keeper-strip | attentive (T3) | Ollie is still Ollie. The naming scope line now reads 'Everyone in this household sees this.' | The keeper survives the claim, and the change in who can see it is stated. |

**Failure branches:**
- A carry fails. The receipt names the failed row with Retry and never shows a quiet success with a row missing.
- Nothing to carry. The plain success screen shows no empty list.
- She claims a different address than the saved one. Today switches, and a one-time notice reads 'Today now uses {home}. {saved} is still saved.'
- The address is already claimed by someone else. The flow becomes a household request or invitation path, not a duplicate home.
- The home already has a keeper (the claim merges into an existing household). The receipt must say which keeper is kept.
- The claim receipt is dismissed without a choice. Dates stay 'Only you'. Past-tense copy saying they are 'now visible' must not appear.
- The postcard does not arrive. After the stated window a late path appears, with a warning that the old code will stop working.
- Mover rows are keyed on Home.move_in_date, which does not exist at T1. At claim, move-in must be asked for or carried, or the 60-day mover rows never appear (f6-home-basics-rows).
- Offline at receipt. Consent buttons are disabled with a reason, and the default stays private.

---

## flow-07 — Widget discovery → add → glance → tap
- **Persona:** Hannah Ruiz, 52, a nurse on night shifts who moved to 1420 NE Garfield St, Camas. She has a Pixel 8 on Android 15, declined notifications (they wake her), and checks her home screen many times a day.
- **Goal:** Get pickup day, air and her next date on the home screen with no notifications. Tapping it opens the exact thing shown.
- **Platforms:** android/ios
- **Moves metric:** Activation (widget snapshot counts as the return trigger) and Week-four return with trigger=widget.
- **Why a storyboard:** This is the only return trigger that needs no permission. It runs from an in-app hint through the how-to sheet, the OS pin dialog or gallery, the home screen, overnight timeline changes and a deep-link landing. Four prompts disagree on sizes, labels, marks and where a tap lands, and the funnel is invisible without this storyboard.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f4-briefing-optin-card | OS notifications denied (neutral line + one-time widget offer) | After declining, Today shows one neutral line: 'Pickup still shows here on Today · Or put it on your home screen'. | The widget is offered once, at a teachable moment, never as a blocking modal and never more than once in 24 hours. |
| 2 | x-place-file | widget row present | Later she taps 'Put today on your home screen' on the place file. | The durable entry point exists after the one-time hint has gone. |
| 3 | f7-widget-howto-sheet | 2 · Android default with pin action (proposed) | She sees her own medium widget labelled 'Your widget' (Tuesday recycling, AQI band), and a primary 'Add to home screen' button because requestPinAppWidget is supported. | She sees the reward before any instructions. The preview is clearly an illustration. |
| 4 | ext:os-pin-dialog | Android system pin dialog with preview | She taps Add. | The system places the widget; no gestures are needed. |
| 5 | f7-today-widget | fresh, Android 4×2 (dynamic colour) | The widget shows the hero 'Recycling + garbage tomorrow' with a tick, a 14-day strip across the full width, and 'AQI 42 · Good' on the band. | The text is 11pt or larger, and meaning survives dynamic colour and greyscale. |
| 6 | f7-today-widget | fresh, next day after midnight entry | She glances after her shift and 'Tomorrow' has become 'Tonight', without her opening the app. | Relative words are computed at render time from ISO dates, using timeline entries at day boundaries. |
| 7 | f7-widget-tap-landing | 1 · loaded from widget, section=pickup | She taps the hero. Today opens scrolled to the pickup card, highlights it once, and shows 'Updated just now'. | The tap opens the exact fact. Content never blanks; a hairline shows only if the refresh takes more than 1 second. |
| 8 | f7-widget-tap-landing | 2 · refreshing in place → snapshot rewritten | The refresh finishes and session_open{trigger:widget} is posted. | A forced refresh writes the snapshot, so 'Open to refresh' can never leave the widget grey. |
| 9 | f7-today-widget | AQI-hero day (AQI ≥ 101) | On a smoke day the hero is 'Unhealthy for sensitive groups · 118'. She taps it. | The urgency ladder chooses the hero, and the widget and Today agree about it. |
| 10 | f1-today-air-band | alert: moderate, arrived from widget (section=air) | Today opens with the air band in view, the crossing marked, and the EPA health statement. | She doesn't have to scroll to find the tapped fact, and the pinned slot shows the active crossing for any arrival. |
| 11 | f7-today-widget | stale per fact | After a two-day trip the pickup and date lines still render correctly, and only the AQI row greys with 'Observed Mon 7:00 am'. | Staleness is judged per fact. Rule-based facts are not greyed out. |
| 12 | x-place-file | widget row gone | The 'Put today on your home screen' row no longer appears. | The app knows a widget is placed (a snapshot read or a pin callback) and stops asking. |

**Failure branches:**
- The launcher doesn't support pinning. The how-to sheet falls back to gesture steps via the app icon: touch and hold → Widgets → drag.
- iOS. There is no pin API; the sheet shows three illustrated steps ('Tap Edit, then Add Widget, and search for Pantopus'). She adds it from f7-widget-gallery, where the preview uses her own snapshot.
- No snapshot was ever written. The preview shows the 'Sample' gallery composition.
- No place. The widget reads 'Save an address to see today here', and the tap lands on f1-add-place-sheet. The labels 'Add a place', 'Save an address first' and 'Save an address to see today here' must lead to the same place.
- Android maps 'today' to the hub briefing screen. The tap lands on a different payload and hard-errors for T1. This must be fixed or the widget is decoration.
- Refresh fails. 'Couldn't refresh · Retry' appears, with the last content intact.
- Cold start. The full skeleton is allowed only when there is no prior content.
- Whole snapshot past its horizon. Everything greys, with 'As of Mon 7:40 am · Open to refresh'.
- iOS StandBy or tinted mode. The small widget has no background and uses shape-only provenance, or StandBy is declared disfavoured.
- Air reading missing. That row drops and the layout rebalances; the whole widget is never marked failed.

---

## flow-08 — Mail snap to paid (phase 2)
- **Persona:** Dana Whitfield, 38, owner of 1428 NE Maple St, Camas (T3, finance.manage), on a Wednesday evening with a stack of 6 envelopes. Sam Okafor, the housemate, also pays bills sometimes.
- **Goal:** Turn paper into confirmed bills with reminders, mark one paid, and make sure Sam doesn't pay it again.
- **Platforms:** ios/android/web
- **Moves metric:** Week-four return (monthly return with investment) and Honesty (no unconfirmed read reaches bills; no reminder after paid).
- **Why a storyboard:** It spans the scanner, the queue, the review, triage, Today, a push, bill detail, a second person's notification list and the trend. The prompts use different fixtures, disagree on who added the bill, and don't say where 'paid' is confirmed or how undo works.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f10-mail-day-triage | populated | From the Mail tab she sees 'Mail Day · Wednesday' and the persistent 'Scan today's stack', and taps it. | The capture action is always available, not only in the empty hero. |
| 2 | ext:system-document-scanner | VisionKit / ML Kit batch session | She scans three pages; auto-capture handles the edges. | The claimed-home and finance checks run before the scanner opens. |
| 3 | f10-snap-capture-tray | post-capture queue (proposed redraw) | She sees three thumbnails uploading. She taps page 2 and chooses 'Same letter as previous'. The audience line reads 'Only your household can see these photos: you and Sam.' She taps Done (2). | Pages are grouped into pieces, and the audience is named. |
| 4 | f10-mail-day-triage | mid-upload rows | Two rows show 'Unconfirmed' with thumbnails. | The rows stay in 'Needs a call' until she decides. |
| 5 | f10-extraction-confirm | extracted, low confidence (Piece 1 of 2) | She sees the photo beside the fields. Amount $184.62 has a crop and 'Read beside "Amount due"'. Due date is flagged 'We weren't sure — check this' with 'Oct 2 (Due date) · Sep 12 (Statement date)'. She taps Oct 2. | Checking costs less than trusting; the correction happens in place with no reason picker. |
| 6 | f10-extraction-confirm | saving → success | She taps 'Add $184.62 due Oct 2 to bills' and reads 'Added $184.62 to your calendar. We'll remind you the day before.' with Undo. | The commit button restates the values. The word 'Paid' never appears. |
| 7 | f10-extraction-confirm | extracted (Piece 2 of 2) → 'Just file it' | She files the Chase statement without creating a bill. | Filing without a bill is a first-class commit. |
| 8 | f10-mail-day-triage | reviewed today → Finish day | Reviewed rows collapse, each with its own Undo (no countdown). She taps Finish day. | Undo lasts until the day is finished, and the copy never claims 'all your mail'. |
| 9 | f5-today-calendar-strip | ready with money row | Today shows 'Clark PUD · $184.62 · in 12 days · Fri 2 Oct' with a tick. | The bill appears wherever the calendar renders. |
| 10 | ext:os-push-tray | Thu Oct 1 bill reminder | She receives 'Clark PUD due tomorrow' with the body 'Maple St', and no amount on the lock screen. | One reminder, and it lands on the bill itself. |
| 11 | f3-bill-detail-web | due today / unpaid (native BillDetail equivalent) with f10-bill-provenance block | She sees the amount and due date as the headline, and under them 'From a photo you took · Sep 16'. She pays at the utility, then taps Mark paid. | The provenance is evidence beneath the number, not a banner. |
| 12 | f3-bill-detail-web | paid (proposed undo) | She reads 'Marked paid · Undo'. The bill_paid fan-out waits until the undo window closes, and the remaining reminders for everyone are cancelled. | A mis-tap does not notify the household, and Sam is not reminded about a paid bill. |
| 13 | f3-household-notifications | unread list (Sam) | Sam sees the quiet row 'Dana marked Clark PUD paid' and taps it. | The name comes first and the row lands on the exact bill. |
| 14 | f3-bill-detail-web | paid — landing from notification | Sam reads 'Paid by Dana · Thu' in a calm state. | It reads as reassurance, not an error. |
| 15 | f10-bill-trend | 12 months present | Dana scrolls to see her October column and the average of 14 homes nearby, drawn as a reference line. | This is the monthly payoff, with the k stated and no household-vs-household bars. |

**Failure branches:**
- No claimed home (T1). Mail Day reads 'Mail snap needs a claimed address' and routes to x-date-sheet bill mode. That mode is described as pre-filled from a snap, which makes the route circular.
- Member without finance.view. They see that a piece arrived but not the payee, amount or photo. 'Add to bills' is disabled with a reason; 'Just file it' is allowed.
- AI unavailable. Fields are blank placeholders, never $0.00 or today's date; 'Needed to add a bill' appears only after she presses Add.
- Unreadable photo. She is offered a retake or manual entry.
- Duplicate suspected. 'You already have Clark Public Utilities · $184.62 · due Oct 2' with Keep both / Replace.
- Scanner unsupported (iOS isSupported false, Android RAM under 1.7 GB). Fallback to Photo Picker or a single camera shot. Camera permission denied applies on iOS and web only.
- Upload failed or offline. Pieces are held locally with per-item retry.
- Sam also taps Mark paid at the same moment. The second sees 'Already marked paid by Dana'.
- A member wants to record their own payment. 'I paid this' is not offered today, so the member caption must name who can mark it paid.
- Bill deleted after the push. 'This bill was removed' with a route back.
- 'cancelled' vs 'canceled' filter bug. A deleted snapped bill stays listed.
- She photographed a bank statement by mistake. f10-mail-snap-privacy lists the snaps and allows deleting one or all; the bills survive.
- insufficientData. The trend draws bars with no reference line and 'Not enough homes nearby to compare yet'.

---

## flow-09 — First open of the keeper (phase 2)
- **Persona:** Maya Chen, 34 (T1 saved place, pickup confirmed, one date set), in week 3 on her iPhone at 7:40 am, checking whether recycling is tonight before work.
- **Goal:** Answer 'what's due' first. Optionally give the place a face in one tap, or skip permanently at no cost.
- **Platforms:** ios/android/web
- **Moves metric:** Week-four return (does the face change return?) — measured also by removal rate; must not affect Honesty.
- **Why a storyboard:** The first encounter decides whether the keeper feels like a nag. The doc and the prompts disagree on auto-presenting it, on what happens after Skip, on the species list and on the count, and the strip, the sheet and the place file each draw part of the moment.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f1-today-tab | 4 · saved place, keeper slot reserved | Today loads with the pickup card first. The keeper slot holds a quiet inline invitation, 'Give your place a keeper'. | Nothing auto-presents. She can use Today while ignoring the invitation. |
| 2 | f11-keeper-strip | 2 · unnamed | On her third visit she taps the invitation. | The invitation appears only for a limited time and never as a badge or modal. The silhouette meets contrast. |
| 3 | f11-keeper-naming | 1 · default | She sees six species tiles, a name field, and 'Name the keeper' and 'Skip' as equal buttons. The scope line reads 'Only you see this.' | Skip is a real, neutral button. No pronouns, traits or quiz. |
| 4 | f11-keeper-naming | 2 · species picked | She picks Octopus, and 'Ollie' is pre-filled with the counter at 5/24. | One tap is enough. Selection is not styled like the focus ring, and focus does not jump to the field. |
| 5 | f11-keeper-naming | 4 · saving | She taps 'Name the keeper'. | The save is announced as a status message. |
| 6 | f11-keeper-strip | 4 · attentive | The strip shows Ollie's pose settling into 'Recycling tomorrow.' and a count, '6 on file', with only the categories reachable at T1 drawn. | The mood comes only from obligations; the pose is helpful, never distressed. There is no denominator or unreachable segments, and a static pose under Reduce Motion. |
| 7 | x-place-file | 3 · T1 saved place | She taps the count and lands on her place file. | The keeper's count and the place file's count are the same number. |
| 8 | f11-keeper-strip | relaxed / quiet day (next week) | She reads 'Nothing due this week.' | The relaxed state appears only when the checks succeed. |
| 9 | f11-keeper-strip | 7 · mood unavailable | One morning a check fails, and she reads 'Couldn't check what's due · Retry' with a neutral pose. | It can never be mistaken for relaxed. |

**Failure branches:**
- She taps Skip. The keeper slot closes completely, with no leftover invitation. She can come back through a Place-section row in the place file or through Settings. The f11-keeper-naming 'Skipped' frame currently keeps the invitation.
- An air alert is on screen. The avatar and mood are suppressed, and the alert owns the screen.
- Offline. The last-known mood is greyed with 'as of 7:04 am'.
- She later claims the address (flow-06). The keeper carries over and its scope line changes.
- T3 member without rename rights. The strip shows 'Only Sam can rename this keeper'.
- Remove. Optimistic with Undo, and the copy carries no creature emotion.
- The doc's F11 says to auto-present on the second open. That must not ship.
- The keeper never sends a push, carries promotions, or shows a streak.

---

## flow-10 — First alert push for a bookmarked address (air/NOAA) → landing → mute or threshold
- **Persona:** Luis Ortega, 41 (flow-02). He also saved 'Mom's house' in Camas. During a Gorge smoke event he gets his first ever alert push from Pantopus, having only turned on the pickup reminder.
- **Goal:** Understand which address the alert is about and why he got it, and turn alerts down if he wants, without losing the pickup reminder.
- **Platforms:** ios/android/web
- **Moves metric:** Honesty (no push that misstates urgency or address) and Week-four return (alerts must not drive opt-outs).
- **Why a storyboard:** For most T1 users this is the first push ever, about an address they only bookmarked. It crosses the tray, the landing, the provenance sheet and settings, and the prompts disagree about which threshold is drawn.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | ext:os-push-tray | Time Sensitive (AQI ≥ 151) | He receives 'Unhealthy air: AQI 176' with the body 'AirNow, 4:00 PM · Lacamas Dr'. | The urgency level matches the event. The place label is there, with no house number. |
| 2 | f1-today-air-band | alert: critical, saved place chip | The landing shows the address label with 'Saved place · Only you', the band with his chosen threshold marked 'Crossed 151 at 4:00 PM', EPA's health statement, and a separate Pantopus context line. | The screen agrees with the push about which address and which threshold. |
| 3 | x-provenance-sheet | 4 · no source_url (AirNow) | He taps the band and reads 'Preliminary reading from AirNow, observed 4:00 PM · Covers: nearest monitors'. | The reasons offered fit the reading ('reading looks wrong'), not 'the date is wrong'. |
| 4 | f4-notification-settings | default populated | From the row overflow 'Turn these off' he opens settings. Under Air & weather alerts he picks '201+' from a radio list and leaves the evening briefing on. | There is a switch for alerts, and changing it does not touch the pickup reminder. The row reads the OS channel state. |
| 5 | f1-today-air-band | still unhealthy, no new push | Two hours later AQI is 182 and no second push has come. | There is one push per crossing episode, updated in place. |

**Failure branches:**
- No reading. 'No reading for this address right now' looks different from Good.
- Stale observation. The time is stated with its age.
- The Android channel is blocked. The row reads 'Off in Android settings · Open'.
- Focus mode. Only the air group's helper text says alerts can break through Focus.
- The alert is about 'Mom's house' but Today uses another place. The landing must still show which saved place triggered it; the rule for which saved places alert is undefined.
- The settings default (151) and the backend (≥101) disagree. The landing would mark a threshold the user did not choose.
- Location source is none. No alert is sent.

---

## flow-11 — 'This isn't right' from report to visible resolution (honesty counter)
- **Persona:** Jordan Lee, 36 (flow-05), now a saved-place user at 6207 NE 42nd Ave, Vancouver. He believes both the seeded tax-appeal row and the county pickup day are wrong.
- **Goal:** Report a fact once, fix what he can himself, and later see what happened, on the same row.
- **Platforms:** web/ios/android
- **Moves metric:** Honesty (the §5 counter's 'not my schedule' reports, resolved and visible).
- **Why a storyboard:** The pilot's only zero-target metric reads this report. No prompt draws what happens after 'Thanks — we'll check it', or where the outcome shows up.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f5-today-calendar-strip | seeded statewide/county rule row | He taps the list row 'Property-tax appeal window closes' (not the dot). | The row is the tap target, at least 44pt. |
| 2 | x-date-sheet | view-seeded (tax appeal as a rule with input) | He reads 'Closes July 1, or 60 days after your value notice was mailed' and enters the mailing date. The row becomes a computed date with a tick. | A conditional deadline is never shown as a single seeded date. |
| 3 | x-provenance-sheet | 5 · reason picker (schedule payload) | On the pickup row he opens 'This isn't right' and picks 'Not my day'. | The reasons fit the kind of fact. |
| 4 | x-provenance-sheet | 6 · report submitted | He reads 'Reported Sep 16. We'll check by Sep 23 and tell you here.' | The receipt promises a check-by date and names where the answer will appear. |
| 5 | x-place-file | 'Your reports' row (proposed) | He sees 'Pickup day · Checking · reported Sep 16'. | There is a private list of his reports and their status. |
| 6 | x-provenance-sheet | resolved (proposed) | A week later the sheet reads 'Fixed Sep 20: the county moved your route to Wednesday'. The pickup card updates to match. | The correction appears where he already looks, with its source and a one-line reason even when nothing changed. |

**Failure branches:**
- Flood zone disputed. The sheet says 'Only FEMA can change this' and links to LOMA; it never promises to check.
- Radon disputed. The answer is 'County zone, not a reading of your home' with a free kit link.
- 'We matched the wrong spot' (a Pantopus geocoding error) is a separate reason from 'the map is wrong'.
- Report failed. Retry keeps the chosen reason.
- Offline. The report control is disabled with a reason.
- The check-by date slips. The founder must commit only to a window she can actually meet.

---

## flow-12 — Dead invitation → sender reissue → recipient accepts
- **Persona:** Tova Lindgren, 27, invited by username to 4312 NW Sierra Dr before the permissions migration; she taps the old link a week later. Dana Whitfield is the sender.
- **Goal:** Neither person gets stuck: the sender learns an invitation died and fixes it in one tap, and the recipient gets a fresh working link.
- **Platforms:** web/ios/android
- **Moves metric:** Activation (co-resident added within 7 days).
- **Why a storyboard:** This is a loop across two people that the migration creates on day one. The sender half has no entry point in the doc, and the banner, roster, composer and decision screen each hold one piece.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f3b-invitation-decision | INVITE_POLICY_CHANGED blocked | Tova reads 'This home changed who can invite people. We've told Dana Whitfield.' | She is not asked to chase someone who can see nothing wrong. |
| 2 | f3-invite-banner | needs reissue (sender) | On Dana's landing, one banner reads '2 invitations need to be sent again · Fix'. | The precedence rule applies: invite > reissue > setup > verify, and only one banner shows. |
| 3 | f3-members-roster | needs reissue | Pending rows show 'Needs reissue' with a Reissue action. | One tap per row. |
| 4 | f3-invite-composer | needs reissue → sending → sent | Dana confirms, and a new link and expiry are shown. | The old link stops working, and the new expiry is stated. |
| 5 | f3-invite-banner | one invite (recipient) | Tova's landing shows 'Dana Whitfield invited you to Sierra Dr · Review'. | The recipient does not need to find the email again. |
| 6 | f3b-invitation-decision | offer → accepted | She accepts and continues as in flow-04 from step 8. | The grant list matches what the sender reviewed. |

**Failure branches:**
- Multiple invites. 'You have 3 invitations' opens an invitations list that no prompt draws.
- Fetch failed. The slot stays silently empty and nothing below it shifts.
- Tova is signed out. The token is preserved through registration.
- Dana has no manage rights. The row explains who can reissue.
- The new-invitation push has no defined copy or landing.

---

## flow-13 — Mover's civic deadline: seasonal aha → plan → reminder → self-report
- **Persona:** Jordan Lee, 36, moved from Portland, OR to Vancouver, WA in September, and has never registered in Washington.
- **Goal:** Know which registration path is still open, make a plan, be reminded before that path's deadline, and record it for himself only.
- **Platforms:** web/ios/android
- **Moves metric:** Activation (one important date) and Honesty (never implies registration status).
- **Why a storyboard:** The deadline appears on five surfaces with conflicting wording ('closes Oct 26' against a per-method rule), and the path hands off from an anonymous aha to a person-scoped self-report.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | f8-seasonal-aha | seasonal deadline | He reads 'Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington.' and the in-person line. | The copy is specific to each method, uses 'must arrive' wording, and cites the Washington Secretary of State. |
| 2 | x-place-file | mover row 'Update your voter registration' (requires move-in date) | After saving, he taps the row. | The mover row appears at T1 because move-in is asked for or carried. |
| 3 | f6-place-section-details | ready (civic registration block) | He sees 'Online/mail: received by Mon Oct 26 · In person: until 8 p.m. Tue Nov 3', an outbound 'Check or update at VoteWA', and a separate 'Remind me'. | The app never states whether he is registered. The check goes to the official state site. |
| 4 | x-date-sheet | view-seeded voter registration + plan (proposed) | He picks 'Online' as his plan, and the reminder targets Oct 26 with a series. | The plan decides which deadline the reminder follows. |
| 5 | f5-today-calendar-strip | seeded statewide rule (bar) | Oct 26 appears as a full-height bar labelled 'Statewide — WA'. | It is visibly not a claim about his house. |
| 6 | x-date-sheet | 'I did this' person-scoped | He taps 'You marked this done'. The footer reads 'Only you'. | The self-report is never shown to the household as a fact. |

**Failure branches:**
- After Oct 26. The aha and block switch to 'You can still register in person until 8 p.m. Nov 3'; they are not suppressed.
- No seeded rule for the state. The block is absent, not an empty shell.
- T1 with no move-in date. The mover rows never appear (gap).
- Unverified seed. A hollow mark plus the source.
- Deadline passed for every method. The existing election banner shows.

---

## flow-14 — Web saver installs a native app: continuity of place, first-week state and permission
- **Persona:** Maya Chen, 34 (flow-01), who saved and confirmed pickup on the web and then taps the WallBar app-download link on her iPhone.
- **Goal:** Open the app and find Today, her confirmed day and her dates already there, with no re-onboarding and an in-context notification ask.
- **Platforms:** ios/android
- **Moves metric:** Week-four return (native triggers) and Activation (briefing/widget on native).
- **Why a storyboard:** The pilot runs on three platforms. The move from web to native is where device-local state, the launch-time permission request and native Today splits break the loop, and no prompt covers it.

| # | surface | state | user sees / does | moment of truth |
|---|---|---|---|---|
| 1 | ext:app-store | install from WallBar link | She installs Pantopus. | Nothing fires on first launch: the AppDelegate permission request has been removed. |
| 2 | ext:native-sign-in | sign in | She signs in with the same email. | There is no carousel and no location prompt. |
| 3 | f1-today-tab | 4 · saved place with chip | Native Today shows 1402 NE 3rd Ave with the confirmed pickup card. | The native Today uses the same composition as web; it is not a home-gated screen. |
| 4 | x-place-file | 6 · sync merge | She reads 'Synced 3 items from your other device' once. | Dismissals and ticks are stored on the server, so nothing re-asks. |
| 5 | f4-briefing-optin-card | one on (web push) / native not yet authorised | The card reads the OS state and asks for this device only. | The switch does not show on while this device has no permission. |
| 6 | f4-notification-primer | default | Entered from the card's Yes, the OS dialog opens directly. | The permission is asked once, in context. |

**Failure branches:**
- Android has no saved-places client. Today dead-ends until SavedPlacesApi ships.
- A different account is signed in on the device. The chip and places reset with 'You switched accounts'.
- The widget is added before any Today load. The widget shows 'no snapshot'.
- The web briefing is on, but the native device token is not registered. Settings must show the per-device state honestly.

---

## Handoff gaps between v1 prompts

- f1-email-verify-handoff ↔ f1-save-confirmation: the handoff says the server now holds the pending place (and calls the different-device frame identical), while save-confirmation's WHY and its recovery frame still assume a device-local 24h draft the user retypes ('the value the user retypes'). Their recovery copy also differs ('We stopped holding that address.' vs 'We couldn't read the address you previewed on this device.'). Neither shows a held address as a selectable row, and neither says how long the hold lasts.
- f1-email-verify-handoff says 'Verify your email to save it' (the save waits on verification) and hands off 'into the save confirmation', but does not say whether it lands on save-confirmation frame 1 (pre-save 'Save' button) or frame 3 (saved). Save-confirmation lists the verification landing as an entry without naming a frame.
- Scope caption wording differs across the save path: f1-email-verify-handoff 'Only you will see this.', f1-save-confirmation 'Only you can see this.', f1-your-places 'Only you can see these.', f1-today-tab chip 'Saved place · Only you', f1-add-place-sheet saved frame chip '1402 NE 3rd Ave - Only you', f11-keeper-naming 'Only you see this.'
- f1-save-confirmation body promises 'your morning briefing can use it'. The activation-critical trigger is the night-before briefing, which f4-briefing-optin-card presents as a separate row, so the save moment names the wrong return trigger.
- f1-add-place-sheet lists its entry as Today's empty-state CTA 'Preview an address', and the sheet has no preview. The design doc routes that same label to /start. f7-today-widget's no-place copy is 'Save an address to see today here', f7-widget-tap-landing hands off to the 'Add a place' sheet, and f7-widget-howto-sheet's no-place footer is 'Save an address first' with no stated destination: three labels, two possible destinations.
- f1-add-place-sheet refuses non-Clark addresses ('We only cover Clark County, Washington right now.'), while the /start preview (f8 prompts) and the design doc ('available nationwide') accept them. A person who previewed and saved a Portland address on /start is refused when adding the same address signed in.
- f4-notification-primer lists 'tapping Yes on the briefing opt-in card' as an entry and then asks 'Yes / Not now' again, but f4-briefing-optin-card does not say whether its Yes goes to the primer or straight to the OS. The primer's granted frame shows the card flipped to '6:00pm - Change' even when the entry was the pickup card's 'That's my day', where no time was ever chosen.
- After the first 'That's my day', f4-notification-primer says the primer sheet is presented, while f4-briefing-optin-card says the first pickup confirmation 'scrolls to and highlights this card'. Two different next steps for one tap.
- f4-notification-primer promises 'nothing else unless something needs you tonight', but f4-notification-settings draws morning briefing, household activity, date reminders, bill reminders and air alerts all ON by default for the same user.
- The pickup push text differs everywhere: f4-notification-primer 'Recycling and garbage tomorrow - City of Camas schedule, not yet confirmed'; f4-today-pickup-card 'Recycling and garbage tomorrow — not yet confirmed' with body 'Bins out tonight. 2418 NW Lacamas Dr.' (full address); f3-household-notifications 'Garbage + recycling is tomorrow (not yet confirmed)'; f1-today-tab pinned briefing 'Recycling and garbage tomorrow — city schedule, not yet confirmed'; design doc caveat in the body; f11-keeper-strip fixture 'Recycling goes out tonight'; f7-widget-gallery 'Recycling + garbage Tue'.
- 'Not my schedule' has three destinations: FINAL inventory / f4-today-pickup-card (provenance report, then Date sheet); x-date-sheet (opens the Date sheet directly); x-provenance-sheet (lists the pickup card as an entry, ends at 'Thanks — we'll check it.' with no hand-off to the Date sheet). x-place-file also puts a 'Not my schedule' CTA on its pickup row with no destination.
- Pickup source and confidence disagree for Camas: f4-today-pickup-card 'City of Camas Public Works · Route B', Tuesday, HOLLOW; x-provenance-sheet draws 'Recycling — every other Tuesday' from City of Camas as FILLED official; x-place-file 'Camas garbage Thursdays, recycling every other Thursday' hollow; f3b-invitation-decision 'Tuesday, Waste Connections'; f3-member-home-dashboard 'Garbage + recycling - Wed'. A user moving from the invitation screen to Today sees a different hauler and a different weekday.
- After 'That's my day', f4-today-pickup-card flips the source to 'You · Tuesday', f4-notification-settings shows 'Pickup day - Tuesday (confirmed by Sam)', x-place-file keeps its own row. No prompt says the widget snapshot (f7-today-widget) or the 14-day strip mark changes from hollow to tick on confirm, so the widget can keep showing a hollow guess.
- Reminder deep links disagree: x-date-sheet uses /app/place/today?rule=cal_7f3a2 and opens the Date sheet; f5-today-calendar-strip says the rule push 'deep-links here and highlights that row'; f3-household-notifications says 'Today with the rule highlighted'. f1-today-tab says the /app/place/today route is to be renamed or deleted, and no prompt covers a reminder for a date outside the 14-day window that the strip cannot host.
- Lease reminder fixtures do not agree and none draw the reminder or 'done': x-date-sheet has 'Lease ends — 31 Mar 2027, remind 60 days' and an unlinked 'Notice to vacate — 31 Jan 2027'; x-place-file has 'Lease ends · May 31, 2027 · Reminder set 60 days before' next to 'Notice deadline · April 1, 2027' (the reminder fires on the deadline); f5-today-calendar-strip has 'Lease notice deadline — tell landlord by Oct 30'. Only the voter kind has 'I did this'; no user-entered kind can be marked done to stop reminders.
- The Date sheet's save confirmation is not specified. The design doc toast says 'Saved to your calendar. Only you.' / 'Saved to your household calendar.' and x-date-sheet's footer says 'Only you will see this.' / 'Everyone in this household will see this.', and x-date-sheet's 'saved' frame has no copy.
- x-place-file lists 'the claim-success receipt's "See what we know"' as an entry, but f1-claim-receipt has no such action. The receipt's one-time banner on the place file is not among x-place-file's ten states, and no persistent 'What moved when you claimed' entry exists anywhere.
- f1-claim-receipt offers 'Keep them private to me' for carried dates, but x-date-sheet makes scope a prop that only switches the footer by home/saved_place. So at T3 every date says 'Everyone in this household will see this.', and a private-at-home date has no representation in the Date sheet, place file or household calendar.
- f1-claim-receipt's consent copy is past tense ('are now visible to everyone in this household'), while the FINAL inventory's open question recommends defaulting to carry-and-share. The prompts do not say what happens if the user leaves without choosing.
- f1-claim-receipt closes with 'Today now uses this home.' and strikes the 'Saved place - Only you' chip, but f1-today-tab has no first-open-after-claim notice. f1-your-places still draws the claimed address as a list row ('Our house - 2817 NW Sierra St'), while the FINAL inventory says the duplicate SavedPlace row is retired.
- Keeper count and scope across the claim do not match: f1-claim-receipt 'Ollie, your keeper - knows 11 things'; f11-keeper-strip '11 on file' (T1 frame: integer 4); x-place-file '14 things on file'. f11-keeper-naming's scope line switches from 'Only you see this.' to 'Everyone in this household sees this.', but the claim receipt asks consent only for dates, not for the keeper.
- f3-invite-composer's review manifest shows only 'Role offered — Member' with no capability list, while f3b-invitation-decision shows a grant/limit list the sender never reviewed. The composer's 'Expires Sep 30, 2026 (14 days)', 'Access — Ongoing' and note promising 'pickup day and household calendar' differ from the decision screen's 'Starts Sep 18, 2026' and 'expires Sep 25, 2026'.
- Unlock lists differ between the screens a co-resident and an owner see: f3b-invitation-decision locked column (residency letter; Residency Pass; neighbor messages; Real Rent; Block Founder rank); f3b-verify-address-sheet (Send neighbor messages; Request a residency letter; +3: Show a Residency Pass, Set Real Rent, Claim Block Founder rank); f3b-owner-attestation grants only three rows but claims to reuse 'exactly the list the other person was shown'; f3b-locked-action-row adds 'send a postcard invite'.
- f3b-invitation-decision's accepted state has 'Open Home' with no destination and makes 'Verify this address' primary. f3-member-home-dashboard is reached via 'Place file → this home', and f1-today-tab has no frame for the first open after accept, when HomeOccupancy silently switches Today to the new home.
- f3b-verify-address-sheet offers 'Ask Sam Ortega to confirm · Usually same day', but its only pending state is the postcard. f3b-locked-action-row's pending variant is also postcard-only, and f3b-owner-attestation's 'Not now' and 'declined' states never report back to the requester. The requester has no 'asked, waiting' or 'declined' frame.
- f3-invite-banner says multiple invitations open 'the decision flow's index', and no prompt draws that list. The 'new invitation' push is named as an entry, but no prompt gives its copy.
- Notification categories do not match: f3-household-notifications draws channels 'Household activity / Security / Reminders / Briefing'; f4-notification-settings draws 'Briefings / Household activity / Dates and bills / Air and weather alerts'. Security has no settings row and Air has no channel.
- bill_paid landing disagrees: f3-household-notifications → the bill; f3-bills-list → scrolls to and highlights a list row; f3-bill-detail-web → bill detail. Mark paid has no Undo in f3-bills-list or f3-bill-detail-web, while f10-bill-provenance uses an Undo snackbar for delete.
- f3b-invitation-decision gives the household's pickup as 'Tuesday, Waste Connections', but the household it describes (the Payne St house) has no pickup fixture elsewhere. f3-household-block, f3-member-home-dashboard and f3-bills-list use Maple St with a Wednesday pickup, so the co-resident storyboard cannot be drawn from consistent data.
- Compare sender and strings disagree between the sheet and what arrives: f8-compare-sheet and f8-compare-arrival-header use 'Dana', f8-og-compare-card and the design doc use 'Maya'. Flood is 'Zone X — minimal risk' (sheet, header) vs 'Zone X — minimal' (OG, reveal). Radon is 'Zone 1 — highest predicted' vs 'Zone 1 — highest'. The OG headline limit is ~140 characters vs the token's ≤90.
- Freshness does not carry across the compare hop: f8-compare-arrival-header shows 'Dana's card, as of Sep 12, 2026', but f8-compare-sheet's preview and f8-og-compare-card label the same frozen reading 'Air today' / 'AirNow, today', and f8-compare-reveal places the frozen and live AQI on one track.
- f8-compare-reveal's 'Send yours back' opens f8-compare-sheet's reciprocal variant ('Send my card'). Neither says which address is minted (the recipient's typed, unsaved address), and the sheet's privacy line and name toggle are not restated for the recipient.
- f8-compare-reveal draws the WallBar as 'Claim this address and be one of the first here', while f9-founding-meter-preview requires that CTA to follow founding_open, f8-native-share-compare's wall says 'Keep this address handy.' / 'Continue', and f8-seasonal-aha's follow-up says 'Claim this address to know the morning that changes.' The first account ask is worded as a claim on some surfaces and a save on others.
- f8-compare-arrival-header's signed-in state swaps 'Sign in' for 'Save this address' with no destination (f1-add-place-sheet? f1-save-confirmation?). f8-native-share-compare says the native card is anonymous ('no name'), while the web sheet offers a name, and no prompt says whether a /start?vs= link opens the installed app.
- f8-og-compare-card specifies only the PNG. The og:title the recipient actually reads ('What's true about Maya's place. Yours?' in the design doc), og:description and og:image:alt are in no prompt.
- Widget and landing disagree: f7-today-widget and f7-widget-gallery label the place 'Garfield St · Camas', while f7-widget-tap-landing's header shows '1420 NE Garfield St · Saved place · Only you'. f7-widget-gallery's sample pickup carries a FILLED mark and 'Recycling + garbage Tue', while f7-today-widget and f7-widget-howto-sheet carry HOLLOW and 'Recycling and garbage tomorrow'.
- f7-today-widget says 'A tap deep-links to the Today tab' for every region, and f7-widget-tap-landing always lands at the top of Today with no section parameter. On an AQI-hero day the tapped fact (the air band) is below the fold, and f1-today-tab keeps air sixth.
- x-place-file shows the widget row 'shown because no widget is placed', but no prompt says how the app learns a widget was placed. f7-widget-howto-sheet ends at 'Done' with no confirmation, and f4-notification-primer's declined frame promotes the widget row on Today, while f7-widget-howto-sheet lists only the place file and notification settings as entries.
- f7-widget-howto-sheet rules out any add button on both platforms, while the Android pin API exists, and its iOS step 2 ('Tap the plus') contradicts current Edit → Add Widget wording. f7-today-widget and f7-widget-howto-sheet draw 364×170pt on a 393×852 screen, which is the Pro Max size.
- Mail-snap audience differs by surface: f10-snap-capture-tray 'stored privately to your home and never shown to neighbors'; f10-mail-day-triage chip 'Your household'; f10-mail-snap-privacy 'Everyone in this household can see them'; f10-mail-piece-photo and f10-mail-day-triage hide photos from members without finance.view.
- f10-snap-capture-tray commits 'Done (3)' shots, while f10-extraction-confirm counts 'Piece 3 of 5', and neither says how pages become pieces. f10-extraction-confirm's success says 'We'll remind you 7 days before' with a 60/30/7/1 control, while the design doc says bill reminders are day-before and day-of from home_reminders.
- f10-bill-provenance says 'From a photo you took · Oct 3' next to 'Added by Sam · Oct 3' (who took it?), and its fixture ($142.18 due Oct 12) does not match f10-extraction-confirm ($184.62 due Oct 2) or f10-mail-day-triage, so the snap → confirm → bill storyboard cannot use one bill.
- f10-mail-day-triage routes T1 users with 'Mail snap needs a claimed address' to the Date sheet, but x-date-sheet's bill mode is described as 'pre-filled from a mail snap', so the fallback depends on the thing it replaces. No prompt draws where 'Mark paid' is confirmed after a bill reminder beyond f3-bill-detail-web's button.
- The keeper's first appearance disagrees: the design doc F11 auto-presents the naming sheet on the second Today open, while f11-keeper-naming and f11-keeper-strip say never auto-present. f11-keeper-naming's 'Skipped' frame keeps the inline invitation in the Today slot while also claiming Skip 'never asks again'. The species lists differ (doc: otter, owl, fox, heron, cat, dog; prompts: octopus, otter, heron, fox, raccoon, squirrel).
- f11-keeper-strip's mood line 'Recycling tomorrow.' and fixture 'Recycling goes out tonight' do not match f4-today-pickup-card's 'Recycling and garbage tomorrow', and the keeper's T1 ring outlines money/people/proof while x-place-file's T1 frame renders them as 'Not here — this is a saved place'.
- f1-today-tab's progress row reads '3 of 6 things on file →' and x-place-file lists it as an entry, but the design doc's F2 checklist has seven keys and a three-question first week, and x-place-file forbids anything that reads as percent complete. The Today row and the place file do not share a defined step set.
- f1-today-air-band marks 'the 101 threshold' on the alert landing, and its push says 'at 2418 NW Lacamas Dr', while f4-notification-settings sets the user's threshold to '151+' by default and the backend alert fires at AQI ≥ 101, so the landing can show a line the user did not choose.
- x-provenance-sheet offers the same two reasons ('The date is wrong' / 'That's not my schedule') on every payload, including AQI, and ends at 'Thanks — we'll check it.' No surface (x-place-file, f4-today-pickup-card) has a 'You reported this · checking' or resolved state, so the report has no place to come back to.
- f6-place-section-details's civic 'Check or update' opens the Date sheet, while the design doc F6 sends the user to the state office. x-place-file's voter row reads 'October 26, 2026 · Statewide — WA' as one date, while x-date-sheet and f6 give per-method dates. Mover rows are keyed on Home.move_in_date (f6-home-basics-rows), so a T1 mover never sees them.
