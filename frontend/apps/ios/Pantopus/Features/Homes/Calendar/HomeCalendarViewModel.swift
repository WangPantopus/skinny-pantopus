//
//  HomeCalendarViewModel.swift
//  Pantopus
//
//  T6.4c (P18) — drives the Home calendar surface. Fetches
//  `GET /api/homes/:id/events` (route `backend/routes/home.js:4793`)
//  and projects the event list into:
//    - a `MonthStripState` for the feature-local `MonthStripHeader`
//      (month label, 7-day window, today index, per-day event dots,
//       user-selected day),
//    - a `BannerConfig` summary ("10 events this week · next: …")
//      with a "Today" CTA that clears the selection,
//    - a list of `RowSection`s grouped by relative day bucket
//      (TODAY / TOMORROW / THIS WEEK / NEXT WEEK / LATER, or a single
//      "ON <DATE>" section when a day is selected).
//
//  The VM uses an injectable `now` clock so unit tests can drive
//  deterministic section bucketing + month-strip dot counts.
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length cyclomatic_complexity multiline_function_chains

@Observable
@MainActor
public final class HomeCalendarViewModel: ListOfRowsDataSource {
    // MARK: - Shell contract

    public let title = "Home calendar"
    /// Home subtitle rendered on the design's centered top-bar. The
    /// shell doesn't expose a subtitle slot today, so the host view
    /// renders it directly via a `navigationTitle` override.
    public private(set) var subtitle: String?

    /// No tabs on the calendar — the chip-strip slot stays nil too;
    /// filtering happens via month-strip day taps.
    public var tabs: [ListOfRowsTab] {
        []
    }

    public var selectedTab: String = ""
    public var topBarAction: TopBarAction? {
        nil
    }

    public var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Add event",
            variant: .secondaryCreate,
            tint: .home
        ) { [onAddEvent] in onAddEvent() }
    }

    public private(set) var state: ListOfRowsState = .loading

    /// Optional summary banner rendered above the first section card
    /// when at least one event is loaded. Shows "N events this week"
    /// and the next-up event line. Tapping `Today` clears the selected
    /// day so the full agenda re-appears.
    public var banner: BannerConfig? {
        guard case .loaded = state else { return nil }
        guard let summary = currentBannerSummary(), summary.hasContent else { return nil }
        return BannerConfig(
            icon: .calendarDays,
            title: summary.title,
            subtitle: summary.subtitle,
            cta: BannerCTA(
                label: "Today",
                accessibilityLabel: "Jump to today",
                tint: .home
            ) { [weak self] in
                Task { @MainActor in self?.jumpToToday() }
            },
            tint: .home
        )
    }

    /// Month-strip state computed from the loaded events + the visible
    /// week + any user-selected day. `nil` until the first load returns.
    public private(set) var monthStrip: MonthStripState?

    // MARK: - Dependencies

    private let homeId: String
    private let api: APIClient
    private let onAddEvent: @Sendable () -> Void
    private let onOpenEvent: @Sendable (String) -> Void
    private let now: @Sendable () -> Date
    /// Calendar + time zone. Tests pin both to UTC for deterministic
    /// bucketing.
    private let calendar: Calendar
    private let timeZone: TimeZone

    private var events: [CalendarEventDTO] = []
    /// Task due-dates, bill due-dates and package expected-delivery
    /// dates plotted alongside the home events. RN's month grid does the
    /// same (`src/app/homes/[id]/calendar.tsx:48-74`) so a household can
    /// see everything that lands on a day, not just calendar entries.
    private var derived: [HomeCalendarDerivedItem] = []
    /// ISO yyyy-MM-dd anchor for the visible week strip. Defaults to
    /// "the start of the week containing `now()`". Prev / Next chevrons
    /// roll it ±7 days. Selecting a day outside the current strip
    /// re-anchors to that day's week.
    private var weekAnchorIsoDate: String
    /// User-selected day filter. `nil` means "show full agenda".
    private var selectedIsoDate: String?

    // MARK: - I10 (Home calendar & RSVP) additions

    /// Rich agenda the bespoke design renders (time-led rows + assignee
    /// avatar stacks + booking-union rows). Built alongside `state`'s
    /// RowSections (which stay for the existing projection tests).
    private(set) var agendaSections: [HomeAgendaSection] = []
    /// Empty-state kind for the bespoke agenda (nil when rows exist).
    private(set) var agendaEmpty: AgendaEmpty?
    /// Household members keyed by user id — drives avatar stacks + filters.
    private(set) var members: [String: HomeMember] = [:]
    /// Members in roster order, for the filter chip row.
    private(set) var memberOrder: [HomeMember] = []
    /// The active member-filter chip. Mutated via `selectFilter` /
    /// `clearMemberFilter` (which re-project the agenda).
    private(set) var memberFilter: MemberFilter = .all
    /// FAB "create" menu sheet.
    var isCreateMenuPresented = false
    /// Locally-presented cross-stream scheduling screen (booking detail E2,
    /// who's-free F7, find-a-time F4, …) — we can't push through HubTabRoot.
    var presentedRoute: PresentedHomeRoute?
    /// Signed-in member id (for the "Mine" filter) — resolved in `load()`.
    private var resolvedUserId: String?

    /// Member-filter chip selection.
    public enum MemberFilter: Hashable {
        case all
        case mine
        case member(id: String, name: String)
    }

    /// Bespoke-agenda empty-state kind.
    public enum AgendaEmpty: Equatable {
        case firstRun
        case filteredMember(name: String)
        case filteredDay
    }

    init(
        homeId: String,
        homeSubtitle: String? = nil,
        api: APIClient = .shared,
        onAddEvent: @escaping @Sendable () -> Void = {},
        onOpenEvent: @escaping @Sendable (String) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = HomeCalendarViewModel.localCalendar,
        timeZone: TimeZone = .current
    ) {
        self.homeId = homeId
        subtitle = homeSubtitle
        self.api = api
        self.onAddEvent = onAddEvent
        self.onOpenEvent = onOpenEvent
        self.now = now
        self.calendar = calendar
        self.timeZone = timeZone
        var cal = calendar
        cal.timeZone = timeZone
        weekAnchorIsoDate = Self.weekAnchor(for: now(), calendar: cal)
    }

    // MARK: - Lifecycle

    public func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func loadMoreIfNeeded() async {}

    // MARK: - Public mutators (driven by MonthStripHeader)

    /// Toggle a day filter. Selecting the already-selected day clears
    /// it. Selecting a day outside the current week re-anchors the
    /// strip to that day's week.
    public func selectDay(isoDate: String) {
        if selectedIsoDate == isoDate {
            selectedIsoDate = nil
        } else {
            selectedIsoDate = isoDate
            var cal = calendar
            cal.timeZone = timeZone
            if let date = Self.parseIso(isoDate, calendar: cal) {
                weekAnchorIsoDate = Self.weekAnchor(for: date, calendar: cal)
            }
        }
        rebuild()
    }

    /// Roll the visible week one increment in `direction`.
    public func shiftWeek(_ direction: WeekShift) {
        var cal = calendar
        cal.timeZone = timeZone
        guard let anchor = Self.parseIso(weekAnchorIsoDate, calendar: cal) else { return }
        let days: Int = switch direction {
        case .previous: -7
        case .next: 7
        }
        guard let shifted = cal.date(byAdding: .day, value: days, to: anchor) else { return }
        weekAnchorIsoDate = Self.weekAnchor(for: shifted, calendar: cal)
        rebuild()
    }

    /// Banner "Today" CTA — clears the selected day filter and pins
    /// the strip back to the week containing today.
    public func jumpToToday() {
        selectedIsoDate = nil
        var cal = calendar
        cal.timeZone = timeZone
        weekAnchorIsoDate = Self.weekAnchor(for: now(), calendar: cal)
        rebuild()
    }

    // MARK: - Fetching

    private func fetch() async {
        if resolvedUserId == nil { resolvedUserId = Self.signedInUserId() }
        do {
            let response: GetHomeEventsResponse = try await api.request(
                HomesEndpoints.homeEvents(homeId: homeId)
            )
            events = response.events
            // Members are best-effort (sequential, and *before* the derived
            // fan-out, so the roster is the second request the stub sees in
            // tests). Avatar stacks + filter chips degrade gracefully when
            // the roster can't be fetched.
            let occupants: OccupantsResponse? = try? await api.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            if let occupants {
                applyMembers(occupants.occupants)
            }
            // Events are the primary read — the three derived feeds are
            // best-effort side-reads that must never fail the calendar.
            await fetchDerived()
            rebuild()
        } catch {
            events = []
            derived = []
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your calendar."
            )
        }
    }

    /// `GET /api/homes/:id/tasks` (`backend/routes/home.js` via
    /// `HomesEndpoints.tasks`), `…/bills`, and `…/packages`. Each is
    /// optional: a member without `tasks.view` / `finance.view` /
    /// `mailbox.view` simply gets fewer dots.
    private func fetchDerived() async {
        async let tasksResult: GetHomeTasksResponse? = try? await api.request(
            HomesEndpoints.tasks(homeId: homeId),
            as: GetHomeTasksResponse.self
        )
        async let billsResult: GetHomeBillsResponse? = try? await api.request(
            HomesEndpoints.bills(homeId: homeId),
            as: GetHomeBillsResponse.self
        )
        async let packagesResult: GetHomePackagesResponse? = try? await api.request(
            HomesEndpoints.packages(homeId: homeId),
            as: GetHomePackagesResponse.self
        )
        let tasks = await tasksResult
        let bills = await billsResult
        let packages = await packagesResult
        // Drop anything whose due date will not resolve — an unplaceable row
        // can never reach the agenda, and keeping it would make `derived`
        // non-empty and so suppress the first-run empty state. Mirrors
        // Android's `placeable` filter in `fetchDerived`.
        derived = HomeCalendarDerivedItem.build(
            tasks: tasks?.tasks ?? [],
            bills: bills?.bills ?? [],
            packages: packages?.packages ?? []
        ).filter { HomeAgendaBuilder.parseInstant($0.dateISO, zone: timeZone) != nil }
    }

    // MARK: - State projection

    private func rebuild() {
        rebuildAgenda()
        var cal = calendar
        cal.timeZone = timeZone
        let nowDate = now()
        let parsed = events.compactMap { dto -> ParsedEvent? in
            guard let date = Self.parseIsoInstant(dto.startAt) else { return nil }
            return ParsedEvent(dto: dto, start: date, isoDate: Self.isoDay(date, calendar: cal))
        }.sorted { $0.start < $1.start }

        // Every dated thing that belongs on this month's grid: calendar
        // events plus task / bill / package due dates.
        var agenda: [AgendaEntry] = parsed.map { event in
            AgendaEntry(
                date: event.start,
                isoDate: event.isoDate,
                row: Self.row(for: event, calendar: cal) { [weak self] eventId in
                    Task { @MainActor in self?.handleTap(eventId: eventId) }
                }
            )
        }
        agenda += derived.compactMap { item in
            // Bare `yyyy-MM-dd` due dates anchor to midnight in the DISPLAY
            // zone — see `derivedRow`.
            guard let date = Self.parseIsoInstant(item.dateISO, zone: cal.timeZone) else {
                return nil
            }
            return AgendaEntry(
                date: date,
                isoDate: Self.isoDay(date, calendar: cal),
                row: Self.derivedRow(item, start: date, calendar: cal)
            )
        }
        agenda.sort { $0.date < $1.date }

        monthStrip = makeMonthStripState(entries: agenda, now: nowDate, calendar: cal)

        if agenda.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .calendarDays,
                    headline: "No events scheduled",
                    subcopy:
                    "Plan chores, repairs, birthdays, and household milestones. " +
                        "Members get notified automatically.",
                    ctaTitle: "Add event"
                ) { [onAddEvent] in onAddEvent() }
            )
            return
        }

        let filtered: [AgendaEntry]
        if let selected = selectedIsoDate {
            filtered = agenda.filter { $0.isoDate == selected }
            if filtered.isEmpty {
                state = .empty(
                    ListOfRowsState.EmptyContent(
                        icon: .calendarDays,
                        headline: "Nothing on this day",
                        subcopy: "Pick a different day or tap Today to see the full agenda.",
                        ctaTitle: "Add event"
                    ) { [onAddEvent] in onAddEvent() }
                )
                return
            }
        } else {
            filtered = agenda
        }

        let sections = Self.makeSections(
            entries: filtered,
            now: nowDate,
            calendar: cal,
            selectedIsoDate: selectedIsoDate
        )
        state = .loaded(sections: sections, hasMore: false)
    }

    private func handleTap(eventId: String) {
        onOpenEvent(eventId)
    }

    /// Project one derived due-date into a `RowModel` for the `ListOfRowsState`
    /// projection. `HomeCalendarDerivedItem.row` is the contract source for the
    /// derived palette (its own label / icon / background / foreground) and for
    /// the `detail ?? kind.label` subtitle, so it is reused wholesale; only the
    /// time stamp is overridden. A bare `yyyy-MM-dd` due date is anchored to
    /// midnight in the display zone, which the row's own UTC-pinned all-day
    /// heuristic would then read as 07:00Z and print as "12:00 AM". A date-only
    /// value has no clock time at all, so the row is all-day by construction.
    /// Mirrors Android's `derivedRow`.
    static func derivedRow(
        _ item: HomeCalendarDerivedItem,
        start: Date,
        calendar cal: Calendar
    ) -> RowModel {
        let base = item.row(calendar: cal)
        let timeLabel = HomeAgendaBuilder.isDateOnly(item.dateISO)
            ? "All day"
            : formatTime(start: start, endIso: nil, calendar: cal)
        return RowModel(
            id: base.id,
            title: base.title,
            subtitle: base.subtitle,
            template: base.template,
            leading: base.leading,
            trailing: base.trailing,
            chips: base.chips,
            timeMeta: timeLabel
        )
    }

    // MARK: - Pure projections (test surface)

    /// Build the 7-day strip state. The `weekAnchorIsoDate` field drives
    /// which 7 days appear; per-day event counts come from the parsed
    /// list. `selectedIsoDate` flows straight through so the strip
    /// highlights the user's selection.
    func makeMonthStripState(
        entries: [AgendaEntry],
        now: Date,
        calendar cal: Calendar
    ) -> MonthStripState? {
        guard let anchor = Self.parseIso(weekAnchorIsoDate, calendar: cal) else { return nil }
        let monthFmt = DateFormatter()
        monthFmt.locale = Locale(identifier: "en_US_POSIX")
        monthFmt.timeZone = cal.timeZone
        monthFmt.dateFormat = "MMMM yyyy"
        let dowFmt = DateFormatter()
        dowFmt.locale = Locale(identifier: "en_US_POSIX")
        dowFmt.timeZone = cal.timeZone
        // Narrow weekday — single initial ("S M T W T F S"), matching the
        // home-shell `MonthStrip` (NOT the 3-letter `EEE` abbreviation).
        dowFmt.dateFormat = "EEEEE"
        let dayFmt = DateFormatter()
        dayFmt.locale = Locale(identifier: "en_US_POSIX")
        dayFmt.timeZone = cal.timeZone
        dayFmt.dateFormat = "d"

        var dotCounts: [String: Int] = [:]
        for entry in entries {
            dotCounts[entry.isoDate, default: 0] += 1
        }

        var days: [MonthStripState.Day] = []
        for offset in 0..<7 {
            guard let date = cal.date(byAdding: .day, value: offset, to: anchor) else { continue }
            let iso = Self.isoDay(date, calendar: cal)
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
            selectedIsoDate: selectedIsoDate,
            todayIsoDate: Self.isoDay(now, calendar: cal)
        )
    }

    /// Bucket the events into relative date sections. When
    /// `selectedIsoDate` is set the projection emits a single
    /// "ON <DATE>" section so the host renders just that day's rows.
    public static func makeSections(
        events: [ParsedEvent],
        now: Date,
        calendar: Calendar,
        selectedIsoDate: String?,
        onTap: @escaping @MainActor @Sendable (String) -> Void
    ) -> [RowSection] {
        makeSections(
            entries: events.map { event in
                AgendaEntry(
                    date: event.start,
                    isoDate: event.isoDate,
                    row: row(for: event, calendar: calendar, onTap: onTap)
                )
            },
            now: now,
            calendar: calendar,
            selectedIsoDate: selectedIsoDate
        )
    }

    /// Bucketing over already-projected rows, so calendar events and
    /// derived task / bill / package due dates share one grouping pass.
    public static func makeSections(
        entries: [AgendaEntry],
        now: Date,
        calendar: Calendar,
        selectedIsoDate: String?
    ) -> [RowSection] {
        var cal = calendar
        cal.timeZone = calendar.timeZone
        let todayStart = cal.startOfDay(for: now)
        let tomorrowStart = cal.date(byAdding: .day, value: 1, to: todayStart) ?? todayStart
        let dayAfterTomorrowStart = cal.date(byAdding: .day, value: 2, to: todayStart) ?? todayStart
        let nextWeekStart = cal.date(byAdding: .day, value: 7, to: todayStart) ?? todayStart
        let twoWeeksOut = cal.date(byAdding: .day, value: 14, to: todayStart) ?? todayStart

        if let selected = selectedIsoDate {
            // Single-day filter — one section labelled by the date.
            return [
                RowSection(
                    id: "day-\(selected)",
                    header: dayHeader(forIso: selected, calendar: cal),
                    rows: entries.map(\.row)
                )
            ]
        }

        var today: [RowModel] = []
        var tomorrow: [RowModel] = []
        var thisWeek: [(date: Date, row: RowModel)] = []
        var nextWeek: [RowModel] = []
        var later: [RowModel] = []

        for entry in entries {
            let start = entry.date
            // Skip items from earlier calendar days — the agenda only
            // surfaces today's remaining items plus everything in the
            // future. (Past items that happen to be earlier in TODAY
            // still pass through the `start < tomorrowStart` branch.)
            if start < todayStart { continue }
            let row = entry.row
            switch start {
            case _ where start < tomorrowStart:
                today.append(row)
            case _ where start < dayAfterTomorrowStart:
                tomorrow.append(row)
            case _ where start < nextWeekStart:
                thisWeek.append((date: start, row: row))
            case _ where start < twoWeeksOut:
                nextWeek.append(row)
            default:
                later.append(row)
            }
        }

        var sections: [RowSection] = []
        if !today.isEmpty {
            sections.append(RowSection(id: "today", header: "Today", rows: today))
        }
        if !tomorrow.isEmpty {
            sections.append(RowSection(id: "tomorrow", header: "Tomorrow", rows: tomorrow))
        }
        if !thisWeek.isEmpty {
            // Within the "this week" bucket, group by day for readability.
            let grouped = Dictionary(grouping: thisWeek) { Self.isoDay($0.date, calendar: cal) }
            let ordered = grouped.keys.sorted()
            for iso in ordered {
                guard let bucket = grouped[iso] else { continue }
                sections.append(
                    RowSection(
                        id: "thisweek-\(iso)",
                        header: dayHeader(forIso: iso, calendar: cal),
                        rows: bucket.map(\.row)
                    )
                )
            }
        }
        if !nextWeek.isEmpty {
            sections.append(RowSection(id: "nextweek", header: "Next week", rows: nextWeek))
        }
        if !later.isEmpty {
            sections.append(RowSection(id: "later", header: "Later", rows: later))
        }
        return sections
    }

    /// Build one event row.
    public static func row(
        for event: ParsedEvent,
        calendar: Calendar,
        onTap: @escaping @MainActor @Sendable (String) -> Void
    ) -> RowModel {
        let category = CalendarEventCategory.from(eventType: event.dto.eventType)
        let timeLabel = formatTime(start: event.start, endIso: event.dto.endAt, calendar: calendar)
        let timeRangeLabel = formatTimeRange(
            start: event.start,
            endIso: event.dto.endAt,
            calendar: calendar
        )
        let metaParts = [
            event.dto.locationNotes,
            recurrenceShortLabel(event.dto.recurrenceRule)
        ].compactMap { $0 }.filter { !$0.isEmpty }
        let subtitle = metaParts.isEmpty
            ? timeRangeLabel
            : "\(timeRangeLabel) · \(metaParts.joined(separator: " · "))"
        let attendeeCount = event.dto.assignedTo?.count ?? 0
        var chips: [RowChip] = [
            RowChip(
                text: category.label,
                icon: category.icon,
                tint: .custom(
                    background: category.background,
                    foreground: category.foreground
                )
            )
        ]
        if attendeeCount > 0 {
            chips.append(
                RowChip(
                    text: attendeeCount == 1 ? "1 attendee" : "\(attendeeCount) attendees",
                    icon: .users,
                    tint: .status(.neutral)
                )
            )
        }
        let eventId = event.dto.id
        return RowModel(
            id: event.dto.id,
            title: event.dto.title,
            subtitle: subtitle,
            template: .statusChip,
            leading: .typeIcon(
                category.icon,
                background: category.background,
                foreground: category.foreground
            ),
            trailing: .none,
            onTap: { Task { @MainActor in onTap(eventId) } },
            body: event.dto.description,
            chips: chips,
            timeMeta: timeLabel
        )
    }

    // MARK: - Banner

    public struct BannerSummary: Sendable, Equatable {
        public let count: Int
        public let nextLabel: String?
        public var hasContent: Bool {
            count >= 1 || nextLabel != nil
        }

        public var title: String {
            if count < 1 { return "Nothing scheduled this week" }
            return count == 1 ? "1 event this week" : "\(count) events this week"
        }

        public var subtitle: String? {
            nextLabel.map { "Next · \($0)" }
        }
    }

    /// Pure projection from the parsed events + clock — exposed
    /// internal so the banner getter + tests can use it without going
    /// through the SwiftUI view body.
    func currentBannerSummary() -> BannerSummary? {
        guard !events.isEmpty else { return nil }
        var cal = calendar
        cal.timeZone = timeZone
        let nowDate = now()
        let parsed = events.compactMap { dto -> ParsedEvent? in
            guard let date = Self.parseIsoInstant(dto.startAt) else { return nil }
            return ParsedEvent(dto: dto, start: date, isoDate: Self.isoDay(date, calendar: cal))
        }.sorted { $0.start < $1.start }
        return Self.summarize(events: parsed, now: nowDate, calendar: cal)
    }

    /// Pure summary projection. Static for tests.
    public static func summarize(
        events: [ParsedEvent],
        now: Date,
        calendar: Calendar
    ) -> BannerSummary {
        var cal = calendar
        cal.timeZone = calendar.timeZone
        let weekStart = cal.startOfDay(for: now)
        let weekEnd = cal.date(byAdding: .day, value: 7, to: weekStart) ?? weekStart
        var thisWeekCount = 0
        var next: ParsedEvent?
        for ev in events {
            if ev.start >= weekStart, ev.start < weekEnd { thisWeekCount += 1 }
            if ev.start >= now, next == nil { next = ev }
        }
        let nextLabel = next.map { ev -> String in
            let category = CalendarEventCategory.from(eventType: ev.dto.eventType)
            let timeLabel = formatNextTimeLabel(ev.start, now: now, calendar: cal)
            let title = ev.dto.title
            // "Soccer game · 4:00 PM today" or "Plumber visit · 10:00 AM tomorrow"
            return "\(title) · \(timeLabel) (\(category.label))"
        }
        return BannerSummary(count: thisWeekCount, nextLabel: nextLabel)
    }

    // MARK: - Date helpers

    public struct ParsedEvent: Sendable, Equatable {
        public let dto: CalendarEventDTO
        public let start: Date
        public let isoDate: String
    }

    /// A dated agenda item after projection — either a home event or a
    /// derived task / bill / package due date. Bucketing works over
    /// these so both kinds share one grouping pass.
    public struct AgendaEntry: Sendable {
        public let date: Date
        public let isoDate: String
        public let row: RowModel

        public init(date: Date, isoDate: String, row: RowModel) {
            self.date = date
            self.isoDate = isoDate
            self.row = row
        }
    }

    public enum WeekShift: Sendable, Equatable {
        case previous
        case next
    }

    /// UTC-anchored Gregorian calendar — used by tests so date math is
    /// timezone-stable, and by the all-day heuristic (the wire stores
    /// all-day events at 00:00Z).
    public static var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        cal.firstWeekday = 1 // Sunday — matches design's week strip.
        return cal
    }

    /// Device-local Gregorian calendar (Sunday-first, matching the design's
    /// week strip) — the production default so agenda times render at the
    /// same wall time the add-event form composes instants from. Mirrors
    /// Android's `ZoneId.systemDefault()` display zone.
    public static var localCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        cal.firstWeekday = 1 // Sunday — matches design's week strip.
        return cal
    }

    /// "yyyy-MM-dd" projection for a Date in the calendar's timezone.
    public static func isoDay(_ date: Date, calendar cal: Calendar) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: date)
    }

    /// Parse a `yyyy-MM-dd` string back to a Date at start-of-day in
    /// the calendar's timezone.
    public static func parseIso(_ iso: String, calendar cal: Calendar) -> Date? {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.date(from: iso)
    }

    /// Parse a full ISO-8601 timestamp (with or without fractional
    /// seconds). Accepts bare yyyy-MM-dd as a fallback so all-day events
    /// stored without a time component still flow through.
    ///
    /// A bare `yyyy-MM-dd` carries no zone (Postgres `date` columns —
    /// `home_bills.due_date`), so `zone` decides which midnight it anchors to:
    /// pass the display zone for derived due-dates so they bucket onto the day
    /// the reader sees. Defaults to UTC, the wire convention timestamped
    /// events are pinned to, so event parsing is unchanged. Same contract as
    /// `HomeAgendaBuilder.parseInstant(_:zone:)`.
    public static func parseIsoInstant(_ iso: String, zone: TimeZone? = nil) -> Date? {
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

    /// First day of the week (Sunday) containing `date`, in `calendar`'s
    /// timezone, formatted yyyy-MM-dd.
    public static func weekAnchor(for date: Date, calendar cal: Calendar) -> String {
        let weekday = cal.component(.weekday, from: date) // 1 = Sunday
        let daysBack = weekday - cal.firstWeekday
        let anchor = cal.date(byAdding: .day, value: -daysBack, to: cal.startOfDay(for: date))
            ?? cal.startOfDay(for: date)
        return isoDay(anchor, calendar: cal)
    }

    // MARK: - Formatting

    /// "9:00 AM" / "All day"
    static func formatTime(start: Date, endIso: String?, calendar cal: Calendar) -> String {
        if endIso == nil, isAllDay(start: start, calendar: cal) { return "All day" }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "h:mm a"
        return fmt.string(from: start)
    }

    /// "9:00 – 10:30 AM" / "All day" / "Window 12 – 8 PM"
    static func formatTimeRange(start: Date, endIso: String?, calendar cal: Calendar) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "h:mm a"
        let startLabel = fmt.string(from: start)
        guard let endIso, let end = parseIsoInstant(endIso) else {
            if isAllDay(start: start, calendar: cal) { return "All day" }
            return startLabel
        }
        let endLabel = fmt.string(from: end)
        return "\(startLabel) – \(endLabel)"
    }

    /// Relative-day stamp for the next-up event banner.
    /// "4:00 PM today" / "10:00 AM tomorrow" / "Wed Oct 15"
    static func formatNextTimeLabel(_ date: Date, now: Date, calendar cal: Calendar) -> String {
        let nowDay = cal.startOfDay(for: now)
        let evDay = cal.startOfDay(for: date)
        let delta = cal.dateComponents([.day], from: nowDay, to: evDay).day ?? 0
        let time = DateFormatter()
        time.locale = Locale(identifier: "en_US_POSIX")
        time.timeZone = cal.timeZone
        time.dateFormat = "h:mm a"
        let timeStr = time.string(from: date)
        switch delta {
        case 0: return "\(timeStr) today"
        case 1: return "\(timeStr) tomorrow"
        default:
            let dayFmt = DateFormatter()
            dayFmt.locale = Locale(identifier: "en_US_POSIX")
            dayFmt.timeZone = cal.timeZone
            dayFmt.dateFormat = "EEE MMM d"
            return "\(timeStr) · \(dayFmt.string(from: date))"
        }
    }

    /// Section header for a specific yyyy-MM-dd. "Wed Oct 15".
    static func dayHeader(forIso iso: String, calendar cal: Calendar) -> String {
        guard let date = parseIso(iso, calendar: cal) else { return iso }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = cal.timeZone
        fmt.dateFormat = "EEE MMM d"
        return fmt.string(from: date)
    }

    /// "All day" heuristic — backend doesn't expose an explicit flag,
    /// so we treat events whose `start_at` lands at exactly midnight
    /// UTC and that carry no `end_at` as all-day. Pinned to UTC (the wire
    /// convention) regardless of the display calendar passed by callers.
    static func isAllDay(start: Date, calendar _: Calendar) -> Bool {
        let parts = utcCalendar.dateComponents([.hour, .minute, .second], from: start)
        return (parts.hour ?? 0) == 0 && (parts.minute ?? 0) == 0 && (parts.second ?? 0) == 0
    }

    /// Light human-readable label for an RRULE string. We don't parse
    /// the full grammar; we surface the most common Pantopus-emitted
    /// shapes ("FREQ=WEEKLY", "FREQ=YEARLY", "FREQ=MONTHLY"). Anything
    /// else is squashed to "Repeats".
    static func recurrenceShortLabel(_ rrule: String?) -> String? {
        guard let rrule, !rrule.isEmpty else { return nil }
        let upper = rrule.uppercased()
        if upper.contains("FREQ=WEEKLY") { return "Repeats weekly" }
        if upper.contains("FREQ=YEARLY") { return "Repeats yearly" }
        if upper.contains("FREQ=MONTHLY") { return "Repeats monthly" }
        if upper.contains("FREQ=DAILY") { return "Repeats daily" }
        return "Repeats"
    }

    // MARK: - I10 agenda projection + navigation

    /// Build the member lookup + ordered roster from the occupants list.
    private func applyMembers(_ occupants: [OccupantDTO]) {
        var lookup: [String: HomeMember] = [:]
        var order: [HomeMember] = []
        for occupant in occupants where occupant.isActive {
            let trimmed = occupant.displayName?.trimmingCharacters(in: .whitespaces) ?? ""
            let name = trimmed.isEmpty ? (occupant.username ?? "Member") : trimmed
            let member = HomeMember(
                id: occupant.userId,
                name: name,
                isYou: occupant.userId == resolvedUserId
            )
            lookup[occupant.userId] = member
            order.append(member)
        }
        members = lookup
        memberOrder = order
    }

    /// Rebuild the bespoke agenda from the current events + member + day
    /// filters. Runs alongside the RowSection projection in `rebuild()`.
    func rebuildAgenda() {
        var cal = calendar
        cal.timeZone = timeZone
        let onlyUser: String? = switch memberFilter {
        case .all: nil
        case .mine: resolvedUserId
        case let .member(id, _): id
        }
        let nowDate = now()
        let eventSections = HomeAgendaBuilder.sections(
            events: events,
            members: members,
            now: nowDate,
            calendar: cal,
            timeZone: timeZone,
            selectedIsoDate: selectedIsoDate,
            onlyUserId: onlyUser
        )
        // Derived task / bill / package due dates share the agenda with the
        // home's own events, under EVERY member filter including "Mine".
        // They carry no household owner, so scoping them by assignee would
        // hide them behind any chip but "All" — the empty-looking month the
        // feed exists to prevent. It would also contradict the month strip,
        // which counts its dots with no member filter applied: a day would
        // show a dot while its agenda section came back empty.
        let sections = agendaSectionsWithDerived(eventSections, now: nowDate, calendar: cal)
        agendaSections = sections
        if !sections.isEmpty {
            agendaEmpty = nil
        } else if events.isEmpty, derived.isEmpty {
            agendaEmpty = .firstRun
        } else if case let .member(_, name) = memberFilter {
            agendaEmpty = .filteredMember(name: name)
        } else if memberFilter == .mine {
            agendaEmpty = .filteredMember(name: "you")
        } else if selectedIsoDate != nil {
            agendaEmpty = .filteredDay
        } else {
            agendaEmpty = .firstRun
        }
    }

    /// Fold the derived task / bill / package due dates into the bespoke
    /// agenda. `HomeAgendaBuilder` only speaks `CalendarEventDTO` (it is
    /// shared with the gated scheduler, F15), so the derived rows are
    /// projected here and merged into their day's section, time-ordered
    /// alongside the events. Without this the derived feeds would only
    /// reach the month-strip dots — the design's list renders
    /// `agendaSections`, not the `ListOfRowsState` projection.
    private func agendaSectionsWithDerived(
        _ eventSections: [HomeAgendaSection],
        now nowDate: Date,
        calendar cal: Calendar
    ) -> [HomeAgendaSection] {
        guard !derived.isEmpty else { return eventSections }
        let todayStart = cal.startOfDay(for: nowDate)
        // Sort keys for the merge — events by `start_at`, derived rows by
        // their due date, both keyed on the row id.
        var instants: [String: Date] = [:]
        for dto in events {
            // Same anchor `HomeAgendaBuilder.sections` bucketed with — a bare
            // date resolved at UTC here would sort against a locally-bucketed
            // section and interleave wrongly.
            guard let date = HomeAgendaBuilder.parseInstant(dto.startAt, zone: cal.timeZone) else { continue }
            instants[dto.id] = date
        }

        var buckets: [String: [HomeAgendaItem]] = [:]
        var order: [String] = []
        for section in eventSections {
            buckets[section.id] = section.items
            order.append(section.id)
        }
        for item in derived {
            // `zone: cal.timeZone` — a bill's `due_date` is a bare
            // Postgres `date`, so it has no zone on the wire. Anchoring it at
            // UTC midnight and then bucketing with the device-local calendar
            // renders it a day early west of UTC, and drops an item due today
            // through the `date >= todayStart` window below.
            guard let date = HomeAgendaBuilder.parseInstant(
                item.dateISO,
                zone: cal.timeZone
            ) else { continue }
            let iso = Self.isoDay(date, calendar: cal)
            // Same windowing the builder applies to events: the selected
            // day when one is picked, otherwise today-forward only.
            if let selected = selectedIsoDate {
                guard iso == selected else { continue }
            } else {
                guard date >= todayStart else { continue }
            }
            instants[item.id] = date
            if buckets[iso] == nil { order.append(iso) }
            buckets[iso, default: []].append(
                derivedAgendaItem(item, start: date, calendar: cal)
            )
        }

        return order.sorted().map { iso in
            let items = (buckets[iso] ?? []).enumerated().sorted { lhs, rhs in
                let left = instants[lhs.element.id] ?? .distantPast
                let right = instants[rhs.element.id] ?? .distantPast
                if left == right { return lhs.offset < rhs.offset }
                return left < right
            }
            return HomeAgendaSection(
                id: iso,
                header: HomeAgendaBuilder.header(forIso: iso, now: nowDate, calendar: cal),
                items: items.map(\.element)
            )
        }
    }

    /// Project one derived due-date into the design's agenda row.
    ///
    /// - The status / amount rides the row's own `detail` slot, falling back to
    ///   the kind label exactly as the `ListOfRowsState` subtitle does. It is
    ///   never appended to the title: the title is `lineLimit(1)`, so the
    ///   appended text would be the first thing ellipsised away.
    /// - `derived` carries the kind through so the row renders its own
    ///   label / icon / tint. `category` is inert on these rows — it exists
    ///   only because the field is non-optional, hence `.generic`.
    /// - A non-nil `derived` is also the read-only marker: the row card gives
    ///   these rows no tap affordance at all (no button, no ripple), because
    ///   they mirror surfaces that own their own screens.
    private func derivedAgendaItem(
        _ item: HomeCalendarDerivedItem,
        start: Date,
        calendar cal: Calendar
    ) -> HomeAgendaItem {
        // A bare `yyyy-MM-dd` due date carries no clock time, so the row is
        // all-day by construction. Re-deriving it would ask the UTC-pinned
        // midnight heuristic about a local-midnight anchor and get "12:00 AM".
        // Timestamped derived dates (task `due_at`, package `expected_at`)
        // still go through that shared heuristic, unchanged.
        let allDay = HomeAgendaBuilder.isDateOnly(item.dateISO)
            || Self.isAllDay(start: start, calendar: cal)
        let (time, ampm) = HomeAgendaBuilder.timeParts(start, allDay: allDay, calendar: cal)
        // `detail ?? kind.label`, blank-safe — the same predicate Android's
        // `detail?.takeIf(String::isNotBlank) ?: kind.label` applies, so a
        // whitespace-only status falls back to the kind label on both platforms.
        let subtitle = item.detail.flatMap {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0
        } ?? item.kind.label
        return HomeAgendaItem(
            id: item.id,
            time: time,
            ampm: ampm,
            title: item.title,
            category: .generic,
            location: nil,
            members: [],
            isBooking: false,
            bookingStatus: nil,
            bookingId: nil,
            eventId: nil,
            derived: item.kind,
            subtitle: subtitle
        )
    }

    /// The filter chips: All · Mine · <each member>.
    var filterChips: [MemberFilter] {
        var chips: [MemberFilter] = [.all, .mine]
        chips.append(contentsOf: memberOrder.map { .member(id: $0.id, name: $0.name) })
        return chips
    }

    func selectFilter(_ filter: MemberFilter) {
        memberFilter = filter
        rebuildAgenda()
    }

    func clearMemberFilter() {
        memberFilter = .all
        rebuildAgenda()
    }

    /// Tap an agenda row: booking-union rows deep-link to the Scheduling
    /// Booking Detail (E2) via the router; normal events open the home detail.
    /// Derived task / bill / package rows are mirrors of surfaces that own
    /// their own screens, so they stay read-only exactly as in RN's calendar —
    /// they are the only rows that are neither a booking nor an event. The row
    /// card also renders them without any tap affordance, so this guard is the
    /// belt to that view-layer braces.
    func openAgendaItem(_ item: HomeAgendaItem) {
        guard item.derived == nil else { return }
        guard item.isBooking || item.eventId != nil else { return }
        if item.isBooking, let bookingId = item.bookingId {
            presentedRoute = PresentedHomeRoute(
                .bookingDetail(owner: .home(homeId: homeId), bookingId: bookingId)
            )
        } else {
            onOpenEvent(item.eventId ?? item.id)
        }
    }

    /// Home id exposed for the local cross-stream route presenter's owner
    /// context. (The `homeId` stored prop stays private.)
    var homeIdForRouting: String {
        homeId
    }

    func openWhosFree() {
        presentedRoute = PresentedHomeRoute(
            .whosFree(homeId: homeId, tz: TimeZone.current.identifier)
        )
    }

    func openCreateMenu() {
        isCreateMenuPresented = true
    }

    /// Handle a create-menu selection. "Add event" reuses the host's
    /// `onAddEvent`; the rest fan out to other-stream screens, presented
    /// locally through the router.
    func selectCreateAction(_ action: HomeCreateAction) {
        isCreateMenuPresented = false
        switch action {
        case .addEvent:
            onAddEvent()
        case .findATime:
            presentedRoute = PresentedHomeRoute(.findATimeSetup(homeId: homeId))
        case .bookResource:
            presentedRoute = PresentedHomeRoute(.resourceList(homeId: homeId))
        case .scheduleVisit:
            presentedRoute = PresentedHomeRoute(.scheduleVisit(homeId: homeId))
        }
    }

    /// The signed-in member id, for the "Mine" filter.
    static func signedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.id
        }
        return nil
    }
}
