# Resume prompt for the next Stream 5 session — Accounts and Social (formerly Stream 3)

Written 2026-10-01T05:40Z (from `date -u`; the commit time is authoritative). It replaces [NEXT-STREAM5-PROMPT-2026-09-30.md](NEXT-STREAM5-PROMPT-2026-09-30.md), whose rules and runtime notes still apply where this file doesn't change them.

You are **Stream 5**, one of the user's parallel workstreams. History before 2026-09-30 calls it "Stream 3" or "S3".
- **Scope:** accounts, sign-in/sessions, profiles and privacy, connections and blocks, chat, notifications, reports, and crews (public crew page, crew dashboard and owner tools, seats).
- **Snapshot:** every fact here is a snapshot. Verify the live state (branch, worktrees, PRs, CI, leases) before acting.

## 1. Read first
1. [05-accounts-social.md](05-accounts-social.md) on `codex/workstream-coordination` (pull `--ff-only`, commit by explicit path, push). The top **LIVE** blocks are the current state, newest first.
2. The hub [README.md](README.md): the five-stream numbering and the 2026-09-27 LAUNCH SCOPE block.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md` in the app repo: the verification-first rules.
4. The private kit: `…/.pantopus-recovery/stream3-runtime-kit/README.md` and `tools/stream5-e2e/README.md`. Never print or dump the fixture credential files.

## 2. State at 2026-10-01T05:40Z (master `7a42f1d7a`, batch 268)
- **The user's direction (2026-10-01):** keep working while there is work, and help the other streams.
  - Cross-stream fixes go through Stream 1's routing, and the owning stream is told before its file is touched.
  - Decide for the best UX, safety, security and retention without asking, and record each decision in the status file, the PR and memory. Money, legal and new-table questions still go to the user.
- **Merged today:**
  - every Stream 5 PR from #1119 through #1217 (see the LIVE blocks), and #1216 (verified_resident means a verified residency);
  - cross-stream #1226 (post viewer) and #1228 (mail Star keyboard);
  - #1230 (chat Report under the drawer), #1234 (ModalShell semantics), #1236 (five dialogs);
  - #1243 (the name card: Message dead end, one-click disconnect, silent failures);
  - #1244 (the same on Discover).
  - Bundles are under `…/.pantopus-recovery/audits/20261001-stream5-*`, each with its RESULT and MANIFEST.
- **Open:**
  - **#1251** (crew forms, part 2: Legal tab, new crew wizard, location Hours page; names and chip state). Head `bec3d256c`, bundle `20261001-stream5-crew-forms-labels-2-r1`. The RESULT has `CI_SECTION`: seal with `seal-pr.sh` when CI is green and send it to Stream 1.
  - **#1238** (Android View as: a hidden badge says "Not shown" to TalkBack). Head `e13464e95`, bundle `20261001-stream5-android-viewas-badge-r1`.
    - The RESULT has a device `TODO:`. Stream 1 runs the check on its candidate, then sends a bundle hash: fill the TODO from it.
    - Seal with **`seal-pr-explained.sh`**. The PR's android unit job is red only because of master's `PulseComposeSnapshotTest.pulse_compose_edit_prefilled`, from Stream 2's #1209 (its own run 36810090384 failed it). Stream 2 is re-recording the golden.
  - Draft #842 stays a draft.

## 3. Runtime (Stream 5's own; unchanged from the 2026-09-30 prompt except the commits)
- **Database:** stack `pantopus-stream3-block-r1` (DB 64532, Kong 64531).
- **API 18134:** tree `/private/tmp/pantopus-stream3-chat-realtime-r1` on `361f07042`, receipt 05:31:05Z.
  - **Restart it after about 8 logins:** at about 10 the API answers 429.
  - Creating several crews within minutes also hits a 429.
- **Web 18131:** tree `/private/tmp/pantopus-stream3-web-chat-names-r1` on `bec3d256c`, #1251's head. Move it with `git checkout --detach`, then wait about 15 s.
  - A page loaded right after a checkout can miss `#email` for 30 s; retry once.
- **Fixtures:** none remain from today. Every run removed what it created by exact id, after a foreign-key-generated reference check, and the post-checks equal the pre-checks. Leave "S5 Crew Biz" (`s5_gig_biz_dfa0bf`) alone.
- **Probe patterns from today** (the scripts are in each bundle's `scripts/`):
  - Forward one specific POST to the real API with `route.fetch({url: API+path})` when it is a get-or-create that finds the fixture, and count rows before and after.
  - Answer every other write in the browser.
  - The people search reads `LocalProfile` only: give a fixture user a Local Profile (handle = username).
  - Toasts: `div.fixed.top-4.right-4[aria-live="polite"]` with a 2 s timeout.
  - The conversation composer's placeholder is "Message"; the room page's is "Type a message…".
- **Scans** (in the kit's `tools/stream5-e2e/`, with README notes; TypeScript at the web tree's `node_modules/.pnpm/typescript@5.9.3`): `page-health.mjs`, `link-target-scan.cjs`, `try-finally-scan.cjs`, `destructive-scan.cjs`, `console-only-catch-scan.cjs`, `unnamed-buttons.cjs`, `unnamed-links.cjs`, `unlabeled-fields.cjs`.
  - Run them over `git archive <master> frontend/apps/web/src`.
  - Today's results: Stream 5's web code has no remaining silent write failures, no unconfirmed destructive actions and no dead link targets. The app-wide scan's one dead target, `/app/homes/find` → `claim-owner`, went to Stream 3, which took it.

## 4. Rules in force
Unchanged from the 2026-09-30 prompt, section 4:
- **Not approved by the user:** no `/api/b/:username` reads (use the substitution), no canned AI replies, never migration `20260926100000`.
- **The founder's environment:** never ports 64521/64522, backend 8000 or simulator EB5AD759. Keep `/Users/yingpengwang/skinny-pantopus` read-only. Native device runs are Stream 1's.
- **Destructive commands:** no reset, stash, clean or gc. Delete fixtures by exact id only.
- **Secrets:** keep secrets, raw tokens and logs out of Git and chat; mask emails in screenshots.
- **Launch-scope cuts:** never verify, test or fix them.
- **Merging:** Stream 1 merges everything.
- **Evidence values:** take them from `date -u`, `git rev-parse` and `gh` only; grep RESULT.md for placeholders before sealing.

## 5. Candidates (each confirmed in code; reproduce before fixing)
1. **(design call)** The name card (`components/user/UserIdentityLink.tsx`) opens only on mouse hover, so keyboard and touch users can't reach its Connect, Follow and Message. They can reach the profile through the link.
2. **(design call; recommendation: add it)** The web public profile has no Connect button, and never had one. The Android and iOS profiles do, with a confirmed disconnect. On web, connecting is only possible from the hover card or Discover.
3. **Placeholder-named fields:** the page editor's FAQ and stats rows (`BlockEditor.tsx`), the crew Reviews reply box.
4. **Shared AppShell:** centred dialogs' backdrops don't cover the header and sidebar, because they render inside `<main>`.
5. **Focus management for dialogs:** `lib/useDialogFocusTrap` runs on mount with `[]` deps, so use it only in components that mount when open. ModalShell changes must apply to every caller (Stream 1's rule).
6. **Lower:**
   - `getPostingIdentities` reads crew name/logo columns that don't exist;
   - the logo route keeps the replaced file;
   - `/app/chat/new` is orphaned;
   - `MessageActionMenu` is dead code.
- **Not Stream 5's, already routed:**
  - My Mail Day's summary GET writes a MailEvent on every mailbox load (Stream 4, cut #8);
  - `find_homes_nearby` is missing (cut #4);
  - master's Android snapshot (Stream 2).

## 6. Waiting on the user or other streams
The 2026-09-30 list still stands:
- report takedown rules; closing neighbor-message reports;
- native report entry points on a device;
- #1037's second backfill;
- account deletion with payment history; SECURITY DEFINER deletion;
- S3-26; the iOS crew-profile toast;
- crew Invoices' raw user id (money); draft #842.

## 7. Next, in order
1. Tell Stream 1 you are the new Stream 5 session, then read the newest LIVE block.
2. Seal #1251 when its CI is green. When Stream 1's device bundle for #1238 arrives, fill its TODO and seal it with `seal-pr-explained.sh`.
3. Then work section 5, one PR at a time: reproduce through the real API and web, make the smallest fix, run E2E before and after, clean up by exact id, seal, hand off.
