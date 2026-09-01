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
}
