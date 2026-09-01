# Chat and Realtime Architecture Interview Notes

This document captures interview-ready answers for the chat, Socket.IO, idempotency, unread-count, direct-chat race, realtime rate-limit, and privacy-serializer questions. It is written from the perspective of the engineer who built this codebase and needs to explain both the current implementation and the production tradeoffs honestly.

The most important framing is this:

- The database is the source of truth for chat state: rooms, participants, messages, unread counts, reactions, and typing rows.
- Socket.IO is used for low-latency delivery and connection lifecycle, not for durable product truth.
- The current code is solid for a single backend instance and has recovery paths for missed realtime events, but it does not yet provide globally correct realtime fanout across multiple backend containers.
- The next production step is a Socket.IO Redis adapter, shared presence, distributed rate limits, and transactional message-send side effects.

## Primary Code References

- `backend/app.js`: creates Express, HTTP server, and Socket.IO server. It uses the default Socket.IO in-memory adapter.
- `backend/socket/chatSocketio.js`: authenticates sockets, tracks connected users and rooms in memory, handles room join, typing, read receipts, reactions, direct-chat socket creation, and cleanup.
- `backend/routes/chats.js`: owns durable chat commands through REST: create direct/group room, send/edit/delete messages, mark read, list rooms/conversations, reactions, file access, and serializers.
- `backend/services/badgeService.js`: computes badge counts from database state and emits `badge:update` to currently connected sockets known to the local process.
- `backend/database/schema.sql`: contains current schema dump, including `ChatParticipant`, `ChatRoom`, `ChatTyping`, unread trigger, and related constraints.
- `supabase/migrations/20260310000004_fix_direct_chat_race.sql`: advisory-lock migration for direct-chat creation races.
- `supabase/migrations/20260310000009_chat_idempotent_send.sql`: `client_message_id` column and global unique index.
- `backend/serializers/identitySerializers.js`: privacy-safe identity serializer layer.
- `frontend/apps/web/src/hooks/useChatMessages.ts` and `frontend/apps/mobile/src/hooks/useChatMessages.ts`: client-side socket join, message merge, optimistic send, idempotency, reconnect backfill, and polling fallback behavior.

## Mental Model

The system intentionally separates command handling from event delivery.

REST handles commands that must be authoritative and easy to reason about:

- Create or retrieve a room.
- Validate membership.
- Validate business-identity authority.
- Validate attachments.
- Enforce block rules.
- Enforce pre-bid message limits.
- Persist messages.
- Apply idempotency.
- Update read state and badge state.

Socket.IO handles immediacy:

- Join rooms.
- Deliver `message:new`, `message:edited`, `message:deleted`, and `message:reaction_updated`.
- Emit typing indicators.
- Emit read receipts.
- Emit badge updates.
- Track online/offline status for the local process.

The durable truth must be recoverable through REST because mobile apps background, browser tabs sleep, sockets disconnect, load balancers restart containers, and realtime delivery is inherently best-effort unless backed by a cross-instance event bus and replay log.

## Question 1: Why Is Socket.IO State Kept In Memory?

Socket.IO state is kept in memory because the state being tracked there is connection-local, not durable product state.

In `backend/socket/chatSocketio.js`, the process keeps:

- `connectedUsers`: a `Map<userId, Set<socketId>>`.
- `userRooms`: a `Map<userId, Set<roomId>>`.
- `socketCounters`: per-socket sliding-window counters for events like `typing:start` and `message:react`.

That state is inherently tied to the Node.js process that owns the WebSocket connection. A `socket.id` is only meaningful inside the Socket.IO server instance where the socket is connected. Keeping that mapping in memory is fast, simple, and appropriate for a single process because it avoids a network round trip on every typing event, badge emit, or online/offline transition.

The critical design line is that memory is not the source of truth for chat membership or message state. Durable chat state lives in Supabase/Postgres:

- `ChatRoom`: room metadata.
- `ChatParticipant`: membership, role, active status, unread count, last-read timestamp.
- `ChatMessage`: messages.
- `MessageReaction`: reactions.
- `ChatTyping`: persisted typing rows with expiration.

So the memory maps are an optimization and routing cache for currently connected sockets. They can be lost on process restart without losing messages, unread counts, or membership. When a client reconnects, the socket server reloads rooms through `get_user_chat_rooms`, joins the socket to those rooms, emits the room list, and the client can backfill messages through REST or `room:join`.

Why not put all socket state in Redis immediately?

For an early single-instance deployment, in-memory state is the lowest-complexity correct answer. It avoids premature distributed-systems complexity and keeps local development straightforward. But it is only acceptable if we are explicit that it is a single-instance assumption. Once we run more than one backend container, the in-memory Socket.IO state becomes partial and we need a cross-instance adapter.

## Question 2: What Happens With Multiple Backend Containers?

With the current implementation, multiple backend containers create split-brain realtime delivery.

Each backend container has its own:

- `connectedUsers` map.
- Socket.IO room membership.
- Socket.IO default adapter.
- Badge-service reference to local connected sockets.
- Notification-service reference to local connected sockets.
- Per-socket rate-limit counters.

When a REST request sends a message, `backend/routes/chats.js` does roughly this:

1. Validate the sender and message.
2. Insert `ChatMessage`.
3. Emit `io.to(roomId).emit('message:new', ...)`.
4. Update side effects such as room timestamp and sender read state.
5. Emit badge updates to recipients known to this process.

That `io.to(roomId).emit(...)` only reaches sockets connected to the same Node process unless Socket.IO is configured with a distributed adapter. If user A's REST request lands on container A, but user B's socket is connected to container B, container B will not receive the `message:new` event.

The current frontend has recovery paths:

- On connect/reconnect, it clears joined-room state and re-emits `room:join`.
- `room:join` returns recent backfill messages.
- When the tab becomes visible, web refreshes messages.
- When the socket is disconnected, clients poll REST every 30 seconds as degraded fallback.
- Incoming messages are deduplicated by canonical message ID and optimistic `client_message_id`.

Those recovery paths protect user experience from permanent data loss. They do not make realtime delivery globally correct.

In interview terms, I would say:

> Today the database remains correct with multiple containers, but realtime fanout and online presence are only locally correct per container. The system degrades to eventual consistency through REST backfill. To make realtime correct horizontally, I would add the Socket.IO Redis adapter, sticky load balancing for Engine.IO/WebSocket sessions, and Redis-backed presence/rate-limits.

## Question 3: Do We Use A Redis Adapter Or Cross-Instance Presence Strategy?

No. The repository does not currently use a Redis adapter or shared presence strategy.

Evidence:

- `backend/app.js` initializes Socket.IO with `socketIo(server, { cors: ... })`.
- There is no `@socket.io/redis-adapter` dependency in `backend/package.json`.
- There is no Redis connection setup for Socket.IO.
- `connectedUsers` lives in `backend/socket/chatSocketio.js` as a process-local `Map`.
- `badgeService` and `notificationService` receive that local map at startup.

That means:

- `io.to(roomId).emit(...)` broadcasts only inside the current process.
- `badge:update` emits only to sockets in the current process.
- `user:online` and `user:offline` are local-process approximations.
- Per-socket rate limits reset when the user reconnects or lands on a different container.

The production design I would use:

1. Add Redis adapter:

   - Add `@socket.io/redis-adapter`.
   - Add `redis` or `ioredis`.
   - Create pub/sub Redis clients.
   - Call `io.adapter(createAdapter(pubClient, subClient))`.

2. Use sticky sessions:

   Socket.IO long-polling and WebSocket upgrade paths require the same Engine.IO session to consistently reach the same process unless using compatible session-aware load balancing. I would configure ALB/Nginx/Kubernetes ingress stickiness or force WebSocket transport where appropriate and still keep sticky routing for safety.

3. Use shared presence:

   Keep per-process socket ownership local, but write aggregate presence to Redis:

   - `presence:user:{userId}:sockets` as a set of `{instanceId}:{socketId}` with TTL or heartbeat.
   - `presence:instance:{instanceId}` heartbeat with expiry.
   - `online` means at least one live socket entry exists.

4. Handle crash cleanup:

   Relying only on disconnect hooks is insufficient because containers can die. TTLs and instance heartbeats prevent ghost presence.

5. Move rate limits to Redis:

   Socket event rate limits should key by user ID, IP, and possibly room ID, not only socket ID.

## Question 4: How Do Room Membership Checks Work For `room:join`?

`room:join` performs an explicit database membership check before joining a Socket.IO room.

Current flow:

1. Socket authentication middleware reads a Supabase token from `socket.handshake.auth.token`.
2. For web clients using HTTP-only cookies, it falls back to the `pantopus_access` cookie.
3. Supabase Admin verifies the token via `auth.getUser(token)`.
4. The socket receives `socket.userId`.
5. On `room:join`, the handler queries `ChatParticipant`.
6. It requires:

   - matching `room_id`,
   - matching authenticated `user_id`,
   - `is_active = true`.

7. If no active participant row exists, callback returns `{ error: 'Access denied' }`.
8. If the row exists, the socket joins the Socket.IO room and receives recent messages.

This is the right basic security posture: Socket.IO room membership is not trusted as authorization. The database participant row is checked before socket room join.

There are two additional details:

First, on connection, the socket auto-joins rooms returned by `get_user_chat_rooms`. That RPC filters active participant rows. This gives users realtime updates for rooms they already participate in, even before explicitly opening a thread.

Second, typing and read-receipt handlers later check `socket.rooms.has(roomId)`. That is efficient, but it means authorization is only rechecked when the socket joins. If a user is removed from a room while their socket remains connected, the server does not currently broadcast an eviction or force `socket.leave(roomId)`. In production, I would add a participant-removal event that makes all instances leave that user's sockets from the room, and I would consider rechecking membership for sensitive events.

Recommended hardening:

- Validate `roomId` shape before querying.
- Return machine-readable error codes such as `CHAT_ROOM_ACCESS_DENIED`.
- On participant removal, emit cross-instance socket eviction.
- For long-lived sockets, periodically refresh membership or use an authorization version.
- Do not rely on socket room membership alone for any durable mutation.

## Question 5: Why Are Message Sends REST-Only While Realtime Delivery Is Socket.IO?

Message sending is REST-only because sending a message is a durable command, not a transient event.

The send path does a lot more than "emit text to a room":

- Authenticates the user through normal API middleware.
- Applies global and chat-specific rate limits.
- Validates the request body with Joi.
- Confirms active room participation.
- Handles business identity with `asBusinessUserId`.
- Stores `actor_user_id` when a human sends as a business identity.
- Checks direct-chat block rules.
- Enforces pre-bid message limits for gig chats.
- Validates file attachments and ownership.
- Validates reply target belongs to the same room.
- Validates topic membership.
- Applies `clientMessageId` idempotency.
- Inserts `ChatMessage`.
- Relies on the DB trigger to increment recipient unread counts.
- Broadcasts the created message over Socket.IO.
- Updates room timestamp, sender read state, and topic activity.
- Emits badge updates.
- Sends push notifications asynchronously.

Keeping that as one REST command path avoids having two write paths that drift. If we accepted both `POST /api/chat/messages` and `socket.emit('message:send')`, then every validation, idempotency, permission check, attachment check, metric, and side effect would need to be duplicated or factored into a shared command service. Until that shared command service exists, REST-only sends are safer.

Socket.IO is then used for the delivery plane:

- `message:new`
- `message:edited`
- `message:deleted`
- `message:reaction_updated`
- `typing:user`
- `typing:stopped`
- `messages:read`
- `badge:update`

This command/event split is common in production systems. The client gets a clean request/response contract for the durable write and a realtime event stream for low-latency updates.

If I were evolving this code, I would eventually extract a `chatMessageService.sendMessage(...)` command that both REST and a potential socket command could call. But I would still keep the semantics request/ack based, with the database insert completing before broadcast.

## Question 6: What Happens If Message Broadcast Succeeds But Unread-Count Updates Fail?

There are two different unread/update concepts in the current code, and they should not be conflated.

Recipient unread increments are database-triggered:

- `ChatMessage` insert fires `trigger_increment_unread`.
- The trigger calls `increment_unread_count()`.
- It updates `ChatParticipant.unread_count = unread_count + 1` for every active participant in the room except the sender.

Because that trigger runs inside the same database transaction as the insert, if the recipient unread increment fails at the database level, the message insert should fail too. In that failure mode, the REST route never reaches the broadcast, because broadcast happens after insert success.

However, after insert success and broadcast, the route performs additional side effects:

- Update `ChatRoom.updated_at`.
- Reset the acting sender's `unread_count` to 0 and `last_read_at` to now.
- Update `ConversationTopic.last_activity_at` if applicable.
- Emit fresh badge counts to recipients.
- Send push notifications asynchronously.

Those side effects happen after `io.to(roomId).emit('message:new', ...)`.

If broadcast succeeds and then one of these post-broadcast database updates fails, the user can see the message in realtime while the HTTP request may fail or related derived state may lag. Examples:

- The message is persisted and delivered, but `ChatRoom.updated_at` is stale.
- The sender's local unread count may not reset.
- The conversation topic activity timestamp may not move forward.
- Badge updates may not emit immediately.
- Push delivery may fail, but it is explicitly non-blocking.

The most serious case is not recipient unread increments, because those are trigger-protected. The serious case is post-insert side-effect inconsistency after broadcast.

How I would harden it:

1. Move message insert plus all database side effects into one transactional Postgres RPC, for example `send_chat_message(...)`.
2. Return the inserted message from that RPC.
3. Broadcast only after the RPC commits successfully.
4. Keep badge emit and push notification non-blocking because they are delivery effects, not durable chat state.
5. Add a periodic reconciliation job that recomputes unread drift from messages and `last_read_at`, or at least detects drift.
6. Record a metric for side-effect failure after message persistence.

This gives a clean invariant:

> If `message:new` is emitted, the durable message state and required database side effects are already committed.

## Question 7: What Happens If Two Clients Send The Same `client_message_id` In Different Rooms?

Today, `client_message_id` is effectively global.

The migration creates:

```sql
CREATE UNIQUE INDEX idx_chat_message_client_id
  ON "ChatMessage" (client_message_id)
  WHERE client_message_id IS NOT NULL;
```

The REST handler also looks up an existing message only by `client_message_id`, without checking `room_id` or sender:

```js
.eq('client_message_id', clientMessageId)
```

So if two clients send the same `client_message_id` in different rooms, the second request can return the first message as an idempotent success. If the first message is in room A and the second request is trying to send to room B, this is semantically wrong.

In practice, the clients generate UUIDs with `crypto.randomUUID()`, so accidental collisions are astronomically unlikely. But "unlikely" is not the same as a correct API contract. A malicious client, a buggy client, or a copied retry payload could reuse the key across rooms.

Current behavior:

- Same `client_message_id` in same room: returns existing message.
- Same `client_message_id` in different room: returns existing message anyway.
- Same `client_message_id` by different sender: returns existing message anyway.
- Same `client_message_id` by different sender in different room: returns existing message anyway.

That means the implementation does not match the comment above the idempotency check, which says it checks the same room and sender.

## Question 8: The Chat Idempotency Key Appears Globally Unique. Why Not Scope It By Sender And Room?

It should be scoped by sender and room. The current global uniqueness is too broad.

The correct idempotency domain is not "all messages ever". It is:

- the room being written to,
- the resolved sender identity,
- the client-generated message key.

In this codebase, "resolved sender identity" matters because the acting user may send as a business. For example:

- `userId` is the human actor.
- `senderUserId` may be the business identity if `asBusinessUserId` is valid.
- `actor_user_id` records the human behind the business message for internal audit.

So the uniqueness key should likely be:

```sql
CREATE UNIQUE INDEX idx_chat_message_room_sender_client_id
  ON "ChatMessage" (room_id, user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
```

Then the idempotency lookup should be:

```js
.eq('room_id', roomId)
.eq('user_id', senderUserId)
.eq('client_message_id', clientMessageId)
```

This gives the intended behavior:

- Retrying the same message in the same room by the same sender returns the same row.
- Reusing the same key in another room creates a separate message.
- Reusing the same key by another sender creates a separate message.
- A duplicate insert race is resolved by the database unique constraint.

The send path should also catch unique-violation errors (`23505`) and then query the scoped existing row. That closes the classic race:

1. Request A checks for existing row and finds none.
2. Request B checks for existing row and finds none.
3. Request A inserts successfully.
4. Request B insert hits unique violation.
5. Request B returns the existing row as idempotent success.

That is the behavior users expect from retry-safe sends.

## Question 9: How Do You Handle Direct-Chat Creation Races?

Direct-chat creation is handled at the database layer through an advisory lock in the migration `20260310000004_fix_direct_chat_race.sql`.

The original race was:

1. User A creates chat with user B.
2. User B creates chat with user A at the same time.
3. Both calls run `SELECT` and find no existing direct room.
4. Both insert a new `ChatRoom`.
5. The pair now has duplicate direct rooms.

The migration fixes that by:

- Sorting the two UUIDs so `(A, B)` and `(B, A)` produce the same key.
- Computing a deterministic advisory lock key from the sorted pair.
- Calling `pg_advisory_xact_lock(...)`.
- Rechecking for an existing direct room while holding the lock.
- Creating the room only if none exists.
- Reactivating participants if they had previously left.

This is the right place to solve the race. Application-level locks would not protect against multiple containers. A database advisory lock does.

The REST route then layers product rules on top:

- Curator accounts cannot initiate direct messages.
- Users cannot create a self-chat unless the business-identity path changes the identity.
- Blocked users cannot create direct chats.
- The other user must exist.
- Curator accounts cannot receive messages.
- Business identity requires `canActAsBusiness`.
- Business team members are upserted as participants where appropriate.
- The `(room_id, user_id)` unique constraint prevents duplicate participant rows.

There is one repo-maintenance concern: `backend/database/schema.sql` appears to show the older non-locking version of `get_or_create_direct_chat`, while the Supabase migration has the locking version. I would regenerate or reconcile the schema dump so reviewers do not get conflicting evidence.

A more canonical long-term data model would add a deterministic pair key:

- `direct_pair_key = least(user1,user2) || ':' || greatest(user1,user2)`
- Unique index on direct rooms by pair key.

But because `ChatRoom` currently stores room metadata and participants separately, the advisory lock is a pragmatic fix that fits the existing schema without a larger migration.

## Question 10: Are Typing And Reaction Rate Limits Enough To Protect Realtime Infrastructure?

No. They are useful local guardrails, but not sufficient production protection.

Current socket limits:

- `typing:start`: 10 per socket per minute.
- `message:react`: 60 per socket per minute.

Current REST chat limits:

- Message sends: 30 per user per minute.
- Direct-chat creation: default 40 per user per minute.
- Group chat creation: 5 per user per minute.
- Reactions: 60 per user per minute.
- Edits: 20 per user per minute.
- Deletes: 20 per user per minute.
- Participant changes: 10 per user per minute.
- Global API write limiter also applies to writes.

The problem is that the Socket.IO limits are:

- per socket ID,
- in memory,
- cleared on disconnect,
- not shared across containers,
- not keyed by user ID or IP,
- not applied to every realtime event,
- not enough to prevent connection churn attacks.

Attack or stress cases:

- A client repeatedly reconnects to reset socket counters.
- A user opens many sockets to multiply allowed typing/reaction volume.
- A deployment has multiple backend containers, and each container tracks counters independently.
- A client spams `room:join`, which currently has no explicit socket rate limit.
- A client spams `typing:stop` or `messages:read`.
- A client repeatedly emits invalid payloads that trigger database lookups.
- A malicious user joins many legitimate rooms and sends allowed-but-expensive events.

Production protection I would add:

1. Redis-backed socket event limiters keyed by:

   - user ID,
   - IP,
   - room ID for room-scoped events,
   - event type.

2. Connection-level limits:

   - max concurrent sockets per user,
   - max connection attempts per IP/user,
   - backoff after repeated auth failures.

3. Event-specific limits:

   - `room:join`,
   - `typing:start`,
   - `typing:stop`,
   - `messages:read`,
   - `message:react`,
   - `message:unreact`,
   - `chat:create_direct`.

4. Payload validation before database work:

   - UUID validation,
   - allowed reaction length/shape,
   - max room count per join burst.

5. Fanout safeguards:

   - cap room sizes where appropriate,
   - monitor event fanout counts,
   - use queue or pub/sub for large broadcast surfaces.

6. Metrics:

   - socket auth failure rate,
   - room join denial rate,
   - rate-limited event count,
   - reconnect rate,
   - per-user socket count,
   - realtime delivery latency,
   - missed-after-reconnect rate.

The current limits are reasonable for accidental spam in a single-container setup. They are not a complete abuse-control strategy for a horizontally scaled realtime system.

## Question 11: How Do Chat Serializers Align With Newer Privacy-Safe Identity Serializers?

The REST chat routes are partially aligned with the newer privacy-safe identity serializer layer. The Socket.IO-specific paths still need cleanup.

The privacy-safe serializer layer lives in `backend/serializers/identitySerializers.js`. It provides:

- `serializePrivateAccount`
- `serializeLocalProfileForViewer`
- `serializeAudienceProfileForViewer`
- `serializeBusinessSeatForViewer`
- `serializeHomeIdentityForViewer`
- `serializePostAuthorForViewer`
- `serializeGigAuthorForViewer`
- `serializeListingAuthorForViewer`
- `serializeChatSenderForViewer`
- `serializeUserAsLocalIdentity`
- `serializeUserIdentityForViewer`

REST chat alignment:

- `loadLocalIdentityMapForUsers(...)` loads `LocalProfile` rows for chat users.
- Room lists include `other_participant_identity`.
- Message responses call `serializeChatMessageForViewer(...)`.
- `serializeChatMessageForViewer(...)` strips `actor_user_id` by default.
- Sender identity is serialized through `serializeUserIdentityForViewer(...)`.
- Participants are serialized through `serializeChatParticipantForViewer(...)`.
- Reaction summaries use `serializeUserAsLocalIdentity(...)` in the REST route.

That is the right direction: chat should not return raw `User` rows with private fields or legacy identity aliases.

Gaps:

1. Socket `room:join` backfill selects raw sender fields:

   - `id`
   - `username`
   - `name`
   - `profile_picture_url`

   It then returns messages mostly raw, with reactions attached. It does not run the same `serializeChatMessageForViewer(...)` helper used by REST.

2. Socket reaction summaries select `User.id` and `User.name` directly and emit `{ id, name }`.

3. The socket serializer path and REST serializer path can drift because they are implemented separately.

4. Chat sender serialization currently treats user identity as local/business identity, which is good, but audience/persona DMs have a separate privacy model and should not be mixed into normal direct chat.

5. The `serializeChatSenderForViewer(message)` helper exists in `identitySerializers.js`, but `routes/chats.js` uses its own local `serializeChatMessageForViewer(...)`. That is not automatically wrong, but it means the boundary is less centralized than it could be.

How I would tighten it:

- Move chat message serialization into the shared serializer module or a dedicated `chatSerializers.js`.
- Use the same serializer for:

  - REST message fetch,
  - REST message send response,
  - Socket `message:new`,
  - Socket `room:join` backfill,
  - Socket reaction summaries,
  - REST reaction summaries.

- Stop selecting `User.name` in socket code unless the serializer needs it internally and the output is privacy-filtered.
- Add tests that assert chat REST and socket payloads do not expose forbidden raw fields:

  - `email`
  - `phone`
  - `address`
  - `legal_name`
  - `first_name`
  - `last_name`
  - raw `actor_user_id`
  - private home/location fields

- Add contract tests that compare REST message shape and socket message shape.

Interview answer:

> The newer REST chat surfaces mostly honor the identity firewall by serializing participants and senders into local/business identity shapes and stripping internal actor identity. The remaining work is to route all Socket.IO payloads, especially `room:join` backfill and reaction summaries, through the same serializer boundary so realtime cannot bypass privacy guarantees.

## Additional Interview-Level Details

### Why The Database Trigger For Unread Counts Is A Good Choice

Unread counts are tied to message persistence. They should not depend on application code remembering to update them.

The trigger gives a strong invariant:

> Every inserted message increments unread for active non-sender participants.

This is better than doing unread increments after broadcast in application code because:

- It works regardless of which backend path inserts the message.
- It is closer to the durable state.
- It avoids accidentally persisting a message without unread state.
- It remains correct if a future service inserts system messages or migration-created messages, assuming the trigger should apply.

The tradeoff is that triggers hide side effects from application readers. For maintainability, I would document this invariant near the send code and add tests that assert insert -> unread increment behavior.

### Why Message Broadcast Is Best-Effort

Realtime delivery is not the source of truth. Even with Redis adapter, clients can miss events because:

- Mobile app is backgrounded.
- Browser tab is suspended.
- Network changes.
- WebSocket reconnects.
- The server restarts.
- The user logs in from multiple devices.

Therefore the client always needs reconciliation:

- Fetch messages through REST.
- Deduplicate by message ID.
- Replace optimistic sends by `client_message_id`.
- Backfill on `room:join`.
- Refresh on foreground/visibility.
- Poll when disconnected.

This codebase already has most of that client-side recovery logic. The missing production piece is cross-instance realtime broadcast.

### Why Reactions Are Allowed Through Both Socket And REST

Unlike message sends, reactions are smaller and currently have both paths:

- Socket path for fast interaction when connected.
- REST fallback when socket is not connected.

That is acceptable because the operation is simpler, but it still creates duplicate logic:

- Both paths check message existence.
- Both paths check participant membership.
- Both paths toggle `MessageReaction`.
- Both paths rebuild summary.
- Both paths broadcast `message:reaction_updated`.

The risk is drift. The REST path uses privacy-safe identity serialization for reaction users, while the socket path currently emits raw-ish `{ id, name }`. I would extract a shared reaction service and shared serializer.

### Why Direct Chat Uses An RPC

Direct-chat creation spans multiple tables:

- `ChatRoom`
- `ChatParticipant` for user 1
- `ChatParticipant` for user 2

It also needs race protection. Putting that in a Postgres RPC is reasonable because it lets the lock, lookup, room insert, and participant insert execute in one database transaction.

The REST route still owns product authorization because the RPC uses service role and should not decide product policy on its own. That split is:

- REST route: "Are these two identities allowed to chat?"
- RPC: "Create or retrieve exactly one direct room for this allowed pair."

### Why Business Identity Makes Chat More Complicated

Chat has both a human actor and a displayed sender identity.

Examples:

- A normal user sends as themselves:
  - `user_id = actor user`
  - no `actor_user_id`

- A team member sends as a business:
  - `user_id = business user identity`
  - `actor_user_id = human team member`

This is why the code is careful to:

- require explicit `asBusinessUserId`,
- avoid auto-detecting business identity from room participants,
- verify `canActAsBusiness(...)`,
- strip `actor_user_id` from public chat responses,
- preserve `actor_user_id` internally for audit.

This is also why idempotency should scope by resolved sender identity, not only acting user ID.

### Current Production Risks

The main risks I would call out in an interview are:

1. Cross-container realtime fanout is not complete.

   Needs Redis adapter and sticky sessions.

2. Presence is local only.

   Needs Redis-backed aggregate presence with TTLs.

3. Socket rate limits are local and per socket.

   Needs Redis-backed user/IP/event limits.

4. `client_message_id` is globally unique.

   Needs scoped uniqueness by room and sender.

5. Socket backfill and socket reaction summaries bypass some newer serializer patterns.

   Needs shared chat serializer for REST and Socket.IO payloads.

6. Message side effects happen partly after broadcast.

   Needs transactional send RPC or service-level transaction boundary.

7. Schema dump and migration appear out of sync for direct-chat locking.

   Needs schema regeneration or reconciliation.

8. Membership revocation does not proactively evict sockets from rooms.

   Needs cross-instance room leave on participant removal.

## Production Hardening Plan

If I were taking this from current state to horizontally scaled production, I would do it in this order.

### Phase 1: Correctness Under Multiple Containers

- Add `@socket.io/redis-adapter`.
- Configure Redis pub/sub clients.
- Add load-balancer sticky sessions for Socket.IO.
- Add an instance ID to logs and socket metrics.
- Verify cross-container `message:new`, `message:edited`, `message:deleted`, `message:reaction_updated`, `badge:update`, and `chat:new`.

### Phase 2: Distributed Presence

- Store presence in Redis with TTL:
  - user ID,
  - instance ID,
  - socket ID,
  - last heartbeat.
- Emit `user:online` only on global offline -> online transition.
- Emit `user:offline` only on global online -> offline transition.
- Add crash cleanup via TTL expiry.
- Add metrics for ghost presence and stale sockets.

### Phase 3: Idempotency Fix

- Add scoped unique index on `(room_id, user_id, client_message_id)`.
- Backfill or drop the old global unique index after checking duplicates.
- Update idempotency lookup to include room and resolved sender identity.
- Catch unique violations and return scoped existing row.
- Add tests for:
  - same key same room same sender,
  - same key different room,
  - same key different sender,
  - concurrent duplicate send.

### Phase 4: Transactional Send Boundary

- Create `send_chat_message(...)` RPC or server-side transaction using direct `pg`.
- Include:
  - insert message,
  - update room timestamp,
  - reset sender read state,
  - update topic activity,
  - return inserted message.
- Broadcast only after commit.
- Keep badge and push delivery non-blocking.
- Add reconciliation checks for unread drift.

### Phase 5: Realtime Abuse Controls

- Move socket rate limits to Redis.
- Key limits by user/IP/event/room.
- Add limits for connect, auth failure, `room:join`, read receipts, typing stop, direct-chat creation.
- Add payload validation before database queries.
- Add per-user concurrent socket caps.

### Phase 6: Serializer Unification

- Create a shared chat serializer used by REST and Socket.IO.
- Replace socket raw user selects with safe serializer input selects.
- Make reaction summaries privacy-safe in both REST and socket paths.
- Add tests for forbidden fields in every chat payload.
- Add contract tests for REST/socket shape parity.

## Concise Interview Answer

If asked to summarize the whole design:

> Chat state is database-authoritative and Socket.IO is a best-effort realtime delivery layer. We keep process-local socket maps because socket IDs and room joins are connection-local, while durable state lives in Postgres. The current code is correct for persistence and works well on one backend instance, with client backfill for missed events. In a multi-container deployment, realtime fanout and presence are only locally correct until we add the Socket.IO Redis adapter, sticky sessions, and Redis-backed presence/rate limits. Message sends are REST-only because they are durable commands with auth, idempotency, block checks, business identity, attachments, unread triggers, and push side effects. The main fixes I would prioritize are scoped chat idempotency, transactional send side effects before broadcast, distributed socket infrastructure, and unified privacy-safe serialization for REST and Socket.IO payloads.

