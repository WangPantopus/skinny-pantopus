import Foundation

/// Process-local window; interruptions and repeated active callbacks are not sessions.
struct PilotSessionWindow {
    private(set) var opened = false
    private(set) var foreground = false
    private var backgroundAt: TimeInterval?

    mutating func enterForeground(now: TimeInterval) -> Bool {
        guard !foreground else { return false }
        foreground = true
        let shouldOpen = !opened || backgroundAt.map { now - $0 >= 30 * 60 } == true
        opened = true
        backgroundAt = nil
        return shouldOpen
    }

    mutating func enterBackground(now: TimeInterval) {
        guard foreground else { return }
        foreground = false
        backgroundAt = now
    }
}

struct PilotEventBody: Encodable {
    let eventType: String
    let meta: [String: String]
    enum CodingKeys: String, CodingKey { case eventType = "event_type", meta }
}

/// Authenticated pilot measurements. No vendor changes, durable queue or retry loop.
@MainActor
final class PilotEvents {
    enum Event: String {
        case sessionOpen = "session_open"
        case reminderAction = "reminder_action"
        case suggestionDecision = "suggestion_decision"
    }

    static let shared = PilotEvents()
    private let api: APIClient
    private var window = PilotSessionWindow()
    private var pendingOpen = false
    private var pendingActor: String?
    private var pushType: String?
    private var flush: Task<Void, Never>?
    private var pendingReminder: (recipient: String, meta: [String: String])?

    init(api: APIClient = .shared) {
        self.api = api
    }

    func enterForeground(now: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        if window.enterForeground(now: now) {
            pendingOpen = true
            pendingActor = actor
        } else if !pendingOpen {
            pushType = nil
        }
        scheduleOpen()
    }

    func enterBackground(now: TimeInterval = ProcessInfo.processInfo.systemUptime) {
        window.enterBackground(now: now)
        flush?.cancel()
        flush = nil
        pendingOpen = false
        pendingActor = nil
        pushType = nil
    }

    /// Called only for an actual notification response, never for delivery.
    func notificationOpened(type: String?) {
        guard !window.opened || !window.foreground || pendingOpen else { return }
        pushType = Self.identifier(type) ?? "unknown"
        scheduleOpen()
    }

    func authChanged() {
        if let pendingActor, actor != pendingActor {
            pendingOpen = false
            pushType = nil
        }
        scheduleOpen()
        if let reminder = pendingReminder {
            let auth = api.authProvider ?? AuthManager.shared
            if auth.state == .unknown { return }
            pendingReminder = nil
            if actor == reminder.recipient { record(.reminderAction, meta: reminder.meta) }
        }
    }

    /// Only defer through cold auth hydration; expired/signed-out actors are refused.
    func reminderOpened(recipient: String, meta: [String: String]) {
        let auth = api.authProvider ?? AuthManager.shared
        if auth.state == .unknown {
            pendingReminder = (recipient, meta)
        } else if actor == recipient {
            record(.reminderAction, meta: meta)
        }
    }

    func record(_ event: Event, meta: [String: String]) {
        let scope = HomeClaimSessionScope(api: api)
        Task { @MainActor in
            guard scope.isCurrent else { return }
            await send(event, meta: meta, scope: scope)
        }
    }

    func send(_ event: Event, meta: [String: String], scope: HomeClaimSessionScope? = nil) async {
        let scope = scope ?? HomeClaimSessionScope(api: api)
        guard actor != nil, scope.isCurrent else { return }
        let body = Self.payload(event, meta: meta)
        // POSTs are not transport-retried by APIClient. Normal auth refresh remains.
        _ = try? await api.request(Endpoint(
            method: .post, path: "/api/hub/funnel-events", body: body,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeout: 5,
            dispatchGuard: { try scope.requireCurrent() }
        ))
    }

    static func payload(_ event: Event, meta: [String: String]) -> PilotEventBody {
        var safe = meta.filter { key, value in
            guard value.utf16.count <= 40 else { return false }
            switch key {
            case "platform": return ["ios", "android"].contains(value)
            case "trigger": return ["push", "organic"].contains(value)
            case "push_type": return identifier(value) != nil
            case "kind": return ["pickup", "task"].contains(value)
            case "action": return ["bins_out", "done", "not_now"].contains(value)
            case "date": return value.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil
            case "suggestion": return value == "radon_test"
            case "decision": return ["already_tested", "reminder_added", "not_now"].contains(value)
            default: return false
            }
        }
        safe["platform"] = "ios"
        return PilotEventBody(eventType: event.rawValue, meta: safe)
    }

    private static func identifier(_ value: String?) -> String? {
        guard let value, value.utf16.count <= 40,
              value.range(of: "^[a-z][a-z0-9_]*$", options: .regularExpression) != nil else { return nil }
        return value
    }

    private var actor: String? {
        let auth = api.authProvider ?? AuthManager.shared
        guard case let .signedIn(user) = auth.state, auth.accessToken != nil else { return nil }
        return user.id
    }

    private func scheduleOpen() {
        guard pendingOpen, window.foreground, actor != nil else { return }
        flush?.cancel()
        // Let the notification response and auth hydration join the same foreground
        // transition before classifying it. Consuming the window precedes dispatch.
        flush = Task { @MainActor in
            do { try await Task.sleep(for: .seconds(1)) } catch { return }
            guard pendingOpen, window.foreground, let actor,
                  pendingActor == nil || pendingActor == actor else { return }
            pendingOpen = false
            pendingActor = nil
            var meta = ["trigger": pushType == nil ? "organic" : "push"]
            if let pushType { meta["push_type"] = pushType }
            pushType = nil
            await send(.sessionOpen, meta: meta)
        }
    }
}
