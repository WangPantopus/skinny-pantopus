//
//  GigsV2Endpoints.swift
//  Pantopus
//
//  The two Gigs "v2" routes the RN app calls that nothing native did:
//
//  * `POST /api/gigs/:gigId/share-status` — mint a 24-hour public status
//    link for a live task (poster or assigned helper only).
//  * `GET  /api/v2/gigs/:gigId/offers`    — scored + ranked offers with
//    trust capsules, used by owners of `curated_offers` / `quotes` gigs.
//
//  They live in their own file (rather than in the heavily-shared
//  `GigsEndpoints`) because they are mounted from two different routers.
//

import Foundation

public enum GigsV2Endpoints {
    /// `POST /api/gigs/:gigId/share-status` — mints a random 16-byte token
    /// on the gig, stamps `status_share_expires_at` 24h out, and returns
    /// `{ share_url, expires_at }`. The caller must be the poster
    /// (`user_id`) or the assigned helper (`accepted_by`), otherwise 403.
    ///
    /// Route `backend/routes/gigsV2.js:244`
    /// (router mounted at `/api/gigs`, `backend/app.js:310`).
    public static func shareStatus(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/share-status")
    }

    /// `GET /api/v2/gigs/:gigId/offers` — owner-only ranked offers. The
    /// handler expires stale pending bids, enriches each with the
    /// bidder's trust signals, runs `scoreOffers`, and returns
    /// `{ gig, offers: [{ …bid, match_score, match_rank, is_recommended,
    /// trust_capsule }] }`. Non-owners get 403; callers fall back to
    /// `GET /api/gigs/:gigId/bids` on any failure (mirrors RN
    /// `gig-v2/[id].tsx:108`).
    ///
    /// Route `backend/routes/offersV2.js:47`
    /// (router mounted at `/api/v2`, `backend/app.js:311`).
    public static func scoredOffers(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/v2/gigs/\(gigId)/offers")
    }
}
