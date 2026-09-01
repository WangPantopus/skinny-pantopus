//
//  ResourceListViewModel.swift
//  Pantopus
//
//  Stream I12 — F9 Bookable Home Resources · List. Backs the ListOfRows
//  archetype. Reads `GET …/scheduling/resources` and annotates each row with a
//  live "Free now / Booked until …" status derived from the home's active
//  resource bookings (see the Foundation-gap note in `ResourceKit`).
//

import Observation
import SwiftUI

/// Feature-local loaded model for the bespoke F9 list. The design's
/// `ResourceRow` (13.5pt/700 title · 11pt type tile · dot+label trailing) can't
/// be expressed through the shared `ListOfRows` row chrome, so the loaded /
/// empty / offline frames render bespoke from this projection. Loading / error
/// still flow through the shared shell visuals (mirrored locally).
struct ResourceListItem: Identifiable {
    let id: String
    let name: String
    let kind: ResourceKind
    let statusLabel: String
    let isFree: Bool
}

@Observable
@MainActor
final class ResourceListViewModel: ListOfRowsDataSource {
    /// One-tap quick-start template (design F9 empty frame). Each opens the
    /// editor seeded with the template's resource kind.
    struct ResourceTemplate: Identifiable {
        let id: String
        let label: String
        let icon: PantopusIcon
        let kind: ResourceKind
        /// The "Other" template uses a neutral tile (no Home accent).
        let isNeutral: Bool
    }

    static let templates: [ResourceTemplate] = [
        ResourceTemplate(id: "room", label: "Guest room", icon: .doorOpen, kind: .room, isNeutral: false),
        ResourceTemplate(id: "driveway", label: "Driveway", icon: .car, kind: .vehicle, isNeutral: false),
        ResourceTemplate(id: "charger", label: "EV charger", icon: .zap, kind: .charger, isNeutral: false),
        ResourceTemplate(id: "tools", label: "Tools", icon: .wrench, kind: .tool, isNeutral: false),
        ResourceTemplate(id: "other", label: "Other", icon: .plus, kind: .other, isNeutral: true)
    ]

    /// Loaded resource rows for the bespoke list (empty when the screen is
    /// loading / empty / errored — read `state` for the active frame).
    private(set) var items: [ResourceListItem] = []

    // MARK: ListOfRows chrome

    var title: String {
        "Resources"
    }

    var topBarAction: TopBarAction? {
        TopBarAction(
            label: "Add",
            accessibilityLabel: "Add a resource",
            icon: .plus
        ) { [weak self] in
            Task { @MainActor in self?.openEditor(resourceId: nil) }
        }
    }

    var tabs: [ListOfRowsTab] {
        []
    }

    var selectedTab: String = ""

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Add a resource",
            variant: .secondaryCreate,
            tint: .home
        ) { [weak self] in
            Task { @MainActor in self?.openEditor(resourceId: nil) }
        }
    }

    private(set) var state: ListOfRowsState = .loading

    // MARK: Dependencies

    let homeId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    init(
        homeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.homeId = homeId
        self.push = push
        self.client = client
    }

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    private var isLoaded: Bool {
        if case .loaded = state { return true }
        return false
    }

    // MARK: Load

    func load() async {
        await fetch(showLoading: !isLoaded)
    }

    func refresh() async {
        await fetch(showLoading: false)
    }

    func loadMoreIfNeeded() async {}

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let response: ResourcesResponse = try await client.request(
                SchedulingEndpoints.getResources(owner: owner)
            )
            let resources = response.resources.filter { $0.isActive != false }
            // Best-effort booking annotation — the list still renders if the
            // bookings read is unavailable.
            let bookings = await fetchBookings()
            rebuild(resources: resources, bookings: bookings)
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "Couldn't load resources.")
        } catch {
            state = .error(message: "Couldn't load resources.")
        }
    }

    /// Active resource bookings for the home (never fails the screen).
    private func fetchBookings() async -> [ResourceBooking] {
        do {
            let response: ResourceBookingsResponse = try await client.request(
                SchedulingEndpoints.getBookings(owner: owner)
            )
            return response.bookings.filter { $0.resourceId != nil && $0.isLive }
        } catch {
            return []
        }
    }

    // MARK: Navigation

    func openEditor(resourceId: String? = nil) {
        push(.resourceEditor(homeId: homeId, resourceId: resourceId))
    }

    func openDetail(_ resourceId: String) {
        push(.resourceDetail(homeId: homeId, resourceId: resourceId))
    }

    /// Quick-start from an empty-frame template — opens the editor. (The wire
    /// has no template-seed param, so this lands on the same "new resource"
    /// editor the FAB / Add action open; the kind is the design hint.)
    func openTemplate(_: ResourceTemplate) {
        openEditor()
    }

    // MARK: Row building

    private func rebuild(resources: [ResourceDTO], bookings: [ResourceBooking]) {
        guard !resources.isEmpty else {
            items = []
            // Design F9 empty frame renders bespoke in `ResourceListView` from
            // the `.empty` marker below (explainer card + "TEMPLATES" overline +
            // 5 tappable template rows, no primary CTA). The `EmptyState`
            // payload here is retained only so the shared shell — and the
            // existing projection tests that read `state` — keep a consistent
            // empty marker; the bespoke view ignores its fields.
            state = .empty(.init(
                icon: .packageOpen,
                headline: "Add what your household shares",
                subcopy: "Anything members book — rooms, the driveway, tools. Start from a template.",
                ctaTitle: "Add a resource",
                onCTA: { [weak self] in Task { @MainActor in self?.openEditor(resourceId: nil) } },
                tint: Theme.Color.homeBg,
                accent: Theme.Color.home
            ))
            return
        }
        let now = Date()
        items = resources.map { resource -> ResourceListItem in
            let kind = ResourceKind(wire: resource.resourceType)
            let status = Self.status(for: resource.id, bookings: bookings, now: now)
            return ResourceListItem(
                id: resource.id,
                name: resource.name,
                kind: kind,
                statusLabel: status.label,
                isFree: status.isFree
            )
        }
        // The bespoke `ResourceListView` renders `items`; the shared shell only
        // needs a non-empty loaded marker so its loading/empty/error routing
        // (and existing projection tests) stay consistent.
        let rows = items.map { item -> RowModel in
            let id = item.id
            return RowModel(
                id: id,
                title: item.name,
                template: .statusChip,
                leading: .typeIcon(item.kind.icon, background: Theme.Color.homeBg, foreground: Theme.Color.home),
                trailing: .statusChip(
                    text: item.statusLabel,
                    variant: item.isFree ? .success : .neutral
                ),
                onTap: { [weak self] in Task { @MainActor in self?.openDetail(id) } },
                chips: [RowChip(text: item.kind.label, tint: .status(.neutral))]
            )
        }
        state = .loaded(sections: [RowSection(id: "resources", rows: rows, style: .flat)], hasMore: false)
    }

    /// A resource is "Booked until <end>" when a live booking spans `now`,
    /// otherwise "Free now".
    private static func status(
        for resourceId: String,
        bookings: [ResourceBooking],
        now: Date
    ) -> (label: String, isFree: Bool) {
        let mine = bookings.filter { $0.resourceId == resourceId }
        let active = mine.first { booking in
            guard let startISO = booking.startAt, let start = SchedulingTime.parseUTC(startISO) else { return false }
            let end = booking.endAt.flatMap(SchedulingTime.parseUTC) ?? start
            return start <= now && now < end
        }
        if let active, let end = active.endAt {
            return ("Booked until \(ResourceTime.timeLabel(end))", false)
        }
        return ("Free now", true)
    }
}
