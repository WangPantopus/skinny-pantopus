//
//  HolidayCardDTOs.swift
//  Pantopus
//
//  Christmas cards (launch keys `holiday_cards` + `mailbox`; server
//  `backend/services/holidayCards.js`): the season's pictures, today's card,
//  sending one and taking it back, and the card a piece of mail carries.
//

// swiftlint:disable file_length

import Foundation

/// When a card comes: with the next morning's mail, the next morning sealed
/// until Christmas, on Christmas morning, or (by email) right away.
public enum HolidayCardArrival: String, Sendable, Hashable, CaseIterable {
    case nextMorning = "next_morning"
    case sealedChristmas = "sealed_christmas"
    case christmasMorning = "christmas_morning"
    case now
}

/// The digital stamps left, with `GET /api/mailbox/cards` while postage is on.
public struct HolidayCardStamps: Decodable, Sendable, Hashable {
    public let available: Int
    public let freeRemaining: Int
    public let paidRemaining: Int

    private enum CodingKeys: String, CodingKey {
        case available
        case freeRemaining = "free_remaining"
        case paidRemaining = "paid_remaining"
    }
}

/// `GET /api/mailbox/cards` — route `backend/routes/mailbox.js:1776`: whether
/// sending is open, the pictures and their collections, the arrivals open
/// now and today's card.
public struct HolidayCardsResponse: Decodable, Sendable, Hashable {
    public let postageEnabled: Bool
    /// Digital stamps left (postage on; nil when they couldn't be read).
    public let stamps: HolidayCardStamps?
    public let open: Bool
    public let holiday: String
    public let year: Int
    /// The last day cards can be sent (`YYYY-MM-DD`).
    public let closesOn: String?
    /// The most letters a note can have.
    public let messageLimit: Int
    /// Every picture, in number order.
    public let designs: [HolidayCardDesign]
    /// The pictures' collections in the order Pick a card shows them;
    /// empty from a server without collections (one grid of every picture).
    public let collections: [HolidayCardCollection]
    /// The arrivals open now for a person found by name, and by email.
    public let personArrivals: [HolidayCardArrival]
    public let emailArrivals: [HolidayCardArrival]
    /// Every arrival open now for a card to an email address (and a list of only addresses): the three a person
    /// has, its email going at the sender's 7 a.m. or on Christmas morning, and right away (`arrivals.email_all`).
    /// Nil from older servers: `emailArrivals` as before. A card by link keeps `emailArrivals`.
    public let emailAllArrivals: [HolidayCardArrival]?
    /// The next 7 a.m. round where the sender lives: the carrier's pickup.
    public let nextRoundAt: String?
    /// 7 a.m. on Christmas morning where the sender lives.
    public let christmasMorningAt: String?
    public let timeZone: String?
    /// The card sent today, if any (one a day).
    public let today: SentHolidayCard?
    /// How many one card can go to at once: 20 with digital stamps on (a
    /// list, `POST /api/mailbox/cards/batch`), else 1.
    public let maxRecipients: Int
    /// The server keeps a signature beside FROM (`card_table`, plan 8.2): its box and the most bytes it takes. Nil
    /// from older servers and with the key off: no signing, the typed first name as before.
    public let signature: HolidayCardSignatureSpec?
    /// Which of a card's own photo and voice can be added now (launch key `holiday_card_memories`); nil from older
    /// servers.
    public let media: HolidayCardMediaSpec?
    /// "Help me write it" can be used now (the server's launch key `card_note_help`); false from older servers and
    /// with the key off: no button.
    public let noteHelp: Bool
    /// The travelling card (server switch `card_travel`, travelling card plan Part 2): "Let it travel" shows only when
    /// this says it's on; nil from older servers and with the switch off.
    public let travel: HolidayCardsTravel?
    /// Pick a card shows the card shelves (server switch `card_shelves`, card shelves A5); false from older servers and
    /// with the switch off: one collection at a time behind a row of names.
    public let shelves: Bool
    /// The collections' ids in the order "One from each collection" draws them (card shelves E2); nil from older
    /// servers: the collections' own order.
    public let opening: [String]?
    /// The next round of card improvements is on (server switch `CARD_IMPROVEMENTS`, cards-next contract section 1):
    /// the flow draws the new experience only while this read says so; false (left out) keeps every card screen as it
    /// was. Never kept beyond this read.
    public let improved: Bool

    private enum CodingKeys: String, CodingKey {
        case open, holiday, year, designs, collections, arrivals, today, stamps, signature, media, travel, shelves, opening
        case improved
        case noteHelp = "note_help"
        case maxRecipients = "max_recipients"
        case postageEnabled = "postage_enabled"
        case closesOn = "closes_on"
        case messageLimit = "message_limit"
        case nextRoundAt = "next_round_at"
        case christmasMorningAt = "christmas_morning_at"
        case timeZone = "time_zone"
    }

    private struct Arrivals: Decodable {
        let person: [String]?
        let email: [String]?
        let emailAll: [String]?

        private enum CodingKeys: String, CodingKey {
            case person, email
            case emailAll = "email_all"
        }
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        open = try c.decode(Bool.self, forKey: .open)
        postageEnabled = (try? c.decodeIfPresent(Bool.self, forKey: .postageEnabled)) ?? false
        stamps = try? c.decodeIfPresent(HolidayCardStamps.self, forKey: .stamps)
        holiday = (try? c.decodeIfPresent(String.self, forKey: .holiday)) ?? "christmas"
        year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? 2026
        closesOn = try? c.decodeIfPresent(String.self, forKey: .closesOn)
        messageLimit = (try? c.decodeIfPresent(Int.self, forKey: .messageLimit)) ?? 300
        designs = try c.decode([HolidayCardDesign].self, forKey: .designs)
        collections = (try? c.decodeIfPresent([HolidayCardCollection].self, forKey: .collections)) ?? []
        let arrivals = try? c.decodeIfPresent(Arrivals.self, forKey: .arrivals)
        personArrivals = (arrivals?.person ?? []).compactMap(HolidayCardArrival.init(rawValue:))
        emailArrivals = (arrivals?.email ?? []).compactMap(HolidayCardArrival.init(rawValue:))
        let emailAll = (arrivals?.emailAll ?? []).compactMap(HolidayCardArrival.init(rawValue:))
        emailAllArrivals = emailAll.isEmpty ? nil : emailAll
        nextRoundAt = try? c.decodeIfPresent(String.self, forKey: .nextRoundAt)
        christmasMorningAt = try? c.decodeIfPresent(String.self, forKey: .christmasMorningAt)
        timeZone = try? c.decodeIfPresent(String.self, forKey: .timeZone)
        today = try? c.decodeIfPresent(SentHolidayCard.self, forKey: .today)
        maxRecipients = max(1, (try? c.decodeIfPresent(Int.self, forKey: .maxRecipients)) ?? 1)
        signature = try? c.decodeIfPresent(HolidayCardSignatureSpec.self, forKey: .signature)
        media = try? c.decodeIfPresent(HolidayCardMediaSpec.self, forKey: .media)
        noteHelp = (try? c.decodeIfPresent(Bool.self, forKey: .noteHelp)) ?? false
        travel = try? c.decodeIfPresent(HolidayCardsTravel.self, forKey: .travel)
        shelves = (try? c.decodeIfPresent(Bool.self, forKey: .shelves)) ?? false
        opening = try? c.decodeIfPresent([String].self, forKey: .opening)
        improved = (try? c.decodeIfPresent(Bool.self, forKey: .improved)) == true
    }

    /// "Add a photo" shows (the server takes one now, and this build carries the memories), unless no bought stamp
    /// is left and none can be bought.
    var takesPhoto: Bool {
        LaunchFeatures.holidayCardMemories && media?.photo?.usable == true && mediaStamp != .unavailable
    }

    /// A Live Photo keeps its moving part (the server takes one now).
    var takesLivePhoto: Bool {
        takesPhoto && media?.photo?.live?.usable == true
    }

    /// The most bytes a Live Photo's moving part can be.
    var livePhotoMaxBytes: Int {
        media?.photo?.live?.maxBytes ?? 15_728_640
    }

    /// "Record a greeting" shows.
    var takesVoice: Bool {
        LaunchFeatures.holidayCardMemories && media?.voice?.usable == true && mediaStamp != .unavailable
    }

    /// The server takes a photo or greeting now and this build carries them, whatever the stamps say: a send carries
    /// what's attached (the server refuses it, saying why, rather than the card going without it).
    var takesMemories: Bool {
        LaunchFeatures.holidayCardMemories && (media?.photo?.usable == true || media?.voice?.usable == true)
    }

    /// Whether a photo or greeting can go now: `ready` (or a server without the rule), `buy` (the buttons open the
    /// stamp books) or `unavailable`.
    var mediaStamp: HolidayCardMediaSpec.BoughtStamp.State {
        media?.boughtStamp?.state ?? .ready
    }
}

/// `signature` on `GET /api/mailbox/cards`: the box a signature is drawn in (400 × 100) and the most bytes it can take
/// as compact JSON (2048). `saves`: the account can keep one signature for the next cards (founder, 2026-11-16;
/// `PUT`/`DELETE /api/mailbox/cards/signature`), and `saved` is the one it keeps (nil: none, or an older server).
public struct HolidayCardSignatureSpec: Decodable, Sendable, Hashable {
    public let width: Int
    public let height: Int
    public let maxBytes: Int
    public let saves: Bool
    public let saved: CardSignature?

    private enum CodingKeys: String, CodingKey {
        case width = "w"
        case height = "h"
        case maxBytes = "max_bytes"
        case saves, saved
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        width = try c.decode(Int.self, forKey: .width)
        height = try c.decode(Int.self, forKey: .height)
        maxBytes = try c.decode(Int.self, forKey: .maxBytes)
        saves = (try? c.decodeIfPresent(Bool.self, forKey: .saves)) == true
        // A saved signature this app can't read leaves the card unsigned, never the signing itself.
        saved = try? c.decodeIfPresent(CardSignature.self, forKey: .saved)
    }
}

/// `PUT /api/mailbox/cards/signature`: the signature to keep, and back as kept.
public struct CardSignatureBody: Codable, Sendable, Hashable {
    public let signature: CardSignature

    public init(signature: CardSignature) {
        self.signature = signature
    }
}

/// The sender's own signature beside FROM (`card_table`, plan 8.2): 1 to 40 pen strokes in a `width` × `height`
/// (400 × 100) box, each a flat list of whole-number x, y pairs. Sent with the card, kept with its note (never on
/// the Mail row), and back as `card.signature` on the opened card, Look it over and Sent's detail; nil while sealed
/// for the reader and when unsigned. The sender's own data: never logged, never in a share picture's file name.
public struct CardSignature: Codable, Sendable, Hashable {
    public let width: Int
    public let height: Int
    public let strokes: [[Int]]

    private enum CodingKeys: String, CodingKey {
        case width = "w"
        case height = "h"
        case strokes
    }

    public init(width: Int, height: Int, strokes: [[Int]]) {
        self.width = width
        self.height = height
        self.strokes = strokes
    }
}

/// `GET /api/mailbox/cards/waiting` — route `backend/routes/mailbox.js:2314`:
/// the Christmas card a new account joined for, or none.
public struct HolidayCardWaitingResponse: Decodable, Sendable, Hashable {
    public let card: Card?

    public struct Card: Decodable, Sendable, Hashable {
        /// Opens as a tap on it in the Mailbox does (`GET /api/mailbox/:id`).
        public let mailId: String
        /// The first word of the name on the envelope.
        public let fromFirstName: String?
        /// It can't be opened until Christmas morning.
        public let sealed: Bool

        private enum CodingKeys: String, CodingKey {
            case mailId = "mail_id"
            case fromFirstName = "from_first_name"
            case sealed
        }
    }
}

/// `GET /api/mailbox/cards/arrivals?to=` — route
/// `backend/routes/mailbox.js:1809`: when a card to one person can come, by
/// their clock rather than this phone's.
public struct HolidayCardArrivalsFor: Decodable, Sendable, Hashable {
    /// The arrivals open to them now.
    public let arrivals: [HolidayCardArrival]
    /// The day of their next 7 a.m. mail where they live (`YYYY-MM-DD`).
    public let nextRoundOn: String?

    private enum CodingKeys: String, CodingKey {
        case arrivals
        case nextRoundOn = "next_round_on"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        arrivals = ((try? c.decodeIfPresent([String].self, forKey: .arrivals)) ?? [])
            .compactMap(HolidayCardArrival.init(rawValue:))
        nextRoundOn = try? c.decodeIfPresent(String.self, forKey: .nextRoundOn)
    }
}

/// One of the season's pictures: the app carries the first 17 itself
/// (`Assets.xcassets/HolidayCards/<id>`) and loads any other from the
/// website (`HolidayCardPicture`); this is its caption, the colour of its
/// paper and its height.
public struct HolidayCardDesign: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let number: Int
    public let caption: String
    /// The picture's own border colour, `#rrggbb`.
    public let paper: String
    /// The picture's height at 960 wide: its shape while it loads.
    public let height: Int?
    /// Its public page's name, and the colour of its table (`card_table`); older servers don't send them.
    public let slug: String?
    public let table: String?
    /// A Christmas with Jesus Christ picture's whole verse, in the KJV words its caption names ("For unto us a child
    /// is born…"); nil for every other picture and from older servers (`card_table`, plan 6.2).
    public let verse: String?
    /// The table it opens on, named by the server (card shelves A4): `reverence`, `santa` or `nostalgia`; nil from
    /// older servers, where `CardTableMood` goes by the number.
    public let mood: String?
}

/// A collection of the season's pictures ("Christmas with Friends"): who
/// it's for, and its pictures in grid order. A picture can move between
/// collections; its number never changes.
public struct HolidayCardCollection: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    /// Who it's for: "For the friends who feel like family."
    public let line: String
    /// Its pictures' ids, in grid order.
    public let designs: [String]
    /// The card shelves' facts (card shelves A3); nil or empty from older servers. `short`: the name in a row of
    /// names ("Santa"); `slug`: its public name in a link; `pick`: the design id of its large card in "One from each
    /// collection"; `parts`: Christmas with Jesus Christ's parts in story order.
    public let short: String?
    public let slug: String?
    public let pick: String?
    public let parts: [HolidayCardCollectionPart]

    private enum CodingKeys: String, CodingKey {
        case id, name, line, designs, short, slug, pick, parts
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        line = (try? c.decodeIfPresent(String.self, forKey: .line)) ?? ""
        designs = (try? c.decodeIfPresent([String].self, forKey: .designs)) ?? []
        short = try? c.decodeIfPresent(String.self, forKey: .short)
        slug = try? c.decodeIfPresent(String.self, forKey: .slug)
        pick = try? c.decodeIfPresent(String.self, forKey: .pick)
        // A part this app can't read is left out, never the collection.
        parts = ((try? c.decodeIfPresent([CardTravelLenient<HolidayCardCollectionPart>].self, forKey: .parts)) ?? [])
            .compactMap(\.value)
    }
}

/// One part of a collection, in story order ("The first Christmas"): its name and its pictures' ids.
public struct HolidayCardCollectionPart: Decodable, Sendable, Hashable, Identifiable {
    public let name: String
    public let designs: [String]

    public var id: String {
        name
    }
}

/// A card as its sender sees it: today's card, or the answer to sending it.
public struct SentHolidayCard: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let design: String?
    /// The person's name, or the email address masked.
    public let toName: String?
    public let byEmail: Bool
    /// By link, not to an address (`by_email` is true too, for older apps).
    public let byLink: Bool
    public let arrival: HolidayCardArrival?
    /// When it goes into their mailbox (nil by email).
    public let arrivesAt: String?
    /// The day it goes into their mailbox by their clock (`YYYY-MM-DD`; nil
    /// by email).
    public let arrivesOn: String?
    /// Sealed until (Christmas morning where they live), or nil.
    public let opensAt: String?
    /// Until when it can be taken back (the carrier's pickup; nil by email).
    public let takeBackUntil: String?
    public let canTakeBack: Bool
    /// `waiting`, `delivered`, `claimed`, `expired` or `withdrawn`.
    public let status: String
    public let sentAt: String?
    /// By email, set to go at the sender's 7 a.m. or on Christmas morning: when (ISO); nil once it went, or when it
    /// goes as it's sealed.
    public let emailSendAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, design, arrival, status
        case toName = "to_name"
        case byEmail = "by_email"
        case byLink = "by_link"
        case arrivesAt = "arrives_at"
        case arrivesOn = "arrives_on"
        case opensAt = "opens_at"
        case takeBackUntil = "take_back_until"
        case canTakeBack = "can_take_back"
        case sentAt = "sent_at"
        case emailSendAt = "email_send_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        design = try? c.decodeIfPresent(String.self, forKey: .design)
        toName = try? c.decodeIfPresent(String.self, forKey: .toName)
        byEmail = (try? c.decodeIfPresent(Bool.self, forKey: .byEmail)) ?? false
        byLink = (try? c.decodeIfPresent(Bool.self, forKey: .byLink)) ?? false
        arrival = (try? c.decodeIfPresent(String.self, forKey: .arrival)).flatMap(HolidayCardArrival.init(rawValue:))
        arrivesAt = try? c.decodeIfPresent(String.self, forKey: .arrivesAt)
        arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
        opensAt = try? c.decodeIfPresent(String.self, forKey: .opensAt)
        takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
        canTakeBack = (try? c.decodeIfPresent(Bool.self, forKey: .canTakeBack)) ?? false
        status = (try? c.decodeIfPresent(String.self, forKey: .status)) ?? "waiting"
        sentAt = try? c.decodeIfPresent(String.self, forKey: .sentAt)
        emailSendAt = try? c.decodeIfPresent(String.self, forKey: .emailSendAt)
    }
}

/// `POST /api/mailbox/cards` body — route `backend/routes/mailbox.js:1837`:
/// the picture, the note, when it comes, and to whom (a person found by name,
/// or an email address for someone not on Pantopus).
/// One share of a card's picture, counted so the founder can see whether sharing works (`card_table`).
public struct HolidayCardSharedBody: Encodable, Sendable {
    public let design: String
    /// `instagram`, `facebook`, `email`, `link`, `save` or `more`.
    public let kind: String
    /// `story`, `post`, `link` or `video`.
    public let format: String
    public let withNote: Bool

    private enum CodingKeys: String, CodingKey {
        case design, kind, format
        case withNote = "with_note"
    }
}

/// `GET /api/mailbox/cards/share-video/:design`: where the picture's share video is (public storage), and its size.
public struct HolidayCardShareVideo: Decodable, Sendable, Hashable {
    public let url: String
    public let width: Int?
    public let height: Int?
}

public struct SendHolidayCardBody: Encodable, Sendable {
    public let design: String
    public let message: String
    public let arrival: String
    public let to: Recipient
    /// One per card draft, sent with every look and retry of it: the server
    /// answers a repeat with the card it stored, never a second one.
    public let requestId: String?
    public let useStamp: Bool?
    /// Signed beside FROM (plan 8.2); left out when they keep their typed name.
    public let signature: CardSignature?
    /// The card's own photo and voice greeting (file ids from `POST /cards/media`) and the photo's description; a
    /// send with either must carry `request_id`.
    public let photo: String?
    public let photoAlt: String?
    public let voice: String?
    /// The photo's moving part when it goes as a Live Photo; left out for a still.
    public let photoLive: String?
    /// "Let it travel" left on (travelling card plan Part 2): true starts a journey; left out for an ordinary card.
    public var travel: Bool?

    private enum CodingKeys: String, CodingKey {
        case design, message, arrival, to, signature, photo, voice, travel
        case requestId = "request_id"
        case useStamp = "use_stamp"
        case photoAlt = "photo_alt"
        case photoLive = "photo_live"
    }

    public enum Recipient: Encodable, Sendable {
        case person(userId: String)
        case email(String)
        /// One link, one person: the first to open it keeps the card (`card_table`).
        case link

        private enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case email
            case link
        }

        public func encode(to encoder: any Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case let .person(userId): try c.encode(userId, forKey: .userId)
            case let .email(address): try c.encode(address, forKey: .email)
            case .link: try c.encode(true, forKey: .link)
            }
        }
    }

    public init(
        design: String,
        message: String,
        arrival: HolidayCardArrival,
        to: Recipient,
        requestId: String? = nil,
        useStamp: Bool? = nil,
        signature: CardSignature? = nil,
        media: HolidayCardMediaPick = .none
    ) {
        self.design = design
        self.message = message
        self.arrival = arrival.rawValue
        self.to = to
        self.requestId = requestId
        self.useStamp = useStamp
        self.signature = signature
        photo = media.photo
        photoAlt = media.photo == nil ? nil : media.photoAlt
        voice = media.voice
        photoLive = media.photo == nil ? nil : media.photoLive
    }
}

/// `POST /api/mailbox/cards/batch` (and its look) body: one card to a list
/// of people and addresses (digital stamps on), each its own card under its
/// own request ID, kept for every look and retry of the list. One choice of
/// arrival: an address reads the morning mail as right away and Christmas
/// morning as sealed until Christmas.
public struct SendHolidayCardListBody: Encodable, Sendable {
    public let design: String
    public let message: String
    public let arrival: String
    public let useStamp = true
    public let recipients: [Recipient]
    /// One signature for the whole list, as one note (plan 8.2).
    public let signature: CardSignature?
    /// The photo, its description, its Live Photo clip and the voice greeting every card on the list carries (cards-next
    /// Wave 2, only while `improved`); nil (left out) otherwise.
    public let photo: String?
    public let photoAlt: String?
    public let voice: String?
    public let photoLive: String?
    /// True when the app words every choice by email (`arrivals.email_all`): each address keeps the list's choice,
    /// its email going at the sender's 7 a.m. or on Christmas morning. Nil (left out) keeps the older mapping.
    public let emailsKeepArrival: Bool?
    /// "Let it travel" left on: each card of the list starts a journey of its own; left out otherwise.
    public var travel: Bool?

    public struct Recipient: Encodable, Sendable {
        public let to: SendHolidayCardBody.Recipient
        public let requestId: String

        private enum CodingKeys: String, CodingKey {
            case to
            case requestId = "request_id"
        }
    }

    private enum CodingKeys: String, CodingKey {
        case design, message, arrival, recipients, signature, photo, voice, travel
        case useStamp = "use_stamp"
        case photoAlt = "photo_alt"
        case photoLive = "photo_live"
        case emailsKeepArrival = "emails_keep_arrival"
    }

    public init(
        design: String,
        message: String,
        arrival: HolidayCardArrival,
        recipients: [Recipient],
        signature: CardSignature? = nil,
        media: HolidayCardMediaPick = .none,
        emailsKeepArrival: Bool? = nil
    ) {
        self.design = design
        self.message = message
        self.arrival = arrival.rawValue
        self.recipients = recipients
        self.signature = signature
        photo = media.photo
        photoAlt = media.photo == nil ? nil : media.photoAlt
        voice = media.voice
        photoLive = media.photo == nil ? nil : media.photoLive
        self.emailsKeepArrival = emailsKeepArrival
    }
}

/// One card on a list's look: ready to go (and when it comes), sent by an
/// earlier try of the list, or refused (and why, in the server's words).
public struct HolidayCardListLine: Decodable, Sendable, Hashable {
    public let requestId: String
    /// `ready`, `already_sent` or `refused`.
    public let status: String
    public let toName: String?
    public let byEmail: Bool
    public let arrival: HolidayCardArrival?
    /// The day it goes into their mailbox by their clock (`YYYY-MM-DD`).
    public let arrivesOn: String?
    /// By email, when its email goes (ISO) if not right away.
    public let emailSendAt: String?
    public let card: SentHolidayCard?
    public let error: String?
    public let code: String?

    private enum CodingKeys: String, CodingKey {
        case status, arrival, card, error, code
        case requestId = "request_id"
        case toName = "to_name"
        case byEmail = "by_email"
        case arrivesOn = "arrives_on"
        case emailSendAt = "email_send_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        requestId = try c.decode(String.self, forKey: .requestId)
        status = try c.decode(String.self, forKey: .status)
        toName = try? c.decodeIfPresent(String.self, forKey: .toName)
        byEmail = (try? c.decodeIfPresent(Bool.self, forKey: .byEmail)) ?? false
        arrival = (try? c.decodeIfPresent(String.self, forKey: .arrival)).flatMap(HolidayCardArrival.init(rawValue:))
        arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
        emailSendAt = try? c.decodeIfPresent(String.self, forKey: .emailSendAt)
        card = try? c.decodeIfPresent(SentHolidayCard.self, forKey: .card)
        error = try? c.decodeIfPresent(String.self, forKey: .error)
        code = try? c.decodeIfPresent(String.self, forKey: .code)
    }
}

/// `POST /api/mailbox/cards/batch/preview` → 200: the first card that can go
/// as its person will see it (the fields of `HolidayCardPreview`; none when
/// nobody can get it), every card's line, the stamps left and the stamps the
/// ready cards take.
public struct HolidayCardListPreview: Decodable, Sendable, Hashable {
    public let look: HolidayCardPreview?
    public let recipients: [HolidayCardListLine]
    public let stamps: HolidayCardStamps?
    public let needed: Int

    private enum CodingKeys: String, CodingKey {
        case recipients, stamps, needed
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        look = try? HolidayCardPreview(from: decoder)
        recipients = try c.decode([HolidayCardListLine].self, forKey: .recipients)
        stamps = try? c.decodeIfPresent(HolidayCardStamps.self, forKey: .stamps)
        needed = (try? c.decodeIfPresent(Int.self, forKey: .needed)) ?? 0
    }
}

/// One card in a list's answer: sent now, sent by an earlier try, or not sent
/// and why. A card that didn't go used no stamp.
public struct HolidayCardListResult: Decodable, Sendable, Hashable {
    public let requestId: String
    /// `sent`, `already_sent` or `not_sent`.
    public let status: String
    public let card: SentHolidayCard?
    public let error: String?
    public let code: String?

    private enum CodingKeys: String, CodingKey {
        case status, card, error, code
        case requestId = "request_id"
    }
}

/// `POST /api/mailbox/cards/batch` → 200 (402 `STAMPS_REQUIRED` with
/// `needed` and `available` when the cards need more stamps than are left;
/// nothing is sent then).
public struct SendHolidayCardListResponse: Decodable, Sendable, Hashable {
    public let results: [HolidayCardListResult]
}

/// `POST /api/mailbox/cards` → 201.
public struct SendHolidayCardResponse: Decodable, Sendable, Hashable {
    public let card: SentHolidayCard
    /// The link to send, for a card by link.
    public let link: String?
}

/// `GET /api/mailbox/cards/:id/link`: the link again while it waits.
public struct HolidayCardLinkResponse: Decodable, Sendable, Hashable {
    public let link: String
}

/// `POST /api/mailbox/cards/:id/take-back` → 200.
public struct TakeBackHolidayCardResponse: Decodable, Sendable, Hashable {
    public let takenBack: Bool

    private enum CodingKeys: String, CodingKey {
        case takenBack = "taken_back"
    }
}

/// `POST /api/mailbox/cards/:id/email-again` → 200.
public struct EmailAgainHolidayCardResponse: Decodable, Sendable, Hashable {
    public let emailed: Bool
}

/// `POST /api/mailbox/cards/preview` → 200: what the other person will see,
/// before anything is stored or sent. The card as their Mailbox will show
/// it, when it comes and opens by their clock, and for an email address the
/// email they get and the page its link opens. Never their time zone,
/// address or ids.
public struct HolidayCardPreview: Decodable, Sendable, Hashable {
    /// The card as a Mailbox row (`id` "preview"): the name it will really
    /// carry, the postmark by their clock, the note and the card.
    public let piece: DrawerItemsResponse.DrawerMail
    /// The day it goes into their mailbox by their clock (`YYYY-MM-DD`; nil by email).
    public let arrivesOn: String?
    /// The day a sealed card opens (`YYYY-MM-DD`), or nil.
    public let opensOn: String?
    /// Days from its arrival to the morning a sealed card opens, or nil.
    public let sealedDays: Int?
    /// Until when it could be taken back (the carrier's pickup; nil by email).
    public let takeBackUntil: String?
    /// The email an address gets; nil for a person on Pantopus.
    public let email: Email?
    /// When that email goes (ISO), set for the sender's 7 a.m. or Christmas morning; nil when it goes right away.
    public let emailSendAt: String?
    /// The page the email's link opens; nil for a person on Pantopus.
    public let linkPage: LinkPage?

    /// The email's words and picture, from the strings the real email uses.
    public struct Email: Decodable, Sendable, Hashable {
        /// The picture at the top of the email (launch key `card_table` on the server): the card's front lying on its
        /// open envelope, or the sealed envelope for a card sealed until Christmas. Nil from a server without it.
        public let picture: URL?
        public let subject: String
        public let heading: String
        public let lines: [String]
        public let button: String
        public let footnote: String
        /// The email's footer lines.
        public let footer: [String]

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            picture = (try? c.decodeIfPresent(String.self, forKey: .picture)).flatMap { $0 }.flatMap(URL.init(string:))
            subject = try c.decode(String.self, forKey: .subject)
            heading = try c.decode(String.self, forKey: .heading)
            lines = (try? c.decodeIfPresent([String].self, forKey: .lines)) ?? []
            button = try c.decode(String.self, forKey: .button)
            footnote = (try? c.decodeIfPresent(String.self, forKey: .footnote)) ?? ""
            let footer = (try? c.decodeIfPresent([String].self, forKey: .footer)) ?? []
            self.footer = footer.isEmpty
                ? ["Pantopus — Your household, organized.", "If you don’t know the sender, you can safely ignore this email."]
                : footer
        }

        private enum CodingKeys: String, CodingKey {
            case picture, subject, heading, lines, button, footnote, footer
        }
    }

    /// What the link's page says: who it's from, sealed or not, and the
    /// address it was sent to, masked ("d***@example.com").
    public struct LinkPage: Decodable, Sendable, Hashable {
        public let senderName: String
        public let senderVerified: Bool
        public let sealed: Bool
        public let sentTo: String
        public let sentOn: String?
        /// They can open and read it before joining (`guest_open`, sent only while the card round's switch is on).
        public let guestOpen: Bool

        private enum CodingKeys: String, CodingKey {
            case sealed
            case guestOpen = "guest_open"
            case senderName = "sender_name"
            case senderVerified = "sender_verified"
            case sentTo = "sent_to"
            case sentOn = "sent_on"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            senderName = try c.decode(String.self, forKey: .senderName)
            senderVerified = (try? c.decodeIfPresent(Bool.self, forKey: .senderVerified)) ?? false
            sealed = (try? c.decodeIfPresent(Bool.self, forKey: .sealed)) ?? false
            sentTo = try c.decode(String.self, forKey: .sentTo)
            sentOn = try? c.decodeIfPresent(String.self, forKey: .sentOn)
            guestOpen = (try? c.decodeIfPresent(Bool.self, forKey: .guestOpen)) == true
        }
    }

    private enum CodingKeys: String, CodingKey {
        case piece, email
        case arrivesOn = "arrives_on"
        case opensOn = "opens_on"
        case sealedDays = "sealed_days"
        case takeBackUntil = "take_back_until"
        case linkPage = "link_page"
        case emailSendAt = "email_send_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        piece = try Self.piece(in: c)
        arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
        opensOn = try? c.decodeIfPresent(String.self, forKey: .opensOn)
        sealedDays = try? c.decodeIfPresent(Int.self, forKey: .sealedDays)
        takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
        email = try? c.decodeIfPresent(Email.self, forKey: .email)
        emailSendAt = try? c.decodeIfPresent(String.self, forKey: .emailSendAt)
        linkPage = try? c.decodeIfPresent(LinkPage.self, forKey: .linkPage)
    }

    /// The piece read as any Mailbox row is. One without the stored `type`
    /// reads as the letter a card is.
    private static func piece(in c: KeyedDecodingContainer<CodingKeys>) throws -> DrawerItemsResponse.DrawerMail {
        if let row = try? c.decode(DrawerItemsResponse.DrawerMail.self, forKey: .piece) { return row }
        guard case var .object(fields) = try c.decode(JSONValue.self, forKey: .piece) else {
            throw DecodingError.dataCorruptedError(forKey: .piece, in: c, debugDescription: "The preview's piece isn't an object.")
        }
        if fields["type"]?.stringValue == nil { fields["type"] = .string("letter") }
        let data = try JSONEncoder().encode(JSONValue.object(fields))
        return try JSONDecoder().decode(DrawerItemsResponse.DrawerMail.self, from: data)
    }
}

/// The card a piece of mail carries (`card` on every piece; nil for anything
/// else): its picture, caption, paper and year, and whether it's still sealed
/// until Christmas morning (its note stays on the server until then).
public struct MailCard: Decodable, Sendable, Hashable {
    public let design: String
    public let number: Int?
    public let caption: String?
    public let paper: String?
    /// The picture's height at 960 wide: its shape while it loads (nil for
    /// a picture the server doesn't know).
    public let height: Int?
    public let holiday: String?
    public let year: Int
    public let arrival: String?
    public let sealedUntil: String?
    public let sealed: Bool
    /// Its public page's name, and the colour of its table (`card_table`).
    public let slug: String?
    public let table: String?
    /// A Christmas with Jesus Christ picture's whole verse ("Read the verse", plan 6.2); none while it's sealed, nor
    /// from older servers.
    public let verse: String?
    /// The sender's signature beside FROM (plan 8.2); nil while sealed, unsigned, and from older servers.
    public let signature: CardSignature?
    /// The card's own photo and voice greeting (`holiday_card_memories`); nil while sealed, without them, and from
    /// older servers.
    public let photo: CardPhoto?
    public let voice: CardVoice?
    /// A card that travels (server switch `card_travel`, travelling card plan): its postmarks, miles and places for its
    /// reader; nil for every other card, the switch off, and older servers.
    public let travel: CardTravel?
    /// The table it opens on, named by the server (card shelves A4); nil from older servers.
    public let mood: String?

    private enum CodingKeys: String, CodingKey {
        case design, number, caption, paper, height, holiday, year, arrival, sealed, slug, table, verse, signature
        case photo, voice, travel, mood
        case sealedUntil = "sealed_until"
    }

    /// The card a reply answers (experience plan Part 3), drawn with that card's picture in the reply's row.
    init(reply: CardReplyCard) {
        design = reply.design
        number = reply.number
        caption = reply.caption
        paper = reply.paper
        height = reply.height
        holiday = "christmas"
        year = reply.year
        arrival = nil
        sealedUntil = nil
        sealed = false
        slug = reply.slug
        table = reply.table
        verse = nil
        signature = reply.signature
        photo = nil
        voice = nil
        travel = nil
        mood = reply.mood
    }

    /// A card not sent yet, as its envelope is drawn while it's being sealed.
    init(design: HolidayCardDesign, year: Int, sealed: Bool) {
        self.design = design.id
        number = design.number
        caption = design.caption
        paper = design.paper
        height = design.height
        holiday = "christmas"
        self.year = year
        arrival = nil
        sealedUntil = nil
        self.sealed = sealed
        slug = design.slug
        table = design.table
        verse = sealed ? nil : design.verse
        signature = nil
        photo = nil
        voice = nil
        travel = nil
        mood = design.mood
    }

    private init(copying card: MailCard, sealed: Bool) {
        design = card.design
        number = card.number
        caption = card.caption
        paper = card.paper
        height = card.height
        holiday = card.holiday
        year = card.year
        arrival = card.arrival
        sealedUntil = card.sealedUntil
        self.sealed = sealed
        slug = card.slug
        table = card.table
        verse = card.verse
        signature = card.signature
        photo = card.photo
        voice = card.voice
        travel = card.travel
        mood = card.mood
    }

    /// The same card on the morning its seal lifts.
    func unsealed() -> MailCard {
        MailCard(copying: self, sealed: false)
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        design = try c.decode(String.self, forKey: .design)
        number = try? c.decodeIfPresent(Int.self, forKey: .number)
        caption = try? c.decodeIfPresent(String.self, forKey: .caption)
        paper = try? c.decodeIfPresent(String.self, forKey: .paper)
        height = try? c.decodeIfPresent(Int.self, forKey: .height)
        holiday = try? c.decodeIfPresent(String.self, forKey: .holiday)
        year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? 2026
        arrival = try? c.decodeIfPresent(String.self, forKey: .arrival)
        sealedUntil = try? c.decodeIfPresent(String.self, forKey: .sealedUntil)
        sealed = (try? c.decodeIfPresent(Bool.self, forKey: .sealed)) ?? false
        slug = try? c.decodeIfPresent(String.self, forKey: .slug)
        table = try? c.decodeIfPresent(String.self, forKey: .table)
        verse = try? c.decodeIfPresent(String.self, forKey: .verse)
        signature = try? c.decodeIfPresent(CardSignature.self, forKey: .signature)
        photo = sealed ? nil : try? c.decodeIfPresent(CardPhoto.self, forKey: .photo)
        voice = sealed ? nil : try? c.decodeIfPresent(CardVoice.self, forKey: .voice)
        travel = try? c.decodeIfPresent(CardTravel.self, forKey: .travel)
        mood = try? c.decodeIfPresent(String.self, forKey: .mood)
    }
}

// MARK: - "Help me write it"

/// One note "Help me write it" offers: a way of saying it (`heartfelt`, `light` or `brief`) and the words, within the
/// card's letter limit.
public struct HolidayCardNoteIdea: Decodable, Sendable, Hashable, Identifiable {
    public let tone: String
    public let text: String

    public var id: String {
        tone
    }
}

/// The answer of `POST /api/ai/draft/card-note`: up to three notes to pick from.
public struct HolidayCardNoteIdeasResponse: Decodable, Sendable, Hashable {
    public let notes: [HolidayCardNoteIdea]
}

/// The body of `POST /api/ai/draft/card-note`.
public struct HolidayCardNoteHelpBody: Encodable, Sendable {
    /// The picture they picked.
    public let design: String
    /// The first names the card is to, as the screen shows them (none for an address or a link).
    public let to: [String]
    /// How many people the card goes to: from two on, the note names no one.
    public let count: Int
    /// "Anything to mention?"
    public let hint: String?
    /// What's on the card so far.
    public let note: String?
    /// The notes already shown ("Try again"), so the next ones differ.
    public let passedOver: [String]?

    public init(design: String, to: [String], count: Int, hint: String?, note: String?, passedOver: [String]?) {
        self.design = design
        self.to = to
        self.count = count
        self.hint = hint
        self.note = note
        self.passedOver = passedOver
    }

    private enum CodingKeys: String, CodingKey {
        case design, to, count, hint, note
        case passedOver = "passed_over"
    }
}
