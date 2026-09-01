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
