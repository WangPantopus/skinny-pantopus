//
//  PostMediaUploadResponse.swift
//  Pantopus
//
//  `POST /api/upload/post-media/:postId` response envelope.
//

import Foundation

/// Acknowledgement returned after attaching images/videos to a post.
public struct PostMediaUploadResponse: Decodable, Sendable, Hashable {
    public let message: String
    public let mediaURLs: [String]
    public let mediaTypes: [String]
    public let mediaThumbnails: [String]
    public let mediaLiveURLs: [String]

    private enum CodingKeys: String, CodingKey {
        case message
        case mediaURLs = "media_urls"
        case mediaTypes = "media_types"
        case mediaThumbnails = "media_thumbnails"
        case mediaLiveURLs = "media_live_urls"
    }
}
