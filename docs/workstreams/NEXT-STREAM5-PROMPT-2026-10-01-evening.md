# Resume prompt for the next Stream 5 session — Accounts and Social (formerly Stream 3)

Written 2026-10-01T17:52Z (from `date -u`; the commit time is authoritative). It replaces [NEXT-STREAM5-PROMPT-2026-10-01.md](NEXT-STREAM5-PROMPT-2026-10-01.md); that file's rules and runtime notes still apply where this one doesn't change them.

You are **Stream 5**, one of the user's parallel workstreams.
- **Naming:** records before 2026-09-30 call it "Stream 3" or "S3".
- **Scope:** accounts, sign-in/sessions, profiles and privacy, connections and blocks, chat, notifications, reports, and crews (business pages, owner tools, invoices and packages, seats).
- **Snapshot:** every fact here is a snapshot. Check the live branch, worktrees, PRs, CI and leases before acting.

## 1. Read first
1. **[05-accounts-social.md](05-accounts-social.md)** on `codex/workstream-coordination`. The top LIVE blocks are the current state, newest first.
   - The coordination checkout is shared: other streams leave dirty files there. Commit **only your own file, by explicit path**, never stash, and never touch their files.
   - `git pull --rebase` refuses while others' files are dirty, so fetch first. If the remote moved, use `git pull --no-rebase` (a merge) when the incoming changes don't touch the dirty files.
2. **The hub [README.md](README.md):** the five-stream numbering and the 2026-09-27 LAUNCH SCOPE block.
3. **`AGENTS.md` and `docs/PROJECT_HANDOFF.md`** in the app repo: the verification-first rules.
4. **The private kit:** `…/.pantopus-recovery/stream3-runtime-kit/README.md` and `tools/stream5-e2e/README.md`. Never print or dump the fixture credential files.

## 2. State at 2026-10-01T17:52Z (master `c5ab503df`, batch 314)
### Merged today (Stream 5)
- #1341 #1342 #1343 #1344 #1346 #1349 #1351 #1353 #1362 #1371 #1382 #1395, and earlier ones (see the LIVE blocks).
- **#1382 is a SECURITY fix.** One malformed chat socket event could stop the whole API.
  - **The repository is public:** its PR text is deliberately neutral ("chat socket hardening"). The details are only in the private bundle `20261001-stream5-socket-crash-guard-r1`.
  - Stream 1 told the user the backend should be deployed promptly.
- **#1395:** a repeated sign-up gets the first 201, and an overlapping sign-up can no longer delete the account.
  - The addendum `20261001-stream5-signup-race-addendum-r1`: a second `generateLink` keeps the original password. Stream 1's optional follow-up was declined.

### Open PRs: what each needs
Bundles are under `…/.pantopus-recovery/audits/<bundle>`, each with RESULT.md and MANIFEST.json. Seal with `zsh …/stream3-runtime-kit/tools/stream5-e2e/seal-pr.sh <pr> <branch> <full head sha> <bundle NAME> "<verdict without quotes>"` once CI is green, then send Stream 1 the PR, head, bundle and seal.

| PR | What | Head | Bundle | Needs |
|---|---|---|---|---|
| #1380 | seat-invite renew + one pending invite per email (migration **20261001138000**, renumbered from 136000) | `80f2d5822` | `20261001-stream5-seat-invite-renew-r1` | **Sealed `0e248f90…`**. Merges with #1381. Stream 1 has it. |
| #1396 | a repeated crew create gets the first 201 | `51cad4882` | `20261001-stream5-crew-create-repeat-r1` | **Sealed `28b1b171…`**. Stream 1 has it. |
| #1366 | invoice recipient endpoint + web picker | `ab5c3470c` | `20261001-stream5-invoice-recipient-picker-r1` | **Sealed `090059b6…`**, but its base is #1357's branch. After #1357 merges: `gh pr edit 1366 --base master`, prove the merge with `git merge-tree`, re-seal if master moved. |
| #1381 | native: copy the seat-invite link | `736d38fea` | `20261001-stream5-seat-invite-link-native-r1` | Device pass recorded (Stream 1 `20261001-stream1-cand31-device-cells-r1`, seal `2a8dd3c0…`). **Seal when iOS CI is green**; it merges with #1380. |
| #1387 | a reaction retry keeps the reaction (`reacted`) | `f8fbea665` | `20261001-stream5-reaction-intended-state-r1` | Device pass recorded (same cand31 bundle). **Seal when iOS CI is green.** |
| #1338 | password change keeps the current session | `7f08153b7` | `20261001-stream5-password-change-session-r1` | Device pass recorded. **Seal when iOS CI is green.** |
| #1356 | the new-password field stays masked | `09e1ab26a` | `20261001-stream5-password-field-masked-r1` | Device pass recorded. **Seal when iOS CI is green.** |
| #1357 | crew invoice create + package buy take `client_request_id` | `88d7fedd9` | `20261001-stream5-crew-intent-keys-r1` | Device pass recorded. **Seal when iOS CI is green.** If the emulator job fails on infrastructure: `gh run rerun <id> --failed`. |
| #1367 | native invoice recipient picker (stacked on #1366) | `0c655233f` | `20261001-stream5-invoice-recipient-picker-native-r1` | Device pass recorded (`20261001-stream1-cand30-device-cells-r1`). Seal when iOS CI is green. After #1366 merges, retarget to master and prove the merge. |
| #1408 | catalog category/item + package creates take `client_request_id` (server, web, iOS, Android) | `46ae1afbc` | `20261001-stream5-catalog-package-keys-r1` | CI was running at handoff. **Device check requested from Stream 1** (add an item, a category and a package; a lost-reply retry of each ends with one row). Seal after CI is green and Stream 1's bundle has been recorded in the RESULT's Native section. |
| #842 | draft | – | – | Stays a draft. |

**At handoff,** only the macOS (iOS) CI jobs were pending on #1338, #1356, #1357, #1367, #1381 and #1387. Check each once with `gh pr view N --json statusCheckRollup`; don't poll in loops.

## 3. Runtime (Stream 5's own)
- **Database:** stack `pantopus-stream3-block-r1`. DB at 127.0.0.1:64532 (postgres/postgres), Kong at 64531.
  - The migration ledger ends at `20260930184000`. `20261001100000` and `20261001130000` (Stream 5) were applied by hand, with content equal to master's files, but have no ledger rows.
  - Other streams' `20261001131000`–`137000` are **not** applied. Apply master's file unchanged before testing anything that depends on one, and drop unmerged migrations after a test.
- **API 18134:** tree `/private/tmp/pantopus-stream3-chat-realtime-r1` on master `c5ab503df`, started 17:52:26Z. To move it:
  - `git -C <tree> checkout -q --detach <sha>`, then kill the pid on 18134;
  - from `R=/private/tmp/pantopus-stream3-s351-runtime-20260925-r1`, run `S3_SRC=<tree> S3_BACKEND_TREE_OF=<full sha> S3_LOCAL_STORAGE=1 nohup python3 api-launch-private.py > /dev/null 2>&1 &`;
  - copy `$R/api-start-isolation-safe.json` into the bundle before the next restart, which overwrites it.
  - About 10 logins or 20 sign-ups per process trip the limiters, so restart between probe sets.
  - Each owner can create 3 crews a day (active owner seats); deleting the test crews frees the count.
- **Web 18131: stopped.** Tree `/private/tmp/pantopus-stream3-web-chat-names-r1` on master `c5ab503df`.
  - Start it with the Bash tool's **`run_in_background: true`**: `cd $R && S3_WEB_PAID=1 python3 web-launch-private.py <web tree>`. A `nohup … &` Next process dies with the tool's shell. `S3_WEB_PAID=1` turns on the paid scheduling pages.
  - Run the web typecheck gate, ESLint and Jest in that tree; this worktree's `node_modules` is stale.
  - Quirks of this runtime only: the page runs on `stream3.localhost`, so the web socket can't connect (the API logs `GET /socket.io` 404) and the web falls back to REST. A POST passed with `route.fallback()` doesn't reach the API, so forward it with `route.fetch({ url: API + path })`, or abort after the fetch to simulate a lost reply.
- **Job harness** (backend code with the API's own admin client; ports aren't checked): `HARNESS_SCRIPT=… HARNESS_LABEL=… HARNESS_USER_ID=… HARNESS_OUT=… S3_SRC=… S3_BACKEND_TREE_OF=… python3 $R/job-harness-launch-private.py`.
- **Fixtures:** none remain from this session. Every run deleted what it made by exact id, and the all-table "created/updated since start" scans are clean apart from sign-in security events, which are left as in earlier bundles.
  - The test crew owners were hs13b, hs15b and hs12b.
  - Leave "S5 Crew Biz" (`s5_gig_biz_dfa0bf`) alone.
- **Reusable probes from today** (in each bundle's `scripts/`):
  - `send-twice.mjs`;
  - `socket-crash-probe.mjs` (a Node socket.io-client from the API tree's `node_modules`);
  - `reaction-twice-probe.mjs`;
  - `signup-race-probe.mjs`, and `signup-overlap-probe.mjs` (a psql `LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE` plus `pg_sleep` widens a race deterministically);
  - `generatelink-twice-harness.cjs`;
  - `crew-create-repeat-probe.mjs`, `catalog-package-keys-probe.mjs`, `web-keys-journey.mjs`;
  - cleanups: `crew-cleanup.py` (scans every uuid column for the crew ids), `signup-cleanup.py`, `package-cleanup.py`.

## 4. Rules in force
- **The user's standing direction:** never stop or wait. Decide for the best UX, safety, security and retention, and record every decision in the status file, the PR and memory. Help other streams through Stream 1's routing, telling the owner first. Money, legal and new-table questions go to the user.
- **Merging:** Stream 1 runs the only merge queue. Seal, send the seal, and Stream 1 merges.
- **Migrations:** ask Stream 1 for a number before creating one. The number must sort after master's newest, so renumber with `git mv` if master passes it.
- **Not approved by the user:** no `/api/b/:username` reads (use the substitution), no canned AI replies, never migration `20260926100000`.
- **The founder's environment:** never ports 64521/64522, backend 8000 or simulator EB5AD759. `/Users/yingpengwang/skinny-pantopus` stays read-only. Native device runs are Stream 1's.
- **Destructive commands:** no reset, stash, clean or gc. Delete fixtures by exact id only. **Never run anything inside a sealed bundle:** start an addendum bundle instead.
- **Public repository:** describe security fixes neutrally in commits, PRs and the status file, and keep the details in the private bundle.
- **Secrets:** keep secrets, raw tokens and logs out of Git and chat; mask emails in screenshots; never put addresses in SQL text (use psql `-v`).
- **Launch-scope cuts:** never verify, test or fix them. Invoices, packages and payouts are never gated.
- **Evidence values:** take them from `date -u`, `git rev-parse` and `gh` only.
  - The seal refuses `TODO`, `TBD` or `FIXME` anywhere in RESULT.md, even when quoting code.
  - The RESULT must keep exactly one `CI_SECTION` until the seal fills it.
  - Only `@example.com` addresses may appear in records.
- **iOS:** SwiftLint and SwiftFormat don't type-check. When a closure or initializer signature changes, grep every caller, `#Preview` blocks included (#1381 broke Stream 1's iOS build this way). Prefer defaulted parameters.

## 5. Backlog, in order (each confirmed in code; reproduce before fixing)
From the idempotency audit (`20261001-stream5-native-post-idempotency-r1`, `source/classification.tsv`):
1. **`POST /api/scheduling/invoices/:id/send`:** a repeat sends a second "You have a new invoice" notification and push.
2. **`POST /api/files/portfolio`:** a duplicate public portfolio item on a retry (client key, like #1408).
3. **`POST /api/businesses/:id/verify/upload-evidence`:** a sequential retry shows a failure for a submission that worked (Android `BusinessLegalViewModel.kt:368-374`).
4. **UserReport race:** 6 simultaneous reports make 6 rows and 6 alert emails. A unique index needs a migration number from Stream 1 and a check of production duplicates.
5. **Lower:**
   - `upload/chat-media` orphans files against the quota (needs a clean-up design);
   - `upload/profile-picture`, `upload/business-media` and `upload/ai-media` orphan objects (benign).

The older candidates in the 10-01 prompt's section 5 still stand: the name card is hover-only (design call); the web profile has no Connect (design call); placeholder-named fields; AppShell dialog backdrops; dialog focus.

## 6. Waiting on the user (don't start)
- Report takedown rules; closing neighbor-message reports; native report entry points on a device.
- #1037's second backfill; account deletion with payment history; SECURITY DEFINER deletion.
- S3-26; the iOS crew-profile toast; the monthly summary's content.
- Four product questions: the view-as exposure audit or notice (#1304); whether the P0.2 email was sent; "Home affiliation" (wire or remove); "Find me by real name".
- Server-sent seat-invite email (a product decision).

## 7. Next, in order
1. Tell Stream 1 you are the new Stream 5 session, then read the newest LIVE block in 05-accounts-social.md.
2. Check CI once for the open PRs in section 2.
   - Seal each green one and send the seal: #1381 and #1387 first, because they merge with #1380.
   - Handle the stacked retargets as #1357 and #1366 merge.
   - Record Stream 1's device bundle for #1408 when it arrives.
3. Then section 5, one PR at a time: reproduce through the real API and web, make the smallest fix, run E2E before and after, clean up by exact id, seal, hand off.
