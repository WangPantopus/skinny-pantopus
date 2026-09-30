# Resume prompt for the next Stream 5 session — Accounts and Social (formerly Stream 3)

Rewritten 2026-09-30T21:10:15Z (commit time; first version 04:05:05Z). You are **Stream 5**, one of the user's parallel workstreams (until 2026-09-30 this was **Stream 3**; history says "Stream 3"/"S3"). Scope: accounts, sign-in/sessions, profiles and privacy, connections and blocks, chat, notifications, reports, crews (business accounts: public crew page, crew dashboard/owner tools, seats/teams, endorsements). Every fact here is a snapshot: verify the live state (branch, worktrees, remote PRs, CI, leases) before acting.

## 1. Read first
1. [05-accounts-social.md](05-accounts-social.md) in this checkout (branch `codex/workstream-coordination`; pull with `--ff-only`, commit by explicit path, push). The top LIVE block is the current state.
2. The hub [README.md](README.md): the renumbering notice and the 2026-09-27 LAUNCH SCOPE block.
3. `AGENTS.md` and `docs/PROJECT_HANDOFF.md` in the app repo: verification-first rules.
4. The private kit: `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream3-runtime-kit/README.md` and **`tools/stream5-e2e/README.md`** (the E2E patterns and `ci-record.sh` used today). Never print or dump the fixture credential files.

## 2. State at 2026-09-30T21:10:15Z
- **Merged today after 16:00Z** (Stream 1's batches; master was `e514e033b` at 20:29Z, check the live head):
  - #1037 (crew seats), #1042 (report queue), #1043 (Business Profiles names), #1046 (one report alert, dead crew block);
  - #1053 (a crew's private data stays with its team, security batch 207) and #1060 (unpublished crew → 404 for outsiders, batch 210);
  - #1055 (S3-62: only a **verified** resident can endorse; the refusal shows in a toast, batch 211) and #1066 (the 14-day endorse rule counts from the occupancy's `verified_at`; a null `verified_at` counts as not yet 14 days, batch 212);
  - #1068 (chat list initials and Assistant row readable, batch 213);
  - #1076 (**S3-22 closed**: crew page hero/CTA buttons do what the owner chose, button links http(s)-only in the API, no Directions to a home-based crew, batch 215);
  - #1077 (light cards readable in dark mode, batch 216) and #1080 (the real profile completion percentage, no profile in the console, batch 217).
- **Open, sealed and handed to Stream 1** (they merge; nothing to do unless they ask):
  - **#1087** public profile trust signals: head `0ccc4d928`, CI run 36775249193 success, seal `7fbf14f05daf7302fee07946f8dc0d82bcf6b2564df65bb41cda54048f5dcc1f`, bundle `20260930-stream5-profile-trust-signals-r1`.
  - **#1089** a failed connection action says why: head `0d8c493ab`, CI 36775674336, seal `95da3278001c18543122b6624c192495560ffa24570f160e913020fcb4339d68`, bundle `…-connections-errors-r1`.
  - **#1090** crew dashboard Inbox: head `a17a7d73b`, CI 36776269108, seal `a63a3c35e9107b065bf33e87f1642900dfddfe6e8f5e3d94a6e6fd6d12d0d5f6`, bundle `…-crew-inbox-r1`.
  - **#1092** stale "skills aren't saved" note removed: head `be13de394`, CI run 36776925247 success, seal `470e0df6a442884d2ae14e8efc618eac37d3d6c1ac01ede676abbbf9abef3fa9`, bundle `…-skills-note-r1`.
- **Open, NOT sealed — finish first: #1081** (iOS + Android: page editors keep a button's `url` and get a Link address field; the crew profile Directions chip opens Maps and is hidden for home-based crews). Branch `claude/stream5-native-crew-links-directions`, head `7fb117fa72018aca67a6593097d22ba1b01fa4b9`, bundle `20260930-stream5-native-crew-links-r1` (RESULT written; its Verification says pending).
  1. CI run 36771770835: the iOS jobs were queued on macOS runners; the Android instrumented job **failed on CI infrastructure** (the emulator's "QEMU2 main loop" hung and the runner got a shutdown signal after 21/61 tests passed, 0 failed; log noted in the bundle). When the run completes, `gh run rerun 36771770835 --failed`, then record it with `ci-record.sh`.
  2. **Stream 1 runs the device checks** on its iOS simulator and Android emulator (pantopus_s1): storefront Directions opens Maps; no Directions on a home-based crew for the owner or a non-member; a web-set Link survives a phone edit; the Link address field and hint. The fixture recipe was sent to them (it is also in the bundle RESULT). Wait for their result.
  3. Then fill the bundle's Verification (CI + device results), seal with `make-manifest.py`, update the PR body, and send Stream 1 the head, CI run and seal.

## 3. Runtime (Stream 5's own; reserved ports)
- **Stack** `pantopus-stream3-block-r1` (Kong 64531, DB 64532), migrations through `20260930184000` (= master's newest at 20:29Z). New migrations: copy into `/private/tmp/pantopus-stream5-db-r1/supabase/migrations` and `supabase migration up --local` from there. Ask Stream 1 for a migration number before creating one.
- **API 18134**: point `/private/tmp/pantopus-stream3-chat-realtime-r1` at the wanted commit (`git checkout --detach <sha>`, clean backend), stop the running API (`kill` the pid listening on 18134), then from `/private/tmp/pantopus-stream3-s351-runtime-20260925-r1` run `S3_SRC=/private/tmp/pantopus-stream3-chat-realtime-r1 S3_BACKEND_TREE_OF=<sha> S3_LOCAL_STORAGE=1 nohup python3 api-launch-private.py > <log>` (receipt `api-start-isolation-safe.json`). It runs master `e514e033b` (started 20:54:47Z). **About 10 logins per API process trip the limiter (429): restart between journeys.**
- **Web 18131** (Next dev, HMR) serves `/private/tmp/pantopus-stream3-web-chat-names-r1`; move it with `git checkout --detach <sha>` (wait ~12 s). It is on master `e514e033b`. Browse it as `http://stream3.localhost:18131` (the scripts rewrite the dev host).
- **Proxy 18130** (`no-send-proxy.cjs`) refuses writes except per-caller allowances read from `endorse-check.json` / `report-check.json` (both **disabled**).
- **Fixtures:** accounts solo2, hs2b, hs4b, hs6, hs9b, hs11b, hs12, hs12b, hs13b, hs15b, rls1, rls2 (hs13b: verified owner occupancy; hs9b: unverified member occupancy; rls1/rls2: no home). Everything today's runs created was deleted by exact id and every changed row restored (see each bundle's cleanup). **One unexplained crew remains:** "S5 Crew Biz" (`s5_gig_biz_dfa0bf`, id `9dd2e294-148b-4d44-95df-b0d8892bca4f`, created 08:42Z, 2 team rows, 1 gig) — no bundle, kit note or memory names it; leave it unless its owner is found.
- **Evidence bundles:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`; seal with `python3 …/stream3-runtime-kit/handoff-tools-20260926/make-manifest.py <bundle> <head> <base> <branch> <seal-file> '<json>'`.

## 4. Rules in force
- **Unapproved by the user:** no `/api/b/:username` reads (use the non-writing substitution in `tools/stream5-e2e/README.md`), no canned AI replies, no migration `20260926100000`.
- **Founder's services/devices:** never ports 64521/64522, backend 8000 or simulator EB5AD759. Keep `/Users/yingpengwang/skinny-pantopus` read-only. This session type has no simulator access; Stream 1 runs native device passes.
- **Destructive commands:** no reset, stash, clean or gc; delete fixtures by exact id only; don't touch other streams' dirty files or leases.
- **Secrets:** keep secrets, raw tokens, database archives and operator logs out of Git and chat; mask account emails in screenshots; drop the API's login lines from log excerpts.
- **Launch scope (2026-09-27):** never verify, test or fix Beacon/creator tools, personas, public scheduling, listing/task chat pickers, Gigs/Market filters, Marketplace or Open Gigs.
- **Merging:** Stream 1 batches and merges every PR (no competing queue). Hand each over with head SHA, CI run and seal. Retarget a stacked PR to master after its base merges (`gh pr edit N --base master`; CI doesn't rerun on retarget, so prove the merge with `git merge-tree`).
- **Evidence values:** times from `date -u` or the record files, SHAs from `git rev-parse`, CI ids from `gh`; exit status on the next line (`rc=$?`); grep RESULT.md for placeholders and cross-check every cited time before sealing. SQL contracts are verified by the PR's CI database job, never locally.
- **Decisions:** the user's standing direction is to decide for the best UX, safety, security and retention without asking, and to record each decision (status file, PR, memory). Money, legal and new-table questions still go to the user.

## 5. Backlog: the 2026-09-30 sweep of Stream 5's web screens (candidates, each confirmed in code; confirm through the real API and E2E before fixing)
Done: fake response time / reliability / crew-as-person (#1087), crew Inbox (#1090), connection errors (#1089), stale skills note (#1092), profile console log (#1080). Remaining, in priority order:
1. **Crew page placeholder blocks shown to visitors** (`components/business/PublicBlockRenderer.tsx`): Team ("Team members will be displayed here.", ~line 473), Posts feed ("Posts will appear here when available.", ~535), Gallery (grey tiles, ignores `data.images`, ~189), Embed (prints "Embedded content: <url>", ~523), and the **Contact form** (inputs never read; "Send Message" opens the generic inquiry, so the typed text is lost, ~495). Suggested: render nothing publicly for blocks with no real content; make the contact form send the typed message into the inquiry (`startBusinessInquiry` then `sendMessage`), or remove its dead fields. The editor's hints for these blocks (`BlockEditor.tsx` ~199, 274, 282, 290) promise features that don't exist.
2. **Public profile Services/Portfolio tabs** (`app/[username]/PublicProfileClient.tsx`, `components/profile/public/tabs/`): the API never sends `services` or `portfolio`, so Portfolio is always "No portfolio items" (no way to add one) and the owner's "Add your first service" opens Edit Profile, which has no services field. Suggested: hide Portfolio when empty; point the owner's button at what Edit Profile can actually change (skills) or remove it.
3. **Block Appearance settings are saved but never applied** (`BlockEditor.tsx` ~82, 95: padding/background in `block.settings`; neither `PublicBlockRenderer` nor `BlockPreview` reads them).
4. **Hero "Background image — Click to upload" is a dead control** (`BlockEditor.tsx` ~371).
5. **Crew Overview checklist dead ends** (`components/business/tabs/OverviewTab.tsx` ~85–87, `LocationsTab.tsx` ~58): "Set business hours" opens the Locations tab (no hours control); "Upload a logo" opens the Profile tab (no upload; a logo can only be set at creation).
6. **SeatCard "⋮" has no onClick** (`components/business/seats/SeatCard.tsx` ~91): its menu appears only on hover, so keyboard and touch users can't reach Edit/Remove.
7. **Builder preview shows hard-coded 9–5 hours and ★★★★★** (`BlockPreview.tsx` ~150, 207; owner-facing only).
- Not for Stream 5 alone: "Request / Hire" opens a generic Post-a-task form and drops the person (`requestFor` is never read; gigs area → Stream 2/Stream 1); crew Invoices asks for a raw user UUID (money → user); entry points into cut features (Beacon CTA on the identity page, etc.) stay as they are.
- Lower confidence (verify before acting): blocked-user rows' no-op `onNavigate`; the crew page's "Be the first to leave a review!" with no review action; `chat/new` redirects to `/app/mailbox?roomId=` (ignored); crew Payments/Insights/Settings tabs missing from the dashboard tab bar.

## 6. Waiting on the user or other streams
- Takedown rules for reports; closing neighbor-message reports; native report entry points on a device (Stream 1).
- #1037's second backfill (people who already hold a binding) after the user confirms the API is deployed.
- Account deletion for accounts with payment history (user); moving account deletion into one SECURITY DEFINER transaction (recorded; the dry-run/delete race is unreproduced; needs a migration number).
- S3-26 (AI key or accept the gap); draft #842 (don't merge unless verified or accepted).
- iOS crew profile: the Contact / "Hire to review" failure toast may sit behind the floating tab bar — needs a device screenshot (Stream 1) before any fix.

## 7. Next, in order
1. Finish #1081 (section 2).
2. Watch #1087, #1089, #1090, #1092 through Stream 1's merges; answer any review.
3. Work the sweep backlog (section 5) one PR at a time: confirm, fix the smallest thing, E2E before/after through the real API and web, clean fixtures by exact id, seal, hand off.
4. Rerun the drift scanners (`tools/drift-scanners/`) after big merges; treat hits as candidates.
5. Update the status file's LIVE block, this prompt and memory at each milestone.

## 8. Lessons from 2026-09-30
- Public profile pages are server-rendered from a fetch cached 60 s (`lib/publicShare.ts`): wait it out and warm once before checking changed data.
- A crew fixture: `POST /api/businesses` as rls1, publish/locate in SQL, delete by exact id (BusinessPageBlock/Revision by page, BusinessPage, BusinessLocation, BusinessAuditLog, SeatBinding by seat, BusinessSeat, BusinessTeam, BusinessPrivate, BusinessProfile, User). Chat fixtures: ChatTyping/ChatMessage/ChatParticipant by room (the room row goes with its participants).
- Updating a HomeOccupancy re-stamps `updated_at` and `membership_version` (triggers); only the field itself can be restored exactly.
- zsh doesn't word-split `$VAR`: pass file lists as arrays (`(${(f)"$(…)"})`); an empty list makes Jest run everything.
- Match UI chips by container (`locator('span', { hasText })`), not exact text, when they include a remove button.
- Contrast sweeps must measure gradients at every stop; #1052 made hue text theme-aware but not gradient stops, so hue text on a light gradient goes light-on-light in dark mode.
- Stacked PRs: base on the previous branch, retarget after it merges, and re-seal with the merge proof (`git patch-id --stable`) if you rebase.
