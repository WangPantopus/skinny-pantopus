//
//  AvailabilityScheduleListViewModel.swift
//  Pantopus
//
//  Stream I3 — B4 Availability Schedule List. Backs the screen via
//  `ListOfRowsDataSource`. Reads the personal availability composite
//  (`GET /api/scheduling/availability`) and manages schedules: set-default,
//  rename, duplicate (clones rules), delete (guards 409
//  `CANNOT_DELETE_DEFAULT`). Availability is ALWAYS personal — no owner.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class AvailabilityScheduleListViewModel: ListOfRowsDataSource {
    // MARK: ListOfRowsDataSource chrome

    var title: String {
        "Availability"
    }

    var topBarAction: TopBarAction? {
        TopBarAction(icon: .plus, accessibilityLabel: "New schedule") { [weak self] in
            Task { @MainActor in await self?.createSchedule() }
        }
    }

    var tabs: [ListOfRowsTab] {
        []
    }

    var selectedTab: String = ""
    var fab: FABAction? {
        nil
    }

    private(set) var state: ListOfRowsState = .loading

    // MARK: Bespoke display projection

    //
    // The design renders each schedule as its own standalone white card (16pt
    // radius, 36pt icon tile, vertical-ellipsis kebab) with a 10pt gap and a
    // boxed info note in the single-schedule frame — geometry the shared
    // ListOfRowsView `.card` shell can't express (it merges rows into one
    // grouped card with hairline dividers). The bespoke view consumes this
    // projection; `state` above is retained for the data-source protocol.

    /// Render phase for the bespoke schedule-list view.
    enum DisplayPhase: Equatable {
        case loading
        case loaded(rows: [ScheduleRowDisplay])
        case empty
        case error(message: String)
    }

    /// One schedule row's display fields.
    struct ScheduleRowDisplay: Identifiable, Equatable {
        let id: String
        let name: String
        let summary: String
        let timezone: String
        let isDefault: Bool
    }

    private(set) var displayPhase: DisplayPhase = .loading

    // MARK: Local UI state (driven from the View)

    /// Schedule whose overflow menu is open.
    var menuTarget: AvailabilityScheduleDTO?
    /// Schedule being renamed (drives the rename alert).
    var renameTarget: AvailabilityScheduleDTO?
    var renameText: String = ""
    /// Schedule pending delete confirmation.
    var deleteTarget: AvailabilityScheduleDTO?
    /// Transient blocking-error message (e.g. can't delete the default).
    var actionError: String?
    /// True while a mutation (create/rename/delete) is in flight.
    private(set) var isMutating = false

    // MARK: Dependencies + data

    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var schedules: [AvailabilityScheduleDTO] = []
    private var rules: [AvailabilityRuleDTO] = []

    init(
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.push = push
        self.client = client
    }

    private var isLoaded: Bool {
        if case .loaded = state { return true }
        return false
    }

    // MARK: Load

    func load() async {
        await fetch(showLoading: !isLoaded)
    }

    func refresh() async {
        await fetch(showLoading: false)
    }

    func loadMoreIfNeeded() async {}

    private func fetch(showLoading: Bool) async {
        if showLoading {
            state = .loading
            displayPhase = .loading
        }
        do {
            let response: AvailabilityResponse = try await client.request(SchedulingEndpoints.getAvailability())
            schedules = response.schedules
            rules = response.rules
            rebuild()
        } catch let error as SchedulingError {
            let message = error.userMessage ?? "Couldn't load your availability."
            state = .error(message: message)
            displayPhase = .error(message: message)
        } catch {
            state = .error(message: "Couldn't load your availability.")
            displayPhase = .error(message: "Couldn't load your availability.")
        }
    }

    // MARK: Mutations

    /// "+" — create a fresh schedule and open its editor.
    func createSchedule() async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            let request = CreateScheduleRequest(
                timezone: SchedulingTime.deviceTimeZoneIdentifier,
                name: "New schedule"
            )
            let response: AvailabilityScheduleResponse = try await client.request(
                SchedulingEndpoints.createSchedule(request)
            )
            await fetch(showLoading: false)
            push(.weeklyHoursEditor(scheduleId: response.schedule.id))
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't create a schedule."
        } catch {
            actionError = "Couldn't create a schedule."
        }
    }

    /// Empty-state CTA — seed a default 9–5, Mon–Fri schedule.
    func createDefaultSchedule() async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            let request = CreateScheduleRequest(
                timezone: SchedulingTime.deviceTimeZoneIdentifier,
                name: "Working hours",
                isDefault: true
            )
            let response: AvailabilityScheduleResponse = try await client.request(
                SchedulingEndpoints.createSchedule(request)
            )
            let weekdayRules = [1, 2, 3, 4, 5].map { weekday in
                RulesRequest.Rule(weekday: weekday, startTime: TimeOfDay.nineAM.hhmm, endTime: TimeOfDay.fivePM.hhmm)
            }
            _ = try? await client.request(
                SchedulingEndpoints.setRules(scheduleId: response.schedule.id, RulesRequest(rules: weekdayRules)),
                as: RulesResponse.self
            )
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't create your schedule."
        } catch {
            actionError = "Couldn't create your schedule."
        }
    }

    func setDefault(_ schedule: AvailabilityScheduleDTO) async {
        await mutate {
            _ = try await self.client.request(
                SchedulingEndpoints.updateSchedule(id: schedule.id, UpdateScheduleRequest(isDefault: true)),
                as: AvailabilityScheduleResponse.self
            )
        }
    }

    func commitRename() async {
        guard let target = renameTarget else { return }
        let name = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        renameTarget = nil
        guard !name.isEmpty, name != target.name else { return }
        await mutate {
            _ = try await self.client.request(
                SchedulingEndpoints.updateSchedule(id: target.id, UpdateScheduleRequest(name: name)),
                as: AvailabilityScheduleResponse.self
            )
        }
    }

    func duplicate(_ schedule: AvailabilityScheduleDTO) async {
        let sourceRules = rules.filter { $0.scheduleId == schedule.id }
        await mutate {
            let request = CreateScheduleRequest(
                timezone: schedule.timezone ?? SchedulingTime.deviceTimeZoneIdentifier,
                name: "\(schedule.name ?? "Schedule") (copy)"
            )
            let created: AvailabilityScheduleResponse = try await self.client.request(
                SchedulingEndpoints.createSchedule(request)
            )
            guard !sourceRules.isEmpty else { return }
            let cloned = sourceRules.map { rule in
                RulesRequest.Rule(weekday: rule.weekday, startTime: rule.startTime, endTime: rule.endTime)
            }
            _ = try await self.client.request(
                SchedulingEndpoints.setRules(scheduleId: created.schedule.id, RulesRequest(rules: cloned)),
                as: RulesResponse.self
            )
        }
    }

    func confirmDelete() async {
        guard let target = deleteTarget else { return }
        deleteTarget = nil
        await mutate {
            try await self.client.send(SchedulingEndpoints.deleteSchedule(id: target.id))
        }
    }

    /// Shared mutate→refetch wrapper that surfaces the typed conflict message
    /// (e.g. `CANNOT_DELETE_DEFAULT`) on the action-error alert.
    private func mutate(_ body: @escaping () async throws -> Void) async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            try await body()
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? Self.fallbackMessage(for: error)
        } catch {
            actionError = "Something went wrong. Please try again."
        }
    }

    private static func fallbackMessage(for error: SchedulingError) -> String {
        if error.code == "CANNOT_DELETE_DEFAULT" {
            return "Make another schedule your default before deleting this one."
        }
        return "Something went wrong. Please try again."
    }

    // MARK: Row building

    private func rebuild() {
        guard !schedules.isEmpty else {
            state = .empty(.init(
                icon: .calendarClock,
                headline: "You don't have a schedule yet",
                subcopy: "Set the hours you're open to bookings. Your home and business pages build from this.",
                ctaTitle: "Add working hours"
            ) { [weak self] in Task { @MainActor in await self?.createDefaultSchedule() } })
            displayPhase = .empty
            return
        }
        displayPhase = .loaded(rows: schedules.map { schedule in
            let scheduleRules = rules.filter { $0.scheduleId == schedule.id }
            return ScheduleRowDisplay(
                id: schedule.id,
                name: schedule.name ?? "Schedule",
                summary: AvailabilitySummary.summarize(rules: scheduleRules),
                timezone: Self.timezoneAbbreviation(schedule.timezone),
                isDefault: schedule.isDefault == true
            )
        })
        let rows = schedules.map { schedule -> RowModel in
            let scheduleRules = rules.filter { $0.scheduleId == schedule.id }
            let summary = AvailabilitySummary.summarize(rules: scheduleRules)
            let tz = Self.timezoneAbbreviation(schedule.timezone)
            let subtitle = tz.isEmpty ? summary : "\(summary) · \(tz)"
            let isDefault = schedule.isDefault == true
            let scheduleId = schedule.id
            return RowModel(
                id: scheduleId,
                title: schedule.name ?? "Schedule",
                subtitle: subtitle,
                template: .fileChevron,
                leading: .typeIcon(
                    .calendarClock,
                    background: Theme.Color.primary50,
                    foreground: Theme.Color.primary600
                ),
                trailing: .kebab,
                onTap: { [weak self] in Task { @MainActor in self?.push(.weeklyHoursEditor(scheduleId: scheduleId)) } },
                onSecondary: { [weak self] in Task { @MainActor in self?.openMenu(schedule) } },
                inlineChip: isDefault
                    ? RowChip(
                        text: "Default",
                        tint: .custom(background: Theme.Color.primary600, foreground: Theme.Color.appTextInverse)
                    )
                    : nil
            )
        }
        // Single-schedule frame: the design shows a footnote explaining the
        // list is skipped — opening Availability drops straight into the editor.
        let footnote = schedules.count == 1
            ? "With one schedule, this list is skipped — opening Availability drops you straight into the editor."
            : nil
        state = .loaded(
            sections: [RowSection(id: "schedules", footer: footnote, rows: rows, style: .card)],
            hasMore: false
        )
    }

    private func openMenu(_ schedule: AvailabilityScheduleDTO) {
        menuTarget = schedule
    }

    // MARK: Id-based entrypoints for the bespoke list view

    /// Open the weekly-hours editor for a schedule id.
    func openEditor(id: String) {
        push(.weeklyHoursEditor(scheduleId: id))
    }

    /// Open the overflow menu for a schedule id.
    func openMenu(id: String) {
        guard let schedule = schedules.first(where: { $0.id == id }) else { return }
        menuTarget = schedule
    }

    func beginRename(_ schedule: AvailabilityScheduleDTO) {
        renameText = schedule.name ?? ""
        renameTarget = schedule
    }

    private static func timezoneAbbreviation(_ identifier: String?) -> String {
        guard let identifier, let zone = TimeZone(identifier: identifier) else { return "" }
        return zone.abbreviation() ?? identifier
    }
}
