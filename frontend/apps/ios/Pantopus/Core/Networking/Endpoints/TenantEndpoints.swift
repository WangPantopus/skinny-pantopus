//
//  TenantEndpoints.swift
//  Pantopus
//
//  Tenant-side landlord flows. `backend/routes/landlordTenant.js` is
//  mounted at `/api/v1` (`backend/app.js:397`), so the tenant routes
//  resolve to `/api/v1/tenant/*`.
//
//  NOTE: the RN client also calls `GET /api/v1/tenant/home/:id/status`
//  and `POST /api/v1/tenant/request/:leaseId/cancel`. Neither route
//  exists in `backend/routes/landlordTenant.js` today (the only
//  `/tenant/*` declarations are `request-approval` :483,
//  `accept-invite` :601, and `move-out` :643), so they are deliberately
//  absent here rather than stubbed with fixture data.
//

import Foundation

public enum TenantEndpoints {
    /// `POST /api/v1/tenant/request-approval` — route
    /// `backend/routes/landlordTenant.js:483`. Creates a pending
    /// `HomeLease` addressed to the home's verified landlord authority.
    ///
    /// Known non-2xx answers the caller should branch on:
    ///   * 400 — "This property has no verified landlord…" (:515)
    ///   * 409 — "You already have a pending request for this home" (:527)
    ///   * 409 — "You already have an active lease at this home" (:540)
    public static func requestApproval(_ request: TenantRequestApprovalRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/v1/tenant/request-approval", body: request)
    }

    /// `POST /api/v1/tenant/move-out` — route
    /// `backend/routes/landlordTenant.js:643`. Ends the caller's own
    /// active lease.
    public static func moveOut(leaseId: String, reason: String?) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/v1/tenant/move-out",
            body: TenantMoveOutRequest(leaseId: leaseId, reason: reason)
        )
    }
}
