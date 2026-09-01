//
//  WaitingRoomViewModel.swift
//  Pantopus
//
//  Backs the A18.4 persistent waiting room. Loads the caller's pending
//  ownership claim for `homeId` from `GET /api/homes/my-ownership-claims`
//  and projects it into `WaitingRoomContent`. Actions surface navigation
//  intents via `pendingNav` for the host to handle.
//

import Foundation
import Logging
import Observation

/// Which canonical frame the room opens on (seed / query param).
public enum WaitingRoomState: String, Sendable, Hashable {
    case active
    case moreInfoRequested
}

/// Navigation intents surfaced to the host.
public enum WaitingRoomNav: Sendable, Hashable {
    case notifications
    case backToHome(homeId: String)
    case viewClaim(claimId: String)
    case updateEvidence(homeId: String, claimId: String)
    case cancelClaim(homeId: String)

    // MARK: Verification Center intents

    /// A12.7 postcard screen — "Enter verification code" / "Verify with
    /// a mailed code".
    case verifyPostcard(homeId: String)
    /// Residency-evidence wizard — "Upload proof".
    case uploadProof(homeId: String)
    /// A12 landlord-verification wizard.
    case landlordVerification(homeId: String)
    /// "This isn't my home" — the existing Leave home confirm, which
    /// owns `POST /api/homes/:id/move-out`.
    case leaveHome(homeId: String)
    /// "Request help" — Help Center.
    case requestHelp
}

@Observable
@MainActor
public final class WaitingRoomViewModel {
    public let homeId: String
    public private(set) var content: WaitingRoomContent
    public private(set) var phase: WaitingRoomPhase = .loading
    public private(set) var pendingNav: WaitingRoomNav?

    /// The only masked status `GET /api/homes/my-ownership-claims` returns
    /// while a claim is still in flight — every other value it can return
    /// (`approved` / `rejected` / `revoked`) is terminal.
    private static let underReviewStatus = "under_review"
    /// Terminal statuses that mean the claimant won. `maskClaimState`
    /// (`backend/routes/homeOwnership.js:2107`) emits `approved`; the extra
    /// synonyms mirror `MyClaimsListViewModel.statusText`.
    private static let approvedStatuses: Set<String> = ["approved", "verified", "complete"]
    /// Claim reference shown in the waiting room = first 8 chars of the id.
    private static let claimRefLength = 8

    private let seedState: WaitingRoomState
    private var claimId: String?
    private let api: APIClient
    private let logger = Logger(label: "app.pantopus.ios.WaitingRoom")

    init(
        homeId: String,
        state: WaitingRoomState = .active,
        content: WaitingRoomContent? = nil,
        api: APIClient = .shared
    ) {
        self.homeId = homeId
        seedState = state
        self.api = api
        self.content = content ?? Self.content(for: state)
    }

    static func content(for state: WaitingRoomState) -> WaitingRoomContent {
        switch state {
        case .active: .active()
        case .moreInfoRequested: .moreInfoRequested()
        }
    }

    public func consumeNav() {
        pendingNav = nil
    }

    public func refresh() async {
        do {
            let claimsResponse: MyOwnershipClaimsResponse = try await api.request(
                HomesEndpoints.myOwnershipClaims()
            )
            guard let claim = claimsResponse.claims.first(where: { $0.homeId == homeId }) else {
                claimId = nil
                await applyVerificationFallback()
                return
            }
            claimId = claim.id
            guard claim.status == Self.underReviewStatus else {
                if Self.approvedStatuses.contains(claim.status) {
                    // A18.2 "You're the owner". Dates come straight off the
                    // claim row — never the design's sample dates.
                    let approvedAddress = await resolvedAddress()
                    let approvedContent = StatusWaitingContent.claimSubmitted(
                        homeName: approvedAddress,
                        approved: true,
                        submittedOn: Self.dayCaption(claim.createdAt),
                        decidedOn: Self.dayCaption(claim.updatedAt)
                    )
                    phase = .approved(approvedContent)
                    return
                }
                phase = .notice(.claimDecided)
                return
            }
            let ref = String(claim.id.prefix(Self.claimRefLength)).uppercased()

            let address = await resolvedAddress()

            content =
                seedState == .moreInfoRequested
                    ? .moreInfoRequested(address: address, claimRef: ref)
                    : .active(address: address, claimRef: ref)
            phase = .loaded
        } catch {
            logger.warning("waitingRoom.load failed: \(error.localizedDescription)")
            phase = .notice(.loadFailed)
        }
    }

    /// No claim row for this home. RN serves the Verification Center on
    /// this same route, branching on `verification_status` from
    /// `GET /api/homes/:id/me` (`src/app/homes/[id]/waiting-room.tsx:26-70`).
    /// Only when the caller *is* verified (or the call fails) do we fall
    /// back to the "No claim in review" notice.
    private func applyVerificationFallback() async {
        guard let access = try? await api.request(
            HomeAdminEndpoints.myAccess(homeId: homeId),
            as: HomeVerificationAccessDTO.self
        ), access.hasAccess, access.needsVerification else {
            phase = .notice(.noClaim)
            return
        }
        phase = .verification(
            HomeVerificationContent.make(
                status: HomeVerificationStatus.from(raw: access.verificationStatus),
                isInChallengeWindow: access.isInChallengeWindow,
                challengeWindowEndsAt: access.challengeWindowEndsAt,
                postcardExpiresAt: access.postcardExpiresAt
            )
        )
    }

    /// Route one Verification Center action card. Keys are declared on
    /// `HomeVerificationContent.ActionKey`.
    public func handleVerificationAction(_ action: HomeVerificationAction) {
        switch action.actionKey {
        case HomeVerificationContent.ActionKey.enterCode,
             HomeVerificationContent.ActionKey.requestMailedCode:
            pendingNav = .verifyPostcard(homeId: homeId)
        case HomeVerificationContent.ActionKey.uploadProof:
            pendingNav = .uploadProof(homeId: homeId)
        case HomeVerificationContent.ActionKey.landlordVerification:
            pendingNav = .landlordVerification(homeId: homeId)
        case HomeVerificationContent.ActionKey.moveOut:
            pendingNav = .leaveHome(homeId: homeId)
        case HomeVerificationContent.ActionKey.requestHelp:
            pendingNav = .requestHelp
        default:
            log("verification.\(action.actionKey)")
        }
    }

    /// Best-effort street address for this home. Falls back to the generic
    /// "Your home" label rather than inventing an address.
    private func resolvedAddress() async -> String {
        guard let detail: HomeDetailResponse = try? await api.request(HomesEndpoints.detail(homeId: homeId)) else {
            return "Your home"
        }
        let home = detail.home.base
        let joined = [home.address, home.city, home.state]
            .compactMap { $0 }
            .joined(separator: " · ")
        return joined.isEmpty ? "Your home" : joined
    }

    /// "Oct 14"-style caption for an ISO-8601 backend timestamp. Returns nil
    /// when the string doesn't parse so the caller omits the caption instead
    /// of printing a placeholder.
    static func dayCaption(_ iso: String) -> String? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    public func openNotifications() {
        pendingNav = .notifications
    }

    public func handleInlineAction(_ action: WaitingRoomInlineAction) {
        switch action.actionKey {
        case "update_evidence":
            if let claimId {
                pendingNav = .updateEvidence(homeId: homeId, claimId: claimId)
            }
        case "cancel_claim":
            pendingNav = .cancelClaim(homeId: homeId)
        default:
            log("inline.\(action.actionKey)")
        }
    }

    public func handlePrimary(_ cta: StatusCTA) {
        switch cta.actionKey {
        case "view_claim":
            if let claimId {
                pendingNav = .viewClaim(claimId: claimId)
            }
        // A18.2 approved frame's primary CTA ("Open your home").
        case "open_home":
            pendingNav = .backToHome(homeId: homeId)
        default:
            log("dock.\(cta.actionKey)")
        }
    }

    public func handleSecondary(_ cta: StatusCTA) {
        switch cta.actionKey {
        case "back_to_home":
            pendingNav = .backToHome(homeId: homeId)
        // A18.2 approved frame's ghost CTA ("View claim").
        case "view_claim":
            if let claimId {
                pendingNav = .viewClaim(claimId: claimId)
            }
        default:
            log("dock.\(cta.actionKey)")
        }
    }

    private func log(_ action: String) {
        logger.info("waitingRoom.action", metadata: [
            "homeId": .string(homeId),
            "action": .string(action)
        ])
    }
}
