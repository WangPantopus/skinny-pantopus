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
1. **R06, the iOS restart check.** This is the last local R06 item.
   - **Already sealed** (no code change):
     - accounts, via the real API, `20260930-stream2-r06-request-identity-r1` (MANIFEST `8365b5ca…`): the same `clientRequestId` gives the owner the same pass and another account a different one;
     - the Android restart, same bundle: a lost reply shows the committed pass once, with no resend;
     - the Android Identity ANR, `20260930-stream2-r06-identity-anr-repro-r1` (`f6f5b638…`): not reproduced in 3 bounded runs, so it's a watch item.
   - **iOS:** use `tools/android-r06-restart-identity.py` as the model, on sim 6F914A30 with the shared iOS driver. First confirm the installed dylib still matches master for `PlaceResidencyPassSection.swift`.
   - **Then** send R06 to the coordinator with device clock, full-day expiry and the hosted issuer lifecycle named as boundaries.
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
   - **Reproduced 2026-09-30:** the "Member join policy" has no effect. With "Verified only", a residency claim routes exactly as under "Open invite" (`household_review`, pending). Bundle `20260930-stream3-home-d06-join-policy-r1` (`5d920d44…`). **User decision 2026-09-30: hide it** and keep the column and API field. Web: [#917](https://github.com/WangPantopus/skinny-pantopus/pull/917), with the coordinator (bundle `20260930-stream3-home-d06-hide-join-policy-r1`, `8c65ee69…`). iOS and Android show it on their Ownership & security screens; that PR is next. The three-level policy is post-launch work (see "Post-launch work" below).
   - **Leads from a read-only code inventory (2026-09-30; each needs reproduction before any change):**
     - `POST /api/homes/check-address` returns `home_id` and claimed status for an exact address, whatever the mask ("Invite only — completely hidden");
     - 8 of the 9 `HomePrivacy` toggles have no reader (no UI either); the address-precision toggle affects only the members-only Place header;
     - ~~the public fridge-card link is not covered by Lockdown although the panel says existing share links stop working~~: **user decision 2026-09-30:** the fridge card keeps working; the panel wording is fixed in [#916](https://github.com/WangPantopus/skinny-pantopus/pull/916) (web; native has no Lockdown panel);
     - `/discover` treats `members` visibility like `private`, and native apps have no visibility control;
     - per-Home notification preferences are saved but never read;
     - ~~guest-pass passcodes travel as `?passcode=` and are limited only by the generic 60/min/IP view limiter~~: measured (`20260930-stream3-home-d08-passcode-measure-r1`, `2f0a911c…`) and repaired in [#915](https://github.com/WangPantopus/skinny-pantopus/pull/915): 10 wrong passcodes per 15 minutes per link, the passcode in a header, and new passcodes of at least 6 characters. The same measurement found live guest-pass, share and invitation tokens in the backend log; repaired in [#914](https://github.com/WangPantopus/skinny-pantopus/pull/914) for every known bearer path. Both are with the coordinator;
     - `POST /check-address` returns the Home id and claimed status for an exact address, even at "Invite only — completely hidden". **Decided 2026-09-30 under the standing instruction** (queued after the native fixes):
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
9. **U02–U05, this stream's cells.** Start with the two recorded VoiceOver gaps: the iOS residency review sheet's Close/Reload and the Members top bar are each one merged accessibility group. Then do native large text, screen readers and dark mode, and the U03 and U04 cases no row covers yet. Itemize the cells in this file the way Stream 1 itemized its own (the user approved Stream 1's lists on 2026-09-29), using the case names in `checklists/data.py` (A1–A5; E1–E6 and R1–R2; L1–L4). Don't write to Stream 1's generator. U05 starts when the launch flags are on master.
10. **Minor lead:** `homeListService.checked()` swallows the underlying error (a logging gap only).
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
| R05 | **Partial/open.** Existing lease approval/end/move-out/request repairs and native receipts are reused; PR176 only repairs the Home Settings caller. | Remaining attachment account/lifetime and real-provider/rollout boundaries. Current native apps explicitly have no landlord-request screen; web request attachment entry is distinct from the existing residency-evidence alternative. Do not build new controls/readers from the stale inventory wording alone. |
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
| U01 | **Partial/open — Stream 3's alone; 3 of its 4 open items closed 2026-09-30.** Accepted earlier: the indistinguishable unit cards (API, browser, iPhone and Android; `docs/home-list-unit-identity-2026-09-11.md`) and complete recipient identities on both native Pending invitation lists. 2026-09-30, on current builds: personal residency cards are distinct on web, iOS and Android (`20260930-stream3-home-u01-residency-cards-r1`, `d67413b1…`, no change); the web chat-button overlap leaves nothing covered at 375×548 and 390×664 (`20260930-stream3-home-u01-fab-overlap-r2`, `e36c0888…`, no change); the verified member's separate unverified-property label is fixed on web by #927, and native reads the viewer's own standing. | Long native activity identities (it needs long account names; the runtime has two shared accounts). Native chat-button overlap was accepted 2026-09-11. |
| U02 | **Partial/open — itemized 2026-09-30 (section "Stream 3 exit checklists" below); web evidence.** The former Stream 2 ran real-Chrome sweeps of its 37 retained web routes: dark-mode contrast ([#809](https://github.com/WangPantopus/skinny-pantopus/pull/809), `20260929-stream2-web-dark-link-contrast-r1`, `db25f76e…`: 12 targeted texts now pass, low-contrast styles 112 → 95), accessible names ([#819](https://github.com/WangPantopus/skinny-pantopus/pull/819), `20260929-stream2-web-a11y-names-r1`, `549cdcdb…`: 19 unnamed controls → 0) and a 390×844 layout sweep for owner and member (same seal: no horizontal overflow). Stream 3's own dark-mode repairs: [#801](https://github.com/WangPantopus/skinny-pantopus/pull/801) residency and ownership-evidence choices (`c02dbcea…`), [#807](https://github.com/WangPantopus/skinny-pantopus/pull/807) the Home editor's Visibility choice (`3d351f7d…`) and [#822](https://github.com/WangPantopus/skinny-pantopus/pull/822) Members and Owners role and tier accents (`6e8b95ee…`). | Native large text (Dynamic Type, font 2.0), VoiceOver and TalkBack, native dark mode and keyboard focus on this stream's screens. Recorded, not fixed: the iOS residency review sheet's Close/Reload and the Members top bar are each one merged VoiceOver group. The remaining low-contrast styles are the brand-colour decision Stream 1 carries. |
| U03 | **Partial/open — itemized 2026-09-30 (below); recorded per row.** Error, retry, lost-reply, duplicate and cold-restart cases are accepted inside R03, R06, D05, D07, D08 and M02 (their bundles are in the checklist above). | Loading, empty, partial, unavailable, offline, slow, cancel, back, double-tap and process-death cases on this stream's screens where no row covers them yet. |
| U04 | **Partial/open — itemized 2026-09-30 (below); recorded per row.** The bounded Home account-switch and session lifetimes that the U04 row already accepts; R06's restart request identity is sealed on Android (`20260930-stream2-r06-request-identity-r1`, `8365b5ca…`). | Long-lived sessions, background and foreground, and concurrent device or account changes beyond the bounded Home tests; the R06 iOS restart (open work item 1). |
| U05 | **Not started — waits for the launch flags on master.** | This stream's screen and action inventory in the final release build on web, iOS and Android, for the release manifest Stream 1 assembles. |

## Stream 3 exit checklists (U02–U04), itemized 2026-09-30

Itemized from sealed evidence in the audit store using Stream 1's case names (`checklists/data.py`). `MMDD name` means `2026MMDD-stream2-name-r1`, or `-stream3-home-` from 2026-09-30. This is a static list; Stream 1's generator isn't used.
- **How it was built:** a read-only evidence map came first, and I re-checked every ✅ against its bundle's own report. One map claim was wrong: iOS and Android do have a landlord verification wizard (`VerifyLandlord/`, `verify_landlord/`). So a cell without a bundle is ⬜ or ❓, never inferred.
- **Legend:** ✅ done (sealed evidence) · ❓ confirm from existing evidence before any rerun · ⬜ to do · 🔷 user decision · ⛔ named boundary · – not offered on that client.
- **Row closure:** a row closes when every cell is ✅, –, ⛔ with its boundary, or 🔷 decided.
- **Native:** native cells can't run until the machine-wide native reinstall (the user's OK).

**U03 edge cases** — E1 server error; E2 lost reply; E3 double tap; E4 not allowed; E5 changed meanwhile; E6 bad input; R1 read failure; R2 empty.

| Workflow | iOS | Android | Web |
|---|---|---|---|
| Joining: invitations, waiting room, residency claim, verification pages | ✅ E4 R1 (#724: pending 403 shows the waiting state; a 503 shows an error, not "No claim in review")<br>✅ new-account invite → verification → original review (0928 home-new-account-invite)<br>❓ E1 E2 E3 E5 E6 | ✅ E4 R1 (#724)<br>✅ new-account invite (0928 home-new-account-invite)<br>❓ E1 E2 E3 E5 E6 | ✅ E1 E4 R1 (#722 waiting room: Leave 503 keeps the original, and Retry sends one command; pending 403 says "Waiting for approval"; read 503 and Retry)<br>✅ R2 (#558: no false "No household admin yet")<br>✅ R1 invitations and verify pages, owner view (0929 web-false-empty-sweep-r2)<br>✅ new-account invite (0928 home-new-account-invite)<br>❓ E2 E3 E5 E6 |
| Owner's residency review (approve, reject) | ✅ hint copy (#799)<br>❓ E5 departed applicant (#796 ran on web)<br>⬜ E1 E2 E3 R1 | same as iOS | ✅ E5 (#796: a departed applicant's claim gets an honest 409; Reject works)<br>✅ R1 review-claim and residency (sweep r2)<br>✅ hint copy (#799)<br>❓ E1 E2 E3 |
| Leaving, member removal and recovery | ✅ E5 (#781 re-inviting an ended member; #794 approving an ended member's request: honest 409 on all three clients)<br>❓ E1 E2 E3 (the older removal reports #722 reuses)<br>🔷 re-entry (decision 1) | same as iOS | ✅ E1 (#722 Leave)<br>✅ E5 (#781, #794)<br>❓ E2 E3 (older removal reports)<br>🔷 re-entry (decision 1) |
| Ownership: claims, Owners page, transfer | ❓ transfer copy (0927 native-transfer-account; blocked by device auth, never submitted)<br>⬜ E1 E2 E3 E4 E5 R1<br>✅ disputes: launch without them (decision 3, 2026-09-30) | same as iOS | ✅ E4 (#835: permission sentence; Invite and Transfer hidden)<br>✅ E6 (#473: an unknown or own email gets an honest 400; nothing changes)<br>✅ R1 owners pages (sweep r2)<br>⛔ E1 revoke failure through the API only (#473)<br>✅ disputes: launch without them (decision 3; the flag defaults off)<br>⛔ hosted check that production doesn't set the flag |
| Landlord and lease approvals | ❓ older R05 reuse only (confirm)<br>⬜ U03 cases in the native landlord wizard | same as iOS | ❓ older R05 reuse<br>⬜ U03 cases |
| Residency letters and passes, public verify pages | ✅ E1 (0927 native-residency-pass: issue and revoke 503 show an error; retry works)<br>✅ E2 (#729; the app killed after a committed issue or revoke shows the right state after restart)<br>✅ E4 (#493 guest wording; #538 public pages)<br>✅ E5 (#735 expiry while open)<br>❓ R1 (#732: an error, but recovery only by leaving and reopening)<br>❓ E3 (code guard only) | ✅ E1 E2 (native-residency-pass; #729; 0930 r06-request-identity restart)<br>✅ E4 (#493, #538)<br>✅ E5 (#735)<br>❓ R1 (#732) E3 | ✅ E2 (#729: after a lost 201, the retry gets the same pass)<br>✅ E4 E5 (#538 public pages say revoked or no longer verified; #735 expiry on issuer and public pages)<br>✅ R1 (#732: 503 then Try again)<br>❓ R2 E3<br>⛔ device clock, full-day expiry, hosted issuer |
| Home settings (D05) | ✅ E1 E3 (#693: the rename field is locked while saving; a 503 keeps the draft)<br>✅ rename starts from the real name, an untouched Save sends nothing, and clearing works (#982)<br>⬜ E2 E4 E5 E6 R1 | ✅ E1 E3 (#693)<br>✅ the same rename fixes (#982)<br>⬜ E2 E4 E5 E6 R1 | ✅ E1 E3 (#690: inputs locked while saving; a failure keeps the draft)<br>✅ E4 (#858: entries gated by permission)<br>✅ E5 (#632: two tabs keep each other's edits; #745: a name cleared elsewhere)<br>✅ E6 (#626: invalid coordinates aren't saved; geocoder emulated)<br>✅ R1 (#694 malformed read; #745 read 503; both then Try again)<br>❓ E2 |
| Privacy (D06) | ✅ E1 (#749: a 503 rolls back with an error)<br>❓ E3 (#749: iOS reports the toggle enabled while saving, a harness limit)<br>✅ E5 R1 (#638: Place shows the saved setting on return; an injected 503 shows an error)<br>⬜ no native Home visibility control; document pickers don't start from the Home default | ✅ E1 E3 (#749: extra taps while saving make no extra save)<br>✅ E5 R1 (#638)<br>⬜ the same native gaps | ✅ E4 (#803: an invite-only Home's link gives non-members 403; #865, #869, #874 map homes layer through the API)<br>✅ Default Visibility for New Items applies (#898)<br>✅ join policy hidden (#917 web, #971 native); the fridge card keeps working during Lockdown (#916)<br>❓ E1 R1 on the settings privacy section |
| Members, permissions, security and Lockdown (D07) | ✅ E4 E5 (#781, #794)<br>✅ R1 malformed Access & Codes list (#701)<br>– Lockdown (web only)<br>✅ the Members audit list shows plain words (#972, `0930 d07-native-audit-labels`; the dashboard's recent-activity card is Stream 4's)<br>⬜ E1 E2 E3 | same as iOS | ✅ E1 (#757 mismatched Lockdown replies rejected; #825 "Finish revoking"; #881 "Record this change")<br>✅ E4 (#474, #816, #820, #835, #858)<br>✅ E5 (#881 two-tab race)<br>✅ E6 (#791: already a member or already invited)<br>✅ R1 (#644 security summary; #647 Lockdown summary; sweep r2)<br>✅ audit labels (#888)<br>✅ decisions 2 and 5 settled 2026-09-30 (least-privilege defaults; Lockdown leaves the Home private) |
| Guest passes (D08, M02) | ✅ E4 (#519: entry only for pass managers)<br>✅ E5 (#761: expiry while open)<br>✅ R1 malformed list (#701)<br>✅ scheduled start: a scheduled pass stays current, shows "Starts …" and is revocable (#999, `0930 d08-scheduled-start`)<br>⬜ copied link<br>✅ Allowed areas → the real "What they can see" sections (user-approved 09-26, `2c8908956`) | same as iOS | ✅ E4 (#519; #827 pass managers during Lockdown)<br>✅ E5 (#761: list and public page)<br>✅ R1 (#758 malformed Share list; #680)<br>❓ older PR #53/#60 (E1 reasons, wrong passcode, stale reply, quota)<br>✅ passcodes (#915)<br>✅ scheduled start: Share Center "Scheduled · Starts …", guest page "Not Active Yet" (API `SHARE_NOT_STARTED` in `0930 d08-scheduled-start`)<br>⬜ copied link and public rendering |
| Deleting a Home (D10) | ✅ E1 (503: recoverable error)<br>✅ E2 (deleted; the app terminated before the reply; the Home is gone after restart)<br>✅ E4 (403)<br>❓ E3<br>⬜ E6 cancel flow | ✅ E1 (503, then same-screen retry)<br>✅ E4<br>✅ E6 (Cancel sends nothing)<br>❓ E2 E3 | ✅ E1 E4 (503 keeps state; 403 after access is removed; restore and retry)<br>✅ E3 (a forced duplicate click sends one DELETE)<br>✅ E6 (cancel stages and invalid confirmation send nothing)<br>⛔ linked-resource cleanup (files, balances, Crew payments) |

All D10 cells come from 0927 home-delete-three-apps. Homes list and Home identity cases are tracked under U01.

**U04 lifetimes** — L1 background and return; L2 cold restart; L3 switch account; L4 session refresh.

| Area | iOS | Android | Web |
|---|---|---|---|
| Homes list, joining and waiting room | ✅ L2 My Homes after restart (home-delete-three-apps)<br>⬜ L1 L3 L4 | ✅ L2 (same)<br>⬜ L1 L3 L4 | ❓ L2 reload (#722 records none)<br>⬜ L1 L3 L4 |
| Residency letters and passes | ✅ L2 (native-residency-pass: restart after a committed issue or revoke)<br>✅ L2 request-identity restart (`0930 r06-ios-restart`, `badb1a99…`)<br>⬜ L1 L3 L4 | ✅ L2 (native-residency-pass; 0930 r06-request-identity)<br>⬜ L1 L3 L4 | ✅ L2 reload (#732, #735)<br>⛔ L3 checked through the API only (0930 r06-request-identity: another account never gets the same pass)<br>⬜ L1 L4 |
| Home settings and privacy | ✅ L2 (#693 cold restart; #749)<br>⬜ L1 L3 L4 | ✅ L2 (#693; #749)<br>⬜ L1 L3 L4 | ✅ L2 reload<br>⬜ L1 L3 L4 |
| Members, security and guest passes | ✅ L2 (#761 guest list)<br>⬜ L1 L3 L4 | ✅ L2 (#761)<br>⬜ L1 L3 L4 | ✅ L2 reload (#761, #881)<br>⬜ L1 L3 L4 |
| Deleting a Home | ✅ L2 restart: the Home is gone | ✅ L2 relaunch: the Home is gone | ✅ L2 landing after delete (S1 #652) |

**U02 accessibility** — A1 largest text; A2 dark mode; A3 contrast; A4 screen reader; A5 keyboard (web).

| Screen | iOS | Android | Web |
|---|---|---|---|
| Members & Security, Members, invitations, Lockdown, audit log | ⬜ A1 A2 A3 A4<br>✅ each Requests row's Invite/Decline are separate elements (#973)<br>✅ Members top bar: not reproduced; the driver's default backend flattens system navigation bars (`0930 u02-navbar-probe`) | ⬜ A1 A2 A3 A4 | ✅ A2 role accents (#822), links and danger actions (#809)<br>✅ names (#819; not a full screen-reader pass)<br>⬜ A1 A4 A5<br>🔷 A3 brand colour |
| Residency review, verification pages, ownership (owners, claim, transfer, dispute) | ⬜ A1 A2 A3 A4<br>✅ the review sheet's Close/Reload: not reproduced, they are separate elements (`0930 u02-navbar-probe`) | ⬜ A1 A2 A3 A4 | ✅ A2 evidence choices (#801), Strong tier (#822)<br>✅ names (#819)<br>⬜ A1 A4 A5<br>🔷 A3 |
| Settings, privacy mirror, Home editor, Delete home | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ✅ A2 editor Visibility (#807), Danger Zone and Leave Home (#809)<br>✅ names (#819)<br>⬜ A1 A4 A5<br>🔷 A3 |
| Share center, add guest | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ✅ A2 partial (#809)<br>✅ names (#819)<br>⬜ A1 A4 A5 |
| Residency letters and passes (Identity) | ⬜ A1 A2 A3 A4 | ⬜ A1 A2 A3 A4 | ✅ A2 "Generate a residency letter" (#809)<br>⬜ A1 A4 A5 |
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
  - **The other D10 lead stays open:** an approved request whose pending invite the purge deleted.

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
