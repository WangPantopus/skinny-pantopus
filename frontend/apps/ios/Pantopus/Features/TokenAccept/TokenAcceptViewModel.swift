//
//  TokenAcceptViewModel.swift
//  Pantopus
//
//  Resolves Home, business-seat and guest-pass links without treating
//  unavailable reads as expired invitations. Home decisions recover their
//  protected original before a newly opened token can replace the screen.
//

import Foundation
import Observation

@Observable
@MainActor
public final class TokenAcceptViewModel {
    public private(set) var state: TokenAcceptState = .loading
    private(set) var homeDecision: HomeInvitationDecisionViewModel?
    private var generation = 0
    private var session: HomeClaimSessionScope?
    var sessionIsCurrent: Bool {
        session?.isCurrent ?? true
    }

    func suspend() {
        generation += 1
        homeDecision?.suspend()
        homeDecision = nil
        state = .loading
    }

    func close() {
        onDeclined()
    }

    private let api: APIClient
    private let token: String
    private let auth: AuthManager
    private let invitationStore: any PendingHomeInvitationDecisionStoring
    private let onAccepted: @MainActor (InviteType) -> Void
    private let onDeclined: @MainActor () -> Void

    init(
        token: String,
        api: APIClient = .shared,
        auth: AuthManager? = nil,
        invitationStore: any PendingHomeInvitationDecisionStoring = PendingHomeInvitationDecisionStore(),
        onAccepted: @escaping @MainActor (InviteType) -> Void = { _ in },
        onDeclined: @escaping @MainActor () -> Void = {}
    ) {
        self.token = token
        self.api = api
        self.auth = auth ?? api.authProvider ?? AuthManager.shared
        self.invitationStore = invitationStore
        self.onAccepted = onAccepted
        self.onDeclined = onDeclined
    }

    public func load() async {
        suspend()
        let revision = generation
        let lease = HomeClaimSessionScope(api: api)
        session = lease
        let scope = HomeInvitationDecisionViewModel.scope(api: api)
        guard scope.isValid, lease.isCurrent else {
            state = .error(message: "Sign in to review this invitation.")
            return
        }
        do {
            if try invitationStore.load(scope: scope) != nil {
                homeDecision = HomeInvitationDecisionViewModel(token: token, api: api, store: invitationStore)
                return
            }
        } catch {
            // An unreadable protected slot must not be treated as empty.
            homeDecision = HomeInvitationDecisionViewModel(token: token, api: api, store: invitationStore)
            return
        }
        let identity = identityChip()
        async let homeTask = resolve(JSONValue.self, endpoint: TokenAcceptEndpoints.homeInvite(token: token))
        async let seatTask = resolve(BusinessSeatInviteResponse.self, endpoint: TokenAcceptEndpoints.businessSeatInvite(token: token))
        async let guestTask = resolve(TokenAcceptGuestPassResponse.self, endpoint: TokenAcceptEndpoints.guestPass(token: token))
        let (home, seat, guest) = await (homeTask, seatTask, guestTask)
        guard generation == revision, lease.isCurrent, !Task.isCancelled else { return }
        if case let .success(value) = home {
            guard HomeInvitationValidation.preview(value) else {
                state = .error(message: "The invitation response could not be checked. Retry to review its current details.")
                return
            }
            homeDecision = HomeInvitationDecisionViewModel(token: token, api: api, store: invitationStore)
            return
        }
        if case let .success(value) = seat, let id = value.seatId, HomePostalValidation.uuid(id) {
            state = .ready(Self.makeSeatOffer(seat: value, identity: identity))
            return
        }
        if case let .success(value) = guest, let pass = value.pass, pass.label != nil || pass.customTitle != nil {
            state = .ready(Self.makeGuestOffer(pass: pass, identity: identity))
            return
        }
        let allMissing = home.isMissing && seat.isMissing && guest.isMissing
        state = allMissing ? .expired(message: "This invitation is unavailable. Check the complete link with the sender.")
            : .error(message: "The invitation could not be checked right now. Retry to review its current status.")
    }

    public func accept() async {
        guard case let .ready(offer) = state, sessionIsCurrent else { return }
        let revision = generation
        state = .accepting(offer)
        do {
            switch offer.inviteType {
            case .homeInvite:
                homeDecision = HomeInvitationDecisionViewModel(token: token, api: api, store: invitationStore)
            case .businessSeat:
                let _: BusinessSeatAcceptResponse = try await api.request(
                    TokenAcceptEndpoints.acceptBusinessSeat(body: BusinessSeatAcceptBody(token: token))
                )
                guard generation == revision, sessionIsCurrent, !Task.isCancelled else { return }
                state = .accepted(offer, message: "Welcome to \(offer.venue) — your seat is active.")
                onAccepted(.businessSeat)
            case .guestPass:
                // Guest passes don't have a separate "accept" — viewing
                // is the acceptance. Mark accepted so the success
                // frame renders, then route the user to the pass.
                state = .accepted(offer, message: "Your guest pass is active. Welcome to \(offer.venue).")
                onAccepted(.guestPass)
            }
        } catch {
            guard generation == revision, sessionIsCurrent else { return }
            state = .error(message: "Acceptance could not be confirmed. Retry to check the invitation’s current status.")
        }
    }

    public func decline() async {
        guard case let .ready(offer) = state, sessionIsCurrent else { return }
        let revision = generation
        state = .accepting(offer)
        do {
            switch offer.inviteType {
            case .homeInvite:
                homeDecision = HomeInvitationDecisionViewModel(token: token, api: api, store: invitationStore)
                return
            case .businessSeat:
                let _: AnyDecodable = try await api.request(
                    TokenAcceptEndpoints.declineBusinessSeat(body: BusinessSeatDeclineBody(token: token))
                )
            case .guestPass:
                break
            }
            guard generation == revision, sessionIsCurrent, !Task.isCancelled else { return }
            state = .declined
            onDeclined()
        } catch {
            guard generation == revision, sessionIsCurrent else { return }
            state = .error(message: "The decline could not be confirmed. Retry to check the invitation's current status.")
        }
    }

    // MARK: - Projection

    static func makeSeatOffer(
        seat: BusinessSeatInviteResponse,
        identity: IdentityChipContent
    ) -> TokenAcceptOffer {
        let venue = seat.business?.name ?? seat.business?.username ?? "this business"
        let sender = seat.business?.name ?? "The team"
        let role = humanRole(seat.roleBase ?? "member")
        return TokenAcceptOffer(
            invitationId: seat.seatId,
            inviteType: .businessSeat,
            title: "Accept a business seat",
            sender: "\(sender) offered you a seat",
            roleOffered: role,
            venue: venue,
            benefits: seatBenefits(role: seat.roleBase),
            expiry: nil,
            safetyBand: SafetyBand(
                icon: .shieldCheck,
                text: "Your seat is firewalled — coworkers see your business profile, not your local identity."
            ),
            primaryCtaLabel: "Add me to \(venue)",
            secondaryCtaLabel: "Decline",
            identityChip: identity
        )
    }

    static func makeGuestOffer(
        pass: TokenAcceptGuestPassDTO,
        identity: IdentityChipContent
    ) -> TokenAcceptOffer {
        let venue = pass.homeName ?? pass.customTitle ?? "the host's place"
        let kind = (pass.kind ?? "guest").replacingOccurrences(of: "_", with: " ")
        let label = pass.label ?? pass.customTitle ?? "Guest pass"
        let expiry = formatExpiry(pass.expiresAt)
        return TokenAcceptOffer(
            invitationId: nil,
            inviteType: .guestPass,
            title: label,
            sender: "Welcome to \(venue)",
            roleOffered: humanRole(kind),
            venue: venue,
            benefits: guestBenefits(welcomeMessage: pass.welcomeMessage, expiresAt: pass.expiresAt),
            expiry: expiry,
            safetyBand: SafetyBand(
                icon: .lock,
                text: "Guest passes never reveal your account email — you stay anonymous to the host."
            ),
            primaryCtaLabel: "View guest pass",
            secondaryCtaLabel: "Not now",
            identityChip: identity
        )
    }

    // MARK: - Helpers

    private func identityChip() -> IdentityChipContent {
        if case let .signedIn(user) = auth.state {
            let displayName = user.displayName ?? ""
            let label = displayName.isEmpty ? user.email : displayName
            return IdentityChipContent(label: label, handle: nil)
        }
        return IdentityChipContent(label: "Accepting as guest")
    }

    private enum Resolution<Value> {
        case success(Value), missing, unavailable
        var isMissing: Bool {
            if case .missing = self { true } else { false }
        }
    }

    private func resolve<T: Decodable>(_: T.Type, endpoint: Endpoint) async -> Resolution<T> {
        do { return try await .success(api.request(endpoint)) } catch APIError.notFound { return .missing } catch { return .unavailable }
    }

    static func humanRole(_ raw: String) -> String {
        let normalized = raw.replacingOccurrences(of: "_", with: " ").trimmingCharacters(in: .whitespaces)
        guard !normalized.isEmpty else { return "Member" }
        return normalized.prefix(1).uppercased() + normalized.dropFirst()
    }

    static func seatBenefits(role: String?) -> [String] {
        let lower = role?.lowercased() ?? ""
        var benefits: [String] = [
            "Post and respond as \(humanRole(role ?? "member"))",
            "Access the business dashboard and team feed"
        ]
        if lower.contains("admin") || lower.contains("manager") {
            benefits.append("Invite teammates and manage seats")
        } else {
            benefits.append("Switch identities anytime in the You tab")
        }
        return benefits
    }

    static func guestBenefits(welcomeMessage: String?, expiresAt: String?) -> [String] {
        var benefits: [String] = []
        if let message = welcomeMessage, !message.isEmpty {
            benefits.append(message)
        }
        benefits.append("See wi-fi, parking, and entry info during your stay")
        if let expiry = expiresAt, let days = daysFromNow(expiry) {
            benefits.append("Valid for \(days) day\(days == 1 ? "" : "s")")
        }
        return benefits
    }

    static func formatExpiry(_ iso: String?) -> String? {
        guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return "Expires \(formatter.string(from: date))"
    }

    static func daysFromNow(_ iso: String) -> Int? {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return nil }
        let seconds = date.timeIntervalSinceNow
        if seconds <= 0 { return nil }
        return Int((seconds / 86400).rounded(.up))
    }
}

/// Decodable placeholder used when we don't care about a response
/// body (e.g. the decline endpoints).
private struct AnyDecodable: Decodable {}
