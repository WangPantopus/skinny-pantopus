//
//  ResourceKit.swift
//  Pantopus
//
//  Stream I12 — Home resources & visits. Shared, view-less helpers consumed by
//  F9–F14: resource/visit type → icon+label mapping, smart rule defaults,
//  `available_hours` round-tripping, the household member projection, time
//  formatting, and the FEATURE-LOCAL booking projection.
//
//  ── Foundation gap (flagged, not patched here) ─────────────────────────────
//  Resource bookings are `Booking` rows with `resource_id` set + `event_type_id
//  = null`. Neither the shared `CalendarEventDTO` (calendar union) nor the
//  shared `BookingDTO` decodes `resource_id`, and the backend `/events` union
//  (home.js:5053) does not emit `resource_id` at all. So a resource-DETAIL view
//  cannot scope bookings to one resource via those shared shapes. Until the
//  shared DTOs carry `resourceId` (and the union emits `resource_id`), F9/F11/
//  F12 read the host bookings list (`GET …/scheduling/bookings`, which selects
//  `*` and therefore returns `resource_id`) through the local `ResourceBooking`
//  decode below and filter client-side. This consumes the shared endpoint
//  factory read-only and never creates `HomeCalendarEvent` rows.
//

import Foundation

// MARK: - Resource type

/// The bookable resource taxonomy (`resource_type` wire enum). Drives the
/// leading tile glyph and the type badge label across F9–F12.
enum ResourceKind: String, CaseIterable {
    case room
    case vehicle
    case tool
    case charger
    case other

    /// Tolerant mapping from a wire string (defaults to `.other`).
    init(wire: String?) {
        self = ResourceKind(rawValue: wire ?? "") ?? .other
    }

    /// Title-case label shown in the editor chip + type badge.
    var label: String {
        switch self {
        case .room: "Room"
        case .vehicle: "Vehicle"
        case .tool: "Tool"
        case .charger: "Charger"
        case .other: "Other"
        }
    }

    /// Leading tile glyph. (No `bed`/`car-front` glyph exists in `PantopusIcon`;
    /// `.doorOpen` reads as a room and `.car` as a vehicle.)
    var icon: PantopusIcon {
        switch self {
        case .room: .doorOpen
        case .vehicle: .car
        case .tool: .wrench
        case .charger: .zap
        case .other: .package
        }
    }

    /// Smart defaults surfaced when the host picks a type in the editor
    /// (F10 collapsed-rule helper). Mirrors the design's "Charger defaults:
    /// 4 hr max · No approval".
    var defaultRules: ResourceRuleDefaults {
        switch self {
        case .charger: ResourceRuleDefaults(maxDurationMin: 240, bufferMin: 0, requiresApproval: false)
        case .room: ResourceRuleDefaults(maxDurationMin: 720, bufferMin: 30, requiresApproval: false)
        case .vehicle: ResourceRuleDefaults(maxDurationMin: 480, bufferMin: 15, requiresApproval: true)
        case .tool: ResourceRuleDefaults(maxDurationMin: 240, bufferMin: 0, requiresApproval: false)
        case .other: ResourceRuleDefaults(maxDurationMin: 120, bufferMin: 0, requiresApproval: false)
        }
    }
}

/// Smart rule defaults seeded from a resource type.
struct ResourceRuleDefaults: Equatable {
    var maxDurationMin: Int
    var bufferMin: Int
    var requiresApproval: Bool
}

/// `who_can_book` wire enum (v1 honours `members`; `specific`/`guests` are
/// stored but gate to members server-side).
enum WhoCanBook: String, CaseIterable {
    case members
    case specific
    case guests

    init(wire: String?) {
        self = WhoCanBook(rawValue: wire ?? "") ?? .members
    }

    /// Segmented-control label per the F10 design (`All / Specific / Guest link`).
    var label: String {
        switch self {
        case .members: "All"
        case .specific: "Specific"
        case .guests: "Guest link"
        }
    }
}

// MARK: - Visit type

/// `visit_type` wire enum. The backend accepts ONLY `vendor` | `guest`
/// (scheduling.js:973) — the design's Delivery/Service chips have no v1
/// persistence, so this stream ships the two contract-backed types.
enum VisitKind: String, CaseIterable {
    case vendor
    case guest

    init(wire: String?) {
        self = VisitKind(rawValue: wire ?? "") ?? .vendor
    }

    var label: String {
        switch self {
        case .vendor: "Vendor"
        case .guest: "Guest"
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .vendor: .wrench
        case .guest: .userRound
        }
    }
}

// MARK: - Available hours

/// Structured projection of a resource's opaque `available_hours` jsonb.
/// The backend stores it verbatim; this stream owns the shape:
/// `{ "days": [1,2,3,4,5], "start": "07:00", "end": "22:00" }` (days are
/// `Calendar` weekday integers, Sun = 1 … Sat = 7).
struct AvailableHours: Equatable {
    /// Sun = 1 … Sat = 7, matching `Calendar.component(.weekday:)`.
    var days: Set<Int>
    /// `HH:mm` (24h).
    var start: String
    /// `HH:mm` (24h).
    var end: String

    /// Mon–Fri, 9–5 — the editor's seed when a resource has no stored hours.
    static let weekdayDefault = AvailableHours(days: [2, 3, 4, 5, 6], start: "09:00", end: "17:00")

    init(days: Set<Int>, start: String, end: String) {
        self.days = days
        self.start = start
        self.end = end
    }

    /// Lenient decode from the stored jsonb (returns `nil` for an empty `{}`).
    init?(json: JSONValue?) {
        guard let dict = json?.dictValue, !dict.isEmpty else { return nil }
        let days = dict["days"]?.arrayValue?.compactMap { $0.numberValue.map { Int($0) } } ?? []
        guard !days.isEmpty,
              let start = dict["start"]?.stringValue,
              let end = dict["end"]?.stringValue
        else { return nil }
        self.days = Set(days)
        self.start = start
        self.end = end
    }

    /// Encode back to jsonb for `POST`/`PUT /resources`.
    var json: JSONValue {
        .object([
            "days": .array(days.sorted().map { JSONValue.number(Double($0)) }),
            "start": .string(start),
            "end": .string(end)
        ])
    }

    /// "7 AM – 10 PM" window label for the editor value row.
    var windowLabel: String {
        "\(ResourceTime.clockLabel(hhmm: start)) – \(ResourceTime.clockLabel(hhmm: end))"
    }
}

// MARK: - Household member projection

/// Lightweight household member used for avatars + the who-is-home / for-whom
/// pickers. Projected from the shared `OccupantDTO` roster.
struct ResourceHomeMember: Identifiable, Hashable {
    let id: String
    let name: String
    let avatarURL: URL?

    /// 1–2 letter initials for the avatar disc.
    var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }

    /// Stable palette index (0–5) so a member keeps the same avatar tone
    /// across screens without storing colour server-side.
    var toneIndex: Int {
        var hash = 5381
        for byte in id.utf8 {
            hash = ((hash << 5) &+ hash) &+ Int(byte)
        }
        return abs(hash) % MemberTone.allCases.count
    }

    var tone: MemberTone {
        MemberTone.allCases[toneIndex]
    }

    init(id: String, name: String, avatarURL: URL? = nil) {
        self.id = id
        self.name = name
        self.avatarURL = avatarURL
    }

    /// Project the active-occupant roster into bookable members.
    static func from(occupants: [OccupantDTO]) -> [ResourceHomeMember] {
        occupants
            .filter(\.isActive)
            .map { occupant in
                ResourceHomeMember(
                    id: occupant.userId,
                    name: occupant.displayName ?? occupant.username ?? "Member",
                    avatarURL: occupant.avatarUrl.flatMap(URL.init(string:))
                )
            }
    }
}

/// Token-mapped avatar tones (kept off raw hex; resolved by `MemberAvatar`).
enum MemberTone: CaseIterable {
    case green, sky, violet, amber, rose, teal
}

// MARK: - Feature-local booking projection

/// A resource booking row read from `GET …/scheduling/bookings` (host list).
/// Decodes `resource_id` — which the shared `BookingDTO` omits — so resource
/// detail/booking screens can scope to one resource. See the Foundation-gap
/// note at the top of this file.
struct ResourceBooking: Decodable, Hashable, Identifiable {
    let id: String
    let resourceId: String?
    let startAt: String?
    let endAt: String?
    let inviteeName: String?
    let status: String?
    let createdBy: String?
    let hostUserId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case resourceId = "resource_id"
        case startAt = "start_at"
        case endAt = "end_at"
        case inviteeName = "invitee_name"
        case status
        case createdBy = "created_by"
        case hostUserId = "host_user_id"
    }

    /// Active (non-cancelled) bookings only.
    var isLive: Bool {
        status == "confirmed" || status == "pending"
    }

    var isPending: Bool {
        status == "pending"
    }
}

/// Envelope for `GET …/scheduling/bookings` decoded into the local row shape.
struct ResourceBookingsResponse: Decodable {
    let bookings: [ResourceBooking]
}

// MARK: - Time helpers

/// Date/time formatting + composition for the resources & visits surfaces. All
/// reads pass the device IANA tz; instants are stored/compared in UTC.
enum ResourceTime {
    /// Device IANA tz — sent on every calendar read, used for local rendering.
    static var tz: String {
        SchedulingTime.deviceTimeZoneIdentifier
    }

    private static var zone: TimeZone {
        TimeZone(identifier: tz) ?? .current
    }

    /// Encode a `Date` to a UTC ISO-8601 string for write bodies.
    static func utcISO(_ date: Date) -> String {
        isoFormatter.string(from: date)
    }

    private nonisolated(unsafe) static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    /// Fixed-format label formatter pinned to `en_US_POSIX` (QA1480): without
    /// the pin, the user's 12/24-hour override rewrites the designed pattern
    /// and non-Gregorian/non-latn locales leak calendars and digits — drifting
    /// from the POSIX-pinned peers on the same Home surfaces
    /// (`HomeAgendaBuilder`, `FindATimeFormat`).
    private static func fixedFormatter(_ pattern: String, in timeZone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = pattern
        return formatter
    }

    /// "HH:mm" (24h) → "7 AM" clock label.
    static func clockLabel(hhmm: String) -> String {
        let parts = hhmm.split(separator: ":")
        guard let hour = parts.first.flatMap({ Int($0) }) else { return hhmm }
        let minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        var comps = DateComponents()
        comps.hour = hour
        comps.minute = minute
        let cal = Calendar(identifier: .gregorian)
        guard let date = cal.date(from: comps) else { return hhmm }
        // The components date was built in the current zone — format in the
        // same zone so the wall time round-trips.
        let formatter = fixedFormatter(minute == 0 ? "h a" : "h:mm a", in: .current)
        return formatter.string(from: date)
    }

    /// "9:00–11:00 AM" range from two UTC ISO instants, rendered in `tz`.
    static func rangeLabel(startISO: String?, endISO: String?) -> String {
        guard let startISO, let start = SchedulingTime.parseUTC(startISO) else { return "" }
        let end = endISO.flatMap(SchedulingTime.parseUTC)
        let sameMeridiem = end.map { Self.sameMeridiem(start, $0) } ?? true
        let formatter = fixedFormatter(sameMeridiem ? "h:mm" : "h:mm a", in: zone)
        let startText = formatter.string(from: start)
        guard let end else { return "\(startText) \(Self.meridiem(start))" }
        formatter.dateFormat = "h:mm a"
        return "\(startText)–\(formatter.string(from: end))"
    }

    /// "9:00 AM" single instant.
    static func timeLabel(_ iso: String?) -> String {
        guard let iso, let date = SchedulingTime.parseUTC(iso) else { return "" }
        return fixedFormatter("h:mm a", in: zone).string(from: date)
    }

    /// Day-section header: "Today · Mon Jun 16" / "Tomorrow · Tue Jun 17" /
    /// "Wed Jun 18".
    static func daySectionLabel(_ iso: String) -> String {
        guard let date = SchedulingTime.parseUTC(iso) else { return "" }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        let stamp = fixedFormatter("EEE MMM d", in: zone).string(from: date)
        if cal.isDateInToday(date) { return "Today · \(stamp)" }
        if cal.isDateInTomorrow(date) { return "Tomorrow · \(stamp)" }
        return stamp
    }

    /// "Sat · Jun 21" header for the F12 day strip.
    static func dayStripLabel(_ date: Date) -> String {
        fixedFormatter("EEE · MMM d", in: zone).string(from: date)
    }

    /// "Sat Jun 21 · 9:00–10:00 AM" header used on the visit detail time pill.
    static func longRangeLabel(startISO: String?, endISO: String?) -> String {
        guard let startISO, let start = SchedulingTime.parseUTC(startISO) else { return "" }
        let day = fixedFormatter("EEE MMM d", in: zone).string(from: start)
        let range = rangeLabel(startISO: startISO, endISO: endISO)
        return range.isEmpty ? day : "\(day) · \(range)"
    }

    /// "Jun 12" short date for terminal/done headers.
    static func shortDate(_ iso: String?) -> String {
        guard let iso, let date = SchedulingTime.parseUTC(iso) else { return "" }
        return fixedFormatter("MMM d", in: zone).string(from: date)
    }

    /// Day key (start-of-day in `tz`) for grouping bookings under day headers.
    static func dayKey(_ iso: String) -> Date? {
        guard let date = SchedulingTime.parseUTC(iso) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        return cal.startOfDay(for: date)
    }

    /// Combine a calendar day with an hour-of-day (local tz) into a UTC `Date`.
    static func combine(day: Date, hour: Int, minute: Int = 0) -> Date? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = zone
        return cal.date(bySettingHour: hour, minute: minute, second: 0, of: day)
    }

    private static func meridiem(_ date: Date) -> String {
        fixedFormatter("a", in: zone).string(from: date)
    }

    private static func sameMeridiem(_ lhs: Date, _ rhs: Date) -> Bool {
        meridiem(lhs) == meridiem(rhs)
    }
}
