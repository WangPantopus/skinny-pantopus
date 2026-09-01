//
//  AIDTOs.swift
//  Pantopus
//
//  DTOs for `GET /api/ai/conversations` (`backend/routes/ai.js:358`).
//  The serializer selects `id, title, message_count, last_message_at,
//  created_at, updated_at` from `AIConversation`
//  (`backend/services/ai/agentService.js:1003`).
//

import Foundation

/// One Ask-Pantopus conversation summary. There is no messages payload —
/// the backend keeps no per-message rows for AI threads.
public struct AIConversationSummaryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String?
    public let messageCount: Int?
    public let lastMessageAt: String?
    public let createdAt: String?
    public let updatedAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, title
        case messageCount = "message_count"
        case lastMessageAt = "last_message_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// `GET /api/ai/conversations` envelope — ordered newest-updated first.
public struct AIConversationsResponse: Decodable, Sendable, Hashable {
    public let conversations: [AIConversationSummaryDTO]
}

/// Envelope from `POST /api/ai/transcribe` (`backend/routes/ai.js:387`)
/// — Whisper transcription of a recorded describe-step voice note.
public struct AITranscriptionResponse: Decodable, Sendable, Hashable {
    public let text: String
    public let durationSeconds: Double?

    private enum CodingKeys: String, CodingKey {
        case text
        case durationSeconds = "duration_seconds"
    }
}

/// Body for `POST /api/ai/draft/listing-vision` (Snap & Sell). Images
/// are base64 data URLs or hosted URLs; the route caps the array at 5
/// (`backend/routes/ai.js:74`).
public struct AIDraftListingVisionRequest: Encodable, Sendable {
    public let images: [String]
    public let text: String?
    public let latitude: Double?
    public let longitude: Double?

    public init(images: [String], text: String? = nil, latitude: Double? = nil, longitude: Double? = nil) {
        self.images = images
        self.text = text
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// One AI-drafted listing. Mirrors `listingDraftJsonSchema`
/// (`backend/services/ai/schemas.js:210`) — the model emits camelCase
/// keys natively, so no CodingKeys mapping is needed.
public struct AIListingDraftDTO: Decodable, Sendable, Hashable {
    public let title: String?
    public let description: String?
    public let price: Double?
    public let isFree: Bool?
    /// AI product-category enum (`electronics`, `furniture`, `sports`,
    /// …) — note this is the *draft* enum, not the backend listing
    /// category enum; map before submitting.
    public let category: String?
    public let condition: String?
    public let tags: [String]?
    public let listingType: String?
    public let deliveryAvailable: Bool?
    public let meetupPreference: String?
}

/// Comp-range price suggestion attached to a vision draft
/// (`backend/services/marketplace/priceIntelligenceService.js:42`).
public struct AIPriceSuggestionDTO: Decodable, Sendable, Hashable {
    public let low: Double
    public let median: Double
    public let high: Double
    public let basis: String?
    public let comparableCount: Int?

    private enum CodingKeys: String, CodingKey {
        case low, median, high, basis
        case comparableCount = "comparable_count"
    }
}

/// Envelope from `POST /api/ai/draft/listing-vision`
/// (`backend/routes/ai.js:199`).
public struct AIListingVisionResponse: Decodable, Sendable {
    public let draft: AIListingDraftDTO
    public let confidence: Double?
    public let priceSuggestion: AIPriceSuggestionDTO?
}

/// Body for `POST /api/ai/draft/post`. `text` is the free-text prompt
/// (Joi `draftPostSchema` caps it at 2000 chars,
/// `backend/routes/ai.js:81`); `surface` is `"place"` or `"connections"`
/// when set and is omitted for prompts that aren't feed-bound.
public struct AIDraftPostRequest: Encodable, Sendable {
    public let text: String
    public let surface: String?

    public init(text: String, surface: String? = nil) {
        self.text = text
        self.surface = surface
    }
}

/// One AI-drafted post. Mirrors `postDraftJsonSchema`
/// (`backend/services/ai/schemas.js:99`) — `content` is the only key the
/// schema marks required; the model emits camelCase natively.
public struct AIPostDraftDTO: Decodable, Sendable, Hashable {
    public let content: String
    public let title: String?
    public let postType: String?
    public let purpose: String?
    public let visibility: String?
    public let tags: [String]?
}

/// Envelope from `POST /api/ai/draft/post` (`backend/routes/ai.js:218`).
public struct AIPostDraftResponse: Decodable, Sendable, Hashable {
    public let draft: AIPostDraftDTO
}
