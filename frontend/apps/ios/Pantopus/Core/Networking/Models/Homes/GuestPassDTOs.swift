//
//  GuestPassDTOs.swift
//  Pantopus
//
//  DTOs for the home guest-pass surface in `backend/routes/homeIam.js`:
//    - POST   /api/homes/:id/guest-passes          (line 667)
//    - GET    /api/homes/:id/guest-passes          (line 783)
//    - DELETE /api/homes/:id/guest-passes/:passId  (line 860)
//
//  The POST returns the raw share `token` exactly once (only the hash is
//  stored). The GET enriches each row with a computed `status` +
//  `last_viewed_at`. Field-for-field parity with the Android
//  `GuestPassDtos.kt`.
//

import Foundation

/// One `HomeGuestPass` row. The list endpoint adds the computed
/// `status` + `last_viewed_at`; both are nil on the create/revoke
/// payloads. Unmodelled columns (token hash, passcode hash, raw
/// permissions jsonb) are intentionally omitted — `Decodable` ignores
/// keys it doesn't declare.
public struct GuestPassDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let label: String
    public let kind: String
    public let startAt: String?
    public let endAt: String?
    public let revokedAt: String?
    public let createdAt: String?
    public let includedSections: [String]?
    public let customTitle: String?
    public let maxViews: Int?
    public let viewCount: Int?
    /// Computed `'active' | 'revoked' | 'expired'` — list endpoint only.
    public let status: String?
    public let lastViewedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case label
        case kind
        case startAt = "start_at"
        case endAt = "end_at"
        case revokedAt = "revoked_at"
        case createdAt = "created_at"
        case includedSections = "included_sections"
        case customTitle = "custom_title"
        case maxViews = "max_views"
        case viewCount = "view_count"
        case status
        case lastViewedAt = "last_viewed_at"
    }
}

/// Body for `POST /api/homes/:id/guest-passes`. The handler resolves the
/// window with the precedence `end_at` > `duration_hours` > template
/// default, so callers send either `durationHours` (relative) or the
/// `startAt`/`endAt` pair (absolute), never both.
public struct CreateGuestPassRequest: Encodable, Sendable, Hashable {
    public var label: String
    public var kind: String
    public var durationHours: Int?
    public var startAt: String?
    public var endAt: String?

    public init(
        label: String,
        kind: String = "guest",
        durationHours: Int? = nil,
        startAt: String? = nil,
        endAt: String? = nil
    ) {
        self.label = label
        self.kind = kind
        self.durationHours = durationHours
        self.startAt = startAt
        self.endAt = endAt
    }

    /// Omit nil optionals from the wire body.
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(label, forKey: .label)
        try c.encode(kind, forKey: .kind)
        try c.encodeIfPresent(durationHours, forKey: .durationHours)
        try c.encodeIfPresent(startAt, forKey: .startAt)
        try c.encodeIfPresent(endAt, forKey: .endAt)
    }

    private enum CodingKeys: String, CodingKey {
        case label
        case kind
        case durationHours = "duration_hours"
        case startAt = "start_at"
        case endAt = "end_at"
    }
}

/// 201 envelope for `POST /api/homes/:id/guest-passes`. `token` is the
/// raw share secret, returned exactly once on creation.
public struct CreateGuestPassResponse: Decodable, Sendable, Hashable {
    public let pass: GuestPassDTO
    public let token: String
}

/// Envelope for `GET /api/homes/:id/guest-passes`.
public struct GuestPassesResponse: Decodable, Sendable, Hashable {
    public let passes: [GuestPassDTO]
}

/// 200 envelope for `DELETE /api/homes/:id/guest-passes/:passId`.
public struct RevokeGuestPassResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let pass: GuestPassDTO
}
