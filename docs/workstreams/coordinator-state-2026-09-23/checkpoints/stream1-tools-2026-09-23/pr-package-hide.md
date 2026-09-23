The package task routes answer 501 until package tasks exist (#378, the coordinator's decision (a)). The apps still offered that flow in four places. This PR hides them behind one flag per app, which is off for now (`PackageGigAvailability.isAvailable` on iOS, `PACKAGE_GIG_AVAILABLE` on Android). Turning the flag on restores each entry exactly as it was.

## 1. Mail task form: "Post as Neighbor Task Instead"

**Problem.** The create-from-mail task form offers "Post as Neighbor Task Instead". That button opens the package task form ("Ask a Neighbor … Only Verified Neighbors with trust scores can see and accept package gigs"). The form's submit posts to `…/package/:mailId/gig`, which now answers 501. Before #378, that route faked a success.

**Reproduced** (Android, master build, as the owner of a delivered package mail):
- The form showed the button.
- It opened the package task form.
- Submitting sent `POST /api/mailbox/v2/p2/package/…b001/gig` → 501, and the app showed "Could not create gig request".

**Change.** The button is hidden on both apps. "Create Task" and "See all mail tasks" are unchanged.

**Verified:** AFTER_1

## 2. Unboxing: "Need help assembling? … Create Task Request"

**Problem.** The unboxing screen's card promises "Post a task and a Verified Neighbor will help. Package details are pre-filled." Its button posts to the same 501 route. With sample data, iOS even showed "Task created" without sending a request.

**Reproduced** (Android, master build): the card showed, and "Create Task Request" sent `POST …/package/…b001/gig` → 501.

**Change.**
- The card is hidden in both unboxing states (capturing and filed).
- The unboxing checklist's "Need a hand? — post an assembly task" line is dropped.
- The other checklist lines are unchanged.

**Verified:** AFTER_2

## 3. Package mail: "Ask a Verified Neighbor"

**Problem.** The package mail detail's "Ask a Verified Neighbor" opens the same package task form.

**Change.**
- iOS: the mail detail passes no `onAskNeighbor` to the package layout while the flag is off. A missing handler is the layout's existing way of leaving the action out.
- Android: the mail-detail route passes no `onAskNeighbor`.

On both apps the package variant of the mail detail didn't render for my fixture package mail. The generic mail detail showed instead, so this entry is covered by code.

**Verified:** AFTER_3

## 4. iOS: a `pantopus://mailbox/gig` link opens the package's mail

**Problem.** On iOS, the deep link opened the package task form directly.

**Change.** While the flag is off, the link opens the package's mail instead. Android has no deep link to that form.

**Verified:** AFTER_4

**Checks:** CHECKS

Evidence: `.pantopus-recovery/audits/20260923-stream1-native-package-gig-hidden-r1/`, MANIFEST `MANIFEST_SHA`.

**Limits:** local harness, synthetic identities.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
