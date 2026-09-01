//
//  ListingMediaUploadResponse.swift
//  Pantopus
//
//  `POST /api/upload/listing-media/:listingId` response envelope
//  (`backend/routes/upload.js:1049`).
//

import Foundation

/// Acknowledgement returned after attaching images to a listing.
public struct ListingMediaUploadResponse: Decodable, Sendable, Hashable {
    public let message: String?
    public let mediaURLs: [String]
    public let mediaTypes: [String]?

    private enum CodingKeys: String, CodingKey {
        case message
        case mediaURLs = "media_urls"
        case mediaTypes = "media_types"
    }
}
