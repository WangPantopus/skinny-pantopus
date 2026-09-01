//
//  ConnectionsEndpoints.swift
//  Pantopus
//
//  S5 — the Connections routes the native center was missing: outbound
//  ("Sent") requests, the blocked list, disconnect, and unblock. Kept in
//  its own file rather than piling into `RelationshipsEndpoints.swift`
//  so parallel feature work doesn't collide; the shared
//  `RelationshipUserDTO` / `RelationshipActionEcho` shapes are reused
//  from there.
//
//  All routes live under `/api/relationships` (`backend/app.js:352`) and
//  are declared in `backend/routes/relationships.js`.
//

import Foundation

/// The four `/api/relationships/…` routes Connections needs beyond
/// list / pending / accept / reject.
public enum ConnectionsEndpoints {
    /// `GET /api/relationships/requests/sent` — outbound pending
    /// requests. Route `backend/routes/relationships.js:698`. Response
    /// is `{ requests: [{ id, status, created_at, addressee }] }`
    /// (`relationships.js:702-717`).
    public static let sentRequests = Endpoint(
        method: .get,
        path: "/api/relationships/requests/sent"
    )

    /// `GET /api/relationships/blocked` — people the viewer has blocked.
    /// Route `backend/routes/relationships.js:727`. Response is
    /// `{ blocked: [{ id, created_at, responded_at, block_reason,
    /// requester, addressee, blocked_user }] }` — the handler enriches
    /// each row with `blocked_user` at `relationships.js:747-750`.
    public static let blocked = Endpoint(
        method: .get,
        path: "/api/relationships/blocked"
    )

    /// `DELETE /api/relationships/:id` — disconnect an accepted
    /// relationship. Route `backend/routes/relationships.js:578`. The
    /// handler 400s on a `blocked` row ("Unblock first"), so never call
    /// this from the Blocked tab.
    public static func disconnect(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/relationships/\(id)")
    }

    /// `POST /api/relationships/:id/unblock` — lift a block. Route
    /// `backend/routes/relationships.js:522`. Only the blocker may
    /// unblock (403 otherwise); the row is deleted outright so the pair
    /// can re-request.
    public static func unblock(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/relationships/\(id)/unblock")
    }
}

// MARK: - DTOs

/// One row in `GET /api/relationships/requests/sent`. Mirrors the
/// pending shape but carries `addressee` (the person you asked) instead
/// of `requester`. See `backend/routes/relationships.js:702-710`.
public struct SentRequestDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let status: String?
    public let createdAt: String?
    public let addressee: RelationshipUserDTO?

    public init(
        id: String,
        status: String? = nil,
        createdAt: String? = nil,
        addressee: RelationshipUserDTO? = nil
    ) {
        self.id = id
        self.status = status
        self.createdAt = createdAt
        self.addressee = addressee
    }

    private enum CodingKeys: String, CodingKey {
        case id, status, addressee
        case createdAt = "created_at"
    }
}

/// Envelope for `GET /api/relationships/requests/sent`.
public struct SentRequestsResponse: Decodable, Sendable {
    public let requests: [SentRequestDTO]

    public init(requests: [SentRequestDTO]) {
        self.requests = requests
    }
}

/// One row in `GET /api/relationships/blocked`.
/// `blockedUser` is server-derived (the counterpart relative to the
/// viewer) — `backend/routes/relationships.js:747-750`.
public struct BlockedRelationshipDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let createdAt: String?
    public let respondedAt: String?
    public let blockReason: String?
    public let blockedUser: RelationshipUserDTO?

    public init(
        id: String,
        createdAt: String? = nil,
        respondedAt: String? = nil,
        blockReason: String? = nil,
        blockedUser: RelationshipUserDTO? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.respondedAt = respondedAt
        self.blockReason = blockReason
        self.blockedUser = blockedUser
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case respondedAt = "responded_at"
        case blockReason = "block_reason"
        case blockedUser = "blocked_user"
    }
}

/// Envelope for `GET /api/relationships/blocked`.
public struct BlockedRelationshipsResponse: Decodable, Sendable {
    public let blocked: [BlockedRelationshipDTO]

    public init(blocked: [BlockedRelationshipDTO]) {
        self.blocked = blocked
    }
}
