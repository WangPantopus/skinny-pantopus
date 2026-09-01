//
//  HubExtrasEndpoints.swift
//  Pantopus
//
//  Hub routes that sit outside the three bootstrap calls in
//  `HubEndpoints`. Kept in its own file so parallel work on the hub
//  bundle doesn't collide.
//

import Foundation

/// Secondary `/api/hub/*` routes.
public enum HubExtrasEndpoints {
    /// `POST /api/hub/dismiss-density-milestone` — marks the neighbor
    /// density milestone banner as seen for this home so the next
    /// `GET /api/hub` stops returning `neighborDensity.milestone`.
    /// Body is `{ homeId, milestone }` (milestone must be numeric).
    /// Route `backend/routes/hub.js:1024`.
    public static func dismissDensityMilestone(homeId: String, milestone: Int) -> Endpoint {
        Endpoint(
            method: .post,
            path: "/api/hub/dismiss-density-milestone",
            body: DismissDensityMilestoneRequest(homeId: homeId, milestone: milestone)
        )
    }
}

/// Body for `POST /api/hub/dismiss-density-milestone`
/// (`backend/routes/hub.js:1026`).
public struct DismissDensityMilestoneRequest: Encodable, Sendable, Hashable {
    public let homeId: String
    public let milestone: Int

    public init(homeId: String, milestone: Int) {
        self.homeId = homeId
        self.milestone = milestone
    }
}

/// `{ ok: true }` ack from `POST /api/hub/dismiss-density-milestone`
/// (`backend/routes/hub.js:1045`).
public struct DismissDensityMilestoneResponse: Decodable, Sendable, Hashable {
    public let ok: Bool?

    public init(ok: Bool? = nil) {
        self.ok = ok
    }
}
