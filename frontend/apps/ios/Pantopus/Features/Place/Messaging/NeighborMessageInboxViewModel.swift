//
//  NeighborMessageInboxViewModel.swift
//  Pantopus
//
//  The verified-neighbor inbox — the in-app surface that lists received
//  messages (`GET /api/neighbor-messages/received`, sender always
//  anonymized) and routes into the D2 detail. The web reaches a single
//  message by deep link; native needs a list to make them browsable.
//

import SwiftUI

@Observable
@MainActor
final class NeighborMessageInboxViewModel {
    enum State: Equatable {
        case loading
        case loaded([ReceivedNeighborMessage])
        case empty
        case error(message: String)
    }

    private(set) var state: State = .loading
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// Coming back from a message keeps the list on screen while it is read
    /// again (the message's unread dot goes); only a first visit or a retry
    /// shows the loading rows.
    func load() async {
        switch state {
        case .loaded, .empty: break
        case .loading, .error: state = .loading
        }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: ReceivedNeighborMessagesResponse = try await api.request(
                NeighborMessagesEndpoints.received()
            )
            state = response.messages.isEmpty ? .empty : .loaded(response.messages)
        } catch {
            switch state {
            // A failed re-read keeps the list (or the empty inbox) that is on screen.
            case .loaded, .empty: return
            case .loading, .error:
                state = .error(message: "We couldn't load your messages. Check your connection and try again.")
            }
        }
    }
}
