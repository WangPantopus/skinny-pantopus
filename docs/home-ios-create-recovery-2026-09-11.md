# iPhone Home creation recovery — September 11, 2026

Continuation after backend checkpoint `c0d474989`. Installed cancellation,
lost-reply/restart and atomic optional-setup journeys pass with production
HTTP/SDK/SQL. Final iPhone regression, signed build and style pass. Android,
browser and existing-Home admission remain separate work. Visual review finds
missing unit identifiers on list cards; H07/H08/R02 and U01 remain open.

## Resulting behavior

Before the first possible creation POST, iPhone retains the original request UUID,
complete body, form and optional networks/codes in account/API-origin-scoped
Keychain storage. Storage is non-synchronizing and available only while this
device is unlocked. Access values never enter ordinary scene storage. A failed
protected write blocks submission; there is no plaintext fallback.

Reopening Add Home restores the original command and checks its status. It never
automatically posts a replacement. Unconfirmed saves offer status, an exact retry
or server-confirmed cancellation. Closing the screen retains the command. Only a
confirmed cancelled/rejected command can return to editing, and edited details
require address validation before a fresh request. Completed commands remain
protected until acknowledged, then both entry points reload My Homes and its
current authority. The outcome itself grants no current Home access.

The coordinator validates actor/request identity, timestamps, terminal decision,
Home/claim IDs, claimed role, verification type and the complete optional-access
ID set. It fences concurrent requests within the account/origin, retires replies
after lifecycle or session changes, and preserves an observed terminal outcome
in memory if the subsequent protected write fails. Another screen's matching
completion can be adopted, but another intent cannot be cleared or overwritten.

Optional access records commit in the same backend command as the Home, replacing
the old sequential creation followed by best-effort access writes. Incomplete or
oversized access fields are corrected on their editable step before review.
The unused primary toggle and misleading review row are removed. Review and
completion explain that private setup does not verify residency or ownership.
Section accessibility containment preserves individual input/control identities;
inputs also have explicit labels.

## Actual acceptance and evidence

Installed cancellation r5 passes in 112.746 seconds. An incomplete access row
shows an inline error before review. After correction, creation waits at the
controlled provider boundary. The app is terminated and reopened, recovers the
original pending request, cancels it through the server and returns its original
unit/access details to editing. Releasing the delayed worker creates no Home.
The cancelled command remains a server tombstone until exact fixture cleanup.

Installed r7 passes both remaining journeys: lost-reply/restart in 101.204
seconds and optional-setup refusal/corrected retry in 91.135 seconds. The first
withholds the actual completed HTTP response, checks one Home/occupancy/preference,
one pending ownership record and one access record in SQL, then terminates the
app. Reopening resolves the original completed command, acknowledges it and
shows that exact Home's usable private Tasks action. There is exactly one Home
creation POST; status recovery does not mint another command.

The refusal journey applies the actual server age/access policy to the synthetic
household claimant. Rejection leaves no partial Home. After the synthetic account
condition is corrected, Edit details restores the original optional setup,
revalidates the address and creates a fresh command. Its Home and access record
commit together. Both completed Homes have zero verified occupancies and no
legacy owner pointer. Their My Homes actions say “My tasks”; neither claims
verified ownership or residency. These are actual SDK/SQL list responses.

Final signed build r8 passes. Full regression r2 passes 4,369 checks with 168
intentional skips and no failures (4,537 total), including the final r6 app
changes. Earlier focused r1 passes 36 checks. The 14 changed Swift files pass
r6 format/strict lint; the final UI-driver changes also pass r8 format/strict
lint. Privacy r1 passes. Final-source diff whitespace checks pass.

Private evidence prefixes are `/private/tmp/pantopus-home-create-ios-`: signed
`build-r8.log`, regression `regression-r2.xcresult` and its summary JSON, style
`{format,lint}-r6.log` and `{format,lint}-r8.log`, privacy `privacy-r1.log`, and
installed `ui-r5.xcresult` / `ui-r7.xcresult` with exported attachments. Accepted
products are APFS-cloned at `/private/tmp/pantopus-home-native-artifacts-after-ios-create/`.

The fixture `scripts/ios/home-create-ui-fixture.cjs` controls only synthetic
sign-in, providers, notifications and surrounding shell APIs. Native navigation,
Keychain, creation routes, authority/list readers and local SDK/SQL are actual.
Both r4 and r5 complete event histories have zero fixture errors. Both graceful
shutdowns confirm exact synthetic SQL and temporary command-function cleanup;
no migration ledger changed. The original local ledger remains `20260910220000`.
Private fixture evidence is `fixture-r4.{json,log}` and `fixture-r5.{json,log}`
under the same prefix.

### Failed attempts and discovered first-use gap

Build r1 found a changed preview callback; r3 ran out of disk; r4 found an invalid
XCTest query method. Their logs remain private. Installed r1/r2 were interrupted
by Docker/REST unavailability; exact guarded cleanup is retained. Fixture state
initially read a nonexistent unit column; it now uses the actual `Home.address2`
column. Configuration is validated before temporary SQL is installed, and a
failed state snapshot can no longer prevent graceful cleanup.

Installed r3 exposed section identifiers replacing child input identities; r6's
containment/labels repair is verified on the installed app. Installed r4 reached
review but stopped at an iOS Passwords offer. The driver now declines only that
specific observed system sheet. Installed r6 completed both server recovery paths
but wrongly required the list container itself to be tappable; r7 verifies the
actual Home-specific Tasks action and private/verification badges. None of those
failed runs is represented as passing acceptance.

Final visual review exposes a separate real defect: units 301 and 303 at one
street render as indistinguishable Home cards. SQL retains their distinct units,
but the safe list projection omits `address2`. Fix the authorized list projection
and client unit labels next; do not hide this by inventing different fixture
nicknames or count broader Home identity/first use as complete.

## Infrastructure interruption and limits

A disk-full build interrupted local Docker. No database, volume, cache or
accepted artifact was deleted. After the stopped VM was restarted, the owned
REST container could not start because of stale container runtime state. Its
original stopped container is retained as
`supabase_rest_pantopus-home-gig-replay-preserved-create-recovery-20260911`.
A replacement under its original name uses the same pinned image, configuration
and network aliases, with no mounts. Credentials/configuration snapshots and
repair logs remain private. Existing SQL records and the migration ledger were
preserved; unrelated stopped services were not rebuilt.

Protected-store corruption remains a blocking recovery condition, never permission
to silently discard an unknown command. Recovery on another device is not supplied
by this device-only store. Existing-Home claim submission, residency completion,
Android/browser creation, broader first-use/invitation flows and permanent migration
adoption remain separate work. The backend's legacy-client and notification limits
are retained in [its report](home-create-recovery-2026-09-11.md). No paid provider,
real message, deployment or merge is part of this local acceptance.
