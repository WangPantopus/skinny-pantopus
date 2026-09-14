//
//  CancelClaimViewModel.swift
//  Pantopus
//
//  Loads the caller's ownership claim and withdraws it while retaining history via
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
    private let scope: HomeClaimSessionScope
    private var generation = 0

    init(homeId: String, api: APIClient = .shared, identity: (() -> String?)? = nil) {
        self.homeId = homeId
        self.api = api
        scope = HomeClaimSessionScope(api: api, identity: identity)
    }

    public var canSubmit: Bool {
        guard scope.isCurrent else { return false }
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
        guard !isSubmitting else { return }
        generation += 1
        let revision = generation
        claimId = nil
        phase = .loading
        errorMessage = nil
        Task {
            do {
                try scope.requireCurrent()
                let response: MyOwnershipClaimsResponse = try await api.request(
                    HomesEndpoints.myOwnershipClaims()
                )
                try scope.requireCurrent()
                guard revision == generation else { return }
                if let claim = response.claims.first(where: { $0.homeId == homeId && Self.withdrawable($0) }) {
                    claimId = claim.id
                    phase = .ready
                } else {
                    phase = .noClaim
                }
            } catch {
                guard revision == generation else { return }
                logger.warning("load claims failed: \(error.localizedDescription)")
                phase = .error(error.localizedDescription)
            }
        }
    }

    public func submit() {
        guard !shouldDismissAfterCancel, scope.isCurrent else { return }
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
                try scope.requireCurrent()
                let receipt = try await api.request(
                    HomesEndpoints.deleteOwnershipClaim(homeId: homeId, claimId: id),
                    as: DeleteOwnershipClaimResponse.self
                )
                try scope.requireCurrent()
                guard receipt.matches(homeId: homeId, claimId: id) else { throw APIError.invalidResponse }
                shouldDismissAfterCancel = true
            } catch {
                logger.warning("withdraw claim failed: \(error.localizedDescription)")
                errorMessage = error.localizedDescription
                phase = .ready
            }
        }
    }

    private static func withdrawable(_ claim: OwnershipClaimDTO) -> Bool {
        ["under_review", "rejected"].contains(claim.status)
    }

    public func acknowledgeDismiss() {
        shouldDismissAfterCancel = false
    }
}
