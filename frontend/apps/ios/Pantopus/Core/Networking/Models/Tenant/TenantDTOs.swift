//
//  TenantDTOs.swift
//  Pantopus
//
//  DTOs for the tenant ↔ landlord approval flow
//  (`backend/routes/landlordTenant.js`, mounted at `/api/v1` in
//  `backend/app.js:397`).
//

import Foundation

/// Observed existing lease, checked by the server before admitting a request.
public struct TenantRequestContext: Codable, Sendable {
    public let homeId: String
    public let actorId: String
    public let leaseId: String?
    public let leaseState: String?

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id"
        case actorId = "actor_id"
        case leaseId = "lease_id"
        case leaseState = "lease_state"
    }
}

public struct TenantHomeStatusResponse: Decodable, Sendable {
    public let homeId: String
    public let requestContext: TenantRequestContext
    public let lease: LeaseStatus?

    public struct LeaseStatus: Decodable, Sendable {
        public let state: TenantLeaseState
        public let lease: TenantLeaseDTO?
    }

    func matches(homeId: String) -> Bool {
        let context = requestContext
        let validLease = context.leaseId == nil
            ? context.leaseState == nil
            : context.leaseId?.isEmpty == false && ["pending", "active", "ended", "canceled"].contains(context.leaseState ?? "")
        return self.homeId == homeId && context.homeId == homeId && !context.actorId.isEmpty && validLease
    }

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id"
        case requestContext = "request_context"
        case lease
    }
}

/// `HomeLease.state` — the tenant-visible lifecycle of a lease request.
public enum TenantLeaseState: String, Decodable, Sendable, Hashable {
    case none
    case pending
    case active
    case denied
    case ended
}

/// Free-form `metadata` jsonb the request-approval handler writes
/// (`landlordTenant.js:551`) and the deny handler appends to.
public struct TenantLeaseMetadata: Decodable, Sendable, Hashable {
    public let message: String?
    public let leaseFileId: String?
    public let deniedReason: String?
    public let deniedAt: String?

    private enum CodingKeys: String, CodingKey {
        case message
        case leaseFileId = "lease_file_id"
        case deniedReason = "denied_reason"
        case deniedAt = "denied_at"
    }
}

/// A `HomeLease` row as returned by `POST /tenant/request-approval`
/// (`landlordTenant.js:576`).
public struct TenantLeaseDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let state: TenantLeaseState
    public let source: String?
    public let startAt: String?
    public let endAt: String?
    public let createdAt: String?
    public let metadata: TenantLeaseMetadata?

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case state
        case source
        case startAt = "start_at"
        case endAt = "end_at"
        case createdAt = "created_at"
        case metadata
    }
}

/// `POST /api/v1/tenant/request-approval` body. Validated by
/// `tenantRequestSchema` (`landlordTenant.js:60`): `home_id` is a
/// required uuid, `start_at` / `end_at` are ISO strings or null, and
/// `message` is capped at 1000 chars.
public struct TenantRequestApprovalRequest: Encodable, Sendable {
    public let homeId: String
    public let startAt: String?
    public let endAt: String?
    public let message: String?
    public let requestContext: TenantRequestContext?
    public let leaseFileId: String?

    public init(
        homeId: String,
        startAt: String? = nil,
        endAt: String? = nil,
        message: String? = nil,
        requestContext: TenantRequestContext? = nil,
        leaseFileId: String? = nil
    ) {
        self.homeId = homeId
        self.startAt = startAt
        self.endAt = endAt
        self.message = message
        self.requestContext = requestContext
        self.leaseFileId = leaseFileId
    }

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id"
        case startAt = "start_at"
        case endAt = "end_at"
        case message
        case requestContext = "request_context"
        case leaseFileId = "lease_file_id"
    }
}

struct TenantLeaseFileSession: Decodable {
    let homeId: String
    let actorId: String
    let sessionScope: String
    var headers: [String: String] {
        ["X-Pantopus-Session-Scope": sessionScope]
    }

    func matches(home: String, actor: String) -> Bool {
        homeId == home && actorId == actor && UUID(uuidString: homeId) != nil
            && UUID(uuidString: actorId) != nil && HomeClaimReviewSnapshot.validToken(sessionScope)
    }

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id", actorId = "actor_id", sessionScope = "session_scope"
    }
}

struct TenantLeaseFile: Decodable, Equatable {
    static let allowedMIMEs: Set<String> = [
        "application/pdf", "text/plain", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"
    ]
    static let maxBytes = 25 * 1024 * 1024
    let id: String
    let homeId: String
    let fileName: String
    let fileSize: Int
    let mimeType: String
    let available: Bool
    let leaseId: String?
    func matches(home: String, file: String) -> Bool {
        id == file && homeId == home && UUID(uuidString: id) != nil && UUID(uuidString: homeId) != nil
            && !fileName.isEmpty && fileName.utf16.count <= 255 && fileSize > 0 && fileSize <= Self.maxBytes
            && Self.allowedMIMEs.contains(mimeType) && available && (leaseId == nil || UUID(uuidString: leaseId ?? "") != nil)
    }

    private enum CodingKeys: String, CodingKey {
        case id, available
        case homeId = "home_id", fileName = "file_name", fileSize = "file_size", mimeType = "mime_type", leaseId = "lease_id"
    }
}

struct TenantLeaseFileResponse: Decodable { let file: TenantLeaseFile }
struct TenantLeaseFileRemoval: Decodable { let deleted: Bool }

/// 201 envelope — `{ lease }` (`landlordTenant.js:587`).
public struct TenantRequestApprovalResponse: Decodable, Sendable, Hashable {
    public let lease: TenantLeaseDTO
}

/// `POST /api/v1/tenant/move-out` body (`landlordTenant.js:69`).
public struct TenantMoveOutRequest: Encodable, Sendable {
    public let leaseId: String
    public let reason: String?

    public init(leaseId: String, reason: String? = nil) {
        self.leaseId = leaseId
        self.reason = reason
    }

    private enum CodingKeys: String, CodingKey {
        case leaseId = "lease_id"
        case reason
    }
}
