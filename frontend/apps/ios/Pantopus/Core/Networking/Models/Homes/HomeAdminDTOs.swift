//
//  HomeAdminDTOs.swift
//  Pantopus
//
//  DTOs for the owner/admin home-administration surface — see
//  `HomeAdminEndpoints.swift` for the route citations:
//
//    DELETE /api/homes/:id                                  — home.js:3191
//    GET    /api/homes/:id/me                                — homeIam.js:51
//    POST   /api/homes/:id/members/:userId/role              — homeIam.js:212
//    GET    /api/homes/:id/household-access-requests         — home.js:2671
//    POST   …/household-access-requests/:requestId/approve   — home.js:2714
//    POST   …/household-access-requests/:requestId/reject    — home.js:2831
//

import Foundation

// MARK: - DELETE /api/homes/:id

/// `{ message }` — route `backend/routes/home.js:3191`.
public struct DeleteHomeResponse: Decodable, Sendable, Hashable {
    public let message: String?

    public init(message: String? = nil) {
        self.message = message
    }
}

// MARK: - GET /api/homes/:id/me

/// The viewer's own access record for a home — route
/// `backend/routes/homeIam.js:51`. Only the fields the Members screen
/// needs are modelled; the handler emits more (challenge/claim windows,
/// postcard context) that other surfaces decode separately.
public struct HomeAccessDTO: Decodable, Sendable, Hashable {
    public let hasAccess: Bool
    /// `is_owner` — verified/legacy owner OR IAM `role_base == "owner"`.
    public let isOwner: Bool
    /// `role_base` — one of the `ROLE_RANK` keys, or nil when access was
    /// denied (the 403 body still decodes into this shape).
    public let roleBase: String?
    /// Raw IAM permission strings; `members.manage` gates the roster
    /// mutations and the Requests tab.
    public let permissions: [String]
    public let canManageHome: Bool
    public let canManageAccess: Bool
    public let canManageFinance: Bool
    public let canManageTasks: Bool
    public let canViewSensitive: Bool

    public init(
        hasAccess: Bool,
        isOwner: Bool = false,
        roleBase: String? = nil,
        permissions: [String] = [],
        canManageHome: Bool = false,
        canManageAccess: Bool = false,
        canManageFinance: Bool = false,
        canManageTasks: Bool = false,
        canViewSensitive: Bool = false
    ) {
        self.hasAccess = hasAccess
        self.isOwner = isOwner
        self.roleBase = roleBase
        self.permissions = permissions
        self.canManageHome = canManageHome
        self.canManageAccess = canManageAccess
        self.canManageFinance = canManageFinance
        self.canManageTasks = canManageTasks
        self.canViewSensitive = canViewSensitive
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        hasAccess = try container.decodeIfPresent(Bool.self, forKey: .hasAccess) ?? false
        isOwner = try container.decodeIfPresent(Bool.self, forKey: .isOwner) ?? false
        roleBase = try container.decodeIfPresent(String.self, forKey: .roleBase)
        permissions = try container.decodeIfPresent([String].self, forKey: .permissions) ?? []
        canManageHome = try container.decodeIfPresent(Bool.self, forKey: .canManageHome) ?? false
        canManageAccess = try container.decodeIfPresent(Bool.self, forKey: .canManageAccess) ?? false
        canManageFinance = try container.decodeIfPresent(Bool.self, forKey: .canManageFinance) ?? false
        canManageTasks = try container.decodeIfPresent(Bool.self, forKey: .canManageTasks) ?? false
        canViewSensitive = try container.decodeIfPresent(Bool.self, forKey: .canViewSensitive) ?? false
    }

    /// Mirrors `canReviewHouseholdAccessRequests`
    /// (`backend/routes/home.js:219`) and the `members.manage` gate on
    /// `POST /:id/members/:userId/role` (`homeIam.js:218`).
    public var canManageMembers: Bool {
        isOwner || permissions.contains("members.manage")
    }

    /// RN's `can(perm)` helper (`src/app/homes/[id]/index.tsx:122`):
    /// owners and admins see everything; a viewer whose record carries no
    /// `permissions[]` at all falls through to "allow" so a partial
    /// payload can't blank the dashboard; otherwise the IAM string list
    /// decides. Permission vocabulary is the `home_permission` enum
    /// (`backend/database/schema.sql:227-251`).
    public func can(_ permission: String) -> Bool {
        if isOwner || roleBase == "owner" || roleBase == "admin" { return true }
        if permissions.isEmpty { return true }
        return permissions.contains(permission)
    }

    private enum CodingKeys: String, CodingKey {
        case hasAccess
        case isOwner = "is_owner"
        case roleBase = "role_base"
        case permissions
        case canManageHome = "can_manage_home"
        case canManageAccess = "can_manage_access"
        case canManageFinance = "can_manage_finance"
        case canManageTasks = "can_manage_tasks"
        case canViewSensitive = "can_view_sensitive"
    }
}

// MARK: - GET /api/homes/:id/audit-log

/// Joined actor `User` on a `HomeAuditLog` row — route
/// `backend/routes/homeIam.js:602` selects
/// `actor:actor_user_id (id, username, name, profile_picture_url)`.
public struct HomeAuditActorDTO: Decodable, Sendable, Hashable, Identifiable {
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

/// One `HomeAuditLog` row. The handler `select('*')`s the table, so the
/// action verb, the target it was applied to, and the timestamp are all
/// present; `metadata` is free-form jsonb we deliberately don't model.
public struct HomeAuditEntryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let actorUserId: String?
    /// Screaming-snake verb, e.g. `OWNERSHIP_CLAIM_SUBMITTED`.
    public let action: String
    /// Table name the action targeted, e.g. `HomeOccupancy`.
    public let targetType: String?
    public let targetId: String?
    public let createdAt: String?
    public let actor: HomeAuditActorDTO?

    public init(
        id: String,
        homeId: String? = nil,
        actorUserId: String? = nil,
        action: String,
        targetType: String? = nil,
        targetId: String? = nil,
        createdAt: String? = nil,
        actor: HomeAuditActorDTO? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.actorUserId = actorUserId
        self.action = action
        self.targetType = targetType
        self.targetId = targetId
        self.createdAt = createdAt
        self.actor = actor
    }

    /// RN falls back to "System" when the row has no resolvable actor
    /// (`src/app/homes/[id]/members/index.tsx:393`).
    public var actorDisplayName: String {
        if let name = actor?.name, !name.isEmpty { return name }
        if let username = actor?.username, !username.isEmpty { return "@\(username)" }
        return "System"
    }

    /// `OWNERSHIP_CLAIM_SUBMITTED` → "Ownership claim submitted".
    public var actionLabel: String {
        let spaced = action
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: ".", with: " ")
            .lowercased()
            .trimmingCharacters(in: .whitespaces)
        guard let first = spaced.first else { return action }
        return first.uppercased() + spaced.dropFirst()
    }

    /// `HomeOccupancy` → "Home occupancy". `nil` when the row carries no
    /// target, so the row never renders a dangling arrow.
    public var targetLabel: String? {
        guard let targetType, !targetType.isEmpty else { return nil }
        let spaced = targetType
            .replacingOccurrences(of: "([a-z0-9])([A-Z])", with: "$1 $2", options: .regularExpression)
            .replacingOccurrences(of: "_", with: " ")
        guard let first = spaced.first else { return nil }
        return first.uppercased() + spaced.dropFirst().lowercased()
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case actorUserId = "actor_user_id"
        case action
        case targetType = "target_type"
        case targetId = "target_id"
        case createdAt = "created_at"
        case actor
    }
}

/// `{ entries }` envelope — route `backend/routes/homeIam.js:602`.
public struct HomeAuditLogResponse: Decodable, Sendable, Hashable {
    public let entries: [HomeAuditEntryDTO]

    public init(entries: [HomeAuditEntryDTO]) {
        self.entries = entries
    }
}

// MARK: - POST /api/homes/:id/members/:userId/role

/// Body for the role change — route `backend/routes/homeIam.js:212`.
/// The handler accepts `preset_key` or `role_base`; we always send
/// `role_base` so the assignable list is the backend's `ROLE_RANK`
/// vocabulary rather than a preset table that may be empty.
public struct ChangeMemberRoleRequest: Encodable, Sendable, Hashable {
    public let roleBase: String

    public init(roleBase: String) {
        self.roleBase = roleBase
    }

    private enum CodingKeys: String, CodingKey {
        case roleBase = "role_base"
    }
}

/// `{ message, role_base }` — route `backend/routes/homeIam.js:212`.
public struct ChangeMemberRoleResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let roleBase: String?

    public init(message: String? = nil, roleBase: String? = nil) {
        self.message = message
        self.roleBase = roleBase
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case roleBase = "role_base"
    }
}

// MARK: - Household access requests

/// Joined `User` record on a household-access request row.
public struct HouseholdAccessRequesterDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let firstName: String?
    public let lastName: String?
    public let profilePictureUrl: String?

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        firstName: String? = nil,
        lastName: String? = nil,
        profilePictureUrl: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.firstName = firstName
        self.lastName = lastName
        self.profilePictureUrl = profilePictureUrl
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case username
        case name
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureUrl = "profile_picture_url"
    }
}

/// One row from `GET /api/homes/:id/household-access-requests` — route
/// `backend/routes/home.js:2671`. The handler `select('*')`s the
/// `HomeHouseholdAccessRequest` table and joins the requester.
public struct HouseholdAccessRequestDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let requesterUserId: String
    /// `owner / resident / household_member / guest`.
    public let requestedIdentity: String
    /// `pending / approved / rejected / cancelled`.
    public let status: String
    public let createdAt: String?
    public let requester: HouseholdAccessRequesterDTO?

    public init(
        id: String,
        homeId: String,
        requesterUserId: String,
        requestedIdentity: String,
        status: String,
        createdAt: String? = nil,
        requester: HouseholdAccessRequesterDTO? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.requesterUserId = requesterUserId
        self.requestedIdentity = requestedIdentity
        self.status = status
        self.createdAt = createdAt
        self.requester = requester
    }

    /// Title-case label for `requested_identity`, matching the RN
    /// vocabulary in `src/app/homes/[id]/members/index.tsx:26`.
    public var requestedIdentityLabel: String {
        switch requestedIdentity {
        case "owner": "Owner"
        case "resident": "Resident"
        case "household_member": "Household member"
        case "guest": "Guest"
        default: requestedIdentity
        }
    }

    /// Display name resolution order mirrors RN's `requesterDisplayName`.
    public var requesterDisplayName: String {
        guard let requester else { return "Unknown user" }
        if let name = requester.name, !name.isEmpty { return name }
        let parts = [requester.firstName, requester.lastName]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        if !parts.isEmpty { return parts.joined(separator: " ") }
        if let username = requester.username, !username.isEmpty { return "@\(username)" }
        return "Unknown user"
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case requesterUserId = "requester_user_id"
        case requestedIdentity = "requested_identity"
        case status
        case createdAt = "created_at"
        case requester
    }
}

/// `{ requests }` envelope — route `backend/routes/home.js:2671`.
public struct HouseholdAccessRequestsResponse: Decodable, Sendable, Hashable {
    public let requests: [HouseholdAccessRequestDTO]

    public init(requests: [HouseholdAccessRequestDTO]) {
        self.requests = requests
    }
}

/// `{ ok, message }` — approve (`home.js:2714`) / reject (`home.js:2831`).
public struct HouseholdAccessRequestActionResponse: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let message: String?

    public init(ok: Bool, message: String? = nil) {
        self.ok = ok
        self.message = message
    }
}
