//
//  HomeOwnershipClaimEndpoints.swift
//  Pantopus
//
//  Claim-lifecycle routes that sit beside the submit / evidence pair in
//  `HomesEndpoints`. Kept in their own file so the claim flow can grow
//  without touching the 600-line shared homes endpoint surface.
//

import Foundation

/// Endpoint builders for `backend/routes/homeOwnership.js` claim actions.
public enum HomeOwnershipClaimEndpoints {
    /// `POST /api/homes/:id/ownership-claims/:claimId/challenge` — route
    /// `backend/routes/homeOwnership.js:1282`.
    ///
    /// Moves an active ownership claim onto the challenge path against
    /// the home's currently-verified household. The backend re-derives
    /// the claim's evidence strength and answers `409
    /// INSUFFICIENT_CHALLENGE_EVIDENCE` when the uploaded documents
    /// aren't strong enough, so the client only calls this after a
    /// strong document (deed / closing disclosure / escrow attestation /
    /// title match) has been registered. Body is
    /// `challengeClaimSchema` (`homeOwnership.js:63`): an optional
    /// `note`.
    public static func challenge(
        homeId: String,
        claimId: String,
        request: ChallengeClaimRequest = ChallengeClaimRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/ownership-claims/\(claimId)/challenge",
            body: request
        )
    }
}

/// Body for the challenge route. `note` is the only field the Joi schema
/// accepts (`backend/routes/homeOwnership.js:63`).
public struct ChallengeClaimRequest: Encodable, Sendable, Hashable {
    public let note: String?

    public init(note: String? = nil) {
        self.note = note
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(note, forKey: .note)
    }

    private enum CodingKeys: String, CodingKey {
        case note
    }
}

/// Response envelope for the challenge route. The handler answers with a
/// message plus the updated claim block; we only need to know it
/// succeeded, so the payload stays loosely typed.
public struct ChallengeClaimResponse: Decodable, Sendable, Hashable {
    public let message: String?

    public init(message: String? = nil) {
        self.message = message
    }
}
