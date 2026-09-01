//
//  OwnerDTOs.swift
//  Pantopus
//
//  P15 / T6.3g — DTOs for the per-home Owners roster. Backs the
//  `GET /api/homes/:id/owners` envelope at
//  `backend/routes/homeOwnership.js:1381`. The handler enriches each
//  row with a nested `user` object when `subject_type == 'user'`; the
//  field is null for `business` / `trust` subjects (no client-side
//  surface for those today — they fall back to the masked subject id).
//

import Foundation

/// One row in the `GET /api/homes/:id/owners` envelope. Mirrors the
/// enriched shape returned by `backend/routes/homeOwnership.js:1418`.
public struct OwnerDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let subjectType: String
    public let subjectId: String
    public let ownerStatus: String
    public let isPrimaryOwner: Bool
    public let addedVia: String?
    public let verificationTier: String
    public let createdAt: String
    public let user: OwnerUser?

    public init(
        id: String,
        subjectType: String,
        subjectId: String,
        ownerStatus: String,
        isPrimaryOwner: Bool,
        addedVia: String? = nil,
        verificationTier: String,
        createdAt: String,
        user: OwnerUser? = nil
    ) {
        self.id = id
        self.subjectType = subjectType
        self.subjectId = subjectId
        self.ownerStatus = ownerStatus
        self.isPrimaryOwner = isPrimaryOwner
        self.addedVia = addedVia
        self.verificationTier = verificationTier
        self.createdAt = createdAt
        self.user = user
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case subjectType = "subject_type"
        case subjectId = "subject_id"
        case ownerStatus = "owner_status"
        case isPrimaryOwner = "is_primary_owner"
        case addedVia = "added_via"
        case verificationTier = "verification_tier"
        case createdAt = "created_at"
        case user
    }
}

/// Enriched user payload returned by the handler when
/// `subject_type == 'user'`. Mirrors the columns selected at
/// `backend/routes/homeOwnership.js:1411-1413`.
public struct OwnerUser: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let profilePictureUrl: String?

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        profilePictureUrl: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.profilePictureUrl = profilePictureUrl
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case username
        case name
        case profilePictureUrl = "profile_picture_url"
    }
}

/// Envelope for `GET /api/homes/:id/owners`.
public struct OwnersResponse: Decodable, Sendable, Hashable {
    public let owners: [OwnerDTO]

    public init(owners: [OwnerDTO]) {
        self.owners = owners
    }
}

/// 200 envelope for `DELETE /api/homes/:id/owners/:ownerId`. The
/// backend may return one of two shapes depending on quorum:
///   - immediate removal: `{ "message": "Owner removed" }`
///   - quorum needed:    `{ "message": "Owner removal requires approval…",
///                          "quorum_action_id": "uuid" }`
///
/// The screen treats `quorum_action_id != nil` as "removal pending" and
/// leaves the row in place; the optimistic-delete rollback fires when
/// the handler 4xxes / 5xxes.
public struct RemoveOwnerResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let quorumActionId: String?

    public init(message: String, quorumActionId: String? = nil) {
        self.message = message
        self.quorumActionId = quorumActionId
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case quorumActionId = "quorum_action_id"
    }
}
