//
//  HolidayCardMediaDTOs.swift
//  Pantopus
//
//  A card's own photo and voice greeting (memories plan steps 4 and 7, launch key `holiday_card_memories`; contract
//  `docs/product/christmas-card-memories-contract-2026-11-02.md`, server `backend/services/cardMedia.js`): what the
//  server says can be added, what an upload answers, and the photo and voice a card carries once it's open. The bytes
//  only ever come through the card's own reader-checked routes (`HolidayCardEndpoints.media…`), never a storage link.
//

import Foundation

/// `media` on `GET /api/mailbox/cards`: which of a card's own photo and voice can be added now, and their limits.
/// `usable` is false while the server's key is off (and voice until its server part is in).
public struct HolidayCardMediaSpec: Decodable, Sendable, Hashable {
    public struct Photo: Decodable, Sendable, Hashable {
        public let usable: Bool
        /// The most bytes a photo can be as it comes (10 MiB).
        public let maxBytes: Int
        /// The stored photo's long side (1600).
        public let longSide: Int

        private enum CodingKeys: String, CodingKey {
            case usable
            case maxBytes = "max_bytes"
            case longSide = "long_side"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            usable = (try? c.decodeIfPresent(Bool.self, forKey: .usable)) ?? false
            maxBytes = (try? c.decodeIfPresent(Int.self, forKey: .maxBytes)) ?? 10_485_760
            longSide = (try? c.decodeIfPresent(Int.self, forKey: .longSide)) ?? 1600
        }
    }

    public struct Voice: Decodable, Sendable, Hashable {
        public let usable: Bool
        public let maxSeconds: Int
        public let maxBytes: Int

        private enum CodingKeys: String, CodingKey {
            case usable
            case maxSeconds = "max_seconds"
            case maxBytes = "max_bytes"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            usable = (try? c.decodeIfPresent(Bool.self, forKey: .usable)) ?? false
            maxSeconds = (try? c.decodeIfPresent(Int.self, forKey: .maxSeconds)) ?? 60
            maxBytes = (try? c.decodeIfPresent(Int.self, forKey: .maxBytes)) ?? 5_242_880
        }
    }

    public let photo: Photo?
    public let voice: Voice?

    private enum CodingKeys: String, CodingKey {
        case photo, voice
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        photo = try? c.decodeIfPresent(Photo.self, forKey: .photo)
        voice = try? c.decodeIfPresent(Voice.self, forKey: .voice)
    }
}

/// `POST /api/mailbox/cards/media` → 201: the stored photo (upright, at most 1600 px, a JPEG with no metadata) or voice
/// greeting, as a send names it, sendable by its uploader until `expiresAt` (72 hours).
public struct HolidayCardMediaUpload: Decodable, Sendable, Hashable {
    public struct Media: Decodable, Sendable, Hashable {
        public let fileId: String
        public let kind: String
        public let width: Int?
        public let height: Int?
        /// A voice greeting's length, read by the server from the file: the one to show.
        public let durationMs: Int?

        private enum CodingKeys: String, CodingKey {
            case kind, width, height
            case fileId = "file_id"
            case durationMs = "duration_ms"
        }
    }

    public let media: Media
    public let expiresAt: String?

    private enum CodingKeys: String, CodingKey {
        case media
        case expiresAt = "expires_at"
    }
}

/// `card.photo` on an opened card, Look it over and Sent's detail; nil while sealed and on lists.
public struct CardPhoto: Codable, Sendable, Hashable {
    public let fileId: String
    public let width: Int?
    public let height: Int?
    /// The sender's description, read by screen readers.
    public let alt: String?
    /// A photo from someone who isn't the reader's connection: drawn covered, its bytes loaded only after a tap. Look
    /// it over and Sent are never covered.
    public let covered: Bool

    private enum CodingKeys: String, CodingKey {
        case width, height, alt, covered
        case fileId = "file_id"
    }

    public init(fileId: String, width: Int?, height: Int?, alt: String?, covered: Bool = false) {
        self.fileId = fileId
        self.width = width
        self.height = height
        self.alt = alt
        self.covered = covered
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fileId = try c.decode(String.self, forKey: .fileId)
        width = try? c.decodeIfPresent(Int.self, forKey: .width)
        height = try? c.decodeIfPresent(Int.self, forKey: .height)
        alt = (try? c.decodeIfPresent(String.self, forKey: .alt)).flatMap { $0.isEmpty ? nil : $0 }
        covered = (try? c.decodeIfPresent(Bool.self, forKey: .covered)) ?? false
    }

    /// The photo's shape (width over height), 4:3 when the server didn't say.
    var aspect: CGFloat {
        guard let width, let height, width > 0, height > 0 else { return 4 / 3 }
        return CGFloat(width) / CGFloat(height)
    }
}

/// `card.voice` on an opened card, Look it over and Sent's detail; nil while sealed and on lists.
public struct CardVoice: Codable, Sendable, Hashable {
    public let fileId: String
    public let durationMs: Int?

    private enum CodingKeys: String, CodingKey {
        case fileId = "file_id"
        case durationMs = "duration_ms"
    }

    public init(fileId: String, durationMs: Int?) {
        self.fileId = fileId
        self.durationMs = durationMs
    }
}

/// Where a card's photo or voice bytes come from: the uploader's own route (Write on the back, Look it over), the
/// sender's Sent, or the recipient's piece.
public enum CardMediaSource: Hashable, Sendable {
    case own(fileId: String)
    case sent(cardId: String, fileId: String)
    case piece(mailId: String, fileId: String)

    var fileId: String {
        switch self {
        case let .own(fileId), let .sent(_, fileId), let .piece(_, fileId): fileId
        }
    }
}

/// What a send carries of the card's own media: the uploaded photo (with its description) and voice greeting.
public struct HolidayCardMediaPick: Sendable, Hashable {
    public var photo: String?
    public var photoAlt: String?
    public var voice: String?

    public init(photo: String? = nil, photoAlt: String? = nil, voice: String? = nil) {
        self.photo = photo
        self.photoAlt = photoAlt
        self.voice = voice
    }

    public static let none = HolidayCardMediaPick()

    var isEmpty: Bool {
        photo == nil && voice == nil
    }
}
