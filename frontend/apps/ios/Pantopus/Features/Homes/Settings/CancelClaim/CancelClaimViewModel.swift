//
//  CancelClaimViewModel.swift
//  Pantopus
//
//  Loads the caller's ownership claim for a home and deletes it via
//  `DELETE /api/homes/:id/ownership-claims/:claimId`.
//

import Foundation
import OSLog

private let logger = Logger(subsystem: "app.pantopus", category: "CancelClaim")

@MainActor
@Observable
public final class CancelClaimViewModel {
    public enum Phase: Equatable {
        case loading
        case ready
        case submitting
        case noClaim
        case error(String)
    }

    public let homeId: String

    public private(set) var phase: Phase = .loading
    public private(set) var shouldDismissAfterCancel = false
    /// Submit/load failure copy shown above the confirmation while still retryable.
    public private(set) var errorMessage: String?

    private var claimId: String?
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    public var canSubmit: Bool {
        if case .ready = phase { return true }
        // Load failure: allow the CTA to retry the claims fetch.
        if case .error = phase, claimId == nil { return true }
        return false
    }

    public var isSubmitting: Bool {
        if case .submitting = phase { return true }
        return false
    }

    public func load() {
        phase = .loading
        errorMessage = nil
        Task {
            do {
                let response: MyOwnershipClaimsResponse = try await api.request(
                    HomesEndpoints.myOwnershipClaims()
                )
                if let claim = response.claims.first(where: { $0.homeId == homeId }) {
                    claimId = claim.id
                    phase = .ready
                } else {
                    phase = .noClaim
                }
            } catch {
                logger.warning("load claims failed: \(error.localizedDescription)")
                phase = .error(error.localizedDescription)
            }
        }
    }

    public func submit() {
        guard !shouldDismissAfterCancel else { return }
        guard let id = claimId else {
            // Load failed previously — retry fetch instead of delete.
            if case .error = phase { load() }
            return
        }
        guard case .ready = phase else { return }
        phase = .submitting
        errorMessage = nil
        Task {
            do {
                _ = try await api.request(
                    HomesEndpoints.deleteOwnershipClaim(homeId: homeId, claimId: id),
                    as: DeleteOwnershipClaimResponse.self
                )
                shouldDismissAfterCancel = true
            } catch {
                logger.warning("delete claim failed: \(error.localizedDescription)")
                errorMessage = error.localizedDescription
                phase = .ready
            }
        }
    }

    public func acknowledgeDismiss() {
        shouldDismissAfterCancel = false
    }
}
