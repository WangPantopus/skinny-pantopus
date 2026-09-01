//
//  GigViewerBidEndpoints.swift
//  Pantopus
//
//  The *bidder's own* view of a bid on a gig detail screen. The poster-side
//  bid routes (list / accept / counter / reject) already live in
//  `GigsEndpoints`; this file adds the one route the viewer-bid state needs
//  that nothing else called — "does the signed-in viewer already have a bid
//  on this gig?".
//
//  Update / withdraw / counter-accept / counter-decline deliberately reuse
//  the existing `GigsEndpoints` helpers rather than duplicating them:
//  `updateBid`, `withdrawBid`, `acceptCounter`, `declineCounter`.
//

import Foundation

public enum GigViewerBidEndpoints {
    /// `GET /api/gigs/:id/my-bid` — the signed-in viewer's own bid on this
    /// gig, or `{ "bid": null }` when they have not bid.
    /// Route `backend/routes/gigs.js:7882`.
    ///
    /// The handler selects a narrow column set (`id, gig_id, user_id,
    /// bid_amount, message, proposed_time, status, created_at,
    /// updated_at`) and normalises `assigned → accepted`. It notably does
    /// **not** return the counter columns, so a `countered` bid is
    /// enriched from `GET /api/gigs/my-bids` (`gigs.js:1452`), which does.
    public static func myBid(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/my-bid")
    }
}
