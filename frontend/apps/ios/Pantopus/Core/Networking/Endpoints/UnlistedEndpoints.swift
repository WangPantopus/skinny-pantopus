//
//  UnlistedEndpoints.swift
//  Pantopus
//
//  Endpoint builders for Unlisted (Wave 4) — the removal surface.
//  The claimed-home half lives in `backend/routes/unlisted.js` (mounted
//  under `/api/homes`); the anonymous half sits in
//  `backend/routes/public.js` so it rides the same preview limiter and
//  persists nothing.
//

import Foundation

public enum UnlistedEndpoints {
    /// `GET /api/homes/:id/unlisted` — route
    /// `backend/routes/unlisted.js:32`. The state's exposure profile
    /// plus THIS caller's removal progress (personal, not household).
    ///
    /// Gated on home access, **not** on verification: someone who has
    /// just claimed their address is exactly who needs this, and making
    /// them wait for a postcard would invert the product.
    ///
    /// `unlisted.removals` is `null` when the progress read failed —
    /// `UnlistedRemovalProgress.unavailable`, which must not render as
    /// an empty checklist.
    public static func profile(homeId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/unlisted")
    }

    /// `PUT /api/homes/:id/unlisted/removals/:brokerId` — route
    /// `backend/routes/unlisted.js:65`. Records where the resident has
    /// got to with one broker. The removal itself happens on the
    /// broker's own site; this is bookkeeping they own, never a claim
    /// that Pantopus removed anything.
    ///
    /// 400 `UNKNOWN_BROKER` / `BAD_STATUS` on a rejected pair.
    public static func setRemovalStatus(
        homeId: String,
        brokerId: String,
        status: UnlistedRemovalStatus
    ) -> Endpoint {
        let encodedBroker = brokerId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? brokerId
        return Endpoint(
            method: .put,
            path: "/api/homes/\(homeId)/unlisted/removals/\(encodedBroker)",
            body: UpdateUnlistedRemovalRequest(status: status)
        )
    }

    /// `GET /api/public/unlisted?address=` — route
    /// `backend/routes/public.js`. The anonymous T0 profile: the address
    /// is resolved to a STATE **locally** (`backend/utils/usState.js`,
    /// no geocoder) and then dropped. Nothing is persisted, nothing is
    /// logged with the result, and the address reaches no third party —
    /// which is what lets the web panel promise exactly that.
    ///
    /// Two non-ready answers, and they are NOT interchangeable:
    /// `could_not_place` (we could not read a state out of it) still
    /// carries the full national removal list with no state program;
    /// `unsupported_region` (resolved outside the US) carries a message
    /// and no profile.
    public static func publicPreview(address: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/public/unlisted",
            query: ["address": address],
            authenticated: false
        )
    }
}
