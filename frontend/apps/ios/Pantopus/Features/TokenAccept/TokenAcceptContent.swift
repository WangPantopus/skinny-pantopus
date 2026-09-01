//
//  TokenAcceptContent.swift
//  Pantopus
//
//  Render-only models for the T3.5 Token / Accept screen.
//

import Foundation

/// Which kind of token the deep link resolved into.
public enum InviteType: Sendable, Hashable {
    case homeInvite
    case businessSeat
    case guestPass
}

/// The identity that will accept the invite. Renders as a small chip
/// in the header.
public struct IdentityChipContent: Sendable, Hashable {
    public let label: String
    public let handle: String?

    public init(label: String, handle: String? = nil) {
        self.label = label
        self.handle = handle
    }
}

/// One safety / firewall reassurance line below the offer card.
public struct SafetyBand: Sendable, Hashable {
    public let icon: PantopusIcon
    public let text: String

    public init(icon: PantopusIcon, text: String) {
        self.icon = icon
        self.text = text
    }
}

/// Top-level offer the screen renders. Built by the VM after the
/// resolver picks one of the three flavors.
public struct TokenAcceptOffer: Sendable, Hashable {
    public let invitationId: String?
    public let inviteType: InviteType
    public let title: String
    public let sender: String
    public let roleOffered: String
    public let venue: String
    public let benefits: [String]
    public let expiry: String?
    public let safetyBand: SafetyBand
    public let primaryCtaLabel: String
    public let secondaryCtaLabel: String
    public let identityChip: IdentityChipContent

    public init(
        invitationId: String?,
        inviteType: InviteType,
        title: String,
        sender: String,
        roleOffered: String,
        venue: String,
        benefits: [String],
        expiry: String?,
        safetyBand: SafetyBand,
        primaryCtaLabel: String,
        secondaryCtaLabel: String,
        identityChip: IdentityChipContent
    ) {
        self.invitationId = invitationId
        self.inviteType = inviteType
        self.title = title
        self.sender = sender
        self.roleOffered = roleOffered
        self.venue = venue
        self.benefits = benefits
        self.expiry = expiry
        self.safetyBand = safetyBand
        self.primaryCtaLabel = primaryCtaLabel
        self.secondaryCtaLabel = secondaryCtaLabel
        self.identityChip = identityChip
    }
}

/// Top-level state.
public enum TokenAcceptState: Sendable {
    case loading
    case ready(TokenAcceptOffer)
    case accepting(TokenAcceptOffer)
    case accepted(TokenAcceptOffer, message: String)
    case declined
    case expired(message: String)
    case error(message: String)
}
