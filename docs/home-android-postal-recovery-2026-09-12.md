# Android postal recovery — September 12, 2026

Accepted on final signed Debug APK r2 after a reproduced Release-only serializer
failure was repaired. The complete installed HTTP/SDK/SQL postal journey passes
on both r1 and final r2; all three original creation regressions pass on r1.
Full Debug and Release regression each pass 4,540 checks with 80 skips across
514 suites. Ktlint, Detekt, full Android Lint, privacy and signing pass. The final
enum annotation additionally passes both assemblies, four focused recovery
checks, style, Release vital lint and an actual optimized-APK serializer probe.

## Behavior

The production mail-verification route reads fresh postal and personal residency
status. A labeled six-field address is confirmed before mailing; landlord
fallback only opens review. Exact mail/code UUID and JSON are retained in an
account/origin/Home-scoped encrypted store before HTTP. Backup and device
transfer exclude that store. Lost responses, restart, cancellation, failed proof
writes and missing provider keys recover the original. Historical code proof
cannot become a current permission. Lifecycle/session changes clear displayed
addresses, codes, confirmations and actions, and retire old responses.

Acknowledgement reconciles a confirmed local removal even when coroutine
cancellation interrupts the return from IO. The same existing Add Home edge was
reproduced before repair: its original disappeared from storage, but the old
request hint prevented subsequent restores. The repair passes that reproduction
and all three installed creation regressions. Unexpected loss of an
unacknowledged postal original still blocks replacement.

## Installed acceptance and regression

All six postal phases pass on APK r1: sustained unavailable/malformed reads and
retry, changed apartment refusal, cancelled late mailing, lost original and
missing-key recovery, unknown delivery, cancelled code, lost wrong/successful
code results, and held current-access reply retirement. Final SQL records one
postcard and one synthetic provider call. The wrong code spends one guess;
success records provisional proof before later simulated approval and removal.
The removed-access screen has no code field, guesses count or Home action.
The labeled address and final screenshots were visually reviewed. The protected
postal original was acknowledged and its encrypted slot verified empty.

All three original creation journeys pass on the same APK: cancellation, lost
reply and atomic refusal/recovery. Units 401 and 403 each have exactly one private
Home and secret with zero verified occupancies; cancelled unit 402 has no Home.
Its protected original was acknowledged. Both exact fixtures were cleaned with
review definition, OID/owner/ACL/config and migration ledger preserved. No held
work remained. These accepted artifacts and evidence remain unchanged.

Four postal recovery checks plus existing creation/joining/landlord checks pass
(36 focused checks). The original Add Home acknowledgement failure is preserved
across its configured retries before the repair. The first Detekt run requested
smaller validation functions; those were refactored and Detekt passed. Full
Debug/Release regression and both assemblies pass. Full Lint passed in 6m 1s.

## Optimized enum correction — reproduced and accepted

The generated protected-command adapter uses Moshi's reflective enum adapter.
R8 renamed `HomePostalKind.Mail` and `.Code` in Release. Running that optimized
APK's actual Moshi enum adapter on the owned emulator reproduced
`NoSuchFieldException`; Debug and JVM tests do not exercise this optimization.
The sole accepted-source delta is `@JsonClass(generateAdapter = false)` on that
enum, following [Moshi's enum requirements](https://github.com/square/moshi#enums).
The corrected file passes style. Both variants rebuild successfully; four focused
postal checks and Release vital lint pass. The unchanged final optimized APK
round-trips Mail and Code through its own Moshi enum adapter on the emulator,
while the original APK fails the identical probe. Full Debug/Release regression
and full Lint above ran immediately before this annotation-only correction;
current-head CI must independently exercise the final committed sources.

The entire installed postal journey also passes again on final APK r2, with
unchanged source and installed APK hashes. Both key address/removal captures were
visually reviewed. One postcard/provider call, exactly one wrong guess plus one
successful verification, removed access, zero protected slots and no held work
are verified before exact fixture r2 cleanup. Final Debug/Release products are
preserved separately; earlier evidence and artifacts remain intact.

## Evidence and limits

Private evidence prefix: `/private/tmp/pantopus-home-android-postal-`.
- `source-build-r1.json`, `app-r1.apk`, `ui-r1/result.json` bind the original
  accepted sources and installed journey.
- `create-regression-r1/result.json` and `final-verification.json` retain the
  three installed creation cases and exact postconditions.
- `fixture-r1/cleanup.json` and `create-cleanup-r1.json` confirm exact cleanup.
- `ack-reproduction-r1.log` and `ack-reproduction-r1-results/` retain the original
  failure. `quality-build-r1.log` records the initial Detekt refusal;
  `quality-build-r2.log`, `lint-r1.log`, `privacy-r1.log`, `signing-r1.log` and
  `regression-r1-summary.json` retain the passing checks.
- `release-enum-r1/` preserves both R8 mappings, both complete original JUnit
  result directories, unchanged-APK before/after runtime probes, failure proof,
  annotation delta, final build/style/signing/install logs.
- `source-build-r2.json`, `source-evidence-r1.json`, `app-r2.apk`,
  `ui-r2/result.json`, `ui-r2/final-verification.json` and
  `fixture-r2/cleanup.json` bind final acceptance and exact cleanup.

All owned postal and creation fixtures are cleaned exactly. The owned Android
emulator is stopped with userdata retained. No real mail,
provider, hosted service or physical phone is exercised. Native prepared review,
invitations/private first use, ordinary no-claim verification entry and the wider
backlog remain open. Combined migration replay/adoption is unfinished; no merge
or release occurs. Paid services remain one final launch bundle.
