//
//  SchedulingFeatureFlags.swift
//  Pantopus
//
//  Gates the PAID Calendarly surfaces (priced event types, packages, invoices,
//  payouts, deposits/refund policy). Payout settlement is deferred server-side
//  and charges run in Stripe TEST mode — so the paid surface ships behind this
//  flag, defaulting OFF. Toggle via UserDefaults (a debug/dev settings switch)
//  or the `SCHEDULING_PAID_ENABLED` environment override (tests / scheme env).
//

import Foundation

/// Feature flags for Calendarly. Read-only from feature code via the static
/// accessors; the paid flag also has a setter for a debug toggle.
public enum SchedulingFeatureFlags {
    /// UserDefaults key backing `paidEnabled`.
    public static let paidEnabledDefaultsKey = "scheduling.paidEnabled"

    /// Whether priced scheduling surfaces are enabled. Default OFF.
    ///
    /// Resolution order: the `SCHEDULING_PAID_ENABLED` environment variable
    /// ("1"/"true" → on) wins when present (tests + scheme env); otherwise the
    /// `UserDefaults` value (default `false`).
    public static var paidEnabled: Bool {
        get {
            if let raw = ProcessInfo.processInfo.environment["SCHEDULING_PAID_ENABLED"] {
                return raw == "1" || raw.lowercased() == "true"
            }
            return UserDefaults.standard.bool(forKey: paidEnabledDefaultsKey)
        }
        set {
            UserDefaults.standard.set(newValue, forKey: paidEnabledDefaultsKey)
        }
    }
}
