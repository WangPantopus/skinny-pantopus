//
//  OffersEndpoints.swift
//  Pantopus
//
//  T5.2.4 Cross-listing Offers endpoints. The screen splits offers into
//  two buckets — bids on gigs I posted (Received) and bids I placed
//  (Sent) — and these two backend routes are the canonical sources for
//  each tab.
//

import Foundation

public enum OffersEndpoints {
    /// `GET /api/gigs/my-bids` — bids the current user placed on other
    /// people's gigs. Route `backend/routes/gigs.js:1253`.
    public static func myBids(limit: Int = 100) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs/my-bids",
            query: ["limit": String(limit)]
        )
    }

    /// `GET /api/gigs/received-offers` — bids other people placed on
    /// gigs the current user posted (or manages on behalf of a
    /// business). Route `backend/routes/gigs.js:1469`.
    public static func receivedOffers(limit: Int = 100) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/gigs/received-offers",
            query: ["limit": String(limit)]
        )
    }
}
