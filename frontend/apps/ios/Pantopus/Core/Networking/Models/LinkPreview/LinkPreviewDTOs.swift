//
//  LinkPreviewDTOs.swift
//  Pantopus
//
//  DTOs for `/api/link-preview`. Route: `backend/routes/linkPreview.js`.
//

import Foundation

/// `GET /api/link-preview` — a page's preview text. There is no image: one
/// the poster's link chose would show its host every viewer's IP address.
public struct LinkPreviewDTO: Decodable, Sendable, Hashable {
    public let title: String?
    public let description: String?
    public let siteName: String?
    public let url: String?
}
