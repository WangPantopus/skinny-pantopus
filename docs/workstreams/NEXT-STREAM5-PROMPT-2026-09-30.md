# Resume prompt for the next Stream 5 session — Accounts and Social (formerly Stream 3)

Rewritten 2026-09-30T20:20:28Z (commit time; first version 04:05:05Z). You are **Stream 5**, one of the user's parallel workstreams. Until 2026-09-30 this stream was **Stream 3**. The user renumbered it because the former Streams 1 and 2 were each split in two (now Streams 1–4). Scope, accepted evidence, decisions, kit and runtime carried over.

Every fact here is a snapshot. Verify the live state (branch, worktrees, remote PRs, CI, leases) before acting.

## 1. Read first
1. [05-accounts-social.md](05-accounts-social.md) in this checkout. The top LIVE block is the current state; older blocks are history. In history, "Stream 3" / "S3" means this stream.
2. The hub [README.md](README.md): the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md`: the verification-first rules.
4. The private kit README: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md`. The path keeps `stream3`. Never print or dump the fixture credential files.

## 2. State at 2026-09-30T20:20:28Z
- **Merged today:**
  - earlier: chat privacy, account deletion, the security track, #1018, #1022, #1023, #1028, #1030 (details and seals in the status file);
  - since 16:00Z: #1037 (crew seats), #1042 (report queue), #1043, #1046, #1053 (private crew data), #1060 (unpublished crews 404), #1055 (S3-62: a verified resident can endorse), #1066 (the 14-day rule counts from `verified_at`), #1068 (chat contrast) and #1076 (**S3-22**: crew page buttons, http(s)-only links, no Directions to a home).
- **Open (as of this rewrite):**
  - **#1077**, light cards readable in dark mode: sealed `adcb284e…`, targets master.
  - **#1080**, the real profile completion percentage: sealed `a139de2d…`, stacked on #1077. Retarget it to master after #1077 merges.
  - **#1081**, native (iOS and Android): page editors keep button `url`; Directions opens Maps and is hidden for home-based crews. Waiting on CI and Stream 1's device run (4 checks listed in the PR); seal after both.
- **Follow-ups:**
  - takedown (product rules);
  - closing neighbor-message reports;
  - native report entry points on a device (Stream 1);
  - #1037's second backfill after the API deploys (user);
  - deletion for accounts with payment history (user).
  - The old **draft #842** (S3-26 mail chips): don't merge it unless it's verified or the user accepts it.
- **`/b/` pages without `/b/` reads:** in a test browser, answer `GET /api/b/:username` with the real non-writing `GET /api/businesses/public/:username` (the scripts in the S3-22 and S3-62 bundles). Prove 0 `/api/b/` requests in the API and proxy logs and 0 `BusinessProfileView` rows.

## 3. Runtime (Stream 5's own; reserved ports)
- **Stack:** `pantopus-stream3-block-r1`, Kong 64531, DB 64532. It has master's migrations through `20260930183000` plus #1037's `20260930184000`; 182000's chat-policy section went in as a delta. Apply new ones with `supabase migration up --local` from `/private/tmp/pantopus-stream5-db-r1`, after copying the file into its `supabase/migrations`.
- **API 18134:**
  1. Point the source checkout `/private/tmp/pantopus-stream3-chat-realtime-r1` at the wanted commit (detached, clean backend).
  2. From `/private/tmp/pantopus-stream3-s351-runtime-20260925-r1`, run `S3_SRC=<checkout> S3_BACKEND_TREE_OF=<sha> S3_LOCAL_STORAGE=1 nohup python3 api-launch-private.py`. The receipt is `api-start-isolation-safe.json`.
  3. It currently runs master `20e7b4768` (started 20:04:55Z), with no alert inbox set. Web 18131 serves the same master.
  4. About 10 logins per API process trip the rate limiter; restart before a new journey.
- **Proxy and web:** proxy 18130 (deletion check disabled), web 18131.
- **Fixture accounts still present:** solo2, hs2b, hs4b, hs6, hs9b, hs11b, hs12, hs12b, hs13b, hs15b, rls1, rls2. Earlier deletion journeys removed the rest (dm*, hs1–5, org1 and others).
- **Evidence bundles:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`.
  - Seal with `make-manifest.py` from `…/stream3-runtime-kit/handoff-tools-20260926`.
  - Mint the anon key in memory from the rest container's JWK; the probes in the bundles show how.

## 4. Rules in force
- **Unapproved by the user:** no `/api/b/:username` reads, no canned AI replies, no migration `20260926100000`.
- **Founder's services and devices:** never use ports 64521/64522, backend 8000 or simulator EB5AD759. Keep `/Users/yingpengwang/skinny-pantopus` read-only.
- **Destructive commands:** no reset, stash, clean or gc, and no fixture deletion outside exact ownership (delete by exact id only). Don't touch other streams' dirty files or leases.
- **Secrets:** keep secrets, raw tokens, database archives and operator logs out of Git and chat. Black out fixture emails in web screenshots.
- **Launch scope (2026-09-27):** never verify, test or fix Beacon/creator tools, personas, public scheduling, listing/task chat pickers, Gigs/Market filters, Marketplace or Open Gigs.
- **Merging:** no competing tracker or merge queue. Stream 1 batches PRs; hand each over with its head SHA, CI result and seal.
- **Migrations:**
  - ask Stream 1 for a migration number before creating any file;
  - check-migrations now requires RLS on new public tables, an EXECUTE revoke on new SECURITY DEFINER functions (RLS helpers excepted), and no table or sequence GRANT to anon or PUBLIC.
- **SQL contracts:** verify them through the PR's CI database job, never the local stack. Its arm64 Postgres crashes. When a contract change is needed, also grep for dynamic `EXECUTE format('SET LOCAL ROLE %I', …)`.
- **Evidence values:** times from `date -u`, SHAs from `git rev-parse`, exit status captured on the next line (`rc=$?`); never estimate. Grep RESULT.md for placeholders before sealing.
- **Devices:** take device slots, the heavy slot and the shared iOS driver through the tools, with `stream5:` leases. This session has no simulator access. Don't work around the user's grant; Stream 1 ran today's native pass.

## 5. Still open, waiting on the user
The acceptance rows (N01–N05, A01–A05) are verified locally, but each has a part only the user can supply:
- **Devices:** real devices with release builds: N01, N02, and A02's device parts (secure storage, biometrics, provider revocation).
- **Keys and access:**
  - push keys (N01);
  - Apple/Google sign-in in staging, and a real email service (A01);
  - hosted storage credentials (A03);
  - Smarty activation (A04).
- **Decisions:**
  - `/b/` reads (S3-22, S3-62, crew Contact toast);
  - an AI key, or accepting S3-26 as is;
  - a daily-briefing delivery policy and a Crew Day entry point (N05);
  - who processes reports (N04);
  - live-money invoice testing (A05).
- **Owned elsewhere:** N03's Pulse posting belongs to Stream 1; its Beacon parts are cut.

## 6. Next
1. Retarget #1080 once #1077 merges, then hand it off.
2. Seal #1081 after its CI and Stream 1's device results.
3. Rerun the drift scanners after big merges (kit `tools/drift-scanners/`, README inside).
4. **Recorded, not started:** move account deletion into one SECURITY DEFINER transaction, to close the narrow dry-run/delete race. This needs a migration number from Stream 1.
5. Otherwise, open new work only for a reproduced in-scope failure or a finding routed by another stream.
