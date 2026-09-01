//
//  PostPrecheckEndpoints.swift
//  Pantopus
//
//  Pre-post safety precheck. Kept out of `PostsEndpoints` so parallel
//  work on the feed routes doesn't collide.
//

import Foundation

/// `POST /api/posts/precheck`.
public enum PostPrecheckEndpoints {
    /// `POST /api/posts/precheck` — runs the cooldown / tone / callout /
    /// politics / visitor heuristics against a draft before it is
    /// submitted. The handler always fails open (`canPost: true`) on an
    /// internal error, so a transport failure must never block posting.
    /// Route `backend/routes/posts.js:707`.
    public static func precheck(body: PostPrecheckRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/precheck", body: body)
    }
}

/// Body for `POST /api/posts/precheck`
/// (`backend/routes/posts.js:709` destructures exactly these keys).
public struct PostPrecheckRequest: Encodable, Sendable, Hashable {
    public let content: String
    public let postType: String?
    public let purpose: String?
    public let surface: String?
    public let latitude: Double?
    public let longitude: Double?

    public init(
        content: String,
        postType: String? = nil,
        purpose: String? = nil,
        surface: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.content = content
        self.postType = postType
        self.purpose = purpose
        self.surface = surface
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// Response from `POST /api/posts/precheck`
/// (`backend/routes/posts.js:809-816`).
public struct PostPrecheckResponse: Decodable, Sendable, Hashable {
    public let ok: Bool?
    /// False only while a `cooldown_1h` / `cooldown_24h` restriction is
    /// live (`backend/routes/posts.js:811`).
    public let canPost: Bool?
    public let cooldown: Cooldown?
    public let flags: [Flag]?
    public let suggestions: [Suggestion]?
    public let isVisitor: Bool?

    /// Active posting restriction row from `UserPostingCooldown`.
    public struct Cooldown: Decodable, Sendable, Hashable {
        public let restrictionLevel: String?
        public let expiresAt: String?
        public let reason: String?

        private enum CodingKeys: String, CodingKey {
            case restrictionLevel = "restriction_level"
            case expiresAt = "expires_at"
            case reason
        }
    }

    /// Hard signal (`cooldown`, `callout_risk`).
    public struct Flag: Decodable, Sendable, Hashable {
        public let type: String?
        public let level: String?
        public let message: String?
        public let suggestedAction: String?
        public let expiresAt: String?
    }

    /// Soft nudge (`tone_check`, `politics_in_nearby`,
    /// `intent_mismatch`, `visitor_context`).
    public struct Suggestion: Decodable, Sendable, Hashable {
        public let type: String?
        public let message: String?
        public let suggestedAction: String?
        public let suggestedIntents: [String]?
    }

    /// RN surfaces the first suggestion, then the first flag —
    /// `usePostComposer.ts:186`.
    public var primaryNudge: String? {
        let suggestion = suggestions?.first { $0.message?.isEmpty == false }
        if let message = suggestion?.message { return message }
        let flag = flags?.first { $0.message?.isEmpty == false }
        return flag?.message
    }
}
