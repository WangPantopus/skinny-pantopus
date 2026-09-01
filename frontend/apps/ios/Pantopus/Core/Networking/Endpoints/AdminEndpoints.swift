//
//  AdminEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the admin Review-claims surface. Server
//  enforces `requireAdmin` (`backend/middleware/verifyToken.js:128`) on
//  every route here; non-admin sessions receive 403.
//

import Foundation

/// Endpoint builders for `backend/routes/admin.js`.
public enum AdminEndpoints {
    /// `GET /api/admin/claims?bucket=` — route `backend/routes/admin.js:156`.
    /// Pending bucket returns oldest-first; approved / rejected return
    /// newest-first. Set `bucket` to filter; omit for "all states".
    public static func claims(
        bucket: AdminClaimBucket,
        limit: Int = 50,
        offset: Int = 0
    ) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/admin/claims",
            query: [
                "bucket": bucket.rawValue,
                "limit": String(limit),
                "offset": String(offset)
            ]
        )
    }

    /// `GET /api/admin/claims/counts` — route `backend/routes/admin.js:230`.
    /// One call returns the three tab badges.
    public static func claimCounts() -> Endpoint {
        Endpoint(method: .get, path: "/api/admin/claims/counts")
    }

    /// `GET /api/admin/claims/:claimId` — route `backend/routes/admin.js:260`.
    /// Returns the claim record + home + claimant + evidence list with
    /// presigned file URLs (1-hour TTL).
    public static func claimDetail(claimId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/admin/claims/\(claimId)")
    }

    /// `POST /api/admin/claims/:claimId/review` — route `backend/routes/admin.js:342`.
    /// `action` is one of approve / reject / request_more_info; the
    /// optional `note` is surfaced to the claimant in the rejection /
    /// more-info notification.
    public static func reviewClaim(
        claimId: String,
        request: AdminClaimReviewRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/admin/claims/\(claimId)/review",
            body: request
        )
    }
}
