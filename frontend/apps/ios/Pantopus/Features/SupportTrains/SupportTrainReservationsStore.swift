//
//  SupportTrainReservationsStore.swift
//  Pantopus
//
//  P3.7 — Bridge between the Edit Signup form and the Review Signups
//  list. The form pushes the updated reservation here when the
//  organizer hits Save; the list view-model pulls patches on appear
//  and replays them against its in-memory cache so the row reflects
//  the change without a re-fetch.
//
//  Edit patches contain the acknowledged server response, never an unsaved draft.
//

import Foundation
import Observation

/// Process-wide cache of acknowledged reservation patches keyed by
/// reservation id. The list screen reads from here on appear; the
/// edit form writes here on Save.
@Observable
@MainActor
public final class SupportTrainReservationsStore {
    public static let shared = SupportTrainReservationsStore()

    /// Bumps every time a patch is applied — the Review-signups view
    /// observes this in `.onChange` to refresh its rows.
    public private(set) var revision: Int = 0

    private var patches: [String: SupportTrainReservationDTO] = [:]

    /// Record a patched reservation. Increments `revision` so observers
    /// re-render.
    public func apply(_ updated: SupportTrainReservationDTO) {
        patches[updated.id] = updated
        revision &+= 1
    }

    /// Return — and remove — the patch for `reservationId`, or `nil`
    /// when there is no pending edit. Called by the list VM after it
    /// has replayed the patch into its own cache so subsequent appears
    /// don't double-apply.
    public func consumePatch(forId reservationId: String) -> SupportTrainReservationDTO? {
        patches.removeValue(forKey: reservationId)
    }

    /// Test affordance — empty the store between unit tests.
    public func reset() {
        patches.removeAll()
        revision = 0
    }

    private init() {}
}
