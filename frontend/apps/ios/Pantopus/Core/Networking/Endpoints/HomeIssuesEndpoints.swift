//
//  HomeIssuesEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the per-home **issue tracker** (`HomeIssue`).
//  This is a DIFFERENT backend collection from the maintenance-task log
//  (`/api/homes/:id/maintenance`, `backend/routes/home.js:4695`) — issues
//  are resident-reported problems with their own lifecycle
//  (`open → scheduled → completed`, plus `dismissed`).
//

import Foundation

/// Endpoint builders for the `HomeIssue` collection in
/// `backend/routes/home.js` (the `// ============ HOME ISSUES ============`
/// block).
public enum HomeIssuesEndpoints {
    /// `GET /api/homes/:id/issues` — route `backend/routes/home.js:4386`.
    /// Optional `status` / `severity` query filters are applied
    /// server-side; the list screen buckets client-side instead so a
    /// single fetch feeds all three tabs.
    public static func list(homeId: String, status: String? = nil, severity: String? = nil) -> Endpoint {
        var query: [String: String] = [:]
        if let status, !status.isEmpty { query["status"] = status }
        if let severity, !severity.isEmpty { query["severity"] = severity }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/issues",
            query: query
        )
    }

    /// `POST /api/homes/:id/issues` — route `backend/routes/home.js:4420`.
    /// `title` is the only required body field; the handler defaults
    /// `severity` to `"medium"` and stamps `reported_by` from the token.
    public static func create(homeId: String, request: CreateHomeIssueRequest) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/issues",
            body: request
        )
    }

    /// `PUT /api/homes/:id/issues/:issueId` — route
    /// `backend/routes/home.js:4462`. Requires `can_manage_home`. The
    /// handler whitelists `title / description / status / severity /
    /// assigned_vendor_id / estimated_cost / photos / secret_fixes /
    /// linked_gig_id / resolved_at / details` and rewrites `updated_at`.
    public static func update(
        homeId: String,
        issueId: String,
        request: UpdateHomeIssueRequest
    ) -> Endpoint {
        Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/issues/\(issueId)",
            body: request
        )
    }
}
