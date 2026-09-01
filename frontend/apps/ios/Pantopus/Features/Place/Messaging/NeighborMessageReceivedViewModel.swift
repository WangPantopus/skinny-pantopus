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
                blocked: false,
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
        guard !replying else { return }
        replying = true
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
            // Stay on the quick-reply bar; the row tap can be retried.
        }
        replying = false
    }

    func startEditingReply() {
        editingReply = true
    }

    func markNotHelpful() async {
        guard !flags.notHelpful else { return }
        _ = try? await api.request(NeighborMessagesEndpoints.notHelpful(id: messageId)) as NeighborMessageAck
        flags.notHelpful = true
    }

    func block() async {
        guard !flags.blocked else { return }
        _ = try? await api.request(NeighborMessagesEndpoints.block(id: messageId)) as NeighborMessageAck
        flags.blocked = true
    }

    func report() async {
        guard !flags.reported else { return }
        let request = ReportNeighborMessageRequest(reason: nil)
        _ = try? await api.request(NeighborMessagesEndpoints.report(id: messageId, request: request)) as NeighborMessageAck
        flags.reported = true
    }
}
