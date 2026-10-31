//
//  HolidayCardDTOs.swift
//  Pantopus
//
//  Christmas cards (launch keys `holiday_cards` + `mailbox`; server
//  `backend/services/holidayCards.js`): the season's pictures, today's card,
//  sending one and taking it back, and the card a piece of mail carries.
//

import Foundation

/// When a card comes: with the next morning's mail, the next morning sealed
/// until Christmas, on Christmas morning, or (by email) right away.
public enum HolidayCardArrival: String, Sendable, Hashable, CaseIterable {
    case nextMorning = "next_morning"
    case sealedChristmas = "sealed_christmas"
    case christmasMorning = "christmas_morning"
    case now
}

/// `GET /api/mailbox/cards` — route `backend/routes/mailbox.js:1776`: whether
/// sending is open, the pictures, the arrivals open now and today's card.
public struct HolidayCardsResponse: Decodable, Sendable, Hashable {
    public let open: Bool
    public let holiday: String
    public let year: Int
    /// The last day cards can be sent (`YYYY-MM-DD`).
    public let closesOn: String?
    /// The most letters a note can have.
    public let messageLimit: Int
    public let designs: [HolidayCardDesign]
    /// The arrivals open now for a person found by name, and by email.
    public let personArrivals: [HolidayCardArrival]
    public let emailArrivals: [HolidayCardArrival]
    /// The next 7 a.m. round where the sender lives: the carrier's pickup.
    public let nextRoundAt: String?
    /// 7 a.m. on Christmas morning where the sender lives.
    public let christmasMorningAt: String?
    public let timeZone: String?
    /// The card sent today, if any (one a day).
    public let today: SentHolidayCard?

    private enum CodingKeys: String, CodingKey {
        case open, holiday, year, designs, arrivals, today
        case closesOn = "closes_on"
        case messageLimit = "message_limit"
        case nextRoundAt = "next_round_at"
        case christmasMorningAt = "christmas_morning_at"
        case timeZone = "time_zone"
    }

    private struct Arrivals: Decodable {
        let person: [String]?
        let email: [String]?
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        open = try c.decode(Bool.self, forKey: .open)
        holiday = (try? c.decodeIfPresent(String.self, forKey: .holiday)) ?? "christmas"
        year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? 2026
        closesOn = try? c.decodeIfPresent(String.self, forKey: .closesOn)
        messageLimit = (try? c.decodeIfPresent(Int.self, forKey: .messageLimit)) ?? 300
        designs = try c.decode([HolidayCardDesign].self, forKey: .designs)
        let arrivals = try? c.decodeIfPresent(Arrivals.self, forKey: .arrivals)
        personArrivals = (arrivals?.person ?? []).compactMap(HolidayCardArrival.init(rawValue:))
        emailArrivals = (arrivals?.email ?? []).compactMap(HolidayCardArrival.init(rawValue:))
        nextRoundAt = try? c.decodeIfPresent(String.self, forKey: .nextRoundAt)
        christmasMorningAt = try? c.decodeIfPresent(String.self, forKey: .christmasMorningAt)
        timeZone = try? c.decodeIfPresent(String.self, forKey: .timeZone)
        today = try? c.decodeIfPresent(SentHolidayCard.self, forKey: .today)
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

/// One of the season's pictures: the app carries the picture itself
/// (`Assets.xcassets/HolidayCards/<id>`); this is its caption and the colour
/// of its paper.
public struct HolidayCardDesign: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let number: Int
    public let caption: String
    /// The picture's own border colour, `#rrggbb`.
    public let paper: String
}

/// A card as its sender sees it: today's card, or the answer to sending it.
public struct SentHolidayCard: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let design: String?
    /// The person's name, or the email address masked.
    public let toName: String?
    public let byEmail: Bool
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

    private enum CodingKeys: String, CodingKey {
        case id, design, arrival, status
        case toName = "to_name"
        case byEmail = "by_email"
        case arrivesAt = "arrives_at"
        case arrivesOn = "arrives_on"
        case opensAt = "opens_at"
        case takeBackUntil = "take_back_until"
        case canTakeBack = "can_take_back"
        case sentAt = "sent_at"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        design = try? c.decodeIfPresent(String.self, forKey: .design)
        toName = try? c.decodeIfPresent(String.self, forKey: .toName)
        byEmail = (try? c.decodeIfPresent(Bool.self, forKey: .byEmail)) ?? false
        arrival = (try? c.decodeIfPresent(String.self, forKey: .arrival)).flatMap(HolidayCardArrival.init(rawValue:))
        arrivesAt = try? c.decodeIfPresent(String.self, forKey: .arrivesAt)
        arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
        opensAt = try? c.decodeIfPresent(String.self, forKey: .opensAt)
        takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
        canTakeBack = (try? c.decodeIfPresent(Bool.self, forKey: .canTakeBack)) ?? false
        status = (try? c.decodeIfPresent(String.self, forKey: .status)) ?? "waiting"
        sentAt = try? c.decodeIfPresent(String.self, forKey: .sentAt)
    }
}

/// `POST /api/mailbox/cards` body — route `backend/routes/mailbox.js:1837`:
/// the picture, the note, when it comes, and to whom (a person found by name,
/// or an email address for someone not on Pantopus).
public struct SendHolidayCardBody: Encodable, Sendable {
    public let design: String
    public let message: String
    public let arrival: String
    public let to: Recipient

    public enum Recipient: Encodable, Sendable {
        case person(userId: String)
        case email(String)

        private enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case email
        }

        public func encode(to encoder: any Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case let .person(userId): try c.encode(userId, forKey: .userId)
            case let .email(address): try c.encode(address, forKey: .email)
            }
        }
    }

    public init(design: String, message: String, arrival: HolidayCardArrival, to: Recipient) {
        self.design = design
        self.message = message
        self.arrival = arrival.rawValue
        self.to = to
    }
}

/// `POST /api/mailbox/cards` → 201.
public struct SendHolidayCardResponse: Decodable, Sendable, Hashable {
    public let card: SentHolidayCard
}

/// `POST /api/mailbox/cards/:id/take-back` → 200.
public struct TakeBackHolidayCardResponse: Decodable, Sendable, Hashable {
    public let takenBack: Bool

    private enum CodingKeys: String, CodingKey {
        case takenBack = "taken_back"
    }
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
    /// The page the email's link opens; nil for a person on Pantopus.
    public let linkPage: LinkPage?

    /// The email's words, from the strings the real email uses.
    public struct Email: Decodable, Sendable, Hashable {
        public let subject: String
        public let heading: String
        public let lines: [String]
        public let button: String
        public let footnote: String
        /// The email's footer lines.
        public let footer: [String]

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
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
            case subject, heading, lines, button, footnote, footer
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

        private enum CodingKeys: String, CodingKey {
            case sealed
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
        }
    }

    private enum CodingKeys: String, CodingKey {
        case piece, email
        case arrivesOn = "arrives_on"
        case opensOn = "opens_on"
        case sealedDays = "sealed_days"
        case takeBackUntil = "take_back_until"
        case linkPage = "link_page"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        piece = try Self.piece(in: c)
        arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
        opensOn = try? c.decodeIfPresent(String.self, forKey: .opensOn)
        sealedDays = try? c.decodeIfPresent(Int.self, forKey: .sealedDays)
        takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
        email = try? c.decodeIfPresent(Email.self, forKey: .email)
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
    public let holiday: String?
    public let year: Int
    public let arrival: String?
    public let sealedUntil: String?
    public let sealed: Bool

    private enum CodingKeys: String, CodingKey {
        case design, number, caption, paper, holiday, year, arrival, sealed
        case sealedUntil = "sealed_until"
    }

    /// A card not sent yet, as its envelope is drawn while it's being sealed.
    init(design: HolidayCardDesign, year: Int, sealed: Bool) {
        self.design = design.id
        number = design.number
        caption = design.caption
        paper = design.paper
        holiday = "christmas"
        self.year = year
        arrival = nil
        sealedUntil = nil
        self.sealed = sealed
    }

    private init(copying card: MailCard, sealed: Bool) {
        design = card.design
        number = card.number
        caption = card.caption
        paper = card.paper
        holiday = card.holiday
        year = card.year
        arrival = card.arrival
        sealedUntil = card.sealedUntil
        self.sealed = sealed
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
        holiday = try? c.decodeIfPresent(String.self, forKey: .holiday)
        year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? 2026
        arrival = try? c.decodeIfPresent(String.self, forKey: .arrival)
        sealedUntil = try? c.decodeIfPresent(String.self, forKey: .sealedUntil)
        sealed = (try? c.decodeIfPresent(Bool.self, forKey: .sealed)) ?? false
    }
}
