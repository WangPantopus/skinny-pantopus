//
//  RelationshipsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/relationships.js` — connection
//  requests, accept/reject, block/unblock, and the membership listing.
//

import Foundation

/// Endpoints under `/api/relationships/*`.
public enum RelationshipsEndpoints {
    /// `GET /api/relationships` — list my relationships, optionally
    /// filtered by status. Route `backend/routes/relationships.js:622`.
    public static func list(
        status: String? = nil,
        limit: Int = 50,
        offset: Int = 0
    ) -> Endpoint {
        var query: [String: String] = [
            "limit": String(limit),
            "offset": String(offset)
        ]
        if let status, !status.isEmpty { query["status"] = status }
        return Endpoint(method: .get, path: "/api/relationships", query: query)
    }

    /// `GET /api/relationships/requests/pending` — list pending requests
    /// received by me. Route `backend/routes/relationships.js:669`.
    public static let pending = Endpoint(
        method: .get,
        path: "/api/relationships/requests/pending"
    )

    /// `POST /api/relationships/requests` — send a connection request
    /// to another user. Route `backend/routes/relationships.js:67`.
    public static func sendRequest(body: ConnectionRequestBody) -> Endpoint {
        Endpoint(method: .post, path: "/api/relationships/requests", body: body)
    }

    /// `POST /api/relationships/:id/accept` — accept an inbound
    /// connection request. Route `backend/routes/relationships.js:217`.
    public static func accept(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/relationships/\(id)/accept")
    }

    /// `POST /api/relationships/:id/reject` — decline an inbound
    /// request. Route `backend/routes/relationships.js:295`.
    public static func reject(id: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/relationships/\(id)/reject")
    }
}

/// `POST /api/relationships/requests` body. Matches the Joi validator at
/// `backend/routes/relationships.js:40-43` (snake_case field names).
public struct ConnectionRequestBody: Encodable, Sendable {
    public let addresseeId: String
    public let message: String?

    public init(addresseeId: String, message: String? = nil) {
        self.addresseeId = addresseeId
        self.message = message
    }

    private enum CodingKeys: String, CodingKey {
        case addresseeId = "addressee_id"
        case message
    }
}

/// `POST /api/relationships/requests` response envelope. The backend
/// returns `{message, relationship}`; we only use `message` for telemetry.
public struct ConnectionRequestResponse: Decodable, Sendable {
    public let message: String?
}

/// Trimmed `User` projection embedded in relationships / pending responses.
/// Mirrors the `USER_SELECT` constant at
/// `backend/routes/relationships.js:47`.
public struct RelationshipUserDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let username: String?
    public let name: String?
    public let firstName: String?
    public let lastName: String?
    public let profilePictureURL: String?
    public let city: String?
    public let state: String?

    public init(
        id: String,
        username: String? = nil,
        name: String? = nil,
        firstName: String? = nil,
        lastName: String? = nil,
        profilePictureURL: String? = nil,
        city: String? = nil,
        state: String? = nil
    ) {
        self.id = id
        self.username = username
        self.name = name
        self.firstName = firstName
        self.lastName = lastName
        self.profilePictureURL = profilePictureURL
        self.city = city
        self.state = state
    }

    private enum CodingKeys: String, CodingKey {
        case id, username, name, city, state
        case firstName = "first_name"
        case lastName = "last_name"
        case profilePictureURL = "profile_picture_url"
    }
}

/// One row in `GET /api/relationships`. The backend enriches each row
/// with `other_user` (the counterpart relative to the current viewer)
/// and `direction` (`"sent" | "received"`). See
/// `backend/routes/relationships.js:649-657`.
public struct RelationshipDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let status: String
    public let createdAt: String?
    public let respondedAt: String?
    public let acceptedAt: String?
    public let blockedBy: String?
    public let direction: String?
    public let otherUser: RelationshipUserDTO?

    public init(
        id: String,
        status: String,
        createdAt: String? = nil,
        respondedAt: String? = nil,
        acceptedAt: String? = nil,
        blockedBy: String? = nil,
        direction: String? = nil,
        otherUser: RelationshipUserDTO? = nil
    ) {
        self.id = id
        self.status = status
        self.createdAt = createdAt
        self.respondedAt = respondedAt
        self.acceptedAt = acceptedAt
        self.blockedBy = blockedBy
        self.direction = direction
        self.otherUser = otherUser
    }

    private enum CodingKeys: String, CodingKey {
        case id, status, direction
        case createdAt = "created_at"
        case respondedAt = "responded_at"
        case acceptedAt = "accepted_at"
        case blockedBy = "blocked_by"
        case otherUser = "other_user"
    }
}

/// Envelope for `GET /api/relationships`.
public struct RelationshipsListResponse: Decodable, Sendable {
    public let relationships: [RelationshipDTO]

    public init(relationships: [RelationshipDTO]) {
        self.relationships = relationships
    }
}

/// One row in `GET /api/relationships/requests/pending`.
public struct PendingRequestDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let status: String?
    public let createdAt: String?
    public let requester: RelationshipUserDTO?

    public init(
        id: String,
        status: String? = nil,
        createdAt: String? = nil,
        requester: RelationshipUserDTO? = nil
    ) {
        self.id = id
        self.status = status
        self.createdAt = createdAt
        self.requester = requester
    }

    private enum CodingKeys: String, CodingKey {
        case id, status, requester
        case createdAt = "created_at"
    }
}

/// Envelope for `GET /api/relationships/requests/pending`.
public struct PendingRequestsResponse: Decodable, Sendable {
    public let requests: [PendingRequestDTO]

    public init(requests: [PendingRequestDTO]) {
        self.requests = requests
    }
}

/// Generic ack envelope returned by accept / reject — only `message` is
/// consumed by the UI for telemetry.
public struct RelationshipActionEcho: Decodable, Sendable {
    public let message: String?
}
