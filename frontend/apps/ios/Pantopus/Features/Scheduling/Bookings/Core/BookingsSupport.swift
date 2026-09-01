//
//  BookingsSupport.swift
//  Pantopus
//
//  Stream I8 (Bookings Inbox & Core) — small presentation helpers shared by the
//  inbox (E1), booking detail (E2), and the approve/decline · reschedule ·
//  cancel sheets (E3–E5): the status-tab filter, the per-row owner pillar
//  (derived from the booking's `owner_type` wire string, never a hardcoded hue),
//  tz-aware time formatting (always render a local string, store/compare UTC),
//  relative day-section bucketing, and the reason/refund option models.
//

import SwiftUI

// MARK: - Status tab filter

/// The four inbox tabs. The raw value is the `status` query the backend reads
/// (`GET /bookings?status=…`): `upcoming` = confirmed+future, `pending` =
/// awaiting approval, `past` = confirmed|completed|no_show+past, `cancelled` =
/// cancelled|declined.
enum BookingStatusFilter: String, CaseIterable, Hashable {
    case upcoming
    case pending
    case past
    case cancelled

    var title: String {
        switch self {
        case .upcoming: "Upcoming"
        case .pending: "Pending"
        case .past: "Past"
        case .cancelled: "Cancelled"
        }
    }

    /// Past/cancelled lists read newest-first; upcoming/pending soonest-first.
    var isDescending: Bool {
        switch self {
        case .upcoming, .pending: false
        case .past, .cancelled: true
        }
    }
}

// MARK: - Owner pillar (per-row identity accent)

/// Maps a booking's `owner_type` wire string to the host's identity pillar so
/// each row/header can accent off its owner without touching hex. Mirrors the
/// Foundation `SchedulingIdentityTheme` mapping used everywhere else.
enum BookingsPillar {
    static func owner(forType ownerType: String?) -> SchedulingOwner {
        switch (ownerType ?? "").lowercased() {
        case "home": .home(homeId: "")
        case "business": .business(id: "")
        default: .personal
        }
    }

    static func accent(forType ownerType: String?) -> Color {
        owner(forType: ownerType).theme.accent
    }

    static func accentBg(forType ownerType: String?) -> Color {
        owner(forType: ownerType).theme.accentBg
    }

    /// The short owner label rendered by the row's owner glyph ("Personal" /
    /// "Home" / "Business"). The route carries only the owner id, so a specific
    /// home/business name isn't available here.
    static func label(forType ownerType: String?) -> String {
        owner(forType: ownerType).theme.title
    }

    /// Whether reassignment is available — home/business only (a personal
    /// booking has no team to reassign to). Drives the E2/E4 reassign affordance.
    static func supportsReassign(_ owner: SchedulingOwner) -> Bool {
        switch owner {
        case .personal: false
        case .home, .business: true
        }
    }
}

// MARK: - Time formatting (UTC in, local string out)

/// tz-aware formatting for host booking surfaces. The host views their own
/// bookings in the device timezone; instants are stored/compared in UTC.
enum BookingsTime {
    /// The host's display timezone (their device zone).
    static var displayTimeZone: String {
        SchedulingTime.deviceTimeZoneIdentifier
    }

    private static func calendar(_ tz: String) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz) ?? .current
        return cal
    }

    /// The short, DST-aware zone abbreviation for the trailing "· PT" suffix.
    static func zoneAbbreviation(_ tz: String, at date: Date = Date()) -> String {
        guard let zone = TimeZone(identifier: tz) else { return "" }
        if let abbr = zone.abbreviation(for: date), !abbr.isEmpty, !abbr.hasPrefix("GMT") {
            return abbr
        }
        let seconds = zone.secondsFromGMT(for: date)
        if seconds == 0 { return "GMT" }
        let hours = seconds / 3600
        return "GMT\(seconds < 0 ? "-" : "+")\(abs(hours))"
    }

    /// Row "when" line: "Today · 2:00 PM · PT" when the booking is today, else
    /// "Sat, Jun 14 · 10:00 AM · PT".
    static func relativeWhen(startUTC: String?, tz: String = displayTimeZone) -> String {
        guard let startUTC, let date = SchedulingTime.parseUTC(startUTC) else { return "—" }
        let cal = calendar(tz)
        let time = timeString(date, tz: tz)
        let zone = zoneAbbreviation(tz, at: date)
        if cal.isDateInToday(date) {
            return "Today · \(time) · \(zone)"
        }
        let day = dateString(date, tz: tz, format: "EEE, MMM d")
        return "\(day) · \(time) · \(zone)"
    }

    /// E2 header line: "Thu, Jun 18 · 2:00–2:30 PM · PT".
    static func headerWhen(startUTC: String?, endUTC: String?, tz: String = displayTimeZone) -> String {
        guard let startUTC, let start = SchedulingTime.parseUTC(startUTC) else { return "—" }
        let day = dateString(start, tz: tz, format: "EEE, MMM d")
        let range = timeRange(startUTC: startUTC, endUTC: endUTC, tz: tz)
        let zone = zoneAbbreviation(tz, at: start)
        return "\(day) · \(range) · \(zone)"
    }

    /// "11:00–11:45 AM" (the meridiem is shown once, on the end time).
    static func timeRange(startUTC: String?, endUTC: String?, tz: String = displayTimeZone) -> String {
        guard let startUTC, let start = SchedulingTime.parseUTC(startUTC) else { return "—" }
        guard let endUTC, let end = SchedulingTime.parseUTC(endUTC) else {
            return timeString(start, tz: tz)
        }
        let cal = calendar(tz)
        let sameMeridiem = (cal.component(.hour, from: start) < 12) == (cal.component(.hour, from: end) < 12)
        let startStr = sameMeridiem ? timeStringNoMeridiem(start, tz: tz) : timeString(start, tz: tz)
        let endStr = timeString(end, tz: tz)
        return "\(startStr)–\(endStr)"
    }

    /// Compact sheet subtitle date+time: "Mon, Jun 16 · 11:00 AM".
    static func shortWhen(startUTC: String?, tz: String = displayTimeZone) -> String {
        guard let startUTC, let start = SchedulingTime.parseUTC(startUTC) else { return "—" }
        let day = dateString(start, tz: tz, format: "EEE, MMM d")
        return "\(day) · \(timeString(start, tz: tz))"
    }

    /// Duration in minutes between two UTC instants, e.g. "45 min".
    static func durationLabel(startUTC: String?, endUTC: String?) -> String? {
        guard let startUTC, let endUTC,
              let start = SchedulingTime.parseUTC(startUTC),
              let end = SchedulingTime.parseUTC(endUTC) else { return nil }
        let minutes = Int(end.timeIntervalSince(start) / 60)
        guard minutes > 0 else { return nil }
        return "\(minutes) min"
    }

    private static func timeString(_ date: Date, tz: String) -> String {
        format(date, tz: tz) { fmt in
            // Pinned 12-hour clock (QA1480), matching `timeStringNoMeridiem` —
            // `timeStyle = .short` follows the user's 24-hour override, which
            // mixed the two clock conventions inside one range ("2:00–14:30").
            fmt.locale = Locale(identifier: "en_US_POSIX")
            fmt.dateFormat = "h:mm a"
        }
    }

    private static func timeStringNoMeridiem(_ date: Date, tz: String) -> String {
        format(date, tz: tz) { fmt in
            fmt.locale = Locale(identifier: "en_US_POSIX")
            // 12-hour clock without the trailing AM/PM (shown once on the range end).
            fmt.dateFormat = date.minute(in: tz) == 0 ? "h" : "h:mm"
        }
    }

    private static func dateString(_ date: Date, tz: String, format pattern: String) -> String {
        format(date, tz: tz) { $0.dateFormat = pattern }
    }

    private static func format(_ date: Date, tz: String, _ configure: (DateFormatter) -> Void) -> String {
        let fmt = DateFormatter()
        fmt.timeZone = TimeZone(identifier: tz) ?? .current
        configure(fmt)
        return fmt.string(from: date)
    }
}

private extension Date {
    func minute(in tz: String) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz) ?? .current
        return cal.component(.minute, from: self)
    }
}

// MARK: - Calendar math (host reschedule slot picker)

/// tz-aware day math for the E4 reschedule picker, mirroring the
/// `Calendar(identifier:.gregorian)` + zone the Foundation `SlotPicker` uses, so
/// `availableDays` / the selected-day filter line up exactly.
enum BookingsCalendar {
    static func calendar(tz: String) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz) ?? .current
        return cal
    }

    static func availableDays(_ slots: [SlotDTO], tz: String) -> Set<Date> {
        let cal = calendar(tz: tz)
        return Set(slots.compactMap { SchedulingTime.parseUTC($0.start).map { cal.startOfDay(for: $0) } })
    }

    static func slots(_ slots: [SlotDTO], on day: Date, tz: String) -> [SlotDTO] {
        let cal = calendar(tz: tz)
        let target = cal.startOfDay(for: day)
        return slots
            .filter { SchedulingTime.parseUTC($0.start).map { cal.startOfDay(for: $0) == target } ?? false }
            .sorted { $0.start < $1.start }
    }

    /// `from`/`to` ISO day strings (in `tz`) covering the visible month, clamped
    /// to today, never inverted.
    static func monthRange(monthAnchor: Date, tz: String) -> (from: String, to: String) {
        let cal = calendar(tz: tz)
        let interval = cal.dateInterval(of: .month, for: monthAnchor)
        let start = interval?.start ?? monthAnchor
        let end = interval?.end ?? cal.date(byAdding: .month, value: 1, to: monthAnchor) ?? monthAnchor
        let today = cal.startOfDay(for: Date())
        let from = max(start, today)
        let to = max(end, from)
        return (isoDay(from, tz: tz), isoDay(to, tz: tz))
    }

    static func isoDay(_ date: Date, tz: String) -> String {
        let fmt = DateFormatter()
        fmt.calendar = Calendar(identifier: .iso8601)
        fmt.timeZone = TimeZone(identifier: tz) ?? .current
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }
}

// MARK: - Day sections

/// A relative day bucket that groups the inbox list ("Today", "Tomorrow",
/// "Later this week", …). Ordered so future buckets read soonest-first and past
/// buckets newest-first.
struct BookingDaySection: Hashable {
    let title: String
    /// Sort key — ascending for upcoming, the view reverses for past/cancelled.
    let order: Int

    static func section(forStartUTC startUTC: String?, tz: String = BookingsTime.displayTimeZone) -> BookingDaySection {
        guard let startUTC, let date = SchedulingTime.parseUTC(startUTC) else {
            return BookingDaySection(title: "Scheduled", order: 1000)
        }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz) ?? .current
        let today = cal.startOfDay(for: Date())
        let day = cal.startOfDay(for: date)
        let diff = cal.dateComponents([.day], from: today, to: day).day ?? 0
        switch diff {
        case 0: return BookingDaySection(title: "Today", order: 0)
        case 1: return BookingDaySection(title: "Tomorrow", order: 1)
        case 2...6: return BookingDaySection(title: "Later this week", order: 2)
        case let d where d >= 7: return BookingDaySection(title: "Later", order: 3)
        case -1: return BookingDaySection(title: "Yesterday", order: -1)
        case -6 ... -2: return BookingDaySection(title: "Earlier this week", order: -2)
        default: return BookingDaySection(title: "Earlier", order: -3)
        }
    }
}

// MARK: - Initials

enum BookingsAvatar {
    /// Up to two uppercase initials from a name, falling back to "·".
    static func initials(from name: String?) -> String {
        let parts = (name ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ")
            .prefix(2)
        let initials = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return initials.isEmpty ? "·" : initials
    }

    /// Two-character initials from an opaque id (the E4 reassign rail has only
    /// host ids — no roster names — so it shows the first two id chars, like
    /// Android's `MemberOption`).
    static func initials(fromId id: String) -> String {
        let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "·" : String(trimmed.prefix(2)).uppercased()
    }
}

// MARK: - Decline / cancel reasons & refund presets

/// E3 decline reason chips.
enum DeclineReason: String, CaseIterable, Hashable {
    case timeDoesntWork
    case fullyBooked
    case notAFit
    case other

    var label: String {
        switch self {
        case .timeDoesntWork: "Time doesn't work"
        case .fullyBooked: "Fully booked"
        case .notAFit: "Not a fit"
        case .other: "Other"
        }
    }
}

/// E5 cancel reason chips.
enum CancelReason: String, CaseIterable, Hashable {
    case changedPlans
    case emergency
    case foundSomeoneElse
    case other

    var label: String {
        switch self {
        case .changedPlans: "Changed plans"
        case .emergency: "Emergency"
        case .foundSomeoneElse: "Found someone else"
        case .other: "Other"
        }
    }
}

/// E5 refund mode segmented control. Only shown for paid bookings.
enum RefundPreset: String, CaseIterable, Hashable {
    case full
    case partial
    case perPolicy

    var label: String {
        switch self {
        case .full: "Full"
        case .partial: "Partial"
        case .perPolicy: "Per policy"
        }
    }
}

/// E4 apply-mode segmented control (host only). "Propose" sends the new time for
/// the invitee to accept; "Reschedule now" moves it immediately.
enum RescheduleMode: String, CaseIterable, Hashable {
    case propose
    case now

    var label: String {
        switch self {
        case .propose: "Propose to invitee"
        case .now: "Reschedule now"
        }
    }
}
