//
//  BookingsExtrasFormatting.swift
//  Pantopus
//
//  Stream I9 — small pure formatting helpers shared by the Bookings-extras
//  surfaces. Time helpers defer to Foundation's `SchedulingTime` so we always
//  render the backend-supplied local string / requested tz.
//

import Foundation

enum BookingsExtrasFormatting {
    /// Up-to-two-letter avatar initials from a display name.
    static func initials(from name: String?) -> String {
        guard let name, !name.trimmingCharacters(in: .whitespaces).isEmpty else { return "?" }
        let letters = name
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
        return letters.joined().uppercased()
    }

    /// "Jun 8" style short day from an ISO-UTC timestamp, rendered in `tz`.
    static func shortDay(utcISO: String?, tz: String) -> String? {
        guard let utcISO, let date = SchedulingTime.parseUTC(utcISO) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: tz) ?? .current
        let formatter = DateFormatter()
        formatter.timeZone = calendar.timeZone
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }

    /// "Mon, Jun 9 · 4:30 PM" style label for a booking start, rendered in `tz`.
    static func dayAndTime(utcISO: String?, tz: String) -> String? {
        guard let utcISO else { return nil }
        return SchedulingTime.localString(utcISO: utcISO, tz: tz, dateStyle: .medium, timeStyle: .short)
    }
}
