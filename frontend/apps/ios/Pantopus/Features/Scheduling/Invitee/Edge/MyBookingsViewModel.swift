//
//  MyBookingsViewModel.swift
//  Pantopus
//
//  D11 My Bookings — customer (Stream I7). Reads `GET /api/scheduling/my-bookings`
//  (the signed-in user's bookings across all owners), dedupes by booking id,
//  splits into Upcoming / Past around now, and groups each segment into the
//  design's time buckets. The endpoint returns lean booking rows (no joined
//  event-type / host names or manage token), so rows render the owner pillar,
//  the local time, and the status honestly. Tokens only.
//

import SwiftUI

/// A titled group of bookings under one overline.
struct BookingGroup: Identifiable, Equatable {
    let id: String
    let title: String
    var attention: Bool = false
    let bookings: [BookingDTO]
}

@Observable
@MainActor
final class MyBookingsViewModel {
    enum Segment: Equatable { case upcoming, past }

    enum State: Equatable {
        case loading
        case loaded
        case empty
        case error(message: String)
    }

    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var upcomingGroups: [BookingGroup] = []
    private(set) var pastGroups: [BookingGroup] = []
    var segment: Segment = .upcoming
    private var didLoad = false
    private var isFetching = false

    init(
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.push = push
        self.client = client
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    /// Whether the currently-selected segment has any rows.
    var hasContentForSegment: Bool {
        switch segment {
        case .upcoming: !upcomingGroups.isEmpty
        case .past: !pastGroups.isEmpty
        }
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        state = .loading
        do {
            let response: BookingsResponse = try await client.request(SchedulingEndpoints.getMyBookings())
            apply(response.bookings)
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "We couldn't load your bookings.")
        } catch {
            state = .error(message: "We couldn't load your bookings.")
        }
    }

    private func apply(_ bookings: [BookingDTO]) {
        // Dedupe by id (the backend dedupes too; this is defense in depth).
        var seen = Set<String>()
        let unique = bookings.filter { seen.insert($0.id).inserted }

        let now = Date()
        let upcoming = unique
            .filter { startDate($0).map { $0 >= now } ?? true }
            .sorted { (startDate($0) ?? .distantFuture) < (startDate($1) ?? .distantFuture) }
        let past = unique
            .filter { startDate($0).map { $0 < now } ?? false }
            .sorted { (startDate($0) ?? .distantPast) > (startDate($1) ?? .distantPast) }

        upcomingGroups = groupUpcoming(upcoming, now: now)
        pastGroups = groupPast(past, now: now)
        state = (upcomingGroups.isEmpty && pastGroups.isEmpty) ? .empty : .loaded
    }

    // MARK: - Grouping

    private func groupUpcoming(_ bookings: [BookingDTO], now: Date) -> [BookingGroup] {
        let needsAttention = bookings.filter { isPending($0) }
        let scheduled = bookings.filter { !isPending($0) }
        let calendar = Calendar(identifier: .gregorian)
        let today = calendar.startOfDay(for: now)

        var thisWeek: [BookingDTO] = []
        var nextWeek: [BookingDTO] = []
        var later: [BookingDTO] = []
        for booking in scheduled {
            let days = dayOffset(startDate(booking), from: today, calendar: calendar)
            switch days {
            case ..<7: thisWeek.append(booking)
            case 7..<14: nextWeek.append(booking)
            default: later.append(booking)
            }
        }

        var groups: [BookingGroup] = []
        if !needsAttention.isEmpty {
            groups.append(BookingGroup(id: "attention", title: "Needs attention", attention: true, bookings: needsAttention))
        }
        if !thisWeek.isEmpty { groups.append(BookingGroup(id: "this-week", title: "This week", bookings: thisWeek)) }
        if !nextWeek.isEmpty { groups.append(BookingGroup(id: "next-week", title: "Next week", bookings: nextWeek)) }
        if !later.isEmpty { groups.append(BookingGroup(id: "later", title: "Later", bookings: later)) }
        return groups
    }

    private func groupPast(_ bookings: [BookingDTO], now: Date) -> [BookingGroup] {
        let calendar = Calendar(identifier: .gregorian)
        let today = calendar.startOfDay(for: now)
        var thisMonth: [BookingDTO] = []
        var earlier: [BookingDTO] = []
        for booking in bookings {
            let daysAgo = -dayOffset(startDate(booking), from: today, calendar: calendar)
            if daysAgo <= 30 { thisMonth.append(booking) } else { earlier.append(booking) }
        }
        var groups: [BookingGroup] = []
        if !thisMonth.isEmpty { groups.append(BookingGroup(id: "this-month", title: "This month", bookings: thisMonth)) }
        if !earlier.isEmpty { groups.append(BookingGroup(id: "earlier", title: "Earlier", bookings: earlier)) }
        return groups
    }

    private func isPending(_ booking: BookingDTO) -> Bool {
        booking.status.lowercased() == "pending"
    }

    private func startDate(_ booking: BookingDTO) -> Date? {
        booking.startAt.flatMap(SchedulingTime.parseUTC)
    }

    private func dayOffset(_ date: Date?, from origin: Date, calendar: Calendar) -> Int {
        guard let date else { return Int.max }
        let day = calendar.startOfDay(for: date)
        return calendar.dateComponents([.day], from: origin, to: day).day ?? Int.max
    }
}

#if DEBUG
extension MyBookingsViewModel {
    static func previewLoaded() -> MyBookingsViewModel {
        let viewModel = MyBookingsViewModel(push: { _ in }, client: .shared)
        let json = #"""
        {"bookings":[
          {"id":"b1","owner_type":"user","status":"confirmed",
           "start_at":"2026-06-18T21:00:00Z","invitee_name":"Maya Chen",
           "invitee_timezone":"America/Los_Angeles"},
          {"id":"b2","owner_type":"business","status":"pending",
           "start_at":"2026-06-19T17:00:00Z","invitee_name":"Maya Chen",
           "invitee_timezone":"America/Los_Angeles"},
          {"id":"b3","owner_type":"home","status":"completed",
           "start_at":"2026-06-01T16:00:00Z","invitee_name":"Maya Chen",
           "invitee_timezone":"America/Los_Angeles"}
        ]}
        """#
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(BookingsResponse.self, from: data) {
            viewModel.apply(response.bookings)
        }
        viewModel.didLoad = true
        return viewModel
    }

    static func previewEmpty() -> MyBookingsViewModel {
        let viewModel = MyBookingsViewModel(push: { _ in }, client: .shared)
        viewModel.state = .empty
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
