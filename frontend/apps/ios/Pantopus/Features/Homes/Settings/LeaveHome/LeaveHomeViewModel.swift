//
//  LeaveHomeViewModel.swift
//  Pantopus
//
//  Confirmation + submit for `POST /api/homes/:id/move-out`.
//

import Foundation
import OSLog

private let logger = Logger(subsystem: "app.pantopus", category: "LeaveHome")

@MainActor
@Observable
public final class LeaveHomeViewModel {
    public let homeId: String

    public private(set) var isSubmitting = false
    public var errorMessage: String?
    public private(set) var shouldDismissAfterLeave = false

    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    public func submit() {
        guard !isSubmitting, !shouldDismissAfterLeave else { return }
        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                _ = try await api.request(
                    HomesEndpoints.moveOut(homeId: homeId),
                    as: MoveOutResponse.self
                )
                // Keep isSubmitting true until the host pops so a second tap
                // cannot re-fire move-out during the dismiss window.
                shouldDismissAfterLeave = true
            } catch {
                logger.warning("move-out failed: \(error.localizedDescription)")
                errorMessage = error.localizedDescription
                isSubmitting = false
            }
        }
    }

    public func acknowledgeDismiss() {
        shouldDismissAfterLeave = false
    }
}
