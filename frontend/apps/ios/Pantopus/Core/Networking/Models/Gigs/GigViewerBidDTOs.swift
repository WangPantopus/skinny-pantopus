//
//  GigViewerBidDTOs.swift
//  Pantopus
//
//  Envelope for `GET /api/gigs/:id/my-bid`. The row itself decodes into the
//  existing `BidDTO` (Models/Offers/OffersDTOs.swift) — the same shape My
//  Bids already renders — so the gig detail and My Bids agree field-for-
//  field on status / counter state.
//

import Foundation

/// Envelope from `GET /api/gigs/:id/my-bid`
/// (`backend/routes/gigs.js:7905`). `bid` is `null` when the signed-in
/// viewer has not bid on this gig.
public struct GigMyBidResponse: Decodable, Sendable {
    public let bid: BidDTO?

    public init(bid: BidDTO?) {
        self.bid = bid
    }
}

/// Statuses in which the viewer's bid is still live on the gig. Anything
/// else (`withdrawn`, `rejected`, `expired`) leaves the detail screen on
/// its normal "Place bid" path so the viewer can bid again.
public enum ViewerBidStatus {
    public static let active: Set<String> = ["pending", "countered", "accepted"]

    /// Statuses the backend still lets the bidder edit or withdraw
    /// (`PUT`/`DELETE .../bids/:bidId`, gigs.js:4166 + gigs.js:5440).
    public static let mutable: Set<String> = ["pending", "countered"]
}
