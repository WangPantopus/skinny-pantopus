//
//  MembershipDTOs.swift
//  Pantopus
//
//  Decoder shapes for `GET /api/personas/:id/membership` — the fan-side
//  view of their own membership (A10.8). Built by `serializeMembershipForFan`
//  (`backend/serializers/identitySerializers.js:352`), wrapped in
//  `stripNullish`, so several keys (e.g. `fanHandle`, period bounds) may be
//  absent — every field is therefore optional. The embedded `persona` is the
//  shared `serializeAudienceProfileForViewer` shape (camelCase keys).
//

import Foundation

// MARK: - GET /api/personas/:id/membership  (+ POST .../membership/cancel)

/// Envelope for the membership read and the cancel mutation (the cancel
/// route echoes the re-fetched membership in the same shape).
public struct PersonaMembershipResponse: Decodable, Sendable {
    public let membership: PersonaMembershipDTO?
}

public struct PersonaMembershipDTO: Decodable, Sendable {
    public let membershipId: String?
    public let persona: MembershipPersonaDTO?
    public let tier: MembershipTierDTO?
    public let status: String?
    public let cancelAtPeriodEnd: Bool?
    public let currentPeriodStart: String?
    public let currentPeriodEnd: String?
    /// Present once a downgrade has been scheduled — the change lands at
    /// `currentPeriodEnd`, not immediately.
    public let scheduledTierChange: MembershipScheduledTierChangeDTO?
    /// Message-thread + video-call credits left this period. `msgThreads`
    /// is `nil` when the tier grants unlimited (or no) threads — the
    /// distinction comes from `tier.msgThreadsPerPeriod`.
    public let quotaRemaining: MembershipQuotaRemainingDTO?
}

/// `serializeMembershipForFan` emits `{ tierId }` only — the target tier's
/// name is resolved client-side against the public tier ladder.
public struct MembershipScheduledTierChangeDTO: Decodable, Sendable {
    public let tierId: String?
}

public struct MembershipQuotaRemainingDTO: Decodable, Sendable {
    public let msgThreads: Int?
    public let videoCalls: Int?
}

/// The persona the fan supports — `serializeAudienceProfileForViewer`
/// (camelCase). Only the fields the membership card binds to are decoded.
public struct MembershipPersonaDTO: Decodable, Sendable {
    public let id: String?
    public let handle: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let category: String?
    public let audienceLabel: String?
    public let followerCount: Int?
    public let credential: CredentialDTO?

    public struct CredentialDTO: Decodable, Sendable {
        public let status: String?
        public let label: String?
    }
}

/// The fan's tier. Perk fields (`msgThreadsPerPeriod`, `creatorCanInitiateDm`,
/// `replyPolicy`) drive the "What you get" benefit rows. Backend emits
/// camelCase here.
public struct MembershipTierDTO: Decodable, Sendable {
    public let id: String?
    public let rank: Int?
    public let name: String?
    public let priceCents: Int?
    public let currency: String?
    public let billingInterval: String?
    public let msgThreadsPerPeriod: Int?
    public let creatorCanInitiateDm: Bool?
    public let replyPolicy: String?
}

// MARK: - GET /api/personas/:handle/tiers  (public tier ladder)

/// The tier ladder the fan can move between. Emitted by
/// `backend/routes/personas.js:1111` with `stripe_price_id` stripped.
public struct PersonaPublicTiersResponse: Decodable, Sendable {
    public let tiers: [PersonaPublicTierDTO]
}

public struct PersonaPublicTierDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let rank: Int
    public let name: String?
    public let description: String?
    public let priceCents: Int?
    public let currency: String?
    public let billingInterval: String?
    public let msgThreadsPerPeriod: Int?
    public let replyPolicy: String?
}

// MARK: - Mutation bodies

/// Body for `POST .../membership/upgrade` and `.../membership/downgrade`.
/// `tier_rank` is 1…4 (`tierChangeSchema`,
/// `backend/routes/personaMembership.js:117`).
public struct MembershipTierChangeBody: Encodable, Sendable {
    public let tierRank: Int

    public init(tierRank: Int) {
        self.tierRank = tierRank
    }

    enum CodingKeys: String, CodingKey {
        case tierRank = "tier_rank"
    }
}

/// Body for `POST .../membership/refund-request`. Only `sla_missed` is
/// supported in v1.0 — `period_unused` is validated but the handler
/// returns `400 reason_not_supported` (`personaMembership.js:301`).
public struct MembershipRefundRequestBody: Encodable, Sendable {
    public let reason: String
    public let threadId: String?

    public init(reason: String = "sla_missed", threadId: String? = nil) {
        self.reason = reason
        self.threadId = threadId
    }

    enum CodingKeys: String, CodingKey {
        case reason
        case threadId = "thread_id"
    }
}
