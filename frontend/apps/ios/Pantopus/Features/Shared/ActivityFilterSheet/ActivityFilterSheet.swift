//
//  ActivityFilterSheet.swift
//  Pantopus
//
//  P5.4 — Generic activity filter. One sheet for bids / posts / tasks /
//  offers: they all share the same filter shape (status chips + sort
//  order + date range). The sheet is a thin, semantic builder on top of
//  the shared `FilterSheetShell` — it maps an `ActivityFilter` to the
//  shell's `[FilterSection]` model and parses the applied sections back
//  into an `ActivityFilter`.
//
//  Per-surface parameterisation is the `statusOptions` (and its title):
//  bids → pending / accepted / declined / completed, tasks → open /
//  in-progress / done, offers → pending / accepted / declined, posts →
//  the post intents. Sort + date range are shared across every surface.
//

import SwiftUI

// MARK: - Filter value model

/// Sort order shared by every activity surface. The value-based cases
/// only apply to surfaces that carry an amount (bids / tasks / offers);
/// posts pass the `.timeOnly` subset.
public enum ActivitySortOrder: String, Sendable, Hashable, CaseIterable {
    case newest
    case oldest
    case valueHighToLow
    case valueLowToHigh

    public var label: String {
        switch self {
        case .newest: "Newest first"
        case .oldest: "Oldest first"
        case .valueHighToLow: "Value: high to low"
        case .valueLowToHigh: "Value: low to high"
        }
    }

    /// Date-only ordering — the subset surfaces without a per-row value
    /// (My posts) expose.
    public static let timeOnly: [ActivitySortOrder] = [.newest, .oldest]

    /// Stable order in which the radio options render.
    public static let all: [ActivitySortOrder] = [.newest, .oldest, .valueHighToLow, .valueLowToHigh]

    /// Sort `items` by this order. `date` / `value` accessors project the
    /// sort key out of each element; `nil` keys sort to the end.
    public func sorted<T>(
        _ items: [T],
        date: (T) -> Date?,
        value: (T) -> Double?
    ) -> [T] {
        switch self {
        case .newest:
            items.sorted { (date($0) ?? .distantPast) > (date($1) ?? .distantPast) }
        case .oldest:
            items.sorted { (date($0) ?? .distantFuture) < (date($1) ?? .distantFuture) }
        case .valueHighToLow:
            items.sorted { (value($0) ?? -.greatestFiniteMagnitude) > (value($1) ?? -.greatestFiniteMagnitude) }
        case .valueLowToHigh:
            items.sorted { (value($0) ?? .greatestFiniteMagnitude) < (value($1) ?? .greatestFiniteMagnitude) }
        }
    }
}

/// Date-range preset shared by every activity surface. `.anytime` is the
/// no-filter position. (A bespoke "custom" from/to picker is intentionally
/// deferred — the shared shell hosts chips, not date pickers.)
public enum ActivityDateRange: String, Sendable, Hashable, CaseIterable {
    case anytime
    case today
    case week
    case month

    public var label: String {
        switch self {
        case .anytime: "Anytime"
        case .today: "Today"
        case .week: "This week"
        case .month: "This month"
        }
    }

    /// Stable chip render order.
    public static let all: [ActivityDateRange] = [.anytime, .today, .week, .month]

    /// Whether `date` falls inside this range relative to `now`.
    public func contains(_ date: Date, now: Date, calendar: Calendar = .current) -> Bool {
        switch self {
        case .anytime:
            true
        case .today:
            calendar.isDate(date, inSameDayAs: now)
        case .week:
            date >= now.addingTimeInterval(-7 * 86400)
        case .month:
            date >= now.addingTimeInterval(-30 * 86400)
        }
    }
}

/// The applied (or working) selection across the three filter dimensions.
/// The default value is the "no filter" position — `isActive` is `false`
/// so consumers can skip filtering entirely and preserve the unfiltered
/// list order.
public struct ActivityFilter: Sendable, Hashable {
    /// Selected status chip ids. Empty = all statuses.
    public var statusIds: Set<String>
    /// Selected sort order. `nil` = keep the list's natural (load) order.
    public var sort: ActivitySortOrder?
    /// Selected date-range preset. `.anytime` = no date filtering.
    public var dateRange: ActivityDateRange

    public init(
        statusIds: Set<String> = [],
        sort: ActivitySortOrder? = nil,
        dateRange: ActivityDateRange = .anytime
    ) {
        self.statusIds = statusIds
        self.sort = sort
        self.dateRange = dateRange
    }

    /// `true` when the user has narrowed or re-ordered the list in any
    /// dimension. Drives the no-op fast path in consuming view-models.
    public var isActive: Bool {
        !statusIds.isEmpty || sort != nil || dateRange != .anytime
    }

    /// Apply this filter to `items`. `statusId` projects each element's
    /// status chip id (return `nil` for "no matching chip"); `date` and
    /// `value` project the sort/date keys. Returns `items` untouched when
    /// the filter is inactive.
    public func apply<T>(
        to items: [T],
        now: Date,
        statusId: (T) -> String?,
        date: (T) -> Date?,
        value: (T) -> Double?
    ) -> [T] {
        guard isActive else { return items }
        var result = items
        if !statusIds.isEmpty {
            result = result.filter { element in
                guard let id = statusId(element) else { return false }
                return statusIds.contains(id)
            }
        }
        if dateRange != .anytime {
            result = result.filter { element in
                guard let when = date(element) else { return false }
                return dateRange.contains(when, now: now)
            }
        }
        if let sort {
            result = sort.sorted(result, date: date, value: value)
        }
        return result
    }
}

// MARK: - Section identifiers

enum ActivityFilterSection {
    static let status = "status"
    static let sort = "sort"
    static let dateRange = "dateRange"
}

// MARK: - Sheet

/// The generic activity filter sheet. Builds three sections (status /
/// sort / date range) and renders them through `FilterSheetShell`, then
/// maps the applied sections back to an `ActivityFilter`.
@MainActor
public struct ActivityFilterSheet: View {
    private let statusTitle: String
    private let statusOptions: [FilterOption]
    private let sortOptions: [ActivitySortOrder]
    private let filter: ActivityFilter
    private let onApply: @MainActor (ActivityFilter) -> Void
    private let onClose: @MainActor () -> Void

    /// - Parameters:
    ///   - statusTitle: Section header for the status chips (e.g.
    ///     `"Status"`, `"Type"`).
    ///   - statusOptions: Per-surface status chips. Pass `[]` to omit the
    ///     status section entirely.
    ///   - sortOptions: Sort orders to offer. Defaults to the full set;
    ///     surfaces without a per-row value pass `ActivitySortOrder.timeOnly`.
    ///   - filter: The currently-applied filter (seeds the working copy).
    ///   - onApply: Called with the parsed filter when the user taps Apply.
    ///   - onClose: Called when the sheet should dismiss.
    public init(
        statusTitle: String = "Status",
        statusOptions: [FilterOption],
        sortOptions: [ActivitySortOrder] = ActivitySortOrder.all,
        filter: ActivityFilter,
        onApply: @escaping @MainActor (ActivityFilter) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.statusTitle = statusTitle
        self.statusOptions = statusOptions
        self.sortOptions = sortOptions
        self.filter = filter
        self.onApply = onApply
        self.onClose = onClose
    }

    public var body: some View {
        FilterSheetShell(
            title: "Filters",
            sections: Self.sections(
                statusTitle: statusTitle,
                statusOptions: statusOptions,
                sortOptions: sortOptions,
                filter: filter
            ),
            onApply: { applied in onApply(Self.filter(from: applied)) },
            onClose: onClose
        )
        .accessibilityIdentifier("activityFilterSheet")
    }

    // MARK: - Mapping

    /// Build the shell's section list from an `ActivityFilter`.
    static func sections(
        statusTitle: String,
        statusOptions: [FilterOption],
        sortOptions: [ActivitySortOrder],
        filter: ActivityFilter
    ) -> [FilterSection] {
        var sections: [FilterSection] = []
        if !statusOptions.isEmpty {
            sections.append(
                FilterSection(
                    id: ActivityFilterSection.status,
                    title: statusTitle,
                    control: .chipGroup(options: statusOptions, selectedIds: filter.statusIds)
                )
            )
        }
        sections.append(
            FilterSection(
                id: ActivityFilterSection.sort,
                title: "Sort by",
                control: .radio(
                    options: sortOptions.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedId: filter.sort?.rawValue
                )
            )
        )
        sections.append(
            FilterSection(
                id: ActivityFilterSection.dateRange,
                title: "Date range",
                control: .singleChip(
                    options: ActivityDateRange.all.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedId: filter.dateRange.rawValue
                )
            )
        )
        return sections
    }

    /// Parse the shell's applied sections back into an `ActivityFilter`.
    static func filter(from sections: [FilterSection]) -> ActivityFilter {
        var statusIds: Set<String> = []
        var sort: ActivitySortOrder?
        var dateRange: ActivityDateRange = .anytime
        for section in sections {
            switch section.id {
            case ActivityFilterSection.status:
                if case let .chipGroup(_, ids) = section.control { statusIds = ids }
            case ActivityFilterSection.sort:
                if case let .radio(_, selectedId) = section.control {
                    sort = selectedId.flatMap(ActivitySortOrder.init(rawValue:))
                }
            case ActivityFilterSection.dateRange:
                if case let .singleChip(_, selectedId) = section.control {
                    dateRange = selectedId.flatMap(ActivityDateRange.init(rawValue:)) ?? .anytime
                }
            default:
                break
            }
        }
        return ActivityFilter(statusIds: statusIds, sort: sort, dateRange: dateRange)
    }
}

#Preview {
    ActivityFilterSheet(
        statusTitle: "Status",
        statusOptions: [
            FilterOption(id: "pending", label: "Pending"),
            FilterOption(id: "accepted", label: "Accepted"),
            FilterOption(id: "declined", label: "Declined"),
            FilterOption(id: "completed", label: "Completed")
        ],
        filter: ActivityFilter(statusIds: ["pending"], sort: .newest, dateRange: .week),
        onApply: { _ in },
        onClose: {}
    )
}
