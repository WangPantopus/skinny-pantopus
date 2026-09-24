# Address verification needed (the locked-action treatment)
id: f3b-locked-action-row · platforms: web/ios/android · isNew: True · artboards: 19

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Address verification needed (the locked-action treatment) · f3b-locked-action-row

TYPE: NEW. This is one LockedActionRow placed inside existing designed screens. Treat each attached host screenshot as exact: keep it, and change only the locked control and the row you add. Also replace one existing iOS chip with a caption.

ATTACH: Nearby with the "Message a neighbor" control (iOS and Android); the Place residency letter screen with its "Get a residency letter" button (web 1440); the Real Rent card on Place (web 390); the Block Founders panel on Nearby (the list-row host in frame 1); the iOS My Homes list with the current green "Household access" chip; the LockedActionRow specimen from the Foundations board.

PLATFORMS & VIEWPORTS: web 1440x900 and 390x844, iOS 393x852, Android 412x915. The row must work in a 320pt column.

WHERE IT LIVES & HOW PEOPLE ARRIVE: the row sits wherever an action needs address verification, in the tab where that action lives:
- Place: residency letter, Residency Pass, residency claims, fridge cards, Real Rent, public-record alerts.
- Nearby: neighbor messages, Block Founder rank, postcard invites, the call to join as a Founding Neighbor.
- Mail: letters to neighbors.
- Profile: the address line (the address-confirmed badge).
People don't navigate to the row; they meet it when they reach the host, and the host itself is the previous step. The row's "Verify address" link opens the "Verify this address" sheet with the matching reason (e.g. "To send neighbor messages, we need to confirm you live here."). The pending row's "Enter code" link opens the same sheet in its postcard-pending state. When verification finishes, or when the owner confirms, the host's control goes live at once.

WHO AND WHEN: Sam Ortega joined HOME A on Sat 10 Oct through Maya Chen's invitation. He is a household member who is not yet address-verified. On Mon 19 Oct at 3:40 PM he opens Nearby and taps "Message a neighbor". At 6:10 PM Maya confirms he lives there, and he sees the live control. The pending frame shows the other path, where Sam asked for a postcard on Wed 14 Oct. Jordan Lee has only PLACE B saved.

THE ONE JOB: Tell a household member why an action is unavailable and offer the way to unlock it, instead of hiding the control or failing after the tap.

FIRST FIVE SECONDS: first, the dimmed control, still in its usual place; second, the reason directly beneath it; third, the "Verify address" link. The one action is "Verify address".

CONTENT (fixture deltas only). One reason string per host, each followed by the link "Verify address":
- Neighbor messages: "Address verification needed to send neighbor messages"
- Residency letter: "Address verification needed to get a residency letter"
- Residency Pass: "Address verification needed to show your Residency Pass"
- Residency claims: "Address verification needed to claim residency for a program"
- Fridge cards: "Address verification needed to print a fridge card"
- Real Rent: "Address verification needed to share what you pay in rent"
- Public-record alerts: "Address verification needed to get alerts when this home's public records change"
- Block Founder rank: "Address verification needed to earn a Block Founder rank"
- Postcard invites: "Address verification needed to send a postcard invite"
- Founding Neighbor: "Address verification needed to join as a Founding Neighbor"
- Mail letters: "Address verification needed to send a letter to neighbors"
- Profile address line: "Address verification needed to show your address on your profile"
Other variants:
- Pending (Sam, postcard path): "Your postcard is on its way — expected by Sat 24 Oct (in 5 days)" · link "Enter code", which opens the verify sheet in its postcard-pending state. It is never a second start.
- Server disagrees, shown after a tap: "We couldn't complete that. Your address isn't verified yet." · "Verify address".
- Names who can act, with no link (a member without bill rights): "Maya can add bills here".
- Unknown reason: "Address verification needed for this" · "Verify address".
- No path for this person (the owner turned off confirmation and no other method is available), with no link: "Address verification needed to send neighbor messages. No way to verify is available for this address right now."
- Saved place only (Jordan at PLACE B), with no link: "Claim this address first". Draw no locked controls for Jordan at all.
- Result, shown once after an owner confirms: "Maya confirmed you live at Larkspur Loop".
- iOS My Homes row: before, the green "Household access" chip; after, no chip, and the row caption reads "Member · Your household" in bodySmall text.secondary.
- Worst case: the 81-character public-record alerts reason at 320pt, at AX5.

LAYOUT & VISUALIZATION:
The row is one row, at least 44pt tall:
- a 16pt lock glyph in text.secondary (3:1 or better);
- the reason in bodySmall text.secondary;
- "Verify address" as an inline link in primary.700, at the trailing edge of the first line.
Surface:
- The row has no fill and sits on the host's own surface: base under a button and in a list, raised in a card header.
- A border.subtle hairline is decoration only.
- Only the dimmed control above may fall below 4.5:1.
Dark mode: the reason in dark text secondary on dark base (dark raised in card headers), the lock glyph in dark text secondary, a dark border hairline, and the link in dark focus/link.
The row fits three host shapes with no custom variant: (1) directly beneath a disabled primary button, (2) as a row inside a list, and (3) inside a card header.
Wrapping:
- At 320pt the reason wraps to two lines before it truncates, and the link stays on the first line.
- At AX5 the link moves below the reason.
The reason always names the specific action, using the string for that host. The control stays visible and dimmed, with the row beneath it; nothing looks active while doing nothing.
Degradation:
- An unknown reason keeps the link.
- The pending state's link reads "Enter code" and opens the pending sheet.
- Offline keeps the link visible but disabled, with a reason.
- While the host loads, draw the host's skeleton and no row.

INTERACTION, MOTION & HAPTICS:
- Tapping the dimmed control always does something: it scrolls the row into view, moves focus to it and fades a 300ms highlight on it (static under Reduce Motion).
- VoiceOver reads the row when focus lands. On web the reason is also announced through a live region; on Android, through a TalkBack announcement.
- The control is exposed as dimmed but not natively disabled (aria-disabled on web, not the disabled attribute), so it stays focusable and tappable. On Android, a visible locked control never swallows a tap silently.
- "Verify address" opens the sheet with the host's reason. "Enter code" opens the sheet's pending state.
- The server-disagrees row replaces the success feedback after a tap and says what to do.
- The result line appears once, as a status above the now-live control, and clears when the person leaves the screen. Its NotificationRow twin stays in the notifications list.
- There are no haptics on the row.

FOUNDATIONS COMPONENTS USED: LockedActionRow (all variants: under a disabled CTA, as a list row, in a card header, pending with "Enter code", server disagrees, names who can act, and the saved-place variant "Claim this address first"); NotificationRow (the result twin); WarmingSkeleton (the host's own, in the loading frame); OfflineNotice.

ACCESSIBILITY:
- The dimmed control is exposed as dimmed, with the reason as its hint: "Message a neighbor, dimmed. Address verification needed to send neighbor messages."
- The link reads "Verify address, opens Verify this address". The pending link reads "Enter code, opens your postcard code".
- The lock glyph is decorative.
- The row's target is 44pt, 48dp or 44px, and each link keeps its own 44pt target.
- The result line is announced as a status.
- Nothing depends on colour: the glyph and the words carry the state.
- Focus rings look different from the highlight.
- The My Homes caption's spoken label is "Member of Larkspur Loop".

COPY: every string in CONTENT is final copy. In addition:
- Offline caption under the disabled link: "You're offline. Verifying needs a connection."
- Legacy member (verified before the change): no row, and the control is live.
- My Homes captions: "Owner · Your household", "Admin · Your household", "Member · Your household", "Guest · Access until Sun 1 Nov"; spoken label "Member of Larkspur Loop" (and so on for each role).

EDGE CASES:
- A longer localised reason wraps to two lines, or three at AX5, and never truncates the action name.
- A host with several locked controls gets one row per control, never a grouped banner.
- Legacy members keep every unlock.
- Once the person is address-verified, the row disappears and the control goes live.
- For a saved-place user, locked controls are absent, and home-only sections show "Claim this address first".
- On a slow network, the host's own loading state applies, and the row never flashes before permissions load.
- While a document or a request to Maya is pending instead of a postcard, the row reads the matching status from the verify sheet, and its link opens that pending state.

INSTEAD OF:
- Instead of hiding the control, draw it dimmed with the row beneath, because a member reads a missing control as the app being broken or the owner blocking them.
- Instead of error red, warning amber or an alert icon, draw a neutral lock row, because this is a way to unlock, not a failure.
- Instead of text.muted on a sunken fill, draw text.secondary on the host's own surface with no fill, because the reason is live text with a working link and must pass 4.5:1.
- Instead of a generic "Verification required", draw the specific action for that host, because a generic line teaches nothing.
- Instead of a verification badge on a person's name, put the explanation on the action, because badges rank the people you live with.
- Instead of a green "Household access" chip, draw the plain caption "Member · Your household", because green reads as verified and the contract allows no membership chips.
- Instead of a "Verify address" link when no path exists, draw the reason alone, because a dead link is worse than none.
- Instead of a pending row with no link, draw "Enter code", because the person whose postcard just arrived needs a way to the code field from where they met the lock.
- Instead of a natively disabled button that ignores taps, draw a dimmed control that brings the reason into focus, because a dead tap reads as broken.

DONE WHEN:
- Sam taps "Message a neighbor" and gets an explanation and a path, never an error code or a dead tap.
- The reason passes 4.5:1 in light and dark.
- The same row sits unchanged under a button, in a list and in a card header at 320pt.
- Every host has its own reason string.
- Sam's pending row offers "Enter code" and never a second start.
- After Maya confirms, Sam's control is live, and he sees who confirmed.

ARTBOARDS:
1. f3b-locked-action-row · ios · 01-three-hosts-320 · light — the dense default: the row under a disabled button (on base), in a list row (the Block Founders panel's rank row, on base) and in a card header (on raised), each 320pt wide and labelled.
2. f3b-locked-action-row · ios · 02-locked-nearby-compose · light — Sam on Nearby: "Message a neighbor" dimmed, the row beneath, and the focus highlight after a tap.
3. f3b-locked-action-row · ios · 03-address-verified-live · light — the same host after Maya confirms: the control live and the one-time result line.
4. f3b-locked-action-row · ios · 04-legacy-member-live · light — the host unchanged, with no row.
5. f3b-locked-action-row · ios · 05-pending-postcard · light — Sam's pending row with "Enter code".
6. f3b-locked-action-row · ios · 06-server-disagrees · light — the row shown after a tap.
7. f3b-locked-action-row · ios · 07-offline · light — the link disabled, with its reason.
8. f3b-locked-action-row · ios · 08-host-loading · light — the Nearby host skeleton, with no row until permissions load.
9. f3b-locked-action-row · ios · 09-variant-sheet · light — names who can act, unknown reason, no path, and "Claim this address first" at PLACE B.
10. f3b-locked-action-row · ios · 10-reason-strings-all-hosts · light — all twelve host reason rows stacked at 320pt, each labelled with its tab and host.
11. f3b-locked-action-row · ios · 11-my-homes-caption-before-after · light — the green "Household access" chip beside the chipless row captioned "Member · Your household".
12. f3b-locked-action-row · android · 12-locked-nearby-compose · light — the Android host; the tap lands on the row, and the reason is announced.
13. f3b-locked-action-row · web-1440 · 13-residency-letter-disabled-button · light — the row under the dimmed "Get a residency letter" button.
14. f3b-locked-action-row · web-390 · 14-real-rent-card-header · light — the row in the Real Rent card header, on raised.
15. f3b-locked-action-row · ios · 15-three-hosts-ax5 · light — AX5 text with the public-record alerts reason, wrapping, the link below the reason.
16. f3b-locked-action-row · ios · 16-three-hosts-greyscale · light — frame 1 in greyscale.
17. f3b-locked-action-row · ios · 17-three-hosts · dark — the dark twin of frame 1: the reason in dark text secondary, the link in dark focus/link.
18. f3b-locked-action-row · ios · 18-locked-nearby-compose · dark — the dark twin of frame 2.
19. f3b-locked-action-row · web-1440 · 19-notes · light — Notes, listing:
- the full host list per tab, with its reason string;
- the release rule: ship this row in the same release as the verification-source migration, or household members get a mystery week of vanished or failing controls;
- that the dimmed-control-plus-row form, which the contract and research allow, replaces the "in place of the control" wording in both the inventory and the flow's step 12; the Android silent no-op is prevented because the dimmed control stays tappable and brings the reason into focus;
- that bringing the row into focus is how the dimmed control "opens the same reason";
- that the row uses the contract's text.secondary-on-base option, with no sunken fill;
- the contract change to the pending variant: the string "Your postcard is on its way — expected by Sat 24 Oct (in 5 days)" and the link "Enter code" (the contract has no link);
- the My Homes caption for every role, in place of any chip;
- the assumption that an owner-level setting to turn off confirmation exists, with no designed surface yet;
- the assumption that the gated Mail action is sending letters to neighbors (confirm the scope of the mail compose gate);
- every invented or changed string: the ten reason strings not taken from the design doc (residency letter, Residency Pass, residency claims, fridge cards, Real Rent, public-record alerts, Block Founder rank, postcard invites, Founding Neighbor, Mail letters, Profile address line; residency letter, Real Rent and Block Founder rank were reworded from v1 to follow the GrantLimitList verbs), "Maya can add bills here", the no-path sentence, the pending string, "Enter code", the server-disagrees line, the offline caption, the My Homes captions and labels, and 3:40 PM;
- omitted states.

BATCH PLAN: Turn 1: 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19.
