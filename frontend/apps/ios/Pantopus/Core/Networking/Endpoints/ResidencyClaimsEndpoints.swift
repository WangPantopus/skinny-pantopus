//
//  ResidencyClaimsEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/residencyClaims.js` (mounted
//  under `/api/homes`) — the Residency Pass: scoped, expiring,
//  revocable claims, the letter's live minimal-disclosure sibling.
//  Claims are personal per home+user.
//

import Foundation

public enum ResidencyClaimsEndpoints {
    /// `POST /api/homes/:id/residency-claims` — route
    /// `backend/routes/residencyClaims.js:36`. Issue (verified T4
    /// occupants only; 30/day limiter server-side). A scope whose fact
    /// can't be resolved fails closed with 422 SCOPE_UNAVAILABLE.
    public static func issue(homeId: String, request: IssueResidencyClaimRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/residency-claims", body: request)
    }

    /// `GET /api/homes/:id/residency-claims` — route
    /// `backend/routes/residencyClaims.js:70`. The caller's own claims
    /// for this home, newest first.
    public static func list(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/residency-claims")
    }

    /// `GET /api/homes/:id/residency-claims/:claimId/views` — route
    /// `backend/routes/residencyClaims.js:87`. The issuer-visible
    /// audit trail.
    public static func views(homeId: String, claimId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/residency-claims/\(claimId)/views")
    }

    /// `POST /api/homes/:id/residency-claims/:claimId/revoke` — route
    /// `backend/routes/residencyClaims.js:107`. Kills the claim's
    /// public verification immediately.
    public static func revoke(homeId: String, claimId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/homes/\(homeId)/residency-claims/\(claimId)/revoke")
    }
}
