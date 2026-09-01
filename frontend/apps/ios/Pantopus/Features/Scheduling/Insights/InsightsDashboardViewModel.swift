//
//  InsightsDashboardViewModel.swift
//  Pantopus
//
//  H9 Insights Dashboard (Stream I17). The read-only analytics home: headline
//  tiles + a bookings-over-time chart + a ranked top-event-types list + footer
//  links into the no-show report and team performance. Business violet by
//  default; Personal sky when a personal owner views their own page.
//
//  Wiring (honest backend mapping):
//   • Headline + trend + top types ← `GET /bookings/summary` (the deployed
//     `bookingMetricsService.getSummary`, richer than the Foundation DTO —
//     bookingsThisMonth / deltaPct / sparkline / byEventType).
//   • Completion % + no-show % ← `GET /insights/no-shows?days` (period-scoped).
//   • Event-type names ← `GET /event-types`.
//  The page-traffic / UTM / conversion cards in the design have no backend
//  source and are intentionally omitted rather than fabricated.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class InsightsDashboardViewModel {
    enum Phase: Equatable { case loading, loaded, empty, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var filter = InsightsFilter.default
    var showFilterSheet = false

    private(set) var summary: InsightsSummary?
    private(set) var report: InsightsNoShowReport?
    private(set) var eventTypes: [EventTypeDTO] = []

    // MARK: Derived chrome

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    var isBusiness: Bool {
        if case .business = owner { true } else { false }
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        let days = filter.days()
        do {
            let summaryResult: InsightsSummary = try await client.request(SchedulingEndpoints.getBookingsSummary(owner: owner))
            summary = summaryResult

            async let typesR: EventTypesResponse? = try? client.request(SchedulingEndpoints.getEventTypes(owner: owner))
            async let reportR: InsightsNoShowReport? = try? client.request(SchedulingEndpoints.noShowInsights(owner: owner, days: days))
            eventTypes = await (typesR)?.eventTypes ?? []
            report = await reportR

            phase = isEmpty ? .empty : .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load insights.")
        } catch {
            phase = .error("Couldn't load insights.")
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

    // MARK: Derived data

    private var eventTypeNames: [String: String] {
        Dictionary(eventTypes.map { ($0.id, $0.name) }) { first, _ in first }
    }

    private var bookingsThisMonth: Int {
        summary?.bookingsThisMonth ?? 0
    }

    private var upcoming: Int {
        summary?.upcomingCount ?? 0
    }

    private var isEmpty: Bool {
        let noSummary = bookingsThisMonth == 0 && upcoming == 0 && (summary?.byEventType?.isEmpty ?? true)
        let noReport = report.map { ($0.completed ?? 0) + ($0.noShow ?? 0) + ($0.cancelled ?? 0) == 0 } ?? true
        return noSummary && noReport
    }

    private var completionRate: Double? {
        guard let report else { return nil }
        let concluded = (report.completed ?? 0) + (report.noShow ?? 0)
        guard concluded > 0 else { return nil }
        return Double(report.completed ?? 0) / Double(concluded) * 100
    }

    /// The 2×2 headline tiles.
    var tiles: [MetricTile] {
        [
            MetricTile(id: "bookings", label: "This month", value: "\(bookingsThisMonth)", delta: summary?.deltaPct),
            MetricTile(id: "upcoming", label: "Upcoming", value: "\(upcoming)"),
            MetricTile(id: "completion", label: "Completion", value: InsightsFormat.percent(completionRate)),
            MetricTile(id: "noshow", label: "No-show", value: InsightsFormat.percent(report?.noShowRate))
        ]
    }

    var dayBars: [DayBar] {
        InsightsMath.dailyBars(sparkline: summary?.sparkline, maxBars: 14)
    }

    /// True once there are enough bookings to read a trend (suppress otherwise).
    var hasTrend: Bool {
        (summary?.sparkline?.reduce(0) { $0 + ($1.count ?? 0) } ?? 0) >= 3
    }

    var topTypes: [RankedRow] {
        let source: [InsightsSummary.EventTypeCount]? = if filter.eventTypeIds.isEmpty {
            summary?.byEventType
        } else {
            summary?.byEventType?.filter { filter.eventTypeIds.contains($0.eventTypeId ?? "") }
        }
        return InsightsMath.topEventTypes(byEventType: source, names: eventTypeNames, limit: 5)
    }

    var eventTypeOptions: [InsightsFilterOption] {
        eventTypes.map { InsightsFilterOption(id: $0.id, name: $0.name) }
    }

    /// Subtitle for the "No-show report" footer link — the current rate, when known.
    var noShowLinkSubtitle: String {
        if let rate = report?.noShowRate { return "\(InsightsFormat.percent(rate)) no-show rate" }
        return "Track reliability"
    }

    // MARK: Navigation

    func openType(_ id: String) {
        push(.perEventTypePerformance(owner: owner, eventTypeId: id))
    }

    func openNoShowReport() {
        push(.noShowReport(owner: owner))
    }

    func openTeamPerformance() {
        push(.teamPerformance(owner: owner))
    }

    func openBookingPage() {
        push(.bookingPageManagement(owner: owner))
    }
}
