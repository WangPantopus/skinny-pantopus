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
//  S1 STATUS: the reservation *write* routes that do exist are now
//  wired for real — reserve / cancel / reveal-address / deliver /
//  confirm all live in `SupportTrainActionsEndpoints.swift`, and
//  `ReviewSignupsViewModel.confirm(_:)`'s optimistic flip is paired
//  with `POST …/reservations/:reservationId/confirm` by the host.
//  There is still **no** edit route: `backend/routes/supportTrains.js`
//  declares 39 routes and none of them is a
//  `PATCH /:id/reservations/:reservationId`
//  (`grep -nE "^router\.(get|post|patch|put|delete)" backend/routes/
//  supportTrains.js` — the only reservation-scoped writes are the five
//  above). So this optimistic store stays the user-facing source of
//  truth for the Edit Signup form until that route ships; it is not a
//  stand-in for anything that already exists server-side.
//

import Foundation
import Observation

/// Process-wide cache of optimistic reservation patches keyed by
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
