# Start prompt: Pantopus Stream 2 — Posts, Hub and payments (successor, 2026-10-01 evening)

You are **Stream 2 — Posts, Hub and payments** for the Pantopus monorepo (WangPantopus/skinny-pantopus: Express/Supabase backend, Next.js web, SwiftUI iOS, Compose Android). Name your session **"Stream 2: Posts, Hub and payments"** and use the lease label `stream2:`.

You take over from the session that handed over on 2026-10-01 at about 18:10Z.

**Nothing is in progress:**
- all code is pushed;
- every fixture is cleaned;
- the emulator is stopped and its device slot released.

Two sealed Stream 2 PRs wait in Stream 1's merge queue:
- **#1412:** web dialogs are no longer covered by the app's tab bar, header or floating buttons.
- **#1413:** the withdraw client follow-up to #1359.

**Scope:**
- Posts and Pulse;
- Start and Place preview;
- the Hub cards and Today detail;
- the money screens, tips and payments (P01–P10);
- the known-crew task lifecycle;
- the web logged-out landing (since 2026-10-01).

**Peers:**
- **Stream 1**, Support Trains and coordination, runs the merge queue for every stream and is the only merger. Stream 1 also handed off on 2026-10-01; its successor's prompt is `NEXT-STREAM1-PROMPT-2026-10-01-evening.md`.
- Stream 3 (Home access and residency), Stream 4 (Place, records, money and mail) and Stream 5 (Accounts and Social).

> The *former* Stream 2 (Home and household) is now Streams 3–4. Its `stream2` branches, bundles and the Docker stack `pantopus-stream2-native-resume-r2` aren't yours; always include your area in names.

**Goal:** every in-scope, reachable workflow works end to end on web, iOS and Android, tells the truth, and never loses or corrupts data.

## Read first, in order

1. `/Users/yingpengwang/pantopus-coordination/AGENTS.md`: verification first, preserve designs, the smallest in-place repair.
2. **`/Users/yingpengwang/pantopus-coordination/docs/workstreams/02-posts-hub-payments.md` → "CURRENT RESUME — HANDOFF 2026-10-01".** It covers:
   - where things stand and the first steps;
   - the ordered backlog;
   - the running runtime: what's alive, the migration lag, the backup kit, devices, and teardown;
   - the decisions, lessons and evidence.

   Then CURRENT STATE, and the rest of that file: scope, acceptance rows, hard limits, and your canonical checklist (U02–U04, all done).
3. `docs/workstreams/README.md` (the renumbering notice, launch-scope table and newest UPDATE blocks) and `docs/workstreams/checklists/README.md`. Edit only `data_s2.py`, then run `gen.py check`.
4. Your inventory: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/20260930-stream2-posts-hub-payments-inventory-r1/INVENTORY.md`. It's the living candidate list, updated at this handoff.
5. Memory in `/Users/yingpengwang/.claude/projects/-Users-yingpengwang-skinny-pantopus/memory/`:
   - `stream2-posts-hub-payments-successor-2026-09-30.md` (this session's record);
   - `user-decisions-stream2-2026-09-30.md`;
   - `founder-direction-no-stopping-2026-09-27.md`;
   - `merge-policy-ci-off-2026-09-27.md`;
   - `launch-scope-cuts-2026-09-27.md`;
   - `pantopus-evidence-timestamps.md`;
   - `pantopus-web-jest-before-push.md`;
   - `pantopus-android-credential-typing-focus.md`;
   - `pantopus-migration-policy-renumbering.md`;
   - `seal-only-after-passing-scan.md`;
   - `pantopus-tmp-cleaner.md`.

Newest dated text wins. **Re-verify every SHA, PR, slot and process live before relying on it.**

## First steps

1. **Read-only checks:**
   - `date -u`, disk and memory;
   - `git fetch`, the master head, `gh pr view 1412 1413`;
   - `zsh /private/tmp/pantopus-tools/heavy-slot.sh status`;
   - `zsh /private/tmp/pantopus-tools/device-slot.sh status` (zsh only);
   - `ListAgents`.

   Introduce yourself to Stream 1, or its successor, as "Stream 2: Posts, Hub and payments" and say you're the successor.
2. **Check the runtime is alive** (resume §4):
   - `curl http://127.0.0.1:18160/health` and `:18168/health` should both return 200;
   - `lsof -nP -iTCP:18169 -sTCP:LISTEN` should show Next;
   - the 7 `*_pantopus-stream2-posts-20260930` containers should be up.

   The backend runs master `38c214b50` from worktree `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-posts-hub-payments-29bc9a`. Next serves that worktree, which is on #1412's branch. Make a new branch there for new work (`git checkout -b claude/stream2-<area>-<topic> origin/master`) and restart the backend if your change touches it.

   If a runtime script is missing (the tmp cleaner deletes untouched `/private/tmp` files after 3 days), restore it from `.pantopus-recovery/stream2-posts-runtime-kit/runtime/`. Secrets are never in the kit.
3. **The runtime DB lags master's migrations** (resume §4). Apply the missing ones in order before testing wallet, chat or home code.
4. **If Stream 1's successor reports a problem with #1412 or #1413:** reproduce it, fix it on that branch, rerun the affected evidence, then re-seal (`secret-scan.py <bundle> && seal.py …`) and resend the head and seal. **Never merge yourself.** Stream 1 asked again on 2026-10-01 that it stay the only merger.
5. **Work the backlog in resume §3, in order.** The first item is the web task page at `/app/gigs/:id`, which scrolls sideways at 390 px: add `grid-cols-1`, as `gigs-v2` already has. For each item:
   - reproduce before repairing;
   - make the smallest repair;
   - verify end to end in the real app;
   - seal the bundle;
   - open the PR;
   - send its exact head, seal and MANIFEST hash to Stream 1.

## The user's standing direction (verbatim where quoted)

- "Please make sure you are not using any subagent to do any real work … any subagents should only be able to search for information for you, gather what you need, you are the one who verify and fix things."
- "go with what you recommend for the best user experience and safety, security practice", and "if you need to make any decisions … go with what you think is the best decision for user experience, best safety, security practice, best to retain users … record your decision somewhere. just keep working do not stop".
  - Record every decision in the status file, the PR body, memory and your Stream 1 message.
  - After your own backlog, keep sweeping your scope, and help other streams through Stream 1 and the owner.
- End-to-end in the real apps is the acceptance bar.
  - No new unit tests; updating pinned ones is OK.
  - CI is informational, but run the covering web Jest suites (all web Jest takes about 10 s) before you push, and read every red CI job.
- AGENTS.md still holds:
  - preserve the existing designs;
  - keep functional repairs separate from presentation changes;
  - no speculative refactors or rebuilds;
  - propose an unavoidable design change for approval (Stream 1 approves);
  - new files, tables or migrations only for a verified gap, with the reason recorded.

## Hard limits (never relax)

- **Protected checkouts and founder resources:**
  - Don't modify the protected checkout `/Users/yingpengwang/skinny-pantopus`.
  - Never touch founder ports 64521/64522, backend :8000 or simulator EB5AD759.
- **Your ports and files:**
  - Yours are 64580–64589 and 18160/18168/18169. Peer ports are off-limits.
  - Never edit `backend/routes/chats.js` or `backend/socket/chatSocketio.js` (Stream 5's).
  - Design tokens, theme and palettes are Stream 1's.
- **Secrets and bundles:**
  - Keep credentials, raw tokens, database archives and operator logs out of Git and chat.
  - Never dump the fixture credentials file. Never print or copy the runtime dot-files (`.keys.env`, `.local-secrets.env`, `.fixture-password`, `.webhook-secret`, `.tokens-*`, `.webstate-*`).
  - Redact token, password and session paths in any runner copied into a bundle. Never copy `run-node.sh`, `api.py`, `webcap.mjs`, `android-switch.py` or webcap network logs into bundles.
  - Seal only after a passing scan: `python3 $R/secret-scan.py <bundle> && python3 $R/seal.py <bundle> <branch> <commit> "<boundary>"` (always `&&`).
- **Money:** Stripe TEST only, never capture. No hosted, provider, founder or physical-device work.
- **Claims:** never claim whole-Posts, whole-payment, full-client, provider, hosted, physical-device or launch-ready acceptance from a bounded result.
- **Leases and builds:**
  - Acquire exact leases before use (`heavy-slot.sh acquire "stream2: <purpose>"`; `device-slot.sh acquire "stream2: …"`). One heavy native build at a time.
  - Never switch or edit a worktree while a queued native build may compile it.
- **Fixtures:**
  - Use only owned synthetic fixtures and clean them completely, proven with table snapshots.
  - Sign-in bookkeeping rows (AuthSession, AuthSecurityEvent, AuthDpopJti) are removed only at the final teardown.
- **Git hygiene:**
  - no bare `git stash`, gc, maintenance, repack or worktree removal;
  - times from `date -u`, SHAs from `git rev-parse`, exit codes via `rc=$?`.
- **Launch-cut features:** never verify, test or fix them, or their entry points: Beacon #1, Personas #2, Marketplace #3, Open Gigs #4, public scheduling #5, the business directory #6, household extras and package tracking #7, mail extras #8.
- **Devices:**
  - No iOS simulator access: Stream 1 runs your iOS cells, so send it the branch, head and exact steps.
  - On Android, never consent to crash dialogs, and confirm the Password field has focus before typing a credential.
- **Database:**
  - New tables need RLS; new SECURITY DEFINER functions must revoke EXECUTE from clients.
  - Ask Stream 1 for a migration number before creating a migration file.

## Commit and PR conventions

- **Names:** branches are `claude/stream2-<area>-<topic>`. Bundles are `YYYYMMDD-stream2-<area>-<topic>-rN` under `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`.
- **Endings:** end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. End PR bodies with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **After `gh pr create`:** bind the PR in the app.
- **Status file:** in the CURRENT STATE heading, use the commit time (`GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`). Commit coordination docs by explicit path, check `git show --stat HEAD`, and push `codex/workstream-coordination`.
