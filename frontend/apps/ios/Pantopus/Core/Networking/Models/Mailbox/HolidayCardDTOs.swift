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
