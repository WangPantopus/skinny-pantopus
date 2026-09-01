//
//  WeeklyHoursEditorViewModel.swift
//  Pantopus
//
//  Stream I3 — B5 Weekly Hours Editor. The atomic personal-availability
//  editor: per-weekday on/off + one or more time ranges, schedule name, and
//  timezone. Reads the composite (`GET /api/scheduling/availability`),
//  filters to this schedule, and saves the WHOLE rule set
//  (`PUT /availability/:id/rules`) plus name/timezone changes
//  (`PUT /availability/:id`). Availability is ALWAYS personal.
//

import Observation
import SwiftUI

/// One weekday's editable hours (backend weekday index 0=Sun … 6=Sat).
struct DayHours: Identifiable, Hashable {
    let weekday: Int
    var isEnabled: Bool
    var ranges: [TimeRange]
    var id: Int {
        weekday
    }
}

/// Locally-presented sheet from the weekly-hours editor.
enum WeeklyHoursSheet: String, Identifiable {
    case dateOverrides
    case blockOff
    var id: String {
        rawValue
    }
}

@Observable
@MainActor
final class WeeklyHoursEditorViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    private(set) var phase: Phase = .loading

    let scheduleId: String

    // Editable state
    var scheduleName: String = ""
    var timezoneId: String = SchedulingTime.deviceTimeZoneIdentifier
    var lockTimezone: Bool = true
    var days: [DayHours] = []

    // UI flags
    var showTimezoneSheet = false
    var activeSheet: WeeklyHoursSheet?
    private(set) var isSaving = false
    var saveError: String?

    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var baselineSignature: String?
    private var loadedName = ""
    private var loadedTimezone = SchedulingTime.deviceTimeZoneIdentifier

    init(
        scheduleId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.scheduleId = scheduleId
        self.push = push
        self.client = client
    }

    // MARK: Derived

    /// Every enabled day must carry at least one well-formed range. All-off is
    /// valid (it just clears the schedule and warns).
    var formValid: Bool {
        for day in days where day.isEnabled {
            if day.ranges.isEmpty { return false }
            if day.ranges.contains(where: { !$0.isValid }) { return false }
        }
        return true
    }

    var allOff: Bool {
        !days.contains { $0.isEnabled }
    }

    /// True for a brand-new / unset schedule: every day is off AND the user
    /// has not yet edited anything (the loaded baseline carried no rules).
    /// Drives the design's dedicated empty "Set your hours" hero frame, which
    /// is distinct from the all-day-off WARNING frame the user reaches by
    /// turning every day off after editing.
    var isUnset: Bool {
        allOff && !isDirty
    }

    var isDirty: Bool {
        signature() != baselineSignature
    }

    /// `Pacific Time · auto` style chip label.
    var timezoneDisplay: String {
        let city = Self.cityName(timezoneId)
        return lockTimezone ? "\(city) · auto" : city
    }

    /// The city portion only (no " · auto" suffix), so the field button can
    /// render the suffix in a separate muted color.
    var timezoneCityDisplay: String {
        Self.cityName(timezoneId)
    }

    // MARK: Load

    func load() async {
        if case .ready = phase { return }
        await fetch()
    }

    func reload() async {
        await fetch()
    }

    private func fetch() async {
        phase = .loading
        do {
            let response: AvailabilityResponse = try await client.request(SchedulingEndpoints.getAvailability())
            guard let schedule = response.schedules.first(where: { $0.id == scheduleId }) else {
                phase = .error(message: "This schedule no longer exists.")
                return
            }
            scheduleName = schedule.name ?? "Working hours"
            timezoneId = schedule.timezone ?? SchedulingTime.deviceTimeZoneIdentifier
            lockTimezone = timezoneId == SchedulingTime.deviceTimeZoneIdentifier
            loadedName = scheduleName
            loadedTimezone = timezoneId
            days = Self.buildDays(from: response.rules.filter { $0.scheduleId == scheduleId })
            baselineSignature = signature()
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load this schedule.")
        } catch {
            phase = .error(message: "Couldn't load this schedule.")
        }
    }

    private static func buildDays(from rules: [AvailabilityRuleDTO]) -> [DayHours] {
        Weekday.displayOrder.map { weekday in
            let ranges = rules
                .filter { $0.weekday == weekday }
                .compactMap { rule -> TimeRange? in
                    guard let start = TimeOfDay(rule.startTime), let end = TimeOfDay(rule.endTime) else { return nil }
                    return TimeRange(start: start, end: end)
                }
                .sorted { $0.start < $1.start }
            return DayHours(weekday: weekday, isEnabled: !ranges.isEmpty, ranges: ranges)
        }
    }

    // MARK: Editing

    func setEnabled(_ weekday: Int, _ enabled: Bool) {
        guard let index = days.firstIndex(where: { $0.weekday == weekday }) else { return }
        days[index].isEnabled = enabled
        if enabled, days[index].ranges.isEmpty {
            days[index].ranges = [.nineToFive]
        }
    }

    func addRange(_ weekday: Int) {
        guard let index = days.firstIndex(where: { $0.weekday == weekday }) else { return }
        // Clamp the start hour to 22 so the default end (start + 1h) stays
        // within the day and the synthesized window always has positive
        // duration (start < end) — otherwise a late last range would seed an
        // invalid 23:00–23:00 block that blocks Save.
        let lastEndHour = days[index].ranges.last?.end.hour ?? 8
        let startHour = min(lastEndHour + 1, 22)
        let start = TimeOfDay(hour: startHour, minute: 0)
        let end = TimeOfDay(hour: startHour + 1, minute: 0)
        days[index].ranges.append(TimeRange(start: start, end: end))
        days[index].isEnabled = true
    }

    func removeRange(_ weekday: Int, _ rangeId: UUID) {
        guard let index = days.firstIndex(where: { $0.weekday == weekday }) else { return }
        days[index].ranges.removeAll { $0.id == rangeId }
        if days[index].ranges.isEmpty { days[index].isEnabled = false }
    }

    func updateStart(_ weekday: Int, _ rangeId: UUID, _ value: TimeOfDay) {
        mutateRange(weekday, rangeId) { $0.start = value }
    }

    func updateEnd(_ weekday: Int, _ rangeId: UUID, _ value: TimeOfDay) {
        mutateRange(weekday, rangeId) { $0.end = value }
    }

    private func mutateRange(_ weekday: Int, _ rangeId: UUID, _ apply: (inout TimeRange) -> Void) {
        guard let dayIndex = days.firstIndex(where: { $0.weekday == weekday }),
              let rangeIndex = days[dayIndex].ranges.firstIndex(where: { $0.id == rangeId })
        else { return }
        apply(&days[dayIndex].ranges[rangeIndex])
    }

    /// Clone one day's ranges (and enabled state) onto the target weekdays.
    func copyHours(from weekday: Int, to targets: [Int]) {
        guard let source = days.first(where: { $0.weekday == weekday }) else { return }
        for target in targets {
            guard let index = days.firstIndex(where: { $0.weekday == target }) else { continue }
            days[index].isEnabled = source.isEnabled
            days[index].ranges = source.ranges.map { TimeRange(start: $0.start, end: $0.end) }
        }
    }

    func applyNineToFiveDefault() {
        days = Weekday.displayOrder.map { weekday in
            let isWeekday = (1...5).contains(weekday)
            return DayHours(
                weekday: weekday,
                isEnabled: isWeekday,
                ranges: isWeekday ? [.nineToFive] : []
            )
        }
    }

    func changeTimezone(_ identifier: String) {
        timezoneId = identifier
        lockTimezone = identifier == SchedulingTime.deviceTimeZoneIdentifier
        showTimezoneSheet = false
    }

    func setLockTimezone(_ locked: Bool) {
        lockTimezone = locked
        if locked { timezoneId = SchedulingTime.deviceTimeZoneIdentifier }
    }

    // MARK: Cross-screen

    /// Booking limits live on the event type. The design's LinksCard reaches B7
    /// directly (and Android routes straight to BookingLimits), so resolve the
    /// personal default event type and push `.bookingLimits` for it. If the user
    /// has no event types yet, fall back to the services list so they can create
    /// one first.
    func openBookingLimits() async {
        do {
            let response: EventTypesResponse = try await client.request(SchedulingEndpoints.getEventTypes(owner: .personal))
            let active = response.eventTypes.filter { $0.isActive ?? true }
            let target = active.min { ($0.sortOrder ?? .max) < ($1.sortOrder ?? .max) }
                ?? response.eventTypes.first
            if let target {
                push(.bookingLimits(owner: .personal, eventTypeId: target.id))
            } else {
                push(.eventTypeList(owner: .personal))
            }
        } catch {
            push(.eventTypeList(owner: .personal))
        }
    }

    func makeDateOverridesViewModel() -> DateOverridesViewModel {
        DateOverridesViewModel(scheduleId: scheduleId, client: client)
    }

    func makeBlockOffViewModel() -> BlockOffTimeViewModel {
        BlockOffTimeViewModel(client: client) { [weak self] bookingId in
            guard let self else { return }
            activeSheet = nil
            push(.bookingDetail(owner: .personal, bookingId: bookingId))
        }
    }

    // MARK: Save

    func save() async {
        guard !isSaving, formValid else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let rules = days
                .filter(\.isEnabled)
                .flatMap { day in
                    day.ranges.map { range in
                        RulesRequest.Rule(weekday: day.weekday, startTime: range.start.hhmm, endTime: range.end.hhmm)
                    }
                }
            _ = try await client.request(
                SchedulingEndpoints.setRules(scheduleId: scheduleId, RulesRequest(rules: rules)),
                as: RulesResponse.self
            )

            let trimmedName = scheduleName.trimmingCharacters(in: .whitespacesAndNewlines)
            let nameChanged = !trimmedName.isEmpty && trimmedName != loadedName
            let tzChanged = timezoneId != loadedTimezone
            if nameChanged || tzChanged {
                _ = try await client.request(
                    SchedulingEndpoints.updateSchedule(
                        id: scheduleId,
                        UpdateScheduleRequest(
                            name: nameChanged ? trimmedName : nil,
                            timezone: tzChanged ? timezoneId : nil
                        )
                    ),
                    as: AvailabilityScheduleResponse.self
                )
                if nameChanged { loadedName = trimmedName }
                loadedTimezone = timezoneId
            }
            baselineSignature = signature()
        } catch let error as SchedulingError {
            saveError = error.userMessage ?? "Couldn't save your hours."
        } catch {
            saveError = "Couldn't save your hours."
        }
    }

    // MARK: Dirty signature

    private func signature() -> String {
        let rulePart = days
            .filter(\.isEnabled)
            .flatMap { day in day.ranges.map { "\(day.weekday):\($0.start.hhmm)-\($0.end.hhmm)" } }
            .sorted()
            .joined(separator: ",")
        return "\(scheduleName)|\(timezoneId)|\(rulePart)"
    }

    private static func cityName(_ identifier: String) -> String {
        guard let zone = TimeZone(identifier: identifier) else { return identifier }
        if let name = zone.localizedName(for: .generic, locale: .current), !name.isEmpty {
            return name
        }
        return identifier.split(separator: "/").last.map { $0.replacingOccurrences(of: "_", with: " ") } ?? identifier
    }
}
