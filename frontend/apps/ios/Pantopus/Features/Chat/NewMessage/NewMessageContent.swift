//
//  NewMessageContent.swift
//  Pantopus
//
//  Render models for the New Message contact picker (T6.6b P25). The
//  view is pure display — projections from connection / unified-
//  conversation / search DTOs into `NewMessageContactRow` live in the
//  view-model.
//

import Foundation

/// Identity badge tint on the picker row's avatar verification overlay.
public enum NewMessageIdentityBadge: String, Sendable, Hashable {
    case personal, home, business
}

/// One row in the picker. Renders as avatar-with-badge → name +
/// locality + optional sub-line → chevron.
public struct NewMessageContactRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let userId: String
    public let name: String
    public let initials: String
    public let locality: String?
    public let sub: String?
    public let subIcon: PantopusIcon?
    public let verified: Bool
    public let identity: NewMessageIdentityBadge

    public init(
        id: String,
        userId: String,
        name: String,
        initials: String,
        locality: String?,
        sub: String?,
        subIcon: PantopusIcon?,
        verified: Bool,
        identity: NewMessageIdentityBadge
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.initials = initials
        self.locality = locality
        self.sub = sub
        self.subIcon = subIcon
        self.verified = verified
        self.identity = identity
    }
}

/// Stable section ids. Public so the view + tests can address them
/// without sprinkling string literals.
public enum NewMessageSectionID: String, Sendable, Hashable {
    case connections
    case recent
    case allVerified
}

/// One overline-labelled card on the picker. Always rendered as
/// uppercase overline + count + the contained rows.
public struct NewMessageSection: Identifiable, Sendable, Hashable {
    public let id: NewMessageSectionID
    public let label: String
    public let rows: [NewMessageContactRow]

    public init(id: NewMessageSectionID, label: String, rows: [NewMessageContactRow]) {
        self.id = id
        self.label = label
        self.rows = rows
    }
}

/// Top-level render state for the picker.
public enum NewMessageState: Sendable {
    /// Initial fetch in flight.
    case loading
    /// All three sections empty AND no active search query — pivots to
    /// the search-affordance empty state ("Search for someone to
    /// message").
    case empty
    /// Sections + rows ready to render.
    case loaded(sections: [NewMessageSection])
    case error(message: String)
}

/// Routing payload emitted when the user taps a contact row. The host
/// (`InboxTabRoot`) maps this onto a chat-conversation push using the
/// existing `.person` thread mode.
public struct NewMessageDestination: Hashable, Sendable {
    public let userId: String
    public let displayName: String
    public let initials: String
    public let verified: Bool
    public let locality: String?

    public init(
        userId: String,
        displayName: String,
        initials: String,
        verified: Bool,
        locality: String?
    ) {
        self.userId = userId
        self.displayName = displayName
        self.initials = initials
        self.verified = verified
        self.locality = locality
    }
}
