# iOS Home bill access and failure recovery — September 10, 2026

This source checkpoint keeps bill viewing available to a member with effective
`finance.view`, while requiring both `finance.view` and `finance.manage` for
changes. Owner/admin labels and legacy flags do not override effective denial.
It is part of draft PR #32, not a hosted release or complete Home acceptance.

## Resulting workflow

The bill list, direct bill detail and create/edit wizard each read the exact
Home access endpoint before loading or changing financial data. Read-only users
see their bills and split details without Add, Edit, Remove or Mark paid actions.
The wizard also checks direct entry; hiding a button is not its authority check.

A shared access helper binds each screen to its original account, session and
API origin. Older permission replies cannot overwrite a newer refresh, and
old screens cannot reveal or mutate bills after a session change. The helper
uses the configured authentication provider, with the existing in-memory hashed
legacy-token fallback when a session identifier is absent. No token or financial
payload is written to persistence by this change.

Permissions refresh again before a mutation. Current effective denial, failed
access reads, a changed session or a different Home/bill in the response prevents
success callbacks and hides unavailable content/actions. Retained navigation
callbacks recheck their current screen scope. List counts and banners clear when
access is unavailable. A failed Remove now leaves the detail open with the error;
it no longer closes merely because the preexisting bill state was loaded.

## Verification and limits

- The three targeted iOS suites pass **59 checks** on the local iPhone simulator
  with iOS 26.5. They exercise the real default access-endpoint-before-bills
  sequence, read-only and direct entry, permission revocation before writes,
  older access replies, session changes, wrong receipts and failed removal.
- Changed Swift sources pass formatting and strict lint. An independent
  read-only review of the eight source/test files found no actionable issue.
- Initial compiler issues in a composed empty-state callback were repaired by
  extracting a typed action helper; the final build and checks pass.
- API responses in these checks are controlled fixtures. No real household,
  production service or physical iPhone operation ran in this checkpoint.
- Android parity is active separately. Other Home entry points, derived data,
  claim review/evidence, private attachments and full household workflows remain
  acceptance gates. Previous-head iOS 18.5 CI exposed a separate Home dashboard
  async cleanup crash; its repair and remote runtime verification are independent
  of these bill controls. This report does not claim that CI is green.

The implementation files are HomeFinanceAccess.swift, BillsListViewModel.swift,
BillDetailView.swift and AddBillWizardViewModel.swift/AddBillWizardView.swift in
`frontend/apps/ios/Pantopus/Features/Homes/Bills`; the three checked suites are
HomeFinanceAccessTests, BillsListViewModelTests and AddBillWizardViewModelTests.
