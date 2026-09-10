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

## Remaining core async-let repair

The next [CI run 34451266542](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34451266542)
on `c315267a6` passed backend, database, web and Android, but reproduced the same
ten dashboard crashes on all three iOS 18.5 devices. The actual iPhone 16 crash
bundle again reports `swift_task_dealloc` through async-let cleanup in the core
loading child. Changing only the outer group had not removed the failing path.

The three remaining core async lets now use a typed task group too. Detail,
dashboard and access reads still run concurrently; the group joins before any
of those results are published. No detached work or error suppression was added.
Existing assertions and test selection remain intact. Independent review passes;
the final iOS 26.5 app build passes all 13 dashboard checks with formatting,
strict lint and no new dashboard warnings. Private verification log:
`/private/tmp/pantopus-home-dashboard-taskgroup-ios-r2.log`.

The affected iOS 18.5 runtime still must pass current-head CI before this repair
is considered verified. Do not merge from the newer local runtime result alone.

## Affected runtime verification

[CI run 34455246057](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34455246057)
at `a68bbc5a8057718d15cfefa19d401e28b38984f6` passes all three actual iOS 18.5
jobs: iPhone 16, iPhone 16 Pro and iPhone SE (third generation). This establishes
the previously missing runtime proof for the final repair. Assertions and test
selection were unchanged. The wider Home branch remains draft, and complete
final-head CI and household acceptance still gate integration/release.
