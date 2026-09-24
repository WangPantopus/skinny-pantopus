# FINAL screen inventory — first-person loop (F1–F12)

**59 surfaces, but only 5 of them are genuinely new screens: the loop needs one place file, one Date sheet, one Today, one provenance mark — plus 10 sheets, 14 new cards, 2 widget sizes-in-one and 28 extensions of screens that already ship, which is 159 per-platform builds across web, iOS and Android.**

| | count |
|---|---|
| newScreens | 5 |
| newSheetsModals | 10 |
| newCards | 14 |
| newWidgets | 2 |
| extendedExisting | 28 |
| totalSurfacesTouched | 59 |
| perPlatformBuilds | 159 |


---

# PHASE: loop

## [x-place-file] Your place file
- **NEW_SCREEN** · Cross-cutting (F2, F5, F6, F7, F11) · platforms: web/ios/android · origin: added-by-critique · effort/platform: 3d
- **Host:** The Place tab's index — what the Place tab shows for a user who has saved an address, and the 'facts' destination for a user who has claimed one. Web /app/place; iOS HubTabRoot place root; Android root/home.
- **Entry:** Place tab (it is the tab's index); Today: a single progress row during the first 14 days ('3 of 6 things on file →'); Keeper strip fact count (phase 2); Claim-success receipt; Reminder pushes with no specific rule
- **Job:** The one hub for every fact the product can hold about this address — so the first-week checklist, the mover's checklist, the user's dates and the keeper's 'knows N things' are one list with one storage model instead of four that drift.
- **Contents:** A 12-month year band at the top; below it, fact rows grouped in five categories — Place (address, pickup day, move-in date), Dates (the six F5 kinds + seeded county/state rows), Money (bills, phase 2), People (co-residents, invites), Proof (address verification). Each row is either KNOWN (value + edit affordance) or MISSING (one-line ask + CTA into the Date sheet, the add-a-place sheet, the invite composer, docs or the verify sheet). Mover rows (mail forwarding, utilities, voter registration) appear only while move_in_date is within 60 days. A 'Put today on your home screen' row appears when no widget is placed. Ticks and dismissals persist server-side (HomeOccupancy at T3, user preferences keyed by saved place at T1).
- **Visualization:** Top band: a 12-month horizontal timeline, months as columns, with one LANE per source — You / Your city / Your county / Your state — a marker per rule at its date, today as a vertical rule, and the next 14 days shaded so the band and the Today strip are visibly the same data at two zooms. Markers carry the filled/hollow/tick provenance encoding. Below: fact rows, known rows showing the value as the primary line; missing rows showing the ask, not a red X. The category count renders as a five-segment ring (segment filled if anything is known in that category) with the integer inside — deliberately NOT a progress bar or percentage, so nothing reads as 'you are 60% complete'.
- **States:** loading, T1 saved place (Money/People/Proof rows render as 'Not here — this is a saved place', never as failures), T3 home, mover window active (extra rows), all known ('Everything we can hold about this place is on file' — no confetti, no percentage), dismissed mover rows with an undo and a restore row in home settings, sync merge from another device shown once as 'Synced 3 items from your other device', permission-denied per row (household member without finance.view / members.manage sees the fact counted, CTA disabled with the reason), offline (cached, CTAs disabled), error
- **UX note:** This is the single largest merge in the pack and the most important one for a first-time user: today the same list of facts is drawn as F2's checklist, F6's Just Moved card, F5's Your-dates card and F11's keeper ledger, with four storage models and four dismissals. One route also fixes two structural holes — the Place tab has no reason to exist for a user with no claimed home, and F5's own acceptance criterion is false today because composeForHome expands only 14 days, so a lease end eight months out is saved, toasted, and then invisible and undeletable until two weeks before it fires. The year band is what makes the loop's annual-return step visible at all.

## [x-provenance-sheet] Where this comes from (provenance + "this isn't right")
- **NEW_SHEET_OR_MODAL** · Cross-cutting (F4, F5, F6, F8, F9, F10, F12) · platforms: web/ios/android · origin: added-by-critique · effort/platform: 1.5d
- **Host:** Opened from any data mark in the product: a 14-day strip dot, a calendar row, an air-quality marker, a compare scale strip, a bill provenance block, a seeded civic/tax row.
- **Entry:** Any hollow or filled mark on the Today 14-day strip; Calendar row tap; AQI band marker tap; Compare scale-strip row tap; Bill provenance block (phase 2); Pickup card 'Not my schedule'
- **Job:** One sheet that answers 'where did this fact come from, how sure are we, and how do I tell you it's wrong' — so provenance is a mark everywhere and prose in exactly one place.
- **Contents:** Takes a common payload {value, bands, authority, as_of, confidence, source_url, rule_id}. Renders: the value in plain language; the authority ('FEMA flood zone', 'AirNow, today', 'Clark County Assessor', 'You', 'We read this from your photo'); observed/updated time; the confidence line ('On record, not yet confirmed'); a source link that opens in a new tab / SFSafariViewController / Custom Tab; and the report control 'This isn't right' with a two-option reason picker (wrong date / not my schedule) and the confirmation 'Thanks — we'll check it.' Needs a backend report endpoint that does not exist today.
- **Visualization:** A half-sheet whose top is the mark itself, rendered large, in the same three shapes used everywhere else: FILLED = official/confirmed, HOLLOW = on record but unconfirmed, FILLED-WITH-TICK = you entered it. Under it, a one-line legend, the authority as a caption, and the source link as a row with an external-link glyph. The report control is a quiet text button, not a destructive red.
- **States:** official/confirmed, on record, unconfirmed, you entered it, no source_url (label, no dead tap target), report submitted, report failed, offline (read-only from cache, report disabled)
- **UX note:** This resolves the single worst inconsistency across the three critiques: UNVERIFIED is currently specified four ways (a row-suffix string, a push parenthetical, a widget glyph, and nothing at all on the share card). Words repeated per row become boilerplate exactly where the pilot's zero-target honesty metric is scored; a shape repeated per mark does not. Push copy is the only exception — a mark cannot travel in a notification tray, so the caveat rides the title, never the body tail where truncation eats it. Build this FIRST: every other entry renders its marks.

## [f1-your-places] Your places (and which one Today uses)
- **EXTEND_EXISTING** · F1 · platforms: web/ios/android · origin: merged · effort/platform: 1.5d
- **Host:** Web: SavedPlaceContext, re-hosted inside PlaceShell (kill the bare 760px query-param frame at app/(app)/app/place/page.tsx:43-44). iOS: Features/SavedPlaces. Android: ui/screens/saved_places/SavedPlacesScreen.kt.
- **Entry:** Place tab when there is no claimed home; Today header chip ('Saved place · Only you' → opens here); Place file → Address row; Post-save confirmation 'View saved places'
- **Job:** See everything you saved, see which one Today is running on and why, switch it, claim it or remove it — in one surface instead of the two the doc specifies.
- **Contents:** Rows of label + city/state + saved date; a 'Used for Today' badge on the resolved place; the precedence explanation in one sentence ('Today uses the address you saved most recently' / 'A home you've claimed always wins'); row overflow (Open, Use for Today, Claim this address, Remove); a header line 'Only you can see these.'; and an empty state pointing at the add-a-place sheet. 'Use for Today' writes the existing UserNotificationPreferences custom pin, which already outranks everything in resolveLocation — no new column.
- **Visualization:** A list where exactly one row carries a filled 'Used for Today' badge and the rest carry nothing — one badge slot, one overflow, no chips competing. The precedence sentence sits directly under the badged row, not in a header, so the explanation is adjacent to the thing it explains. A claimed row renders with the home glyph and a greyed 'Today always uses your home' caption rather than a disabled-looking control.
- **States:** loading, empty, single place (explanation, no chooser), multi-place chooser, a home outranks the saved place (selection disabled, explained), row already claimed (renders as a home, not a saved place), removing with Undo, account-switch reset, offline, error
- **UX note:** The doc specifies this twice (a saved-places list and a 'where Today gets this' sheet) for one job; merging them removes the worse failure, which is that the web saved-place surface has NO nav entry anywhere and renders frameless — so a web user who saves a place today can never find it again, making F1's own acceptance criterion untestable by a real person. Correctness dependency: removal must invalidate queryKeys.hubToday; both web Today mounts hold staleTime 120s, so today the address keeps rendering for two minutes after removal, which on an 'only you' surface reads as a privacy failure.

## [f1-add-place-sheet] Add a place (signed-in address search + save)
- **NEW_SHEET_OR_MODAL** · F1 · platforms: web/ios/android · origin: added-by-critique · effort/platform: 1d
- **Host:** Sheet over the Place tab and over Today. iOS has SavePlaceSheet.swift already but no entry point from these surfaces; Android has SavedPlacesApi and no signed-in write path at all; web has only the signed-out /start funnel.
- **Entry:** Today empty state 'Preview an address'; Your places empty state and '+ Add'; Widget tap landing when there is no place; Place file address row when empty
- **Job:** Give 'Preview an address' and 'Save an address to see today here' a destination for a signed-in user who has no place — today both dead-end on Android.
- **Contents:** Address autocomplete, the selected suggestion, a single Save action, the privacy line ('A private bookmark for your account. Nobody else can see it.'), and on success a direct hand-off to Today. Reuses the existing SavedPlaces POST with expectedUserId.
- **Visualization:** A compact sheet: one focused field, suggestions as a plain list, one primary button, and a single privacy sentence — deliberately not a mini-funnel. No grades, no preview: this is 'bookmark it', and the reading happens on Today a second later.
- **States:** idle, typing / suggestions, geocode failure ('We couldn't find that address'), unsupported region, saving, saved (sheet dismisses onto Today with the new chip), duplicate of an existing saved place, offline, error
- **UX note:** Adversarial walk found this as a hard dead end: the Place launch funnel is the SIGNED-OUT root, and Android's only saved-place write reads a pending draft from the signup flow. So a signed-in Android user with no place taps 'Preview an address' and reaches nothing. Routing those CTAs to 'Claim your address' instead would be worse — claiming is a much heavier promise than the copy makes.

## [f1-save-confirmation] Saved — Today now uses this address
- **EXTEND_EXISTING** · F1 · platforms: web/ios/android · origin: merged · effort/platform: 0.75d
- **Host:** Web: PendingPlaceSaver at /app/place?preview=<id> — as the success STATE of the save, not a route. iOS: Features/Place/Launch/PendingPlaceView.swift. Android: ui/screens/place/launch/PendingPlaceScreen.kt.
- **Entry:** /start funnel continue-with-preview; Email verification landing; Add-a-place sheet (skips straight to saved)
- **Job:** The one moment the user learns the save did anything. Say what changed, in one sentence, and hand them to Today.
- **Contents:** Title swap 'Keep this address handy' → 'Saved privately'. Body revised — today's 'a private bookmark… setting up a Home is a separate step' is now incomplete, because the save also sets Today and enables the briefing. Primary 'See Today', secondary 'Set up a Home', tertiary 'View saved places'. Carries the preview-lost recovery: when the local draft is unreadable, an inline address field with one-tap re-save instead of dropping to an empty Place.
- **Visualization:** Two-state title with a single confirming glyph; three actions in strict weight order with the privacy sentence as a caption, never a second paragraph. The recovery state replaces the body with a focused address field and keeps the title, so a lost draft reads as 'type it again', not as an error page.
- **States:** pre-save confirm, saving, saved, preview lost / expired / different device — inline recovery, save error (browser storage failure), account switched (expectedUserId mismatch — must refuse), offline
- **UX note:** Made a state rather than a dedicated route on web (it already is a route on both natives, which is fine). The recovery state is not optional: the previewed address lives in a device-local localStorage draft with a 24h TTL, so anyone who registers on a laptop and verifies on a phone arrives with nothing — the bridge silently fails for the most common signup path.

## [f1-email-verify-handoff] Email verification handoff carrying the held address
- **EXTEND_EXISTING** · F1 · platforms: web · origin: added-by-critique · effort/platform: 1d
- **Host:** frontend/apps/web/src/app/(auth)/register → /verify-email-sent interstitial and the verification landing route.
- **Entry:** Register submit from /start with a preview; Email verification link
- **Job:** Keep the previewed address alive across the register → verify-email → return gap, which is where the bridge currently breaks for cross-device users.
- **Contents:** The interstitial names the held address (label only, never coordinates): 'We're holding 1402 NE 3rd Ave for you. Verify your email to save it.' The verification landing completes the save from a SERVER-side pending place attached to the unverified account, then routes to the save confirmation. The localStorage draft becomes an optimization, not the load-bearing path.
- **Visualization:** Interstitial: the held address rendered as a small pinned address chip under the headline, so the user sees the thing being held rather than reading about it. Nothing else changes.
- **States:** sent (address named), verified on the same device, verified on a different device (server draft completes the save), no held address (plain verification copy), draft expired, verification link expired, error
- **UX note:** Adversarial flow 1 blocker. Requires one backend change (persist the pending place server-side at register time). Without it, F1's entire bridge is device-local and fails silently for anyone who opens the verification mail on their phone.

## [f4-notification-settings] Notifications (one page, four groups)
- **EXTEND_EXISTING** · F1 / F3 / F4 / F5 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Web /app/settings/notifications; iOS NotificationSettingsViewModel; Android NotificationSettingsViewModel. Absorbs the fake per-home toggles at /app/homes/[id]/settings:157-167.
- **Entry:** Settings; Briefing opt-in card 'More options'; Any push's in-app row overflow ('Turn these off')
- **Job:** One honest place to control every push this design introduces — including the alert pushes, which today have no switch anywhere.
- **Contents:** Four groups: BRIEFINGS (morning toggle + time, evening toggle + time, timezone caption, and a pickup-status row 'Pickup day — Tuesday (confirmed by Sam)' / 'Not set · Set it'); HOUSEHOLD ACTIVITY (bills paid, tasks completed, events added); DATES AND BILLS (renamed from 'Home Reminders', which misdescribes the toggle for a user with no home; split so a user can mute date reminders without losing bill reminders); AIR AND WEATHER ALERTS (on/off plus a severity threshold). The MailPreferences master gate is surfaced here as the visible top-level switch instead of hiding in the Mail area. The per-home toggles are DELETED, not wired.
- **Visualization:** Four labelled groups with helper text under each master, and one permission banner pinned at the top when the OS is denying. The silence contract for the evening briefing is stated in its own row caption, because the people who come here are people who stopped getting pushes and want to know whether they are still on.
- **States:** loading, saved, save error, OS permission denied banner at the top (explaining that in-app rows continue), no location (captions must not promise a briefing that will skip), timezone caption
- **UX note:** The proposal edited adjacent rows of this page from four separate feature entries and added a fifth settings surface; that is how preference pages rot. The per-home toggles look real and persist nothing ('real impl would persist') — shipping three new notification types behind a control that pretends to save is worse than shipping no control. Per-kind mute belongs on the date row itself ('Remind me: never'), not as new settings rows.

## [f1-today-tab] Today (one composition, both payloads)
- **EXTEND_EXISTING** · F1 / F4 · platforms: web/ios/android · origin: merged · effort/platform: 3d
- **Host:** Web /app/today (hub/today/page.tsx). iOS TodayTabRoot / AddressTodayTabView. Android TodayTabScreen. Absorbs the content of /app/place/today, the native Screen-2 Today and the push-only briefing screen.
- **Entry:** Today tab in both navs; Briefing push; Widget tap; Alert push; 'See Today' on the save confirmation
- **Job:** Stop having three screens called Today. One composition per platform, whose sections appear or not based on data, so claiming an address reads as 'more sections appeared' rather than a layout change that loses the calendar.
- **Contents:** Location row (address label + 'Saved place · Only you' chip at T1 + 'Updated Nm ago'); the delivered briefing pinned as the top card when arrived from a push; weather; the pickup lead card; the 14-day address-calendar block; the air-quality band; alerts; ranked signals; 'Good day to…' tiles; the briefing opt-in card; a first-14-days progress row pointing at the place file; the keeper strip slot (phase 2). Requires the address_calendar section to be emitted on the hub payload (the backend already emits pickup there as a signal of kind 'address_calendar'; the web type union is simply missing the member, which is why it currently renders with a Sparkles icon).
- **Visualization:** One vertical order, identical at every tier: location row → pinned briefing (if any) → pickup lead card → 14-day strip → weather → air band → alerts → signals. Quiet day is a FINISHED screen, not an empty state: the receipt line renders as four small ticked checks (weather, air, alerts, your calendar), which is what makes silence legible. The warming state renders the same skeleton shapes in place, never a full-page spinner.
- **States:** no place at all — 'Today starts with a place' (source==='none' only), display_mode hidden (has a location — must NOT show the empty copy), warming: location resolved, provider checks still landing — sections appear as they arrive, no all-clear claim yet, saved place (chip), claimed home (no chip), quiet day: 'Nothing needs your attention today' with a receipt line naming what was checked, partial: a named provider failed, Retry, the rest still rendered, alert variant, stale/offline with 'Updated 2h ago', error + Retry, arrived from a push (briefing pinned), arrived from the widget (refreshed in place, 'Updated just now')
- **UX note:** The biggest IA fix in the pack. Today the tab and Place > Today render different payloads with different gates, and the briefing is a third Today reachable only by tapping a push — which means a native user with notifications off can never see the pickup card or the quiet-day receipt, breaking design rule 4 on two of three platforms. Collapsing to one composition deletes three duplicate entries from the original proposal and is cheaper than maintaining the split. Rename /app/place/today's residual content 'At this address' inside the Place area or delete the route.

## [f1-today-air-band] Air quality band (and the alert landing)
- **EXTEND_EXISTING** · F1 / F4 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Today's air section on all three platforms; also the landing for AQI ≥ 101 and NOAA alert pushes, which F4 widens to saved-place users.
- **Entry:** Today (always visible); AQI / NOAA alert push; Compare scale strip 'Air today' row
- **Job:** Make the one genuinely canonical scale in the product legible, and make an alert push land on a screen that shows the crossing that caused it.
- **Contents:** The reading, the band name, the dominant pollutant, the health message, the observation time, and on the alert variant the address label with its 'Saved place · Only you' chip so the notification and the screen agree about which address this is about. Rendered ALWAYS, not only when is_noteworthy — today a healthy day and a failed fetch look identical (nothing).
- **Visualization:** A six-band horizontal scale bar in the EPA colours users already know, with a marker at the index and the band name printed beside it; on the alert variant the 101 threshold is marked on the same bar so the push's cause is visible in one glance. The bar is what makes 'Good' informative — the number alone says nothing about where 42 sits or how far 101 is.
- **States:** reading present, no reading ('No reading for this address right now' — visibly different from Good), alert: moderate, alert: critical, saved place (chip) vs claimed home, stale observation (time stated), OS permission denied — in-app only, location source none (never alert), offline
- **UX note:** For most T1 users the air alert is the first push Pantopus ever sends, about an address they only bookmarked — so the landing must name the saved place and say 'Only you', or it reads as surveillance. Keep the audiences separate: widening alert geohashes to SavedPlace must not widen pickup pushes, which F4 explicitly forbids for a saved place with no user-set day.

## [f4-briefing-optin-card] Briefing opt-in (morning + night-before, one card)
- **NEW_CARD_IN_EXISTING** · F1 / F4 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Today, below the day's content. Replaces the home-gated BriefingOptIn currently buried in web's TodayDetail; net-new on both natives, where no briefing control exists outside Settings.
- **Entry:** Today; Notification settings (the durable twin); After a first pickup confirmation
- **Job:** Let a saved-place user switch on the return trigger without owning or verifying a home — and expose the evening briefing that F4's whole feature and §5's activation metric depend on.
- **Contents:** Two asks in one card: 'A morning heads-up?' and 'The night before pickup?', each Yes / Not now, each expanding in place into a time-chip row (evening default 6pm). The silence contract stated once: 'Only when something needs you. No news means nothing's up.' Declining writes prompted_at so it never asks twice. Once on, collapses to a '6:00pm · Change' row. Reads OS notification authorization before it claims anything.
- **Visualization:** One card, two switch rows, each expanding in place into a chip row — never two competing cards and never a modal. The permission warning, when present, sits above both rows as a single amber line, so a switch can never read 'on' while the OS is denying delivery.
- **States:** never asked, asked and declined (hidden), one on / one off, both on (collapsed rows), OS notifications denied — 'Notifications are off for Pantopus' + Open settings, and the widget row is promoted above this card, saving, save error, no location (hidden)
- **UX note:** The proposal specified two separate opt-in cards for the same screen and then wrote a risk on each saying 'show only one at a time' — merging is the obvious answer and it removes the ranking problem entirely. Shipping morning-only would leave §5's activation bar unreachable for a purely navigational reason: evening_briefing_enabled is three taps deep in Settings on every platform today.

## [f1-claim-receipt] Claimed — what came with you
- **EXTEND_EXISTING** · F1 / F5 / F11 · platforms: web/ios/android · origin: added-by-critique · effort/platform: 0.75d
- **Host:** The existing post-claim/post-verify success surface — web VerifiedSuccess at /app/place?verified=1; the native equivalents after the add-home / verify flow.
- **Entry:** Claim / verify completion; Place file after a claim (one-time banner)
- **Job:** Acknowledge the T1→T3 promotion on screen, name what moved, and get consent for the one real privacy change it causes.
- **Contents:** 'Your pickup day, 2 dates and Ollie came with you.' A list of what was copied from the saved place to the home; one line that the private bookmark is now a home and that the dates you entered are now visible to everyone in this household (a genuine privacy delta that needs consent, not a silent migration); and a note that Today now uses this home.
- **Visualization:** A short receipt list — one row per carried item with its value and a tick — under the existing success headline. No illustration, no celebration: it is a manifest, and its job is to be checkable.
- **States:** nothing to carry (plain success, no empty list), dates carried, keeper carried (phase 2), pickup rule carried, carry failed (explicit, with a retry — never silent loss), household-visibility consent declined (dates stay private to the actor)
- **UX note:** Every critique found this independently and no feature owns it. Today F5 keys rules to SavedPlace.id, F11 stores the keeper in two different preference slots, and §6 lists five migrations with no promotion step — so the user loses everything they typed at the exact moment they invest most. Server-side, copy saved_place-scoped rules and preferences to home scope inside the same transaction that creates the home, and retire the duplicate SavedPlace row. Until this exists, F5 and F11 should not ship to T1 at all.

## [f3-invite-composer] Invite a co-resident (email, username, link, QR)
- **EXTEND_EXISTING** · F3 · platforms: web/ios/android · origin: from-doc · effort/platform: 1.5d
- **Host:** Web SenderInvitationManager (already has all three channels); iOS InviteMemberWizardView (email only, hard-rejects anything else); Android HomeInvitationSenderContent (email + username, no QR).
- **Entry:** Members roster Invite; Household block 'Invite by email' / 'Share a link'; Home dashboard FAB; Place file 'People' missing row
- **Job:** Send one household invitation by whichever channel you actually have for that person.
- **Contents:** Channel chips (Email / Username / Share instead), one recipient field that swaps with the channel, role chips Member/Guest, optional note, review, confirm, then the post-send recovery panel with the link and QR. iOS gains username and link; Android gains QR. The link-exposure warning renders at the moment Link is chosen, not after sending.
- **Visualization:** The channel picker swaps exactly one field and never reflows the form; Email stays the default path and Link/QR sit behind a 'Share instead' secondary that asks for no recipient. The review step is a plain manifest — home, offered role, access window, expiry.
- **States:** form, per-channel validation error, review / confirm, sending, sent + recovery panel, needs reissue (INVITE_POLICY_CHANGED), permission-denied, error, offline
- **UX note:** iOS is the real work here; web is a no-op and Android is a QR affordance. Keeping Email primary matters because Link is the channel that widens exposure, and the warning has to arrive at the point of choosing rather than in a post-send panel.

## [f3-invite-banner] Invitations waiting for you (single-slot landing banner)
- **NEW_CARD_IN_EXISTING** · F3 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** The surface a signed-in user actually lands on: web Place dashboard / hub StatusStrip; iOS Hub banner slot; Android HubSections banner region.
- **Entry:** Place dashboard / hub on every load; Push notification for a new invitation
- **Job:** Make a waiting household invitation — and a dead one needing reissue — impossible to miss, without opening My Homes.
- **Contents:** One row: '{Inviter} invited you to {home}' + Review, backed by GET /api/homes/invitations (a dead client on web with zero callers, and no native client at all). Two or more reads 'You have 2 invitations' and opens the decision flow's index. The sender-side twin appears here too: '2 invitations need to be sent again'. Explicit precedence, one banner maximum: invite > reissue > setup > verify.
- **Visualization:** A single-line banner with the inviter's name first and one action — the same slot shape the existing 'from the card in your mailbox' pill uses, so it reads as an arrival context rather than a new component. Never stacked with the setup or verify banners; the precedence rule is enforced in code, not by hope.
- **States:** hidden (none), one invite, multiple, expiring soon, needs reissue (sender), fetch failed (hide silently, never a broken banner), offline
- **UX note:** The doc puts received invites only on My Homes, which a brand-new invitee — who usually has no home at all and lands on the Place dashboard — has no reason to open. Merging the doc's My Homes section into this banner removes a screen and fixes the entry-point bug at the same time. The sender half is what closes the INVITE_POLICY_CHANGED loop: without it the recipient is told to ask someone who can see nothing wrong.

## [f3-household-block] Who lives here with you (household block)
- **NEW_CARD_IN_EXISTING** · F3 · platforms: web/ios/android · origin: merged · effort/platform: 0.75d
- **Host:** The place file's People section — NOT the home dashboard, which is not where anyone lands (there is no Home tab in the four-tab nav and both natives auto-land on Place).
- **Entry:** Place file People section; Home dashboard (mirrored, same dismissal); Members empty state
- **Job:** Ask a new resident, once, who else lives at this address, and make inviting them a two-tap job on the screen they actually see.
- **Contents:** Title 'Who lives here with you?', the privacy sentence ('They see the same pickup day, calendar and bills. Nothing about your home is shared with anyone else.'), primary 'Invite by email', secondary 'Share a link', tertiary 'Just me'. Triggered by members_active === 1 or within 7 days of the actor's own HomeOccupancy.start_at. Dismissal persists on HomeOccupancy with an undo toast; the Members empty state can reoffer.
- **Visualization:** A two-CTA block that survives a 320dp column with the privacy sentence intact and does not out-shout the verify banner above it. 'Just me' is a text button, not a greyed afterthought.
- **States:** loading, visible, dismissed with undo, permission-denied — a member without members.manage sees a read-only 'You and 2 others live here', member count > 1 (block collapses to the roster row), dismiss PATCH failed (keep the card, retry silently), offline
- **UX note:** Hosting it on the place file instead of the home dashboard is the fix for the doc's biggest F3 delivery problem — as specified, the card would be seen by a minority of new residents. Also: 'Just me' must not be permanent as the acceptance criteria imply; an undo toast plus a reoffer from the roster keeps a mis-tap from being a dead end. For a co-resident who joined later, key the mover window on the viewer's own occupancy start, not the owner's move_in_date.

## [f3-member-home-dashboard] Home dashboard, member read-only view
- **EXTEND_EXISTING** · F3 · platforms: web/ios/android · origin: from-doc · effort/platform: 1d
- **Host:** Web dashboard per-card gates + useHomePermissions; iOS HomeDashboardProjection; Android HomeDashboardScreen + HomeDashboardAccess.
- **Entry:** Place file → this home; My Homes; Household notification deep links
- **Job:** Give an invited co-resident a dashboard that is useful and readable without manage permissions — which the permissions migration creates on day one.
- **Contents:** After the migration a member gets members.view, calendar.view, calendar.edit and finance.view, so Members, Calendar and Bills cards appear for the first time. Each needs a designed read-only variant defined ONCE — same layout, action row replaced by a single 'View'. TodayCard's memberCount becomes non-null for members (today it is forced null unless members.view).
- **Visualization:** One read-only card variant applied across all six cards rather than per-card improvisation: identical header and body, action row replaced by a single quiet 'View' affordance. Every manage control a member can see is either absent or disabled-with-reason — never present-and-inert.
- **States:** loading, member view (read-only cards, no manage FAB), owner/admin view, access revoked mid-session, verification-required CTA row, error, offline
- **UX note:** Android's silent early-return on canPerform is the specific failure: a member taps a visible control and nothing happens at all, which reads as a broken app rather than a permission.

## [f3-bills-list] Bills list (member read-only + payer attribution)
- **EXTEND_EXISTING** · F3 · platforms: web/ios/android · origin: from-doc · effort/platform: 0.75d
- **Host:** Web bills page + BillsBudgetCard; iOS BillsListViewModel; Android bills list.
- **Entry:** Home dashboard Bills card; Place file Money section; bill_paid notification
- **Job:** Let a co-resident see the household's bills and see who paid what, so two people do not pay the same bill.
- **Contents:** finance.view read-only list (no Mark paid), payer attribution on the row, highlight-from-notification support (already present on web via highlightBillId), and rows that open the bill detail rather than writing from the list.
- **Visualization:** Row grammar: provider, amount, due date, status chip, and 'Paid by Sam · Sep 15' as the secondary line — the attribution is what gives the push an in-app twin.
- **States:** loading, Upcoming / Paid / All, member read-only, manage, highlighted from a notification, permission-denied, error, offline
- **UX note:** Keep mark-paid semantics identical everywhere it exists, or remove the write from glanceable surfaces entirely: a mis-tap on a card the user was skimming should not mark a household bill paid and notify everyone.

## [f3-members-roster] Members roster (one surface, honest invite, no fake guest form)
- **EXTEND_EXISTING** · F3 / F3b · platforms: web/ios/android · origin: merged · effort/platform: 1.5d
- **Host:** Web: collapse /app/homes/[id]/members into a thin wrapper over the dashboard Members & Security tab (or delete the tab in favour of the route) — today they are two unlinked 537-line surfaces. iOS MembersListViewModel; Android MembersListScreen.
- **Entry:** Home dashboard Members tab; Place file 'People' rows; Household block 'Who lives here'; Invite banner 'You have 2 invitations'
- **Job:** Let every member see who lives here, show honestly how each person was verified, and make the Invite button actually invite.
- **Contents:** Roster grouped by role; per-row verification-source note; pending invites (managers only) including the 'Needs reissue' row with one-tap reissue after the permissions migration; the FIX — both web Invite buttons currently route to /members/add-guest, whose handleSubmit makes no API call and toasts success unconditionally. That page is DELETED and 'Add guest' points at the working Share Center.
- **Visualization:** Role groups with one row per person. The verification note is NOT a status chip on the name — it appears only where something is locked, as a quiet capability caption, because badging your housemates as 'Address-verified' vs 'Household member' reads as a social ranking of the people you live with rather than a note about what they can do.
- **States:** loading, member view (no FAB, no role editing, no pending section), owner/admin view, empty, permission-denied, pending invite, needs reissue, sending / reissuing, error, offline
- **UX note:** Resolves the two critiques' disagreement in favour of the first-time reader: the IA lens wanted per-row source chips removed, the F3b analysis wanted the distinction visible. Answer — put the explanation on the ACTION (the locked-action row), never on the person. Also note the roster is where a lying screen currently sits one tap from the flow F3 is fixing; deleting add-guest is not optional cleanup.

## [f3-household-calendar] Household calendar (give the built screen an entry point)
- **EXTEND_EXISTING** · F3 / F5 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Web /app/homes/[id]/calendar → HomeAgenda, which is fully built with a gated read-only mode and linked from NOWHERE in the app; iOS HomeCalendarViewModel; Android HomeCalendarScreen.
- **Entry:** Home header tab; Dashboard Calendar card; Place file Dates section ('Everyone here can see these →'); home_event_created notification
- **Job:** Deliver F3's promise that a co-resident can read and edit the household calendar, and make the T3 toast ('Saved to your household calendar') true.
- **Contents:** Add the missing links (Home header tab + dashboard Calendar card 'Open calendar' + the place file's Dates section). Turn on member editing now that calendar.edit is a member default. Plot AddressCalendarRule occurrences — the user's dates and pickup — alongside home events and the derived task/bill/package due dates, read-only here (editing goes back to the Date sheet, one write path). DELETE the dashboard's separate HouseholdCalendar 7-day aggregate; two calendars with no cross-links is the inconsistency this feature is meant to fix.
- **Visualization:** The agenda already mixes four item types; address rules become a fifth with a visual rule for 'annual, self-entered' vs 'this week, derived' so a lease end does not read like an overdue task. Rows carry the same filled/hollow/tick provenance marks as Today.
- **States:** loading, agenda with events, empty, member with calendar.edit, legacy member read-only (explained), derived items hidden per their own permissions, create-event sheet, a month with one annual date and nothing else (must not look broken), error, offline
- **UX note:** The cheapest win in F3: the screen exists, works, and has zero links, so F3's calendar acceptance criterion fails on web for a reason that costs a day. Android needs a /homes/:id/calendar router branch or the notification lands on the dashboard.

## [f3-bill-detail-web] Bill detail (new web route)
- **NEW_SCREEN** · F3 / F5 / F10 · platforms: web · origin: added-by-critique · effort/platform: 0.5d
- **Host:** New route /app/homes/[id]/bills/[billId] — today the bills directory contains only page.tsx, so web has no bill-shaped destination at all.
- **Entry:** bill_paid notification; Bill reminder push; Bills list row; Today 14-day strip money row (phase 2); Mail piece 'Added to bills' (phase 2)
- **Job:** Give every bill push, notification and calendar row an exact surface to land on, as design rule 4 requires.
- **Contents:** Provider, amount, due date, status, payer attribution ('Paid by Sam · Tue'), Mark paid / Already paid gated on finance.manage, Edit, Remove — and in phase 2 the photo provenance block and the 12-month trend. Fixes the confirmed bug on the way in: the list writes status 'cancelled' while the Upcoming filter excludes only 'canceled', so a deleted bill stays listed.
- **Visualization:** Amount and due date as the headline, status as a single chip, everything else subordinate. Provenance and trend sit beneath as evidence, never as a banner above the number the user came to see.
- **States:** loading, unpaid, due today, overdue, paid (landing after a reminder reads as reassurance, not an error), member read-only (Mark paid absent with reason), deleted since the push ('This bill was removed'), permission-denied, error, offline
- **UX note:** A few hours of work that unblocks four other surfaces. Without it, every money push on web lands on a list and the monthly-return step of the loop breaks quietly. Ship the matching Android router branches for /bills and /calendar in the same PR — DeepLinkRouter enumerates eight /homes/:id children and sends everything else to the dashboard.

## [f3-household-notifications] Household activity notifications (rows, channel, routing)
- **EXTEND_EXISTING** · F3 / F5 / F10 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Web /app/notifications + notificationRoutes.ts; iOS notification centre + DeepLinkRouter; Android NotificationDispatcher.channelFor + DeepLinkRouter.
- **Entry:** Push tray; In-app notifications list; Notification settings ('what you'll get')
- **Job:** Make 'Sam marked the water bill paid' arrive, read clearly, and land on the thing it describes — and do the same for date and bill reminders.
- **Contents:** Types: bill_paid → the bill; task_completed → the task; home_event_created → the calendar; calendar_date reminder → Today with the rule highlighted; bill reminder → the bill. An in-app row always exists even with push off. New router branches on Android for /bills, /calendar and /place/today?rule=; a household push channel so muting co-resident chatter does not mute security alerts.
- **Visualization:** Two-line rows with an actor avatar and a home label when the user belongs to more than one home: 'Sam marked the Clark PUD bill paid' / '$84 · due Sep 20 · Maple St'. Reminder rows carry the same provenance mark as the calendar row they came from, so an unconfirmed deadline is unconfirmed in the tray too.
- **States:** unread / read, push disabled at OS level (in-app twin present), same-day grouping when several bills are paid at once, landing target resolves, landing target gone (graceful fallback to the list, never a blank screen), T1 vs T3 routing (rule links must branch on scope, not assume a home id), error, offline
- **UX note:** Two of the three new links mis-land on Android on day one without the router branches, and channelFor's prefix mapping drops all of them into SYSTEM. Fix both with the feature, not after.

## [f3b-invitation-decision] Invitation decision (what you get now vs what needs verification)
- **EXTEND_EXISTING** · F3b · platforms: web/ios/android · origin: from-doc · effort/platform: 1d
- **Host:** Web AuthenticatedInvitationPage / PublicInvitationPage at /invite/[token]; iOS HomeInvitationDecisionView; Android HomeInvitationDecisionScreen.
- **Entry:** Invite link / token deep link; Invite banner Review; Manual invite-code entry
- **Job:** Let someone accept household access understanding exactly what it does and does not give them — and land them somewhere useful.
- **Contents:** Home, city, inviter, offered role, access window, expiry, Accept / Decline. Replaces the ownership sentence with a two-column scannable list: 'What you get now' (calendar, bills, tasks, members, the household's pickup day) vs 'What needs address verification' (residency letter, Residency Pass, neighbor messages, Real Rent, Block Founder rank). Accepted state gains primary 'Verify this address' and secondary 'Open Home'. The signed-out path preserves the token through register and returns here.
- **Visualization:** Two short columns of ticked and locked rows instead of another paragraph — the paragraph is exactly why the current line reads as legalese. Lead with the grant; the limits are a scannable list, not a warning.
- **States:** loading, offer, accepting, accepted (verify next step), declined, expired, revoked, already a member, INVITE_POLICY_CHANGED — blocked with the reason, signed-out variant, error, offline
- **UX note:** Do NOT auto-present the verify sheet on accept — that turns a welcome into a nag. Make it the success screen's primary CTA with a 'later' that costs nothing. Blocking dependency: see the owner-attestation entry; if no verification method accepts a non-owner occupant on an already-claimed home, this CTA leads to an uncompletable sheet.

## [f3b-verify-address-sheet] Verify this address (one sheet, many callers)
- **NEW_SHEET_OR_MODAL** · F3b · platforms: web/ios/android · origin: from-doc · effort/platform: 1d
- **Host:** Web reuses VerifyPromptSheet from new hosts; iOS and Android have only an inline verify banner and need the sheet itself.
- **Entry:** Invitation accepted screen; Any locked attested action; Place dashboard verify banner; Place file 'Proof' row; Members roster capability caption
- **Job:** One consistent place to understand what address verification adds and start it — parameterised by WHY it opened.
- **Contents:** A reason string in the header ('To send neighbor messages…', 'You've joined this household…'), an identical body: the unlock list, then method cards (postcard code, document, landlord confirmation, owner attestation) each with a time-to-result and its requirement line.
- **Visualization:** Unlock list first, capped at the two people actually want, with the rest collapsed; method rows below carry an ETA chip each so the choice is 'how fast' rather than 'what is this'.
- **States:** loading methods, method picker, a method unavailable for this address type, a method unavailable to a non-owner occupant (stated, with the owner-attestation path offered), verification already pending (status, not a second start), already address-verified (never opens), error, offline
- **UX note:** Two sheets would be the obvious mistake here — one for 'after you accepted' and one for 'you tried to do a thing'. One sheet plus a reason parameter keeps the body identical and the header honest.

## [f3b-locked-action-row] Address verification needed (the locked-action treatment)
- **NEW_CARD_IN_EXISTING** · F3b · platforms: web/ios/android · origin: from-doc · effort/platform: 1.5d
- **Host:** Every surface gated by isVerifiedResident: residency letters, Residency Pass, residency claims, fridge cards, Real Rent, Block Founder rank and postcard invites, neighbor-message compose, mail compose, the verified badge, the Founding tier CTA.
- **Entry:** Every attested control (the row replaces the control in place)
- **Job:** Tell a household-verified member why an attested action is unavailable instead of hiding it or 403-ing after the tap.
- **Contents:** One reusable row: lock glyph + one-line reason ('Address verification needed to send neighbor messages') + 'Verify address' link into the sheet. Also re-labels the iOS My Homes green 'Household access' chip, which currently claims verified status and contradicts F3b outright.
- **Visualization:** One lock row that fits under a primary CTA, inside a list row and inside a card header without a bespoke variant per screen — lock, reason, link, one line at 320dp. Never hide, always explain, always offer the path.
- **States:** address-verified (unchanged), household-verified — locked with reason, legacy — treated as address so nobody loses an unlock, verification pending — 'We're checking your postcard code' instead of a verify CTA, server disagrees with the client gate — honest error, never a silent no-op, offline
- **UX note:** Highest-risk part of F3b: flipping isVerifiedResident to false makes controls vanish or 403 with no explanation, and an invited co-resident reads that as the app being broken or the owner blocking them. Ship it in the same release as the migration, or household members get a mystery week. Android is a specific hazard — handleFab and handleQuickAction early-return silently when canPerform is false, so a visible control does literally nothing.

## [f3b-owner-attestation] Confirm this person lives here (owner attestation)
- **NEW_SHEET_OR_MODAL** · F3b · platforms: web/ios/android · origin: added-by-critique · effort/platform: 1d
- **Host:** Opened from the members roster (owner/admin) and from a notification triggered when a household member starts verification on an already-claimed home.
- **Entry:** Members roster row overflow; Notification 'Sam is verifying this address'; Verify sheet's 'Ask {owner} to confirm you live here' path
- **Job:** Give a co-resident a completable path to address verification on a home someone else has already claimed.
- **Contents:** The person, when they joined, what confirming grants them (neighbor messages, residency letter, Block Founder rank), the owner's attestation checkbox with its plain consequence line, Confirm / Decline. Writes verification_source='address'.
- **Visualization:** A short attestation sheet: one person, one statement, one checkbox, two buttons. It reads as a vouching act, not a permissions grid.
- **States:** request pending, confirming, confirmed, declined, owner has revoked the member's access, already address-verified, permission-denied (only owner/admin), error, offline
- **UX note:** Adversarial blocker. F3b's whole 'never hide, always explain, always offer the path' promise collapses if postcard, document and landlord flows all require the owner — every locked control would lead to a sheet nobody can complete, which is worse than hiding the control. Confirm which methods accept a non-owner occupant before the migration; if none do, this sheet is a hard prerequisite for F3b.

## [f4-today-pickup-card] Tomorrow's pickup (push landing + confirm/correct)
- **NEW_CARD_IN_EXISTING** · F4 · platforms: web/ios/android · origin: merged · effort/platform: 1.5d
- **Host:** Today, directly above the 14-day strip. Also the landing content for the night-before push and the notifications-off equivalent.
- **Entry:** Today (always, notifications on or off); Night-before evening-briefing push; Place file pickup row; 14-day strip tonight cell
- **Job:** State tomorrow's pickup, say how confident we are, and let one tap turn a guessed city schedule into the household's own confirmed day.
- **Contents:** Kind glyph (garbage / recycling / both / bulk), headline 'Recycling and garbage tomorrow', line 'Bins out tonight.', the source with its confidence, and the paired actions 'That's my day' (confirms — writes the rule, the caveat disappears, the row flips to 'You · Tuesday') and 'Not my schedule' (opens the provenance sheet's report, then the Date sheet). The push itself rides the evening briefing: title = the headline (not 'Your Evening Briefing'), the unconfirmed caveat as a title suffix so truncation cannot eat it, one push per trigger per day.
- **Visualization:** One emphasis card: kind glyph, one-line headline, one-line instruction, and the confidence expressed as the same hollow/filled mark used everywhere — with the words appearing once ('City schedule, not yet confirmed') rather than per row. The two actions are peers, equal weight: confirming and correcting are both good outcomes, and making 'That's my day' primary would bias the honesty counter.
- **States:** confirmed rule (no caveat, shows who set it), unverified city rule (hollow mark + confirm/correct pair), T1 saved place (writes a saved_place rule — see the SCOPE_RANK blocker), nothing tomorrow (card absent), no pickup rule at all (card reads 'Set your pickup day' as a demoted single line), confirming / saving, confirmed just now, error, stale/offline, suppressed (low-signal day, no push)
- **UX note:** The doc calls F4 backend-only 'with no client work beyond copy'; that is its largest error. This card is the notifications-off equivalent design rule 4 promises, and today it is unreachable on two platforms. Two hard dependencies: a T1 pickup confirmation is silently dropped by applyPrecedence (no 'saved_place' in SCOPE_RANK) and hasHouseholdPickup only matches scope 'home', so the user confirms and the guessed city day keeps rendering — ship the backend fix in the same PR or do not push unverified pickups to saved-place users at all.

## [f4-notification-primer] Notification permission primer
- **NEW_SHEET_OR_MODAL** · F4 / F5 / F3 · platforms: ios/android · origin: added-by-critique · effort/platform: 0.75d
- **Host:** Presented from the briefing opt-in card (or the first pickup confirmation) immediately before the OS prompt. iOS: replaces the launch-time request in AppDelegate.swift:50-61.
- **Entry:** Briefing opt-in card Yes; First pickup confirmation; Household-activity opt-in
- **Job:** Stop burning the one-shot iOS notification grant at cold launch, before the user has a place or a reason.
- **Contents:** One sentence naming exactly what will arrive ('We'll tell you the night before pickup, and nothing else unless something needs you tonight'), Yes / Not now, and only on Yes the system prompt. Android 13+ POST_NOTIFICATIONS follows the same path.
- **Visualization:** A short sheet with a single illustrative example of the actual notification, rendered as a tray card — the user sees the thing they are agreeing to receive rather than a description of it.
- **States:** default, granted, declined (the card falls back to its denied state; the widget becomes the promoted return trigger), already granted (never shown), already denied at OS level (shows Open Settings instead of a prompt)
- **UX note:** Confirmed by reading: iOS fires the system prompt from didFinishLaunchingWithOptions, and iOS never re-asks. Every push in F3/F4/F5 depends on a grant the app currently spends at the worst possible moment. This is a one-day fix that protects the whole notification strategy.

## [x-date-sheet] The Date sheet (one sheet, three modes, ten kinds)
- **NEW_SHEET_OR_MODAL** · F5 (+F2, F4, F6, F12) · platforms: web/ios/android · origin: merged · effort/platform: 2.5d
- **Host:** Presented over the Today tab, over the place file, and from a reminder deep link. Web: SlidePanel pattern. iOS: .sheet. Android: ModalBottomSheet.
- **Entry:** Place file: any missing-fact row CTA; Place file: any known-fact row tap (edit); Today 14-day strip row tap; Today pickup card 'Not my schedule' / 'Set your pickup day'; Reminder push deep link (?rule=<id>); Civic section registration block
- **Job:** 'Tell the app a date' is one job. Today it is specified as seven separate sheets; this is the one component that creates, shows, edits, reminds about and deletes every dated fact at an address.
- **Contents:** Modes: CREATE, VIEW-MINE (edit / remind / delete), VIEW-SEEDED (read-only, source, remind, dispute). Kinds: pickup day (with the recurrence branch — weekday, frequency not_set/weekly/biweekly, explicit next recycling date, never inferred), lease ends, notice deadline, insurance renews, warranty ends, HOA dues, property-tax appeal, voter-registration deadline (seeded, state-scoped), and bill (phase 2, pre-filled from OCR). Fields: kind, date picker (must accept ~2 years out), optional title, 'Remind me' 60/30/7/1 days. Scope ('home' | 'saved_place') is a prop, not a second component: it changes the footer line — 'Only you will see this.' vs 'Everyone in this household will see this.' — and nothing else. Seeded mode adds plain-language explanation ('Your county lets you challenge the assessed value your tax is based on'), the per-method dates for voter registration, and 'I did this' as a labelled self-report.
- **Visualization:** Kind picker as a two-column grid of glyph tiles (one tap, no wizard step) above a native date control; the 'Remind me' row is a four-segment control where the chosen lead renders as a small leader line back to the date, so the reminder is visibly earlier than the event rather than an abstract number. Seeded mode shows the hollow provenance mark beside the date and the authority as a caption. The collision warning renders the conflicting row inline, marked, so the user sees exactly which warranty they are about to overwrite.
- **States:** create, already-set collision — shows the existing row's TITLE and date, not just the kind, with Replace / Add as a separate calendar event (T3) / Cancel, saving, saved, validation: past date; lead longer than the distance to the date, permission-denied (household member without calendar.edit), seeded read-only, deleted with Undo toast (no confirm dialog), offline — save disabled, 'You're offline', AI/manual fallback for bill mode
- **UX note:** The critiques split on whether pickup day is its own control. It is not: making it a kind with a recurrence branch is what unblocks F2's checklist row at T1 (where no pickup control exists at all today) and gives F4's push caveat a one-tap destination. Two backend blockers must ship with this or the sheet silently lies: (1) SCOPE_RANK in addressCalendarService.js:25 has no 'saved_place', so a T1 user's confirmed pickup day is dropped whenever a city rule exists for that kind — their correction is invisible; (2) the lead_days CHECK is 0–30 and the only value anyone picks for a lease notice is 60. Delete-with-Undo replaces all three proposed destructive dialogs (the pattern already ships at Android SavedPlacesScreen.kt:85-90).

## [f5-today-calendar-strip] Next 14 days at this address (strip + rows)
- **NEW_CARD_IN_EXISTING** · F5 / F4 / F6 / F12 · platforms: web/ios/android · origin: merged · effort/platform: 2d
- **Host:** Today. Web AddressCalendarCard re-hosted on hub/today; iOS PlaceTodayDetailContent's calendar block; Android AddressCalendarSection. Scope-aware ({scope:'home'|'saved_place', id}) instead of homeId.
- **Entry:** Today (always visible); Place file year band → 'this fortnight'; Reminder push with a rule id (row highlights on arrival)
- **Job:** Show the next two weeks at this address as a shape, not a paragraph — pickup cadence, the user's own dates, seeded civic rows — with each item's provenance visible at a glance.
- **Contents:** A 14-day strip above the existing list; list rows below with kind glyph, title, relative day and the provenance mark; a persistent '+ Add a date' row at the foot that opens the Date sheet (NOT a header toggle); pickup day folded in as a kind; statewide seeded rows (voter registration, tax appeal) explicitly scope-labelled 'Statewide — WA' / 'Clark County'; bills as items in phase 2. Six new PlaceCalendarKind members each need an icon in every client — KIND_ICON is a total Record, so widening the union is a compile error until they are all drawn.
- **Visualization:** 14 equal cells, today leftmost, weekday initial beneath each, weekend cells tinted so the pickup cadence reads as a rhythm. One dot per event inside its day cell, coloured by class (pickup / civic / money / yours), capped at three then '+N'. Dots carry the provenance encoding: filled = official, hollow = unconfirmed, tick = you entered it. A statewide row renders as a full-height bar spanning the cell rather than a dot, so it visibly is not a claim about this house. Tonight's pickup emphasises cell 2 — an emphasis, never an alert banner.
- **States:** loading, ready, empty — 14 drawn-but-empty cells ('checked, nothing found', visually distinct from a failed section), stale/partial section fallback, unverified city rule, user-entered rule, seeded statewide rule, permission-denied (rows visible, no '+ Add'), T1 saved place, error (no strip at all rather than an empty one)
- **UX note:** A dated 14-day sequence rendered as a text list cannot answer the one question the window exists for, and its empty state is indistinguishable from a broken section. The strip also gives F4's 'tonight' a spatial anchor and F6's statewide deadline a way to sit in the card without reading as an address-specific claim — which is precisely the honesty failure the pilot scores at zero. The doc's '+ Date' header toggle is the wrong affordance: a list gets a list row, not a mode switch.

## [f6-home-basics-rows] Home basics: move-in date + restore the mover rows
- **EXTEND_EXISTING** · F6 · platforms: web/ios/android · origin: from-doc · effort/platform: 0.5d
- **Host:** Per-home settings: web /app/homes/[id]/settings (editor at /edit:320); iOS HomeSettingsViewModel; Android HomeSettingsScreen.
- **Entry:** Home settings; Place file 'Moved in' row (tap to set); Undo toast after dismissing the mover rows
- **Job:** Make the gate for the whole mover experience editable, and give a synced dismissal a way back.
- **Contents:** Two rows in Home Info: 'Moved in' with a date control (PATCH /api/homes/:id { move_in_date }) and a helper line saying what it drives ('Shows your first-week steps for 60 days'); and 'Moving checklist — Show again', visible only while dismissed.
- **Visualization:** Two plain settings rows; the only decision is the native date control and the helper line, without which 'Move-in date' reads as trivia rather than the switch that turns the mover experience on.
- **States:** move-in date unset ('Not set'), set / editable, future date or >60 days ago (warn the rows will not appear), saving, save error, permission-denied (non-owner sees it read-only), dismissed (restore row present), never dismissed (restore row absent)
- **UX note:** Highest-leverage half-day in F6: both natives can only ever stamp move_in_date = today from an add-home checkbox and have no correction path, so a mover who claims their address three weeks after moving gets a window three weeks wrong and anyone who missed the checkbox never sees the rows at all — F6's acceptance criteria are literally unreachable on iOS and Android today.

## [f6-place-section-details] Place section details: risk instrument, free radon kits, registration deadline
- **NEW_CARD_IN_EXISTING** · F6 / F8 / F12 · platforms: web/ios/android · origin: merged · effort/platform: 1.5d
- **Host:** Place > Risk & readiness (presentation.tsx lead_radon + flood/wildfire entries, /app/place/risk) and Place > Civic (CivicDetail / PlaceCivicDetailContent / PlaceMoneyCivicDetailContent).
- **Entry:** Place > Risk & readiness; Place > Civic; Place file 'Voter registration' row; Compare scale strip tap (the in-app twin of the share card); T0 preview radon aha follow-up
- **Job:** Make the in-app risk page the same instrument the share card uses, give the radon card its one genuinely free action, and give voter registration a durable home after the mover rows expire.
- **Contents:** RISK: the four-layer scale strips (flood, wildfire, air today, radon) replacing independent inline chip rows, plus a free-kit action line under the existing screening disclaimer ('Free test kits · Washington Dept of Health' from program_url, or 'Radon program · {State} DOH', or nothing at all where no program exists). CIVIC: a 'Your registration' block above the existing election banner — state, deadline, days remaining, per-method dates, the provenance mark, source link, and 'Check or update' opening the Date sheet in seeded mode.
- **Visualization:** Risk: four stacked scale strips, each drawn on its OWN authority's named bands (FEMA zones; USFS 1-5; EPA's six AQI bands; radon zones 3-2-1) with a marker in the band and the band's plain name beside it — never a shared letter scale, never a radar. The free kit renders as an action pill with an arrow, visually separated from the grey disclaimer, because stacking a second grey under an existing grey buries the only free thing on the card. Civic: the registration block outranks the election banner, because a dated action beats an informational fact.
- **States:** ready, partial coverage, no program for this state (line absent, never a generic EPA fallback), no seeded rule for this state (block absent, not an empty shell), deadline passed (collapses to the existing 'No upcoming election'), unverified confidence (hollow mark + source), section unavailable / error, home-gated (these details resolve the primary home only — show the address in the block header for multi-home users)
- **UX note:** Merging the radon kit and the registration block into one entry keeps 'seeded facts get a source and an action' as a single pattern applied to two section cards. Making the risk detail use the compare card's strips means the most-shared artifact in the product is visibly a preview of the app rather than a separate marketing object — and it gives the compare chips a tap destination, which they otherwise lack.

## [f7-today-widget] Today at your address (home-screen widget, three sizes)
- **NEW_WIDGET** · F7 · platforms: ios/android · origin: merged · effort/platform: 3d
- **Host:** iOS: new PantopusWidgets/TodayWidget.swift + a third bundle entry + TodayWidgetSnapshot shared into the extension via project.yml. Android: TodayWidgetProvider cloned from TasksNearMeWidgetProvider + layout + info xml + manifest receiver. Snapshot only — the extension can never call the API.
- **Entry:** OS widget gallery; Place file 'Put today on your home screen' row; How-to sheet
- **Job:** Give the address a reason to be on the home screen: what's due, what the air is, what's next — with no push and no permission.
- **Contents:** Snapshot contract {generatedAt, placeLabel, nextPickup{kind,date,unverified}?, aqi{index,label}?, nextDate{kind,title,date}?, year?}. Relative day words computed at render from the stored ISO date, never a stored days_until. Urgency promotion ladder shared by both platforms: pickup within 1 day > AQI ≥ 101 > nearest date > any pickup > any AQI.
- **Visualization:** Each size earns its area with a different FORM, not more strings. SMALL: one promoted fact chosen by the urgency ladder, with its glyph and provenance mark. MEDIUM: the promoted fact as a hero line, then the 14-day dot strip (about 120pt at 6pt cells — the same instrument as Today), then AQI as a micro band-bar with a marker instead of the string 'AQI 42 Good'. LARGE: the 12-month year strip above today's three lines — the only place the annual promise is visible without opening the app. Stale greys the marks but keeps the strip geometry, so 'nothing due' (drawn cells, no dots) and 'stale' (greyed dots) are different pictures.
- **States:** fresh, partial (any one or two facts nil — distinct layouts, not blanks), pickup not set (a demoted line, never the hero — a chore does not belong in a surface people added to feel informed), unverified pickup (hollow mark), stale >6h (marks greyed, geometry kept, 'Open to refresh'), no snapshot ever written, no place ('Save an address to see today here' — only where the add-a-place sheet exists), dark mode, iOS tinted/accented rendering (marks must survive desaturation)
- **UX note:** Three equal text lines gives a lease notice twelve days out the same weight as tomorrow's recycling, and nothing earns a second size. One snapshot key + StaticConfiguration is acceptable for a one-address-per-mover pilot, but placeLabel is then the only tell of which address this is — so it must never be the line that truncates.

## [f7-widget-tap-landing] Widget tap landing (attribution + forced refresh)
- **EXTEND_EXISTING** · F7 · platforms: ios/android · origin: from-doc · effort/platform: 1d
- **Host:** iOS DeepLinkRouter (which today reads only deliveryId/kind and discards every other query param) + TodayTabRoot; Android DeepLinkRouter + RootTabScreen + TodayTabViewModel.
- **Entry:** Any tap on either widget size
- **Job:** Make the tap honest: open the exact surface the widget summarises, refresh it so the snapshot is rewritten, and record that this open came from the widget.
- **Contents:** Parse ?src=widget; force refresh() (not the idempotent load()); write the snapshot on success; post session_open {trigger:'widget'} — which requires the first funnel-event client either native app has ever had. Adds an 'Updated just now' / 'Updated Nm ago' line to the Today header so a user who tapped 'Open to refresh' can see it happened.
- **Visualization:** Refresh-in-place: a thin progress line under the header, content untouched. Blanking a screen someone tapped a widget to reach is the one thing this landing must never do.
- **States:** loaded, refreshing in place (content stays; never the skeleton), refresh failed (last content + inline 'Couldn't refresh'), cold start (full skeleton is acceptable — no prior content), no place → the add-a-place sheet, offline
- **UX note:** Two confirmed bugs, not risks. (1) Android maps 'today' to the hub BRIEFING screen, so a widget tap lands on a different payload than the widget showed — and for a T1 user that screen has no empty state and hard-errors. (2) Both Today view models are idempotent once loaded, so 'Open to refresh' can open a warm app, write no snapshot, and leave the widget grey permanently. Fix both here or F7 is a decoration.

## [f7-widget-gallery] Widget gallery entry (name, description, preview)
- **NEW_WIDGET** · F7 · platforms: ios/android · origin: from-doc · effort/platform: 0.5d
- **Host:** iOS configurationDisplayName/description + a POPULATED placeholder(in:); Android receiver label + description + a dedicated static previewLayout and new strings.
- **Entry:** OS widget gallery browse
- **Job:** The only place a person browsing their phone's widget gallery learns this exists — the whole top of the widget funnel.
- **Contents:** Name 'Today at your address'; description promising a fact, not a feature ('Pickup, air and your next date — no notification needed.'); preview artwork with plausible sample content at each size.
- **Visualization:** A dedicated preview composition with sample data — 'Recycling + garbage Tue', the 14-day strip half-populated, 'AQI 42' mid-band — never the live layout.
- **States:** sample preview (each size), iOS redacted placeholder, dark mode
- **UX note:** The existing Android widget sets previewLayout to the LIVE layout, so cloning that pattern would sell the widget to a brand-new user with the words 'Save an address to see today here'. Same trap on iOS if placeholder(in:) returns nil.

## [f7-widget-howto-sheet] Add the widget (how-to, with a live preview)
- **NEW_SHEET_OR_MODAL** · F7 · platforms: ios/android · origin: from-doc · effort/platform: 0.75d
- **Host:** Presented from the place file's 'Put today on your home screen' row — iOS .sheet with a medium detent; Android ModalBottomSheet.
- **Entry:** Place file widget row; Notification settings (for a user who declined push — the widget is the better offer)
- **Job:** No public API can place a widget for the user, so the only way this converts is by showing the reward first and then teaching three OS gestures.
- **Contents:** A live preview of the user's OWN widget rendered from their real snapshot, then three numbered platform-correct steps, then Done. No fake 'Add it for me' button.
- **Visualization:** Preview at true size at the top, three compact illustrated gesture steps beneath, fitting a medium detent without scrolling. The preview, not the instructions, is the top of the sheet: the user sees their own recycling day before being asked to do anything.
- **States:** default (live preview), no snapshot yet (falls back to the gallery sample), no place (CTA becomes 'Save an address first'), iOS step set vs Android step set, dark mode
- **UX note:** Keep the steps to gestures ('touch and hold the home screen') rather than exact menu items, and never screenshot a specific OS version. Ranking the widget above the briefing opt-in for a permission-denied user is the best UX decision in F7 — it is the only return trigger that needs no permission at all.

## [f8-scale-strips] The four-layer reading instrument (scale strips)
- **NEW_CARD_IN_EXISTING** · F8 · platforms: web/ios/android · origin: added-by-critique · effort/platform: 1.5d
- **Host:** Shared component: the compare arrival header, the compare reveal, the compare sheet preview, the OG route, and the Place > Risk detail. Today these four chips are assembled ONLY inside /api/og/place and have never been rendered as UI.
- **Entry:** Compare arrival header; Compare reveal; Compare sheet preview; OG card; Place > Risk & readiness
- **Job:** Make four readings from four different authorities comparable without inventing a grade or judging a home.
- **Contents:** Four rows — Flood (FEMA zone), Wildfire (USFS hazard, quarter-mile), Air today (AirNow), Radon (county zone, EPA). Each row: layer name, the plain value FIRST, the authority as a caption, the provenance mark, and a tap into the provenance sheet. NO letter grades anywhere.
- **Visualization:** Per layer, a horizontal track segmented into THAT authority's own named bands, with a marker positioned in the band and the band's plain name printed beside it. Tracks never span layers, so nothing sums or averages into a verdict. Three sizes drawn once: OG card, compare row, risk detail.
- **States:** all four present, a layer with no data → greyed track, no marker, 'Not on record' (never a blank row; the two compare columns must stay the same length), unverified reading → hollow marker, air is time-scoped and always says 'today', sender's frozen token values vs the viewer's live values (freshness stated), narrow width → captions collapse to one 'Sources: FEMA, USFS, AirNow, EPA' line rather than dropping provenance
- **UX note:** This kills F8's letter grades, which are the pack's clearest honesty blocker: the token declares g:{flood:'A',wildfire:'C',air:'B',radon:'D'} for four incommensurable labels, manufacturing a shared ordinal scale that does not exist, with no legend — and converting 'what's on record about an address' into a report card on somebody's home, which is exactly what the pilot scores at zero. A radar chart is worse (it normalises unlike axes and encodes area, so a bigger blob reads as a worse home). Also add a confidence field to the compare token, or drop unverified layers from the card rather than shipping them as confident.

## [f8-compare-arrival-header] Compare arrival header on /start
- **NEW_CARD_IN_EXISTING** · F8 · platforms: web · origin: from-doc · effort/platform: 1d
- **Host:** StartFunnel HeroStep at /start?vs=<token>; nearest precedent is the existing 'from the card in your mailbox' pill.
- **Entry:** A friend's /start?vs= link (SMS, chat, email unfurl)
- **Job:** Show a stranger what their friend's place reads, and put their own address field in the still-empty second column so the only obvious next move is to type.
- **Contents:** Left: the sender's card decoded from the token — optional first name + city, the four scale strips, the aha headline. Right: 'Your place', empty, holding the address field and 'See your place', with the privacy proof line. The from-card pill and the compare header never both render; precedence is defined.
- **Visualization:** Above 640px, two columns. Below it — which is where nearly every compare link is opened — the sender collapses to a ONE-LINE strip (name · city · four tiny markers, tap to expand) sitting directly above a still-autofocused address field. The doc's 'compare header above the hero' pushes the field below the fold on a phone, which is the exact opposite of the spread goal.
- **States:** verifying token (sender skeleton), valid, sender named, valid, anonymous ('A place in Camas, WA'), expired or tampered → quiet banner 'That comparison link has expired. Type an address to see your own place.' and the ordinary hero, token verify offline → render decodable chips or the expired banner, signed-in viewer → header swaps 'Sign in' for 'Save this address', <640px → sender column collapses
- **UX note:** A signed-in pilot user opening a friend's link is the most likely recipient in a 30-mover pilot, and today PlaceHeader tells them to sign in to an account they are already in. Fixing that is one state, not a screen.

## [f8-compare-reveal] Compare reveal (a third funnel step)
- **NEW_SCREEN** · F8 · platforms: web · origin: from-doc · effort/platform: 1.5d
- **Host:** An explicit third state of the StartFunnel state machine (hero | compare-reveal | preview) at /start?vs=<token> after submit.
- **Entry:** Submitting an address from the compare arrival header
- **Job:** The payoff moment — their place next to the sender's, layer by layer — before dropping them into their own full preview.
- **Contents:** The comparison block, then the recipient's own aha, money lead, Band-A groups, locked Band-B and the WallBar unchanged. Ends with a quiet divider so the compare block and the recipient's aha are not two competing headlines.
- **Visualization:** ONE comparison table: four rows, one per layer, each row a SINGLE track carrying BOTH marks — sender filled, 'You' ringed — with the layer name above and the two plain-language values beneath left and right. Rows ordered by distance between the marks, descending, so the one real difference is row one — never a fixed order and never 'worse first'. True two-column cards only above 768px, as a presentation of the same rows.
- **States:** loading (a two-column skeleton that does not exist today), both revealed, both marks in the same band (merged mark + 'Both minimal' — the most common outcome and the one the doc omits), recipient geocode failure — KEEPS the sender's marks and retries inline (today CouldNotPlace resets the funnel and destroys the sender column), unsupported region — same rule, a layer missing for the recipient ('Not on record here'), legacy free-tiles fallback when sections is empty, offline after reveal
- **UX note:** Two literal facing cards at 375px is eight markers and eight captions, and two scorecards invite a winner — the neighbour-judgment failure. A shared track reads as two readings on one instrument, works identically at 375 and 1200px, and solves the OG card with the same component. It is a screen, not a card: it has its own skeleton, its own error rules and its own place in the funnel state machine.

## [f8-compare-sheet] Compare with a friend (mint + consent)
- **NEW_SHEET_OR_MODAL** · F8 · platforms: web · origin: from-doc · effort/platform: 1d
- **Host:** Opened from a secondary button under the aha card in the preview step and from the reveal ('Send yours back').
- **Entry:** Under the aha card in the T0 preview; Compare reveal 'Send yours back'; WallBar footer (demoted)
- **Job:** Mint and send a compare link in one tap, showing — before the link exists — exactly what the card will and will not reveal.
- **Contents:** A live preview of the card at share-card proportions; the privacy line 'This card shows readings and your city, never your address.'; an off-by-default 'Show my first name on the card' toggle + field; 'Copy link' on desktop / 'Share' on mobile. Fires t0_share_clicked with method 'compare'.
- **Visualization:** The card preview is the top of the sheet, at the proportions it will unfurl in a messenger, with the privacy sentence directly beneath it and the button last — so consent precedes the link rather than following it.
- **States:** idle, name field shown, minting, mint error, rate limited (distinct copy, not a generic error), copied (18s confirmation), share sheet opened, share cancelled (must not read as failure), reciprocal variant from the reveal
- **UX note:** The doc puts the privacy sentence in its own §Privacy section; if it lands after the link is made, the consent is retroactive. Also keep 'Compare with a friend' out of the WallBar footer, which already carries share + app-download — a third link there becomes a 3-up row on a phone.

## [f8-og-compare-card] Compare share card (OG image)
- **EXTEND_EXISTING** · F8 · platforms: web · origin: from-doc · effort/platform: 1d
- **Host:** /api/og/place (edge), referenced from /start generateMetadata.
- **Entry:** Any shared /start?vs= link unfurling in a messenger or social app
- **Job:** Be the thing a stranger actually sees first — the unfurled card in a chat — and make 'Yours?' the obvious question.
- **Contents:** With ?vs=: left column the sender (city, optional first name, four scale strips, headline truncated ~140); right column a filled, inviting 'Yours? → pantopus.com' prompt card of equal visual weight; footer carries the contrast line. Cache-Control public, max-age=3600 since the token is immutable. Data comes from the TOKEN only, never a live no-store fetch, or a slow upstream times out the unfurl and the link shows no image.
- **Visualization:** Two columns at 1200x630 using the same scale-strip rows as the app, so the share artifact is visibly a preview of the product. The 'Yours?' column is a filled prompt, not an outlined ghost — an empty outline reads as a rendering failure in a chat thread, and it is the whole conversion mechanic. Must survive the 400px thumbnail crop some clients use.
- **States:** vs valid, vs expired or tampered → falls back to the generic single-address card, NEVER an error image in someone's chat, no vs (unchanged), headline over the slice limit (ellipsis, never mid-word garbage), no first name, cached
- **UX note:** The expired-token fallback is not in the doc and is the one state that can embarrass the product in someone else's group chat.

## [f8-native-share-compare] Share + compare actions on the native T0 preview
- **EXTEND_EXISTING** · F8 · platforms: ios/android · origin: from-doc · effort/platform: 1d
- **Host:** iOS PlacePreviewBody (no share control exists at all today) using SystemShareSheet; Android PlaceLaunchScreen's existing ShareAddressLink.
- **Entry:** T0 preview aha card
- **Job:** Give the native funnels the same one-tap spread as web without building a native compare screen in v1.
- **Contents:** A tertiary text-button row under the aha: 'Share this address' and 'Compare with a friend'. Compare mints a token and hands <web base>/start?vs=<token> to the system share sheet. No first-name field in v1, so the card is anonymous — say so in a one-line caption rather than implying it is personalised.
- **Visualization:** A text-button row, never filled buttons, and never inside the sticky wall — the wall's 'Continue' stays the single primary at the moment the funnel wants a sign-up.
- **States:** idle, minting (disabled + spinner), mint error, offline (compare disabled), no share targets (Android), iOS: both controls are net-new on that screen
- **UX note:** Neither native app has any funnel-event emitter, so compare sends from native are unrecorded and the spread metric stays web-only — it understates k rather than inflating it, which is the acceptable direction. Adding the emitter is F7's job (the widget needs it for session_open), so these get it for free if F7 lands first.

## [f8-positioning-copy] Positioning line + contrast line
- **COPY_ONLY** · F8 · platforms: web/ios/android · origin: from-doc · effort/platform: 0.5d
- **Host:** Five hard-coded copies: /start page metadata, StartFunnel H1, marketing HeroSection, PlaceLaunchView.swift:128, PlaceLaunchScreen.kt:143 — plus the new OG footer.
- **Entry:** /start hero (all platforms); Marketing homepage; OG card footer
- **Job:** Say in one sentence what Pantopus is and, under it, what it is not, so a stranger from a friend's card knows in two lines why this is not another neighborhood app.
- **Contents:** POSITIONING_LINE unchanged in text but promoted to one constant; POSITIONING_CONTRAST ('Nextdoor is what your neighbors say. Pantopus is what's on record about your address.') as a caption under the hero lede on all three platforms and in the OG footer.
- **Visualization:** Caption weight, clearly subordinate to the H1 and typographically distinct from the lede — one line at ≥640px — or the hero becomes three competing paragraphs.
- **States:** default, narrow viewport (wraps without pushing the address field off-screen), compare arrival (contrast line moves BELOW the address field so the sender card and the input keep the first viewport)
- **UX note:** Build note the doc misses: frontend/packages/types/src/copy.ts does not exist, so 'one constant per platform' is a new module plus a types rebuild across every consumer, not a five-file find-and-replace.

## [f8-seasonal-aha] Rotating seasonal aha card
- **EXTEND_EXISTING** · F8 / F12 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** The anonymous preview aha card: web AhaCard, iOS PlacePreviewBody, Android PlaceLaunchScreen — all rendering the server-ranked aha from pickAha.
- **Entry:** T0 preview (web, iOS, Android); Compare arrival header (sender's headline)
- **Job:** Make the single headline on the anonymous preview be the fact that is actually urgent this month at this address.
- **Contents:** New content shapes: a dated deadline headline ('Voter registration for November 3 closes {date} in {state}'), a tax-appeal window headline, a January radon headline whose follow-up is an outbound free-kit link, and the unchanged calm fallback. Each seasonal headline carries a source and, for seeded rows, the unverified treatment — which must survive into the 90-char token headline and the OG card, where there is far less room.
- **Visualization:** The card gains a date treatment it does not have today — the deadline as a dated chip beside the grade badge — and a visibly secondary outbound follow-up, distinct from the existing follow-up button that scrolls to the wall. Keep 'Claim this address' unambiguously primary: this is the one outbound link before the wall, at the moment of highest intent.
- **States:** seasonal match, no match (existing ranked aha), calm fallback, seeded, unverified (hollow mark + source), no program_url for the state (headline only, no link), date already passed (suppressed, never a past deadline)
- **UX note:** The honesty risk outweighs the layout risk: F6/F12 seeds ship with confidence 'unverified', and a headline reading 'Registration closes October 5' with no caveat is exactly the failure the pilot counts at zero. Do not silently repurpose the existing single follow-up action — an identical-looking button doing two different things depending on the month is worse than two buttons.

## [f9-privacy-mirror] What neighbors see (user-scoped, with 'Your posts')
- **EXTEND_EXISTING** · F9 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Web /app/homes/[id]/privacy; iOS PlacePrivacyMirrorView; Android PlacePrivacyMirrorScreen — re-scoped from home-gated to user-scoped with a place selector.
- **Entry:** Place file 'What neighbors see' row; Place dashboard privacy-mirror row; Post composer location picker
- **Job:** Make the coordinate-leak fix legible and checkable, to the people most likely to be posting from a bookmarked address.
- **Contents:** A third row beside address and profile: the jitter ring drawn to scale against a street grid, the literal string a neighbor gets, the count of the user's public posts, and a link into the feed location control. Plus the same one-liner inline in the post composer's location picker, where the decision is actually made.
- **Visualization:** A map thumb with the jitter radius drawn as a real ring over a street grid, at scale — a described radius is an unfalsifiable claim; a drawn one is checkable. The neighbor's literal view is quoted verbatim beneath it.
- **States:** loading, T1 saved place (the whole point of the re-scope), T3 home, no public posts yet, error, offline / cached
- **UX note:** Home-gating this mirror means the coordinate-leak promise is invisible to exactly the T1 cohort F1 creates and the pilot recruits. The fix is server-side and otherwise invisible: shipped silently, nobody learns the leak was closed and nobody can verify it. Android also needs a /homes/:id/privacy router branch for any future privacy push.

## [f9-curator-chip] Pantopus curator chip + 'Why am I seeing this?'
- **EXTEND_EXISTING** · F9 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Feed post card and detail on all three platforms, plus the Pulse and map card variants that share the data but not the component.
- **Entry:** Feed card author row; Pulse card; Post detail overflow
- **Job:** Let a reader tell at a glance that a post came from Pantopus rather than a neighbor, and understand what they are muting.
- **Contents:** A 'Pantopus curator' chip replacing the neighbor identity affordance, a 'Source: {publisher}' line under the body, Report and Mute unchanged in the overflow, and a 'Why am I seeing this?' overflow item that expands IN PLACE with four short lines (what a curator post is, where it came from, that no neighbor wrote it, that it does not count as neighborhood activity) plus the mute toggle writing to the feed preferences that already exist.
- **Visualization:** The curator row does not present an avatar-plus-name shape at all — the chip replaces the identity block, so it cannot be misread as a person. The explainer expands inline under the chip rather than opening a sheet, because four lines do not deserve a modal.
- **States:** origin curator, origin system, origin user (unchanged), origin missing on cached rows → NO chip, and never a human-looking byline, muted (feed re-filters behind the confirmation), mute write failure, reported, media loading / failed
- **UX note:** 'Curator' is internal vocabulary, so the doc's own requirement ('keep report/mute available') assumes a reader who knows what they are muting. Decode safety matters more than the chip: adding origin to three client types means cached posts arrive without it, so the default must be no chip.

## [f9-earn-removal] Earn entries removed + a calm landing for old links
- **EXTEND_EXISTING** · F9 · platforms: web/ios/android · origin: merged · effort/platform: 0.5d
- **Host:** Hub status strip inbox_offers item; mailbox nav Earn section; the native onOpenEarn routes and the /earn wallet route.
- **Entry:** Mailbox drawer; Hub status strip; Old bookmarks and old pushes
- **Job:** Take the cash-Earn promise off every surface for users who never earned, without hiding money from users who have.
- **Contents:** Nav and status-strip entries gated on 'has an EarnTransaction', defaulting hidden while eligibility is unknown. Old links redirect silently to the mailbox root with one neutral line; the wallet stays reachable for anyone with a balance.
- **Visualization:** The drawer simply has one fewer row — no gap, no stale badge, no orphaned section header. Draw both variants side by side; the eligible variant is now the exception.
- **States:** no EarnTransaction → hidden, has one → shown, eligibility loading → hidden (never flash then remove), ineligible arrival → redirect + one line, eligible with history → wallet read-only, offline with a cached payload still carrying inbox_offers (gate on the flag, not the cache)
- **UX note:** The doc specifies 404s. A 404 on a route the app itself linked last week reads as a broken product, not a policy — and locking someone out of their own pending payout to tidy the IA would be the worst outcome in F9. Gate client and server both, or native flashes the row before the payload arrives.

## [f9-verification-promise-copy] Verification promise lists (one name, no withdrawn fee promise)
- **COPY_ONLY** · F9 · platforms: web/ios/android · origin: from-doc · effort/platform: 0.25d
- **Host:** VerifyPromptSheet, VerifiedSuccess, the mover rows' payoff line on web; PlaceVerifyFlow and JustMovedCard on iOS; JustMovedCard on Android.
- **Entry:** Verify sheet; Post-verify success; Place file Proof row
- **Job:** Every surface that sells verification uses one name and none carries the withdrawn 'permanent 0% marketplace fee' promise.
- **Contents:** Unlock-list rows and the post-verify success list, re-labelled: 'Block Founder' is the permanent rank, 'Founding Neighbor' is the scarce first-5 tier, and the two are never used as synonyms.
- **Visualization:** No new layout, but labels shorten — re-check the unlock list's row rhythm at two lines per row rather than three.
- **States:** default
- **UX note:** The doc's only test is a copy grep in publicPlace.test.js, which covers none of the six client files — the native mirrors will silently keep the old names. Run the grep over frontend/apps/{web,ios,android} or the platforms diverge on day one.

## [f9-founding-meter-preview] Founding slots — honest meter, fails closed
- **EXTEND_EXISTING** · F9 / F8 · platforms: web/ios/android · origin: merged · effort/platform: 0.75d
- **Host:** The block_density card in the T0 preview (web DensityCard, iOS/Android PreviewSections) and the sticky WallBar's same-block line.
- **Entry:** T0 preview density section; Sticky wall on a compare arrival
- **Job:** Never promise a Founding Neighbor slot the system cannot honour — including when the founding-window lookup fails, which today defaults to 'open'.
- **Contents:** Three label states instead of two: open, no slots, unknown. The web CTA 'Claim this address and be one of the first here' is hard-coded client-side and must follow founding_open or the button re-promises what the label just withdrew. When a compare sender and viewer share a geohash-6 and slots remain, the wall line replaces (not stacks on) 'Keep this address handy.'
- **Visualization:** A 5-SEGMENT slot meter — filled = taken, hollow = open, always exactly five segments so the denominator is visible — plus a thin bar for days remaining out of the 21-day window. Deliberately a different shape from DensityCard's four qualitative dots for 'verified homes nearby', or users will read density dots as slots. An empty meter would read as 'five open', which is the exact false promise the fails-open fix exists to kill — so a failed lookup renders nothing.
- **States:** founding open (meter + date), zero slots or window ended (no meter, no line, silently), lookup failed → render NO density card at all, preview loading, legacy free-tiles fallback
- **UX note:** Keep the same-block sentence about the BLOCK's remaining slots, never about the sender: the compare card's whole promise is 'readings and a city, never your address', and 'you two are on the same block' tells the recipient something the sender never explicitly agreed to share.


---

# PHASE: pilot

## [f9-nearby-cells-map] Cells map detail (3-referral unlock, de-curated counts)
- **EXTEND_EXISTING** · F9 · platforms: web/ios/android · origin: from-doc · effort/platform: 1d
- **Host:** Nearby: web NearbyCellsMap; iOS NearbyCellsMapCard; Android NearbyScreen.
- **Entry:** Nearby tab; Invite rewards card tier 2 ('Unlocked — see the map'); Block Founders panel
- **Job:** Make the 3-referral tier a real destination with an honest locked state, and stop curator rows counting as organic activity.
- **Contents:** Cell grid with a per-cell detail panel. Locked: the map stays visible, per-cell detail carries 'Unlock with 3 neighbors who join' plus a 1/3 progress row and a share control. Unlocked: verified-home count, founding slots open, activity — with origin='curator' excluded from organic counts.
- **Visualization:** The free layer legitimately shows the grid and the shape of activity; only the per-cell NUMBERS gate. Count 'verified homes' (real, small) and 'posts' separately rather than one blended figure that silently shrinks the day curator rows stop counting.
- **States:** locked (0-2), progress 1/3, 2/3, unlocked, cell has no data, loading, error, offline
- **UX note:** Gating content in a product with almost no users makes an empty map feel withheld rather than sparse — so never blur-paywall the map itself. This is also where the 3-referral tier finally has a destination; today every unlocked tier is a dead promise on all three platforms.

## [f9-block-founders-panel] Block Founders (rank vs tier, slot meter, postcard allowance)
- **EXTEND_EXISTING** · F9 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Moved to the Nearby tab alongside the cells map; today it lives in Place > Your block (BlockDetail / PlaceBlockFoundersSection / PlaceBlockFoundersContent) with Place > Your block reduced to a pointer row.
- **Entry:** Nearby tab; Place > Your block pointer row; Invite rewards card tier 3; Verified success
- **Job:** One name per thing, and make the earned weekly postcard allowance visible before it is spent.
- **Contents:** Rank badge ('Block Founder #3 · permanent'), a visually distinct tier line ('Founding Neighbor · slot 2 of 5 · closes in 6 days'), the founder roster, and the invite composer with an allowance line ABOVE the field ('4 of 6 invites left this week · +1 earned from a referral') plus the reset-day note. Cap is 3 + min(converted referrals, 3).
- **Visualization:** Two visibly different chip shapes: rank is a numeral in a permanent-feeling badge; tier is a countdown pill paired with the 5-segment slot meter. Sharing one shape would make the rename change nothing a reader perceives — which is the doc's actual failure, since both names currently sit in the same paragraph. The allowance is a counter at the top of the form, not a subtitle under the button.
- **States:** T4 verified (rank + tier), T3 unverified (teaser), founding window closed, no founders yet, allowance remaining, allowance exhausted (reset day named), send error, rate-limited, loading, error
- **UX note:** Moving block and founding content to Nearby gives the fourth tab a job (today the loop touches it once) and puts the two unlocked referral tiers next to their rewards. Today the earned invite count exists only inside the post-send toast, so a user earns an extra invite and learns of it only after spending one.

## [f9-invite-rewards-card] Invite rewards (what a referral actually pays)
- **NEW_CARD_IN_EXISTING** · F9 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** Nearby, above the cells map. Net-new on web (the getInviteProgress client has zero callers and web renders no referral UI at all); an extend of ProfileInsightCards on iOS and Android, moved off the profile.
- **Entry:** Nearby tab; Post-share confirmation; Block Founders allowance line ('where did this come from?')
- **Job:** State honestly what a referral pays — 1 → an extra postcard invite this week, 3 → cells-map detail, 10 → Founding Neighbor badge — and put it where the link is actually shared.
- **Contents:** Converted vs invited counts; the copyable referral link at the top; the live reward the user can feel today ('4 postcard invites this week — 3 base + 1 earned'); tier rows with real payouts, each tappable to its destination; priority_matching dropped (gig matching does not exist); tier 4 renamed Block Builder. The tier table is served in the payload, not mirrored a fourth time in client code.
- **Visualization:** Link and payoff in one frame: link row on top, the live earned reward as the hero line, locked tiers demoted to a quiet secondary list with real tap targets. Locked vs unlocked differs by more than opacity — a locked row shows its requirement, not a dimmed promise.
- **States:** zero referrals (the realistic pilot state — link still copyable), partial progress, all unlocked, loading, error, 5-minute cache serving stale counts right after a conversion
- **UX note:** With near-zero other users, a 0/1/0/0 list is demoralising, so lead with the one thing the user can feel today. Four tier tables already disagree (types package, iOS, Android, backend) — serve it, do not mirror it.


---

# PHASE: phase2

## [f10-mail-day-triage] Mail Day triage (snap-aware)
- **NEW_SCREEN** · F10 · platforms: web/ios/android · origin: from-doc · effort/platform: 2d
- **Host:** Web: NEW route /app/mailbox/mail-day (today the nav entry points at the SETTINGS page, so web has no triage surface at all). iOS MailDayView and Android MailDayScreen: extend.
- **Entry:** Mailbox nav (must be repointed off the settings page or the feature is invisible on web); Mail Day banner in the mailbox layout; Mail Day push; Place file Money section
- **Job:** The one place a stack of paper mail becomes a list of decisions.
- **Contents:** Day header, streak and last-scan chips, a PERSISTENT capture affordance (not only the empty-state CTA), 'Needs a call' rows where a snapped piece shows a thumbnail + classification + one extracted line + an 'Unconfirmed' state, 'Reviewed today' with per-item and bulk undo, the sticky Finish-day footer, the yesterday recap and setup nudges.
- **Visualization:** One row archetype with an optional leading thumbnail rail and an optional amber unconfirmed state, so a digital routing decision and a photographed bill awaiting confirmation share a rhythm. Densest frame to draw: 9 unreviewed (3 photographed, one uploading, one failed) above 6 reviewed with a live undo countdown and the Finish footer overlapping.
- **States:** loading, empty (hero + Scan today's stack), populated, mid-upload rows, failed upload with inline retry, error, offline (queued snaps as pending rows), no claimed home → 'Mail snap needs a claimed address' routing to the Date sheet instead of a dead camera button, permission-denied (member without finance.view sees the piece, not payee or amount), AI unavailable notice, undo window
- **UX note:** Both natives put the scan CTA only in the EMPTY hero, so a user with one digital item already queued has no way to snap. Make the capture affordance persistent on all three platforms.

## [f10-snap-capture-tray] Snap capture tray (batch session)
- **NEW_SHEET_OR_MODAL** · F10 · platforms: web/ios/android · origin: from-doc · effort/platform: 1.5d
- **Host:** Over Mail Day triage. iOS reuses SystemCameraPicker; Android reuses CameraX; web is a modal with file input + capture=environment + drag-drop, mirroring the shipped SnapSellListingModal pattern.
- **Entry:** Mail Day capture affordance; Mail Day empty hero CTA; Hub 'Scan mail' action chip (currently inactive and routing to the mailbox root)
- **Job:** Turn a physical stack into a batch of uploads in one session without leaving the screen between pieces.
- **Contents:** Viewfinder or file target, a thumbnail strip of this session's shots with per-shot delete and retake, a live counter, 'Add another' as the default and 'Done (3)' as the commit, per-file progress, and one privacy line ('Photos are stored privately to your home and never shown to neighbors').
- **Visualization:** Batch-first: the thumbnail strip is the persistent element and 'Add another' is the default action, so 'shoot the whole stack now, confirm later' is the path of least resistance. One-handed reach for the counter and Done.
- **States:** camera permission denied → explain + Open Settings + photo-library fallback, no camera (web desktop) → file picker only, capturing, uploading, upload failed (per-item retry, batch preserved), rejected file with a specific reason, offline (held locally, 'Will upload when you're back online'), no claimed home (checked BEFORE the viewfinder opens)
- **UX note:** The doc says only 'wire the existing CTAs to the camera', which invites a one-shot picker — shoot, sheet, back to an empty screen, shoot again. Wrong shape for a stack of mail on a Tuesday evening. Run the tier and finance-permission checks before the viewfinder, or a user photographs a bill and is then told they cannot save it.

## [f10-extraction-confirm] Confirm what we read (extraction review)
- **NEW_SCREEN** · F10 · platforms: web/ios/android · origin: from-doc · effort/platform: 2d
- **Host:** A full-screen step in a capture → confirm → next loop over Mail Day, and re-openable from any Unconfirmed row.
- **Entry:** Upload completion in the capture tray; Any Unconfirmed row on Mail Day
- **Job:** Make the machine's guess into the user's confirmed fact before anything reaches bills, the calendar or a reminder.
- **Contents:** The photo pinned; the classification; editable payee, amount, due date, account ending, kind — each showing what was read and each independently correctable; per-field confidence; the same 'Remind me' control the Date sheet uses; two explicit commits, 'Add to bills' and 'Just file it'; and the confirmation 'Added to your calendar. We'll remind you {lead} before.' — never the word 'Paid'.
- **Visualization:** Photo BESIDE fields, not photo-then-fields — the user is proofreading, so source and extracted value must be visible together; highlight the region a tapped field came from where OCR gives boxes. Confidence is expressed per FIELD (a hollow mark on the uncertain one), never as a single percentage score.
- **States:** extracting, extracted, high confidence, extracted, low confidence (uncertain fields flagged; commit still available), AI unavailable → same screen, blank fields, 'We couldn't read this one automatically', unreadable photo → retake or manual, duplicate suspected (same payee + amount + due date already on the list), permission-denied (member can 'Just file it'; 'Add to bills' disabled with the reason), no claimed home → routed to the Date sheet, saving, error (typed values preserved), offline
- **UX note:** The doc's 'editable chips (Due Oct 12 · $142 · Clark PUD · Confirm)' is F10's clumsiest choice: a currency, a date and a payee each want a different keyboard and a different control, and a chip row hides which value the model was unsure about. Chips stay only as the collapsed Mail Day row summary. Done N times per stack, this is a screen, not a sheet.

## [f10-mail-piece-photo] Photographed mail piece (the record, and the photo viewer)
- **EXTEND_EXISTING** · F10 · platforms: web/ios/android · origin: merged · effort/platform: 1.25d
- **Host:** The existing mailbox drawer list and mail piece detail on all three platforms, driven by the new Mail row (cover_image_url = the private key, key_facts, due-date urgency).
- **Entry:** Mail Day row → 'See the piece'; Mailbox drawer; Bill provenance block 'View the photo'; Mail snap privacy card's listing
- **Job:** Answer 'where did the thing I photographed go?' after triage ends — and be the one place the image can be looked at and permanently deleted.
- **Contents:** Rows with a thumbnail and extracted key facts, plus a photographed filter with payee/amount search. On the piece: the full-bleed zoomable image on a dark scrim, who can see it, when it was taken, an authenticated download on web, an 'Added to bills' cross-link, and a single destructive 'Delete this photo' whose confirm states what survives ('The bill and its amount stay; only the photo is removed').
- **Visualization:** A document viewer, not a photo gallery: pinch-zoom and small-print legibility beat swipe-between-items, and the chrome must not obscure the top third of a portrait letter at 2x.
- **States:** photographed with a confirmed bill, photographed, filed without a bill, photo deleted, text record kept, signed URL expired (transparent re-fetch, then an honest error), permission-denied (piece visible, payee and amount hidden), loading, error, offline (no cached original — say so)
- **UX note:** Merging the doc's separate photo viewer into the mail piece keeps one object to two durable surfaces — the record (Mail) and the obligation (bill) — cross-linked both ways. Without any viewer, the privacy promise (private storage, authenticated download, deletable) is unfalsifiable from inside the product: uploaded, read by a model, never seen or removed by the person.

## [f10-bill-provenance] Bill provenance block (from a photo you took)
- **NEW_CARD_IN_EXISTING** · F10 · platforms: web/ios/android · origin: from-doc · effort/platform: 0.75d
- **Host:** The bill detail route on web and BillDetailView / BillDetailScreen on the natives.
- **Entry:** Bill detail (any arrival: list, notification, calendar row, mail piece link)
- **Job:** Show a bill's origin honestly — a machine read a photograph and a human confirmed it — and give one place to correct, view or delete both together.
- **Contents:** 'From a photo you took · Oct 3' with a thumbnail, the confirmation provenance line ('We read this from your photo. You confirmed the amount on Oct 3.'), 'View the photo', 'Fix what we read', and a delete that removes the bill and its photo together.
- **Visualization:** A subordinate evidence block beneath the amount and due date — never a banner above them — with the confirmation stated as a state ('You confirmed this'), not a confidence percentage, which would invite distrust of a value the user already checked.
- **States:** created by snap (block present), created manually (block absent — no empty provenance slot), low-confidence extraction, photo deleted, bill kept, paid, overdue, permission-denied, error, offline
- **UX note:** The 'cancelled' vs 'canceled' filter bug lives directly under this work; deleting a snapped bill would reproduce that lie on the most visible new path.

## [f10-mail-snap-privacy] Mail snaps: privacy and storage
- **NEW_CARD_IN_EXISTING** · F10 · platforms: web/ios/android · origin: merged · effort/platform: 1d
- **Host:** The Mail Day settings column on web; the Mail Day setup/settings stack on the natives (NOT settings/notifications, which is briefing-only).
- **Entry:** Mail Day settings; Photo viewer 'Manage mail snaps'; Privacy mirror 'What we store'
- **Job:** One place to understand where photographs of your mail live, and to delete all of them.
- **Contents:** A plain-language explainer ('We read the photo to suggest a payee, amount and due date. You confirm before anything is saved. Photos stay private to this home.'); a 'Keep the photo after we read it' toggle (off = extract then discard); a count and size line that LISTS the snaps with payee and date; a destructive 'Delete all mail snaps' whose confirm states that bills and amounts survive; and an honest notice when extraction is unavailable on this deployment.
- **Visualization:** A trust surface, not a preferences grid: one paragraph of plain language, one toggle with its consequence line, then the list of what exists, then the destructive action. Listing what will be deleted is both the finder and the honest precondition for deleting it.
- **States:** photos kept (default), photos off, deleting (progress, then confirmation), zero snaps (no scary destructive button), AI unavailable, error
- **UX note:** Without this, removing a photograph of an account number means finding each bill and deleting it one at a time — a poor answer to 'I photographed my bank statement by mistake.' Do not bolt reminder preferences onto this card while the per-home toggles still persist nothing.

## [f10-bill-trend] Bill trend vs the going rate
- **NEW_CARD_IN_EXISTING** · F10 / F3 · platforms: web/ios/android · origin: added-by-critique · effort/platform: 1d
- **Host:** Bill detail, per bill_type. Data already exists: homeBillComparisonService returns own_months/amounts plus k-anonymous peer averages and an insufficientData flag — rendered as sentences on Android only, and nothing at all on web and iOS.
- **Entry:** Bill detail; Place file Money section
- **Job:** Give the monthly-return step of the loop an actual payoff: is this bill normal for around here?
- **Contents:** 12 months of your amounts with the peer average as a reference line, the current month highlighted, and the k stated in the caption ('average of 14 homes nearby'). A snapped bill marks its column so the provenance block and the trend agree.
- **Visualization:** A zero-based column chart of your amounts with the peer average as a single horizontal REFERENCE LINE — not a paired second series. Paired bars invite a household-versus-household reading; a baseline reads as 'here is the going rate', which is what a k-anonymous peer average actually is. The line's ABSENCE is the honest signal when k is too small; it must never degrade to a zero baseline.
- **States:** 12 months present, partial history, insufficientData → bars drawn, NO line, caption 'Not enough homes nearby to compare yet', permission-denied, loading, error, offline
- **UX note:** F10 stakes the monthly return on bills and never mentions the one real time series already in the codebase. This is the cheapest genuinely new value in phase 2.

## [f11-keeper-strip] Keeper strip on Today
- **NEW_CARD_IN_EXISTING** · F11 · platforms: web/ios/android · origin: merged · effort/platform: 2.5d
- **Host:** The unified Today tab on each platform — NOT the doc's named targets (HubTodayCard is mounted only at /app/hub, which is not a tab, and the native kicker belongs to the push-only briefing screen).
- **Entry:** Today (always, once named); Naming sheet; Place file fact ring
- **Job:** Give the return surface a face: who is looking after this address, what is due, and how much the place file knows.
- **Contents:** Species avatar (6 species x 4 moods), name, mood word, the mood line verbatim ('Nothing due this week.' / 'Recycling tomorrow.' / 'A bill is overdue.'), and the fact count as a tap target into the place file. Requires a nullable keeper block on the Today payload, since mood is computed in GET /api/hub — a third payload neither Today fetches.
- **Visualization:** Avatar + name + mood line as one strip above the weather. The fact count renders as a five-segment ring of CATEGORIES (place, dates, money, people, proof) filled where anything is known, integer inside — deliberately not a progress bar or percentage, so nothing reads as '60% complete' and a saved place reads as a smaller instrument rather than a failing one.
- **States:** loading (reserved space, no pop-in after the weather renders), unnamed (generic silhouette + 'Give your place a keeper'), relaxed / quiet day, attentive / fidgeting / worried, MOOD UNAVAILABLE — 'Couldn't check what's due', visually distinct from relaxed, offline (last-known mood, greyed, 'as of'), T1 saved place (calendar-only mood; copy says 'this place', never 'household'), no place (keeper absent), alert on screen (avatar and mood suppressed; the alert owns the screen), permission-denied (member can see, cannot rename)
- **UX note:** Two changes to the doc. (1) Ship it on the Today each platform actually shows, or almost nobody sees it. (2) Mood must be nullable end to end: the inputs come from hub.js:221-260, whose Mail and bill counts are wrapped in .catch(() => 0) over column names that can fail, so a broken query renders as a cheerful 'relaxed' on the day a bill is overdue — a lie on the one metric the pilot scores at zero. Drop the 'knows N things' mechanic as a growth game; the place file already shows the facts.

## [f11-keeper-naming] Give your place a keeper (naming)
- **NEW_SHEET_OR_MODAL** · F11 · platforms: web/ios/android · origin: from-doc · effort/platform: 1d
- **Host:** Expands from an inline invitation on the keeper strip. Writes one place-scoped preference slot keyed by (scope_type, scope_key), not two.
- **Entry:** Keeper strip inline invitation; Keeper strip overflow (rename / change species); Place file 'Proof'/'Place' section row
- **Job:** A one-time, low-stakes act of naming that converts a data screen into something the person owns — and that is genuinely skippable and reversible.
- **Contents:** Six species tiles, a 24-character name field with a live counter and a suggested default, primary 'Name the keeper' and an equal-weight 'Skip'. One scope line: 'Only you see this.' (T1) vs 'Everyone in this household sees this.' (T3). Overflow on the strip afterwards: Rename, Change species, Remove.
- **Visualization:** Six species tiles in a two-row grid with the name field beneath — one screen, no wizard step. Skip is a real button of equal weight, not a grey afterthought.
- **States:** default (primary disabled until a species is picked), name validation error, saving, save error, skipped (persisted; never auto-presents again, still reachable), permission-denied (member sees 'Sam named this place's keeper Ollie', read-only), T1 vs T3 copy, offline (save disabled)
- **UX note:** An auto-presented modal on the second open interrupts someone who opened the app to learn whether recycling is tomorrow — the worst possible moment to ask for a pet name. Make the auto-present an inline invitation that expands on tap, fire the sheet at most once ever, and make rename/remove exist: the doc gives naming exactly once with no rename path, so a typo or a kid's joke name is permanent.


---

# MERGES (doc proposed more; we fold together)

- Four half-lists of the same facts → ONE place file. F2's first-week checklist, F6's Just Moved card, F5's 'Your dates' card and F11's keeper ledger are the same list with four storage models (hub.js step keys, HomeOccupancy ticks, the calendar API, a count computed in GET /api/hub) and four dismissals. They would drift within one release. The checklist becomes a single progress row on Today for 14 days; the mover rows become the same file's rows while move_in_date is recent; the keeper's count becomes the file's category ring.
- Seven date sheets → ONE Date sheet with three modes and ten kinds. f5-add-date-sheet, f2-pickup-day-quick-set, f4-6-pickup-editor-entry, f6-voter-step-sheet, f12-calendar-event-detail-sheet, f5-remove-date-confirm and F5's lead picker inside f10-3 are one job. Pickup day becomes a kind with a recurrence branch, which is also what unblocks F2's checklist row at T1. Scope (home | saved_place) is a prop, not a second component.
- Three Todays → ONE Today per platform. The Today tab (hub payload), Place > Today (intelligence payload) and the push-only briefing screen become one composition whose sections appear based on data. This deletes f5-t1-calendar-host, f4-7-tonight-row-address-calendar, f4-3-quiet-day-state as a separate entry and f11-keeper-briefing-kicker outright, and fixes design rule 4 on both natives, where the pickup card is currently unreachable with notifications off.
- Saved-places list + 'Where Today gets this' sheet → ONE 'Your places' surface, which is also the Place tab's index for a user with no claimed home. Both listed the same rows, both marked which one Today uses, both offered use/claim/remove.
- Received-invitations section (My Homes) + pending-invite banner (landing) + sender reissue row → ONE single-slot landing banner with a stated precedence (invite > reissue > setup > verify). The My Homes section's audience — a brand-new invitee with no home — never opens My Homes.
- Morning opt-in card + evening opt-in card → ONE briefing card with two switches, on the screen each platform actually lands on; and four separate settings entries → ONE notifications page with four groups.
- F3b's 'verify after you accept' sheet + 'you need verification to do this' sheet → ONE verify sheet parameterised by a reason string.
- Members page + dashboard Members tab (and settings route + settings tab, and HomeAgenda + the dashboard's HouseholdCalendar) → one of each pair. Web currently carries four unlinked duplicates; extending one half of each guarantees divergence. /members/add-guest is deleted outright rather than demoted — it toasts success without making any API call.
- F8's four letter-grade chips + per-chip 'how we know' captions + the compare reveal's two cards → ONE scale-strip instrument reused at three sizes (OG card, compare row, risk detail), with the comparison rendered as one shared track per layer carrying both marks.
- F12's calendar-row provenance + F8's source captions + F10's 'we read this from a photo' explanation + the two different 'this isn't right' affordances → ONE provenance sheet that also hosts the honesty report §5 depends on and currently has no front door or back end.
- F10's photo viewer + photographed mail piece → one surface: the mail piece detail IS the photo viewer. Two durable homes for one object (the record in Mail, the obligation in the bill), cross-linked, plus the transient triage row.
- Three destructive confirmation dialogs (remove saved place, remove date, remove keeper) → optimistic delete + Undo everywhere, with a one-line consequence prefix only where someone beyond the actor is affected. The pattern already ships at Android SavedPlacesScreen.kt:85-90.
- f1-post-save-arrival and the preview-lost recovery → one surface: the save's success state, with recovery as a state of it rather than a separate screen.
- f9-curator-explainer-sheet → an overflow item that expands in place ('Why am I seeing this?'); f9-earn-unavailable-landing → a silent redirect, not a route. Four lines and a toggle do not deserve a sheet; a route whose only job is to say the feature is gone reads as a broken product.
- Block and founding content consolidated onto Nearby: the cells map, Block Founders rank/roster, the postcard allowance and the invite rewards card (which had no home in the four-tab nav at all) now sit together, giving the fourth tab a job and the two unlocked referral tiers real destinations.

# ADDITIONS (doc missed these; required)

- Your place file (NEW route, Place tab index) — the missing hub the four duplicated checklists collapse into, and the answer to 'what is the Place tab for before you claim an address'. Carries the 12-month year band, which is the only surface where the loop's annual-return step is visible at all: composeForHome expands 14 days, so today a lease end eight months out is saved, toasted, then invisible and undeletable until two weeks before it fires.
- Claim-success receipt ('what came with you') — nothing in the design acknowledges the T1→T3 promotion, and §6's five migrations contain no promotion step. F5 keys rules to SavedPlace.id, F11 stores the keeper in two different preference slots, F2/F6 ticks live on HomeOccupancy which does not exist at T1 — so the user loses everything they typed at the moment of maximum investment. Also the moment to get consent for the real privacy delta: T1 dates are 'Only you', T3 dates are household-visible.
- Email-verification handoff carrying the held address — the previewed address lives in a device-local localStorage draft with a 24h TTL, so anyone who registers on a laptop and verifies on a phone loses it and the bridge silently fails for the most common signup path.
- Signed-in add-a-place sheet — 'Preview an address' and the widget's 'Save an address to see today here' have no destination at all for a signed-in Android user (the Place launch funnel is the signed-out root; the only save path reads a pending draft from signup). iOS has SavePlaceSheet but no entry point from these surfaces.
- Notification permission primer — iOS fires the system prompt from didFinishLaunchingWithOptions, spending the one-shot grant at cold launch before the user has a place or a reason, and never re-asks. Every push in F3/F4/F5 depends on it.
- Provenance sheet + the single 'this isn't right' report — §5's honesty counter is defined as 'any user report tagged not my schedule', and three surfaces assume the report exists. There is no endpoint, no component and no confirmation anywhere in the product, so the pilot's one zero-target metric currently cannot be measured.
- Owner attestation ('Confirm this person lives here') — F3b flips isVerifiedResident to false for household members and promises 'always offer the path', but postcard, document and landlord verification may all be uncompletable for a non-owner occupant on an already-claimed home. Without this, every locked control leads to a sheet nobody can finish.
- Web bill detail route — web has no bill-shaped destination, so F3's bill_paid notification, F5's date reminders, F10's bill reminder and the calendar money row all land on a list. Design rule 4 requires the exact surface.
- Air and weather alert preference — F4 widens AQI ≥ 101 and NOAA alert pushes to saved-place users, and there is no off switch for them anywhere; a user asking for 'fewer pushes' can silence everything else and still get unmutable alerts about an address they only bookmarked.
- Locked-action treatment across the eight attested surfaces — F3b's migration makes controls vanish or 403 with no explanation, which an invited co-resident reads as the app being broken or the owner blocking them.
- Entry point for the fully built, zero-linked web household calendar — F3's calendar acceptance criterion cannot pass on web today for a reason that costs one day.
- Widget large size and the widget's in-app discovery row — §5 counts a written widget snapshot as an activation signal equal to the briefing, yet nothing in either app mentions the widget exists; and no size earns more than 'more text' without the 14-day and 12-month strips.
- Bill trend against the k-anonymous peer average — a real 12-month own-vs-peer series already exists in the codebase, rendered as sentences on Android only and nowhere on web or iOS, while F10 stakes the monthly return on bills without mentioning it.
- Privacy mirror re-scoped from home-gated to user-scoped — otherwise the coordinate-leak fix is invisible to exactly the T1 cohort F1 creates and the pilot recruits, and the promise is unfalsifiable from inside the product.
- A warming state for the first Today a new user ever sees — a brand-new saved place is a cold geohash, and F4's all-clear copy ('Nothing needs your attention today', with a receipt claiming the checks succeeded) would be a lie in that window.

# OPEN QUESTIONS for the founder

- Does ANY verification method accept a non-owner occupant on a home someone else has already claimed? If not, the owner-attestation sheet is a hard prerequisite for F3b, and F3b must not ship until it exists — otherwise every locked control an invited co-resident taps leads to a sheet they cannot complete.
- Does per-home notification granularity exist, or not? The toggles at /app/homes/[id]/settings look real and persist nothing. Decide now: wire them to HomePreference.settings, or delete them. A user who turns off 'bill reminders' on one home and keeps getting them will not try the switch twice.
- Which Today do the natives ship first? Collapsing to one composition is the right answer and the cheaper one long-term, but it is a bigger single PR than F1 assumes. If you split it, ship the payload merge (address_calendar into the hub payload) before any F4/F5 client work, or you will build the pickup card twice.
- On claim, do the saved-place dates become household-visible automatically, or does the user consent? Recommendation: consent on the claim receipt, defaulting to carry-and-share, with a 'keep these private to me' option — silently changing an 'Only you' promise is the kind of thing a pilot user will name in an interview.
- Species and mood art for F11 is 24 renderings (6 x 4) plus tinted/monochrome widget variants. Commission it, cut to three species, or cut the creature and ship only the fact ring? The ring is the retention half; the creature is the decoration.
- Sparkline (frontend/apps/web/.../primitives.tsx:91-113) is a decorative polyline with hard-coded points, no data prop, aria-hidden — a chart-shaped component that always rises. The moment anyone implements the bill trend or the keeper's growth they will import it and ship an invented trend line with no test that fails. Either give it a required points prop or rename it DecorativeSparkline and lint it out of place/, home/ and hub/ surfaces. One line, cheapest honesty guarantee in the pack.
- Backend line items the doc does not list and that three surfaces silently depend on: SCOPE_RANK needs 'saved_place' (or a T1 user's confirmed pickup day is dropped whenever a city rule exists); hasHouseholdPickup must match saved_place scope; the lead_days CHECK must widen 0→60 (the only value anyone picks for a lease notice); the compare token needs a confidence field; the honesty-report endpoint does not exist; the pending place must persist server-side at register time.
- Android's DeepLinkRouter enumerates eight /homes/:id children and sends everything else to the dashboard. Four new links (bills, calendar, place/today?rule=, homes/:id/privacy) need branches. Ship them with the features or accept that four pushes mis-land on day one.
- Effort reality check: these entries sum to roughly 7 weeks per platform against the doc's per-feature estimates, and the gap is almost entirely the surfaces the doc assumed were free — the management list, the T1 hosts, the deep-link landings, the permission states and the discovery surfaces. Decide whether the pilot ships with F7 and F8 or whether those slip, before the build order does it for you.

# BUILD ORDER

1. f9-privacy-mirror
2. f9-curator-chip
3. f9-earn-removal
4. f9-verification-promise-copy
5. f9-founding-meter-preview
6. x-provenance-sheet
7. x-date-sheet
8. x-place-file
9. f1-your-places
10. f1-add-place-sheet
11. f1-save-confirmation
12. f1-email-verify-handoff
13. f1-today-tab
14. f5-today-calendar-strip
15. f4-today-pickup-card
16. f1-today-air-band
17. f4-notification-primer
18. f4-briefing-optin-card
19. f4-notification-settings
20. f1-claim-receipt
21. f6-home-basics-rows
22. f6-place-section-details
23. f3-members-roster
24. f3-invite-composer
25. f3-invite-banner
26. f3b-invitation-decision
27. f3b-verify-address-sheet
28. f3b-owner-attestation
29. f3b-locked-action-row
30. f3-household-block
31. f3-member-home-dashboard
32. f3-household-calendar
33. f3-bill-detail-web
34. f3-bills-list
35. f3-household-notifications
36. f8-scale-strips
37. f8-compare-sheet
38. f8-compare-arrival-header
39. f8-compare-reveal
40. f8-og-compare-card
41. f8-native-share-compare
42. f8-seasonal-aha
43. f8-positioning-copy
44. f7-today-widget
45. f7-widget-tap-landing
46. f7-widget-gallery
47. f7-widget-howto-sheet
48. f9-nearby-cells-map
49. f9-block-founders-panel
50. f9-invite-rewards-card
51. f10-mail-day-triage
52. f10-snap-capture-tray
53. f10-extraction-confirm
54. f10-mail-piece-photo
55. f10-bill-provenance
56. f10-bill-trend
57. f10-mail-snap-privacy
58. f11-keeper-strip
59. f11-keeper-naming
