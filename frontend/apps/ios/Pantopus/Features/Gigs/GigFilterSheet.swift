//
//  GigFilterSheet.swift
//  Pantopus
//
//  P5.3 — Gig filter bottom sheet. A thin projection over the shared
//  `FilterSheetShell`: `GigFilterCriteria` builds the `[FilterSection]`
//  the shell renders and parses the applied sections back into a typed
//  value. Budget bounds (`minPrice`/`maxPrice`), open-to-bids
//  (`pay_type=offers`), and a single schedule (`schedule_type`) are
//  forwarded to `GET /api/gigs` as query params — Apply refetches. The
//  dimensions the API can't express (multi-category, multi-schedule,
//  posted-within) stay client-side via `matchesClientSide`.
//  P6a adds the saved-search mapping + the footer save/manage row.
//

// swiftlint:disable file_length

import Foundation
import SwiftUI

// MARK: - Dimension enums

/// Schedule chip filter. Backend `schedule_type` is loosely typed
/// ("scheduled" / "flexible" / seed values), so matching is tolerant —
/// see `from(backendKey:)`.
public enum GigScheduleFilter: String, CaseIterable, Sendable, Hashable, Identifiable {
    case oneTime
    case recurring
    case flexible

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .oneTime: "One-time"
        case .recurring: "Recurring"
        case .flexible: "Flexible"
        }
    }

    /// Map a backend `schedule_type` to a filter bucket. Returns `nil`
    /// when the value is missing or unrecognised.
    public static func from(backendKey raw: String?) -> GigScheduleFilter? {
        let key = (raw ?? "")
            .lowercased()
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
        switch key {
        case "onetime", "scheduled", "once": return .oneTime
        case "recurring", "repeat", "repeating": return .recurring
        case "flexible", "flex", "anytime": return .flexible
        default: return nil
        }
    }
}

/// "Posted within" radio filter.
public enum GigPostedWithin: String, CaseIterable, Sendable, Hashable, Identifiable {
    case anytime
    case today
    case week
    case month

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .anytime: "Anytime"
        case .today: "Today"
        case .week: "This week"
        case .month: "This month"
        }
    }

    /// Earliest acceptable post date relative to `now`. `nil` means no
    /// lower bound (`anytime`).
    public func cutoff(from now: Date) -> Date? {
        switch self {
        case .anytime: nil
        case .today: now.addingTimeInterval(-86400)
        case .week: now.addingTimeInterval(-604_800)
        case .month: now.addingTimeInterval(-2_592_000)
        }
    }
}

/// Distance radius chips — RN `FilterChipBar.DISTANCE_CHIPS`. The wire
/// value is **meters** on `max_distance`; selecting one also pins
/// `includeRemote=false` so location-less remote tasks drop out.
public enum GigDistanceFilter: String, CaseIterable, Sendable, Hashable, Identifiable {
    case oneMile
    case threeMiles
    case fiveMiles

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .oneMile: "Under 1 mi"
        case .threeMiles: "Under 3 mi"
        case .fiveMiles: "Under 5 mi"
        }
    }

    /// `max_distance` query value, in meters. Matches RN's constants
    /// exactly (1609 / 4828 / 8047).
    public var meters: Int {
        switch self {
        case .oneMile: 1609
        case .threeMiles: 4828
        case .fiveMiles: 8047
        }
    }
}

/// Deadline window chips — RN `FilterChipBar.TIME_CHIPS`. Rides the
/// `deadline` query param the backend narrows on
/// (`backend/routes/gigs.js:2209`).
public enum GigDeadlineFilter: String, CaseIterable, Sendable, Hashable, Identifiable {
    case today
    case thisWeek

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .today: "Today"
        case .thisWeek: "This week"
        }
    }

    public var backendValue: String {
        switch self {
        case .today: "today"
        case .thisWeek: "this_week"
        }
    }

    /// Latest acceptable `deadline`, mirroring the backend's cutoff
    /// arithmetic (`backend/routes/gigs.js:2213-2244`): end of today, or
    /// end of the upcoming Sunday.
    public func cutoff(from now: Date) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let startOfToday = calendar.startOfDay(for: now)
        let dayOffset: Int
        switch self {
        case .today:
            dayOffset = 0
        case .thisWeek:
            // JS `getDay()` is 0=Sunday; Foundation's weekday is 1=Sunday.
            let weekday = calendar.component(.weekday, from: now) - 1
            dayOffset = 7 - weekday
        }
        let dayStart = calendar.date(byAdding: .day, value: dayOffset, to: startOfToday) ?? startOfToday
        // End of that day (23:59:59.999).
        return dayStart.addingTimeInterval(86400 - 0.001)
    }
}

/// Task-archetype chips — RN `FilterChipBar.ARCHETYPE_CHIPS`. Values
/// match the backend's `task_archetype` enum
/// (`backend/routes/gigs.js:508`).
public enum GigTaskArchetypeFilter: String, CaseIterable, Sendable, Hashable, Identifiable {
    case quickHelp
    case deliveryErrand
    case homeService
    case proServiceQuote
    case careTask
    case eventShift
    case remoteTask

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .quickHelp: "Quick help"
        case .deliveryErrand: "Delivery"
        case .homeService: "Home service"
        case .proServiceQuote: "Pro service"
        case .careTask: "Care"
        case .eventShift: "Event"
        case .remoteTask: "Remote"
        }
    }

    public var backendValue: String {
        switch self {
        case .quickHelp: "quick_help"
        case .deliveryErrand: "delivery_errand"
        case .homeService: "home_service"
        case .proServiceQuote: "pro_service_quote"
        case .careTask: "care_task"
        case .eventShift: "event_shift"
        case .remoteTask: "remote_task"
        }
    }
}

// MARK: - Criteria

/// The applied Gig filter selection. The default value is the
/// "everything passes" position, so a freshly-constructed criteria
/// has an `activeCount` of zero and `matches` returns `true` for every
/// gig.
public struct GigFilterCriteria: Sendable, Hashable {
    /// Empty == "all categories".
    public var categories: Set<GigsCategory>
    /// Lower budget handle (dollars). `budgetMin` == no lower bound.
    public var budgetLower: Double
    /// Upper budget handle (dollars). `budgetMax` == "no ceiling" ($500+).
    public var budgetUpper: Double
    /// Empty == "any schedule".
    public var schedules: Set<GigScheduleFilter>
    /// When `true`, keep only gigs still accepting bids (unassigned).
    public var openToBids: Bool
    public var postedWithin: GigPostedWithin
    /// Distance radius chip (`max_distance` + `includeRemote=false`).
    public var distance: GigDistanceFilter?
    /// Deadline window chip (`deadline`).
    public var deadline: GigDeadlineFilter?
    /// Task-archetype chip (`task_archetype`).
    public var archetype: GigTaskArchetypeFilter?

    /// Budget slider domain. `budgetMax` doubles as the "$500+" ceiling.
    public static let budgetMin: Double = 0
    public static let budgetMax: Double = 500
    public static let budgetStep: Double = 25

    /// Stable id for the single "open to bids" chip.
    static let openToBidsOptionID = "openToBids"

    public init(
        categories: Set<GigsCategory> = [],
        budgetLower: Double = GigFilterCriteria.budgetMin,
        budgetUpper: Double = GigFilterCriteria.budgetMax,
        schedules: Set<GigScheduleFilter> = [],
        openToBids: Bool = false,
        postedWithin: GigPostedWithin = .anytime,
        distance: GigDistanceFilter? = nil,
        deadline: GigDeadlineFilter? = nil,
        archetype: GigTaskArchetypeFilter? = nil
    ) {
        self.categories = categories
        self.budgetLower = budgetLower
        self.budgetUpper = budgetUpper
        self.schedules = schedules
        self.openToBids = openToBids
        self.postedWithin = postedWithin
        self.distance = distance
        self.deadline = deadline
        self.archetype = archetype
    }

    /// Concrete categories the chip group offers (`all` is a sentinel
    /// and never shown in the sheet).
    static let categoryOptions: [GigsCategory] = GigsCategory.allCases.filter { $0 != .all }

    var isBudgetActive: Bool {
        budgetLower > Self.budgetMin || budgetUpper < Self.budgetMax
    }

    /// Number of active filter dimensions — drives the "N filters" pill.
    public var activeCount: Int {
        var count = 0
        if !categories.isEmpty { count += 1 }
        if isBudgetActive { count += 1 }
        if !schedules.isEmpty { count += 1 }
        if openToBids { count += 1 }
        if postedWithin != .anytime { count += 1 }
        if distance != nil { count += 1 }
        if deadline != nil { count += 1 }
        if archetype != nil { count += 1 }
        return count
    }

    // MARK: Sections (criteria → shell)

    public func sections() -> [FilterSection] {
        [
            FilterSection(
                id: "category",
                title: "Category",
                control: .chipGroup(
                    options: Self.categoryOptions.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedIds: Set(categories.map(\.rawValue))
                )
            ),
            FilterSection(
                id: "budget",
                title: "Budget ($0–$500+)",
                control: .rangeSlider(
                    FilterRange(
                        min: Self.budgetMin,
                        max: Self.budgetMax,
                        lower: budgetLower,
                        upper: budgetUpper,
                        step: Self.budgetStep
                    )
                )
            ),
            FilterSection(
                id: "schedule",
                title: "Schedule",
                control: .chipGroup(
                    options: GigScheduleFilter.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedIds: Set(schedules.map(\.rawValue))
                )
            ),
            FilterSection(
                id: "openToBids",
                title: "Bids",
                control: .chipGroup(
                    options: [FilterOption(id: Self.openToBidsOptionID, label: "Open to bids only")],
                    selectedIds: openToBids ? [Self.openToBidsOptionID] : []
                )
            ),
            FilterSection(
                id: "postedWithin",
                title: "Posted within",
                control: .radio(
                    options: GigPostedWithin.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedId: postedWithin.rawValue
                )
            ),
            FilterSection(
                id: "distance",
                title: "Distance",
                control: .chipGroup(
                    options: GigDistanceFilter.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedIds: distance.map { [$0.rawValue] } ?? []
                )
            ),
            FilterSection(
                id: "deadline",
                title: "Due by",
                control: .chipGroup(
                    options: GigDeadlineFilter.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedIds: deadline.map { [$0.rawValue] } ?? []
                )
            ),
            FilterSection(
                id: "archetype",
                title: "Task type",
                control: .chipGroup(
                    options: GigTaskArchetypeFilter.allCases.map { FilterOption(id: $0.rawValue, label: $0.label) },
                    selectedIds: archetype.map { [$0.rawValue] } ?? []
                )
            )
        ]
    }

    // MARK: Parse (shell → criteria)

    public init(sections: [FilterSection]) {
        self.init()
        for section in sections {
            switch (section.id, section.control) {
            case let ("category", .chipGroup(_, ids)):
                categories = Set(ids.compactMap(GigsCategory.init(rawValue:)))
            case let ("budget", .rangeSlider(range)):
                budgetLower = range.lower
                budgetUpper = range.upper
            case let ("schedule", .chipGroup(_, ids)):
                schedules = Set(ids.compactMap(GigScheduleFilter.init(rawValue:)))
            case let ("openToBids", .chipGroup(_, ids)):
                openToBids = ids.contains(Self.openToBidsOptionID)
            case let ("postedWithin", .radio(_, selectedId)):
                postedWithin = selectedId.flatMap(GigPostedWithin.init(rawValue:)) ?? .anytime
            case let ("distance", .chipGroup(_, ids)):
                // Single-valued dimensions: the backend takes one
                // `max_distance` / `deadline` / `task_archetype`, so the
                // last chip the user turned on wins.
                distance = ids.compactMap(GigDistanceFilter.init(rawValue:)).first
            case let ("deadline", .chipGroup(_, ids)):
                deadline = ids.compactMap(GigDeadlineFilter.init(rawValue:)).first
            case let ("archetype", .chipGroup(_, ids)):
                archetype = ids.compactMap(GigTaskArchetypeFilter.init(rawValue:)).first
            default:
                break
            }
        }
    }

    // MARK: Server-side query mapping (GET /api/gigs)

    /// `minPrice` query param — only when the lower handle moved.
    public var serverMinPrice: Double? {
        budgetLower > Self.budgetMin ? budgetLower : nil
    }

    /// `maxPrice` query param — `budgetMax` is the open-ended "$500+"
    /// ceiling, so it imposes no upper bound.
    public var serverMaxPrice: Double? {
        budgetUpper < Self.budgetMax ? budgetUpper : nil
    }

    /// `pay_type=offers` — the backend models "open to bids" as a pay type.
    public var serverPayType: String? {
        openToBids ? "offers" : nil
    }

    /// `max_distance` query value (meters). Route
    /// `backend/routes/gigs.js:2112`.
    public var serverMaxDistanceMeters: Int? {
        distance?.meters
    }

    /// `includeRemote` query value. RN pins it to `false` while a
    /// distance chip is on so location-less remote tasks drop out
    /// (`app/(tabs)/gigs.tsx:88`); otherwise the param is omitted.
    public var serverIncludeRemote: Bool? {
        distance == nil ? nil : false
    }

    /// `deadline` query value ("today" | "this_week"). Route
    /// `backend/routes/gigs.js:2209`.
    public var serverDeadline: String? {
        deadline?.backendValue
    }

    /// `task_archetype` query value. Route
    /// `backend/routes/gigs.js:2205`.
    public var serverTaskArchetype: String? {
        archetype?.backendValue
    }

    /// `schedule_type` query param. The backend takes a single value, so
    /// it's only forwarded when exactly one schedule is selected *and*
    /// that selection has a backend equivalent — `recurring` has none
    /// (gigs store it as `flexible`-ish seed values), so it stays
    /// client-side, as does any multi-select.
    public var serverScheduleType: String? {
        guard schedules.count == 1, let only = schedules.first else { return nil }
        switch only {
        case .oneTime: return "scheduled"
        case .flexible: return "flexible"
        case .recurring: return nil
        }
    }

    // MARK: Predicates

    /// `true` when `category` survives the category dimension.
    func matchesCategory(_ category: GigsCategory) -> Bool {
        categories.isEmpty || categories.contains(category)
    }

    /// `true` when `price` survives the budget dimension. A `nil` price
    /// only passes when the budget filter is inactive.
    func matchesBudget(_ price: Double?) -> Bool {
        guard isBudgetActive else { return true }
        guard let price else { return false }
        if price < budgetLower { return false }
        if budgetUpper < Self.budgetMax, price > budgetUpper { return false }
        return true
    }

    /// Full gig predicate across every dimension. Used by surfaces that
    /// filter purely client-side (e.g. the Nearby map pins).
    public func matches(_ gig: GigDTO, now: Date = Date()) -> Bool {
        guard matches(
            category: GigsCategory.from(backendKey: gig.category),
            price: gig.price,
            scheduleType: gig.scheduleType,
            acceptedBy: gig.acceptedBy,
            createdAt: gig.createdAt,
            now: now
        ) else { return false }
        return matchesFeedChips(gig, now: now)
    }

    /// The three RN chip-bar dimensions applied locally, for surfaces
    /// that filter an already-fetched list (Tasks map pins). The Gigs
    /// feed sends them as query params instead.
    public func matchesFeedChips(_ gig: GigDTO, now: Date = Date()) -> Bool {
        if let distance {
            guard let miles = gig.distanceMiles else { return false }
            guard miles * 1609.344 <= Double(distance.meters) else { return false }
        }
        if let deadline {
            guard let due = Self.parseDate(gig.deadline) else {
                // RN keeps urgent tasks in the "Today" bucket even when
                // they carry no explicit deadline (`gigs.js:2250`).
                return deadline == .today && gig.isUrgent == true
            }
            guard due <= deadline.cutoff(from: now) else { return false }
        }
        if let archetype {
            guard gig.taskArchetype == archetype.backendValue else { return false }
        }
        return true
    }

    /// Primitive-field overload for surfaces that project away the DTO
    /// (the Tasks map's `TaskMapItem` — seed/preview mode has no `GigDTO`).
    public func matches(
        category: GigsCategory,
        price: Double?,
        scheduleType: String?,
        acceptedBy: String?,
        createdAt: String?,
        now: Date = Date()
    ) -> Bool {
        guard matchesCategory(category) else { return false }
        guard matchesBudget(price) else { return false }
        if !schedules.isEmpty {
            guard let bucket = GigScheduleFilter.from(backendKey: scheduleType),
                  schedules.contains(bucket) else { return false }
        }
        if openToBids, !(acceptedBy ?? "").isEmpty { return false }
        if let cutoff = postedWithin.cutoff(from: now) {
            guard let posted = Self.parseDate(createdAt), posted >= cutoff else { return false }
        }
        return true
    }

    /// Residual predicate for the Gigs feed — only the dimensions
    /// `GET /api/gigs` can't express. Budget + open-to-bids (+ a single
    /// mappable schedule) ride the request as query params, so they're
    /// deliberately absent here. Posted-within stays client-side: the
    /// backend has no posted-within / created-after param.
    public func matchesClientSide(_ gig: GigDTO, now: Date = Date()) -> Bool {
        guard matchesCategory(GigsCategory.from(backendKey: gig.category)) else { return false }
        if !schedules.isEmpty, serverScheduleType == nil {
            guard let bucket = GigScheduleFilter.from(backendKey: gig.scheduleType),
                  schedules.contains(bucket) else { return false }
        }
        if let cutoff = postedWithin.cutoff(from: now) {
            guard let posted = Self.parseDate(gig.createdAt), posted >= cutoff else { return false }
        }
        return true
    }

    static func parseDate(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}

// MARK: - Saved-search mapping (P6a)

/// `POST /api/gigs/saved-searches` projection — pure functions so the
/// derived name + body are testable without a view. Route
/// `backend/routes/gigSavedSearches.js:64`.
public extension GigFilterCriteria {
    /// The single category a saved search stores (the backend keeps one
    /// value). Exactly one sheet chip wins; with no sheet chips the
    /// feed's active chip applies (omitting "All"); a multi-select
    /// saves category-less so alerts span every selected category.
    func savedSearchCategory(feedCategory: GigsCategory) -> GigsCategory? {
        if categories.count == 1 { return categories.first }
        if categories.isEmpty, feedCategory != .all { return feedCategory }
        return nil
    }

    /// Client-derived display name, e.g. "Cleaning · under $100 · 5 mi".
    /// Mirrors exactly the criteria that ride the POST body.
    func savedSearchName(
        feedCategory: GigsCategory,
        searchText: String,
        radiusMiles: Double
    ) -> String {
        var pieces = [savedSearchCategory(feedCategory: feedCategory)?.label ?? "All tasks"]
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { pieces.append("\u{201C}\(trimmed)\u{201D}") }
        switch (serverMinPrice, serverMaxPrice) {
        case let (min?, max?): pieces.append("$\(Int(min))–$\(Int(max))")
        case let (min?, nil): pieces.append("over $\(Int(min))")
        case let (nil, max?): pieces.append("under $\(Int(max))")
        case (nil, nil): break
        }
        if serverScheduleType != nil, let only = schedules.first { pieces.append(only.label) }
        if openToBids { pieces.append("open to bids") }
        pieces.append(
            radiusMiles.truncatingRemainder(dividingBy: 1) == 0
                ? "\(Int(radiusMiles)) mi"
                : String(format: "%.1f mi", radiusMiles)
        )
        return pieces.joined(separator: " · ")
    }

    /// Build the `POST /api/gigs/saved-searches` body from the live
    /// state: this criteria + the feed's active chip, search text, and
    /// resolved location/radius. Server-expressible dimensions reuse
    /// the existing `GET /api/gigs` mappings (`serverMinPrice` /
    /// `serverMaxPrice` / `serverScheduleType` / `serverPayType`);
    /// slider extremes and unmappable selections are omitted.
    func savedSearchBody(
        feedCategory: GigsCategory,
        searchText: String,
        latitude: Double,
        longitude: Double,
        radiusMiles: Double
    ) -> CreateGigSavedSearchBody {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return CreateGigSavedSearchBody(
            name: savedSearchName(
                feedCategory: feedCategory,
                searchText: searchText,
                radiusMiles: radiusMiles
            ),
            category: savedSearchCategory(feedCategory: feedCategory)?.rawValue,
            search: trimmed.isEmpty ? nil : trimmed,
            minPrice: serverMinPrice,
            maxPrice: serverMaxPrice,
            scheduleType: serverScheduleType,
            payType: serverPayType,
            latitude: latitude,
            longitude: longitude,
            radiusMiles: radiusMiles,
            notify: true
        )
    }

    /// "Save this search" enablement: any active criteria dimension or
    /// a non-empty feed search text.
    func canSaveSearch(searchText: String) -> Bool {
        activeCount > 0 || !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

// MARK: - Sheet

/// Gig filter bottom sheet. Host presents it via `.sheet`; `onApply`
/// fires with the parsed criteria, then the shell calls `onClose`.
/// When `onSaveSearch` is supplied (the Gigs feed), the footer grows a
/// "Save this search" button — enabled by the **live working**
/// criteria or feed search text — plus a "Saved searches" link that
/// presents the manage sheet (P6a).
@MainActor
public struct GigFilterSheet: View {
    private let criteria: GigFilterCriteria
    private let searchText: String
    private let onApply: @MainActor (GigFilterCriteria) -> Void
    private let onClose: @MainActor () -> Void
    private let onSaveSearch: (@MainActor (GigFilterCriteria) -> Void)?

    @State private var showManageSheet = false

    public init(
        criteria: GigFilterCriteria,
        searchText: String = "",
        onApply: @escaping @MainActor (GigFilterCriteria) -> Void,
        onClose: @escaping @MainActor () -> Void,
        onSaveSearch: (@MainActor (GigFilterCriteria) -> Void)? = nil
    ) {
        self.criteria = criteria
        self.searchText = searchText
        self.onApply = onApply
        self.onClose = onClose
        self.onSaveSearch = onSaveSearch
    }

    public var body: some View {
        FilterSheetShell(
            title: "Filters",
            sections: criteria.sections(),
            footerAccessory: footerAccessory,
            onApply: { sections in onApply(GigFilterCriteria(sections: sections)) },
            onClose: onClose
        )
        .sheet(isPresented: $showManageSheet) {
            GigSavedSearchesSheet()
        }
        .accessibilityIdentifier("gigFilterSheet")
    }

    /// Save/manage footer row, present only when the host wires
    /// `onSaveSearch` (the Gigs feed). Receives the shell's live
    /// working sections so enablement tracks unapplied edits.
    private var footerAccessory: (@MainActor ([FilterSection]) -> AnyView)? {
        guard let onSaveSearch else { return nil }
        return { sections in
            AnyView(
                self.savedSearchRow(
                    working: GigFilterCriteria(sections: sections),
                    save: onSaveSearch
                )
            )
        }
    }

    /// Footer accessory: save the live working criteria + manage link.
    private func savedSearchRow(
        working: GigFilterCriteria,
        save: @escaping @MainActor (GigFilterCriteria) -> Void
    ) -> some View {
        let canSave = working.canSaveSearch(searchText: searchText)
        return HStack(spacing: Spacing.s3) {
            Button {
                save(working)
            } label: {
                HStack(spacing: 6) {
                    Icon(
                        .bell,
                        size: 13,
                        strokeWidth: 2.2,
                        color: canSave ? Theme.Color.primary600 : Theme.Color.appTextMuted
                    )
                    Text("Save this search")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(canSave ? Theme.Color.primary600 : Theme.Color.appTextMuted)
                }
                .frame(minHeight: 36)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
            .accessibilityLabel("Save this search")
            .accessibilityIdentifier("gigFilters.saveSearch")
            Spacer()
            Button {
                showManageSheet = true
            } label: {
                Text("Saved searches")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .underline()
                    .frame(minHeight: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Saved searches")
            .accessibilityIdentifier("gigFilters.manageSearches")
        }
    }
}

#Preview("Default") {
    GigFilterSheet(criteria: GigFilterCriteria(), onApply: { _ in }, onClose: {})
}

#Preview("Active") {
    GigFilterSheet(
        criteria: GigFilterCriteria(
            categories: [.handyman, .cleaning],
            budgetLower: 50,
            budgetUpper: 300,
            schedules: [.oneTime],
            openToBids: true,
            postedWithin: .week
        ),
        onApply: { _ in },
        onClose: {}
    )
}
