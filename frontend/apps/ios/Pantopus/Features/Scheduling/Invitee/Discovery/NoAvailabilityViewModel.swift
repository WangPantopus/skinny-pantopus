//
//  NoAvailabilityViewModel.swift
//  Pantopus
//
//  C8 Slot / No-Availability State (Stream I5) — the routed standalone calm
//  state for the invitee picker. The inline no-availability / day-full states
//  live inside C6 (the Foundation `SlotPicker`); this surface is the dedicated
//  full screen reached when a horizon has nothing open. It offers next-horizon
//  paging and, on finding a month with times, hands to C6 — never a dead end.
//  `status:'paused'` stays a calm state, not an error.
//

import SwiftUI

@Observable
@MainActor
final class NoAvailabilityViewModel {
    enum State: Equatable {
        case loading
        /// No open times in the currently-scanned month.
        case noTimes(monthName: String)
        /// A scanned month has open times — offer to view them.
        case found(monthName: String)
        /// `status:'paused'` — calm, not an error.
        case paused
        case error(message: String)
    }

    let slug: String
    let eventTypeSlug: String
    let timezoneId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private var monthAnchor: Date
    private var didLoad = false

    let accent: Color = Theme.Color.primary600

    init(
        slug: String,
        eventTypeSlug: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        timezoneId = tz
        self.push = push
        self.client = client
        monthAnchor = DiscoveryCalendar.calendar(tz: tz).startOfDay(for: Date())
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await evaluate()
    }

    func refresh() async {
        await evaluate()
    }

    func seeNextMonth() async {
        let cal = DiscoveryCalendar.calendar(tz: timezoneId)
        guard let next = cal.date(byAdding: .month, value: 1, to: monthAnchor) else { return }
        monthAnchor = next
        await evaluate()
    }

    /// "Get notified when times open" — design's terminal `fullyBooked` notify
    /// affordance. View-only stub; the waitlist/notify subscription is deferred
    /// backend.
    func notifyWhenAvailable() {
        // Deferred: subscribe the invitee to a new-times notification.
    }

    /// Hand off to C6 so the booker can pick from the open times.
    func openPicker() {
        push(.inviteeSlotPicker(
            slug: slug,
            eventTypeSlug: eventTypeSlug,
            tz: timezoneId,
            oneOffToken: nil
        ))
    }

    private func evaluate() async {
        state = .loading
        let (from, to) = DiscoveryCalendar.monthRange(monthAnchor: monthAnchor, tz: timezoneId)
        do {
            let response: PublicSlotsResponse = try await client.request(
                SchedulingPublicEndpoints.slots(
                    slug: slug, eventTypeSlug: eventTypeSlug, from: from, to: to, tz: timezoneId
                )
            )
            switch response.status {
            case .paused:
                state = .paused
            case .unavailable, .expired:
                state = .error(message: "This link isn't available")
            case .active, .secret, .unknown:
                state = response.slots.isEmpty ? .noTimes(monthName: monthName) : .found(monthName: monthName)
            }
        } catch let error as SchedulingError {
            if case .notFound = error {
                state = .error(message: "This link isn't available")
            } else {
                state = .error(message: error.userMessage ?? "Something went wrong. Try again.")
            }
        } catch {
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    private var monthName: String {
        monthName(monthAnchor)
    }

    /// The month after the currently-scanned one — for the "See {month}" CTA.
    var nextMonthName: String {
        let cal = DiscoveryCalendar.calendar(tz: timezoneId)
        let next = cal.date(byAdding: .month, value: 1, to: monthAnchor) ?? monthAnchor
        return monthName(next)
    }

    private func monthName(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = DiscoveryCalendar.calendar(tz: timezoneId)
        formatter.timeZone = TimeZone(identifier: timezoneId) ?? .current
        formatter.dateFormat = "LLLL"
        return formatter.string(from: date)
    }
}

#if DEBUG
extension NoAvailabilityViewModel {
    /// Fixture-seeded "no open times" state for `#Preview` / screenshots.
    static func previewNoTimes(monthName: String = "June") -> NoAvailabilityViewModel {
        let viewModel = NoAvailabilityViewModel(
            slug: "ada", eventTypeSlug: "intro", tz: "America/Los_Angeles", push: { _ in }, client: .shared
        )
        viewModel.state = .noTimes(monthName: monthName)
        viewModel.didLoad = true
        return viewModel
    }
}
#endif
