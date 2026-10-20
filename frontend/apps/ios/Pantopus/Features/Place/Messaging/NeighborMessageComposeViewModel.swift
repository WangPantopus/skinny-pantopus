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

    enum RecipientSearchState: Equatable {
        case idle
        case loading
        case loaded([DiscoveredHomeDTO])
        case error(String)
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
    private(set) var recipient: ComposeRecipient?
    var recipientQuery = "" {
        didSet {
            searchGeneration += 1
            recipientSearchState = .idle
        }
    }

    private(set) var recipientSearchState: RecipientSearchState = .idle
    private var searchGeneration = 0

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

    var canSearchRecipients: Bool {
        let query = recipientQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return query.count >= 4 && query.rangeOfCharacter(from: .decimalDigits) != nil
            && query.rangeOfCharacter(from: .letters) != nil && recipientSearchState != .loading
    }

    func searchRecipients() async {
        guard canSearchRecipients else { return }
        searchGeneration += 1
        let generation = searchGeneration
        let query = recipientQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        recipientSearchState = .loading
        do {
            let response: HomeDiscoverResponse = try await api.request(
                HomeDiscoveryEndpoints.discover(query: query, limit: 50)
            )
            guard generation == searchGeneration, !Task.isCancelled else { return }
            // Reuse discovery's privacy contract. Never select a redacted or
            // ambiguous address, enumerate verification, or name a resident.
            let homes = response.homes.filter {
                $0.id != senderHomeId && !$0.isMember && $0.addressRedacted == false
                    && $0.visibility == "public_preview" && !($0.address?.isEmpty ?? true)
            }
            recipientSearchState = .loaded(homes)
        } catch {
            guard generation == searchGeneration, !Task.isCancelled else { return }
            recipientSearchState = .error("Couldn't search homes. Check your connection and try again.")
        }
    }

    func selectRecipient(_ home: DiscoveredHomeDTO) {
        guard !sending, case let .loaded(homes) = recipientSearchState,
              homes.contains(where: { $0.id == home.id }), let address = home.address else { return }
        recipient = ComposeRecipient(
            homeId: home.id,
            address: address,
            relativeLabel: [home.city, home.state].compactMap { $0 }.joined(separator: ", ")
        )
        sendError = nil
    }

    func changeRecipient() {
        guard !sending else { return }
        recipient = nil
        sendError = nil
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
        } catch let error as APIError {
            switch error {
            case .clientError, .forbidden:
                sendError = error.errorDescription
            default:
                sendError = "We couldn't send that message. Please try again."
            }
        } catch {
            sendError = "We couldn't send that message. Please try again."
        }
        sending = false
    }
}
