//
//  StripeBootstrap.swift
//  Pantopus
//
//  Phase 3 (3A) — shared Stripe SDK initialisation. Called once at app
//  start from `AppDelegate` with the publishable key resolved by
//  `AppEnvironment` (Info.plist → xcconfig → .env). The SDK ships in the
//  build already (project.yml: StripePaymentSheet + StripeApplePay); we
//  only set the publishable key. PaymentSheet (the card-entry UI) and the
//  server-created intents do the rest — we never build a card form.
//

import StripePaymentSheet

/// One-shot Stripe configuration. `configure(publishableKey:)` is
/// idempotent and a no-op when the key is empty (e.g. an un-provisioned
/// local build), so launch never crashes on a missing secret.
public enum StripeBootstrap {
    public static func configure(publishableKey: String) {
        let trimmed = publishableKey.trimmingCharacters(in: .whitespacesAndNewlines)
        // Skip empty / unsubstituted xcconfig placeholders (including the
        // pk_test_REPLACE_ME / pk_live_REPLACE_ME committed defaults) so a
        // developer without a key can still launch, and a misconfigured
        // release never registers a fake key. Real card flows surface a
        // backend/Stripe error rather than a crash.
        guard !trimmed.isEmpty,
              !trimmed.hasPrefix("$("),
              !trimmed.contains("REPLACE_ME") else { return }
        StripeAPI.defaultPublishableKey = trimmed
    }
}
