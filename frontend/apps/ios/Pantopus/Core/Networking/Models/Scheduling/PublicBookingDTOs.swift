//
//  PublicBookingDTOs.swift
//  Pantopus
//
//  DTOs for the PUBLIC invitee booking flow — route `/api/public/book*` and
//  `/api/public/booking/:token*` (all `authenticated:false`). Slug = booking
//  PAGE slug. `manageToken` is returned once on create — PERSIST it. See
//  `reference/calendarly-backend-api.md` → Public Scheduling Booking Flow.
//

import Foundation

/// The public-facing booking-page view (subset of `BookingPageDTO`).
public struct PublicPageView: Decodable, Sendable, Hashable {
    public let slug: String?
    public let title: String?
    public let tagline: String?
    public let avatarURL: String?
    public let intro: String?
    public let timezone: String?
    public let branding: JSONValue?
    public let ownerType: String?
    public let cancellationPolicy: JSONValue?
    public let confirmationMessage: String?

    enum CodingKeys: String, CodingKey {
        case slug
        case title
        case tagline
        case avatarURL = "avatar_url"
        case intro
        case timezone
        case branding
        case ownerType = "owner_type"
        case cancellationPolicy = "cancellation_policy"
        case confirmationMessage = "confirmation_message"
    }
}

/// The public-facing event-type view (only safe fields; no host eligibility).
public struct PublicEventTypeView: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let slug: String?
    public let description: String?
    public let color: String?
    public let durations: [Int]?
    public let defaultDuration: Int?
    public let locationMode: String?
    public let locationDetail: String?
    public let priceCents: Int?
    public let currency: String?
    public let depositCents: Int?
    public let depositRefundable: Bool?
    public let refundPolicy: String?
    public let cancellationWindowMin: Int?
    public let rescheduleCutoffMin: Int?
    public let requiresApproval: Bool?
    public let questions: [EventTypeQuestionDTO]?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case description
        case color
        case durations
        case defaultDuration = "default_duration"
        case locationMode = "location_mode"
        case locationDetail = "location_detail"
        case priceCents = "price_cents"
        case currency
        case depositCents = "deposit_cents"
        case depositRefundable = "deposit_refundable"
        case refundPolicy = "refund_policy"
        case cancellationWindowMin = "cancellation_window_min"
        case rescheduleCutoffMin = "reschedule_cutoff_min"
        case requiresApproval = "requires_approval"
        case questions
    }
}

/// `GET /api/public/book/:slug` → page + status + event types.
public struct PublicBookView: Decodable, Sendable, Hashable {
    public let page: PublicPageView
    /// `active` | `paused` — render paused honestly (not an error).
    public let status: SchedulingStatus
    public let eventTypes: [PublicEventTypeView]
}

/// `GET /api/public/book/:slug/:eventTypeSlug/slots` → event type + tz + status
/// + slots. Paused pages return `status:'paused'` with empty `slots`.
public struct PublicSlotsResponse: Decodable, Sendable, Hashable {
    public let eventType: PublicEventTypeView
    public let timezone: String?
    public let status: SchedulingStatus
    public let slots: [SlotDTO]
}

/// `GET /api/public/book/o/:token` → one-off link view.
public struct OneOffBookView: Decodable, Sendable, Hashable {
    public let eventType: PublicEventTypeView
    public let singleUse: Bool?
    public let slots: [SlotDTO]

    enum CodingKeys: String, CodingKey {
        case eventType
        case singleUse = "single_use"
        case slots
    }
}

/// Body for `POST /api/public/book/:slug/:eventTypeSlug` and `POST
/// /api/public/book/o/:token` — the invitee commit. Public, so no owner fields.
public struct PublicBookingCreateRequest: Encodable, Sendable {
    public let startAt: String
    public var durationMin: Int?
    public let name: String
    public let email: String
    public var phone: String?
    public var timezone: String?
    /// Dynamic intake answers keyed by question.
    public var answers: JSONValue?

    enum CodingKeys: String, CodingKey {
        case startAt = "start_at"
        case durationMin = "duration_min"
        case name
        case email
        case phone
        case timezone
        case answers
    }

    public init(
        startAt: String,
        name: String,
        email: String,
        durationMin: Int? = nil,
        phone: String? = nil,
        timezone: String? = nil,
        answers: JSONValue? = nil
    ) {
        self.startAt = startAt
        self.name = name
        self.email = email
        self.durationMin = durationMin
        self.phone = phone
        self.timezone = timezone
        self.answers = answers
    }
}

/// The booking shape returned by the public create / manage endpoints.
public struct PublicBookingDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let status: String
    public let startAt: String?
    public let endAt: String?
    public let inviteeName: String?
    public let inviteeTimezone: String?
    public let locationMode: String?
    public let locationDetail: String?
    public let requiresApproval: Bool?
    public let previousStartAt: String?
    public let cancelReason: String?
    public let policySnapshot: JSONValue?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case startAt = "start_at"
        case endAt = "end_at"
        case inviteeName = "invitee_name"
        case inviteeTimezone = "invitee_timezone"
        case locationMode = "location_mode"
        case locationDetail = "location_detail"
        case requiresApproval = "requires_approval"
        case previousStartAt = "previous_start_at"
        case cancelReason = "cancel_reason"
        case policySnapshot = "policy_snapshot"
    }
}

/// Page confirmation fields echoed back on a public create.
public struct PublicCreatePage: Decodable, Sendable, Hashable {
    public let confirmationMessage: String?
    public let timezone: String?

    enum CodingKeys: String, CodingKey {
        case confirmationMessage = "confirmation_message"
        case timezone
    }
}

/// `POST /api/public/book/:slug/:eventTypeSlug` (and one-off) → 201. Carries
/// the one-time `manageToken` (PERSIST it) and `clientSecret` if priced.
public struct PublicBookingCreateResponse: Decodable, Sendable, Hashable {
    public let booking: PublicBookingDTO
    public let eventType: PublicEventTypeView?
    public let page: PublicCreatePage?
    /// The invitee's only handle for manage/reschedule/cancel/.ics — PERSIST it.
    public let manageToken: String
    /// Stripe payment-intent secret when the event type is priced.
    public let clientSecret: String?
}

/// The manage-token actions bundle (computed server-side).
public struct ManageActions: Decodable, Sendable, Hashable {
    public let canCancel: Bool?
    public let canReschedule: Bool?
    public let inviteeCancelAllowed: Bool?
    public let inviteeRescheduleAllowed: Bool?
    public let rescheduleDeadline: String?
    public let freeCancelUntil: String?
    public let refundEstimateCents: Int?

    enum CodingKeys: String, CodingKey {
        case canCancel = "can_cancel"
        case canReschedule = "can_reschedule"
        case inviteeCancelAllowed = "invitee_cancel_allowed"
        case inviteeRescheduleAllowed = "invitee_reschedule_allowed"
        case rescheduleDeadline = "reschedule_deadline"
        case freeCancelUntil = "free_cancel_until"
        case refundEstimateCents = "refund_estimate_cents"
    }
}

/// The manage-token payment bundle (present only when the booking is priced).
public struct ManagePayment: Decodable, Sendable, Hashable {
    public let amountTotal: Int?
    public let currency: String?
    public let paymentStatus: String?
    public let paidAt: String?

    enum CodingKeys: String, CodingKey {
        case amountTotal = "amount_total"
        case currency
        case paymentStatus = "payment_status"
        case paidAt = "paid_at"
    }
}

/// `GET /api/public/booking/:token` → booking + actions + payment + eventType +
/// page. The manage surface (D4).
public struct ManageBookingResponse: Decodable, Sendable, Hashable {
    public let booking: PublicBookingDTO
    public let actions: ManageActions?
    public let payment: ManagePayment?
    public let eventType: PublicEventTypeView?
    public let page: PublicPageView?
}

/// Envelope for the public reschedule / cancel / accept / decline mutations →
/// `{ booking }`.
public struct PublicBookingResponse: Decodable, Sendable, Hashable {
    public let booking: PublicBookingDTO
}

/// Body for `POST /api/public/booking/:token/reschedule`.
public struct PublicRescheduleRequest: Encodable, Sendable {
    public let startAt: String

    enum CodingKeys: String, CodingKey {
        case startAt = "start_at"
    }

    public init(startAt: String) {
        self.startAt = startAt
    }
}

/// Body for `POST /api/public/booking/:token/cancel`.
public struct PublicCancelRequest: Encodable, Sendable {
    public var reason: String?

    public init(reason: String? = nil) {
        self.reason = reason
    }
}

/// Body for `POST /api/public/book/:slug/:eventTypeSlug/waitlist`.
public struct WaitlistJoinRequest: Encodable, Sendable {
    public var name: String?
    public let email: String
    public var desiredFrom: String?
    public var desiredTo: String?

    enum CodingKeys: String, CodingKey {
        case name
        case email
        case desiredFrom = "desired_from"
        case desiredTo = "desired_to"
    }

    public init(
        email: String,
        name: String? = nil,
        desiredFrom: String? = nil,
        desiredTo: String? = nil
    ) {
        self.email = email
        self.name = name
        self.desiredFrom = desiredFrom
        self.desiredTo = desiredTo
    }
}

/// `POST /api/public/book/:slug/:eventTypeSlug/waitlist` → 201 `{ waitlist }`.
public struct WaitlistJoinResponse: Decodable, Sendable, Hashable {
    public let waitlist: WaitlistJoinEntry

    public struct WaitlistJoinEntry: Decodable, Sendable, Hashable {
        public let id: String
        public let status: String?
    }
}
