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

/// Body for `POST /api/ai/draft/pickup-schedule` (`backend/routes/ai.js:249`):
/// photos of a hauler's flyer, as the person's own `/api/upload/ai-media`
/// URLs (1–3), or what they wrote.
public struct AIDraftPickupScheduleRequest: Encodable, Sendable {
    public let images: [String]?
    public let text: String?

    public init(images: [String]? = nil, text: String? = nil) {
        self.images = images
        self.text = text
    }
}

/// The pickup days read from a flyer, for the pickup editor to fill in. A nil
/// field keeps the editor's own value; nothing is saved until the person taps
/// the editor's Save.
public struct AIDraftPickupScheduleResponse: Decodable, Sendable, Hashable {
    public struct Schedule: Decodable, Sendable, Hashable {
        /// `MO`…`SU`.
        public let garbageWeekday: String?
        /// `weekly`, `biweekly`, or `not_set` (the flyer says there is no recycling).
        public let recyclingFrequency: String?
        /// `YYYY-MM-DD`, already inside the window the save route accepts.
        public let recyclingNextDate: String?
        /// "Garbage every Tuesday. Recycling every other Tuesday, next on Tuesday, October 20."
        public let summary: String?

        private enum CodingKeys: String, CodingKey {
            case summary
            case garbageWeekday = "garbage_weekday"
            case recyclingFrequency = "recycling_frequency"
            case recyclingNextDate = "recycling_next_date"
        }
    }

    public let schedule: Schedule
    /// One sentence about what the flyer shows that the editor doesn't keep (yard waste, holidays).
    public let note: String?
}

/// `POST /api/ai/draft/radon-result`: a radon test result read from a photo or
/// PDF of the lab's report, for the Today radon sheet to fill in. The report
/// isn't kept, and nothing is saved until the person taps the sheet's Save.
public struct AIRadonReportResponse: Decodable, Sendable, Hashable {
    public struct Result: Decodable, Sendable, Hashable {
        /// The result in pCi/L (converted when the report gave Bq/m³).
        public let valuePci: Double?
        /// The report gave the result as below this limit ("<0.4").
        public let belowLimit: Bool?
        /// `YYYY-MM-DD`: the day the test ended.
        public let testedOn: String?
        /// `short_term`, `long_term`, or nil when the report doesn't say.
        public let testKind: String?
        /// "Short-term test, October 1 to October 3, 2026: 5.2 pCi/L. From …"
        public let summary: String?

        private enum CodingKeys: String, CodingKey {
            case summary
            case valuePci = "value_pci"
            case belowLimit = "below_limit"
            case testedOn = "tested_on"
            case testKind = "test_kind"
        }
    }

    public let result: Result
    /// One sentence on how the report was read (which of several results, a missing date).
    public let note: String?
}
