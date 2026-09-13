# Browser authentication form readiness

September 12, 2026. Found during ordinary-member onboarding (H07/H08).

## Reproduction and repair

Actual Chrome displayed the server-rendered login fields before React attached
their handlers. Entering synthetic credentials and clicking Sign in submitted a
native GET: the owned test profile's navigation history contained both `email`
and `password` query keys. No real user credentials were used. The preceding
attempt also submitted mismatched controlled form state; normal login succeeds
after the repair.

Login, registration, password recovery and password reset now share `AuthForm`.
Its server-rendered fieldset stays disabled until hydration finishes. The form
declares POST as defense against native GET fallback, and its hydrated handler
prevents navigation before calling the existing API handler. JavaScript-disabled
visitors receive an explanation. Existing loading, validation, recovery, OAuth
and safe return-destination behavior is retained.

## Verification

`scripts/web/test-auth-form-hydration.cjs` runs actual Chrome against the local
Next app. Each of the four pages passes with JavaScript disabled: every form
control is disabled, POST is declared, the explanation is visible and no entered
data appears in a query. Each also passes with script requests held and then
released: controls remain disabled before hydration, enable afterward and issue
one correctly shaped controlled API POST with the entered synthetic values.
The API error appears in the form without native navigation or query changes.
All four fit a 390-pixel viewport; the login layout was visually inspected.

Web regression: 1,215 tests in 95 suites pass, including four server-rendering
regressions and existing authentication/return-link tests. Type check passes
with zero errors; changed production-source lint passes. These local results do not replace exact pushed-head CI.

Private evidence: `/private/tmp/pantopus-home-member-first-use-r1/auth-form-hydration/`.
`before.json` records only safe query keys and source hashes. Original owned
profiles remain private. `after-r3/result.json` binds the eight browser cases;
the first verification attempt stopped on an ambiguous test selector that also
matched Next's route announcer. It was corrected to select the form's alert.
No authentication provider or hosted release is established by controlled API
responses. Broader new-account/provider onboarding and H07/H08 remain open.
