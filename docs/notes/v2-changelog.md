
## f9-privacy-mirror
- Collapsed header now shows only the place's own label or city plus ScopeChip; street labels moved into the open 'Show for' menu; INSTEAD OF line rewritten; frames 1, 2, 3, 14, 15, 16 updated; Notes line added (review major: header narrows the home in screenshots)
- Composer one-liner rewritten to 'Neighbors see this post at one spot about 0.3 mi from your address, never the address itself.' with link 'See the spot'; picker row uses 'Nearby · Camas, WA' per research; TYPE no longer claims the 'same' promise verbatim (review major + minor)
- Defined the destination of 'Manage where your posts appear': Nearby composer with empty draft and picker open, per-platform container, Close returns; added frame 07 web-1440 composer panel; Notes open question on standing setting vs per-post picker (review major)
- Saved place: dropped 'Change' on the Address row with the reason; open question added; Address value now 'A neighbor sees on your posts' (review minor)
- Saved-place frames use 'This place on the map' and 'This place is not shown'; 'Your home' kept for HOME A; recorded on Notes (review minor, ScopeChip copy rule)
- Maya has two places in all her frames, so frame 2's chevron is consistent (review minor)
- Frame 14 (stale link) now Jordan with an old home id; stale-link line no longer names a street (review minor)
- Scale bar extends to 0.4 mi when the offset exceeds 0.3 mi; whole-screen failure drawn as an inset in frame 11; error strings use the ' · Retry' form (review minor)
- Offline rule names the exact disabled controls and keeps zoom/pan within cached tiles (review minor)
- Post count labelled 'Your public posts (all places)' pending the open question (review minor)
- Notes: confirm iOS routes pantopus://homes/:id/privacy; layered-grid pattern considered and replaced; Phase 2 'What we store' row from f10-mail-snap-privacy (review minors)
- Frame count now 19 plus Notes; batch plan re-split

## f9-curator-chip
- Frame count corrected to 19 plus Notes (review minor)
- Line 4 explicitly gated on the Seeder exclusion being live in code, with the three-line inset as the fallback; stated as planned, not as fact (review minor, per-surface change)
- Reported copy now 'We'll review it within 7 days, by Mon 26 Oct.' with relative count; Notes open questions on the review queue and the 7-day window, with fallback copy (review minors)
- SourceCaption named as the contract's dated static variant with the external-link glyph; scope word 'NE 164th Ave area' replaces 'outage map'; no ProvenanceMark on post captions and the 'Source:' prefix recorded as a documented variant (review minors)
- Dark chip now dark raised fill with a 1px dark text.secondary outline, because dark sunken equals dark base (review minor)
- Mute scope stated: Nearby feed, Nearby map and Pulse card; toggle relabelled 'Show Pantopus posts' with a caption; InlineUndo and already-muted text aligned; muted Pulse inset added to frame 13; Notes open question if the preference doesn't reach Pulse (review minor)
- Placed 'Turn them back on in Feed preferences.' under InlineUndo with a link; defined failure after a feed-card mute; inset added to frame 9 (review minor)
- iOS overflow now a pull-down menu from the ••• button in PLATFORMS and frame 6 (review minor)
- Offline disables the overflow mute item too; the mute INSTEAD OF line now gives its reason (review minor)
- Notes omitted states now lists 'origin system' (review minor)

## f9-earn-removal
- Resolved the offers-chip contradiction: the chip is removed for everyone and eligible people reach their balance through the drawer's Earn Wallet row; added frame 13 (Sam's strip), an INSTEAD OF line, an engineering line, and a Notes deviation from the design doc (review major)
- Notes records the dropped back-to-tab CTA as a deviation from research (review minors, duplicated finding)
- Notes engineering now stores the landing-line dismissal per account; signed-out arrival added to omitted states and to the arrival flow as 'preserving the destination' (review minor)
- InlineErrorRow copy changed to 'We couldn't check your Earn balance · Retry' (review minor)
- Notes open question on pending Earn transactions counting toward eligibility (review minor)
- Frame 6 gains an 'Ask about your balance' inset marked pending decision (review minor)
- History row renamed 'Offer reward', not a referral payout, to match F9's postcard-invite referrals; a11y example and Notes updated (review minor)
- Frame 12 is now a two-up of Android and iOS strips; frame 5 gains Maya's Android drawer inset (review minor)
- Frames renumbered to 18 plus Notes; batch plan re-split into four turns

## f9-verification-promise-copy
- Invite rule now counts only neighbors the verifier invited: 'Plus 1 a week for each neighbor you invite who joins, up to 6.', success sub line and '3 base + 3 from neighbors you invited' (review major, design doc F9 referral tiers).
- Added a web-390 mover-row artboard (12) and Android verify-sheet-list (7) and Android success (8) artboards; replaced the 'no Android sheet' sentence with the verify-sheet-prompt ownership line; frames 18 → 21, batch plan rebalanced to 4 turns (review majors).
- Added the in-sheet order line (header → unlock list → rank caption → Also once you verify → method rows or code field → collapsed 'What verifying doesn't do'), first-viewport rule at 390, no primary button; FIRST FIVE SECONDS now names method rows / code field; frame 1 is Maya's pending state; offline frame says method rows or code entry (review major, f3b sheet spec).
- Founding sub line now 'Goes to homes verified by Sun 25 Oct'; new edge rule hides the Founding row when the method's usual time runs past closing (absent in Sam's picker, present in Maya's pending state) (review major, brief fail-closed rule).
- Renamed 'Also on this block' to 'Also once you verify' everywhere with the same heading style as 'What this unlocks', stated explicitly (review major).
- Pending dates fixed to 'Postcard mailed Thu 15 Oct · expected in 3 days · Thu 22 Oct'; pending example moved to Maya before code entry; Sam has no postcard; sheet pending line drawn with LockedActionRow pending, Proof row with FactRow pending (review minors).
- Added 'Address confirmed by landlord' string; person-name variant restricted to a household member's Proof row and flagged as dependent on owner attestation (review minor).
- Verified Proof row carries the filled ProvenanceMark with 'Official'; pending has none (review minor).
- Added offline strings 'You're offline. What verifying adds stays readable.' and 'Verifying needs a connection.' (review minor).
- Push set to Active interruption level and drawn with PushCopy on Notes only (review minor, brief P8).
- Notes now records the Founding date-rule exception, the cross-platform copy-check founder flag, the Place file 'Meet the block' host flag and the renamed strings (review minors).
- 'What stays the same' renamed to 'What verifying doesn't do' and made a collapsed disclosure on the sheet, per the review's order line; rows unchanged.

## f9-founding-meter-preview
- Web CTA is now 'Claim this address' in every state; the 'be one of the first here' variant moved to Notes as a founder option restricted to 8+ days remaining; frame 10 shows closing day with the plain CTA (review major).
- Wall line is bodySmall 14/20 and may wrap to two lines at 390, bar grows with matching scroll padding, Continue stays 44px on its own row if needed; Notes updated (review major, house no-truncation rule).
- Wall rule changed to 'any wall where the typed address's block has open slots'; frames 6 and 20 drawn that way; frame 7 became the zero-open-slots wall; doc's same-block rule recorded on Notes as a restorable alternative (review minor, uxNote 'never about the sender').
- Persona is now a signed-out visitor typing PLACE B's address, distinct from Jordan who saved it (review minor, house fixtures).
- Caption now says 'You can claim this address either way.'; fee sentence moved into the disclosure and added to founder flags (two review minors, per-surface research change).
- Added native placement: preview sits inside the Place tab launch with the tab bar visible (review minor, f8 prompt).
- Added data-source rule: slot numbers only from slots_open and ends_at, never density or a verified-home count (review minor, doc F8 and derive f8-8).
- Specified the hatch: 45°, 1.5px strokes, 4px pitch, clipped, on surface.base (review minor).
- Worst-case long address changed to '12004 NE Pacific Crest Heights Loop, Unit 1402, Vancouver, WA 98684' and listed on Notes (review minor).
- Added iOS lookup-failed artboard (14) and native fail-closed edge case; frames 20 → 21, batch plan now 4 turns (review minor).

## f8-positioning-copy
- Compare arrival keeps the H1 and lede above Dana's sender strip in layout, reading order, frame 4 and a new DONE WHEN check (review major, f8-compare-arrival-header).
- Both unfurl descriptions now lead with the contrast line; compare adds 'Sources: FEMA, USFS, AirNow, EPA.'; drawn truncated at two lines; image footer kept per doc with the founder decision on Notes (review major, brief §7 and house AVOID).
- Added og:image:alt rule (four readings and city, never an address; owned by the share card prompt) beside the unfurl (review minor, brief §5).
- Persona is now a signed-out stranger about to type PLACE B's address, distinct from Jordan (review minor, house fixtures).
- Native assessed-value handling: static lede can't depend on a reading, so an exact fallback lede is given and used everywhere on native if the value isn't always available; listed as invented and flagged (two review minors).
- DONE WHEN now requires only the H1 and contrast line to be identical across platforms and the share footer (review minor).
- Notes records that the no-name title replaces the flows-spec string, that flow-05 must adopt it, and that the share card prompt owns the unfurl strings (two review minors).
- Notes records the naming exceptions for the 320 frame and the 360 bubble frame (review minor).
- Web autofocus only at 640px and wider; added web offline state with the OfflineNotice form line and a web-390 offline artboard (11); frames 18 → 19, batch plan now 4 turns (review minor).

## x-provenance-sheet
- PB confidence sentence written out in full ("You haven't confirmed it for this address yet."); substitution instruction removed (review: broken copy, ScopeChip rule).
- P1 on-record value is now weekday only ("Garbage · Tuesdays", "Recycling frequency: Not set"), matching P17 and the prefilled Not set frequency; the fixture's full schedule is what Maya confirms (added P1-mine payload and a Notes line). Story rewritten so the host card reads "Garbage tomorrow".
- Added the schedule reason "Wrong recycling week", selected on artboards 2, 27 and 30; all three reasons map to "not my schedule" in Notes; handoff states the Next recycling field starts empty.
- Spelled out the schedule sequence: Send report alone keeps the sheet open on the receipt; ticked box plus reason plus Set my pickup day sends first, then dismisses to the DateSheet; unticked sends nothing. The reopened self-fixed view (artboard 15) shows the tick mark, Source 'You' and a report status block. Artboard 3 is the report-only path with the self-fix still above.
- Added the one-tap confirm pair "Yes, Tuesday is right" / "Set my pickup day" (Thursday for PB) to the schedule default foot, matching PickupCard, with a new artboard 4 for the confirmed-in-place state.
- PB resolved states now state the Wednesday premise and Jordan's report; the Fixed string is rewritten; No change shows Wednesday; Updated set to Thu 15 Oct 2026; premise logged in Notes.
- Layout reordered: Source/Updated/Method come before the confidence sentence; detent rule and reading order updated to match.
- Covers rule replaced with 'Covers states only area or people; confidence states only how sure'. P2 and P3 confidence rewritten; P4 Covers set to 'The nearest AirNow monitors'; P7 Covers names the account, with no ScopeChip; P6 Source no longer repeats the date.
- EPA Unhealthy for Sensitive Groups statement supplied word for word, with a verify line in Notes.
- Added the P8 wildfire payload (filled mark, 270 m model method, Covers, wrong-spot reason) and artboard 10.
- Added the receipt pattern with examples for P6, wrong spot/county and air; DONE WHEN now covers FEMA, USFS and EPA designations.
- Android Back and web Escape now step back from the report view first. The desktop web day cell moves focus to the DateRows and never opens the sheet directly.
- Added the seasonal aha SourceCaption entry point. 'View the photo' dismisses and opens the mail piece photo. ScopeChip 'Your household' added to P2, P4, P4-alert, P5 and P8.
- Uses DateSheet by its contract name throughout and adds it to FOUNDATIONS. 'The only test-kit action in this sheet' is now stated, and the test-kit string difference is logged in Notes.
- Internal-jargon rationale ('section 5 honesty counter', 'Build this sheet first') replaced with the plain receipt/outcome rationale.
- Artboard 7 is renamed 08-air-alert-report and described as a report view; the radon artboard gains a report-view inset. Not on record keeps the legend with no word emphasised.
- Accessibility additions: outbound rows are spoken as leaving the app, the alert AqiBand gets a summary, Retry gets a label and the offline caption is named. The Notes line on the stale mark's contrast is added.
- The disabled Send report state now has the caption 'Pick what's wrong to send this.' The Guest lock covers both schedule buttons.
- The Notes invented-strings list is expanded to name every source, Covers, receipt, outcome, status and link string. Artboards are renumbered to 37, and the batch plan now has 7 turns.

## x-date-sheet
- PREREQUISITE (outside this prompt): amend Foundations 00d-08 so V1 and V3 carry an Off segment and state, and V3 (lease-notice) adds 14 days selected with ticks Mon 15 Feb 2027 · 14 days before / Sun 28 Feb 2027 · Day before / Mon 1 Mar 2027 · Day of; amend the contract PushCopy date-reminder body to 'Tell your landlord by Mon 1 Mar' with tray action Done; update flow-03 steps 4, 8 and 10 to Mon 15 Feb. The prompt now references these as drawn on the board, so the Notes deferral line 'Changes for prompt 00' is removed (review: ReminderLeadControl redefinition).
- ReminderLeadControl now cited as 'date-sheet and lease-notice variants as drawn on the Foundations board, including Off and the lease 14 days'; tick labels switched to Foundations form (date with year, then role; 'Day of' replaces 'On the day').
- Timeline end-cap removed: Foundations event line with KindGlyph and leader line, 'not to scale', lease-end two-line caption, explicit 'no disc or filled shape' (review: filled shape conflicts with provenance).
- Bill-from-snap frame now draws two ticks (Thu 22 Oct 2026 · Day before, Fri 23 Oct 2026 · Day of) with the one-day caption and spoken summary; bill saved message says 'the day before and on the day'.
- Saved-place bill line changed to 'This saves as a date, not to Bills. Claim this address to track bills.' (no 'household'); EDGE CASES names it as the only saved-place claim wording.
- iOS date path cut to three taps (field opens with month/year selector open, set Mar 2027, tap 31; paste accepted); inset labelled 'three taps'; DONE WHEN and INSTEAD OF aligned (three taps or fewer, never month paging).
- Claim carry-over visibility now follows the claim receipt choice (Only you if declined/left, Household if Share tapped).
- Every-other-week pickup moved to HOME A (Vancouver); PLACE B (Camas) is Weekly with caption 'City of Camas · recycling weekly · 2026 collection calendar' and a weekly preview plus a 'Next holiday change' Thanksgiving row; Veterans Day assumption dropped since no affected date remains; new frame 05 keeps the nothing-preselected Next recycling state (frames 38 total, batch plan re-cut).
- Preview drawn as DateRows (pickup variant naming bins; holiday-moved variant with the contract's wording); weekday chips get full spoken names.
- Reminder and shared-add deep links written out (rule=cal_7f3a2, add=date&kind=lease_end, web and native) in WHERE IT LIVES and Notes, with the route-rename note.
- Saving state added as an inset on frame 19.
- Handoffs now include the place-file year band 'You' lane ticks and Today's first-week row advancing.
- Remove cancels pending reminders (Undo restores); household notices for Remove, Mark done and visibility changes wait until Undo is gone; removing Lease ends also removes the linked Notice deadline with an InlineUndo naming both.
- 'Add as a separate calendar event' now replaces the sheet with the household calendar create sheet carrying title and date; Replace it and Cancel behaviours stated.
- Guest line added to Invented strings, noted as replacing the existing permission message.
- VoteWA link opens in-app browser on iOS/Android, new tab on web.
- Tax-appeal calling row named 'Property-tax appeal window closes' with sheet title 'Property-tax appeal'.
- Added notification settings pickup status row entry point.
- Voter 'Not now' removed; 'I did this' is the single primary action and Close is the exit (glossary rule).
- Create-mode tile behaviours defined: seeded tiles switch in place to view-seeded, absent without a seed; Bill tile switches to bill mode; Notice deadline tile collision caption 'Already set for Mon 1 Mar · from your lease'.
- Undefined states filled: 'Other' opens a 'Days of notice' field (1–180); Not sure of the day replaces Remind me with the start-of-month line; pickup at a home is always household with its footer; Mark done shows the done line in-sheet then Close returns to the done row with Undo.
- Passed-lead frames follow the Foundations rule: HOA frame names 30 chosen-then-passed, 60 disabled, passed-lead line, suggestion and Suggested ticks; voter frame names 1 day selected, the '60, 30 and 7 days have passed or fall today.' line and two ticks; warranty and tax-computed frames gain their passed-lead lines and explicit ticks; voter-after-deadline frame gets its In person ticks.
- Notes records the PLACE B override of the HOME A-only note and lists the missing invented strings; greyscale frame adds a hollow-mark inset.

## x-place-file
- Voter mover row line 2 now shows both deadlines plus SourceCaption 'Washington Secretary of State · statewide'; copy change from the doc listed on Notes (F6 acceptance, derive f6-voter-step-sheet).
- Added deleted-date reminder landing ('That date was removed', no sheet, never blank) to EDGE CASES, COPY, DONE WHEN and a margin note on frame 7 (flow-03).
- Per-date visibility is now a tappable ScopeChip compact (44pt/48dp) that opens the DateSheet 'Visible to: Only you · Household' control; added 'Change who can see this' custom action; warranty chip drawn tappable in frame 4. Variant anatomy fully defined (labels 'Only you'/'Household', only on household-entered dates, static on voter self-report) and appended to component-contract.md under Pending additions. The reviewer's 'not a separate target' suggestion conflicted with the visibility-control finding; the control won and Notes records why.
- Renamed 'On record for this address' to 'Public records for this address' everywhere; Risk & readiness row rewritten on two lines with scope word, hazard word, AQI spelled out, observed 7:00 AM, and a 'Sources: FEMA, USFS, AirNow, EPA' caption; Civic row value is now 'Voter registration and elections'.
- Mover rows gain a visible leading 'Mark done' tick control, a body that opens its destination (USPS outbound, three utility outbound rows, Civic registration block) and trailing Hide; drawn in frames 1, 4 and 15.
- Added an explicit iOS above-the-fold height budget with a fallback (Next row under header) and noted the arithmetic on Notes.
- Specified phone year-band cell geometry: 28pt lanes, vertical stacking (max 2), count below its mark, holiday ghost below the moved mark, city rhythm as 2pt tick lines (solid/dashed); Notes gets a zoomed Nov cell inset; reminder on phones is a caption under the Mar cell.
- Removed the T1 pickup row's 'Confirm' action (row opens DateSheet pickup kind); frame 2 updated.
- Stated HOME A's first-week steps are done and what the Next row shows when the widget was promoted in the last 24h.
- Wording: web step 'Turn on a reminder'; ask 'When does your insurance renew?'; Undo "Skipped 'Insurance renews'"; iOS widget button 'See how to add it', Android keeps 'Add the widget'.
- Sam's view: 'You and Maya live here · View'; 'Add one date that matters' ticked with 'Your household already has 3 dates' (3, not the suggested 4, because the warranty is Maya-only; noted on Notes).
- Layout consistency: Hide trailing, wraps at AX5; targets 44pt iOS / 48dp Android / 44px web; DateSheet right SlidePanel on web 1440 and bottom on web 390; ProvenanceSheet centred 560 modal on 1440 and bottom sheet on 390.
- Removed jargon and meta references: 'T1' replaced by 'saved place' (defined in WHO AND WHEN), 'other F6 steps' by 'other moving steps', dropped '(its own prompt)' and '(formerly ...)'; folded WHY ONE LIST into THE ONE JOB; URLs use rule=lease-notice; Notes artboard named 'x-place-file · notes · 22-notes · light'.
- Pending LockedActionRow now has no link and reads 'Postcard requested Sun 18 Oct...'; 'Enter your code' is a separate outlined button; voter DateRow title is 'Register or update your voter registration'; VoteWA is the outbound TextActionRow with 'Remind me' beside it.
- Added late-postcard path after Fri 30 Oct ('Send a new code' enabled, 'Your old code will stop working.'), as a margin note on frame 9 (flow-06).
- Added read-only Dates state for a member without date-edit permission with LockedActionRow 'Maya can add and change dates here.' (F5 acceptance, flow-03).
- Added recurrence captions ('Every year' on HOA dues, both property-tax rows and the appeal; 'One time' on warranty, notice and lease rows) per the DateRow contract.
- Named the saved-place Moved in destination (DateSheet move-in kind at saved-place scope) and stated that mover rows then appear on a saved place (flow-13 step 2).
- Added no-phase-2 strings for the claim row and banner; without phase 2 the money step is covered by the Public records 'Money signals' row.
- Kept a quiet Proof FactRow 'Verify this address · Add' at HOME A (flow-06 step 10); More you can add at HOME A is now (2).
- Notes now records the filled-unverified-seed decision (brief P14; flow-13 and f6 must follow) and that the count rule adds address and move-in to F11's list (keeper strip must match).
- Accessibility: legend added to reading order; web 1440 month columns are focusable labelled buttons with a distinct focus ring; web 390 band hidden from screen readers except its summary; mover tick spoken labels added.
- INSTEAD OF: merged the saved-place and error lines and added a line for the tappable per-date chip, staying at 8 lines.

## f1-your-places
- Home-row caption changed from 'Today always uses your home' to 'Today uses your home'; added rule that a home user whose Today runs on a viewed or pinned location loses the caption and gets the above-list line (review major + minor; doc §3 resolver order).
- Notes open question extended to cover the recently viewed location as well as the pin (review major).
- Removal sentence replaced: a removed address never shows on Today again, even if open, with the privacy reason restored from the inventory uxNote (review minor).
- Stated that the home row carries no StatusChip and its caption is the Today marker; reworded 'no chips' to 'every other saved row ... Only the home row carries a chip' (review minors; contract StatusChip 'No two chips on one row').
- Deep-link arrival from the Today chip now moves accessibility focus to the row; claim-notice arrival moves focus to the arrival line (review minors; brief §5).
- Notes record that the inventory string 'A home you've claimed always wins' is replaced (review minor).
- LandingBannerSlot lines each get a trailing 44pt action: sync uses the board's V6 'Synced 3 items from your other device · Review'; account-switched and claim-notice use Close; new variants and 'Synced' wording recorded on Notes (review minor).
- Added top-bar rule: tab root with no back control for no-home users; pushed screen with back 'Place' / breadcrumb for home users; artboard lines updated (review minor).
- 'Used for Today' StatusChip glyph changed from primary.700 check to a sun-outline in text.strong; recorded on Notes; INSTEAD OF updated (review minor).
- Replaced angle-bracket template strings with concrete strings (Claimed Tue 1 Sep, Joined Tue 1 Sep, Saved Sat 10 Oct, More for 1107 NE Birchfield Ct) (review minor).
- Entry point (4) renamed to 'See your places' to match the save confirmation rename; added entry (8) for the Add a place sheet returning here; frame 10 reference corrected (cross-prompt consistency).
- Fixture reconcile note broadened to cover the add-place, save and email projects.

## f1-add-place-sheet
- Success now returns to the opening screen: onto Today from Today/widget/place file/compare header, onto Your places (new top row plus status line with See Today) from Your places; added artboard 08b; frame 17 (now 18) shows Maya back on Your places (review major).
- Added viewed-location and pinned-location status variants with no switch caption; added to COPY, EDGE CASES and Notes (review major; doc §3 resolver order).
- Duplicate: board's curly quotes used, inline 'Use for Today' action hidden in the duplicate state, dated message recorded on Notes as an extension of the contract variant (review minors).
- Chosen-place artboard now quotes the full 'Saved privately. …' string (review minor).
- Notes record the departure from doc F1 'Preview an address → /start'; added 'Save an address first' widget how-to as an entry point (review minor; flows-spec flow-07).
- Restored v1 rules: sheet keeps its height when a state replaces the list; INSTEAD OF line against a /start link (review minor).
- Added founder-reconcile fixture note; renamed 'anonymous first-place case' to 'unnamed signed-in first-place case' (review minors).
- Fixed dim-host instruction per platform so it no longer conflicts with full-height sheets (review minor).
- ATTACH adds Today warming-state backdrops and Maya's Your places backdrop (review minor).
- '5 addresses found' added to COPY and Notes; post-save status row recorded as a new pattern proposed for Foundations (review minor).
- Added focus-after-save note and ONE JOB wording updated to cover returning to origin.

## f1-save-confirmation
- Aligned 03-saved with the email handoff: no 'Saved … to your account.' line; Notes record that flow-01 step 8's line is folded into the title plus address (review major + minor).
- Stated which arrivals open 04a/04b (lost/expired draft, confirm after hold expired) and that the email page routes here rather than drawing its own recovery (review major; flows-spec failure branch and handoff gap).
- Rewrote entry (1): register lands on 03-saved; sign-in saves on arrival via 02-saving; never a second Save tap; 01-pre-save limited to arrivals that have not asked to keep the address; recorded on Notes; INSTEAD OF added (review major).
- Added viewed-location and pinned body variants (review minor).
- Offline keeps See your places enabled; reason now 'You're offline. Claiming needs a connection.' (review minor; matches f1-your-places offline frame).
- Added 'Saving…' string; held-row target now 44pt / 48dp / 44px (review minor).
- Saved-at-registration 06 gets primary 'Switch account' and no Preview button; it and the outside-Clark-County layer line listed as omitted states on Notes (review minor).
- Duplicate chip shows message only with curly quotes; inline action hidden (review minor).
- Renamed 'View saved places' to 'See your places' throughout, including home variant and Notes (review minor).

## f1-email-verify-handoff
- Confirmed landing is now the save confirmation's 03-saved exactly; removed 'Saved 1107 NE Birchfield Ct to your account.' from CONTENT, COPY and frame 4; Notes record the fold (review majors).
- Added held-mode rule: a confirm after the hold expired opens the save confirmation's 04a/04b; this page draws no recovery row (review majors; flows-spec failure branch).
- Frame 11 redefined as the page reopened after the hold ended, before confirming, with its own sentence and AddressChip expired fill only; override of board caption/action recorded on Notes (review major + minor).
- Saved mode uses the AddressChip default state with no hold message; held variant only in held fallback (review minor).
- Notes add founder item on how long an unconfirmed account and its saved place last (review minor; brief P2).
- Notes list confirming-in-progress as an omitted state (review minor).
- Added entry point (3) reopening Check your email; INSTEAD OF lines added for single recovery destination and exact 03-saved match; DONE WHEN extended.

## f1-today-tab
- Pinned slot rule (b) rewritten: pin only delivered items not in the first viewport under 'From your 6:00 PM briefing · Also:', highlight in-view items in place; removed the duplicate 'Recycling and garbage tomorrow ↓' line (review major).
- Artboard 05 now uses f5's 6-item strip and pins only 'Renters insurance renews tomorrow ↓', which scrolls to that DateRow; CONTENT states artboards 04 and 05 use f5's 6-item strip (review major + minor).
- FirstWeekRow moved from slot 11 to slot 2b and added to FIRST FIVE SECONDS; open question replaced by a decision (review major).
- FirstWeekRow full step order added (Save → Pickup day → Reminder or widget → One date or person) with reminder copy and target (briefing card), person-step target at a claimed home, not counted at a saved place, 7-day window and disappears when done or hidden; pickup target is now f5's 'Set your pickup day' row button (review major).
- Frame-size rule replaced: full-length for 01, 02, 04, 13, 14, 19-22 with fold lines; platform viewports for the rest; web/Android dense frames may be full-length (review major).
- Briefing push entry now kind=morning|evening, with the morning briefing pinning date items the same way (review minor).
- Alert push entry now pantopus://today?section=air&src=alert; alert for a different saved place lands on f1-today-air-band naming the place with its ScopeChip; added to EDGE CASES and as a Notes open question; NOAA pinned-slot strings added (review minors).
- Artboard 02 now states the gutters tile and the property-tax signal show, with the signal below the push threshold so it does not cancel the all-clear (review minor).
- Redirect keeps ?rule= query; Place › Today sun times recorded on Notes as dropped pending founder confirmation (review minors).
- Stale briefing push after place removal lands in no-place state; pinned viewing location recorded as omitted state (review minor).
- One-time notices now use LandingBannerSlot geometry with the two-line join variant; contract clarification added to Notes (review minor).
- Hidden-details line placed directly above slot 3 on surface.sunken; warming line placed in the FreshnessLine (review minors).
- Overflow count now '+N' counting marks, matching f5 (review minor).
- Private date at a claimed home shows ScopeChip person glyph + 'Only you' at the end of its SourceCaption (artboard 13) (review minor).
- Weather source caption now authority · scope · as-of (review minor).
- Offline disabled-control reason strings added to COPY (review minor).
- Notes records that 'Your household' chip supersedes 'no chip' in flow-06 and the inventory (review minor).
- Section titles are accessibility headings (review minor).
- Artboard 14 has no FirstWeekRow, with reason; recorded on Notes (review minor).
- Ranked tax signal title changed to 'Pay property tax, 2nd half' to mirror f5's action-naming title.

## f5-today-calendar-strip
- Added the saved-outside-window state (status line 'Saved · Lease ends Wed 31 Mar 2027 is in your place file · See it'), new artboard 14, and split the OUT line for inside vs outside the window (review major).
- Added a visible 44pt 'Set your pickup day' button on the first unset seeded pickup row, opening the DateSheet in create mode with Pickup day and Thursday prefilled; drawn in artboard 03; FirstWeekRow entry now targets it (review major).
- Specified cell fill and edge: surface.sunken with a 1.5px text.secondary baseline, weekends at 50% fill; skeleton has no baselines or initials; DONE WHEN checks artboards 07 vs 08 (review major).
- Phase-2 artboard fixed to one viewing date (Tue 20 Oct 6:10 PM): relative counts 3/8/13 days, summary 8 items, Tue 20 pickup row in done style; bill rows get the tick mark (review major + minor).
- Geometry rule replaced: every artboard full-length with collapsed PickupCard, whole card, fold line, never shortened rows (review major).
- County specimen given a time (6:10 PM), done-style Tue 20 row, no tonight outline, summary 5 items, week-two label 'Tue 27' (review minor).
- Empty specimen moved to a new account whose only saved place is Mom's place, with chip and footer (review minor).
- Deadline titles now name the action: 'Register or update to vote: online or mail' and 'Pay property tax, 2nd half'; spoken labels updated; rationale recorded on Notes; mirrored in f1 (review minors).
- Row actions made reachable without gestures via the DateSheet (with a content-swapping 'Where this comes from' row and Back) and a 44px overflow button on web 1440 (review minor).
- Left-rule wording now matches the contract ('Annual or self-entered rows'); seeded city pickup rows never get it; identity.home on a saved place recorded as an open question (review minor).
- Added private-at-a-home row state and qualified the home footer sentence in EDGE CASES (review minor).
- Notes now lists contract clarifications (4) narrowed region bar, (5) new DateRow states, plus the cell token and pickup-button clarifications (review minors).
- Overflow wording aligned to 'more than 3 marks show +N'; tonight outline tied to tomorrow's pickup cell; artboard count now 23 with renumbered phase-2, AX5, greyscale and dark frames.

## f4-today-pickup-card
- Frame 2 caption corrected to '● Confirmed by Sam on Sat 3 Oct · Tuesday' (3 Oct 2026 is a Saturday); every read date now carries its weekday ('read Thu 1 Oct 2026') (review: major, date/weekday).
- Kept HOME A's combined recycling headline and route-calendar source, but logged it on Notes as an assumption that departs from P17 and needs founder sign-off (review: major, P17).
- Added PLACE B tray preview 'Garbage tomorrow' / 'Bins out tonight' (no street label, no recycling) to frame 7 (review: major).
- Frames 4 and 5 now read 'Garbage only tomorrow' (the holiday headline too); PLACE B keeps 'Garbage tomorrow' because recycling is Not set; conflict logged on Notes (review: minor x2, resolved together).
- Spoken button labels now start with the visible text, with hints (WCAG 2.5.3) (review: major).
- Stale state no longer dims the marks; only the FreshnessLine ages, and a mark dims only when its source calendar has expired; artboard 15 updated; new INSTEAD OF line (review: major).
- Removed the non-existent StatusLine component; status line described in LAYOUT; the reported line is ProvenanceMark (reported variant) (review: minor).
- Widget offer unified as 'Put today on your home screen' / 'Show me how', with the override of the 00d-06 S3 strings logged (review: minor).
- Ask buttons specified as equal outlined buttons that stack at AX5; added the granted-but-briefing-off path (review: minor).
- Web ask gated on the web briefing push channel; dependencies added to Notes for the web channel and removal of the iOS launch-time permission request (in plain words, no file path) (review: minor x2).
- Notes now record the superseded push copy (design doc caveat, PushCopy body) and the omitted quiet-hours / Scheduled Summary delay (review: minor x2).
- Invented-strings Notes line broadened to cover every non-canonical string (review: minor).
- Tray artboards reworded as PushCopy inset illustrations with 'iOS Active' / 'Android DEFAULT' as annotations outside the inset, with no lock screen or system chrome (review: minor).
- Guest frame now uses LockedActionRow in place of the buttons; the Priya assumption is logged as departing from the pending-invite fixture (review: minor).
- States renumbered sequentially (no 03b/05b/08b); the ProvenanceSheet for a household-confirmed rule omits the city-report checkbox (review: minor).
- Removed code identifiers (SCOPE_RANK, hasHouseholdPickup, haptic API names) from the prompt text and kept their meaning in plain words (house rule: no code identifiers).

## f1-today-air-band
- Alert audience now reads 'claimed homes and the person's newest saved place' (design doc); the Notes question was reworded to 'whether to widen beyond the newest saved place' (review: minor).
- Added a Notes dependency: the alert checker must read each person's threshold before the 151 frames can be true (review: minor).
- The hazardous frame now has a place, time, threshold, crossing time, ScopeChip and caption; the choice is logged as an assumption (review: minor x2).
- The below-151 push now states it uses PushCopy V4 with a corrected title that overrides 'Sensitive groups: AQI 118'; logged on Notes as a question for the contract owner (review: major).
- Removed the redefinition of AqiBand anatomy; the prompt now says to draw it exactly as on the Foundations board and lists only two overrides (the PANTOPUS NOTE content and the still-above line), both logged on Notes (review: major).
- Deleted the 'USG' allowance; category names are always EPA's full names (review: minor).
- Frame 4 now has the observed-6:00 PM caption and the silent in-place update to AQI 182; the PLACE B alert is dated 4:10 PM (review: minor).
- Added artboard 5, alert-other-saved-place; the manifest and batch plan were renumbered (23 frames) (review: minor).
- Overflow target sizes are now given for all three platforms, the widget deep link is written in full for native and web, and the web-1440 section is set to 640 wide (review: minor).
- The PM2.5 sensitive-groups sentence now matches the Foundations board word for word, and the verify-verbatim note is kept (review: minor).
- The tray artboards are now drawn as PushCopy insets, with their levels printed as annotations outside each inset, for consistency with the PushCopy board rule.

## f4-briefing-optin-card
- A morning-row grant now turns on the evening briefing only if the night-before row was never answered; a declined row is never switched on; the side effect is visible as 'Also on: the night before pickup' and drawn as new frame 4 (review: major x2).
- Added a Notes dependency: the iOS launch-time permission request must be removed (in plain words, with no file path) (review: major).
- Added a Notes line explaining that the old Place > Today opt-in is removed because the route is folded into Today; TYPE now gives that reason (review: minor).
- 'Omitted' now reads 'iOS and Android both-on' (review: minor).
- 'Not now' and 'No thanks' now use separate InlineUndo strings that match the pickup card, plus one line on how Not now differs (review: minor x2).
- Frame 5 (formerly 4) composition stated: Today is scrolled so its full QuietDayReceipt is off the top edge (review: minor).
- The Yes buttons' spoken names now start with 'Yes' (WCAG 2.5.3) (review: major).
- The already-denied state no longer shows a settings pressure line before any tap; the row swaps only after Yes is tapped; artboard renamed 13-yes-tapped-while-denied; the INSTEAD OF line was updated to match (review: major).
- Kept the flow-07 widget offer string and logged its override of the 00d-06 S3 strings; 'Show me how' is shared with the pickup prompt (review: minor).
- Added an alternative collapse line, 'Your dates still show here on Today…', for a decline from the morning row or a place with no pickup day (review: minor).
- Added the 'For 2418 NE Larkspur Loop' caption for people with more than one place, from the absorbed f1-briefing-settings proposal (review: minor).
- Added a Notes entry: 'Yes' kept as an answer label with a verb-led accessible name, and board question 6.2 still open (review: minor).
- The manifest was renumbered to 28 frames with sequential state ids; the batch plan was updated.

## f4-notification-primer
- Pickup entry is now the first Date-sheet save only; the first "That's my day" uses the PickupCard inline ask and fires the OS dialog directly (review major; per-surface-changes f4-today-pickup-card; brief §2.8). WHO AND WHEN and artboards 1, 2, 4, 16 rewritten; the inline-route open question replaced by a superseded-flow note.
- Sheet anatomy and strings aligned to Foundations NotificationAsk: content-sized detent, Close row, no iOS grabber, titles "Pickup reminders on this phone" / "Household updates on this phone", the board household body, silence contract, tray time "now", "Notifications are off for Pantopus." with board captions, Android buttons outlined (review major; prompts-v3 00d-06).
- Mail handoff defined: Allow turns Household activity on, banner removed, status line "Household updates are on · Change" to ?group=household; in-place switch when already granted; Don't Allow leaves the banner. Artboard 10 replaced with 10-mail-granted (review majors).
- Granted caption now "Next pickup reminder in 7 days · Mon 26 Oct, 6:00 PM · garbage only" because a bill due Fri 23 Oct can trigger a Thu evening send (review major).
- Added the removed launch-time request line (inventory purpose; flow-14 step 1).
- ATTACH now uses only existing Today and Mail tab frames; hosts come from Foundations (build order).
- Notes open question on whether the body should name Account & security and existing reminders (brief §3; NN/g).
- Offline frame explained as a connection drop after the pickup save; queued pickup saves never open the sheet.
- Widget hint: once per 24 h after confirm or denial, with the frame 4/5 split; Android visible Close added; note on why no lasting decline is paired.
- Resolved scroll-and-highlight conflict: no briefing-card highlight; recorded for the briefing card prompt (flows-spec line 481).
- Widget row string corrected to "Put Today on your home screen" with "Add the widget".
- Worst-case tray body shortened at a word boundary to 37 characters; full label struck in the margin; artboards 12-13 updated.
- Save error now uses NotificationAsk "Couldn't save · Retry" in the briefing card status slot, naming the failed write; InlineErrorRow dropped from this surface.
- FIRST FIVE SECONDS reordered to title, tray, Continue to match layout and reading order.

## f4-notification-settings
- Task reminders and task_assigned now have a switch: "Bill and task reminders" with helper naming tasks given to you; full switch map added to Notes (review major; design doc §3; derive f5-reminder-settings-copy; critique).
- OS-denied frame fixed: every switch off and disabled with the caption "Your choice: on. It comes back when notifications are allowed."; artboard 5 rewritten (review major).
- Explicit override of the Foundations NotificationAsk OS-blocked specimen (switch off/disabled, not on), with a Notes correction item (review major).
- Quiet-night frame moved to Wed 21 Oct so the skip receipt is true; edge case adds never skip before a pickup day (review major).
- "Tasks completed" caption is now "Only tasks you created." (design doc F3).
- ATTACH: the briefing card and Mail row entry hosts come from Foundations components (build order).
- iOS blocked string "Off in iOS Settings · Open Settings" added; Briefings widget row hidden while the banner offers the widget.
- Morning caption reworded to "Items sent in the last day don't repeat." with the weather lead-in exception on Notes.
- Deep-link landing moves accessibility focus to the group header, then the first control; Notes question on the "Turn these off" label (brief §5).
- Threshold selection is platform-native: iOS checkmark, Android M3 radio, web native radio; focus is separate.
- "Pause briefings until…" defined: platform date picker defaulting to 7 days, then "Paused until Mon 26 Oct · Resume".
- Air helper now states the delivery level first.
- Offline copy now says what still works: "You're offline. Your current settings still apply. Changes need a connection."
- Blocked spoken label is per platform (Android "disabled", iOS "dimmed").
- LockedActionRow removed; FactRow not-at-this-tier used for Household activity at PLACE B (contract doNot).
- Artboard 8 moved to iOS to show the story's native landing from "Turn these off".
- Loading timing rule added: nothing under 1 second, then skeletons (brief P11).
- Added Mail's "Household updates are on · Change" as an entry to ?group=household, to match the primer handoff.

## f1-claim-receipt
- Existing-household case now has its own summary, question and caption naming Sam; artboard 14 rewritten with the delta (review major and minor; flow-06 failure branch).
- Visible scope captions added under every scope pair, including pending, kept private and shared (review major; ScopeChip contract "glyph plus words"; flow-06 step 5).
- Linked Notice deadline moves with its lease row as a caption and is not counted; Notes assumption added (DateSheet contract).
- At-claim Share result and revisited Keep private now drawn (artboards 6 and 7 are side-by-side result pairs); counts update after a successful Retry; the worst case uses a real long warranty item name.
- Claim receipt banner placed in the LandingBannerSlot precedence after invite and reissue; revisited page has no primary action.
- Notes: the confirmation caption names whichever verification method was used (design doc F3b).
- Header now uses visible "Was" / "Now" words with a spoken label, not strikethrough alone.
- Keep private result line gains Undo, equal to Share (ICO; brief P19).
- Pickup day row gains the caption "Everyone in this household will see this."
- Different-address frame now uses Maya's own saved place "Mom's house" instead of Jordan Lee's PLACE B.
- Initial focus defined for the success screen and the revisited page.
- Artboard 21 is now the dark twin of iOS frame 3.

## f6-home-basics-rows
- Replaced the two-state status line with five true states (showing, hidden, not started, ended, not set), in the house count-first order, with a one-time 'Saved. ' prefix; frames 1, 2, 7, 8, 9, 15 now name their exact line (review major x2, minor ordering).
- Removed the Notes item defending date-first ordering (review minor).
- Entry path now Place → HOME A → Home tools → Settings; added the fallback for an iOS screen with no Home Info group (derive-proposals).
- Corrected how homes arrive: saved-place claims arrive Not set, 'just moved' checkbox stamps the add date; web Edit home page noted (inventory uxNote, derive-proposals).
- Added Notes line that the inline 'Just moved in? Tell us when' ask is now the place file's Not set row (derive-proposals).
- Split deep-link arrival into case A (sheet opens, focus in sheet, highlight after close) and case B (checklist row focused, no sheet); frame 16 shows B with an A inset.
- Targets now follow Foundations 00c-02: known row is whole-row target; Add and Show again are separate buttons with spoken labels.
- Validation reworded: dates inside 60 days get no note.
- Offline now draws FreshnessLine 'You're offline · as of 6:10 PM' with per-control reasons, including a Show again offline reason (contract OfflineNotice).
- Added member helper, 'Saving…', 'Saved', 'Retrying…' to COPY; slow save is glyph plus word, word only under Reduce Motion.
- Clarified save failure: sheet already closed, Retry resends, tapping reopens the sheet with Tue 29 Sep 2026.
- Notes now list contract deviations (hidden toggle and ReminderLeadControl) and the omitted cold-load state.
- Replaced the templated web URL with /app/homes/home-a/settings (HOME A's id).

## f6-place-section-details
- Self-report line now 'You marked this done · Only you will see this.' (contract ScopeChip sentence; the two review fixes conflicted, chose the approved sentence form) in LAYOUT, frame 13 and Notes.
- Voter lines are now two DateRows by exact name with KindGlyph and relative-first line 2 ('in 7 days · Mon 26 Oct', 'in 15 days · Tue 3 Nov'); FIRST FIVE SECONDS, frame 14 ('in 7 days · Tue 3 Nov') and DONE WHEN updated; Notes sentence replaced (house style, contract DateRow).
- Air row relabelled 'Air quality index (AQI) today', caption shows 'observed 7:00 AM — 11 hours ago', mark at 50% (stale air row); added to components, edge cases, INSTEAD OF and a Notes assumption (brief P11, contract FreshnessLine).
- Mark rule clarified: 'Not on record' rows carry no mark; not-mapped and non-burnable keep the filled mark; spoken examples added.
- Radon caption now includes 'as of 1993 map', flagged on Notes.
- Offline link reason now 'You're offline. You can open this when you're back.' (Foundations 00c-08, OfflineNotice).
- Flood ProvenanceSheet adds the wrong-place row 'Wrong spot on the map? Tell Pantopus' (research-findings, contract variant); frame 11.
- Named-home chip now also on the Risk section header for multi-home users; Notes records the in-state second home and the out-of-state risk.
- TYPE now keeps the existing 'Your household' header chip on both pages.
- Frame 10 is three definite crops; the optional array became a definite 100-cell array in crop (c) only, with an invented caption.
- Added web-390 Civic frame (artboard 8), renumbered to 25 frames, and a fifth batch turn.
- Deep link written as pantopus://place/home-a/civic (HOME A's id).
- Notes widened: saved-place/T1 destination for flow-13, place file voter row and Foundations 00c-08, with a proposed DateSheet fallback; Zone AE contract string difference; invented-string list expanded.

## f3-members-roster
- The roster now follows the Foundations MemberRow board: the heading is ADMINS, OWNER has no disclosure, and each disclosure is a 44pt/48dp row with a chevron. The review found the prompt contradicted the board here.
- MemberRow's own-row caption (⑧) is explicitly suppressed on every row, including Maya's. Notes records this as a deliberate override the board should adopt. The review flagged that the board variant would leak into frame 1.
- The Leave sheet now uses DestructiveConfirm's Leave-home variant word for word: the What goes / What stays lists and the buttons Leave this home / Stay in this home. A new artboard 8 draws the done state, "You left Larkspur Loop." The Remove sheet uses the same two-list shape and is listed as a proposed variant. Adding tasks to the Leave list is a Notes proposal. (Review, major.)
- Pending rows now follow the InviteRow board. Resend success appends " · Sent" and is spoken as "Invitation resent". "Waiting for your OK" is a caption, not a StatusChip. The link caption drops the role. Offline reasons are per action. "Inviting needs a connection." appears only under the header Invite. (Review, major.)
- Needs-reissue rows show no expiry, and Notes proposes this change to the board. The "Sent again · The old link no longer works…" state is kept and listed as proposed. Notes also records why the reviewer's alternative resend string was not adopted, where two minor fixes conflicted.
- Added a partial-failure state: an InlineErrorRow "We couldn't load pending invitations. · Retry" in the Pending slot while the people stay live. It has its own artboard (13) and edge case. (Review, major; source: derive proposal for the invitation-reissue surface.)
- Added detail lines for the legacy case (Jordan Park), the post-attestation case ("Confirmed by Maya Chen · Mon 19 Oct 2026") and Noor Haddad. Frame 4 now shows three sheets. (Review, minor; F3b legacy rule.)
- Removed the contradiction about how someone becomes a Guest: a new Guest comes through Invite, an existing person through Change role. (Review, minor.)
- Renamed the expiring invitee to nina.cho@example.com, so it no longer clashes with the house style's Jordan Lee. The caption now keeps the date: "Expires tomorrow · Tue 20 Oct". (Review, minor.)
- The Change role sheet gains a title, Save role, Close, and an InlineUndo "Sam is now an admin · Undo" with the household notice held until the Undo closes. (Review, minor.)
- Cancel invitation and Turn off link now take effect only when the Undo closes, per brief P19. (Review, minor.)
- Guest passes now opens the Share page on web and the native guest-pass screens on iOS and Android, and both native screens are attached. Notes asks whether the Android form actually issues a pass. (Review, minor; checked against the codebase.)
- The admin disclosure now starts with "Everything a member can do, plus:". All invented disclosure strings are listed on Notes, with the admin-rights assumption and the tasks product question. (Review, minor.)
- The locked row now reads "message your neighbors", matching LockedActionRow. The spoken-label date order now matches the board. (Review, minor.)
- The empty state hides the header Invite, leaving one action. The entry point is now "the member count on the home dashboard's Today card". (Review, minor.)
- The web attachment now includes the Calendar header tab, and Notes records that the dashboard guest quick action points to the Share page. (Review, minor; derive proposal for the add-guest fix.)
- The artboard states are renumbered in manifest order. There are now 24 artboards (new: left-done, pending-error), in 4 turns. (Review, minor.)
- Sam's single-dead-invitation Fix now opens the composer directly, matching the banner prompt's decision.

## f3-invite-composer
- All three channel options now use the standard ChoiceChip channel style, with Email selected by default. This removes the text-chip look for Share instead, which the review flagged as a contract mismatch.
- The member caption now uses GrantLimitList V5's middot format. The Guest caption adds the relative count ("· in 13 days"). Notes records it as a correction to V5g, and records the ChoiceChip board's comma version as the one that should follow. (Review, minor.)
- The review manifest now uses V2's grants followed by V4's "What needs address verification" with "Show 3 more", replacing the undefined "(5)" collapsed list. Notes lists this as a proposed extension. (Review, minor.)
- Offline keeps the chips enabled, and Notes flags this as an override of the ChoiceChip board's disabled cell. (Review, minor.)
- The link-ready frame 8 and the Android frame 15 now show "Expires in 7 days · Mon 26 Oct". A sent line for the username channel was added. (Review, minor; InviteRow rule that every active link shows its expiry.)
- The email sent panel and the reissued panel now carry a caption naming who the link is for. (Review, minor.)
- Artboard 10 now shows the new link with Copy link / Share, the old link stopped, the new expiry and Done, in the sent-panel layout, per flow 12 step 4. (Review, minor.)
- Added the lookup state "Looking up @priyar…" (frame 3 crop), Close on the form and review, and the in-sheet already-member and already-invited errors in COPY. Removed FreshnessLine, which nothing used. (Review, minor.)
- The web scope line now lists every web change. Added reissue entry points: the home dashboard's invite entry after the rules change, and the sender banner's Fix when only one invitation needs reissue. (Review, minor; derive proposal for the invitation-reissue surface; matches the banner prompt's decision.)
- Notes now records that Foundations crops showing "Send invite" or an InviteRow under the link choice are superseded, and flags the glossary conflict with "Members" used as a screen name. (Review, minor.)
- Artboard state numbers are renumbered in manifest order (14-email-error, 15-ax5, 16-greyscale). The prompt stays at 22 artboards in 4 turns.

## f3-invite-banner
- Replaced the rule "never inserted after first paint" with the LandingBannerSlot behaviour. The slot waits during the page's WarmingSkeleton. A late invitation banner replaces any lower banner and moves content down once, in 300ms or less (no animation under Reduce Motion). Only a failed or empty fetch guarantees no shift. Added artboard 7 (late arrival) and updated the edge cases, motion and DONE WHEN. (Review, two majors; Foundations board note 5.7.)
- Added states for the "Invitations waiting for you" list: skeleton rows, the InlineErrorRow "We couldn't load your invitations. · Retry" when the list is reached from a push or Review, and offline rows with Review disabled. They are drawn together on artboard 13. (Review, major; derive proposal for the received-invitations list.)
- Added the rule that the banner and the section never repeat each other on Your places. The count banner now appears on a place file (Sam Ortega as the recipient, on Notes), and artboards 2, 16, 20 and 22 were redrawn. Frame 3 is annotated. (Review, major.)
- The expiring banner is now the LandingBannerSlot expiring variant: a two-line shape, the caption "Expires tomorrow · Tue 20 Oct" in text.primary on line 2, and the warning glyph replacing the envelope. COPY, artboard 4 and the greyscale frame were updated. (Review, major.)
- WHO AND WHEN now states landing on Place as the blocking assumption A1. WHERE says Today draws no banner if Today stays first. DONE WHEN now reads "the first time they open Place". The Notes question is marked blocking. (Review, major; brief §2.5.)
- Offline now uses the board caption "You're offline. Review opens when you're back." (and the Fix version), with FreshnessLine kept at the top of the page. The AX5 action is now left-aligned. (Review, minor.)
- The precedence ladder now matches the board's nine steps, and Notes says the full ladder lives on the Foundations board. (Review, minor.)
- The notification rows now use "Today · 5:10 PM" and "Today · 9:00 AM", with no home label, because Maya has one home. The invitation push, the "Household invitation" placeholder and the Android public version are listed as a proposed PushCopy variant. (Review, minor.)
- Notes says the sender banner is LandingBannerSlot's sender-reissue variant and that the InviteRow board's crop should be corrected. (Review, minor.)
- Fix on a single dead invitation now opens the composer's reissue review directly, matching the one-item reasoning. It is recorded on Notes and mirrored in the composer and roster prompts. (Review, minor.)
- Count rules added: only live invitations not hidden by Not now are counted; with only dead invitations there is no banner but the section shows; Not now on one of two leaves a single-invite banner. The cancelled caption now names who can fix it. (Review, minor.)
- The worst-case name is now drawn on artboard 19 (web-390), and "You have 9 invitations" on artboard 22. (Review, minor.)
- The per-frame fixtures are now stated (which frames have one invitation and which have two), and the state numbers run in manifest order. There are now 28 artboards in 5 turns. (Review, minor.)

## f3b-invitation-decision
- Notes: the new-invitation push moved to the Account & security group (Time Sensitive / HIGH, on by default), with the placeholder 'Invitation' instead of 'Household update'; a lower level is recorded as an open decision (review major, ux-research-brief §3)
- Limit-row colour unified to the contract: body text.primary on base, lock glyph in text.secondary; ACCESSIBILITY and INSTEAD OF rewritten to match (review major + minor, GrantLimitList contract)
- Added a pinned bottom action bar on ios/android/web-390 with scroll padding, unpinned at AX5, inline on web-1440; frames 1, 2, 4, 6, 7, 8 are drawn at viewport height (review major, house style sticky bars)
- The shared 'Also:' line was rewritten as verbs, with 'tier' and 'home record watches' removed; its wording matches the locked-action row's reason strings (review minors, critique 'never render tier')
- Grant heading changed to 'What members can do now' ('What guests can do now' for Guests); a contract change for second-person rows is recorded on Notes (review minor)
- Declined COPY fixed so Undo appears only once, in the InlineUndo (review minor)
- TYPE change list extended with (6) the Accept/Decline styling, (7) the new frames and (8) the pinned bar (review minor)
- Edge cases added: sign-in with a different email shows account mismatch; an already address-verified invitee sees 'Also yours' with ticks; a new frame 17 was added for it (review minor)
- Notes: added the Guest-grants assumption and the inventory's blocking dependency on the owner-confirmation path (review minors, inventory uxNote)
- Notes: added 'an hour ago', 'Declined · Undo', 'Invitation', the new headings and the offline caption to the invented strings (review minor)
- Offline now follows the OfflineNotice pattern (one line plus per-control 'Needs a connection.')
- Frame count went from 25 to 26, and the batch plan was updated

## f3b-verify-address-sheet
- TYPE changed from NEW to EXTENSION of the existing web VerifyPromptSheet and the iOS/Android PlaceVerifySheet plus status screens; the change list is spelled out, all three current sheets are attached, and isNew is now false (review major, codebase evidence)
- iOS now opens at the large detent; medium is used only for the single-line states. Requirement lines are shortened to 60 characters or fewer, and the 90-day rule and Clark Public Utilities example moved to the Document choose step (review major + minor on the medium detent)
- Ask now uses an InlineUndo 'Request ready · Undo'; Maya is notified on close, leave or background; 'Cancel request' follows, with a new request-cancelled frame (review major, brief P19)
- Landlord interaction and pending state added, with a new frame; a general rule says any pending method shows its status, not a second start (review minor)
- Unlock-row glyph specified. The two review fixes conflicted (success tick vs lock); the GrantLimitList lock was chosen because these rows are still locked for the reader, and the attestation sheet uses the tick with the same strings, recorded on Notes (review minors)
- Notes record the departure from the doc's 'unchanged' unlock list and the dropped mailbox benefit (review minor)
- The didn't-confirm state now removes the Ask row; recorded on Notes (review minor)
- DONE WHEN fixed to put the header above the 'What this unlocks' heading (review minors)
- Frame 16 became the before/after caller frame (now 19), matching the components list (review minor)
- Pending dates gain relative counts; the code format is specified as 6 uppercase letters or digits with the standard keyboard, and listed on Notes (review minor)
- Offline follows the OfflineNotice pattern: one line plus 'Needs a connection.' per row (review minor)
- The shared 'Also:' line was rewritten as verbs without 'tier', matching the invitation and attestation prompts
- Callers list updated: 'Enter code' on the pending LockedActionRow opens the pending state
- Frame count went from 29 to 32; the batch plan now has 6 turns

## f3b-owner-attestation
- The push is placed in the Account & security group, on by default, with the placeholder 'Request for you' instead of 'Household update'; the level stays an open decision on Notes; frame 13 draws it (review major + minor, brief §3 five fixed groups)
- The header reads 'Not now' only while a decision is open and 'Close' in every other state; frames annotated (review minor, house style visible Close/Done)
- Reading order now starts with Not now; initial focus goes to the title (review minors, WCAG 2.4.3)
- The commit moment now covers sheet close, leaving the screen and app backgrounding (review minor)
- Grant rows specified as the GrantLimitList success tick with the verify sheet's strings and order; 'Don't confirm' is always enabled and needs no tick (review minor)
- Sam's decline NotificationRow 'Maya didn't confirm your address' added and drawn in frame 13; listed as invented (review minor, flows-spec failure branch)
- Frame 13 extended with the NotificationRow twin and Sam's result rows (review minor)
- Notes: the hard-prerequisite rule from the inventory and FINAL open question added (review minor)
- A request-cancelled-by-Sam state was added (merged into frame 10), matching the verify sheet's new Cancel request
- The shared 'Also:' line was rewritten as verbs without 'tier', matching the other F3b prompts
- Offline follows the OfflineNotice pattern, with 'Needs a connection.' per control

## f3b-locked-action-row
- The pending row now has the 'Enter code' link to the verify sheet's pending state, instead of no link; CONTENT, LAYOUT, frame 5, DONE WHEN and INSTEAD OF were updated, and the contract change is recorded on Notes (review major, research 'no dead ends')
- Light-mode colour fixed to a single choice (text.secondary on the host's base/raised surface, no fill); dark mode is named by tokens only, and raw hex was removed from LAYOUT and frame 17 (review minor, house rule)
- Notes: the release-coupling rule from the inventory uxNote was added (review minor)
- Notes: all non-doc reason strings are listed as invented or changed, including the three reworded from v1 (review minor)
- Notes: added the Mail-gate scope assumption (review minor, design doc mailCompose gate)
- Notes: the 'in place of the control' deviation now names flows-spec flow-04 step 12 and explains how the Android no-op is prevented (review minor)
- COPY now states that all CONTENT strings are final copy and lists the extra captions; the pending date gains the relative count (review minor)
- Jargon reasons reworded: 'claim residency for a program', 'get alerts when this home's public records change'; the worst case now uses the longest string (review minor)
- 'Founding Neighbor tier' removed from host names and the components list, per the critique rule never to render 'tier'
- An edge case was added for document- or request-pending rows, which read the matching verify-sheet status

## f3-household-block
- Rewrote the NotificationAsk sentence to name what Household activity sends (joins, leaves, bills marked paid, calendar edits) and to say bill updates due soon can make a sound; dropped the flat 'no sound' promise (review major; brief §3; contract NotificationAsk).
- Replaced the 43-character email-address caption with a PushCopy tray preview 'Your invite was accepted' / 'Larkspur Loop', the named title 'Sam joined your household', and the canonical in-app row '… — can see the calendar and bills'; never an email address in a notification (two review majors; house style PUSH; f3-household-notifications).
- Spoken labels now start with the visible label ('Invite by email. Invite someone who lives here', 'Share a link. Invite someone with a link') and the rule is stated (review major; WCAG 2.5.3).
- Added the fixture delta that Maya was unverified on Mon 5 Oct and confirmed by postcard before TODAY; stated which frames show the banner (01–07, 16–18) and which do not (08, 09) (review minor; Foundations 00c-09 V4).
- Made the NotificationAsk row's 'Not now' the permanent close with the setting kept in Notifications settings, plus a caption saying so (review minor; glossary 'Not now').
- Stated that the host headers already name Larkspur Loop and showed the header in the worst-case frame 02 (review minor; derive proposal densest content).
- Read-only lines now put the viewer first as 'You' in frames 08, 09 and the many-residents case (review minor).
- Resolved the show-rule conflict: full card only for someone who can invite while exactly one person is active; the 7-day window governs only the read-only line (review minor).
- Added PushCopy to ATTACH and components; added an INSTEAD OF line about lock-screen previews; updated DONE WHEN and Notes.

## f3-member-home-dashboard
- Pickup row now follows the TODAY fixture and Foundations V1a: hollow mark, line 2 'Tomorrow · Waste Connections · city schedule', spoken 'on record, not confirmed'; removed 'Maya confirmed this day' and the tick (review major; house style invariant 1; 00c-01 V1a). Same choice applied in f3-household-calendar.
- Member view legend now reads '✓ Added by your household'; owner view keeps the canonical legend; the ticked row carries 'Added by Maya'; contract question added to Notes (review major and minor).
- Rewrote 'What arrives' and WHO AND WHEN: Sam's first dashboard visit since joining day; the screen does not repeat Today's one-time notice, which may come before or after (two review minors; flows-spec step 8→10).
- KeeperStrip made unconditional and recorded on Notes (review minor).
- Moved the Android routing note to Notes as an omitted engineering item; kept only 'Notifications that have their own target never land here' (review minor).
- Each BillRow now carries the StatusChip 'Upcoming'; Comcast named as the third counted bill (review minor; contract BillRow).
- Frame 11 now draws Maya's voter row in the DateRow done state with 'Only you will see this.', never in Sam's view (review minor; consistency with f3-household-calendar).
- Notes now list the join-date precedence, HOA dues as a self-added date (hence $306.17 vs the Foundations $591.17), the 'Everyone at Larkspur Loop' caption reason, and Maya's pre-TODAY verification (review minor).
- Described 'Statewide — WA' as a coverage chip in ScopeChip geometry; added StatusChip to components; added an INSTEAD OF line and DONE WHEN checks for truthful legend words.

## f3-household-calendar
- Pickup rows (Tue 20, Tue 27, summary and projected rows, specimen move) now carry the hollow mark with 'Waste Connections · city schedule', matching the TODAY fixture and Foundations V1a/V1b; removed 'Maya confirmed this day', fixed the spoken labels and the projected-mark INSTEAD OF line (review major; consistent with f3-member-home-dashboard). This also removes the third-person 'Maya confirmed' issue in Maya's view.
- Property tax now follows Foundations V3c: 'Property tax, 2nd half' / 'in 14 days · Mon 2 Nov · Clark County Treasurer · county-wide' / 'Every year', filled mark and identity.home rule; only one-off voter rows have no rule; row groups and INSTEAD OF rewritten (review major).
- Resolved the monthly HOA conflict by keeping Foundations V6 (monthly) and drawing HOA on Tue 1 Dec, Fri 1 Jan, Mon 1 Feb and Mon 1 Mar with counts raised: December 2 items, January 2 (Maya) / 1 (Sam), February 1, March 3 (review major, alternative fix).
- Member legend now reads '✓ Added by your household'; owner keeps the canonical legend; contract question on Notes worded as in the dashboard prompt (review major).
- Frame 09 extended to January–March 2027 member view and renamed '09-january-to-march-member', drawing the notice and lease rows so 'never looks overdue' is checkable (review major).
- Used the Foundations strings exactly for the notice row ('Tell your landlord in writing by Mon 1 Mar 2027', 'Does not repeat · Reminder Mon 15 Feb 2027') and moved recurrence captions to their own last line in sentence case (review minor).
- Frame 08 annotation now points to Foundations DateRow V2 (Thanksgiving, Place B, City of Camas 2026 calendar) as the confirmed real example (review minor).
- Gave line 2 and a mark for every row; stated that home events and tasks carry the tick, the specimen row carries the hollow mark and the ghost row has none; added the December summary text; gave Sam's January header; described 'Statewide — WA' as a coverage chip (two review minors).
- Replaced 'There is no chip' with 'Keep the Statewide — WA chip; draw no Only you chip' and fixed the INSTEAD OF reason (review minor).
- Frame 15 now lands from the push 'Sam added Chimney sweep' / 'Sat 14 Nov · Larkspur Loop' drawn as a PushCopy inset (review minor; f3-household-notifications).
- Reworded the native entry as the Larkspur Loop screen's list and added a third inset for it in frame 14 (review minor).
- Named the guest (Lena Park, frame 06) and the legacy read-only member (Sam, frame 05); stated frame 06 'October 2026 · 5 items' and frame 17 'November 2026 · 9 items'; gave empty-state counts (review minor).
- Empty state now uses 'Checked — nothing from your household on the calendar' with one in-body 'Add a date' (review minor; glossary).
- Placed and labelled the month buttons: 'Jump to month' under the legend and 'Previous month' / 'Next month' on each month header, all 44pt (review minor).
- FIRST FIVE SECONDS now matches the layout, with the legend as a quiet caption line; the place file link is 'See the household calendar ›', noted for the place-file prompt (review minor; contract ScopeChip).
- Moved the Android routing note to Notes as omitted engineering work (review minor).

## f3-bill-detail-web
- Removed the impossible 'Already marked paid by Sam' race string from INTERACTION and COPY; kept only the phone case and added the '<name>' pattern for a future second manager to Notes (review major).
- Visibility now true: ScopeChip 'Your household' plus caption 'Maya and Sam can see this bill', Details 'Visible to: Maya and Sam', with the rule that 'Your household' is used only when everyone can see bills; updated COPY and frames 1 and 18 (review major + minor).
- Replaced the misleading 'Reminders are off for this bill, for everyone' with 'No more reminders for October's bill, for anyone.' and Details 'Reminders: Sun 22 Nov · Mon 23 Nov' (P18 whole series); added matching INSTEAD OF line (review major).
- Frame 04 is now the loop-phase Paid landing for Sam (no provenance, no trend); Sam's phase-2 captions moved to a 520-wide 'Other viewer' inset in frame 03 (review major).
- Added dark twin 26 of frame 02; Notes renumbered to 27; Turn 5 now 25-27 (review major).
- Fixed one StatusChip placement everywhere: at the end of the due line, wrapping under it at 390 (review minor).
- Added a Cancel text button (and Escape) to 'Paid a different amount'; stated that Edit opens the existing bill edit form, out of scope (review minor).
- Remove now carries the caption 'This removes the monthly bill and its future months.'; Skip is stated as one month only (review minor).
- Tick keeps the contract's fixed spoken name 'you added this' with the person in the row label; the open question stays on Notes with the Foundations legend overriding (review minor x2).
- Denied copy no longer uses 'members': 'Bills at Larkspur Loop are shared with Maya and Sam. Maya can change your access.'; replaced internal 'bill_paid' with 'the "marked paid" notification' in instructions (review minor).
- Notes records that detail uses 'Marked paid by' on purpose while BillRow keeps 'Paid by' (review minor).
- Stated that a stale notification for a removed bill opens this page's removed state, with browser Back returning to Notifications, to align with f3-household-notifications (cross-prompt consistency).

## f3-bills-list
- Removed the impossible 'Already marked paid by Sam' race variant from INTERACTION and COPY; kept the phone case and noted the '<name>' pattern on Notes (review major x2).
- Added dark twin 25 of frame 07; removed the 'omitted to stay in budget' note; Notes renumbered to 26; Turn 5 now 25-26 (review major).
- Moved the grouped burst from Tue 22 Sep to Thu 17 Sep on every row, frame 10, accessibility label and Notes, so no bill in it was within 3 days of due (review minor; matches f3-household-notifications).
- InlineUndo now reads 'Marked Clark Public Utilities paid · Undo' with 'We'll let Sam know when you leave this screen.' (page on web; omitted for Only-you bills); updated COPY and frame 7 (review minor).
- Header stated exactly: '3 upcoming · $306.17 through Mon 2 Nov · 1 overdue ($41.18)', overdue kept out of the window total; worst case updated (review minor).
- Notes explain HOA dues are a calendar date, not a household bill, so they are outside the list and totals (review minor).
- Notes and LAYOUT state the BillRow member variant is drawn as the header LockedActionRow plus 'Not marked paid yet' in place of 'I paid this' until decided (review minor).
- Target sizes now '44pt iOS / 48dp Android / 44px web'; Notes record the deliberate 'Paid by' vs 'Marked paid by' difference (review minor).
- WHERE path reordered to 'Place tab › Larkspur Loop (place file) › Money section › Bills' (review minor).
- Denied copy no longer uses 'members' ('shared with Maya and Sam'); internal 'bill_paid' replaced with plain 'marked paid' notification wording; grouped arrival now names the 'See all 3 in Bills' line to match f3-household-notifications (consistency).

## f3-household-notifications
- Date-reminder routing now matches the fixture window: in-strip dates open Today (Cedar Ave insurance, new HOA dues row), outside-strip dates open the place file Dates row (property tax); frame 13 has three labelled insets (review major).
- Removed-target fallback unified with f3-bill-detail-web: rows open the object's own removed state ('That bill was removed.' + 'Back to bills'); the list line appears only for unresolvable targets; frame 12 updated (review major).
- Added a hollow-mark date reminder (City budget hearing, 'on record, not confirmed') to the list and its tray version 'Unconfirmed: budget hearing' in frame 9; bill reminder rows now carry the tick, as on the Foundations board (review major).
- Grouped row now has one behaviour per target: in-app tap expands (chevron only, 'Show 3' removed), child rows open bill detail, 'See all 3 in Bills' opens the highlighted Bills list, the grouped push opens the Bills list directly (review major + minor).
- Burst moved to Thu 17 Sep, 6:40 PM in row 8, the push string, frame 7 and Notes; added the mixed-burst delivery rule (review major).
- NotificationRow used as published: row overflow removed and replaced by 'Household activity settings' links in the header and under the first Marked paid row; joined/left rows keep avatars (PR, TO); bill reminders end with the tick; line 2 order is amount · date · time · place label, with authority after the place for date reminders (review major + minor).
- In-app row 1 now reads 'Maya marked Clark Public Utilities paid' with a matching spoken label; 'Clark PUD' kept only in the push title (review minor).
- Row 9 caption no longer puts 'Today' beside the place name; added TODAY/EARLIER overlines with bare times; settings level line now 'Quiet — no sound or pop-up. Shows in your notification shade and in Notifications.' (review minor).
- Replaced the pickup-based INSTEAD OF line with the 'Maya marked Clark PUD paid' (26) title example; kept the caveat-first rule using the budget-hearing example (review minor).
- Web entry point is now the top-bar bell at 1440 and 390 with no sidebar tab selected; the web-390 list moved to position 4 and the manifest renumbered (review minor).
- Internal event names replaced with plain labels 'Marked paid', 'Task finished', 'Date added' (review minor).
- Lease push body now carries the action, 'Tell landlord by Mon 1 Mar', with the dropped place label recorded as a product trade-off on Notes (review minor).
- Removed-date landing now goes to Today (or the place file) with 'That date was removed.' and no error dialog, per the absorbed f5-reminder-landing proposal; the double-gate explanation line is assigned to f4-notification-settings on Notes (review minor).

## f8-scale-strips
- Replaced the wrong 'current order' with the real Risk & readiness structure on all platforms: Heat & cold first, instrument, NFIP, Seismic/Earthquake, Health & environment (Lead paint, Drinking water, EPA-regulated nearby), Emergency plan, Fridge card; section source notes replaced by SourceCaptions removed (review major).
- Radon free-kit line reframed as new work owned by f6-place-section-details, drawn as TextActionRow 'Get a free test kit · Washington Dept of Health ↗', absent with no state program (review major).
- Frame 8 moved to a January specimen date (Mon 11 Jan 2027) with the radon aha, since October shows the voter aha (review major).
- Share-card column now uses one-line short forms with a 720px column limit and a two-line rule for long air categories; removed the 'list overflow on Notes' escape (review major). Kept 'Air on …' with 'on' for consistency with the frozen row-name pattern and noted it on Notes.
- Summary sentence now follows the Foundations wording (three agencies issue resolved) (review minor).
- Narrow-width rule now covers frozen instruments ('as of' line and 'on Sat 12 Sep') (review minor; research-findings).
- Alert delta draws the 101 threshold rule on the signed-in Air row only; stale mark stays at full ink; EPA TAD Table 4 check added to Notes (review minor; 00b).
- Split entries from reuse sites; compare rows open ProvenanceSheet; the inventory's compare-tap entry listed as an open question on Notes (review minor).
- Notes flags the 7:00 AM to 6:00 PM fixture change (review minor).
- Added the wildfire ProvenanceSheet report control 'Only USFS can change this' (review minor).
- Collapsed line uses 'Air on Sat 12 Sep · 42'; Notes flags the arrival header must match (review minor).
- Placed the AQI spell-out on the Air band-name line (review minor).
- Legend shows only marks present in the frame (review minor).
- Frame 4 now three stacked specimens with gutter time labels (review minor).

## f8-compare-sheet
- Image rows use the share-card short forms and the 720px column limit; long sender line wraps to two 40px lines with a height budget shown in frame 13 (review major).
- Hollow street-matched row now prints 'On record, not confirmed'; sources line splits Official and On record, not confirmed when any row is hollow (review major).
- Notes records 05-og-column instead of V5 and asks for the 00b in-context correction (review minor).
- Notes assumption that the voter and tax seeded rows are verified (review minor).
- Worst-case headline no longer carries 'moved from' wording (house style rule) (review minor).
- Handoff names t0_share_clicked with meta.method 'compare' (review minor; design doc).
- Rate-limit copy now says 'requests', with the shared per-network budget noted (review minor; derive proposals).
- 28px deviation listed on Notes; shortened glossary form removed (review minor, merged with the major fix).
- Added the mobile URL-row Copied state and 'Link copied' status (review minor).
- 'Not now' renamed 'Cancel' everywhere per the glossary (review minor).
- Name field appears empty and focused; empty field keeps the card anonymous with no re-mint (review minor; flows-spec step 3).
- URL caption changed to 'Works for 61 more days' to drop the colon and duplicate date (review minor).
- Rate-limited state now defines disabled actions, caption, and a 'Try again' button after 60 seconds (review minor).
- Image instruction reworded to keep the attached frame's layout and replace its strings (review minor).
- WHO AND WHEN says which frames are the non-reciprocal and reciprocal paths; added to Notes assumptions (review minor; flows-spec flow-05).

## f8-compare-arrival-header
- Dana's headline is now the radon headline the default ranking picks on Sat 12 Sep; the voter headline moved to a Mon 5 Oct specimen (artboard 14) and the seasonal rule is recorded on Notes (review major, design doc F8 rotating headline).
- At 390 each expanded row keeps its own SourceCaption; the merged 'Sources:' line is used only at 360 or narrower and at 200% (review major, contract SourceCaption).
- Stated the expanded order below 640, including subline, freshness line, legend and the headline block, which never appears in the collapsed line (review major and minor).
- Expanded state no longer claims the field stays on screen: added a repeated 'Hide readings' and a tall frame with the fold marked; the keyboard rule now scrolls to keep the field and two suggestions visible; artboard 4 draws the keyboard (review major).
- Aligned the air and wildfire rows to Foundations V9 and 00b: label 'Air quality index (AQI)', value 'AQI 42 · Good · on Sat 12 Sep', 'Wildfire hazard potential', 'USFS · quarter-mile area · 2023' (review minors, glossary).
- Added the unconfirmed-row rule: hollow mark with label, or leave the row out when the token lacks confidence (critique finding).
- Notes records the 'must arrive by' rewording and the dropped follow-up line (review minor).
- Worst case lengthened to a 24-character name and a 57-character name and city, with a 90-character air headline valid for Sat 12 Sep (review minor, derive f8-1).
- Replaced the couldn't-check state with a couldn't-open banner over the ordinary hero that shows no readings at any width; the server-render sentence moved to Notes (review minors).
- Loading now uses the WarmingSkeleton row skeleton below 640 and the instrument skeleton at 640 and wider (review minor).
- Offline rewritten to the OfflineNotice form variant: sunken strip above the field, disabled controls that stay focusable, and the sentence printed once (review minor).
- Recorded non-target rows as a contract override (review minor).
- Collapsed button's spoken name now starts with its visible words, for WCAG 2.5.3 (review minor).
- FIRST FIVE SECONDS now matches the layout, with the lede between the H1 and Dana's line (review minor).
- After Mon 26 Oct the voter headline switches to the in-person line instead of hiding, and the relative day count was added (review minor, research share-compare-civic).
- Added artboard 07b-expired at 1440 and replaced the hollow-mark Notes question with the research answer (review minor).
- Manifest grew to 19 frames in four turns.

## f8-compare-reveal
- Rows now follow ScaleStrip V5 order (name and chip, value lines, track zone, band names, caption), and band names are printed (review major, 00b-01).
- Dana's headline is left off the reveal, with the reason on Notes (review major, design doc).
- Chose option (a): in October Jordan's aha is the voter headline with its hollow mark, source, detail, follow-up and VoteWA link. The FEMA next step moved above the divider, and the batch rule is recorded on Notes (review major, doc acceptance criterion).
- Each spread action now has its own true caption: 'Share this address' says it shares the address link (two review majors).
- Flood value uses the full approved string (review minor, contract).
- Worst case uses 'Very low · 1 of 5', listed as a specimen (review minor).
- Offline state now says 'Share this address' stays enabled; the action captions are added to the invented list (review minor).
- Geocode failure and unsupported region now show an editable pre-filled field, with no PlaceHeader, divider or WallBar; artboards 6, 7 and 19 updated (review major, flows-spec flow-05).
- Jordan's readings are listed as specimens on Notes (review minor).
- Radon next step reads 'Get a free test kit · Washington Dept of Health ↗', and the 13b artboard was added (review minor, 00b copy rules).
- Unsupported-region error now says what to do next (review minor).
- Specified the text.primary vs text.strong weight rule, the 1000/640/328 container and header spans, and added the 04b wide loading skeleton (review minor, inventory state).
- Added the legend's spoken form and the SlotMeter caption about the badge and claiming after close (review minor, research).
- Duplicate AddressChip gains 'Only you will see this.'; the hollow-mark Notes question is replaced; Air label is 'Air quality index (AQI)' and the wildfire label and caption match 00b (review minor).
- Added the unconfirmed or missing-confidence rule for Dana's lane (critique finding).
- Manifest grew to 20 frames in four turns.

## f8-og-compare-card
- Dana's og:description now carries the radon headline the default ranking picks on Sat 12 Sep; the voter headline stays on the reciprocal card, made Mon 19 Oct (review major, design doc rotating headline).
- The PNG is measured in embedded Roboto. The column widened to 760px with a 376px 'Yours?' card; measured widths are printed; budgets are fixture 620, reciprocal 620 and worst case 572; the overflow rule and compact-form fallback are kept (two review majors; measured with Roboto and Arial).
- Added the unconfirmed-layer rule: a hollow mark with words, or leave the layer off (review major, critique finding).
- The reciprocal headline and the reveal aha now match: both are the voter headline in October (review minor).
- Frame 4 now prints its budget, and the removed 24px gap is recorded as a deviation (review minor).
- Air rows now use the V9 value 'AQI 42 · Good · on Sat 12 Sep' with the layer word 'Air', recorded as a compression (review minor).
- First-name limit set to 24 characters (assumed, listed on Notes), and the worst-case name is 24 characters (two review minors, derive f8-3).
- WHO AND WHEN now matches the fixture: Jordan saved PLACE B last week (review minor).
- Named-card alt text now describes the image, including the header and 'Official' (review minor, OGP).
- Sources line uses the 00b per-authority string with dates and scope; old deviation (c) dropped (review minor, house invariant 5).
- Added the centre square-crop outline to artboard 6 with a WhatsApp note; replaced the hollow-mark Notes question (review minor, research hedge).
- After the mail deadline, og:description switches to the in-person line instead of dropping it (consistent with header and research).

## f8-native-share-compare
- Android 'Share this address' moved out of the sticky wall into the pair; wall now keeps only its sentence, 'Continue' and 24-hour line (TYPE, CONTENT, frame 8, INSTEAD OF, DONE WHEN, Notes) — review major (contract: no actions inside sticky wall)
- ATTACH split into 2a (wall with current link) and 2b (scrolled to aha card); added address OG card attachment — review major
- Caption sentence 1 now names 'the compare card'; Share hint now says the link includes the address; DONE WHEN checks the distinction; logged as Foundations delta — review major (privacy honesty)
- Sticky wall strings quoted in full with 24-hour line — review minor
- Added a defined status line between pair and caption holding offline reason, 'Link copied' or InlineErrorRow; caption always stays visible; error edge case and frame 4 fixed — review minors
- Spinner now replaces the start of the label as on Foundations S2; 1s delay logged as surface delta — review minor
- Android 13+ system clipboard confirmation annotated on frame 12 — review minor
- Rate-limited state given InlineErrorRow copy with time estimate, marked invented and not drawn — review minor (flows-spec flow-05)
- Frame 18 dark twin changed to android offline (app-drawn state) instead of system sharesheet — review minor
- Frames 6 and 7 drawn as labelled 'system UI' frame with the address OG card as header image; system UI treatment stated once in PLATFORMS — review minor
- Follow-up row string updated to 'Keep this address to set a reminder before Mon 26 Oct' to match revised f8-seasonal-aha
- Aha card referenced in its converted native anatomy; KindGlyph added to components used, to match revised f8-seasonal-aha

## f8-seasonal-aha
- Added summer trigger threshold: AQI 101+ today or wildfire hazard High (4 of 5)+, else ranked card (CONTENT, EDGE CASES, DONE WHEN) — review major (design doc F8)
- TYPE now says the kept anatomy is web's and lists the native conversion (overline, 42pt tile, neutral chip, SourceCaption, sunken follow-up scrolling to wall); ATTACH (2) marked 'layout changes as listed'; frames 18, 19, 23 and Notes updated — review major
- Follow-up strings changed to 'Keep this address to set a reminder before …' everywhere; INSTEAD OF, Never-write list and Notes updated — review major (notification model)
- Calm fallback now has one filled mark and three stacked SourceCaptions (NWS, AirNow, FEMA); FEMA/radon assumptions for Densmore Ave logged — review major (invariant 5)
- Frame 10 redrawn as a Mon 11 Jan 2027 radon card for a hypothetical Zone 1 county (Laramie County, WY) with no program link; county/state on Notes; voter-lookup rule noted — review major/minor
- Kept verb-led kit label and logged it on Notes as a deviation from Foundations V2a plus a check that WA DOH offers free kits — review minor
- Tier edge case now: signed out on web; on apps signed out or signed in with no saved place — review minor
- Deep-link and scroll-to-wall now move accessibility focus; spoken form for 'Today' added — review minor (brief §5)
- Notes now record dropped grade badge (one chip per row) and the voter-over-tax assumption — review minor
- Frames 18 and 19 draw the full TextActionRow share-compare pair and caption; hand-off text updated — review minor
- Icon tile defined as KindGlyph tile in text.strong on surface.sunken, no tint; KindGlyph added to components and ATTACH — review minor
- Compare share card removed from entry points (headline still appears there) — review minor
- Offline frame gains the OfflineNotice top line 'You're offline · as of 6:08 PM'; skeleton reference changed to WarmingSkeleton (section skeleton) — review minor
- Tax detail reworded to 'Moved from Sat 31 Oct because that date is a Saturday.'; reading chip logged as surface-specific pill; visitor logged as unnamed newcomer, not Jordan Lee — review minor

## f7-today-widget
- Artboard 05 and every 6:10 PM frame now draw the AQI row stale; added the rule that a confirm rewrites pickup only and keeps the 7:00 AM air observation (review major).
- Replaced the small-widget stack with a three-row height budget: 16 + 72 + 16 + 2×8 = 120pt, body semibold for every hero, no 4-line date hero. Added the air-hero small layout and set Android breakpoint e to about 80dp with 12dp padding; the budget is recorded on Notes (review major).
- Added the earlier-day age string "Observed Mon 7:00 AM · AirNow — 2 days ago" and the two-day-trip edge case (flow-07 step 11).
- Notes now record the doc's shorthand replacements, including "Garbage tomorrow" and "Tax due Oct 31" (now "Property tax due · Mon 2 Nov").
- The medium air band now prints "Sensitive groups" beside it (research: always print the category name); Notes explain why the small prints the name in the hero instead.
- The Vancouver lane now shows the holiday-moved weeks (Memorial Day, Labor Day) and projected weeks after the last published calendar (contract YearBand, brief P17); the assumptions are on Notes.
- Wrote out the spoken labels for the small, the large hero, the air line and the date line. Medium region 2 now says 'next, recycling and garbage Tuesday 20 October'. The large air line says 'observed'. The push action now uses the contract casing "That's My Day".
- Added a Notes line that CarPlay gets the StandBy treatment.
- Added a medium date-hero layout with a height budget and a drop rule; artboard 06 uses it.
- Large lines now follow DateRow grammar at widget density (44pt rows, KindGlyph 16pt, bodySmall/caption), with a YearBand height budget of 312 of 322pt.
- The large now has four link regions; the air line opens section=air. Artboard 02 outlines all four.
- Unified the AQI string order: "AQI 118 · Unhealthy for Sensitive Groups" for the medium and large, "AQI 118 · Sensitive groups" for the small and the Android minimum.
- Hero glyph is now KindGlyph (garbage+recycling); "Garbage only" lines use KindGlyph (garbage).
- Defined the AX5 clamp order (the small becomes "Pickup tomorrow" plus its mark; the medium and large keep the listed text). "Pickup tomorrow" is added to COPY and Notes.
- The small and the Android minimum now draw the ScopeChip glyph alone, with the words kept in the spoken label; still listed on Notes as a proposed deviation.
- Added a 6:30 AM timeline entry on pickup day, after which the ladder picks the Fri 23 Oct bill ("in 3 days").
- Added dark twin artboard 24 (stale air and past horizon) and height-budget artboard 23; Notes is now artboard 25, and a fifth batch turn keeps every turn at 6 artboards or fewer.

## f7-widget-tap-landing
- The ScopeChip on the claimed home now follows the contract; this is stated in TYPE and recorded on Notes as a change to the host screen.
- Added the Android no-place fallback (land on "Today starts with a place" with no sheet), in EDGE CASES and Notes (critique blocker).
- Notes now say the highlight lasts until first interaction, replacing the contract's decaying highlight, and give the reason.
- COPY now includes both EPA health statements, "Today starts with a place", the header address, and both "AirNow · nearest monitors" strings.
- ATTACH now includes Today's empty state, the Add a place sheet and the normal-day air band.
- Added artboard 10 (section=air with no crossing), a matching layout rule and a persona moment; later artboards renumbered, total 20, BATCH PLAN updated.
- Moved the internal link and event names out of WHERE IT LIVES and into Notes.
- DONE WHEN now says only a successful refresh clears "Open to refresh"; failed and offline landings keep it (also on Notes).
- KindGlyph named as garbage+recycling, to match the widget prompt.

## f7-widget-gallery
- Jordan's own-data medium now uses the widget's 2-line date-hero layout, with the caption continuing or on its own line and the air row dropped. EDGE CASES say 2 lines on the iOS medium and 3 on the Android 4x2 (review major).
- Said where each provenance shape appears: filled on the Clark County property tax markers (large only), hollow and tick on the medium. The VoteWA note now points at Jordan's hero, since in the sample the voter date is a bar.
- Added the sample-scope trade-off to Notes: "Your household" shown to people with no place and to Android users below version 15.
- Added Jordan's snapshot time (Mon 19 Oct, 7:50 AM) and a Notes line on the Android 15 generated-preview rate limit (about 2 updates an hour).
- ATTACH now includes the existing Android "Tasks near me" widget and the f7-today-widget date-hero artboard 06.
- The small sample and the large air line now match the revised widget (scope glyph, garbage+recycling glyph, "AirNow, observed 7:00 AM"). The greyscale frame now uses the large, so all three shapes can be checked.

## f7-widget-howto-sheet
- Guarded the no-place state: the "Save an address first" footer ships only where the signed-in Add a place sheet exists. Elsewhere the settings row is hidden for people with no place, and a Done-only fallback covers the case where the state is reached anyway. Recorded in EDGE CASES, Notes and artboard 09 (review major, critique blocker).
- Fixed the footer's contradictory weights: a filled "Save an address first" and an outlined "Done" of the same size below it, stated once.
- The inline-hint trigger now names "Yes, Tuesday is right" (contract PickupCard) and the notification's "That's My Day" action (contract PushCopy).
- The preview's spoken label now includes "Waste Connections" and "category 1 of 6, AirNow, observed 7 AM", matching the widget's region labels.
- The pin dialog is now drawn as neutral Material 3 system chrome, with Pantopus tokens only inside its widget preview.
- Added "Home screen widget" and the no-place fallback line to COPY and to the Notes list of invented strings.
- ATTACH now includes the signed-in Add a place sheet; the preview names KindGlyph (garbage+recycling) to match the widget.

## f9-nearby-cells-map
- Homes follow the server's k-anonymity floor of 10: exact counts appear only at 10 or more, or for the verified viewer's own area; otherwise the floored words 'Forming (under 10)' show. The Lacamas Shores fixture became the floored Hearthwood; the caption 'never a single home' is kept only on exact-count rows; the Notes question now uses 10 (review, major)
- Added TYPE items (6), the fill changing from home density to posts with a new legend, and (7), which keeps the existing 5x5 grid of 25 areas; the map summary now says 25. The verified-home density words survive in the panel and list, and the server dependency is on Notes (review, major)
- Base map limited to the ~2.7 x 1.9 mi grid extent, with SR-14, NE 164th and NE 192nd; I-205, Lacamas Lake and the paper mill dropped; scale bar tied to area size; area names declared mock-up labels; Sifton and Lacamas Shores replaced by invented Cedar Knoll and Hearthwood; Fisher's Landing and Forest Home kept to mirror Block Founders (review, major x2)
- Added ScopeChip in the location row, the map-centre rule, Jordan (saved place) and Sam variants, and a new artboard 13-saved-place-viewer; frames renumbered to 18 (review, major)
- Defined 'No data' as the posts lookup returning nothing, separate from the homes row 'No homes with a verified address here yet' (review, minor)
- Notes item added: area (map) and block (Block Founders) name the same unit (review, minor)
- Dark-mode colours now named by token instead of raw hex (review, minor)
- Phone sheet made non-modal, with scroll-first behaviour and focus return on Done (review, minor)
- Control block became two rows, adding the pan arrow labels to COPY (review, minor)
- The other 18 areas are named by nearest street, each with 0-2 homes shown floored, all listed on Notes (review, minor)
- List label changed to '3 with a verified address' (review, minor)
- Artboard 2 now shows the deep-link landing with its highlight and focus ring (review, minor)

## f9-block-founders-panel
- The postcard preview now uses the printed template text: front, back, count line, pantopus.com/start and the opt-out line with an invented code. Notes record that the preview renders from the same template and flag the under-10 count line (review, major)
- Restored the four existing address inputs (Street address, City, ST, ZIP) in place of one field (review, major)
- DONE WHEN and TYPE (6) now also allow the allowance counter's 'N of 6' (review, major)
- Added TYPE (8): the composer moves directly under the tier, then the roster (first 3, then 'Show all N'), then the unlock meters; reading order and layout updated so the counter comes first on phones (review, major)
- 'Permanent' is kept in frames but tied to Notes (e) with an engineering gate; the alternate caption is drawn on Notes (review, minor x2)
- ScopeChip now covers only the address-confirmed line; the header scope question is on Notes (j) (review, minor)
- Pending teaser now reads 'expected Thu 22 – Thu 29 Oct' to match the component; Notes (k) says the mailed date and expiry live in the verify sheet (review, minor)
- Used glyphs now carry a horizontal line, never a diagonal one (review, minor)
- Wording now follows the glossary: 'get a Block Founder rank'; Jordan's row is rewritten without 'homes'; Notes (g) updated (review, minor)
- Sam's roster row now reads '#3 Maya C.'; artboard 2 shows the post-send state; artboard 13 shows the disabled-but-focusable rate limit (review, minor)
- Unlocked meters now use an open-padlock glyph instead of a tick (review, minor)
- Entry (c) renamed to 'Go to postcard invites' to match Invite rewards (cross-surface)

## f9-invite-rewards-card
- Hero control renamed 'Go to postcard invites' and drawn as a text button, so 'Copy link' is the only filled button; Row A's spoken label, the handoff line, INSTEAD OF and DONE WHEN updated, and Block Founders entry (c) changed to match (review, major)
- Notes (h) records the server dependencies: a verified-stage count, and an error instead of zeros on failure (review, minor)
- Row B reworded to 'details for each area on the map, like posts and Founding slots', which avoids home claims and the under-10 conflict; Notes (i) cross-references the cells map decision (review, minor x2)
- Notes (j) flags the Invite glossary collision; the first ledger step is renamed 'Sent your link' throughout, including spoken, large-count, one-join and stale states (review, minor x2)
- Sam's link pantopus.com/join/sam-7h3q added to CONTENT and to frame 12 (review, minor)
- Added artboard 16-profile-pointer-row; dark twins and Notes renumbered to 17-19; batch plan now has 4 turns (review, minor)
- Jordan (saved place) is described explicitly on frame 12 and in LAYOUT, and removed from the omitted list except as noted (review, minor)

## f10-mail-day-triage
- Web 1440 widths now fit: 240 sidebar + 220 mailbox nav + fluid list (~620) + 300 right column, 24px gutters (review major, AppShell/mailbox layout widths).
- Decide redrawn as full-width verb-phrase action buttons with no radio dots; Tab/Enter behaviour, focus moves to the next row, polite status; removed the filled-radio selected style (review major, keyboard/switch safety).
- Decided rows collapse in place with Undo until Maya leaves, then list under Reviewed today; added artboard 02b-just-decided; motion is now collapse-in-place with Reduce Motion cross-fade (review major, contract InlineUndo).
- Removed per-row 'Not confirmed' words; legend once, ring/border/Confirm per row; greyscale frame updated (review major, contract ProvenanceMark copy rule).
- Resolved Alex: he is a current guest of HOME A; Maya's header adds the named-audience line; no-guest variant moved to edge cases (review minor, ScopeChip doNot).
- Empty state: no Finish day footer, hero button is the only scan control until it scrolls away; finished (a) replaces the footer (review minors on filled controls and duplicate buttons).
- Added bills-before-tonight note (only Comcast) to avoid duplicate fixture bills (review minor).
- Retry renamed 'Retry page 3 of 3', with 'Page 3 didn't upload' and a spoken label that does not name the unread sender (review minor; spoken wording deviation noted).
- Unconfirmed photographed rows get a secondary 'Decide' that files without a bill; added 'Keep paper, delete photo' (review minor).
- Undo lifetime defined when Finish day is never tapped, and 'Day finished · Undo' after Finish day (review minor).
- Dark not-confirmed row uses surface raised with the warning border and no tint (review minor, house tokens).
- Skeleton threshold aligned to brief P11 (nothing under 1s, skeletons past about 2s) (review minor).
- Privacy link placed with 'Mail Day settings' below the recap on web 390 and native (review minor, derive f10-8).
- Removed Today screenshot from ATTACH; frame 1 states the '2 pieces ready to check' status line (review minor).
- Notes: completed invented-strings list; added open decision on read-from-your-photo label and the proposed named-audience Foundations addition (review minors).

## f10-snap-capture-tray
- Alex Kim is a current guest of HOME A at 6:05 PM; Maya's frames 1-4 and 7-9 use the guest audience line (review major, ScopeChip doNot and research).
- Added fan-out of joined stacks with a bracket, per-page selection and in-bracket removed slot; WHO AND WHEN says Maya already joined 1-2 and 6-8 after each page returned as its own piece; frame 03 redrawn fanned (review major, research one-page-one-piece default).
- Added artboard 02b-water-joined as the main-storyboard join with page 3 uploading and page 8 failed; frames 03 and 04 marked as alternative branches (review minor).
- Chase stack reads '3 pages · Page 8 didn't upload' with 'Retry page 8' and ring text '1 of 3 uploaded' (review minors, self-contradiction).
- All-failed state: retry row above the buttons reads 'Retry 8 pages'; 'Done (5)' stays enabled (review minors).
- Count and live status pinned under the title so reading order matches visual order (review minor).
- Count reads 'pieces of mail'; joined stacks spoken as 'one piece of mail' (review minor, terminology).
- Stated the Close vs Done difference and the assistive label 'Close, your pages keep uploading' (review minor).
- PDF rejection's 'Add a due date' closes the tray then opens the Date sheet over Mail Day, no stacking (review minor, house style).
- Added the Android picker limit line with the value listed as open in Notes (review minor, research capture topic).
- Notes: proposed Foundations addition for the named-audience sentence form; completed invented-strings list (review minor).
- Batch plan extended to five turns for 25 artboards.

## f10-extraction-confirm
- No-claimed-home route now opens the Date sheet in bill mode pre-filled with the read values (hollow until Save); typed values kept on Close; frame 16 redrawn (review major, brief P2 and DateSheet bill mode).
- Added the guest-household audience line for Maya and stated frames 1-7 and 21 use it, matching the tray (review major, ScopeChip doNot).
- Added a sticky bottom commit bar on phones (stacked, wrapping, scroll padding, scrolls at AX5) and commit placement on desktop (review major).
- Added bills-before-tonight note; duplicate frame moved to a later second photo of the Clark bill; payee suggestions now use Comcast (review major, fixture conflict).
- FIRST FIVE SECONDS reordered to Amount then Due date (review minor).
- Notes inset for the day-before/day-of fallback control if bill lead reminders are not built (review minor, design doc F10).
- Guest arrives only from the tray's Done; Mail Day gives Alex no Confirm (review minor).
- ProvenanceSheet opened here has no 'This isn't right' control; corrections happen in fields (review minors, research).
- Undo lifetime defined: stays through Next piece as a collapsed line under the top bar until returning to Mail Day, then 'Fix what we read'; success uses text-button Undo and filled Next piece (review minors).
- Notes: extraction-schema backend dependency (labels, regions, flags, alternatives) (review minor).
- Crop rule now conditional on a region existing, with the no-region line replacing the crop (review minor).
- Web 1440 replaces the app shell with its own top bar; 55/45 spans the full width (review minor).
- Initial-focus Due date label now starts with piece and payee context (review minor).
- Notes: proposed named-audience Foundations addition and completed invented-strings list.

## f10-mail-piece-photo
- Bill-deleted amount line now reads "$142.18 · due Fri 23 Oct"; "was due" is reserved for overdue bills; COPY updated (review minor)
- Notes now log the proposed spoken name "not confirmed yet" as a departure from the contract's "on record, not confirmed" (review minor)
- Zoom cluster and page controls sized 44pt / 48dp / 44px (review minor)
- Notes explain that the Foundations Keep-focused default replaces the research's no-default-focus rule (review minor)
- Added the not-confirmed DestructiveConfirm sub-variant, the photo-deleted state for an unconfirmed piece ("No photo to check against"), and artboard 11b; batch plan rebalanced to at most 6 per turn (review major)
- Top bar now uses the host's navigation: iOS back chevron when pushed, Close only from Confirm what we read; the facts panel is a persistent non-dismissible panel, logged on Notes (review minor)
- Delete button now references the DestructiveConfirm Foundations style instead of restating its weight and border (review minor)
- Skeleton now WarmingSkeleton with shimmer (static only under Reduce Motion); expired link re-fetch has no indicator (review minor)
- ATTACH now points to the f10-mail-day-triage and f10-extraction-confirm artboards and adds OfflineNotice, InlineErrorRow and WarmingSkeleton (review minor)
- Filter chip and search placed above the drawer list, with the heading "Photographed · all drawers"; frame 04 draws the Bills drawer under the same header (review minor)
- September row now carries StatusChip "Paid" and line 2 "$109.60 · photo deleted Sat 17 Oct" (review minor)
- Specified the web 390 collapsed/expanded panel and the position of the page controls (review minor)
- Added insets for the guest drawer row and the empty filter, plus the peek content for a piece not confirmed yet (review minor)

## f10-bill-provenance
- Added the fixture delta "Sam Ortega has bill access (can add, fix, mark paid and delete bills)" to CONTENT and Notes (review minor)
- ProvenanceSheet photo-read variant now has the full contract anatomy (Authority, confirmed time, flat source caption, Close) and is logged on Notes as a proposed addition with no report control; the corrected-date sheet sentence was added and shown on frame 03 (review minor x2)
- Added the Notes handoff: web delete must write status 'canceled' (bills/page.tsx:91) (review minor, derive f10-5)
- Added the delete path for a bill whose photo was already deleted (InlineUndo "Bill deleted · Undo", or the host's confirm with its own text), artboard 07b and a Notes entry; batch plan rebalanced (review major)
- Household notification now uses the canonical brief string "Sam marked Clark PUD paid" / "Due Fri 23 Oct · Larkspur Loop" (review minor)
- Added the Sam-variant spoken label for row 1 and logged the spoken-name variant on Notes (review minor)
- Delete button now references the DestructiveConfirm Foundations style instead of restating weight 600 (review minor)
- Specified the guest host headline (no amount, no StatusChip, due line only if the host shows it to guests) and logged it on Notes (review minor)
- Added the custom accessibility action "View the photo" to row 1 (review minor)
- ATTACH Foundations list completed with BillRow, InlineErrorRow and OfflineNotice to match components used

## f10-bill-trend
- Not-enough-homes and average-never-loaded states now change the SourceCaption: the Pantopus line becomes "Pantopus · not enough homes nearby yet" or is dropped; drawn on frames 04, 09 and 18 (review major)
- Guest LockedActionRow now reads "Ask Maya to change who can see bills."; it no longer claims a member can grant access. Reasoning logged on Notes; this also resolves the minor 'Sam is a member' finding (review major + minor)
- Household SourceCaption line carries ProvenanceMark S you-added (review minor)
- The reference line's dark ink is now dark text primary with a dark raised halo, and the missing text.strong dark value is logged on Notes (review minor)
- Named the dark column steps (primary.500 past, primary.300 highlighted with a dark text primary outline) on surface.raised, replacing the open-ended Notes item (review major)
- Pantopus average line drawn with no mark; Notes propose a no-mark SourceCaption variant for computed averages instead of the filled-mark assumption (review major)
- Frame 12 split: focus on the card title at arrival, plus a focused October column inset captioned "after Tab" (review minor)
- INSTEAD OF trimmed to 8 lines: the line/area-chart point moved into LAYOUT and the 'your neighbours' line was dropped (glossary covers it) (review minor)
- Frame 13 described as a hand-entered variant and logged on Notes (review minor)
- ATTACH now references the f10-bill-provenance artboards and adds OfflineNotice

## f10-mail-snap-privacy
- Notes now propose the V2 body "Your bills, their amounts and your mail records stay; only the photos are removed." and record that a piece not confirmed yet loses its photo pane (review minor)
- Frame 13 who-row now reads "You and Sam. People nearby: None."; the generic line became a Notes template without "Members" (review minor x2)
- Reading-off notice reworded to "Reading photos is off for now…" to match a deployment without photo reading (review minor)
- Guest LockedActionRow now reads "Maya or Sam can delete these photos. Maya can change this setting.", and the owner-only assumption is on Notes (review minor)
- Zero-state "What we keep" now says the photos are gone and the confirmed bill facts stay; used on frames 08 and 09 (review major)
- Added DestructiveConfirm V2 sub-variants: unconfirmed (1 piece isn't in bills yet) on frame 06, and waiting-to-be-read on new artboard 06b; base body moved to Notes; batch plan rebalanced (review major)
- Frame 05 gets its own default-off "What we keep" value (review minor)
- Delete button now references the DestructiveConfirm Foundations style instead of restating weight 600 (review minor)
- Guest view gets its own explainer: "Maya or Sam confirms before anything is saved." (review minor)
- ATTACH points to the f10-mail-day-triage artboards and adds OfflineNotice and FreshnessLine

## f11-keeper-strip
- Count changed to FactCount V2 "14 on file" for HOME A and V3 T1 "7 on file" for PLACE B, matching Foundations 00b-07 and the place file; "11 on file" kept only as the claim-receipt count and the open item marked resolved (review major).
- Count spoken label now reads "14 on file: place, dates, money, people. Opens your place file." (review major).
- Phone layout returned to the contract's one-row KeeperStrip, with FactCount V2 as a right-aligned block at most 160pt wide and word-pill pips; the block moves below the name and line only at AX5 or 200%. Name set in bodyMedium 16/24/500. The minor fix proposing middot words or a two-row deviation note was set aside because it conflicts with this major fix; pips are stated to be word pills, never dots (review major, minor).
- Fixture delta added: HOME A pickup confirmed by Maya (You · Tuesday), so HOME A pickup lines stay unmarked, and it is listed on Notes (review major).
- Flow-06 claim-receipt hand-off added to WHERE IT LIVES; flow-06 step 13 added to the Notes open items (review major).
- Overdue landing now uses an "Already paid?" text button that opens the BillRow overflow (Mark paid · Paid a different amount · Skip this month), with InlineUndo and no household notice until Undo closes. The one-tap control and its open item were removed, and artboard 4 was updated (review major x2).
- FactCount is now permission-limited too: the guest sees "8 on file · Place · Dates · People", shown in artboard 12, with DONE WHEN extended to cover the count (review major).
- Mood-input text rewritten so it no longer contradicts itself; Fri 30 fixture now has both utility bills and water marked paid, with dated items; the 3+ line and its FourteenDayStrip landing added as an inset in artboard 4 (review minor x2).
- Calm tap target defined (scrolls to QuietDayReceipt); 14-day invitation expiry defined; briefing-kicker merge noted in WHERE IT LIVES and Notes (review minor).
- Calm line changed to "No bills or dates due in the next 7 days." and the pickup day-before rule noted (review minor).
- PLACE B strip shows only a wordless hollow ProvenanceMark with the spoken label "on record, not confirmed"; the PickupCard carries the caveat once, and the string was removed from the strip's COPY (review minor).
- Hide options reordered to "Hide for 7 days · until Mon 26 Oct" and "Hide for 31 days · until Thu 19 Nov" (review minor x2).
- Strip spoken label now includes the mood word: "Ollie, busy: ..." (review minor).
- Remove now reaches Sam's Today only after Undo closes, and Sam's menu is stated to have no Remove item (review minor).
- Notes restructured into assumptions, merges, omitted states, invented strings, replacements, resolved and open items, with the Foundations in-context string difference and the contract label example added.

## f11-keeper-naming
- iOS sheet now opens at the large detent (or a content-sized detent) with a pinned button footer and reserved scroll padding; Android and web 390 match; artboard 1 shows both buttons without scrolling (review major).
- Naming moment moved to Mon 12 Oct so it fits the fixture keeper and the strip prompt; the Mon 12 landing strip content is defined and listed as an assumption (review minor).
- Notes invented-string list completed, and the queued-write string change from the contract's "Will upload..." added as a normalisation (review minor).
- KindGlyph species-tile variant recorded as a proposed contract deviation, and the second scope line recorded as the mitigation for ScopeChip's finance-permission rule (review minor x2).
- Entry point (1) now includes "after the FirstWeekRow has gone, for at most 14 days" (review minor x2).
- THE ONE JOB changed to two taps to name and one to skip, matching DONE WHEN (review minor).
- Re-entry save hand-off defined (returns to the invoking row, which reads "Ollie · River otter" and announces the status) and drawn in artboard 14 (review minor).
- Empty-name helper for Rename and re-entry modes added: "Give it a name.", in COPY, EDGE CASES, artboard 11 and Notes (review minor).
- Artboards 1 and 2 swapped so the dense otter-picked frame leads; dark twin now references 01 (review minor).
- Body copy rewritten: "A small animal on Today that sums up what's due here." and "You can rename or remove it any time." (review minor).
- FactCount V2 added to the components used for the landing; one INSTEAD OF line added for the pinned buttons, with the confetti and guilt lines merged to stay within 8.
