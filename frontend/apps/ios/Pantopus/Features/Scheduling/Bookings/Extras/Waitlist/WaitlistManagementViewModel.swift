//
//  WaitlistManagementViewModel.swift
//  Pantopus
//
//  Stream I9 — E13 Waitlist (host management surface). Lists the event type's
//  waitlist (`GET /event-types/:id/waitlist`) over a capacity header (seats from
//  the event type's `seat_cap`) and promotes entries
//  (`POST /waitlist/:id/promote` — which notifies the invitee a spot opened).
//

import Observation
import SwiftUI

@Observable
@MainActor
final class WaitlistManagementViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case empty
        case error(message: String)
    }

    let owner: SchedulingOwner
    let eventTypeId: String
    let push: @MainActor (SchedulingRoute) -> Void

    private(set) var phase: Phase = .loading
    private(set) var seatTotal = 0
    /// Seated/confirmed count for the event. `nil` when the host waitlist payload
    /// doesn't carry it (the current `{ waitlist }` route is lean — see
    /// deferredBackend). When unknown we treat the event as full (the safe,
    /// non-promoting default) rather than hardcoding the bar to 100%.
    private(set) var seatsFilled: Int?
    private(set) var entries: [RosterPerson] = []
    var actionError: String?

    private let client: SchedulingClient

    init(
        owner: SchedulingOwner,
        eventTypeId: String,
        seatsFilled: Int? = nil,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.seatsFilled = seatsFilled
        self.push = push
        self.client = client
    }

    var waitingCount: Int {
        entries.count
    }

    /// Seats shown as filled on the capacity bar. Unknown ⇒ fall back to the
    /// cap so the bar reads full (matches the conservative `isFull` default).
    var displayedFilled: Int {
        seatsFilled ?? seatTotal
    }

    /// Whether every seat is taken. Drives the capacity bar tone, the section
    /// overline copy, and whether promote is offered. Unknown filled ⇒ full.
    var isFull: Bool {
        guard seatTotal > 0 else { return false }
        return displayedFilled >= seatTotal
    }

    /// Open seats remaining (never negative). `0` when full / unknown.
    var openSeats: Int {
        max(0, seatTotal - displayedFilled)
    }

    /// Section overline: "1 seat open · promote available" / "2 seats open · …"
    /// when there's room, else "All seats filled".
    var sectionOverline: String {
        guard !isFull, openSeats > 0 else { return "All seats filled" }
        let noun = openSeats == 1 ? "seat" : "seats"
        return "\(openSeats) \(noun) open · promote available"
    }

    func load() async {
        if phase != .ready { phase = .loading }
        await fetch(showLoading: phase != .ready)
    }

    func refresh() async {
        await fetch(showLoading: false)
    }

    private func fetch(showLoading: Bool) async {
        if showLoading { phase = .loading }
        do {
            let eventType: EventTypeDetailResponse = try await client.request(
                SchedulingEndpoints.getEventType(owner: owner, id: eventTypeId)
            )
            let waitlistResponse: WaitlistResponse = try await client.request(
                SchedulingEndpoints.getWaitlist(owner: owner, eventTypeId: eventTypeId)
            )

            seatTotal = max(eventType.eventType.seatCap ?? 1, 1)
            let waiting = waitlistResponse.waitlist.filter { ($0.status ?? "waiting") == "waiting" }
            entries = Self.build(waiting)
            phase = entries.isEmpty ? .empty : .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load the waitlist")
        } catch {
            phase = .error(message: "Couldn't load the waitlist")
        }
    }

    private static func build(_ entries: [WaitlistEntryDTO]) -> [RosterPerson] {
        let tz = SchedulingTime.deviceTimeZoneIdentifier
        return entries.enumerated().map { index, entry in
            var meta = "#\(index + 1)"
            if let joined = BookingsExtrasFormatting.shortDay(utcISO: entry.createdAt, tz: tz) {
                meta += " · joined \(joined)"
            }
            return RosterPerson(
                id: entry.id,
                name: entry.inviteeName ?? entry.inviteeEmail ?? "Guest",
                meta: meta,
                statusRaw: nil,
                promoteEntryId: entry.id
            )
        }
    }

    func promote(entryId: String) async {
        actionError = nil
        do {
            let _: SchedulingOkResponse = try await client.request(
                SchedulingEndpoints.promoteWaitlist(owner: owner, entryId: entryId)
            )
            await refresh()
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't promote — try again"
        } catch {
            actionError = "Couldn't promote — try again"
        }
    }
}
