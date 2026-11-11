//
//  MomentTime.swift
//  Pantopus
//
//  Times for Moments: the API's ISO 8601 strings, "2h ago" and "22h left",
//  and "Taken Oct 3" for an album photo or video taken more than a day before
//  it was posted (contract v3.3). Moved out of MomentsDTOs.swift.
//

import Foundation

/// ISO 8601 times from the Moments API, with or without fractional seconds.
enum MomentTime {
    static func parse(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }

    static func string(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    /// A photo or video taken more than a day before it's posted says when (contract v3.3, the server's rule too).
    static func takenLongAgo(_ taken: Date?, now: Date = Date()) -> Bool {
        guard let taken else { return false }
        return now.timeIntervalSince(taken) > 24 * 3600
    }

    /// "Taken Oct 3", or "Taken Oct 3, 2024" when it isn't this year (the viewer's own calendar).
    static func taken(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        formatter.setLocalizedDateFormatFromTemplate(sameYear ? "MMMd" : "MMMdyyyy")
        return "Taken \(formatter.string(from: date))"
    }

    /// The server's `taken_at` as the viewer's label, or nil.
    static func taken(_ raw: String?) -> String? {
        parse(raw).map { taken($0) }
    }

    /// "2h ago", "35m ago", "just now".
    static func ago(_ date: Date?, now: Date = Date()) -> String {
        guard let date else { return "" }
        let seconds = max(0, now.timeIntervalSince(date))
        if seconds < 60 { return "just now" }
        if seconds < 3600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86400 { return "\(Int(seconds / 3600))h ago" }
        return "\(Int(seconds / 86400))d ago"
    }

    /// "24h left", "35m left", "1m left": rounded up, so a Moment just posted for 24 hours says 24, and never under a minute.
    static func left(_ date: Date?, now: Date = Date()) -> String {
        guard let date else { return "" }
        let seconds = max(0, date.timeIntervalSince(now))
        // Whole minutes first, so the last half minute before an hour reads "1h left", never "60m left".
        let minutes = max(1, Int((seconds / 60).rounded(.up)))
        if minutes >= 60 { return "\(Int((Double(minutes) / 60).rounded(.up)))h left" }
        return "\(minutes)m left"
    }
}
