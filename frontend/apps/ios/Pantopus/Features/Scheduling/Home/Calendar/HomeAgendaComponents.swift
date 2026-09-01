//
//  HomeAgendaComponents.swift
//  Pantopus
//
//  Stream I10 — the design's day-grouped agenda model + row card, shared by
//  the Home Calendar (F1) and the Permission-Gated Scheduler (F15) so the
//  time-led row, category chip, booking-union badge, and assignee avatar
//  stack read identically on both. Lifted from `home-shell.jsx` (`EventRow`,
//  `DaySection`) + `home-calendar-frames.jsx`.
//

import SwiftUI

// swiftlint:disable file_length

// MARK: - Model

/// One agenda row, projected from a `CalendarEventDTO` (+ the member lookup),
/// or from a `HomeCalendarDerivedItem` (task / bill / package due date).
public struct HomeAgendaItem: Sendable, Hashable, Identifiable {
    public let id: String
    /// "6:30" / "All day".
    public let time: String
    /// "PM" / "" (empty for all-day).
    public let ampm: String
    public let title: String
    public let category: CalendarEventCategory
    public let location: String?
    public let members: [HomeMember]
    /// Booking-union row (`source == "booking"`). Render-only, deep-links to E2.
    public let isBooking: Bool
    /// "pending" | "confirmed" (booking rows only).
    public let bookingStatus: String?
    /// The originating booking id (booking rows only) — for the E2 deep-link.
    public let bookingId: String?
    /// The home-event id (normal rows) — for the F2 detail push.
    public let eventId: String?
    /// Non-null for the read-only derived task / bill / package due-date rows.
    /// Such a row's whole visual identity — label, icon, background,
    /// foreground — comes from this kind and never from `category`: a bill
    /// must read in the Home pillar's unpaid red, not the category palette's
    /// paid-green. It is also the row's read-only marker, so the row card
    /// renders it with no tap affordance at all (no button, no highlight, no
    /// `.isButton` trait).
    ///
    /// Parity contract — mirrored in Android `HomeAgendaItem.derived`.
    public let derived: HomeCalendarDerivedKind?
    /// Secondary line under the title. Derived rows carry
    /// `detail ?? kind.label` here rather than folded into `title`, which is
    /// `lineLimit(1)` and would ellipsise it away first.
    public let subtitle: String?

    public init(
        id: String,
        time: String,
        ampm: String,
        title: String,
        category: CalendarEventCategory,
        location: String?,
        members: [HomeMember],
        isBooking: Bool,
        bookingStatus: String?,
        bookingId: String?,
        eventId: String?,
        derived: HomeCalendarDerivedKind? = nil,
        subtitle: String? = nil
    ) {
        self.id = id
        self.time = time
        self.ampm = ampm
        self.title = title
        self.category = category
        self.location = location
        self.members = members
        self.isBooking = isBooking
        self.bookingStatus = bookingStatus
        self.bookingId = bookingId
        self.eventId = eventId
        self.derived = derived
        self.subtitle = subtitle
    }
}

/// A day section in the agenda, with a relative header ("Today · Mon Jun 16").
public struct HomeAgendaSection: Sendable, Hashable, Identifiable {
    public let id: String
    public let header: String
    public let items: [HomeAgendaItem]
}

// MARK: - Builder

/// Pure projection from events → day-grouped agenda sections. Static so it's
/// trivially unit-testable. Mirrors `HomeCalendarViewModel`'s bucketing but
/// produces the richer `HomeAgendaItem` (assignees + booking-union) the
/// bespoke design row needs.
public enum HomeAgendaBuilder {
    // swiftlint:disable:next function_parameter_count
    public static func sections(
        events: [CalendarEventDTO],
        members: [String: HomeMember],
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone,
        selectedIsoDate: String?,
        onlyUserId: String? = nil
    ) -> [HomeAgendaSection] {
        var cal = calendar
        cal.timeZone = timeZone

        let parsed: [(date: Date, dto: CalendarEventDTO)] = events
            .compactMap { dto in
                // `zone: cal.timeZone` — a value with no zone on the wire
                // anchors to local midnight in the display zone. Timestamped
                // `start_at` values (every real home event) are unaffected.
                guard let date = parseInstant(dto.startAt, zone: cal.timeZone) else { return nil }
                return (date, dto)
            }
            .filter { entry in
                guard let only = onlyUserId else { return true }
                return (entry.dto.assignedTo ?? []).contains(only)
            }
            .sorted { $0.date < $1.date }

        let todayStart = cal.startOfDay(for: now)

        // Group by ISO day, keeping only today + future (or the selected day).
        var buckets: [String: [HomeAgendaItem]] = [:]
        var order: [String] = []
        for entry in parsed {
            let iso = isoDay(entry.date, calendar: cal)
            if let selected = selectedIsoDate {
                guard iso == selected else { continue }
            } else {
                guard entry.date >= todayStart else { continue }
            }
            let item = item(from: entry.dto, start: entry.date, members: members, calendar: cal)
            if buckets[iso] == nil { order.append(iso) }
            buckets[iso, default: []].append(item)
        }

        return order.map { iso in
            HomeAgendaSection(
                id: iso,
                header: header(forIso: iso, now: now, calendar: cal),
                items: buckets[iso] ?? []
            )
        }
    }

    // MARK: Item projection

    static func item(
        from dto: CalendarEventDTO,
        start: Date,
        members: [String: HomeMember],
        calendar cal: Calendar
    ) -> HomeAgendaItem {
        // Timestamped all-day rows are stored at midnight UTC + nil end — that
        // heuristic stays pinned to UTC no matter which zone the agenda
        // displays in. A bare `yyyy-MM-dd` is all-day by definition, and says
        // so explicitly rather than relying on the zone its midnight lands in.
        let allDay = isDateOnly(dto.startAt)
            || (dto.endAt == nil && isMidnight(start, calendar: utcHeuristicCalendar))
        let (time, ampm) = timeParts(start, allDay: allDay, calendar: cal)
        let assignees = (dto.assignedTo ?? []).compactMap { members[$0] }
        let isBooking = dto.source == "booking"
        return HomeAgendaItem(
            id: dto.id,
            time: time,
            ampm: ampm,
            title: dto.title,
            category: CalendarEventCategory.from(eventType: dto.eventType),
            location: dto.locationNotes?.isEmpty == false ? dto.locationNotes : nil,
            members: assignees,
            isBooking: isBooking,
            bookingStatus: dto.bookingStatus,
            bookingId: dto.bookingId,
            eventId: isBooking ? nil : dto.id
        )
    }

    // MARK: Formatting

    static func timeParts(_ date: Date, allDay: Bool, calendar cal: Calendar) -> (String, String) {
        if allDay { return ("All day", "") }
        let timeFmt = DateFormatter()
        timeFmt.locale = Locale(identifier: "en_US_POSIX")
        timeFmt.timeZone = cal.timeZone
        timeFmt.dateFormat = "h:mm"
        let ampmFmt = DateFormatter()
        ampmFmt.locale = Locale(identifier: "en_US_POSIX")
        ampmFmt.timeZone = cal.timeZone
        ampmFmt.dateFormat = "a"
        return (timeFmt.string(from: date), ampmFmt.string(from: date))
    }

    static func header(forIso iso: String, now: Date, calendar cal: Calendar) -> String {
        guard let date = parseIso(iso, calendar: cal) else { return iso }
        let dayFmt = DateFormatter()
        dayFmt.locale = Locale(identifier: "en_US_POSIX")
        dayFmt.timeZone = cal.timeZone
        dayFmt.dateFormat = "EEE MMM d"
        let stamp = dayFmt.string(from: date)
        let todayStart = cal.startOfDay(for: now)
        let dayStart = cal.startOfDay(for: date)
        let delta = cal.dateComponents([.day], from: todayStart, to: dayStart).day ?? 0
        switch delta {
        case 0: return "Today · \(stamp)"
        case 1: return "Tomorrow · \(stamp)"
        default: return stamp
        }
    }

    static func isMidnight(_ date: Date, calendar cal: Calendar) -> Bool {
        let parts = cal.dateComponents([.hour, .minute, .second], from: date)
        return (parts.hour ?? 0) == 0 && (parts.minute ?? 0) == 0 && (parts.second ?? 0) == 0
    }

    /// UTC calendar backing the all-day heuristic (wire stores 00:00Z).
    private static var utcHeuristicCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        if let utc = TimeZone(identifier: "UTC") {
            cal.timeZone = utc
        }
        return cal
    }

    static func isoDay(_ date: Date, calendar cal: Calendar) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }

    static func parseIso(_ iso: String, calendar cal: Calendar) -> Date? {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: iso)
    }

    /// True when a wire value is a bare `yyyy-MM-dd` calendar date — no clock
    /// time, no zone. Postgres `date` columns serialise this way
    /// (`home_bills.due_date`, `backend/database/schema.sql:6194`), and a bare
    /// date means "this day wherever you read it", not an instant. Callers use
    /// it both to pick the anchor zone below and to mark the row all-day
    /// without asking the UTC-pinned midnight heuristic, which would see a
    /// local-midnight anchor as 07:00Z and print "12:00 AM".
    /// Mirrors Android `HomeAgendaBuilder.isDateOnly`.
    static func isDateOnly(_ iso: String) -> Bool {
        guard iso.count == 10 else { return false }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: iso) != nil
    }

    /// Resolve a wire date into an instant.
    ///
    /// A bare `yyyy-MM-dd` has no zone on the wire, so it anchors to **midnight
    /// in the display `zone`**, not midnight UTC: pinning it to UTC renders
    /// every date-only row one day early west of UTC and drops an item due
    /// today out of the agenda's "not before today" window. Timestamped values
    /// are unaffected — they carry their own offset.
    ///
    /// The default zone keeps the callers that only ever see timestamps (event
    /// detail, the gated scheduler) on their previous behaviour.
    /// Mirrors Android `HomeAgendaBuilder.parseInstant(iso, zone)`.
    static func parseInstant(_ iso: String, zone: TimeZone? = nil) -> Date? {
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: iso) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let d = plain.date(from: iso) { return d }
        let dayFmt = DateFormatter()
        dayFmt.locale = Locale(identifier: "en_US_POSIX")
        dayFmt.timeZone = zone ?? TimeZone(identifier: "UTC")
        dayFmt.dateFormat = "yyyy-MM-dd"
        return dayFmt.date(from: iso)
    }

    // MARK: Month strip

    /// First day of the week (Sunday) containing `date`, ISO yyyy-MM-dd.
    static func weekAnchorIso(for date: Date, calendar cal: Calendar) -> String {
        let weekday = cal.component(.weekday, from: date) // 1 = Sunday
        let daysBack = weekday - cal.firstWeekday
        let anchor = cal.date(byAdding: .day, value: -daysBack, to: cal.startOfDay(for: date))
            ?? cal.startOfDay(for: date)
        return isoDay(anchor, calendar: cal)
    }

    // swiftlint:disable function_parameter_count
    /// Build a 7-day `MonthStripState` for the week anchored at `anchorIso`,
    /// counting events per day. Used by the gated scheduler (F15).
    static func weekStrip(
        events: [CalendarEventDTO],
        anchorIso: String,
        selectedIso: String?,
        now: Date,
        calendar: Calendar,
        timeZone: TimeZone
    ) -> MonthStripState? {
        // swiftlint:enable function_parameter_count
        var cal = calendar
        cal.timeZone = timeZone
        guard let anchor = parseIso(anchorIso, calendar: cal) else { return nil }

        var dotCounts: [String: Int] = [:]
        for dto in events {
            guard let date = parseInstant(dto.startAt, zone: cal.timeZone) else { continue }
            dotCounts[isoDay(date, calendar: cal), default: 0] += 1
        }

        let monthFmt = DateFormatter()
        monthFmt.locale = Locale(identifier: "en_US_POSIX")
        monthFmt.timeZone = cal.timeZone
        monthFmt.dateFormat = "MMMM yyyy"
        let dowFmt = DateFormatter()
        dowFmt.locale = Locale(identifier: "en_US_POSIX")
        dowFmt.timeZone = cal.timeZone
        dowFmt.dateFormat = "EEE"
        let dayFmt = DateFormatter()
        dayFmt.locale = Locale(identifier: "en_US_POSIX")
        dayFmt.timeZone = cal.timeZone
        dayFmt.dateFormat = "d"

        var days: [MonthStripState.Day] = []
        for offset in 0..<7 {
            guard let date = cal.date(byAdding: .day, value: offset, to: anchor) else { continue }
            let iso = isoDay(date, calendar: cal)
            days.append(
                MonthStripState.Day(
                    id: iso,
                    dayOfWeek: dowFmt.string(from: date),
                    date: Int(dayFmt.string(from: date)) ?? 0,
                    eventCount: dotCounts[iso] ?? 0
                )
            )
        }
        return MonthStripState(
            monthLabel: monthFmt.string(from: anchor),
            days: days,
            selectedIsoDate: selectedIso,
            todayIsoDate: isoDay(now, calendar: cal)
        )
    }
}

// MARK: - Row card

/// The design's `EventRow`: a 42pt time column, a 1px divider, the title with
/// a category chip + booking badge + location, and a trailing assignee stack.
public struct HomeAgendaRowCard: View {
    let item: HomeAgendaItem
    var dimmed: Bool = false
    let onTap: @MainActor () -> Void

    public init(item: HomeAgendaItem, dimmed: Bool = false, onTap: @escaping @MainActor () -> Void) {
        self.item = item
        self.dimmed = dimmed
        self.onTap = onTap
    }

    public var body: some View {
        // Derived task / bill / package rows are read-only: they render as a
        // plain container, NOT a `Button` with a no-op action. A no-op button
        // still takes the press, flashes, and carries the `.isButton` trait,
        // which reads as "this opens something" when nothing does. Mirrors
        // Android, where the derived row is rendered with `enabled = false`.
        if item.derived != nil {
            card
                .accessibilityElement(children: .combine)
                .accessibilityLabel(accessibilityLabel)
                .accessibilityIdentifier("homeAgendaRow_\(item.id)")
        } else {
            Button(action: onTap) { card }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityLabel(accessibilityLabel)
                .accessibilityIdentifier("homeAgendaRow_\(item.id)")
        }
    }

    private var card: some View {
        HStack(spacing: Spacing.s3) {
            VStack(spacing: 1) {
                Text(item.time)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .monospacedDigit()
                if !item.ampm.isEmpty {
                    Text(item.ampm)
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
            }
            .frame(width: 42)

            Rectangle().fill(Theme.Color.appBorder).frame(width: 1)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                // A derived row's `detail ?? kind.label` rides its own line
                // between the title and the chip row — never folded into the
                // title, which is lineLimit(1) and would ellipsise the amount
                // away first. 11.5pt mirrors Android's HomeAgendaRowCard.
                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                }
                HStack(spacing: Spacing.s1) {
                    // A derived row's identity comes from its own kind, never
                    // from `CalendarEventCategory` (which paints a bill green).
                    if let kind = item.derived {
                        DerivedKindChipMini(kind: kind)
                    } else {
                        CategoryChipMini(category: item.category)
                    }
                    if item.isBooking {
                        HomeBookingTag()
                        if let status = item.bookingStatus {
                            SchedulingStatusPill(status: status)
                        }
                    }
                    if let location = item.location {
                        HStack(spacing: 3) {
                            Icon(.mapPin, size: 10, color: Theme.Color.appTextSecondary)
                            Text(location)
                                .font(.system(size: 10.5))
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
            Spacer(minLength: Spacing.s1)
            if !item.members.isEmpty {
                HomeAvatarStack(members: item.members, size: 26)
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .opacity(dimmed ? 0.55 : 1)
        .contentShape(Rectangle())
    }

    private var accessibilityLabel: String {
        var parts = [
            "\(item.time) \(item.ampm)",
            item.title,
            item.derived?.label ?? item.category.label
        ]
        if item.isBooking { parts.append("Booking") }
        if let subtitle = item.subtitle { parts.append(subtitle) }
        if let location = item.location { parts.append(location) }
        return parts.joined(separator: ", ")
    }
}

/// The derived-feed chip. `HomeCalendarDerivedKind` owns its own label, icon
/// and tint — tasks = warning, bills = error, deliveries = business — so the
/// colour-coding reads the same across the Home pillar. That palette is a
/// documented cross-platform contract; routing a derived row through
/// `CalendarEventCategory` instead renders an unpaid bill in the "paid / ok"
/// green. Mirrors Android's `DerivedKindChipMini`.
public struct DerivedKindChipMini: View {
    let kind: HomeCalendarDerivedKind

    public init(kind: HomeCalendarDerivedKind) {
        self.kind = kind
    }

    public var body: some View {
        HStack(spacing: 4) {
            Icon(kind.icon, size: 9, color: kind.foreground)
            Text(kind.label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(kind.foreground)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(kind.background)
        .clipShape(Capsule())
    }
}

/// The design's small category chip (sunken pill + colour dot + label).
public struct CategoryChipMini: View {
    let category: CalendarEventCategory

    public init(category: CalendarEventCategory) {
        self.category = category
    }

    public var body: some View {
        HStack(spacing: Spacing.s1) {
            Circle().fill(category.foreground).frame(width: 7, height: 7)
            Text(category.label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
    }
}

/// Shimmer skeleton row mirroring the loaded geometry (never a spinner).
public struct HomeAgendaSkeletonRow: View {
    public init() {}
    public var body: some View {
        HStack(spacing: Spacing.s3) {
            VStack(spacing: 4) {
                Shimmer(width: 30, height: 11)
                Shimmer(width: 20, height: 8)
            }
            .frame(width: 42)
            Rectangle().fill(Theme.Color.appBorder).frame(width: 1, height: 36)
            VStack(alignment: .leading, spacing: 6) {
                Shimmer(width: 150, height: 11)
                Shimmer(width: 90, height: 9)
            }
            Spacer()
            Shimmer(width: 26, height: 26, cornerRadius: 13)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 11)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}
