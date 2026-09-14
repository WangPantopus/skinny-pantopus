//
//  TenantEndpoints.swift
//  Pantopus
//
//  Tenant-side landlord flows. `backend/routes/landlordTenant.js` is
//  mounted at `/api/v1` (`backend/app.js:397`), so the tenant routes
//  resolve to `/api/v1/tenant/*`.
//
//  The existing status and request-cancellation routes are not yet consumed
//  by this native wizard. They are implemented in `landlordTenant.js`.
//

import Foundation

public enum TenantEndpoints {
    /// `POST /api/v1/tenant/request-approval` — route
    /// `backend/routes/landlordTenant.js:483`. Creates a pending
    /// `HomeLease` addressed to the home's verified landlord authority.
    ///
    /// Known non-2xx answers the caller should branch on:
    ///   * 400 includes validation/unavailable errors; only the explicit
    ///     "This property has no verified landlord…" response selects mail review.
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
