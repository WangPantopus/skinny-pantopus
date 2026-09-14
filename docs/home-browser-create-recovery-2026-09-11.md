# Browser Home creation recovery — September 11, 2026

The browser Add Home wizard now retains an immutable creation command before its
first POST, recovers that command after reload, and opens current My Homes after
confirmed completion. This extends the bounded native creation repairs to the
browser. Existing-Home admission, complete onboarding and release remain open.

## Behavior

The request UUID and exact JSON, including optional setup, are encrypted with a
nonexportable AES-GCM key in IndexedDB. Actor/API-origin scope, authenticated
additional data and transactional compare-and-replace prevent another tab from
replacing the original command. Corrupt or unavailable storage blocks a new POST;
there is no plaintext fallback or automatic deletion of an unknown outcome.

Reload checks status. Retry uses the same UUID and JSON. Cancellation must be
confirmed before editing. Completion, rejection and cancellation require the
matching actor/request, valid command dates, HTTP status and projected outcome.
Completion also verifies Home/claim identities, exact access-record count, role,
verification requirement and the explicit absence of a current-access check.
A failed terminal-proof write keeps the already observed decision in memory;
retry repairs its protected write without a second HTTP mutation. Only saved
terminal proof permits explicit acknowledgement. Completion reloads My Homes
instead of navigating directly into the returned Home ID.

Session/background retirement hides details and prevents late creation work from
publishing or starting a POST after a suspended protected write. Account changes
receive a fresh ordinary form. Same-account unsubmitted form state remains in
memory while recovery is hidden; reload durability is for submitted commands.

The browser now sends an explicit owner/renter role; the former nonowner payload
implicitly selected household membership. Optional Wi-Fi requires both fields,
respects server lengths and retains meaningful password whitespace. Optional
fields have accessible names. Progress buttons cannot skip forward past address
verification. Review explains that ownership/residency still need verification.
The existing mail step-up entry is retained after a confirmed step-up rejection;
its provider/delivery journey is not newly certified here.

## Actual acceptance

The Chrome driver forwards real requests to the owned production routes and
Supabase SDK/PostgreSQL fixture. Only sign-in, providers, notification transport
and unrelated navigation services are controlled. At a 390-pixel viewport:

- Unit 502: incomplete Wi-Fi blocks Review, correction proceeds, then a delayed
  provider holds the creation command. Reload recovers that same command;
  cancellation is confirmed and the released worker creates no Home. Editing
  restores unit 502.
- Unit 501: the Home/occupancy/preference/pending owner/access record commit while
  the HTTP reply is withheld. Reload recovers completion with exactly one POST.
  The stored envelope contains ciphertext and a nonexportable key. Current My
  Homes shows private Tasks, the correct unit and no verified residency/ownership.
- Unit 503: an actual age-policy refusal rolls back optional setup and the Home.
  After correcting the synthetic account input, Edit retains the original
  network/password, including whitespace; address revalidation and a new command
  commit one Home. The two same-named unit cards have their correct Tasks links.
- Unit 504: explicit renter creation returns the renter/residency outcome, no
  pending ownership claim, one private setup and the correct current Tasks link.
- Unavailable IndexedDB blocks submission without a POST. Restoring storage and
  reopening recovery restores the ordinary form.
- Unit 505: a thrown IndexedDB quota error during the terminal-proof write leaves
  the original command recoverable. Retry saves the observed result without a
  second POST, then current My Homes opens. Direct IndexedDB inspection verifies
  that explicit UI acknowledgement consumes the command.

The successful final fixture has six terminal commands (four completed, one
cancelled, one rejected), four private Homes and no fixture errors. Screens were
reviewed; no narrow horizontal overflow occurs. Exact synthetic SQL, command
functions and the temporary table are cleaned afterward; migration ledger stays
unchanged. Browser profiles, private snapshots and earlier failed runs remain
preserved outside Git.

Private evidence uses `/private/tmp/pantopus-home-create-web-`: `ui-r3/` is the
complete owner/cancellation/refusal journey; `ui-r4/` is renter; `ui-r5/` is cold
storage failure/recovery; `ui-r6/` is terminal-write failure/recovery. Fixture r2
and `final-state-r1.json` retain final SQL/cleanup proof. `source-manifest-r1.json`
binds source digests. Earlier r1 used an ambiguous duplicate-link selector; r2
read SQL before the corrected POST had completed. The driver now waits for the
confirmed UI and preserves persistent browser profiles. Those partial runs are
not acceptance passes. Initial local typecheck r1 caught malformed generated JSX
attributes; corrected compilation and final typecheck pass.

Eight focused fault checks pass: unavailable writes, lost replies, mismatched
proof, proof persistence failure, missing-command cancellation, bound rejected
responses, stale tabs and retirement during protected save. Full browser
regression passes **93 suites / 1,186 checks**. Typecheck reports zero errors;
changed-source lint and privacy gates pass. No backend/schema or native source
change is included in this milestone.

## Continue

Finish existing-Home submission/cold-start/resubmission (R02), ordinary member and
invitation first use, primary eligibility and native residency review; then the
full backlog. Broader account/provider/browser/offline/accessibility combinations
and client-server version compatibility remain open. H07/H08 remain partial;
74 of the 80 acceptance-inventory entries remain open or partial. That inventory
is not a whole-app completion percentage.

Android predecessor `3ebbf4789` is pushed; its
[CI run 34671037286](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34671037286)
still needs its final native results at this checkpoint. Check the new pushed
head independently. #32/#34 remain unfinished drafts; #34 conflicts. Reconcile
40 Home / 21 payment / 49 combined migration versions and populated adoption
before merging completed scopes. No hosted deployment, permanent migration,
owner-data/device change or paid activation occurred. Paid services stay one
final launch bundle; the owner's physical iPhone remains on verified build 2.
