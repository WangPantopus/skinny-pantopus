# PC status: Channels and public web

Owner: the PC session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- October 13, 2026: read the briefing pipeline end to end and wrote the digest design note (below). Nothing is built; building starts when R2 begins.
- Ran the two channel paths once on my own `pc` stack (a synthetic account, nothing real sent) to check what the kit assumed. A push with no provider credentials returns `acceptedCount: 0` and logs no payload; an email with no SMTP returns `EMAIL_UNAVAILABLE`. Neither can be seen locally today. See Findings 1 to 3.
- October 13, 2026: the design note merged ([PR 2256](https://github.com/WangPantopus/skinny-pantopus/pull/2256)). The founder answered the decisions it raised; they are recorded under "Decided by the founder" below.

## Next

- Wait for R2 to start (about week 3). First thing in R2: the noise-budget module, its one seam in `notificationService.js`, and the digest tick with only its held-push release step (quiet hours and the direct and never classes need no table; the Lambda call and the route seam come with it). PB's first Pulse push, the day-6 `ask_still_open` in S7, lands earlier than the digest, and the gate must merge before the first release cut so that push is held overnight. PB changes nothing: the gate recognizes the types in contract section 6. The founder has approved my making the six seam edits myself, one small PR each, with PB as reviewer; none is started before R2.
- Then S13: the migration (needs H3), the preference handlers, the digest tick with the email and push templates, unsubscribe, and the weekly street digest (quiet until a street opens). S15 after H2. S18 after the founder's provider accounts.

## Requests (to other streams)

- → **PB**, S13 content (blocks the digest, R3). Three in-process functions that use the same predicate as `GET /api/pulse/feed` (`canReadPost`, mutes, blocks, hidden, held and removed items, open areas only). None of them advances a seen marker. Tell me the module names when S6 and S10 land:
  1. `digestPosts(viewerId, { since, until, limit })` → street, neighborhood and town groups of `PulsePost`, newest first, plus the total new count.
  2. `unansweredForHelper(viewerId, { minAgeHours, limit })` → open Asks with no replies, in topics the viewer follows.
  3. `followRecaps(viewerId, { since })` → followed conversations with `notify` of `recap` or `each` that got replies, with the new `PulseReply` rows. Also `getSeenMarker(viewerId, view)`.
- → **PB**, notification type names: contract section 6 names none for follow alerts (`notify = each`) or for Right now. Tell me the names so the noise-budget registry lists them as budgeted and right_now.
- → **PB**, small seams in files you own. The founder approved on October 13 that PC makes each one, in its own small PR with PB as reviewer, when its slice starts (each is a few lines). If you already have changes in flight in one of these files, tell me which and I will build on them:
  1. `pantopus-seeder/src/handlers/briefing.py`: after the briefing loop, one call to `POST /api/internal/briefing/digest-tick`, plus the digest counts in the run summary and metrics (about 20 lines).
  2. `backend/routes/internalBriefing.js`: `router.post('/digest-tick', verifyInternalApiKey, …)` that calls my job (about 6 lines).
  3. `backend/services/notificationService.js`: in `createNotification` and `createBulkNotifications`, ask `noiseBudget.pushDecision(...)` before `pushService.sendToUser`. Types it does not know behave exactly as today (about 12 lines).
  4. `backend/services/emailService.js`: let `sendEmail` take a `headers` option (3 lines), for `List-Unsubscribe`.
  5. `backend/services/push/dispatch.js`: a local-only `PUSH_DELIVERY_MODE=log` sink, guarded like `EMAIL_DELIVERY_MODE=log` (`APP_ENV=local`), that logs the payload without tokens and counts the device as accepted. It gives every stream the push payload log the kit assumes (about 15 lines).
  6. `backend/app.js`: mount my `/api/pulse/preferences` router and the digest unsubscribe route (2 lines), unless your `pulse.js` mounts them.
- → **PB**, contract PR (I open it): the final `DigestDelivery` columns (section 7), an additive `channels_available` on `GET /api/pulse/preferences`, and the digest push `data` shape (section 5).
- → **PV**, `scripts/pulse/stream-runtime.sh`: (1) write `PUSH_EXPO_ENABLED=false` into the generated `.env`. Unset means on, so an Expo-shaped token in a local stack makes the backend call Expo. (2) Expose the mail inbox's SMTP port (`smtp_port = B+5`) and write `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` into `.env`, so backend email lands in the stream's inbox. Today only Supabase Auth's mail does.
- → **PS**: none yet. I read posts only through PB's functions, so held and removed states are honored there. Tell me if the digest needs a separate hook.
- → **PI, PA**: none now. The S10 preferences screen reads and writes `GET|PUT /api/pulse/preferences` (contract 2.9). The digest push opens `/app/pulse`.

## Needs founder

1. Still open from the README: tick **New tables** (this slice adds `DigestDelivery`, H3) and confirm **moderation cover** before the public pages (H2).
2. **Later, before any real send** (acknowledged October 13; not needed now): the digest's sender address and Postmark message stream, and whether SPF, DKIM and DMARC for pantopus.com already cover this kind of mail. Nothing is sent until you set it.

Defaults I am using where the kit was silent. Tell me to change any:

- The digest and the morning and evening briefings stay separate opt-ins. The digest leaves out a home item a briefing already pushed in the last 24 hours.
- Nothing new means nothing sent: no "quiet day" email.
- Street and neighborhood posts appear in the email as 140-character excerpts, because the reader is a verified neighbor. Never photos, distance or house numbers.
- "Still unanswered" draws only from topics the person follows, once per Ask.
- New digests default to 8:00 AM by email. The weekly street digest goes Sunday 10:00 and stays quiet until a street opens.
- No AI text, and no open or click tracking.

## Decided by the founder (October 13, 2026)

1. **Seam edits.** PC makes the six small edits in PB-owned files itself, one small PR each, with PB reviewing. They start with their slices (the first ones when R2 starts), not before.
2. **Quiet hours for people who never set any:** 9 PM to 8 AM in their own local time, for Pulse pushes. A person's own setting always wins.
3. **Existing pushes** ("Neighborhood milestone reached", `density_milestone`, and the monthly summary): leave them alone. They are not registered under the noise budget.

## Digest design note (S13), October 13, 2026

### In short

- The digest rides the briefing Lambda's 15-minute tick. The Lambda gets one more call; everything else is Node. No second scheduler.
- It is one email and/or one push at the person's chosen time. It lists what is new, ends with "You're caught up" only when that is true, and sends nothing when nothing is new.
- The noise budget and quiet hours are one module, `noiseBudget.js`. One seam in `notificationService.js` makes every Pulse push ask it first.
- `DigestDelivery` is the idempotency ledger and also holds the day's single budgeted push, so the cap is a database constraint and not a convention.
- No AI text, no open or click tracking, no unread badge, no neighbor text on a lock screen.
- The defaults I chose where the kit was silent are listed under "Needs founder".

### 1. How the pipeline works today

Read in full, and the two channel paths run on the `pc` stack.

- **Clock.** EventBridge runs `pantopus-briefing-scheduler` every 15 minutes (`pantopus-seeder/src/handlers/briefing.py`, 300 s timeout). It reads the preference rows, keeps people whose morning or evening time is within 15 minutes of now in `daily_briefing_timezone`, drops quiet hours and anyone with a delivery row today, and calls `POST /api/internal/briefing/send` once per person (at most 100 per run, 30 s each).
- **Send.** `backend/routes/internalBriefing.js` checks the opt-in and quiet hours, claims a `DailyBriefingDelivery` row (unique on user, local date and kind), composes through `composeScheduledBriefing` (weather, air, alerts, household records, the address calendar, then `rankSignals`; one lead signal that must pass the interrupt gate), re-checks household access, and pushes. It counts as sent only when a provider accepted at least one device. The daily cleanup Lambda purges rows older than 30 days, resets stuck `composing` rows and retries each failure once.
- **Channels.** Briefings are push only. `emailService.sendEmail` is nodemailer over SMTP (Postmark in staging), with no headers option. `smsService.sendSms` only logs.
- **Quiet hours** exist in four copies (`briefing.py`, `internalBriefing.js`, `mailDayNotification.js`, `plans/planNotifications.js`). `createNotification` and `createBulkNotifications` check none of them: they push at once, at any hour.
- **Prior art reused below.** Plans already holds pushes in quiet hours (`push_deferred_until` on the notification, released by `planJobs.js`) and claims every send first.

### 2. Reuse the briefing scheduler (no second scheduler)

```
EventBridge, every 15 minutes
  → briefing.py (morning and evening: unchanged)
      └ new, last step: POST /api/internal/briefing/digest-tick   (x-internal-api-key)
          → backend/jobs/pulseDigest.js  runPulseDigestTick({ now })
              1. find people whose digest is due (a SQL filter, not a scan of every row)
              2. per person: claim a DigestDelivery row → compose → send each channel → record
              3. release held pushes whose quiet hours ended; purge rows older than 30 days
```

- **Why Node picks the people.** One time-zone implementation (Intl, as Plans does) instead of a second one in Python. `now` can be forced for local runs and daylight-saving tests. A SQL filter on `digest_enabled` replaces reading every preference row: the Lambda's select has no range, so at the API's 1,000-row limit it would silently stop.
- **Due.** The person's local time is at or after `digest_time_local` and less than 3 hours past it, and no delivery row exists for that local date and channel. A late Lambda cannot lose the day, and a digest is never early (the briefing window is plus or minus 15 minutes, so it can be).
- **One evaluation a day.** The first tick in the window composes and decides. Nothing new is recorded as `skipped` and nothing is sent that day, even if a post arrives later in the window. Turning the digest on after the chosen time but inside the window sends once, at the next tick.
- **Daylight saving.** The due test compares wall-clock time in the person's zone and the unique key is the local date, so the repeated hour in the fall cannot send twice and the missing hour in the spring cannot skip a day.
- **Work per call.** At most 40 people or 20 seconds, whichever comes first; the rest wait for the next tick (the 3-hour window is 12 ticks). The call returns `{ due, sent, held, skipped, failed, remaining }`. A forced `now` in the body is honored only when `APP_ENV=local`.
- **Fallback** if PB prefers not to touch `briefing.py`: one EventBridge rule on the existing generic job trigger (`/api/internal/jobs/pulse-digest`). Same Node job, but a second rule.

### 3. Content and order

| # | Section | Source | Rule |
|---|---|---|---|
| 1 | For your home | The Hub Today pipeline (`collectInternalContext`, address calendar, alerts, AQI) | Up to 3 lines: alerts, pickup today or tomorrow, tasks due. Bills and the family calendar only while their launch flags are on. No weather chatter and no seasonal tips. Skipped if a briefing already said it today. If the household re-check fails, only this section is dropped. Household data stays here and never goes into Pulse. |
| 2 | Your plans | `Plan` and `PlanRequest` through the Plans services | Requests waiting on me as host, "Still coming?" after a change, plans I am in that happen today. Only what needs a decision or happens today. |
| 3 | New around {Town} | PB `digestPosts` | Street, then neighborhood, then town (open areas only), newest first. At most 8 posts, at most 3 per walled group. Each line: first name, label, topic, a 140-character excerpt, reply count. No photos, no distance, no house numbers. |
| 4 | Replies you asked to hear about | PB `followRecaps` | Follows set to "Daily recap of new replies" or "Notify me about each update". The second group is here so an alert the budget dropped still reaches the person. |
| 5 | Still unanswered | PB `unansweredForHelper` | At most one Ask, older than a day, no replies, in a topic the person follows; each Ask is shown to a person once. Off when `nudge_helper` is false. |
| 6 | The end | | Section 4. |

- **Send rule.** Send when any of sections 1 to 5 has content; otherwise record `skipped: nothing_new`. Home items alone are enough.
- **What counts as new.** `since` is the later of the end of the person's last digest window and their in-app seen marker for Nearby, never more than 48 hours back; `until` is now. The digest never advances the in-app marker: reading an email is not seeing the page.
- **Nothing is invented.** Every line is a row the person can open. No counts of how active the town is, no AI text, no "trending".
- **Order comes only from choices the person made** (area, topics, follows, time), as on the page. A Heads-up gets no priority; Right now is the urgent path.

### 4. The ending line

Same copy as the page: **You're caught up** and **That's everything new around {Town} since {this morning | yesterday | Tuesday}.** The day word is computed in the person's zone.

It is said only when true. If the cap cut posts, the end reads "{N} more around {Town}" with an Open Pulse button, and there is no "caught up". Nothing follows the end except the footer: no "you might like", no invite-a-friend, no app-download banner.

### 5. What each channel carries

| | Email | Push |
|---|---|---|
| Content | All sections, in order | One notification. Title `Around {Town}`; body counts plus the top home item, at most 100 characters, for example "3 new conversations · Recycling pickup is tomorrow" |
| Neighbor text | Excerpts, as in section 3 | None. No names or post text on a lock screen |
| Subject or title | `Your {Town} digest · Wed Oct 14`: no counts, no hooks | As above |
| Links | Each post links to its share URL (`/posts/{id}`): the apps open it, the signed-in web redirects to `/app/feed/post/{id}`, signed out gets the public page or the sign-in card. One "Open Pulse" button | `data: { type: 'pulse_digest', link: '/app/pulse', route: '/app/pulse', recipient_user_id }` |
| Format | HTML and plain text, light and dark, existing email styling | No `Notification` row, so no unread badge. The exact payload is stored on the delivery row |
| Footer | Why you got it, "Change time or channel", one-click unsubscribe (section 8) | — |
| Honors | The digest opt-in and channel, and the account switches `MailPreferences.email_notifications` (email) and `push_notifications` (push) | The same, plus having a push token |

The text channel is not part of the digest. S18 is street-level asks and offers to text-only neighbors who replied first.

### 6. The noise budget and quiet hours: one module

`backend/services/pulse/digest/noiseBudget.js` is the only place that decides whether, when and how often Pulse may push. The digest, follow alerts and every Pulse notification ask it; nothing else holds this policy.

| Class | Types (contract section 6 is the source) | Rule |
|---|---|---|
| direct | `post_commented`, `comment_replied`, `pulse_helpful`, `pulse_thanks`, `offer_request`, `offer_chosen`, `offer_gone`, `ask_still_open`, `pulse_moderation_notice` (plan decisions are direct too; Plans keeps its own equivalent hold code and is not touched) | Pushed at once, held overnight, no daily cap |
| budgeted | the digest push, the weekly street digest, follow alerts (`notify = each`) | Held overnight; **one push per person per local day across the whole class** |
| right_now | Right now updates (R3), official severe alerts | Not held by quiet hours; not capped; never for crime |
| never | "someone posted near you", trending, unread-count nags, re-engagement | Never pushed; asking for a push of this class logs and drops it |

- **Decision.** `pushDecision({ userId, type, now })` returns `send`, `hold(until)` or `drop(reason)`. The in-app row always exists, so a dropped follow alert is still in the list, and its replies appear in the next digest's section 4.
- **Where it is enforced.** The seam in `createNotification` and `createBulkNotifications` (before `pushService.sendToUser`), the digest sender, and a release step in the digest tick for held pushes. Held pushes use Plans' `push_deferred_until` and `push_sent_at` keys, so there is one convention. Types the module does not know are untouched, so no existing flow changes.
- **The cap is a constraint.** A budgeted push first claims the person's slot for the local day by writing a `DigestDelivery` row with `push_budget_date`, which has a unique index on `(user_id, push_budget_date)`. The loser of a race gets a unique violation and is dropped. A push that provably did not go out releases its slot.
- **Quiet hours.** Built on Plans' DST-safe `localParts` helper, not a fifth copy of the arithmetic. The window is the person's own `quiet_hours_start_local` and `quiet_hours_end_local`, read in their `daily_briefing_timezone`. A window past midnight wraps; start equal to end means none. Unset means 9 PM to 8 AM in their local time for Pulse pushes (decided October 13). Email is never held: quiet hours govern pushes.
- **The digest and quiet hours.** If the chosen time falls inside quiet hours, the digest push is held to the end of quiet hours and sent if that is still inside the 3-hour window; otherwise it is skipped as `quiet_hours_window_passed`. The email is unaffected.
- **The four older copies stay as they are.** Retiring them into this module is a separate follow-up (it also fixes `internalBriefing.js` comparing time strings, which misses the exact start and end minute).

### 7. Idempotency and data

**`DigestDelivery`** (new table, needs H3). Server-only, RLS on, no client grants, follows `scripts/db/check-migrations.cjs`. The contract's sketch grows to this, because the cap and the retries need it:

```
id                uuid primary key
user_id           uuid not null, references "User" on delete cascade
kind              text   daily | weekly_street | follow_alert
period_start      date   the person's local date (weekly: the local Sunday)
channel           text   email | push
status            text   claimed | held | sent | skipped | failed
skip_reason       text   nothing_new · no_area · email_off · push_off · no_push_token ·
                         quiet_hours_window_passed · budget_used · …
attempts          smallint not null default 0
window_start, window_end   timestamptz    what "new" meant for this digest
item_count        int not null default 0
included          jsonb  post ids only (new, recap, unanswered); no text
payload           jsonb  push: title, body, data. email: subject. No tokens, addresses or post text
hold_until        timestamptz            a push held by quiet hours
push_budget_date  date                   set when this row used the day's one budgeted push
claimed_at, sent_at, created_at
unique (user_id, kind, period_start, channel)
unique (user_id, push_budget_date) where push_budget_date is not null
```

- **Claim before send.** Insert the row (unique key); a conflict means someone has it, so stop. Compose, send, then update to `sent`. Crashing between the provider accepting and the update leaves a `claimed` row, which is never re-sent: a missed digest is better than a duplicate. A stale `claimed` row is closed as `failed` with reason `stale_claim` and is not retried.
- **Retry.** Only a failure we know did not send (transport error, zero devices accepted) is retried, on later ticks inside the window, at most 3 attempts. After the window it stays `failed`.
- **`both` is two rows**, one per channel, so a failed push never re-sends the email.
- **Retention.** The tick deletes rows older than 30 days (the briefing cleanup Lambda does not know this table).
- **Why not `DailyBriefingDelivery`.** Its reads feed the briefing ranker's history, its unique key has no channel, and its `briefing_kind` and `composition_mode` checks describe briefings. A new table avoids touching all three. If the table approval slips, the fallback is two new kinds on that table with the history query filtered.

**Columns on `UserNotificationPreferences`** (one additive migration, as the contract lists): `digest_enabled boolean not null default false`, `digest_time_local time not null default '08:00'`, `digest_channel text not null default 'email'` (check: `email`, `push`, `both`), `weekly_street_digest_enabled boolean not null default false`, `nudge_helper boolean not null default true`. There is no digest time-zone column: the digest uses the existing `daily_briefing_timezone`, as the contract's `digest.timezone` implies.

### 8. Preferences and unsubscribe

- **`GET|PUT /api/pulse/preferences`** (contract 2.9) is a thin mapping onto the columns above: `digest.enabled`, `digest.time_local` (HH:MM), `digest.timezone` (the existing `daily_briefing_timezone`), `digest.channel`, `weekly_street_digest`, `quiet_hours` (the existing columns, same validation as `PUT /api/hub/preferences`), `nudge_helper`. Partial updates. When no row exists yet it is created the way `PUT /api/hub/preferences` creates it (including its saved-places-only rule for the evening briefing), so saving a digest preference cannot switch an evening briefing on for someone the hub would have left off. The handler copies those few lines, and PB is asked to extract them into a shared helper. The response also says which channels are available (`channels_available`, additive) so a screen can explain "Email notifications are off in Settings". New files, all mine: `backend/routes/pulsePreferences.js`, `backend/routes/publicPulseDigest.js`, `backend/services/pulse/digest/*`.
- **Unsubscribe.** Every digest email carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` pointing at a signed link: `v1.{userId}.{kind}.{expiry}.{HMAC-SHA256}`, with the key derived from the existing `JWT_SECRET` under a fixed label, so no new secret and no JWT that could pass as a session token. A POST turns the email channel off (`both` becomes `push`; `email` becomes disabled). A GET opens a small public page, `/digest/unsubscribe`, that confirms and offers Undo; it is the only new web page before S15, and a person must be able to unsubscribe without signing in. A bad or expired link changes nothing. The only one-click unsubscribe in the repo today is for booking reminders; the monthly receipt links to signed-in Settings.

### 9. Privacy rules for the digest

- **Reader checks.** Every post is read through PB's functions, so the wall, mutes, blocks, holds and removals apply exactly as on the page. The privacy matrix's "a digest or notification that quotes the post" row is run on every digest PR.
- **Walled content in email.** Street and neighborhood excerpts go only to verified neighbors of that area, with no photos and no house numbers. A forwarded email can leak them; the footer says the email is for the recipient.
- **Lock screens.** Push carries counts and the home item, never neighbor text.
- **No tracking.** No open pixel, no click redirects, no per-link parameters. "Notification open rates" are a never-goal.
- **Logs and storage.** No post text or addresses in logs or in `DigestDelivery`. User ids are shortened in logs, as the Python scheduler does.
- **Household.** Home items come only from what the person can already see on Today. Another member's private tasks never appear.

### 10. How I will verify (nothing real is sent)

The standard is the founder's: no test code, every scenario run in the real surfaces. For S13 that is `05-scenarios.md` S13.1 and the cross-cutting checks A1, A3 to A5 and A7 to A12 and A14, run by hand against my own backend and database; A2, A6 and A13 where a surface exists (the unsubscribe page, the push's deep link once S3 lands). Each PR ends with `Scenarios run: …` and what could not be verified.

- **Two accounts** with different times, time zones and channels, on my own `pc` stack. The job runs with a forced `now`, and a second run sends nothing.
- **Time:** the due window and the 3-hour catch-up; the fall-back day (November 1, 2026) and the spring-forward day (March 14, 2027) send exactly once; a person with a missing or invalid time zone gets the Pacific default, as the briefing does.
- **Quiet hours:** the push is held and released at the end; the email is not held; a digest time inside quiet hours.
- **Budget:** a follow alert after a digest push the same day is dropped and the in-app row stays; the next local day it works; Right now is not held; two budgeted pushes at once leave one winner.
- **Content:** nothing new sends nothing; a muted topic, a blocked person, a held post and a removed post are absent; a second account that is not a neighbor never sees street items; a legacy post type renders as a plain line; a deleted post is gone; caps and "N more" are honest.
- **Email:** the HTML, the plain text and light and dark rendering in the local inbox once the stack can deliver to it (Finding 3); links open the post signed in on the web and the right card signed out; one-click unsubscribe works, a tampered or expired link does nothing, Undo works.
- **Push:** the payload recorded on the delivery row (and in the log once the sink exists) holds counts only and the right link; the web and the apps' cold and warm starts open `/app/pulse` once S3 lands.
- **Old data:** a person with no preference row, no home, no town, and an old-style account. The existing web Pulse feed and post page still load.
- **Cannot be verified here:** real inbox delivery and how Gmail, Apple Mail and Outlook render it; Postmark deliverability and spam placement; real APNs and FCM delivery and the lock-screen look on physical phones; the S10 preferences screens (they are PI and PA's) until they exist, so until then preferences are checked through the API.

### 11. Findings from reading (not mine to fix)

| # | Finding | Owner |
|---|---|---|
| 1 | **There is no push payload log.** `push/dispatch.js` logs one debug line ("provider not configured") and never the payload. With no credentials a push returns `acceptedCount: 0`, which the briefing treats as a failure (503), so no push can reach `sent` locally. Ran on `pc`: `{"acceptedCount":0,"unresolvedCount":1}`. The "push payload logs" the kit relies on (my brief, `05-scenarios.md` A12) do not exist yet. | PB, PV |
| 2 | **Expo push is on unless `PUSH_EXPO_ENABLED=false`**, and the runtime script's `.env` leaves it unset. A local account with an Expo-shaped token would make the backend call Expo's servers. I set it to false in my local env. | PV |
| 3 | **Backend email cannot reach the local inbox.** With no SMTP the result is `EMAIL_UNAVAILABLE`; `EMAIL_DELIVERY_MODE=log` logs one line and delivers nowhere. The inbox (Mailpit) receives only Supabase Auth's mail and its SMTP port is not exposed to the host. | PV |
| 4 | **Quiet hours: four copies, and the main push path checks none.** `createNotification` and `createBulkNotifications` push at once at any hour, and the main push path has no per-person daily cap. | PB |
| 5 | **Two existing pushes look like what the budget forbids:** `density_milestone` ("Neighborhood milestone reached", not launch-cut) and the monthly summary. | Founder: leave them (decided October 13) |
| 6 | **The briefing scheduler reads every preference row with no range.** At the API's `max_rows` of 1,000 it stops silently. Not urgent at pilot size. | PB |
| 7 | **The public post page** `frontend/apps/web/src/app/posts/[id]/page.tsx` reads the general post endpoint and shows `creator.name` first, then the location name and the creator's city and state. Every page outside `robots.ts`'s private list is crawlable in production. S15 reads PB's public endpoint only, shows first name and label, and moves `robots` to an allowlist. | PC at S15 |
| 8 | **Unsubscribe:** only booking reminders have a one-click link; the monthly receipt sends people to signed-in Settings. | PC (section 8) |

### 12. Notes for the later slices

- **S15 (after H2).** New routes under `frontend/apps/web/src/app/`: a town page, a post page, `sitemap.ts`, `robots.ts` as an allowlist with `noindex` elsewhere. Post pages use no-store reads, as `/posts/[id]` does, so a post removed from the web view disappears at once; town pages revalidate for about a minute with a per-section timeout so one slow query cannot block the page. Same patterns as the Plans share page (`force-dynamic`, `OpenInAppButton`, `buildShareMetadata`). The privacy matrix's signed-out rows run on every public PR.
- **S18 (needs the founder's accounts).** Text: `smsService.sendSms` is a logger today. The consent rules (only people who replied first, STOP always honored) need a provider webhook route and some stored state. Whether that fits columns on the existing preferences table or needs a small new table, I will say before the founder is asked for an SMS account. Reply-by-email: the signed inbound route `/api/internal/email-inbound` (SES, Lambda, HMAC) already exists for persona support. A second recognizer for `reply+{token}@` addresses goes in front of the persona router, with tokens bound to a person and a post. The founder confirms the SES receipt rule is live and `EMAIL_INBOUND_HMAC_SECRET` is set before this starts.
