//
//  PostReactionRequest.swift
//  Pantopus
//
//  Backend exposes a single toggle: `POST /api/posts/:id/like` returns
//  `{ liked: Bool, likeCount: Int }`. Route: `backend/routes/posts.js:2375`.
//

import Foundation

/// Response payload for `POST /api/posts/:id/like`.
public struct PostLikeResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let liked: Bool
    public let likeCount: Int
}

/// A post's one reaction (the like above, counted in `like_count`), named
/// for what it means on that kind of post, the same on web, iPhone and
/// Android and in the author's notice (`backend/utils/postReaction.js`):
/// Going on an event, Celebrate on a win, Helpful on every other kind.
public enum PostReactionKind: String, Sendable, CaseIterable, Identifiable {
    case helpful
    case going
    case celebrate

    public init(postType: String?) {
        switch postType {
        case "event": self = .going
        case "neighborhood_win", "progress_wins": self = .celebrate
        default: self = .helpful
        }
    }

    public var id: String {
        rawValue
    }

    /// The button: "Helpful", "Going", "Celebrate".
    public var label: String {
        switch self {
        case .helpful: "Helpful"
        case .going: "Going"
        case .celebrate: "Celebrate"
        }
    }

    /// The count in words: "3 helpful", "2 going", "4 celebrated".
    public func countText(_ count: Int) -> String {
        switch self {
        case .helpful: "\(count) helpful"
        case .going: "\(count) going"
        case .celebrate: "\(count) celebrated"
        }
    }
}
