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

    /// The kindness and safety check when the person taps Post: the same
    /// route with `stage: "post"`, answering `findings` (AI phase 2
    /// contract §6.6). The composer waits at most 10 seconds, then posts.
    /// Route `backend/routes/posts.js` `POST /precheck`.
    public static func postCheck(body: PostPrecheckRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/posts/precheck", body: body, timeout: 10)
    }

    /// "Before you ask": up to 3 earlier questions and recommendations
    /// nearby matching the question being written, each with its best
    /// reply (AI phase 2 contract §6.5).
    /// Route `backend/routes/posts.js` `GET /before-you-ask`.
    public static func beforeYouAsk(query: String, latitude: Double?, longitude: Double?) -> Endpoint {
        var params = ["q": query]
        if let latitude, let longitude {
            params["latitude"] = String(latitude)
            params["longitude"] = String(longitude)
        }
        return Endpoint(method: .get, path: "/api/posts/before-you-ask", query: params)
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
    /// `"post"` when the person tapped Post: the answer adds `findings`.
    public let stage: String?
    public let title: String?
    public let safetyAlertKind: String?

    public init(
        content: String,
        postType: String? = nil,
        purpose: String? = nil,
        surface: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        stage: String? = nil,
        title: String? = nil,
        safetyAlertKind: String? = nil
    ) {
        self.content = content
        self.postType = postType
        self.purpose = purpose
        self.surface = surface
        self.latitude = latitude
        self.longitude = longitude
        self.stage = stage
        self.title = title
        self.safetyAlertKind = safetyAlertKind
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
    /// What the kindness and safety check found (`stage: "post"` only),
    /// most important first. Empty: post at once.
    public let findings: [Finding]?

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

    /// One thing the check found: `kind` is `heads_up_kind`, `tone`,
    /// `phone` or `address`; `message` is the server's sentence.
    public struct Finding: Decodable, Sendable, Hashable {
        public let kind: String
        public let message: String
        public let text: String?
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

/// Response from `GET /api/posts/before-you-ask`.
public struct BeforeYouAskResponse: Decodable, Sendable, Hashable {
    public let posts: [EarlierPost]

    /// An earlier question or recommendation nearby.
    public struct EarlierPost: Decodable, Sendable, Hashable, Identifiable {
        public let postId: String
        /// `ask_local` or `recommendation`.
        public let type: String
        public let title: String?
        public let body: String?
        public let solved: Bool?
        public let replyCount: Int?
        public let bestReply: Reply?

        public var id: String {
            postId
        }

        private enum CodingKeys: String, CodingKey {
            case postId = "post_id"
            case type, title, body, solved
            case replyCount = "reply_count"
            case bestReply = "best_reply"
        }
    }

    /// Its best reply: one the asker marked Helpful, else the most liked.
    public struct Reply: Decodable, Sendable, Hashable {
        public let text: String?
        public let helpful: Bool?
        public let likes: Int?
    }
}
