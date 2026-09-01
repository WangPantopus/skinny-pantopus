//
//  InsightsModels.swift
//  Pantopus
//
//  Stream I17 — Insights & reports. The period/filter model that the H13 sheet
//  drives, value formatting, and the pure projection builders the four report
//  view-models consume. Everything here is `Sendable` and side-effect-free so
//  the aggregations are unit-testable without networking.
//

import Foundation

// MARK: - Period & filter (H13 drives this)

/// A date-range preset for the insights surfaces. `days` maps onto the report
/// endpoints' `days` query (≤ 365); `custom` carries an explicit start/end.
enum InsightsPeriod: String, Hashable, CaseIterable, Identifiable {
    case last7
    case last30
    case last90
    case yearToDate
    case custom

    var id: String {
        rawValue
    }

    /// Fixed-window presets; `nil` for the computed windows.
    var presetDays: Int? {
        switch self {
        case .last7: 7
        case .last30: 30
        case .last90: 90
        case .yearToDate, .custom: nil
        }
    }

    var title: String {
        switch self {
        case .last7: "Last 7 days"
        case .last30: "Last 30 days"
        case .last90: "Last 90 days"
        case .yearToDate: "Year to date"
        case .custom: "Custom range"
        }
    }
}

/// The shared insights filter. Date range drives the API window; the event-type
/// and member selections are applied client-side where a surface supports them.
struct InsightsFilter: Hashable {
    var period: InsightsPeriod = .last30
    var customStart: Date?
    var customEnd: Date?
    /// Empty == all event types.
    var eventTypeIds: Set<String> = []
    /// Empty == everyone (business team-performance only).
    var memberIds: Set<String> = []

    static let `default` = InsightsFilter()

    /// `days` window the report endpoints accept, clamped to 1…365.
    func days(now: Date = Date(), calendar: Calendar = .current) -> Int {
        switch period {
        case .last7, .last30, .last90:
            return period.presetDays ?? 30
        case .yearToDate:
            let startOfYear = calendar.date(from: calendar.dateComponents([.year], from: now)) ?? now
            let span = calendar.dateComponents([.day], from: startOfYear, to: now).day ?? 30
            return min(365, max(1, span + 1))
        case .custom:
            guard let start = customStart, let end = customEnd else { return 30 }
            let span = calendar.dateComponents(
                [.day],
                from: calendar.startOfDay(for: min(start, end)),
                to: calendar.startOfDay(for: max(start, end))
            ).day ?? 30
            return min(365, max(1, span + 1))
        }
    }

    /// `from`/`to` UTC day keys for `GET /bookings?from&to`. `to` is EXCLUSIVE
    /// (the day after the last included day): the backend parses a date-only
    /// bound as UTC midnight, so an inclusive `to` would exclude every booking
    /// on the final day — including all of today.
    func range(now: Date = Date(), calendar: Calendar = .current) -> (from: String, to: String) {
        if period == .custom, let start = customStart, let end = customEnd {
            let hi = max(start, end)
            let hiExclusive = calendar.date(byAdding: .day, value: 1, to: hi) ?? hi
            return (SchedulingTime.isoDay(min(start, end)), SchedulingTime.isoDay(hiExclusive))
        }
        let from = calendar.date(byAdding: .day, value: -days(now: now, calendar: calendar), to: now) ?? now
        let toExclusive = calendar.date(byAdding: .day, value: 1, to: now) ?? now
        return (SchedulingTime.isoDay(from), SchedulingTime.isoDay(toExclusive))
    }

    /// Number of non-date filters applied (for the Apply-button badge).
    var activeFilterCount: Int {
        (eventTypeIds.isEmpty ? 0 : 1) + (memberIds.isEmpty ? 0 : 1)
    }

    /// Short label for the period chip, e.g. "Last 30 days" or "Jun 1 – Jun 13".
    func chipLabel(now _: Date = Date()) -> String {
        if period == .custom, let start = customStart, let end = customEnd {
            return "\(InsightsFormat.shortDay(min(start, end))) – \(InsightsFormat.shortDay(max(start, end)))"
        }
        return period.title
    }
}

// MARK: - Formatting

enum InsightsFormat {
    /// A whole-number percent value (already 0–100) → "13%"; nil → em dash.
    static func percent(_ value: Double?, dashIfNil: Bool = true) -> String {
        guard let value, value.isFinite else { return dashIfNil ? "—" : "0%" }
        return "\(Int(value.rounded()))%"
    }

    /// A fraction (0–1) → "13%".
    static func percent(fraction: Double?, dashIfNil: Bool = true) -> String {
        guard let fraction, fraction.isFinite else { return dashIfNil ? "—" : "0%" }
        return "\(Int((fraction * 100).rounded()))%"
    }

    /// A signed delta percent for the trend chip, e.g. "+12%" / "-4%".
    static func signedPercent(_ delta: Int?) -> String? {
        guard let delta else { return nil }
        return "\(delta >= 0 ? "+" : "")\(delta)%"
    }

    static func count(_ value: Int?) -> String {
        "\(value ?? 0)"
    }

    /// "30 min" / "1 hr" / "1 hr 30 min".
    static func duration(min minutes: Int?) -> String {
        guard let minutes, minutes > 0 else { return "" }
        if minutes % 60 == 0 { return "\(minutes / 60) hr" }
        if minutes > 60 { return "\(minutes / 60) hr \(minutes % 60) min" }
        return "\(minutes) min"
    }

    /// "$50" / "$49.99" from a cents amount, or `nil` when free / unknown.
    static func money(cents: Int?, currency: String? = "USD") -> String? {
        guard let cents, cents > 0 else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = (currency ?? "USD").uppercased()
        formatter.maximumFractionDigits = cents % 100 == 0 ? 0 : 2
        return formatter.string(from: NSNumber(value: Double(cents) / 100))
    }

    /// "Jun 1" from a `Date` in the current locale/zone.
    static func shortDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    /// "Jun 16" from a UTC ISO string rendered in `tz`; falls back to the raw
    /// string's date portion when parsing fails.
    static func dayLabel(iso: String?, tz: String) -> String {
        guard let iso else { return "" }
        if let date = SchedulingTime.parseUTC(iso), let zone = TimeZone(identifier: tz) {
            let formatter = DateFormatter()
            formatter.timeZone = zone
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
        return String(iso.prefix(10))
    }
}

// MARK: - Projections

/// A 2×2 headline metric tile.
struct MetricTile: Identifiable, Hashable {
    let id: String
    /// Overline label (Title Case is allowed only here).
    let label: String
    let value: String
    var delta: Int?
    var caption: String?
}

/// A ranked row (top event types).
struct RankedRow: Identifiable, Hashable {
    let id: String
    let rank: Int
    let title: String
    let count: Int
    /// 0…1 share vs the top row, for the proportion bar.
    let proportion: Double
}

/// One bar in a mini bar chart.
struct DayBar: Identifiable, Hashable {
    let id: String
    let dateLabel: String
    let value: Int
    /// 0…1 height vs the tallest bar.
    let proportion: Double
    let accessibilityLabel: String
}

/// One segment of a stacked reliability bar.
struct BreakdownSegment: Identifiable, Hashable {
    enum Kind: String, Hashable { case honored, lateCancel, noShow }
    let kind: Kind
    let label: String
    let count: Int
    /// 0…1 of the total.
    var fraction: Double
    var id: String {
        kind.rawValue
    }
}

/// Aggregated funnel/stat numbers for a single event type.
struct EventTypePerf: Hashable {
    let booked: Int
    let confirmed: Int
    let completed: Int
    let noShow: Int
    let cancelled: Int
    /// Percent, `completed / (completed + noShow)` — nil when nothing concluded.
    var completionRate: Double?
    /// Percent, `noShow / (completed + noShow)` — nil when nothing concluded.
    var noShowRate: Double?

    static let empty = EventTypePerf(
        booked: 0,
        confirmed: 0,
        completed: 0,
        noShow: 0,
        cancelled: 0,
        completionRate: nil,
        noShowRate: nil
    )
}

/// A team-member row for team performance.
struct HostRow: Identifiable, Hashable {
    let id: String
    let name: String
    let initials: String
    let bookings: Int
    let completed: Int
    let noShow: Int
    let cancelled: Int
    /// Percent, `noShow / total`.
    let noShowRate: Double
    /// 0…1 share of the team's total bookings (round-robin balance bar).
    let share: Double
}

/// One selectable option (event type / member) in the H13 filter sheet.
struct InsightsFilterOption: Identifiable, Hashable {
    let id: String
    let name: String
}

/// How team performance is sorted.
enum HostSort: String, Hashable, CaseIterable {
    case bookings
    case noShow

    var title: String {
        switch self {
        case .bookings: "Bookings"
        case .noShow: "No-show rate"
        }
    }
}

// MARK: - Pure aggregation

/// Side-effect-free builders. Kept separate from the view-models so the math is
/// directly unit-testable.
enum InsightsMath {
    /// Bars from the summary's 30-day sparkline (most recent `maxBars`).
    static func dailyBars(sparkline: [InsightsSummary.SparkPoint]?, maxBars: Int = 14) -> [DayBar] {
        let points = (sparkline ?? []).suffix(maxBars)
        let maxValue = max(1, points.map { $0.count ?? 0 }.max() ?? 0)
        let tz = TimeZone.current.identifier
        return points.enumerated().map { index, point in
            let value = point.count ?? 0
            let plural = value == 1 ? "" : "s"
            let spoken = InsightsFormat.dayLabel(iso: point.date, tz: tz)
            return DayBar(
                id: "\(point.date ?? "")-\(index)",
                dateLabel: dayOfMonth(point.date),
                value: value,
                proportion: Double(value) / Double(maxValue),
                accessibilityLabel: "\(spoken): \(value) booking\(plural)"
            )
        }
    }

    /// Bars from raw bookings, bucketed by local day across the window.
    static func dailyBars(bookings: [BookingDTO], tz: String, days span: Int, now: Date = Date(), maxBars: Int = 14) -> [DayBar] {
        guard let zone = TimeZone(identifier: tz) else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone

        let keyFormatter = DateFormatter()
        keyFormatter.timeZone = zone
        keyFormatter.dateFormat = "yyyy-MM-dd"
        let labelFormatter = DateFormatter()
        labelFormatter.timeZone = zone
        labelFormatter.dateFormat = "MMM d"

        var counts: [String: Int] = [:]
        for booking in bookings {
            guard let iso = booking.startAt, let date = SchedulingTime.parseUTC(iso) else { continue }
            counts[keyFormatter.string(from: date), default: 0] += 1
        }

        let windowDays = min(max(span, 1), maxBars)
        // swiftlint:disable:next large_tuple
        var buckets: [(key: String, label: String, value: Int)] = []
        for offset in stride(from: windowDays - 1, through: 0, by: -1) {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: now) else { continue }
            let key = keyFormatter.string(from: day)
            buckets.append((key: key, label: labelFormatter.string(from: day), value: counts[key] ?? 0))
        }

        let maxValue = max(1, buckets.map(\.value).max() ?? 0)
        return buckets.enumerated().map { index, entry in
            DayBar(
                id: "\(entry.key)-\(index)",
                dateLabel: entry.label,
                value: entry.value,
                proportion: Double(entry.value) / Double(maxValue),
                accessibilityLabel: "\(entry.label): \(entry.value) booking\(entry.value == 1 ? "" : "s")"
            )
        }
    }

    /// Top event types from the summary's `byEventType`, joined to names.
    static func topEventTypes(
        byEventType: [InsightsSummary.EventTypeCount]?,
        names: [String: String],
        limit: Int = 5
    ) -> [RankedRow] {
        let buckets = (byEventType ?? [])
            .compactMap { bucket -> (id: String, count: Int)? in
                guard let id = bucket.eventTypeId else { return nil }
                return (id, bucket.count ?? 0)
            }
            .sorted { $0.count > $1.count }
            .prefix(limit)
        let maxCount = max(1, buckets.map(\.count).max() ?? 0)
        return buckets.enumerated().map { index, bucket in
            RankedRow(
                id: bucket.id,
                rank: index + 1,
                title: names[bucket.id] ?? "Untitled event type",
                count: bucket.count,
                proportion: Double(bucket.count) / Double(maxCount)
            )
        }
    }

    /// Funnel/stat numbers for one event type's bookings.
    static func eventTypePerf(bookings: [BookingDTO]) -> EventTypePerf {
        let completed = bookings.filter { $0.status == "completed" }.count
        let noShow = bookings.filter { $0.status == "no_show" }.count
        let cancelled = bookings.filter { $0.status == "cancelled" || $0.status == "declined" }.count
        let confirmed = bookings.filter { $0.status == "confirmed" }.count
        let concluded = completed + noShow
        return EventTypePerf(
            booked: bookings.count,
            confirmed: confirmed,
            completed: completed,
            noShow: noShow,
            cancelled: cancelled,
            completionRate: concluded > 0 ? Double(completed) / Double(concluded) * 100 : nil,
            noShowRate: concluded > 0 ? Double(noShow) / Double(concluded) * 100 : nil
        )
    }

    /// Reliability breakdown segments from a no-show report.
    static func breakdown(completed: Int, cancelled: Int, noShow: Int) -> [BreakdownSegment] {
        let total = max(1, completed + cancelled + noShow)
        return [
            BreakdownSegment(kind: .honored, label: "Honored", count: completed, fraction: Double(completed) / Double(total)),
            BreakdownSegment(kind: .lateCancel, label: "Late cancel", count: cancelled, fraction: Double(cancelled) / Double(total)),
            BreakdownSegment(kind: .noShow, label: "No-show", count: noShow, fraction: Double(noShow) / Double(total))
        ]
    }

    /// Host rows for team performance, joined to member names and proportioned.
    static func hostRows(
        hosts: [InsightsTeamReport.HostStat]?,
        names: [String: String],
        sort: HostSort = .bookings
    ) -> [HostRow] {
        // swiftlint:disable:next large_tuple
        let stats = (hosts ?? []).compactMap { stat -> (id: String, total: Int, completed: Int, noShow: Int, cancelled: Int)? in
            guard let id = stat.hostUserId else { return nil }
            return (id, stat.total ?? 0, stat.completed ?? 0, stat.noShow ?? 0, stat.cancelled ?? 0)
        }
        let teamTotal = max(1, stats.map(\.total).reduce(0, +))
        let rows = stats.map { stat -> HostRow in
            let name = names[stat.id] ?? "Team member"
            let rate = stat.total > 0 ? Double(stat.noShow) / Double(stat.total) * 100 : 0
            return HostRow(
                id: stat.id,
                name: name,
                initials: initials(from: name),
                bookings: stat.total,
                completed: stat.completed,
                noShow: stat.noShow,
                cancelled: stat.cancelled,
                noShowRate: rate,
                share: Double(stat.total) / Double(teamTotal)
            )
        }
        switch sort {
        case .bookings: return rows.sorted { $0.bookings > $1.bookings }
        case .noShow: return rows.sorted { $0.noShowRate > $1.noShowRate }
        }
    }

    /// A balance label for the round-robin distribution.
    static func balanceLabel(_ rows: [HostRow]) -> String {
        guard rows.count > 1 else { return "Only one member takes bookings" }
        let shares = rows.map(\.share)
        guard let maxShare = shares.max(), let leader = rows.max(by: { $0.share < $1.share }) else {
            return "Evenly distributed"
        }
        let even = 1.0 / Double(rows.count)
        // Within ~12pts of an even split reads as balanced.
        if maxShare - even <= 0.12 { return "Evenly distributed" }
        return "Skewed toward \(leader.name)"
    }

    /// Invitee names that recur in the recent list (repeat-offender flag).
    static func repeatOffenders(_ recent: [InsightsNoShowReport.RecentNoShow]) -> Set<String> {
        var counts: [String: Int] = [:]
        for row in recent {
            guard let name = row.inviteeName, !name.isEmpty else { continue }
            counts[name, default: 0] += 1
        }
        return Set(counts.filter { $0.value > 1 }.keys)
    }

    // MARK: Helpers

    static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init)
        return letters.isEmpty ? "?" : letters.joined().uppercased()
    }

    private static func dayOfMonth(_ iso: String?) -> String {
        guard let iso, iso.count >= 10 else { return "" }
        // `yyyy-MM-dd` → day number.
        let day = iso.dropFirst(8).prefix(2)
        return String(Int(day) ?? 0)
    }
}
