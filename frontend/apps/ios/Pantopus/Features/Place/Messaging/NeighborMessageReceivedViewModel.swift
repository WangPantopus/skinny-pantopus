//
//  NeighborMessageReceivedViewModel.swift
//  Pantopus
//
//  D2 — the receiving side of a verified-neighbor message. Fetches the
//  anonymized message (the API never returns the sender) and owns the
//  in-control actions: templated reply, "not helpful", block, and report.
//  None of these notify the sender. Mirrors web `NeighborMessageReceived` +
//  `…ReceivedView`.
//

import SwiftUI

@Observable
@MainActor
final class NeighborMessageReceivedViewModel {
    enum State: Equatable {
        case loading
        case loaded(ReceivedNeighborMessage)
        case notFound
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var replies: [NeighborReplyTemplate] = []
    private(set) var flags = NeighborManageFlags()
    /// Local toggle: re-show the quick-reply bar over an existing reply.
    var editingReply = false
    private(set) var replying = false
    private(set) var isUpdating = false
    private(set) var actionError: String?

    let messageId: String
    private let api: APIClient

    init(messageId: String, api: APIClient = .shared) {
        self.messageId = messageId
        self.api = api
    }

    var message: ReceivedNeighborMessage? {
        if case let .loaded(message) = state { return message }
        return nil
    }

    func load() async {
        state = .loading
        do {
            async let messageReq: ReceivedNeighborMessage = api.request(
                NeighborMessagesEndpoints.message(id: messageId)
            )
            async let catalogReq: NeighborMessageTemplates = api.request(
                NeighborMessagesEndpoints.templates()
            )
            let (message, catalog) = try await (messageReq, catalogReq)
            replies = catalog.replies
            flags = NeighborManageFlags(
                notHelpful: message.notHelpful,
                blocked: message.blockedByViewer ?? false,
                reported: message.reported
            )
            state = .loaded(message)
        } catch APIError.notFound {
            state = .notFound
        } catch {
            state = .error(message: "We couldn't load this message. Check your connection and try again.")
        }
    }

    func reply(_ replyTemplateId: String) async {
        guard !replying, !isUpdating, message?.canReply == true, !flags.blocked else { return }
        replying = true
        actionError = nil
        do {
            let updated: ReceivedNeighborMessage = try await api.request(
                NeighborMessagesEndpoints.reply(
                    id: messageId,
                    request: ReplyNeighborMessageRequest(replyTemplateId: replyTemplateId)
                )
            )
            editingReply = false
            state = .loaded(updated)
        } catch {
            actionError = "Couldn't send your reply. Tap the reply to try again."
        }
        replying = false
    }

    func startEditingReply() {
        guard message?.canReply == true, !flags.blocked else { return }
        editingReply = true
    }

    func markNotHelpful() async {
        guard !flags.notHelpful else { return }
        await update(NeighborMessagesEndpoints.notHelpful(id: messageId), failure: "Couldn't save your feedback. Try again.") {
            flags.notHelpful = true
        }
    }

    func block() async {
        guard !flags.blocked else { return }
        await update(NeighborMessagesEndpoints.block(id: messageId), failure: "Couldn't block this neighbor. Try again.") {
            flags.blocked = true
            editingReply = false
            ScreenStore.store(for: api).markStale(topics: [ScreenTopic.profileMe, ScreenTopic.chats, ScreenTopic.posts])
        }
    }

    func report() async {
        guard !flags.reported else { return }
        let request = ReportNeighborMessageRequest(reason: nil)
        await update(
            NeighborMessagesEndpoints.report(id: messageId, request: request),
            failure: "Couldn't report this message. Try again."
        ) {
            flags.reported = true
        }
    }

    private func update(_ endpoint: Endpoint, failure: String, onSuccess: () -> Void) async {
        guard !isUpdating, !replying else { return }
        isUpdating = true
        actionError = nil
        defer { isUpdating = false }
        do {
            _ = try await api.request(endpoint) as NeighborMessageAck
            onSuccess()
        } catch {
            actionError = failure
        }
    }
}
