//
//  PerEventTypePerformanceViewModel.swift
//  Pantopus
//
//  H10 Per-Event-Type Performance (Stream I17). Drills into one event type's
//  funnel + stats, derived from its bookings over the window plus the event-type
//  header (name / duration / price). States: loaded / empty (never booked) /
//  loading / error.
//
//  Wiring: `GET /event-types/:id` (header) + `GET /bookings?event_type_id&from&to`
//  (the funnel/stat aggregation). Page-views are not in the backend, so the
//  funnel starts at Booked rather than fabricating a views step.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class PerEventTypePerformanceViewModel {
    enum Phase: Equatable { case loading, loaded, empty, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let eventTypeId: String
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var filter = InsightsFilter.default
    var showFilterSheet = false

    private(set) var eventType: EventTypeDTO?
    private(set) var bookings: [BookingDTO] = []

    // MARK: Chrome

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    init(
        owner: SchedulingOwner,
        eventTypeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        let range = filter.range()
        do {
            let detail: EventTypeDetailResponse = try await client.request(
                SchedulingEndpoints.getEventType(owner: owner, id: eventTypeId)
            )
            eventType = detail.eventType

            async let bookingsR: BookingsResponse? = try? client.request(
                SchedulingEndpoints.getBookings(owner: owner, eventTypeId: eventTypeId, from: range.from, to: range.to)
            )
            bookings = await (bookingsR)?.bookings ?? []

            phase = bookings.isEmpty ? .empty : .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load performance.")
        } catch {
            phase = .error("Couldn't load performance.")
        }
    }

    func refresh() async {
        await load()
    }

    func apply(_ newFilter: InsightsFilter) async {
        filter = newFilter
        await load()
    }

    func openFilter() {
        showFilterSheet = true
    }

    // MARK: Derived

    var title: String {
        eventType?.name ?? "Performance"
    }

    var durationLabel: String {
        let minutes = eventType?.defaultDuration ?? eventType?.durations.first
        return InsightsFormat.duration(min: minutes)
    }

    var priceLabel: String {
        InsightsFormat.money(cents: eventType?.priceCents, currency: eventType?.currency) ?? "Free"
    }

    private var perf: EventTypePerf {
        InsightsMath.eventTypePerf(bookings: bookings)
    }

    var tiles: [MetricTile] {
        [
            MetricTile(id: "booked", label: "Booked", value: "\(perf.booked)"),
            MetricTile(id: "completed", label: "Completed", value: "\(perf.completed)"),
            MetricTile(id: "completion", label: "Completion", value: InsightsFormat.percent(perf.completionRate)),
            MetricTile(id: "noshow", label: "No-show", value: InsightsFormat.percent(perf.noShowRate))
        ]
    }

    /// Funnel steps Booked → Completed → No-show, proportioned against Booked.
    var funnel: [FunnelStep] {
        let booked = max(perf.booked, 1)
        return [
            FunnelStep(id: "booked", label: "Booked", count: perf.booked, proportion: 1, percent: nil),
            FunnelStep(
                id: "completed",
                label: "Completed",
                count: perf.completed,
                proportion: Double(perf.completed) / Double(booked),
                percent: InsightsFormat.percent(fraction: Double(perf.completed) / Double(booked))
            ),
            FunnelStep(
                id: "noshow",
                label: "No-show",
                count: perf.noShow,
                proportion: Double(perf.noShow) / Double(booked),
                percent: InsightsFormat.percent(fraction: Double(perf.noShow) / Double(booked))
            )
        ]
    }

    var dayBars: [DayBar] {
        InsightsMath.dailyBars(bookings: bookings, tz: SchedulingTime.deviceTimeZoneIdentifier, days: filter.days(), maxBars: 14)
    }

    var hasTrend: Bool {
        bookings.count >= 3
    }

    struct FunnelStep: Identifiable, Hashable {
        let id: String
        let label: String
        let count: Int
        let proportion: Double
        let percent: String?
    }

    // MARK: Navigation

    func openEditor() {
        push(.eventTypeEditor(owner: owner, eventTypeId: eventTypeId))
    }

    func openBookingPage() {
        push(.bookingPageManagement(owner: owner))
    }
}
