# Android Home bill access and recovery — September 10, 2026

The Android bill list, detail and create/edit wizard now use current effective
Home finance permissions. `finance.view` preserves viewing; both view and manage
are required for changes. Labels such as owner/admin and legacy flags do not
override a deny. Read-only viewers have no Add, Edit, Remove or Mark paid control.
Direct mutation calls refresh access before sending a write.

Each screen binds its opening account/session to the actual injected API origin.
A token-change observer hides prior data and invalidates callbacks on a session
change. Legacy sessions without an identifier use an in-memory token digest.
The atomic account/session helper matches the separately developed payment
recovery helper. No token or bill contents are persisted by this change.

Reads and successful mutations must match the exact Home, bill and splits. Old
responses cannot replace current screen state. Saving rechecks access, and a
success event is checked again before navigation. A failed split read leaves
the verified bill visible with explicit unavailable text and Retry splits;
it does not imply that no household allocations exist. The retry retrieves and
renders the actual allocations. Failed mutations retain a recoverable error.

## Evidence and remaining work

The final JDK 17 run passes 62 focused bill/access workflow checks, ktlint,
Detekt with no findings, Android lint with zero errors, and debug assembly.
Whole-app Android lint reports 212 warnings and 16 information findings; those
were not silently claimed resolved. Independent review of the permission/session
and response boundaries is complete, and the requested split-read recovery
repair passes its focused check. Diff whitespace checks pass.

These checks use controlled API responses and do not constitute physical-device
or complete household acceptance. Other Home entry points, claim/evidence and
attachment workflows, derived data, current-head CI and integrated household
acceptance remain required. The matching [iOS bill milestone](home-ios-finance-access-2026-09-10.md)
is separately committed, including its split-read and unchanged-receipt repair.
No provider, hosted policy or production change ran here.
