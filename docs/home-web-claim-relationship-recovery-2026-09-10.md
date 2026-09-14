# Browser claimant relationship review and recovery — September 10

The normal Home claims page now opens an explicit review for continuing independent
verification or flagging an unknown claimant. It shows current claim/evidence
status, explains the selected response, accepts an optional private note and
requires acknowledgement again after changing the response or note. The browser
saves the original decision before submission and retains its confirmation until
acknowledged. A permanent recovery link works even after the claim leaves the
pending list. Invitation/evidence verification remain separate existing flows.

## Implementation and current-state boundaries

- The new relationship review GET uses the production claim review service and
  ordinary SQL authority, returns a non-credential opening-session proof and
  disables caching. The existing decision POST now checks that proof when
  supplied; legacy requests remain compatible. A changed HTTP-only account or
  session cannot submit a command prepared under the old proof.
- One encrypted decision slot per API origin/actor/Home prevents another claim
  or tab from replacing an unconfirmed request. AES-GCM uses a non-extractable
  browser key, authenticated scope and an atomic revision compare-and-write.
  The original claim, action, note, request UUID and displayed review token are
  retained exactly. Confirmed receipts bind to that original. Nothing sensitive
  is put into localStorage or the URL; the URL only carries the claim identifier
  and selected action. Account-change storage contains only the existing marker.
- Before every submission/retry/acknowledgement, current claim authority and the
  saved original are re-read. Session/account/origin and foreground lifetime are
  checked again after asynchronous reads/storage work. A terminal claim can
  recover an old receipt; it cannot be rewound or silently resubmitted as new.
- Cold confirmed recovery uses a fresh authorized read and does not POST again.
  The UI separates the original outcome from today's claim status. A saved
  decision for another claim must be finished first. Only a confirmed receipt
  or a definitive stale/ineligible reply can be acknowledged and cleared.
  Unknown transport failure, unreadable storage and conflicting saved revisions
  do not erase the original. These are browser-local receipts, not cloud sync.
- Backgrounding, account/session changes and current denial remove claim/note/
  receipt UI. Restoring access reloads the original. The claims list now clears
  stale rows and reports a refresh failure instead of showing a false empty
  queue. Delayed earlier loads cannot repopulate the replaced list generation.
- First-use encryption-key writes now catch synchronous quota/security failures
  through the same recoverable promise path. The shared storage helper uses
  general recovery wording because it also supports relationship decisions.

## Actual acceptance and findings

[Chrome acceptance driver](../scripts/web/test-home-claim-relationship.cjs) and
[isolated HTTP fixture](../scripts/db/home-claim-relationship-http-fixture.cjs)
run the actual new screens and production relationship GET/POST routes, Joi,
read/write services and PostgreSQL. Final run **r7 passes** with **six POSTs,
three receipts and zero uncaught browser exceptions**, followed by exact SQL
fixture cleanup. It covers:

1. Normal pending-claim entry; current unverified deed status; explicit response/
   note review; changing the response disables submission until reviewed again.
2. First-use key initialization failure and later draft-write quota failure:
   visible error, no POST/receipt and retry after restoring browser storage.
3. Lost committed decline reply; encrypted, non-extractable original storage;
   later SQL rejection and disappearance from pending claims; recovery through
   the permanent link, identical retry, current rejected state, cold confirmed
   reload without POST, explicit acknowledgement and no new terminal action.
4. Stale displayed claim: definitive 409 creates no receipt, explicit restart
   loads current review, clears the note and requires acknowledgement again.
5. Two competing tabs cannot replace the original; the second recovers it.
   A pending deed flag enters admin review, not a qualifying property dispute.
6. Current revoked/restored authority and account replacement hide private
   fields. Corrupting the actual encrypted bytes blocks new/retry actions across
   reloads; restoring the exact bytes recovers the original. Opening another
   claim cannot replace that saved decision.
7. Held preflight reads during deterministic background/account changes send
   no POST and retain the exact original. Restored access permits keyboard
   retry; qualifying verified title evidence enters challenged/dispute review
   while Home security remains normal. Cold confirmation and acknowledgement
   remain correct.
8. Claims-list denial clears old rows, shows a reload error rather than “no
   pending claims,” and recovers after authority restoration. The acknowledged
   recovery inbox is empty. Desktop 1100px and narrow 390px layouts and keyboard
   controls pass. Seven r6 screen captures were visually reviewed; final r7 repeats the same
   rendering acceptance and adds console diagnostic capture only.

Harness corrections are recorded separately from app findings: initial fixture
loading missed an indirect database dependency, a list assertion ran before its
load completed, and an early narrow capture caught the sidebar during its resize
transition. The final harness waits for the observed list/layout states. No app
navigation fix was invented for those observations. The stale-list and key-write
failure repairs above are actual application changes.

The dev overlay's diagnostic was inspected: recorded console output consists of
intentional 403/409/503 cases, blocked unrelated resources and the intentionally
unavailable local socket endpoint. There are no uncaught page exceptions. This
is not evidence of a working socket/provider connection.

## Verification limits and remaining gates

Identity/profile/session registration and unrelated shell responses are synthetic;
comparison-list shape is synthetic but populated from current authorized SQL
claim projections. Relationship review and decision HTTP/services/SQL are real.
Later rejection, evidence and authority changes are controlled SQL fixtures;
this does not claim acceptance of the separate administrator rejection/provider
verification UI. Lifecycle events are deterministic browser events, not OS
suspension or physical-device proof. No hosted auth, provider, document upload,
notification, paid service, migration adoption, deployment or merge was exercised.
Private evidence is under `/private/tmp/pantopus-home-relationship-browser-r7/`
and the matching log. Operator data/credentials/archives remain outside Git.

Final web type gate passes with **zero errors**. Focused lint has **zero errors
and 12 pre-existing any-type warnings** on the older claims list; new components
have none. All **92 web suites / 1,178 existing checks** pass. All backend privacy
gates and the 32 relationship-route compatibility checks pass. The complete
backend run under **Node 22.23.2**, matching CI's Node 22 line, passes **317 suites,
5,164 checks and 16 existing skips**. Two local Node 24.13.0 broad runs reported
one unchanged logout test's `socket hang up`; its 89-case suite passes separately.
The cause of that runtime-dependent observation is unproven. No assertion or
app behavior was weakened to make it pass; final-head remote CI remains required.
The underlying [backend milestone](home-claim-relationship-decisions-2026-09-10.md)
already records the final 34-migration replay, 39 SQL/pgTAP contracts, 12 actual
lock races and full-field populated upgrade preservation; no migration changes
were added by this browser milestone.

Origin was fetched before this checkpoint. Backend predecessor `3e421b5c3` has
passing backend/web/database/safeguards/iOS build/Android instrumentation checks;
three iOS device jobs and Android lint/test/assemble were still running. The
older Android `05c678efe` run was superseded/cancelled before Android completed,
so its aggregate is not a pass. Refresh the new exact head. PRs #32/#34 remain
drafts; paid #34 stays `e9ef2decb`, green but unfinished. Preserve both branches'
GigDetail/CompletionFlow edits and reconcile the combined **43 migration versions**
with fresh/populated replay before integration. Every paid dependency remains
in one final launch-preparation bundle.

Exact browser/SQL fixtures and ephemeral HTTP listeners are cleaned. The owned
web listener and Gig database are stopped, with the local database backup retained.
The fresh relationship replay project was already stopped at the backend checkpoint.
Owner files, emulator 5554 and other existing owner runtimes are unchanged.

Next: native iOS prepared relationship review with Keychain original/confirmation
recovery and installed HTTP/SQL acceptance, then Android parity. Continue residency
receipts, ownership transfer/challenge, lease/resource cleanup, remaining Home/
Pulse/Beacon/platform/vendor workflows and release rehearsals afterward. Browser
relationship recovery is locally complete within these explicit limits; native
relationship recovery and the complete application are not yet complete.
