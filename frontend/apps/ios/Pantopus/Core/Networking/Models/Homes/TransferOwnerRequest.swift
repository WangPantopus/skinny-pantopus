//
//  TransferOwnerRequest.swift
//  Pantopus
//
//  DTOs for `POST /api/homes/:id/owners/transfer` — route
//  `backend/routes/homeOwnership.js:1526`. Schema: `transferOwnerSchema`
//  at the same file, line 74.
//

import Foundation

/// Body for `POST /api/homes/:id/owners/transfer`. Mirrors
/// `transferOwnerSchema`. All four keys are nullable in the schema; in
/// practice the buyer is identified by `buyer_user_id` (when the
/// recipient was picked from a known account) or by `buyer_email` /
/// `buyer_phone` for an off-platform invite.
public struct TransferOwnerRequest: Encodable, Sendable, Hashable {
    public var buyerEmail: String?
    public var buyerPhone: String?
    public var buyerUserId: String?
    /// ISO-8601 effective date. Omitted when the transfer takes effect
    /// immediately.
    public var effectiveDate: String?

    public init(
        buyerEmail: String? = nil,
        buyerPhone: String? = nil,
        buyerUserId: String? = nil,
        effectiveDate: String? = nil
    ) {
        self.buyerEmail = buyerEmail
        self.buyerPhone = buyerPhone
        self.buyerUserId = buyerUserId
        self.effectiveDate = effectiveDate
    }

    /// Custom encoder so nil optionals are OMITTED from the wire body
    /// instead of emitted as `null` — keeps requests small and matches
    /// the `InviteOwnerRequest` convention.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(buyerEmail, forKey: .buyerEmail)
        try c.encodeIfPresent(buyerPhone, forKey: .buyerPhone)
        try c.encodeIfPresent(buyerUserId, forKey: .buyerUserId)
        try c.encodeIfPresent(effectiveDate, forKey: .effectiveDate)
    }

    private enum CodingKeys: String, CodingKey {
        case buyerEmail = "buyer_email"
        case buyerPhone = "buyer_phone"
        case buyerUserId = "buyer_user_id"
        case effectiveDate = "effective_date"
    }
}

/// Envelope for `POST /api/homes/:id/owners/transfer`. The backend
/// returns one of two shapes depending on quorum:
///   - direct (200):  `{ "message": …, "transfer_claim_id": "uuid"|null }`
///   - quorum (201):  `{ "message": …, "quorum_action_id": "uuid",
///                       "required_approvals": 2 }`
///
/// All shape-specific keys are optional so a single type decodes both.
public struct TransferOwnerResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let transferClaimId: String?
    public let quorumActionId: String?
    public let requiredApprovals: Int?

    /// `true` when the backend deferred the transfer to a co-owner
    /// approval quorum rather than initiating it immediately.
    public var requiresQuorum: Bool {
        quorumActionId != nil
    }

    public init(
        message: String,
        transferClaimId: String? = nil,
        quorumActionId: String? = nil,
        requiredApprovals: Int? = nil
    ) {
        self.message = message
        self.transferClaimId = transferClaimId
        self.quorumActionId = quorumActionId
        self.requiredApprovals = requiredApprovals
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case transferClaimId = "transfer_claim_id"
        case quorumActionId = "quorum_action_id"
        case requiredApprovals = "required_approvals"
    }
}
