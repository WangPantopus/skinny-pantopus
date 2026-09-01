//
//  RecurringSetupViewModel.swift
//  Pantopus
//
//  D12 Recurring / Multi-Session Setup (Stream I7). Lets the owner lay out a
//  weekly series — weekday + time + session count — then builds the `sessions[]`
//  (UTC ISO starts) and books them in one call (`POST /api/scheduling/bookings/
//  recurring`). A 409 surfaces the nearest open times through the Foundation
//  `SlotTakenSheet` (never a dead end), prompting the owner to adjust the pattern
//  and retry. Tokens only.
//

import SwiftUI

@Observable
@MainActor
final class RecurringSetupViewModel {
    enum State: Equatable {
        case loading
        case configuring
        /// The series-summary / recap step (design Frame 4) — a read-back of the
        /// selected occurrences before the final confirm. Reached from the
        /// configuring screen's "Review N bookings" CTA; view-only, no fetch.
        case reviewing
        case confirming
        case booked(count: Int)
        case error(message: String)
    }

    /// How the series count is bounded — a session count, or an end date
    /// (design Frame 5 "Number of sessions / Until a date" segmented toggle).
    /// View-only end-condition modelling; the request still ships explicit
    /// session instants, so "Until a date" derives the count locally.
    enum EndCondition: Hashable {
        case count
        case untilDate
    }

    /// Per-occurrence availability status. The configure/recap surfaces model
    /// every occurrence, but without per-week availability data they all resolve
    /// to `.open`. `.conflict` / `.unavailable` are reserved for when the engine
    /// can flag individual weeks (deferred — needs an availability lookup).
    enum OccurrenceStatus: Equatable {
        case open
        case conflict
        case unavailable
    }

    let owner: SchedulingOwner
    let eventTypeId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var eventType: EventTypeDTO?

    // Pattern configuration (observed → drives the live preview).
    var weekdayIndex: Int = 2 // 0=Sun … 6=Sat (default Tuesday, matching the design)
    var timeOfDay: Date = RecurringSetupViewModel.defaultTime()
    var count: Int = 6
    let minCount = 1
    let maxCount = 52

    /// Whether the count control is expanded into the picker panel (design
    /// Frame 5). View-only — toggled by tapping the stepper count.
    var countPickerExpanded = false
    /// Which end-condition tab is active inside the expanded count picker.
    var endCondition: EndCondition = .count
    /// The quick-pick session counts shown in the expanded picker grid.
    let quickPickCounts = [4, 6, 8, 12]
    /// Occurrence indices the owner has removed on the recap step (design
    /// Frame 4 per-row "x"). Drives which sessions are actually booked.
    private(set) var removedIndices: Set<Int> = []

    /// Drives the 409 recovery sheet; set when a confirm comes back conflicting.
    var slotConflict: SlotConflictItem?
    /// Shown as a banner after a conflict so the owner knows to adjust.
    private(set) var conflictHint = false

    private var didLoad = false
    private var isFetching = false

    init(
        owner: SchedulingOwner,
        eventTypeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.push = push
        self.client = client
    }

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }
        state = .loading
        do {
            let response: EventTypeDetailResponse = try await client.request(
                SchedulingEndpoints.getEventType(owner: owner, id: eventTypeId)
            )
            eventType = response.eventType
            state = .configuring
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "We couldn't load this event type.")
        } catch {
            state = .error(message: "We couldn't load this event type.")
        }
    }

    // MARK: - Count stepper

    func incrementCount() {
        guard count < maxCount else { return }
        count += 1
        clearConflictHint()
    }

    func decrementCount() {
        guard count > minCount else { return }
        count -= 1
        clearConflictHint()
    }

    func setCount(_ value: Int) {
        count = min(max(value, minCount), maxCount)
        clearConflictHint()
    }

    func setWeekday(_ index: Int) {
        weekdayIndex = index
        clearConflictHint()
    }

    /// Tapping the count toggles the expanded picker panel (design Frame 5).
    func toggleCountPicker() {
        countPickerExpanded.toggle()
    }

    func setEndCondition(_ condition: EndCondition) {
        endCondition = condition
    }

    private func clearConflictHint() {
        conflictHint = false
        removedIndices.removeAll()
    }

    // MARK: - Session computation

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar
    }

    /// The local start instants for the configured series.
    var sessions: [Date] {
        let calendar = calendar
        let now = Date()
        let comps = calendar.dateComponents([.hour, .minute], from: timeOfDay)
        let today = calendar.startOfDay(for: now)
        guard var anchor = calendar.date(
            bySettingHour: comps.hour ?? 9,
            minute: comps.minute ?? 0,
            second: 0,
            of: today
        ) else { return [] }

        // Shift to the next matching weekday (1=Sun … 7=Sat in Calendar).
        let target = weekdayIndex + 1
        let current = calendar.component(.weekday, from: anchor)
        let delta = (target - current + 7) % 7
        anchor = calendar.date(byAdding: .day, value: delta, to: anchor) ?? anchor
        if anchor < now {
            anchor = calendar.date(byAdding: .day, value: 7, to: anchor) ?? anchor
        }

        return (0..<count).compactMap { calendar.date(byAdding: .day, value: $0 * 7, to: anchor) }
    }

    /// One occurrence: its local start instant plus its availability status.
    /// Without per-week availability data every occurrence resolves to `.open`;
    /// the status is modelled view-side so the row/strip can already render the
    /// conflict/full treatments once an availability lookup feeds it (deferred).
    struct Occurrence: Equatable {
        let index: Int
        let date: Date
        var status: OccurrenceStatus
    }

    /// The configured occurrences, each tagged with its availability status.
    var occurrences: [Occurrence] {
        sessions.enumerated().map { index, date in
            Occurrence(index: index, date: date, status: status(forIndex: index))
        }
    }

    /// Per-occurrence status. Always `.open` until an availability source can
    /// flag individual weeks as taken (`.conflict`) or full (`.unavailable`).
    private func status(forIndex _: Int) -> OccurrenceStatus {
        .open
    }

    /// The occurrences the owner is actually booking — the configured series
    /// minus any removed on the recap step (design Frame 4).
    var bookableOccurrences: [Occurrence] {
        occurrences.filter { !removedIndices.contains($0.index) && $0.status != .unavailable }
    }

    /// How many occurrences will be booked after removals.
    var bookableCount: Int {
        bookableOccurrences.count
    }

    /// Remove / restore a single occurrence on the recap step.
    func toggleRemoved(index: Int) {
        if removedIndices.contains(index) {
            removedIndices.remove(index)
        } else {
            removedIndices.insert(index)
        }
    }

    // MARK: - Recap step (design Frame 4)

    /// "Review N bookings" → the read-back recap. View-only; no fetch.
    func review() {
        countPickerExpanded = false
        state = .reviewing
    }

    /// Back out of the recap to keep adjusting the pattern.
    func backToConfigure() {
        state = .configuring
    }

    /// The series as UTC ISO start strings — the `sessions[]` request payload,
    /// honoring any occurrences removed on the recap step.
    var sessionISOs: [String] {
        bookableOccurrences.map { Self.isoUTC($0.date) }
    }

    // MARK: - Confirm

    func confirm() async {
        let isos = sessionISOs
        guard !isos.isEmpty else { return }
        state = .confirming
        let request = RecurringBookingRequest(
            eventTypeId: eventTypeId,
            sessions: isos,
            inviteeTimezone: TimeZone.current.identifier
        )
        do {
            let response: RecurringBookingsResponse = try await client.request(
                SchedulingEndpoints.createRecurringBookings(owner: owner, request)
            )
            state = .booked(count: response.bookings.count)
        } catch let error as SchedulingError {
            if let conflict = SlotConflictItem(error: error) {
                slotConflict = conflict
                conflictHint = true
                state = .configuring
            } else {
                state = .error(message: error.userMessage ?? "We couldn't book your series.")
            }
        } catch {
            state = .error(message: "We couldn't book your series.")
        }
    }

    /// Dismiss the recovery sheet — the owner adjusts the pattern and retries.
    func dismissConflict() {
        slotConflict = nil
    }

    // MARK: - Presentation helpers

    var durationMin: Int {
        eventType?.defaultDuration ?? eventType?.durations.first ?? 30
    }

    var isPriced: Bool {
        SchedulingFeatureFlags.paidEnabled && (eventType?.priceCents ?? 0) > 0
    }

    var perSessionPriceLabel: String? {
        guard isPriced else { return nil }
        return EdgeFormat.money(cents: eventType?.priceCents, currency: eventType?.currency)
    }

    var totalPriceLabel: String? {
        guard isPriced, let price = eventType?.priceCents else { return nil }
        return EdgeFormat.money(cents: price * bookableCount, currency: eventType?.currency)
    }

    /// `$40 each` line on the recap footer (design Frame 4). Nil when free.
    var perSessionEachLabel: String? {
        guard let each = perSessionPriceLabel else { return nil }
        return "\(each) each"
    }

    /// The event-type name for the recap header ("Intro call"). The design also
    /// shows "· with <host>", but the host display name isn't on this surface's
    /// payload, so it's omitted rather than faked.
    var recapEventName: String {
        eventType?.name ?? "Series"
    }

    /// State-aware occurrence overline ("All 6 open"). Conflict/full counts are
    /// reserved for when availability data can mark individual weeks.
    var occurrenceOverline: String {
        let open = occurrences.filter { $0.status == .open }.count
        let conflict = occurrences.filter { $0.status == .conflict }.count
        let full = occurrences.filter { $0.status == .unavailable }.count
        var parts: [String] = []
        if conflict == 0 && full == 0 {
            return "All \(open) open"
        }
        if open > 0 { parts.append("\(open) open") }
        if conflict > 0 { parts.append("\(conflict) needs a new time") }
        if full > 0 { parts.append("\(full) full") }
        return parts.joined(separator: " · ")
    }

    var weekdayName: String {
        let symbols = calendar.weekdaySymbols
        let index = min(max(weekdayIndex, 0), symbols.count - 1)
        return symbols[index]
    }

    var timeLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = .current
        formatter.setLocalizedDateFormatFromTemplate("jmm")
        return formatter.string(from: timeOfDay)
    }

    /// `Jun 16 – Jul 21` — the span of the booked occurrences.
    var rangeLabel: String? {
        let dates = bookableOccurrences.map(\.date)
        guard let first = dates.first else { return nil }
        let from = monthDay(first)
        guard let last = dates.last, dates.count > 1 else { return from }
        return "\(from) – \(monthDay(last))"
    }

    /// The host-pillar accent — sky for Personal, green for Home, violet for
    /// Business. Paints the selected occurrences and the active CTA, per the
    /// design's "Host pillar accent" note.
    var accent: Color {
        owner.theme.accent
    }

    /// Lightest pillar tint — selected/recap chips, the summary chip fill.
    var accentBg: Color {
        owner.theme.accentBg
    }

    private func monthDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.timeZone = .current
        formatter.setLocalizedDateFormatFromTemplate("MMMd")
        return formatter.string(from: date)
    }

    static func isoUTC(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func defaultTime() -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar.date(bySettingHour: 14, minute: 0, second: 0, of: Date()) ?? Date()
    }
}

#if DEBUG
extension RecurringSetupViewModel {
    static func previewConfiguring() -> RecurringSetupViewModel {
        let viewModel = RecurringSetupViewModel(owner: .personal, eventTypeId: "et1", push: { _ in }, client: .shared)
        // swiftlint:disable line_length
        let json = #"""
        {"eventType":{"id":"et1","name":"Intro call","slug":"intro","durations":[30],"default_duration":30,"price_cents":4000,"currency":"usd"}}
        """#
        // swiftlint:enable line_length
        if let data = json.data(using: .utf8), let response = try? JSONDecoder().decode(EventTypeDetailResponse.self, from: data) {
            viewModel.eventType = response.eventType
        }
        viewModel.state = .configuring
        viewModel.didLoad = true
        return viewModel
    }

    static func previewReviewing() -> RecurringSetupViewModel {
        let viewModel = previewConfiguring()
        viewModel.state = .reviewing
        return viewModel
    }
}
#endif
