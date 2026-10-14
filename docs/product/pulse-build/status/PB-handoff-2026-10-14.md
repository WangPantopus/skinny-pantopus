# PB handoff — October 14, 2026

The founder requested that all work be committed/pushed, PRs opened, and PB-only local resources removed before the next session. Continue the existing work; do not rebuild it or treat this as a new design.

## Git and PRs

Current branch: `claude/pulse-pb-s9-conversations`. It contains the entire open PB chain. Fetch and inspect current remote state first; the following is the handoff snapshot.

Merged this session: 2301 (reply moderation), 2298 (contract/status), 2304 (founder approval), 2305 (Plans moderation), 2278 (PulseArea), 2306 (area contract), 2307 (area APIs), 2309 (shared audience wall), 2310 (feed contract). Master `f5de3f183` passed CI 38637985918 completely; 2310 then merged as `b4234543c`; its master CI 38643228669 also passed completely. The Census boundaries for Camas, Washougal and Vancouver are already in migrations. H1 and H3 are clear; **all eleven tables and the Census download are approved**. No hosted changes or deployment were authorized.

Open chain:

| PR | Branch | State and contents |
|---|---|---|
| [2311](https://github.com/WangPantopus/skinny-pantopus/pull/2311) | `claude/pulse-pb-s5-distance` | Draft; green CI at `230053f07`. Shared privacy-safe distance formatter and service-only density lookup. Native display verification still needed. |
| [2312](https://github.com/WangPantopus/skinny-pantopus/pull/2312) | `claude/pulse-pb-s6-feed` | Draft; green CI at `6df382a77`. Grouped feed, counts, opaque pagination and monotonic seen markers. Following intentionally stays empty until S10. |
| [2313](https://github.com/WangPantopus/skinny-pantopus/pull/2313) | `claude/pulse-pb-s9-contract` | Green documentation PR at `838c8051a`, stacked on 2312. Exact claim responses and additive legacy reply envelope. |
| [2317](https://github.com/WangPantopus/skinny-pantopus/pull/2317) | `claude/pulse-pb-s9-conversations` | Stacked on 2313. Conversation/replies reads and additive create-reply fields. Remaining S9 actions are not implemented. Local full Jest passed: 342 suites, 6,633 tests; one suite and 16 tests skipped. The implementation head passed backend CI, safeguards and schema replay; recheck the final documentation head before merging. |

Retarget stacked PRs to master only when their parents have landed, or merge a verified top head containing the exact green parent heads after retargeting all to master. Keep branches. Check the shared launch-stream queue before each merge; this is distinct from the retired September workstream system. Its active file is `launch-streams/status/REQUESTS.md` in the primary checkout. No PB HOLD is left outstanding.

Existing client work to reuse: iOS S6 2308 and S9 2314; Android S6 2303, lifecycle 2302, composer drafts 2315, share authorization 2316 and radius/comment wording 2318. These are other owners’ drafts; inspect their current state before assuming a request is still open.

## Verification and limits

- Merged area/wall/Plans work was checked with two synthetic accounts on PB web, iOS and Android, after relaunch. Previous S7/privacy fixtures and Alice/Carol quiet-hours rows existed locally; cleanup removes the PB database, so recreate fixtures instead of assuming they survived.
- Distance: real PB database checks covered both readers, rounding, sparse density, duplicate occupancies, invited/ended/guest/pending/frozen homes and hidden/grid-snapped points. Privacy gates and schema replay passed.
- Feed: 106 same-timestamp rows paged once each; scope, moderation, expiry, mute/hide, six types plus legacy/business/curator rows, labels, Going/save state, closed areas and concurrent seen markers checked through the PB API. No raw home/point fields in DTOs. Full backend checks passed in CI. Local full Jest had an intermittent homeAddressRedaction failure; its focused rerun passed all 18 tests.
- Web S6 compatibility: legacy feed and direct post page loaded; the direct post page and replies survived reload. One existing feed detail-panel reload showed “Post not found”; that panel case remains to investigate. No new web Pulse UI is claimed complete.
- Fresh native master/S6 builds were stopped for the founder's cleanup request before S6 display checks completed. The new feed/distance PRs must stay draft until native verification passes. A private copy of PA 2303 required changing `/api/pulse/*` in a Kotlin block comment to `/api/pulse/…`; it otherwise fails KSP with an unclosed comment. The owner is asked to fix it in PB status. No client source was changed in this worktree.
- Conversation read draft: local two-account API probe passed with 205 replies, deep branches, repeated client request IDs, old/soft-deleted rows, held/removed moderation, bidirectional blocks, hidden parent names, microsecond polling, malformed input and scope revocation. All privacy gates and the full existing Jest suite passed (342 suites, 6,633 tests; one suite and 16 tests skipped). No native conversation check has run. `helpful` and `thanked_by_viewer` are placeholders until the next S9 actions; no Helpful/Thanks/claims endpoint or account-deletion migration ships in this draft. Do not call S9 finished.
- No new unit/UI tests were added. Private probes used synthetic local data only. Hosted systems, physical devices, production delivery and deployment were not verified or changed.

## Next work

1. Read AGENTS, NEXT_STEPS, the mobile brief, Pulse README, PB stream/status, contract, spec and scenarios. Audit branches/PRs/CI again. Preserve existing work.
2. Recreate only PB runtime, accounts and devices. Reuse PI 2308 and PA 2303 for S6 verification, and PI 2314 for S9; their owners retain source ownership. Finish two-account web/native checks, including relaunch, before merging 2311/2312. The S6 contract requests in PB status cover `read_at`, selected `area_id` polling, opaque cursors and caught-up acknowledgment. Do not confuse `end.since` with the snapshot time.
3. Finish S5 label limits and S8 creation with PS's composer-check dependency. Creation currently does not write the new read scopes or enable the new types. Do not duplicate PS-owned safety files.
4. Finish S9: Helpful and private Thanks, atomic OfferClaim requests/choice (max five, first-wins race, retries), reports via the existing moderation model, narrower-only scope changes, and soft account-deletion replies that preserve other people's descendants. Update existing tests only if broken. Keep the old `{ message, comment }` create response intact.
5. S10 follow graph/preferences makes Following real. Then follow the PB stream's remaining S12–S24 slices and hold points. H2 public exposure/moderation cover and H6 signup abuse verification still apply.

## Runtime after cleanup

Cleanup completed: the six `pantopus-pulse-pb` containers, its two volumes and network, backend/web listeners, PB simulator/emulator, private runtime/build copies, DerivedData, web output, own worktree dependency/build caches and PB local env/config files were removed. Ports 55001, 55002, 55004, 55100 and 55101 are closed. The browser verification tab is closed. The local launcher and generated TypeScript include overrides were restored to their tracked versions. Keep this checkout and Git branches. Never remove shared package stores, system SDKs, global Gradle/Xcode caches or another stream's stack/device.

Start from the current branch's migrations. Source `~/.config/pantopus/dev-env.sh` before node/pnpm/supabase/java commands; run `pnpm install --frozen-lockfile`, then `scripts/pulse/stream-runtime.sh start pb --env backend/.env`. That regenerates PB's ignored local env. Use only PB ports. Recreate synthetic accounts with reserved `example.com` addresses: the current helper's `example.invalid` default is rejected by app sign-in validation. Native devices must be recreated; the old UDID is no longer usable. Existing local runtime memory is historical after this cleanup.

Commit footer remains `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branches use `claude/pulse-pb-<topic>`. PRs require “Scenarios run:” and “Not verified here” and end with `🤖 Generated with Claude Code`. Only the founder changes hosted systems, spends money or deploys.
