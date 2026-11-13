# Plans with businesses: prompts for the step 2 app sessions

November 12, 2026 · Ready to paste. Neither session has been started; the founder
starts them. The step 2 server PR (#3983) is merged, so they can start once its
backend release is out.

One prompt for iPhone and one for Android. They can run side by side: they touch
different folders. Each begins with the same rules.

The server they build against is #3983 (step 2) on top of #3976 (step 1), both
merged.

## The rules both prompts start with

> Read `AGENTS.md` first, then `docs/product/plans-with-businesses/README.md`,
> `02-design.md`, `03-build-contract.md` (sections 5 and 9, and "Calls the build
> made") and `04-build-plan.md`.
>
> - Before any work, write your plan in plain words (what people will see change,
>   on which screens, what stays) and get the founder's OK. Put every approval
>   you need in that one ask.
> - Work in your own worktree and branch, on `/Volumes/Studio-Extended`. Check for
>   an open PR or a running session on the same files before you start.
> - Reuse before rebuilding. Change the Plans screens that exist; add no new tab,
>   and keep the side menu button where it is.
> - Everything new shows only when the server sends it. With `plans_business` off,
>   which is how production is, Plans must look and behave exactly as it does
>   today: check that on the build you make.
> - Verify in the real app (a simulator or an emulator) against a real local
>   backend and database, in light and dark, after a relaunch, and from the other
>   side: the guest's phone and the business's. Say plainly what you could not
>   verify.
> - No new unit tests. Update an existing test your change intends to break.
> - The founder allowed this build's sessions to use subagents on Opus 5.5 at
>   Extra reasoning (November 12). Keep the design decisions and the real-app
>   checks yourself.
> - Keep each PR small. Merge your own PR after green CI and the real-app check,
>   through the shared merge queue. Never put keys, tokens or real people's
>   details in Git, a PR or chat.
> - Only the founder cuts store builds, turns `plans_business` on, or changes
>   anything hosted.

## What the server gives you (both apps)

All of it is in the contract; this is the short list.

- **Say you can draw it.** Add `biz=1` to the query string of every request under
  `/api/plans` (reads and writes), of `GET /api/posts/map` when it asks for the
  plans layer, and of `GET /api/businesses/:id/plans`. Without it a business's
  plan does not exist, for guests and for the business's own team. Send it from
  this build on; nothing else changes for a person without the switch.
- **A business's plan card** carries `business`, `label`, `label_text`, `place`
  (public: name, address and point), `price` (`null` is "Free"),
  `guests_can_invite` and `more_times`. A neighbor's card has none of these keys:
  that is how you tell them apart. `host.display_name` is the business's name.
  `viewer.auto_rule` is `"open"` when anyone gets in right away.
- **The list** (`GET /api/plans`) takes `host=all|neighbors|businesses` and answers
  with `has_business_plans`: show the All / Neighbors / Businesses filter only
  when it is true, and remember the person's choice. A venue's later plans are
  already folded: the row's `more_times` has the count and the first six as short
  lines. The map pins take the same `host=` and a business's pin is exact, with
  `business`, `label_text`, `place_name` and `more_times` (a number).
- **"Host as"** (`GET /api/plans/host-as`): the businesses this person may post
  for, each with its `locations`, the `kinds` a business posts (with the name
  each reads for a business and its `labels`) and `limits`. It is empty for
  nearly everyone: show "Host as" only when it isn't.
- **Posting as a business** (`POST /api/plans`): send `host_as: { business_user_id }`,
  `business_location_id`, `label` (a key), `auto_rules: ["open"]` for "Right away"
  or `[]` for "I approve each", and the usual kind, title, about, times, spots,
  details and note. No `place`. The refusals are in the contract's section 5.5;
  show each one's `message`.
- **Changing one** (`PATCH /api/plans/:id`): the usual fields, plus `label`,
  `auto_rules`, `guests_can_invite` and `business_location_id`.
- **The business page** (`GET /api/businesses/:id/plans`): `{ items, plans_hosted }`.
- **The plan's chat.** Guests who are in get the chat as today, and the
  business's own lines appear in it. The business's team is not in it yet: the
  team's view of a plan has no `chat_room_id`, so show them no chat button
  (contract, call B7).
- **A neighbor's venue.** When a neighbor posts or moves a plan at a place chosen
  from the picker, send the picker's `place_id` as `place.place_id` (step 1). It
  is one line in each app; the server ignores it for a place typed by hand.
- **The team's permissions.** The team screen lists the permissions it knows.
  Add the two new ones, `plans.post` ("Post plans") and `plans.manage` ("Run
  plans"), so an owner can grant or refuse them.

Not in this step: a price, paying, refunds, the roster and check-in, repeats,
"Bring a friend", the Today cards, and the monthly statement. Draw none of them.

## The rig

A private local stack with a verified test business, its team and guests is
described in `~/.config/pantopus/launch-kit/streams/PLANSBIZ/README.md` (how to
start it, the test accounts, the switch, and the checks that drive the server).
Share its backend; don't start a second stack. Its test people's credentials are
in its `accounts.env`: read them from there and never print them.

## The iPhone prompt

> You are the iPhone session for step 2 of Plans with businesses. [The rules
> above.]
>
> **Your area:** `frontend/apps/ios/Pantopus/Features/Plans/` and the business
> page's plans section. Nothing on Android, the web or the server: ask the
> founder if the server needs to change.
>
> **Build these boards** (pictures in `docs/product/plans-with-businesses/screens/`,
> dark versions on the canvas the README links):
>
> | Board | What | Where it lives today |
> | --- | --- | --- |
> | P1 | The business shape, the badge on a kind tile and a pin, "Verified business", the price chip ("Free"), the label chip | New small views, reused by the rest |
> | G1 | The map: a business's pin with the badge and no shaded area, "Sat 10:00 · 4 times" on its tag | `Map/PlansMapView`, `PlanPinView` |
> | G2 | The list with the filter and the fold | `PlansSheetContent`, `PlansListColumn` |
> | G3 | A business's plan before you join, free: the place, the label, the "Hosted by" card, "Join" with "You're in right away" or "Ask to join" | The plan detail views, `PlanPinCard` |
> | G7 | A neighbor's plan: unchanged. Compare it with G3 on your build | The same views |
> | B1 | "Host as you or your business", then the five kinds worded for a business | `Host/PlanComposerRoot` |
> | B2 | Label, time, where (one of the business's locations), spots, who gets in. No price and no repeats | `Host/PlanDetailsForm` |
> | B3 | Posted: the link and invitations by email and to people who came before | `Host/PlanPreviewAndPosted`, `Host/PlanInviteSheet` |
> | B6 | Upcoming plans on the business page | The business page |
>
> Joining a free business plan uses today's ask sheet and "You're in" page; the
> host shown is the business. The team sees a guest's first name only; draw what
> the server sends and add nothing.
>
> **Also:** `biz=1` on the requests listed above; `place.place_id` when a
> neighbor picks a place; the two permissions on the team's permissions sheet
> (`ManagePermissionsSheet.swift`).
>
> **Done when**, in a simulator against the rig: with the switch off for the
> person, Plans is exactly today's; with it on, a guest finds the club's plan on
> the map and in the list, filters, opens the fold, joins and is in, and opens
> the chat; the club's editor posts a plan as the club, sees who asked and
> accepts, and is offered no chat; the owner, who didn't post it, can change
> and cancel it; all of it reads the same after a relaunch, in light and dark. Match Android's strings, test ids and accessibility labels (agree
> them with the Android session through the founder).

## The Android prompt

> You are the Android session for step 2 of Plans with businesses. [The rules
> above.]
>
> **Your area:**
> `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/plans/`
> and the business page's plans section. Nothing on iPhone, the web or the
> server: ask the founder if the server needs to change.
>
> **Build these boards** (the boards are drawn as iPhone; follow Android's own
> shipped Plans screens with the same parts):
>
> | Board | What | Where it lives today |
> | --- | --- | --- |
> | P1 | The business shape, the badge on a kind tile and a pin, "Verified business", the price chip ("Free"), the label chip | New small composables, reused by the rest |
> | G1 | The map: a business's pin with the badge and no shaded area, "Sat 10:00 · 4 times" on its tag | `map/PlansMapScreen`, `components/PlanPins` |
> | G2 | The list with the filter and the fold | `PlansSheetContent`, `PlanRows` |
> | G3 | A business's plan before you join, free | `detail/PlanDetailScreen`, `PlanGuestContent` |
> | G7 | A neighbor's plan: unchanged. Compare it with G3 on your build | The same screens |
> | B1 | "Host as you or your business", then the five kinds worded for a business | `host/HostFlowScreen` |
> | B2 | Label, time, where (one of the business's locations), spots, who gets in. No price and no repeats | `host/HostDetailsContent` |
> | B3 | Posted: the link and invitations by email and to people who came before | `host/HostFlowScreen`, `detail/PlanInviteSheet` |
> | B6 | Upcoming plans on the business page | The business page |
>
> Joining a free business plan uses today's ask sheet and "You're in" screen; the
> host shown is the business. The team sees a guest's first name only; draw what
> the server sends and add nothing.
>
> **Also:** `biz=1` on the requests listed above; `place.place_id` when a
> neighbor picks a place (`PlanPlaceInput`); the two permissions on the team's
> permissions sheet (`ManagePermissionsSheet.kt`).
>
> **Done when**, in an emulator against the rig: the same list as the iPhone
> prompt's. Match iPhone's strings, test ids and accessibility labels, as the
> Android guide requires.
