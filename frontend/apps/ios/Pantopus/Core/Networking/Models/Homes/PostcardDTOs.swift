//
//  PostcardDTOs.swift
//  Pantopus
//
//  DTOs for the postcard ownership-verification flow in
//  `backend/routes/homeOwnership.js`:
//    - POST /api/homes/:id/request-postcard (line 2452)
//    - POST /api/homes/:id/verify-postcard  (line 2548)
//
//  Note: the backend has no postcard *delivery-tracking* surface — the
//  request response carries only `id` / `requested_at` / `expires_at`,
//  not a USPS mailed/in-transit/delivered status. The A12.7 timeline is
//  therefore driven by `PostcardVerificationSampleData`. Field-for-field
//  parity with the Android `PostcardDtos.kt`.
//

import Foundation

/// Postcard metadata returned by `POST /api/homes/:id/request-postcard`.
public struct PostcardInfoDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let requestedAt: String?
    public let expiresAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case requestedAt = "requested_at"
        case expiresAt = "expires_at"
    }
}

/// 201 envelope for `POST /api/homes/:id/request-postcard`.
public struct RequestPostcardResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let postcard: PostcardInfoDTO
}

/// Body for `POST /api/homes/:id/verify-postcard`. Mirrors
/// `verifyPostcardSchema` — a 6–8 char alphanumeric code.
public struct VerifyPostcardRequest: Encodable, Sendable, Hashable {
    public let code: String

    public init(code: String) {
        self.code = code
    }
}

/// 200 envelope for `POST /api/homes/:id/verify-postcard`. The
/// `occupancy` row the handler also returns isn't modelled — the screen
/// only needs to know the call succeeded and the resulting status.
public struct VerifyPostcardResponse: Decodable, Sendable, Hashable {
    public let message: String
    /// `'verified' | 'provisional'`.
    public let verificationStatus: String?
    public let challengeWindowEndsAt: String?

    private enum CodingKeys: String, CodingKey {
        case message
        case verificationStatus = "verification_status"
        case challengeWindowEndsAt = "challenge_window_ends_at"
    }
}
