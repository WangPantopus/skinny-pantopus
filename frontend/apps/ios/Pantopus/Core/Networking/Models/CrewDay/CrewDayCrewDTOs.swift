//
//  CrewDayCrewDTOs.swift
//  Pantopus
//
//  Crew Day (launch cut #13) reads for the crew: the list of a business's
//  street days with its readiness, fee and service presets, and one day
//  for the crew (02-contract.md §4 "Crew" and "Shapes": the day card).
//

import Foundation

/// The invitation's link and printable flyer.
public struct CrewDayShareDTO: Decodable, Sendable, Hashable {
    public let code: String?
    public let url: String?
    public let flyerURL: String?

    private enum CodingKeys: String, CodingKey {
        case code, url
        case flyerURL = "flyer_url"
    }
}

/// A day card: one street day in the crew's lists, and the base of the crew's day.
public struct CrewDaySummaryDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let title: String
    public let service: String?
    public let serviceLabel: String?
    public let streetLabel: String?
    public let city: String?
    public let state: String?
    public let timezone: String?
    public let serviceDate: String?
    public let windowStart: String?
    public let windowEnd: String?
    public let windowStartsAt: String?
    /// `draft`, `pending_review`, `declined`, `open`, `in_progress`, `done` or `cancelled`.
    public let status: String
    public let capacity: Int
    public let bookedCount: Int
    public let spotsLeft: Int
    public let isFull: Bool
    public let bookingClosesAt: String?
    public let isClosed: Bool
    /// Look-first homes waiting for the crew's price.
    public let priceChecks: Int
    /// Households inside the cutoff asking to be released.
    public let releaseAsks: Int
    public let doneCount: Int
    public let chargedCents: Int
    /// The dates its active bookings are on (rain can split a day), or its own date.
    public let dates: [String]
    /// The operator's note on a declined day.
    public let reviewNote: String?
    public let share: CrewDayShareDTO?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Crew Day"
        service = try c.decodeIfPresent(String.self, forKey: .service)
        serviceLabel = try c.decodeIfPresent(String.self, forKey: .serviceLabel)
        streetLabel = try c.decodeIfPresent(String.self, forKey: .streetLabel)
        city = try c.decodeIfPresent(String.self, forKey: .city)
        state = try c.decodeIfPresent(String.self, forKey: .state)
        timezone = try c.decodeIfPresent(String.self, forKey: .timezone)
        serviceDate = try c.decodeIfPresent(String.self, forKey: .serviceDate)
        windowStart = try c.decodeIfPresent(String.self, forKey: .windowStart)
        windowEnd = try c.decodeIfPresent(String.self, forKey: .windowEnd)
        windowStartsAt = try c.decodeIfPresent(String.self, forKey: .windowStartsAt)
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "draft"
        capacity = try c.decodeIfPresent(Int.self, forKey: .capacity) ?? 0
        bookedCount = try c.decodeIfPresent(Int.self, forKey: .bookedCount) ?? 0
        spotsLeft = try c.decodeIfPresent(Int.self, forKey: .spotsLeft) ?? 0
        isFull = try c.decodeIfPresent(Bool.self, forKey: .isFull) ?? false
        bookingClosesAt = try c.decodeIfPresent(String.self, forKey: .bookingClosesAt)
        isClosed = try c.decodeIfPresent(Bool.self, forKey: .isClosed) ?? false
        priceChecks = try c.decodeIfPresent(Int.self, forKey: .priceChecks) ?? 0
        releaseAsks = try c.decodeIfPresent(Int.self, forKey: .releaseAsks) ?? 0
        doneCount = try c.decodeIfPresent(Int.self, forKey: .doneCount) ?? 0
        chargedCents = try c.decodeIfPresent(Int.self, forKey: .chargedCents) ?? 0
        dates = try c.decodeIfPresent([String].self, forKey: .dates) ?? []
        reviewNote = try c.decodeIfPresent(String.self, forKey: .reviewNote)
        share = try c.decodeIfPresent(CrewDayShareDTO.self, forKey: .share)
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, service, city, state, timezone, status, capacity, dates, share
        case serviceLabel = "service_label"
        case streetLabel = "street_label"
        case serviceDate = "service_date"
        case windowStart = "window_start"
        case windowEnd = "window_end"
        case windowStartsAt = "window_starts_at"
        case bookedCount = "booked_count"
        case spotsLeft = "spots_left"
        case isFull = "is_full"
        case bookingClosesAt = "booking_closes_at"
        case isClosed = "is_closed"
        case priceChecks = "price_checks"
        case releaseAsks = "release_asks"
        case doneCount = "done_count"
        case chargedCents = "charged_cents"
        case reviewNote = "review_note"
    }
}

/// What a business still needs before it can run a Crew Day.
public struct CrewDayReadinessDTO: Decodable, Sendable, Hashable {
    public let published: Bool
    public let payoutsEnabled: Bool
    public let documentsVerified: Bool
    /// The required steps left: `publish_page`, `set_up_payouts`.
    public let missing: [String]

    public var isReady: Bool {
        missing.isEmpty && published && payoutsEnabled
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        published = try c.decodeIfPresent(Bool.self, forKey: .published) ?? false
        payoutsEnabled = try c.decodeIfPresent(Bool.self, forKey: .payoutsEnabled) ?? false
        documentsVerified = try c.decodeIfPresent(Bool.self, forKey: .documentsVerified) ?? false
        missing = try c.decodeIfPresent([String].self, forKey: .missing) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case published, missing
        case payoutsEnabled = "payouts_enabled"
        case documentsVerified = "documents_verified"
    }
}

/// The business's fee on each charge.
public struct CrewDayFeeDTO: Decodable, Sendable, Hashable {
    /// Percent: 10 for a founding business, 15 for home services.
    public let ratePct: Double?
    public let founding: Bool?

    private enum CodingKeys: String, CodingKey {
        case founding
        case ratePct = "rate_pct"
    }
}

/// A service's presets for New Crew Day.
public struct CrewDayServicePresetDTO: Decodable, Sendable, Hashable {
    public let key: String
    public let label: String?
    public let dayTitle: String?
    public let included: [String]?

    private enum CodingKeys: String, CodingKey {
        case key, label, included
        case dayTitle = "day_title"
    }
}

/// `GET /api/crew-days/business/:businessId`.
public struct CrewDayBusinessResponse: Decodable, Sendable, Hashable {
    public let readiness: CrewDayReadinessDTO?
    /// The viewer may start, edit, price and cancel (owners and editors).
    public let canEdit: Bool
    public let fee: CrewDayFeeDTO?
    public let services: [CrewDayServicePresetDTO]
    public let today: [CrewDaySummaryDTO]
    public let upcoming: [CrewDaySummaryDTO]
    public let pending: [CrewDaySummaryDTO]
    public let drafts: [CrewDaySummaryDTO]
    public let past: [CrewDaySummaryDTO]

    public var isEmpty: Bool {
        today.isEmpty && upcoming.isEmpty && pending.isEmpty && drafts.isEmpty && past.isEmpty
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        readiness = try c.decodeIfPresent(CrewDayReadinessDTO.self, forKey: .readiness)
        canEdit = try c.decodeIfPresent(Bool.self, forKey: .canEdit) ?? false
        fee = try c.decodeIfPresent(CrewDayFeeDTO.self, forKey: .fee)
        services = try c.decodeIfPresent([CrewDayServicePresetDTO].self, forKey: .services) ?? []
        today = try c.decodeIfPresent([CrewDaySummaryDTO].self, forKey: .today) ?? []
        upcoming = try c.decodeIfPresent([CrewDaySummaryDTO].self, forKey: .upcoming) ?? []
        pending = try c.decodeIfPresent([CrewDaySummaryDTO].self, forKey: .pending) ?? []
        drafts = try c.decodeIfPresent([CrewDaySummaryDTO].self, forKey: .drafts) ?? []
        past = try c.decodeIfPresent([CrewDaySummaryDTO].self, forKey: .past) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case readiness, fee, services, today, upcoming, pending, drafts, past
        case canEdit = "can_edit"
    }
}

/// The crew's money on a day (gross of every priced home, the crew's share after the fee).
public struct CrewDayMoneyDTO: Decodable, Sendable, Hashable {
    public let grossCents: Int?
    /// Percent kept by Pantopus.
    public let feeRate: Double?
    public let netCents: Int?
    public let chargedCents: Int?
    public let scheduledCents: Int?
    public let pausedCents: Int?

    private enum CodingKeys: String, CodingKey {
        case grossCents = "gross_cents"
        case feeRate = "fee_rate"
        case netCents = "net_cents"
        case chargedCents = "charged_cents"
        case scheduledCents = "scheduled_cents"
        case pausedCents = "paused_cents"
    }
}

/// `GET /api/crew-days/:id/crew` (and `{ crew_day }` from the crew's writes): the day card, the whole form, and
/// what the viewer may change.
public struct CrewDayCrewDayDTO: Decodable, Sendable, Hashable, Identifiable {
    public let card: CrewDaySummaryDTO
    public let businessUserId: String?
    public let center: CrewDayPoint?
    public let radiusM: Int?
    public let cancelCutoffAt: String?
    public let included: [String]
    public let outsideOnly: Bool
    public let prepNote: String?
    public let priceOptions: [CrewDayPriceOption]
    public let addOns: [CrewDayAddOn]
    public let priceFromCents: Int?
    public let cancelReason: String?
    public let cancelledBy: String?
    public let canEdit: Bool
    public let editableFields: [String]
    public let money: CrewDayMoneyDTO?

    public var id: String {
        card.id
    }

    public init(from decoder: Decoder) throws {
        card = try CrewDaySummaryDTO(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        businessUserId = try c.decodeIfPresent(String.self, forKey: .businessUserId)
        center = try c.decodeIfPresent(CrewDayPoint.self, forKey: .center)
        radiusM = try c.decodeIfPresent(Int.self, forKey: .radiusM)
        cancelCutoffAt = try c.decodeIfPresent(String.self, forKey: .cancelCutoffAt)
        included = try c.decodeIfPresent([String].self, forKey: .included) ?? []
        outsideOnly = try c.decodeIfPresent(Bool.self, forKey: .outsideOnly) ?? true
        prepNote = try c.decodeIfPresent(String.self, forKey: .prepNote)
        priceOptions = try c.decodeIfPresent([CrewDayPriceOption].self, forKey: .priceOptions) ?? []
        addOns = try c.decodeIfPresent([CrewDayAddOn].self, forKey: .addOns) ?? []
        priceFromCents = try c.decodeIfPresent(Int.self, forKey: .priceFromCents)
        cancelReason = try c.decodeIfPresent(String.self, forKey: .cancelReason)
        cancelledBy = try c.decodeIfPresent(String.self, forKey: .cancelledBy)
        canEdit = try c.decodeIfPresent(Bool.self, forKey: .canEdit) ?? false
        editableFields = try c.decodeIfPresent([String].self, forKey: .editableFields) ?? []
        money = try c.decodeIfPresent(CrewDayMoneyDTO.self, forKey: .money)
    }

    private enum CodingKeys: String, CodingKey {
        case center, included, money
        case businessUserId = "business_user_id"
        case radiusM = "radius_m"
        case cancelCutoffAt = "cancel_cutoff_at"
        case outsideOnly = "outside_only"
        case prepNote = "prep_note"
        case priceOptions = "price_options"
        case addOns = "add_ons"
        case priceFromCents = "price_from_cents"
        case cancelReason = "cancel_reason"
        case cancelledBy = "cancelled_by"
        case canEdit = "can_edit"
        case editableFields = "editable_fields"
    }
}

/// A write that changed one day answers `{ crew_day }`.
public struct CrewDayWriteResponse: Decodable, Sendable {
    public let crewDay: CrewDayCrewDayDTO

    private enum CodingKeys: String, CodingKey {
        case crewDay = "crew_day"
    }
}
