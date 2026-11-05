//
//  CrewDayBookingDTOs.swift
//  Pantopus
//
//  Crew Day (launch cut #13): the household's booking page (screen 5),
//  `GET /api/crew-days/bookings/:bookingId` and `{ booking }` from every
//  booking write (02-contract.md §4 "Household", SRV-3). Fields later
//  server slices fill (photos, problem, proposal) decode as optional.
//

import Foundation

/// The household's booking page.
public struct CrewDayBookingDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let crewDay: Day
    /// `price_pending`, `price_offered`, `booked`, `new_dates`, `on_the_way`, `done`, `paid`, `payment_failed`,
    /// `refunded`, `cancelled` or `declined`.
    public let status: String
    public let steps: [Step]
    public let serviceDate: String?
    public let windowStart: String?
    public let windowEnd: String?
    public let windowStartsAt: String?
    public let eta: Eta?
    public let gateReadyAt: String?
    public let cantGetInAt: String?
    public let prepNote: String?
    public let accessNote: String?
    public let address: Address?
    public let option: Choice?
    public let addOns: [CrewDayAddOn]
    public let priceCents: Int?
    public let card: Card?
    public let cancelCutoffAt: String?
    public let canCancel: Bool
    public let canChange: Bool
    public let canAskRelease: Bool
    public let releaseAskedAt: String?
    public let charge: Charge?
    public let invoiceId: String?
    public let doneAt: String?
    public let doneNote: String?
    public let photos: [String]
    public let householdConfirmedAt: String?
    public let remindNextSeason: Bool
    public let cancelledBy: String?
    public let share: Share?

    public struct Day: Decodable, Sendable, Hashable {
        public let id: String
        public let code: String?
        public let title: String
        public let service: String?
        public let streetLabel: String?
        public let timezone: String?
        public let status: String?
        public let included: [String]?
        public let outsideOnly: Bool?
        public let crew: CrewDayCrewDTO?

        private enum CodingKeys: String, CodingKey {
            case id, code, title, service, timezone, status, included, crew
            case streetLabel = "street_label"
            case outsideOnly = "outside_only"
        }
    }

    /// One of Booked · On the way · Done · Paid (`label` "Requested" while the price is pending).
    public struct Step: Decodable, Sendable, Hashable {
        public let key: String
        public let label: String
        /// `done`, `current` or `todo`.
        public let state: String
    }

    public struct Eta: Decodable, Sendable, Hashable {
        public let start: String?
        public let end: String?
        public let updatedAt: String?

        private enum CodingKeys: String, CodingKey {
            case start, end
            case updatedAt = "updated_at"
        }
    }

    public struct Address: Decodable, Sendable, Hashable {
        public let line: String?
        public let city: String?
        public let state: String?
        public let zip: String?
    }

    public struct Choice: Decodable, Sendable, Hashable {
        public let id: String
        public let label: String
    }

    public struct Card: Decodable, Sendable, Hashable {
        public let brand: String?
        public let last4: String?
    }

    public struct Charge: Decodable, Sendable, Hashable {
        /// `not_yet`, `scheduled`, `paused`, `charged`, `partially_refunded`, `refunded`, `failed` or `none`.
        public let state: String?
        public let amountCents: Int?
        public let dueAt: String?
        public let paidAt: String?
        public let refundedCents: Int?
        public let failure: String?

        private enum CodingKeys: String, CodingKey {
            case state, failure
            case amountCents = "amount_cents"
            case dueAt = "due_at"
            case paidAt = "paid_at"
            case refundedCents = "refunded_cents"
        }
    }

    public struct Share: Decodable, Sendable, Hashable {
        public let url: String?
        public let flyerURL: String?
        public let message: String?
        public let bookedCount: Int?
        public let spotsLeft: Int?

        private enum CodingKeys: String, CodingKey {
            case url, message
            case flyerURL = "flyer_url"
            case bookedCount = "booked_count"
            case spotsLeft = "spots_left"
        }
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        crewDay = try c.decode(Day.self, forKey: .crewDay)
        status = try c.decode(String.self, forKey: .status)
        steps = try c.decodeIfPresent([Step].self, forKey: .steps) ?? []
        serviceDate = try c.decodeIfPresent(String.self, forKey: .serviceDate)
        windowStart = try c.decodeIfPresent(String.self, forKey: .windowStart)
        windowEnd = try c.decodeIfPresent(String.self, forKey: .windowEnd)
        windowStartsAt = try c.decodeIfPresent(String.self, forKey: .windowStartsAt)
        eta = try c.decodeIfPresent(Eta.self, forKey: .eta)
        gateReadyAt = try c.decodeIfPresent(String.self, forKey: .gateReadyAt)
        cantGetInAt = try c.decodeIfPresent(String.self, forKey: .cantGetInAt)
        prepNote = try c.decodeIfPresent(String.self, forKey: .prepNote)
        accessNote = try c.decodeIfPresent(String.self, forKey: .accessNote)
        address = try c.decodeIfPresent(Address.self, forKey: .address)
        option = try c.decodeIfPresent(Choice.self, forKey: .option)
        addOns = try c.decodeIfPresent([CrewDayAddOn].self, forKey: .addOns) ?? []
        priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
        card = try c.decodeIfPresent(Card.self, forKey: .card)
        cancelCutoffAt = try c.decodeIfPresent(String.self, forKey: .cancelCutoffAt)
        canCancel = try c.decodeIfPresent(Bool.self, forKey: .canCancel) ?? false
        canChange = try c.decodeIfPresent(Bool.self, forKey: .canChange) ?? false
        canAskRelease = try c.decodeIfPresent(Bool.self, forKey: .canAskRelease) ?? false
        releaseAskedAt = try c.decodeIfPresent(String.self, forKey: .releaseAskedAt)
        charge = try c.decodeIfPresent(Charge.self, forKey: .charge)
        invoiceId = try c.decodeIfPresent(String.self, forKey: .invoiceId)
        doneAt = try c.decodeIfPresent(String.self, forKey: .doneAt)
        doneNote = try c.decodeIfPresent(String.self, forKey: .doneNote)
        photos = (try? c.decodeIfPresent([String].self, forKey: .photos)) ?? []
        householdConfirmedAt = try c.decodeIfPresent(String.self, forKey: .householdConfirmedAt)
        remindNextSeason = try c.decodeIfPresent(Bool.self, forKey: .remindNextSeason) ?? false
        cancelledBy = try c.decodeIfPresent(String.self, forKey: .cancelledBy)
        share = try c.decodeIfPresent(Share.self, forKey: .share)
    }

    private enum CodingKeys: String, CodingKey {
        case id, status, steps, eta, address, option, card, charge, photos, share
        case crewDay = "crew_day"
        case serviceDate = "service_date"
        case windowStart = "window_start"
        case windowEnd = "window_end"
        case windowStartsAt = "window_starts_at"
        case gateReadyAt = "gate_ready_at"
        case cantGetInAt = "cant_get_in_at"
        case prepNote = "prep_note"
        case accessNote = "access_note"
        case addOns = "add_ons"
        case priceCents = "price_cents"
        case cancelCutoffAt = "cancel_cutoff_at"
        case canCancel = "can_cancel"
        case canChange = "can_change"
        case canAskRelease = "can_ask_release"
        case releaseAskedAt = "release_asked_at"
        case invoiceId = "invoice_id"
        case doneAt = "done_at"
        case doneNote = "done_note"
        case householdConfirmedAt = "household_confirmed_at"
        case remindNextSeason = "remind_next_season"
        case cancelledBy = "cancelled_by"
    }
}

/// `{ booking }` from a booking write.
public struct CrewDayBookingWriteResponse: Decodable, Sendable {
    public let booking: CrewDayBookingDTO
}
