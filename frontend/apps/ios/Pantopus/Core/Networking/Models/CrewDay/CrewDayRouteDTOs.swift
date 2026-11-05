//
//  CrewDayRouteDTOs.swift
//  Pantopus
//
//  Crew Day (launch cut #13) reads for the crew on and before the day
//  (02-contract.md §4 "Crew", SRV-3 to SRV-6): the crew's homes with the
//  privacy rule ("Home 3 · Two stories" until 6 PM the evening before, then
//  the address, first name and access note), what needs the crew, the route
//  for one date, and the rain proposal with each home's answer.
//

import Foundation

/// One home as the crew sees it now. The address, first name, household and access note are nil outside the job
/// window (a home waiting on a price check shows its address at once, never its note).
public struct CrewDayHomeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    /// "Home 3", or "Cancelled home".
    public let label: String
    /// "Two stories · clean the gutter guards".
    public let details: String
    public let priceCents: Int?
    public let status: String
    public let serviceDate: String?
    public let windowStart: String?
    public let windowEnd: String?
    public let addressVisible: Bool
    public let address: Address?
    public let firstName: String?
    /// The household's account, to open a conversation (job window only).
    public let householdUserId: String?
    public let accessNote: String?
    public let routePosition: Int?
    public let eta: CrewDayBookingDTO.Eta?
    public let gateReadyAt: String?
    public let cantGetInAt: String?
    public let releaseAskedAt: String?
    public let doneAt: String?
    public let photoCount: Int
    /// `not_yet`, `scheduled`, `paused`, `charged`, `partially_refunded`, `refunded`, `failed` or `none`.
    public let chargeState: String?
    public let chargeDueAt: String?
    public let problem: CrewDayBookingDTO.Problem?
    public let newDateChoice: NewDateChoice?
    /// The route read adds the photos and the crew's note.
    public let photos: [CrewDayPhoto]
    public let doneNote: String?
    /// When the household booked (a price check: when it asked).
    public let createdAt: String?

    public struct Address: Decodable, Sendable, Hashable {
        public let line: String?
        public let city: String?
        public let state: String?
        public let zip: String?
        public let latitude: Double?
        public let longitude: Double?
    }

    /// A household's answer to a rain proposal: a date, or `cancel`.
    public struct NewDateChoice: Decodable, Sendable, Hashable {
        public let proposalId: String?
        public let date: String?

        private enum CodingKeys: String, CodingKey {
            case date
            case proposalId = "proposal_id"
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        label = try c.decodeIfPresent(String.self, forKey: .label) ?? "Home"
        details = try c.decodeIfPresent(String.self, forKey: .details) ?? ""
        priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "booked"
        serviceDate = try c.decodeIfPresent(String.self, forKey: .serviceDate)
        windowStart = try c.decodeIfPresent(String.self, forKey: .windowStart)
        windowEnd = try c.decodeIfPresent(String.self, forKey: .windowEnd)
        addressVisible = try c.decodeIfPresent(Bool.self, forKey: .addressVisible) ?? false
        address = try? c.decodeIfPresent(Address.self, forKey: .address)
        firstName = try c.decodeIfPresent(String.self, forKey: .firstName)
        householdUserId = try c.decodeIfPresent(String.self, forKey: .householdUserId)
        accessNote = try c.decodeIfPresent(String.self, forKey: .accessNote)
        routePosition = try c.decodeIfPresent(Int.self, forKey: .routePosition)
        eta = try? c.decodeIfPresent(CrewDayBookingDTO.Eta.self, forKey: .eta)
        gateReadyAt = try c.decodeIfPresent(String.self, forKey: .gateReadyAt)
        cantGetInAt = try c.decodeIfPresent(String.self, forKey: .cantGetInAt)
        releaseAskedAt = try c.decodeIfPresent(String.self, forKey: .releaseAskedAt)
        doneAt = try c.decodeIfPresent(String.self, forKey: .doneAt)
        photoCount = try c.decodeIfPresent(Int.self, forKey: .photoCount) ?? 0
        chargeState = try c.decodeIfPresent(String.self, forKey: .chargeState)
        chargeDueAt = try c.decodeIfPresent(String.self, forKey: .chargeDueAt)
        problem = try? c.decodeIfPresent(CrewDayBookingDTO.Problem.self, forKey: .problem)
        newDateChoice = try? c.decodeIfPresent(NewDateChoice.self, forKey: .newDateChoice)
        photos = (try? c.decodeIfPresent([CrewDayPhoto].self, forKey: .photos)) ?? []
        doneNote = try c.decodeIfPresent(String.self, forKey: .doneNote)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    }

    private enum CodingKeys: String, CodingKey {
        case id, label, details, status, address, eta, problem, photos
        case priceCents = "price_cents"
        case serviceDate = "service_date"
        case windowStart = "window_start"
        case windowEnd = "window_end"
        case addressVisible = "address_visible"
        case firstName = "first_name"
        case householdUserId = "household_user_id"
        case accessNote = "access_note"
        case routePosition = "route_position"
        case gateReadyAt = "gate_ready_at"
        case cantGetInAt = "cant_get_in_at"
        case releaseAskedAt = "release_asked_at"
        case doneAt = "done_at"
        case photoCount = "photo_count"
        case chargeState = "charge_state"
        case chargeDueAt = "charge_due_at"
        case newDateChoice = "new_date_choice"
        case doneNote = "done_note"
        case createdAt = "created_at"
    }
}

/// `{ booking }` from a crew write on one home (price, release, on the way, can't get in, done).
public struct CrewDayHomeWriteResponse: Decodable, Sendable {
    public let booking: CrewDayHomeDTO
}

/// `GET /api/crew-days/:id/crew`: the day (`CrewDayCrewDayDTO`) and what the crew works from: what needs it, the
/// homes, the rain proposal, the crew's own business (for previews), past customers to invite.
public struct CrewDayCrewPageDTO: Decodable, Sendable, Hashable, Identifiable {
    public let day: CrewDayCrewDayDTO
    public let crew: CrewDayCrewDTO?
    public let pastCustomers: Int
    public let priceChecks: [CrewDayHomeDTO]
    public let releaseAsks: [CrewDayHomeDTO]
    public let bookings: [CrewDayHomeDTO]
    public let ended: [CrewDayHomeDTO]
    public let proposal: Proposal?

    public var id: String {
        day.id
    }

    /// The open rain proposal and how many homes it went to.
    public struct Proposal: Decodable, Sendable, Hashable {
        public let id: String
        public let dates: [CrewDayDateWindow]
        public let deadlineAt: String?
        public let sentAt: String?
        public let homes: Int?

        private enum CodingKeys: String, CodingKey {
            case id, dates, homes
            case deadlineAt = "deadline_at"
            case sentAt = "sent_at"
        }
    }

    private struct NeedsYou: Decodable {
        let priceChecks: [CrewDayHomeDTO]?
        let releaseAsks: [CrewDayHomeDTO]?

        private enum CodingKeys: String, CodingKey {
            case priceChecks = "price_checks"
            case releaseAsks = "release_asks"
        }
    }

    public init(from decoder: Decoder) throws {
        day = try CrewDayCrewDayDTO(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        crew = try? c.decodeIfPresent(CrewDayCrewDTO.self, forKey: .crew)
        pastCustomers = try c.decodeIfPresent(Int.self, forKey: .pastCustomers) ?? 0
        let needs = try? c.decodeIfPresent(NeedsYou.self, forKey: .needsYou)
        priceChecks = needs?.priceChecks ?? []
        releaseAsks = needs?.releaseAsks ?? []
        bookings = (try? c.decodeIfPresent([CrewDayHomeDTO].self, forKey: .bookings)) ?? []
        ended = (try? c.decodeIfPresent([CrewDayHomeDTO].self, forKey: .ended)) ?? []
        proposal = try? c.decodeIfPresent(Proposal.self, forKey: .proposedDates)
    }

    private enum CodingKeys: String, CodingKey {
        case crew, bookings, ended
        case pastCustomers = "past_customers"
        case needsYou = "needs_you"
        case proposedDates = "proposed_dates"
    }
}

/// `{ crew_day }` from a crew write on the day, read as the whole page.
public struct CrewDayCrewPageWriteResponse: Decodable, Sendable {
    public let crewDay: CrewDayCrewPageDTO

    private enum CodingKeys: String, CodingKey {
        case crewDay = "crew_day"
    }
}

/// `GET /api/crew-days/:id/route?date=`: the homes on one date, in the crew's order.
public struct CrewDayRouteDTO: Decodable, Sendable, Hashable {
    public let crewDayId: String
    public let title: String
    public let date: String
    /// Every date the day's homes are on (rain can split a day).
    public let dates: [String]
    public let timezone: String?
    public let windowStart: String?
    public let windowEnd: String?
    public let total: Int
    public let done: Int
    public let homes: [CrewDayHomeDTO]

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        crewDayId = try c.decode(String.self, forKey: .crewDayId)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Crew Day"
        date = try c.decode(String.self, forKey: .date)
        dates = try c.decodeIfPresent([String].self, forKey: .dates) ?? []
        timezone = try c.decodeIfPresent(String.self, forKey: .timezone)
        windowStart = try c.decodeIfPresent(String.self, forKey: .windowStart)
        windowEnd = try c.decodeIfPresent(String.self, forKey: .windowEnd)
        total = try c.decodeIfPresent(Int.self, forKey: .total) ?? 0
        done = try c.decodeIfPresent(Int.self, forKey: .done) ?? 0
        homes = try c.decodeIfPresent([CrewDayHomeDTO].self, forKey: .homes) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case title, date, dates, timezone, total, done, homes
        case crewDayId = "crew_day_id"
        case windowStart = "window_start"
        case windowEnd = "window_end"
    }
}

/// `POST /:id/running-late` → the homes it moved and the route after the move.
public struct CrewDayRunningLateResponse: Decodable, Sendable {
    public let minutes: Int?
    public let moved: Int?
    public let route: CrewDayRouteDTO?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        minutes = try c.decodeIfPresent(Int.self, forKey: .minutes)
        // `moved` is a count or the moved homes' ids.
        moved = (try? c.decodeIfPresent(Int.self, forKey: .moved))
            ?? (try? c.decodeIfPresent([String].self, forKey: .moved))?.count
        route = try? c.decodeIfPresent(CrewDayRouteDTO.self, forKey: .route)
    }

    private enum CodingKeys: String, CodingKey {
        case minutes, moved, route
    }
}

/// `POST /:id/invite-past` → how many households were invited.
public struct CrewDayInvitedResponse: Decodable, Sendable {
    public let invited: Int

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        invited = (try? c.decodeIfPresent(Int.self, forKey: .invited))
            ?? (try? c.decodeIfPresent([String].self, forKey: .invited))?.count ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case invited
    }
}
