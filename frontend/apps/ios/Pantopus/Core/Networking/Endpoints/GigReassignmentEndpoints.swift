//
//  GigReassignmentEndpoints.swift
//  Pantopus
//
//  The two "this assignment isn't going to happen" exits an assigned gig
//  has before work starts: the poster swaps the worker out
//  (`/reopen-bidding`) and the worker releases themselves
//  (`/worker-release`). Both unassign, cancel any pre-capture payment
//  hold, and put the gig back to `open` for new bids — they are not
//  cancellations and carry no cancellation fee.
//

import Foundation

/// Endpoints for releasing an assigned gig back to bidding.
public enum GigReassignmentEndpoints {
    /// `POST /api/gigs/:gigId/reopen-bidding` — the **poster** unassigns
    /// the current worker and reopens the task for bids. Preconditions
    /// (`backend/routes/gigs.js:4874`): caller holds `gigs.manage` on the
    /// gig owner, `status == "assigned"`, `started_at` is null, and any
    /// linked payment is still pre-capture (the authorization is cancelled
    /// server-side). Response `{gig, reopened_count, accepted_bid_restored?, message}`.
    public static func reopenBidding(gigId: String) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/reopen-bidding", body: ReopenBiddingBody())
    }

    /// `POST /api/gigs/:gigId/worker-release` — the **assigned worker**
    /// releases themselves ("Can't make it"). Preconditions
    /// (`backend/routes/gigs.js:5954`): caller is `accepted_by`,
    /// `status == "assigned"`, `started_at` is null. Releases the payment
    /// hold, rejects the accepted bid, reopens the gig, and notifies the
    /// poster. Body `{note?}` (≤1000 chars, server-truncated).
    /// Response `{success, message}`.
    public static func workerRelease(gigId: String, note: String? = nil) -> Endpoint {
        Endpoint(method: .post, path: "/api/gigs/\(gigId)/worker-release", body: WorkerReleaseBody(note: note))
    }
}

/// Body for `POST /api/gigs/:gigId/reopen-bidding`. The route reads an
/// optional `rollbackMode`, which only the payment-abort path sets — the
/// poster-initiated "Replace worker" flow sends the default (worker is
/// unassigned and their bid is rejected), so the field stays `nil`.
public struct ReopenBiddingBody: Encodable, Sendable {
    public let rollbackMode: String?

    public init(rollbackMode: String? = nil) {
        self.rollbackMode = rollbackMode
    }

    enum CodingKeys: String, CodingKey {
        case rollbackMode
    }
}

/// Body for `POST /api/gigs/:gigId/worker-release`.
public struct WorkerReleaseBody: Encodable, Sendable {
    public let note: String?

    public init(note: String? = nil) {
        self.note = note
    }

    enum CodingKeys: String, CodingKey {
        case note
    }
}
