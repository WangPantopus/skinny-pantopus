# Native Beacon staging acceptance

The actual iOS Staging app published **Beacon native N2 — lilac harbor** from
the Beacon composer. A separate address-free follower opened its audience
notification and saw that exact content with **Beacon Simulator Studio** as
the author. An ordinary cold start retained the authenticated session, followed
by normal settings logout.

## Isolation and evidence

Two fresh synthetic accounts, one Beacon and exactly one active follower were
enrolled only in the staging beta allowlist. Global/internal Beacon flags stayed
off. Both accounts had device push disabled and zero tokens throughout. There
was no physical iPhone recipient or pending owner observation.

The live API reconciled exactly one stored N2 post and one audience notification
whose link contained that same post ID. After the native tap, only N2 was read;
the earlier N1 notification remained unread. N1 was created during an earlier
test attempt that checked composer dismissal before the response completed.
It was reconciled before any retry and was never republished. N2 verified the
complete send, response, composer dismissal and creator logout sequence.

The opt-in `BeaconStagingJourneyUITests` harness takes synthetic credentials
from a private runner and skips ordinary CI. It uses native login, Keychain,
device binding and the actual HTTPS API; it does not enable the Debug API
fixture. Harness corrections handled delayed password-save/Face ID prompts,
SwiftUI accessibility identifiers inherited from parent views, and the Pulse
sheet presentation. The passing follower case verifies cold start and logout;
it does not establish gesture dismissal of the Pulse sheet.

## Build and limits

- App source: `ac86abad6ed0c096a8ce0ee3d0c15e62cd836058`, integrated through
  [PR #15](https://github.com/WangPantopus/skinny-pantopus/pull/15).
- iPhone 17 / iOS 26.5 Simulator, dedicated to this synthetic fixture.
- Staging configuration with staging API and Socket URLs verified in the built
  app. Local test instrumentation uses `-Onone` and testability; this is not a
  distribution IPA or TestFlight acceptance.
- Actual simulated application entitlement and native Keychain login verified.
- Strict SwiftLint and SwiftFormat pass for the harness.
- [PR CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34331005965)
  and [merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34333762148)
  passed, including all three iOS simulator jobs. Live mutations are deliberately
  excluded from CI and were run separately by the private operator harness.

This establishes native composer → live audience notification → exact-post
behavior. Earlier reports separately record physical APNs delivery and
mute/access/preference restrictions. Simulator coverage does not replace them.
Private results and app hashes are retained under `ios-continuation/` in the
durable recovery root; credentials and operator logs are not versioned.

The fixture remains active for natural elapsed token expiry and remaining
notification/session cases. Do not reuse the old cleaned device fixtures or
republish N1/N2. Chat continuation is the next repair under investigation.
