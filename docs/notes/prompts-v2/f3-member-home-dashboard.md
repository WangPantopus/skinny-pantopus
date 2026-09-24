# Home dashboard, member view
id: f3-member-home-dashboard · platforms: web/ios/android · isNew: False · artboards: 16

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Home dashboard, member view · f3-member-home-dashboard

TYPE: EXTENSION of the existing designed screen "Home dashboard". This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: (1) Home dashboard, owner view, on iOS, Android and web-1440, showing all six cards in their current order and the web home header tabs. (2) The Foundations board rows for LockedActionRow, MemberRow, InviteRow, BillRow, DateRow, ProvenanceMark and KeeperStrip. (3) Invitation decision, accepted frame (the previous step).

PLATFORMS & VIEWPORTS: iOS 393x852 · Android 412x915 · web 390x844 and 1440x900.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab → Your place file → "Larkspur Loop" → Home dashboard. Web URL: /app/homes/:id/dashboard.
Ways in:
- "Open Home" on the accepted invitation screen (flow 04, step 8 → 10).
- The home row in Your places.
- Household notifications whose object has no page of its own. Notifications that have their own target (a bill, a calendar event) never land here.
What arrives: Sam, a member since Sat 10 Oct, opening the home for the first time since joining day. This screen does not repeat Today's one-time notice about which address Today uses; that notice appears on his first Today open, which may come before or after this screen.
Next steps: "Open calendar" goes to the household calendar (flow 04, step 11). "View" on Bills goes to the bills list. "Verify address" on a verification row opens the verify sheet with its reason (step 13).

WHO AND WHEN: Sam Ortega, a member of HOME A. Maya Chen is the owner; her own address was confirmed by postcard before TODAY. It is Mon 19 Oct 2026, 6:10 PM. Sam joined on Sat 10 Oct through Maya's invitation, went straight to Today that day, and now opens the home dashboard for the first time since joining day to see what he can do.

THE ONE JOB: Give a co-resident a useful, readable dashboard without manage rights, where every limit says who can act.

FIRST FIVE SECONDS: In the screenshot's card order, the eye lands first on the Today card ("2 people live here", "Recycling and garbage tomorrow"), then the Calendar card, then the Bills card total. The primary action is the Calendar card's "Open calendar" link.

CONTENT: After this change, members see the member list, the calendar (read and edit) and bills (read only). They could already read and edit tasks. So Members, Calendar and Bills appear for members for the first time. Keep the six cards in the screenshot's order, and do not re-rank them for members.
- Header: ScopeChip "Your household". Use the named form "Larkspur Loop · Your household" only when the viewer belongs to two homes.
- Today card: the member count now shows "2 people live here" (it used to be blank for members). Pickup line: "Recycling and garbage tomorrow". Under the pickup line, add KeeperStrip permission-limited: name "Ollie", mood word "On it", mood line "Recycling and garbage tomorrow." The mood uses only facts Sam may see.
- Members card: heading "2 people live here". MemberRows "Maya Chen · Owner · joined Thu 1 Oct" and "Sam Ortega · You · joined Sat 10 Oct". In the owner view only, add the InviteRow: recipient "priya@example.com", caption "Member · sent Mon 12 Oct · Expires Mon 26 Oct", inline "Resend".
- Calendar card: under the card header, print the legend once, as one caption line. Owner view: "● Official · ○ On record, not confirmed · ✓ You added this". Member view: "● Official · ○ On record, not confirmed · ✓ Added by your household". Then show three DateRows from the household calendar, which is now the only calendar:
  - "Recycling and garbage", line 2 "Tomorrow · Waste Connections · city schedule", with the hollow mark (the pickup day is on record, not confirmed, in both views).
  - "Maya's parents visiting", line 2 "in 3 days · Thu 22 Oct", with the tick mark. Sam's view adds the first-occurrence words "Added by Maya" to line 2: "in 3 days · Thu 22 Oct · Added by Maya". Maya's view shows "in 3 days · Thu 22 Oct · You added this".
  - "Online or mail voter registration must arrive by Mon 26 Oct", line 2 "in 7 days · Mon 26 Oct · Washington Secretary of State · statewide · 2026", with the filled mark and the "Statewide — WA" coverage chip in ScopeChip geometry. In Sam's view the row is in its default state. In Maya's view (frame 11) it is in the DateRow done state: line 2 reads "You marked this done · in 7 days · Mon 26 Oct · Washington Secretary of State · statewide · 2026", with the caption "Only you will see this." below; keep the "Statewide — WA" chip. Sam's view never shows Maya's done state.
  Delete the old, separate 7-day household calendar that used to sit in this card.
- Bills card: header "3 upcoming · $306.17 through Mon 2 Nov", with the caption "Everyone at Larkspur Loop can see these". BillRows, each carrying the StatusChip "Upcoming": "Clark Public Utilities · Upcoming · $142.18" with line 2 "due Fri 23 Oct", and "City of Vancouver water · Upcoming · $84.00" with line 2 "due Wed 28 Oct". The third bill, Comcast $79.99 due Mon 2 Nov, is counted in the header and reached through "View". Totals count only the bills the household can see. A bill set to Only me is never counted on a member's card. This fixture has none, so both views show $306.17.
- Tasks card: "2 open", with the row "Change furnace filter · due Sat 24 Oct".
- Documents & Security card: keep its existing content.
- Revoked copy: "Your access to Larkspur Loop ended." / "Your saved places and private dates stay with you." / button "Go to your places".
- Worst case: all six cards at AX5, with the Documents & Security card holding two stacked locked rows and the Bills card showing a partial error (frame 12).

LAYOUT & VISUALIZATION: Define ONE member treatment and apply it to every card. The header, body and density stay pixel-identical to the owner's card. Only the footer action row changes (and, on the Calendar card, the third legend item).
- Cards where the member lacks the action (Members, Bills, Documents & Security): the owner's control cluster is replaced, in the same row, by a LockedActionRow in its names-who-can-act variant, with a quiet "View" right-aligned. The rows read "Maya can invite people here", "Maya can add bills and mark them paid here" and "Maya can manage documents and security here", with no trailing period. They have no link.
- Cards where the member holds the action: the footer is identical to the owner's. Calendar: "Add an event" as a text button and "Open calendar" as the right-aligned link; neither is filled. Tasks: "Add a task · View".
- The owner's Bills footer is "Add a bill · View". Mark paid lives on the bill itself, never on a dashboard card.
- Draw no floating action button in either view. The owner's invite lives in the Members card footer.
- Frame 02 puts the owner and member versions of the Members and Bills cards side by side, so the difference is visibly one row.
- Keep the identity.home accent the screenshot already uses.
- A control a member can see is either live, or absent and replaced by a LockedActionRow stating the reason. It is never visible and dead.
- Verification: household members see no "Verify this address" banner at the top. Address verification appears only on the actions that need it. The Documents & Security card shows "Address verification needed to get a residency letter · Verify address". The Today card's neighbor-message action shows "Address verification needed to send neighbor messages · Verify address".
- On web, keep the home header tabs from the screenshot and insert "Calendar" directly after "Dashboard". Dashboard stays selected.
- Degraded states: a card whose data failed keeps its frame and shows an InlineErrorRow. A card the viewer may not see is absent, with no ghost card.

INTERACTION, MOTION & HAPTICS:
- Each card header and each "View" opens that card's full screen.
- Only the two address-verification rows (residency letter, neighbor messages) are interactive. Tapping one, or its "Verify address", opens the verify sheet with that reason, which offers "Ask Maya Chen to confirm · Usually same day".
- The names-who-can-act rows are information, not buttons. Their only action is the quiet "View" beside them.
- Tapping a DateRow opens that date. Tapping a BillRow opens the bill. The marks are never their own targets.
- If Sam's role changes during the session, the footers re-render in place with no layout jump, and the app announces "You're now an admin at Larkspur Loop."
- If access is revoked, one calm panel replaces the cards and the cached household data is removed.
- Motion is limited to 200ms cross-fades. With Reduce Motion, content swaps with no movement.
- There are no haptics on this screen and no gesture-only actions.

FOUNDATIONS COMPONENTS USED: LockedActionRow (names who can act; under a card; offline) · MemberRow (owner, member, you) · InviteRow (pending, owner view only) · BillRow (member; the list header states scope and total) · StatusChip ("Upcoming") · DateRow (pickup, deadline, home event, done) · ProvenanceMark · ScopeChip ("Your household" in the header; the "Statewide — WA" coverage chip in its geometry on the voter row; the sentence "Only you will see this.") · KeeperStrip (permission-limited) · WarmingSkeleton (card-shaped) · InlineErrorRow · FreshnessLine · OfflineNotice.

ACCESSIBILITY:
- Reading order: the header and ScopeChip, then the cards in visual order. Each card reads as one group: heading, content, footer.
- Locked footers read as, for example, "Maya can add bills and mark them paid here. View bills."
- Polite live regions: the role change, revoked access and "You're offline".
- Merged BillRow label: "Clark Public Utilities, 142 dollars 18 cents, due Friday October 23, upcoming."
- Mark names are appended to row labels: "Recycling and garbage, tomorrow, Waste Connections, on record, not confirmed"; "Maya's parents visiting, in 3 days, Thursday October 22, added by Maya" (Sam) or "…, you added this" (Maya); "…, official, statewide".
- Targets: 44pt, 48dp or 44px.
- At AX5, footers stack with "View" under the reason, the legend wraps, and nothing is cut off.
- Lock and tick glyphs always sit next to words.

COPY: The strings above, plus:
- Error: "We couldn't load Larkspur Loop just now · Retry".
- Partial error: "We couldn't load bills just now · Retry bills".
- Offline: "You're offline · as of 6:04 PM" and "Adding needs a connection."
- Loading shows no text.

EDGE CASES:
- A long home label, such as "Larkspur Loop · Your household" in the two-home case, wraps instead of being cut off.
- Eight people: "8 people live here", with the first three rows and "View".
- 14 upcoming bills: "14 upcoming · $2,418.60 through Mon 30 Nov".
- No bills: "Checked — no upcoming bills".
- An owner with one Only-me bill: her total includes it; Sam's does not.
- A guest who cannot see bills: the Bills card is absent.
- Slow network: show skeletons only after 1s.
- Offline: cached cards stay, and "Add an event" and "Add a task" are disabled and keep their reason.
- Access revoked while a sheet is open: the sheet closes first.

INSTEAD OF:
- Instead of a different read-only look per card, draw one footer rule applied six times, because consistency teaches the rule once.
- Instead of hiding Members, Calendar or Bills from members, draw them in full, because seeing them is the point of the change.
- Instead of a greyed manage button with no reason, draw the LockedActionRow naming Maya, because a silent dead tap reads as a broken app.
- Instead of a "Request access" flow or a verify link on the names-who-can-act rows, draw only Maya's name, because no such flow exists and verifying never grants manage rights.
- Instead of "Mark paid" on the Bills card, draw "View", because a mis-tap there would notify the whole household.
- Instead of a verify banner at the top for Sam, draw locked rows on the two actions that need it, because he just joined and is not missing a setup step.
- Instead of provenance marks with no words, print the legend once under the Calendar card header, because a mark without its word says nothing.
- Instead of "✓ You added this" in Sam's legend, draw "✓ Added by your household" plus "Added by Maya" on the row, because Sam did not add Maya's entries.

DONE WHEN: Sam can see who lives here, read and add to the calendar, and read the bills without asking Maya. Every limit names Maya, and only the verification limits offer a next step. The owner and member cards differ by exactly one row (plus the legend's third word). No card shows a visible control that does nothing. Every legend word is true for the person reading it, and the pickup mark matches Today (hollow). The revoked frame says what he keeps. All of this reads in greyscale and at AX5.

ARTBOARDS:
1. f3-member-home-dashboard · ios · 01-member-view · light — Sam's six cards, with the KeeperStrip, the locked footers, the live Calendar and Tasks footers, the member legend and the hollow pickup row.
2. f3-member-home-dashboard · web-1440 · 02-owner-vs-member · light — the owner and member Members and Bills cards side by side, with the differing row annotated. The header tabs show Calendar after Dashboard.
3. f3-member-home-dashboard · ios · 03-verification-locked · light — the residency-letter and neighbor-message LockedActionRows, annotated as the only rows that open the verify sheet.
4. f3-member-home-dashboard · ios · 04-access-revoked · light — the calm panel with "Go to your places".
5. f3-member-home-dashboard · ios · 05-role-changed · light — the footers now showing owner-level controls, with the announcement line.
6. f3-member-home-dashboard · ios · 06-loading · light — card-shaped skeletons in place.
7. f3-member-home-dashboard · android · 07-member-view · light — frame 01 on Material 3.
8. f3-member-home-dashboard · android · 08-error · light — two phone frames side by side, each labelled: a cold-load error, and a Bills-only InlineErrorRow.
9. f3-member-home-dashboard · android · 09-offline · light — cached cards, the offline FreshnessLine, and the disabled add actions with their reason.
10. f3-member-home-dashboard · web-390 · 10-member-view · light — mobile web.
11. f3-member-home-dashboard · web-1440 · 11-owner-view · light — Maya's full dashboard with Priya's InviteRow, the owner legend, Maya's voter row in the DateRow done state with "Only you will see this.", the Calendar header tab and no floating button.
12. f3-member-home-dashboard · ios · 12-ax5-worst-case · light — Sam's six cards at AX5, the Documents & Security card with both locked rows stacked, and the Bills InlineErrorRow "We couldn't load bills just now · Retry bills".
13. f3-member-home-dashboard · ios · 13-greyscale · light — frame 01 in greyscale.
14. f3-member-home-dashboard · ios · 01-member-view · dark — the dark twin of frame 01.
15. f3-member-home-dashboard · ios · 04-access-revoked · dark — the dark twin of frame 04.
16. Notes — list the following:
- Assumptions: the pickup row follows the TODAY fixture (hollow, not yet confirmed), matching the Foundations board. The filled statewide voter row assumes the seeded WA deadline was checked by hand (seeded state and county rows otherwise ship as on record, not confirmed). The authority string "Washington Secretary of State · statewide · 2026" follows the Foundations specimen, with the year added. "Maya can add bills and mark them paid here" extends the Foundations specimen "Maya can add bills here". Priya's sent date, Mon 12 Oct, follows from the 14-day invitation length. Maya's address was confirmed before TODAY, so the verify sheet can offer "Ask Maya Chen to confirm". The join dates Thu 1 Oct and Sat 10 Oct take precedence over the Foundations MemberRow specimen dates. In this fixture HOA dues is a self-added date, not a bill, so the Bills card shows 3 upcoming and $306.17 (the Foundations LockedActionRow crop counts it as a bill, giving $591.17). The caption reads "Everyone at Larkspur Loop can see these" instead of naming people, because no bill permissions differ between Maya and Sam. The KeeperStrip is drawn unconditionally, as a permission-limited strip.
- Contract question for the Foundations board: legend wording for a tick another household member added. Used here: "Added by your household".
- Every invented string: the join dates, "Maya's parents visiting", "Added by Maya", "Added by your household", "city schedule", "Change furnace filter · due Sat 24 Oct", the KeeperStrip mood line, the role-change line, the error and offline lines, "Checked — no upcoming bills", "as of 6:04 PM", and the edge-case totals.
- Omitted: the verify sheet itself (drawn in its own prompt); routing fixes for bill and calendar notifications (engineering).

BATCH PLAN: Turn 1: artboards 1–6, then wait for "continue". Turn 2: 7–12, then wait for "continue". Turn 3: 13–16.
