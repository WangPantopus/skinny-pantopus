//
//  MemberWorkingHoursViewModel.swift
//  Pantopus
//
//  G4 Member Working-Hours Editor (Stream I13) — SELF-SERVICE "My booking hours".
//  Per the stream scope correction, `/availability` is hard-scoped to req.user,
//  so a member edits ONLY their own weekly hours (loaded from GET /availability,
//  saved via PUT /availability/:id/rules). Opened from G3: your own row →
//  editable; a teammate's row → read-only (their hours are private). Matches
//  `memberhours-frames.jsx` (editing / override / saving / inherits-readonly /
//  loading). Business violet accent.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MemberWorkingHoursViewModel {
    enum Mode: Equatable {
        case editSelf
        case readOnly(memberName: String)
    }

    enum Phase: Equatable { case loading, ready, error(String) }

    struct DayHours: Identifiable, Hashable {
        let weekday: Int // 0=Sun … 6=Sat
        var ranges: [TimeRange]
        var id: Int {
            weekday
        }
    }

    /// The upcoming dated exception shown above the week grid. Drives both the
    /// biz-tone date-override card (`memberhours` frame 2) and the error-tone
    /// blocked-out / time-off card (frame 3), selected by `isBlocked`.
    struct DatedException: Equatable {
        let title: String
        let sub: String
        /// `true` → time-off (error tone, `ban`); `false` → custom hours
        /// override (biz tone, `calendar-clock`).
        let isBlocked: Bool
    }

    // MARK: Inputs

    let mode: Mode
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var days: [DayHours] = []
    private(set) var scheduleId: String?
    var timezoneId: String = SchedulingTime.deviceTimeZoneIdentifier
    private var loadedTimezone: String = SchedulingTime.deviceTimeZoneIdentifier
    private(set) var upcomingException: DatedException?
    var showTimezoneSheet = false
    private(set) var isSaving = false
    /// Inline save failure rendered in the sheet footer — a silent `return
    /// false` left the spinner stopping with no explanation. Distinguishes
    /// total failure from "hours saved, timezone didn't" partial success.
    private(set) var saveError: String?

    // MARK: Derived

    var isReadOnly: Bool {
        if case .readOnly = mode { true } else { false }
    }

    var readOnlyMemberName: String? {
        if case let .readOnly(name) = mode { name } else { nil }
    }

    var title: String {
        switch mode {
        case .editSelf: "My booking hours"
        case let .readOnly(name): "\(name)'s booking hours"
        }
    }

    var formValid: Bool {
        days.allSatisfy { $0.ranges.allSatisfy(\.isValid) }
    }

    init(mode: Mode, client: SchedulingClient) {
        self.mode = mode
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        if isReadOnly {
            // `/availability` is hard-scoped to req.user, so a teammate's actual
            // hours can't be fetched. Seed the 7-day scaffold so the dimmed
            // read-only "inherits personal" grid (memberhours frame 4) renders
            // its row structure; populating real ranges is a backend follow-up.
            if days.isEmpty {
                days = Weekday.displayOrder.map { DayHours(weekday: $0, ranges: []) }
            }
            phase = .ready
            return
        }
        phase = .loading
        do {
            let response: AvailabilityResponse = try await client.request(SchedulingEndpoints.getAvailability())
            let schedule = response.schedules.first { $0.isDefault == true } ?? response.schedules.first
            guard let schedule else {
                phase = .error("You don't have a working-hours schedule yet.")
                return
            }
            scheduleId = schedule.id
            timezoneId = schedule.timezone ?? SchedulingTime.deviceTimeZoneIdentifier
            loadedTimezone = timezoneId
            days = Self.buildDays(from: response.rules.filter { $0.scheduleId == schedule.id })
            upcomingException = Self.nextException(response.overrides.filter { $0.scheduleId == schedule.id })
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your hours.")
        } catch {
            phase = .error("Couldn't load your hours.")
        }
    }

    // MARK: Editing

    func addRange(weekday: Int) {
        guard let idx = days.firstIndex(where: { $0.weekday == weekday }) else { return }
        let last = days[idx].ranges.last
        let newRange: TimeRange
        if let last, last.end < TimeOfDay(hour: 22, minute: 0) {
            let start = last.end
            let end = TimeOfDay(hour: min(start.hour + 1, 23), minute: start.minute)
            newRange = TimeRange(start: start, end: end > start ? end : TimeOfDay(hour: 23, minute: 0))
        } else {
            newRange = .nineToFive
        }
        days[idx].ranges.append(newRange)
    }

    func removeRange(weekday: Int, id: UUID) {
        guard let idx = days.firstIndex(where: { $0.weekday == weekday }) else { return }
        days[idx].ranges.removeAll { $0.id == id }
    }

    func setStart(weekday: Int, id: UUID, _ time: TimeOfDay) {
        update(weekday: weekday, id: id) { $0.start = time }
    }

    func setEnd(weekday: Int, id: UUID, _ time: TimeOfDay) {
        update(weekday: weekday, id: id) { $0.end = time }
    }

    private func update(weekday: Int, id: UUID, _ mutate: (inout TimeRange) -> Void) {
        guard let dayIdx = days.firstIndex(where: { $0.weekday == weekday }),
              let rangeIdx = days[dayIdx].ranges.firstIndex(where: { $0.id == id }) else { return }
        mutate(&days[dayIdx].ranges[rangeIdx])
    }

    func copyMondayToWeekdays() {
        guard let monday = days.first(where: { $0.weekday == 1 })?.ranges else { return }
        for weekday in [2, 3, 4, 5] {
            guard let idx = days.firstIndex(where: { $0.weekday == weekday }) else { continue }
            days[idx].ranges = monday.map { TimeRange(start: $0.start, end: $0.end) }
        }
    }

    func changeTimezone(_ identifier: String) {
        timezoneId = identifier
    }

    // MARK: Save

    /// Returns true on success so the view can dismiss. The rules PUT and the
    /// timezone PUT are tracked separately so a timezone failure after the
    /// rules landed reports the partial success honestly instead of implying
    /// nothing saved.
    func save() async -> Bool {
        guard let scheduleId, !isSaving, formValid else { return false }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let rules = days.flatMap { day in
                day.ranges.map { RulesRequest.Rule(weekday: day.weekday, startTime: $0.start.hhmm, endTime: $0.end.hhmm) }
            }
            _ = try await client.request(
                SchedulingEndpoints.setRules(scheduleId: scheduleId, RulesRequest(rules: rules)),
                as: RulesResponse.self
            )
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't save your hours. Try again."
            return false
        } catch {
            saveError = "Couldn't save your hours. Try again."
            return false
        }
        if timezoneId != loadedTimezone {
            do {
                _ = try await client.request(
                    SchedulingEndpoints.updateSchedule(id: scheduleId, UpdateScheduleRequest(timezone: timezoneId)),
                    as: AvailabilityScheduleResponse.self
                )
                loadedTimezone = timezoneId
            } catch {
                // The rules PUT already landed — report the partial success.
                saveError = "Your hours were saved, but the timezone change didn't stick. Try saving again."
                return false
            }
        }
        return true
    }

    // MARK: Builders

    private static func buildDays(from rules: [AvailabilityRuleDTO]) -> [DayHours] {
        Weekday.displayOrder.map { weekday in
            let ranges = rules
                .filter { $0.weekday == weekday }
                .compactMap { rule -> TimeRange? in
                    guard let start = TimeOfDay(rule.startTime), let end = TimeOfDay(rule.endTime) else { return nil }
                    return TimeRange(start: start, end: end)
                }
                .sorted { $0.start < $1.start }
            return DayHours(weekday: weekday, ranges: ranges)
        }
    }

    /// The next dated exception, typed so the view can pick the biz-tone
    /// (custom hours) vs error-tone (time off) card per `memberhours` frames
    /// 2 and 3. A fully-unavailable override → blocked-out / time-off card.
    private static func nextException(_ overrides: [AvailabilityOverrideDTO]) -> DatedException? {
        let today = OverrideFormatting.ymdKey(Date())
        let upcoming = overrides.filter { $0.date >= today }.sorted { $0.date < $1.date }
        guard let next = upcoming.first else { return nil }
        let date = OverrideFormatting.displayDate(next.date)
        if next.isUnavailable == true {
            return DatedException(
                title: "\(date) · Time off",
                sub: "No bookings during these days",
                isBlocked: true
            )
        }
        return DatedException(
            title: "\(date) · \(OverrideFormatting.summary(for: next))",
            sub: "Overrides the weekly hours for this date",
            isBlocked: false
        )
    }
}
