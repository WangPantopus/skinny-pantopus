//
//  InviteOwnerRequest.swift
//  Pantopus
//
//  DTOs for `POST /api/homes/:id/owners/invite` — route
//  `backend/routes/homeOwnership.js:1376`. Schema:
//  `inviteOwnerSchema` at the same file, line 66.
//

import Foundation

/// Body for `POST /api/homes/:id/owners/invite`. Mirrors
/// `inviteOwnerSchema`. All four keys are nullable in the schema, but
/// `email` is effectively required: when no `user_id` is provided the
/// handler looks the user up by email and returns 400 if neither
/// resolves to a known account.
public struct InviteOwnerRequest: Encodable, Sendable, Hashable {
    public var email: String?
    public var phone: String?
    public var userId: String?
    public var fastTrack: Bool

    public init(
        email: String? = nil,
        phone: String? = nil,
        userId: String? = nil,
        fastTrack: Bool = false
    ) {
        self.email = email
        self.phone = phone
        self.userId = userId
        self.fastTrack = fastTrack
    }

    /// Custom encoder so nil optionals are OMITTED from the wire body
    /// instead of emitted as `null`. Backend's `inviteOwnerSchema`
    /// accepts both, but absent keys keep the request small and
    /// surface intent more cleanly to log readers.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(email, forKey: .email)
        try c.encodeIfPresent(phone, forKey: .phone)
        try c.encodeIfPresent(userId, forKey: .userId)
        try c.encode(fastTrack, forKey: .fastTrack)
    }

    private enum CodingKeys: String, CodingKey {
        case email, phone
        case userId = "user_id"
        case fastTrack = "fast_track"
    }
}

/// 201 envelope for `POST /api/homes/:id/owners/invite`.
public struct InviteOwnerResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let claimId: String

    private enum CodingKeys: String, CodingKey {
        case message
        case claimId = "claim_id"
    }
}
