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
   - Racing Lockdown commands (enable and disable in flight together).
   - Audit-write failure: `writeAuditLog` is non-fatal while the panel promises "Records Lockdown changes".
   - ~~Three web leads~~ (scoped share links during Lockdown; Invitations by URL; the standalone Settings links): all three reproduced and repaired in [#858](https://github.com/WangPantopus/skinny-pantopus/pull/858), merged in batch 141 (master `8af54a57a`).
   - New leads (recorded, not reproduced as defects yet):
     - the Members & Security audit list shows raw action codes (Stream 4; its #854 label table can be reused);
     - the URL-only Settings page's Notifications switches have no height, keep local state only and name cut features (needs a product call: remove or persist);
     - a member opening the Members page by URL still sees "Recover a member removal" and "Refresh members".
   - Accepted limit: the Lockdown retry control is gone after a page reload.
3. **D05, Home settings:** recovery, concurrent edits from two clients, retained intent and explicit clearing on native.
4. **D06, privacy:** every remaining exposed privacy control and its native and other consumers.
   - **Done out of order (coordinator, 2026-09-30):** the Explore map homes layer, [#865](https://github.com/WangPantopus/skinny-pantopus/pull/865). The mail-compose recipients leak is Stream 4's (in progress there).
   - **Leads from a read-only code inventory (2026-09-30; each needs reproduction before any change):**
     - `POST /api/homes/check-address` returns `home_id` and claimed status for an exact address, whatever the mask ("Invite only — completely hidden");
     - `member_attach_policy` (web and both native "Member join/attach policy" controls) has no reader outside an unused service;
     - 8 of the 9 `HomePrivacy` toggles have no reader (no UI either); the address-precision toggle affects only the members-only Place header;
     - `default_visibility` ("Default Visibility for New Items", web) has no effect, because record creation hardcodes `members`;
     - the public fridge-card link is not covered by Lockdown although the panel says existing share links stop working (unsure whether it counts as a share link);
     - `/discover` treats `members` visibility like `private`, and native apps have no visibility control;
     - per-Home notification preferences are saved but never read.
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

**Waiting on the user.** These are Stream 3's decisions; the closure plan has the details: https://claude.ai/artifact/AZyYcWk2YpdwT4pc3nGGkp
1. Rejoining after leaving (R03): build membership renewal, or confirm an ended membership is final so R03 can close on the rest.
2. What an ordinary member sees by default (D07, D06): new members get the home overview and Tasks only.
3. Ownership disputes at launch (R04): `HOUSEHOLD_CLAIM_CHALLENGE_FLOW` has never been audited in the deployed setting.
4. Guest pass "Allowed areas" on the native Add guest form (M02, D08).
5. Should Lockdown give the home its previous visibility back when it ends (D07)? #828 states the current behavior; restoring needs the old value stored.

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
| D07 | **Partial/open.** 2026-09-30 [#858](https://github.com/WangPantopus/skinny-pantopus/pull/858) (batch 141): during Lockdown a document share link tells a `home.edit` holder "Share links are off while Lockdown is on" instead of the guest-facing denial; a member opening Invitations by URL gets a permission sentence instead of the sender form; the URL-only Settings page offers Members & Roles and Access & Codes only to viewers who can open them. Real Chrome before/after + real API, exact cleanup, bundle `20260930-stream3-home-d07-web-leads-r1` (`7be1dd8e…`). #758 ShareCentercollection error/retry34-file5154af44/all353unchanged, merged batch99/#760. #757 matchingLockdownreceipt guard58-file9b508c29/all353restored, merged batch99/#760; concurrency/serverpartialfailureunverified. #755 standalone saved access reveal + emergency-only Overview,47-filed8966910 seal/all353 restored; merged batch98/#756. #753 access-only dashboard and existing Lockdown member/invite copy,73-file986c3f0f seal/exactcleanup, merged batch97/#754. #751 one-row audit copy corrected after actual Lockdown issue-create/full-audit mismatch;50-file4a737de4 seal/cleanup, merged batch96/#752. #647 current Lockdown read/manage recovery and per-card failures verified (e570e414), merged; #649 corrects forced-signin copy; member/invite/audit/session effect wording now reconciled via649/751/753; concurrent/failing commands remain. #644 supplementary-summary failure/retry/real403/navigation evidence7eb50c75; healthy0 states only, Lockdown effects open. #641 repairs two real vendor false-empty readers, bounded UI/API/SQL evidence9a2d5cf9 and exact vendor cleanup. Invitation send/decline/role/audit and mailbox-preferences route repair evidence is recorded. 2026-09-26: web explicit role choice ([#474](https://github.com/WangPantopus/skinny-pantopus/pull/474), bundle `20260926-stream2-web-role-choice-r1`). Members "Invite" opens the real Invite Member panel instead of a stub that faked success ([#528](https://github.com/WangPantopus/skinny-pantopus/pull/528), bundle `20260926-stream2-members-invite-r1`). | Existing web provider/security read errors are accepted (#641/#644/#647), not repeat work. Remaining: Lockdown concurrent/failing commands and audit-write failure, ShareCenter lifetime boundaries and other consumers outside those accepted cases. |
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
| U01 | **Partial/open — Stream 3's alone.** Accepted: the indistinguishable unit cards (API, browser, iPhone and Android; `docs/home-list-unit-identity-2026-09-11.md`) and complete recipient identities on both native Pending invitation lists. In Stream 1's U reconciliation the former Stream 2 confirmed no current U01 work; nothing has been rechecked since. | Personal residency cards that can't be told apart; the narrow-screen member label/badge and floating-chat overlap; the verified-member screen's separate unverified-property label; long native activity identities. Finished screens on all three clients, with current rendered evidence. |
| U02 | **Partial/open — web evidence; not itemized.** The former Stream 2 ran real-Chrome sweeps of its 37 retained web routes: dark-mode contrast ([#809](https://github.com/WangPantopus/skinny-pantopus/pull/809), `20260929-stream2-web-dark-link-contrast-r1`, `db25f76e…`: 12 targeted texts now pass, low-contrast styles 112 → 95), accessible names ([#819](https://github.com/WangPantopus/skinny-pantopus/pull/819), `20260929-stream2-web-a11y-names-r1`, `549cdcdb…`: 19 unnamed controls → 0) and a 390×844 layout sweep for owner and member (same seal: no horizontal overflow). Stream 3's own dark-mode repairs: [#801](https://github.com/WangPantopus/skinny-pantopus/pull/801) residency and ownership-evidence choices (`c02dbcea…`), [#807](https://github.com/WangPantopus/skinny-pantopus/pull/807) the Home editor's Visibility choice (`3d351f7d…`) and [#822](https://github.com/WangPantopus/skinny-pantopus/pull/822) Members and Owners role and tier accents (`6e8b95ee…`). | Native large text (Dynamic Type, font 2.0), VoiceOver and TalkBack, native dark mode and keyboard focus on this stream's screens. Recorded, not fixed: the iOS residency review sheet's Close/Reload and the Members top bar are each one merged VoiceOver group. The remaining low-contrast styles are the brand-colour decision Stream 1 carries. |
| U03 | **Partial/open — recorded per row; not itemized.** Error, retry, lost-reply, duplicate and cold-restart cases are accepted inside R03, R06, D05, D07, D08 and M02 (their bundles are in the checklist above). | Loading, empty, partial, unavailable, offline, slow, cancel, back, double-tap and process-death cases on this stream's screens where no row covers them yet. |
| U04 | **Partial/open — recorded per row; not itemized.** The bounded Home account-switch and session lifetimes that the U04 row already accepts; R06's restart request identity is sealed on Android (`20260930-stream2-r06-request-identity-r1`, `8365b5ca…`). | Long-lived sessions, background and foreground, and concurrent device or account changes beyond the bounded Home tests; the R06 iOS restart (open work item 1). |
| U05 | **Not started — waits for the launch flags on master.** | This stream's screen and action inventory in the final release build on web, iOS and Android, for the release manifest Stream 1 assembles. |

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
