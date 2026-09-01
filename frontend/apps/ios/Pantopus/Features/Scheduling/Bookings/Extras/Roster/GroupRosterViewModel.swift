//
//  GroupRosterViewModel.swift
//  Pantopus
//
//  Stream I9 — E8 Group Event Roster & Seats. There is no dedicated roster
//  endpoint, so the roster is composed client-side: attendees + status from
//  `GET /bookings/:id`, capacity from the event type's `seat_cap`
//  (`GET /event-types/:id`, adjustable via `PUT`), and the waitlist from
//  `GET /event-types/:id/waitlist`. Promote via `POST /waitlist/:id/promote`.
//

import Observation
import SwiftUI

/// A seated attendee or a waitlisted person, flattened for the row view.
struct RosterPerson: Identifiable, Hashable {
    let id: String
    let name: String
    var meta: String?
    let statusRaw: String?
    /// Present for waitlist rows — the entry id to promote.
    var promoteEntryId: String?

    var initials: String {
        BookingsExtrasFormatting.initials(from: name)
    }
}

@Observable
@MainActor
final class GroupRosterViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case empty
        case error(message: String)
    }

    let owner: SchedulingOwner
    let bookingId: String
    let push: @MainActor (SchedulingRoute) -> Void

    private(set) var phase: Phase = .loading
    private(set) var eventTypeId: String?
    private(set) var seatTotal = 0
    private(set) var seated: [RosterPerson] = []
    private(set) var waitlist: [RosterPerson] = []
    private(set) var confirmedCount = 0
    private(set) var pendingCount = 0
    var actionError: String?

    private let client: SchedulingClient

    init(
        owner: SchedulingOwner,
        bookingId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.bookingId = bookingId
        self.push = push
        self.client = client
    }

    var filled: Int {
        seated.count
    }

    var waitingCount: Int {
        waitlist.count
    }

    var isFull: Bool {
        seatTotal > 0 && filled >= seatTotal
    }

    var canAdjustCapacity: Bool {
        eventTypeId != nil
    }

    var nudgeCounts: NudgeAudienceCounts {
        NudgeAudienceCounts(all: filled, confirmed: confirmedCount, noShows: 0)
    }

    /// The whole-booking target for a no-show (group events are one booking row
    /// in this model, so per-attendee no-show isn't separately addressable).
    var noShowTargets: [NoShowTarget] {
        [NoShowTarget(bookingId: bookingId, name: "this booking")]
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
            let detail: BookingDetailResponse = try await client.request(
                SchedulingEndpoints.getBooking(owner: owner, id: bookingId)
            )
            let attendees = detail.attendees ?? []
            eventTypeId = detail.booking.eventTypeId

            var total = attendees.count
            var entries: [WaitlistEntryDTO] = []
            if let id = detail.booking.eventTypeId {
                let eventType: EventTypeDetailResponse = try await client.request(
                    SchedulingEndpoints.getEventType(owner: owner, id: id)
                )
                let waitlistResult: WaitlistResponse = try await client.request(
                    SchedulingEndpoints.getWaitlist(owner: owner, eventTypeId: id)
                )
                total = eventType.eventType.seatCap ?? max(total, 1)
                entries = waitlistResult.waitlist.filter { ($0.status ?? "waiting") == "waiting" }
            }

            seated = Self.buildSeated(attendees)
            confirmedCount = seated.filter { $0.statusRaw == "confirmed" }.count
            pendingCount = seated.filter { $0.statusRaw == "pending" }.count
            waitlist = Self.buildWaitlist(entries)
            seatTotal = max(total, filled)

            phase = (seated.isEmpty && waitlist.isEmpty) ? .empty : .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load the roster")
        } catch {
            phase = .error(message: "Couldn't load the roster")
        }
    }

    private static func buildSeated(_ attendees: [BookingAttendeeDTO]) -> [RosterPerson] {
        attendees.compactMap { attendee in
            let rsvp = attendee.rsvpStatus ?? "going"
            guard rsvp != "declined" else { return nil }
            let status = rsvp == "going" ? "confirmed" : "pending"
            return RosterPerson(
                id: attendee.id ?? attendee.email ?? UUID().uuidString,
                name: attendee.name ?? attendee.email ?? "Guest",
                meta: nil,
                statusRaw: status,
                promoteEntryId: nil
            )
        }
    }

    private static func buildWaitlist(_ entries: [WaitlistEntryDTO]) -> [RosterPerson] {
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
                statusRaw: "waitlisted",
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

    func adjustCapacity(by delta: Int) async {
        guard let eventTypeId else { return }
        let newCap = max(filled, max(1, seatTotal + delta))
        guard newCap != seatTotal else { return }
        let previous = seatTotal
        seatTotal = newCap // optimistic
        actionError = nil
        do {
            let _: EventTypeResponse = try await client.request(
                SchedulingEndpoints.updateEventType(owner: owner, id: eventTypeId, UpdateEventTypeRequest(seatCap: newCap))
            )
        } catch {
            seatTotal = previous // revert
            actionError = "Couldn't update capacity — try again"
        }
    }

    func openShareLink() {
        push(.bookingPageManagement(owner: owner))
    }

    func openAddAttendee() {
        push(.manualBooking(owner: owner))
    }
}
