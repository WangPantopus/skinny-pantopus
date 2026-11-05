//
//  CrewDayBodyDTOs.swift
//  Pantopus
//
//  Crew Day (launch cut #13) request bodies, from the build kit's contract
//  (docs/product/crew-day-build/02-contract.md §4). The reads are in
//  `CrewDayDTOs.swift`.
//

import Foundation

/// `POST /public/:code/quote`.
public struct CrewDayQuoteBody: Encodable, Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double
    public let addressLine: String
    public let optionId: String
    public let addOnIds: [String]

    public init(latitude: Double, longitude: Double, addressLine: String, optionId: String, addOnIds: [String]) {
        self.latitude = latitude
        self.longitude = longitude
        self.addressLine = addressLine
        self.optionId = optionId
        self.addOnIds = addOnIds
    }

    private enum CodingKeys: String, CodingKey {
        case latitude, longitude
        case addressLine = "address_line"
        case optionId = "option_id"
        case addOnIds = "add_on_ids"
    }
}

/// The address a booking is for (the crew sees it in the job window only).
public struct CrewDayAddressBody: Codable, Sendable, Hashable {
    public let line: String
    public let city: String
    public let state: String
    public let zip: String
    public let latitude: Double
    public let longitude: Double

    public init(line: String, city: String, state: String, zip: String, latitude: Double, longitude: Double) {
        self.line = line
        self.city = city
        self.state = state
        self.zip = zip
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// `POST /:id/bookings`.
public struct CrewDayBookingBody: Encodable, Sendable, Hashable {
    public let clientRequestId: String
    public let homeId: String?
    public let address: CrewDayAddressBody
    public let optionId: String
    public let addOnIds: [String]
    public let accessNote: String?
    public let paymentMethodId: String
    public let approveTerms: Bool

    public init(
        clientRequestId: String,
        homeId: String?,
        address: CrewDayAddressBody,
        optionId: String,
        addOnIds: [String],
        accessNote: String?,
        paymentMethodId: String
    ) {
        self.clientRequestId = clientRequestId
        self.homeId = homeId
        self.address = address
        self.optionId = optionId
        self.addOnIds = addOnIds
        self.accessNote = accessNote
        self.paymentMethodId = paymentMethodId
        approveTerms = true
    }

    private enum CodingKeys: String, CodingKey {
        case address
        case clientRequestId = "client_request_id"
        case homeId = "home_id"
        case optionId = "option_id"
        case addOnIds = "add_on_ids"
        case accessNote = "access_note"
        case paymentMethodId = "payment_method_id"
        case approveTerms = "approve_terms"
    }
}

/// `PATCH /bookings/:bookingId` (nil fields stay as they are).
public struct CrewDayBookingPatch: Encodable, Sendable, Hashable {
    public var accessNote: String?
    public var optionId: String?
    public var addOnIds: [String]?
    public var remindNextSeason: Bool?

    public init(accessNote: String? = nil, optionId: String? = nil, addOnIds: [String]? = nil, remindNextSeason: Bool? = nil) {
        self.accessNote = accessNote
        self.optionId = optionId
        self.addOnIds = addOnIds
        self.remindNextSeason = remindNextSeason
    }

    private enum CodingKeys: String, CodingKey {
        case accessNote = "access_note"
        case optionId = "option_id"
        case addOnIds = "add_on_ids"
        case remindNextSeason = "remind_next_season"
    }
}

public struct CrewDayPriceAnswerBody: Encodable, Sendable, Hashable {
    public let approve: Bool
}

/// "Something needs attention": `kind` is `missed`, `damage`, `no_show`,
/// `charge` or `other`.
public struct CrewDayProblemBody: Encodable, Sendable, Hashable {
    public let kind: String?
    public let note: String
    public let photoPaths: [String]

    public init(kind: String?, note: String, photoPaths: [String]) {
        self.kind = kind
        self.note = note
        self.photoPaths = photoPaths
    }

    private enum CodingKeys: String, CodingKey {
        case kind, note
        case photoPaths = "photo_paths"
    }
}

public struct CrewDayNewDateBody: Encodable, Sendable, Hashable {
    public let proposalId: String
    /// `YYYY-MM-DD` or `cancel`.
    public let choice: String

    private enum CodingKeys: String, CodingKey {
        case choice
        case proposalId = "proposal_id"
    }
}

/// "Ask for a Crew Day on my street". `months` are `YYYY-MM`, or `["any"]`.
public struct CrewDayRequestBody: Encodable, Sendable, Hashable {
    public let service: String
    public let homeId: String
    public let months: [String]
    public let note: String?

    public init(service: String, homeId: String, months: [String], note: String?) {
        self.service = service
        self.homeId = homeId
        self.months = months
        self.note = note
    }

    private enum CodingKeys: String, CodingKey {
        case service, months, note
        case homeId = "home_id"
    }
}

/// A point on the map (the area's center, never shown to households).
public struct CrewDayPoint: Codable, Sendable, Hashable {
    public let latitude: Double
    public let longitude: Double

    public init(latitude: Double, longitude: Double) {
        self.latitude = latitude
        self.longitude = longitude
    }
}

/// `POST /api/crew-days` (New Crew Day).
public struct CrewDayCreateBody: Encodable, Sendable, Hashable {
    public let businessId: String
    public let service: String
    public let streetLabel: String
    public let city: String
    public let state: String
    public let center: CrewDayPoint
    public let radiusM: Int
    public let serviceDate: String
    public let windowStart: String
    public let windowEnd: String
    public let capacity: Int
    public let bookingClosesAt: String?
    public let included: [String]
    public let outsideOnly: Bool
    public let prepNote: String?
    public let priceOptions: [CrewDayPriceOption]
    public let addOns: [CrewDayAddOn]
    public let submit: Bool
    public let repeatOf: String?

    public init(
        businessId: String,
        service: String,
        streetLabel: String,
        city: String,
        state: String,
        center: CrewDayPoint,
        radiusM: Int,
        serviceDate: String,
        windowStart: String,
        windowEnd: String,
        capacity: Int,
        bookingClosesAt: String?,
        included: [String],
        outsideOnly: Bool,
        prepNote: String?,
        priceOptions: [CrewDayPriceOption],
        addOns: [CrewDayAddOn],
        submit: Bool,
        repeatOf: String?
    ) {
        self.businessId = businessId
        self.service = service
        self.streetLabel = streetLabel
        self.city = city
        self.state = state
        self.center = center
        self.radiusM = radiusM
        self.serviceDate = serviceDate
        self.windowStart = windowStart
        self.windowEnd = windowEnd
        self.capacity = capacity
        self.bookingClosesAt = bookingClosesAt
        self.included = included
        self.outsideOnly = outsideOnly
        self.prepNote = prepNote
        self.priceOptions = priceOptions
        self.addOns = addOns
        self.submit = submit
        self.repeatOf = repeatOf
    }

    private enum CodingKeys: String, CodingKey {
        case service, city, state, center, capacity, included, submit
        case businessId = "business_id"
        case streetLabel = "street_label"
        case radiusM = "radius_m"
        case serviceDate = "service_date"
        case windowStart = "window_start"
        case windowEnd = "window_end"
        case bookingClosesAt = "booking_closes_at"
        case outsideOnly = "outside_only"
        case prepNote = "prep_note"
        case priceOptions = "price_options"
        case addOns = "add_ons"
        case repeatOf = "repeat_of"
    }
}

/// `PATCH /api/crew-days/:id` (nil fields stay as they are).
public struct CrewDayUpdateBody: Encodable, Sendable, Hashable {
    public var capacity: Int?
    public var included: [String]?
    public var prepNote: String?
    public var priceOptions: [CrewDayPriceOption]?
    public var addOns: [CrewDayAddOn]?

    public init(
        capacity: Int? = nil,
        included: [String]? = nil,
        prepNote: String? = nil,
        priceOptions: [CrewDayPriceOption]? = nil,
        addOns: [CrewDayAddOn]? = nil
    ) {
        self.capacity = capacity
        self.included = included
        self.prepNote = prepNote
        self.priceOptions = priceOptions
        self.addOns = addOns
    }

    private enum CodingKeys: String, CodingKey {
        case capacity, included
        case prepNote = "prep_note"
        case priceOptions = "price_options"
        case addOns = "add_ons"
    }
}

/// The crew's price for a look-first home, or `decline` with a note.
public struct CrewDaySetPriceBody: Encodable, Sendable, Hashable {
    public let priceCents: Int?
    public let decline: Bool?
    public let note: String?

    public init(priceCents: Int? = nil, decline: Bool? = nil, note: String? = nil) {
        self.priceCents = priceCents
        self.decline = decline
        self.note = note
    }

    private enum CodingKeys: String, CodingKey {
        case decline, note
        case priceCents = "price_cents"
    }
}

/// One new date offered after rain.
public struct CrewDayDateWindow: Codable, Sendable, Hashable {
    public let date: String
    public let windowStart: String
    public let windowEnd: String

    public init(date: String, windowStart: String, windowEnd: String) {
        self.date = date
        self.windowStart = windowStart
        self.windowEnd = windowEnd
    }

    private enum CodingKeys: String, CodingKey {
        case date
        case windowStart = "window_start"
        case windowEnd = "window_end"
    }
}

public struct CrewDayProposeDatesBody: Encodable, Sendable, Hashable {
    public let dates: [CrewDayDateWindow]
    public let note: String?

    public init(dates: [CrewDayDateWindow], note: String?) {
        self.dates = dates
        self.note = note
    }
}

public struct CrewDayReasonBody: Encodable, Sendable, Hashable {
    public let reason: String
}

public struct CrewDayNoteBody: Encodable, Sendable, Hashable {
    public let note: String
}

public struct CrewDayRouteOrderBody: Encodable, Sendable, Hashable {
    public let bookingIds: [String]

    private enum CodingKeys: String, CodingKey {
        case bookingIds = "booking_ids"
    }
}

public struct CrewDayRunningLateBody: Encodable, Sendable, Hashable {
    public let minutes: Int
    public let date: String?
}

public struct CrewDayEtaBody: Encodable, Sendable, Hashable {
    public let etaStart: String
    public let etaEnd: String

    private enum CodingKeys: String, CodingKey {
        case etaStart = "eta_start"
        case etaEnd = "eta_end"
    }
}

public struct CrewDayDoneBody: Encodable, Sendable, Hashable {
    public let photoPaths: [String]
    public let note: String?

    private enum CodingKeys: String, CodingKey {
        case note
        case photoPaths = "photo_paths"
    }
}
