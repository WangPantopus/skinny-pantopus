//
//  CardTravelDTOs.swift
//  Pantopus
//
//  The travelling card (server-only switch `card_travel`, docs/product/travelling-card-2026-11-21): whoever receives
//  a Christmas card can pass the same card on, free, with a note of their own, to up to two people. These are the
//  fields the server adds to a card that travels; an older server, the switch off, or a card that doesn't travel sends
//  none, and every screen stays as it is. Every field decodes leniently, so a shape the app doesn't know yet is no card
//  at all rather than a failed screen.
//

import Foundation

/// One town on a card's way: where it left from, and that day's date where its sender lives.
public struct CardTravelStop: Decodable, Sendable, Hashable {
    /// "Boise", or "Abroad" for someone outside the United States.
    public let town: String
    /// "ID"; nil abroad.
    public let state: String?
    /// The day, `YYYY-MM-DD`.
    public let on: String?

    private enum CodingKeys: String, CodingKey {
        case town, state, on
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        town = try c.decode(String.self, forKey: .town)
        state = (try? c.decodeIfPresent(String.self, forKey: .state)).flatMap { $0.isEmpty ? nil : $0 }
        on = try? c.decodeIfPresent(String.self, forKey: .on)
    }

    /// "Boise, ID", or "Abroad".
    public var place: String {
        state.map { "\(town), \($0)" } ?? town
    }
}

/// A received card that travels, as its reader sees it (`piece.card.travel`; NOTES "The server's shapes" 5).
public struct CardTravel: Decodable, Sendable, Hashable {
    /// The journey page's id (`<web>/cards/journey/<journey>`); nil on a look before sending.
    public let journey: String?
    /// 1 for the card that started the journey.
    public let hop: Int?
    /// The towns it left on its way to this reader, oldest first: the envelope's postmarks. The first cancels the stamp.
    public let postmarks: [CardTravelStop]
    /// Straight-line miles from town to town to reach this reader.
    public let miles: Int
    /// Towns so far (the postmarks' count).
    public let towns: Int
    /// How many people one person may pass it to, and how many more this reader may.
    public let places: Int
    public let placesLeft: Int
    /// The place the next pass-on takes (1 or 2); nil when none is left.
    public let nextPlace: Int?
    /// The cards this reader passed it on with.
    public let passed: [CardTravelPassed]
    public let canPassOn: Bool
    /// Why it can't be passed on now, in the server's words.
    public let passOnRefusal: CardTravelRefusal?

    private enum CodingKeys: String, CodingKey {
        case journey, hop, postmarks, miles, towns, places, passed
        case placesLeft = "places_left"
        case nextPlace = "next_place"
        case canPassOn = "can_pass_on"
        case passOnRefusal = "pass_on_refusal"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        journey = try? c.decodeIfPresent(String.self, forKey: .journey)
        hop = try? c.decodeIfPresent(Int.self, forKey: .hop)
        postmarks = ((try? c.decodeIfPresent([CardTravelLenient<CardTravelStop>].self, forKey: .postmarks)) ?? [])
            .compactMap(\.value)
        miles = (try? c.decodeIfPresent(Int.self, forKey: .miles)) ?? 0
        towns = (try? c.decodeIfPresent(Int.self, forKey: .towns)) ?? postmarks.count
        places = (try? c.decodeIfPresent(Int.self, forKey: .places)) ?? 2
        placesLeft = (try? c.decodeIfPresent(Int.self, forKey: .placesLeft)) ?? 0
        nextPlace = try? c.decodeIfPresent(Int.self, forKey: .nextPlace)
        passed = ((try? c.decodeIfPresent([CardTravelLenient<CardTravelPassed>].self, forKey: .passed)) ?? []).compactMap(\.value)
        canPassOn = (try? c.decodeIfPresent(Bool.self, forKey: .canPassOn)) ?? false
        passOnRefusal = try? c.decodeIfPresent(CardTravelRefusal.self, forKey: .passOnRefusal)
    }
}

/// One card a reader passed their card on with (`passed[]`).
public struct CardTravelPassed: Decodable, Sendable, Hashable, Identifiable {
    public let place: Int
    /// The passed-on card's id (for its take-back).
    public let id: String
    public let firstName: String?
    public let toName: String?
    public let byEmail: Bool
    public let byLink: Bool
    public let status: String?
    public let canTakeBack: Bool
    public let takeBackUntil: String?

    private enum CodingKeys: String, CodingKey {
        case place, id, status
        case firstName = "first_name"
        case toName = "to_name"
        case byEmail = "by_email"
        case byLink = "by_link"
        case canTakeBack = "can_take_back"
        case takeBackUntil = "take_back_until"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        place = (try? c.decodeIfPresent(Int.self, forKey: .place)) ?? 1
        firstName = try? c.decodeIfPresent(String.self, forKey: .firstName)
        toName = try? c.decodeIfPresent(String.self, forKey: .toName)
        byEmail = (try? c.decodeIfPresent(Bool.self, forKey: .byEmail)) ?? false
        byLink = (try? c.decodeIfPresent(Bool.self, forKey: .byLink)) ?? false
        status = try? c.decodeIfPresent(String.self, forKey: .status)
        canTakeBack = (try? c.decodeIfPresent(Bool.self, forKey: .canTakeBack)) ?? false
        takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
    }
}

/// Why a card can't be passed on now: the server's code and the words to show.
public struct CardTravelRefusal: Decodable, Sendable, Hashable {
    public let code: String?
    public let error: String?
}

/// A card in Sent that travels (`travel` on a sent card; NOTES "The server's shapes" 6): how far it has gone since it
/// left this sender.
public struct SentCardTravel: Decodable, Sendable, Hashable {
    public let journey: String
    public let towns: Int
    public let miles: Int
    /// "Tampa, FL"; nil until it has reached anyone.
    public let nowIn: String?

    private enum CodingKeys: String, CodingKey {
        case journey, towns, miles
        case nowIn = "now_in"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        journey = try c.decode(String.self, forKey: .journey)
        towns = (try? c.decodeIfPresent(Int.self, forKey: .towns)) ?? 0
        miles = (try? c.decodeIfPresent(Int.self, forKey: .miles)) ?? 0
        nowIn = try? c.decodeIfPresent(String.self, forKey: .nowIn)
    }
}

/// One element of a list that may not decode: kept as nil instead of failing the list.
struct CardTravelLenient<T: Decodable & Sendable>: Decodable {
    let value: T?

    init(from decoder: any Decoder) throws {
        value = try? T(from: decoder)
    }
}

// MARK: - Letting a card travel (plan Part 2)

/// `travel` on `GET /api/mailbox/cards`: the switch shows only when the server sends this with `on`.
public struct HolidayCardsTravel: Decodable, Sendable, Hashable {
    public let on: Bool
    /// "Boise, ID", or nil when the sender has no town yet (they're asked once, D4).
    public let town: String?
    /// How many people one person may pass a card to (two, D1).
    public let places: Int

    private enum CodingKeys: String, CodingKey {
        case on, town, places
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        on = (try? c.decodeIfPresent(Bool.self, forKey: .on)) ?? false
        town = (try? c.decodeIfPresent(String.self, forKey: .town)).flatMap { $0.isEmpty ? nil : $0 }
        places = (try? c.decodeIfPresent(Int.self, forKey: .places)) ?? 2
    }

    public init(on: Bool, town: String?, places: Int) {
        self.on = on
        self.town = town
        self.places = places
    }
}

/// One town `GET /api/mailbox/cards/towns?q=` offers (NOTES "The server's shapes" 2).
public struct CardTownMatch: Decodable, Sendable, Hashable, Identifiable {
    /// What `PUT /cards/town` keeps ("zip:98660", or a place's id).
    public let id: String
    public let town: String
    public let state: String
    /// "Vancouver, WA".
    public let label: String
    public let zip: String?

    private enum CodingKeys: String, CodingKey {
        case id, town, state, label, zip
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        town = (try? c.decodeIfPresent(String.self, forKey: .town)) ?? ""
        state = (try? c.decodeIfPresent(String.self, forKey: .state)) ?? ""
        let label = try? c.decodeIfPresent(String.self, forKey: .label)
        self.label = label ?? (state.isEmpty ? town : "\(town), \(state)")
        zip = try? c.decodeIfPresent(String.self, forKey: .zip)
    }
}

/// The answer of `GET /api/mailbox/cards/towns?q=`: up to 8 towns; without `q`, the town nearest where the person's
/// location says they are ("Use Vancouver, WA"), or none.
public struct CardTownsResponse: Decodable, Sendable, Hashable {
    public let towns: [CardTownMatch]
    public let suggested: CardTownMatch?

    private enum CodingKeys: String, CodingKey {
        case towns, suggested
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        towns = ((try? c.decodeIfPresent([CardTravelLenient<CardTownMatch>].self, forKey: .towns)) ?? []).compactMap(\.value)
        suggested = try? c.decodeIfPresent(CardTownMatch.self, forKey: .suggested)
    }
}

/// The body of `PUT /api/mailbox/cards/town`: an `id` from the list; kept in the profile's town fields.
public struct CardTownBody: Encodable, Sendable {
    public let id: String

    public init(_ match: CardTownMatch) {
        id = match.id
    }
}

/// The answer of `PUT /api/mailbox/cards/town`: the town as it's kept ("Vancouver, WA").
public struct CardTownAnswer: Decodable, Sendable, Hashable {
    public let town: String?
}

// MARK: - Passing it on (plan Part 4; NOTES "The server's shapes" 7 and 8)

/// The body of `POST /api/mailbox/cards/:id/pass-on` and its preview: who gets it next, the note, the signature, one
/// request ID per draft and the place it takes (`next_place`).
public struct CardPassOnBody: Encodable, Sendable {
    public let to: SendHolidayCardBody.Recipient
    public let message: String
    public let signature: CardSignature?
    public let requestId: String
    public let place: Int

    private enum CodingKeys: String, CodingKey {
        case to, message, signature, place
        case requestId = "request_id"
    }

    public init(to: SendHolidayCardBody.Recipient, message: String, signature: CardSignature?, requestId: String, place: Int) {
        self.to = to
        self.message = message
        self.signature = signature
        self.requestId = requestId
        self.place = place
    }
}

/// The answer of `POST /api/mailbox/cards/:id/pass-on/preview`: what would happen, nothing stored.
public struct CardPassOnPreview: Decodable, Sendable, Hashable {
    public let passOn: Look

    public struct Look: Decodable, Sendable, Hashable {
        public let place: Int?
        public let toName: String?
        public let byEmail: Bool
        public let byLink: Bool
        public let arrivesAt: String?
        public let arrivesOn: String?
        public let takeBackUntil: String?
        /// The sender's town ("Tampa, FL") for "Your town, Tampa, FL, goes on its journey."
        public let town: String?

        private enum CodingKeys: String, CodingKey {
            case place, town
            case toName = "to_name"
            case byEmail = "by_email"
            case byLink = "by_link"
            case arrivesAt = "arrives_at"
            case arrivesOn = "arrives_on"
            case takeBackUntil = "take_back_until"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            place = try? c.decodeIfPresent(Int.self, forKey: .place)
            toName = try? c.decodeIfPresent(String.self, forKey: .toName)
            byEmail = (try? c.decodeIfPresent(Bool.self, forKey: .byEmail)) ?? false
            byLink = (try? c.decodeIfPresent(Bool.self, forKey: .byLink)) ?? false
            arrivesAt = try? c.decodeIfPresent(String.self, forKey: .arrivesAt)
            arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
            takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
            town = try? c.decodeIfPresent(String.self, forKey: .town)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case passOn = "pass_on"
    }
}

/// The answer of `POST /api/mailbox/cards/:id/pass-on/take-back`: its place is free again.
public struct CardPassOnTakeBack: Decodable, Sendable, Hashable {
    public let takenBack: Bool

    private enum CodingKeys: String, CodingKey {
        case takenBack = "taken_back"
    }
}
