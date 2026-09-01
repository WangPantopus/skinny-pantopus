# Stripe Checkout success/cancel deep-link config — decision

Date: 2026-05-08
Status: Decided. Implemented in P2.11a.
Resolves: audience-profile design v2 §17 implementation detail flagged
in the original §6 of the IA spec on universal-link configuration.

---

## 0. Problem

Per §8.2 the persona subscribe flow is **web-only checkout** (no
StoreKit / Play Billing in v1.0). Mobile opens `pantopus.com`'s
checkout in the system browser. After payment, Stripe redirects to
a `success_url` / `cancel_url` we control. Two questions:

1. What URLs should the backend pass to Stripe?
2. How does the user get back to the app after success?

## 1. Decision

**Use the existing canonical persona URL with a query param flag.**
No bespoke deep-link scheme; no app-only intermediate redirect; no
custom `pantopus://` URL scheme. The URL itself is the universal
link.

```
success_url = https://pantopus.com/@{handle}?welcome=1
cancel_url  = https://pantopus.com/@{handle}?canceled=1
```

The mobile app's deep-link handler reads `?welcome=1` from the persona
profile route and shows the welcome banner. iOS Associated Domains
(`applinks:pantopus.com`) and Android App Links handle the universal-
link routing — both are device-config concerns, not Pantopus app code.

## 2. Why this shape

- **Same URL works on devices without the app.** The fan completes
  checkout on web, the success URL is the canonical persona profile
  page, and the web profile page renders the welcome state too.
  Universal-link installs/upgrades don't break the flow.
- **Universal-link / app-link routing is browser-native.** No
  intermediate `/return-to-app` page; no custom URL scheme; no risk
  of the app catching a URL it shouldn't have.
- **`?welcome=1` is the minimum safe signal.** Doesn't carry the
  fan handle, persona id, or any auth token in the URL — those are
  resolved server-side by the membership lookup once the app
  refetches.
- **Cancel = same URL minus the welcome flag.** The user lands on
  the same persona page they started from, with `?canceled=1`
  available if we want to show "no charge — try again" copy.

## 3. What's NOT done in P2.11a (operator follow-up)

The associated-domains / app-links **device config** lives outside
the codebase and outside the sandbox:

- **iOS:** Add `applinks:pantopus.com` to the app's Associated
  Domains entitlement in Xcode + ship the `apple-app-site-
  association` JSON at `https://pantopus.com/.well-known/apple-app-
  site-association` declaring `/@*` and `/persona/*` as universal-
  link paths.
- **Android:** Add an `intent-filter` with `android:autoVerify="true"`
  matching `https://pantopus.com/@*` + ship the
  `assetlinks.json` at `https://pantopus.com/.well-known/assetlinks.json`.

Until both are deployed, the success URL opens in the device's
browser (graceful fallback) and the user manually returns to the
app — the membership row is already correct via the Stripe webhook,
so the app's next refresh shows the active membership.

## 4. P2.11a app-side hooks

Mobile's persona profile screen (`/persona/[personaHandle]`)
already exists. The handshake screen (`/persona/[personaHandle]/follow`,
P2.11a) opens checkout via `expo-web-browser`'s
`WebBrowser.openBrowserAsync` for free-tier-skip and
`Linking.openURL` for paid-tier external checkout. After return:

1. Persona profile screen reads `?welcome=1` from
   `useLocalSearchParams()`.
2. If present, refetches membership state.
3. Renders the brief "You're in 🎉" banner.

The page also reads `?canceled=1` to render a "no charge" toast
(non-blocking).

## 5. Backend hook

`backend/services/personaPaymentsService.js → createCheckoutSession`
keeps the existing URL pattern; a code comment now references this
doc + flags the universal-link expectation explicitly so a future
refactor doesn't mistake the URLs for "just web links".

## 6. Open follow-up

When Apple Pay / Google Pay support lands on web checkout, the same
universal-link return path works without changes. No revision to this
decision is expected unless StoreKit / Play Billing fallback (Plan B
from §8.2) goes live in a region — in which case the URL pattern
survives but the in-app StoreKit handler skips this flow entirely.
