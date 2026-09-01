//
//  NeighborMessageComposeViewModel.swift
//  Pantopus
//
//  D1 — composing a verified-neighbor heads-up. Loads the server template
//  catalog (the only thing you can send — no free text), tracks the
//  selection, and sends a template-only note to a recipient home on your
//  block. The verified-only (T4) gate is enforced upstream: the dashboard
//  only surfaces the composer for verified residents, and the backend
//  re-checks. Mirrors web `NeighborMessageCompose` + `…ComposeView`.
//

import SwiftUI

@Observable
@MainActor
final class NeighborMessageComposeViewModel {
    enum State: Equatable {
        case loading
        case loaded([NeighborMessageTemplate])
        case error(message: String)
    }

    private(set) var state: State = .loading
    /// The chosen template id (radio). Send is gated on this + a recipient.
    var selectedTemplateId: String?
    private(set) var sending = false
    private(set) var sendError: String?
    /// Flips to the calm "Delivered anonymously" confirmation.
    private(set) var sent = false

    let senderHomeId: String
    let address: String
    let recipient: ComposeRecipient?

    private let api: APIClient

    init(
        senderHomeId: String,
        address: String,
        recipient: ComposeRecipient?,
        api: APIClient = .shared
    ) {
        self.senderHomeId = senderHomeId
        self.address = address
        self.recipient = recipient
        self.api = api
    }

    var templates: [NeighborMessageTemplate] {
        if case let .loaded(templates) = state { return templates }
        return []
    }

    var selectedTemplate: NeighborMessageTemplate? {
        guard let id = selectedTemplateId else { return nil }
        return templates.first { $0.id == id }
    }

    var canSend: Bool {
        recipient != nil && selectedTemplate != nil && !sending
    }

    func load() async {
        if case .loaded = state { return }
        state = .loading
        do {
            let catalog: NeighborMessageTemplates = try await api.request(
                NeighborMessagesEndpoints.templates()
            )
            state = .loaded(catalog.templates)
        } catch {
            state = .error(message: "We couldn't open the composer. Check your connection and try again.")
        }
    }

    func send() async {
        guard let recipient, let template = selectedTemplate, !sending else { return }
        sending = true
        sendError = nil
        do {
            let request = SendNeighborMessageRequest(
                senderHomeId: senderHomeId,
                recipientHomeId: recipient.homeId,
                templateId: template.id
            )
            _ = try await api.request(NeighborMessagesEndpoints.send(request)) as SentNeighborMessage
            sent = true
        } catch {
            sendError = "We couldn't send that message. Please try again."
        }
        sending = false
    }
}
