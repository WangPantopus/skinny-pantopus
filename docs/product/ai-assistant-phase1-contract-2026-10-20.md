# AI assistant, phase 1: the contract between the server and the apps

October 20, 2026 · Status: building. Decided by the founder on October 20 ("start phase 1 as proposed, using your recommendations for the open decisions"); the decisions are recorded in [NEXT_STEPS.md](../../NEXT_STEPS.md) under "Made on October 20 (AI assistant)". The proposal is the [AI expansion page](https://claude.ai/artifact/DkyRkpcQ1bLL4ETb3DjqQ5).

Phase 1 makes the assistant **see** what the person can see in Plans, Pulse, Place and Today, **do** what the app can do with one tap, and **know how the app works**. Phase 2 (catch-up summaries, chats, nudges) and phase 3 (memory, rules, Siri) are out of scope here.

This file is the contract three sessions build against: the backend, iOS and Android. The web app keeps working unchanged: it never asks for the new cards, so the server never sends them.

## 1. Rules that hold everywhere

1. **The assistant never writes.** Every change is an action card. The person taps once, and the app sends the card's request to an endpoint the app already uses. Permissions, validation, flags, privacy and notifications stay in those endpoints.
2. **The model never writes a request.** The server builds each request from validated fields, for a fixed list of card types. The apps execute only requests on their allowlist (section 4.3).
3. **It sees what the person sees.** Each read tool calls the same service, with the same viewer, as the screen it mirrors: plan cards carry the area only, posts carry displayed points, money sections stay hidden from household members.
4. **Other people's words are data.** Post text, comments, plan notes and names reach the model inside tool results that say so; nothing in them can act without the person's tap.
5. **Launch flags hold.** Marketplace, open gigs and the mailbox stay off; Plans tools exist only for people with the `plans` flag. Playdates follow `plans_playdates`: the plan tools offer them only to people who have it, and the plan services' own rules decide the rest (a verified address to see, host or ask to join one; public places; the host approves each family; parents stay).

## 2. What stays the same

`POST /api/ai/chat` (server-sent events) keeps its events (`conversation`, `status`, `text_delta`, `draft`, `done`, `error`) and its existing cards (`post`, `support_train`, `pickup_schedule`; `gig` and `listing` while their flags are off are never sent). An app build that sends nothing new gets exactly what it gets today.

## 3. Request

`POST /api/ai/chat` body, new fields only:

| Field | Type | Meaning |
|---|---|---|
| `cards` | string[] | Existing. Add `"action"` to receive action cards (section 4) and `"link"` to receive link buttons (section 5). Keep `"pickup_schedule"`. |
| `context` | object, optional | What the person is looking at when they tapped Ask (section 6). Sent with the first message of a conversation started from a screen; may be repeated on later messages. |

`context` shape: `{ "surface": string, "id"?: uuid, "home_id"?: uuid, "section"?: string }`. Unknown surfaces are ignored. The server checks access exactly as the screen does; a plan or post the person can't see is treated as no context.

## 4. Action cards

### 4.1 Event

An action card arrives as the existing `draft` event:

```json
{ "type": "action", "draft": { ...envelope... }, "valid": true }
```

and in history (`GET /api/ai/conversations/:id/messages`) as `{ "role": "assistant", "draft": { "type": "action", "draft": { ...envelope... } } }`. As with today's drafts, a card ends the assistant's turn; the line under it arrives as `text_delta`.

### 4.2 Envelope

```json
{
  "id": "6f1c…",                     // uuid; also the idempotency key where an endpoint takes one
  "card": "plan_create",             // one of the types in 4.4
  "title": "Pickup game",
  "lines": [ { "label": "When", "value": "Sat, Oct 24 · 10:00–11:30 AM" } ],
  "warnings": [ "Moving the time more than 30 minutes asks everyone who's in \"Still coming?\"" ],
  "note": null,                      // the assistant's one line, or null (also streamed as text)
  "expires_at": "2026-10-24T17:00:00Z",   // optional: after this, show the card as expired and disable actions
  "actions": [ Action ],             // usually one primary action
  "items": [ Item ]                  // optional, for cards with one row per person (plan_requests)
}
```

`Action`:

```json
{
  "id": "confirm",
  "label": "Post plan",
  "style": "primary",                // "primary" | "secondary" | "destructive"
  "request": {
    "method": "POST",
    "path": "/api/plans",
    "body": { ... },                 // JSON object, sent as is
    "headers": { "x-pantopus-session-scope": "…" }   // optional; only this header is ever used
  },
  "then": {                          // optional follow-up, sent only after the request succeeds
    "request": { "method": "POST", "path": "/api/homes/H/tasks/{{response.task.id}}/recurrence", "body": { "expected_task_updated_at": "{{response.task.updated_at}}", ... }, "headers": { ... } }
  },
  "done": {
    "label": "Plan posted",
    "link": "pantopus://plans/{{response.id}}"   // optional; open it with the app's deep-link router
  }
}
```

`Item` (one row with its own buttons): `{ "id": uuid, "title": string, "lines": [ {label, value} ], "actions": [ Action ] }`.

**Placeholders.** `{{response.a.b}}` in `then.request.path`, in string values of `then.request.body` (top level only) and in `done.link` is replaced with the value at that dot path in the JSON response of the request just sent. If a value is missing, skip the `then` request (show the card as done with a note that the repeat wasn't set) and drop the link.

### 4.3 What the apps do

1. Render the envelope with the app's existing card style: title, `lines` as label/value rows, `warnings` in the caution style, `items` as rows with their own buttons, then the actions. A "Not now" control (local only) dismisses the card.
2. On tap, check the request against the allowlist below (method and path pattern; the only header allowed is `x-pantopus-session-scope`). A request off the list is never sent: show "This card can't be used in this version of Pantopus."
3. Send it with the signed-in API client. On success, run `then` if present, show `done.label` and, if there is a link, an Open button. Disable the card's actions while a request runs and after it succeeds.
4. On an error response, show the server's `message`, else its `error` text. `409 SESSION_SCOPE_CHANGED` means the card came from an earlier sign-in: show "This card is from an earlier sign-in. Ask again." and leave the card usable.
5. Remember which `(card id, action id)` pairs succeeded, on the device, so cards restored from history show as done after a relaunch.

**Allowlist** (`:id` is a uuid):

| Method | Path |
|---|---|
| POST | `/api/plans` |
| PATCH | `/api/plans/:id` |
| POST | `/api/plans/:id/cancel` |
| POST | `/api/plans/:id/requests` |
| POST | `/api/plans/:id/requests/:id/accept` |
| POST | `/api/plans/:id/requests/:id/decline` |
| POST | `/api/chat/messages` |
| POST | `/api/posts/:id/comments` |
| PATCH | `/api/posts/:id/solve` |
| POST | `/api/homes/:id/tasks` |
| POST | `/api/homes/:id/tasks/:id/recurrence` |
| PUT | `/api/hub/preferences` |

### 4.4 Card types

| `card` | When the server offers it | Request | Done |
|---|---|---|---|
| `plan_create` | The person has `plans` and asked to host something | `POST /api/plans` with `kind`, `title`, `about`, `guest_note`, `starts_at`, `ends_at`, `spots`, `place` (`{kind:"public", name, address, latitude, longitude}` or `{kind:"home", home_id}`), `auto_rules`, `join_requirement`, `details` (a playdate's `kids_age_bands`). Validated with the server's own plan rules before the card is shown | "Plan posted", link to the plan |
| `plan_edit` | The host asked to change their plan | `PATCH /api/plans/:id` with the changed fields only. A warning when the change asks guests "Still coming?" | "Plan updated" |
| `plan_cancel` | The host asked to cancel | `POST /api/plans/:id/cancel` with `note` | "Plan cancelled" |
| `plan_requests` | The host asked about who wants to join | One item per waiting request, each with Accept and Decline (`POST …/requests/:id/accept` or `/decline`). The first hand-accept at a home carries `confirm_shares_address: true` with a warning that it shares the address | "Accepted" / "Declined" per item |
| `plan_ask` | The person wants to join someone's plan | `POST /api/plans/:id/requests` with `party_size` and `note`; for a playdate, `party_size: 1`, `kids_count`, `kids_age_bands` and `stays_with_kids: true`, with warnings that the parent stays and what the host sees | "Asked" |
| `plan_message` | The host or an accepted guest wants to message the plan's chat | `POST /api/chat/messages` with `roomId`, `messageText`, `messageType: "text"`, `clientMessageId` (= card id) | "Sent", link to the chat |
| `post_reply` | The person wants to reply to a post they can see | `POST /api/posts/:id/comments` with `comment`, optional `parentCommentId`, `clientRequestId` (= card id) | "Replied", link to the post |
| `post_solve` | The author of an open question wants to mark it solved | `PATCH /api/posts/:id/solve` | "Marked solved" |
| `home_task` | A reminder or household task in a home where the person can create tasks | `POST /api/homes/:id/tasks` with `request_id` (= card id), `task_type`, `title`, `description`, `assigned_to`, `due_at`, `priority`, `visibility`, and the `x-pantopus-session-scope` header. A repeating task adds a `then` that starts the repeat (`POST …/tasks/{{response.task.id}}/recurrence`) | "Added", link to the home's tasks |
| `notification_settings` | The person asked to change quiet hours, briefings or alerts | `PUT /api/hub/preferences` with only the changed fields and `expected_user_id` | "Saved" |

## 5. Link buttons

When an answer points somewhere in the app ("open notification settings"), the server sends:

```
event: link
data: { "label": "Open notification settings", "url": "pantopus://settings/notifications" }
```

after the text it belongs to (it may come before `done`). Apps that sent `"link"` in `cards` show each link as a button under that reply and open it with their deep-link router; an unknown URL does nothing. History items carry them as `"links": [ { "label", "url" } ]` on the assistant message.

URLs come only from a fixed catalog on the server (section 5.1), never from the model.

### 5.1 Catalog

Every URL here opens on both apps today through their deep-link routers (iOS `Core/Routing/DeepLinkRouter.swift`, Android `core/routing/DeepLinkRouter.kt`), except the one marked **new**, which both apps add in phase 1. The server writes them from `backend/services/ai/appGuide.js`.

| Screen | URL |
|---|---|
| Today | `pantopus://today` |
| Place (default home) | `pantopus://place` |
| One home on Place | `pantopus://place/<homeId>` |
| A Place section screen | `pantopus://place/<homeId>/<slug>` (slugs: `today`, `your-home`, `risk`, `block`, `money`, `civic`) |
| Home tools, and the home's tasks | `pantopus://homes/<homeId>/dashboard` (there is no link to the task list itself) |
| One home task | `pantopus://homes/<homeId>/tasks/<taskId>` |
| Home members | `pantopus://homes/<homeId>/members` |
| Enter a postcard code | `pantopus://homes/<homeId>/verify-postcard` |
| A claim's progress | `pantopus://homes/<homeId>/waiting-room` |
| Nearby | `pantopus://nearby` |
| One post | `pantopus://posts/<postId>` |
| Plans tab | `pantopus://plans` |
| One plan | `pantopus://plans/<planId>` |
| Host a plan | `pantopus://plans/new` |
| Who asked to join (host) | `pantopus://plans/<planId>/requests` |
| A chat | `pantopus://chat/<roomId>` |
| Notifications | `pantopus://notifications` |
| Notification settings | `pantopus://settings/notifications` (**new**: add it to both routers; it opens Settings → Notifications) |
| One Support Train | `pantopus://support-trains/<trainId>` |

## 6. Screen context ("Ask about this")

| `surface` | Sent from | Fields | What the server adds |
|---|---|---|---|
| `today` | The Ask box at the top of Today | `home_id` (the home Today shows) | The day: weather, air, alerts, calendar, good-day picks, plans today and tasks due |
| `place` | The Ask button on Place, and on a Place section's detail screen | `home_id`, optional `section` (the detail slug: `today`, `your-home`, `risk`, `block`, `money`, `civic`) | That home's sections, with sources and dates, under the person's own access |
| `nearby` | The Ask button on the Nearby feed | none | Recent posts near the person's place |
| `post` | The Ask button on a post | `id` (post id) | The post and its replies, as the person can see them |
| `plans` | The Ask button on the Plans tab (map or list) | none | The person's own plans and plans nearby this week |
| `plan` | The Ask button on a plan | `id` (plan id) | The plan as the person sees it; for the host, the waiting requests |

The app shows the context above the conversation ("About: Pickup game") and offers two or three starter prompts for that surface (section 7). Context changes nothing about access.

## 7. Entry points in the apps

Inside each screen's existing design; no tab changes, no new screens besides the existing assistant thread.

| Where | Control | Starter prompts |
|---|---|---|
| Today | A box at the top, "Ask Pantopus", opening the assistant with `today` context | "What do I need to know today?", "Is it a good day to…", "Set my pickup days" |
| Place | A trailing button in the header, and on section detail screens | "What does this mean for us?", "What should we do this season?", "Remind us…" |
| Nearby | A trailing button in the feed header | "What did I miss this week?", "Help me post something", "Who do neighbors recommend…" |
| Plans tab | A trailing button in the header | "Find something this weekend", "Host a plan", "What's coming up for me?" |
| A plan | A button among the plan's actions | Host: "Who wants to join?", "Message everyone", "Move it". Guest: "Ask to join", "What should I bring?" |
| A post | A button in the post's actions | "Draft a reply", "Sum up the replies" |
| Messages | The existing "Pantopus AI" row | unchanged |

The assistant thread already exists on both apps; an entry point opens it with the context set and the first prompt not yet sent.

## 8. Other changes in phase 1

- **Post cards keep every field.** The `post` draft now also carries `eventDate`, `eventEndDate`, `eventVenue`, `dealExpiresAt`, `lostFoundType` and `safetyAlertKind` when they apply, and only post types and heads-up kinds the nearby feed accepts. The native Pulse composers must prefill all of them (today they keep only the headline, text and type).
- **Longer turns.** A turn may take up to 45 seconds and eight tool rounds; the `status` event names each step ("Looking at plans nearby…"). Apps keep showing it.
- **New errors.** `error` events may carry `AI_BUDGET` ("Pantopus AI has done a lot today. Try again tomorrow.") and `AI_DISABLED` ("Pantopus AI is paused right now."). Show the message as given.

## 9. Verification (phase 1 is done when)

Against a local backend and database with the live model, on the iOS simulator and the Android emulator, with test accounts:

1. From Today: "Pickleball at a park near me tomorrow at 6, need 3" gives a `plan_create` card; one tap posts the plan; it shows on the Plans tab and on a second account's map as an area only; it is still there after relaunch.
2. As that host, from the plan: "Who wants to join?" after the second account asks gives a `plan_requests` card; Accept lets the guest in, and the guest sees the exact place.
3. From Place: "Remind Sam to change the furnace filter every month" gives a `home_task` card assigned to the household member; one tap creates it with its monthly repeat; the member sees it and gets the assignment push.
4. "How do I add my partner to our home?" answers in plain words with a link button that opens the members screen.
5. "Nothing after 9 PM" gives a `notification_settings` card; one tap saves quiet hours; Settings shows them after relaunch.
6. From a post: "Draft a reply" gives a `post_reply` card; one tap posts it; the author sees it.
7. A post whose text tells the assistant to do something else, and a plan note doing the same, change nothing (the attack set).
8. An app build without `"action"` in `cards` behaves exactly as before.

Sources for this contract: `backend/routes/plans.js`, `backend/services/plans/planActions.js`, `backend/routes/posts.js` (comments, solve), `backend/routes/chats.js` (send), `backend/routes/home.js` (task routes and recurrence), `backend/routes/hub.js` (preferences), `backend/utils/requestSessionScope.js`, and the iOS and Android deep-link routers.
