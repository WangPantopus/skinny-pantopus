//
//  DateOverridesViewModel.swift
//  Pantopus
//
//  Stream I3 — B6 Date Overrides & Holidays (sheet). Manages a schedule's
//  date-level overrides: full-day "unavailable" holidays and partial-day
//  custom-hours windows, plus a bulk US-public-holiday import. Reads the
//  composite (`GET /api/scheduling/availability`) and saves the WHOLE set
//  (`PUT /availability/:id/overrides`) on each add/remove. Personal only.
//

import Observation
import SwiftUI

/// One date override the user is managing. A custom-hours date can carry
/// SEVERAL entries (one per time block — see `customBlocks`), so the identity
/// is the date *and* its window rather than the date alone.
struct OverrideEntry: Identifiable, Hashable {
    let date: String // YYYY-MM-DD
    var isUnavailable: Bool
    var start: TimeOfDay?
    var end: TimeOfDay?
    var id: String {
        "\(date)|\(start?.hhmm ?? "")|\(end?.hhmm ?? "")"
    }
}

enum OverrideMode: String, CaseIterable, Identifiable {
    case unavailable
    case customHours
    var id: String {
        rawValue
    }

    var label: String {
        self == .unavailable ? "Unavailable" : "Custom hours"
    }
}

@Observable
@MainActor
final class DateOverridesViewModel {
    enum Phase {
        case loading
        case ready
        case error(message: String)
    }

    private(set) var phase: Phase = .loading
    let scheduleId: String

    private(set) var overrides: [OverrideEntry] = []

    // Composer state
    var selectedDate = Date()
    var mode: OverrideMode = .unavailable
    /// Design AVAIL-08 (`PickerBlock` "+ Add a block"): custom hours are a LIST
    /// of blocks, each persisted as its own override row for the date — the
    /// availability engine honours split windows on the same date. Mirrors the
    /// web `DateOverrideEditor` `customBlocks` state.
    var customBlocks: [TimeRange] = [TimeRange(start: .nineAM, end: .fivePM)]
    var isRange = false
    var rangeEndDate = Date()

    /// Custom month calendar navigation — tracks which month is currently shown.
    /// Initialized in `init` to the first of the current month.
    var displayedMonth = Date()

    /// Advance the displayed month by `delta` months (positive = forward).
    func stepMonth(_ delta: Int) {
        let cal = Calendar.current
        if let next = cal.date(byAdding: .month, value: delta, to: displayedMonth) {
            displayedMonth = next
        }
    }

    /// When the user taps a day cell, snap `selectedDate` to that day and keep
    /// the displayed month in sync (so selecting via tap doesn't lose context).
    func selectDay(_ day: Int) {
        let cal = Calendar.current
        var comps = cal.dateComponents([.year, .month], from: displayedMonth)
        comps.day = day
        if let date = cal.date(from: comps) {
            selectedDate = date
        }
    }

    private(set) var isSaving = false
    var errorMessage: String?

    private let client: SchedulingClient

    init(scheduleId: String, client: SchedulingClient = .shared) {
        self.scheduleId = scheduleId
        self.client = client
        // Snap displayedMonth to the first of the current month so the custom
        // calendar grid opens on the right page.
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: Date())
        displayedMonth = cal.date(from: comps) ?? Date()
    }

    // MARK: Derived

    /// US holidays for the current calendar year.
    private var currentYearHolidays: [USHolidays.Holiday] {
        USHolidays.forYear(Calendar.current.component(.year, from: Date()))
    }

    var holidayCount: Int {
        currentYearHolidays.count
    }

    /// The current-year US holiday set, exposed for the read-only
    /// imported-holiday list shown when the holiday set is on. View-only —
    /// the source of truth for "is the set on" is `holidaysEnabled`.
    var currentYearHolidayList: [USHolidays.Holiday] {
        currentYearHolidays
    }

    /// True when every current-year holiday is already covered by an override.
    /// Any override on the date counts — enabling the set skips dates that
    /// carry a hand-authored override (see `toggleHolidays`), so requiring
    /// `isUnavailable` on those would snap the switch straight back off.
    var holidaysEnabled: Bool {
        let present = Set(overrides.map(\.date))
        return currentYearHolidays.allSatisfy { present.contains($0.date) }
    }

    var canAddCustom: Bool {
        guard !isRange, mode == .customHours else { return true }
        return !customBlocks.isEmpty && customBlocks.allSatisfy(\.isValid)
    }

    /// Upper bound for the date-range picker so a blocked range can't exceed
    /// the per-write cap (and silently drop the tail past `dates(from:to:)`'s
    /// guard). 60 days comfortably covers a long vacation hold.
    var maxRangeEnd: Date {
        Calendar.current.date(byAdding: .day, value: 60, to: selectedDate) ?? selectedDate
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
            overrides = Self.buildEntries(from: response.overrides.filter { $0.scheduleId == scheduleId })
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(message: error.userMessage ?? "Couldn't load your overrides.")
        } catch {
            phase = .error(message: "Couldn't load your overrides.")
        }
    }

    private static func buildEntries(from dtos: [AvailabilityOverrideDTO]) -> [OverrideEntry] {
        dtos
            .map { dto in
                OverrideEntry(
                    date: dto.date,
                    isUnavailable: dto.isUnavailable ?? false,
                    start: dto.startTime.flatMap(TimeOfDay.init),
                    end: dto.endTime.flatMap(TimeOfDay.init)
                )
            }
            .sorted { $0.date < $1.date }
    }

    // MARK: Mutations

    func addOverride() async {
        var list = overrides
        let newEntries = composedEntries()
        guard !newEntries.isEmpty else { return }
        let newDates = Set(newEntries.map(\.date))
        list.removeAll { newDates.contains($0.date) }
        list.append(contentsOf: newEntries)
        await persist(list)
    }

    func removeOverride(_ date: String) async {
        await persist(overrides.filter { $0.date != date })
    }

    // MARK: Custom-hours blocks (design "+ Add a block")

    /// Append a second window to the selected date. Seeded past the last block
    /// so the new row doesn't overlap what's already there.
    func addCustomBlock() {
        let previousEnd: TimeOfDay = customBlocks.last?.end ?? TimeOfDay.nineAM
        let start = TimeOfDay(hour: min(previousEnd.hour + 1, 22), minute: 0)
        let end = TimeOfDay(hour: min(start.hour + 2, 23), minute: 0)
        customBlocks.append(TimeRange(start: start, end: end))
    }

    func removeCustomBlock(_ id: UUID) {
        guard customBlocks.count > 1 else { return }
        customBlocks.removeAll { $0.id == id }
    }

    func updateCustomBlock(_ id: UUID, start: TimeOfDay, end: TimeOfDay) {
        guard let index = customBlocks.firstIndex(where: { $0.id == id }) else { return }
        customBlocks[index].start = start
        customBlocks[index].end = end
    }

    func toggleHolidays(_ enable: Bool) async {
        let holidayDates = Set(currentYearHolidays.map(\.date))
        // Strip only IMPORT-SHAPED entries (full-day unavailable, no times).
        // A hand-authored override that happens to fall on a holiday date —
        // e.g. custom half-day hours on Jul 4 — must survive the switch in
        // both directions: persist() replaces the whole set server-side, so
        // dropping it here destroyed it permanently.
        var list = overrides.filter { entry in
            !(holidayDates.contains(entry.date)
                && entry.isUnavailable
                && entry.start == nil
                && entry.end == nil)
        }
        if enable {
            // Skip holiday dates that already carry a user override.
            let occupied = Set(list.map(\.date))
            list.append(contentsOf: currentYearHolidays
                .filter { !occupied.contains($0.date) }
                .map { OverrideEntry(date: $0.date, isUnavailable: true, start: nil, end: nil) })
        }
        await persist(list)
    }

    private func composedEntries() -> [OverrideEntry] {
        if isRange {
            return Self.dates(from: selectedDate, to: rangeEndDate).map {
                OverrideEntry(date: $0, isUnavailable: true, start: nil, end: nil)
            }
        }
        let key = OverrideFormatting.ymdKey(selectedDate)
        if mode == .unavailable {
            return [OverrideEntry(date: key, isUnavailable: true, start: nil, end: nil)]
        }
        // One override row per valid block (design AVAIL-08 multi-block day).
        return customBlocks
            .filter(\.isValid)
            .map { OverrideEntry(date: key, isUnavailable: false, start: $0.start, end: $0.end) }
    }

    private func persist(_ newList: [OverrideEntry]) async {
        guard !isSaving else { return }
        isSaving = true
        defer { isSaving = false }
        let sorted = newList.sorted { $0.date < $1.date }
        let payload = sorted.map { entry in
            OverridesRequest.Override(
                date: entry.date,
                isUnavailable: entry.isUnavailable,
                startTime: entry.isUnavailable ? nil : entry.start?.hhmm,
                endTime: entry.isUnavailable ? nil : entry.end?.hhmm
            )
        }
        do {
            let response: OverridesResponse = try await client.request(
                SchedulingEndpoints.setOverrides(scheduleId: scheduleId, OverridesRequest(overrides: payload))
            )
            overrides = Self.buildEntries(from: response.overrides)
        } catch let error as SchedulingError {
            // Keep the in-memory list and composer state intact on failure —
            // re-fetching here would flash the loading skeleton and discard
            // what the user just entered. They can simply retry.
            errorMessage = error.userMessage ?? "Couldn't save your overrides."
        } catch {
            errorMessage = "Couldn't save your overrides."
        }
    }

    private static func dates(from start: Date, to end: Date, calendar: Calendar = .current) -> [String] {
        let lower = calendar.startOfDay(for: min(start, end))
        let upper = calendar.startOfDay(for: max(start, end))
        var keys: [String] = []
        var cursor = lower
        var guardCount = 0
        while cursor <= upper, guardCount < 90 {
            keys.append(OverrideFormatting.ymdKey(cursor, calendar: calendar))
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
            guardCount += 1
        }
        return keys
    }
}
