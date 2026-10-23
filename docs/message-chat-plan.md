# Chat reliability and latency repairs — October 23, 2026

**Continuation handoff:** [Messages / Chat performance handoff — October 23](chat-performance-handoff-2026-10-23.md) records the final PR inventory, exact artifacts, remaining work and next-session prompt. Later verification distinctions in that handoff supersede progress statements below.

The founder requested repairs in the real web, iOS and Android apps, preserving the current design, with no unit tests or coverage work. This section tracks the current work; the older inventory below is background and contains items already shipped.

Ownership: `codex/chat-reliability-backend` owns backend/database integration; `codex/chat-web-reliability`, `codex/chat-ios-reliability` and `codex/chat-android-reliability` own their clients. Shared TypeScript chat API changes belong to the web session. Other open LocalProfile/security work is preserved. No hosted configuration or database changes are part of local verification.

## Full person-conversation scope

Person history, changes, search, mute, read and sender unread echoes now share a room lookup that
filters both active members before paging by room ID. Intersecting two capped
membership lists could omit a conversation after 1,000 unrelated rooms. The
new lookup also keeps assigned-task access checks and rejects a self pair.
Database lookup failures remain retryable rather than masquerading as an empty
conversation.

A local 1,031-room fixture reproduced the loss: the old query returned 1,000
rows and omitted the new shared room. Real API history/search recovered its
message, preferences covered both shared rooms, mute/unmute persisted, and
bounded read updated both rooms. The temporary rooms were removed afterward.
Syntax and the four existing identity-select guards passed. Actual web person
mute/unmute survived reloads, and send/read passed. Android sent and received,
showed the sender's Read receipt, and retained both messages after relaunch.
iOS send/peer reply passed; a later visible-message acknowledgement gap was
found in iOS and is being repaired in its owning client PR.

## Typing across API processes

Typing start/stop now shares the existing Postgres notification connection,
carrying only room/user IDs, state, time and a process nonce. It is best-effort
and expires after five seconds; pending work and database publish queues are
bounded. Each receiving API process checks current membership, blocks and task
eligibility before emitting to its local subscribers. Business staff keep
receiving customer typing after a fresh authority check, but never broadcast
their personal identity as the business. Both start and stop are limited to
30/minute, allowing clients to refresh at three seconds before a five-second
indicator expires.

Real Socket.IO clients on two local API processes received one start and one
stop each. Blocked/revoked members received none. A business owner received the
customer indicator, their own typing emitted nothing, and revoking staff
permission suppressed subsequent indicators. Temporary fixture rows were
removed. Syntax and all four identity-select guards pass. Actual web typing
passed in both directions with three-second refreshes and clear/send/idle stop.
iOS showed continuous incoming typing for 29 seconds; Android for 54 seconds,
then both cleared it on stop.

## Preference changes on another device

`chat:preferences_changed` carries only `{at}` and invalidates the current
identity's active chat preference readers. It is emitted after room mute or
person mute commits, using the existing database notification trigger and
coalesced listener. Other conversation participants receive no preference
signal. Currently authorized business staff receive their business's signal;
revoked staff do not. Ordinary message/read updates do not cause preference
refetches. Foreground/reconnect still refreshes if a transient signal was missed.

The additive local migration passed transaction rehearsal and complete
application-function lint before being applied. Real two-process API/socket
checks observed exactly two own-account signals for mute/unmute, zero peer
signals, and no additional signal for reading. Business-owner receipt and
revocation suppression passed. Syntax, migration policy and identity-select
guards passed. Two actual browser tabs of the same account updated their mute
icons live in both directions; native adoption is in the client follow-ups.

## Presence across API processes

Online status now uses the existing Postgres notification connection with
per-process leases, combined across a person's devices. Opening a room asks for
already-connected peers; the existing `user:online`/`user:offline` events remain
the client contract. Normal last-device disconnects update immediately. A
crashed process expires after 45 seconds, checked every 15 seconds; presence
is approximate, never proof of message delivery. No last-seen activity is stored.

Only room subscribers receive status, after current membership,
blocks, task eligibility and business authority checks shared with typing.
Business staff never broadcast their personal identity in a customer's room.
Work queues, tracked leases and subscribed rooms are bounded, and messages do
not wait for presence. Native clients clear stale online state on their own
connection loss. The current presentation is preserved.

Two real local API processes passed initial already-online discovery, remote
reconnect, one-device disconnect without a false offline, last-device offline,
blocked-peer suppression and revoked-member suppression. Abruptly stopping the
isolated source process cleared its online status after 52 seconds. Actual
Android reopening an already-online peer showed Active now, and the peer's
last disconnect removed it. A subsequent peer message arrived once and the
sender saw Read. The iOS header check remains pending. Syntax and four
identity-select checks passed. No test code was added or modified.

## Bounded latency observations

Chat latency histograms now use fixed 4,096-slot rings and discard observations
older than five minutes on snapshot reads. This removes traffic-dependent
array growth and repeated array-shift cleanup. Snapshots retain existing
percentile fields and add the sample capacity, window and whether the sample
limit was reached; these in-memory samples are not production-wide metrics.

Real local API reads passed in twelve repetitions each of room list, room
history and unified inbox. The metric endpoint returned twelve observations
per route with the new bound metadata. This small local run is a functional
check, not a production latency benchmark. Syntax and diff checks passed.

## Complete room and business inbox pages

The older `/chat/rooms` and `/chat/business/:id/rooms` readers now order all
eligible rooms by latest message activity before limiting, and filter type
before paging. Previously an active older conversation could be excluded by
its membership's join date. Existing rows remain; additive fields are
`hasMore` and `nextCursor`, with `before=<timestamp>|<room UUID>` for the next
page. Limits are clamped to 1–500 (default 200). `total` and `totalUnread`
describe the complete eligible, type-filtered inbox, not only the current page.

An overload of the existing service-only room reader returns page memberships
and totals in one database snapshot. Preview seeks reuse existing indexes.
Counterparty reads use at most 100 room IDs per URL; failed identity/preview
dependencies return retryable unavailability instead of replacing cached rows
with incomplete data. Current business and assigned-task access checks remain.

The additive migration passed a transaction rehearsal, complete function lint,
migration policy and four identity-select guards, then was applied and recorded
only locally. Real API checks used 531 personal and 531 business fixture rooms:
both old readers omitted the newly active older room, both new readers placed
it first, 500-row pages and subsequent pages recovered every room once, totals
were stable, type filtering preceded the limit, malformed cursors returned 400,
and a nonowner received 403. Fixtures were removed. Real client pagination
adoption and screen verification remain in progress; no test code was changed.

## Delayed insert timestamps

A local concurrent-transaction check reproduced a new message incorrectly
falling behind the read boundary: PostgreSQL's `now()` default used the old
transaction start time, and the message arrived with unread count zero. The
existing revision trigger now fills omitted creation times with the database
clock after acquiring its room lock. No extra history scan or lock is added.
Explicit historical timestamps remain unchanged, including microseconds.

The additive migration passed full function lint and transaction rehearsal
before local application. Repeating the delayed transaction kept the new
message after the read boundary with unread count one. Its synthetic rows were
removed. Existing app send and receive flows are being rechecked. Separately,
person conversations spanning several rooms need a visible boundary per room;
the previous global timestamp could acknowledge another room's unseen history.

## Visible read boundaries for each room

Room and person read endpoints now accept `throughMessageIds`, a map from room
ID to the newest accepted message actually visible in that room. They also
accept the existing `throughMessageId` as an older-server fallback; when both
are supplied that ID must be in the map. A map updates only its listed rooms.
Clients must retain foreground and topic-filter guards and must not derive
these boundaries from offscreen cached rows. An empty map changes nothing.

A single cursor from an existing client now updates only its own room. Legacy
requests without either cursor retain request-time semantics using each room's
own latest message. The private wrapper reuses existing monotonic read locking,
validates the complete map before updates and returns complete unread totals in
one JSON envelope, avoiding PostgREST's set-returning row cap. No table is added.

Local database checks reproduced the old unseen-room count falling to zero,
then verified the new count stays one. Actual API requests passed partial and
complete two-room reads, wrong-room and out-of-scope rejection, a stale cursor
leaving a later arrival unread, and existing single-cursor clients. A real
PostgREST call returned all 1,031 empty fixture rooms in its JSON response.
All temporary rooms were removed. The additive migration passed full function
lint and transaction rehearsal before local application; migration policy,
JavaScript syntax and four identity-select checks passed. Actual client map
adoption and screen verification remain pending. No test code was changed.

## Explicit business sender in group conversations

Actual business-inbox browser verification found that sending in a group as a
business displayed the staff member's personal name. Business access was valid,
but sender selection only honored the explicit business for direct rooms.
Every explicit business send now applies the same current permission and active
business-membership checks before selecting its public sender. The human actor
remains internal except in their own author response. Task chats retain their
existing owner identity and reject a conflicting explicit business. Personal
sends do not automatically switch to a business that happens to be in the room.

Explicit non-task business sends also refuse an unpublished sender using the
existing `NOT_PUBLISHED` response, since that identity cannot be shown publicly.
Real local API checks passed business sender/private actor persistence, peer
history without actor disclosure, same-key retry once, unauthorized and revoked
staff rejection, personal identity preservation, author edit/delete, unpublished
refusal and successful send after local fixture publication. Temporary backend
fixtures were removed. Syntax and all four identity-select guards passed.
The original group browser recheck remains pending; no test code was changed.

## Reconnect and history across many shared rooms

History and compact sync/read-receipt lookups now query at most 100 room IDs per
URL. Person history merges these batches into only the requested global page,
preserving microsecond timestamp/UUID ordering. Compact state reads run at most
four requests at once. A missing snapshot room returns retryable unavailability
instead of silently advancing an incomplete cache.

Both existing `/changes` routes also accept POST with JSON `cursor` and optional
`until` maps, `limit` and `asBusinessUserId`. GET and JSON-string cursors remain
compatible. Maps accept up to 10,000 rooms, with UUID and safe revision validation;
the earlier 500-room cap was smaller than valid history responses. POST avoids
placing these maps in an HTTP request URL. Responses remain unchanged.

A synthetic pair sharing 531 rooms reproduced old history HTTP 500 and cursor
GET HTTP 431. New actual API history returned 200/200/131 messages in exact
microsecond order without duplicates, with all 531 snapshot cursors. After edits
and one deletion, POST changes returned 200/200/131 changes exactly once; the
next delta was empty and malformed cursors returned 400. Fixture rooms and the
temporary person were removed. Client POST adoption and actual screen reconnect
verification remain pending. No schema or test-code changes.

## Immediate contract

- REST message history uses `(created_at, id)` for both `before` and `after`; both bounds can be combined. `nextCursor` pages backward and `hasMore` comes from an extra row.
- `room:join` subscribes and returns recent messages; it does not mark anything read. Sending also does not clear incoming unread messages.
- Existing room/person `POST .../read` routes and socket `messages:read` accept optional `throughMessageId`. Clients send the newest **visible, server-accepted** message only while foregrounded, with no topic filter. They use the returned `unreadCount`, which may remain positive.
- The service-only `mark_chat_read_through` RPC persists a monotonic participant cursor and recomputes remaining unread messages while holding the participant lock. Legacy callers omit the cursor and use the request's start time. Cursor IDs outside the authorized conversation are refused.
- `messages:read` carries `{userId, roomId, readAt, throughMessageId}`. It describes that participant's read in that room. A single group participant's receipt never means everyone read it.
- Direct-message history synthesizes existing `read_at` only from the other participant's real cursor. Old join/send timestamps do not count as read evidence. Server acceptance is **Sent**, not Delivered.
- Typing broadcasts remain ephemeral; they no longer wait for database writes. Push recipients respect `ChatParticipant.notifications_enabled` as well as account push preferences.

## Verification recorded so far

On an isolated local database replayed from current migrations plus the additive read-cursor migration, with synthetic accounts only:

- Real REST sends persisted successfully; a real Socket.IO room join preserved the recipient's unread count.
- Sending a reply preserved unseen incoming messages. Reading through the first of three incoming messages left two unread, and repeating that read did not clear them.
- Reloading direct history returned `read_at` for the message inside the read boundary and no receipt for the later unread message.
- Equal-timestamp messages paginated without loss or duplicates using combined composite bounds in room and person history. A nonmember read was refused.
- JavaScript syntax, migration policy, existing identity-select checks and whitespace checks passed. No unit tests or coverage work was written or run.
- Web browser, iOS simulator and Android emulator verification is in progress. These API/socket observations do **not** substitute for the app checks.

## Persistent mute and traffic budgets

The next backend slice adds `PATCH /api/chat/rooms/:roomId/preferences` and
`PATCH /api/chat/conversations/:otherUserId/preferences`, with
`{notificationsEnabled, asBusinessUserId?}`. Room, business-room and unified
inbox rows expose `notifications_enabled`. Person mute is stored in the existing
private notification preferences and also covers future direct/task rooms;
room mute stays on the existing participant. Both personal and business
membership are checked before writing.

Chat read acknowledgements now have a separate 240/minute authenticated budget.
Other chat message actions share 240/minute, with sends capped at 120/minute
and 12/5 seconds; reaction/edit/delete limits remain. Ordinary app writes retain
their existing allowance. Rate-limit responses carry the actual retry delay.

Local live-API checks passed for persisted person/room mute, unmute, nonmember
refusal, and sending successfully after 80 read acknowledgements. The clients
will wire these contracts in their next cache/outbox slice. Real image upload
also succeeded against the isolated private S3-compatible storage service.
Hosted push delivery and physical devices remain unverified.

The first backend PR's CI database replay, migration safeguards, privacy gates,
and Docker build pass. Its existing Jest suite fails five assertions tied to
the old read/typing/pagination behavior or its old mocked RPC surface. No tests
were modified under the founder's instruction; the PR remains draft.

## Incremental cache reconciliation

The next backend slice adds optional `?sync=true` to room/person history. It
returns `syncCursors`, a map from room ID to revision captured **before** the
history query. Clients retain the first-page anchor with the cached window;
loading older pages must not advance it.

`GET /api/chat/rooms/:roomId/changes` and
`GET /api/chat/conversations/:otherUserId/changes` accept `cursor` (a JSON map),
optional `until` (the preceding page's `untilCursors`), `limit` (up to 200), and
the existing `asBusinessUserId`. The response contains `messages`,
`syncCursors`, `untilCursors`, `hasMore`, `roomIds`, `removedRoomIds`,
`resetRequired`, and direct-room `readReceipts`. Changes cover **all topics**;
clients filter only after merging. Soft deletions contain only ID, room ID,
`deleted: true` and `sync_version`. New/missing room cursors, future cursors or
hard deletion request a full replacement. Removed rooms are purged from that
conversation's cache. Access errors must never be interpreted as an empty
successful update.

The existing room row allocates each message/reaction revision under its
transaction lock. A later writer cannot commit a revision ahead of an earlier
one. Room activity and topic activity now commit with the message, removing
two follow-up writes from the send path. No new database table is introduced.

Local observations: paged changes recovered an edit, reaction and deletion;
an unchanged cursor returned no rows; concurrent inserts waited and committed
in revision order; malformed cursors returned 400, nonmembers 403, and hard
deletion requested replacement. Public client roles cannot call the new RPC.
Client integration and app verification of this slice remain in progress.

## Server search and old-message navigation

`GET /api/chat/search?q=...` searches the current identity's authorized rooms;
room/person `/search` routes narrow that scope. `asBusinessUserId` retains the
existing business authorization. Literal substring matching (including Unicode
and escaped `%`/`_`) uses a partial trigram index. Results are newest first,
with `hasMore`, a composite `nextCursor`, and `roomContexts` mapping room IDs to
their existing person/room navigation and public identity. There is no
invented total or scan of only the first message page.

Room/person `/messages/:messageId/context` returns a small ascending window
around an authorized, undeleted match. `hasMore` and `nextCursor` page older;
`hasMoreAfter` tells the client that returning to the live bottom must load the
latest window. A search window must not replace the cached latest window or
advance its sync cursor. Existing layouts and search result rows stay intact.

Local API/DB checks recovered an old match behind 130 newer messages, paged 130
matches as 50/50/30 without duplicates, preserved literal wildcard characters
and Unicode, opened the old match's context, and refused a nonmember. The
client search integration and its real-app checks are next.

## Bounded attachment uploads

Chat uploads now authorize the room before consuming multipart data, stream
into private temporary files, validate content from disk, strip image metadata
with one image processor at a time, hash streams and stream to private object
storage. The existing upload request IDs, attachment rows, byte limits and
message binding stay in use. Temporary originals are removed after completion,
failure or cancellation; abandoned directories expire after a day.

Admission allows four uploads per process and two per account, with a retryable
429 before reading excess requests. A multipart batch is bounded to 250 MB;
the existing image/document/video limits apply during streaming. No new table
or hosted storage configuration is required.

Local real-storage checks passed for an image and identical keyed retry,
invalid image rejection, oversize rejection, a 12 MB document attached to a
message, correct byte-range download, concurrent admission and abort cleanup.
The real web sender and recipient also passed fresh image send, thumbnail,
lightbox, document download with matching bytes, and persistence after reload.
Native attachment checks remain in progress.

## Delivery across API processes

Committed message changes now announce only their row keys, operation and
revision over the existing Postgres listener connection. Every API process
loads current message data and current eligible recipients before emitting the
same message, edit, reaction, delete and read events. The local write path
shares the bounded queue and revision deduplication with database notices, so
it does not add a second message event. Reaction selection is calculated for
each recipient. No new table, external broker or hosted setup is introduced.

A listener reconnect invalidates connected clients' chat windows because
Postgres notifications are transient; durable history/change cursors remain
the recovery authority. Failed or overloaded event work also invalidates the
affected room rather than emitting unverified content.

Two real local API processes passed send/receive exactly once, edit, reaction
with recipient-specific selection, bounded read receipt, soft deletion,
direct database insertion and hard deletion. A nonmember and a participant
revoked in the same transaction as an insertion received no message content.
Two individual recipient-arrival observations were 164 ms and 260 ms under
the heavily loaded development host; these are not percentile benchmarks.
Web and Android passed a real shared-group exchange, plus reload/relaunch
persistence. iOS verification and the final cross-platform sweep remain open.

## Paginated inbox and preference reads

`GET /api/chat/unified-conversations` adds `hasMore` and an opaque `nextCursor`.
Send it as `before` with the same `limit` and optional `since`. Ordering uses
last activity and a stable person/room key, including timestamp ties. Clients
deduplicate by person/room key while merging pages and refresh the top when
live activity moves a row. `total` and `totalUnread` still span the full
authorized inbox. The reader uses one indexed latest-message lookup per room
and hydrates identities, plans, train titles and topics only for the page.
It no longer silently stops at PostgREST's default 1,000 memberships.

`GET` counterparts to both room/person `/preferences` routes return the same
`{notificationsEnabled, roomIds}` shape as `PATCH`, with the existing
`asBusinessUserId` query authorization. A chat opened directly can load its
saved setting without scanning the inbox.

The live API paged 1,031 local synthetic inbox rows in eleven pages without
duplicates or omissions, including 1,030 tied timestamps. Existing inbox
totals matched, and mute/unmute persisted through the preference read.
An execution plan used the existing room-message, participant and topic
indexes; its single observed database execution took 87 ms on the loaded
development host. Browser/native pagination checks are still pending.

## Authorization outages and room preview queries

Room and business authorization now distinguish a failed database read from a
confirmed refusal. History, changes and preference reads return a retryable
failure during an outage, preserving the cached-history revocation contract.
Socket room joins likewise report a retryable failure. The existing permission
helper opts into this distinction only for chat; its other callers keep their
current behavior.

The existing room-preview RPC now uses one indexed lateral seek per distinct
room instead of reading the complete matching history before selecting its
latest row. Its invoker security, columns and deleted-message rule are unchanged.

A real local API through a temporary network-fault proxy returned 503 for
history, changes and preferences when membership storage was unreachable, then
returned the same history after recovery. The new preview SQL matched the old
result, including repeated room inputs. Application-function lint, JavaScript
syntax, migration policy and identity guards passed. Final app verification of
this slice is pending; no hosted configuration was changed.

## Badge reconciliation and bounded counters

Chat statistics now sum transactional room message counts instead of counting
all message rows on each badge refresh. The existing room table holds the
counter; inserts, soft deletion, restoration and hard deletion maintain it in
the same transaction. Unread counters also remove deleted unread messages and
respect the stored read boundary. The statistics RPC preserves existing fields,
checks task-room eligibility and has no PostgREST membership row cap.

The existing database change listener now refreshes badges on every API
instance, reusing its authorized recipient resolution. Updates coalesce per
person, run at most four computations concurrently, and serialize each person's
results. Query failures retain the prior badge and retry with bounded backoff.
Room invalidations page memberships instead of silently stopping at 1,000 rows.

Local live checks confirmed insert badges, a read made through another API
process, exact message-count maintenance and unread deletion/restoration. A
network outage produced HTTP 503 and no false zero socket badge; restoring the
connection delivered the current count. Database-wide room counts matched
message rows, and application-function lint passed. App checks of this server
slice are pending; physical-device push delivery remains unverified.

## Inbox search across all pages

`GET /api/chat/unified-conversations?q=literal` filters authorized room/train
names, all active topic titles, and public counterpart display names/handles
before pagination. Keep the same query with `before`; `total` and `totalUnread`
continue to describe the whole authorized inbox. An empty query preserves the
existing reader. Candidate person IDs are checked through the inbox's existing
identity serializer, so a private account-name match behind a different public
alias is discarded. Failed profile reads fail the search rather than falling
back to private names.

The live API returned all 65 tied-timestamp synthetic groups in seven searched
pages, found a Unicode/literal-wildcard topic outside the five displayed topics,
and matched the public alias while rejecting a distinct private account name.
Function lint, migration policy and syntax passed. Browser/native search checks
are pending; existing design and navigation are unchanged.

## Bounded thumbnail work

Private thumbnail reads previously downloaded and decoded the original on every
request. Identical requests now share work and reuse a memory cache capped at
16 MiB / 128 entries for ten minutes. Only bounded 512-pixel WebP derivatives
enter that cache. The uploader and reader share one image-processing slot;
pending thumbnail work is capped and times out. No derivative files or extra
storage objects are created. Each HTTP request still checks current File state
and room/business/task authorization before consulting the cache.

Real local HTTP/storage checks: 20 simultaneous cold reads generated one image
(seven shared the in-flight request, twelve found the completed cache); the next
20 reads were cache hits with no conversion. A 1600×1200 upload produced 512×384
thumbnails while full-size download retained 1600×1200. Conditional raw HTTP
returned 304. Warm-cache access still refused nonmembers/revoked members (403)
and deleted files (410). Errors use no-store so temporary failures cannot inherit
the immutable image cache policy. Database read failures now answer retryable
503 rather than incorrectly reporting a missing/deauthorized file. Real app
photo rechecks are continuing; cold thumbnails still depend on original storage.

## Push account binding

The default lock-screen payload now uses generic chat text. iOS can display an
already accepted background push before application account guards run, and the
app has no Notification Service Extension. Generic title/body remove sender and
message text from that delayed OS surface; authenticated chat and business bell
previews remain unchanged. The founder was offered the preview preference and
the generic default was stated while implementation continued. This is not a
claim that delivered OS alerts can be recalled or that physical push was verified.

Durable chat and business-chat push envelopes now include `recipient_user_id`
for the destination account, separate from the represented message sender. The
recipient is included only in that recipient's private push envelope, never in
room-readable message DTOs. Native handlers can reject a delayed delivery or tap
after account switch instead of opening the old account's thread. Android's
matching display/tap guard and stable OS notification ID are a separate client
slice; it requires this backend contract before release. iOS foreground/tap
handling is being checked. Physical background push remains unverified.

## Authoritative muted badge totals

Both native apps currently subtract muted row counts from the all-unread total.
That calculation becomes incomplete once the inbox is paginated. The server now
adds `total_unmuted_unread` to chat statistics, `unmutedUnreadMessages` to badge
updates, and `totalUnmutedUnread` plus per-row `unmuted_unread` to unified inbox
responses. Existing all-unread fields and message-row indicators remain intact.
The new totals cover the complete authorized inbox regardless of page or search;
room mute and persistent person mute both apply. Preference changes invalidate
chat counters across API processes.

Local database checks passed for mute/unmute, preserved actual unread, persistent
person mute despite an enabled room, and filtered/paginated totals. A real API
send/retry saved one message; its muted recipient received an authoritative live
badge with one actual unread and zero unmuted unread, matching HTTP statistics
and the filtered inbox. The server-only delivery flag remained absent from the
message DTO. Native/web consumption is the next client slice; no tests were added.

## Durable push delivery storage — approved October 23

A message can commit and the API process can exit before its current in-memory
push operation completes. Retries also need per-recipient progress, so one
recipient's temporary provider failure does not resend to everyone. Existing
chat rows are readable by room members; placing staff delivery identities there
would weaken business-seat privacy. Using hidden bell notifications as queue
rows would change notification-list/count behavior and overload that contract.

Approved addition: one private `ChatPushDelivery` table, with no client grants
or RLS policies. Each row references the existing message, recipient account
and represented room identity; a unique message/recipient key prevents duplicate
jobs. It stores delivery state, attempts, next-attempt time, lease ID/expiry and
completion time. It stores no message text, credentials or device tokens.

An insert trigger creates work in the message transaction, preserving mute
preferences at send time. The API reuses the existing Postgres notification
listener to wake a bounded worker and periodically recovers pending work after
process restarts. A service-only claim RPC uses leases and SKIP LOCKED; finish
requires the same lease. Each attempt rechecks current membership, task-room
eligibility, block/mute settings, deletion and the read boundary before loading
public sender identity and sending. Existing business bell notifications retain
their idempotent identity; transport retries do not create duplicate bell rows.

Retry temporary/unknown provider outcomes with bounded backoff, suppress stale
or newly ineligible work, and expire old push work. Use stable message IDs for
provider collapse/deduplication. Provider acceptance is not proof of physical
phone delivery. Verify durable capture, crash/lease recovery, concurrent workers,
preference suppression and current message state locally; physical phones and
hosted APNs/FCM remain a separate founder-supported verification step.

The founder approved the additive schema and local implementation. The private
queue now captures work atomically, fences/renews worker leases, keeps accepted
registration IDs (never raw tokens), expires work after 24 hours, and cleans
completed rows after seven days. A new writer opt-in column preserves the old
API push path during a rolling deployment. Stable message-specific APNs collapse
IDs follow [Apple's notification request contract](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).

Local checks passed: transaction capture and old-writer compatibility; three
workers claiming 12 distinct jobs; expired-lease recovery and stale-worker
rejection; mute-at-send and current mute/read/delete/block/revocation suppression;
private client privileges; business staff delivery and atomic bell deduplication,
read-state preservation and deletion preservation. The running API recovered a
job created while stopped, retained retries with an unavailable APNs transport,
and settled after its synthetic registration was removed. No real push was sent.
Schema/function lint, migration policy, syntax and identity privacy guards pass.

On the running backend, real web UI queued-send recovery, fresh send/peer receipt,
reaction, edit and delete passed. The observed fresh peer receipt was 502 ms
including automation overhead; this is not a percentile or production benchmark.
Native ordinary-flow rechecks are continuing. Hosted migration/deployment and
physical-phone APNs/FCM acceptance remain unverified and founder-owned.

## Remaining repair sequence

| Area | Work remaining after immediate repairs |
| --- | --- |
| Client reconciliation | Finish app verification of live payload merges, optimistic ID reconciliation, stale-response guards, full loaded-range reconnect, edits/deletions/reactions, inbox order and unread deltas. |
| Sending | Durable account-scoped unsent outbox, preserved idempotency keys, bounded retries, consecutive composition, explicit retry state. Founder approved an encrypted account-scoped recent-history cache on October 23; reuse existing cache lifecycles, bound storage, clear on sign-out and reconcile edits/deletions after reconnect. |
| Reads and mute | Verify viewport/foreground boundaries and persisted receipts; connect mute actions to server preferences. |
| Server send path | Separate chat/read rate budgets; transactionally maintain summaries and delivery work; reduce redundant membership/identity queries. |
| Recovery and inbox scale | Efficient durable change cursors, stable paginated inbox queries, server message search with authorized results and jump-to-message. |
| Timeline performance | Lazy/windowed rendering, bounded projections and caches, stable scroll anchors and constant-time reply lookup. |
| Attachments | Bounded streaming upload memory, progress/cancel/retry, precomputed private thumbnails, real file send/download/relaunch checks. |
| Delivery and scale | Reuse existing durable job/notification infrastructure for retryable push; cross-process transport and user rooms with local multi-instance verification. |
| Measurement | Measure visible-send, server acceptance, recipient arrival, open and recovery latency; separate cold build/emulator contention from runtime performance. |

## Historical inventory

This is the full production-readiness backlog for the current chat/message stack, based on backend/routes/chats.js, backend/socket/chatSocketio.js, backend/database/schema.sql, backend/routes/upload.js, frontend/apps/web/src/hooks/useChatMessages.ts, and frontend/apps/mobile/src/hooks/useChatMessages.ts.

1. Access Control And Data Exposure

Revoke direct anon and authenticated execution on chat-related SECURITY DEFINER RPCs and raw chat tables unless they are explicitly safe for client-side use.
Move sensitive chat RPCs to a non-exposed schema, or bind them to auth.uid() internally so callers cannot pass arbitrary user IDs.
Fix all chat RLS policies so room/message/participant access always requires is_active = true.
Ensure removed participants immediately lose message, room, and participant visibility everywhere, including canonical person-conversation queries.
Audit every business-identity path so authorization is explicit and revocable; do not silently grant durable room access unless required.
Add server-side blocklist enforcement so blocked users cannot create chats, fetch history, send messages, react, or upload chat files.
Add abuse controls for spam, harassment, flooding, and repeated unsolicited direct-chat creation.
Add admin/moderation access rules separately from normal user access; do not piggyback on service-role reads.
2. Media And Attachment Security

Replace public file_url chat attachments with authenticated downloads or short-lived signed URLs.
Ensure S3/CloudFront is not publicly readable for chat media.
Add malware scanning for uploaded chat files before they become accessible.
Add MIME sniffing and extension validation; do not trust only file.mimetype.
Strip EXIF/location metadata from images unless there is an intentional product reason to preserve it.
Add per-room attachment authorization checks on download, not just upload.
Add content-size, file-count, and storage-quota enforcement specifically for chat.
Add retention and deletion handling for attachments tied to deleted/redacted messages.
3. Realtime Contract And Delivery Semantics

Pick one source of truth for message delivery semantics and align REST, Socket.IO, and DB contracts to it.
Remove or replace dead/drifted socket paths that rely on missing or mismatched RPCs.
Fix the current socket payload mismatch between get_user_chat_rooms output and what the socket server expects.
Make reconnect deterministic: on reconnect, fetch missed messages since the last acknowledged cursor before resuming live events.
Add idempotent send semantics with a client-generated message UUID or idempotency key.
Add explicit delivery states: queued, sent, persisted, delivered, failed.
Add server acknowledgements that include canonical message ID, server timestamp, room ID, and any transformed fields.
Deduplicate server events by canonical message ID on both server and client.
Make read receipts precise and consistent; if message-level receipts are supported, persist a true cursor rather than just zeroing unread count.
Keep typing events ephemeral and rate-limited, and verify room membership before every typing broadcast.
4. Data Model Hardening

Add a canonical direct-conversation uniqueness model so two concurrent creates cannot produce duplicates.
Persist both actor_user_id and sender_identity_user_id for business messaging; today the human actor is lost when sending as a business.
Validate reply_to_id belongs to the same room and is visible to the sender.
Validate topic_id belongs to the same allowed conversation pair and room context.
Store a monotonic room-local ordering key or sequence for stable pagination and replay.
Move room summary fields into durable server-maintained state: last message ID, last message time, preview, participant counts, unread counts if needed.
Make message insert, room summary update, unread update, and topic activity update transactional.
Define and implement a real deleted-message retention job instead of doing redaction work on read paths.
Decide whether person-grouped conversations are the canonical model or just a derived inbox view; remove the current hybrid ambiguity.
5. Inbox And Message Query Performance

Replace the current “fetch N recent rows across all rooms and hope coverage is enough” strategy for inbox previews with per-room summary state or a proper ranked query.
Remove the per-room exact-count N+1 query pattern from unified conversations.
Use cursor pagination with (created_at, id) or a sequence key, not timestamp alone.
Add/verify indexes for the actual hot paths: (room_id, deleted, created_at desc, id), (user_id, is_active, joined_at), reaction lookups, and room-summary lookups.
Run EXPLAIN ANALYZE for room list, unified conversations, room message fetch, conversation fetch, reaction fetch, and mark-read.
Add pagination response cursors from the server rather than inferring hasMore from length === limit.
Keep deleted-message redaction off the critical read path.
Cache or precompute inbox totals and badge counts instead of recomputing full exact counts on every open.
6. REST API Hardening

Add chat-specific write rate limits for send, react, edit, delete, participant changes, and direct-chat creation.
Add payload validation for all cross-object references, not just UUID shape.
Standardize error codes for auth failure, rate limit, blocked user, invalid attachment, stale cursor, duplicate send, and business-identity auth.
Make all room-fetch endpoints consistently enforce active membership and business-identity authorization.
Remove API surface that exists in the client package but has no backend implementation, or implement it fully.
Ensure edit/delete permissions are correct for represented business messages and audit requirements.
Make mark-read APIs consistent across REST and sockets; right now the signatures and semantics drift.
7. Client Reliability

On web and mobile, actually use the room:join callback payload and/or force a post-reconnect refresh.
Stop trusting local unread increments for inbox state; reconcile from authoritative server badge/inbox payloads.
Add resend/retry handling for transient failures without creating duplicate messages.
Persist unsent drafts and pending attachments across refresh/app background if chat is a core feature.
Handle offline mode explicitly: queue or block sends cleanly, surface failure state, and replay safely.
Make optimistic sends use the same idempotency key the server understands.
Ensure business-identity message ownership is rendered consistently in thread view, inbox view, reactions, edits, and deletes.
Add upload progress, cancel, and failure UI for attachments.
Refresh thread state after foreground resume on mobile, not only when the socket happens to reconnect cleanly.
8. Moderation, Privacy, And Compliance

Add message reporting, moderation queueing, and reviewer tooling for abusive content.
Define retention, redaction, legal hold, and export policies for chat data.
Define who can view deleted messages and for how long.
Add audit logging for participant adds/removes, business-identity sends, moderation actions, and access-sensitive operations.
Add privacy review for attachment URLs, logs, notification payloads, and admin tooling.
Ensure chat notifications do not leak sensitive message content on lock screens or shared business devices without policy.
9. Observability And Operations

Add request IDs and socket session IDs to logs so a send can be traced across API, DB write, socket broadcast, and client receipt.
Instrument p50/p95/p99 for send latency, thread load, inbox load, reconnect recovery, upload latency, and badge refresh latency.
Track duplicate-send rate, reconnect-miss rate, unread drift rate, socket auth failure rate, and attachment upload failure rate.
Add alerts for elevated send failures, socket connect failures, DB query regressions, and unexpected 403/500 spikes on chat endpoints.
Create runbooks for message-delivery incidents, media-access incidents, unread-count drift, and moderation escalation.
Load test reconnect storms, noisy-room inboxes, concurrent direct-chat creation, attachment bursts, and mark-read churn.
10. Test Program

Add real integration tests against actual Postgres/Supabase with RLS enabled; mocked unit tests are not enough.
Add socket end-to-end tests for connect, join, send, reconnect, duplicate event handling, read receipts, and reactions.
Add security tests for removed participants, blocked users, unauthorized business impersonation, and direct DB/RPC bypass attempts.
Add concurrency tests for duplicate direct-chat creation and simultaneous sends from multiple devices.
Add pagination tests that cover same-timestamp messages, backfill after reconnect, and no-gap/no-dup guarantees.
Add attachment tests for private download authorization, signed URL expiry, malware failure, and MIME mismatch.
Add performance regression tests for inbox list and message fetch queries at realistic production cardinalities.
Launch Bar

No unauthorized history access in integration/security tests.
No duplicate message creation under retries/reconnect.
No lost messages after reconnect in end-to-end tests.
Inbox and thread queries must be bounded, indexed, and benchmarked at realistic scale.
Attachment access must be private and auditable.
REST, socket, and database contracts must match exactly with no legacy drift paths left.





Release Blockers
These have to be closed before any real production traffic.

Owner: Security + DB + Backend

 Revoke direct anon/authenticated access to chat SECURITY DEFINER RPCs and any exposed chat tables/functions that let callers pass arbitrary user IDs.
 Move sensitive chat RPCs out of exposed public API surface, or bind them strictly to auth.uid() internally.
 Fix RLS so only is_active = true participants can view rooms, messages, participants, and typing state.
 Ensure removed participants immediately lose access everywhere, including person-conversation aggregation endpoints.
 Replace public chat attachment URLs with signed/authenticated download flow.
 Confirm S3/CloudFront is not publicly readable for chat media.
Owner: Backend + DB + Realtime

 Unify REST, Socket.IO, and DB contracts; remove drifted socket paths that depend on missing or incompatible RPCs.
 Fix the socket/server mismatch around room payload shape and read-receipt RPC signatures.
 Add reconnect backfill so clients fetch missed messages after reconnect before resuming live events.
 Add idempotent send support with client message IDs or idempotency keys.
Owner: Backend + QA

 Add real integration tests with actual Postgres/Supabase + RLS enabled for send/read/remove/reconnect/access-control paths.
 Add socket end-to-end tests for connect, join, send, delete, react, read, reconnect, and duplicate-event handling.
Workstreams

1. Auth, RLS, and Data Exposure
Owner: Security + DB + Backend

 Audit every chat table, view, and function grant.
 Restrict get_or_create_direct_chat, get_user_chat_rooms, and similar RPCs so they cannot be abused outside the backend.
 Ensure business-identity access checks are explicit, revocable, and consistently enforced in all room/message endpoints.
 Add blocklist enforcement to chat creation, fetch, send, react, upload, and participant changes.
 Separate moderator/admin access from normal participant access.
 Add audit logs for sensitive chat access and business-identity actions.
2. Message Delivery and Realtime Semantics
Owner: Backend + Realtime + Frontend

 Define one canonical delivery model for send, persist, broadcast, ack, and read.
 Return canonical message ID, server timestamp, sender identity, and room ID on every successful send.
 Make sends idempotent under retry, reconnect, and double-submit.
 Persist actor identity separately from represented sender identity for business messaging.
 Ensure delete/edit/reaction events use the same message identity and room authorization rules as REST.
 Make read receipts precise; if message-level read is supported, persist a cursor rather than only resetting unread count.
 Rate-limit typing events and verify membership on every typing broadcast.
3. Data Model Hardening
Owner: DB + Backend

 Enforce direct-conversation uniqueness under concurrent creation.
 Validate reply_to_id belongs to the same room and is visible to the sender.
 Validate topic_id belongs to the right conversation pair/context.
 Add stable pagination keying using (created_at, id) or a room-local sequence.
 Maintain durable room summary state: last message ID/time/preview and participant summary metadata.
 Make message insert, unread update, topic activity update, and room summary update atomic.
 Replace read-time deleted-message cleanup with background retention jobs.
4. Inbox and Query Performance
Owner: DB + Backend

 Replace current “global recent rows across many rooms” preview logic with per-room summary state or a proper ranked query.
 Remove per-room exact-count N+1 queries from unified conversations and badges.
 Benchmark GET /rooms, unified conversations, room message fetch, canonical conversation fetch, reaction fetch, and mark-read queries.
 Add/verify hot-path indexes for room fetch, room message pagination, reaction lookup, unread lookup, and topic filtering.
 Return real pagination cursors from the API instead of inferring hasMore from length === limit.
 Keep expensive redaction/counting work off synchronous request paths.
5. Attachment and File Security
Owner: Backend + Security + Infra

 Serve chat files via signed URLs or authenticated proxy endpoints.
 Add malware scanning and quarantine workflow for uploaded chat files.
 Validate actual MIME/content, not just client-reported mimetype.
 Strip EXIF/location metadata from images unless intentionally retained.
 Enforce per-user and per-room quotas for chat storage.
 Add download authorization checks tied to room membership.
 Define retention/deletion behavior for files on soft-deleted and redacted messages.
6. API Hardening and Abuse Controls
Owner: Backend + Security

 Add chat-specific rate limits for send, react, edit, delete, direct-chat create, participant changes, and attachment upload.
 Standardize machine-readable error codes for blocked, unauthorized, duplicate send, stale cursor, invalid attachment, and rate-limit states.
 Remove or implement any client-exposed chat API methods that do not exist server-side.
 Ensure all endpoints consistently require active membership, not just membership row existence.
 Add spam/flood controls and suspicious-behavior detection for chat abuse.
 Add content/reporting endpoints and moderation queue integration.
7. Web and Mobile Client Reliability
Owner: Frontend Web + Frontend Mobile

 Use room:join responses or force thread refresh on reconnect.
 Reconcile unread state from authoritative server payloads instead of local increments.
 Persist drafts and pending uploads where product requires it.
 Handle offline/airplane mode explicitly with failed/pending send states.
 Use the same idempotency key on optimistic messages that the server understands.
 Add attachment upload progress, retry, cancel, and failure UI.
 Refresh thread state on app foreground/resume, not only on socket reconnect.
 Ensure business-identity rendering is consistent in inbox, thread, reactions, edits, and deletes.
8. Moderation, Privacy, and Compliance
Owner: Trust/Safety + Legal + Backend

 Add message reporting and moderation workflows.
 Define retention, deletion, redaction, export, and legal-hold policy for chats.
 Define what deleted messages remain available for disputes/admin review and for how long.
 Ensure notifications and lock-screen surfaces do not leak sensitive message content by default.
 Review logs, analytics, and error payloads for PII leakage.
9. Observability and Operations
Owner: Infra + Backend

 Add request IDs and socket session correlation IDs.
 Instrument p50/p95/p99 for send latency, inbox load, thread load, reconnect recovery, upload latency, and badge refresh.
 Track duplicate sends, missed-after-reconnect, unread drift, auth failures, and attachment failures.
 Add alerts for send failure spikes, socket connect failure spikes, DB latency regressions, and unexpected 403/500 rates.
 Write runbooks for message delivery failures, unread drift, attachment exposure, and moderation incidents.
 Load test reconnect storms, noisy-room inboxes, concurrent chat creation, and attachment bursts.
10. Test Matrix
Owner: QA + Backend + Frontend

 Integration test: active participant can fetch/send/read.
 Integration test: removed participant cannot fetch room, messages, conversation history, or files.
 Integration test: blocked users cannot create or continue chats.
 Integration test: business delegate can act only where authorized.
 Integration test: reconnect recovers missed messages with no gaps/duplicates.
 Integration test: duplicate send retries collapse to one persisted message.
 Integration test: same-timestamp pagination has no skip/dup behavior.
 Integration test: attachment upload/download respects privacy rules.
 Socket E2E test: join, send, edit, delete, react, read, reconnect.
 Performance test: inbox and thread endpoints at realistic room/message cardinalities.
Definition Of “Production Ready”

 No unauthorized chat or attachment access in integration/security tests.
 No missing messages after reconnect in E2E tests.
 No duplicate persisted messages under retry/reconnect.
 Inbox/thread queries are indexed, benchmarked, and bounded.
 REST, socket, and DB contracts match exactly.
 Attachments are private and auditable.
 Monitoring, alerts, and incident runbooks exist.
