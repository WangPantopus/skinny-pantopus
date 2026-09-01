//
//  ProfessionalEndpoints.swift
//  Pantopus
//
//  Endpoint builders for `backend/routes/professional.js` — the
//  Business-pillar professional profile (headline, categories, pricing,
//  verification).
//

import Foundation

public enum ProfessionalEndpoints {
    /// `GET /api/professional/profile/me` — route `professional.js:164`.
    /// Returns `{ profile: … | null }`; null means professional mode is off.
    public static func profileMe() -> Endpoint {
        Endpoint(method: .get, path: "/api/professional/profile/me")
    }

    /// `POST /api/professional/profile` — route `professional.js:89`.
    /// Turns professional mode **on**. Responds 201 + `{ message, profile }`
    /// for a brand-new record. A soft-disabled record (`is_active: false`)
    /// is re-activated by the same route (200); an already-active record
    /// answers 400 "Professional profile already exists."
    public static func createProfile(_ body: ProfessionalEnableRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/professional/profile", body: body)
    }

    /// `DELETE /api/professional/profile/me` — route `professional.js:221`.
    /// Soft-disable: flips `is_active` + `is_public` to false and returns
    /// the updated row, so the record survives for a later re-enable.
    public static func disableProfile() -> Endpoint {
        Endpoint(method: .delete, path: "/api/professional/profile/me")
    }

    /// `PATCH /api/professional/profile/me` — route `professional.js:190`.
    /// Partial update; only the safe, unambiguous fields are sent (headline /
    /// bio / public + active flags). `categories` is enum-constrained on the
    /// server, so free-text skills are not written here.
    public static func updateProfileMe(_ body: ProfessionalProfileUpdateRequest) -> Endpoint {
        Endpoint(method: .patch, path: "/api/professional/profile/me", body: body)
    }

    /// `GET /api/professional/verification/status` — route
    /// `professional.js:372`. Tier + status of the verification flow.
    public static func verificationStatus() -> Endpoint {
        Endpoint(method: .get, path: "/api/professional/verification/status")
    }

    /// `POST /api/professional/verification/start` — route
    /// `professional.js:310`. Moves `verification_status` to `pending` for
    /// admin review. Tier must be 1 or 2 (`professional.js:315`); 400 when a
    /// review is already in progress or the tier is already verified, 404
    /// when professional mode is off. Mirrors RN's "Start verification" CTA
    /// (`pantopus/frontend/apps/mobile/src/app/professional.tsx:386`).
    public static func startVerification(_ body: ProfessionalVerificationStartRequest) -> Endpoint {
        Endpoint(method: .post, path: "/api/professional/verification/start", body: body)
    }

    /// `GET /api/professional/:username` — route `professional.js:403`. The
    /// public-facing professional profile (user + portfolio + skills +
    /// review stats). Used by the public view, not the self editor.
    public static func publicProfile(username: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/professional/\(username)")
    }
}
