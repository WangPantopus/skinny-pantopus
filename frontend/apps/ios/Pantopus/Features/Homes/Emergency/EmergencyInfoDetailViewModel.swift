//
//  EmergencyInfoDetailViewModel.swift
//  Pantopus
//
//  P2.8 — Backs the Emergency Info detail view. Fetches the parent
//  list (the backend exposes no GET-by-id today) and finds the row by
//  id, projecting into a `EmergencyFormDraft` for display + handoff to
//  the edit form.
//
//  Edit and delete go to the server (PUT / DELETE
//  `/api/homes/:id/emergencies/:emergencyId`). The detail shows the saved
//  entry the edit form hands back, and `isDeleted` flips only after the
//  server confirms the delete (or says it is already gone). The parent
//  navigator pops the view when either signal flips.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
public final class EmergencyInfoDetailViewModel {
    public enum State: Sendable, Equatable {
        case loading
        case loaded(EmergencyFormDraft)
        case missing
        case error(String)
    }

    public private(set) var state: State = .loading
    public private(set) var isDeleting: Bool = false
    public private(set) var isDeleted: Bool = false
    public var showsDeleteConfirm: Bool = false
    /// A failed delete keeps the row and says why.
    public var toast: ToastMessage?

    private let homeId: String
    private let emergencyId: String
    private let api: APIClient
    private let onChanged: @Sendable () -> Void
    private let onClose: @Sendable () -> Void

    init(
        homeId: String,
        emergencyId: String,
        api: APIClient = .shared,
        onChanged: @escaping @Sendable () -> Void = {},
        onClose: @escaping @Sendable () -> Void = {}
    ) {
        self.homeId = homeId
        self.emergencyId = emergencyId
        self.api = api
        self.onChanged = onChanged
        self.onClose = onClose
    }

    public func load() async {
        state = .loading
        do {
            let response: GetHomeEmergenciesResponse = try await api.request(
                HomesEndpoints.emergencies(homeId: homeId)
            )
            guard let dto = response.emergencies.first(where: { $0.id == emergencyId }) else {
                state = .missing
                return
            }
            // Legacy list-of-rows types (shutoff_water etc.) render their
            // raw fields under the generic "Other" category.
            state = .loaded(EmergencyFormDraft.display(dto: dto))
        } catch {
            state = .error(
                (error as? APIError)?.errorDescription
                    ?? "Couldn't load this item."
            )
        }
    }

    /// Show the saved entry. Called by the form's `onUpdated` after the
    /// server confirmed the PUT.
    public func apply(updated: EmergencyFormDraft) {
        state = .loaded(updated)
        onChanged()
    }

    /// Delete on the server, then flip `isDeleted` so the view can pop.
    /// Already gone on the server is the outcome the member asked for; any
    /// other failure keeps the row and shows why.
    public func confirmDelete() async {
        guard case .loaded = state, !isDeleting else { return }
        isDeleting = true
        showsDeleteConfirm = false
        defer { isDeleting = false }
        do {
            _ = try await api.request(
                HomesEndpoints.deleteEmergency(homeId: homeId, emergencyId: emergencyId),
                as: DeleteEmergencyResponse.self
            )
        } catch APIError.notFound {
            // Already removed (for example by another device).
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Couldn't delete this item.",
                kind: .error
            )
            return
        }
        isDeleted = true
        onChanged()
        onClose()
    }
}
