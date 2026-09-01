//
//  TenantDTOs.swift
//  Pantopus
//
//  DTOs for the tenant ↔ landlord approval flow
//  (`backend/routes/landlordTenant.js`, mounted at `/api/v1` in
//  `backend/app.js:397`).
//

import Foundation

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
    public let deniedReason: String?
    public let deniedAt: String?

    private enum CodingKeys: String, CodingKey {
        case message
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

    public init(
        homeId: String,
        startAt: String? = nil,
        endAt: String? = nil,
        message: String? = nil
    ) {
        self.homeId = homeId
        self.startAt = startAt
        self.endAt = endAt
        self.message = message
    }

    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id"
        case startAt = "start_at"
        case endAt = "end_at"
        case message
    }
}

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
