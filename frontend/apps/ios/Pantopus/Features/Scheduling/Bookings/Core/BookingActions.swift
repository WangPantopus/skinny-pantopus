//
//  BookingActions.swift
//  Pantopus
//
//  Stream I8 — the owner-scoped host booking service. One place the inbox (E1),
//  detail (E2), and the approve/decline · reschedule · cancel sheets (E3–E5)
//  reach the `/bookings*` lifecycle endpoints, so 409 conflicts, owner context,
//  and the `{ booking }` envelopes are handled identically everywhere. Returns
//  decoded DTOs / throws the typed `SchedulingError`; the view-models own the
//  optimistic UI + recovery.
//

import Foundation

/// Thin owner-scoped facade over `SchedulingEndpoints` + `SchedulingClient` for
/// the host booking lifecycle. Constructed with the screen's `SchedulingOwner`;
/// every call injects it via the endpoint builders.
struct BookingActions {
    let owner: SchedulingOwner
    private let client: SchedulingClient

    init(owner: SchedulingOwner, client: SchedulingClient = .shared) {
        self.owner = owner
        self.client = client
    }

    // MARK: - Reads

    /// `GET /bookings?status&event_type_id&from&to&q` — the inbox list for the
    /// active tab, optionally narrowed by the E9 filter facets.
    func list(
        status: BookingStatusFilter,
        search: String?,
        eventTypeId: String? = nil,
        from: String? = nil,
        to: String? = nil
    ) async throws -> [BookingDTO] {
        let trimmed = search?.trimmingCharacters(in: .whitespacesAndNewlines)
        let response: BookingsResponse = try await client.request(
            SchedulingEndpoints.getBookings(
                owner: owner,
                status: status.rawValue,
                eventTypeId: eventTypeId,
                from: from,
                to: to,
                search: (trimmed?.isEmpty == false) ? trimmed : nil
            )
        )
        return response.bookings
    }

    /// `GET /bookings/summary` — month counts + delta + sparkline. Note: no
    /// `pendingCount` on the wire; derive Pending badges from the pending list.
    func summary() async throws -> SchedulingSummaryDTO {
        try await client.request(SchedulingEndpoints.getBookingsSummary(owner: owner))
    }

    /// `GET /event-types` → `[id: name]` so inbox rows can show the event title
    /// (the bookings list omits it).
    func eventTypeNames() async throws -> [String: String] {
        let response: EventTypesResponse = try await client.request(SchedulingEndpoints.getEventTypes(owner: owner))
        return Dictionary(response.eventTypes.map { ($0.id, $0.name) }) { first, _ in first }
    }

    /// `GET /bookings/:id` — booking + attendees + minimal event type.
    func detail(id: String) async throws -> BookingDetailResponse {
        try await client.request(SchedulingEndpoints.getBooking(owner: owner, id: id))
    }

    /// `GET /bookings/:id/available-slots?from&to&tz` — reschedule/reassign slots
    /// (excludes the booking being moved). Always passes `tz`.
    func availableSlots(id: String, from: String, to: String, tz: String) async throws -> [SlotDTO] {
        let response: SlotsResponse = try await client.request(
            SchedulingEndpoints.getBookingAvailableSlots(owner: owner, id: id, from: from, to: to, tz: tz)
        )
        return response.slots
    }

    // MARK: - Lifecycle mutations

    /// `POST /bookings/:id/approve` — pending → confirmed.
    func approve(id: String) async throws -> BookingDTO {
        try await mutation(SchedulingEndpoints.approveBooking(owner: owner, id: id))
    }

    /// `POST /bookings/:id/decline` — pending → declined.
    func decline(id: String, reason: String?) async throws -> BookingDTO {
        try await mutation(
            SchedulingEndpoints.declineBooking(owner: owner, id: id, BookingReasonRequest(reason: reason))
        )
    }

    /// `POST /bookings/:id/cancel` — confirmed → cancelled (+ refund logic).
    func cancel(id: String, reason: String?) async throws -> BookingDTO {
        try await mutation(
            SchedulingEndpoints.cancelBooking(owner: owner, id: id, BookingReasonRequest(reason: reason))
        )
    }

    /// `POST /bookings/:id/reschedule` — move to `startAt` (+ optional reassign).
    /// 409 `SLOT_CONFLICT` (→ alternatives) / `PAST_DEADLINE` surfaced as
    /// `SchedulingError`.
    func reschedule(id: String, startAt: String, hostUserId: String? = nil, reason: String? = nil) async throws -> BookingDTO {
        try await mutation(
            SchedulingEndpoints.rescheduleBooking(
                owner: owner,
                id: id,
                RescheduleBookingRequest(startAt: startAt, hostUserId: hostUserId, reason: reason)
            )
        )
    }

    /// `POST /bookings/:id/propose-reschedule` — send the new time for the
    /// invitee to accept (pending proposal).
    func proposeReschedule(id: String, startAt: String, hostUserId: String? = nil) async throws -> BookingDTO {
        try await mutation(
            SchedulingEndpoints.proposeReschedule(
                owner: owner,
                id: id,
                ProposeRescheduleRequest(startAt: startAt, hostUserId: hostUserId)
            )
        )
    }

    /// `POST /bookings/:id/reassign` — home/business only; 409 `INVALID_HOST`.
    func reassign(id: String, hostUserId: String, reason: String? = nil) async throws -> BookingDTO {
        try await mutation(
            SchedulingEndpoints.reassignBooking(
                owner: owner, id: id, ReassignBookingRequest(hostUserId: hostUserId, reason: reason)
            )
        )
    }

    /// `POST /bookings/:id/no-show` — 409 `NOT_APPLICABLE_YET` before event end.
    func markNoShow(id: String) async throws -> BookingDTO {
        try await mutation(SchedulingEndpoints.markNoShow(owner: owner, id: id))
    }

    // MARK: - Helpers

    private func mutation(_ endpoint: Endpoint) async throws -> BookingDTO {
        let response: BookingResponse = try await client.request(endpoint)
        return response.booking
    }
}
