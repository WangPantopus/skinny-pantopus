# Home dashboard iOS runtime compatibility — September 10, 2026

CI run [34446082070](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34446082070)
failed all three iOS 18.5 simulator jobs at Home head `d35f7b844`. The downloaded
iPhone 16 result bundle identifies ten HomeDashboardViewModelTests crashes,
including ordinary dashboard loading, access loss, public fallback and checklist
refresh. The other tests were not the source of this failure. The crash reports
show SIGABRT in `swift_task_dealloc`, through
`asyncLet_finish_after_task_completion`, from the core child of
`HomeDashboardViewModel.fetchAll`. Local iOS 26.5 had passed those cases.

The dashboard now starts its five independent reads in one structured task
group, preserving concurrent network suspension and parent cancellation. Each
called loader remains MainActor-isolated. The core gathers its three child
results into local values before publishing observable properties and resetting
an inaccessible tab. No task is detached, network read removed or error surface
suppressed. The stale access comment now correctly states that missing access
leaves private navigation unavailable.

Local iOS 26.5 verification passes all **13 dashboard checks** after the final
closure adjustment, with formatting and strict lint. The preceding combined
run also passed the dashboard and 59 bill checks. Explicit actor annotations
on the first group closures caused new compiler isolation warnings; removing
those redundant annotations leaves isolation on the called methods and removes
those new warnings. The final source has independent structural review and
retains the existing assertions and test selection.

**Verification limit:** final-head CI on iOS 18.5 must pass before this is marked
resolved or merged. The local newer runtime cannot establish that result. No
physical iPhone, hosted service, dependency or deployment setting changed.
