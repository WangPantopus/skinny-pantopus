//
//  EventTypeListViewModel.swift
//  Pantopus
//
//  Stream I2 — B1 Event Type / Service List. Backs the screen via
//  `ListOfRowsDataSource`. Lists the owner's event types
//  (`GET /event-types`), split into Active / Hidden tabs by `is_active`, and
//  manages them: create (+), open editor, copy/share the booking link,
//  duplicate, hide/activate (`PUT is_active`), delete (guards 409
//  `HAS_UPCOMING_BOOKINGS` → suggest hiding). Owner-polymorphic via
//  `SchedulingOwner`.
//

import Observation
import SwiftUI

// Reorder mode (B1 FRAME 6) pushed this past the 500-line ceiling. Splitting it into a
// cross-file extension would mean widening `eventTypes` / `client` / `fetch` / the
// `isReordering` setter to internal, trading real encapsulation for a line count — so this
// follows the same opt-out the sibling scheduling view-models already use.
// swiftlint:disable file_length

/// Active / Hidden tab for the event-type list.
enum EventTypeTab: String {
    case active
    case hidden
}

@Observable
@MainActor
// swiftlint:disable:next type_body_length
final class EventTypeListViewModel: ListOfRowsDataSource {
    // MARK: ListOfRowsDataSource chrome

    var title: String {
        "Event types"
    }

    var topBarAction: TopBarAction? {
        TopBarAction(icon: .plus, accessibilityLabel: "New event type") { [weak self] in
            Task { @MainActor in self?.createNew() }
        }
    }

    var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: EventTypeTab.active.rawValue, label: "Active", count: activeTypes.count),
            ListOfRowsTab(id: EventTypeTab.hidden.rawValue, label: "Hidden", count: hiddenTypes.count)
        ]
    }

    var selectedTab: String {
        get { tab.rawValue }
        set {
            tab = EventTypeTab(rawValue: newValue) ?? .active
            rebuild()
        }
    }

    var fab: FABAction? {
        nil
    }

    private(set) var state: ListOfRowsState = .loading

    // MARK: Local UI state (driven from the View)

    /// Event type whose overflow menu is open.
    var menuTarget: EventTypeDTO?
    /// Event type pending delete confirmation.
    var deleteTarget: EventTypeDTO?
    /// Transient blocking-error message (e.g. can't delete with bookings).
    var actionError: String?
    /// A shareable booking link awaiting the system share sheet.
    var shareItem: ShareLinkItem?
    /// Brief "Link copied" affordance.
    var showCopiedToast = false
    /// False when the resolved owner can't edit this catalog (403 / forbidden) —
    /// drives the read-only lock banner + disabled +/toggles/overflow (design
    /// `event-types-frames.jsx` FrameGated).
    private(set) var canEdit = true
    /// B1 FRAME 6 — reorder mode. Entered from the top-bar "Reorder" action;
    /// rows grow a grip, hide their overflow, and inert their toggle while it's on.
    private(set) var isReordering = false

    // MARK: Dependencies + data

    let owner: SchedulingOwner
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var tab: EventTypeTab = .active
    private var eventTypes: [EventTypeDTO] = []
    private var pageSlug: String?

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    private var activeTypes: [EventTypeDTO] {
        eventTypes.filter { $0.isActive != false }
    }

    private var hiddenTypes: [EventTypeDTO] {
        eventTypes.filter { $0.isActive == false }
    }

    // MARK: Bespoke-view projection

    //
    // The B1 screen is rendered bespoke (not through `ListOfRowsView`) so it can
    // carry the design's per-row toggle, 6px colour dot, segmented Active/Hidden
    // filter, pillar section overline, and template-chip empty state — chrome the
    // generic shell can't express. `state` still drives loading/empty/error and
    // stays the projection the unit tests assert on; these read-only accessors
    // expose the row data the bespoke rows need (toggle/dot) without altering it.

    /// Rows for the currently-selected tab, in wire order.
    var visibleTypes: [EventTypeDTO] {
        tab == .active ? activeTypes : hiddenTypes
    }

    var activeCount: Int {
        activeTypes.count
    }

    var hiddenCount: Int {
        hiddenTypes.count
    }

    /// Currently-selected filter tab (read-only; mutate via `selectedTab`).
    var currentTab: EventTypeTab {
        tab
    }

    /// Pillar-accented uppercase section overline above the rows.
    var sectionOverline: String {
        isBusiness ? "Bookable services" : "Your event types"
    }

    /// Centered top-bar title — "Services" for business catalogs, "Event types"
    /// elsewhere (design `FrameBusiness` vs `FramePersonal`).
    var screenTitle: String {
        isBusiness ? "Services" : "Event types"
    }

    /// Per-row meta line ("30 min · Video · $120") reused by the bespoke row.
    func rowMeta(for eventType: EventTypeDTO) -> String {
        subtitle(for: eventType, location: EventLocationMode.from(eventType.locationMode))
    }

    /// True when the row is hidden (`is_active=false`).
    func isHidden(_ eventType: EventTypeDTO) -> Bool {
        eventType.isActive == false
    }

    /// True when the row is unlisted (`visibility=secret`) — drives the eye-off badge.
    func isSecret(_ eventType: EventTypeDTO) -> Bool {
        eventType.visibility == "secret"
    }

    /// "N hosts" pill label for team rows (design EventRow `hosts`), from the
    /// list endpoint's aggregated `assignee_count`. Mirrors web's `isTeam` gate;
    /// nil (no pill) for solo modes or when the count is absent/zero.
    func hostsBadge(for eventType: EventTypeDTO) -> String? {
        let teamModes = ["round_robin", "collective", "group"]
        guard teamModes.contains(eventType.assignmentMode ?? ""),
              let count = eventType.assigneeCount, count > 0 else { return nil }
        return count == 1 ? "1 host" : "\(count) hosts"
    }

    /// Business owners price their bookable services (design `FrameBusiness`);
    /// personal events have no price concept (design `FramePersonal`).
    var isBusiness: Bool {
        if case .business = owner { return true }
        return false
    }

    private var isLoaded: Bool {
        if case .loaded = state { return true }
        if case .empty = state { return true }
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
            let response: EventTypesResponse = try await client.request(SchedulingEndpoints.getEventTypes(owner: owner))
            canEdit = true
            eventTypes = response.eventTypes
            // The booking-page slug powers per-row copy/share; a failure here is
            // non-fatal (`try?`) — the list still loads, links just stay disabled.
            let page = try? await client.request(
                SchedulingEndpoints.getBookingPage(owner: owner),
                as: BookingPageResponse.self
            )
            pageSlug = page?.page.slug
            rebuild()
        } catch let error as SchedulingError {
            if case .forbidden = error {
                // Gated owner (403): render the read-only catalog with a lock banner
                // instead of a full-screen error (design FrameGated). The list endpoint
                // returns no rows on 403, so the banner sits above whatever loaded.
                canEdit = false
                eventTypes = []
                rebuild()
            } else {
                canEdit = true
                state = .error(message: error.userMessage ?? "Couldn't load your event types.")
            }
        } catch {
            canEdit = true
            state = .error(message: "Couldn't load your event types.")
        }
    }

    // MARK: Navigation

    func createNew() {
        push(.eventTypeEditor(owner: owner, eventTypeId: nil))
    }

    /// Drives the all-hidden empty state's "View hidden" CTA — flips the
    /// segmented filter to the Hidden tab in place (design `FrameAllHidden`).
    func showHiddenTab() {
        tab = .hidden
        rebuild()
    }

    /// Bespoke segmented-filter tap (design `FilterHeader`). Mirrors the
    /// `selectedTab` setter the shell would otherwise drive.
    func selectTab(_ target: EventTypeTab) {
        tab = target
        rebuild()
    }

    /// Open an event type in the editor (bespoke row tap).
    func openEventType(_ eventType: EventTypeDTO) {
        open(eventType)
    }

    /// Empty-state template chip (design `FrameEmpty`) — create a video event
    /// type pre-set to `minutes`, then open it in the editor.
    func createFromTemplate(minutes: Int) {
        Task {
            do {
                let request = CreateEventTypeRequest(
                    name: "\(minutes) minute meeting",
                    slug: uniqueSlug(EventTypeFormat.slugify("\(minutes)-min-meeting")),
                    durations: [minutes],
                    defaultDuration: minutes,
                    locationMode: "video"
                )
                let response = try await client.request(
                    SchedulingEndpoints.createEventType(owner: owner, request),
                    as: EventTypeResponse.self
                )
                push(.eventTypeEditor(owner: owner, eventTypeId: response.eventType.id))
            } catch {
                actionError = "Couldn't create event type."
            }
        }
    }

    /// Suffix `-2`, `-3`, … onto a base slug until it doesn't collide with an
    /// existing event type's slug.
    private func uniqueSlug(_ base: String) -> String {
        let taken = Set(eventTypes.map(\.slug))
        guard taken.contains(base) else { return base }
        var n = 2
        while taken.contains("\(base)-\(n)") {
            n += 1
        }
        return "\(base)-\(n)"
    }

    private func open(_ eventType: EventTypeDTO) {
        push(.eventTypeEditor(owner: owner, eventTypeId: eventType.id))
    }

    // MARK: Link sharing

    /// `https://pantopus.com/book/<page>/<event>` — nil until the page slug
    /// loads, which disables copy/share for that row.
    private func bookingLink(for eventType: EventTypeDTO) -> String? {
        guard let pageSlug, !pageSlug.isEmpty else { return nil }
        return "https://pantopus.com/book/\(pageSlug)/\(eventType.slug)"
    }

    func copyLink(_ eventType: EventTypeDTO) {
        guard let link = bookingLink(for: eventType) else {
            actionError = "Set up your booking link first, then you can share this."
            return
        }
        UIPasteboard.general.string = link
        showCopiedToast = true
    }

    func share(_ eventType: EventTypeDTO) {
        guard let link = bookingLink(for: eventType) else {
            actionError = "Set up your booking link first, then you can share this."
            return
        }
        shareItem = ShareLinkItem(link: link)
    }

    // MARK: Reorder (design `event-types-frames.jsx` FRAME 6)

    /// Only offered when the catalog is editable and there is something to
    /// reorder — mirrors the web entry condition (`canEdit && 2+ rows`).
    var canReorder: Bool {
        canEdit && visibleTypes.count > 1
    }

    func startReordering() {
        guard canReorder else { return }
        isReordering = true
    }

    /// "Done" in the hint bar — leave reorder mode and persist any pending move.
    func doneReordering() async {
        isReordering = false
        await persistOrder()
    }

    /// Live drag preview: splice the moved row into its new slot within the FULL
    /// catalog. The visible list is a filtered projection whose relative order
    /// matches, so translating through ids keeps hidden rows undisturbed.
    func moveRows(fromOffsets source: IndexSet, toOffset destination: Int) {
        var visible = visibleTypes
        visible.move(fromOffsets: source, toOffset: destination)
        let reorderedIds = visible.map(\.id)
        var cursor = 0
        eventTypes = eventTypes.map { current in
            // Rewrite only the rows belonging to the visible tab, in their new order.
            guard reorderedIds.contains(current.id) else { return current }
            defer { cursor += 1 }
            return visible[cursor]
        }
    }

    /// Persist every row whose position no longer matches its stored `sort_order`.
    /// Optimistic: positions are stamped locally first, so a failure refetches
    /// rather than leaving the list lying about the saved order.
    private func persistOrder() async {
        let changed = eventTypes.enumerated().filter { index, type in type.sortOrder != index }
        guard !changed.isEmpty else { return }
        do {
            for (index, type) in changed {
                _ = try await client.request(
                    SchedulingEndpoints.updateEventType(
                        owner: owner,
                        id: type.id,
                        UpdateEventTypeRequest(sortOrder: index)
                    ),
                    as: EventTypeResponse.self
                )
            }
            await fetch(showLoading: false)
        } catch {
            actionError = "Couldn't save the new order."
            await fetch(showLoading: false)
        }
    }

    // MARK: Mutations

    func toggleHidden(_ eventType: EventTypeDTO) async {
        let makeActive = eventType.isActive == false
        await mutate {
            _ = try await self.client.request(
                SchedulingEndpoints.updateEventType(
                    owner: self.owner,
                    id: eventType.id,
                    UpdateEventTypeRequest(isActive: makeActive)
                ),
                as: EventTypeResponse.self
            )
        }
    }

    func duplicate(_ eventType: EventTypeDTO) async {
        await mutate {
            let request = Self.copyRequest(from: eventType)
            _ = try await self.client.request(
                SchedulingEndpoints.createEventType(owner: self.owner, request),
                as: EventTypeResponse.self
            )
        }
    }

    func confirmDelete() async {
        guard let target = deleteTarget else { return }
        deleteTarget = nil
        await mutate {
            try await self.client.send(SchedulingEndpoints.deleteEventType(owner: self.owner, id: target.id))
        }
    }

    /// Shared mutate→refetch wrapper that surfaces the typed conflict message
    /// (e.g. `HAS_UPCOMING_BOOKINGS`) on the action-error alert.
    private func mutate(_ body: @escaping () async throws -> Void) async {
        do {
            try await body()
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            actionError = Self.message(for: error)
        } catch {
            actionError = "Something went wrong. Please try again."
        }
    }

    private static func message(for error: SchedulingError) -> String {
        switch error.code {
        // The backend emits HAS_BOOKINGS (routes/scheduling.js DELETE /event-types/:id);
        // HAS_UPCOMING_BOOKINGS never existed on the wire and is kept only as a legacy alias.
        case "HAS_BOOKINGS", "HAS_UPCOMING_BOOKINGS":
            "This has upcoming bookings. Hide it instead to keep those on the calendar."
        case "SLUG_TAKEN":
            "That booking link is taken. Rename the copy and try again."
        default:
            error.userMessage ?? "Something went wrong. Please try again."
        }
    }

    /// Clone every editable field from a source type into a create request
    /// with a "(copy)" name + derived slug.
    private static func copyRequest(from dto: EventTypeDTO) -> CreateEventTypeRequest {
        let name = "\(dto.name) (copy)"
        return CreateEventTypeRequest(
            name: name,
            slug: EventTypeFormat.slugify("\(dto.slug)-copy"),
            description: dto.description,
            color: dto.color,
            durations: dto.durations.isEmpty ? [30] : dto.durations,
            defaultDuration: dto.defaultDuration ?? dto.durations.first,
            locationMode: dto.locationMode,
            locationDetail: dto.locationDetail,
            assignmentMode: dto.assignmentMode,
            requiresApproval: dto.requiresApproval,
            visibility: dto.visibility,
            bufferBeforeMin: dto.bufferBeforeMin,
            bufferAfterMin: dto.bufferAfterMin,
            minNoticeMin: dto.minNoticeMin,
            maxHorizonDays: dto.maxHorizonDays,
            slotIntervalMin: dto.slotIntervalMin,
            seatCap: dto.seatCap,
            scheduleId: dto.scheduleId
        )
    }
}

// MARK: - Row building

private extension EventTypeListViewModel {
    func rebuild() {
        // Gated owner: skip the create/empty CTAs — the read-only rows (possibly
        // empty) render under the lock banner instead (design FrameGated).
        if !canEdit {
            let visible = tab == .active ? activeTypes : hiddenTypes
            let rows = visible.map(row(for:))
            state = .loaded(sections: [RowSection(id: tab.rawValue, rows: rows, style: .card)], hasMore: false)
            return
        }
        guard !eventTypes.isEmpty else {
            state = .empty(emptyAllContent)
            return
        }
        let visible = tab == .active ? activeTypes : hiddenTypes
        guard !visible.isEmpty else {
            state = .empty(emptyTabContent)
            return
        }
        let rows = visible.map(row(for:))
        state = .loaded(sections: [RowSection(id: tab.rawValue, rows: rows, style: .card)], hasMore: false)
    }

    func row(for eventType: EventTypeDTO) -> RowModel {
        let swatch = EventTypeSwatch.match(eventType.color)
        let location = EventLocationMode.from(eventType.locationMode)
        let isHidden = eventType.isActive == false
        return RowModel(
            id: eventType.id,
            title: eventType.name,
            subtitle: subtitle(for: eventType, location: location),
            template: .fileChevron,
            leading: .typeIcon(location.icon, background: swatch.tint, foreground: swatch.color),
            trailing: .kebab,
            onTap: { [weak self] in Task { @MainActor in self?.open(eventType) } },
            onSecondary: { [weak self] in Task { @MainActor in self?.menuTarget = eventType } },
            chips: chips(for: eventType),
            highlight: isHidden ? .muted : nil
        )
    }

    /// "30 min · Video · $120" — the design appends the price to the meta
    /// line after a "·" (design `EventRow`, business services frame) rather
    /// than rendering it as a separate pill chip. Personal events carry no
    /// price concept (design `FramePersonal` shows none); business services
    /// always show one, rendering "Free" for a zero price (design
    /// `FrameBusiness` → `price="Free"`).
    func subtitle(for eventType: EventTypeDTO, location: EventLocationMode) -> String {
        var meta = EventTypeFormat.durationsAndLocation(eventType.durations, location: location)
        if isBusiness, let cents = eventType.priceCents {
            let price = cents == 0
                ? "Free"
                : EventTypeFormat.price(cents: cents, currency: eventType.currency ?? "USD")
            meta += " · \(price)"
        }
        return meta
    }

    func chips(for eventType: EventTypeDTO) -> [RowChip]? {
        var chips: [RowChip] = []
        // The design business row shows a `users`-icon "N hosts" badge inline
        // beside the name. The list `EventTypeDTO` carries no assignee count,
        // so the badge is data-blocked — see deferredBackend.
        if eventType.visibility == "secret" {
            chips.append(RowChip(text: "Unlisted", icon: .eyeOff, tint: .status(.neutral)))
        }
        return chips.isEmpty ? nil : chips
    }

    var emptyAllContent: ListOfRowsState.EmptyContent {
        // Design `FrameEmpty` — calendar-plus hero, primary CTA. (The
        // "Start from a template" overline + duration template chips the
        // design draws below the CTA need a new `EmptyContent` slot on the
        // shared shell — see sharedChangesNeeded.)
        .init(
            icon: .calendarPlus,
            headline: "You don't have any event types yet",
            subcopy: "An event type is something people can book — a call, a meeting, a visit. Start from a template or build your own.",
            ctaTitle: "Create your first event type"
        ) { [weak self] in Task { @MainActor in self?.createNew() } }
    }

    var emptyTabContent: ListOfRowsState.EmptyContent {
        if tab == .active {
            // Design `FrameAllHidden` — eye-off grey disc, "Everything's
            // hidden", and a "View hidden →" ghost button that flips to the
            // Hidden tab.
            return .init(
                icon: .eyeOff,
                headline: "Everything's hidden",
                subcopy: "Switch to Hidden to bring one back, or create a new event type.",
                ctaTitle: "View hidden",
                onCTA: { [weak self] in Task { @MainActor in self?.showHiddenTab() } },
                tint: Theme.Color.appSurfaceSunken,
                accent: Theme.Color.appTextSecondary
            )
        }
        return .init(
            icon: .eye,
            headline: "Nothing hidden",
            subcopy: "Hidden event types stay off your booking page. Hide one from its menu.",
            tint: Theme.Color.appSurfaceSunken,
            accent: Theme.Color.appTextSecondary
        )
    }
}
