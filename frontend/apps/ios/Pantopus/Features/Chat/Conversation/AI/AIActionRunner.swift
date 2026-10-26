//
//  AIActionRunner.swift
//  Pantopus
//
//  One tap on a Pantopus AI action card (contract
//  `docs/product/ai-assistant-phase1-contract-2026-10-20.md`, section 4.3,
//  with the phase 2 additions in
//  `docs/product/ai-assistant-phase2-contract-2026-10-20.md`, section 8.1).
//  The card's request goes out only when it is on the allowlist, through the
//  signed-in API client, so the endpoint's own permissions, validation and
//  notifications apply. A follow-up runs after it with the reply's values
//  filled in, and an error shows the server's own words.
//

import Foundation

/// The requests an action card may send: these methods and paths, where `:id`
/// is a uuid and `:system` one of a home's six system keys, with no header
/// but `x-pantopus-session-scope`.
enum AIActionAllowlist {
    static let sessionScopeHeader = "x-pantopus-session-scope"

    /// The systems a `home_system` card can date (`PUT /api/homes/:id/systems/:key`).
    static let systemKeys: Set<String> = ["roof", "hvac", "water_heater", "electrical_panel", "sewer_septic", "windows"]

    private static let routes: [(method: Endpoint.Method, path: String)] = [
        (.post, "/api/plans"),
        (.patch, "/api/plans/:id"),
        (.post, "/api/plans/:id/cancel"),
        (.post, "/api/plans/:id/requests"),
        (.post, "/api/plans/:id/requests/:id/accept"),
        (.post, "/api/plans/:id/requests/:id/decline"),
        (.post, "/api/chat/messages"),
        (.post, "/api/posts/:id/comments"),
        (.patch, "/api/posts/:id/solve"),
        (.post, "/api/homes/:id/tasks"),
        // Phase 2: a system's installed year, a task's status, date or
        // owner, and an appliance.
        (.put, "/api/homes/:id/systems/:system"),
        (.put, "/api/homes/:id/tasks/:id"),
        (.post, "/api/homes/:id/assets"),
        (.post, "/api/homes/:id/tasks/:id/recurrence"),
        (.put, "/api/hub/preferences"),
        (.put, "/api/posts/feed-preferences"),
        // Phase 2: a nudge's "Fewer like this".
        (.post, "/api/ai/nudges/:id/fewer")
    ]

    /// The request as an endpoint, or nil when the app never sends it: a
    /// method or path off the list, another header, or a body that isn't a
    /// JSON object.
    static func endpoint(for request: AIActionCardDTO.Request) -> Endpoint? {
        guard let method = request.method.flatMap({ Endpoint.Method(rawValue: $0.uppercased()) }),
              let path = request.path, permits(method: method, path: path) else { return nil }
        var headers: [String: String] = [:]
        for (name, value) in request.headers ?? [:] {
            guard name.lowercased() == sessionScopeHeader,
                  let scope = value.stringValue, !scope.isEmpty, !scope.contains(where: \.isNewline) else { return nil }
            headers[sessionScopeHeader] = scope
        }
        if let body = request.body, body.dictValue == nil { return nil }
        // 30 s: a plan is checked against the host's other plans and the map before it posts.
        return Endpoint(method: method, path: path, body: request.body, headers: headers, timeout: 30)
    }

    static func permits(method: Endpoint.Method, path: String) -> Bool {
        let segments: [String] = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        for route in routes where route.method == method && matches(pattern: route.path, segments: segments) {
            return true
        }
        return false
    }

    /// A nudge's or the brief's "Fewer like this" (`POST /api/ai/nudges/:id/fewer`), which the
    /// server takes on an expired nudge too (phase 2 contract §3.6).
    static func isFewerLikeThis(_ request: AIActionCardDTO.Request) -> Bool {
        guard request.method.flatMap({ Endpoint.Method(rawValue: $0.uppercased()) }) == .post, let path = request.path else { return false }
        let segments: [String] = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        return matches(pattern: "/api/ai/nudges/:id/fewer", segments: segments)
    }

    /// One route's path, segment by segment; `:id` takes only a uuid and
    /// `:system` only a system key.
    private static func matches(pattern: String, segments: [String]) -> Bool {
        let expected: [String] = pattern.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard expected.count == segments.count else { return false }
        for (want, have) in zip(expected, segments) {
            if want == ":id" {
                guard have.count == 36, UUID(uuidString: have) != nil else { return false }
            } else if want == ":system" {
                guard systemKeys.contains(have) else { return false }
            } else if want != have {
                return false
            }
        }
        return true
    }
}

/// `{{response.a.b}}` in a follow-up's path, its body's top-level strings and
/// the done link: the value at that dot path in the reply to the request just
/// sent.
enum AIActionPlaceholders {
    /// The text with every placeholder filled in, or nil when one has no value.
    static func fill(_ text: String, from reply: Any?) -> String? {
        let placeholder = #/\{\{\s*response\.([A-Za-z0-9_.\-]+)\s*\}\}/#
        var result = ""
        var rest = text[...]
        while let match = rest.firstMatch(of: placeholder) {
            guard let value = scalar(at: String(match.output.1), in: reply) else { return nil }
            result += String(rest[..<match.range.lowerBound])
            result += value
            rest = rest[match.range.upperBound...]
        }
        return result + String(rest)
    }

    /// The follow-up with its placeholders filled in, or nil when one has no value.
    static func fill(_ request: AIActionCardDTO.Request, from reply: Any?) -> AIActionCardDTO.Request? {
        guard let path = request.path.flatMap({ fill($0, from: reply) }) else { return nil }
        var body = request.body
        if let fields = request.body?.dictValue {
            var filled = fields
            for (key, value) in fields {
                guard let text = value.stringValue else { continue }
                guard let resolved = fill(text, from: reply) else { return nil }
                filled[key] = .string(resolved)
            }
            body = .object(filled)
        }
        return AIActionCardDTO.Request(method: request.method, path: path, body: body, headers: request.headers)
    }

    /// A string, number or true/false at the dot path; nil for anything else.
    static func scalar(at path: String, in reply: Any?) -> String? {
        var current = reply
        for key in path.split(separator: ".") {
            if let object = current as? [String: Any] {
                current = object[String(key)]
            } else if let array = current as? [Any], let index = Int(key), array.indices.contains(index) {
                current = array[index]
            } else {
                return nil
            }
        }
        if let text = current as? String { return text }
        guard let number = current as? NSNumber else { return nil }
        if CFGetTypeID(number) == CFBooleanGetTypeID() { return number.boolValue ? "true" : "false" }
        return number.stringValue
    }
}

/// Sends one action's request (and its follow-up) and says how it went.
@MainActor
enum AIActionRunner {
    static let blockedMessage = "This card can\u{2019}t be used in this version of Pantopus."
    static let scopeChangedMessage = "This card is from an earlier sign-in. Ask again."
    static let repeatNotSetNote = "The repeat wasn\u{2019}t set."

    enum Outcome: Equatable {
        case done(ChatAIActionDone)
        case failed(String)
    }

    private enum Sent {
        case reply(Any?)
        case failed(String)
    }

    static func run(_ action: AIActionCardDTO.Action, api: APIClient = .shared) async -> Outcome {
        guard let endpoint = AIActionAllowlist.endpoint(for: action.request) else { return .failed(blockedMessage) }
        let reply: Any?
        switch await send(endpoint, api: api) {
        case let .reply(value): reply = value
        case let .failed(message): return .failed(message)
        }
        changed(by: endpoint, body: action.request.body)
        var note: String?
        if let followUp = action.then {
            if let request = AIActionPlaceholders.fill(followUp.request, from: reply),
               let next = AIActionAllowlist.endpoint(for: request) {
                switch await send(next, api: api) {
                case .reply: changed(by: next, body: request.body)
                case let .failed(message): note = "\(repeatNotSetNote) \(message)"
                }
            } else {
                note = repeatNotSetNote
            }
        }
        let label = action.done?.label.flatMap { $0.isEmpty ? nil : $0 } ?? "Done"
        let link = action.done?.link.flatMap { AIActionPlaceholders.fill($0, from: reply) }
        return .done(ChatAIActionDone(label: label, link: link, note: note))
    }

    private static func send(_ endpoint: Endpoint, api: APIClient) async -> Sent {
        do {
            // 403 and 404 bodies too: the card shows the server's own reason.
            let response = try await api.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            let status = response.response.statusCode
            guard (200..<300).contains(status) else { return .failed(message(status: status, body: response.data)) }
            return .reply(response.data.isEmpty ? nil : try? JSONSerialization.jsonObject(with: response.data))
        } catch let APIError.clientError(status, body) {
            return .failed(message(status: status, body: body.map { Data($0.utf8) }))
        } catch let APIError.server(status, body) {
            return .failed(message(status: status, body: Data(body.utf8)))
        } catch let error as APIError {
            return .failed(error.errorDescription ?? "That didn\u{2019}t work. Try again.")
        } catch {
            return .failed("That didn\u{2019}t work. Try again.")
        }
    }

    /// The server's `message`, else its `error` text. A `409
    /// SESSION_SCOPE_CHANGED` means the card came from an earlier sign-in.
    static func message(status: Int, body: Data?) -> String {
        let object = body.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        let code = (object?["code"] as? String) ?? (object?["error"] as? String)
        if status == 409, code == "SESSION_SCOPE_CHANGED" { return scopeChangedMessage }
        if let text = (object?["message"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
            return text
        }
        if let text = (object?["error"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty,
           !APIError.isMachineCode(text) {
            return text
        }
        if let details = object?["details"] as? [[String: Any]],
           let text = details.compactMap({ $0["message"] as? String }).first(where: { !$0.isEmpty }) {
            return text
        }
        return status >= 500 ? "Something went wrong on our side. Please try again." : "That didn\u{2019}t work. Try again."
    }

    /// Screens showing what the request changed read it again.
    private static func changed(by endpoint: Endpoint, body: JSONValue?) {
        let parts = endpoint.path.split(separator: "/").map(String.init)
        guard parts.count >= 2 else { return }
        let id = parts.count > 2 ? parts[2] : nil
        switch parts[1] {
        case "plans":
            PlansStoreReads.changed(planId: id)
        case "posts":
            PulsePostsRefresh.notifyPostsDidChange()
            if let id { signal([ScreenTopic.post(id)]) }
        case "homes":
            if let id { signal([ScreenTopic.home(id), ScreenTopic.today]) }
        case "chat":
            let room = body?.dictValue?["roomId"]?.stringValue
            signal(Set([ScreenTopic.chats] + (room.map { [ScreenTopic.chat($0)] } ?? [])))
        case "hub", "ai":
            // Notification settings show the switches and "Fewer like this" mutes.
            signal([ScreenTopic.profileMe])
        default:
            break
        }
    }

    private static func signal(_ topics: Set<String>) {
        ScreenStore.shared.markStale(topics: topics)
        NotificationCenter.default.post(name: .screenStoreChanged, object: nil, userInfo: ["topics": topics])
    }
}

/// Which action cards' taps went through, kept on the device so a card
/// restored from history still shows as done after a relaunch (contract
/// section 4.3, step 5), and which cards were put away with "Not now". Card
/// ids are uuids, so one account's records never match another's cards. They
/// stay through a sign-out: signing back in must not offer a finished card
/// again, since a plan or a message sent from one would go out twice.
@MainActor
final class AIActionDoneStore {
    static let shared = AIActionDoneStore()

    private struct Saved: Codable {
        var done: [String: Entry] = [:]
        var dismissed: [String: Date] = [:]
    }

    private struct Entry: Codable {
        let done: ChatAIActionDone
        let at: Date
    }

    private static let storageKey = "pantopus.ai.actionCards.v1"
    /// Old records go first past this many; a card that old is long gone from the thread.
    private static let limit = 500
    private let defaults: UserDefaults
    private var saved: Saved

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        saved = defaults.data(forKey: Self.storageKey).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) } ?? Saved()
    }

    /// The key for one action: the card, the row it sits on (if any) and the action.
    nonisolated static func key(cardId: String, itemId: String?, actionId: String) -> String {
        "\(cardId)|\(itemId ?? "")|\(actionId)"
    }

    func done(forKey key: String) -> ChatAIActionDone? {
        saved.done[key]?.done
    }

    func record(_ done: ChatAIActionDone, forKey key: String) {
        saved.done[key] = Entry(done: done, at: Date())
        persist()
    }

    func isDismissed(cardId: String) -> Bool {
        saved.dismissed[cardId] != nil
    }

    func dismiss(cardId: String) {
        saved.dismissed[cardId] = Date()
        persist()
    }

    /// A deleted conversation's cards: nothing of them stays on the device.
    func forget(cardIds: Set<String>) {
        guard !cardIds.isEmpty else { return }
        saved.done = saved.done.filter { key, _ in
            !cardIds.contains(String(key.prefix { $0 != "|" }))
        }
        saved.dismissed = saved.dismissed.filter { !cardIds.contains($0.key) }
        persist()
    }

    private func persist() {
        if saved.done.count > Self.limit {
            let oldest = saved.done.sorted { $0.value.at < $1.value.at }.prefix(saved.done.count - Self.limit)
            for (key, _) in oldest {
                saved.done[key] = nil
            }
        }
        if saved.dismissed.count > Self.limit {
            let oldest = saved.dismissed.sorted { $0.value < $1.value }.prefix(saved.dismissed.count - Self.limit)
            for (key, _) in oldest {
                saved.dismissed[key] = nil
            }
        }
        if let data = try? JSONEncoder().encode(saved) {
            defaults.set(data, forKey: Self.storageKey)
        }
    }
}
