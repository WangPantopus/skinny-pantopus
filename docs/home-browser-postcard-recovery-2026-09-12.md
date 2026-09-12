# Browser Home postcard recovery

September 12, 2026. Browser milestone following backend verification/review
`d88c9efcc` and postal request `f035c47ef`.

## Result

The browser checks current postal and personal residency status before offering
mailing or code entry. It displays the applicant's own submitted address and any
previously confirmed mailing address, with an explicit street/apartment confirmation
for new requests. It distinguishes saved requests, mailing not started, provider
acceptance, unknown transport, definite refusal and recorded postal proof.

One original address or code attempt is saved in encrypted IndexedDB recovery
storage before a possible POST. Actor, API origin, Home, postcard and request UUID
remain bound across restart, unknown responses and cancellation. Compare-and-write
storage fences another tab's revision. A known result whose local proof write
fails is saved again without reposting. A not-started mailing resumes only its
original server-confirmed address/UUID. Unknown mailing does not trigger resending.

A successful code reply records proof; it does not navigate directly to a private
Home or a claimed Place verification success. Current residency status determines
whether an Open Home/Return to Place link is available. Page/session/origin/Home
changes retire old reads, actions and form input. Failed status reads remove action
controls and retain recovery, with a plain retry message.

The shared SDK now excludes Home API exchanges from development request, response
and error diagnostics. JSON-string retries could otherwise bypass recursive field
redaction and log a code or private address. Production endpoint behavior is
unchanged by this diagnostic suppression.

## Actual acceptance

Private evidence prefix: `/private/tmp/pantopus-home-postcard-web-`.

Chrome at 390×844 renders the actual production API responses from the local
Supabase SDK/PostgreSQL fixture. Authentication, mail/notification transport and
unrelated app surfaces are controlled; no real mail or messages are sent.
`ui-r4/` and its adjacent log pass:

- Malformed initial read fails closed and recovers without requesting mail.
- A different apartment is refused; the exact confirmed unit can be submitted.
- A lost committed request survives browser reload with one postcard, no dispatch
  yet, and its original identity. Missing keys preserve it; restoring the synthetic
  key allows only its original mailing to resume.
- Unknown delivery remains visible; refresh produces no duplicate send.
- A code POST dropped before the server is cancelled without consuming a guess.
- Lost wrong-code and successful-code replies recover once after reload. The
  original wrong attempt uses one guess; a recorded success cannot renew access.
- An injected IndexedDB proof-write failure is repaired with no extra POST/guess.
- Postal proof leads to household review; it does not expose a Home/Place link.
- Later current approval can expose the guarded link, while removal/freeze retires
  it. A held old status reply cannot bring access back after page retirement.
- No horizontal overflow in captured narrow layouts. Reviewed images include
  explicit mailing address, unknown delivery and recorded-proof recovery.
- Browser console diagnostics contain no Home request paths, fixture addresses
  or submitted postal code. Only one controlled provider call occurs.

The first UI runner stopped on an ambiguous alert selector that also matched
Next's route announcer. Scoping to the actual page alert fixed the runner. UI r2
passed before diagnostic suppression; r3 and final r4 include the console gate.
Types first identified two missing Home-scope validator arguments in the new
store; those were corrected before UI acceptance.

Final types (`types-r4.log`) and changed-surface lint (`lint-r3.log`) have no errors
or warnings. Full web lint (`lint-r2.log`) has zero errors and 1,116 pre-existing
warnings on other surfaces. Full browser regression after the SDK change:
93 suites / 1,193 passed (`regression-r2.log`). Privacy gates pass (`privacy-r1.log`).
The final two small lifetime/error-copy refinements also pass final types/lint and
the actual UI suite; no broad regression was repeated for those refinements.

All three owned fixture runs clean their exact synthetic rows and temporary
postal schema. `fixture-r3/cleanup.json` verifies exact persisted review function,
OID, owner, grants and settings restoration; the migration ledger is unchanged.
No permanent role defaults or migrations were adopted.

## Remaining work and preservation

Continue native existing-Home submission and personal status first, followed by
native postal/prepared review, invitations/private first use and the full backlog.
H07/H08/R02 remain partial. Broader cross-tab/browser/version/offline/accessibility
combinations and unsolicited mounted server updates remain bounded acceptance
limits; current actions still enforce database policy. Physical mailing, provider
webhooks, real APNs and delivery are not certified by this browser exercise.

Source migration inventories remain 43 Home / 21 paid / 52 combined, with 12
identical shared files and no timestamp collisions. Combined replay/adoption and
legacy mutation compatibility remain release prerequisites. #32/#34 stay drafts;
#34 conflicts. Backend predecessor `d88c9efcc` has completed backend/database/web,
iOS lint/build and Android instrumented jobs passing in
[run 34682745853](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34682745853);
iPhone execution and Android lint/test/assembly are unfinished at this checkpoint.
Verify the browser milestone's own pushed-head checks independently.

No merge, hosted release, paid activation or physical-device change occurred.
The iPhone remains the verified in-place Pantopus 1.0.0 (2) native build. Owner
work, databases, devices, artifacts and private evidence are preserved. Dedicated
postal code keys and paid providers remain one final launch bundle.
