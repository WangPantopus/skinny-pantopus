# Android own-review residency history — September 13, 2026

The installed Android reader passes on the separate native-history candidate
`9350896c4f6a822afdc2fc5cdb8e59a4970e063d`. This is bounded local reader acceptance.
The separate fresh applicant/reviewer cycle is still pending, so this scope is
not ready for integration into the primary Home branch.

## Product and installed evidence

Formatting, Detekt, Debug and Release lint, both APK builds and signing checks
pass. The 21 focused history checks pass. Each full variant passes 4,647 checks
with 80 skips, across 527 suites. Frozen source inputs and retained signed APKs
have separate digest bindings; the installed Debug APK matches its retained
product. The predecessor removal APK was preserved before the normal upgrade.

Acceptance uses the owned Android emulator and loopback API/real local SQL.
The fixture contains 23 actual rejection receipts for reviewer A and one actual
approval for reviewer B, created by real HTTP commands. No history rows were
seeded. Authentication and account changes use ordinary app login and logout.

- The current list loads 20 decisions, then the remaining page. The actual first
  and oldest visible row actions request their exact SQL receipt IDs. Secure
  Compose dialogs do not export row IDs to UIAutomator, so this does not claim
  independent identification of every one of the 23 visible row identities.
- Reviewer B sees its own approval, including recorded Member role and the
  distinction between a saved decision and today's claim/public username.
  Neither the list nor detail presents a receipt as current household access.
- List and detail loading retire previous results. Unavailable reads display
  failure rather than an authorized empty list; explicit retry recovers.
  The fault covers the initial GET and both automatic retries in the shipped
  retry policy. A preceding one-shot fault correctly recovered automatically.
- Held successful list and detail responses are cancelled by a newer reload.
  Releasing the old response records socket abandonment with matching metadata;
  the newer error remains visible. These installed runs prove cancellation and
  stale-state retirement, not delivery of old successful bytes. Separate
  noncancellable-response model tests cover generation ordering.
- Observed launcher background and normal app return trigger a fresh detail
  read. Its failure retires the prior detail until retry succeeds.
- Actual owner permission denial produces current 403 and no retained rows.
  An older held request cannot restore content. Supported permission restoration
  permits a fresh read. Ordinary B-to-A logout/cold-login return shows A's own
  rejection again.

History-only intervals preserve the full recorded claim, membership, command,
receipt, audit, ownership, permission, letter and controlled-notice state. The
explicit deny/restore interval has deliberate permission/audit/legacy-flag
effects and is not described as write-free. No additional original decision or
removal command was issued by the reader. All seven observed protected local
original stores are empty afterward. A fresh preference-hash baseline was not
captured before the reader, so whole-reader preference-byte preservation is not
claimed.

The optimized Release APK also passes the twelve-record generated-codec runtime
probe without installing or launching Release. Its retained Debug APK and all
preference hashes stay unchanged across that offline probe. Exact shared-reader
fixture cleanup restores all 374 candidate and 366 retained tables and logical
catalogs. The durable private archive independently verifies 1,186 files.

## Evidence and limitations

Private source/product evidence is indexed under `android-history-candidate-r2`;
accepted pagination is `android-history-reader-r2`, and the remaining accepted
reader phases are `android-history-reader-r5`. Earlier stopped attempts are
retained: missing dialog IDs, an interrupted driver crossing a held-request
boundary, a conflicting hold, and a one-shot 503 consumed by normal GET retry.
Those attempts are not combined into an uninterrupted passing run.

Secure-window capture remains enabled. UI hierarchy, actual UI-triggered HTTP
and SQL evidence establish these behaviors; blocked raster capture does not
establish a broad visual or accessibility acceptance matrix. This is emulator
coverage, not physical Android, hosted deployment, provider delivery, or
app-wide acceptance. The fresh command cycle remains a separate gate. Reader/product source
`9350896c4` passes all 16 checks in [CI 34768705945](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34768705945);
subsequent source changes require their own exact-head check. See the [native WIP report](home-native-history-wip-2026-09-13.md).
