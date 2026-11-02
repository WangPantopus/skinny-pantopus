//
//  AssistantPushActions.swift
//  Pantopus
//
//  Buttons on the assistant's notifications
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §9): Mark done
//  on a single household task, Mark solved on the person's answered question,
//  and Fewer like this on every suggestion. Each runs in the background,
//  only for the account the push was for and never behind App Lock: the
//  push's card request is checked against the card allowlist and the
//  narrower list below, sent, and reported as the card's state (§4.2). On
//  success the notification goes; on any failure a local notification says
//  so and opens the nudge in the assistant.
//

import UserNotifications

/// What an assistant push carries (`notificationId`, `recipient_user_id`, `conversation_id`,
/// `assistant_action`).
struct AssistantPushPayload {
    /// The card's own request, as the engine stored it (`assistant_action`, a JSON string).
    struct Action: Decodable {
        let cardId: String?
        let itemId: String?
        let actionId: String
        let method: String
        let path: String
        let body: JSONValue?

        private enum CodingKeys: String, CodingKey {
            case method, path, body
            case cardId = "card_id"
            case itemId = "item_id"
            case actionId = "action_id"
        }
    }

    let notificationId: String?
    let recipient: String?
    let conversationId: String?
    let action: Action?
    /// The delivered notification, removed once its button went through.
    let requestIdentifier: String

    init(userInfo: [AnyHashable: Any], requestIdentifier: String) {
        notificationId = userInfo["notificationId"] as? String ?? userInfo["notification_id"] as? String
        recipient = userInfo["recipient_user_id"] as? String
        conversationId = userInfo["conversation_id"] as? String
        action = (userInfo["assistant_action"] as? String)
            .flatMap { $0.data(using: .utf8) }
            .flatMap { try? JSONDecoder().decode(Action.self, from: $0) }
        self.requestIdentifier = requestIdentifier
    }
}

@MainActor
enum AssistantPushActions {
    nonisolated static let markDone = "ASSISTANT_MARK_DONE"
    nonisolated static let markSolved = "ASSISTANT_MARK_SOLVED"
    nonisolated static let fewer = "ASSISTANT_FEWER"

    static let all: Set<String> = [markDone, markSolved, fewer]

    /// The five categories the nudge engine sets (§9.2). Every button needs the phone unlocked,
    /// and none opens the app.
    nonisolated static var categories: [UNNotificationCategory] {
        let done = UNNotificationAction(identifier: markDone, title: "Mark done", options: [.authenticationRequired])
        let solved = UNNotificationAction(identifier: markSolved, title: "Mark solved", options: [.authenticationRequired])
        let fewerLikeThis = UNNotificationAction(identifier: fewer, title: "Fewer like this", options: [.authenticationRequired])
        let category = { (identifier: String, actions: [UNNotificationAction]) in
            UNNotificationCategory(identifier: identifier, actions: actions, intentIdentifiers: [], options: [])
        }
        return [
            category("ASSISTANT_SUGGESTION", [fewerLikeThis]),
            category("ASSISTANT_DONE", [done, fewerLikeThis]),
            category("ASSISTANT_SOLVED", [solved, fewerLikeThis]),
            category("ASSISTANT_DONE_ONLY", [done]),
            category("ASSISTANT_SOLVED_ONLY", [solved])
        ]
    }

    static let failureTitle = "Couldn\u{2019}t mark it done."
    static let failureBody = "Tap to open it in Pantopus."

    /// Runs one button. Anything that doesn't go through leaves the note that opens the nudge.
    static func handle(action: String, payload: AssistantPushPayload) async {
        guard all.contains(action), let notificationId = payload.notificationId, UUID(uuidString: notificationId) != nil else { return }
        let auth = AuthManager.shared
        if auth.state == .unknown { await auth.restoreSession() }
        guard case let .signedIn(user) = auth.state, let recipient = payload.recipient,
              recipient.lowercased() == user.id.lowercased() else {
            await notifyFailure(payload, notificationId: notificationId, message: nil)
            return
        }
        AppLockManager.shared.configure(userID: user.id)
        guard !AppLockManager.shared.isLocked, let send = send(for: action, payload: payload, notificationId: notificationId) else {
            await notifyFailure(payload, notificationId: notificationId, message: nil)
            return
        }
        do {
            let response = try await APIClient.shared.requestDataResponse(send.endpoint, includingForbidden: true, includingNotFound: true)
            guard (200..<300).contains(response.response.statusCode) else {
                await notifyFailure(payload, notificationId: notificationId, message: serverMessage(response.data))
                return
            }
        } catch let APIError.clientError(_, body) {
            await notifyFailure(payload, notificationId: notificationId, message: body.flatMap { serverMessage(Data($0.utf8)) })
            return
        } catch {
            await notifyFailure(payload, notificationId: notificationId, message: nil)
            return
        }
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [payload.requestIdentifier])
        if let cardId = send.cardId {
            await AICardStateReporter.report(send.report, cardId: cardId, userId: user.id)
        }
        changed(send.endpoint.path)
    }

    /// What a button sends, and what it reports for its card.
    private struct Send {
        let endpoint: Endpoint
        let cardId: String?
        let report: AICardStateReport
    }

    /// Fewer like this for the nudge; Mark done or Mark solved only when the push's card request is one a
    /// notification may send.
    private static func send(for action: String, payload: AssistantPushPayload, notificationId: String) -> Send? {
        switch action {
        case fewer:
            return Send(
                endpoint: Endpoint(method: .post, path: "/api/ai/nudges/\(notificationId.lowercased())/fewer"),
                cardId: payload.action?.cardId,
                report: .done(actionId: "fewer", itemId: nil, link: nil)
            )
        case markDone, markSolved:
            guard let card = payload.action, let endpoint = permitted(card, markDone: action == markDone) else { return nil }
            return Send(endpoint: endpoint, cardId: card.cardId, report: .done(actionId: card.actionId, itemId: card.itemId, link: nil))
        default:
            return nil
        }
    }

    /// The card's request when it is one a notification may send: on the card allowlist, and
    /// exactly a task marked done (`PUT /api/homes/:id/tasks/:id` with `{ "status": "done" }`)
    /// or the person's question marked solved (`PATCH /api/posts/:id/solve`).
    static func permitted(_ card: AssistantPushPayload.Action, markDone: Bool) -> Endpoint? {
        let request = AIActionCardDTO.Request(method: card.method, path: card.path, body: card.body, headers: nil)
        guard let endpoint = AIActionAllowlist.endpoint(for: request) else { return nil }
        let segments = card.path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        let uuid = { (raw: String) in raw.count == 36 && UUID(uuidString: raw) != nil }
        if markDone {
            guard endpoint.method == .put, segments.count == 6, segments[1] == "api", segments[2] == "homes", uuid(segments[3]),
                  segments[4] == "tasks", uuid(segments[5]),
                  let body = card.body?.dictValue, body.count == 1, body["status"]?.stringValue == "done" else { return nil }
        } else {
            guard endpoint.method == .patch, segments.count == 5, segments[1] == "api", segments[2] == "posts", uuid(segments[3]),
                  segments[4] == "solve" else { return nil }
        }
        return endpoint
    }

    /// The server's own words when the task changed or is gone.
    private static func serverMessage(_ data: Data?) -> String? {
        guard let data, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let text = (object["message"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return text?.isEmpty == false ? text : nil
    }

    /// "Couldn't mark it done. Tap to open it in Pantopus." as a local notification that opens
    /// the nudge in the assistant, or the server's own sentence when it sent one. It takes the
    /// original's place, as on Android.
    private static func notifyFailure(_ payload: AssistantPushPayload, notificationId: String, message: String?) async {
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [payload.requestIdentifier])
        let content = UNMutableNotificationContent()
        content.title = message == nil ? failureTitle : "Pantopus"
        content.body = message.map { "\($0) \(failureBody)" } ?? failureBody
        content.sound = nil
        var userInfo: [String: Any] = [
            "type": "assistant_nudge",
            "notificationId": notificationId.lowercased(),
            "link": "pantopus://assistant?nudge=\(notificationId.lowercased())"
        ]
        if let recipient = payload.recipient { userInfo["recipient_user_id"] = recipient }
        if let conversationId = payload.conversationId { userInfo["conversation_id"] = conversationId }
        content.userInfo = userInfo
        let request = UNNotificationRequest(identifier: "assistant-failed-\(notificationId.lowercased())", content: content, trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }

    /// Screens showing the task or the post read it again.
    private static func changed(_ path: String) {
        let parts = path.split(separator: "/").map(String.init)
        guard parts.count >= 3 else { return }
        let topics: Set<String>
        switch parts[1] {
        case "homes": topics = [ScreenTopic.home(parts[2]), ScreenTopic.today]
        case "posts": topics = [ScreenTopic.post(parts[2])]
        default: return
        }
        ScreenStore.shared.markStale(topics: topics)
        NotificationCenter.default.post(name: .screenStoreChanged, object: nil, userInfo: ["topics": topics])
    }
}
