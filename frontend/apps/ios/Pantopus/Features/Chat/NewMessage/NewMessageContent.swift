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
    /// The person's photo; their initials show without one.
    public let avatarURL: URL?
    /// A group chat's room, for a row under Groups (whose `userId` is the room too).
    public let roomId: String?

    public init(
        id: String,
        userId: String,
        name: String,
        initials: String,
        locality: String?,
        sub: String?,
        subIcon: PantopusIcon?,
        verified: Bool,
        identity: NewMessageIdentityBadge,
        avatarURL: URL? = nil,
        roomId: String? = nil
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
        self.avatarURL = avatarURL
        self.roomId = roomId
    }
}

/// Stable section ids. Public so the view + tests can address them
/// without sprinkling string literals.
public enum NewMessageSectionID: String, Sendable, Hashable {
    case connections
    case recent
    /// Recent group and household chats, when the picker sends to them too.
    case groups
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
    /// A search is active, nothing on this device matches and the people
    /// search failed — so "No matches" would be a guess.
    case searchFailed
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
    public let identity: NewMessageIdentityBadge
    /// The person's photo, for the conversation the pick opens.
    public let avatarURL: URL?
    /// Set for a group chat picked: the room the message goes to.
    public let roomId: String?

    public init(
        userId: String,
        displayName: String,
        initials: String,
        verified: Bool,
        locality: String?,
        identity: NewMessageIdentityBadge = .personal,
        avatarURL: URL? = nil,
        roomId: String? = nil
    ) {
        self.userId = userId
        self.displayName = displayName
        self.initials = initials
        self.verified = verified
        self.locality = locality
        self.identity = identity
        self.avatarURL = avatarURL
        self.roomId = roomId
    }
}
