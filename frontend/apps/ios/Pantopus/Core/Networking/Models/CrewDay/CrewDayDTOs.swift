//
//  CrewDayDTOs.swift
//  Pantopus
//
//  Crew Day (launch cut #13) request bodies and reads, from the build kit's
//  contract (docs/product/crew-day-build/02-contract.md §2 and §4). Reads
//  decode every field the screens don't strictly need as optional, so a
//  field the server adds or leaves out never breaks a screen.
//

import Foundation

// MARK: - Shared shapes

/// One price on a Crew Day's price list. `priceCents` is nil for an option
/// the crew confirms after a look (`needsLook`).
public struct CrewDayPriceOption: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let priceCents: Int?
    public let needsLook: Bool

    public init(id: String, label: String, priceCents: Int?, needsLook: Bool) {
        self.id = id
        self.label = label
        self.priceCents = priceCents
        self.needsLook = needsLook
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        label = try c.decode(String.self, forKey: .label)
        priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
        needsLook = try c.decodeIfPresent(Bool.self, forKey: .needsLook) ?? false
    }

    private enum CodingKeys: String, CodingKey {
        case id, label
        case priceCents = "price_cents"
        case needsLook = "needs_look"
    }
}

/// An add-on ("Clean the gutter guards · +$30").
public struct CrewDayAddOn: Codable, Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let priceCents: Int

    public init(id: String, label: String, priceCents: Int) {
        self.id = id
        self.label = label
        self.priceCents = priceCents
    }

    private enum CodingKeys: String, CodingKey {
        case id, label
        case priceCents = "price_cents"
    }
}

/// The crew's business as households see it.
public struct CrewDayCrewDTO: Decodable, Sendable, Hashable {
    public let businessUserId: String?
    public let name: String
    public let username: String?
    public let avatarURL: String?
    /// Pantopus verified the business's documents ("Insured and registered").
    public let verified: Bool?
    public let rating: Rating?

    public struct Rating: Decodable, Sendable, Hashable {
        public let average: Double
        public let count: Int
    }

    private enum CodingKeys: String, CodingKey {
        case name, username, verified, rating
        case businessUserId = "business_user_id"
        case avatarURL = "avatar_url"
    }
}

/// A street day's service, with the words people read.
public enum CrewDayService: String, Codable, Sendable, CaseIterable {
    case gutterCleaning = "gutter_cleaning"
    case leafCleanup = "leaf_cleanup"
    case roofMoss = "roof_moss"
    case holidayLights = "holiday_lights"
    case windowWashing = "window_washing"
    case pressureWashing = "pressure_washing"
    case other

    /// "Gutter cleaning".
    public var label: String {
        switch self {
        case .gutterCleaning: "Gutter cleaning"
        case .leafCleanup: "Leaf cleanup"
        case .roofMoss: "Roof moss"
        case .holidayLights: "Holiday lights"
        case .windowWashing: "Window washing"
        case .pressureWashing: "Pressure washing"
        case .other: "Something else"
        }
    }
}

// MARK: - Invitation (screen 1)

/// `GET /api/crew-days/public/:code`.
public struct CrewDayInvitationDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let code: String
    public let title: String
    public let service: String
    public let streetLabel: String
    public let city: String?
    public let state: String?
    public let timezone: String?
    public let serviceDate: String
    public let windowStart: String
    public let windowEnd: String
    public let windowStartsAt: String?
    public let windowEndsAt: String?
    public let bookingClosesAt: String?
    public let included: [String]
    public let outsideOnly: Bool
    public let priceFromCents: Int?
    public let priceOptions: [CrewDayPriceOption]
    public let addOns: [CrewDayAddOn]
    public let capacity: Int
    public let bookedCount: Int
    public let spotsLeft: Int
    /// `availability`: `open`, `full`, `closed`, `cancelled` or `done`.
    public let dayState: String
    public let crew: CrewDayCrewDTO?
    public let viewer: Viewer?

    public struct Viewer: Decodable, Sendable, Hashable {
        /// `crew`, `household` or `none`.
        public let role: String
        public let bookingId: String?

        private enum CodingKeys: String, CodingKey {
            case role
            case bookingId = "booking_id"
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        code = try c.decode(String.self, forKey: .code)
        title = try c.decode(String.self, forKey: .title)
        service = try c.decodeIfPresent(String.self, forKey: .service) ?? CrewDayService.other.rawValue
        streetLabel = try c.decodeIfPresent(String.self, forKey: .streetLabel) ?? ""
        city = try c.decodeIfPresent(String.self, forKey: .city)
        state = try c.decodeIfPresent(String.self, forKey: .state)
        timezone = try c.decodeIfPresent(String.self, forKey: .timezone)
        serviceDate = try c.decode(String.self, forKey: .serviceDate)
        windowStart = try c.decode(String.self, forKey: .windowStart)
        windowEnd = try c.decode(String.self, forKey: .windowEnd)
        windowStartsAt = try c.decodeIfPresent(String.self, forKey: .windowStartsAt)
        windowEndsAt = try c.decodeIfPresent(String.self, forKey: .windowEndsAt)
        bookingClosesAt = try c.decodeIfPresent(String.self, forKey: .bookingClosesAt)
        included = try c.decodeIfPresent([String].self, forKey: .included) ?? []
        outsideOnly = try c.decodeIfPresent(Bool.self, forKey: .outsideOnly) ?? true
        priceFromCents = try c.decodeIfPresent(Int.self, forKey: .priceFromCents)
        priceOptions = try c.decodeIfPresent([CrewDayPriceOption].self, forKey: .priceOptions) ?? []
        addOns = try c.decodeIfPresent([CrewDayAddOn].self, forKey: .addOns) ?? []
        capacity = try c.decodeIfPresent(Int.self, forKey: .capacity) ?? 0
        bookedCount = try c.decodeIfPresent(Int.self, forKey: .bookedCount) ?? 0
        spotsLeft = try c.decodeIfPresent(Int.self, forKey: .spotsLeft) ?? 0
        dayState = try c.decodeIfPresent(String.self, forKey: .dayState) ?? "open"
        crew = try c.decodeIfPresent(CrewDayCrewDTO.self, forKey: .crew)
        viewer = try c.decodeIfPresent(Viewer.self, forKey: .viewer)
    }

    private enum CodingKeys: String, CodingKey {
        case id, code, title, service, city, state, timezone, included, capacity, crew, viewer
        case streetLabel = "street_label"
        case serviceDate = "service_date"
        case windowStart = "window_start"
        case windowEnd = "window_end"
        case windowStartsAt = "window_starts_at"
        case windowEndsAt = "window_ends_at"
        case bookingClosesAt = "booking_closes_at"
        case outsideOnly = "outside_only"
        case priceFromCents = "price_from_cents"
        case priceOptions = "price_options"
        case addOns = "add_ons"
        case bookedCount = "booked_count"
        case spotsLeft = "spots_left"
        case dayState = "availability"
    }
}

/// `POST /api/crew-days/public/:code/quote` answer.
public struct CrewDayQuoteDTO: Decodable, Sendable, Hashable {
    public let inArea: Bool
    public let priceCents: Int?
    public let needsLook: Bool
    public let message: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        inArea = try c.decodeIfPresent(Bool.self, forKey: .inArea) ?? false
        priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
        needsLook = try c.decodeIfPresent(Bool.self, forKey: .needsLook) ?? false
        message = try c.decodeIfPresent(String.self, forKey: .message)
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case inArea = "in_area"
        case priceCents = "price_cents"
        case needsLook = "needs_look"
    }
}

// MARK: - Household cards (screens 9 and 10)

/// One card on Today or in Your Crew Days: a booking, an open day coming to
/// my street, or a street request I sent. Everything but the ids is optional.
public struct CrewDayCardDTO: Decodable, Sendable, Hashable, Identifiable {
    /// The booking's id for a booking, the Crew Day's (or request's) otherwise.
    public let id: String
    public let bookingId: String?
    public let crewDayId: String?
    public let code: String?
    public let title: String?
    public let service: String?
    public let serviceLabel: String?
    public let streetLabel: String?
    public let city: String?
    public let timezone: String?
    public let serviceDate: String?
    public let windowStart: String?
    public let windowEnd: String?
    public let windowStartsAt: String?
    /// The booking's status, or a request's (`requested`, `offer_ready`, `no_crew`).
    public let status: String?
    /// Today only: what the booking needs from me, or what is coming (`price_ready`, `new_dates`,
    /// `payment_failed`, `done`, `on_the_way`, `today`, `tomorrow`, or the status).
    public let todayState: String?
    public let priceCents: Int?
    public let priceFromCents: Int?
    public let charge: CrewDayBookingDTO.Charge?
    public let eta: CrewDayBookingDTO.Eta?
    public let gateReadyAt: String?
    public let photoCount: Int?
    public let problemStatus: String?
    public let bookingClosesAt: String?
    public let crewName: String?
    /// The crew's business account, to open a conversation with it.
    public let crewUserId: String?
    /// A request answered by an offer: that open day.
    public let offer: Link?
    /// A past booking whose crew opened a new day reaching this home ("Book again").
    public let bookAgain: Link?
    public let months: [String]?
    public let note: String?
    /// The operator's answer to a request ("No crew yet" and why).
    public let answerNote: String?
    public let createdAt: String?

    /// An open Crew Day a card points to.
    public struct Link: Decodable, Sendable, Hashable {
        public let crewDayId: String?
        public let code: String
        public let serviceDate: String?

        private enum CodingKeys: String, CodingKey {
            case code
            case crewDayId = "crew_day_id"
            case serviceDate = "service_date"
        }
    }

    /// The offer's invitation code.
    public var offerCode: String? {
        offer?.code
    }

    /// The new day's invitation code.
    public var bookAgainCode: String? {
        bookAgain?.code
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bookingId = try c.decodeIfPresent(String.self, forKey: .bookingId)
        crewDayId = try c.decodeIfPresent(String.self, forKey: .crewDayId)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? bookingId ?? crewDayId ?? UUID().uuidString
        code = try c.decodeIfPresent(String.self, forKey: .code)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        service = try c.decodeIfPresent(String.self, forKey: .service)
        serviceLabel = try c.decodeIfPresent(String.self, forKey: .serviceLabel)
        streetLabel = try c.decodeIfPresent(String.self, forKey: .streetLabel)
        city = try c.decodeIfPresent(String.self, forKey: .city)
        timezone = try c.decodeIfPresent(String.self, forKey: .timezone)
        serviceDate = try c.decodeIfPresent(String.self, forKey: .serviceDate)
        windowStart = try c.decodeIfPresent(String.self, forKey: .windowStart)
        windowEnd = try c.decodeIfPresent(String.self, forKey: .windowEnd)
        windowStartsAt = try c.decodeIfPresent(String.self, forKey: .windowStartsAt)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        todayState = try c.decodeIfPresent(String.self, forKey: .todayState)
        priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
        priceFromCents = try c.decodeIfPresent(Int.self, forKey: .priceFromCents)
        charge = try? c.decodeIfPresent(CrewDayBookingDTO.Charge.self, forKey: .charge)
        eta = try? c.decodeIfPresent(CrewDayBookingDTO.Eta.self, forKey: .eta)
        gateReadyAt = try c.decodeIfPresent(String.self, forKey: .gateReadyAt)
        photoCount = try c.decodeIfPresent(Int.self, forKey: .photoCount)
        problemStatus = try c.decodeIfPresent(String.self, forKey: .problemStatus)
        bookingClosesAt = try c.decodeIfPresent(String.self, forKey: .bookingClosesAt)
        let crew = try? c.decodeIfPresent(CrewDayCrewDTO.self, forKey: .crew)
        crewName = crew?.name
        crewUserId = crew?.businessUserId
        offer = try? c.decodeIfPresent(Link.self, forKey: .offer)
        bookAgain = try? c.decodeIfPresent(Link.self, forKey: .bookAgain)
        months = try c.decodeIfPresent([String].self, forKey: .months)
        note = try c.decodeIfPresent(String.self, forKey: .note)
        answerNote = try c.decodeIfPresent(String.self, forKey: .answerNote)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    }

    private enum CodingKeys: String, CodingKey {
        case id, code, title, service, city, timezone, status, charge, eta, crew, offer, months, note
        case bookingId = "booking_id"
        case crewDayId = "crew_day_id"
        case serviceLabel = "service_label"
        case streetLabel = "street_label"
        case serviceDate = "service_date"
        case windowStart = "window_start"
        case windowEnd = "window_end"
        case windowStartsAt = "window_starts_at"
        case todayState = "today_state"
        case priceCents = "price_cents"
        case priceFromCents = "price_from_cents"
        case gateReadyAt = "gate_ready_at"
        case photoCount = "photo_count"
        case problemStatus = "problem_status"
        case bookingClosesAt = "booking_closes_at"
        case bookAgain = "book_again"
        case answerNote = "answer_note"
        case createdAt = "created_at"
    }
}

/// `GET /api/crew-days/today`.
public struct CrewDayTodayResponse: Decodable, Sendable, Hashable {
    public let mine: [CrewDayCardDTO]
    public let nearby: [CrewDayCardDTO]

    public init(mine: [CrewDayCardDTO] = [], nearby: [CrewDayCardDTO] = []) {
        self.mine = mine
        self.nearby = nearby
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mine = try c.decodeIfPresent([CrewDayCardDTO].self, forKey: .mine) ?? []
        nearby = try c.decodeIfPresent([CrewDayCardDTO].self, forKey: .nearby) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case mine, nearby
    }
}

/// `GET /api/crew-days/mine`.
public struct CrewDayMineResponse: Decodable, Sendable, Hashable {
    public let upcoming: [CrewDayCardDTO]
    public let requests: [CrewDayCardDTO]
    public let past: [CrewDayCardDTO]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        upcoming = try c.decodeIfPresent([CrewDayCardDTO].self, forKey: .upcoming) ?? []
        requests = try c.decodeIfPresent([CrewDayCardDTO].self, forKey: .requests) ?? []
        past = try c.decodeIfPresent([CrewDayCardDTO].self, forKey: .past) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case upcoming, requests, past
    }
}
