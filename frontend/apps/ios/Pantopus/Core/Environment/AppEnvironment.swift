//
//  AppEnvironment.swift
//  Pantopus
//
//  Centralised configuration. Values come from Info.plist build settings
//  or a local .env file (loaded in Debug only via BuildSettings).
//

import Foundation

@Observable
final class AppEnvironment: @unchecked Sendable {
    enum Target: String, CaseIterable {
        case local
        case staging
        case production

        /// Selected from scheme env variable `PANTOPUS_API_ENV` first.
        /// When unset (release builds installed from TestFlight / App
        /// Store don't carry scheme env) we fall back per build
        /// configuration: Debug → `.local`, Staging → `.staging`,
        /// Release → `.production`. The STAGING flag is set only by the
        /// Staging configuration (see project.yml).
        static var current: Target {
            if let raw = ProcessInfo.processInfo.environment["PANTOPUS_API_ENV"],
               let target = Target(rawValue: raw) {
                return target
            }
            #if DEBUG
            return .local
            #elseif STAGING
            return .staging
            #else
            return .production
            #endif
        }
    }

    let target: Target
    let apiBaseURL: URL
    let socketURL: URL
    let stripePublishableKey: String

    static let current = AppEnvironment()

    private init() {
        let target = Target.current
        self.target = target

        switch target {
        case .local:
            // Dev points at the Mac/simulator host — http is expected here.
            apiBaseURL = Self.bundleURL(
                forInfoKey: "PantopusAPIBaseURL",
                fallback: "http://localhost:8000"
            )
            socketURL = Self.bundleURL(
                forInfoKey: "PantopusSocketURL",
                fallback: "http://localhost:8000"
            )
        case .staging:
            // Driven by Config/Pantopus.Staging.xcconfig → Info.plist, with
            // the canonical staging host as the safety net.
            apiBaseURL = Self.secureBundleURL(
                forInfoKey: "PantopusAPIBaseURL",
                fallback: "https://staging.api.pantopus.app"
            )
            socketURL = Self.secureBundleURL(
                forInfoKey: "PantopusSocketURL",
                fallback: "https://staging.api.pantopus.app"
            )
        case .production:
            // Driven by Config/Pantopus.Release.xcconfig → Info.plist, with
            // the canonical prod host as the safety net. The https guard means
            // a stray localhost/test value can never leak into a prod build.
            apiBaseURL = Self.secureBundleURL(
                forInfoKey: "PantopusAPIBaseURL",
                fallback: "https://api.pantopus.app"
            )
            socketURL = Self.secureBundleURL(
                forInfoKey: "PantopusSocketURL",
                fallback: "https://api.pantopus.app"
            )
        }

        // Stripe publishable key — read from Info.plist so it can be injected
        // per-configuration via xcconfig. Never commit a real key here.
        stripePublishableKey = Bundle.main.object(forInfoDictionaryKey: "StripePublishableKey") as? String ?? ""
    }

    private static func mustURL(_ string: String) -> URL {
        guard let url = URL(string: string) else {
            preconditionFailure("Invalid URL literal: \(string)")
        }
        return url
    }

    private static func bundleURL(forInfoKey key: String, fallback: String) -> URL {
        let configured = Bundle.main.object(forInfoDictionaryKey: key) as? String
        let trimmed = configured?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let value = trimmed.isEmpty || trimmed.hasPrefix("$(") ? fallback : trimmed
        return mustURL(value)
    }

    /// Like `bundleURL`, but only honours the Info.plist value when it is a
    /// real `https://` URL. Empty, unsubstituted (`$(…)`), or non-https
    /// values fall back to the canonical host — so staging/prod builds can
    /// never silently point at localhost or an http origin.
    private static func secureBundleURL(forInfoKey key: String, fallback: String) -> URL {
        let configured = Bundle.main.object(forInfoDictionaryKey: key) as? String
        let trimmed = configured?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let value = trimmed.hasPrefix("https://") ? trimmed : fallback
        return mustURL(value)
    }
}
