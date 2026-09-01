//
//  AvailabilityFormatting.swift
//  Pantopus
//
//  Stream I3 (Availability) — pure, testable helpers shared by B4/B5/B6/B9:
//  the wall-clock `TimeOfDay` value, weekday-index conventions (backend is
//  0=Sunday … 6=Saturday — Apple's `Calendar` is 1=Sunday), human-readable
//  schedule/override summaries, and the US public-holiday set used by the
//  date-overrides holiday import. No SwiftUI, no networking.
//

import Foundation

/// A wall-clock time of day (no date, no timezone). The backend stores
/// availability rule/override windows as `HH:MM` (or `HH:MM:SS`) strings,
/// detached from any instant — this models exactly that.
public struct TimeOfDay: Sendable, Hashable, Comparable {
    public let hour: Int
    public let minute: Int

    public init(hour: Int, minute: Int) {
        self.hour = min(max(hour, 0), 23)
        self.minute = min(max(minute, 0), 59)
    }

    /// Parse a backend `HH:MM` or `HH:MM:SS` string. Returns nil on garbage.
    public init?(_ raw: String) {
        let parts = raw.split(separator: ":")
        guard parts.count >= 2,
              let h = Int(parts[0]),
              let m = Int(parts[1]),
              (0...23).contains(h),
              (0...59).contains(m)
        else { return nil }
        self.init(hour: h, minute: m)
    }

    /// The canonical `HH:MM` wire form (zero-padded, 24-hour).
    public var hhmm: String {
        String(format: "%02d:%02d", hour, minute)
    }

    /// Minutes since midnight — handy for range comparisons.
    public var minutesSinceMidnight: Int {
        hour * 60 + minute
    }

    public static func < (lhs: TimeOfDay, rhs: TimeOfDay) -> Bool {
        lhs.minutesSinceMidnight < rhs.minutesSinceMidnight
    }

    // MARK: - Date bridging (for SwiftUI DatePicker)

    /// Build a `Date` on a fixed reference day carrying this time, in the
    /// device calendar — used to drive `DatePicker(.hourAndMinute)`.
    public func referenceDate(calendar: Calendar = .current) -> Date {
        let components = DateComponents(year: 2001, month: 1, day: 1, hour: hour, minute: minute)
        return calendar.date(from: components) ?? Date(timeIntervalSinceReferenceDate: 0)
    }

    /// Read a `Date` back into a `TimeOfDay` (device calendar hour/minute).
    public init(from date: Date, calendar: Calendar = .current) {
        let components = calendar.dateComponents([.hour, .minute], from: date)
        self.init(hour: components.hour ?? 0, minute: components.minute ?? 0)
    }

    /// Localized short display, e.g. `9:00 AM`.
    public var display: String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter.string(from: referenceDate())
    }

    public static let nineAM = TimeOfDay(hour: 9, minute: 0)
    public static let fivePM = TimeOfDay(hour: 17, minute: 0)
}

/// A start–end time window within a single day.
public struct TimeRange: Sendable, Hashable, Identifiable {
    public let id: UUID
    public var start: TimeOfDay
    public var end: TimeOfDay

    public init(id: UUID = UUID(), start: TimeOfDay, end: TimeOfDay) {
        self.id = id
        self.start = start
        self.end = end
    }

    /// A window is well-formed when it has positive duration.
    public var isValid: Bool {
        start < end
    }

    /// Localized display, e.g. `9:00 AM – 5:00 PM`.
    public var display: String {
        "\(start.display) – \(end.display)"
    }

    public static let nineToFive = TimeRange(start: .nineAM, end: .fivePM)
}

/// Weekday helpers. The Calendarly backend uses **0 = Sunday … 6 = Saturday**
/// (JavaScript `Date.getDay()`). Pantopus surfaces availability Monday-first,
/// so the display order is `[Mon … Sun]` while the stored index stays 0-based
/// Sunday.
public enum Weekday {
    /// Backend weekday indices in Monday-first display order.
    public static let displayOrder: [Int] = [1, 2, 3, 4, 5, 6, 0]

    private static let longNames: [Int: String] = [
        0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
        4: "Thursday", 5: "Friday", 6: "Saturday"
    ]

    private static let shortNames: [Int: String] = [
        0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"
    ]

    public static func longName(_ weekday: Int) -> String {
        longNames[weekday] ?? ""
    }

    public static func shortName(_ weekday: Int) -> String {
        shortNames[weekday] ?? ""
    }
}

/// Builds the human-readable summary line shown on the B4 schedule list
/// (e.g. `Mon–Fri, 9:00 AM – 5:00 PM`). Pure function over a schedule's rules.
public enum AvailabilitySummary {
    /// Summarize the weekly rules belonging to one schedule.
    public static func summarize(rules: [AvailabilityRuleDTO]) -> String {
        let enabled = enabledWeekdays(rules)
        guard !enabled.isEmpty else { return "No hours set" }

        // Collapse to the common single range when every enabled day shares
        // exactly one identical window — the dominant real-world case.
        if let shared = sharedSingleRange(rules: rules, enabled: enabled) {
            return "\(dayLabel(for: enabled)), \(shared.display)"
        }
        return "\(dayLabel(for: enabled)) · varies"
    }

    /// The set of weekdays (backend index) that have at least one rule, in
    /// Monday-first display order.
    private static func enabledWeekdays(_ rules: [AvailabilityRuleDTO]) -> [Int] {
        let present = Set(rules.map(\.weekday))
        return Weekday.displayOrder.filter { present.contains($0) }
    }

    /// When every enabled weekday has exactly one rule and all are identical,
    /// return that shared window.
    private static func sharedSingleRange(rules: [AvailabilityRuleDTO], enabled: [Int]) -> TimeRange? {
        var window: (String, String)?
        for weekday in enabled {
            let dayRules = rules.filter { $0.weekday == weekday }
            guard dayRules.count == 1, let rule = dayRules.first else { return nil }
            let key = (rule.startTime, rule.endTime)
            if let existing = window {
                if existing.0 != key.0 || existing.1 != key.1 { return nil }
            } else {
                window = key
            }
        }
        guard let window, let start = TimeOfDay(window.0), let end = TimeOfDay(window.1) else { return nil }
        return TimeRange(start: start, end: end)
    }

    /// Render a span of weekdays as `Mon–Fri`, `Sat & Sun`, or a comma list.
    static func dayLabel(for enabled: [Int]) -> String {
        guard !enabled.isEmpty else { return "" }
        // Contiguous in Monday-first order → use an en-dash span.
        let positions = enabled.compactMap { Weekday.displayOrder.firstIndex(of: $0) }.sorted()
        let isContiguous = positions.count > 1 && positions.last == (positions.first ?? 0) + positions.count - 1
        if isContiguous, let first = enabled.first, let last = enabled.last {
            return "\(Weekday.shortName(first))–\(Weekday.shortName(last))"
        }
        if enabled.count == 2 {
            return "\(Weekday.shortName(enabled[0])) & \(Weekday.shortName(enabled[1]))"
        }
        return enabled.map { Weekday.shortName($0) }.joined(separator: ", ")
    }
}

/// Formats a `YYYY-MM-DD` override key and its window for the B6 list rows.
public enum OverrideFormatting {
    /// `Thu, Jul 4` from a `YYYY-MM-DD` key (falls back to the raw key).
    public static func displayDate(_ ymd: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        parser.timeZone = TimeZone(identifier: "UTC")
        guard let date = parser.date(from: ymd) else { return ymd }
        let display = DateFormatter()
        display.locale = .current
        display.timeZone = TimeZone(identifier: "UTC")
        display.dateFormat = "EEE, MMM d"
        return display.string(from: date)
    }

    /// `YYYY-MM-DD` key for a `Date` (device calendar day).
    public static func ymdKey(_ date: Date, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    /// The right-hand summary for an override row: `Unavailable` or a window.
    public static func summary(for override: AvailabilityOverrideDTO) -> String {
        if override.isUnavailable == true { return "Unavailable" }
        guard let startRaw = override.startTime, let endRaw = override.endTime,
              let start = TimeOfDay(startRaw), let end = TimeOfDay(endRaw)
        else { return "Custom hours" }
        return TimeRange(start: start, end: end).display
    }
}

/// Computes the US public-holiday set for a given year (B6 bulk import). All
/// dates are returned as `YYYY-MM-DD` keys with a human label.
public enum USHolidays {
    public struct Holiday: Sendable, Hashable, Identifiable {
        public let date: String
        public let name: String
        public var id: String {
            date
        }
    }

    /// The 11 US federal holidays for `year`, observed-date math included for
    /// the floating ones (e.g. 3rd Monday).
    public static func forYear(_ year: Int) -> [Holiday] {
        var holidays: [Holiday] = []
        func add(_ month: Int, _ day: Int, _ name: String) {
            holidays.append(Holiday(date: String(format: "%04d-%02d-%02d", year, month, day), name: name))
        }
        func nth(_ weekday: Int, _ occurrence: Int, of month: Int, _ name: String) {
            if let day = nthWeekday(weekday, occurrence: occurrence, month: month, year: year) {
                add(month, day, name)
            }
        }
        add(1, 1, "New Year's Day")
        nth(2, 3, of: 1, "Martin Luther King Jr. Day") // 3rd Monday of Jan (Calendar weekday 2 = Mon)
        nth(2, 3, of: 2, "Presidents' Day") // 3rd Monday of Feb
        nth(2, -1, of: 5, "Memorial Day") // last Monday of May
        add(6, 19, "Juneteenth")
        add(7, 4, "Independence Day")
        nth(2, 1, of: 9, "Labor Day") // 1st Monday of Sep
        nth(2, 2, of: 10, "Indigenous Peoples' Day") // 2nd Monday of Oct
        add(11, 11, "Veterans Day")
        nth(5, 4, of: 11, "Thanksgiving") // 4th Thursday of Nov (Calendar weekday 5 = Thu)
        add(12, 25, "Christmas Day")
        return holidays
    }

    /// The day-of-month for the `occurrence`-th `weekday` in a month, where
    /// `weekday` is Apple's `Calendar` 1=Sunday … 7=Saturday and a negative
    /// `occurrence` counts from the end (-1 = last).
    private static func nthWeekday(_ weekday: Int, occurrence: Int, month: Int, year: Int) -> Int? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        guard let firstOfMonth = calendar.date(from: DateComponents(year: year, month: month, day: 1)),
              let range = calendar.range(of: .day, in: .month, for: firstOfMonth)
        else { return nil }

        let matchingDays = range.compactMap { day -> Int? in
            guard let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { return nil }
            return calendar.component(.weekday, from: date) == weekday ? day : nil
        }
        guard !matchingDays.isEmpty else { return nil }
        if occurrence < 0 { return matchingDays.last }
        let index = occurrence - 1
        return matchingDays.indices.contains(index) ? matchingDays[index] : nil
    }
}
