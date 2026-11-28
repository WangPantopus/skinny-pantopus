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
        /// The stored photo's long side (2400; 1600 until November 16).
        public let longSide: Int
        /// A Live Photo's moving part can ride the photo (contract section 13); nil from a server before it.
        public let live: Live?

        /// The limits of a Live Photo's moving part: 15 MiB and 10 seconds.
        public struct Live: Decodable, Sendable, Hashable {
            public let usable: Bool
            public let maxBytes: Int
            public let maxSeconds: Int

            private enum CodingKeys: String, CodingKey {
                case usable
                case maxBytes = "max_bytes"
                case maxSeconds = "max_seconds"
            }

            public init(from decoder: any Decoder) throws {
                let c = try decoder.container(keyedBy: CodingKeys.self)
                usable = (try? c.decodeIfPresent(Bool.self, forKey: .usable)) ?? false
                maxBytes = (try? c.decodeIfPresent(Int.self, forKey: .maxBytes)) ?? 15_728_640
                maxSeconds = (try? c.decodeIfPresent(Int.self, forKey: .maxSeconds)) ?? 10
            }
        }

        private enum CodingKeys: String, CodingKey {
            case usable, live
            case maxBytes = "max_bytes"
            case longSide = "long_side"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            usable = (try? c.decodeIfPresent(Bool.self, forKey: .usable)) ?? false
            maxBytes = (try? c.decodeIfPresent(Int.self, forKey: .maxBytes)) ?? 10_485_760
            longSide = (try? c.decodeIfPresent(Int.self, forKey: .longSide)) ?? 1600
            live = try? c.decodeIfPresent(Live.self, forKey: .live)
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

    /// A photo or voice greeting goes only on a card sent with a bought stamp (founder, 2026-11-11): what the person
    /// can do about it now. Present only while `photo.usable`; nil from older servers (photo and voice as before).
    public struct BoughtStamp: Decodable, Sendable, Hashable {
        public enum State: String, Sendable {
            /// A bought stamp is left: photo and voice as usual; the card spends one.
            case ready
            /// None left, and books are on sale for this person: both buttons stay, say why, and open the stamp books.
            case buy
            /// None left and none can be bought (stamp books off for this person, the free daily card, sales over).
            case unavailable
        }

        public let state: State
        /// Bought stamps left now; nil when the balance couldn't be read just now.
        public let remaining: Int?

        private enum CodingKeys: String, CodingKey {
            case state, remaining
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            let raw = try c.decode(String.self, forKey: .state)
            guard let state = State(rawValue: raw) else {
                throw DecodingError.dataCorruptedError(forKey: .state, in: c, debugDescription: "Unknown state \(raw)")
            }
            self.state = state
            remaining = try? c.decodeIfPresent(Int.self, forKey: .remaining)
        }
    }

    /// The free photo or voice cards a person has (cards-next Wave 2, only while `improved`): the first `limit` cards
    /// with a photo or greeting need no bought stamp, and `bought_stamp` is left out while `remaining` is above 0. Nil
    /// with the switch off and from older servers.
    public struct FreeAllowance: Decodable, Sendable, Hashable {
        public let limit: Int
        public let remaining: Int
    }

    public let photo: Photo?
    public let voice: Voice?
    public let freeAllowance: FreeAllowance?
    public let boughtStamp: BoughtStamp?

    private enum CodingKeys: String, CodingKey {
        case photo, voice
        case freeAllowance = "free_allowance"
        case boughtStamp = "bought_stamp"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        photo = try? c.decodeIfPresent(Photo.self, forKey: .photo)
        voice = try? c.decodeIfPresent(Voice.self, forKey: .voice)
        freeAllowance = try? c.decodeIfPresent(FreeAllowance.self, forKey: .freeAllowance)
        boughtStamp = try? c.decodeIfPresent(BoughtStamp.self, forKey: .boughtStamp)
    }
}

/// `POST /api/mailbox/cards/media` → 201: the stored photo (upright, at most 2400 px, a JPEG with no metadata) or voice
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
    /// The photo is a Live Photo: its few seconds of video (contract section 13), read from the same routes as the
    /// photo and covered whenever it is. Nil for a still.
    public let live: CardLive?

    private enum CodingKeys: String, CodingKey {
        case width, height, alt, covered, live
        case fileId = "file_id"
    }

    public init(fileId: String, width: Int?, height: Int?, alt: String?, covered: Bool = false, live: CardLive? = nil) {
        self.fileId = fileId
        self.width = width
        self.height = height
        self.alt = alt
        self.covered = covered
        self.live = live
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fileId = try c.decode(String.self, forKey: .fileId)
        width = try? c.decodeIfPresent(Int.self, forKey: .width)
        height = try? c.decodeIfPresent(Int.self, forKey: .height)
        alt = (try? c.decodeIfPresent(String.self, forKey: .alt)).flatMap { $0.isEmpty ? nil : $0 }
        covered = (try? c.decodeIfPresent(Bool.self, forKey: .covered)) ?? false
        live = try? c.decodeIfPresent(CardLive.self, forKey: .live)
    }

    /// The photo's shape (width over height), 4:3 when the server didn't say.
    var aspect: CGFloat {
        guard let width, let height, width > 0, height > 0 else { return 4 / 3 }
        return CGFloat(width) / CGFloat(height)
    }
}

/// `card.photo.live`: a Live Photo's moving part, an MP4 or QuickTime clip of at most 10 seconds.
public struct CardLive: Codable, Sendable, Hashable {
    public let fileId: String
    public let mimeType: String?
    public let durationMs: Int?

    private enum CodingKeys: String, CodingKey {
        case fileId = "file_id"
        case mimeType = "mime_type"
        case durationMs = "duration_ms"
    }

    public init(fileId: String, mimeType: String? = nil, durationMs: Int? = nil) {
        self.fileId = fileId
        self.mimeType = mimeType
        self.durationMs = durationMs
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
    /// The photo's moving part when it goes as a Live Photo (a file id of kind `live`).
    public var photoLive: String?

    public init(photo: String? = nil, photoAlt: String? = nil, voice: String? = nil, photoLive: String? = nil) {
        self.photo = photo
        self.photoAlt = photoAlt
        self.voice = voice
        self.photoLive = photoLive
    }

    public static let none = HolidayCardMediaPick()

    var isEmpty: Bool {
        photo == nil && voice == nil
    }
}
