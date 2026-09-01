//
//  HomeSettingsMutationDTOs.swift
//  Pantopus
//
//  Request/response DTOs for home-settings mutations (rename / leave home
//  / cancel claim).
//

import Foundation

/// Body for `PATCH /api/homes/:id` — route `backend/routes/home.js:3097`,
/// schema `updateHomeSchema` (same file, line 132). Every key in that
/// schema is optional and the object must carry at least one, so we only
/// encode what the caller set. `name` is `Joi.string().max(120)`.
public struct UpdateHomeRequest: Encodable, Sendable, Hashable {
    public var name: String?

    public init(name: String? = nil) {
        self.name = name
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
    }

    private enum CodingKeys: String, CodingKey {
        case name
    }
}

/// `{ message, home }` envelope returned by `PATCH /api/homes/:id`
/// (route `backend/routes/home.js:3178`). The `home` payload is the raw
/// updated `Home` row.
public struct UpdateHomeResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let home: HomeDTO
}

/// `POST /api/homes/:id/move-out` — route `backend/routes/home.js:3391`.
public struct MoveOutResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let homeId: String?

    private enum CodingKeys: String, CodingKey {
        case message
        case homeId
    }
}

/// `DELETE /api/homes/:id/ownership-claims/:claimId` — route
/// `backend/routes/homeOwnership.js:603`.
public struct DeleteOwnershipClaimResponse: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let deleted: Bool

    public init(ok: Bool = true, deleted: Bool = true) {
        self.ok = ok
        self.deleted = deleted
    }

    private enum CodingKeys: String, CodingKey {
        case ok, deleted
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        ok = try container.decodeIfPresent(Bool.self, forKey: .ok) ?? true
        deleted = try container.decodeIfPresent(Bool.self, forKey: .deleted) ?? true
    }
}
