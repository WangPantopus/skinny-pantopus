//
//  TokenAcceptViewModel.swift
//  Pantopus
//
//  Resolves an invite token into one of three offers, then drives
//  accept / decline via the matching backend route. Resolution
//  fires the three preview GETs in parallel and picks whichever
//  succeeds first — only one of the three tables ever stores a
//  given token hash so multiple-success is impossible.
//

import Foundation
import Observation

@Observable
@MainActor
public final class TokenAcceptViewModel {
    public private(set) var state: TokenAcceptState = .loading

    private let api: APIClient
    private let token: String
    private let auth: AuthManager
    private let onAccepted: @MainActor (InviteType) -> Void
    private let onDeclined: @MainActor () -> Void

    init(
        token: String,
        api: APIClient = .shared,
        auth: AuthManager = .shared,
        onAccepted: @escaping @MainActor (InviteType) -> Void = { _ in },
        onDeclined: @escaping @MainActor () -> Void = {}
    ) {
        self.token = token
        self.api = api
        self.auth = auth
        self.onAccepted = onAccepted
        self.onDeclined = onDeclined
    }

    public func load() async {
        state = .loading
        let identity = identityChip()
        // Try the three resolvers in parallel; first non-nil wins.
        async let homeTask = tryDecode(HomeInviteResponse.self, endpoint: TokenAcceptEndpoints.homeInvite(token: token))
        async let seatTask = tryDecode(BusinessSeatInviteResponse.self, endpoint: TokenAcceptEndpoints.businessSeatInvite(token: token))
        async let guestTask = tryDecode(TokenAcceptGuestPassResponse.self, endpoint: TokenAcceptEndpoints.guestPass(token: token))

        let home = await homeTask
        let seat = await seatTask
        let guest = await guestTask

        if let home, let invitation = home.invitation {
            if home.expired == true || invitation.status == "expired" {
                state = .expired(message: "This invitation has expired. Ask the sender for a new link.")
                return
            }
            if home.alreadyUsed == true || invitation.status == "accepted" {
                state = .expired(message: "This invitation has already been used.")
                return
            }
            state = .ready(Self.makeHomeOffer(home: home, invitation: invitation, identity: identity))
            return
        }
        if let seat, seat.seatId != nil {
            state = .ready(Self.makeSeatOffer(seat: seat, identity: identity))
            return
        }
        if let guest, let pass = guest.pass {
            state = .ready(Self.makeGuestOffer(pass: pass, identity: identity))
            return
        }
        state = .expired(message: "We couldn't find this invitation. It might have expired or been used.")
    }

    public func accept() async {
        guard case let .ready(offer) = state else { return }
        state = .accepting(offer)
        do {
            switch offer.inviteType {
            case .homeInvite:
                let _: HomeAcceptResponse = try await api.request(TokenAcceptEndpoints.acceptHomeInvite(token: token))
                state = .accepted(offer, message: "You're now a member of \(offer.venue).")
                onAccepted(.homeInvite)
            case .businessSeat:
                let _: BusinessSeatAcceptResponse = try await api.request(
                    TokenAcceptEndpoints.acceptBusinessSeat(body: BusinessSeatAcceptBody(token: token))
                )
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
            state = .error(message: (error as? APIError)?.errorDescription ?? "Couldn't accept this invitation.")
        }
    }

    public func decline() async {
        guard case let .ready(offer) = state else { return }
        do {
            switch offer.inviteType {
            case .homeInvite:
                if let invitationId = offer.invitationId {
                    let _: AnyDecodable? = try? await api.request(
                        TokenAcceptEndpoints.declineHomeInvite(invitationId: invitationId)
                    )
                }
            case .businessSeat:
                let _: AnyDecodable? = try? await api.request(
                    TokenAcceptEndpoints.declineBusinessSeat(body: BusinessSeatDeclineBody(token: token))
                )
            case .guestPass:
                // Nothing to decline on the server side.
                break
            }
            state = .declined
            onDeclined()
        }
    }

    // MARK: - Projection

    static func makeHomeOffer(
        home: HomeInviteResponse,
        invitation: HomeInviteDetailsDTO,
        identity: IdentityChipContent
    ) -> TokenAcceptOffer {
        let homeName = home.home?.name ?? "this home"
        let city = home.home?.city
        let venue = [homeName, city].compactMap { $0?.isEmpty == false ? $0 : nil }.compactMap { $0 }.joined(separator: " · ")
        let sender = home.inviter?.name ?? home.inviter?.username ?? "Someone"
        let role = humanRole(invitation.proposedRole ?? "member")
        return TokenAcceptOffer(
            invitationId: invitation.id,
            inviteType: .homeInvite,
            title: "Join a home",
            sender: "\(sender) invited you",
            roleOffered: role,
            venue: venue.isEmpty ? homeName : venue,
            benefits: homeBenefits(role: invitation.proposedRole),
            expiry: formatExpiry(invitation.expiresAt),
            safetyBand: SafetyBand(
                icon: .lock,
                text: "Your email and personal account stay private — \(sender) only sees your accepted role."
            ),
            primaryCtaLabel: "Join \(homeName)",
            secondaryCtaLabel: "Decline",
            identityChip: identity
        )
    }

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

    private func tryDecode<T: Decodable>(
        _: T.Type,
        endpoint: Endpoint
    ) async -> T? {
        try? await api.request(endpoint) as T
    }

    static func humanRole(_ raw: String) -> String {
        let normalized = raw.replacingOccurrences(of: "_", with: " ").trimmingCharacters(in: .whitespaces)
        guard !normalized.isEmpty else { return "Member" }
        return normalized.prefix(1).uppercased() + normalized.dropFirst()
    }

    static func homeBenefits(role: String?) -> [String] {
        let lower = role?.lowercased() ?? ""
        if lower.contains("owner") || lower.contains("co_owner") {
            return [
                "Co-manage occupants, ownership, and home settings",
                "Share home docs, wi-fi, and entry info with guests",
                "See all home activity in your Hub"
            ]
        }
        if lower.contains("renter") || lower.contains("tenant") {
            return [
                "See house docs, wi-fi, and entry info",
                "Get notified about home updates and tasks",
                "Mark yourself as a resident in your local profile"
            ]
        }
        return [
            "See house docs, wi-fi, and entry info",
            "Get home updates in your Hub",
            "Privately label yourself a resident if you want"
        ]
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
