//
//  TenantEndpoints.swift
//  Pantopus
//
//  Tenant-side landlord flows. `backend/routes/landlordTenant.js` is
//  mounted at `/api/v1` (`backend/app.js:397`), so the tenant routes
//  resolve to `/api/v1/tenant/*`.
//
//  Submission reads the existing status route first. The request-cancellation
//  route is not yet consumed by this native wizard.
//

import Foundation

public enum TenantEndpoints {
    public static func homeStatus(homeId: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/v1/tenant/home/\(homeId)/status",
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        )
    }

    /// `POST /api/v1/tenant/request-approval` — route
    /// `backend/routes/landlordTenant.js:483`. Creates a pending
    /// `HomeLease` addressed to the home's verified landlord authority.
    ///
    /// Known non-2xx answers the caller should branch on:
    ///   * 400 includes validation/unavailable errors; only the explicit
    ///     "This property has no verified landlord…" response selects mail review.
    ///   * 409 — "You already have a pending request for this home" (:527)
    ///   * 409 — "You already have an active lease at this home" (:540)
    public static func requestApproval(_ request: TenantRequestApprovalRequest, headers: [String: String] = [:]) -> Endpoint {
        Endpoint(method: .post, path: "/api/v1/tenant/request-approval", body: request, headers: headers)
    }

    static func leaseFile(homeId: String, suffix: String, headers: [String: String], method: Endpoint.Method = .get) -> Endpoint {
        Endpoint(
            method: method,
            path: "/api/v1/tenant/home/\(homeId)/lease-files/\(suffix)",
            headers: headers,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData
        )
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
