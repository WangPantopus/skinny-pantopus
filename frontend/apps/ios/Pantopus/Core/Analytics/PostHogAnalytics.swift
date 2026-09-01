//
//  PostHogAnalytics.swift
//  Pantopus
//
//  Product-analytics vendor (PostHog) sitting behind the `Analytics` facade.
//  This is the iOS half of the cross-platform pair — the Android counterpart
//  is `data/analytics/PostHogAnalytics.kt`. Both send the SAME event names
//  (the closed `AnalyticsEvent` taxonomy) to the SAME vendor.
//
//  Gating: a no-op until `start` finds a non-empty `PostHogAPIKey` in
//  Info.plist (resolved from the xcconfig / .env `POSTHOG_API_KEY`). Dev and
//  CI builds leave the key blank, so nothing is sent there; beta / prod flip
//  it on with no code change — exactly how `SentryDSN` gates crash reporting.
//
//  Privacy: autocapture is OFF (manual events only), no IDFA / advertising
//  identifier is collected (so `NSPrivacyTracking` stays false and no ATT
//  prompt is required), and event properties are PII-scrubbed before send.
//

import Foundation
import Logging
import PostHog

@MainActor
final class PostHogAnalytics {
    static let shared = PostHogAnalytics()

    private let logger = Logger(label: "app.pantopus.ios.Analytics")
    private(set) var isStarted = false

    private init() {}

    /// Call once from `AppDelegate.didFinishLaunching` (via `Analytics.start`).
    /// Safe to call again — no-ops after the first successful start.
    func start(environment: AppEnvironment) {
        guard !isStarted else { return }

        let apiKey = (Bundle.main.object(forInfoDictionaryKey: "PostHogAPIKey") as? String) ?? ""
        guard !apiKey.isEmpty else {
            logger.info("PostHog API key not set — product analytics disabled")
            return
        }

        let host = Self.host
        let config = PostHogConfig(apiKey: apiKey, host: host)
        // Manual, explicit events ONLY. The taxonomy lives in `AnalyticsEvent`;
        // nothing reaches the wire that isn't declared there.
        config.captureScreenViews = false
        config.captureApplicationLifecycleEvents = false
        // Keep anonymous sessions from minting person profiles — we only create
        // a person when `identify` is called with the app user id (no PII).
        config.personProfiles = .identifiedOnly

        PostHogSDK.shared.setup(config)
        isStarted = true
        logger.info("PostHog started", metadata: ["env": .string(environment.target.rawValue), "host": .string(host)])
    }

    func capture(_ name: String, properties: [String: String]) {
        guard isStarted else { return }
        PostHogSDK.shared.capture(name, properties: Self.scrubPII(properties))
    }

    /// Associate subsequent events with the app user id (pseudonymous — never
    /// email / name). Mirrors `Observability.identify` so crash + analytics
    /// share the same id.
    func identify(userId: String) {
        guard isStarted else { return }
        PostHogSDK.shared.identify(userId)
    }

    /// Drop the user association (sign-out). Starts a fresh anonymous id.
    func reset() {
        guard isStarted else { return }
        PostHogSDK.shared.reset()
    }

    private static var host: String {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "PostHogHost") as? String) ?? ""
        return configured.isEmpty ? "https://eu.i.posthog.com" : configured
    }

    // MARK: - PII scrubbing

    /// Defense-in-depth: the closed taxonomy already carries no PII, but we
    /// still redact any property whose key looks personal and any value that
    /// matches an email / phone pattern before it leaves the device. Mirrors
    /// the scrubbing in `Observability` and the Android vendor.
    private static let piiKeys: Set<String> = [
        "email", "emailaddress", "email_address",
        "phone", "phonenumber", "phone_number", "telephone",
        "address", "street", "streetaddress", "street_address",
        "city", "state", "zip", "zipcode", "zip_code", "postalcode", "postal_code",
        "fullname", "name", "firstname", "first_name", "lastname", "last_name",
        "password", "token", "authorization", "auth", "secret"
    ]

    private static let redacted = "[redacted]"

    private static func scrubPII(_ properties: [String: String]) -> [String: String] {
        var scrubbed = properties
        for (key, value) in properties {
            if piiKeys.contains(key.lowercased()) {
                scrubbed[key] = redacted
            } else {
                scrubbed[key] = redactPatterns(in: value)
            }
        }
        return scrubbed
    }

    private static func redactPatterns(in value: String) -> String {
        var result = value
        let patterns = [
            #"[\w.+-]+@[\w-]+\.[\w.-]+"#,
            #"\+?\d[\d\s().-]{7,}"#
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern) {
                let range = NSRange(result.startIndex..., in: result)
                result = regex.stringByReplacingMatches(in: result, range: range, withTemplate: redacted)
            }
        }
        return result
    }
}
