//
//  HomeVerificationDTOs.swift
//  Pantopus
//
//  Verification-facing slice of the viewer's own home-access record —
//  `GET /api/homes/:id/me` (route `backend/routes/homeIam.js:51`,
//  builder `HomeAdminEndpoints.myAccess`).
//
//  `HomeAccessDTO` (`HomeAdminDTOs.swift`) models only the fields the
//  Members roster needs. The Verification Center branches on a different
//  slice of the same payload — `verification_status`, the challenge
//  window, and the pending postcard's expiry — so it decodes into its
//  own DTO rather than growing the roster's.
//

import Foundation

/// The verification context `GET /api/homes/:id/me` emits
/// (`backend/routes/homeIam.js:124-141`). Every field is optional-safe:
/// the handler's 403 branch (`homeIam.js:59-63`) returns a much smaller
/// object, and it must still decode.
public struct HomeVerificationAccessDTO: Decodable, Sendable, Hashable {
    public let hasAccess: Bool
    /// `occupancy.verification_status` — `unverified` when the row
    /// carries none (`homeIam.js:126`).
    public let verificationStatus: String
    /// `true` while `verification_status == "provisional"` and
    /// `challenge_window_ends_at` is still in the future.
    public let isInChallengeWindow: Bool
    public let challengeWindowEndsAt: String?
    /// Expiry of the caller's `pending` `HomePostcardCode` row, or nil
    /// when none is outstanding (`homeIam.js:82-89`).
    public let postcardExpiresAt: String?

    public init(
        hasAccess: Bool,
        verificationStatus: String = "unverified",
        isInChallengeWindow: Bool = false,
        challengeWindowEndsAt: String? = nil,
        postcardExpiresAt: String? = nil
    ) {
        self.hasAccess = hasAccess
        self.verificationStatus = verificationStatus
        self.isInChallengeWindow = isInChallengeWindow
        self.challengeWindowEndsAt = challengeWindowEndsAt
        self.postcardExpiresAt = postcardExpiresAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hasAccess = try container.decodeIfPresent(Bool.self, forKey: .hasAccess) ?? false
        verificationStatus =
            try container.decodeIfPresent(String.self, forKey: .verificationStatus) ?? "unverified"
        isInChallengeWindow =
            try container.decodeIfPresent(Bool.self, forKey: .isInChallengeWindow) ?? false
        challengeWindowEndsAt =
            try container.decodeIfPresent(String.self, forKey: .challengeWindowEndsAt)
        postcardExpiresAt =
            try container.decodeIfPresent(String.self, forKey: .postcardExpiresAt)
    }

    /// Whether the caller still owes the home a verification step. Mirrors
    /// RN's `needsVerification` (`src/hooks/useHomeAccess.ts:97`).
    public var needsVerification: Bool {
        verificationStatus != "verified"
    }

    private enum CodingKeys: String, CodingKey {
        case hasAccess
        case verificationStatus = "verification_status"
        case isInChallengeWindow = "is_in_challenge_window"
        case challengeWindowEndsAt = "challenge_window_ends_at"
        case postcardExpiresAt = "postcard_expires_at"
    }
}
