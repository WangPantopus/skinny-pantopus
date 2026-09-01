//
//  MembersDTOs.swift
//  Pantopus
//
//  DTOs for the per-home members roster exposed via
//  `/api/homes/:id/occupants` and friends.
//
//  Endpoints:
//    GET    /api/homes/:id/occupants   — `backend/routes/home.js:3705`
//                                        returns { occupants, pendingInvites }
//    POST   /api/homes/:id/invite      — `backend/routes/home.js:5662`
//    DELETE /api/homes/:id/members/:userId — `backend/routes/homeIam.js:512`
//
//  The list endpoint returns a single payload; the three tabs in the
//  Members screen (Members / Guests / Pending) bucket client-side based
//  on `role` and the active/pending split.
//

import Foundation

// MARK: - GET /:id/occupants

/// Active occupant row. Backend flattens the joined `User` record into
/// the top-level shape (`display_name`, `username`, `avatar_url`) so we
/// can decode without a nested object.
public struct OccupantDTO: Decodable, Sendable, Hashable, Identifiable {
    /// Occupancy row id.
    public let id: String
    /// User id (foreign key on HomeOccupancy).
    public let userId: String
    /// Wire enum: `owner / admin / manager / member / restricted_member /
    /// guest / lease_resident / ...`. We treat anything in
    /// `MemberRole.guestRoles` as a guest for the Guests-tab bucket.
    public let role: String?
    public let isActive: Bool
    public let startAt: String?
    public let createdAt: String?
    /// Flattened from the joined User row.
    public let displayName: String?
    public let username: String?
    public let avatarUrl: String?
    public let joinedAt: String?
    public let canManageHome: Bool?
    public let canManageFinance: Bool?
    public let canManageAccess: Bool?
    public let canManageTasks: Bool?
    public let canViewSensitive: Bool?

    public init(
        id: String,
        userId: String,
        role: String?,
        isActive: Bool,
        startAt: String? = nil,
        createdAt: String? = nil,
        displayName: String? = nil,
        username: String? = nil,
        avatarUrl: String? = nil,
        joinedAt: String? = nil,
        canManageHome: Bool? = nil,
        canManageFinance: Bool? = nil,
        canManageAccess: Bool? = nil,
        canManageTasks: Bool? = nil,
        canViewSensitive: Bool? = nil
    ) {
        self.id = id
        self.userId = userId
        self.role = role
        self.isActive = isActive
        self.startAt = startAt
        self.createdAt = createdAt
        self.displayName = displayName
        self.username = username
        self.avatarUrl = avatarUrl
        self.joinedAt = joinedAt
        self.canManageHome = canManageHome
        self.canManageFinance = canManageFinance
        self.canManageAccess = canManageAccess
        self.canManageTasks = canManageTasks
        self.canViewSensitive = canViewSensitive
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case role
        case isActive = "is_active"
        case startAt = "start_at"
        case createdAt = "created_at"
        case displayName = "display_name"
        case username
        case avatarUrl = "avatar_url"
        case joinedAt = "joined_at"
        case canManageHome = "can_manage_home"
        case canManageFinance = "can_manage_finance"
        case canManageAccess = "can_manage_access"
        case canManageTasks = "can_manage_tasks"
        case canViewSensitive = "can_view_sensitive"
    }
}

/// Pending invite mapped to a member-like shape by the backend.
public struct PendingInviteDTO: Decodable, Sendable, Hashable, Identifiable {
    /// HomeInvite id.
    public let id: String
    /// May be null when the invitee doesn't have an account yet.
    public let userId: String?
    /// Proposed role for the not-yet-accepted member.
    public let role: String?
    public let email: String?
    /// Pretty label — falls back to email when name is unknown.
    public let name: String
    /// Inviter's display name, for the "Invited by …" sub-line.
    public let invitedBy: String?
    public let createdAt: String?

    public init(
        id: String,
        userId: String? = nil,
        role: String? = nil,
        email: String? = nil,
        name: String,
        invitedBy: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.role = role
        self.email = email
        self.name = name
        self.invitedBy = invitedBy
        self.createdAt = createdAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case role
        case email
        case name
        case invitedBy = "invited_by"
        case createdAt = "created_at"
    }
}

/// Envelope for `GET /api/homes/:id/occupants`.
public struct OccupantsResponse: Decodable, Sendable, Hashable {
    public let occupants: [OccupantDTO]
    public let pendingInvites: [PendingInviteDTO]

    private enum CodingKeys: String, CodingKey {
        case occupants
        case pendingInvites
    }
}

// MARK: - POST /:id/invite

/// Body for `POST /api/homes/:id/invite`. Either `email` or `userId`
/// must be set (server validates) — passing neither would create an
/// open invite, which the wizard does not support today.
public struct InviteMemberRequest: Encodable, Sendable, Hashable {
    public var email: String?
    public var userId: String?
    /// Backend field name is `relationship`. Maps to `proposed_role`
    /// (member / guest / admin / …).
    public var relationship: String
    public var message: String?

    public init(
        email: String? = nil,
        userId: String? = nil,
        relationship: String,
        message: String? = nil
    ) {
        self.email = email
        self.userId = userId
        self.relationship = relationship
        self.message = message
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(email, forKey: .email)
        try c.encodeIfPresent(userId, forKey: .userId)
        try c.encode(relationship, forKey: .relationship)
        try c.encodeIfPresent(message, forKey: .message)
    }

    private enum CodingKeys: String, CodingKey {
        case email
        case userId = "user_id"
        case relationship
        case message
    }
}

/// One field of the returned invitation record. The backend echoes the
/// full `HomeInvite` row; we decode only what the UI needs to fold the
/// new pending invite into the list without a refetch.
public struct InvitationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let invitedBy: String?
    public let inviteeEmail: String?
    public let inviteeUserId: String?
    public let proposedRole: String?
    public let createdAt: String?

    public init(
        id: String,
        homeId: String,
        invitedBy: String? = nil,
        inviteeEmail: String? = nil,
        inviteeUserId: String? = nil,
        proposedRole: String? = nil,
        createdAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.invitedBy = invitedBy
        self.inviteeEmail = inviteeEmail
        self.inviteeUserId = inviteeUserId
        self.proposedRole = proposedRole
        self.createdAt = createdAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case invitedBy = "invited_by"
        case inviteeEmail = "invitee_email"
        case inviteeUserId = "invitee_user_id"
        case proposedRole = "proposed_role"
        case createdAt = "created_at"
    }
}

/// Envelope for `POST /api/homes/:id/invite`.
public struct InviteMemberResponse: Decodable, Sendable, Hashable {
    public let invitation: InvitationDTO
    public let emailSent: Bool?
}
