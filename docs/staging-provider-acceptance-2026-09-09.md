# Staging address and account providers — September 9, 2026

Work is isolated in `/private/tmp/pantopus-staging-provider-acceptance`, branch
`codex/staging-provider-acceptance`. PR #25 merged as `fab8869b2` at 18:01 UTC
after [current-head CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34386117504)
passed. Its merged-master run is pending; PR #23's older master run was cancelled
when superseded. The completed browser/saved-card evidence remains in the
[vendor report](staging-vendor-acceptance-2026-09-09.md).

## Provider inventory and remaining limits

A real Google Address Validation request for its documented public example
returns HTTP 200 and a parsed premise result. The actual provider/parser path was
used. The accompanying Smarty request returns 402, explicitly stating that an
active subscription is required. No database address cache was modified, no
address was claimed, and no household access was granted by this probe.
Google/Apple remain disabled in the isolated staging Auth settings. These are
configuration gaps, not passing OAuth callback or residential DPV acceptance.
The owner has been asked whether an existing active Smarty account is available;
no plan was purchased. Continue independent testing while that answer is pending.

The provider checks use Google's [request example](https://developers.google.com/maps/documentation/address-validation/requests-validate-address)
and Smarty's [response reference](https://www.smarty.com/docs/apis/us-street-api/reference).

## Lob request repair in progress

The test-key-only postcard probe returns HTTP 422 with
`mail_use_type_can_not_be_null`; no postcard was created. The provider omitted
Lob's required mail purpose and depended on an account default that is absent.
Address-verification cards now explicitly use `operational`. Custom postcards
require an explicit supported purpose; the existing block invitation caller sends
`marketing`. Inline and template verification requests carry the same purpose.

The initial 105 focused mail/provider/invitation tests pass, including four new
custom-purpose cases and verification request assertions. Full backend/privacy
validation and repeating the live Lob test against a committed private candidate
remain next. Do not repeat the original probe blindly; its attempt and exact
provider response are privately recorded under `20260907/staging-provider`.

Lob's [test-key documentation](https://help.lob.com/account-management/api-keys)
confirms test requests do not print or mail a physical piece. Test rendering
does not verify a real address or prove delivery. All current runtimes are still
as recorded in the vendor report; production and the public staging API/worker
are preserved. No migration or new paid resource was introduced.
