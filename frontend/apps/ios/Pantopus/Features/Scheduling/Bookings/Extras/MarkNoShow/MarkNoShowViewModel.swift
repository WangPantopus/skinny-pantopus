//
//  MarkNoShowViewModel.swift
//  Pantopus
//
//  Stream I9 — E6 Mark No-Show (confirmation dialog). Flips a booking to the
//  `no_show` terminal state via `POST /bookings/:id/no-show`. Only surfaces
//  after the booking's start time; the backend returns `409 NOT_APPLICABLE_YET`
//  (older builds: `BAD_STATE`) before then — handled defensively.
//
//  Group events are modeled as one booking row per attendee, so "who didn't
//  show" maps each selected attendee to its own booking id and marks each.
//

import Observation
import SwiftUI

/// One no-show target — a single booking (1:1) or one attendee's booking row
/// within a group event.
struct NoShowTarget: Identifiable, Hashable {
    let bookingId: String
    let name: String

    var id: String {
        bookingId
    }

    var initials: String {
        BookingsExtrasFormatting.initials(from: name)
    }
}

@Observable
@MainActor
final class MarkNoShowViewModel {
    let owner: SchedulingOwner
    let targets: [NoShowTarget]

    var selectedIds: Set<String>
    var note: String = ""
    private(set) var isSubmitting = false
    var errorMessage: String?

    private let client: SchedulingClient

    init(owner: SchedulingOwner, targets: [NoShowTarget], client: SchedulingClient) {
        self.owner = owner
        self.targets = targets
        // Default to every target selected; the host deselects anyone who showed.
        selectedIds = Set(targets.map(\.bookingId))
        self.client = client
    }

    var isGroup: Bool {
        targets.count > 1
    }

    var canConfirm: Bool {
        !selectedIds.isEmpty
    }

    var confirmTitle: String {
        isGroup ? "Mark \(selectedIds.count) as no-show" : "Mark no-show"
    }

    func toggle(_ id: String) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else {
            selectedIds.insert(id)
        }
    }

    /// Marks each selected target a no-show, tracking per-target outcomes.
    /// Successfully marked targets are removed from `selectedIds` as they land,
    /// so a retry after a partial failure only re-sends the failed ones (a
    /// re-POST for an already-`no_show` booking would 409 `BAD_STATE` forever).
    /// Returns `true` when every selected booking flipped successfully.
    func confirm() async -> Bool {
        guard !isSubmitting, canConfirm else { return false }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        let pending = targets.filter { selectedIds.contains($0.bookingId) }
        var firstError: Error?
        var failedCount = 0
        for target in pending {
            do {
                let _: BookingResponse = try await client.request(
                    SchedulingEndpoints.markNoShow(owner: owner, id: target.bookingId)
                )
                selectedIds.remove(target.bookingId)
            } catch {
                failedCount += 1
                if firstError == nil { firstError = error }
            }
        }
        guard let firstError else { return true }
        let detail = Self.message(for: firstError)
        let markedCount = pending.count - failedCount
        errorMessage = markedCount > 0
            ? "Marked \(markedCount) of \(pending.count) — retry the rest. \(detail)"
            : detail
        return false
    }

    static func message(for error: Error) -> String {
        guard let scheduling = error as? SchedulingError else { return "Couldn't update — try again" }
        switch scheduling.code {
        case "NOT_APPLICABLE_YET":
            return "You can mark a no-show only after the booking's start time."
        case "BAD_STATE":
            return "This booking can't be marked — it may already be closed or marked."
        default:
            return scheduling.userMessage ?? "Couldn't update — try again"
        }
    }
}
