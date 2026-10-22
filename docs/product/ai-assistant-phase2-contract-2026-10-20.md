# AI assistant, phase 2 (first wave): the contract between the server and the apps

October 20, 2026 · Status: ready to build once phase 1 is merged. The founder decided on October 20: "Once the Android PR and the Place/Today facts fix are merged, write the phase 2 contract and start phase 2 in fresh sessions. Leave chat reading until my privacy step is done." Later that day they added: "when phase 1 is done all work should be merged to master then please kick off phase 2 immediately with new sessions … all resume work with default or automatic recommended next steps, do not wait for me." The rules for speaking first were decided earlier that day; see [NEXT_STEPS.md](../../NEXT_STEPS.md), "Made on October 20 (AI assistant)". The proposal is the [AI expansion page](https://claude.ai/artifact/DkyRkpcQ1bLL4ETb3DjqQ5).

Phase 1 ([its contract](ai-assistant-phase1-contract-2026-10-20.md)) made the assistant see, do and know the app. In phase 2 it **speaks first** a few times a day, with the action ready. It also **catches people up** on Nearby and **reads home papers**. Everything in phase 1's contract still holds; this file adds to it.

The web app keeps working unchanged. It never sends the new capabilities, so it gets nothing new. Briefs and nudges open only in the apps, so the web leaves `assistant_brief` and `assistant_nudge` rows out of its notification list, bell, desktop alerts, unread counts and "Mark all read" (it asks the server with `exclude=assistant`; the apps' requests are unchanged).

## 1. What this wave covers

| In this wave | Waits for the founder's privacy step | Later waves |
|---|---|---|
| The nudge engine: limits, quiet hours, "Fewer like this", the Suggestions switch (§3) | Catch-up for a chat, a plan's chat or a Support Train's chat | "Before you ask": earlier answers shown while someone writes a question |
| The morning brief with buttons (§4) | Reply drafts in chats | The kindness and safety check before posting |
| Plans: weather and air watch, requests waiting, after the plan, plus host notices: a guest left, a rule let someone in, "Still coming?" asked again once (§5) | From a chat to a task or plan change | Filing the original document from a card |
| Nearby: catch-up since you last looked, lost-and-found matching, "your question got answers", recommendations summed up (§6) | "What's waiting on me" across chats | Comparing lost-pet photos |
| Home: document readers (photos and PDFs), a year of upkeep, radon followed through, overdue tasks, paperwork dates (§7) | Warning signs on a stranger's first message; translating messages | Forecasts beyond 7 days; a smoke forecast |

**The privacy step** is merging [#2472](https://github.com/WangPantopus/skinny-pantopus/pull/2472) (the privacy policy and data inventory name AI processing and Anthropic) and confirming the Anthropic account's data-retention setting. Only the founder does it. Until then nothing in this wave reads chat messages.

## 2. Rules that hold everywhere

1. **Phase 1's rules hold.** The assistant never writes, the model never writes a request, it sees what the person sees, other people's words are data, and launch flags hold. Since [#2477](https://github.com/WangPantopus/skinny-pantopus/pull/2477), `plans` and `plans_playdates` are on for everyone; marketplace, open gigs and the mailbox stay off.
2. **Speaking first is capped, per person, per local day: one brief and at most two nudges.** Nothing is pushed during quiet hours; it is held until they end, and dropped if it expires first. It never names a pickup day the household hasn't confirmed, and never brings up something the person has already done.
3. **Only people who turned on Suggestions get them** (§3.4). Builds from before phase 2 never set the switch, so their users get no nudges and an unchanged briefing.
4. **Background work reads as the recipient.** Every job builds what it sends with the recipient as the viewer, using the same services and checks as the screens. That covers plan visibility, `canReadPost` and blocks, home permissions and money sections. Other people's words reach the model as quoted data.
5. **No new tables.** Columns are added only where §9 lists them, and every migration is additive.
6. **Every model call is logged and capped.** Background calls write `AIRequestLog` rows with their own `endpoint` names (`brief`, `nudge:<kind>`, `document`, `lostfound`). They share a global daily cap, `AI_BACKGROUND_DAILY_CALLS` (default 3,000), and a per-person cap of 6 a day. The `AI_ASSISTANT=off` switch stops them too. Over a cap, the job sends the plain-text version or nothing; it never sends a half-written brief.
7. **Plain text is the default.** Nudge titles and bodies are written by the server from facts. The model is called only for judgment or drafting: the brief, a lost-and-found match, a draft message to guests.

## 3. Speaking first

### 3.1 A nudge, end to end

1. A trigger (§§5–7) calls the engine: `services/ai/nudges/engine.js`, `sendNudge(...)`, defined in §3.5.
2. The engine checks the Suggestions switch, the kind's mute, the day's cap, the budget and the idempotency key. Then it does three things:
   - creates a **Notification row** (§3.2);
   - adds the nudge to the person's **assistant conversation**, as an assistant message carrying its card (§3.3);
   - sends the **push**, or holds it until quiet hours end.
3. Tapping the push or the row opens the assistant at that message (`pantopus://assistant?nudge=<notificationId>`, §8.2). The card works like any phase 1 card.

### 3.2 The Notification row

| Column | Value |
|---|---|
| `type` | `assistant_brief` or `assistant_nudge` |
| `title`, `body` | Plain text. Title up to 60 characters, body up to 160. |
| `link` | `pantopus://assistant?nudge=<id>`. Older builds route an unknown link to their fallback, but older builds never receive these anyway (§3.4). |
| `metadata` | `{ "kind": "<kind>", "conversation_id": uuid, "subject": { "type": "plan"\|"post"\|"home"\|"task", "id": uuid }, "card": <envelope or null>, "expires_at": iso, "push_deferred_until": iso\|null, "push_sent_at": iso\|null }` |
| `idempotency_key` | `nudge:<kind>:<userId>:<subjectId>:<checkpoint>`. The checkpoint is a local date or a named moment such as `48h`, `24h` or `3h`. A duplicate key sends nothing (`createNotification` already returns null). |

The day's count is taken from these rows: `assistant_nudge` rows created since local midnight. The engine counts a row even when its push is still held. Release held pushes every 5 minutes, using the same pattern as Plans (`planNotifications.js` `push_deferred_until` / `push_sent_at`, released in `planJobs.js`); share one helper rather than writing a third copy. When `expires_at` passes before release, mark the push dropped and keep the row.

### 3.3 In the assistant conversation

The nudge goes into the person's most recent `AIConversation`, creating one if none exists. It is stored in `messages` in the shape a card tool call leaves: an assistant message holding the nudge's line and a tool call, then the tool's result holding the card. So:

- `GET /api/ai/conversations/:id/messages` shows it as an assistant message with its `draft` (action card), under the same `cards` gating as any card;
- the model's next turn sees it, so "move it to Sunday" after a weather nudge just works;
- a card's JSON longer than 4,000 characters must still come back from history. Raise the stored tool-result cap for cards, or store the card under its own key. Phase 1 cuts saved tool results at 4,000 characters (`agentLoop.js`).

### 3.4 The Suggestions switch

Add two columns to `UserNotificationPreferences`:
- `suggestions_enabled boolean NULL`. NULL means never set, and is treated as off.
- `suggestions_muted jsonb NOT NULL DEFAULT '{}'`. It maps a kind to the time its mute ends.

`GET/PUT /api/hub/preferences` read and write `suggestions_enabled`. `PUT` with `suggestions_muted: {}` clears every mute. `draft_notification_settings` gains `suggestions_enabled`.

**In the apps (new builds only):** the first launch of a build that can show these, with `suggestions_enabled` still NULL, shows a one-time notice. It follows the existing BriefingNotice pattern. Text: "Suggestions from Pantopus: a morning brief with buttons, and at most two nudges a day, never during quiet hours." Buttons: **Turn on** (primary) and **Not now**; each sends the matching value. Settings → Notifications gets a "Suggestions from Pantopus" switch, with that sentence as its caption and a "Reset 'Fewer like this'" row.

### 3.5 Engine API (for the Plans, Nearby and Home triggers)

```js
const { sendNudge } = require('../ai/nudges/engine');
const result = await sendNudge({
  userId,                         // recipient
  kind,                           // one of §3.7
  subject: { type: 'plan', id },  // what it is about
  checkpoint: '24h',              // part of the idempotency key
  title, body,                    // plain text
  card,                           // an action-card envelope built with actionCards.js helpers, or null
  expiresAt,                      // Date: never delivered after this
});
// → { sent: true, notificationId } or
//   { sent: false, reason: 'off' | 'muted' | 'cap' | 'duplicate' | 'expired' | 'budget' | 'unconfirmed_pickup' }
```

A card in a nudge is built server-side with the same validation as a chat card, and its `expires_at` is the nudge's.

### 3.6 "Fewer like this"

Every nudge card carries a secondary action, "Fewer like this": `POST /api/ai/nudges/:notificationId/fewer`, with no body. It mutes that kind for the person for 30 days and answers `{ ok: true, kind, muted_until }`. The brief's own "Fewer like this" mutes `brief`; the plain briefing then comes back. Add the route to the allowlist (§8.1).

### 3.7 Kinds

| `kind` | When | To | Card(s) |
|---|---|---|---|
| `brief` | The morning briefing time (§4) | The person | One per line that has an action: `plan_message`, `home_task_update`, `post_solve`, `plan_requests` |
| `plan_weather` | Before a pickup game or a walk-and-coffee: rain at least 50%, wind at least 20 mph, heat at or above 95°F or HeatRisk 3 or more, or AQI over 100 within 3 hours of the start. Checked at 48 h (daily forecast), 24 h and 3 h (hourly). The same condition at the same checkpoint never repeats. | The host | `plan_message` (a draft to guests) and `plan_edit` (move it) |
| `plan_requests_waiting` | Asking closes within 3 hours and requests are still waiting | The host | `plan_requests` |
| `plan_after` | 1 hour after a plan ends, once per plan | The host | `plan_create` (the same plan one week later) and `plan_message` (thanks) |
| `lost_found_match` | A found post and a lost post (or a `missing_pet` heads-up) look like the same animal or item (§6.2) | Both authors, each only if they can read the other post | `post_reply` on the other post |
| `question_answered` | An open question the person asked has 2 or more replies, or one reply older than 12 hours, and isn't solved. At most once per question every 48 hours. | The author | `post_solve`, and `post_reply` (a thanks) |
| `home_overdue` | Weekly, on Monday at the brief time: tasks overdue or unassigned where the person can edit tasks | The person | `home_task_update` per task: done, a new date, assign. Up to 3 items. |
| `home_paperwork` | A warranty, policy or lease date is 30 days away, then 7 days away. Sources: `HomeAsset.warranty_expires_at`, and tasks whose `details.origin` is `document` (§7.1) | Owners and admins | `home_task` (call, renew) |
| `radon_follow_up` | A radon result at or above 4.0 pCi/L with no retest or mitigation task; or "not sure yet" past its date. Facts only, no medical advice. | People who can create tasks in that home | A high result: `home_task` (retest, get quotes). A test past its date: `home_task_update` on that test's task (Mark done, Move to Saturday, and I'll do it when no one has it). As built: the test is already on the list, so the person finishes or moves it rather than adding a second task (decision D5, October 22). |

**These are not nudges.** They are ordinary Plans notifications, not capped. They use the existing plan links and Plans quiet hours:
- `plan_guest_left` (to the host);
- `plan_guest_auto_joined` (to the host, when a rule lets someone in);
- `plan_still_coming_reminder` (to a guest who hasn't answered "Still coming?" 6 hours after it was asked, or 2 hours before the start if that is sooner; once per change).

## 4. The morning brief

- **Without Suggestions** the morning briefing stays exactly as it is: template push, no Notification row, the same Lambda and `internalBriefing.js` route.
- **With Suggestions on**, the same scheduled send composes the brief with the model instead.
  - Input: the Today composition the briefing already gathers, plus plans today, tasks due or overdue, requests waiting on the person, Nearby heads-ups and lost-and-found since they last looked (§6.1), and confirmed pickup days only.
  - Output: up to 4 short lines and up to 3 cards.
  - The send creates an `assistant_brief` row and the conversation message, pushes once, and sets `DailyBriefingDelivery.notification_id`. The claim on that row still prevents double sends.
- **On failure** (model error, over a cap, empty content), the template briefing goes out instead.
- **Fixes along the way:**
  - The briefing push's `link` now opens the brief: `pantopus://assistant?nudge=<id>` with Suggestions, the stored briefing screen without. Today it opens Place.
  - An account with no preferences row is treated as the GET reports it. Today it gets no briefing.
- The evening briefing is unchanged. The scheduler Lambda (`pantopus-seeder`) is unchanged. Its unpaged read stops at 1,000 rows; that is a founder-deploy follow-up, not this wave.

## 5. Plans

- **Outdoor plans.** Nothing in the data marks a plan as outdoors, so weather watch covers `pickup_game` and `walk_coffee` only.
- **Forecast range.** Forecasts reach 24 hours by the hour and 7 days by the day (`weatherProvider.js`), so the 48 h checkpoint uses the daily forecast. AQI is the current reading, used only at the 3 h checkpoint. Reuse the thresholds in `goodDayEngine.js` and `usefulnessEngine.js`.
- **Where the triggers run.** They run in the existing 5-minute Plans tick (`jobs/planJobs.js`), after reminders and host summaries. The 8 AM host summary also says how many requests are waiting.
- **Host notices** (§3.7, not nudges) are added in `planNotifications.js`, next to `plan_changed`.
- **Phase 1 fixes already in flight** in another session: the assistant includes playdates, and `draft_plan_change` reads `going_count`. Don't redo them.

## 6. Nearby

### 6.1 Catch-up since you last looked

- `POST /api/posts/feed/seen` (new, no body) moves the person's Nearby marker to now. It reuses `UserFeedPreference.pulse_nearby_seen_at` through `services/pulse/seen.js` (`advance`, `lastSeen`). The paused Pulse redesign writes the same marker, which is what we want.
  - The apps call it when the Nearby feed appears, at most once every 5 minutes.
- New read tool `catch_up_nearby({ days? })`:
  - Covers posts the person can see since the marker (default 7 days, at most 14), grouped by type with counts.
  - The top items carry their post ids for link buttons.
  - Heads-ups and lost-and-found come first.
- The brief uses the same function.

### 6.2 Lost and found

- **An hourly job** pairs open `found` posts with open `lost` posts and `missing_pet` heads-ups, using these filters:
  - the two posts are within 3 miles of each other (true coordinates, server-side only), and posted within 7 days of each other;
  - their title and text overlap in words (`services/gig/jaccardUtils.js`).
- **One model call per batch** judges each pair "likely" or "unlikely", with a reason. It sees text and dates only, no photos and no exact places.
- **Only "likely" pairs are sent.** A pair is never judged twice within 7 days.
- **The nudge** names neither post's exact place, links to the other post and offers a `post_reply` draft.
- **Blocks** in either direction stop it, and so does a post the recipient can't read.

### 6.3 Your question got answers

Triggered from new comments on an open question (§3.7). The nudge's body summarizes the replies in one line, written by the server from counts and first names (via `localDisplayNames`); the model isn't needed.

### 6.4 Recommendations, summed up

New read tool `find_recommendations({ query })`:
- Searches recommendation posts and their replies that the person can see, within 10 miles and the last 180 days, by the query's words.
- Groups mentions by business or person name, and returns up to 8 with counts and post ids.
- Chat only; never in a nudge.

New tools live in their own module (for example `services/ai/readToolsNearby.js`). Registering them in `tools.js` adds lines and changes nothing else.

## 7. Home

### 7.1 Document readers

- **Upload.** `POST /api/upload/ai-media` also accepts PDFs (`application/pdf`, 10 MB, at most 20 pages, not encrypted). It returns the same `ai-photo:<name>` reference (the name ends in `.pdf`), with delete-after-read and the 15-minute sweep as for photos. A refusal is `{ error: "<readable text>", code }`:
  - 413 `PDF_TOO_LARGE`;
  - 400 `PDF_TOO_MANY_PAGES`, `PDF_ENCRYPTED`, `PDF_UNREADABLE` or `AI_MEDIA_TYPE`.

  The apps show `error`.
- **History.** A user item that carried PDFs has `documents: N` beside `photos` (left out when 0), and the stored "[Document attached …]" note isn't in its `text`. A PDF sent without words asks "What can you tell me about this document?", which history shows as empty text, like the photo question.
- **Chat.** The chat's `images` array may hold PDF references. The server sends a PDF as a document block, as `radonReport.js` does. A PDF it can't read ends the turn with the same error as a photo.
- **Prompt.** The model reads the document in the turn and proposes cards:
  - one card per fact;
  - never repeats account, policy or serial numbers in text;
  - says which page a fact came from;
  - for anything that isn't a home document, says what it is and stops.
- **New card `home_system`.**
  - Request: `PUT /api/homes/:id/systems/:key` with `{ installed_year }`. `:key` is one of `roof`, `hvac`, `water_heater`, `electrical_panel`, `sewer_septic`, `windows`.
  - Offered only where the person has `home.edit` and the home's systems section is unlocked.
  - Lines: System, Installed, From (the document and page).
  - Done: "Saved", with a link to `pantopus://place/<homeId>/your-home`.
- **Dated reminders** use `home_task` with `details: { origin: "document", kind: "warranty"|"policy"|"lease", ends_on, name }`. That is how `home_paperwork` finds them.
  - The key is `origin`, not `source`. The task SQL (`mutate_home_record`) refuses `details.source`, because it marks tasks made from mail.
  - `draft_home_task` now sends `visibility`: the value the server would choose itself, the home's default when the person and the assignee can see tasks at that level, otherwise `members`. The card shows "Seen by" when it isn't the household. (#2507)
- **Appliances.** `POST /api/homes/:id/assets` now needs `assets.manage` and validates its fields (#2499); `GET` needs `assets.view` (#2519).
- **New card `home_asset`.**
  - Request: `POST /api/homes/:id/assets` with `category`, `name` and optionally `brand`, `model`, `room`, `purchase_date` and `warranty_expires_at`.
  - Offered only with `assets.manage`. It never carries a serial number, and the same item twice is refused.
  - Done: "Added". (#2507)

### 7.2 Task updates

- **New card `home_task_update`.**
  - Request: `PUT /api/homes/:id/tasks/:id` with only the changed fields (`status: "done"`, `due_at` or `assigned_to`) and the `x-pantopus-session-scope` header. This is the generic record route in `routes/home.js`.
  - Used by `home_overdue` and by chat ("mark the filter task done").
  - Done: "Updated".

### 7.3 A year of upkeep, and radon

- **"Plan our year".** It answers with one card, `card: "home_year"`, of up to 12 `items`, each a `home_task` with a date, an owner and a repeat. They come from the systems' ages and the region's seasonal checklist (`seasonalEngine.js`, `seasonalChecklistService.js`, read with `yearAhead`, which saves nothing). Each item has its own Add: `POST …/tasks`, then a `then` that starts its repeat. The card has no top-level actions. (#2513)
- **Radon.** It follows the facts on Place: EPA guidance at 4.0 pCi/L, a retest task and a mitigation-quotes task. No medical claims.

## 8. Apps (iOS and Android)

### 8.1 Allowlist additions

| Method | Path |
|---|---|
| PUT | `/api/homes/:id/systems/:key` (`:key` is one of the six system keys above, not a uuid) |
| PUT | `/api/homes/:id/tasks/:id` |
| POST | `/api/homes/:id/assets` (the `home_asset` card, §7.1) |
| POST | `/api/ai/nudges/:id/fewer` |

### 8.2 Links

`pantopus://assistant` (**new**, both apps) opens the assistant thread. `?nudge=<notificationId>` scrolls to that nudge's message. The server adds `assistant` to the link catalog in `appGuide.js`.

### 8.3 What changes on screen

Everything stays inside the existing design: no new tabs or screens.

1. **Settings → Notifications:** the Suggestions switch and the "Reset 'Fewer like this'" row (§3.4), plus the one-time notice on first launch.
2. **Pushes and notification rows** of type `assistant_brief` and `assistant_nudge` open `pantopus://assistant?nudge=<id>`. Rows show title and body like any other row.
3. **The assistant thread** shows briefs and nudges from history. They are ordinary assistant messages with cards, so phase 1's card rendering covers them.
4. **Attach → Document** in the assistant thread sends PDFs through `ai-media` and shows a file chip in the bubble. iOS already offers Document but sends only images.
5. **New card types** (`home_system`, `home_task_update`, `home_asset`, `home_year`) and item cards render with the phase 1 envelope; no special UI. The `home_overdue` nudge sends `home_task_update` as an items card, one row per task with Mark done, Move to Sat… and I'll do it.
6. **Nearby** calls `POST /api/posts/feed/seen` when the feed appears (§6.1).
7. **Android** builds on its phase 1 action-card PR. That PR must be merged first.

## 9. Database (additive only)

- `UserNotificationPreferences.suggestions_enabled boolean NULL` and `.suggestions_muted jsonb NOT NULL DEFAULT '{}'::jsonb` (§3.4).
- No other schema change. `Notification.type` is free text; `Notification.metadata`, `idempotency_key`, `AIConversation.messages`, `UserFeedPreference.pulse_nearby_seen_at`, `HomeSystem` and `HomeTask.details` already exist.
- New migrations sort after master's newest. Name them for what they do; never edit an applied migration.

## 10. Who builds what

Each piece has one owner session, its own worktree and branch, and small PRs. Each session merges its own PRs through the shared HOLD/RELEASE queue (`launch-streams/status/REQUESTS.md`), after green CI and a real-app check. Backend merges release to production through Deploy Backend.

| Session | Owns | Merges |
|---|---|---|
| **Engine** (backend) | §3, §4 and §9:<br>- `services/ai/nudges/engine.js` and the held-push helper<br>- the `internalBriefing.js` brief path<br>- `routes/ai.js` (`/nudges/:id/fewer`, history cards)<br>- `hub.js` preferences<br>- the migration and the conversation append | First. Others rebase on it. |
| **Plans and Nearby** (backend) | §5 and §6:<br>- `services/ai/nudges/plans.js` and `nearby.js`<br>- hooks in `planJobs.js`<br>- the host notices in `planNotifications.js`<br>- the seen route<br>- the new Nearby tools module<br>- the lost-and-found job | After Engine. Its triggers can be built against §3.5 before then. |
| **Home** (backend) | §7:<br>- PDFs in `ai-media` and chat<br>- `home_system`, `home_task_update` and the `draft_home_task` visibility fix in `actionCards.js`<br>- the assets hardening PR<br>- the weekly home jobs | After Engine. |
| **iOS** | §8 on iOS | After the backend parts it shows. |
| **Android** | §8 on Android | After Android phase 1 and the backend parts it shows. |

Shared files (`tools.js`, `actionCards.js`, `agentService.js`, `prompts.js`) take additions only. Whoever merges second rebases. Ask the owning session before changing another area's code. Each backend session updates the question set (`backend/scripts/ai/assistant-questions.json`) for what it adds, and runs it before merging.

## 11. Verification (this wave is done when)

Run against a local backend and database with the live model, on the iOS simulator and the Android emulator, with test accounts:

1. **No switch, no change.** With Suggestions never set, there are no nudges and the briefing is the same template. The one-time notice turns Suggestions on, and Settings still shows it after a relaunch.
2. **The brief.** One push and one row arrive at the set time, for someone with:
   - a plan today;
   - a confirmed pickup tonight;
   - an overdue task;
   - a new heads-up nearby.

   Tapping opens the assistant at the brief. Its buttons work (message guests, mark done). "Fewer like this" brings back the plain briefing the next day. Sent during quiet hours, it arrives when they end.
3. **Weather watch.** A pickup game tomorrow with rain forced in the rig's weather gives the host one nudge, with a message-guests card and a move card. Moving it asks the guest "Still coming?"; check the guest's side. The same checkpoint never nudges twice.
4. **Lost and found.** A lost-dog post and a found-dog post a mile apart reach both authors, each with a link to the other post. A blocked pair gets nothing.
5. **Question answered.** An open question with 2 replies gives the author a nudge. Mark solved works, and the post shows as solved.
6. **Documents.** A water-heater label photo gives a `home_system` card, and Place shows the entered year after a relaunch. A warranty PDF gives a `home_task` for the end date. Later, `home_paperwork` nudges about it.
7. **Limits.** A third nudge in one day is not sent. A nudge that expires during quiet hours is dropped.
8. **Old builds.** A 2.0.1 build (no `action` in `cards`, Suggestions never set) sees no change at all.
9. **Attacks.** A post, a plan note or a document carrying instructions changes nothing (the attack set).

### Results (October 22)

All nine items pass. The server checks ran on October 20 against a local backend and database with the live model (the PR bodies of #2504, #2518, #2525, #2507 and #2517); item 6 ran again on master `a65661ee6` on October 22. The phone checks ran on October 22 on builds whose app code equals master `2fc6ec5ed`, against the same kind of backend with the live model. Where an item has a push, the phone opened it from a real APNs or FCM push.

| Item | Server | iOS simulator | Android emulator |
|---|---|---|---|
| 1. No switch, no change | Passed | Passed (October 20, and again on the merged heads on October 21) | Passed (October 20) |
| 2. The brief | Passed | Passed: the row and the push open the assistant at the brief; Send reached the plan chat and the guest saw it; Mark done finished the task; after "Fewer like this" the next brief was the plain briefing, whose push opens Today | Passed: the push opens it; Send; "Fewer like this" from the card, then the plain briefing |
| 3. Weather watch | Passed | Passed: one nudge; Save changes moved the game and the guest answered "Still coming?"; a second check sends nothing | Passed |
| 4. Lost and found | Passed | Passed: both authors, about a mile apart, and nothing for the blocked pair; Reply, and the card then opens the other post | Passed |
| 5. Question answered | Passed | Passed: Mark solved, and the other person sees it solved | Passed |
| 6. Documents | Passed | Passed (October 20, and again on October 22) | Passed (October 20, and again on October 22) |
| 7. Limits | Passed | Passed: a third nudge in a day is refused, the list shows two, and a nudge that expired in quiet hours keeps its row and sends no push | Covered by the server and iOS |
| 8. Old builds | Passed | Passed (2.0.1) | Passed (2.0.1) |
| 9. Attacks | Passed | Passed: the post and the document | Passed: the post and the plan note |

Not checked: a brief sent by the scheduler at its set time (every brief here went through the same route by hand, with jobs off), a push held through quiet hours arriving on a phone, physical phones, and staging or production.

Found while checking, not fixed here: "Fewer like this" goes away once the brief's last card is used, as it does on an expired card.

Sources for this contract:
- `backend/routes/internalBriefing.js`, `backend/services/notificationService.js`, `backend/services/plans/planJobs.js` and `planNotifications.js`
- `backend/services/context/weatherProvider.js`, `backend/services/feedService.js`, `backend/services/pulse/seen.js` and `lifecycle.js`
- `backend/routes/upload.js` (`ai-media`), `backend/services/ai/photos.js`, `radonReport.js` and `actionCards.js`
- `backend/routes/placeIntelligence.js` (systems), `backend/routes/home.js` (tasks, assets)
- the October 20 research notes in this repository's PR description
