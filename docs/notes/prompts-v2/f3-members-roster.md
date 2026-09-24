# Members roster
id: f3-members-roster · platforms: web/ios/android · isNew: False · artboards: 24

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Members roster · f3-members-roster

TYPE: EXTENSION of the existing designed screen "Members" (the home's Members & Security tab). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
- Web must have exactly one members screen. The standalone members page and the dashboard's Members & Security tab become the same surface, so draw it once, as the tab. Keep the tab's security content below the roster unchanged.
- The old web "Add guest" form page (/members/add-guest) is deleted, because it showed a success message without sending anything. Do not draw it anywhere.

ATTACH:
- The current Members screen on iOS, Android and web 1440. On web this is the Members & Security tab, with the home header tabs Dashboard · Calendar · Share · Members & Security · Settings. The Calendar tab comes from the household calendar surface.
- The home's Share page (guest passes) on web.
- The existing native guest-pass screens on iOS and Android.
- The place file's People section on iOS.
- The Foundations board from prompt 00.

PLATFORMS & VIEWPORTS: iOS 393x852 (primary), Android 412x915, web 1440x900 (left sidebar) and 390x844 (bottom tab bar).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → place file for Larkspur Loop → People → Members. On web the page is /app/homes/{id}/members, and it shows the same surface as the dashboard tab.

Entry points:
- The home dashboard Members card and Members & Security tab.
- The place file's People rows.
- The household block ("Who lives here with you?"), once someone has joined.
- The member count on the home dashboard's Today card.
- The Invite composer's sent panel, which returns here with the new Pending row.
- The sender banner "2 invitations need to be sent again · Fix", which lands here scrolled to the Pending group, with a highlight that fades once. With only one dead invitation, Fix skips this screen and opens the composer's reissue review.
- Deep links /app/homes/{id}/members and their native equivalents.

The recipient banner "You have 2 invitations" does not come here. It opens the "Invitations waiting for you" list on Your places.

Where people go next:
- Invite and "Invite someone" open the Invite composer.
- A row's Reissue opens the Invite composer on its reissue review.
- "Guest passes" opens the home's Share page on web, and the existing native guest-pass screen on iOS and Android.

WHO AND WHEN: Mon 19 Oct, 6:10 PM.
- Maya Chen owns 2418 NE Larkspur Loop. At 5:10 PM she sent an invitation to priya@example.com. She opens Members to check that it is really pending, and finds two older invitations that stopped working when the household's invite rules changed on Wed 14 Oct.
- Sam Ortega, a member, opens the same screen on his phone to see who lives there.

THE ONE JOB: Let everyone in the household see who lives here, and let the people who manage the home fix each invitation in one tap per row.

FIRST FIVE SECONDS: The eye should land on these, in order:
1. The role groups, each with its people.
2. The quieter Pending group below them. A "Needs reissue" row stands out by its glyph and its words.
3. "Invite", alone in the header. It is the one primary action.
A member sees no Invite button. In its place is a line naming who can invite.

CONTENT: Use the FIXTURES. The deltas below are for this surface only; list each one on Notes.

Person rows:
- A person row carries only a MemberRow caption: "joined {date}" or "access until {date}".
- Maya Chen (you) · Owner · joined Thu 1 Oct 2026.
- Sam Ortega · Member · joined Sat 10 Oct 2026.

Person detail lines (method and date, shown in the detail sheet only):
- Maya: "Address confirmed by postcard · Thu 8 Oct 2026".
- Sam, before he is confirmed: "Joined by Maya Chen's invitation · Sat 10 Oct 2026".
- Sam, after Maya confirms: "Confirmed by Maya Chen · Mon 19 Oct 2026".
- Jordan Park, a legacy case whose method is unknown: "Added before the household rules changed on Wed 14 Oct 2026 · Nothing is locked for Jordan". Legacy people keep every unlock they had.
- Noor Haddad: "Joined by Maya Chen's invitation · Tue 13 Oct 2026".

Dense worst case (frame 1):
- OWNER: Maya Chen (you).
- ADMINS: Jordan Park, joined Fri 2 Oct 2026.
- MEMBERS: Sam Ortega; Noor Haddad, joined Tue 13 Oct 2026; Theodora Vasquez-Whitlock, joined Wed 14 Oct 2026.
- GUESTS: Lena Ortega, access until Sun 1 Nov 2026.
- PENDING, 5 rows:
  - priya@example.com · "Member · sent Mon 19 Oct · Expires in 7 days · Mon 26 Oct" · Resend.
  - Invite link · "Works once · Expires in 7 days · Mon 26 Oct" · Turn off link.
  - margaret.oconnor-whitfield@example.com (38 characters) · "Member · sent Sat 17 Oct · Expires in 5 days · Sat 24 Oct" · Resend.
  - theo.park@example.com · "Member · sent Mon 12 Oct" · needs reissue.
  - @rgarcia · "Member · sent Tue 13 Oct" · needs reissue.

Pending-state rows (frame 3 only):
- theo.park@example.com: needs reissue.
- @rgarcia: just reissued, "Sent again · The old link no longer works · Expires in 7 days · Mon 26 Oct".
- nina.cho@example.com: "Member · sent Tue 13 Oct · Expires tomorrow · Tue 20 Oct".
- ben.alvarez@example.com: "Member · Expired Sun 18 Oct" · Resend.
- kai.brooks@example.com: StatusChip "Declined · Thu 15 Oct" · Remove.
- Ana Ruiz, who joined by link: caption "Waiting for your OK" · Approve / Remove.
- priya@example.com: mid-resend, "Sending…", with the "then" frame showing the caption ending " · Sent".

Offline: "You're offline · as of 5:52 PM".

LAYOUT & VISUALIZATION: Keep the host's list layout.

Role groups:
- Order: OWNER, ADMINS, MEMBERS, GUESTS, each as a MemberRow group heading.
- Under ADMINS, MEMBERS and GUESTS, draw the MemberRow group disclosure: a 44pt / 48dp row with a chevron, reading "What can admins do?", "What can members do?" or "What can guests do?".
- OWNER has no disclosure.
- Each disclosure expands in place into a GrantLimitList of verbs, not a permission matrix.
- Under each heading, draw one MemberRow per person.
- At the foot of the GUESTS group only, draw a quiet text action, "Guest passes". Visitor, guest and service passes live behind it.

No verification on person rows:
- Use MemberRow without its own-row method caption (⑧) on every row, including "Maya Chen (you)".
- Draw no chip, badge, tick or colour for how someone was verified.
- Verification text appears in exactly two places: in the person detail sheet, as method and date; and as a LockedActionRow on an action the viewer cannot use yet.

Pending group (managers only):
- Draw it last, using InviteRow. It is quieter than the people.
- A caption sits at the top: "Only you and admins see this." For an admin viewer: "Only Maya Chen and admins see this."
- A "Needs reissue" row uses InviteRow's needs-reissue variant: the warning glyph, "Needs reissue — your household's invite rules changed" in text.primary, and a trailing "Reissue". Its last line has no expiry, because a dead link has no meaningful expiry (proposal on Notes).
- An expired row states its date in words and offers Resend.
- Ana's awaiting-approval row uses InviteRow's awaiting-approval variant. Add one caption line under it: "Ana sees no household data until you approve."

The roster is a list only; it has no chart. When data is missing:
- A cold load that takes over 1s shows WarmingSkeleton rows that keep the group structure.
- Cached data shows FreshnessLine.
- A person with no join date shows only the role.
- If the pending invitations fail to load while the people load, the Pending slot holds an InlineErrorRow, "We couldn't load pending invitations. · Retry". The people groups stay live.

INTERACTION, MOTION & HAPTICS:

Person detail:
- Tapping a person row opens the person detail sheet, with a visible Close. It shows the name, role, join date and the verification line (method and date).
- When Maya views Sam, the detail also offers "Confirm this person lives here". It opens the owner-attestation sheet in place of the detail sheet; sheets never stack. On return, Sam's detail reads "Confirmed by Maya Chen · Mon 19 Oct 2026".
- In Sam's own detail, "Verify address" on the LockedActionRow opens the Verify this address sheet in place of the detail sheet.

Row overflow:
- On other people's rows: Change role, Confirm this person lives here, Remove from Larkspur Loop.
- On the viewer's own row: only "Leave Larkspur Loop".
- Every overflow action is also a screen-reader custom action.

Change role:
- The sheet "Change Sam Ortega's role" has radio rows for Admin, Member and Guest, and two short columns, "Member can" and "Admin can also".
- Choosing Guest reveals an "Access until" date row, with the platform date picker and typed entry.
- Draw an "Owner" radio row, and mark it "(if supported)" on Notes; it depends on whether the backend supports transferring ownership.
- The change applies on "Save role". The row updates in place with InlineUndo "Sam is now an admin · Undo". The household notice waits until the Undo closes.

Roles:
- A new household Guest is added through Invite → Guest chip.
- An existing person becomes a Guest through Change role.

Leave and Remove:
- Leave uses DestructiveConfirm's Leave-home variant.
- Remove uses a proposed DestructiveConfirm Remove variant with the same two-list shape.
- After Leave, Sam lands on his Place tab with "You left Larkspur Loop."

Pending rows:
- Resend sends in place. It shows "Sending…" with its spinner, then the caption gains " · Sent", which is spoken as "Invitation resent". The row stays where it is.
- Reissue opens the Invite composer on its reissue review. It replaces this screen's sheet context and does not stack. After the send, the row back here reads "Sent again · The old link no longer works · Expires in 7 days · Mon 26 Oct".
- The overflow holds Cancel invitation and Extend. Draw Extend in the frame 3 overflow and mark it "(if supported)" on Notes.
- Turn off link and Cancel invitation collapse the row to InlineUndo: "Link turned off · Undo" or "Invitation cancelled · Undo". Both take effect only when the Undo closes (when Maya leaves the screen). The recipient's side changes only then.
- Approve collapses Ana's row to InlineUndo "Ana Ruiz added · Undo" and shows her under MEMBERS. The join notice to other members is sent only after the Undo closes.
- Remove on a declined row uses InlineUndo "Invitation removed · Undo".
- No action uses a timer.
- When an invitee accepts, their pending row cross-fades out and the person appears in their role group, with no status chip.

Motion:
- Rows insert and leave with cross-fades of 300ms or less.
- The deep-link highlight fades once.
- Under Reduce Motion, both are static.

Haptics: one light tick when Approve, Resend or Save role is confirmed, and nothing else.

FOUNDATIONS COMPONENTS USED:
- MemberRow: owner, admin, member, guest, you and empty variants, with no ⑧ on any row (override on Notes).
- InviteRow: pending-email, pending-username, expiring, needs-reissue, declined, link-active and awaiting-approval variants; sending and offline states. The expired row is a proposed date variant (Notes).
- GrantLimitList: the role disclosures and the change-role columns.
- LockedActionRow: the verification variant in Sam's own detail, and the names-who-can-act variant for members and legacy roles.
- StatusChip: "Declined · Thu 15 Oct" only.
- DestructiveConfirm: the Leave-home variant, plus the proposed Remove variant.
- InlineUndo.
- WarmingSkeleton: row skeletons.
- FreshnessLine.
- OfflineNotice.
- InlineErrorRow: the whole-roster load error, the pending-only error and the resend error.

ACCESSIBILITY:
- Reading order: header; Invite (or the line naming who can invite); each group heading and its disclosure; the people; Guest passes; then Pending.
- Each row is one element with a merged label, for example "Sam Ortega, member, joined Saturday 10 October 2026. Actions available." Row actions are custom actions.
- Avatars are decorative.
- Resend, Reissue, Approve, Remove, Guest passes, each disclosure and each overflow get 44pt / 48dp / 44px hit areas, even when they look like text.
- Expiring, expired and needs-reissue states are stated in words, never by glyph or colour alone.
- These are polite status messages: "Sending", "Invitation resent", "Link turned off", "Invitation cancelled" and "You're offline".
- The deep-link highlight also moves accessibility focus to the first needs-reissue row.
- At AX5: captions wrap under names; the overflow stays top-trailing; group headings wrap; Approve and Remove stack.

COPY:

Header and roster:
- Header "Members" · button "Invite".
- Foot of the GUESTS group: "Guest passes".
- Line shown to members (dense household): "Maya Chen or Jordan Park can invite people here." With no admin: "Maya Chen can invite people here."

Disclosures:
- Members: "Sees and edits the calendar" · "Sees bills and who paid" · "Sees who lives here".
- Admins: "Everything a member can do, plus:" · "Invites people and resends invitations" · "Removes people and changes roles" · "Adds bills and marks them paid".
- Guests: "Same as Member until their access ends".

Pending:
- Group captions: "Only you and admins see this." / "Only Maya Chen and admins see this."
- Awaiting approval: "Waiting for your OK" · "Ana sees no household data until you approve." · "Approve" · "Remove".
- Row undo lines: "Link turned off · Undo" · "Invitation cancelled · Undo" · "Ana Ruiz added · Undo" · "Invitation removed · Undo".

Empty state: "Just you at Larkspur Loop · Invite someone". The header Invite is hidden, so "Invite someone" is the one action.

Sam's own detail: LockedActionRow "Address verification needed to message your neighbors · Verify address".

Change role sheet: title "Change Sam Ortega's role" · "Admin" · "Member" · "Guest" · "Owner" · "Member can" · "Admin can also" · "Access until" · "Save role" · "Close" · undo "Sam is now an admin · Undo".

Leave sheet (DestructiveConfirm Leave-home variant, verbatim):
- Title "Leave Larkspur Loop?"
- "What goes": "The household calendar and bills" · "Household activity notifications" · "Your access to this home's place file".
- "What stays": "Dates you added that are Only you" · "Your saved places" · "Bills you marked paid still show 'Sam (no longer here)'".
- Buttons "Leave this home" / "Stay in this home".
- Done state: "You left Larkspur Loop."

Sole owner, on their own row: "Make someone else an owner before you leave."

Remove sheet (proposed variant):
- Title "Remove Sam Ortega from Larkspur Loop?"
- "What goes": "The household calendar, bills and tasks here".
- "What stays": "Bills Sam marked paid keep the note 'Sam (no longer here)'".
- Buttons "Remove Sam" / "Keep Sam".

Access ended (revoked): "Your access to Larkspur Loop ended." · "Your saved places and private dates are still yours." · "Go to Your places".

Legacy role without list access: "You can't see who lives here yet" · "Maya Chen can let you see who lives here." · "Close".

Errors:
- "We couldn't load who lives here. · Retry"
- "We couldn't load pending invitations. · Retry"
- "We couldn't resend to priya@example.com. · Retry"

Offline reasons:
- Under the header Invite: "Inviting needs a connection."
- On pending rows, each reason names its action: "You're offline. You can resend when you're back." (likewise reissue, turn off the link, approve and remove this).
- Pending overflow: "You're offline. You can change this invite when you're back."
- Person-row menu: "You're offline. You can manage people when you're back."
- Own-row menu: "You're offline. You can leave when you're back."

EDGE CASES:
- The 38-character email and the long name wrap to two lines. They are never truncated before the @.
- With 6 people and 5 pending rows, every group keeps its heading and the page scrolls.
- The sole owner's own row has no Leave. It shows the sole-owner line, with no action unless ownership transfer is supported (product question on Notes).
- On Lena's end date, her row leaves the roster by itself. Other members get the quiet row "Lena's guest access ended", drawn on the household notifications surface.
- When someone joins, every member sees it. Pending stays visible to managers only.
- A member (Sam) sees no Pending group, no Invite, no role editing and no overflow on other people's rows.
- Revoked access gets the access-ended frame. A legacy role that simply lacks list access gets the permission-denied frame instead; its access has not ended.
- On a slow network, rows slower than 1s show skeletons. There is no full-page spinner.
- If only the pending list fails, the people stay readable and the Pending slot holds its own Retry.
- Offline: the cached roster stays readable, and each action is disabled with its own reason.

INSTEAD OF:
- Instead of "Address-verified" or "Household member" chips beside names, or the method caption under your own name, draw plain rows with only a joined or access-until caption, and put method and date in the detail — because badging housemates reads as a ranking of the people you live with.
- Instead of carrying over the iOS My Homes green "Household access" chip, draw nothing on the row — because that chip claims a verified status the member does not have.
- Instead of "Add guest" opening a form that shows a success message, draw a quiet "Guest passes" text action at the foot of GUESTS that opens the working pass screen — because the old form never sent anything.
- Instead of a disabled Invite button for members, draw the line naming who can invite — because a member can never invite, so name who can.
- Instead of a Resend on declined invitations, draw "Declined · Thu 15 Oct" with Remove only — so the sender is not prompted to nag.
- Instead of reissuing silently inside the row, draw Reissue opening the composer's review — because the invite rules changed, and the sender must see what the new invitation grants.
- Instead of a per-person permission grid, draw coarse roles with a verb disclosure — because permission matrices lose members who are not experts.
- Instead of a full-page error when only the invitations fail, draw the Retry row in the Pending slot — because the people list still loaded.

DONE WHEN:
- An invited member can see who lives here.
- Maya can find a dead invitation and reach its reissue in one tap per row. The row then states that the old link no longer works, and gives the new expiry.
- After sending, Maya sees a pending row with "Expires in 7 days · Mon 26 Oct" and Resend.
- An accepted invitee appears in their group with no status chip, and their pending row is gone.
- No person row, including Maya's own, shows a verification chip or caption.
- No control is visible but inert.
- The Leave sheet names what goes and what stays.
- Every frame reads correctly in greyscale.

ARTBOARDS:
1. f3-members-roster · ios · 01-owner-dense · light — the worst case: all four role groups with 6 people, Guest passes and 5 pending rows. No ⑧ caption under Maya.
2. f3-members-roster · ios · 02-member-view · light — Sam's view of the dense roster: no Pending group, no Invite, and "Maya Chen or Jordan Park can invite people here."
3. f3-members-roster · ios · 03-pending-states · light — needs reissue, just reissued, expiring, expired, declined, waiting for your OK, and one row at "Sending…" with its " · Sent" then-frame. The overflow is open, showing Cancel invitation and Extend.
4. f3-members-roster · ios · 04-person-detail-owner · light — three sheets side by side: Sam's detail as Maya sees it (method and date, Confirm this person lives here); Sam's detail after Maya confirms; Jordan Park's legacy detail.
5. f3-members-roster · ios · 05-own-detail-locked · light — Sam's own detail with the verification LockedActionRow.
6. f3-members-roster · ios · 06-change-role-sheet · light — the title, the radio rows with Guest selected, the Access until row, the two capability columns, Save role and Close.
7. f3-members-roster · ios · 07-leave-sheet · light — Sam leaving: the What goes and What stays lists, with Leave this home and Stay in this home.
8. f3-members-roster · ios · 08-left-done · light — Sam's Place tab with "You left Larkspur Loop."
9. f3-members-roster · ios · 09-remove-sheet · light — Maya removing Sam, using the proposed Remove variant.
10. f3-members-roster · ios · 10-empty-just-you · light — "Just you at Larkspur Loop · Invite someone", with no header Invite.
11. f3-members-roster · ios · 11-loading · light — skeleton rows that keep the groups.
12. f3-members-roster · ios · 12-error · light — the whole-roster load error with Retry.
13. f3-members-roster · ios · 13-pending-error · light — the people groups loaded; the Pending slot holds "We couldn't load pending invitations. · Retry".
14. f3-members-roster · ios · 14-offline · light — the cached roster with FreshnessLine; each action disabled with its own reason; one row menu open.
15. f3-members-roster · ios · 15-access-ended · light — revoked access.
16. f3-members-roster · ios · 16-permission-denied · light — a legacy role: the reason and who can act.
17. f3-members-roster · android · 01-owner-dense · light — the Material 3 version of frame 1.
18. f3-members-roster · web-1440 · 01-owner-dense · light — the single Members & Security tab, under header tabs that include Calendar.
19. f3-members-roster · web-390 · 03-pending-states · light — frame 3 at 390.
20. f3-members-roster · ios · 17-ax5 · light — frame 1 at AX5.
21. f3-members-roster · ios · 18-greyscale · light — frame 3 in greyscale.
22. f3-members-roster · ios · 01-owner-dense · dark — the dark twin of frame 1.
23. f3-members-roster · ios · 03-pending-states · dark — the dark twin of frame 3.
24. f3-members-roster · ios · 99-Notes · light — the Notes artboard. Include:
  - Assumptions: the invite rules changed on Wed 14 Oct 2026; admins can invite, remove people, change roles and add bills.
  - Every invented string: Jordan Park, Noor Haddad, Theodora Vasquez-Whitlock, Lena Ortega, Ana Ruiz, nina.cho@example.com, and the other emails above; the four detail lines; the admin and guest disclosure strings and the "Everything a member can do, plus:" lead-in; the Remove sheet lists; the undo lines; "We couldn't load pending invitations. · Retry"; "Ana sees no household data until you approve."
  - Deliberate override of the Foundations MemberRow owner variant (⑧), per the contract rule "never on names". The board and its in-context crop should adopt it.
  - Proposed changes to the Foundations board:
    - The Remove sheet as a new DestructiveConfirm variant.
    - Adding "tasks" to the Leave sheet's What goes item.
    - The expired InviteRow as a date variant.
    - No expiry on needs-reissue rows until they are reissued.
    - The "Sent again · The old link no longer works…" reissued state.
    - The approval-line caption under Ana's row.
  - Not adopted: the reviewer's alternative resend result "Sent again · Expires…". The board's " · Sent" is used.
  - Web: the Calendar header tab from the household calendar surface appears in frame 18. The dashboard's guest quick action also points to the Share page.
  - Product questions:
    - Extend, and ownership transfer with sole-owner leave (both "(if supported)").
    - Single-use link vs owner approval. The Works-once row and the approval row are alternative backends, shown together only for coverage.
    - Whether a household Guest differs from a Share guest pass.
    - Whether the native guest-pass form on Android actually issues a pass.
    - The shared member grant string leaves out tasks, which members already have.
  - Omitted states.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: 7-12, then wait for "continue". Turn 3: 13-18, then wait for "continue". Turn 4: 19-24.
