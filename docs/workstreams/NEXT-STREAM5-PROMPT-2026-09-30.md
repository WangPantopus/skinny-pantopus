# Resume prompt for the next Stream 5 session — Accounts and Social (formerly Stream 3)

Written 2026-09-30T04:05:05Z. You are **Stream 5**, one of the user's parallel workstreams. Until 2026-09-30 this stream was **Stream 3**. The user renumbered it because the former Streams 1 and 2 are each being split in two (now Streams 1–4). Scope, accepted evidence, decisions, kit and runtime are unchanged. Every fact here is a snapshot: verify the live state (branch, worktree, remote PRs, CI, leases) before acting.

## 1. Read first
1. [05-accounts-social.md](05-accounts-social.md) in this checkout (formerly `03-accounts-social.md`). The top LIVE block is the current state; older blocks are history. In history, "Stream 3" / "S3" means this stream.
2. The hub [README.md](README.md): the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md`: the verification-first rules.
4. The private kit README: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md`. The path keeps `stream3`. Never print or dump the fixture credential files.

## 2. State at the renumbering
- Every Stream 5 fix PR is merged. The last round was user-approved (2026-09-29T22:09:04Z):
  - #831: the "Notifications are off" banner on iOS and Android;
  - #833: the web account-deletion outcome on `/login`;
  - #839: native apps say a lost deletion answer "couldn't be confirmed". Master was `8e44382ce`.
- One **draft** PR holds the old S3-26 web change (the assistant's mail chips read as text, not dead buttons). It can't be verified end to end while AI content is blocked, so it must not merge until it is verified or the user accepts it. See the LIVE block for its number.
- Docker Desktop has been down since 2026-09-30T03:30Z (disk full), so every local Supabase stack, including this stream's and the founder's, is offline. The user decides the restart. Stream 5 freed about 8.3 GiB of its own caches; its next iOS build is a clean one.
- No lease is held. Fault rules are empty, the deletion allowance is off, and every AUTH-DELETE fixture round is deactivated.

## 3. Rules in force
- No `/api/b/:username` reads, no canned AI replies, and no migration `20260926100000`: the user has not approved them.
- Never use the founder's services or devices: ports 64521/64522, backend 8000, simulator EB5AD759. Keep `/Users/yingpengwang/skinny-pantopus` read-only.
- No destructive database or worktree commands: no reset, stash, clean or gc, and no fixture deletion outside exact ownership. Don't touch other streams' dirty files or leases.
- Keep secrets, raw tokens, database archives and operator logs out of Git and chat.
- Launch scope (2026-09-27): never verify, test or fix Beacon/creator tools, personas, public scheduling for general businesses, or the other cut features.
- No competing tracker or merge queue. Stream 1's queue owner batches PRs; hand each PR over with its head SHA and seal.
- Stream 5 owns only `docs/workstreams/05-accounts-social.md` in this checkout. Fetch and fast-forward before editing, and commit and push only your own changes.
- Take device slots, the heavy slot and the shared iOS driver through the tools, and announce exact `date -u` times. Label leases `stream5:`; the kit scripts accept `stream5:` and `stream3:`.
- Record every time from `date -u` and every SHA from `git rev-parse`; never estimate.

## 4. Still open, waiting on the user
The 10 acceptance rows (N01–N05, A01–A05) are verified locally on simulator, emulator and web, but each has a part only the user can supply:
- **Real devices:** a physical iPhone and Android phone with release builds (N01, N02, and the device parts of A02: secure storage, biometrics, provider revocation).
- **Keys and access:**
  - APNs/FCM push keys (N01);
  - Apple/Google sign-in enabled in staging, and a real email service (A01);
  - hosted storage credentials (A03);
  - Smarty activation, which is paid (A04).
- **Decisions:**
  - `/b/` reads (S3-22, S3-62, crew Contact toast);
  - an AI key, or accepting S3-26 as is;
  - a daily-briefing delivery policy and a Crew Day entry point (N05);
  - who processes reports (N04);
  - live-money invoice testing (A05);
  - the backend deletion-order fix: revoke sessions only after the deletion commits (security; recorded by Stream 1 as a follow-up).
- **Owned elsewhere:** N03's Pulse posting belongs to Stream 1; its Beacon parts are cut.
- **Local but not yet run:** A02 deletion of an account with Home or payment history (needs the user's OK for that test data) and deletion from two devices at once. Both need Docker back.

## 5. Next
Nothing is pending. Wait for the user's devices, access or decisions, or a finding routed by another stream. Open new work only for a reproduced in-scope failure.
