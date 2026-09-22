# iOS tip journey CI repair — September 10, 2026

The three iOS 18.5 simulator jobs in [CI run 34463214786](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34463214786)
failed the same tip scenarios. The current-account payment-read guard intentionally
skipped a summary request for the old fixture's missing session identity. Its
FIFO responses then delivered a pending-review response to the tip decoder.

The fixture now supplies the current actor through the existing coordinator
dependency and binds each response to its actual API route. The original gate,
projection, success, decline and dismissal assertions remain. Added assertions
check one tip creation, exact status reconciliation and the expected payment
reload; declined or dismissed checkout does not reconcile. Runtime access and
payment behavior are unchanged.

Independent review passed. The final iOS 26.5 simulator app build passed all 61
selected tip, assigned-authorization and detail checks. SwiftFormat and strict
SwiftLint passed. An initial local build caught two optional-chaining typos in
the new request assertions; those were corrected before the final passing run.
The private operator log retains the build and simulator evidence.

All three remote iOS 18.5 jobs now pass on pushed head `0037a3115` in
[CI run 34467842363](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34467842363).
This confirms the fixture repair on the affected runtime. It does not certify the complete
provider tip journey: server-confirmed tip success, session retirement and fresh
provider acceptance remain in the paid-gig lifecycle backlog. PR #34 stays draft.
