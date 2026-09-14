# Browser Home invitation sender recovery

September 12, 2026. This milestone uses the [sender protocol](home-invitation-sender-contract-2026-09-12.md) and
[atomic backend](home-invitation-sender-recovery-2026-09-12.md).

## Reproduced problem and repair

The actual browser dashboard saved an invitation through production HTTP/SDK/SQL,
then unmounted the form during its full dashboard refresh. A failed refresh left
only an access-unavailable message; SQL still contained the pending invitation.
Both sender forms also claimed username delivery without supporting proof.

The dashboard modal and Members invitation panel now share one sender manager.
Creation, resend and withdrawal prepare current terms, then retain the exact
original request in an encrypted, account/origin-bound IndexedDB slot before
submission. Check, retry, cancellation of an unseen attempt and acknowledgement
keep that same original through lost replies, failed reads, process restart and
account changes. Cross-tab compare-and-write protects the slot; a corrupt or
unavailable store never becomes an empty slot. A terminal receipt whose protected
write fails is repaired without another POST. An acknowledgement whose committed
clear loses its callback reconciles the empty slot before proceeding.

Saved receipts remain independent of list refresh. The dedicated
`/app/homes/:id/invitations` recovery page is reachable even when the dashboard
cannot load current Home access. Historical receipts grant no current authority.
Sharing the protected creation/resend link requires an explicit fresh context
check of the same invitation and current authority. This read sends no invitation.
The result expires after at most 60 seconds or at invitation expiry; list refresh,
failure, acknowledgement and session/lifecycle changes retire it. Older list
responses cannot overwrite a newer denial or failure. Delivery wording separates
email provider acceptance, saved in-app notices and unconfirmed arrival. Link and
QR sharing use the current browser origin.

Sender review prefers the effective base role over historical role labels and
shows a readable Household approval label for approved access-request invitations.
Malformed effective-role data fails validation. The new sender list distinguishes
invited accounts by their safe public name and
username, and includes pending expired or former-manager invitations for current
managers to withdraw. Expired invitations cannot be resent. Reviewed identity
and terms are bound by the backend; resolved-recipient withdrawal cannot remove
membership. Form copies distinguish household admission from residency/ownership.

## Acceptance and limits

Final browser r9 passes nine actual sender commands: saved create with failed list
refresh; protected-write failure preventing POST; unseen-attempt cancellation;
username create with lost reply and cold failed read; A→B→A account recovery;
acknowledgement-write recovery; explicit resend with controlled provider/in-app
proof; lost withdrawal; withdrawal after recipient acceptance preserving current
membership; current-authority rejection with historical receipt recovery; retired
confirmation; terminal-proof repair without repost; distinct recipient identity; and withdrawal
of an expired pending invitation with resend disabled. Sharing denial retires the
link, and a held older list success cannot overwrite a newer denial. Array receipt state/delivery values are rejected without losing or acknowledging
the original. Present null/false/zero/empty stored records block new creation;
restoring the same sealed original permits normal recovery. Every original is
acknowledged. No member-delete request occurs. Encryption inspection confirms
AES-GCM 256, a nonextractable key and sealed envelopes rather than plaintext
originals. Raw capabilities stay out of diagnostics.

The initial driver attempt was retired by a development source refresh before
any command was submitted. The next actual run exposed undefined optional dates
being retained differently from JSON wire data. The controller now normalizes
JSON before prepared review and protected saving; a regression covers that case.
Neither earlier attempt submitted a sender command. Their artifacts are retained.
The earlier eight-command r3 run is retained as predecessor evidence. Final r5
exposed a fixture adapter bug: an absent fault matched an undefined list action
and threw after a successful SQL response. Explicit sender-list fault mapping and
non-null guards repaired the harness; production list code was unchanged. Final
r6 passes the complete expanded journey on its recorded source. The retained r8 run repeats
that journey on the final compatibility backend and effective-role UI. Final r9
adds actual malformed-receipt and corrupt-storage refusal and recovery on the
final guarded browser source. The r7
fixture was stopped before any browser command to include the corrected legacy
email-role projection. Earlier originals were acknowledged
through UI before each exact fixture cleanup. Source bindings and separate failed
and passing evidence are retained privately.

Integration review additionally found two malformed-data recovery gaps: array
values could coerce into receipt enum strings, and present falsy IndexedDB records
could appear empty. Strict string checks now reject malformed receipt state and
delivery values; only an absent record is an empty recovery slot. Targeted
controller checks preserve the exact original and recover through a later valid
read. Final r9 proves these guards in the actual browser against successful
production HTTP/SQL results, followed by normal recovery of the same original.

Full browser regression: **1,211 passed in 95 suites**, zero failures. Targeted
storage/receipt/form checks pass. Type checking has a zero-error baseline and
changed-source ESLint passes. The journey uses a 390-pixel browser viewport with horizontal-overflow checks.
Final saved-receipt and malformed-receipt recovery viewport captures were inspected at
390 × 844, with text and controls readable. Full-page capture placement of fixed
navigation is not a substitute for viewport or zoom acceptance.
Other browser/device sizes, zoom, screen-reader and full release-wide UI
acceptance remain open.

The fixture uses real production routes, services, SDK and SQL with controlled
synthetic authentication, delivery and injected failures. It is not live email,
push, hosted Auth or deployment proof. Exact cleanup preserves all complete role
rows, migration ledger and function definitions/properties. Private evidence is
retained at `/private/tmp/pantopus-home-sender-invitations-r1/`; raw links, contacts,
profiles and operator logs are not committed.

H07/H08 stay partial. Companion reports record installed sender acceptance on
[iOS](home-ios-invitation-sender-2026-09-12.md) and
[Android](home-android-invitation-sender-2026-09-12.md). Continue ordinary-member
onboarding/private first use; preserve already accepted recipient/address/postal
journeys. The inventory remains 7 of 80 areas closed, not an implementation
percentage. No hosted adoption, merge, paid activation or physical-device change.
