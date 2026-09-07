//
//  NeighborhoodViewModel.swift
//  Pantopus
//
//  Wedge Phase 1 — the density-gated Neighborhood door.
//

import Foundation
import Observation

/// Render state for the Neighborhood door.
enum NeighborhoodState: Equatable {
    case loading
    case loaded(NeighborhoodMeterDTO)
    case error(message: String)
}

/// Internal (not public) because APIClient is internal — same pattern as
/// PlaceDashboardView; the app is a single target so nothing is lost.
@Observable
@MainActor
final class NeighborhoodViewModel {
    private(set) var state: NeighborhoodState = .loading
    /// The window (Wedge v2 §4). Nil until loaded, and nil when the window
    /// fails — it never takes the meter down with it.
    private(set) var cells: NeighborhoodCellsDTO?

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
            if meter.state != .noPlace {
                let window: NeighborhoodCellsDTO? = try? await client.request(NeighborhoodEndpoints.cells())
                cells = window?.isReady == true ? window : nil
            }
        } catch {
            state = .error(message: "We couldn't load your neighborhood meter.")
        }
    }
}
