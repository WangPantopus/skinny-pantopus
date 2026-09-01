//
//  HomeClaimReviewEndpoints.swift
//  Pantopus
//
//  H6 — The **per-home owner** claim-review surface. Deliberately kept
//  out of `HomesEndpoints.swift` (merge contention) and completely
//  separate from `AdminEndpoints` — the admin queue talks to
//  `/api/admin/claims*`, this one talks to the home-scoped routes an
//  owner is authorised for (`ownership.manage` / `members.manage`).
//
//  Both claim collections are mounted on `/api/homes` in `backend/app.js`:
//    - `app.js:322` → `routes/homeOwnership.js`  (ownership claims)
//    - `app.js:326` → `routes/home.js`           (residency claims)
//

import Foundation

/// Endpoint builders for the per-home owner claim-review screen.
public enum HomeClaimReviewEndpoints {
    // MARK: - Ownership claims (`HomeOwnershipClaim`)

    /// `GET /api/homes/:id/ownership-claims` — route
    /// `backend/routes/homeOwnership.js:490`. Owner-only
    /// (`ownership.manage`). Claimants come back masked.
    public static func ownershipClaims(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/ownership-claims")
    }

    /// `GET /api/homes/:id/ownership-claims/compare` — route
    /// `backend/routes/homeOwnership.js:536`. Returns the side-by-side
    /// incumbent-vs-challenger payload built by
    /// `backend/services/homeClaimComparisonService.js:19`.
    ///
    /// 404s when the `adminCompare` household-claim flag is off; callers
    /// must treat any failure as "comparison unavailable" and fall back
    /// to `ownershipClaims(homeId:)`.
    public static func ownershipClaimComparison(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/ownership-claims/compare")
    }

    /// `POST /api/homes/:id/ownership-claims/:claimId/review` — route
    /// `backend/routes/homeOwnership.js:665`. `action` ∈
    /// approve | reject | flag.
    public static func reviewOwnershipClaim(
        homeId: String,
        claimId: String,
        request: HomeOwnershipClaimReviewRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/ownership-claims/\(claimId)/review",
            body: request
        )
    }

    /// `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`
    /// — route `backend/routes/homeOwnership.js:1014`. `action` ∈
    /// invite_to_household | decline_relationship | flag_unknown_person.
    ///
    /// 404s when the `inviteMerge` flag is off, and 403s unless the
    /// caller is a *verified* household authority.
    public static func resolveOwnershipClaimRelationship(
        homeId: String,
        claimId: String,
        request: HomeClaimRelationshipResolveRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/ownership-claims/\(claimId)/resolve-relationship",
            body: request
        )
    }

    // MARK: - Residency claims (`HomeResidencyClaim`)

    /// `GET /api/homes/:id/claims` — route `backend/routes/home.js:6716`.
    /// Gated on `members.manage` (not `ownership.manage`).
    public static func residencyClaims(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/claims")
    }

    /// `POST /api/homes/:id/claim/:claimId/approve` — route
    /// `backend/routes/home.js:6752`. Creates/activates the claimant's
    /// `HomeOccupancy`. Note the singular `claim` segment — this is not
    /// the same path family as `ownership-claims`.
    public static func approveResidencyClaim(
        homeId: String,
        claimId: String,
        request: HomeResidencyClaimApproveRequest = HomeResidencyClaimApproveRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/claim/\(claimId)/approve",
            body: request
        )
    }

    /// `POST /api/homes/:id/claim/:claimId/reject` — route
    /// `backend/routes/home.js:6838`. The claimant's notification is
    /// opaque; `reason` is stored as `review_note` only.
    public static func rejectResidencyClaim(
        homeId: String,
        claimId: String,
        request: HomeResidencyClaimRejectRequest = HomeResidencyClaimRejectRequest()
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/claim/\(claimId)/reject",
            body: request
        )
    }
}
