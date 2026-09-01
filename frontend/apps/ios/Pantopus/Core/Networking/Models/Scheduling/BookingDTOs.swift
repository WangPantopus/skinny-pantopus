//
//  BookingDTOs.swift
//  Pantopus
//
//  DTOs for the host bookings surface + lifecycle — route
//  `/api/scheduling/bookings*`. See `reference/calendarly-backend-api.md`.
//

import Foundation

/// A booking row (host view). Resource bookings have `event_type_id = null`.
public struct BookingDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let ownerType: String?
    public let ownerId: String?
    public let eventTypeId: String?
    /// `pending` | `confirmed` | `cancelled` | `declined` | `completed` | `no_show`.
    public let status: String
    public let startAt: String?
    public let endAt: String?
    public let inviteeName: String?
    public let inviteeEmail: String?
    public let inviteeUserId: String?
    public let inviteeTimezone: String?
    public let hostUserId: String?
    public let paymentId: String?
    public let packageCreditId: String?
    public let intakeAnswers: JSONValue?
    public let noShowFeeApplied: Bool?
    public let refundIssued: Bool?
    public let previousStartAt: String?
    public let cancelReason: String?
    public let createdVia: String?
    public let createdAt: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case ownerType = "owner_type"
        case ownerId = "owner_id"
        case eventTypeId = "event_type_id"
        case status
        case startAt = "start_at"
        case endAt = "end_at"
        case inviteeName = "invitee_name"
        case inviteeEmail = "invitee_email"
        case inviteeUserId = "invitee_user_id"
        case inviteeTimezone = "invitee_timezone"
        case hostUserId = "host_user_id"
        case paymentId = "payment_id"
        case packageCreditId = "package_credit_id"
        case intakeAnswers = "intake_answers"
        case noShowFeeApplied = "no_show_fee_applied"
        case refundIssued = "refund_issued"
        case previousStartAt = "previous_start_at"
        case cancelReason = "cancel_reason"
        case createdVia = "created_via"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// A booking attendee row (per-user RSVP within a booking).
public struct BookingAttendeeDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String?
    public let bookingId: String?
    public let userId: String?
    public let email: String?
    public let name: String?
    /// `going` | `maybe` | `declined` | `pending`.
    public let rsvpStatus: String?
    public let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case bookingId = "booking_id"
        case userId = "user_id"
        case email
        case name
        case rsvpStatus = "rsvp_status"
        case updatedAt = "updated_at"
    }
}

/// Minimal event-type metadata returned in booking detail.
public struct BookingEventTypeMetaDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let name: String?
    public let locationMode: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case locationMode = "location_mode"
    }
}

/// `GET /bookings` → `{ bookings }`.
public struct BookingsResponse: Decodable, Sendable, Hashable {
    public let bookings: [BookingDTO]
}

/// `GET /bookings/:id` → booking + attendees + minimal event type.
public struct BookingDetailResponse: Decodable, Sendable, Hashable {
    public let booking: BookingDTO
    public let attendees: [BookingAttendeeDTO]?
    public let eventType: BookingEventTypeMetaDTO?
}

/// Envelope for the single-booking mutations (approve / decline / cancel /
/// reschedule / reassign / no-show / propose-reschedule / create) → `{ booking }`.
public struct BookingResponse: Decodable, Sendable, Hashable {
    public let booking: BookingDTO
    public let attendees: [BookingAttendeeDTO]?

    enum CodingKeys: String, CodingKey {
        case booking
        case attendees
    }
}

/// `POST /bookings/recurring` → `{ bookings }`.
public struct RecurringBookingsResponse: Decodable, Sendable, Hashable {
    public let bookings: [BookingDTO]
}

/// `POST /bookings/:id/apply-credit` → `{ ok, remaining }`.
public struct ApplyCreditResponse: Decodable, Sendable, Hashable {
    public let ok: Bool
    public let remaining: Int?
}

/// `POST /bookings/:id/rsvp` → `{ attendee }`.
public struct BookingRsvpResponse: Decodable, Sendable, Hashable {
    public let attendee: BookingAttendeeDTO
}

// MARK: - Request bodies

/// Body for `POST /bookings` (manual host booking). Owner fields spliced in by
/// the endpoint builder via `OwnerScopedBody`.
public struct CreateBookingRequest: Encodable, Sendable {
    public let eventTypeId: String
    public let startAt: String
    public var durationMin: Int?
    public var inviteeName: String?
    public var inviteeEmail: String?
    public var inviteePhone: String?
    public var inviteeTimezone: String?
    public var intakeAnswers: JSONValue?

    enum CodingKeys: String, CodingKey {
        case eventTypeId = "event_type_id"
        case startAt = "start_at"
        case durationMin = "duration_min"
        case inviteeName = "invitee_name"
        case inviteeEmail = "invitee_email"
        case inviteePhone = "invitee_phone"
        case inviteeTimezone = "invitee_timezone"
        case intakeAnswers = "intake_answers"
    }

    public init(
        eventTypeId: String,
        startAt: String,
        durationMin: Int? = nil,
        inviteeName: String? = nil,
        inviteeEmail: String? = nil,
        inviteePhone: String? = nil,
        inviteeTimezone: String? = nil,
        intakeAnswers: JSONValue? = nil
    ) {
        self.eventTypeId = eventTypeId
        self.startAt = startAt
        self.durationMin = durationMin
        self.inviteeName = inviteeName
        self.inviteeEmail = inviteeEmail
        self.inviteePhone = inviteePhone
        self.inviteeTimezone = inviteeTimezone
        self.intakeAnswers = intakeAnswers
    }
}

/// Body for `POST /bookings/recurring`. Owner fields spliced in by the builder.
public struct RecurringBookingRequest: Encodable, Sendable {
    public let eventTypeId: String
    /// 1–52 ISO session start times.
    public let sessions: [String]
    public var inviteeName: String?
    public var inviteeEmail: String?
    public var inviteeTimezone: String?

    enum CodingKeys: String, CodingKey {
        case eventTypeId = "event_type_id"
        case sessions
        case inviteeName = "invitee_name"
        case inviteeEmail = "invitee_email"
        case inviteeTimezone = "invitee_timezone"
    }

    public init(
        eventTypeId: String,
        sessions: [String],
        inviteeName: String? = nil,
        inviteeEmail: String? = nil,
        inviteeTimezone: String? = nil
    ) {
        self.eventTypeId = eventTypeId
        self.sessions = sessions
        self.inviteeName = inviteeName
        self.inviteeEmail = inviteeEmail
        self.inviteeTimezone = inviteeTimezone
    }
}

/// Body for `POST /bookings/:id/decline` and `…/cancel`.
public struct BookingReasonRequest: Encodable, Sendable {
    public var reason: String?

    public init(reason: String? = nil) {
        self.reason = reason
    }
}

/// Body for `POST /bookings/:id/reschedule`.
public struct RescheduleBookingRequest: Encodable, Sendable {
    public let startAt: String
    public var hostUserId: String?
    public var reason: String?

    enum CodingKeys: String, CodingKey {
        case startAt = "start_at"
        case hostUserId = "host_user_id"
        case reason
    }

    public init(startAt: String, hostUserId: String? = nil, reason: String? = nil) {
        self.startAt = startAt
        self.hostUserId = hostUserId
        self.reason = reason
    }
}

/// Body for `POST /bookings/:id/propose-reschedule`.
public struct ProposeRescheduleRequest: Encodable, Sendable {
    public let startAt: String
    public var hostUserId: String?

    enum CodingKeys: String, CodingKey {
        case startAt = "start_at"
        case hostUserId = "host_user_id"
    }

    public init(startAt: String, hostUserId: String? = nil) {
        self.startAt = startAt
        self.hostUserId = hostUserId
    }
}

/// Body for `POST /bookings/:id/reassign`.
public struct ReassignBookingRequest: Encodable, Sendable {
    public let hostUserId: String
    public var reason: String?

    enum CodingKeys: String, CodingKey {
        case hostUserId = "host_user_id"
        case reason
    }

    public init(hostUserId: String, reason: String? = nil) {
        self.hostUserId = hostUserId
        self.reason = reason
    }
}

/// Body for `POST /bookings/:id/nudge`.
public struct NudgeRequest: Encodable, Sendable {
    public var message: String?

    public init(message: String? = nil) {
        self.message = message
    }
}

/// Body for `POST /bookings/:id/rsvp`.
public struct BookingRsvpRequest: Encodable, Sendable {
    /// `going` | `maybe` | `declined` | `pending`.
    public let status: String

    public init(status: String) {
        self.status = status
    }
}

/// Body for `POST /bookings/:id/apply-credit`.
public struct ApplyCreditRequest: Encodable, Sendable {
    public let creditId: String

    enum CodingKeys: String, CodingKey {
        case creditId = "credit_id"
    }

    public init(creditId: String) {
        self.creditId = creditId
    }
}
