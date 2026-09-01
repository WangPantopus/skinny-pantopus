//
//  PersonaDmThreadViewModel.swift
//  Pantopus
//
//  Backs the persona-DM thread (A15.4 / A15.5). Reads
//  `GET /api/personas/:id/dms/threads/:threadId`
//  (`backend/routes/personaDms.js:235`) — which doubles as the mark-read
//  call — and appends via
//  `POST /api/personas/:id/dms/threads/:threadId/messages`
//  (`backend/routes/personaDms.js:314`).
//
//  Send failures that the backend treats as first-class states get their
//  own copy: a `403 blocked` is not "request failed", it is "this profile
//  can't accept new messages from your account".
//

import Foundation
import Observation

@Observable
@MainActor
public final class PersonaDmThreadViewModel {
    public private(set) var state: PersonaDmThreadState = .loading

    /// Composer text. Bound directly by the view.
    public var draft: String = ""
    public private(set) var isSending = false
    /// Transient inline error from a failed send (cleared as the fan types).
    public var sendError: String?

    private let api: APIClient
    private let personaId: String
    private let threadId: String

    /// - Parameters:
    ///   - personaId: UUID of the persona the thread belongs to.
    ///   - threadId: UUID of the `PersonaDmThread`. **Not** a user id — the
    ///     persona DM serializer deliberately carries none.
    init(personaId: String, threadId: String, api: APIClient = .shared) {
        self.personaId = personaId
        self.threadId = threadId
        self.api = api
    }

    public var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: PersonaDmThreadDetailResponse = try await api.request(
                PersonaDmEndpoints.thread(personaId: personaId, threadId: threadId)
            )
            let loaded = Self.project(response)
            state = loaded.messages.isEmpty ? .empty(loaded) : .loaded(loaded)
        } catch {
            state = .error(message: Self.loadErrorMessage(error))
        }
    }

    /// Append the composer draft to this thread. No quota is consumed —
    /// only opening a *new* thread burns a message-thread credit.
    public func send() async {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }
        isSending = true
        sendError = nil
        defer { isSending = false }
        do {
            _ = try await api.request(
                PersonaDmEndpoints.sendMessage(
                    personaId: personaId,
                    threadId: threadId,
                    body: PersonaDmMessageBody(body: trimmed)
                ),
                as: PersonaDmSendMessageResponse.self
            )
            draft = ""
            await fetch()
        } catch {
            sendError = Self.sendErrorMessage(error)
        }
    }

    // MARK: - Copy for the first-class failure states

    static func loadErrorMessage(_ error: any Error) -> String {
        guard let apiError = error as? APIError else { return "Couldn't load this thread." }
        switch apiError {
        case .notFound:
            return "This thread is no longer available."
        case .forbidden:
            return "You don't have access to this thread."
        default:
            return apiError.errorDescription ?? "Couldn't load this thread."
        }
    }

    /// `403 blocked` is the only rejection the append route raises beyond
    /// 404 — the fan can still see the thread, but may not post into it.
    static func sendErrorMessage(_ error: any Error) -> String {
        guard let apiError = error as? APIError else { return "Couldn't send. Try again." }
        switch apiError {
        case .forbidden:
            return "This profile can't accept new messages from your account."
        case .notFound:
            return "This thread is no longer available."
        default:
            return apiError.errorDescription ?? "Couldn't send. Try again."
        }
    }

    // MARK: - Projection

    static func project(_ dto: PersonaDmThreadDetailResponse) -> PersonaDmThreadLoaded {
        let role = PersonaDmViewerRole(wire: dto.viewerRole)
        let counterpartyHandle = role == .fan ? dto.persona?.handle : dto.fan?.handle
        let counterpartyName = role == .fan
            ? (dto.persona?.displayName ?? dto.persona?.handle)
            : (dto.fan?.displayName ?? dto.fan?.handle)
        let name = counterpartyName ?? (role == .fan ? "Creator" : "Follower")
        return PersonaDmThreadLoaded(
            title: counterpartyHandle.map { "@\($0)" } ?? name,
            subtitle: name,
            initials: initials(from: name),
            viewerRole: role,
            policyBanner: role == .fan ? policyBanner(dto.replyPolicyStatus) : nil,
            messages: (dto.messages ?? []).map { message($0, viewerRole: role) }
        )
    }

    static func message(_ dto: PersonaDmMessageDTO, viewerRole: PersonaDmViewerRole) -> PersonaDmMessageContent {
        let fromViewer = PersonaDmViewerRole(wire: dto.senderRole) == viewerRole
        return PersonaDmMessageContent(
            id: dto.id,
            fromViewer: fromViewer,
            body: dto.body ?? "",
            timeLabel: timeLabel(from: dto.createdAt),
            readByCounterparty: fromViewer && dto.readAt != nil
        )
    }

    /// Mirrors RN `renderReplyPolicyBanner` — the `sla_missed` copy names
    /// the window that was missed and points at the refund.
    static func policyBanner(_ dto: PersonaDmReplyPolicyStatusDTO?) -> PersonaDmPolicyBanner? {
        guard let dto, let status = dto.status else { return nil }
        let days = dto.slaDays ?? 0
        if status == "sla_missed" {
            return PersonaDmPolicyBanner(
                kind: .missed,
                text: "The creator missed the \(days)-day reply window. "
                    + "You may request a refund from your membership."
            )
        }
        return PersonaDmPolicyBanner(kind: .onTrack, text: policyLabel(dto.policy, slaDays: days))
    }

    static func policyLabel(_ policy: String?, slaDays: Int) -> String {
        switch policy {
        case "discretion": "Replies at the creator's discretion."
        case "always": "Reply guaranteed."
        default: "Reply within \(slaDays) days."
        }
    }

    static func initials(from name: String) -> String {
        let letters = name
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
        if !letters.isEmpty { return letters }
        return String(name.prefix(2)).uppercased()
    }

    static func timeLabel(from iso: String?) -> String {
        guard let iso, let date = parseDate(iso) else { return "" }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "Just now" }
        if interval < 24 * 3600 {
            return date.formatted(.dateTime.hour().minute())
        }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    private static func parseDate(_ iso: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: iso)
    }
}
