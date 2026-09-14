# Browser existing-Home submission — September 11, 2026

Accepted browser submission milestone after backend `2f8625be0`. R02/H07/H08
remain open: this proves submission/recovery and bounded address lifetimes, not
a completed verification/first-use journey or native submission.

## Current implementation

Browser creation and existing-Home joining share the existing encrypted,
actor/origin-scoped compare-and-write slot. Version 1 creation commands remain
readable; version 2 joins retain the original Home, role, exact selected address
snapshot, UUID and JSON. Neither flow can replace the other. Reopening checks
status, unknown results retain retry/cancel, and a failed terminal-proof write is
repaired without a second HTTP mutation. Only an acknowledged terminal result
permits editing or a fresh My Homes read. Historical proof claims no current
access, completed verification or postcard delivery.

The Add Home wizard joins through the new atomic endpoint, supports explicit
renter/household roles, and hides move-in/Wi-Fi/entry/parking fields that joining
never saved. Owner selection stays in ownership verification. Public Home and
Network entry links open the same address-confirmation flow. A Home supplied by
a link must match the subsequently checked address; a different apartment is
refused before any submission. Old-server responses without the required address
snapshot cannot silently fall back to the legacy partial-write route.

Address validation, geolocation and property suggestions now retain their
address/session/lifetime identity. Editing or leaving retires held responses;
parent address scope also binds autocomplete resolution. Shared autocomplete
retires earlier queries/choices on edit, unmount and pagehide; cancelled replies
cannot overwrite a new query. Keyboard/ARIA behavior is checked with regression.

## Accepted evidence and limits

- Final actual Chrome → production HTTP/SDK/SQL r4 passes committed lost-reply
  recovery after reload, cancellation of a held original submission, changed
  apartment rejection/revalidation with a fresh UUID, rejected resubmission with
  an explicit household role, actual encrypted terminal-proof write failure and
  recovery without reposting. UI acknowledgement consumes each protected command.
  Private profile/screens: `/private/tmp/pantopus-home-residency-web-ui-r4/`.
  Initial r1 profiles/screens remain preserved.
- A linked-Home mismatch passes in `...-ui-r2/` without submitting another Home.
- Two additional actual-browser defects were reproduced and retained before
  repair: a held address lookup advanced after an apartment edit, and held
  suggestion resolution overwrote edited address text. Baselines are private at
  `/private/tmp/pantopus-home-residency-web-address-race-baseline-r1/` and
  `/private/tmp/pantopus-home-residency-web-selection-baseline-r1/`.
- Final apartment-edit r4, suggestion-edit r4, pagehide/pageshow r2, held property
  reply r2 and controlled geolocation callback r2 pass. Entering a unit while the
  chosen street is still resolving also passes (selection-unit r1), retaining
  both values. These use real browser UI and production HTTP where relevant;
  page lifecycle and geolocation callbacks are controlled boundaries. Paths use
  `/private/tmp/pantopus-home-residency-web-` with `address-edit-r4/`, `selection-r4/`,
  `address-background-r2/`, `address-property-r2/`, `address-geolocation-r2/` and
  `selection-unit-r1/`. The first background attempt exposed overly broad
  retirement while a user entered a unit during street resolution; the corrected
  scopes retain that legitimate input. Failed runs remain preserved.
- Existing version 1 Home creation also passes actual owner lost-reply, cancellation,
  atomic optional-setup refusal/correction and renter/private-Tasks regression.
  Private profiles are `...-create-regression-ui-r1/` and
  `...-create-regression-renter-r1/`. Both creation and joining protected commands
  are acknowledged through UI before fixture cleanup.
- Final full browser regression r3 passes 93 suites / 1,193 checks. Twenty-five
  focused recovery/keyboard checks pass, including seven new recovery faults.
  Type gate r5 has zero errors. Lint r3 has zero errors and only the two existing
  `@ts-nocheck` warnings on legacy entry pages. Privacy r2 passes. Evidence files
  share `/private/tmp/pantopus-home-residency-web-` and the named suffixes above.
  No paid provider or real message is sent.

Both residency fixtures and the creation-regression fixture are stopped; their
exact synthetic SQL/temporary functions are cleaned with the migration ledger
unchanged. Owned port 18084 has no remaining fixture listener. Private profiles,
screenshots, failed runs and final states are kept. The backend predecessor has
all CI green in [run 34673934859](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34673934859);
verify the new browser head independently.
No physical-device update, owner-worktree change, permanent migration adoption,
merge or hosted/paid deployment occurred.

## Product gaps to address next

Current My Homes routing sends all residency applicants to document upload,
including ordinary requests waiting for household review. Its privacy-safe
verification cards are also indistinguishable when the same applicant has
several requests. These are open first-use defects, not a completed verification
journey. Implement a current personal residency-status/next-step surface and an
identity derived from the applicant's own submitted information, without exposing
current private household addresses or claiming present authority from an old
receipt. Keep household review, evidence, postal intent and unknown delivery
separate and truthful. The old postcard screen also assumes success and delivery
from insufficient response information; reconcile it with the accepted backend
postal status/admission boundary before certifying that path.

Then complete iPhone/Android submission, native prepared residency review,
invitations/private first use and the remaining backlog. Full old/new client and
server combinations, broader session/accessibility/provider coverage, merged
checks, combined schema replay and environment adoption remain required. Paid
services stay one final launch bundle.
