//
//  HomeDiscoveryEndpoints.swift
//  Pantopus
//
//  A12.1 Find-or-Add-Home discovery + the two "join an existing home"
//  paths that hang off it (ask a verified owner to add me, submit a
//  residency claim against an already-claimed address).
//
//  Kept in its own file rather than piled into `HomesEndpoints.swift`
//  so the discovery surface can grow without merge contention.
//

import Foundation

/// Endpoint builders for the home-discovery / join-an-existing-home
/// routes in `backend/routes/home.js`.
public enum HomeDiscoveryEndpoints {
    /// `GET /api/homes/discover?q=&limit=&offset=` — route
    /// `backend/routes/home.js:2297`. Searches `public_preview` homes
    /// whose `privacy_mask_level` is `normal`. The backend rejects a
    /// `q` shorter than 2 characters with a 400.
    public static func discover(
        query: String,
        limit: Int? = nil,
        offset: Int? = nil
    ) -> Endpoint {
        var params: [String: String] = ["q": query]
        if let limit { params["limit"] = String(limit) }
        if let offset { params["offset"] = String(offset) }
        return Endpoint(method: .get, path: "/api/homes/discover", query: params)
    }

    /// `GET /api/homes/:id/public-profile` — route
    /// `backend/routes/home.js:2443`. Returns the masked home preview
    /// plus the two flags the claim-start method picker branches on:
    /// `has_verified_owner` and `is_member`.
    public static func publicProfile(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/public-profile")
    }

    /// `POST /api/homes/:id/request-household-from-owner` — route
    /// `backend/routes/home.js:2561`. Notifies every verified owner
    /// that a non-member wants to be added. Body is validated by
    /// `requestHouseholdFromOwnerSchema` (`backend/routes/home.js:163`)
    /// which accepts `owner | resident | household_member | guest`.
    public static func requestHouseholdFromOwner(
        homeId: String,
        request: RequestHouseholdFromOwnerRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/request-household-from-owner",
            body: request
        )
    }

    /// `POST /api/homes/:id/claim` — route `backend/routes/home.js:6479`.
    /// Provisional residency claim submitted against an existing home
    /// instead of creating a duplicate `Home` row.
    ///
    /// Note: the parity doc calls this `POST /api/homes/:id/residency-claims`;
    /// that path does not exist — `/:id/claim` is the real route.
    public static func submitResidencyClaim(
        homeId: String,
        request: SubmitResidencyClaimRequest
    ) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/homes/\(homeId)/claim",
            body: request
        )
    }
}
