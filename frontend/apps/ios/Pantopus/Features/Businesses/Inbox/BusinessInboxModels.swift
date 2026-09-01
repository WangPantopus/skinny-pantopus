//
//  BusinessInboxModels.swift
//  Pantopus
//
//  Render models for the business-side inbox — the native counterpart of
//  RN's `components/business/tabs/InboxTab.tsx`. Two sections behind one
//  toggle:
//    · Messages — rooms addressed to the *business* identity
//      (`GET /api/chat/business/:businessUserId/rooms`);
//    · Mentions — neighborhood posts matched to the business
//      (`GET /api/businesses/:businessId/matched-posts`).
//

import Foundation

/// Which half of the inbox is showing. RN's `InboxSection`.
public enum BusinessInboxSection: String, Sendable, Hashable, CaseIterable {
    case messages
    case mentions

    public var title: String {
        switch self {
        case .messages: "Messages"
        case .mentions: "Mentions"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .messages: .messageSquare
        case .mentions: .atSign
        }
    }
}

/// One conversation row in the Messages section.
public struct BusinessInboxRoom: Sendable, Hashable, Identifiable {
    public let id: String
    /// Counterpart display name, falling back to the room name.
    public let title: String
    /// Counterpart handle, without the leading `@` (used for initials +
    /// the conversation chrome). Empty when the serializer had none.
    public let handle: String
    /// Last message preview; empty when the room has no visible message.
    public let preview: String
    /// Relative timestamp ("2h ago"); empty when unknown.
    public let timeAgo: String
    public let unreadCount: Int

    public var isUnread: Bool {
        unreadCount > 0
    }

    public init(
        id: String,
        title: String,
        handle: String,
        preview: String,
        timeAgo: String,
        unreadCount: Int
    ) {
        self.id = id
        self.title = title
        self.handle = handle
        self.preview = preview
        self.timeAgo = timeAgo
        self.unreadCount = unreadCount
    }
}

/// One post row in the Mentions section.
public struct BusinessInboxMention: Sendable, Hashable, Identifiable {
    public let id: String
    /// Post author's display name ("Someone" when the serializer omits it).
    public let authorName: String
    public let avatarURL: URL?
    /// Title when present, otherwise the body — matching RN's
    /// `post.title || post.content`.
    public let body: String
    public let timeAgo: String
    /// "3 likes · 2 comments"; empty when both counts are zero.
    public let engagement: String

    public init(
        id: String,
        authorName: String,
        avatarURL: URL?,
        body: String,
        timeAgo: String,
        engagement: String
    ) {
        self.id = id
        self.authorName = authorName
        self.avatarURL = avatarURL
        self.body = body
        self.timeAgo = timeAgo
        self.engagement = engagement
    }
}

/// Render state for one inbox section. Each section loads independently so
/// switching tabs never blanks the other half.
public enum BusinessInboxSectionState: Sendable, Equatable {
    case loading
    case loadedRooms([BusinessInboxRoom])
    case loadedMentions([BusinessInboxMention])
    case empty
    case error(message: String)
}
