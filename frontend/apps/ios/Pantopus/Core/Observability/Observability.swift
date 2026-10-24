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
            // The SDK adds sentry-trace and baggage (trace id, release,
            // environment, Sentry key) to every URLSession request whose URL
            // matches a target, and its default target matches all of them:
            // Stripe, PostHog, storage images. Only the API gets them.
            options.tracePropagationTargets = Self.tracePropagationTargets(apiBaseURL: environment.apiBaseURL)
            options.attachViewHierarchy = false
            options.attachScreenshot = false
            options.sendDefaultPii = false
            options.beforeSend = { event in
                // A link the server couldn't preview answers 502, which is routine.
                if Self.isLinkPreview(event.request?.url) { return nil }
                Self.scrubPII(from: event)
                return event
            }
            options.beforeBreadcrumb = { breadcrumb in
                Self.scrubPII(from: breadcrumb)
                return breadcrumb
            }
            options.beforeSendSpan = { span in
                Self.urlQueryKeys.forEach { span.removeData(key: $0) }
                // An HTTP span names its request in the description and `url`.
                span.spanDescription = span.spanDescription.map(Self.redactBearerPaths)
                if let url = span.data["url"] as? String {
                    span.setData(value: Self.redactBearerPaths(url), key: "url")
                }
                return span
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

    /// Sentry's keys for a request URL's query string and fragment (HTTP
    /// breadcrumbs and spans). Queries carry typed addresses, coordinates,
    /// search terms and signed-URL tokens, so only the path leaves the device.
    private nonisolated static let urlQueryKeys = ["http.query", "http.fragment"]

    /// The API's origin (scheme, host and port) as Sentry's only trace
    /// propagation target. The SDK looks for a string or regex target anywhere
    /// in a URL, so another host's URL carrying the API's address would
    /// match; this pattern is anchored to the start and ends at the port. No
    /// target, so no headers, if the base URL has no host.
    private nonisolated static func tracePropagationTargets(apiBaseURL: URL) -> [NSRegularExpression] {
        guard let scheme = apiBaseURL.scheme, let host = apiBaseURL.host else { return [] }
        let origin = "\(scheme)://\(host)" + (apiBaseURL.port.map { ":\($0)" } ?? "")
        let pattern = "^\(NSRegularExpression.escapedPattern(for: origin))(?:[/?#]|$)"
        guard let target = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return [] }
        return [target]
    }

    /// `GET /api/link-preview?url=` answers 502 for a link that won't load.
    private nonisolated static func isLinkPreview(_ url: String?) -> Bool {
        url?.split(separator: "?").first?.hasSuffix("/api/link-preview") == true
    }

    /// Routes whose last segment is the credential itself: a home invite, a
    /// guest pass, a booking's one-off or manage link (which can cancel or
    /// reschedule it), and the public residency, fridge-card and opt-out
    /// codes. Their URLs leave the device with that segment redacted, as the
    /// backend's request log does (`BEARER_CODE_PATH`, backend/app.js).
    private nonisolated static let bearerPathPattern =
        #"(/api/(?:homes/invitations/token|homes/guest|homes/shared|public/book/o|public/booking|"#
            + #"public/residency-letters|public/residency-claims|public/fridge-cards|public/block-invites/opt-out))"#
            + #"/[^/?#\s]+"#

    /// `value` (a URL, or a span's "GET <url>") with every bearer credential
    /// in its path replaced by `[redacted]`.
    private nonisolated static func redactBearerPaths(_ value: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: bearerPathPattern, options: [.caseInsensitive]) else {
            return value
        }
        let range = NSRange(value.startIndex..., in: value)
        return regex.stringByReplacingMatches(in: value, range: range, withTemplate: "$1/\(redacted)")
    }

    private nonisolated static func scrubPII(from event: Event) {
        // A failed-request event keeps the method, path and status: no query,
        // fragment or request headers. The SDK drops only a short list of
        // headers, so the device id, DPoP proof and step-up token would leave.
        event.request?.url = event.request?.url.map(redactBearerPaths)
        event.request?.queryString = nil
        event.request?.fragment = nil
        event.request?.headers = nil
        // The app's own reports name the request too ("API GET <path> -> 503").
        if let message = event.message {
            let scrubbed = SentryMessage(formatted: redactBearerPaths(message.formatted))
            scrubbed.message = message.message.map(redactBearerPaths)
            scrubbed.params = message.params
            event.message = scrubbed
        }
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
            for key in urlQueryKeys {
                data[key] = nil
            }
            if let url = data["url"] as? String {
                data["url"] = redactBearerPaths(url)
            }
            scrubInPlace(&data)
            breadcrumb.data = data
        }
        if let message = breadcrumb.message {
            breadcrumb.message = redact(emailLikePattern: redactBearerPaths(message))
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
