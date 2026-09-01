//
//  GigReassignmentDTOs.swift
//  Pantopus
//
//  Responses for the two pre-start release routes
//  (`/reopen-bidding`, `/worker-release`) in `backend/routes/gigs.js`.
//

import Foundation

/// Response from `POST /api/gigs/:gigId/reopen-bidding`
/// (`backend/routes/gigs.js:5016`). The full refreshed gig also rides the
/// envelope, but the detail screen refetches instead of trusting it, so
/// only the confirmation copy is decoded.
public struct ReopenBiddingResponse: Decodable, Sendable, Hashable {
    public let reopenedCount: Int?
    public let acceptedBidRestored: Bool?
    public let message: String?

    enum CodingKeys: String, CodingKey {
        case message
        case reopenedCount = "reopened_count"
        case acceptedBidRestored = "accepted_bid_restored"
    }
}

/// Response from `POST /api/gigs/:gigId/worker-release`
/// (`backend/routes/gigs.js:6083`).
public struct WorkerReleaseResponse: Decodable, Sendable, Hashable {
    public let success: Bool?
    public let message: String?

    enum CodingKeys: String, CodingKey {
        case success, message
    }
}
