//
//  CrewDayFormat.swift
//  Pantopus
//
//  Crew Day's words for times and money (build kit 01-spec.md "Copy"):
//  times in the Crew Day's own time zone, written "9 AM–1 PM" and
//  "Tue, Nov 17"; whole-dollar prices without cents ("$180"); receipts
//  with cents ("$180.00").
//

import Foundation

enum CrewDayFormat {
    /// The Crew Day's calendar (its own time zone; Pacific when unknown).
    static func calendar(_ timezone: String?) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US_POSIX")
        calendar.timeZone = timezone.flatMap(TimeZone.init(identifier:))
            ?? TimeZone(identifier: "America/Los_Angeles") ?? .current
        return calendar
    }

    /// `YYYY-MM-DD` as noon that day in the Crew Day's zone (safe for weekday names).
    static func day(_ date: String?, timezone: String?) -> Date? {
        guard let date else { return nil }
        let parts = date.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar(timezone).date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }

    /// An ISO instant from the server (with or without fractional seconds).
    static func instant(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        return ISO8601DateFormatter().date(from: value)
    }

    /// An ISO instant for the server.
    static func iso(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    /// "Tue, Nov 17".
    static func shortDay(_ date: String?, timezone: String?) -> String {
        format(day(date, timezone: timezone), "EEE, MMM d", timezone: timezone)
    }

    /// "Tuesday, Nov 17".
    static func longDay(_ date: String?, timezone: String?) -> String {
        format(day(date, timezone: timezone), "EEEE, MMM d", timezone: timezone)
    }

    /// "Tuesday".
    static func weekday(_ date: String?, timezone: String?) -> String {
        format(day(date, timezone: timezone), "EEEE", timezone: timezone)
    }

    /// "Sunday, Nov 15" for an instant, in the Crew Day's zone.
    static func longDay(instant: Date?, timezone: String?) -> String {
        format(instant, "EEEE, MMM d", timezone: timezone)
    }

    /// "Sun, Nov 15" for an instant, in the Crew Day's zone.
    static func shortDay(instant: Date?, timezone: String?) -> String {
        format(instant, "EEE, MMM d", timezone: timezone)
    }

    /// "Sun, Nov 15, 9 AM" for an instant, in the Crew Day's zone.
    static func dayAndTime(_ instant: Date?, timezone: String?) -> String {
        guard let instant else { return "" }
        return "\(shortDay(instant: instant, timezone: timezone)), \(time(instant, timezone: timezone))"
    }

    /// "9 AM" or "9:30 AM" for an instant, in the Crew Day's zone.
    static func time(_ instant: Date?, timezone: String?) -> String {
        guard let instant else { return "" }
        let minute = calendar(timezone).component(.minute, from: instant)
        return format(instant, minute == 0 ? "h a" : "h:mm a", timezone: timezone)
    }

    /// "9 AM" from a local `HH:MM[:SS]` time.
    static func clock(_ value: String?) -> String {
        guard let value else { return "" }
        let parts = value.split(separator: ":").compactMap { Int($0) }
        guard let hour = parts.first else { return value }
        let minute = parts.count > 1 ? parts[1] : 0
        let suffix = hour < 12 ? "AM" : "PM"
        let twelve = hour % 12 == 0 ? 12 : hour % 12
        return minute == 0 ? "\(twelve) \(suffix)" : String(format: "%d:%02d %@", twelve, minute, suffix)
    }

    /// "9 AM–1 PM" from local `HH:MM` times.
    static func window(_ start: String?, _ end: String?) -> String {
        guard start != nil || end != nil else { return "" }
        return "\(clock(start))–\(clock(end))"
    }

    /// "10–11 AM" (one suffix when both ends share it) for two instants.
    static func window(from start: Date?, to end: Date?, timezone: String?) -> String {
        guard let start, let end else { return time(start ?? end, timezone: timezone) }
        let calendar = calendar(timezone)
        let sameHalf = (calendar.component(.hour, from: start) < 12) == (calendar.component(.hour, from: end) < 12)
        let startText = time(start, timezone: timezone)
        let endText = time(end, timezone: timezone)
        guard sameHalf else { return "\(startText)–\(endText)" }
        let bare = startText.replacingOccurrences(of: " AM", with: "").replacingOccurrences(of: " PM", with: "")
        return "\(bare)–\(endText)"
    }

    /// "$180" (whole dollars; cents only when there are some).
    static func price(_ cents: Int?) -> String {
        guard let cents else { return "" }
        if cents % 100 == 0 { return "$\(grouped(cents / 100))" }
        return receipt(cents)
    }

    /// "$180.00".
    static func receipt(_ cents: Int?) -> String {
        guard let cents else { return "" }
        return String(format: "$%@.%02d", grouped(cents / 100), abs(cents % 100))
    }

    /// "+$30".
    static func addOn(_ cents: Int) -> String {
        "+\(price(cents))"
    }

    /// "1 home" / "6 homes".
    static func homes(_ count: Int) -> String {
        count == 1 ? "1 home" : "\(count) homes"
    }

    private static func grouped(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "en_US")
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private static func format(_ date: Date?, _ pattern: String, timezone: String?) -> String {
        guard let date else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar(timezone).timeZone
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }
}
