//
//  HomeOwnershipSecurityEndpoints.swift
//  Pantopus
//
//  Per-home ownership security POLICY (privacy mask level, owner claim
//  policy, member attach policy, tenure mode). Distinct from
//  `HomePrivacyEndpoints`, which drives the 9 client-side privacy
//  toggles on `/api/homes/:id/privacy`.
//

import Foundation

/// Endpoint builders for the per-home security policy block in
/// `backend/routes/homeOwnership.js` (mounted at `/api/homes` —
/// `backend/app.js:322`).
public enum HomeOwnershipSecurityEndpoints {
    /// `GET /api/homes/:id/security` — route
    /// `backend/routes/homeOwnership.js:1701`. Requires the
    /// `security.manage` permission; 403s otherwise.
    public static func get(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/security")
    }

    /// `PATCH /api/homes/:id/security` — route
    /// `backend/routes/homeOwnership.js:1751`. A multi-owner home may
    /// answer `{ pending: true, quorum_action_id, message }` instead of
    /// applying the change immediately.
    public static func update(
        homeId: String,
        request: UpdateHomeOwnershipSecurityRequest
    ) -> Endpoint {
        Endpoint(method: .patch, path: "/api/homes/\(homeId)/security", body: request)
    }
}
