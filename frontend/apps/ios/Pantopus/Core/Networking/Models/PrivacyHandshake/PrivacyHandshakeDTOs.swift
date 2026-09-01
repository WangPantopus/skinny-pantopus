//
//  PrivacyHandshakeDTOs.swift
//  Pantopus
//
//  Decoder shapes for the T3.4 handshake flow.
//

import Foundation

/// Envelope from `GET /api/personas/:handle/fan-handle-suggestion`.
public struct FanHandleSuggestionResponse: Decodable, Sendable {
    public let suggestion: String?
    public let locked: Bool?
    public let identity: AudienceIdentityDTO?
}

public struct AudienceIdentityDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, handle
        case displayName
        case avatarUrl
    }
}

/// Envelope from `GET /api/personas/:id/follow/status`.
public struct FollowStatusResponse: Decodable, Sendable {
    public let following: Bool?
    public let status: String?
    public let relationshipType: String?
    public let notificationLevel: String?
}

/// Envelope from `POST /api/personas/:id/follow` (handshake mode).
/// Tier 1 returns `{follow, status, membership}`; tier > 1 returns
/// `{requiresPayment, subscribeUrl, handshake}`.
public struct HandshakeSubmitResponse: Decodable, Sendable {
    public let follow: HandshakeFollowDTO?
    public let status: String?
    public let membership: HandshakeMembershipDTO?
    public let requiresPayment: Bool?
    public let subscribeUrl: String?
    public let handshake: HandshakeEchoDTO?
}

public struct HandshakeFollowDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let status: String?
    public let relationshipType: String?
}

public struct HandshakeMembershipDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let fanHandle: String?
    public let tierId: String?
    public let status: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case fanHandle = "fan_handle"
        case tierId = "tier_id"
    }
}

public struct HandshakeEchoDTO: Decodable, Sendable, Hashable {
    public let tierRank: Int?
    public let tierId: String?
    public let fanHandle: String?

    enum CodingKeys: String, CodingKey {
        case tierRank = "tier_rank"
        case tierId = "tier_id"
        case fanHandle = "fan_handle"
    }
}

/// Validation error shape returned by `POST /follow` when the body
/// fails Joi validation (e.g. handle pattern). 400 status with a
/// `details` array.
public struct HandshakeValidationErrorDTO: Decodable, Sendable {
    public struct Detail: Decodable, Sendable {
        public let path: String?
        public let message: String?
    }

    public let error: String?
    public let code: String?
    public let details: [Detail]?
}
