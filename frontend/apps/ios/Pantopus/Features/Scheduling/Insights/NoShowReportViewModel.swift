//
//  NoShowReportViewModel.swift
//  Pantopus
//
//  H11 No-Show & Cancellation Report (Stream I17). Read-only reliability report
//  over a date window: headline no-show rate, a stacked Honored / Late-cancel /
//  No-show breakdown, a recent-no-shows list (with repeat-offender flags), and a
//  "set a policy" callout. States: loaded / celebratory-empty (zero no-shows) /
//  loading / error.
//
//  Wiring: `GET /insights/no-shows?days` (deployed shape: window_days /
//  completed / no_show / cancelled / no_show_rate / recent_no_shows) +
//  `GET /event-types` for the recent rows' event-type names.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class NoShowReportViewModel {
    enum Phase: Equatable { case loading, loaded, celebratory, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var filter = InsightsFilter.default
    var showFilterSheet = false

    private(set) var report: InsightsNoShowReport?
    private(set) var eventTypes: [EventTypeDTO] = []

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
            let reportResult: InsightsNoShowReport = try await client.request(
                SchedulingEndpoints.noShowInsights(owner: owner, days: days)
            )
            report = reportResult
            async let typesR: EventTypesResponse? = try? client.request(SchedulingEndpoints.getEventTypes(owner: owner))
            eventTypes = await (typesR)?.eventTypes ?? []
            phase = (reportResult.noShow ?? 0) == 0 ? .celebratory : .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load the report.")
        } catch {
            phase = .error("Couldn't load the report.")
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

    private var eventTypeNames: [String: String] {
        Dictionary(eventTypes.map { ($0.id, $0.name) }) { first, _ in first }
    }

    var windowDays: Int {
        report?.windowDays ?? filter.days()
    }

    var totalConsidered: Int {
        (report?.completed ?? 0) + (report?.noShow ?? 0) + (report?.cancelled ?? 0)
    }

    var noShowRateLabel: String {
        InsightsFormat.percent(report?.noShowRate)
    }

    var subLabel: String {
        "of \(totalConsidered) booking\(totalConsidered == 1 ? "" : "s") in \(windowDays) days"
    }

    var segments: [BreakdownSegment] {
        InsightsMath.breakdown(
            completed: report?.completed ?? 0,
            cancelled: report?.cancelled ?? 0,
            noShow: report?.noShow ?? 0
        )
    }

    /// A recent no-show row, projected with the event-type name + a repeat flag.
    struct RecentRow: Identifiable, Hashable {
        let id: String
        let name: String
        let detail: String
        let isRepeat: Bool
    }

    var recentRows: [RecentRow] {
        let raw = report?.recentNoShows ?? []
        let repeats = InsightsMath.repeatOffenders(raw)
        let tz = SchedulingTime.deviceTimeZoneIdentifier
        return raw.map { row in
            let name = row.inviteeName ?? "Guest"
            let typeName = row.eventTypeId.flatMap { eventTypeNames[$0] }
            let day = InsightsFormat.dayLabel(iso: row.startAt, tz: tz)
            let detail = [typeName, day.isEmpty ? nil : day].compactMap { $0 }.joined(separator: " · ")
            return RecentRow(
                id: row.id,
                name: name,
                detail: detail.isEmpty ? "No-show" : detail,
                isRepeat: repeats.contains(name)
            )
        }
    }

    // MARK: Navigation

    func openPolicy() {
        push(.cancellationPolicyEditor(owner: owner, eventTypeId: nil))
    }
}
