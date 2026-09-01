//
//  PersonaDmDTOs.swift
//  Pantopus
//
//  Decoder shapes for the persona-DM routes (`backend/routes/personaDms.js`).
//  The serializers there emit camelCase already (`serializeMessage` /
//  the thread-detail literal), so no snake_case `CodingKeys` are needed —
//  the one exception is nothing here, which is why this file has none.
//
//  Privacy invariant carried through to the client: no `user_id` for
//  either party appears on the wire. A message is attributed by
//  `senderRole` ("fan" / "creator"), a thread by `membershipId`.
//

import Foundation

// MARK: - GET /api/personas/:id/dms/threads/:threadId

/// Thread detail envelope (`backend/routes/personaDms.js:280`).
public struct PersonaDmThreadDetailResponse: Decodable, Sendable, Hashable {
    public let thread: PersonaDmThreadDTO?
    public let fan: PersonaDmFanDTO?
    public let persona: PersonaDmPersonaDTO?
    /// `"fan"` or `"creator"` — which side the caller is on.
    public let viewerRole: String?
    public let messages: [PersonaDmMessageDTO]?
    /// Fan-side only. `nil` for the creator, for `discretion` tiers, and
    /// once the creator has replied at least once.
    public let replyPolicyStatus: PersonaDmReplyPolicyStatusDTO?
}

public struct PersonaDmThreadDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let membershipId: String?
    /// `open` / `closed` / `blocked`.
    public let status: String?
    public let createdAt: String?
    public let lastMessageAt: String?
}

/// The fan's pseudonymous audience identity — never their local identity.
public struct PersonaDmFanDTO: Decodable, Sendable, Hashable {
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?
}

public struct PersonaDmPersonaDTO: Decodable, Sendable, Hashable {
    public let handle: String?
    public let displayName: String?
}

public struct PersonaDmMessageDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let threadId: String?
    /// `"fan"` or `"creator"`.
    public let senderRole: String?
    public let body: String?
    public let createdAt: String?
    public let readAt: String?
    // `media` is present on the wire (always an array) but the native
    // composer is text-only today, so it is intentionally not decoded.
}

/// Reply-policy SLA gauge (`personaDmService.getReplyPolicyStatus`).
/// `status` is `on_track` or `sla_missed`; `policy` is one of
/// `discretion / within_3_days / within_7_days / within_14_days / always`.
public struct PersonaDmReplyPolicyStatusDTO: Decodable, Sendable, Hashable {
    public let status: String?
    public let policy: String?
    public let slaDays: Int?
    public let daysRemaining: Int?
}

// MARK: - POST /api/personas/:id/dms/threads

/// 201 body of the open-thread route (`backend/routes/personaDms.js:175`).
/// `quotaRemaining` is `nil` when the tier grants unlimited threads.
public struct PersonaDmOpenThreadResponse: Decodable, Sendable, Hashable {
    public let threadId: String?
    public let quotaRemaining: Int?
}

// MARK: - POST /api/personas/:id/dms/threads/:threadId/messages

/// 201 body of the append-message route (`backend/routes/personaDms.js:387`).
public struct PersonaDmSendMessageResponse: Decodable, Sendable, Hashable {
    public let message: PersonaDmMessageDTO?
}
