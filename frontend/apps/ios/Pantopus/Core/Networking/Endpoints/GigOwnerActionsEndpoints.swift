//
//  GigOwnerActionsEndpoints.swift
//  Pantopus
//
//  Routes the RN gig detail exercises that had no native call site:
//  the poster withdrawing their own pending counter-offer, the poster
//  closing (deleting) a still-open task, and the urgent-task live
//  fulfillment stepper (read + advance).
//
//  Kept out of `GigsEndpoints` on purpose — that file is heavily shared
//  and this package touches four unrelated routes.
//

import Foundation

/// Endpoints for the poster's own lifecycle actions on `/api/gigs/*`.
public enum GigOwnerActionsEndpoints {
    /// `POST /api/gigs/:gigId/bids/:bidId/counter/withdraw` — the poster
    /// withdraws the pending counter-offer they sent. The backend nulls
    /// `counter_*` and flips the bid back to `pending`, notifies the
    /// bidder (`counter_withdrawn`), and emits a `gig:bid-update` room
    /// event. Returns `{ bid }`.
    /// Route `backend/routes/gigs.js:5342`.
    public static func withdrawCounter(gigId: String, bidId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/bids/\(bidId)/counter/withdraw")
    }

    /// `DELETE /api/gigs/:id` — the poster closes a still-open task; the
    /// row is deleted outright. The backend 403s non-owners and 400s any
    /// status other than `open` ("Can only delete open gigs"). Returns
    /// `{ message }`.
    /// Route `backend/routes/gigs.js:3730`.
    public static func deleteGig(id: String) -> Endpoint {
        Endpoint(method: .delete, path: "/api/gigs/\(id)")
    }

    /// `GET /api/gigs/:gigId/active-status` — current fulfillment status,
    /// helper ETA and (when the poster opted into sharing) the helper's
    /// last location for an **urgent / starts-asap** task. Poster or
    /// assigned worker only; 400s on non-urgent gigs.
    /// Route `backend/routes/gigs.js:8810`.
    public static func activeStatus(gigId: String) -> Endpoint {
        Endpoint(method: .get, path: "/api/gigs/\(gigId)/active-status")
    }

    /// `POST /api/gigs/:gigId/status` — advance the urgent-task
    /// fulfillment status. The worker may set `on_the_way` / `arrived` /
    /// `picked_up` / `dropped_off`; either party may set `in_progress`.
    /// Returns `{ gig, fulfillment_status }` and emits
    /// `gig_status_update` into the `gig:<id>` room.
    /// Route `backend/routes/gigs.js:8689`.
    public static func updateFulfillmentStatus(
        gigId: String,
        body: GigFulfillmentStatusBody
    ) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/status", body: body)
    }
}
