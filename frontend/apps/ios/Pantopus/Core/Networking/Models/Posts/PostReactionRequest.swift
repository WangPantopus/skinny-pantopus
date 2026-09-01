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

/// UI-only reaction kinds. The design draws three, but only `helpful`
/// maps to a backend route today; `heart` and `going` raise a "coming
/// soon" toast until multi-reaction support lands server-side.
public enum PostReactionKind: String, Sendable, CaseIterable, Identifiable {
    case helpful
    case heart
    case going

    public var id: String {
        rawValue
    }

    /// Spoken label for VoiceOver / TalkBack.
    public var accessibilityLabel: String {
        switch self {
        case .helpful: "Helpful"
        case .heart: "Loved"
        case .going: "Going"
        }
    }

    /// Whether the reaction is wired to a real backend route.
    public var isBackendWired: Bool {
        self == .helpful
    }
}
