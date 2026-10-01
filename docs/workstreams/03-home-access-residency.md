# Stream 3 — Home access, residency and security (split from the former Stream 2 on 2026-09-30)

> **Split (user direction, 2026-09-30).** The former **Stream 2** (Home and household) is split into **Stream 3 — Home access, residency and security** ([`03-home-access-residency.md`](03-home-access-residency.md)) and **Stream 4 — Place, records, money and mail** ([`04-place-records-money-mail.md`](04-place-records-money-mail.md)).
> - Together their checklists are exactly the former Stream 2's, and nothing is shared or dropped:
>   - the 40-row inventory, 20 rows each;
>   - the 24 S2-xx UX items;
>   - the open work and leads;
>   - the 10 decisions waiting on the user;
>   - and, added 2026-09-30T04:36:26Z, the cross-cutting rows the hub's records give the former Stream 2: U01 is Stream 3's alone, and each stream owns its own screens' cells of U02–U05 (see "Cross-cutting rows" below).
> - The former Stream 2 file is now frozen history at [`former-stream2-home-household.md`](former-stream2-home-household.md) (moved from `02-home-household.md`, which frees `02-` for Stream 1's split). In it, "Stream 2" / "S2" means the stream before the split.
> - The former **Stream 3** (Accounts and Social) is now **Stream 5** ([`05-accounts-social.md`](05-accounts-social.md)). In records dated before 2026-09-30, "Stream 3" / "S3" means Stream 5, not the new Stream 3.
> - Names that contain `stream2` or `S2-` keep them so nothing breaks: the runtime kit, stage folders, audit bundles, existing branches and UX IDs.
> - **This stream from now on:**
>   - branches `claude/stream3-home-<topic>`;
>   - audit bundles `YYYYMMDD-stream3-home-<topic>-rN`;
>   - device and heavy lease label `stream3-home:`, which is also its runtime-lease label;
>   - session name "Stream 3: Home access and residency";
>   - resume prompt [`NEXT-STREAM3-PROMPT-2026-09-30.md`](NEXT-STREAM3-PROMPT-2026-09-30.md).

## HANDOFF — Stream 3, evening of 2026-09-30 (START HERE; written 2026-09-30T21:18:39Z)

The previous session stopped here at the user's request, at a clean boundary.
- It holds no lease, no slot and no fixture, and no fault rules are active.
- Everything is committed and pushed. Every PR is sealed and with the coordinator.
- The older "CURRENT RESUME" below is kept as history. The ordered backlog is §4 here.

### 1. State at handoff (re-check before relying on it)

- **Master:** `11e2b72f68bd6bf5b41815be6032db96e6181891` (batch 219, 21:10:57Z).
- **Merged today:** #1024, #1036 and #1051, plus everything before them.
- **Open PRs:** five, all sealed, E2E-verified in the real apps, with green or clean CI, and sent to the coordinator
  (Stream 1) for its next batch at 21:15Z. The user asked for ready PRs to be merged.
  - **First job:** confirm they merged (`gh pr view <n> --json state,mergedAt`). If one isn't merged, ask the
    coordinator. Don't merge around the queue.

| PR | What | Head | Evidence (audit store `…/.pantopus-recovery/audits/`) |
|---|---|---|---|
| [#1058](https://github.com/WangPantopus/skinny-pantopus/pull/1058) | Android list top bar: at font ≥1.3 a labelled action shows its icon, so the Members title stays | `4bb90fa845f0ec0ae11a355d2bba2a126c4a3987` | `20260930-stream3-home-u04-lifetimes-r1`, MANIFEST `57e9a75b54e741dd63568eb88eabcd581db052472530c38ef90dd0c2dcdf55a6` |
| [#1064](https://github.com/WangPantopus/skinny-pantopus/pull/1064) | Standalone web `/homes/:id/settings` and `/settings/security` say when their read fails (Retry, or a 403 sentence) | `f4b71575d83b001954c6efc4cca01f40f7717370` | `20260930-stream3-home-web-settings-read-errors-r1`, `9c25be46191f18a7167b0e856448655b3473f65cb7c4dda5b122bd872b876b18` |
| [#1065](https://github.com/WangPantopus/skinny-pantopus/pull/1065) | Web Settings tab gets an owner-only "Security & Privacy" row (discoverability, owner claims); merge with or after #1064 | `140b24b1f892a60d222b9c4b4f20b77292e4ee69` | the same bundle |
| [#1070](https://github.com/WangPantopus/skinny-pantopus/pull/1070) | Web member initials on 700 fills (2.15 → 5.02:1) | `76d2236c0d2f140a02d149b2a1fd5c1e8276b73b` | the same bundle |
| [#1067](https://github.com/WangPantopus/skinny-pantopus/pull/1067) | iOS and Android residency letters and passes lists: Try again after a failed read | `7d9a15105a172734a945430be1000f034c12c214` | `20260930-stream3-home-residency-list-retry-r1`, `e28414b21d63577280fcfd9cb674c44c6ef9d4b9626c924f89648c8b96af48f5` (2 CI checks were pending at 21:15Z) |

- **Runtime:**
  - The lease and device slot 4 are with Stream 4 (released to them at 21:10:43Z). Their fixture Home `81cb4308…` is
    theirs.
  - Nothing of Stream 3 is in the database: every fixture today was cleaned exactly.
  - Backend PID 91084 on `00bf2d6ff`. The shared web worktree was restored byte-exact after each placement.
- **Local worktree:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-3-home-access-627a9d`, clean, on branch
  `claude/stream3-home-residency-list-retry`. Start new work from `origin/master` on a new
  `claude/stream3-home-<topic>` branch.
- **Kit** (local, not in Git):
  `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit`.
  - Stages are in `runtime/`; audits are in `../audits/`.
  - The saved builds are `apks-s3/7d9a15105-app-debug.apk` and `apps-s3/7d9a15105/Pantopus.app` (master `5fded9767`
    plus #1067), and `apks-s3/4bb90fa84-app-debug.apk` (#1058).
  - **Cleaned up at the handoff:** older builds, the iOS DerivedData `ios-dd-s3-native` (9.1 GB) and the worktree's Android
    `app/build` are deleted to free disk space. The next iOS build is a full one, about 5–10 minutes in the heavy slot.

### 2. Today's results, in the checklists below (each cell cites its bundle)

- **U04 L1, L3, L4 pass on iOS and Android** (`0930 u04-lifetimes`):
  - **L1:** a rename draft, an Add guest name, Members and Identity survive 20 s in the background, with the same process
    and nothing saved.
  - **L4:** a one-time expired-token 401 on the rename PATCH → `/api/users/refresh` 200 → the replay 200. The owner
    stays signed in.
  - **L3:** member B sees nothing of the owner's Home ("Home access unavailable", "You do not have permission…"), and the
    owner is restored.
- **U03:**
  - Every ❓ cell got a verified disposition, including the new ☑️ marker for 09-11…09-13 reports.
  - R1 residency letters and passes: fixed (#1067).
  - Web privacy: the R1 fix and reachability (#1064, #1065).
  - Landlord unbuilt tabs: hidden (#1051, merged).
- **U02:** the Android top bar at font 2.0 (#1058), and web member initials contrast (#1070).
- **Web U04 was not run.** Its script is ready (§3).

### 3. Tools built today (kit `tools/`; every one refuses to overwrite a label or a sealed stage's files)

- **Fixtures:**
  - `s3-u04-fixture.py fixture|cleanup` makes one owner Home and cleans it up exactly. `S3_STAGE` picks the stage (the
    default is `stream3-home-u04-native-r2`; take `fp.py snap` in it first), `S3_HOME_NAME` names the Home, and
    `S3_ADD_MEMBER=1` adds B as a household member.
  - `s3-landlord-fixture.py` does the same for a Home with a verified landlord authority.
- **`s3-proxy.py <stage> set|clear|list|count`:** fault rules with `<H>` expansion, request counts from the proxy log.
  `S3_FIXTURE_STAGE` reads H from another stage.
- **`s3-worktree-place.py <stage> save|before|after|restore`:** whole-file before/after placement in the shared web
  worktree, driven by `worktree-files.json`. Every blob is checked by hash, and `git status` must match at restore.
- **Device step drivers:**
  - `android-s3-step.py`: url, launch, tap, tapfield, type, clear, back, font, scrollto, background (records process
    ids), wait, capture.
  - `ios-s3-step.py`: url, launch, tap [bridge], tapfield, type, clear, scrollto, background (process ids), wait,
    capture. The text op takes `value`; an empty default read falls back to axbridge.
- **Sequences:**
  - `s3-u04-android.sh` and `s3-u04-ios.sh` run one case per call. `S3_STAGE` and `S3_RETRY_STAGE` must be new stages.
  - `s3-u04-l3-scan.py` scans frames for the owner's data. Both fixture accounts' first name is "Stream2", so an
    `ownerFirstName` hit on B's greeting is a false positive.
- **Web:**
  - `web-s3-u04.cjs l1|l4|l3`: `S3_STAGE`, default `stream3-home-u04-web-r1`. It uses the dashboard Settings tab and
    signs in through the form.
  - `web-s3-settings-read-errors.cjs`, `web-s3-landlord-tabs.cjs`, `s3-web-security-run.sh`.

### 4. Next actions, in order

1. ~~Confirm the five PRs above merged, then mark their cells "merged" here.~~ **Done (checked 2026-09-30T23:12:55Z):** all
   five merged at 21:37:23Z in batch 220 ([#1098](https://github.com/WangPantopus/skinny-pantopus/pull/1098)), each at its sealed head; their cells say so.
2. **Web U04 L1, L3, L4:** **Done 2026-09-30 (`0930 u04-web`, MANIFEST `b51f8ac3…`):** L1 on the Settings tab failed on master and
   is fixed in [#1118](https://github.com/WangPantopus/skinny-pantopus/pull/1118) (merged in batch 225 at 23:48:30Z, master `0256c4f35`); every other case passed. See the live entry.
   - Lease, then `fp.py snap runtime/stream3-home-u04-web-r1 baseline-public-fingerprints`.
   - `S3_STAGE=stream3-home-u04-web-r1 python3 tools/s3-u04-fixture.py fixture`.
   - `S3_STAGE=… node tools/web-s3-u04.cjs l1 l1-a`, then `l4 l4-a "<new name>"`, then `l3 l3-a`.
   - Scan with `s3-u04-l3-scan.py`, exact cleanup, redact screenshots, seal.
   - L1 on web fakes a hidden tab (visibilityState and events); say so in the bundle.
3. **U03 E4 lead on the native Members screen:** **Done 2026-10-01: [#1162](https://github.com/WangPantopus/skinny-pantopus/pull/1162), merged in batch 243 (01:31Z, master `b6419009f`)** (`1001 members-refused`, MANIFEST `0c1f99b6…`). The
   invitation entry is hidden for a viewer the server refuses (403); removal recovery stays (see the live entry).
   - For a viewer without access, Android still offers "Invite member" and "Recover a member removal", and iOS offers the
     two recovery links, beside "You do not have permission to view these records." (`0930 u04-lifetimes`,
     `l3-member-views`).
   - Reproduce, then make the smallest repair (hide those controls on a permission error, as the web pages do since
     #835). Evidence and PR as usual.
4. **Remaining U04 native cells:** L4 on a Members or guest-pass write; L1 and L4 on the Homes list; L3 on residency
   letters and passes (B opens the owner's Identity). **2026-10-01:** Homes list L1/L4 and Identity L3 done on both
   apps (`1001 u04-native-r3`). The web cells of both rows are done (`1001 u04-web-r2`; the guest-pass L1 fix is
   #1213). **Native L4 on a guest-pass create and on a residency letter: done 2026-10-01 on both apps (`1001 u04-native-r4`).**
   - Android's "Invite link" row is still in Home settings, just below the fold under MEMBERS → People. The 02:17Z
     swipe started on the Privacy row and opened Security. Swipe from an overline and check the title before tapping.
5. **U03 ⬜ cells** (the tables below list each one):
   - native joining E1/E3/E6;
   - native departed-applicant E5;
   - removal E1/E3;
   - ~~a real residency-pass double tap (E3)~~ (done 2026-10-01, `1001 pass-e3-native`);
   - D05 native E2/E4/E5/E6/R1;
   - D07 native E1/E2/E3;
   - ~~D10 iOS E3/E6 and Android E2/E3~~ (done 2026-10-01, `1001 d10-native`);
   - the guest-pass copied link;
   - U03 cases in the native landlord wizard;
   - web E3s: all done (removal and leave `1001 web-e3`; joining, with #1214 for the Accept double-click; residency
     letters, fixed by #1231; landlord approval, with #1232 for the row's Approve double-click);
   - web L2 reload of the Homes list.
6. **U02:**
   - native A1/A2 of the verification pages and the privacy mirror;
   - native A3 (the role-palette avatars and other fills) and A4 (VoiceOver and TalkBack);
   - web A1/A4/A5;
   - the "Not in any sweep" row.
7. ~~**U01:** long native activity identities~~ **Done 2026-10-01, no defect** (`1001 u01-long-names`).
8. **☑️ cells:** show the source unchanged since the cited report, or re-run the case, before counting it toward closure.
9. **R03/R04:** the boundaries in their rows. **U05** waits for the launch flags on master.

### 5. Gotchas learned today (on top of the rules below)

- **Lease, slots, heavy slot:**
  - `zsh tools/runtime-lease.sh acquire "stream3-home: …"` waits every 30 s. Stream 4 shares it, so message them before
    and after.
  - `/private/tmp/pantopus-tools/device-slot.sh acquire "stream3-home: …"` gives slot 4 for S34 and pantopus_s34. Shut
    the devices down before releasing.
  - The heavy slot is `/private/tmp/pantopus-tools/heavy-slot.sh`. Run acquire in the background.
- **Emulator:** it restores a snapshot on boot. Reinstall the APK (`adb install -r` keeps data), launch the app, then
  run `android-s3-login.py`, which is focus-checked.
- **iOS sign-in:** `ios-s3-account.py`'s Log in tap lands on the keyboard's Passwords bar. Tap the exposed strip at
  (201, 534), then dismiss the prompt at (127, 547).
- **iOS accessibility stall:** if both the default reader and axbridge return nothing, `simctl shutdown` and `boot`
  fixes it (data kept). Don't loop axbridge; it takes about 30 s a read.
- **Long Identity page:** the residency lists sit below nineteen data-broker cards. Use `scrollto`.
- **Lazy rows** to include in exact cleanups: HomeSeasonalChecklistItem and PropertyIntelligenceCache (the Home's
  dashboard), and MailPreferences (member B's default row, created when B's session opens).
- **Screenshots show fixture e-mails:** the web sidebar footer (black out x 52–239, y 804–860), and iOS sign-in and
  Settings screens (keep them out of bundles). Never print `runtime/accounts.env`.
- **Shell:** zsh does not split `$VAR` command strings, so use arrays. macOS has no `timeout`.
- **Coordination checkout:** it holds other streams' uncommitted edits. Always `git commit --only
  docs/workstreams/03-home-access-residency.md`.
- **Android clock (2026-10-01):** `pantopus_s34` boots from its snapshot ~13 h behind, and automatic time can snap it back
  after you set it. Every Android sign-in then fails "Invalid email or password" (401). After boot: `adb -s emulator-5562 root;
  adb shell settings put global auto_time 0; adb shell "date -u $(date -u +%m%d%H%M%Y.%S)"; adb unroot`.
- **PNG e-mail check (2026-10-01):** Android's Settings footer renders the account e-mail but it is not in the accessibility
  tree, so tree scans miss it. OCR every bundle PNG before sealing (macOS Vision script in the `1001 members-refused` bundle,
  `frames/ocr_at.swift`); withhold sign-in/out screenshots.

### 6. Decisions made today under the standing instruction ("decide for the best UX and safety, record it")

- **#1051:** hide the landlord Notices and Settings tabs rather than show an empty "not available".
- **#1064:** the standalone pages use the Owners page's load-error pattern.
- **#1065:** add one owner-only entry row in the Settings tab rather than build or move the page, matching native Home
  settings.
- **#1067:** the rate-watch Try again control on both residency lists.
- **#1070:** 700 shades, matching Stream 5's chat fix.
- **#1162 (2026-10-01):** hide the native invitation entry only when the server refused the member list (403). Keep
  "Recover a member removal" (it also recovers the viewer's own leave; the web keeps it too) and keep the entry on a
  transient failure (it doubles as saved-invitation recovery). A confirmed member without `members.manage` still sees it
  (lead: the Pending message and a demoted manager's saved action depend on it).
- **#1118 (2026-09-30, evening session):** keep the dashboard's re-check and unmount (a security design); hold only the
  member's own changed Settings fields above it, give them back only into the Settings tab for the same member, the same
  Home and `home.edit`, over the fresh read (another editor's other fields survive). A tab switch still drops them.
- **#1213 (2026-10-01):** keep a guest pass being set up across the dashboard's access re-check the way #1118 keeps
  Settings: only into the Share tab, for the same member and Home, while `members.manage` holds. The passcode comes back
  with the rest, in page memory only; a draft restored without its passcode could produce an unprotected link.
- **#1214 (2026-10-01, cross-stream):** fix the double-click hole in the shared web confirmation dialog, not on the
  invitation page. It ignores a click whose `detail` is above 1 on Cancel, Confirm and the backdrop. A page-only fix
  would leave every other confirmation (revoke, remove, delete) open to being answered by the second click that opened
  it. Stream 1 was told it touches every stream's dialogs.
- **#1231 (2026-10-01):** guard the web letter issue with a synchronous in-flight ref rather than adding a request id
  to the backend route. That's the smallest repair for the reproduced double-click, and it keeps the existing disabled
  state and copy.
- **#1232 (2026-10-01):** the landlord approve modal's backdrop ignores the continuation of a double-click, the same
  rule as #1214. **Lead, not fixed:** the shared `SlidePanel` lets an opener's second click land inside the panel ("+
  Custom Pass" then chooses the Guest Pass template; nothing is written). A fix needs a panel-wide rule that 11 panels
  share with Stream 4, so it waits for its own change.
- **#1245 (2026-10-01, cross-stream):** the shared `SlidePanel` ignores a click with `detail` > 1 for 500 ms after it
  opens (capture phase, on the backdrop and the panel). It's time-bounded so that deliberate quick taps inside an open
  panel keep working. Stream 1 asked for one PR listing the 11 callers.
- **Copy leads (fixed 2026-10-01 in [#1271](https://github.com/WangPantopus/skinny-pantopus/pull/1271)):** the landlord
  wizard's "1 field need attention" (both apps), and the "Email format" summary for an empty e-mail (both apps' code;
  first seen on Android). A malformed e-mail still reads "Email format".
- **☑️:** the marker for older reports.
- **Builds:** U04 ran on the `7d9a15105` builds, the closest to master.

### 7. Prompt for the next Stream 3 session

```text
You are Stream 3 — Home access, residency and security. Name this session "Stream 3: Home access and residency".
Before editing, read in order:
- /Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-3-home-access-627a9d/AGENTS.md
- the project handoff (docs/PROJECT_HANDOFF.md)
- the coordination hub README and 03-home-access-residency.md, both in /Users/yingpengwang/pantopus-coordination
  (branch codex/workstream-coordination; `git fetch` then `git merge --ff-only`). In 03, start at
  "HANDOFF — Stream 3, evening of 2026-09-30" and work its §4 in order.

Work in /Users/yingpengwang/estimate-rescue/skinny-pantopus/stream-3-home-access-627a9d. Branch from origin/master as
claude/stream3-home-<topic>. The runtime kit is
/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit.

Rules:
- Do all the code, verification and fixing yourself. Subagents may only search and gather information.
- Standing user instruction: when a decision would normally go to the user, make the choice that is best for user
  experience, safety and security, and retention, record it (the 03 file's decisions, the PR body, memory), and keep
  working without stopping.
- Evidence protocol:
  1. Write DECISION.md first.
  2. Take an `fp.py snap` baseline.
  3. Capture befores and afters in the real apps.
  4. Clean up exactly.
  5. Redact fixture e-mails.
  6. Seal with `seal-bundle.py`.
  7. Open the PR; its body ends with the Claude Code line.
  8. Send the head and seal to the coordinator (Stream 1), which merges.
  9. Add a live entry in 03.
- Commit trailer: "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".
- Never print runtime/accounts.env. Never touch the founder's environment (64521/64522, backend 8000, simulator
  EB5AD759) or the physical iPhone.
- No destructive git or database commands. Delete fixtures only within your exact ownership. Keep secrets out of Git
  and chat.
- Record every time from `date -u` and every SHA from `git rev-parse`.
- Launch scope: never verify, test or fix the eight cut features.
- Own only docs/workstreams/03-home-access-residency.md in the coordination repo, and always
  `git commit --only <that file>`.
- Share the runtime lease, device slot 4 and the heavy slot with Stream 4. Message them when you take or release any of
  them.
- No new unit tests.
```

## CURRENT RESUME — Stream 3 (start here; written 2026-09-30T04:16:32Z)

**Scope.** Who can reach a home and what they can do there:
- joining and onboarding (H01–H08);
- residency claims and reviews, leaving and rejoining, ownership claims and transfer, landlord and lease approvals, and residency letters and passes (R01–R06);
- Home settings (D05), privacy (D06), and members, permissions, security and Lockdown (D07);
- the guest-pass lifecycle and sharing (D08, M02);
- deleting a home (D10);
- Home and unit identity on finished screens (U01), and this stream's cells of U02–U05.

**State at the split.**
- Master `8e44382ce`. Every former Stream 2 PR is merged; none is open. The most recent in this area:
  - #825: Lockdown reports a failed guest-pass revoke and can finish it;
  - #827: pass managers are told guest passes are off during Lockdown;
  - #828: the Lockdown panel states that the home becomes private and stays private;
  - #835: members opening a page they can't see get a permission sentence.

  Evidence and seals are in the history file.
- **Refreshed 2026-09-30T04:25:38Z:** the split's docs PRs #843 and #844 merged at 04:24:12Z (master `15711c8dc`), so Stream 3 has **no open PRs**. The user's own #430 is not a stream PR: its Home-editor part was repaired by #626, and the coordinator leaves it untouched.
- **Strict progress for this stream:** 8 of 20 rows closed (H01–H06, R01–R02), 12 partial, 0 cut. U01 and this stream's U02–U05 cells have their own section and are not in these counts, so the former Stream 2's 12-of-36 figure keeps its meaning.
- Nothing of Stream 3's is open in the database.

**Open work, in order.** Each row's exact remaining boundary is its last column in the checklist below.
**First, if nobody has yet:** rebuild the shared runtime. The Docker reset at 2026-09-30T05:51:48Z deleted it; the steps are in the resume prompt §2.
1. ~~**R06, the iOS restart check.**~~ **Done 2026-09-30, no code change:** `20260930-stream3-home-r06-ios-restart-r1` (`badb1a99…`). With the pass-issue reply held and the app killed, a cold restart showed one committed pass, one request and no resend.
   - R06's other sealed parts: accounts through the real API and the Android restart (`20260930-stream2-r06-request-identity-r1`, MANIFEST `8365b5ca…`).
   - Watch item: the Android Identity ANR, not reproduced in 3 bounded runs (`20260930-stream2-r06-identity-anr-repro-r1`, `f6f5b638…`).
   - Named boundaries: device clock, full-day expiry and the hosted issuer lifecycle.
2. **D07, members and security.**
   - ~~Racing Lockdown commands; audit-write failure~~: both reproduced on master and repaired in [#881](https://github.com/WangPantopus/skinny-pantopus/pull/881) (one transaction per Lockdown command via the new `set_home_lockdown`), merged in batch 150. Its migration was applied to the shared runtime at 07:37:21Z (`supabase migration up`; ledger 94).
   - ~~Raw codes in the audit lists~~ (Stream 4's lead): repaired in [#888](https://github.com/WangPantopus/skinny-pantopus/pull/888), merged in batch 152 (master `919305835`); the Home activity labels are now shared by `/timeline` and `/audit-log`.
   - Minor lead (coordinator note on #881; parked, not needed before launch): "Record this change" re-runs enable, so the recorded row says `guest_passes_revoked: 0` when the unrecorded first attempt did the revoking, and `lockdown_enabled_at` moves to the retry.
   - ~~Three web leads~~ (scoped share links during Lockdown; Invitations by URL; the standalone Settings links): all three reproduced and repaired in [#858](https://github.com/WangPantopus/skinny-pantopus/pull/858), merged in batch 141 (master `8af54a57a`).
   - New leads (recorded, not reproduced as defects yet):
     - the URL-only Settings page's Notifications switches have no height, keep local state only and name cut features (needs a product call: remove or persist);
     - ~~a member opening the Members page by URL still sees "Recover a member removal" and "Refresh members"~~: no change needed (code check 2026-09-30). Member-removal recovery includes the member's own leave (`is_self`, `removalLink(homeId, 'self')`), and the Homes list shows the same link to everyone; "Refresh members" is the page's standing refresh, which #835 kept.
   - Accepted limit: the Lockdown retry control is gone after a page reload.
3. **D05, Home settings:** recovery, concurrent edits from two clients, retained intent and explicit clearing on native.
4. **D06, privacy:** every remaining exposed privacy control and its native and other consumers.
   - **Done out of order (coordinator, 2026-09-30):** the Explore map homes layer, [#865](https://github.com/WangPantopus/skinny-pantopus/pull/865) (merged, batch 144) and its follow-up [#869](https://github.com/WangPantopus/skinny-pantopus/pull/869) (household members only, per `docs/location-privacy-matrix.md`; merged, batch 146, master `f82d24a18`). Second follow-up [#874](https://github.com/WangPantopus/skinny-pantopus/pull/874) (merged, batch 147, master `b16eca646`): trusted occupancies only, via the shared `getAccessibleHomeIds` (a pending claim, which anyone can file, no longer counts as household). The mail-compose recipients leak is Stream 4's.
   - **Reproduced 2026-09-30:** "Default Visibility for New Items" (web Home settings) has no effect. The owner saved `managers`, a new task was stored `members`, and member B saw it. Bundle `20260930-stream3-home-d06-default-visibility-r1` (`f6fbbe7f…`). **Coordinator decision (a):** honor it for tasks and documents (explicit visibility wins; the creator keeps sight; bills untouched). **Repaired in [#898](https://github.com/WangPantopus/skinny-pantopus/pull/898), merged in batch 156** ([#901](https://github.com/WangPantopus/skinny-pantopus/pull/901), master `b7eb7a7eb`; bundle `20260930-stream3-home-d06-default-visibility-fix-r1`, MANIFEST `c998dcda…`): tasks through the thin wrapper migration `20260930080000`, documents in the upload route; only Managers and Sensitive defaults apply (narrow only). `20260930080000` was applied to the shared runtime at 08:27:22Z (`supabase migration up`, ledger 95). Native gap: iOS/Android document uploads send an explicit visibility (the picker defaults to all members), so they don't follow the default until the pickers start from it (needs native toolchains). Lead: the access-code editor could start from the Home default the same way (access codes were left out of #898).
   - **Reproduced 2026-09-30:** the "Member join policy" has no effect. With "Verified only", a residency claim routes exactly as under "Open invite" (`household_review`, pending). Bundle `20260930-stream3-home-d06-join-policy-r1` (`5d920d44…`). **User decision 2026-09-30: hide it** and keep the column and API field. Web: [#917](https://github.com/WangPantopus/skinny-pantopus/pull/917), with the coordinator (bundle `20260930-stream3-home-d06-hide-join-policy-r1`, `8c65ee69…`). iOS and Android: [#971](https://github.com/WangPantopus/skinny-pantopus/pull/971), merged 2026-09-30 (`20260930-stream3-home-d06-hide-join-policy-native-r1`, `3dfdb0ae…`). The three-level policy is post-launch work (see "Post-launch work" below).
   - **Leads from a read-only code inventory (2026-09-30; each needs reproduction before any change):**
     - ~~`POST /api/homes/check-address` returns `home_id` and claimed status for an exact address, whatever the mask ("Invite only — completely hidden")~~: repaired in #970 (next item but one);
     - 8 of the 9 `HomePrivacy` toggles have no reader (no UI either); the address-precision toggle affects only the members-only Place header;
     - ~~the public fridge-card link is not covered by Lockdown although the panel says existing share links stop working~~: **user decision 2026-09-30:** the fridge card keeps working; the panel wording is fixed in [#916](https://github.com/WangPantopus/skinny-pantopus/pull/916) (web; native has no Lockdown panel);
     - `/discover` treats `members` visibility like `private`, and native apps have no visibility control;
     - per-Home notification preferences are saved but never read;
     - ~~guest-pass passcodes travel as `?passcode=` and are limited only by the generic 60/min/IP view limiter~~: measured (`20260930-stream3-home-d08-passcode-measure-r1`, `2f0a911c…`) and repaired in [#915](https://github.com/WangPantopus/skinny-pantopus/pull/915): 10 wrong passcodes per 15 minutes per link, the passcode in a header, and new passcodes of at least 6 characters. The same measurement found live guest-pass, share and invitation tokens in the backend log; repaired in [#914](https://github.com/WangPantopus/skinny-pantopus/pull/914) for every known bearer path. Both are with the coordinator;
     - `POST /check-address` returns the Home id and claimed status for an exact address, even at "Invite only — completely hidden". **Decided 2026-09-30 under the standing instruction and repaired in [#970](https://github.com/WangPantopus/skinny-pantopus/pull/970)**, merged 2026-09-30 (backend, web, iOS and Android; `20260930-stream3-home-d06-address-check-privacy-r1`, `a36aa59a…`). The address validator's `existing_household` details went too:
       - an invite-only Home answers with a neutral "a private Home is registered here, ask the household for an invite" status, with no id and no claimed status;
       - creating a duplicate Home there stays blocked, so ownership-conflict detection keeps working.
       - Why not hide it completely: `Home` has no unique address constraint, so a full hide would let a second Home at the same address sidestep the conflict checks.
       - This needs the backend plus the add-home flows on web (`homes/new`, `AddressAutocomplete`), iOS and Android (`AddHomeWizard`).
       - Context: Stream 1's #928 closed one id-to-address path; Home ids reaching non-household users are still worth closing.
5. **R03, leaving and rejoining:** the remaining re-entry and occupancy lifecycle, and the old reviewer-original release. Membership renewal is paused (decision 1 below).
6. **H07, H08, M02 and D08, local parts:** remaining onboarding combinations, the exact copied link and public rendering, passcodes and scheduled start. Their hosted parts stay named.
7. **D10 and R04, R05:**
   - D10: linked-resource cleanup (Crew payments belong to Stream 1);
   - R04: the remaining transfer, device-auth and recovery boundaries (the dispute flow waits on decision 3);
   - R05: attachment lifetimes.
8. **U01, Home and unit identity** (all of it is Stream 3's). Reproduce each item on finished screens, not loading placeholders, on web, iOS and Android; any of them may already be fixed:
   - personal residency cards that can't be told apart;
   - the narrow-screen member label/badge overlapping the floating chat button;
   - the verified-member screen's separate unverified-property label (the "property-verification wording");
   - long native activity identities.

   Sources: `docs/REMAINING_WORK_2026-09-11.md` §10 and `docs/home-dashboard-current-summary-2026-09-11.md`. Keep the designs; propose any layout change.
9. **U02–U05, this stream's cells.** ~~The two recorded VoiceOver gaps~~: the Requests row's Invite/Decline are separate since #973; the review sheet's Close/Reload and the Members top bar were not reproduced (a driver artifact; `20260930-stream3-home-u02-navbar-probe-r1`, `85e9b466…`). Next: native large text, screen readers and dark mode, and the U03 and U04 cases no row covers yet. Itemize the cells in this file the way Stream 1 itemized its own (the user approved Stream 1's lists on 2026-09-29), using the case names in `checklists/data.py` (A1–A5; E1–E6 and R1–R2; L1–L4). Don't write to Stream 1's generator. U05 starts when the launch flags are on master.
10. ~~**Minor lead:** `homeListService.checked()` swallows the underlying error (a logging gap only).~~ Repaired in [#983](https://github.com/WangPantopus/skinny-pantopus/pull/983), merged 2026-09-30 (`20260930-stream3-home-list-failure-logging-r1`, `649294ca…`).
11. **Cross-cutting (handed over):** `globalWriteLimiter` is mounted at `app.use('/api')` before any auth (`backend/app.js:320`), so `req.user` is never set there. It always keys by IP at the 30/min anonymous limit, and every signed-in member of a household behind one IP shares 30 writes a minute. The user decided on 2026-09-30 to fix it following industry practice; Stream 1 owns it. In the harness, pace writes about 2.2 s apart.

**Decisions.** These were Stream 3's open decisions; the closure plan has the background: https://claude.ai/artifact/AZyYcWk2YpdwT4pc3nGGkp
- **Decided 2026-09-30.** The user decided these (relayed by the coordinator), then gave a standing instruction to decide for the best UX, safety and retention, record it and keep going:
  - **Member join policy:** hide it (#917 web; native next). The three-level policy is post-launch.
  - **Fridge card during Lockdown:** it keeps working, and the panel wording is fixed (#916).
  - **Passcodes:** new ones need at least 6 characters (#915).
  - **Global write limiter:** fix it following industry practice (Stream 1).
- **Decided by me under the standing instruction** (each also in its PR):
  - **#915:** only wrong passcodes that were actually sent count toward the per-link limit; the header is percent-encoded, since HTTP headers can't carry non-Latin text; Create stays disabled while a passcode is 1–5 characters.
  - **#898:** only Managers/Sensitive defaults apply (a `public` default keeps members), and the default is read under the Home lock. The coordinator confirmed both.
  - **Add-home address checks (D06, commit `46cd0b548`, PR after the native checks):**
    - an "Invite only" Home answers `HOME_FOUND_PRIVATE`, with no id, address or claimed state, to anyone who doesn't already know it. People who already know it keep the full answer: household access or their own onboarding there, its creator, or a pending claim (the same people who can open its preview);
    - the address validator no longer sends `existing_household` (Home id, member count, roles) to clients, for any Home;
    - the web conflict card drops "N members currently registered";
    - clients show "This address has a private Home on Pantopus. Ask someone in that household to send you an invitation." and stop.
  - **#943:** `HomeAccessSecret.created_by` becomes nullable with ON DELETE SET NULL (Stream 1's assignment). No "Former member" text is needed, because no screen names a code's creator.
  - **Add-home address checks (#970, merged in batch 180):** as above.
  - **Settings dead switches (#962, merged in batch 177):** the standalone Home Settings page's five Notifications switches, which saved nothing, are removed. The Settings tab's switches say that per-Home routing isn't live yet.
  - **D05 native rename (commit `9c132e20c`, PR after the device runs):**
    - the editor starts from the Home's own name, not its address;
    - an untouched Save sends nothing;
    - an empty name clears it, as on the web, and `PATCH /:id` stores a blank name as null.
  - **Account deletion and Homes (decision 9: #974 with #968 and #976), 2026-09-30:**
    - **Who keeps a Home** is one rule, shared by `othersKeepHome` and #968's `HOME_PURGE_HOUSEHOLD_PRESENT` and computed with the same `home_effective_access`. It is kept if there is:
      - any other verified owner (a person or a business);
      - another occupant who still has access;
      - a legacy `Home.owner_id` owner with access.

      Pending, provisional and unverified occupants have no access, so they don't keep it.
  - **U01 web chat-button overlap (2026-09-30):** closed with no code change. Nothing meaningful stays covered at the end of any Stream 3 page at 375×548 or 390×664, and extra padding would change the whole app's AppShell layout.
  - **Removed-Home notice (#1008):** people whose pending requests die with a deleted Home get the existing decline notices with neutral wording ("This home was removed from Pantopus …").
  - **D08 scheduled passes (#999):** native lists follow the web: a scheduled pass stays current, shows "Starts …" and stays revocable; `reissue_required` shows "Needs new link".
    - **LIF-02** (Stream 5's route): only a current verified occupant blocks an owner's account deletion. Pending people have nobody to be handed to, the "remove the other residents" message pointed at people the owner can't see, and App Store 5.1.1(v) forbids needless obstacles to deleting an account.
    - **After a 'purged' Home**, `retireHomeForDeletedAccount` closes the remaining pending standing with the existing lifecycle transitions and notices, so nobody waits forever in a Home with no owner: non-verified occupancies, pending residency and ownership claims, and household access requests. #968 stays records-only.
**The five Stream 3 decisions, settled 2026-09-30** (by me under the standing instruction, except item 4; details in each row):
1. **Rejoining after leaving (R03): an ended membership stays final for launch.** Invitations, join requests and residency reviews already refuse with `MEMBERSHIP_RENEWAL_REQUIRED`, and the apps say so plainly (#781, #794, #796, #799). Membership renewal moves to the post-launch list.
   - Why: renewal needs its own re-verification design, and restoring access silently is a safety risk. Leaving already asks for confirmation.
   - R03 can close on its remaining local checks.
2. **What an ordinary member sees by default (D07, D06): keep least privilege.** New members get the home overview and Tasks; owners grant more. The screens already say what a member can't see (#835).
   - Why: a household's documents, access codes and member list are its most sensitive data.
3. **Ownership disputes at launch (R04): launch without them.** `HOUSEHOLD_CLAIM_CHALLENGE_FLOW` defaults to `false` in `backend/config/householdClaims.js` and `.env.example`.
   - R04 narrows to transfer and recovery.
   - Hosted check: the production environment must not set the flag to true.
4. **Guest pass "Allowed areas" (M02, D08): already decided by the user on 2026-09-26** (commit `2c8908956`). The chips that were never sent became the guest page's real "What they can see" sections (`included_sections`), matching the web. This item was stale.
5. **Lockdown visibility (D07): the Home stays private after Lockdown ends.** The owner reopens it deliberately, and the panel already says so (#828).
   - Why: an automatic restore could re-expose a Home before its owner has reviewed what happened.
   - Post-launch idea: a one-tap "Restore previous visibility" after disabling.
6. **iOS large text (U02 A1), decided 2026-09-30:** keep the fixed-size type ramp on Stream 3's iOS screens. This follows the user's 09-29 decision for Posts ("keep the current layout"). A1 checks that nothing essential is clipped and every action is reachable at the largest accessibility size; screens that cut text get the smallest local repair (whole names; capping growth on the three Review claims links).
   - Post-launch idea: Dynamic Type across the iOS design system as one designed change.

Shared with Stream 4:
1. Brand colors that fail contrast (all streams): Stream 1 carries one design-token recommendation.
2. When to verify hosted and provider behavior (both streams): a staging pass before launch, or a launch-day checklist.

**Hosted and provider boundaries.** These rows can't close locally; name them and never turn them into passes:
- H07, H08: email and link delivery, hosted storage.
- R05: attachments and providers.
- R06: the hosted issuer lifecycle, device clock and full-day expiry.
- D08: hosted expiry and downloads, device clock.
- M02: the hosted guest flow.
- D10: files, balances and live obligations.

## Checklist — the inventory rows owned by Stream 3 (20 of the former Stream 2's 40)

State at the split, copied verbatim from the former file's "September 22 exact … 40-row inventory". From now on, update each row only here.

| Row | Current disposition and bounded evidence | Remaining boundary before row closure |
|---|---|---|
| H01 | **Closed — verified/preserve.** Existing detail/property authority and held-result retirement receipts are reused. | None within the recorded H01 scope; release-wide gates remain separate. |
| H02 | **Closed — verified/preserve.** Existing list authority, safe errors and held-result retirement receipts are reused. | None within the recorded H02 scope. |
| H03 | **Closed — verified/preserve.** Existing explicit projections and retryable detail/list/occupant reads are accepted. | None within the recorded H03 scope. |
| H04 | **Closed — verified/preserve.** Existing per-field grants, household references and current roster are accepted. | Managed history and peer ownership remain separately gated outside H04. |
| H05 | **Closed — verified/preserve.** Existing native identity, ownership, residency and current-access receipts are accepted. | Broader onboarding/first-use boundaries remain H07/H08/U01/U02. |
| H06 | **Closed — verified/preserve.** Existing guarded deletion eligibility and occupancy/null behavior are accepted. | Broader member onboarding remains H08. |
| H07 | **Partial/open.** Admission, invitation, task and recovery reused. New-account combined web/Android/iOS return now verified113-file830c6dbc with real auth/decision/SQL, controlled delivery and exact cleanup; no application change. | External delivery/hosted links, process/storage/lifecycle exit criteria and remaining onboarding combinations. |
| H08 | **Partial/open.** Owner/applicant/private-setup lists and recipient decisions reused; three-client new-account invitation→verification→Login→original review→current Home now evidenced113-file830c6dbc. | Provider/hosted delivery and broader onboarding/verification exit criteria beyond this controlled combined transition. |
| R01 | **Closed — verified/preserve.** Prepared residency review, protected originals/receipts, decisions, restart and access retirement are accepted. | Release-wide gates remain separate. |
| R02 | **Closed — verified/preserve.** Atomic submission, lock races, selected-address fencing, populated preservation and legacy compatibility are accepted. | Historical-binary UI, hosted adoption and broader applicant/reviewer lifecycle remain outside R02. |
| R03 | **Partial/open.** Existing protected removal/recovery preserved. Web waiting-room403/read503/protected Leave accepted37/3289 and merged#722. Native pending403/read503/Retry/protectedReviewClose and mounted truthful reopen accepted150/73becde6, final49b1/#724 for coordinator integration; exactfixturecleaned. | Remaining re-entry/occupancy lifecycle and old reviewer-original release; renewal paused. Other native verification/ownership-claim states, challenge/postcard countdowns and broad account/provider boundaries remain unverified. Reuse pending/reopen evidence; the misleading pull hint is repaired. AndroidreviewPNG0 and iOSownercontrolmenuoverlay are qualified in the seal. |
| R04 | **Partial/open.** Existing ordinary claim/review and relationship milestones are reused. 2026-09-26: transfer to an email with no account no longer leaves the Home ownerless ([#473](https://github.com/WangPantopus/skinny-pantopus/pull/473), bundle `20260926-stream2-ownership-transfer-fix-r1`). | Remaining transfer/device-auth/recovery boundaries. Current dispute route is a dashboard redirect/inactive backend product state; claim challenge defaults behind HOUSEHOLD_CLAIM_CHALLENGE_FLOW, deployed setting unaudited. No new voting/dispute screen or flag activation authorized. |
| R05 | **Partial/open.** Existing lease approval/end/move-out/request repairs and native receipts are reused; PR176 only repairs the Home Settings caller. 2026-09-30: the web property page no longer offers its Notices and Settings tabs, which have no backend routes or tables ([#1051](https://github.com/WangPantopus/skinny-pantopus/pull/1051), merged in batch 211; real-Chrome before/after `20260930-stream3-home-landlord-unbuilt-tabs-r1`, `6df5bff9…`). 2026-10-01: the Leases tab's "End Lease" asks first instead of ending a lease on one click ([#1269](https://github.com/WangPantopus/skinny-pantopus/pull/1269), `1001 web-end-lease-confirm`, `dc817385…`; merged in batch 276). | Remaining attachment account/lifetime and real-provider/rollout boundaries. Current native apps explicitly have no landlord-request screen; web request attachment entry is distinct from the existing residency-evidence alternative. Do not build new controls/readers from the stale inventory wording alone. |
| R06 | **Partial/open.** 2026-09-26: native Identity entry, letter PDFs on both apps, and guest/service-provider wording and issue gating on all three platforms ([#493](https://github.com/WangPantopus/skinny-pantopus/pull/493), bundle `20260926-stream2-r06-native-letters-r1`). User-approved 2026-09-26 and done: Proposal A, a guest or service-provider role ends residency in `verifyByCode` and `isStillVerifiedResident` ([#538](https://github.com/WangPantopus/skinny-pantopus/pull/538), bundle `20260926-stream2-residency-guest-role-r1`, batch 32). | Proposal A public-verifier behavior is already accepted in #538; do not repeat it. Native pass issue/view/revoke and recorded recovery now accepted eb4445a2 (105files), exact fixture cleanup. Same-mounted-composer duplicate/uncertain issue now accepted61-file24284dc0, all3platforms, exact0b41/#729 for integration and5claimcleanup. Personal pass-list read503/recovery now accepted50-filef98146c4, actual all3 clients plus web true-empty; #732 exact977a94f mergedbatch88, no fixture/write and349non-auth hashes unchanged. Mounted controlled expiry now accepted84-fileca30aed5 across all3issuer clients/public verifier, exact21df/#735 mergedbatch89; oneclaim+14access cleaned/full349non-auth restore. Remaining: full-day/device-clock/account/restart request identity and broader issuer/hosted lifecycle; Android Identity navigation ANR unresolved. Distinct from guest passes.  Current bounded navigation non-reproduction63-file7a1641e4 reaches pass without ANR/five hashes equal; original ANR cause remains unresolved. |
| D05 | **Partial/open.** #745 actualwebnull-nameRetry repaired5648d2bfd/45-file2758598a: blankcurrentinput/no-op0PATCH/name/clear/reload, exactownedHomecleanup/all349guardedhashes restored; no broaderaccount/concurrency/nativeclear claim.  #693 native rename pending-input gate verified with held200/503, retry/cold rereads and101-table cleanup in110-file6ea2e5ef, qualified AX capture limits.  #690 web in-flight inputs now gated; actual delayed200/503, draft retention, retry/next edit and101-table cleanup verified in43-file1106ecb4.  Settings read/save, permission, atomic and response-lifetime evidence is recorded. 2026-09-27: web Home editor coordinates repaired and real browser/API/SQL verified in [#626](https://github.com/WangPantopus/skinny-pantopus/pull/626), bundle `20260927-stream2-home-edit-coordinates-r1` (`66ab3a82…`); provider response EMULATED, external geocoding unverified. 2026-09-27 separate caller repair `57346effc` preserves unrelated two-tab edits; real browser/API/SQL edges sealed in `20260927-stream2-settings-retained-edits-r1` (`bfd106e6…`). | General settings recovery, concurrent edits, retained intent, privacy and explicit clearing across clients. |
| D06 | **Partial/open.** #638 actual native privacy→Home-tools-return projection, read503/retry/restart verified; final bundle af14517d, fixture retained. Home privacy read-failure repair and actual consumer recovery are recorded. | Every exposed privacy control and all native/other consumers.  #749 pending-save afters/Place/cold/cleanup accepted within scoped173-file seal; merged batch95/#750; no whole-row closure. |
| D07 | **Partial/open.** 2026-09-30 [#881](https://github.com/WangPantopus/skinny-pantopus/pull/881) (batch 150): each Lockdown command is one SQL transaction under the Home's share lock (`set_home_lockdown`, forward migration), so a racing disable can no longer leave the audit log ending "enabled" on a Home that is off, and a refused audit insert is reported (enable stays on with a "Record this change" retry; disable changes nothing). Real Chrome + real API races and refused-audit cases with test-only hooks, bundle `20260930-stream3-home-d07-lockdown-commands-r1` (`3a239f36…`). [#858](https://github.com/WangPantopus/skinny-pantopus/pull/858) (batch 141): during Lockdown a document share link tells a `home.edit` holder "Share links are off while Lockdown is on" instead of the guest-facing denial; a member opening Invitations by URL gets a permission sentence instead of the sender form; the URL-only Settings page offers Members & Roles and Access & Codes only to viewers who can open them. Real Chrome before/after + real API, exact cleanup, bundle `20260930-stream3-home-d07-web-leads-r1` (`7be1dd8e…`). #758 ShareCentercollection error/retry34-file5154af44/all353unchanged, merged batch99/#760. #757 matchingLockdownreceipt guard58-file9b508c29/all353restored, merged batch99/#760; concurrency/serverpartialfailureunverified. #755 standalone saved access reveal + emergency-only Overview,47-filed8966910 seal/all353 restored; merged batch98/#756. #753 access-only dashboard and existing Lockdown member/invite copy,73-file986c3f0f seal/exactcleanup, merged batch97/#754. #751 one-row audit copy corrected after actual Lockdown issue-create/full-audit mismatch;50-file4a737de4 seal/cleanup, merged batch96/#752. #647 current Lockdown read/manage recovery and per-card failures verified (e570e414), merged; #649 corrects forced-signin copy; member/invite/audit/session effect wording now reconciled via649/751/753; concurrent/failing commands remain. #644 supplementary-summary failure/retry/real403/navigation evidence7eb50c75; healthy0 states only, Lockdown effects open. #641 repairs two real vendor false-empty readers, bounded UI/API/SQL evidence9a2d5cf9 and exact vendor cleanup. Invitation send/decline/role/audit and mailbox-preferences route repair evidence is recorded. 2026-09-26: web explicit role choice ([#474](https://github.com/WangPantopus/skinny-pantopus/pull/474), bundle `20260926-stream2-web-role-choice-r1`). Members "Invite" opens the real Invite Member panel instead of a stub that faked success ([#528](https://github.com/WangPantopus/skinny-pantopus/pull/528), bundle `20260926-stream2-members-invite-r1`). | Existing web provider/security read errors are accepted (#641/#644/#647), not repeat work. Remaining: Lockdown concurrent/failing commands and audit-write failure, ShareCenter lifetime boundaries and other consumers outside those accepted cases. |
| D08 | **Partial/open.** #761 mountedexpiry145-filedca63a57: actualwebowner/public+installediOS/Android Active→Past/terminalexpiry, native503/errorlifetime/Retry/cold,20ownedcleaned/all347nonAuthrestored. Short supportedAPIexpiries, helperqualifications explicit; reviewed/mergedbatch101/#764. Earlier browserM02 share lifecycle and nativeissue/revoke/sections evidence retained. | Hosted expiry/storage/downloads, passcodes/scheduled-start, account/permission and device-clock/background boundaries remain. |
| D10 | **Partial/open.** Three-app owned-fixture deletion/cascade/failure/permission/restart verified43a95cbb; Home58 plus2nativefixtures all0, retained delete-interval hashes equal. Web landing repaired byS1#652 and S2addendum43e1e269 passes. Current14-file5274506a binding preserves188acceptedfiles; complete document/claim/legacyretirement is an explicit contract boundary, task-media storage-layer proof alreadyaccepted, liveCrewpayment dependency confirmed open byS1. Files/liveobligations/account breadth open. Real Settings self-leave now uses the existing `/move-out` transaction and was restored cleanly. | Household delete/linked-resource cleanup across history, files, balances and live obligations. |
| M02 | **Partial/open.** #761 mountedowner/public/nativeexpiry plus nativeerror/Retry/cold accepted locally in145-filedca63a57, exactcleanup/source/buildbindings; reviewed/mergedbatch101/#764. Shortdeadline limits explicit; no delivery/clipboard claim. Browser guest-pass issue/view/revoke/time-window/view-limit journey and Android create/Later/Share/revoke are accepted; copied/public-page and provider limits are labelled. 2026-09-26: the guest-pass entry shows only to viewers with `members.manage` on all three platforms ([#519](https://github.com/WangPantopus/skinny-pantopus/pull/519), bundle `20260926-stream2-guest-pass-entry-r1`). A guest pass shared from iOS/Android links to the web app's guest page on the build's web origin, not the download link `pantopus.app` ([#521](https://github.com/WangPantopus/skinny-pantopus/pull/521), bundle `20260926-stream2-guest-pass-link-r1`). Both merged in batch 28. The native Add guest form names the real Home and tells the truth about delivery and the note ([#535](https://github.com/WangPantopus/skinny-pantopus/pull/535), bundle `20260926-stream2-add-guest-truth-r1`); its Allowed areas chips remain a privacy decision with the user. User-approved 2026-09-26 and done: the native Add guest "What they can see" sections are sent as `included_sections` ([#539](https://github.com/WangPantopus/skinny-pantopus/pull/539), bundle `20260926-stream2-add-guest-sections-r1`). Verified on both apps through DB, guest API and the web guest page. | Complete native/hosted guest flow, exact copied-link/public rendering and broader external-share acceptance. |

## Former S2-xx UX items owned by Stream 3 (6 of 24; all resolved, owned for any regression)

| ID | Item (UX inventory 2026-09-23) | Disposition |
|---|---|---|
| S2-01 | "Invite your landlord" opens a 404 | fixed by #380 |
| S2-05 | Visit setup "Link an access code ›" does nothing | fixed by #381 |
| S2-06 | Landlord "tenant_request" notifications open nothing | fixed by #453 |
| S2-10 | "A residency request is ready for review" opens the Home dashboard, not the review | fixed by #453 |
| S2-17 | Home notification links land one level up or on the wrong tab | fixed by #453 |
| S2-23 | Waiting room "Request help" only flashes an email address | fixed by #380 (already on master at the 2026-09-26 check) |

## Cross-cutting rows (`REMAINING_WORK` §10): U01, and Stream 3's cells of U02–U05

Added 2026-09-30T04:36:26Z. These rows sat in the former Stream 1's inventory, not in the former Stream 2's file, so the split's first proof (40 rows and 24 S2-xx items) didn't cover them.
- Stream 1's records give U01's "Home/unit identity, floating chat and verification wording" to the former Stream 2 (coordination commit `7c88a08c7`, its U reconciliation).
- Stream 1's U02–U04 checklists (`checklists/`) cover only Streams 1 and 2's screens. For U05, each stream inventories its own screens.
- `check-stream2-split.py` now also proves that U01 has one owner and that both files carry U02–U05.

| Row | Current disposition and bounded evidence | Remaining boundary before row closure |
|---|---|---|
| U01 | **Closed 2026-10-01 — Stream 3's alone; all 4 open items closed.** Accepted earlier: the indistinguishable unit cards (API, browser, iPhone and Android; `docs/home-list-unit-identity-2026-09-11.md`) and complete recipient identities on both native Pending invitation lists. 2026-09-30, on current builds: personal residency cards are distinct on web, iOS and Android (`20260930-stream3-home-u01-residency-cards-r1`, `d67413b1…`, no change); the web chat-button overlap leaves nothing covered at 375×548 and 390×664 (`20260930-stream3-home-u01-fab-overlap-r2`, `e36c0888…`, no change); the verified member's separate unverified-property label is fixed on web by #927, and native reads the viewer's own standing. | ~~Long native activity identities~~ **closed 2026-10-01, no defect** (`20261001-stream3-home-u01-long-names-r1`, `a5e1065c…`). A 66-character owner name, set temporarily and restored exactly, reaches only the Members Audit Log rows. They wrap cleanly on both apps at default and largest text (Android 2.0 ends with an ellipsis); the Members list and the dashboard's Recent activity use usernames. Noted for U02: on iOS at AX5 the Audit Log row and tabs keep their default size. Native chat-button overlap was accepted 2026-09-11. |
| U02 | **Partial/open — itemized 2026-09-30 (section "Stream 3 exit checklists" below); web evidence.** The former Stream 2 ran real-Chrome sweeps of its 37 retained web routes: dark-mode contrast ([#809](https://github.com/WangPantopus/skinny-pantopus/pull/809), `20260929-stream2-web-dark-link-contrast-r1`, `db25f76e…`: 12 targeted texts now pass, low-contrast styles 112 → 95), accessible names ([#819](https://github.com/WangPantopus/skinny-pantopus/pull/819), `20260929-stream2-web-a11y-names-r1`, `549cdcdb…`: 19 unnamed controls → 0) and a 390×844 layout sweep for owner and member (same seal: no horizontal overflow). Stream 3's own dark-mode repairs: [#801](https://github.com/WangPantopus/skinny-pantopus/pull/801) residency and ownership-evidence choices (`c02dbcea…`), [#807](https://github.com/WangPantopus/skinny-pantopus/pull/807) the Home editor's Visibility choice (`3d351f7d…`) and [#822](https://github.com/WangPantopus/skinny-pantopus/pull/822) Members and Owners role and tier accents (`6e8b95ee…`). The two recorded iOS VoiceOver gaps are closed (2026-09-30): the Requests row by [#973](https://github.com/WangPantopus/skinny-pantopus/pull/973); the review sheet's Close/Reload and the Members top bar were not reproduced (`20260930-stream3-home-u02-navbar-probe-r1`, `85e9b466…`). | Native large text (Dynamic Type, font 2.0), VoiceOver and TalkBack, native dark mode and keyboard focus on this stream's screens. The remaining low-contrast styles are the brand-colour decision Stream 1 carries. |
| U03 | **Partial/open — itemized 2026-09-30 (below); recorded per row.** Error, retry, lost-reply, duplicate and cold-restart cases are accepted inside R03, R06, D05, D07, D08 and M02 (their bundles are in the checklist above). | Loading, empty, partial, unavailable, offline, slow, cancel, back, double-tap and process-death cases on this stream's screens where no row covers them yet. |
| U04 | **Partial/open — itemized 2026-09-30 (below); recorded per row.** The bounded Home account-switch and session lifetimes that the U04 row already accepts; R06's restart request identity is sealed on Android (`20260930-stream2-r06-request-identity-r1`, `8365b5ca…`) and iOS (`20260930-stream3-home-r06-ios-restart-r1`, `badb1a99…`). | Long-lived sessions, background and foreground, and concurrent device or account changes beyond the bounded Home tests. |
| U05 | **Not started — waits for the launch flags on master.** | This stream's screen and action inventory in the final release build on web, iOS and Android, for the release manifest Stream 1 assembles. |

## Stream 3 exit checklists (U02–U04), itemized 2026-09-30

Itemized from sealed evidence in the audit store using Stream 1's case names (`checklists/data.py`). `MMDD name` means `2026MMDD-stream2-name-r1`, or `-stream3-home-` from 2026-09-30. This is a static list; Stream 1's generator isn't used.
- **How it was built:** a read-only evidence map came first, and I re-checked every ✅ against its bundle's own report. One map claim was wrong: iOS and Android do have a landlord verification wizard (`VerifyLandlord/`, `verify_landlord/`). So a cell without a bundle is ⬜ or ❓, never inferred.
- **Legend:** ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.
- **☑️ (added 2026-09-30):** an older accepted report (the 09-11…09-13 `docs/home-*` reports, run on candidate builds before sealed bundles existed; raw copies in the recovery archive). Reused, not re-run. It counts toward closure only once its source is shown unchanged or the case is re-run.
- **Row closure:** a row closes when every cell is ✅, –, ⛔ with its boundary, or 🔷 decided.
- **Native:** native cells can't run until the machine-wide native reinstall (the user's OK).

**U03 edge cases** — E1 server error; E2 lost reply; E3 double tap; E4 not allowed; E5 changed meanwhile; E6 bad input; R1 read failure; R2 empty.

| Workflow | iOS | Android | Web |
|---|---|---|---|
| Joining: invitations, waiting room, residency claim, verification pages | ✅ E4 R1 (#724: pending 403 shows the waiting state; a 503 shows an error, not "No claim in review")<br>✅ new-account invite → verification → original review (0928 home-new-account-invite)<br>✅ E2 E5 (09-12 iOS invitation decisions r7: a lost acceptance reply, and expiry while the confirmation is open; 09-12 postal recovery: a lost admitted reply keeps one postcard) (re-checked 2026-10-01: the iOS decision and postal files and their services are unchanged since `13bb557e7`/`ecac0940f`; `act_on_home_invitation` was later redefined in `f88038778` only to accept resend-link tokens and narrow an inviter shortcut) <br>✅ E1 (`1001 joining-native`, `dcdcc2b9…`): a one-time 503 on the decision keeps "Recover your invitation decision"; Check (404) keeps it; Retry → one decision, one membership, same request id<br>✅ E3 a confirm double tap after a single opener tap: one decision<br>⬜ E3 a double tap on "Accept invitation" leaves "Confirm acceptance" doing nothing (reproduced twice; fix `30e39e566` building)<br>⬜ E6 a malformed link shows a dead "Try again" (fix `30e39e566`); an unknown token ✅ "Link no longer valid"<br>⬜ a second invitation link while one is open is ignored (fix `30e39e566`) | ✅ E4 R1 (#724)<br>✅ new-account invite (0928 home-new-account-invite)<br>✅ E2 E5 (09-12 Android invitation decisions r5: lost replies recover the same original; one rejection after expiry while open; 09-12 residency recovery ui-r6: a lost joining reply, one POST) (re-checked 2026-10-01: the decision files, the residency-submission API, store, routes and service are unchanged since `253d5c6cf`/`e8c3459bd`; `HomeCreationCoordinator` changed only its acknowledgement step, after the outcome, in `e44981d5c`) <br>✅ E1 (`1001 joining-native`): the same recovery; one decision, same request id<br>✅ E3 opener and confirm double taps: one decision, one membership<br>⬜ E6 a malformed link shows a dead "Try again" (fix `30e39e566`); an unknown token ✅<br>✅ a second link replaces the open one | ✅ E1 E4 R1 (#722 waiting room: Leave 503 keeps the original, and Retry sends one command; pending 403 says "Waiting for approval"; read 503 and Retry)<br>✅ R2 (#558: no false "No household admin yet")<br>✅ R1 invitations and verify pages, owner view (0929 web-false-empty-sweep-r2)<br>✅ new-account invite (0928 home-new-account-invite)<br>✅ E2 E5 (09-11/09-12 browser reports: lost invitation replies across restart, a lost residency-submission reply after reload, one postcard after a lost reply; changed reviewed terms; an expired preview stays retired) (re-checked 2026-10-01: the invitation, preview, creation and postcard controllers, stores, hooks and models are unchanged since `b638389e1`/`9a10a7dd4`; the SDK `client.ts` now binds requests to their session, so an error after a lost reply may read differently; retry identity unchanged) <br>❓ E6 partial (a different apartment is refused before submitting; other form validation not run)<br>✅ E3 invitation accept (`1001 web-e3-join`, `88952e7c…`): a real double-click on "Confirm acceptance" sends one decision and gives one membership. A double-click on "Accept invitation" opened the confirmation and its second click hit Cancel, so nothing happened; repaired in the shared confirmation dialog by [#1214](https://github.com/WangPantopus/skinny-pantopus/pull/1214) (`1001 confirm-dblclick`, `188a2230…`; merged in batch 259, 03:29:40Z, master `61d710fed`)<br>⬜ E3 residency-claim submit |
| Owner's residency review (approve, reject) | ✅ hint copy (#799)<br>⬜ E5 departed applicant: no native run (#796 was web; the native refusal copy is unchanged, `0929 residency-review-former-applicant`)<br>✅ E1 E2 E3 R1 (`0930 u03-residency-review`: a 503 keeps the saved decision and Retry approves it; a lost reply commits once, and after relaunch "Original decision confirmed"; a double tap sends 1 POST; a read 503 then Reload) | same as iOS (the same bundle; the review screen is FLAG_SECURE, so it was checked through the accessibility tree) | ✅ E5 (#796: a departed applicant's claim gets an honest 409; Reject works)<br>✅ R1 review-claim and residency (sweep r2)<br>✅ hint copy (#799)<br>✅ E2 (09-11 web residency review recovery r4: a lost committed approval reply replays identically) (re-checked 2026-10-01: controller, store, model, SDK calls and `decide_home_residency_review` unchanged since `d93a7f6ac`; the routes changed only log field names, the service one refusal string) <br>❓ E1 E3 at API/SQL level only (an injected receipt-insert failure changes nothing; SQL races include a duplicate approval; no UI 503 or double click) |
| Leaving, member removal and recovery | ✅ E5 (#781 re-inviting an ended member; #794 approving an ended member's request: honest 409 on all three clients)<br>✅ E2 (09-13 iOS removal recovery r6: after a lost committed reply, Retry sends the same UUID; one command) (re-checked 2026-10-01: the native removal files are unchanged since `a389001a0`; no removal SQL function was redefined) <br>✅ E1 (`1001 removal-native`, `9d7f16cc…`): a one-time 503 on the command shows "Recover original removal" (Check, Retry, Cancel) with B still a member; Check (a 404) keeps it unconfirmed; Retry removes B once, with the same request id (the md5 of the id Check read equals the DB row's)<br>✅ E3 (`1001 removal-native`): two taps 157 ms apart on the alert's "Confirm removal" send one command and give one removal<br>🔷 re-entry (decision 1) | ✅ E5 (#781 re-inviting an ended member; #794 approving an ended member's request: honest 409 on all three clients)<br>✅ E2 (09-13 Android removal recovery: a cold Retry sends the identical UUID; one command) (re-checked 2026-10-01: the native removal files are unchanged since `a389001a0`; no removal SQL function was redefined) <br>✅ E1 (`1001 removal-native`, `9d7f16cc…`): a one-time 503 shows "Saved member removal" (Check, Retry, Cancel) with B still a member; Check (a 404) keeps it; Retry removes B once with the same request id (md5 match). The dialog is a secure window, so its frames are 0-byte PNGs and the text dumps are the evidence<br>✅ E3 (`1001 removal-native`): two taps 170 ms apart on "Confirm removal" send one command and give one removal<br>🔷 re-entry (decision 1) | ✅ E1 (#722 Leave)<br>✅ E5 (#781, #794)<br>✅ E2 (09-13 browser removal recovery r2: one UUID and a byte-identical body; one command) (re-checked 2026-10-01: the web removal files changed only in colours (`82408ce4e`) and the notice link (`90e7e321a`) since `1a4757084`; no removal SQL function was redefined) <br>✅ E3 (`1001 web-e3`, `a33a582c…`): a real double-click on Confirm removal (owner) or Confirm leave (member) sends one command and gives one result<br>🔷 re-entry (decision 1) |
| Ownership: claims, Owners page, transfer | ✅ transfer copy (`0927 native-transfer-account`: both recipient cards show the account requirement; the string is on master)<br>⛔ a native transfer itself (behind device authentication)<br>⬜ E1 E2 E3 E4 E5 R1<br>✅ disputes: launch without them (decision 3, 2026-09-30) | same as iOS | ✅ E4 (#835: permission sentence; Invite and Transfer hidden)<br>✅ E6 (#473: an unknown or own email gets an honest 400; nothing changes)<br>✅ R1 owners pages (sweep r2)<br>⛔ E1 revoke failure through the API only (#473)<br>✅ disputes: launch without them (decision 3; the flag defaults off)<br>⛔ hosted check that production doesn't set the flag<br>✅ the "Find a home" result (`/app/homes/find`, URL-only) opens the owner-claim evidence page instead of a 404 ([#1260](https://github.com/WangPantopus/skinny-pantopus/pull/1260), `1001 web-find-claim-link`, `6a57088c…`; merged in batch 272, master `da1e57588`) |
| Landlord and lease approvals | – no native landlord approval screen (the 09-13 lease runs approved through the service)<br>✅ tenant side (09-13 lease-transaction: the lease request keeps its fields on an impossible date; a committed request or invitation acceptance whose reply became a 503 keeps one lease) (re-checked 2026-10-01: the request and invitation-acceptance 503 cases count; native tenant files unchanged after the last checkpoints except iOS colour tokens)<br>✅ impossible date re-run 2026-10-01 on both apps (`1001 lease-date-native`, `a9d16761…`): "2026-02-30" is rejected locally (iOS "Use YYYY-MM-DD"; Android "Fix 2 things to submit · … Move-in date"); the typed fields stay; no request is sent. Correcting it clears the error. The two copy leads are fixed by [#1271](https://github.com/WangPantopus/skinny-pantopus/pull/1271) (`1001 landlord-copy`, `401ece8c…`; merged in batch 276, 07:06:14Z, master `dc878ddb5`): both apps now say "1 field needs attention", and the banner calls an empty e-mail "Email" ("Fix 1 thing to submit · Email"); 0 requests <br>⬜ U03 cases in the native landlord verification wizard | same as iOS | ✅ E1 E2 E6 (09-13 landlord-account r1, an isolated renderer on the real SDK, routes and SQL: invalid dates send nothing; a server failure keeps the reviewed dates; a lost reply retries the same intent) (re-checked 2026-10-01: the approve modal, SDK, handlers and service are identical since `1a17a22a9`; the approve schema now rejects impossible dates (`113d4cdc6`) and `decide_home_lease` refuses multi-unit approvals (`b7ecefcc3`), neither changes these cases) <br>✅ the unbuilt Notices and Settings tabs are no longer offered ([#1051](https://github.com/WangPantopus/skinny-pantopus/pull/1051), `0930 landlord-unbuilt-tabs`; merged in batch 211)<br>✅ E3 in the full app (`1001 web-e3-landlord`, `cb193bc5…`): a double-click on "Approve Lease" gives one approval (the button disables after the first click). On master, the request row's Approve double-click closed the modal (the second click hit its backdrop); fixed by [#1232](https://github.com/WangPantopus/skinny-pantopus/pull/1232) (merged in batch 264, 04:32:34Z, master `51634ec30`)<br>✅ Leases tab "End Lease" asks first with [#1269](https://github.com/WangPantopus/skinny-pantopus/pull/1269) (`1001 web-end-lease-confirm`, `dc817385…`; merged in batch 276, 07:06:14Z, master `dc878ddb5`): on master one click ended the lease (B's access ended, B notified) with no dialog; now "End this lease?" names the tenant, Cancel sends nothing, and a double-click on "End lease" sends one request<br>⬜ E5 R1 R2 in the full app |
| Residency letters and passes, public verify pages | ✅ E1 (0927 native-residency-pass: issue and revoke 503 show an error; retry works)<br>✅ E2 (#729; the app killed after a committed issue or revoke shows the right state after restart)<br>✅ E4 (#493 guest wording; #538 public pages)<br>✅ E5 (#735 expiry while open)<br>✅ R1 in-place retry ([#1067](https://github.com/WangPantopus/skinny-pantopus/pull/1067), merged in batch 220, `0930 residency-list-retry`, `e28414b2…`: before, a list 503 showed only the error; after, Try again on the letters history and the passes list, one GET each, error gone)<br>✅ E3 a real double tap on "Issue claim & copy link" (two taps 153 ms apart) gives one claim (`1001 pass-e3-native`, `2f3d6039…`) | ✅ E1 E2 (native-residency-pass; #729; 0930 r06-request-identity restart)<br>✅ E4 (#493, #538)<br>✅ E5 (#735)<br>✅ R1 in-place retry (#1067, merged in batch 220, `0930 residency-list-retry`, `e28414b2…`)<br>✅ E3 (two taps 141 ms apart give one claim; `1001 pass-e3-native`) | ✅ E2 (#729: after a lost 201, the retry gets the same pass)<br>✅ E4 E5 (#538 public pages say revoked or no longer verified; #735 expiry on issuer and public pages)<br>✅ R1 (#732: 503 then Try again)<br>❓ R2 (no claims: the history section is hidden with no empty text; decide whether that is right)<br>✅ E3 with [#1231](https://github.com/WangPantopus/skinny-pantopus/pull/1231): on master a real double-click on "Issue verified letter" issued two letters (two codes, two PDFs); with the fix, one (`1001 web-e3-letters`, `0fed46ac…`; merged in batch 264, 04:32:34Z, master `51634ec30`)<br>⛔ device clock, full-day expiry, hosted issuer |
| Home settings (D05) | ✅ E1 E3 (#693: the rename field is locked while saving; a 503 keeps the draft)<br>✅ rename starts from the real name, an untouched Save sends nothing, and clearing works (#982)<br>⬜ E2 E4 E5 E6 R1 | ✅ E1 E3 (#693)<br>✅ the same rename fixes (#982)<br>⬜ E2 E4 E5 E6 R1 | ✅ E1 E3 (#690: inputs locked while saving; a failure keeps the draft)<br>✅ E4 (#858: entries gated by permission)<br>✅ E5 (#632: two tabs keep each other's edits; #745: a name cleared elsewhere)<br>✅ E6 (#626: invalid coordinates aren't saved; geocoder emulated)<br>✅ R1 (#694 malformed read; #745 read 503; both then Try again)<br>❓ E2 partial (#632, `0927 settings-retained-edits`: a committed reply held at the proxy recovers by reload; a truly lost reply on the open page and a retried Save are not recorded) |
| Privacy (D06) | ✅ E1 (#749: a 503 rolls back with an error)<br>✅ E3 (`0928 privacy-save-order`: two real extra taps during a held save are ignored, one unchanged row; not an accessibility-disabled assertion)<br>✅ E5 R1 (#638: Place shows the saved setting on return; an injected 503 shows an error)<br>⬜ no native Home visibility control; document pickers don't start from the Home default | ✅ E1 E3 (#749: extra taps while saving make no extra save)<br>✅ E5 R1 (#638)<br>⬜ the same native gaps | ✅ E4 (#803: an invite-only Home's link gives non-members 403; #865, #869, #874 map homes layer through the API)<br>✅ Default Visibility for New Items applies (#898)<br>✅ join policy hidden (#917 web, #971 native); the fridge card keeps working during Lockdown (#916)<br>✅ R1 Security & Privacy page: a failed read now says so with Retry (403: a permission sentence) instead of spinning forever ([#1064](https://github.com/WangPantopus/skinny-pantopus/pull/1064), merged in batch 220, `0930 web-settings-read-errors`, `9c25be46…`)<br>✅ reachability: the Settings tab's owner-only "Security & Privacy" row opens that page, the only web place for discoverability and the owner-claim policy ([#1065](https://github.com/WangPantopus/skinny-pantopus/pull/1065), merged in batch 220, `0930 web-settings-read-errors`, `9c25be46…`)<br>❓ E1 (code: a failed save keeps the saved choice and toasts; not run) |
| Members, permissions, security and Lockdown (D07) | ✅ E4 E5 (#781, #794)<br>✅ R1 malformed Access & Codes list (#701)<br>– Lockdown (web only)<br>✅ the Members audit list shows plain words (#972, `0930 d07-native-audit-labels`; the dashboard's recent-activity card is Stream 4's)<br>⬜ E1 E2 E3 (Android done 2026-10-01; iOS next)<br>⬜ lead: Change role offers "Owner", which the server always refuses (both apps)<br>✅ E4 a viewer the server refuses the member list (403): the invitation entry is gone (iOS "Invitation recovery"; Android Invite member / Add guest FAB), removal recovery stays; the owner and a transient 503 keep the entry ([#1162](https://github.com/WangPantopus/skinny-pantopus/pull/1162), `1001 members-refused`, `0c1f99b6…`; merged in batch 243) | ✅ E4 E5 (#781, #794)<br>✅ R1 malformed Access & Codes list (#701)<br>– Lockdown (web only)<br>✅ the Members audit list shows plain words (#972, `0930 d07-native-audit-labels`; the dashboard's recent-activity card is Stream 4's)<br>✅ E1 E2 E3 on Change role (`1001 d07-native`, `183967cb…`): a one-time 503 shows "Something went wrong… Please try again." and the role is unchanged, and a retry changes it once; a held reply with the app killed shows the committed role after relaunch; a double tap sends one POST<br>⬜ lead: Change role offers "Owner", which the server always refuses (both apps)<br>✅ E4 a viewer the server refuses the member list (403): the invitation entry is gone (iOS "Invitation recovery"; Android Invite member / Add guest FAB), removal recovery stays; the owner and a transient 503 keep the entry ([#1162](https://github.com/WangPantopus/skinny-pantopus/pull/1162), `1001 members-refused`, `0c1f99b6…`; merged in batch 243) | ✅ E1 (#757 mismatched Lockdown replies rejected; #825 "Finish revoking"; #881 "Record this change")<br>✅ E4 (#474, #816, #820, #835, #858)<br>✅ E5 (#881 two-tab race)<br>✅ E6 (#791: already a member or already invited)<br>✅ R1 (#644 security summary; #647 Lockdown summary; sweep r2)<br>✅ audit labels (#888)<br>✅ decisions 2 and 5 settled 2026-09-30 (least-privilege defaults; Lockdown leaves the Home private)<br>✅ E3 opener with [#1245](https://github.com/WangPantopus/skinny-pantopus/pull/1245): a double-click on a member row no longer closes the member panel it opened (`1001 slidepanel-dblclick`; merged in batch 267, master `361f07042`) |
| Guest passes (D08, M02) | ✅ E4 (#519: entry only for pass managers)<br>✅ E5 (#761: expiry while open)<br>✅ R1 malformed list (#701)<br>✅ scheduled start: a scheduled pass stays current, shows "Starts …" and is revocable (#999, `0930 d08-scheduled-start`)<br>⬜ copied link<br>✅ Allowed areas → the real "What they can see" sections (user-approved 09-26, `2c8908956`) | same as iOS | ✅ E4 (#519; #827 pass managers during Lockdown)<br>✅ E5 (#761: list and public page)<br>✅ R1 (#758 malformed Share list; #680)<br>✅ PR #53/#60 (a local dev server, synthetic auth): a stale reply keeps the new draft; "View Limit Reached" (re-checked 2026-10-01: that path is unchanged)<br>✅ re-run 2026-10-01 on the #915 header path (`1001 passcode-view`, `4df15692…`): three wrong passcodes → 403 `SHARE_PASSCODE_REQUIRED`, `view_count` unchanged; the right one → 200, one view <br>⬜ E1 a 5xx on the guest page (only a 400 `SHARE_INVALID` reason was run)<br>✅ passcodes (#915)<br>✅ scheduled start: Share Center "Scheduled · Starts …", guest page "Not Active Yet" (API `SHARE_NOT_STARTED` in `0930 d08-scheduled-start`)<br>⬜ copied link and public rendering<br>✅ E3 opener with [#1245](https://github.com/WangPantopus/skinny-pantopus/pull/1245): a double-click on "+ Custom Pass" no longer lets its second click pick the "Guest Pass" template (`1001 slidepanel-dblclick`, `e365c5b7…`; merged in batch 267: #1246 at 05:25:37Z, #1245 at 05:25:38Z, master `361f07042`) |
| Deleting a Home (D10) | ✅ E1 (503: recoverable error)<br>✅ E2 (deleted; the app terminated before the reply; the Home is gone after restart)<br>✅ E4 (403)<br>✅ E3: two taps on "Delete" 169 ms apart send one `DELETE`; the Home is gone (`1001 d10-native`, `db6ca600…`)<br>✅ E6: the confirmation is a popover anchored to the row; a tap outside it cancels, and no `DELETE` is sent (`1001 d10-native`) | ✅ E1 (503, then same-screen retry)<br>✅ E4<br>✅ E6 (Cancel sends nothing)<br>✅ E2: the `DELETE` committed, its reply was held 30 s and the app was killed before it; after the relaunch the Home is gone, with no stale row and no false error (`1001 d10-native`, `db6ca600…`)<br>✅ E3: two taps 158 ms apart send one `DELETE` | ✅ E1 E4 (503 keeps state; 403 after access is removed; restore and retry)<br>✅ E3 (a forced duplicate click sends one DELETE)<br>✅ E6 (cancel stages and invalid confirmation send nothing)<br>⛔ linked-resource cleanup (files, balances, Crew payments) |

All D10 cells come from 0927 home-delete-three-apps. Homes list and Home identity cases are tracked under U01.

**U04 lifetimes** — L1 background and return; L2 cold restart; L3 switch account; L4 session refresh.

| Area | iOS | Android | Web |
|---|---|---|---|
| Homes list, joining and waiting room | ✅ L2 My Homes after restart (home-delete-three-apps)<br>✅ L3: after the owner signs out, member B's Place and the owner's Home link show nothing of the owner's; the owner signs back in and sees the Home (`0930 u04-lifetimes`, `57e9a75b…`)<br>✅ L1: My Homes via the drawer, 20 s in the background, same process, listed before and after, no writes<br>✅ L4: a one-time expired-token 401 on `GET /api/homes/my-homes` → refresh 200 → the replay 200, listed (`1001 u04-native-r3`, `80f291e4…`) | ✅ L2 (same)<br>✅ L3: B's My homes shows "No saved Homes yet"; the owner's Home link shows "Home access unavailable"; the owner is restored (`0930 u04-lifetimes`, `57e9a75b…`)<br>✅ L1, L4: the same cases (`1001 u04-native-r3`, `80f291e4…`) | ✅ L1: hidden 20 s, the list reloads on return and shows the Home; nothing sent while hidden<br>✅ L2 reload: the Home is listed before and after<br>✅ L3: member B's My Homes says "No homes yet"; the owner signs back in and sees the Home<br>✅ L4: a one-time expired-token 401 on `GET /api/homes/my-homes` → `/api/users/refresh` 200 → the replay 200, the Home listed (`0930 u04-web`, `b51f8ac3…`) |
| Residency letters and passes | ✅ L2 (native-residency-pass: restart after a committed issue or revoke)<br>✅ L2 request-identity restart (`0930 r06-ios-restart`, `badb1a99…`)<br>✅ L1: Identity kept after 20 s in the background, same process (`0930 u04-lifetimes`, `57e9a75b…`)<br>✅ L3: member B opening the owner's Identity link sees "Something went wrong. You do not have access to this place." and nothing of the owner's (scan: 0 frames; `1001 u04-native-r3`, `80f291e4…`)<br>✅ L4: a one-time expired-token 401 on the letter issue → refresh 200 → the replay 201; one letter, still signed in (`1001 u04-native-r4`, `657befd0…`) | ✅ L2 (native-residency-pass; 0930 r06-request-identity)<br>✅ L1 (the same, `0930 u04-lifetimes`, `57e9a75b…`)<br>✅ L3: the same, with Try again (`1001 u04-native-r3`, `80f291e4…`)<br>✅ L4: a one-time expired-token 401 on the letter issue → refresh 200 → the replay 201; one letter, still signed in (`1001 u04-native-r4`, `657befd0…`) | ✅ L2 reload (#732, #735)<br>⛔ L3 checked through the API only (0930 r06-request-identity: another account never gets the same pass)<br>✅ L1: a residency letter's purpose stays on the letter screen after the page is hidden 20 s; no request while hidden or after<br>✅ L4: a one-time expired-token 401 on the letter issue → refresh 200 → the replay 201, one letter, still signed in (`1001 u04-web-r2`, `75e5c232…`) |
| Home settings and privacy | ✅ L2 (#693 cold restart; #749)<br>✅ L1: a rename draft survives 20 s in the background, same process, nothing saved<br>✅ L4: a one-time expired-token 401 on the rename PATCH is refreshed (`/api/users/refresh` 200) and replayed (200); the new name shows and the owner stays signed in<br>✅ L3: the owner's Home link as member B shows "Home access unavailable" (`0930 u04-lifetimes`, `57e9a75b…`) | ✅ L2 (#693; #749)<br>✅ L1, L4, L3 (the same cases, `0930 u04-lifetimes`, `57e9a75b…`) | ✅ L2 reload<br>✅ L1 with [#1118](https://github.com/WangPantopus/skinny-pantopus/pull/1118): a Home Name draft on the dashboard's Settings tab survives the tab being hidden 20 s and the access re-check; on master it came back as the saved name (`0930 u04-web`, `b51f8ac3…`; #1118 merged in batch 225, [#1120](https://github.com/WangPantopus/skinny-pantopus/pull/1120), 23:48:30Z)<br>✅ L4: a one-time expired-token 401 on the settings PATCH → refresh 200 → the replay 200; saved, still signed in<br>✅ L3: the owner's dashboard and Settings tab as member B say "You don't have permission to do that." |
| Members, security and guest passes | ✅ L2 (#761 guest list)<br>✅ L1: Members, and an Add guest name, kept after 20 s in the background; nothing created<br>✅ L3: the owner's Members link as member B says "You do not have permission to view these records." (`0930 u04-lifetimes`, `57e9a75b…`)<br>✅ L4: a one-time 401 on the guest-pass create (Home settings → Invite link → Add guest) → refresh 200 → the replay 201; one pass, still signed in (`1001 u04-native-r4`, `657befd0…`) | ✅ L2 (#761)<br>✅ L1, L3 (the same, `0930 u04-lifetimes`, `57e9a75b…`)<br>✅ L4: a one-time 401 on the guest-pass create (Home settings → Invite link → Add guest) → refresh 200 → the replay 201; one pass, still signed in (`1001 u04-native-r4`, `657befd0…`) | ✅ L2 reload (#761, #881)<br>✅ L3: the owner's Members page as member B says "You can’t see this household’s member list." (`0930 u04-web`, `b51f8ac3…`)<br>✅ L1 with [#1213](https://github.com/WangPantopus/skinny-pantopus/pull/1213): a guest pass being set up on the dashboard's Share tab survives 20 s hidden and the access re-check, and Create from it makes that pass; on master the panel and its fields were gone (merged in batch 259, 03:29:40Z, master `61d710fed`)<br>✅ L4: a one-time 401 on the guest-pass create → refresh 200 → the replay 201, one pass (`1001 u04-web-r2`, `75e5c232…`) |
| Deleting a Home | ✅ L2 restart: the Home is gone | ✅ L2 relaunch: the Home is gone | ✅ L2 landing after delete (S1 #652) |

**U02 accessibility** — A1 largest text; A2 dark mode; A3 contrast; A4 screen reader; A5 keyboard (web).

| Screen | iOS | Android | Web |
|---|---|---|---|
| Members & Security, Members, invitations, Lockdown, audit log | ✅ A1 A2 (Members, Pending, Requests, audit log; `0930 u02-native-a1a2`); the Requests row's whole name is [#1036](https://github.com/WangPantopus/skinny-pantopus/pull/1036)<br>⬜ A3 A4<br>✅ each Requests row's Invite/Decline are separate elements (#973)<br>✅ Members top bar: not reproduced; the driver's default backend flattens system navigation bars (`0930 u02-navbar-probe`) | ✅ A1 A2 (`0930 u02-native-a1a2`; #1036: the Requests name, chip and Decline at font 2.0)<br>⬜ A3 A4<br>✅ the top-bar title at font 2.0: "Members" in full, and the action becomes a named icon ([#1058](https://github.com/WangPantopus/skinny-pantopus/pull/1058), merged in batch 220, `0930 u04-lifetimes`, `57e9a75b…`) | ✅ A2 role accents (#822), links and danger actions (#809)<br>✅ names (#819; not a full screen-reader pass)<br>⬜ A1 A4 A5<br>🔷 A3 brand colour<br>✅ A3 member initials: 700 fills, measured in Chrome 2.15 → 5.02:1 (amber) and 4.23 → 7.10:1 (violet) ([#1070](https://github.com/WangPantopus/skinny-pantopus/pull/1070), merged in batch 220, `0930 web-settings-read-errors`, `9c25be46…`) |
| Residency review, verification pages, ownership (owners, claim, transfer, dispute) | ✅ A1 A2: Review claims, residency review, Owners, Transfer (`0930 u02-native-a1a2`; #1036: the Review claims links at xl, the Transfer Home name)<br>✅ A3 dark Approve 1.92:1 → 5.48:1 (#1029, Stream 1)<br>⬜ A1 A2 verification pages<br>⬜ A4<br>✅ the review sheet's Close/Reload: not reproduced, they are separate elements (`0930 u02-navbar-probe`) | ✅ A1 A2: the same screens (`0930 u02-native-a1a2`; the residency review is FLAG_SECURE, so it was checked through the accessibility tree; #1036: the Transfer Home name)<br>⬜ A1 A2 verification pages<br>⬜ A3 A4 | ✅ A2 evidence choices (#801), Strong tier (#822)<br>✅ names (#819)<br>⬜ A1 A4 A5<br>🔷 A3 |
| Settings, privacy mirror, Home editor, Delete home | ✅ A1 A2: Home settings, the rename editor, Privacy, Ownership & Security, My homes and Delete home (`0930 u02-native-a1a2`; #1036: the Homes-list unit label and wrapping chips)<br>⛔ Delete home: at xl the system dialog clips its message (Delete stays reachable)<br>⬜ privacy mirror<br>⬜ A3 A4 | ✅ A1 A2: the same screens (`0930 u02-native-a1a2`; #1036: Rename stays at font 2.0, the unit label, wrapping chips)<br>⬜ privacy mirror<br>⬜ A3 A4 | ✅ A2 editor Visibility (#807), Danger Zone and Leave Home (#809)<br>✅ names (#819)<br>⬜ A1 A4 A5<br>🔷 A3 |
| Share center, add guest | ✅ A1 A2: Guest passes and Add guest (`0930 u02-native-a1a2`)<br>⬜ A3 A4 | ✅ A1 A2 (`0930 u02-native-a1a2`; a pass label truncates at 2 lines at 2×, and the "Dog walker" part stays visible)<br>⬜ A3 A4 | ✅ A2 partial (#809)<br>✅ names (#819)<br>⬜ A1 A4 A5 |
| Residency letters and passes (Identity) | ✅ A1 A2 (`0930 u02-native-a1a2`)<br>⬜ A3 A4 | ✅ A1 A2 (`0930 u02-native-a1a2`)<br>⬜ A3 A4 | ✅ A2 "Generate a residency letter" (#809)<br>⬜ A1 A4 A5 |
| Not in any sweep: waiting room, `/messages`, invitation accept, Find a Home, `/guest/:token`, public verify pages, dashboard tab contents | ⬜ | ⬜ | ⬜ A1 A2 A3 A4 A5 |

The 390×844 no-overflow sweep (#819 bundle) is a narrow-layout check, not A1.

**U05** — not started; it waits for the launch flags on master (this stream's screen and action inventory for Stream 1's release manifest).

## Post-launch work (recorded 2026-09-30)

- **Member join policy, three levels.** The ownership plan defines open_invite / admin_approval / verified_only.
  - Only the unused `occupancyAttachService` implements them. Today every join goes through household review whatever the setting, so the control is hidden (#917, native next).
  - After launch: wire the policy into the live admission paths (residency submissions, invitations, join requests), prove each level on all three apps, then show the control again.
  - The `member_attach_policy` column and the API field are kept for this.
- **Membership renewal (R03, decided 2026-09-30).** A former member cannot rejoin the same Home today; every path refuses with `MEMBERSHIP_RENEWAL_REQUIRED` and says so.
  - After launch: design renewal with re-verification, reactivate the one occupancy row per (home, user) rather than adding rows, keep the removal history, and prove it on all three apps.
- **Restore previous visibility after Lockdown (D07, decided 2026-09-30).** Lockdown leaves the Home private.
  - After launch: store the pre-Lockdown visibility when Lockdown is enabled, and offer a one-tap "Restore previous visibility" once it's disabled. Never restore it automatically.
- **Per-Home notification routing** (from #962): the Settings tab says it isn't live yet. Wire the saved preferences into delivery, or remove the switches.
- **Tell invitees when a Home deletion or account purge withdraws their invitation (D10 lead, analyzed 2026-09-30).**
  - Today: `deleteHome` cascades pending `HomeInvite` rows, and `purge_home_household_records` deletes them (`status = 'pending'`). The invitee is told nothing; the invitation leaves their list and the emailed link reads as expired. #1008 and #974 cover only pending claims and requests.
  - An access request the owner approved (by inviting) stays `approved` after the purge. No requester screen shows request status (only the owner's review queue lists requests), so this has no user-visible effect. It only counts as "linked data" for the orphaned Home.
  - After launch: a notification type for a withdrawn invitation (backend types and the three clients' inbox mapping), sent to registered invitees from the same pre-read as #1008, and optionally closing such approved requests as `cancelled`.
  - Decided under the standing instruction: this is not a launch change, because it would add a notification type across three clients for a rare edge case with no stale actionable UI.

## Runtime, devices and kit (shared with Stream 4; lease label `stream3-home:`)

- **Kit:** `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/` ([README](/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/stream2-runtime-kit/README.md)). Tools are in `tools/`, stages in `runtime/`. The audit store is `/Users/yingpengwang/estimate-rescue/skinny-pantopus/pantopus-stream-2-home-3ef380/.pantopus-recovery/audits/`. Names containing `stream2` keep them.
- **Isolated runtime** (never production; restart recipe in the kit README and the history file's 2026-09-27 CURRENT RESUME §3):
  - DB 64554 (`supabase_db_pantopus-stream2-native-resume-r2`, Kong 64553);
  - fault proxy 18142 (rules via `POST /__s2fault/set|clear`);
  - backend 18143 (log restarts in `runtime/backend-restarts.log`);
  - web 18144, which hot-reloads the checked-out branch of `/Users/yingpengwang/estimate-rescue/skinny-pantopus/stream2-mail-journey-18b50a`.
- **Exclusive runtime lease** (new 2026-09-30; the two streams share one runtime):
  - Take it with `zsh tools/runtime-lease.sh acquire '<label>: <purpose>'` before creating or cleaning fixtures, setting fault rules, restarting the backend, switching that worktree's branch, taking a whole-DB baseline or driving the devices below.
  - Release it with `zsh tools/runtime-lease.sh release '<label>'`, and check the holder with `status`.
  - A baseline is valid only inside the lease it was taken in.
- **Code and the shared worktree:** write code in your own session worktree, on a branch from current master. Check your pushed branch out in the shared worktree above, or edit it, only while holding the runtime lease, and keep its uncommitted `.claude/launch.json`.
- **Labels:** `stream2:` and `claude/stream2-…` now belong to the new Stream 2 (Posts, Hub and payments). The kit's `stream2` path names are history only.
- **Devices,** only while holding the runtime lease:
  - **Missing since the 2026-09-30 cleanup (checked 2026-09-30T05:58:25Z):** the Android SDK, every AVD (including the one below) and `~/.gradle`, and every iOS simulator runtime; sim 6F914A30 is still listed but can't boot. Reinstalling them needs the user's OK;
  - emulator-5556 (AVD `Pantopus_Home_Recurrence_Acceptance`) and iOS sim 6F914A30, both through `/private/tmp/pantopus-tools/device-slot.sh`;
  - heavy builds through `/private/tmp/pantopus-tools/heavy-slot.sh`;
  - the shared iOS driver by announcing the take and the release to the other streams.
  - On 2026-09-30 the per-cell build copies and the iOS DerivedData were deleted to free disk, so the next native builds are full rebuilds.
- **Retained fixtures — deleted with the database by the Docker reset (2026-09-30T05:51:48Z).** Recreate only what a journey needs, from the bundle that first made it. They were:
  - Home105 "S2 First Load Home 2";
  - Home70 "Stream2 Resume Home" (owner + member B as a verified member);
  - cohort Home 9d885f71 with 9 neighbor homes (the F01 benchmark);
  - SQL Homes abe5a8c9 and d4eaed7e.
  - The fixture accounts' credentials are still in `runtime/accounts.env`, but the accounts must be recreated in the new database. Never print the file; type values with the kit's secret tools only.
- **State at the split:** Docker Desktop has been down since ~03:30Z on 2026-09-30 (disk full), so the runtime is unreachable until the user restarts it. No runtime lease, device slot, heavy slot or iOS driver is held.
- **Since 2026-09-30T05:51:48Z:** Docker Desktop is back but reset (empty), so the shared runtime must be rebuilt before any runtime work. The steps are in the resume prompt §2. Until then, proxy 18142, backend 18143 and web 18144 still run from before the reset, pointing at the deleted database.
- **Rebuilt 2026-09-30T06:11Z by Stream 3** (details in the kit README's "Rebuilt 2026-09-30" section):
  - stack workdir `stack-20260930/` inside the kit, from master `ed5ea9ec5` (93 migrations applied), same project id and ports (API 64553, DB 64554, Inbucket 64558; the rest inside 64550–64559);
  - new anon/service keys in `runtime/supabase.env` (the JWT secret, URL and DB URL are unchanged);
  - owner `bb1d5fae…` and member B `438f0bb1…` recreated with their original ids and credentials; private bucket `s2-home-documents` recreated; **no Home or other fixture exists yet**;
  - backend 18143 PID 13697, proxy 18142 PID 14166, web 18144 PID 14332 (the shared worktree is detached at `ed5ea9ec5`, `.claude/launch.json` kept), logged in `runtime/backend-restarts.log`;
  - the first baseline (353 public tables) belongs to the rebuild lease only.

## Rules carried over from the former Stream 2

- Read `AGENTS.md`, `docs/PROJECT_HANDOFF.md` and the hub [README](README.md) (the renumbering notice and the 2026-09-27 LAUNCH SCOPE block at the top).
- **Launch scope (2026-09-27):** never verify, test or fix the eight cut features. If a finding lands in a cut area, note it as cut and move on.
- **Verify before changing:** reproduce first, then make the smallest repair in the existing implementation. No new screens, schemas, migrations, services or replacement architectures, and no duplicate trackers. Preserve designs; propose any unavoidable design change.
- **Evidence protocol:**
  1. Write `DECISION.md` first, with its time from `date -u` (from the lease log).
  2. Take a whole-DB baseline with `tools/fp.py snap`.
  3. Capture befores and afters in the real apps.
  4. Run the exact cleanup: preimage digests, and every non-auth table equal to the baseline before COMMIT.
  5. Seal with `tools/seal-bundle.py`.
  6. Open a PR whose body ends with the Claude Code line.
  7. Hand the head and seal to the coordinator, then add an entry at the top of this file's live block.
- **Merge policy:** required CI is off. A PR merges once it's verified end to end in the real apps with sealed evidence and reviewed. The Stream 1 queue owner (the coordinator) batches and merges; send it head + seal.
- **Never:** the physical iPhone; the founder's environment (docker stack `pantopus-home-gig-replay` on 64521/64522, backend :8000, simulator EB5AD759); production providers; real user or payment data; credentials, tokens, raw logs or DB archives in Git or chat (never print `runtime/accounts.env`); destructive git (reset, stash, clean, gc, worktree removal).
- **Times and SHAs:** record every time from `date -u` and every SHA from `git rev-parse`. Never estimate them.

## Live continuation — Stream 3 (newest first)

- **2026-10-01T09:16:04Z — Window 07:58:52–08:55:26Z (lease, slots 3 and 1): native joining and D07 verified, three invitation-link defects found and fixed (fix building), and the Android review-dates fix sent ([#1295](https://github.com/WangPantopus/skinny-pantopus/pull/1295)).**
  - **Joining** (`20261001-stream3-home-joining-native-r1`, MANIFEST `dcdcc2b9e3dd6386f4ef0e87f299e7e1b66f58d8602bfe55cc2dc657e960087d`):
    - E1 passes on both apps: a one-time 503 → recover → Check (404) → Retry → one decision with the same request id.
    - E3 passes on Android, and on iOS when the opener is tapped once.
  - **Three defects, all fixed by `claude/stream3-invite-link-fixes` (`30e39e566`, 4 files; build running; after-runs next window):**
    1. Both apps: a malformed link shows a "Try again" that can never work, because the guest-pass lookup's 400 counted as transient.
    2. iOS: a double tap on "Accept invitation" leaves "Confirm acceptance" doing nothing (the opener replaced the presented `Confirmation`).
    3. iOS: a second link while an invitation is open is ignored. The fix is one line in the shared `RootTabView`.
  - **D07 role change on Android** (`20261001-stream3-home-d07-native-r1`, MANIFEST `183967cb67fedfdec20cf3d8f94539eb98ad67eee39053fa205255c2a35f6c77`): E1 (503 → error, then a retry changes the role once), E2 (held reply, app killed → the committed role after relaunch) and E3 (double tap → one POST) pass. iOS is next.
  - **[#1295](https://github.com/WangPantopus/skinny-pantopus/pull/1295)** (head `4f10b38670bd01b3c7bc36b0aa85b01d587eb55f`, Android 5 files): the removal review and result and the invitation decision show dates like iOS ("Oct 1, 2026, 1:40 AM" instead of raw ISO). Seal `20261001-stream3-home-android-review-dates-r1`, MANIFEST `af08138de30d76c6c3ae308902a7d24804d0c4462f85dca26403796d9bdbc424`. Sent to Stream 1.
  - **Leads:**
    - Change role offers "Owner", which `mutate_home_member` always refuses (403); both apps.
    - Stream 4's U04 finding (`20261001-stream4-u04-native-r1`, `b2427619…`, frames l3-member-00..03): the native Home dashboard tells a refused viewer "could not be confirmed" with "Reload access" after a 403. Mine, with #1162 as the precedent.
    - The iOS removal-opener double-tap probe wasn't completed: a row-menu tap hit the owner's row, and the self-removal was refused correctly with no write.
  - **Decisions (standing instruction):**
    - Treat a 400 from a token lookup as "not found" (a malformed token can never succeed; 429 and 5xx keep the retry).
    - Keep an open confirmation when its opener is tapped again.
    - Key the invitation cover by token.
    - Ship the Android dates fix with three of its four screens verified on a device (the sender review shares the helper).
  - **Process slips, each recorded:**
    - **A DB write after the lease:** I deleted B's stray MailPreferences row (created by my account switch at 08:31:20Z) at 08:56:50Z, after releasing the lease. Stream 4 had baselined at 08:56:43Z; it agreed the delete was right and amended its baseline. Rule kept: clean every stray row before release.
    - **Overlapping fixtures:** an iOS probe's fixture overlapped the Android removal stage; one exact combined cleanup at 08:52:57Z removed both.
    - **Load:** the load reached about 30–50 (other streams' iOS builds plus four devices). The emulator ANRed, so device work paused.
  - **Runtime:**
    - The shared worktree and backend ran on master `337c3cb9a` for the window and are restored to `00bf2d6ff` (PID 16136), with HEAD, status and launch.json equal.
    - No fault rules remain, and the token file is deleted.
    - Devices shut down at 08:55:04Z. iOS has Stream 4's cch build; Android has my `4f10b3867` APK.
  - **Next:**
    - the invite-link fixes' after-runs, then the PR;
    - iOS D07;
    - the Change role "Owner" lead;
    - the dashboard 403 copy;
    - U02 web A1/A4/A5 (plan `stream3-home-u02-web-r1`, 17 screens, the shared `a11ycap` pass).

- **2026-10-01T07:06:00Z — Window 05:46:58–06:54:39Z (lease and slots 1/3): three fixes sent and merged ([#1260](https://github.com/WangPantopus/skinny-pantopus/pull/1260) in batch 272; [#1269](https://github.com/WangPantopus/skinny-pantopus/pull/1269) and [#1271](https://github.com/WangPantopus/skinny-pantopus/pull/1271) in batch 276); native removal E1/E3 pass on both apps.**
  - **Batch 276 merged at 07:06:14Z ([#1272](https://github.com/WangPantopus/skinny-pantopus/pull/1272), master `dc878ddb5`).** Stream 1 reviewed both: End Lease's in-flight guard resets in `finally`, Cancel included, and #1271's files are unchanged on master since my build.
  - **[#1260](https://github.com/WangPantopus/skinny-pantopus/pull/1260)** (head `c11a9f054e9cd4a4f29a6e8fc30630f02d5870aa`, web 1 line; Stream 5's static-scan report): a `/app/homes/find` result went to `/app/homes/<id>/claim-owner`, a route with no page (404). It now opens `claim-owner/evidence`, as every other entry does.
    - Real Chrome: before → "404 · This page could not be found."; after → "Upload evidence", nothing sent.
    - `20261001-stream3-home-web-find-claim-link-r1`, MANIFEST `6a57088c3e740a847b1918dd07ada353f77559706fde1522c1fb5f3f871ec863`.
    - **Merged in batch 272** (06:39:07Z, master `da1e57588`).
  - **[#1269](https://github.com/WangPantopus/skinny-pantopus/pull/1269)** (head `4fca16df3b12f891931a59306337409028989e1b`, web `LeasesTab.tsx` + 1 existing test; Stream 1's landlord-portal finding): "End Lease" ended a lease on the first click. The end runs `decide_home_lease('end')`: B's access ends, residency letters are revoked and B is notified.
    - It now asks through the shared destructive confirmation, worded like UnitsTab's "Mark vacant" for the same API and naming the tenant.
    - Real Chrome after: Cancel → 0 requests; a double-click on "End lease" → 1 request, one end.
    - `20261001-stream3-home-web-end-lease-confirm-r1`, MANIFEST `dc8173856a47d195d06c82c27ce94383d81d02dde959b0b90184d7d76ad81592`.
  - **[#1271](https://github.com/WangPantopus/skinny-pantopus/pull/1271)** (head `86d4b0890c69351989faa16c997588d331a582fe`, iOS + Android, 4 lines): the landlord wizard says "1 field needs attention", and its banner calls an empty e-mail "Email". A malformed one is still "Email format".
    - After-runs on both devices with the fix's builds: 0 requests.
    - `20261001-stream3-home-landlord-copy-r1`, MANIFEST `401ece8c594702b755194bf60b1d905e21cf013d86e3f8470b68c12cc42e6eaa`.
  - **Native removal E1/E3, verification only** (`20261001-stream3-home-removal-native-r1`, MANIFEST `9d7f16cc51c0800aa14af4d664ea50b45ac759181ff446352926f2bbf156dcf3`):
    - E1 on each app: a one-time 503 keeps a recoverable saved original, and B stays a member. Check (a 404) keeps it; Retry removes B once with the same request id. The md5 of the path id Check read equals the DB row's.
    - E3: two taps 157 ms (iOS) or 170 ms (Android) apart send one command.
    - The removal row's native E1/E3 cells are now ✅.
  - **Decisions (standing instruction):**
    - End Lease shows "Ending..." only after the person confirms, and a ref stops a second prompt.
    - One existing test was updated to answer the confirmation, so it still reaches the failure it guards. No new test.
    - The staff "Remove" in `landlord/SettingsTab.tsx` needs no action: it is unreachable since #1051 (Stream 1 told).
  - **Candidates recorded, not fixed:**
    - Android's removal result shows a raw timestamp ("Original removal completed: 2026-10-01T06:16:07.089747+00:00"), while iOS formats it. This is for the next native copy batch.
    - "Check" after a 404 changes nothing visible on either app.
    - Ending a lease that hasn't started sets its end before its start ("Nov 1, 2026 – Oct 1, 2026"). That is a product and backend question.
  - **Slips, each recorded in its bundle:**
    - Android swipes with the keyboard open glide-typed into a field. It was repaired before Submit, and the driver now closes the keyboard before scrolling.
    - An iOS scroll target matched the banner's own text. That sub-run is void and was re-run.
    - The removal bundle's scan was piped through `tail` before sealing. It printed 0 hits, and a re-scan of the sealed dir exits 0.
  - **Runtime:**
    - The backend was on `00bf2d6ff`, PID 54400.
    - The web worktree was at master `7a42f1d7a` (05:47:30–05:56:21Z), then at `12013a711` (06:36:29–06:42:33Z). It is back on `00bf2d6ff`, with HEAD, status and launch.json equal.
    - Every fixture was cleaned exactly, and no fault rules remain.
    - Both devices were shut down at 06:54:35Z with my `86d4b0890` builds; Stream 4 asked me to leave them, since its own builds were deleted for disk space.
    - Lease released at 06:54:39Z; Stream 4 took it at 06:55:00Z.
  - **Next:**
    - native joining E1/E3/E6;
    - D07 native E1/E2/E3;
    - U02 native A3/A4 and web A1/A4/A5;
    - the Android raw-timestamp copy candidate;
    - R03/R04.

- **2026-10-01T05:24:08Z — Window 04:51:02–05:19:31Z (lease and slots 3/4): the SlidePanel fix verified and sent ([#1245](https://github.com/WangPantopus/skinny-pantopus/pull/1245)); native D10 E2/E3/E6, the lease impossible-date re-run and the residency-pass E3 pass on both apps.**
  - **Merged in batch 267 ([#1246](https://github.com/WangPantopus/skinny-pantopus/pull/1246), 05:25:37Z, master `361f07042`).**
  - **[#1245](https://github.com/WangPantopus/skinny-pantopus/pull/1245)** (head `7fb9eb7d0edcf3668c5dd7910690671fd5f5c0a4`, 1 web file, **cross-stream**: the shared `SlidePanel`, 11 callers).
    - On master, "+ Custom Pass" double-clicked picked the Guest Pass template, and a member-row double-click closed the member panel via its backdrop. Both second clicks are now ignored.
    - A regression run of the normal create flow still works.
    - `20261001-stream3-home-web-slidepanel-dblclick-r1`, MANIFEST `e365c5b703fd443868faa6949b031e278d169a40d9846f7cb284826834b69315`.
  - **D10 native, verification only** (`20261001-stream3-home-d10-native-r1`, MANIFEST `db6ca6007f846c036868aa579de0895bab0410e29f5ea1cfc5e425bb47dc4d61`):
    - iOS E3: two taps, one `DELETE`.
    - iOS E6: the confirmation is a popover; a tap outside cancels, and no `DELETE` is sent.
    - Android E3: two taps, one `DELETE`.
    - Android E2: the `DELETE` committed and its reply was held; the app was killed; after the relaunch the Home is gone.
    - The apps' deletes left every table equal to its baseline.
  - **Lease impossible date** (`20261001-stream3-home-lease-date-native-r1`, MANIFEST `a9d167613a43a223b05966d85cbbbd15c67be4de959f328659224477544e9581`): rejected locally on both apps, the fields kept, no request; correcting it clears the error. Two copy leads.
  - **Residency-pass E3** (`20261001-stream3-home-pass-e3-native-r1`, MANIFEST `2f3d6039d5305fbd7743cd084e159759a76678dbd48bb38c03c7618f14df6ca4`): a real double tap gives one claim on each app.
  - **Runtime:**
    - Builds were Stream 4's `1aa45c877`; my paths equal master.
    - The web worktree was at master `ea52073b9` from 04:51:30 to 04:57:58Z and is back on `00bf2d6ff`.
    - The backend is on `00bf2d6ff`, PID 16518. No fault rules.
    - Both devices are shut down. Claim codes are blacked out in 4 frames; two Android sign-in frames are withheld.
  - **Next:**
    - the native copy batch (landlord wizard "needs attention" and its "Email format" label);
    - native joining E1/E3/E6;
    - native removal E1/E3;
    - D07 native E1/E2/E3;
    - U02 native A3/A4 and web A1/A4/A5.

- **2026-10-01T04:29:07Z — Window 03:39:50–04:20:40Z (lease and slots 3/4): web E3s for residency letters and the landlord approval, native U04 L4 on both apps, and U01 closed. Two fixes sent ([#1231](https://github.com/WangPantopus/skinny-pantopus/pull/1231), [#1232](https://github.com/WangPantopus/skinny-pantopus/pull/1232)).**
  - **Both merged in batch 264 ([#1233](https://github.com/WangPantopus/skinny-pantopus/pull/1233), 04:32:34Z, master `51634ec30`). Stream 1 verified both seals and accepted the SlidePanel lead's approach: one small PR listing its callers.**
  - **[#1231](https://github.com/WangPantopus/skinny-pantopus/pull/1231)** (head `ef6aa5a2d512ee7c996364a99d6dbdc7e044ac04`, web 1 file): a double-click on "Issue verified letter" issued two letters on master (two POSTs 201, two codes, two PDFs); one with the fix.
    - Cause: React Query's `isPending` arrives via `setTimeout(0)`, and the route has no request id.
    - `20261001-stream3-home-web-e3-letters-r1`, MANIFEST `0fed46ac4fb665d8d8774f2f670a9ee85d345ef133bcf37aebec17838b43aa1d`.
  - **[#1232](https://github.com/WangPantopus/skinny-pantopus/pull/1232)** (head `03de1cda1292016534675bdd74b8722586193738`, web 1 file): on master, a double-click on a request row's Approve opened the lease-dates modal and its second click closed it via the backdrop. The modal now stays open.
    - "Approve Lease" itself gave one approval on master: the lease active once, one lease-resident occupancy.
    - `20261001-stream3-home-web-e3-landlord-r1`, MANIFEST `cb193bc51317db67647e3ed720795371ea4258e73d6dabe90b9f6b34b9954f35`.
  - **Native L4, verification only:** on both apps a guest-pass create and a letter issue under a one-time 401 → refresh 200 → the replay 201; one result each, still signed in.
    - The Android "Invite link" row is present, just below the fold; the 02:17Z note was wrong.
    - `20261001-stream3-home-u04-native-r4`, MANIFEST `657befd0e2b770ec6cddb708b2c8d65a35f315ef8d932c14aa3144230c4fb982`.
  - **U01 closed, no defect:** `20261001-stream3-home-u01-long-names-r1`, MANIFEST `a5e1065c6f4aabe03eabca972bbe8e0ba148a4c0d201c64a7cf006313a189280`.
    - The owner's name was set to 66 characters and restored exactly; the `User` digest equals the pre-change one.
    - Only the Members Audit Log rows show display names; they wrap or ellipsize cleanly on both apps at default and largest text.
  - **Checks for both fixes:** tsc shows only the known `qrcode`/`jsqr` errors; ESLint is the same as master; all 122 web Jest suites pass (2343 tests).
  - **Runtime:**
    - Builds were Stream 4's `1aa45c877` (my paths equal master `2015eecf1`).
    - The web worktree was at master `2015eecf1` from 03:41:34 to 03:53:21Z and is back on `00bf2d6ff`, with HEAD, status and launch.json hash equal. The backend is on `00bf2d6ff`, PID 74423.
    - Four fixtures (plus one `after/`), each cleaned exactly.
    - Both devices are shut down. Android `font_scale` is back to 1.0 and the iOS content size to "large".
  - **Evidence fixes before sealing:**
    - One web frame's sidebar showed the owner's e-mail (CSS-truncated) because the capture-time blackout raced a re-render. It is blacked out (`redaction-post.json`).
    - Letter codes in 10 native frames are blacked out (`tools/s3-redact-codes.py`).
    - Four Android sign-in frames are withheld.
  - **Leads:**
    - the shared `SlidePanel` lets a double-click's second click land inside the panel;
    - iOS Audit Log rows and tabs don't grow at AX5 (for U02's owner).
  - **Next:**
    - the native lease impossible-date re-run (iOS VerifyLandlord, Android Submit gating);
    - the native D07 E1/E2/E3, D10 iOS E3/E6 and Android E2/E3 cells;
    - U02: native A3/A4 and web A1/A4/A5.

- **2026-10-01T03:29:10Z — Web window (lease 03:04:17–03:24:21Z): two fixes sent to Stream 1 ([#1213](https://github.com/WangPantopus/skinny-pantopus/pull/1213), [#1214](https://github.com/WangPantopus/skinny-pantopus/pull/1214)); U04 web cells for guest passes and residency letters done; web joining E3 done.**
  - **Both merged in batch 259 ([#1215](https://github.com/WangPantopus/skinny-pantopus/pull/1215), 03:29:40Z, master `61d710fed`); Stream 1 verified both seals and accepted #1214 as a shared fix.**
  - **[#1213](https://github.com/WangPantopus/skinny-pantopus/pull/1213)** (head `a04caa24a1b700cc2bdcc3aae76c20520520d513`, web 3 files, #1118's pattern):
    - On master, a guest pass being set up on the dashboard's Share tab was lost when the page was hidden 20 s. The
      access re-check unmounts the tab.
    - It now comes back at the same step, and Create from it makes that pass (one POST 201).
    - `20261001-stream3-home-u04-web-r2`, MANIFEST `75e5c232635038e83252c90bbee091587b5f65146b77ac77c833ac0518d53922`.
    - The same bundle has guest-pass L4 and residency-letter L1/L4 passing on master.
  - **[#1214](https://github.com/WangPantopus/skinny-pantopus/pull/1214)** (head `3fe41e280b3ee8e85d8748277be113634588f25f`, web 1 file; **cross-stream**: the shared `ConfirmDialog`):
    - A double-click on "Accept invitation" opened the confirmation, and the second click (`detail` 2) hit its Cancel
      4 ms later, so nothing happened. Where Confirm sits under the opener, it would confirm unseen.
    - Clicks with `detail` > 1 are now ignored on Cancel, Confirm and the backdrop.
    - Before: `20261001-stream3-home-web-e3-join-r1`, MANIFEST `88952e7cb688e4e281658be5ecbe0b0d23544d3bcd500441a5a7b36380613ff9`. That bundle also shows the confirm step passes E3: one decision, one membership.
    - After: `20261001-stream3-home-web-confirm-dblclick-r1`, MANIFEST `188a22304e2e583635a77cfc70e105501bf67c630ed3d8299ef70a7a6149cad8`.
  - **Checks on both commits:**
    - tsc: only the known `qrcode`/`jsqr` errors.
    - ESLint: the same as master.
    - All 122 web Jest suites pass (2343 tests). The local install lacks `qrcode`/`jsqr`, so a scratchpad Jest config maps them to an existing copy.
  - **Runtime:**
    - The shared web worktree was at master `042e8ca99` for the window and is back on `00bf2d6ff`, with HEAD, status and launch.json hash equal. The backend is on `00bf2d6ff`, PID 47432, not restarted.
    - Three fixtures, each cleaned exactly (351/353 equal; the rest auth history).
    - The invitation tokens were kept only in a 0600 file and deleted.
    - Login limiter: at most 9 logins in any 15 min.
  - **Next:**
    - native L4 on a guest-pass create and on a residency letter (needs slots 3/4);
    - the native lease impossible-date re-run;
    - U01 long native activity identities (a temporary long display name, restored exactly);
    - web E3s for residency letters and landlord.

- **2026-10-01T02:34:19Z — Native U04: Homes list L1/L4 and Identity L3 pass on iOS and Android; #1176 and #1177 merged (batch 246).**
  - **Bundle:** `20261001-stream3-home-u04-native-r3`, MANIFEST `80f291e4ff6d1b69e02d2deae90a48a285ddf339f7804c0b71935170c6e5ac02`, 193 files. Lease and slots 3/4 02:05:40–02:31:55Z; exact cleanup at 02:31:47Z (349/353 equal, the rest auth history).
  - **Homes list:**
    - L1: same process before and after 20 s in the background, the Home listed, 2 GETs on return, no writes.
    - L4: a one-time 401 on `my-homes` → refresh 200 → the replay 200.
    - On iOS, My Homes is reached through the drawer with the new `tools/ios-s3-tapseq.py`; the generic step driver can't tap the Place header's Menu.
  - **Identity L3:** member B opening the owner's Identity link sees "You do not have access to this place." and nothing of the owner's.
  - **Not run:** the guest-pass write L4. The Android Home settings screen no longer has the "Invite link" row the 09-30 sequence used, so finding Add guest is the first step next time. The Members/guest-pass L4 cell stays ⬜.
  - **Handed** the lease and the S34 pair to Stream 4 for its launch-scope block-invite fix.

- **2026-10-01T02:05:21Z — API + web window (lease 01:48:21–02:02:02Z): two fixes sent ([#1176](https://github.com/WangPantopus/skinny-pantopus/pull/1176), [#1177](https://github.com/WangPantopus/skinny-pantopus/pull/1177); both merged in batch 246 at 02:06Z) and two verification bundles.**
  - **[#1176](https://github.com/WangPantopus/skinny-pantopus/pull/1176)** (head `f305b88be06f33e30261810c0ff66fafec16ae00`, backend 1 file): the postcard challenge-window notice to a Home's authorities said "Someone verified via mail code…", because `select('display_name, email')` failed on a missing column.
    - It now names the newcomer with `displayNameFromUser` and never selects the e-mail.
    - API before/after: "Someone" → "Stream2 Resume member", no "@". The postcard tests (12/12) and the privacy gates pass.
    - `20261001-stream3-home-postcard-notice-r1`, MANIFEST `7726f8b3697e3190f5b57f6a534a93908885877b345006c447c07526dabd66c8`.
  - **[#1177](https://github.com/WangPantopus/skinny-pantopus/pull/1177)** (head `4b82941e10778c21c194120a2a7f0b576215dc45`, web 4 files; U01 Home identity): the sidebar Home chip now shows a renamed Home's new name.
    - `ProfileToggle` re-reads the Homes list on a `pantopus:homes-changed` event, fired by the Settings tab, the editor and the standalone nickname.
    - Real Chrome: stale on master; updated after each of the three saves; no extra read without a name change.
    - `20261001-stream3-home-web-home-chip-r1`, MANIFEST `214d97f8cd95a7db3cf0adfddcad4ea37f463d2b55b4c095aab75fcc29981f83`.
  - **Verification (no code):**
    - `20261001-stream3-home-passcode-view-r1` (`4df15692…`): on the #915 header path, a wrong guest-pass passcode spends no view; that cell is now ✅.
    - `20261001-stream3-home-web-e3-r1` (`a33a582c…`): a web double-click on Confirm removal or Confirm leave gives one command and one result; the web removal E3 cell is now ✅.
  - **The E4 lead narrows:** a regular member with the least-privilege defaults gets "You can't see this household's member list." on web, and the same 403 on native. So #1162 already hides the invitation entry for them. Only members granted `members.view` without `members.manage` still see it.
  - **Runtime:** fixtures cleaned exactly per stage. The web worktree is back on `00bf2d6ff`; the backend is on `00bf2d6ff` (PID 2401).
    - The 02:01:21Z entry in `backend-restarts.log` wrongly said "reverted": a relative-path `git apply -R` had failed.
    - It is corrected at 02:01:49Z. The proxy shows 0 requests to the patched process.
  - **Next:** native U04 cells (Homes list L1/L4, B on the owner's Identity, a guest-pass create under a 401) when the lease and a device slot are free. Then the remaining web E3s (joining, residency letters, landlord) and the native lease impossible-date re-run.

- **2026-10-01T01:32:54Z — #1162 merged (batch 243, master `b6419009f`); 7 ☑️ cells re-checked against current source, 2 sub-claims now need re-runs.**
  - **Method:** a read-only research agent mapped each cited report to its source commit and files. I re-checked the removal, residency-review and iOS joining claims myself with `git log`/`git diff`, the SQL redefinitions included.
  - **Now ✅** (claimed path unchanged since the report): joining E2/E5 on all three clients; the web residency review E2; removal E2 on all three; the native lease 503 cases; web landlord E1/E2/E6; the web guest-pass stale draft and "View Limit Reached".
  - **Now ⬜ re-run:**
    - the native lease impossible date: iOS validation became local and strict, and Android's Submit gating changed;
    - the web wrong passcode not spending a view (#915 changed that path).
  - **Ready for my next lease** (code committed, not pushed):
    - the web Home-chip fix `4b82941e1` (`claude/stream3-home-web-home-chip`);
    - the postcard notice-name fix `f305b88be` (`claude/stream3-home-postcard-notice-name`; existing postcard tests 12/12 and the privacy gates pass);
    - the web E3 driver.

- **2026-10-01T01:25:28Z — Native Members E4 fixed in [#1162](https://github.com/WangPantopus/skinny-pantopus/pull/1162) (iOS + Android), sealed and sent to the coordinator; 7 schema-drift candidates triaged.**
  - **#1162** (head `1813e687ef9328caeeb8829ce91c1b8820439325`, 3 files):
    - For a viewer the server refuses the member list (403), Android no longer shows the Invite member / Add guest FAB, and iOS no longer shows "Invitation recovery".
    - Removal recovery stays. The owner's view and a transient 503 keep the entry.
    - Bundle `20261001-stream3-home-members-refused-r1`, MANIFEST `0c1f99b6b7804a0380d556e027cf6f8a1e6c21039f4dc7bfe19fbcb261d64919`, 336 files: before/after on both devices, proxy-confirmed 403s, exact cleanup at 01:19:41Z (349/353 equal, the rest auth history).
    - Builds: iOS `6e2c2e057` (the same iOS tree as the head); Android `1813e687e` (ktlint, detekt, `MembersListViewModelTest`, assembleDebug green). The first Android attempt failed detekt LargeClass, so the second commit compacts the FAB getter.
  - **Lease:** 00:19:49–00:34:35Z and 00:36:36–01:19:58Z. In between, Stream 4 ran its File-rows security repro; my first fixture was cleaned exactly before that.
  - **Schema-drift candidates** (from Stream 2's scan, routed by Stream 1):
    - `homeSecurityPolicy.js` `recalculateTier`: dead, no caller.
    - `landlordTenant.js` `HomeDispute` insert: the route has no client caller and disputes are out of launch scope; recorded, not changed.
    - **`homeOwnership.js:2066`:** live. A postcard verification that opens a challenge window notifies authorities as "Someone…" because the `User.display_name` select errors. The naive fix would show the member's e-mail; the planned fix uses name or username only (next lease).
  - **Void:** iOS My Homes L1. The step driver can't open the drawer's Menu from the Place header, so the cell stays ⬜.
  - **Next:** the web sidebar Home-chip fix (patch drafted), the postcard-notice name fix and web E3 (removal and leave), all in my next lease after Stream 4's window.

- **2026-09-30T23:43:49Z — Resumed (new session). The five handoff PRs merged in batch 220; the web U04 run found one defect, fixed in [#1118](https://github.com/WangPantopus/skinny-pantopus/pull/1118) and sent to the coordinator.**
  - **Merged:** #1058, #1064, #1065, #1067 and #1070 at 21:37:23Z in batch 220 ([#1098](https://github.com/WangPantopus/skinny-pantopus/pull/1098)); each merged head equals its sealed head. Their cells now say so.
  - **Web U04** (`20260930-stream3-home-u04-web-r1`, MANIFEST `b51f8ac35f90353e1b5ff6335ad4763a05fb620c95c0f233468892df5d368e75`, 82 files):
    - Lease 23:17:56–23:39:33Z. The shared web worktree ran master `a211e1f48` and is back on `00bf2d6ff` (HEAD, status and `launch.json` equal). Backend `00bf2d6ff` not restarted. Exact cleanup at 23:39:27Z: 351/353 equal, the rest auth history.
    - **Pass:** Homes list L1, L2 (reload), L3, L4; the Settings save L4; L3 on the owner's dashboard, Settings tab and Members page as member B.
    - **Fail on master:** L1 on the dashboard's Settings tab. The access re-check on return remounts the dashboard, and the tab re-read its settings over the typed draft ("S3 Lifetimes draft kept" came back as "S3 Lifetimes Home").
    - **#1118** (head `42a64edf895bd62ecaf268f95c89d71a3aa0990d`, 2 web files, #918's pattern): only the member's own changed fields are held above the re-check and put back over the fresh read (same member, Home and `home.edit`). After: the draft is kept; a second session's House Rules change made while hidden survives, and Save sends only the name; a tab switch still drops the draft; L4 unchanged.
  - **Lead (not fixed):** after a save, the web sidebar's Home chip keeps the name loaded at sign-in until a reload.
  - **Next:** §4 item 3, the native Members E4 lead. It needs builds (the heavy slot) and devices (slot 4 and the lease, shared with Stream 4).

- **2026-09-30T21:18Z — Session handed off (the user asked me to wrap up). Read "HANDOFF — Stream 3, evening of 2026-09-30" at the top.**
  - **Five PRs** sealed today and sent to the coordinator at 21:15Z:
    - #1058, seal `57e9a75b…`;
    - #1064, #1065 and #1070, seal `9c25be46…`;
    - #1067, seal `e28414b2…`.
  - **U04 L1, L3 and L4 pass on iOS and Android.**
  - **Runtime:** lease and slot 4 with Stream 4 since 21:10:43Z; no Stream 3 fixtures or fault rules left.

- **2026-09-30T19:22Z — #1051 merged (batch 211, master `ef2022ba5`, 19:18:22Z); two more fixes opened: [#1067](https://github.com/WangPantopus/skinny-pantopus/pull/1067) and [#1070](https://github.com/WangPantopus/skinny-pantopus/pull/1070).**
  - **#1067 (native, U03 R1 for residency letters and passes):**
    - The Identity screen's letters history and passes list showed only the error text after a failed read; recovery meant leaving and re-entering (`0928 residency-pass-read`).
    - Both lists, on iOS and Android, now offer Try again, the same control as the rate watch on that screen. Head `7d9a15105`; SwiftLint/SwiftFormat are clean.
    - Its Android lint and Paparazzi, both app builds and the device proof are next (the heavy slot is queued; bundle `20260930-stream3-home-residency-list-retry-r1`).
  - **#1070 (web, U02 A3 on Members):**
    - Stream 5's finding, routed by Stream 1: white initials on 500 fills measured 2.15–4.47:1.
    - The Home copies move to 700, 5.02–7.90:1, matching Stream 5's chat fix. Head `76d2236c0`.
    - The proof joins #1064 and #1065 in one real-Chrome bundle.
  - **Held by the coordinator until their seals:** #1058, #1064 with #1065, #1067 and #1070.

- **2026-09-30T19:11Z — every ❓ cell in the U03/U04 checklists now has a verified disposition; two web PRs opened from it ([#1064](https://github.com/WangPantopus/skinny-pantopus/pull/1064), [#1065](https://github.com/WangPantopus/skinny-pantopus/pull/1065)).**
  - **Method:** a read-only evidence map (audits store, `docs/home-*` reports, the recovery archive). I re-read every quoted line myself before changing a cell.
  - **A new marker, ☑️:** an older accepted report from 09-11…09-13, on candidate builds before sealed bundles existed. It's reused, not re-run, and counts toward closure only once its source is shown unchanged or the case is re-run.
  - **Now ✅:** the native transfer copy; iOS privacy E3 (extra taps during a held save are ignored).
  - **Now ☑️:** E2/E5 for joining on all three clients; E2 for removal on all three and for the web residency review; the web landlord E1/E2/E6 and the native tenant side; the old web guest-pass cases.
  - **Now ⬜** (no evidence exists):
    - native joining E1/E3/E6;
    - native departed-applicant E5;
    - removal E1/E3;
    - residency-pass in-place retry (native R1) and a real double tap;
    - D10 iOS E3 and Android E2/E3;
    - web L2 reload of the Homes list.
  - **Found while mapping (web, Privacy/D06):**
    - `/app/homes/:id/settings/security` spins forever when its read fails. The 09-29 sweep saw the empty page but filed it as "no read of its own". `/app/homes/:id/settings` shows "Unnamed" when its read fails. Both are fixed by #1064 (the Owners page's Retry/403 pattern).
    - That security page is the only web place for a Home's discoverability and owner-claim policy (both live on the backend), and nothing in the app links to it. #1065 adds an owner-only (`security.manage`) "Security & Privacy" row with Manage to the dashboard's Settings tab. It was decided under the standing instruction; iOS and Android already list these settings.
  - **Next:** both PRs get one real-Chrome before/after bundle (`20260930-stream3-home-web-settings-read-errors-r1`, DECISION.md written 19:03Z and 19:09Z) at the start of my next lease. Then the native U04/#1058 session.

- **2026-09-30T18:57Z — [#1051](https://github.com/WangPantopus/skinny-pantopus/pull/1051) sealed and handed to the coordinator: the landlord property page offers only its built tabs.**
  - **Bundle:** `20260930-stream3-home-landlord-unbuilt-tabs-r1`, MANIFEST `6df5bff9d867a692af3b07e65f1c17859cf545eb6649891e5cb08967b40fb58b`, 25 files.
  - **Lease:** 18:52:33–18:55:43Z, a short window that Stream 4 gave inside its sweep; its fixture was untouched. Real Chrome.
  - **The patch:** #1051's one-file patch was applied to the shared web worktree at 18:53:48Z and reverted at 18:55:03Z (blob back to master's `342c77c95…`).
  - **Before:** 5 tabs; `?tab=notices` and `?tab=settings` each gave 404s ×2 and console errors behind live-looking forms and false empty states ("No notices sent yet.", "No staff members added…").
  - **After:** 3 tabs; notices, settings and unknown links open Units; leases still opens Leases; no failed calls.
  - **Cleanup:** exact (4 rows; 351/353 equal the baseline, the rest auth history). Web only: the native apps don't call these routes.

- **2026-09-30T18:37Z — [#1036](https://github.com/WangPantopus/skinny-pantopus/pull/1036) merged (batch 208, master `746b640ce`); [#1058](https://github.com/WangPantopus/skinny-pantopus/pull/1058) opened for the Android top bar at 2×; [#1051](https://github.com/WangPantopus/skinny-pantopus/pull/1051) waits for its real-Chrome seal.**
  - **#1036:** merged 18:35:23Z in batch 208 (PR #1057). The coordinator verified seal `732b0e5d…`. The U02 cells citing #1036 are now on master.
  - **#1058:**
    - At font 1.3 and above, a labelled top-bar action in the shared Android list screen shows its icon, so the Members title no longer collapses to "…" at 2×. TalkBack still reads the action.
    - One file. Head `4bb90fa845f0ec0ae11a355d2bba2a126c4a3987`, on #1036's head.
    - ktlint, detekt, `verifyPaparazziDebug` and `assembleDebug` passed at 18:35:29Z.
    - The emulator before/after goes in `20260930-stream3-home-u04-lifetimes-r1`. The coordinator holds the merge until then.
  - **#1051 (landlord tabs):** the before/after runs first in the next lease; the coordinator merges it on the seal.
  - **Next lease** (Stream 4 holds it; planned in DECISION.md files written before the lease):
    - `stream3-home-landlord-unbuilt-tabs-r1`: web before/after for #1051.
    - `stream3-home-u04-lifetimes-r1`: U04 L1, L3 and L4 on iOS and Android, and the #1058 before/after.

- **2026-09-30T17:37Z — U03: the owner's residency review passes E1, E2, E3 and R1 on iOS and Android (no code change); the D10 approved-request lead moved to post-launch.**
  - **Bundle:** `20260930-stream3-home-u03-residency-review-r1`, MANIFEST `24e573216fc5dd0d2013d7f9efe6941d6faeefca40806548ad551213b666f669`, 153 files. Lease 17:15:17–17:35:51Z. Six own Homes with member B's real household claims; exact cleanup, 349/353 equal and the rest auth history.
  - **Per platform:**
    - R1 (read 503): an honest error and Reload.
    - E1 (decision 503): "not confirmed", then Retry approves it; 1 receipt.
    - E2 (reply held 45 s while the server commits): the client's own re-send, a relaunch and Retry total 4 POSTs, all mapped to 1 decision, 1 receipt and 1 notice. The sheet then shows "Original decision confirmed".
    - E3 (double tap): exactly 1 POST.
  - **[#1036](https://github.com/WangPantopus/skinny-pantopus/pull/1036):** CI almost all green (the Android suite is still running); mergeable.

- **2026-09-30T17:02Z — U02 native A1/A2 done on 19 screens; [#1036](https://github.com/WangPantopus/skinny-pantopus/pull/1036) with the coordinator; #1024 merged (batch 197).**
  - **Bundle:** `20260930-stream3-home-u02-native-a1a2-r1`, MANIFEST `732b0e5df0561d60ca1ae311511d20d7077e987e8e708ce14d8f5fff0f07fe10`, 1,084 files.
  - **#1036:** head `0a4aaa553`, rebased onto master `1e1b6bacc` after #1029.
    - The Requests row shows the whole name (iOS six lines; Android had lost the name entirely at 2×).
    - The Transfer header shows the whole Home name.
    - Review claims links stop growing at iOS xxxLarge.
    - Homes list: one unit label on all three clients, and status chips that wrap.
    - Android Home settings keeps Rename at 2×.
    - Android shared row: from font scale 1.3 the inline chip stacks, VerticalActions grows, and `RowModel.wrapChips` exists.
  - **Checks:**
    - Android: 5,024 tests plus Paparazzi verify, ktlint and detekt.
    - iOS: 125 tests, SwiftLint and SwiftFormat.
    - Web: Jest 1,951.
  - **A2:**
    - iOS dark: all 19 screens readable.
    - Android keeps its light scheme under system dark mode (#1013).
    - The dark Approve (1.92:1) was fixed by Stream 1's #1029 (5.48:1). Stream 1 has the dark green FABs.
  - **Decided:** keep iOS's fixed-size type ramp (Decisions 6).
  - **Boundaries:**
    - Android FLAG_SECURE screens (Access codes, residency review) were checked through the accessibility tree.
    - At iOS xl the system dialog, a placeholder and a title truncate.
  - **Still open in U02:**
    - verification pages and the privacy mirror (A1/A2);
    - A3/A4 on native;
    - the Android Members top-bar title "…" at 2×.
  - **Security probe for Stream 5** (read-only): the Home RPC helpers are caller-bound. Passing another user's id returns false.
  - **Runtime:** lease used 14:18:53–15:14:15Z and 15:35:42–16:58:55Z. Exact cleanup at 16:58:49Z: 349/353 tables equal the baseline, and the other 4 are auth history.

- **2026-09-30T15:25Z — U02 native A1/A2: the iOS pass is done, and four display fixes are built. Master's red iOS SwiftLint is fixed in [#1024](https://github.com/WangPantopus/skinny-pantopus/pull/1024).**
  - **Setup:** stage `runtime/stream3-home-u02-native-a1a2-r1` (not sealed yet). DECISION.md was written at 14:18Z and the baseline taken at 14:19:10Z.
    - Fixture Home `d5a1aae2…` "S3 U02 Hawthorne Garden House", set up through the real API: B's join request and household claim, an invitation, 2 access codes, an active and a scheduled pass, and the owner's pass and letter.
  - **iOS on S34, app `c8498a3d3`:** 19 Stream 3 screens in three modes: base, largest accessibility text (xl) and dark.
    - The app's own text uses fixed sizes (`Theme.Font` = `Font.system(size:)`), so only system-styled text grows. Following the user's 09-29 decision for Posts ("keep the current layout"), A1 checks clipping and reachability; the type ramp is not converted (Decisions).
  - **Findings, all reproduced:**
    - the Requests row cut the requester's name at default size ("Stream2 Resume me…");
    - Transfer ownership cut the Home name to one line (Android clips it with no ellipsis);
    - at xl, Review claims' three recovery links cut their own labels ("Residency decisions and r…");
    - the Homes list read "Unit Unit S3U02" (all three clients add "Unit " before address2, so "Apt 4B" would read "Unit Apt 4B"), and iOS status chips cut "Ownership verified" to "Ownership ver…".
  - **Branch `claude/stream3-home-u02-full-names`** (not pushed yet; heads `e94bd8815`, `45d21d287`, `c49aefccb`, `5d6047490`):
    - the Requests row shows the whole name;
    - the whole Home name shows on Transfer;
    - Review claims' links stop growing at the largest standard size;
    - one unit label and wrapping status chips.
  - **Checks so far:**
    - Android `e94bd8815`: MembersListViewModelTest 48/48, the Transfer tests, ktlint, detekt and Paparazzi verify.
    - iOS `45d21d287`: 93 tests, 0 failures. The after captures show the full name, the wrapped Home name and readable links.
    - Web: tsc, ESLint, and Jest 1,951/1,951.
    - `c49aefccb` (a six-line limit, so the role chip isn't squeezed) and `5d6047490` wait for the next heavy slot and the Android pass.
  - **A2 (dark), iOS:** all 19 screens are readable.
  - **A3, sent to Stream 1 (token owner):** the dark-mode Approve button (`success` fill with `appTextInverse` text) is 1.92:1; light mode is 5.48:1.
  - **System-rendering boundaries at xl:**
    - the Delete home confirmation clips its message;
    - the add-guest email placeholder truncates;
    - the residency sheet's title truncates.
  - **[#1024](https://github.com/WangPantopus/skinny-pantopus/pull/1024):** master's iOS SwiftLint job was red on #970's AddHomeWizard complexity and #999's guest-pass chain, found by Stream 5. It's a lint-only refactor with no behavior change, and it's with the coordinator.
  - **Runtime:** lease, slot 4 and S34 lent to Stream 4 at 15:14:15Z. My fixture stays in place and Stream 4 excludes it.
  - **Next:** heavy slot → iOS/Android builds → Android base/xl/dark pass on pantopus_s34 → after-fix captures → exact cleanup → seal → PR.

- **2026-09-30T14:03Z — the five open Stream 3 decisions are settled; #999 merged (batch 188).**
  - **Decided under the standing instruction:**
    - R03: an ended membership stays final for launch; renewal is post-launch.
    - D07/D06: least-privilege member defaults stay.
    - R04: launch without disputes (the flag defaults to off; a hosted check makes sure production doesn't turn it on).
    - D07: Lockdown leaves the Home private; restoring is post-launch and one-tap.
  - **Already decided by the user on 09-26:** "Allowed areas" became the real "What they can see" sections (`2c8908956`).
  - Rationale and post-launch items are in the Decisions section and under "Post-launch work".
  - **Every Stream 3 PR is merged:** #970–#974, #982, #983, #999 and #1008.

- **2026-09-30T14:01Z — #1008 merged (batch 191, master `dc388a8ac`); U02's two recorded VoiceOver gaps closed as not reproduced.**
  - **Bundle:** `20260930-stream3-home-u02-navbar-probe-r1` (`85e9b466…`), no code change.
  - **Method:** on "Pantopus S34", the same screens were read with the kit driver's two backends.
    - The default `ax` backend shows a system navigation bar as one childless `Group`. That is where "one merged group" came from.
    - The `axbridge` backend shows the real tree:
      - **Members:** `NavigationBar` with Back (`BackButton`), the title, and "Review residency claims" (`listOfRowsTopBarAction`);
      - **residency review sheet:** `NavigationBar` with Close (`homeResidencyReview.close`), the title, and "Reload current access" (`homeResidencyReview.reload`).
  - **Result:** each control is its own accessibility element.
  - **Tooling:** read screens that have a system navigation bar with `"backend":"axbridge"`.
  - **Cleanup:** exact at 14:00:39Z. Lease released; no slot held.

- **2026-09-30T13:53Z — D10 lead fixed: [#1008](https://github.com/WangPantopus/skinny-pantopus/pull/1008), applicants hear when their Home is deleted.**
  - **Change:** `deleteHome` (the owner's Delete Home and #974's `deleted` outcome) reads other people's pending residency claims and access requests before deleting. Afterwards it sends the existing decline notice types, "This home was removed from Pantopus, so your … request was closed." A failure never blocks the deletion.
  - **Evidence:** head `2c85a128f`, bundle `20260930-stream3-home-d10-deleted-home-notice-r1` (`dd6e07d3…`).
    - master: the Home is deleted and the applicant gets 0 notices;
    - branch: 2 notices;
    - the purge-path notices are unchanged (#974 r2).
  - **Checks:** 53 suites / 916 tests; exact cleanup with 353/353 tables equal.
  - **The other D10 lead:** an approved request whose pending invite the purge deleted. Analyzed 2026-09-30 and moved to Post-launch work: it has no user-visible stale state, and invitees aren't told.

- **2026-09-30T13:42Z — U01: three of its four items now closed on current builds, with no code change.**
  - **Personal residency cards: closed.** Bundle `20260930-stream3-home-u01-residency-cards-r1` (`d67413b1…`); exact cleanup at 13:40:47Z.
    - Member B filed two requests through the real API, at "208 Synthetic Card Street, Unit A" and "… Unit B" (both `household_review`).
    - All three clients show two distinct cards, each titled with B's own submitted address and unit, with "Request pending" and a status action: web Chrome at 390×844, iOS S34 (`c8498a3d3`), and Android (`6e6a577f3`, whose My Homes code equals master).
  - **Narrow-screen chat-button overlap: closed for web** (`e36c0888…`, recorded above).
  - **Verified member's separate unverified-property label: closed.**
    - Web: fixed by #927.
    - Native (code check): the Home settings chip comes from the viewer's own `ownership_status` / `residency_status` (`homeDetailService.js:138`), so a verified member sees "Verified". No native card reads the unset `home.verified`.
  - **Left open: long native activity identities.** A real test needs account names long enough to truncate. The runtime has two shared fixture accounts, and I won't rename accounts other streams use.
  - Lease held 13:30:39–13:40:54Z, then returned to Stream 4. No device slot held.

- **2026-09-30T13:29Z — #974, #982 and #983 merged; D08 scheduled passes is PR #999; U01's web chat-button overlap closed.**
  - **Merged:**
    - [#974](https://github.com/WangPantopus/skinny-pantopus/pull/974) in batch 182 (inside #976 with #968, PR #986, 13:03:26Z);
    - [#982](https://github.com/WangPantopus/skinny-pantopus/pull/982) (D05 native rename) and [#983](https://github.com/WangPantopus/skinny-pantopus/pull/983) (Homes list failure logging) in batch 184 (PR #991, master `0c95b18ca`).
  - **[#983](https://github.com/WangPantopus/skinny-pantopus/pull/983)** (open item 10), `c15462283`, bundle `20260930-stream3-home-list-failure-logging-r1` (`649294ca…`).
    - Before: `homeListService` logged nothing on failure. An unreachable DB and a TypeError bug both gave the same 503 with 0 log lines.
    - After: one line per failed request, carrying the cause.
    - **Cross-cutting lead, taken by Stream 1:** `redactLogMeta` redacts every key named `code`, so no error code reaches any log.
  - **[#999](https://github.com/WangPantopus/skinny-pantopus/pull/999), D08 scheduled start,** `6e6a577f3`, bundle `20260930-stream3-home-d08-scheduled-start-r1` (`03967b56…`).
    - **Before, on both apps:** a pass the API lists as `scheduled` (starts later; created with the weekend or custom preset) went under Past as "Expired", with no Revoke. The web already kept it current.
    - **After:** it is current, shows "Starts <date>", and stays revocable. Revoke was proven on iOS and Android with real API writes. `reissue_required` passes now show "Needs new link".
    - Passes were created through the real API; the guest link before its start is 403 `SHARE_NOT_STARTED`.
    - Exact cleanup at 13:27:13Z.
  - **U01 web chat-button overlap: closed with no code change,** bundle `20260930-stream3-home-u01-fab-overlap-r2` (`e36c0888…`).
    - Real Chrome at 375×548 (iPhone SE Safari) and 390×664. These heights make even a two-member Home's pages scroll, which is the case a "long member list" creates.
    - At the end of the Home page, `/members`, `/access` and `/settings`, no control or meaningful text stays covered. The `/members` end-of-scroll row icons come free with a small scroll.
    - **Decided under the standing instruction:** no app-wide padding change.
  - **Self-corrections, recorded:**
    - I first sealed D08 with a hand-typed base SHA. Before anyone saw it, I deleted my own copy and resealed with `git rev-parse` values.
    - Two live-entry headers had carried a later minute than `date -u` (fixed earlier).
  - **Runtime:** lease released at 13:27:20Z (Stream 4 has it). No device or heavy slot held.
  - **Next:**
    - U01: the residency cards recheck and the long native activity identities;
    - the local parts of R04/R05/H07/H08;
    - the two D10 leads.

- **2026-09-30T12:54Z — #974 final for the decision-9 trio; D05 native rename is PR #982; lease released.**
  - **[#974](https://github.com/WangPantopus/skinny-pantopus/pull/974), final head `28f92e4e0`,** r2 bundle `20260930-stream3-home-d10-retire-home-r2`, MANIFEST `348bc8e6…`. The coordinator batches it with #968 and #976 after Stream 5's rerun.
    - **One keeper rule, shared with #968's guard** (`home_effective_access`). The legacy `owner_id`-only Home went from 'purged' (r1) to 'kept'. An unverified occupant is not a keeper.
    - **After 'purged':** pending household-review claims and access requests are rejected with the reviewers' own notice types, and occupancies are kept. A retry is idempotent.
    - **Through the real API:** once the owner leaves, the applicant re-submits and gets 201 `external_postcard` / `address_verification`.
    - **Proof caveat:** #968's purge was stubbed, because it isn't on the runtime.
    - **Checks:** backend Home, account and users unit suites 47/859; privacy and select gates OK; exact cleanup at 12:45:30Z.
  - **[#982](https://github.com/WangPantopus/skinny-pantopus/pull/982), D05 native rename,** `9c132e20c`, bundle `20260930-stream3-home-d05-native-clear-name-r1`, MANIFEST `8ec5a132…`.
    - **Before, on both apps:** the field held the address; an untouched Save stored the address as the name (PATCH 9616 / 9812); clearing was refused.
    - **After:** the field starts empty; an untouched Save sends nothing; setting a name works (9962 / 10140); clearing stores null (10003 / 10183).
    - **Tests:** Android 15/15, ktlint/detekt clean; iOS 9/9.
    - **Cleanup:** exact at 12:52:04Z.
  - **Runtime:**
    - lease released at 12:52:17Z (Stream 4 took it at 12:52:23Z);
    - backend and shared worktree back on `00bf2d6ff`; no proxy rules;
    - device slot released (emulator down at 12:52:21Z).
  - **Leads from D10:**
    - an approved access request whose pending invite the purge deleted stays 'approved';
    - 'deleted' Homes, like the owner's own Delete Home, send applicants no notice.
  - **Next, from the open list:** U01 (the chat-button overlap with a long member list; long native activity identities), D08 scheduled start, the local parts of R04/R05/H07/H08, the `homeListService.checked()` logging gap, and the two D10 leads.

- **2026-09-30T12:31Z — #970–#973 merged (batch 180); #962 merged (batch 177); R06 iOS done; #974 being revised for the decision-9 trio; D05 native rename reproduced on both apps.**
  - **Merged in batch 180** ([#975](https://github.com/WangPantopus/skinny-pantopus/pull/975), master `81cf2e959`). Each was sealed, with the iOS unit tests run under the heavy slot on "Pantopus S34" (11:53:34–12:08:30Z):
    - [#970](https://github.com/WangPantopus/skinny-pantopus/pull/970): D06 add-home address checks, `46cd0b548`, MANIFEST `a36aa59a…`. iOS AddHomeWizard 24/24 and DTODecoding 14/14. Three iOS sign-in screenshots were redacted before sealing, because they showed the fixture email.
    - [#971](https://github.com/WangPantopus/skinny-pantopus/pull/971): join-policy native, `edab09b8e`, `3dfdb0ae…`. iOS HomeOwnershipSecurity 6/6 and HomeSettings 9/9.
    - [#972](https://github.com/WangPantopus/skinny-pantopus/pull/972): native audit labels, `f372b8810`, `2f30a389…`. iOS MembersList 44/44 and DTODecoding 14/14.
    - [#973](https://github.com/WangPantopus/skinny-pantopus/pull/973): iOS row inline buttons with VoiceOver, `aeb8ce319`, `2bb5f2fc…`. ListOfRowsRender 27/27 and ListOfRowsViewModel 5/5.
    - Shared device fixture: `20260930-stream3-home-native-session-r1` (`81502e40…`), with exact cleanup at 11:36:48Z.
  - **Earlier today, not yet recorded here:**
    - [#962](https://github.com/WangPantopus/skinny-pantopus/pull/962) (Settings dead switches) merged in batch 177 (master `ea4d9bd40`).
    - **R06 iOS restart** is sealed as `20260930-stream3-home-r06-ios-restart-r1` (`badb1a99…`), with no code change. The proxy held the pass-issue reply and the app was killed. After a cold restart there was one committed pass, one request and no resend. This was the last local R06 item. Named boundaries: device clock, full-day expiry, hosted issuer.
  - **[#974](https://github.com/WangPantopus/skinny-pantopus/pull/974) (decision 9, `retireHomeForDeletedAccount`)**
    - **r1:** `5d4a6cce6`, `20260930-stream3-home-d10-retire-home-r1`, MANIFEST `9e9764b3…`.
    - **Stream 5's route E2E** (`20260930-stream5-retire-homes-r1`, `a9b574bf…`): deleted, kept, purged and 503 all behave as designed through the real `DELETE /api/users/account`.
    - **The coordinator is holding the trio (#968, #974, #976)** for a revision: one "who keeps a Home" rule shared with #968's guard (the legacy `owner_id` owner was missed), and closing pending standing after a purge. The decisions are above; the r2 stage is `runtime/stream3-home-d10-retire-home-r2`.
    - **Stream 4's rolled-back proofs** ran in my lease window at 11:53:51Z, 12:01:27Z, 12:05:51Z and 12:25:58Z. None changed any data.
  - **D05 native rename** (`9c132e20c`, bundle stage `runtime/stream3-home-d05-native-clear-name-r1`, fixture Home with no name). Before, on master-equivalent builds (`f372b8810`):
    - on both apps, the rename field opens with the street address;
    - an untouched Save sent a PATCH (iOS 9616, Android 9812) that stored the address as the Home's name;
    - clearing the field gives "Enter a name for this home." and sends no request.

    After-builds are under the heavy slot since 12:24:09Z. Android HomeSettingsViewModelTest passes 15/15, and ktlint/detekt are clean.
  - **Runtime:**
    - lease held since 11:32:27Z;
    - device slot 4 is now `pantopus_s34` (swapped from S34 at 12:20:00Z);
    - backend on master `00bf2d6ff`; no proxy rules.

- **2026-09-30T11:23Z — native session done on both apps; four PRs wait only on iOS unit tests and my last cleanup.**
  - **D06 add-home address checks (`46cd0b548`)**, native round (own fixture, cleaned 11:19:22Z). Address validation was EMULATED by fault-proxy rule `s3-validate` using the real route's body from the in-process harness; `check-address` was real.
    - iOS master (`edab09b8e` build, backend `c399b2fe6`): member B got "This address has an existing Home — Confirm your address and relationship to request household access."
    - iOS fix: "This address has a private Home on Pantopus. Ask someone in that household to send you an invitation." (Continue disabled).
    - Android: the same before (backend `00bf2d6ff`) and after.
    - Android `AddHomeWizardViewModelTest` 22/22.
  - **Audit labels (`f372b8810`):**
    - iOS before: "Home access secret create/delete". After: "Access code added/deleted", the API's own descriptions.
    - Android: the same before and after. `MembersListViewModelTest` 48/48.
  - **Row VoiceOver (`aeb8ce319`):**
    - Requests row, before: one Button `rowVerticalAction_Invite-rowVerticalAction_Decline`. After: row text, "Invite" and "Decline" as separate elements. Decline still works (stored `rejected`).
    - Access codes rows also split, into text, "Copy …" and "More actions for …".
  - **Join-policy iOS round (`edab09b8e`):** Ownership & Security shows Privacy & Discoverability and Owner claims only; the Home settings subtitle reads "Discoverability and owner claims".
  - **#943 on devices:** iOS and Android Access codes list a Wi-Fi code whose `created_by` is NULL.
  - **Runtime:**
    - applied master's `20260930134000`, `140000` and `151000` with `--include-all` (schema-only): ledger 103;
    - backend on master `00bf2d6ff` (PID 74306);
    - lease with Stream 4 since 11:21:15Z for their launch-critical reads.
    - Cleanup order agreed: their fixture first, then my native-session fixture.
    - A stray MailPreferences row from my member-B Android session, which blocked their cleanup, was deleted by exact scope at their request (11:22:50Z).
  - **Next:**
    - iOS unit tests under the heavy slot (queued third);
    - after Stream 4's cleanup: my native-session cleanup, then seal and open the PRs (address check, audit labels, row VoiceOver, join-policy native), plus the Settings dead-switch Chrome proof and its PR.

- **2026-09-30T10:53Z — #945 and #943 merged; native session half done; runtime lent to Stream 4.**
  - **Merged:**
    - [#945](https://github.com/WangPantopus/skinny-pantopus/pull/945) in batch 170 (master `c2f8fa5c9`);
    - [#943](https://github.com/WangPantopus/skinny-pantopus/pull/943) in batch 171 (master `1f6743f6b`), after renumbering its migration to `20260930141000` at the coordinator's request (head `8715ffab8`, re-sealed as `20260930-stream3-home-access-secret-creator-r2`, MANIFEST `2ba32887…`). The runtime ledger row and stack file were renamed to match; nothing was re-applied.
  - **Native session on "Pantopus S34"** (shared fixture `runtime/stream3-home-native-session-r1`; the join request needed a verified HomeOwner row, added as `join-request.json`):
    - iOS builds `edab09b8e`, `aeb8ce319` and `f372b8810` are done and point at `127.0.0.1:18142`; `46cd0b548` is building.
    - Join-policy hide (`edab09b8e`): Home settings shows "Ownership & Security, Discoverability and owner claims"; Ownership & Security shows only Privacy & Discoverability and Owner claims.
    - Requests row: before (`edab09b8e`), one Button `rowVerticalAction_Invite-rowVerticalAction_Decline` (the recorded gap reproduced). After (`aeb8ce319`), three elements: the row text button, then "Invite" and "Decline". Touch: the row body is a no-op in both (`onTap` defaults to `{}`); Decline opens its confirmation, and confirming stored `rejected` (10:48:51Z).
    - Audit log before (`edab09b8e`): "Home access secret create/delete", while the API sends "Access code added/deleted". The after capture is pending.
    - #943 on iOS: Access codes lists the Wi-Fi whose `created_by` is NULL.
    - Members top bar (recorded U02 gap): the driver reports the standard SwiftUI navigation bar as one childless group. Back and the toolbar action are standard bar items, so this may be a driver artifact. It needs a real VoiceOver or XCUITest check before any change.
  - **Runtime lease** given to Stream 4 at 10:49:16Z for launch-critical account deletion (their 15 Home columns). My fixture stays; they exclude it from their scopes.
  - **Prepared, not yet proven** (needs the lease): branch `claude/stream3-home-d07-settings-dead-switches` (`3dd16d9a7`). The standalone Home Settings page's five Notifications switches render with no height (nonexistent Tailwind sizes) and save nothing. Removed; decided under the standing instruction (DECISION in stage `runtime/stream3-home-d07-settings-dead-switches-r1`). tsc, Jest (1,893) and lint are unchanged.
  - **U01 floating chat button at 390×844,** owner, short household: nothing is covered on the dashboard, Members & Security, `/members` or `/access`. On `/settings` the button only overlaps the empty right end of the "Danger Zone" heading row. A long member list is still to check.

- **2026-09-30T10:33Z — #943 and #945 with the coordinator; D06 address-check leak reproduced and repaired (native checks pending); runtime maintenance.** Runtime lease held since 10:12:28Z.
  - **[#943](https://github.com/WangPantopus/skinny-pantopus/pull/943)** (Stream 1's launch-critical assignment; found by Stream 5): saving an access code blocked deleting your account, because `HomeAccessSecret.created_by` was NOT NULL with a plain foreign key.
    - Fix: migration `20260930131000`, nullable with ON DELETE SET NULL. No reader change: the SQL checks fail closed or use IS DISTINCT FROM, and no client shows the creator.
    - `account_deletion_dry_run` for member B, who saved a door code through the real API: before, 23503 FK (empty lists) and 23502 NOT NULL (route lists); after, `ok:true` for both.
    - With a NULL creator, the API list and an owner edit return 200 and real Chrome lists the code.
    - Bundle `20260930-stream3-home-access-secret-creator-r1` (`0524caaf…`), head `31231a837`.
  - **[#945](https://github.com/WangPantopus/skinny-pantopus/pull/945):** web Access & Codes grouped by a `category` field the API never sends, so all 7 code types sat under "Other".
    - Fix: group by `access_type` into the page's own groups.
    - Real Chrome before/after. Bundle `20260930-stream3-home-d07-access-code-groups-r1` (`e2c963e0…`), head `afed61737`.
  - **D06 add-home address checks, reproduced on master, stage `runtime/stream3-home-d06-address-check-privacy-r1`, not sealed yet:**
    - `POST /check-address` gave member B, who has no occupancy, an "Invite only" Home's id, full address and claimed status.
    - `POST /api/v1/address/validate` gave B `existing_household {home_id, member_count 1, active_roles [owner]}` for any Home with a household. This was run through the real route and DB with Google and Smarty EMULATED in-process.
    - Web master took B straight to "Claim this home" for the hidden Home.
    - After `46cd0b548`:
      - B gets `HOME_FOUND_PRIVATE` with only `status` and `is_multi_unit`;
      - the Normal Home's answer and the owner's answer for their own invite-only Home are unchanged;
      - the validator verdict keeps `CONFLICT`/`EXISTING_HOUSEHOLD` without `existing_household`;
      - web shows the private-Home message and stays on step 1.
    - Exact cleanup.
    - The iOS and Android wizard changes join the native device session. The PR opens after that.
  - **Runtime:**
    - Applied master's `20260930093000`, `101500` and `110000`, then `131000` (#943), with `supabase migration up`; ledger 99.
    - Backend back on master `c399b2fe6` (PID 2547 since 10:27:35Z), shared worktree detached there, its `.claude/launch.json` kept.
    - Incident: running the repo's pgTAP contract `home-access-secret-transactions` against the shared runtime segfaulted one Postgres backend (signal 11) at 10:20:46Z. Postgres recovered by 10:20:47.849Z and the fingerprints show no data change. Don't run SQL contracts against the shared runtime; CI replays them on a fresh database.
  - **Next:** once the heavy slot is mine (first in queue), one native session on S34 and pantopus_s34:
    - builds: iOS for `edab09b8e`, `aeb8ce319`, `f372b8810` and `46cd0b548`; Android for `f372b8810` and `46cd0b548`;
    - device checks: the join-policy hide, Requests-row VoiceOver, audit labels, the add-home private message, and Access & Codes with a NULL creator.

- **2026-09-30T09:53Z — #927 merged; two more native fixes committed locally; check-address decided.**
  - **#927:** merged in batch 164 ([#929](https://github.com/WangPantopus/skinny-pantopus/pull/929), master `acd904c66`).
  - **Committed locally, waiting on the heavy slot for iOS builds and on the lease for device checks:**
    - `aeb8ce319`, iOS: list rows with inline buttons keep those buttons as their own VoiceOver elements. The row's text is one button element. This fixes the recorded Requests-row gap: Invite/Decline were merged into one element with the row.
    - `f372b8810`, iOS + Android: the Members audit log uses the server's `description` (the web's wording, e.g. "Access code deleted") instead of words derived from the action code.
    - Both apps' Home dashboard recent-activity card is Stream 4's.
  - **Review sheet toolbar:** the other recorded iOS gap (Close/Reload merged) uses standard SwiftUI toolbar items. It may be how the driver reads navigation bars rather than VoiceOver, so I'll reproduce it before changing anything.
  - **Plan:** one iOS session on "Pantopus S34" with one shared fixture (`tools/s3-native-session.py`):
    - the join-policy build doubles as the "before" for the two other fixes, since it touches neither rows nor audit labels;
    - after that, each fix's own build.
  - **check-address:** decided (see D06 leads above).

- **2026-09-30T09:44Z — #914, #915, #916, #917 and #920 merged; [#927](https://github.com/WangPantopus/skinny-pantopus/pull/927) (U01 verification card) is with the coordinator; native join-policy hide half done.**
  - **Merged:** batch 162 ([#921](https://github.com/WangPantopus/skinny-pantopus/pull/921), master `fd7de8790`, 09:22:51Z). The shared runtime moved to `fd7de8790` at 09:41:00Z (backend PID 52324, logged). Coordinator notes:
    - #915's per-link lock can be triggered by anyone who already holds the link. Accepted, since the link is the secret.
    - #915 needs the backend deployed before or with the web.
    - #914 doesn't recurse into non-string path/url values. Fix it only if the file is touched again.
  - **#927:** the U01 "separate unverified-property label".
    - The card now reads "Ownership verification" from `GET /owners` and is hidden without `ownership.view`; the Security Center heading shows only when a card applies.
    - Real Chrome: the owner of a Home with a verified owner saw "Not verified" before and "Verified" after; member B saw a lone "Not verified" card before and no section after.
    - Head `9917e8f7b`, bundle `20260930-stream3-home-u01-verification-card-r1`, `2255f5f4…`; exact cleanup, 351/353.
  - **Native Member Join Policy hide:** branch `claude/stream3-home-d06-hide-join-policy-native`, `f7cb1e32a` + `edab09b8e`, not pushed yet.
    - The second commit drops "member policy" from the Home settings row subtitle on both apps; it read "Discoverability, owner claims, member policy".
    - **Android done:** installed on `pantopus_s34` (hash matches the build, APK bound to the runtime). Ownership & Security shows two groups, and Home settings reads "Discoverability and owner claims". View-model tests pass (6/6 and 15/15), with ktlint and detekt clean.
    - The Android fixture is cleaned exactly (349/353; the other four are the app's sign-in and device rows).
    - **iOS:** build, unit test and "Pantopus S34" check wait for the heavy slot and Stream 4's device run.
  - **My mistake, corrected:** I switched branches in my worktree during the first Android build, so that run was stopped and redone from a clean tree. It's recorded in the bundle.
  - **Lease:** held 09:27:07–09:43:53Z, then released to Stream 4.

- **2026-09-30T09:16Z — [#920](https://github.com/WangPantopus/skinny-pantopus/pull/920) (role label) is with the coordinator; native join-policy hide building; a new U01 finding.**
  - **#920:** from Stream 4's lead. The web dashboard header showed "Service_provider" and "Lease_resident" (raw `role_base` with CSS `capitalize`); it now shows the Members page's names.
    - Head `24e503fe2`, bundle `20260930-stream3-home-role-label-r1`, `fbc4d49c…`.
    - Proof: real Chrome as member B before and after; exact cleanup, 351/353. Lease 09:06:56–09:12:12Z, released early for Stream 4's iOS run.
  - **Native Member Join Policy hide:**
    - committed locally as `f7cb1e32a` (both view models and their existing tests);
    - the Android unit test, ktlint, detekt and debug build are running under the heavy slot, with the iOS build next;
    - device checks on "Pantopus S34" and `pantopus_s34` follow when Stream 4 returns the lease;
    - before: the sealed 2026-09-23 Android capture plus master's own unit tests.
  - **U01 finding (to reproduce and repair next):** the web Security Center's "Verification" card reads `home.verified`, but no Home column or API payload sets that field. So it says "Not verified" on every Home, even owner-verified ones, and it's the only Security Center card an ordinary verified member sees. That matches U01's "verified-member screen's separate unverified-property label".
  - **Two other U01 notes:**
    - the web residency request cards were already repaired on 2026-09-11 ("three distinct request cards"); recheck before any change;
    - floating chat overlap: check whether the last member row's badge can scroll clear of "Open messages panel" at 390 px.
  - **D06 native document pickers:** starting from the Home default needs the Home settings and the user's own access on both apps. Neither app has those endpoints, so this stays a recorded native gap.

- **2026-09-30T09:00Z — #898 merged and on the runtime; D08 measured; four more PRs with the coordinator; U02–U04 itemized.**
  - **#898:** merged in batch 156 (master `b7eb7a7eb`). `20260930080000` was applied to the shared runtime at 08:27:22Z (ledger 95, logged).
  - **D08 measurement** (`20260930-stream3-home-d08-passcode-measure-r1`, 17 files, `2f0a911c…`, no code change):
    - wrong passcodes were never counted or locked; only 60/min per IP applied;
    - the passcode travelled as `?passcode=`;
    - the backend log held the live guest-pass token on every view (103/103), and the invitation and share paths did the same.
  - **With the coordinator** (one lease, 08:50:09–08:57:50Z; befores on master `88149d747`, afters per candidate, real API and Chrome; exact shared cleanup 351/353):
    - [#914](https://github.com/WangPantopus/skinny-pantopus/pull/914) bearer-link tokens redacted from logs on every known path (`74ba94955`, `d8978eab…`);
    - [#915](https://github.com/WangPantopus/skinny-pantopus/pull/915) passcode guard (`0283969bf`, `2553126c…`);
    - [#916](https://github.com/WangPantopus/skinny-pantopus/pull/916) Lockdown panel fridge-card wording (`579ce1f5d`, `d8cf9fb5…`);
    - [#917](https://github.com/WangPantopus/skinny-pantopus/pull/917) Member Join Policy hidden on web (`a6ec78426`, `8c65ee69…`).
  - **User decisions and mine** under the standing instruction are recorded in CURRENT RESUME → "Decided 2026-09-30".
  - **U02–U04:** itemized (section "Stream 3 exit checklists"). Every ✅ was re-checked against its bundle, and one map claim was corrected (native has a landlord wizard).
  - **Next:** the native join-policy hide on iOS and Android (toolchains ready), then U01 on web and the recorded native accessibility gaps.

- **2026-09-30T08:17Z — D06 default visibility: [#898](https://github.com/WangPantopus/skinny-pantopus/pull/898) is with the coordinator.** Head `38c4d48c5e744cce43aa7821a89f5fd7fbe09e33`, base master `66d57bcfe`. Bundle `20260930-stream3-home-d06-default-visibility-fix-r1`, 35 files, MANIFEST `c998dcda3309ab1cab87ba5df4d0d28a676ea2c5ade6c4c99dc804ceca823e50`.
  - **Rule (the coordinator's option (a)):** a new task or document that names no visibility takes a Managers or Sensitive Home default in full when its creator can see that level. Otherwise it gets the most restrictive level the creator (and a task's assignee and viewers) can see. An explicit visibility wins; any other default keeps `members`, so it only narrows.
  - **Fix:**
    - tasks: migration `20260930080000`, a rename plus thin wrapper like `20260910180000`, reading the default under the existing Home lock;
    - documents: the upload route.
  - **Before, on master (lease 08:00:35Z):** every case stored `members`, and member B saw it.
  - **After, with the migration test-applied:**
    - owner → managers/sensitive (hidden from B);
    - member creator → members;
    - manager creator → managers;
    - Sensitive default with a manager creator → managers;
    - the receipt path and mail-to-task store managers, and their retries replay the same task;
    - updates don't move visibility.
  - **Real web:** the Add Task form sends no visibility, the task is stored managers, and B's Tasks page doesn't list it.
  - **Function safety:** the wrapper keeps SECURITY DEFINER, the pinned config and service-role-only EXECUTE; the renamed original is owner-only; check-migrations passes against master.
  - **Not run:** iOS and Android (no toolchains).
  - **Cleanup:**
    - the test migration was reverted, byte-identical;
    - the documents were deleted through the real route, and storage is back to 0;
    - exact SQL cleanup (105 rows), 351/353 tables equal the baseline.
    - Lease released at 08:15:28Z; the runtime is on master `66d57bcfe` (PID 82416).
  - **Cross-cutting lead, sent to the coordinator:** the global write limiter runs before auth, so it always keys by IP at 30 writes/min. A household behind one IP shares that limit (`backend/app.js:320`).

- **2026-09-30T07:45Z — #888 merged; D06 default-visibility gap reproduced and sent to the coordinator.**
  - **#888:** merged in batch 152 ([#891](https://github.com/WangPantopus/skinny-pantopus/pull/891), tip `c26803349`, 07:42:55Z; master `919305835`). Stream 1 diff-proved the table moved byte-identical.
  - **D06 (lease 07:42:27Z; bundle `20260930-stream3-home-d06-default-visibility-r1`, 10 files, MANIFEST `f6fbbe7fdbedb14f8c9e1db4718be65ddb958e220a2eaf72bc9631f6377d2940`, no code change):**
    - the owner saved "Default Visibility for New Items" = Managers through the real API, and it reads back;
    - a task created without a visibility (as every web form sends it) was stored `members`, and member B saw it.
    - Options (honor / remove / relabel) are with the coordinator. My recommendation is to honor it for tasks and documents.
  - **Cleanup:** exact (6 rows, 351/353). Lease released at 07:43:40Z.
  - **Next queued:** the member join policy's effect, then guest-pass passcode handling (D06/D08).

- **2026-09-30T07:39Z — #881 merged; its migration is on the runtime; [#888](https://github.com/WangPantopus/skinny-pantopus/pull/888) is with the coordinator.**
  - **#881:** merged in batch 150 ([#886](https://github.com/WangPantopus/skinny-pantopus/pull/886), tip `c97e29070`, 07:34:27Z); master is now `81bfda802`. Stream 1 verified the seal (66 files) and check-migrations.
  - **Runtime:** from 07:35:39Z (when the runtime returned to master `b06b9f3e5`) to 07:37:21Z, the runtime's master code called a function its DB lacked. I applied `20260930070000_home_lockdown_command.sql` (master blob `1b64492bf`) with `supabase migration up --workdir <kit>/stack-20260930 --local`: the ledger has 94 rows, and the function is SECURITY DEFINER with anon denied.
  - **#888 (D07 audit labels):** head `6d161a2b255e93fc8ef006c18a087fc17f829269`, base `3bf2cde34`, merge-tree clean against `81bfda802`. Bundle `20260930-stream3-home-d07-audit-labels-r1`, 23 files, MANIFEST `49382c3a2f04bfa3a07f940f4c154b527ed6ede1980a6ee90ef52270ecec514d`.
    - Before: real owner API actions showed "HOME ACCESS SECRET DELETE on HomeAccessSecret" on the Security tab and bare `HOME_ACCESS_SECRET_DELETE` on the Members tab.
    - After: "Stream2 Resume owner · Access code deleted".
    - Stream 4's label table moved verbatim into `utils/homeActivityLabels.js` with Stream 4's agreement; `/timeline` was re-checked.
    - Cleanup exact (11 rows, 351/353). Lease released at 07:37:36Z.

- **2026-09-30T07:29Z — D07 Lockdown commands: [#881](https://github.com/WangPantopus/skinny-pantopus/pull/881) is with the coordinator; #874 merged** (batch 147, master `b16eca646`; the map-privacy thread is closed).
  - **#881:** head `0d890e830b7881b44f355ba9ce589f3a7baa0559`, base `b16eca646`; merge-tree clean and `check-migrations` passing against master `3bf2cde34`. Bundle `20260930-stream3-home-d07-lockdown-commands-r1`, 66 files, MANIFEST `3a239f36d134b115d0dc1482d57ee97ff4214d9230454760cee218999f1c6075`.
  - **Reproduced on master (lease 07:17:49Z; test-only hooks on one fixture Home: a 6 s revoke sleep, and a refused Lockdown audit insert):**
    - a disable racing an enable (two real Chrome tabs, and the real API) left the Home off with the audit log ending "lockdown enabled"; the enable reply said on 4 s after it was turned off;
    - with the audit refused, Enable answered 200 while the panel marked "Records Lockdown changes · Active", and Disable unlocked the Home. Nothing was recorded or logged (`writeAuditLog` ignores the returned `{ error }`).
  - **Fix:** a forward migration adds `set_home_lockdown` (SECURITY DEFINER, service role only; justified in the bundle). Each command is one transaction under the Home's share lock.
    - Enable stays on and reports a failed revoke or audit (new 503 `LOCKDOWN_AUDIT_FAILED`).
    - Disable changes nothing unless it's recorded.
    - The panel offers "Record this change".
  - **After:**
    - races: the disable waits for the enable's lock, and the audit reads enabled → disabled, matching off;
    - refused audit on enable: 503, Lockdown stays on, and the retry records it;
    - refused audit on disable: 503, nothing changed.
  - **Checks:** backend 130/130; web `tsc`/ESLint clean; Jest 1866/1866.
  - **Cleanup:** exact (22 rows, 351/353); the hooks and the test-applied function were dropped. Lease released at 07:27:33Z; the runtime is on master `44405970` (PID 50231).

- **2026-09-30T07:17Z — [#874](https://github.com/WangPantopus/skinny-pantopus/pull/874) is with the coordinator** (map homes layer, second follow-up). Head `8979e15f47b16c8be683006efe36b5533332bc01`, base `f82d24a18`, merge-tree clean. Bundle `20260930-stream3-home-d06-map-trusted-occupancy-r1`, 22 files, MANIFEST `d84f3a0da80ec9fb4d4cb3ef256e54498d4c9f1c9f4558d054c6a55510465fed`.
  - **Reproduced (lease 07:14:05Z):** member B's real `POST /api/homes/:id/claim` on a private invite-only fixture Home answered 201 and left B an `is_active: true`, `pending_approval` occupancy. With EWKB decoding EMULATED, master's real handler then gave B that Home's full street and exact coordinates.
  - **Fix:** the household comes from the shared, fail-closed `getAccessibleHomeIds` (verified, provisional, provisional_bootstrap); the owner path stays.
  - **After:** B keeps only the Home where B is a verified member, and the owner is unchanged. The real API is unchanged (empty), with no error lines.
  - **Cleanup:** exact (9 run rows, 351/353). Lease released at 07:16:09Z; the runtime is back on master `f82d24a18` (PID 43567).

- **2026-09-30T07:10Z — #869 merged** (batch 146, [#870](https://github.com/WangPantopus/skinny-pantopus/pull/870), tip `fc0df0942`, 07:05:25Z; master `f82d24a18`; Stream 1 verified the seal, 21 files). The coordinator found one more latent gap in the same block: "actively occupies" meant `is_active`, which includes pending claims (`pending_approval`/`pending_postcard` rows are written active, and `POST /api/homes/:id/claim` lets any signed-in caller file one on any Home). Fix written on `claude/stream3-home-d06-map-trusted-occupancy` (the block uses the shared, fail-closed `getAccessibleHomeIds`); reproduction through a real claim waits for the runtime lease (Stream 4 holds it). D07 follows.

- **2026-09-30T07:05Z — #865 merged; follow-up [#869](https://github.com/WangPantopus/skinny-pantopus/pull/869) is with the coordinator.**
  - **#865:** merged in batch 144 ([#866](https://github.com/WangPantopus/skinny-pantopus/pull/866), tip `ac927ea82`, 07:00:24Z; master `81c414506`). Stream 1 verified the seal (23 files) with an exact-hunk batch proof; the post suites pass 77/77.
  - **Follow-up:** the coordinator asked to blur non-member coordinates. The repo's `docs/location-privacy-matrix.md` is stricter: no Home coordinates to non-household viewers, and "Home pins are only visible to household members", naming `/api/posts/map`. The coordinator agreed to members only.
  - **#869:** head `1c6e9747dfae72c083515b8fcad56d73d5b4860b`, base `81c414506`, merge-tree clean against `759a67943`. Bundle `20260930-stream3-home-d06-map-members-only-r1`, 21 files, MANIFEST `141e5fbd2ddad486957a168b61e56d0970b6fd22cff5023816da213bb4b2a62e`.
    - The layer selects only Homes the viewer owns or actively occupies.
    - Harness (real handler, real DB, EWKB decoding EMULATED): on master, B got the discoverable fixture at exact coordinates; on the head, B gets none, and the owner still gets both own Homes.
    - Real API: 200 with no Home before and after, and no query error.
    - Cleanup exact (4 rows, 351/353). Lease released at 07:04:01Z; the runtime is back on master `81c414506` (PID 38786).
  - **Next:** D07, the Lockdown race and the failed audit write. Its draft is a local WIP only and hasn't been reproduced.

- **2026-09-30T06:58Z — D06 Explore map homes layer: [#865](https://github.com/WangPantopus/skinny-pantopus/pull/865) is with the coordinator** (coordinator-assigned, done ahead of D07). Head `5ef4c2ac9d4410bff3861813ce5e901ee5a5e6a3`, base `68f2daa24`; `git merge-tree` clean against master `eff3f69f5`. Sealed bundle `20260930-stream3-home-d06-map-homes-privacy-r1`, 23 files, MANIFEST `3835ac272eaa4d5c97cccaee0ec24af57a43dcc6fc57a69797e38e1e2c289d95`.
  - **Found by a read-only D06 code inventory:** `GET /api/posts/map?layers=homes`, which the iOS and Android Explore maps request, selects every Home with a location and returns its street and exact coordinates. It checks no visibility, mask, status or membership.
  - **Reproduced (lease 06:51:00Z, two SQL fixture Homes: private + invite-only, and public preview):**
    - real API as non-member B and as the owner: 200 with no Home for anyone, because PostgREST returns `location` as EWKB hex, which the route's parser can't read. The exposure is **latent**;
    - the real handler on the real DB with EWKB decoding EMULATED: B would get the private invite-only Home's full street and exact coordinates.
  - **Fix (the coordinator's one-time grant, homes block only, +19/−3):** the `/discover` rule. The viewer's own Homes, plus `public_preview` + `normal` + `active` Homes with `redactStreet` for non-members. The parser is unchanged.
  - **After:**
    - the harness shows B no longer selects the private Home, and sees "Synthetic Preview Lane"; the owner still sees both in full;
    - the real API is unchanged (empty), with no query error logged.
  - **Also confirmed LIVE through the real API:** `GET /api/mailbox/compose/recipients?homeId=<private Home>` gave non-member B the owner's id, username, name and street. The coordinator routed it to Stream 4 (Stream 4's 629ce8909: fix in progress).
  - **Cleanup:** exact (4 rows; 351/353, login history only). The lease was released at 06:56:05Z, and the runtime is back on master (backend PID 33664).
  - **Leads:** Explore's homes layer draws nothing even for the viewer's own Homes (the EWKB parser); a drawn discoverable Home would still get an exact pin. The other inventory leads are listed under open work item 4.

- **2026-09-30T06:47Z — #858 merged** (batch 141, [#859](https://github.com/WangPantopus/skinny-pantopus/pull/859), tip `8fe0c52d4`, merged 06:44:42Z; #858 MERGED at head `309fbb850` 06:44:43Z; master `8af54a57a`). Stream 1 verified the seal (49 files, integrity OK) and the batch (5 files, blob-equal). D07's three web leads are closed; its row gains the evidence below. Next: D07's racing Lockdown commands and failed audit write (waiting for the runtime lease, which Stream 4 holds since 06:41:19Z).

- **2026-09-30T06:45Z — D07 web leads: [#858](https://github.com/WangPantopus/skinny-pantopus/pull/858) is with the coordinator.** Head `309fbb850b63e0da45c9ff8172b91a24091809b1`, base `ed5ea9ec5`. `git merge-tree` is clean against master `c063bb868`, which touches none of its files. Sealed bundle `20260930-stream3-home-d07-web-leads-r1`, 49 files, MANIFEST `7be1dd8e93f3ad6f5f177584c270480ff9d22d14e600490d15e6d29e8dacbc63`.
  - **Reproduced on master in real Chrome** (own SQL fixture Home: owner, member B as a verified `member`, one metadata-only document):
    - (a) during Lockdown the owner's dashboard document "Create share link" answered 403 `SHARE_DENIED` with the guest-facing "This share link is no longer available to you.";
    - (b) member B opening `/invitations` by URL got the full form, a "could not be loaded… Retry" list error, and after Review a generic "could not continue… Acknowledge the result" (both reads 403 `MEMBERS_MANAGE_REQUIRED`);
    - (c) the URL-only `/settings` page offered B Members & Roles and Access & Codes, which open only refusals.
  - **Fix:**
    - (a) backend: a scoped-link create refused in Lockdown answers `HOME_LOCKDOWN_ACTIVE` "Share links are off while Lockdown is on…" to holders of `home.edit`; others keep `SHARE_DENIED`;
    - (b) web: the list's `MEMBERS_MANAGE_REQUIRED` replaces the form and list with "You don’t have permission to send or manage invitations for this household." (a refused Review says the same; recovery still shows);
    - (c) web: each Settings entry needs its read's permission, and there's no empty Manage box.
  - **After:** all three are truthful. Member B in Lockdown still gets `SHARE_DENIED` from the real API. The owner's controls (form and list, four Settings entries, 201 share with Lockdown off) are unchanged.
  - **Checks:** backend Jest 130/130; web Jest 1890/1890 on the head (only `qrCode` can't load `jsqr` locally).
  - **Cleanup:** exact (16 run rows, 351/353 equal the 06:26:09Z baseline; login history only).
  - **Runtime:** the shared worktree and backend are back on master (PID 26797), and the lease was released at 06:41:10Z.
  - **R06 iOS** stays blocked: no simulator runtime, and no native reinstall is recorded on the hub.
  - **Next:** D07's racing Lockdown commands and failed audit write. `writeAuditLog` ignores supabase-js's returned `{ error }`, so a failed insert isn't even logged, and enable's three steps aren't atomic.

- **2026-09-30T06:11:21Z — shared runtime rebuilt from master `ed5ea9ec5`** (lease `stream3-home:` taken 06:05:49Z). Stream 4's stack was not started yet and the lease was free, so Stream 3 did it:
  - `supabase start --workdir <kit>/stack-20260930` from master's config and migrations (93 applied), project `pantopus-stream2-native-resume-r2`, API 64553, DB 64554, Inbucket 64558; excluded studio, realtime, imgproxy, edge runtime, logflare, vector, supavisor and analytics, as Streams 1 and 2 did;
  - new keys written to `runtime/supabase.env` (mode 600; the old file kept as `supabase.env.pre-reset-20260930`);
  - owner and member B recreated with their original ids, emails and passwords (GoTrue admin create, then `public."User"`), without printing the accounts file; both log in through the real API (`mint-tokens.py`: 200/200), and the private bucket `s2-home-documents` is back;
  - backend (old PID 2550 → 13697), proxy (30261 → 14166) and web (36051/66349 → 14332) restarted by exact PID after the shared worktree moved from `fcb889636` to a detached `ed5ea9ec5`; `/health` 200 direct and through the proxy, web `/login` 200;
  - fresh whole-DB baseline, 353 public tables, 06:11:21Z. **No Homes or other fixtures exist**; each journey recreates only its own, from the bundle that first made them.
  - Native tooling is still missing (hub 05:57Z; no reinstall recorded), so R06's iOS restart stays blocked, and this stream moves to the web and API parts of the open list, starting with D07's three web leads.

- **2026-09-30T05:58:25Z — native tooling is gone too.** Stream 1's cleanup record (hub, 05:57Z), confirmed read-only: the Android SDK, every AVD and `~/.gradle` are missing, and Xcode has no iOS simulator runtime (sim 6F914A30 is listed but can't boot). The kit, the 528 audit bundles and the fixture password file survived. Reinstalling needs the user's OK. Until then this stream runs the runtime rebuild and web or API work only; the resume prompt says so.

- **2026-09-30T05:56:47Z — Docker was reset; the shared runtime is gone.** Docker Desktop came back with a disk image re-created at 05:51:48Z: 0 containers, 0 volumes. DB 64554 and every retained fixture and fixture account went with it; so did the founder's stack, which is the user's. The resume prompt now puts the runtime rebuild first and names the coordination checkout's full path, because a pasted prompt lost its location. Nothing is held.

- **2026-09-30T04:40:59Z — #848 merged; no Stream 3 PR is open.** Batch 137 ([#849](https://github.com/WangPantopus/skinny-pantopus/pull/849)) merged at 04:40:14Z, so master is `ed5ea9ec5`. Master's copies of the five Stream 3/4 files equal coordination `20019853b`, not this branch's tip: `8b7f26d85` later added only the #848 line to each live block. My handoff note said "blob-equal to coordination" without naming the commit, and Stream 1 corrected it. The resume prompt's state line is refreshed.

- **2026-09-30T04:36:26Z — U01 and this stream's U02–U05 cells added (split completeness).** These cross-cutting rows sat in the former Stream 1's inventory, and Stream 1's records give U01 to the former Stream 2, so the first split proof missed them. U01 is Stream 3's alone (the source report places its "property-verification wording" on the verified-member screen). Each stream now carries its own U02–U05 cells, citing the recorded web sweeps and row evidence. `check-stream2-split.py` proves it. Master is `d1ba0b28d`: #846 split the former Stream 1 into Streams 1 and 2, with no change to this stream's rows. Docker still isn't answering, and nothing is held. Docs PR [#848](https://github.com/WangPantopus/skinny-pantopus/pull/848) (head `3dd2e5e35`, docs only) copies this and the 04:25Z prompt refresh to master; it's with the coordinator.

- **2026-09-30T04:25:38Z — the split's docs PRs are merged; prompts refreshed.** #843 and #844 merged at 04:24:12Z, so master `15711c8dc` carries the split. No Stream 3 PR is open. The resume prompt now names the new Stream 2's `stream2:` label and the shared-worktree rule. The runtime-lease lock moved to `/private/tmp/pantopus-stream3-stream4-runtime-lease`.

- **2026-09-30T04:16:32Z — Stream 3 created by splitting the former Stream 2** (user direction).
  - Rows: H01, H02, H03, H04, H05, H06, H07, H08, R01, R02, R03, R04, R05, R06, D05, D06, D07, D08, D10, M02.
  - UX items: S2-01, S2-05, S2-06, S2-10, S2-17, S2-23.
  - Decisions: 5 own + 2 shared.
  - History up to the split: the "Live continuation — 2026-09-27, Codex Stream 2" block in [`former-stream2-home-household.md`](former-stream2-home-household.md), whose last entries are from 2026-09-30T03:40Z. Docker is down; nothing is held.
