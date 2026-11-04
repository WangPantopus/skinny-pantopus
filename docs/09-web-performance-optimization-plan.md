# Web and API performance plan

Updated November 4, 2026. This replaces the April audit in this file: React Query, feed virtualization, local JWT verification, private chat persistence and cross-process change notifications already exist. Reuse them. The founder requested web/backend fixes as unmerged PRs and an infrastructure plan for later; this document does not authorize deployment, purchases, hosted database changes or enabling launch-cut features.

## Recommendation

Keep Next.js on Vercel, the existing Express API/worker on EC2, and Supabase initially. Measure the actual request path, reduce unnecessary work, isolate background work and size the database before changing orchestration. If availability or sustained capacity requires a second API host, move the existing images to ECS/Fargate with an Application Load Balancer. Kubernetes is not a prerequisite for a fast app. Keep Lambda/EventBridge for the existing scheduled jobs and bounded asynchronous work.

The recorded production topology is Vercel → same-origin API/socket rewrites → api.pantopus.com → Express → Supabase in Oregon, with an API and worker sharing an EC2 host. The repository confirms the rewrites, separate worker image, local JWT checks and database-backed notification bus. Current instance type, CPU credits, database tier, region placement, utilization, budgets and CDN hit rates must be verified in the founder's consoles; older release notes are not live measurements.

## What the local audit established

Production-mode Next.js, a real local Express backend, freshly migrated local Supabase, synthetic accounts and local object storage were used. These measurements do not establish production p95 latency.

| Finding | Evidence / repair |
| --- | --- |
| Closed chat UI downloaded with the feed | [PR #3248](https://github.com/WangPantopus/skinny-pantopus/pull/3248) loads the floating inbox/conversation and the hidden inquiry drawer on demand. Initial compressed JS fell from 442,068 bytes to 401,627–405,287 bytes. |
| Initial JavaScript remains a slow-link cost | Fresh-session Chrome runs at 100 ms added latency, 1.5 Mbps download and 4× CPU slowdown took about 3.0–3.7 seconds to show initial content on Feed, Place, Messages and Today. The earlier before/after elapsed-time comparison for #3248 is inconclusive: the saved auth marker was not normalized to both test origins, which could trigger an extra session-cache reset. Retain the measured byte reduction, not a timing claim from that comparison. |
| Opening Place repeated the home authority pipeline | The shell/list and primary-home requests made 28 + 27 database calls for one synthetic owned Home. [PR #3257](https://github.com/WangPantopus/skinny-pantopus/pull/3257) shares one list response, reducing these to 28 calls while retaining opening/final access checks, primary ordering, bounded freshness and older-server fallback. |
| Slow property records held the entire Place screen | With an eight-second ATTOM transport fault, three first-usable-screen measurements were 8,320 / 8,210 / 8,198 ms. [PR #3258](https://github.com/WangPantopus/skinny-pantopus/pull/3258) applies the existing 3.5-second section budget to all external-provider composers: 3,776 / 3,668 / 3,660 ms with the same browser build/account state. Late sections show retry controls; the rest of the dashboard renders. The fault intercepted the request locally and never contacted ATTOM. |
| Feed photo was visibly blurred and cropped | A real upload's 200×200 thumbnail filled a 606 px card. The fix uses the original image, resized by Next for allowlisted public storage. Signed Supabase objects and private chat keep their direct paths. [PR #3250](https://github.com/WangPantopus/skinny-pantopus/pull/3250) |
| Closing a feed image prevented scrolling | Both parent and child restored body overflow; it remained `hidden`. The viewer now owns the lock. |
| Comment URLs were not clickable | Comments now reuse the existing post/chat URL renderer. |
| Post attachments required a pointer | The standalone post page now gives ordinary media tiles keyboard controls. |
| Header/menu exceeded narrow screens | [PR #3252](https://github.com/WangPantopus/skinny-pantopus/pull/3252) keeps controls inside the viewport and limits the enlarged menu: 576 px before, 304 px after on a 320 px viewport at 32 px root text. Header checks passed at 320/390/768/1440 px and 16/32 px root text. |
| Post uploads created unused derivatives | The real upload produced original + thumb + card + detail + full. [PR #3251](https://github.com/WangPantopus/skinny-pantopus/pull/3251) keeps original + thumb for posts, avoiding three encodes and three object writes. Listing defaults and legacy cleanup stay intact. |

The local checks include posting a photo and mixed photo/PDF/video attachments, opening media, replies, likes, saves, reloads and a second person's view. Chat photo/PDF/video send and recipient PDF rendering passed. An intentionally failed feed image showed a visible error and recovered through the retry control. Feed PDF rendering was checked in development: the production CSP correctly excludes loopback storage.

Initial loads of Place, Today, Nearby, Messages, Profile, Settings, Discover and Connections also passed with these synthetic accounts; that smoke check does not cover every action or household role.

The startup follow-up used a verified synthetic Home as well as the no-home account. Chrome checks covered one shared home read on reload, a second account denied access to that Home, older-server fallback, unavailable-list retry/recovery, and a frozen Home disappearing after reload. The provider-fault case verified empty retryable error envelopes, a working retry without navigation, and recovery after removing the fault. Responsive checks wait for the existing sidebar transition to finish before measuring; settled Place layouts passed at 320, 390 and 1440 px, including resizing from desktop to mobile.

The observed startup path is HTML and script loading → session hydration and concurrent shell reads → primary Home or feed location resolution → page data. Place's full response waits for its section composers. Its property calls have a 10-second upstream limit and weather calls a five-second limit; these previously bypassed the section budget. In the local one-home trace, a cold intelligence read initiated 124 outbound fetches (database and public providers); warm reads initiated 49. This is a request fan-out diagnostic for that fixture, not a production request average. The shared-home change removes duplicate authorization work without weakening any check. The section-budget change limits foreground waiting; it does not itself reduce provider work or database load.

Two anonymous hosted browser probes returned HTML quickly (roughly 15–108 ms TTFB from this machine), while `/app/feed` redirected to login as expected. Those probes do not measure authenticated production or disprove a regional/infrastructure problem. Authenticated hosted waterfalls, expired-access-cookie recovery, database/provider timings, and representative devices remain necessary to explain the full reported 5–10 seconds. No production settings were changed.

An expired-access-cookie diagnostic followed the real local refresh endpoint back to Feed: one ordinary run took 1,038 ms and one throttled run (100 ms / 1.5 Mbps / 4× CPU) took 4,245 ms. In the throttled run the refresh POST started at 2,197 ms, and navigation back to Feed began at 2,331 ms. Loading and hydrating the recovery page therefore consumed much more of this sample than the refresh request itself. These single runs identify another path to profile, not a speedup comparison. Any reduction of that route's initial code must preserve token single-flight, invalid-session cleanup, private-cache retirement and the redirect-loop guard. Local recovery probes use one consistent hostname: Next normalizes loopback redirects to `localhost`, so mixing it with `127.0.0.1` loses host-scoped cookies and does not test the intended flow.

These application PRs remain unmerged; none of these findings asserts a production deployment. The web changes passed all 123 existing web suites (2,383 tests); the backend upload change passed 342 runnable suites (6,632 tests) and privacy gates, with the existing skips retained. The PRs carry their exact verification and limitations. The April numbers and promised cumulative speedups have been removed because they no longer describe this code.

## Measure the delay before buying capacity

Use a small synthetic account cohort and the same released commit. Measure signed-out arrival, signed-in cold arrival, hard refresh, warm tab navigation, restored chat, expired-access-cookie session recovery, and slow/offline recovery separately. Include accounts with no Home, a verified Home and time-limited guest access. Include Place, Today, Pulse, Messages and a post with attachments. Use desktop and 390/320 px viewports, normal and enlarged text. Use at least 20 controlled repeats for cold/warm comparisons and 100 or more observations per cohort before interpreting p95. Report sample count, median and p95, cache state, geography, device and build when making a hosting decision. Keep cookies **and origin-scoped session markers** consistent when comparing local ports; do not remove the session-cache reset to improve a benchmark.

Break the timeline into DNS/TLS, document TTFB, script transfer/parse, hydration, profile/session check, location resolution, first data response, first meaningful card and first successful interaction. Track LCP, INP and CLS, but also a custom first-feed-card and first-message metric: a skeleton can improve paint metrics while the app still feels slow. Inspect Vercel external-origin connection timing separately from function execution. A function-region setting does not prove an external rewrite uses that same route. [Vercel rewrites](https://vercel.com/docs/routing/rewrites)

On the API, record route templates, request IDs, status, total duration, authentication time, number/time of database requests, upstream provider time, queue wait and event-loop lag. Never record cookies, tokens, message bodies, full query strings, exact addresses or private file URLs. Reuse the current logger/request IDs and existing metrics first. Keep infrastructure access logs short-lived and restricted; publish only aggregates and synthetic traces. A new monitoring vendor is a founder decision; the prior pilot choice was no error-monitoring service.

Initial acceptance targets (proposed budgets, not measured current performance):

| Measure | Target |
| --- | --- |
| First usable signed-in screen, supported desktop on ordinary broadband | p75 ≤ 2.5 s; p95 ≤ 4 s |
| Warm navigation to data already in memory | p75 ≤ 250 ms |
| LCP / INP / CLS | p75 ≤ 2.5 s / 200 ms / 0.1 |
| Profile, location, badge reads, origin API excluding WAN | p95 ≤ 300 ms |
| First feed or inbox data response, origin API excluding WAN | p95 ≤ 500 ms |
| Ordinary text mutation acknowledgement, excluding media transfer | p95 ≤ 700 ms |
| API failures and saturation | Separate expected 4xx from 5xx; investigate sustained 5xx > 1%, event-loop lag > 100 ms, CPU > 70%, memory > 80% |

Treat thresholds as investigation triggers. Tighten them with real baseline data; do not autoscale merely because one sample is slow.

## Reduce frontend and API work

1. Keep a usable shell and page skeleton in initial HTML. Never delay navigation for badge counts, business switcher details, map prefetch, AI suggestions or offscreen link previews. Inspect the initial request waterfall and defer only genuinely nonessential calls; a timeout is not a successful empty result.
2. Extend existing React Query entries (`lib/me`, `primaryHome`, `myHomes`, `conversations`, `useFeedData`) instead of adding independent caches. Share in-flight identical reads. Keep the previous successful result during a refresh, indicate failed refreshes, and retain drafts on failed writes. Respect the current fresh windows and account-switch cleanup.
3. Split expensive drawers and editors at their actual opening condition. A dynamic import that is still rendered immediately, or has another static import path, will not remove startup work. Compare bytes and actual ready time after every split.
4. Preserve feed cursor pagination and virtualization. Bound DOM/media decoding, reserve image aspect ratios, and verify back navigation restores the prior scroll position. Run long-list checks with synthetic data before changing row measurement.
5. Profile sequential PostgREST calls and repeated session/role reads under concurrent startup requests. Coalesce equivalent in-flight reads without extending authorization TTLs. Any implementation must fence invalidated in-flight results, immediately honor local sign-out, and treat failed reads as retryable outages rather than missing users or empty permissions.
6. Batch author/reaction enrichment using the existing feed service. Use selected columns and bounded pages. Examine `pg_stat_statements` plus `EXPLAIN (ANALYZE, BUFFERS)` on representative local/staging data before proposing an index. Add indexes only in additive migrations, using the repository's lock-timeout/migration rules. No parallel feed or cache tables.
7. Preserve the existing Supabase operation deadlines (10 s for ordinary calls, longer for storage). Apply the existing section budget consistently to external Place providers. A late section is a retryable error, not an empty success or an all-clear reading. Existing bounded background lookups can finish to populate their shared caches; cancel work that has no remaining consumer or cache value. Retrying cannot multiply a 10 s deadline three times on a foreground screen. Use capped jittered retries only for transient idempotent reads; writes need their existing idempotency keys and an honest pending/unknown result.

## Cache policy

Cache public facts and immutable bytes aggressively. Keep account-specific authority current. Cache keys must include every input that changes the answer.

| Layer / data | Proposed policy and invalidation |
| --- | --- |
| Hashed Next.js JS/CSS | Keep Vercel's immutable asset delivery; a deployment changes hashes. Do not cache HTML/RSC under the same rules. |
| Public static/landing content | Existing static generation first; for provider-dependent public content use bounded revalidation with an explicit age/source. Do not apply public caching to an authenticated response. |
| Signed-in HTML/RSC/API | Preserve private/no-store for private responses. Do not blanket-cache `/api`, `/app`, cookies, Authorization or signed links in Vercel, Cloudflare, CloudFront or a service worker. |
| Browser account data | Existing memory query cache, bounded to 200 entries/30 min unused; preserve session replacement and 403/404 retirement. Use existing guarded chat storage only, with its retention, sign-out and membership invalidation. Do not persist a second copy of the whole feed/profile. |
| Public feed photos | Unique immutable upload keys; use the full source with a responsive optimizer or established larger derivative, never enlarge 200 px square thumbnails. Keep the host/path allowlist; private chat and signed URLs bypass a shared optimizer. Measure image hit rate, output dimensions, bytes and first-visit transform latency. |
| Private chat/documents | Authenticate each server read against current access. Preserve API no-store policy and the existing deliberate encrypted/local chat storage lifecycle. A CDN must not make private files publicly reusable. |
| External provider data | Reuse `ContextCache`, `ExternalFeedCache`, `PlaceSectionCache`, `PropertyIntelligenceCache` and `AttomPropertyCache`. Public area facts can share normalized area/provider/input/version keys; exact parcel and Home records retain their existing scope and authorization, never a public CDN policy. Set freshness per source; retain a dated last-good value only where that is truthful. Failure is not “all clear.” |
| Role/session/permission data | Keep existing short TTLs and invalidation signals. No generic Redis/CDN copy of authorization decisions. Account and membership changes must invalidate in-flight work as well as completed entries. |
| Optional shared cache after measurement | Managed ElastiCache Valkey in the API region, TLS/auth/private network, bounded memory and TTL jitter. Start with expensive public facts or distributed rate-limit state only. Prefix keys by environment/schema version; bypass on cache outage for public reads and apply an explicit safe policy to security limits. |

Prevent stampedes with per-key in-flight sharing on one process; introduce distributed locking only if multiple instances actually duplicate expensive work. Use a short lock expiry, owner token, bounded wait and last-good public data. Never turn a cache miss into unbounded parallel provider calls. Delete/permission events must still reach every browser. The app already has Postgres `LISTEN`/`NOTIFY` (`syncChangedService`, `chatRealtime`); evaluate and reuse that before introducing Redis pub/sub.

Supabase has an existing storage CDN. Verify its plan and observed caching before paying for another distribution in front of the same files. Smart CDN capabilities are plan dependent. An extra CDN also needs a deletion/revocation strategy, not only long TTLs. [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn)

Next.js responsive images depend on accurate `sizes`, permitted remote paths and source resolution. Cache expiry cannot restore detail already discarded in a thumbnail. Do not widen the optimizer to arbitrary remote hosts. [Next.js Image documentation](https://nextjs.org/docs/app/api-reference/components/image)

## Hosting choices

| Option | Fit and decision |
| --- | --- |
| Keep EC2 + current containers | Recommended now. Lowest migration work, already supports long-lived sockets and the worker. Check CPU credits if burstable, memory/OOMs, disk space, process limits and API/worker contention. A single host remains an availability risk. |
| ECS on Fargate | Recommended next when a second host/rolling availability is justified. Reuse API and worker images; separate services, health checks, managed task replacement and measured scaling. Account for ALB, task minimums, egress, NAT/VPC endpoints and logs. |
| ECS on EC2 | Reasonable if sustained utilization and an operator justify managing a container host pool. Compare the full operating cost, not only per-vCPU price. |
| EKS/Kubernetes | Defer. Current app structure does not demonstrate a need for Kubernetes APIs or its operational overhead. Revisit only for a concrete organizational/platform requirement. |
| Lambda/serverless API rewrite | Keep for bounded jobs and events. Moving the entire Express/socket/auth flow is a larger contract change, with cold-start, connection and streaming implications. It does not remove slow SQL or excess browser work. Fargate is already an option for running containers without managing hosts. |

AWS distinguishes the orchestrator (ECS/EKS) from compute (EC2/Fargate); compare them as separate choices. [AWS container decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html)

### First hosted improvements, after founder approval

- Confirm API, database and shared cache locations. Place compute doing repeated database calls near the database; Vercel function regions should match the actual downstream path. Measure from West Coast and East Coast browsers before and after. Avoid speculative multi-region API replicas that still call one distant writable database. [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)
- Give API and worker separate resource budgets. If background ingestion/image work causes event-loop or CPU spikes, move the existing worker to a separate instance/task before scaling every service. Keep exactly one owner for each schedule and retain current disabled jobs/flags.
- Inspect database CPU, memory, I/O and connection saturation. Optimize the largest repeated queries first; upgrade Supabase compute/backups when measured constraints and the founder's budget justify it. Keep the present database and schema. [Supabase performance](https://supabase.com/docs/guides/platform/performance)
- Budget connections across API replicas, workers, PostgREST and job consumers. Keep `LISTEN`/queue connections on an appropriate direct or session connection; transaction pooling is for compatible request workloads, not session-dependent listeners. Verify prepared-statement compatibility. [Supabase pooling](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits)
- Check compression and immutable cache headers end to end, HTTP keep-alive, proxy read/upload timeouts and socket upgrade support. Keep same-origin browser cookies/CSRF, trusted forwarded-IP handling and refresh-cookie paths intact.

### ECS readiness gate

Before two API replicas: verify cross-instance chat delivery, edits/deletes/reactions, typing, unread counts, reconnect catch-up and immediate session revocation using the existing database notification bus. Determine whether any event remains process-local. Share or safely redesign in-memory rate limits and replay guards; a second process must not double a person's allowance. Review upload buffering and each process's caches.

Keep socket polling fallback unless intentionally removing it: Socket.IO polling requires session affinity, while cross-node broadcasts require a working propagation mechanism. Configure ALB stickiness/idle timeout and graceful drain; test forced task replacement and rolling deployment. Do not assume a generic socket adapter also solves the application's authorization events. [Socket.IO multiple nodes](https://socket.io/docs/v4/using-multiple-nodes/)

Then provision two API tasks across availability zones, an independently sized worker service, appropriate health endpoints, least-privilege task roles and secrets supplied by the founder. Select CPU/memory from measured load. Maintain one controlled migration step per release and backward-compatible schema changes. Keep the previous task definition and database-compatible image available for rollback.

## Implementation order and decision gates

| Stage | Concrete work | Evidence required before moving on |
| --- | --- | --- |
| Application PR review | Review the independent startup, media, upload and narrow-screen fixes. Keep them unmerged until the founder chooses. | Existing checks green, local browser results, measured bytes/work saved and known limits in each PR. |
| Hosted baseline | Founder/operator verifies regions, instance type/credits, container resource usage, Supabase plan and current origin/CDN headers. Collect the route and browser timings above for 24–48 hours of representative usage. | A waterfall plus API/database breakdown identifying the dominant delay. No synthetic load against production without approval. |
| Existing-host tuning | Remove measured duplicate calls/queries, tune existing caches, isolate the worker if needed, and adjust EC2/database capacity only when saturation is observed. | Repeat cohort improves p75/p95; authorization, upload and socket checks still pass. |
| Shared cache decision | Compare repeated expensive public/provider work across processes with cache memory and operating cost. | Cache hit/miss benefit exceeds extra connection/serialization time; outage fallback and invalidation rehearsal pass. |
| ECS migration decision | Use a second API host when single-host availability, releases or sustained capacity require it; complete the readiness gate below first. | Two-replica staging exercise, rolling replacement, connection budget, rollback rehearsal and founder-approved monthly cost ceiling. |

Do not require every stage. If application fixes plus a correctly sized EC2/database meet the targets, stop there and retain the simpler deployment. Performance checks should continue with ordinary releases.

## Rollout, cost and proof

1. Land approved application PRs individually only when the founder authorizes merging. Each must have existing checks and real-browser evidence. A master merge can deploy this repository automatically.
2. Capture a hosted baseline with synthetic users. Do not export real messages, device tokens or operator logs into this public repository.
3. Change one hosted variable at a time: region/path, resource isolation, database capacity, then shared cache if needed. Re-run the same cohort and correctness checks. Keep the previous settings and rollback trigger documented before changing them.
4. Rehearse peak expected concurrency and a short 2× burst on an authorized environment: browse, post, upload, message, refresh and reconnect together. Check p95/p99, database connections, queue age, failures and memory recovery. Do not load-test production without founder direction.
5. Roll back on materially worse p95, authentication failures, missing/duplicate messages, failed private-media checks or sustained 5xx. Additive migrations stay applied; rollback must use a compatible older image.

Create an AWS Pricing Calculator estimate in the verified region before any purchase. Compare current monthly EC2/EBS/egress + Vercel + Supabase + jobs against: two minimum API tasks + worker + ALB + network/egress + cache + logs. Include paid database capacity/backups and image transformation/egress usage. Use observed request volume, peak concurrency, average image bytes, cache hit rate and retention as inputs; no price or load is assumed here. Set spending alerts and an agreed monthly ceiling before rollout.

Success means the same measured user flows become faster while reload persistence, drafts, privacy, blocks, membership revocation, notifications and other-person views still work. This audit does not claim every route or every codec/browser is verified. Physical phones, hosted latency, live payments, paid geocoding/AI, store submission and production failure/scale tests remain outside the local evidence.
