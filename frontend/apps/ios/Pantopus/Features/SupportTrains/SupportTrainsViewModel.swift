//
//  SupportTrainsViewModel.swift
//  Pantopus
//
//  T6.6c (P26.5) — Support trains. Coordinated rotations of meal /
//  ride / childcare / pet care / errand help around a single
//  recipient who is going through a life event. The screen ships
//  three tabs sharing a single `ListOfRows` shell:
//
//    - **My trains** — `GET /api/support-trains/me/support-trains`
//      (`role` filter omitted so both organizer + helper rows surface).
//    - **Nearby** — `GET /api/support-trains/nearby` with the caller's
//      location.
//    - **Invitations** — projected client-side from `me/support-trains`
//      response rows whose status is `invited` (the backend folds
//      invite rows into the same feed today).
//
//  The screen sits in the Personal-blue identity pillar — these are
//  people-to-people surfaces, not home or business. Train-type tile
//  gradients carry the per-archetype palette; the status chip uses the
//  shared `StatusChipVariant` scale.
//

import Foundation
import Observation
import SwiftUI

public extension Notification.Name {
    /// Posted after an organizer deletes a train. Popping past its detail
    /// and Manage screens at once doesn't re-run a list's `.task`, so the
    /// lists still on the stack re-read when they hear this.
    static let supportTrainDeleted = Notification.Name("supportTrainDeleted")
}

/// Stable tab ids so the view + tests can reference without string
/// literals.
public enum SupportTrainsTab {
    public static let mine = "mine"
    public static let nearby = "nearby"
    public static let invitations = "invitations"
}

@Observable
@MainActor
public final class SupportTrainsViewModel: ListOfRowsDataSource {
    // MARK: - ListOfRowsDataSource

    public let title = "Support trains"

    public var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .search,
            accessibilityLabel: "Search support trains"
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onSearch() }
        }
    }

    public var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: SupportTrainsTab.mine, label: "My trains", count: mineRows.count),
            ListOfRowsTab(id: SupportTrainsTab.nearby, label: "Nearby", count: nearbyRows.count),
            ListOfRowsTab(
                id: SupportTrainsTab.invitations,
                label: "Invitations",
                count: invitationRows.count
            )
        ]
    }

    public var selectedTab: String = SupportTrainsTab.mine {
        didSet {
            guard oldValue != selectedTab else { return }
            rebuild()
        }
    }

    public var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Start a train",
            variant: .extendedNav(label: "Start a train")
        ) { [weak self] in
            MainActor.assumeIsolated { self?.onStartTrain() }
        }
    }

    public private(set) var state: ListOfRowsState = .loading

    // MARK: - Dependencies

    private let api: APIClient
    private let onStartTrain: @MainActor () -> Void
    private let onOpenTrain: @MainActor (String) -> Void
    private let onSearch: @MainActor () -> Void
    private let locationProvider: @MainActor () async -> (latitude: Double, longitude: Double)?
    private let locationRequester: @MainActor () async -> (latitude: Double, longitude: Double)?
    private let openLocationSettings: @MainActor () -> Void

    private var mine: [SupportTrainListItemDTO] = []
    private var nearby: [SupportTrainListItemDTO] = []
    private var loadedOnce = false
    /// Nearby has no location to search from, so it asks for one instead of
    /// claiming there are no trains.
    private var nearbyNeedsLocation = false
    /// "Use my location" got no location (refused or off): Settings is next.
    private var locationRequestFailed = false
    /// A tab whose last read failed shows the error and Try again, not an empty list.
    private var mineFailed = false
    private var nearbyFailed = false

    /// Nearby searches from the device's location, like the Tasks feed: a recent fix,
    /// or a fresh one when location is already allowed. Nothing prompts until the
    /// person taps "Use my location".
    init(
        api: APIClient = .shared,
        onStartTrain: @escaping @MainActor () -> Void = {},
        onOpenTrain: @escaping @MainActor (String) -> Void = { _ in },
        onSearch: @escaping @MainActor () -> Void = {},
        locationProvider: @escaping @MainActor () async -> (latitude: Double, longitude: Double)? = {
            let device = DeviceLocationProvider.shared
            let fix = device.cachedCoordinate()
            let current = if fix == nil, device.isAuthorized { await device.requestCurrent() } else { fix }
            return current.map { (latitude: $0.latitude, longitude: $0.longitude) }
        },
        locationRequester: @escaping @MainActor () async -> (latitude: Double, longitude: Double)? = {
            await DeviceLocationProvider.shared.requestCurrent().map { (latitude: $0.latitude, longitude: $0.longitude) }
        },
        openLocationSettings: @escaping @MainActor () -> Void = {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        }
    ) {
        self.api = api
        self.onStartTrain = onStartTrain
        self.onOpenTrain = onOpenTrain
        self.onSearch = onSearch
        self.locationProvider = locationProvider
        self.locationRequester = locationRequester
        self.openLocationSettings = openLocationSettings
    }

    // MARK: - Lifecycle

    public func load() async {
        // After the first load, each appearance re-reads quietly, so a train
        // deleted or re-statused from its detail or Manage screen doesn't linger.
        if !loadedOnce { state = .loading }
        await fetchBoth()
    }

    public func refresh() async {
        await fetchBoth()
    }

    public func loadMoreIfNeeded() async {
        // Single-shot feeds — pagination deferred to a follow-up.
    }

    /// Nearby's "Use my location": asks for permission if it hasn't been answered,
    /// then searches from the fix. If none comes (refused or off), the next tap
    /// opens Settings.
    public func useMyLocation() async {
        if locationRequestFailed {
            openLocationSettings()
            return
        }
        guard let loc = await locationRequester() else {
            locationRequestFailed = true
            rebuild()
            return
        }
        _ = await fetchNearby(at: loc)
        rebuild()
    }

    // MARK: - Fetching

    private func fetchBoth() async {
        async let mineTask = fetchMine()
        async let nearbyTask = fetchNearby()
        let (mineOk, nearbyOk) = await (mineTask, nearbyTask)
        if !mineOk && !nearbyOk {
            state = .error(message: "Couldn't load support trains. Try again.")
            return
        }
        loadedOnce = true
        rebuild()
    }

    private func fetchMine() async -> Bool {
        do {
            let response: SupportTrainsListResponse = try await api.request(
                SupportTrainsEndpoints.mine()
            )
            mine = response.supportTrains
            mineFailed = false
            return true
        } catch {
            mineFailed = true
            return false
        }
    }

    private func fetchNearby() async -> Bool {
        // A reload starts over: after a trip to Settings, "Use my location" may work now.
        locationRequestFailed = false
        guard let loc = await locationProvider() else {
            // Nearby asks for a location instead; the other two tabs still render.
            nearbyNeedsLocation = true
            nearbyFailed = false
            nearby = []
            return true
        }
        return await fetchNearby(at: loc)
    }

    private func fetchNearby(at loc: (latitude: Double, longitude: Double)) async -> Bool {
        nearbyNeedsLocation = false
        do {
            let response: SupportTrainsNearbyResponse = try await api.request(
                SupportTrainsEndpoints.nearby(latitude: loc.latitude, longitude: loc.longitude)
            )
            nearby = response.supportTrains
            nearbyFailed = false
            return true
        } catch {
            nearby = []
            nearbyFailed = true
            return false
        }
    }

    // MARK: - Projection

    private var mineRows: [SupportTrainListItemDTO] {
        mine.filter { ($0.status ?? "") != "invited" }
    }

    private var nearbyRows: [SupportTrainListItemDTO] {
        nearby
    }

    private var invitationRows: [SupportTrainListItemDTO] {
        mine.filter { ($0.status ?? "") == "invited" }
    }

    private func rebuild() {
        if let failure = failureMessage(for: selectedTab) {
            state = .error(message: failure)
            return
        }
        let activeRows: [SupportTrainListItemDTO]
        let emptyContent: ListOfRowsState.EmptyContent
        switch selectedTab {
        case SupportTrainsTab.nearby where nearbyNeedsLocation:
            activeRows = []
            emptyContent = ListOfRowsState.EmptyContent(
                icon: locationRequestFailed ? .mapPinOff : .mapPin,
                headline: "Turn on location to see trains nearby",
                subcopy: locationRequestFailed
                    ? "Location is off for Pantopus. Allow it in Settings to find support trains within 25 mi of you."
                    : "Pantopus uses your location only to find support trains within 25 mi of you.",
                ctaTitle: locationRequestFailed ? "Open Settings" : "Use my location"
            ) { [weak self] in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    Task { await self.useMyLocation() }
                }
            }
        case SupportTrainsTab.nearby:
            activeRows = nearbyRows
            emptyContent = ListOfRowsState.EmptyContent(
                icon: .heart,
                headline: "No trains nearby right now",
                subcopy: "When a neighbor starts a meal, ride, or pet-care train within 25 mi, you'll see it here.",
                ctaTitle: "Start a train"
            ) { [weak self] in
                MainActor.assumeIsolated { self?.onStartTrain() }
            }
        case SupportTrainsTab.invitations:
            activeRows = invitationRows
            emptyContent = ListOfRowsState.EmptyContent(
                icon: .mail,
                headline: "No invitations",
                subcopy: "When a coordinator invites you to help with their support train, the invite will land here."
            )
        default:
            activeRows = mineRows
            let subcopy = "A support train is a calendar of neighbors taking turns helping someone " +
                "through a life event. Start one for someone, or join one nearby."
            emptyContent = ListOfRowsState.EmptyContent(
                icon: .handCoins,
                headline: "No support trains yet",
                subcopy: subcopy,
                ctaTitle: "Start a train"
            ) { [weak self] in
                MainActor.assumeIsolated { self?.onStartTrain() }
            }
        }
        if activeRows.isEmpty {
            state = .empty(emptyContent)
            return
        }
        let mapped = activeRows.map(rowModel(for:))
        state = .loaded(sections: [RowSection(id: "trains", rows: mapped)], hasMore: false)
    }

    /// The tab's own read failed: say so (the error state offers Try again).
    private func failureMessage(for tab: String) -> String? {
        switch tab {
        case SupportTrainsTab.nearby: nearbyFailed ? "Couldn't load trains nearby. Try again." : nil
        default: mineFailed ? "Couldn't load your support trains. Try again." : nil
        }
    }

    // MARK: - Mapping

    private func rowModel(for train: SupportTrainListItemDTO) -> RowModel {
        // The My-trains feed doesn't (yet) project `support_train_type` —
        // `SupportTrainType.from(nil)` returns `.generic` so the leading
        // tile reads as a neutral mutual-aid glyph instead of mis-labeling
        // every train as "Meal train". The Nearby RPC populates the field
        // and the tile lights up to the per-archetype gradient.
        let type = SupportTrainType.from(train.supportTrainType)
        let recipientLine = train.recipientName ?? train.title ?? "Support train"
        let subtitle = subtitleLine(for: train, type: type)
        let chip = statusChip(for: train.status)
        return RowModel(
            id: train.id,
            title: recipientLine,
            subtitle: subtitle,
            template: .statusChip,
            leading: .categoryGradientIcon(type.icon, gradient: type.gradient),
            trailing: .statusChip(text: chip.text, variant: chip.variant),
            onTap: { [weak self] in
                MainActor.assumeIsolated { self?.onOpenTrain(train.id) }
            },
            metaTail: rowMetaTail(for: train)
        )
    }

    /// Subtitle reads "Type · role" when the train type is known, "Role
    /// · title" when only the role is known (My-trains feed without the
    /// type column), or "Title" alone when neither is known.
    private func subtitleLine(
        for train: SupportTrainListItemDTO,
        type: SupportTrainType
    ) -> String? {
        let parts: [String?] = [
            train.supportTrainType.map { _ in type.label },
            roleLabel(for: train.myRole),
            train.recipientName != nil ? train.title : nil
        ]
        let flattened = parts.compactMap { $0 }.filter { !$0.isEmpty }
        return flattened.isEmpty ? nil : flattened.joined(separator: " · ")
    }

    private func roleLabel(for role: String?) -> String? {
        switch role ?? "" {
        case "organizer": "You organize"
        case "co_organizer": "You co-organize"
        case "helper": "Helper"
        default: nil
        }
    }

    /// Returns the meta-tail line. Prefers the slot progress when the
    /// feed projects it, otherwise falls back to the date range when
    /// available, otherwise `nil` so the chip line collapses cleanly.
    private func rowMetaTail(for train: SupportTrainListItemDTO) -> String? {
        if let slots = slotsLabel(for: train) { return slots }
        if let starts = train.startsOn, let ends = train.endsOn {
            return "\(starts) — \(ends)"
        }
        if let distance = distanceLabel(for: train) { return distance }
        return nil
    }

    /// Renders a short distance hint for the Nearby tab. `<1 mi` and
    /// `N mi` (no decimal beyond 1 mi) keeps the meta line uncluttered.
    private func distanceLabel(for train: SupportTrainListItemDTO) -> String? {
        guard let metres = train.distanceMeters else { return nil }
        let miles = metres / 1609.34
        if miles < 1 { return "<1 mi" }
        return "\(Int(miles.rounded())) mi"
    }

    private func statusChip(for status: String?) -> (text: String, variant: StatusChipVariant) {
        switch status ?? "" {
        case "draft": ("Draft", .neutral)
        case "active": ("Active", .success)
        case "filling": ("Filling up", .info)
        case "full": ("Slots full", .neutral)
        case "wrapping": ("Wrapping up", .warning)
        case "complete": ("Complete", .neutral)
        case "paused": ("Paused", .warning)
        case "completed": ("Completed", .neutral)
        case "archived": ("Archived", .neutral)
        case "invited": ("Invited", .business)
        case "proposed": ("Proposed", .neutral)
        default: ("Active", .info)
        }
    }

    private func slotsLabel(for train: SupportTrainListItemDTO) -> String? {
        guard let total = train.slotsTotal else { return nil }
        let filled = train.slotsFilled ?? 0
        let left = max(0, total - filled)
        if left == 0 { return "\(filled) / \(total) slots" }
        return "\(filled) / \(total) slots · \(left) open"
    }
}

// MARK: - Train type palette

/// Per-archetype tile palette. The icon + gradient pair drives the
/// 40pt leading tile rendered by `RowLeading.categoryGradientIcon`.
public enum SupportTrainType: Sendable, Hashable, CaseIterable {
    case meals
    case rides
    case childcare
    case petcare
    case errands
    case visits
    case generic

    /// Backend `support_train_type` enum mirror. Falls back to
    /// `.generic` when the column is empty so My-trains rows (which
    /// don't yet project the type column) render a neutral mutual-aid
    /// glyph instead of mis-labeling every train as "Meal train". The
    /// Nearby RPC populates the field and the tile lights up.
    public static func from(_ raw: String?) -> SupportTrainType {
        switch raw ?? "" {
        case "meal_support", "meals": .meals
        case "ride_support", "rides": .rides
        case "childcare": .childcare
        case "pet_care", "petcare", "pet": .petcare
        case "errands", "errand_support": .errands
        case "visits", "visit_support": .visits
        default: .generic
        }
    }

    public var label: String {
        switch self {
        case .meals: "Meal train"
        case .rides: "Ride train"
        case .childcare: "Childcare"
        case .petcare: "Pet care"
        case .errands: "Errand train"
        case .visits: "Visit train"
        case .generic: "Support train"
        }
    }

    public var icon: PantopusIcon {
        switch self {
        case .meals: .utensils
        case .rides: .navigation
        case .childcare: .baby
        case .petcare: .pawPrint
        case .errands: .shoppingBag
        case .visits: .heart
        case .generic: .handCoins
        }
    }

    /// Per-archetype gradient pulled from existing category / identity
    /// tokens — no hex literals at the call site. Designers can later
    /// promote any of these to first-class tokens if reused elsewhere.
    public var gradient: GradientPair {
        switch self {
        case .meals:
            GradientPair(start: Theme.Color.handyman, end: Theme.Color.error)
        case .rides:
            GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700)
        case .childcare:
            GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman)
        case .petcare:
            GradientPair(start: Theme.Color.error, end: Theme.Color.business)
        case .errands:
            GradientPair(start: Theme.Color.business, end: Theme.Color.goods)
        case .visits:
            GradientPair(start: Theme.Color.error, end: Theme.Color.business)
        case .generic:
            GradientPair(start: Theme.Color.appTextSecondary, end: Theme.Color.appTextStrong)
        }
    }
}
