//
//  BusinessTeamDTOs.swift
//  Pantopus
//
//  DTOs for owner-side business team & roles management. Cloned from the
//  per-home `MembersDTOs.swift` shape but pointed at the businessIam +
//  businessSeats route families.
//
//  Endpoints:
//    GET    /api/businesses/:id/me                       — backend/routes/businessIam.js:42
//    GET    /api/businesses/:id/role-presets             — backend/routes/businessIam.js:80
//    GET    /api/businesses/:id/members                  — backend/routes/businessIam.js:104
//    POST   /api/businesses/:id/members/:userId/role     — backend/routes/businessIam.js:224
//    GET    /api/businesses/:id/members/:userId/permissions — backend/routes/businessIam.js:493
//    POST   /api/businesses/:id/members/:userId/permissions — backend/routes/businessIam.js:410
//    DELETE /api/businesses/:id/members/:userId          — backend/routes/businessIam.js:525
//    GET    /api/businesses/:id/seats                    — backend/routes/businessSeats.js:425
//    POST   /api/businesses/:id/seats/invite             — backend/routes/businessSeats.js:495
//    DELETE /api/businesses/:id/seats/:seatId            — backend/routes/businessSeats.js:698
//
//  The Team screen renders the businessIam members grouped by `role_base`
//  plus a pending-invites section sourced from the businessSeats list
//  (rows where `invite_status == "pending"`).
//

import Foundation

// MARK: - GET /:id/me

/// The current user's access for a business — drives the `team.view` /
/// `team.manage` / `team.invite` action gating. On a 403 the backend
/// returns `{ hasAccess: false, role_base: null, permissions: [] }`.
public struct BusinessTeamAccessDTO: Decodable, Sendable, Hashable {
    public let hasAccess: Bool
    public let isOwner: Bool?
    public let roleBase: String?
    public let permissions: [String]

    public init(
        hasAccess: Bool,
        isOwner: Bool? = nil,
        roleBase: String? = nil,
        permissions: [String] = []
    ) {
        self.hasAccess = hasAccess
        self.isOwner = isOwner
        self.roleBase = roleBase
        self.permissions = permissions
    }

    private enum CodingKeys: String, CodingKey {
        case hasAccess
        case isOwner
        case roleBase = "role_base"
        case permissions
    }
}

// MARK: - GET /:id/role-presets

/// A single assignable role preset. The role-change picker lists these and
/// posts the `key` back as `preset_key`.
public struct BusinessRolePresetDTO: Decodable, Sendable, Hashable, Identifiable {
    /// Stable preset key (e.g. `content_editor`). Sent as `preset_key`.
    public let key: String
    public let displayName: String
    public let description: String
    /// Underlying role tier (`owner / admin / editor / staff / viewer`).
    public let roleBase: String
    public let iconKey: String?
    public let sortOrder: Int

    public var id: String {
        key
    }

    public init(
        key: String,
        displayName: String,
        description: String,
        roleBase: String,
        iconKey: String? = nil,
        sortOrder: Int = 100
    ) {
        self.key = key
        self.displayName = displayName
        self.description = description
        self.roleBase = roleBase
        self.iconKey = iconKey
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case key
        case displayName = "display_name"
        case description
        case roleBase = "role_base"
        case iconKey = "icon_key"
        case sortOrder = "sort_order"
    }
}

/// Envelope for `GET /api/businesses/:id/role-presets`.
public struct BusinessRolePresetsResponse: Decodable, Sendable, Hashable {
    public let presets: [BusinessRolePresetDTO]
}

// MARK: - GET /:id/members

/// The opaque user record joined onto a team membership. The backend never
/// exposes the seat → user binding elsewhere, but the IAM `/members` list
/// returns the joined `User` directly.
public struct BusinessTeamUserDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let email: String?
    public let profilePictureUrl: String?

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        email: String? = nil,
        profilePictureUrl: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.email = email
        self.profilePictureUrl = profilePictureUrl
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case username
        case name
        case email
        case profilePictureUrl = "profile_picture_url"
    }
}

/// One active team membership row.
public struct BusinessTeamMemberDTO: Decodable, Sendable, Hashable, Identifiable {
    /// BusinessTeam row id.
    public let id: String
    /// Role tier — `owner / admin / editor / staff / viewer`.
    public let roleBase: String?
    /// Optional free-text job title.
    public let title: String?
    public let joinedAt: String?
    public let invitedAt: String?
    public let notes: String?
    /// The joined user. Nil only if the user record was deleted.
    public let user: BusinessTeamUserDTO?

    public init(
        id: String,
        roleBase: String?,
        title: String? = nil,
        joinedAt: String? = nil,
        invitedAt: String? = nil,
        notes: String? = nil,
        user: BusinessTeamUserDTO?
    ) {
        self.id = id
        self.roleBase = roleBase
        self.title = title
        self.joinedAt = joinedAt
        self.invitedAt = invitedAt
        self.notes = notes
        self.user = user
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case roleBase = "role_base"
        case title
        case joinedAt = "joined_at"
        case invitedAt = "invited_at"
        case notes
        case user
    }
}

/// Envelope for `GET /api/businesses/:id/members`.
public struct BusinessTeamMembersResponse: Decodable, Sendable, Hashable {
    public let members: [BusinessTeamMemberDTO]
}

// MARK: - GET /:id/seats (pending invites)

/// A seat row. The Team screen only renders rows where
/// `inviteStatus == "pending"` as the pending-invites section; the
/// accepted seats are already represented by the IAM members list.
public struct BusinessSeatDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String?
    public let roleBase: String?
    public let inviteStatus: String?
    public let inviteEmail: String?
    public let inviteExpiresAt: String?
    public let createdAt: String?
    public let isYou: Bool?

    public init(
        id: String,
        displayName: String? = nil,
        roleBase: String? = nil,
        inviteStatus: String? = nil,
        inviteEmail: String? = nil,
        inviteExpiresAt: String? = nil,
        createdAt: String? = nil,
        isYou: Bool? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.roleBase = roleBase
        self.inviteStatus = inviteStatus
        self.inviteEmail = inviteEmail
        self.inviteExpiresAt = inviteExpiresAt
        self.createdAt = createdAt
        self.isYou = isYou
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case roleBase = "role_base"
        case inviteStatus = "invite_status"
        case inviteEmail = "invite_email"
        case inviteExpiresAt = "invite_expires_at"
        case createdAt = "created_at"
        case isYou = "is_you"
    }
}

/// Envelope for `GET /api/businesses/:id/seats`.
public struct BusinessSeatsResponse: Decodable, Sendable, Hashable {
    public let seats: [BusinessSeatDTO]
}

// MARK: - POST /:id/seats/invite

/// Body for `POST /api/businesses/:id/seats/invite`. Matches the backend
/// `inviteSchema` (display_name + role_base + invite_email + optional
/// notes). `title` is intentionally omitted — it isn't part of the schema.
public struct BusinessSeatInviteRequest: Encodable, Sendable, Hashable {
    public var displayName: String
    public var roleBase: String
    public var inviteEmail: String
    public var notes: String?

    public init(displayName: String, roleBase: String, inviteEmail: String, notes: String? = nil) {
        self.displayName = displayName
        self.roleBase = roleBase
        self.inviteEmail = inviteEmail
        self.notes = notes
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(displayName, forKey: .displayName)
        try c.encode(roleBase, forKey: .roleBase)
        try c.encode(inviteEmail, forKey: .inviteEmail)
        try c.encodeIfPresent(notes, forKey: .notes)
    }

    private enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case roleBase = "role_base"
        case inviteEmail = "invite_email"
        case notes
    }
}

/// Envelope for `POST /api/businesses/:id/seats/invite`.
public struct BusinessTeamSeatInviteResponse: Decodable, Sendable, Hashable {
    public let seat: BusinessSeatDTO
    public let inviteToken: String?

    private enum CodingKeys: String, CodingKey {
        case seat
        case inviteToken = "invite_token"
    }
}

// MARK: - POST /:id/members/:userId/role

/// Body for `POST /api/businesses/:id/members/:userId/role`. The role
/// picker sends a `preset_key`; the backend resolves the underlying role
/// tier + permission grants from the preset.
public struct BusinessChangeRoleRequest: Encodable, Sendable, Hashable {
    public var presetKey: String

    public init(presetKey: String) {
        self.presetKey = presetKey
    }

    private enum CodingKeys: String, CodingKey {
        case presetKey = "preset_key"
    }
}

// MARK: - members/:userId/permissions

/// Response for `GET /api/businesses/:id/members/:userId/permissions`.
public struct BusinessMemberPermissionsResponse: Decodable, Sendable, Hashable {
    public let permissions: [String]
    public let roleBase: String?

    public init(permissions: [String], roleBase: String? = nil) {
        self.permissions = permissions
        self.roleBase = roleBase
    }

    private enum CodingKeys: String, CodingKey {
        case permissions
        case roleBase = "role_base"
    }
}

/// Body for `POST /api/businesses/:id/members/:userId/permissions`.
public struct BusinessTogglePermissionRequest: Encodable, Sendable, Hashable {
    public var permission: String
    public var allowed: Bool

    public init(permission: String, allowed: Bool) {
        self.permission = permission
        self.allowed = allowed
    }
}
