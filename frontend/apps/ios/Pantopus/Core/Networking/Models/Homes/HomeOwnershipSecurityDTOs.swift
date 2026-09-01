//
//  HomeOwnershipSecurityDTOs.swift
//  Pantopus
//
//  DTOs for the per-home ownership security policy
//  (`GET/PATCH /api/homes/:id/security`, route
//  `backend/routes/homeOwnership.js:1701` + `:1751`).
//
//  Enum values are the Postgres enums declared in
//  `backend/database/schema.sql:200-328` and re-validated by the Joi
//  schema at `backend/routes/homeOwnership.js:81`.
//

import Foundation

/// `home_privacy_mask_level` — discoverability / stealth.
public enum HomePrivacyMaskLevel: String, Decodable, Sendable, Hashable, CaseIterable {
    case normal
    case high
    case inviteOnlyDiscovery = "invite_only_discovery"

    public var label: String {
        switch self {
        case .normal: "Normal"
        case .high: "High (Stealth)"
        case .inviteOnlyDiscovery: "Invite-only"
        }
    }
}

/// `home_owner_claim_policy` — open vs. review-required owner claims.
public enum HomeOwnerClaimPolicy: String, Decodable, Sendable, Hashable, CaseIterable {
    case open
    case reviewRequired = "review_required"

    public var label: String {
        switch self {
        case .open: "Allow owner verification (recommended)"
        case .reviewRequired: "Require manual review for new owner claims"
        }
    }
}

/// `home_member_attach_policy` — how new members join the household.
public enum HomeMemberAttachPolicy: String, Decodable, Sendable, Hashable, CaseIterable {
    case openInvite = "open_invite"
    case adminApproval = "admin_approval"
    case verifiedOnly = "verified_only"

    public var label: String {
        switch self {
        case .openInvite: "Open invite"
        case .adminApproval: "Admin approval"
        case .verifiedOnly: "Verified-only"
        }
    }
}

/// `home_security_state` — the home's lifecycle guard rail. Drives the
/// status banner above the policy groups.
public enum HomeSecurityState: String, Decodable, Sendable, Hashable {
    case normal
    case claimWindow = "claim_window"
    case reviewRequired = "review_required"
    case disputed
    case frozen
    case frozenSilent = "frozen_silent"
}

/// `GET /api/homes/:id/security` (and the PATCH echo) envelope.
public struct HomeOwnershipSecurityResponse: Decodable, Sendable, Hashable {
    public let security: HomeOwnershipSecurityDTO
}

/// The policy block. `claimWindowActive` / `ownerCount` are only sent by
/// the GET handler — the PATCH echo re-selects the raw columns only, so
/// both stay optional.
public struct HomeOwnershipSecurityDTO: Decodable, Sendable, Hashable {
    public let securityState: HomeSecurityState
    public let claimWindowEndsAt: String?
    public let ownerClaimPolicy: HomeOwnerClaimPolicy
    public let memberAttachPolicy: HomeMemberAttachPolicy
    public let privacyMaskLevel: HomePrivacyMaskLevel
    public let tenureMode: String?
    public let claimWindowActive: Bool?
    public let ownerCount: Int?

    private enum CodingKeys: String, CodingKey {
        case securityState = "security_state"
        case claimWindowEndsAt = "claim_window_ends_at"
        case ownerClaimPolicy = "owner_claim_policy"
        case memberAttachPolicy = "member_attach_policy"
        case privacyMaskLevel = "privacy_mask_level"
        case tenureMode = "tenure_mode"
        case claimWindowActive = "claim_window_active"
        case ownerCount = "owner_count"
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        securityState = try container.decodeIfPresent(HomeSecurityState.self, forKey: .securityState) ?? .normal
        claimWindowEndsAt = try container.decodeIfPresent(String.self, forKey: .claimWindowEndsAt)
        ownerClaimPolicy = try container.decodeIfPresent(HomeOwnerClaimPolicy.self, forKey: .ownerClaimPolicy) ?? .open
        memberAttachPolicy = try container
            .decodeIfPresent(HomeMemberAttachPolicy.self, forKey: .memberAttachPolicy) ?? .openInvite
        privacyMaskLevel = try container.decodeIfPresent(HomePrivacyMaskLevel.self, forKey: .privacyMaskLevel) ?? .normal
        tenureMode = try container.decodeIfPresent(String.self, forKey: .tenureMode)
        claimWindowActive = try container.decodeIfPresent(Bool.self, forKey: .claimWindowActive)
        ownerCount = try container.decodeIfPresent(Int.self, forKey: .ownerCount)
    }

    public init(
        securityState: HomeSecurityState = .normal,
        claimWindowEndsAt: String? = nil,
        ownerClaimPolicy: HomeOwnerClaimPolicy = .open,
        memberAttachPolicy: HomeMemberAttachPolicy = .openInvite,
        privacyMaskLevel: HomePrivacyMaskLevel = .normal,
        tenureMode: String? = nil,
        claimWindowActive: Bool? = nil,
        ownerCount: Int? = nil
    ) {
        self.securityState = securityState
        self.claimWindowEndsAt = claimWindowEndsAt
        self.ownerClaimPolicy = ownerClaimPolicy
        self.memberAttachPolicy = memberAttachPolicy
        self.privacyMaskLevel = privacyMaskLevel
        self.tenureMode = tenureMode
        self.claimWindowActive = claimWindowActive
        self.ownerCount = ownerCount
    }
}

/// PATCH body — only the changed key is encoded (`nil` fields are
/// omitted so the server never sees a policy it wasn't asked to touch).
public struct UpdateHomeOwnershipSecurityRequest: Encodable, Sendable {
    public let ownerClaimPolicy: HomeOwnerClaimPolicy?
    public let memberAttachPolicy: HomeMemberAttachPolicy?
    public let privacyMaskLevel: HomePrivacyMaskLevel?

    public init(
        ownerClaimPolicy: HomeOwnerClaimPolicy? = nil,
        memberAttachPolicy: HomeMemberAttachPolicy? = nil,
        privacyMaskLevel: HomePrivacyMaskLevel? = nil
    ) {
        self.ownerClaimPolicy = ownerClaimPolicy
        self.memberAttachPolicy = memberAttachPolicy
        self.privacyMaskLevel = privacyMaskLevel
    }

    private enum CodingKeys: String, CodingKey {
        case ownerClaimPolicy = "owner_claim_policy"
        case memberAttachPolicy = "member_attach_policy"
        case privacyMaskLevel = "privacy_mask_level"
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(ownerClaimPolicy?.rawValue, forKey: .ownerClaimPolicy)
        try container.encodeIfPresent(memberAttachPolicy?.rawValue, forKey: .memberAttachPolicy)
        try container.encodeIfPresent(privacyMaskLevel?.rawValue, forKey: .privacyMaskLevel)
    }
}

/// PATCH response. Three shapes share one decoder:
///   * applied — `{ message, security }`
///   * quorum  — `{ message, quorum_action_id, pending: true }`
///   * no-op   — `{ message: "No changes", security }`
public struct UpdateHomeOwnershipSecurityResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let security: HomeOwnershipSecurityDTO?
    public let quorumActionId: String?
    public let pending: Bool?

    private enum CodingKeys: String, CodingKey {
        case message
        case security
        case quorumActionId = "quorum_action_id"
        case pending
    }

    /// True when the backend queued the change for owner approval
    /// instead of applying it (`homeOwnership.js:1806`).
    public var requiresOwnerApproval: Bool {
        pending == true
    }
}
