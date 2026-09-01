//
//  HomeIssueDTOs.swift
//  Pantopus
//
//  DTOs for the per-home issue tracker (`HomeIssue` table). Distinct from
//  `MaintenanceTaskDTO`, which models the maintenance-task log.
//  Routes: `backend/routes/home.js:4386 / :4420 / :4462`.
//

import Foundation

/// One row of the `HomeIssue` table as returned by
/// `GET /api/homes/:id/issues` (`select('*')`, so every column is
/// present but most are nullable).
public struct HomeIssueDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String?
    public let title: String
    public let description: String?
    /// `open` (default) / `suggested` / `scheduled` / `in_progress` /
    /// `completed` / `dismissed`. Not enum-constrained server-side, so
    /// unknown values fall through to a neutral chip.
    public let status: String?
    /// `low` / `medium` (default) / `high` / `urgent`.
    public let severity: String?
    public let reportedBy: String?
    public let assignedVendorId: String?
    public let estimatedCost: Decimal?
    public let linkedGigId: String?
    public let resolvedAt: String?
    public let createdAt: String?
    public let updatedAt: String?

    public init(
        id: String,
        homeId: String? = nil,
        title: String,
        description: String? = nil,
        status: String? = nil,
        severity: String? = nil,
        reportedBy: String? = nil,
        assignedVendorId: String? = nil,
        estimatedCost: Decimal? = nil,
        linkedGigId: String? = nil,
        resolvedAt: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.title = title
        self.description = description
        self.status = status
        self.severity = severity
        self.reportedBy = reportedBy
        self.assignedVendorId = assignedVendorId
        self.estimatedCost = estimatedCost
        self.linkedGigId = linkedGigId
        self.resolvedAt = resolvedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, status, severity
        case homeId = "home_id"
        case reportedBy = "reported_by"
        case assignedVendorId = "assigned_vendor_id"
        case estimatedCost = "estimated_cost"
        case linkedGigId = "linked_gig_id"
        case resolvedAt = "resolved_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Envelope for `GET /api/homes/:id/issues` — handler at
/// `backend/routes/home.js:4410` (`res.json({ issues })`).
public struct HomeIssuesResponse: Decodable, Sendable, Hashable {
    public let issues: [HomeIssueDTO]
}

/// Envelope for `POST` / `PUT` — both reply `{ issue }`
/// (`backend/routes/home.js:4453` and `:4483`).
public struct HomeIssueResponse: Decodable, Sendable, Hashable {
    public let issue: HomeIssueDTO
}

/// Body for `POST /api/homes/:id/issues`. RN sends `title` +
/// optional `description` (`src/app/homes/[id]/maintenance.tsx:53`);
/// `severity` is accepted by the handler and defaults to `"medium"`.
public struct CreateHomeIssueRequest: Encodable, Sendable, Hashable {
    public let title: String
    public let description: String?
    public let severity: String?

    public init(title: String, description: String? = nil, severity: String? = nil) {
        self.title = title
        self.description = description
        self.severity = severity
    }
}

/// Body for `PUT /api/homes/:id/issues/:issueId`. Only the fields that
/// are non-nil are encoded, matching the handler's
/// `if (req.body[key] !== undefined)` merge.
public struct UpdateHomeIssueRequest: Encodable, Sendable, Hashable {
    public let title: String?
    public let description: String?
    public let status: String?
    public let severity: String?

    public init(
        title: String? = nil,
        description: String? = nil,
        status: String? = nil,
        severity: String? = nil
    ) {
        self.title = title
        self.description = description
        self.status = status
        self.severity = severity
    }

    /// Convenience for the list screen's status transitions
    /// (`scheduled` / `completed` / `dismissed`).
    public static func status(_ status: String) -> UpdateHomeIssueRequest {
        UpdateHomeIssueRequest(status: status)
    }

    private enum CodingKeys: String, CodingKey {
        case title, description, status, severity
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(severity, forKey: .severity)
    }
}
