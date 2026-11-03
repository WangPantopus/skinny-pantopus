//
//  PlaceEndpoints.swift
//  Pantopus
//
//  Endpoint builders for the Place Intelligence contract:
//  the living dashboard (`backend/routes/placeIntelligence.js`) and the
//  anonymous T0 preview (`backend/routes/public.js`).
//

import Foundation

public enum PlaceEndpoints {
    /// `GET /api/homes/:id/changes?since=<ISO-8601>` — route
    /// `backend/routes/placeIntelligence.js:111`. What really changed at the
    /// Home since this account's last visit to its Place (newest first, at
    /// most 20, `total` counts all). An older server answers 404.
    public static func changes(homeId: String, since: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/homes/\(homeId)/changes", query: ["since": since])
    }

    /// `GET /api/homes/:id/intelligence?ballot=1[&sections=a,b,c]` — route
    /// `backend/routes/placeIntelligence.js:37`. The grouped section
    /// envelopes for a saved/claimed/verified place (T1–T4; tier and
    /// per-section gating resolved server-side). Pass `sections` to
    /// lazy-load a subset (e.g. a detail page refreshing only its own
    /// group); omitted ⇒ the full launch set. `ballot=1` is this client's
    /// opt-in to the Ballot fields of `civic_election` (with `ballot_p0` on);
    /// without it the server sends the plain election section.
    public static func intelligence(
        homeId: String,
        sections: [PlaceSectionID]? = nil
    ) -> Endpoint {
        var query: [String: String] = ["ballot": "1"]
        if let sections, !sections.isEmpty {
            query["sections"] = sections.map(\.rawValue).joined(separator: ",")
        }
        return Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/intelligence",
            query: query
        )
    }

    /// `GET /api/public/place?address=` — route
    /// `backend/routes/public.js:704`. The address-only T0 preview — no
    /// account required, non-persistent (no DB writes). Returns the free
    /// Band-A subset live (flood, density bucket, area teaser) with
    /// everything recurring or exact as a locked descriptor.
    ///
    /// Five lookups a day (`placeLookupLimiter`): per account when signed
    /// in (the token rides along when there is one), else per network. A
    /// 429 carries the sentence to show.
    public static func publicPreview(address: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/public/place",
            query: ["address": address]
        )
    }
}
