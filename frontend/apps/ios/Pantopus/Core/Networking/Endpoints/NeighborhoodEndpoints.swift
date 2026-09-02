//
//  NeighborhoodEndpoints.swift
//  Pantopus
//

import Foundation

/// Endpoint builders for `backend/routes/neighborhood.js` — the
/// density-gated Neighborhood door (wedge Phase 1).
public enum NeighborhoodEndpoints {
    /// `GET /api/neighborhood/meter` — route
    /// `backend/routes/neighborhood.js:97`. Verified-neighbor count around
    /// the viewer's primary home vs the unlock threshold.
    public static func meter() -> Endpoint {
        Endpoint(method: .get, path: "/api/neighborhood/meter")
    }

    /// `GET /api/neighborhood/cells` — the Nearby window (Wedge v2 §4):
    /// the 5×5 grid of block cells around the viewer's place, each with
    /// ONLY its floored density bucket. Route `backend/routes/neighborhood.js`.
    public static func cells() -> Endpoint {
        Endpoint(method: .get, path: "/api/neighborhood/cells")
    }
}
