//
//  NeighborMessageComposeViewModel.swift
//  Pantopus
//
//  D1 — composing a verified-neighbor heads-up. Loads the server template
//  catalog (the only thing you can send — no free text), tracks the
//  selection, and sends a template-only note to an address on your block.
//  The note reaches a verified household if one lives there; nothing here
//  says whether one does. The verified-only (T4) gate is enforced upstream:
//  the dashboard only surfaces the composer for verified residents, and the
//  backend re-checks. Mirrors web `NeighborMessageCompose` + `…ComposeView`.
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

    enum AddressCheckState: Equatable {
        case idle
        case checking
        case refused(String)
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
    /// The chosen address's apartment or unit, if it has one.
    var recipientUnit = ""
    var recipientQuery = "" {
        didSet {
            checkGeneration += 1
            addressCheckState = .idle
        }
    }

    private(set) var addressCheckState: AddressCheckState = .idle
    private var checkGeneration = 0
    /// Address suggestions while typing, nearest your home first; picking
    /// one checks that exact address (`chooseSuggestion`).
    let addressSuggestions = AddressSuggestions()

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

    var canUseTypedAddress: Bool {
        let query = recipientQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return query.count >= 4 && query.rangeOfCharacter(from: .decimalDigits) != nil
            && query.rangeOfCharacter(from: .letters) != nil && addressCheckState != .checking
    }

    func useTypedAddress() async {
        guard canUseTypedAddress else { return }
        addressSuggestions.dismiss()
        let query = recipientQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        await checkAddress(street: query, city: nil, state: nil, zipcode: nil)
    }

    /// A picked address suggestion is the exact address: check it at once.
    func chooseSuggestion(_ suggestion: GeoSuggestion) async {
        guard !sending, let address = await addressSuggestions.choose(suggestion),
              let street = address.address, !street.isEmpty else { return }
        recipientQuery = street
        await checkAddress(street: street, city: address.city, state: address.state, zipcode: address.zipcode)
    }

    /// Asks the server whether the address is on your block, and chooses it if so.
    private func checkAddress(street: String, city: String?, state: String?, zipcode: String?) async {
        checkGeneration += 1
        let generation = checkGeneration
        addressCheckState = .checking
        let request = NeighborAddressCheckRequest(
            senderHomeId: senderHomeId, address: street, city: city, state: state, zipcode: zipcode
        )
        do {
            let result: NeighborAddressCheck = try await api.request(NeighborMessagesEndpoints.checkAddress(request))
            guard generation == checkGeneration, !Task.isCancelled else { return }
            if result.status == "on_block", let address = result.address {
                recipient = ComposeRecipient(
                    address: address, city: result.city, state: result.state, zipcode: result.zipcode
                )
                recipientUnit = ""
                sendError = nil
                addressCheckState = .idle
            } else {
                addressCheckState = .refused(result.message ?? "Couldn't use that address. Check the number and street.")
            }
        } catch {
            guard generation == checkGeneration, !Task.isCancelled else { return }
            addressCheckState = .refused("Couldn't check that address. Check your connection and try again.")
        }
    }

    func changeRecipient() {
        guard !sending else { return }
        recipient = nil
        sendError = nil
    }

    func load() async {
        if addressSuggestions.near == nil {
            addressSuggestions.near = await AddressSuggestions.homePoint(homeId: senderHomeId)
        }
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
            let unit = recipientUnit.trimmingCharacters(in: .whitespacesAndNewlines)
            let request = SendNeighborMessageRequest(
                senderHomeId: senderHomeId,
                recipientAddress: NeighborRecipientAddress(
                    address: recipient.address,
                    unit: unit.isEmpty ? nil : unit,
                    city: recipient.city,
                    state: recipient.state,
                    zipcode: recipient.zipcode
                ),
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
