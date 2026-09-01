//
//  HomePrivacyEndpoints.swift
//  Pantopus
//
//  P3F / A14.2 — per-home privacy/security toggles.
//

import Foundation

/// Endpoint builders for the per-home privacy toggles in
/// `backend/routes/homePrivacy.js`.
public enum HomePrivacyEndpoints {
    /// `GET /api/homes/:id/privacy` — route `backend/routes/homePrivacy.js:81`.
    public static func get(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/privacy")
    }

    /// `PATCH /api/homes/:id/privacy` — route `backend/routes/homePrivacy.js:110`.
    public static func update(homeId: String, request: UpdateHomePrivacyRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/homes/\(homeId)/privacy", body: request)
    }
}
