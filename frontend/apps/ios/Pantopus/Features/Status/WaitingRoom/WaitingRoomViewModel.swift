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
    /// "Back to My homes": the claim gives no way into this Home yet.
    case myHomes(homeId: String)
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
    /// The approval checklist action in flight (its button reads "Opening…").
    public private(set) var approvalBusyKey: String?
    /// Why the last identity check action couldn't go ahead, shown on the checklist.
    public private(set) var approvalNotice: String?

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
    /// The claim is a renter's residency document (`claim_type` "resident").
    private var claimIsResidency = false
    private let api: APIClient
    private let authority: HomeDashboardAccess
    /// Opens Stripe's identity check page in an in-app browser.
    private let webPresenter: ConnectWebPresenting
    private let logger = Logger(label: "app.pantopus.ios.WaitingRoom")

    init(
        homeId: String,
        state: WaitingRoomState = .active,
        content: WaitingRoomContent? = nil,
        api: APIClient = .shared,
        webPresenter: ConnectWebPresenting? = nil
    ) {
        self.homeId = homeId
        seedState = state
        self.api = api
        self.webPresenter = webPresenter ?? ConnectWebPresenter()
        authority = HomeDashboardAccess(homeId: homeId, api: api)
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
                claimIsResidency = false
                try await applyVerificationFallback()
                return
            }
            claimId = claim.id
            claimIsResidency = claim.claimType == "resident"
            guard claim.status == Self.underReviewStatus else {
                if Self.approvedStatuses.contains(claim.status) {
                    // A18.2 "You're the owner" (a verified resident for a
                    // residency document). Dates come straight off the
                    // claim row — never the design's sample dates.
                    let approvedAddress = await homeContext(claimed: claim.home).address
                    let approvedContent = StatusWaitingContent.claimSubmitted(
                        homeName: approvedAddress,
                        approved: true,
                        submittedOn: Self.dayCaption(claim.createdAt),
                        decidedOn: Self.dayCaption(claim.updatedAt),
                        residency: claimIsResidency
                    )
                    phase = .approved(approvedContent)
                    return
                }
                phase = .notice(claimIsResidency ? .residencyClaimDecided : .claimDecided)
                return
            }
            let ref = String(claim.id.prefix(Self.claimRefLength)).uppercased()

            let home = await homeContext(claimed: claim.home)
            let canOpenHome = await opensHomeScreen()

            content =
                seedState == .moreInfoRequested
                    ? .moreInfoRequested(
                        address: home.address,
                        claimRef: ref,
                        submittedOn: Self.dayCaption(claim.createdAt),
                        canOpenHome: canOpenHome
                    )
                    : .active(
                        address: home.address,
                        claimRef: ref,
                        submittedOn: Self.dayCaption(claim.createdAt),
                        reviewCaption: nil,
                        needsDocuments: claim.approval.map { $0.proof == "missing" } ?? (claim.hasEvidence == false),
                        addressVerified: home.addressVerified,
                        residency: claimIsResidency,
                        approval: claim.approval,
                        canOpenHome: canOpenHome
                    )
            phase = .loaded
        } catch {
            logger.warning("waitingRoom.load failed: \(error.localizedDescription)")
            phase = .notice(.loadFailed)
        }
    }

    /// Pending residents have denied Home access with a safe verification context.
    private func applyVerificationFallback() async throws {
        let access = try await authority.read()
        guard access.verificationKind != nil else {
            phase = .notice(.noClaim)
            return
        }
        let offersLandlord = await offersLandlordConfirmation()
        phase = .verification(
            HomeVerificationContent.make(
                status: HomeVerificationStatus.from(raw: access.verificationStatus),
                offersLandlord: offersLandlord
            )
        )
    }

    /// Whether the Home's own screen has something for this person: shared
    /// access, or their own verification step there (the server's answer for
    /// that screen). A claim on a Home someone else added gives neither until
    /// it's approved. An unreadable answer keeps "Back to home".
    private func opensHomeScreen() async -> Bool {
        guard let access = try? await authority.read() else { return true }
        return access.access != nil || access.verificationKind != nil
    }

    /// The landlord card helps only when a verified landlord can answer, or
    /// the person already has a request there. An unreadable status hides it.
    private func offersLandlordConfirmation() async -> Bool {
        guard let status: TenantHomeStatusResponse = try? await api.request(
            TenantEndpoints.homeStatus(homeId: homeId)
        ) else { return false }
        return status.matches(homeId: homeId) && status.offersLandlordConfirmation
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

    /// Best-effort street address for this home, and whether the person has
    /// verified their address there. A pending claimant can't read the Home
    /// yet, so their own claim's address comes next; the generic "Your home"
    /// label is the last resort, never an invented one.
    private func homeContext(claimed: OwnershipClaimDTO.ClaimedHome? = nil) async -> (address: String, addressVerified: Bool) {
        guard let detail: HomeDetailResponse = try? await api.request(HomesEndpoints.detail(homeId: homeId)) else {
            let claimedLine = [claimed?.address, claimed?.city, claimed?.state]
                .compactMap { $0 }
                .joined(separator: " · ")
            return (claimedLine.isEmpty ? "Your home" : claimedLine, false)
        }
        let home = detail.home.base
        let joined = [home.address, home.city, home.state]
            .compactMap { $0 }
            .joined(separator: " · ")
        // Household-verified members (an invitation) and claims can still verify the address by mail.
        let verified = detail.home.residencyStatus == "verified"
            && !["household", "claim"].contains(detail.home.residencySource ?? "")
        return (joined.isEmpty ? "Your home" : joined, verified)
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

    /// A checklist button: confirm identity (Stripe's page in an in-app browser) or upload a document.
    public func handleApprovalAction(_ key: String) async {
        switch key {
        case WaitingRoomApproval.uploadDocumentKey:
            handleInlineAction(WaitingRoomInlineAction(
                id: "updateEvidence", label: "", icon: .filePlus2, tone: .primary, actionKey: "update_evidence"
            ))
        case WaitingRoomApproval.confirmIdentityKey:
            await confirmIdentity()
        default:
            log("approval.\(key)")
        }
    }

    /// Starts (or continues) the Stripe Identity check approval needs, opens Stripe's page, and
    /// reads the result when the person comes back. While Stripe is still checking, it looks
    /// again a few times so the answer shows without leaving the room.
    private func confirmIdentity() async {
        guard let claimId, approvalBusyKey == nil else { return }
        approvalBusyKey = WaitingRoomApproval.confirmIdentityKey
        approvalNotice = nil
        do {
            let started: ClaimIdentityCheckStartResponse = try await api.request(
                HomesEndpoints.startClaimIdentityCheck(homeId: homeId, claimId: claimId)
            )
            if let raw = started.verificationUrl, let url = URL(string: raw), url.scheme == "https" {
                approvalBusyKey = nil
                await webPresenter.present(url: url)
            }
        } catch {
            approvalNotice = Self.identityFailureMessage(error)
        }
        approvalBusyKey = nil
        for round in 0..<7 {
            if round > 0 { try? await Task.sleep(for: .seconds(10)) }
            let checked: ClaimIdentityCheckResponse? = try? await api.request(
                HomesEndpoints.claimIdentityCheck(homeId: homeId, claimId: claimId)
            )
            await refresh()
            guard checked?.approval?.identity == "processing", self.claimId == claimId else { break }
        }
    }

    /// The server's own words for a refused identity check (it never names another person).
    static func identityFailureMessage(_ error: Error) -> String {
        switch error {
        case let APIError.clientError(_, message?) where !message.isEmpty:
            return message
        case let APIError.server(_, body):
            if let data = body.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = json["error"] as? String, !message.isEmpty {
                return message
            }
        default:
            break
        }
        return "Your identity check couldn\u{2019}t start. Please try again."
    }

    public func handleInlineAction(_ action: WaitingRoomInlineAction) {
        switch action.actionKey {
        case "update_evidence":
            // A residency document is updated in the residency document flow, never the ownership one.
            if claimIsResidency {
                pendingNav = .uploadProof(homeId: homeId)
            } else if let claimId {
                pendingNav = .updateEvidence(homeId: homeId, claimId: claimId)
            }
        case "cancel_claim":
            pendingNav = .cancelClaim(homeId: homeId)
        case "verify_postcard":
            pendingNav = .verifyPostcard(homeId: homeId)
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
        case "my_homes":
            pendingNav = .myHomes(homeId: homeId)
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
