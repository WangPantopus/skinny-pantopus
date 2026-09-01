//
//  HomeDashboardEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the Home dashboard aggregate and the four
//  Home Intelligence reads (health score, seasonal checklist, property
//  value, bill trends) plus the checklist-item mutation.
//
//  Kept out of `HomesEndpoints.swift` — that file is already at the
//  SwiftLint file-length limit and is edited by every Homes surface.
//

import Foundation

/// Endpoint builders for the Home dashboard aggregate + Home Intelligence.
public enum HomeDashboardEndpoints {
    /// `GET /api/homes/:id/dashboard` — route `backend/routes/home.js:6224`.
    ///
    /// Single-request aggregate: `{ home, myAccess, today, counts, members,
    /// recent_activity }`. Pass `includeHealthScore` to embed the health
    /// score in the same round-trip (`?include_health_score=true`).
    public static func dashboard(homeId: String, includeHealthScore: Bool = false) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/dashboard",
            query: includeHealthScore ? ["include_health_score": "true"] : [:]
        )
    }

    /// `GET /api/homes/:id/health-score` — route `backend/routes/home.js:7482`.
    ///
    /// Returns `{ score, breakdown, topIssue, topAction }`. The server
    /// caches for 5 minutes; `force` bypasses that cache (mirrors RN's
    /// `useHomeIntelligence` which always forces on mount so a stale
    /// zero-score can't mask a freshly-populated home).
    public static func healthScore(homeId: String, force: Bool = false) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/health-score",
            query: force ? ["force": "true"] : [:]
        )
    }

    /// `GET /api/homes/:id/seasonal-checklist` — route `backend/routes/home.js:7504`.
    ///
    /// Idempotently generates the current season's checklist when the home
    /// has none, so this doubles as the "Generate checklist" action.
    public static func seasonalChecklist(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/seasonal-checklist")
    }

    /// `PATCH /api/homes/:id/seasonal-checklist/:itemId` — route
    /// `backend/routes/home.js:7577`. Body is `{ status }` where status is
    /// `completed` or `skipped` (Joi-validated). Responds with the updated
    /// `HomeSeasonalChecklistItem` row.
    public static func updateSeasonalChecklistItem(
        homeId: String,
        itemId: String,
        status: String
    ) -> Endpoint {
        Endpoint(
            method: .patch,
            path: "/api/homes/\(homeId)/seasonal-checklist/\(itemId)",
            body: UpdateSeasonalChecklistItemBody(status: status)
        )
    }

    /// `GET /api/homes/:id/property-value` — route `backend/routes/home.js:7752`.
    public static func propertyValue(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/property-value")
    }

    /// `GET /api/homes/:id/bill-trends` — route `backend/routes/home.js:7599`.
    ///
    /// 403s for members without `finance.view` / `finance.manage`.
    public static func billTrends(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/bill-trends")
    }
}

/// Request body for `PATCH /api/homes/:id/seasonal-checklist/:itemId`.
public struct UpdateSeasonalChecklistItemBody: Encodable, Sendable, Equatable {
    public let status: String

    public init(status: String) {
        self.status = status
    }
}
