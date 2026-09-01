//
//  NeighborhoodViewModel.swift
//  Pantopus
//
//  Wedge Phase 1 — the density-gated Neighborhood door.
//

import Foundation
import Observation

/// Render state for the Neighborhood door.
enum NeighborhoodState: Sendable, Equatable {
    case loading
    case loaded(NeighborhoodMeterDTO)
    case error(message: String)
}

// Internal (not public) because APIClient is internal — same pattern as
// PlaceDashboardView; the app is a single target so nothing is lost.
@Observable
@MainActor
final class NeighborhoodViewModel {
    private(set) var state: NeighborhoodState = .loading

    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let meter: NeighborhoodMeterDTO = try await client.request(NeighborhoodEndpoints.meter())
            state = .loaded(meter)
        } catch {
            state = .error(message: "We couldn't load your neighborhood meter.")
        }
    }
}
