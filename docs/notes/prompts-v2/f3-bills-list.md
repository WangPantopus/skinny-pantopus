# Bills list (member read-only + payer attribution)
id: f3-bills-list · platforms: web/ios/android · isNew: False · artboards: 26

Use the Pantopus house style pasted above and the Foundations components from prompt 00, by exact name.

SCREEN: Bills list · f3-bills-list

TYPE: EXTENSION of the existing designed screen "Bills list" (and the dashboard Bills card it opens from). This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.

ATTACH: the Bills list on web 1440, web 390, iOS and Android; the home dashboard Bills card; the native bill detail on iOS and Android.

PLATFORMS & VIEWPORTS: web 1440x900 (left sidebar) and 390x844 (bottom tab bar); iOS 393x852 (large title "Bills", back "Larkspur Loop"); Android 412x915 (Material 3 top app bar). Place is the selected tab everywhere.

WHERE IT LIVES & HOW PEOPLE ARRIVE: Place tab › Larkspur Loop (place file) › Money section › Bills. Other ways in:
- the home dashboard Bills card "View";
- the home header Bills tab;
- a grouped "marked paid" notification ("Maya marked 3 bills paid"), from the push or from the "See all 3 in Bills" line under the expanded in-app row, which opens the Paid segment with those three rows highlighted: /app/homes/{home}/bills?segment=paid&highlight={bill1},{bill2},{bill3};
- a single highlighted row: /app/homes/{home}/bills?linkedType=bill&linkedId={bill};
- Back from bill detail, which restores the scroll position and returns focus to the row you came from, with no wash and no announcement.
A single "marked paid" notification opens bill detail, not this list. Every row hands off to bill detail (web /app/homes/{home}/bills/{bill}; native pantopus://homes/{home}/bills/{bill}).

WHO AND WHEN: The dense default is Sam Ortega's phone on Mon 19 Oct at 6:10 PM. Sam is a member at HOME A. He can see bills, but only Maya can mark them paid. He checks whether the power bill is handled before paying it himself. Jenna, a guest until Tue 20 Oct, cannot see bills. The manage frames are Maya Chen's (owner).

THE ONE JOB: Let everyone in the household see the bills and who marked each one paid, so two people do not pay the same bill.

FIRST FIVE SECONDS: first the header: ScopeChip "Your household" with "Maya and Sam can see these bills" and "3 upcoming · $306.17 through Mon 2 Nov · 1 overdue ($41.18)"; second the column of amounts; third each row's right-hand line: "Not marked paid yet" or "Paid by Maya". The primary action is opening a row. There is no mark-paid button on any row face.

CONTENT (fixture deltas)
- Upcoming (fixtures): Clark Public Utilities $142.18 · due in 4 days · Fri 23 Oct; City of Vancouver water $84.00 · due in 9 days · Wed 28 Oct; Comcast $79.99 · due in 14 days · Mon 2 Nov.
- Overdue (delta): NW Natural $41.18 · was due Tue 13 Oct · Overdue. The header reads exactly "3 upcoming · $306.17 through Mon 2 Nov · 1 overdue ($41.18)". The overdue amount stays out of the window total.
- Paid (delta), newest first: Clark Public Utilities $109.60 (September bill, due Wed 23 Sep) · Paid by Maya · Thu 17 Sep; Comcast $79.99 (due Fri 2 Oct) · Paid by Maya · Thu 17 Sep; Waste Connections $38.75 (quarterly, due Wed 30 Sep) · Paid by Maya · Thu 17 Sep; City of Vancouver water $81.60 · Paid by Theo (no longer here) · Fri 28 Aug. The three Thu 17 Sep rows are the grouped notification's rows.
- HOA dues ($285, Sun 1 Nov) are a date on the calendar, not a household bill, so they are not in this list or its totals.
- Only-you bill (delta, Maya's view only): State Farm renters insurance $22.50 · due in 19 days · Sat 7 Nov.
- Scope sentence rule: print "Everyone at Larkspur Loop can see these bills" only when every person at the home can see bills. When anyone cannot (today, Jenna the guest), name the people: "Maya and Sam can see these bills".
- Worst case: provider "City of Vancouver Water, Sewer and Stormwater Utility"; "Clark County Treasurer · Property tax, 2nd half" $3,412.56 due Mon 2 Nov; the header then reads "4 upcoming · $3,718.73 through Mon 2 Nov · 1 overdue ($41.18)".

LAYOUT & VISUALIZATION
- Header, in this order: ScopeChip; the scope sentence; the count and window total; a FreshnessLine; on Sam's view, LockedActionRow "Maya can mark bills paid."; then the ChoiceChip segment Upcoming / Paid / All (iOS segmented control, Android M3 filter chips).
- Rows use BillRow, identical on all three platforms. Line 1: provider (bodyMedium, truncates first), one StatusChip, and the amount right-aligned in tabular figures, so the amounts form one column. Line 2: the due date (bodySmall, text.secondary) and, right-aligned, the attribution slot. On paid rows the slot reads "Paid by Maya · Thu 17 Sep"; on Sam's unpaid rows it reads "Not marked paid yet" (bodySmall, text.secondary). The name never truncates. Paid rows use the Paid chip. Overdue rows use the Overdue chip with its glyph.
- Member rows (Sam): the BillRow member variant is drawn as the header LockedActionRow plus each unpaid row's "Not marked paid yet"; no "I paid this" item is drawn.
- Only-you bill: line 1 keeps its single StatusChip; line 2's right slot shows a 12pt person glyph plus the words "Only you" in bodySmall text.secondary, in the attribution position. Only-you bills are left out of the header count and total; Maya's header adds "1 bill only you can see".
- Upcoming shows the overdue group first, under the overline "OVERDUE", then the upcoming rows. The All segment adds month overlines once there are more than 20 rows.
- Manage (Maya): each row has an overflow button (44pt iOS / 48dp Android / 44px web) with "Mark paid", "Paid a different amount" and "Skip this month". Sam's rows have no overflow; the whole row opens detail.
- Highlight from a notification: the target rows scroll into view once, get an infoBg wash plus a 2pt leading bar in primary.700 (a shape cue that survives greyscale), and the first receives accessibility focus. The wash fades over 300ms once the person scrolls. The highlight opens nothing by itself. Back from detail gets no highlight.
- Draw no budget bar, spend meter or ring.

INTERACTION, MOTION & HAPTICS
- Mark paid (overflow): the row changes in place to InlineUndo "Marked Clark Public Utilities paid · Undo", with the caption "We'll let Sam know when you leave this screen." under it (web: "…when you leave this page."; no caption for Only-you bills). On Android it is echoed by a Snackbar with Undo that stays open while TalkBack is on. On iOS the inline line is also announced. Undo lasts until Maya leaves the screen and sends nothing. The paid status is saved at once; the household "marked paid" notification is sent only after she leaves, October's reminders stop for everyone, and the repeating bill reappears in Upcoming as "Next due Mon 23 Nov".
- Paid a different amount (overflow): opens bill detail with the amount field focused.
- Skip this month (overflow): the row collapses to "Skipped this month · Undo" plus "Next due Mon 23 Nov". It sends no household notice.
- Race: if the bill was already marked paid on another device, the row reads "Already marked paid by you on your phone · 6:02 PM", and nothing is sent twice. HOME A has no second person who can mark bills paid, so draw only this case.
- The overflow menu is also exposed as custom accessibility actions. There are no swipe-only actions.
- Pull to refresh (native) refreshes in place with FreshnessLine "Updating…" and no full-screen spinner. Web has a Refresh text button in the FreshnessLine.
- Haptics: one light tick when Maya taps Mark paid and the InlineUndo line appears (iOS light impact; Android CONFIRM). No haptic on Undo or on Skip.
- Reduce Motion: the highlight appears and clears with no fade or scroll animation.

FOUNDATIONS COMPONENTS USED: BillRow (manage, member, only-me and former-member variants; highlighted and marked-paid states); StatusChip; ChoiceChip (segment); ScopeChip ("Your household"); LockedActionRow ("names who can act" variant); InlineUndo; FreshnessLine; OfflineNotice; WarmingSkeleton (row skeleton); InlineErrorRow.

ACCESSIBILITY: Reading order: ScopeChip, scope sentence, count and total, FreshnessLine, lock row, segment, rows. Each row is one merged element, for example "Clark Public Utilities, 142 dollars 18 cents, due Friday October 23, upcoming, not marked paid yet", "…, paid by Maya on Thursday September 17" or "State Farm renters insurance, 22 dollars 50 cents, due Saturday November 7, upcoming, only you can see this". The overflow items are custom actions. A row highlighted from a notification gets focus and the announcement "From your notification". Overdue and Only you are words, not colour. The segment shows selection with a check plus fill, which differs from the focus ring. Targets are 44pt iOS, 48dp Android and 44px web. At AX5 and 200%, line 2 stacks under line 1, the amount moves under the provider, and the segment becomes radio rows. Undo announces as a status.

COPY: "Maya and Sam can see these bills" · "Everyone at Larkspur Loop can see these bills" · "3 upcoming · $306.17 through Mon 2 Nov · 1 overdue ($41.18)" · "4 upcoming · $3,718.73 through Mon 2 Nov · 1 overdue ($41.18)" · "OVERDUE" · "Maya can mark bills paid." · "Upcoming" / "Paid" / "All" · "Mark paid" · "Paid a different amount" · "Skip this month" · "Marked Clark Public Utilities paid · Undo" · "We'll let Sam know when you leave this screen." / "We'll let Sam know when you leave this page." · "Skipped this month · Undo" · "Next due Mon 23 Nov" · "Not marked paid yet" · "Paid by Maya · Thu 17 Sep" · "Paid by you · Thu 17 Sep" · "Paid by Theo (no longer here) · Fri 28 Aug" · "Already marked paid by you on your phone · 6:02 PM" · "Only you" · "1 bill only you can see" · "Checked — no household bills on file" + "Add a bill" (manage) / "Maya can add bills here." (member) · "Checked — nothing due. Paid bills are under Paid." · "We couldn't load your bills just now" + "Retry" · "You're offline · as of 5:40 PM" · "Amounts and paid status as of 5:40 PM. Changes since then aren't shown." · "Marking paid needs a connection." · "Updated 2h ago" · "Updating…" · "Refresh" · "You can't see these bills" / "Bills at Larkspur Loop are shared with Maya and Sam. Maya can change your access." · "From your notification".

EDGE CASES: The longest provider truncates before the amount or the attribution. $3,412.56 keeps the amount column aligned. With 20+ bills in All, use month overlines. Draw zero bills for both manage and member. Draw an empty Upcoming with a populated Paid. A removed bill never appears in Upcoming, and returning from a removed bill shows no highlighted row. On a slow network, a cold load uses the row skeleton; a warm load keeps the rows. Offline and stale states say what is stale. A guest without bill access (Jenna) gets the denied state with no providers or amounts. A saved place never reaches this list: its place file shows the Money section as not available for a saved place. Only-you bills appear only for their owner, never count toward the household total and never notify.

INSTEAD OF
- Instead of a one-tap Mark paid on the row face or the dashboard card, keep it in the overflow with InlineUndo, because a mis-tap would tell the whole household.
- Instead of an avatar without a name, print "Paid by Maya", because the name is the point.
- Instead of a greyed Mark paid for Sam, draw LockedActionRow "Maya can mark bills paid.", because he needs to know who can record it.
- Instead of leaving an unpaid row's right slot blank for Sam, print "Not marked paid yet", because absence is not an answer.
- Instead of a budget bar, spend meter or percentage ring, show the count and window total as text, because this list is about who paid, not a score.
- Instead of a highlight that only changes colour, add the leading bar and move focus, because the wash is invisible in greyscale and to screen readers.
- Instead of an "Only you" chip beside the StatusChip, put the person glyph and "Only you" in line 2's right slot, because one row has one chip.
- Instead of "Everyone" when a guest can't see bills, name the people, because the scope line must be true.

DONE WHEN: Sam can tell in five seconds that Clark Public Utilities is not yet marked paid and that only Maya can mark it. Maya can mark a bill paid and undo it without anyone being told, and she is told Sam will hear when she leaves. The grouped notification lands on the right three rows with focus. The header always states who can see the bills, the window total and the overdue amount separately, and every statement is true.

ARTBOARDS
1. f3-bills-list · ios · 01-upcoming-member-dense · light — Sam's view: header with "Maya and Sam can see these bills", "3 upcoming · $306.17 through Mon 2 Nov · 1 overdue ($41.18)", lock row, overdue group and three upcoming rows each reading "Not marked paid yet".
2. f3-bills-list · web-1440 · 02-upcoming-manage · light — Maya's view with overflow buttons and "1 bill only you can see".
3. f3-bills-list · android · 03-upcoming-manage · light — Maya's view.
4. f3-bills-list · ios · 04-paid-segment · light — Sam's view, attribution on every row, including Theo.
5. f3-bills-list · ios · 05-all-segment · light — Sam's view, mixed statuses.
6. f3-bills-list · android · 06-overflow-open · light — Maya's view, the menu with the three actions.
7. f3-bills-list · ios · 07-marked-paid-undo · light — Maya's view, "Marked Clark Public Utilities paid · Undo" in the row, "We'll let Sam know when you leave this screen.", plus Next due Mon 23 Nov.
8. f3-bills-list · android · 08-marked-paid-snackbar · light — Maya's view, Snackbar held open with TalkBack on.
9. f3-bills-list · ios · 09-skipped-this-month · light — Maya's view, "Skipped this month · Undo" and Next due Mon 23 Nov.
10. f3-bills-list · web-390 · 10-highlighted-grouped · light — Sam's view, Paid segment with the three Thu 17 Sep rows highlighted (wash plus leading bar), focus on the first.
11. f3-bills-list · ios · 11-back-focus-restored · light — Sam's view back from bill detail: scroll restored, focus ring on the Clark row, no wash.
12. f3-bills-list · ios · 12-only-you-bill · light — Maya's list with the State Farm row showing the person glyph and "Only you" in line 2.
13. f3-bills-list · web-1440 · 13-empty · light — manage and member empty states side by side.
14. f3-bills-list · android · 14-upcoming-empty-paid-populated · light — "Checked — nothing due. Paid bills are under Paid."
15. f3-bills-list · ios · 15-loading · light — row skeleton.
16. f3-bills-list · android · 16-error · light — InlineErrorRow with Retry.
17. f3-bills-list · ios · 17-offline-stale · light — Maya's view, cached rows, stale line, overflow open with "Mark paid" disabled and "Marking paid needs a connection."
18. f3-bills-list · web-390 · 18-permission-denied · light — Jenna's guest view, no providers or amounts.
19. f3-bills-list · ios · 19-worst-case · light — Sam's view, All segment with month overlines, longest provider, $3,412.56, 20+ rows; header "4 upcoming · $3,718.73 through Mon 2 Nov · 1 overdue ($41.18)".
20. f3-bills-list · web-1440 · 20-member · light — Sam's view on desktop.
21. f3-bills-list · ios · 21-ax5 · light — Sam's view at AX5, stacked rows.
22. f3-bills-list · android · 22-200-percent · light — Sam's view at 200% font.
23. f3-bills-list · ios · 23-greyscale · light — frame 1 in greyscale.
24. f3-bills-list · ios · 01-upcoming-member-dense · dark — dark twin of 1.
25. f3-bills-list · ios · 07-marked-paid-undo · dark — dark twin of 7.
26. f3-bills-list · Notes — assumptions (the scope sentence switches to "Everyone at Larkspur Loop can see these bills" after Jenna's guest access ends Tue 20 Oct; the Thu 17 Sep burst date was chosen so no bill was paid late and every bill in it was more than 3 days from due, so its notice stays quiet; Clark's September amount $109.60 matches the trend board; HOA dues are a calendar date, not a household bill, so they are outside this list and its totals even though the Foundations board draws an HOA BillRow specimen; the overdue amount is reported apart from the window total; rows keep the BillRow string "Paid by Maya" while bill detail uses the longer "Marked paid by" on purpose; the BillRow member variant is drawn as the header LockedActionRow plus "Not marked paid yet" in place of "I paid this" until the product decides; the race pattern "Already marked paid by <name> · 6:02 PM" is reserved for a future second person who can mark bills paid), every invented string (Theo, Jenna, NW Natural, State Farm, Waste Connections $38.75, the Thu 17 Sep payments, 6:02 PM, "We'll let Sam know when you leave this screen."), the open decision on members recording "I paid this", and the note that the dashboard Bills card itself is drawn in f3-member-home-dashboard.

BATCH PLAN: Turn 1: 1-6, then wait for continue. Turn 2: 7-12, then wait for continue. Turn 3: 13-18, then wait for continue. Turn 4: 19-24, then wait for continue. Turn 5: 25-26.
