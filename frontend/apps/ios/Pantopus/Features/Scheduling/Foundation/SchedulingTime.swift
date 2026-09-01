//
//  SchedulingTime.swift
//  Pantopus
//
//  Timezone helpers for the Calendarly wiring contract: ALWAYS pass `tz`
//  (IANA) on slot/calendar reads, render the backend-supplied `startLocal`,
//  but store/compare in UTC. These helpers parse UTC ISO timestamps, render a
//  UTC instant in a chosen IANA zone (for surfaces that need to reformat), and
//  source the IANA identifier list for the timezone selector.
//

import Foundation

public enum SchedulingTime {
    // MARK: - Parsing

    /// ISO-8601 parser tolerant of fractional seconds (the backend emits both
    /// `…Z` and `…​.SSSZ`).
    public static func parseUTC(_ iso: String) -> Date? {
        if let date = isoFractional.date(from: iso) { return date }
        return isoPlain.date(from: iso)
    }

    /// ISO8601DateFormatter is configured once and only read (`date(from:)` is
    /// thread-safe on Apple platforms), so sharing it is safe under strict
    /// concurrency.
    private nonisolated(unsafe) static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private nonisolated(unsafe) static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    // MARK: - Timezone source

    /// The device's IANA timezone identifier — the default `tz` to send on
    /// slot/calendar reads and the timezone selector's initial value.
    public static var deviceTimeZoneIdentifier: String {
        TimeZone.current.identifier
    }

    /// All IANA timezone identifiers, sorted — the timezone selector's source.
    public static var ianaIdentifiers: [String] {
        TimeZone.knownTimeZoneIdentifiers.sorted()
    }

    // MARK: - Rendering

    /// Render a UTC instant in the given IANA timezone. Returns `nil` if the
    /// identifier is unknown. Prefer the backend-supplied `startLocal` when
    /// present; use this only when reformatting client-side.
    public static func localString(
        utcISO: String,
        tz: String,
        dateStyle: DateFormatter.Style = .medium,
        timeStyle: DateFormatter.Style = .short
    ) -> String? {
        guard let date = parseUTC(utcISO), let zone = TimeZone(identifier: tz) else { return nil }
        let formatter = DateFormatter()
        formatter.timeZone = zone
        formatter.dateStyle = dateStyle
        formatter.timeStyle = timeStyle
        return formatter.string(from: date)
    }

    /// Render a `Date` in the given IANA timezone.
    public static func localString(
        date: Date,
        tz: String,
        dateStyle: DateFormatter.Style = .medium,
        timeStyle: DateFormatter.Style = .short
    ) -> String? {
        guard let zone = TimeZone(identifier: tz) else { return nil }
        let formatter = DateFormatter()
        formatter.timeZone = zone
        formatter.dateStyle = dateStyle
        formatter.timeStyle = timeStyle
        return formatter.string(from: date)
    }

    /// Format a `Date` as a `YYYY-MM-DD` UTC day key (for `from`/`to` slot
    /// queries, which the backend reads as ISO dates). The locale is pinned to
    /// `en_US_POSIX` (QA1480): this is a wire value, and `Locale.current`'s
    /// numbering system (e.g. ar/fa digits) would otherwise leak into the
    /// fixed format and NaN out server-side date parsing.
    public static func isoDay(_ date: Date) -> String {
        isoDay(date, in: TimeZone(identifier: "UTC"))
    }

    /// Format a `Date` as a `YYYY-MM-DD` day key in the given IANA timezone.
    /// Use this when the instant was derived with a tz-pinned calendar (e.g.
    /// `startOfDay` in the home's zone) — formatting that instant with the UTC
    /// overload shifts the day string by one for non-UTC zones. The unknown-tz
    /// fallback is `.current`, matching the `Calendar` fallback at the call
    /// sites that compute the instant.
    public static func isoDay(_ date: Date, tz: String) -> String {
        isoDay(date, in: TimeZone(identifier: tz) ?? .current)
    }

    private static func isoDay(_ date: Date, in timeZone: TimeZone?) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.timeZone = timeZone ?? TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
