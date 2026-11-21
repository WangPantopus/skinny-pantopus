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
