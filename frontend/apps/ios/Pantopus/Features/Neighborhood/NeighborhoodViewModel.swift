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
    /// The screen store (Instant Screens): the meter and the window show from
    /// its copies at once and are re-read only once out of date (Nearby: 2 minutes).
    private let store: ScreenStore

    init(client: APIClient = .shared) {
        self.client = client
        store = ScreenStore.store(for: client)
        if let meter = store.peek(NeighborhoodEndpoints.meter(), as: NeighborhoodMeterDTO.self)?.value {
            state = .loaded(meter)
            cells = Self.ready(store.peek(NeighborhoodEndpoints.cells(), as: NeighborhoodCellsDTO.self)?.value)
        }
    }

    func load() async {
        await fetch(force: false)
    }

    func refresh() async {
        await fetch(force: true)
    }

    private func fetch(force: Bool) async {
        do {
            let meter = try await store.load(
                NeighborhoodEndpoints.meter(),
                as: NeighborhoodMeterDTO.self,
                kind: .nearby,
                topics: [ScreenTopic.homes],
                force: force
            ).value
            if state != .loaded(meter) { state = .loaded(meter) }
            if meter.state != .noPlace {
                // A failed window read keeps the one on screen.
                if let window = try? await store.load(
                    NeighborhoodEndpoints.cells(),
                    as: NeighborhoodCellsDTO.self,
                    kind: .nearby,
                    topics: [ScreenTopic.homes],
                    force: force
                ).value {
                    cells = Self.ready(window)
                }
            }
        } catch is CancellationError {
            return
        } catch {
            // A failed refresh keeps the meter on screen.
            if case .loaded = state, !ScreenStore.isRefusal(error) { return }
            state = .error(message: "We couldn't load your neighborhood meter.")
        }
    }

    private static func ready(_ window: NeighborhoodCellsDTO?) -> NeighborhoodCellsDTO? {
        window?.isReady == true ? window : nil
    }
}
