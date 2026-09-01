//
//  BookingFilterViewModel.swift
//  Pantopus
//
//  Stream I9 — E9 Booking Search & Filter. A bottom sheet that narrows the
//  bookings inbox by status / owner-context / event-type / date-range / text.
//  Facets map directly to `GET /bookings` query params (status, event_type_id,
//  from, to, q); the sticky CTA shows a live result count computed against the
//  active owner. The owner-context facet is recorded in the returned filters
//  for the inbox (P8) to honor — cross-owner counting is the inbox's job since
//  the backend list is per-owner.
//

import Observation
import SwiftUI

enum BookingFilterStatus: String, CaseIterable, Identifiable {
    case upcoming, pending, past, cancelled, noShow
    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .upcoming: "Upcoming"
        case .pending: "Pending"
        case .past: "Past"
        case .cancelled: "Cancelled"
        case .noShow: "No-show"
        }
    }

    /// Backend `status` query value (no-show queries `past` then filters
    /// client-side on `status == no_show`).
    var queryValue: String {
        switch self {
        case .upcoming: "upcoming"
        case .pending: "pending"
        case .past, .noShow: "past"
        case .cancelled: "cancelled"
        }
    }
}

enum BookingDateRangeFilter: String, CaseIterable, Identifiable {
    case today, thisWeek, thisMonth, custom
    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .today: "Today"
        case .thisWeek: "This week"
        case .thisMonth: "This month"
        case .custom: "Custom"
        }
    }
}

/// Owner-context facet. Carries an optional concrete `SchedulingOwner` (only the
/// active scope is fully resolvable here; others are recorded for the inbox).
enum BookingScopeFilter: String, CaseIterable, Identifiable {
    case all, personal, home, business
    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .all: "All"
        case .personal: "Personal"
        case .home: "Home"
        case .business: "Business"
        }
    }
}

/// The applied filter set returned to the presenting inbox.
struct BookingFilters: Equatable {
    var status: BookingFilterStatus?
    var eventTypeId: String?
    var dateRange: BookingDateRangeFilter?
    var customFrom: Date
    var customTo: Date
    var search: String
    var scope: BookingScopeFilter
}

extension BookingFilters {
    /// Wire-ready `from`/`to` day bounds for the date-range facet. The upper
    /// bound is EXCLUSIVE next-day midnight: the backend casts a bare day
    /// string to midnight on both `gte`/`lte`, so an inclusive same-day upper
    /// would match nothing. Shared by the E9 sheet's live count and the inbox
    /// fetch so the CTA's "Show N bookings" matches what the list renders.
    func dateBounds(now: Date = Date()) -> (from: String?, to: String?) {
        guard let dateRange else { return (nil, nil) }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        switch dateRange {
        case .today:
            let nextDay = calendar.date(byAdding: .day, value: 1, to: now) ?? now
            return (Self.isoDay(now), Self.isoDay(nextDay))
        case .thisWeek:
            if let interval = calendar.dateInterval(of: .weekOfYear, for: now) {
                return (Self.isoDay(interval.start), Self.isoDay(interval.end))
            }
        case .thisMonth:
            if let interval = calendar.dateInterval(of: .month, for: now) {
                return (Self.isoDay(interval.start), Self.isoDay(interval.end))
            }
        case .custom:
            let lower = min(customFrom, customTo)
            let upper = max(customFrom, customTo)
            // +1 day so the last selected day is included (upper is midnight).
            let upperExclusive = calendar.date(byAdding: .day, value: 1, to: upper) ?? upper
            return (Self.isoDay(lower), Self.isoDay(upperExclusive))
        }
        return (nil, nil)
    }

    static func isoDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

@Observable
@MainActor
final class BookingFilterViewModel {
    /// (id, label) for the event-type facet, supplied by the inbox.
    struct EventTypeOption: Identifiable, Hashable {
        let id: String
        let name: String
    }

    let owner: SchedulingOwner
    let eventTypeOptions: [EventTypeOption]

    var searchText: String = ""
    var selectedStatus: BookingFilterStatus?
    var selectedEventTypeId: String?
    var selectedDateRange: BookingDateRangeFilter?
    var customFrom = Date()
    var customTo = Date()
    var scope: BookingScopeFilter

    private(set) var resultCount: Int?
    private(set) var isCounting = false

    private let client: SchedulingClient
    private let defaultScope: BookingScopeFilter

    init(owner: SchedulingOwner, eventTypeOptions: [EventTypeOption], client: SchedulingClient) {
        self.owner = owner
        self.eventTypeOptions = eventTypeOptions
        self.client = client
        let scope: BookingScopeFilter = switch owner {
        case .personal: .personal
        case .home: .home
        case .business: .business
        }
        self.scope = scope
        defaultScope = scope
    }

    // MARK: Derived

    var hasActiveFilters: Bool {
        selectedStatus != nil
            || selectedEventTypeId != nil
            || selectedDateRange != nil
            || !searchText.trimmingCharacters(in: .whitespaces).isEmpty
            || scope != defaultScope
    }

    /// Stable string the view feeds to `.task(id:)` to debounce + recount.
    var filterSignature: String {
        [
            selectedStatus?.rawValue ?? "-",
            selectedEventTypeId ?? "-",
            selectedDateRange?.rawValue ?? "-",
            isoDay(customFrom),
            isoDay(customTo),
            searchText,
            scope.rawValue
        ].joined(separator: "|")
    }

    var ctaTitle: String {
        switch resultCount {
        case .none: hasActiveFilters ? "Show bookings" : "Show all bookings"
        case .some(0): "No matches"
        case let .some(count): "Show \(count) booking\(count == 1 ? "" : "s")"
        }
    }

    var ctaEnabled: Bool {
        resultCount != 0
    }

    var activeSummary: [ActiveFilterChip] {
        var chips: [ActiveFilterChip] = []
        if let selectedStatus {
            chips.append(.init(id: "status", title: selectedStatus.label, tint: statusTint(selectedStatus)))
        }
        // The active scope (pre-selected) shows as a removable chip unless "All".
        if scope != .all {
            chips.append(.init(id: "scope", title: scope.label, tint: scopeTint(scope)))
        }
        if let id = selectedEventTypeId, let option = eventTypeOptions.first(where: { $0.id == id }) {
            chips.append(.init(id: "eventType", title: option.name, tint: .neutral))
        }
        if let selectedDateRange {
            chips.append(.init(id: "date", title: selectedDateRange.label, tint: .neutral))
        }
        return chips
    }

    struct ActiveFilterChip: Identifiable, Equatable {
        let id: String
        let title: String
        let tint: ChipTint
    }

    enum ChipTint: Equatable { case neutral, warning, error, personal, home, business }

    func statusTint(_ status: BookingFilterStatus) -> ChipTint {
        switch status {
        case .pending: .warning
        case .noShow, .cancelled: .error
        default: .neutral
        }
    }

    func scopeTint(_ scope: BookingScopeFilter) -> ChipTint {
        switch scope {
        case .personal: .personal
        case .home: .home
        case .business: .business
        case .all: .neutral
        }
    }

    // MARK: Mutations

    func toggleStatus(_ status: BookingFilterStatus) {
        selectedStatus = selectedStatus == status ? nil : status
    }

    func toggleEventType(_ id: String) {
        selectedEventTypeId = selectedEventTypeId == id ? nil : id
    }

    func toggleDateRange(_ range: BookingDateRangeFilter) {
        selectedDateRange = selectedDateRange == range ? nil : range
    }

    func selectScope(_ scope: BookingScopeFilter) {
        self.scope = scope
    }

    func removeChip(_ id: String) {
        switch id {
        case "status": selectedStatus = nil
        case "scope": scope = .all
        case "eventType": selectedEventTypeId = nil
        case "date": selectedDateRange = nil
        default: break
        }
    }

    func clearAll() {
        searchText = ""
        selectedStatus = nil
        selectedEventTypeId = nil
        selectedDateRange = nil
        scope = defaultScope
    }

    func currentFilters() -> BookingFilters {
        BookingFilters(
            status: selectedStatus,
            eventTypeId: selectedEventTypeId,
            dateRange: selectedDateRange,
            customFrom: customFrom,
            customTo: customTo,
            search: searchText,
            scope: scope
        )
    }

    // MARK: Live count

    /// Debounced recount. Driven from the view via `.task(id: filterSignature)`
    /// so a rapid facet change cancels the in-flight sleep.
    func recountDebounced() async {
        isCounting = true
        do {
            try await Task.sleep(for: .milliseconds(250))
        } catch {
            return // superseded by a newer signature
        }
        await recount()
        isCounting = false
    }

    private func recount() async {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let bounds = dateBounds()
        do {
            let response: BookingsResponse = try await client.request(
                SchedulingEndpoints.getBookings(
                    owner: owner,
                    status: selectedStatus?.queryValue,
                    eventTypeId: selectedEventTypeId,
                    from: bounds.from,
                    to: bounds.to,
                    search: trimmed.isEmpty ? nil : trimmed
                )
            )
            var rows = response.bookings
            if selectedStatus == .noShow {
                rows = rows.filter { $0.status == "no_show" }
            }
            resultCount = rows.count
        } catch {
            // Leave the CTA in its "Show bookings" fallback; the inbox re-fetches
            // on apply regardless.
            resultCount = nil
        }
    }

    private func dateBounds() -> (from: String?, to: String?) {
        currentFilters().dateBounds()
    }

    private func isoDay(_ date: Date) -> String {
        BookingFilters.isoDay(date)
    }
}
