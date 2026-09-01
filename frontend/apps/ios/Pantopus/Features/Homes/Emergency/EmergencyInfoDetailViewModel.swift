//
//  EmergencyInfoDetailViewModel.swift
//  Pantopus
//
//  P2.8 — Backs the Emergency Info detail view. Fetches the parent
//  list (the backend exposes no GET-by-id today) and finds the row by
//  id, projecting into a `EmergencyFormDraft` for display + handoff to
//  the edit form.
//
//  Edit and delete are local-only today. The detail can hold an
//  optimistic draft (set after a local edit) and an `isDeleted` flag
//  (set after a confirmed delete). The parent navigator pops the view
//  when either signal flips.
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
            if let draft = EmergencyFormDraft.from(dto: dto) {
                state = .loaded(draft)
            } else {
                // Legacy list-of-rows types (shutoff_water etc.) don't
                // map to the form schema — render the raw fields under
                // a generic "Other" category so the user still sees
                // them.
                state = .loaded(EmergencyFormDraft(
                    id: dto.id,
                    category: .other,
                    title: dto.label,
                    severity: EmergencySeverity.from(rawValue: dto.details["severity"]),
                    details: dto.details["detail"] ?? dto.location ?? "",
                    verifiedByUserId: dto.details["verified_by"],
                    lastUpdated: ISO8601DateFormatter().date(from: dto.updatedAt ?? "") ?? Date()
                ))
            }
        } catch {
            state = .error(
                (error as? APIError)?.errorDescription
                    ?? "Couldn't load this item."
            )
        }
    }

    /// Apply an optimistic local edit. Called by the form's
    /// `onUpdated` callback while the backend still lacks a PUT route.
    public func apply(updated: EmergencyFormDraft) {
        state = .loaded(updated)
        onChanged()
    }

    /// Confirm and perform the local delete. Flips `isDeleted` so the
    /// view can pop. Backend has no DELETE handler today; the parent
    /// list reload (driven by `onChanged`) will simply re-show the row
    /// until that ships.
    public func confirmDelete() {
        guard case .loaded = state else { return }
        isDeleting = true
        isDeleted = true
        isDeleting = false
        showsDeleteConfirm = false
        onChanged()
        onClose()
    }
}
