//
//  Observability.swift
//  Pantopus
//
//  Single entry point for crash reporting, error capture, and analytics.
//  Everything else in the app goes through `Observability.shared` so we can
//  swap the backend (Sentry, Firebase, …) without touching call sites.
//

import Foundation
import Logging
import Sentry

@MainActor
final class Observability {
    static let shared = Observability()

    private let logger = Logger(label: "app.pantopus.ios.Observability")
    private(set) var isStarted = false

    private init() {}

    /// Call once from `AppDelegate.didFinishLaunching`. Safe to call again — no-ops after the first invocation.
    func start(environment: AppEnvironment) {
        guard !isStarted else { return }
        isStarted = true

        let dsn = Bundle.main.object(forInfoDictionaryKey: "SentryDSN") as? String ?? ""
        guard !dsn.isEmpty else {
            logger.info("Sentry DSN not set — skipping crash reporting init")
            return
        }

        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = environment.target.rawValue
            options.releaseName = Self.releaseName
            options.enableAutoSessionTracking = true
            options.enableAutoPerformanceTracing = true
            options.tracesSampleRate = environment.target == .production ? 0.1 : 1.0
            options.enableUserInteractionTracing = true
            options.enableNetworkTracking = true
            options.attachViewHierarchy = false
            options.attachScreenshot = false
            options.sendDefaultPii = false
            options.beforeSend = { event in
                Self.scrubPII(from: event)
                return event
            }
            options.beforeBreadcrumb = { breadcrumb in
                Self.scrubPII(from: breadcrumb)
                return breadcrumb
            }
        }

        // Tag every event with platform context so Sentry's search /
        // grouping understands which build hit the failure (P15).
        SentrySDK.configureScope { scope in
            scope.setTag(value: Self.appVersion, key: "app_version")
            scope.setTag(value: Self.osVersion, key: "os_version")
            scope.setTag(value: Self.deviceModel, key: "device_model")
        }

        logger.info("Sentry started", metadata: ["env": .string(environment.target.rawValue)])
    }

    // MARK: - PII scrubbing

    /// Keys whose values get redacted before they leave the device.
    /// Matched case-insensitively against `extra` / `data` keys.
    private nonisolated static let piiKeys: Set<String> = [
        "email", "emailaddress", "email_address",
        "phone", "phonenumber", "phone_number", "telephone",
        "address", "street", "streetaddress", "street_address",
        "city", "state", "zip", "zipcode", "zip_code", "postalcode", "postal_code",
        "fullname", "name", "firstname", "first_name", "lastname", "last_name",
        "password", "token", "authorization", "auth", "secret"
    ]

    private nonisolated static let redacted = "[redacted]"

    private nonisolated static func scrubPII(from event: Event) {
        if var extra = event.extra {
            scrubInPlace(&extra)
            event.extra = extra
        }
        // The breadcrumb pipeline runs through beforeBreadcrumb too —
        // re-apply here for breadcrumbs that were attached pre-scrub.
        event.breadcrumbs?.forEach { Self.scrubPII(from: $0) }
    }

    private nonisolated static func scrubPII(from breadcrumb: Breadcrumb) {
        if var data = breadcrumb.data {
            scrubInPlace(&data)
            breadcrumb.data = data
        }
        if let message = breadcrumb.message {
            breadcrumb.message = redact(emailLikePattern: message)
        }
    }

    private nonisolated static func scrubInPlace(_ dict: inout [String: Any]) {
        for key in dict.keys {
            if piiKeys.contains(key.lowercased()) {
                dict[key] = redacted
            } else if let nested = dict[key] as? [String: Any] {
                var copy = nested
                scrubInPlace(&copy)
                dict[key] = copy
            } else if let str = dict[key] as? String {
                dict[key] = redact(emailLikePattern: str)
            }
        }
    }

    /// Replace anything that looks like an email or phone with `[redacted]`.
    /// Catches PII that slipped into free-form messages.
    private nonisolated static func redact(emailLikePattern value: String) -> String {
        var result = value
        let patterns = [
            #"[\w.+-]+@[\w-]+\.[\w.-]+"#,
            #"\+?\d[\d\s().-]{7,}"#
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern) {
                let range = NSRange(result.startIndex..., in: result)
                result = regex.stringByReplacingMatches(
                    in: result,
                    range: range,
                    withTemplate: redacted
                )
            }
        }
        return result
    }

    // MARK: - Error capture

    func capture(_ error: any Error, file: StaticString = #fileID, line: UInt = #line) {
        logger.error("\(error)", metadata: ["file": .string("\(file):\(line)")])
        guard isStarted else { return }
        SentrySDK.capture(error: error)
    }

    func capture(message: String, level: SentryLevel = .warning) {
        logger.warning("\(message)")
        guard isStarted else { return }
        SentrySDK.capture(message: message) { scope in
            scope.setLevel(level)
        }
    }

    // MARK: - User context

    func identify(userId: String?, email: String? = nil) {
        guard isStarted else { return }
        if let userId {
            let user = User(userId: userId)
            user.email = email
            SentrySDK.setUser(user)
        } else {
            SentrySDK.setUser(nil)
        }
    }

    // MARK: - Breadcrumbs & analytics

    /// Mirror an analytics event into the crash context: a structured log +
    /// Sentry breadcrumb, so the event shows up as context on the next crash.
    /// The product-analytics vendor (PostHog) is a separate sink — see
    /// `Analytics.track`, which fans out to both this method and
    /// `PostHogAnalytics`.
    func track(_ name: String, properties: [String: String] = [:]) {
        logger.info("analytics", metadata: [
            "event": .string(name),
            "props": .string(properties.description)
        ])
        guard isStarted else { return }
        let crumb = Breadcrumb(level: .info, category: "analytics")
        crumb.message = name
        crumb.data = properties
        SentrySDK.addBreadcrumb(crumb)
    }

    // MARK: - Release tag + device info

    private static var releaseName: String {
        "app.pantopus.ios@\(appVersion)+\(buildNumber)"
    }

    private static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }

    private static var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
    }

    private static var osVersion: String {
        let v = ProcessInfo.processInfo.operatingSystemVersion
        return "iOS \(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }

    /// Device hardware identifier (e.g. "iPhone15,2"). Strictly
    /// hardware — no per-user data — so safe to ship to Sentry.
    private static var deviceModel: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        return machineMirror.children.reduce(into: "") { partial, element in
            guard let value = element.value as? Int8, value != 0 else { return }
            partial.append(Character(UnicodeScalar(UInt8(value))))
        }
    }
}
