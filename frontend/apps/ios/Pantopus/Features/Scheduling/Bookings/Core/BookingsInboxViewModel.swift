//
//  BookingsInboxViewModel.swift
//  Pantopus
//
//  E1 Bookings Inbox (Stream I8). Owner-scoped host list driven by
//  `GET /bookings?status&q`: the four tabs map to the `status` filter
//  (upcoming/pending/past/cancelled), the search field maps to `q`, and a
//  best-effort summary fetch powers the Pending badge. Pending rows approve
//  optimistically (refetch-on-error); decline/reschedule/cancel open the local
//  E3/E4/E5 sheets. Loading / empty / error are all first-class.
//

import SwiftUI

@Observable
@MainActor
final class BookingsInboxViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    let owner: SchedulingOwner
    private let push: @MainActor (SchedulingRoute) -> Void
    private let actions: BookingActions

    private(set) var phase: Phase = .loading
    private(set) var bookings: [BookingDTO] = []
    private(set) var eventNames: [String: String] = [:]
    private(set) var pendingCount = 0

    var selectedTab: BookingStatusFilter = .upcoming
    var searchVisible = false
    var searchText = ""
    /// Transient action failure (approve/decline) surfaced as an inline banner.
    var actionError: String?
    var activeSheet: BookingActionSheet?
    /// Drives the E9 filter bottom sheet, presented from the top-bar filter icon.
    var filterSheetVisible = false
    /// The most recently applied filter set. The event-type / date-range facets
    /// are forwarded on every `fetch()` (tab switches and refreshes included) so
    /// the list matches the sheet CTA's "Show N bookings" count. `nil` until the
    /// host applies a filter.
    private(set) var appliedFilters: BookingFilters?

    private var didLoad = false
    private var fetchGeneration = 0

    var accent: Color {
        owner.theme.accent
    }

    /// The active owner mapped to its scope-pill key, so the cross-owner pill row
    /// (All / Personal / Home / Business) can mark the right pill filled. The
    /// inbox is scoped to a single owner per route, so the other pills are
    /// rendered for parity but cross-owner navigation needs an owner directory
    /// the route doesn't carry (see `deferredBackend`).
    var activeScopeKey: BookingScopeFilter {
        switch owner {
        case .personal: .personal
        case .home: .home
        case .business: .business
        }
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        actions: BookingActions
    ) {
        self.owner = owner
        self.push = push
        self.actions = actions
    }

    // MARK: - Derived

    /// The list grouped into the rendered sections: a single "Needs your
    /// approval" group on the Pending tab, otherwise relative day buckets.
    var sections: [BookingSection] {
        if selectedTab == .pending {
            return bookings.isEmpty ? [] : [
                BookingSection(title: "Needs your approval", showsApprovalDot: true, bookings: bookings)
            ]
        }
        let grouped = Dictionary(grouping: bookings) { booking in
            BookingDaySection.section(forStartUTC: booking.startAt)
        }
        let ascending = !selectedTab.isDescending
        return grouped
            .sorted { ascending ? $0.key.order < $1.key.order : $0.key.order > $1.key.order }
            .map { key, value in
                BookingSection(
                    title: key.title,
                    showsApprovalDot: false,
                    bookings: value.sorted {
                        ascending ? ($0.startAt ?? "") < ($1.startAt ?? "") : ($0.startAt ?? "") > ($1.startAt ?? "")
                    }
                )
            }
    }

    var isEmpty: Bool {
        phase == .ready && bookings.isEmpty
    }

    func eventName(for booking: BookingDTO) -> String? {
        booking.eventTypeId.flatMap { eventNames[$0] }
    }

    // MARK: - Loading

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        await loadEventNames()
        await loadSummary()
        await fetch()
    }

    func refresh() async {
        await loadSummary()
        await fetch()
    }

    func selectTab(_ tab: BookingStatusFilter) async {
        guard tab != selectedTab else { return }
        selectedTab = tab
        await fetch()
    }

    func toggleSearch() {
        searchVisible.toggle()
        if !searchVisible, !searchText.isEmpty {
            searchText = ""
            Task { await fetch() }
        }
    }

    func submitSearch() async {
        await fetch()
    }

    // MARK: - Filter sheet (E9)

    /// Open the E9 filter sheet from the top-bar filter icon.
    func presentFilterSheet() {
        filterSheetVisible = true
    }

    /// Build the filter sheet's view-model, seeding its event-type facet from the
    /// inbox's best-effort event-type name map. The filter VM counts results
    /// against this owner.
    func makeFilterViewModel() -> BookingFilterViewModel {
        let options = eventNames
            .map { BookingFilterViewModel.EventTypeOption(id: $0.key, name: $0.value) }
            .sorted { $0.name < $1.name }
        return BookingFilterViewModel(owner: owner, eventTypeOptions: options, client: .shared)
    }

    /// Apply a filter set returned by the E9 sheet. The status facet maps onto
    /// the inbox tab and the text facet onto the search field; the event-type /
    /// date-range facets are stored in `appliedFilters` and forwarded to
    /// `GET /bookings?status&event_type_id&from&to&q` by `fetch()`.
    ///
    /// The status is read via its `queryValue` string (not the facet enum type)
    /// to stay clear of the inbox-vs-facet `BookingStatusFilter` name collision.
    func applyFilters(_ filters: BookingFilters) async {
        appliedFilters = filters
        searchText = filters.search
        searchVisible = searchVisible || !filters.search.trimmingCharacters(in: .whitespaces).isEmpty
        switch filters.status?.queryValue {
        case "upcoming": selectedTab = .upcoming
        case "pending": selectedTab = .pending
        case "past": selectedTab = .past // facet-only `.noShow` also maps here
        case "cancelled": selectedTab = .cancelled
        default: break // no status facet → keep current tab
        }
        await fetch()
    }

    private func fetch() async {
        fetchGeneration &+= 1
        let generation = fetchGeneration
        phase = .loading
        let bounds = appliedFilters?.dateBounds() ?? (from: nil, to: nil)
        do {
            var result = try await actions.list(
                status: selectedTab,
                search: searchText,
                eventTypeId: appliedFilters?.eventTypeId,
                from: bounds.from,
                to: bounds.to
            )
            // The facet-only No-show status queries `past` then narrows
            // client-side, mirroring the sheet's live count.
            if appliedFilters?.status == .noShow, selectedTab == .past {
                result = result.filter { $0.status == "no_show" }
            }
            guard generation == fetchGeneration else { return }
            bookings = result
            phase = .ready
        } catch let error as SchedulingError {
            guard generation == fetchGeneration else { return }
            phase = .error(message: error.userMessage ?? "Couldn't load bookings.")
        } catch {
            guard generation == fetchGeneration else { return }
            phase = .error(message: "Couldn't load bookings.")
        }
    }

    /// Best-effort Pending badge count, derived from the pending bookings list
    /// — the summary endpoint carries no `pendingCount` on the wire. Failure
    /// leaves the badge unchanged.
    private func loadSummary() async {
        guard let pending = try? await actions.list(status: .pending, search: nil) else { return }
        pendingCount = pending.count
    }

    /// Best-effort event-type name map so rows can show the event title (the
    /// list endpoint omits it). Failure simply hides the row subtitle.
    private func loadEventNames() async {
        guard let names = try? await actions.eventTypeNames() else { return }
        eventNames = names
    }

    // MARK: - Quick actions

    /// Optimistic approve: drop the row, confirm server-side, restore + surface
    /// on failure. PAST_DEADLINE / ALREADY_APPROVED come back as a typed message.
    /// The rollback is generation-guarded: a tab switch / filter apply while the
    /// approve is in flight refetches the list, and restoring the stale snapshot
    /// would resurrect the previous tab's rows into the new one.
    func approve(_ booking: BookingDTO) async {
        actionError = nil
        let snapshot = bookings
        let generation = fetchGeneration
        bookings.removeAll { $0.id == booking.id }
        if pendingCount > 0 { pendingCount -= 1 }
        do {
            _ = try await actions.approve(id: booking.id)
        } catch {
            await loadSummary()
            actionError = approveErrorMessage(error, verb: "approve")
            guard generation == fetchGeneration else { return }
            bookings = snapshot
        }
    }

    func presentDecline(_ booking: BookingDTO) {
        activeSheet = .decline(booking)
    }

    func presentReschedule(_ booking: BookingDTO) {
        activeSheet = .reschedule(booking)
    }

    func presentCancel(_ booking: BookingDTO) {
        activeSheet = .cancel(booking)
    }

    func openDetail(_ booking: BookingDTO) {
        push(.bookingDetail(owner: owner, bookingId: booking.id))
    }

    /// FAB / empty-state CTA — jump to the booking-page screen (C1, I4) where the
    /// shareable link lives.
    func shareBookingLink() {
        push(.bookingPageManagement(owner: owner))
    }

    /// Called by a sheet on success: refresh the list + badge so the optimistic
    /// removal is reconciled against the server.
    func handleSheetCompleted() async {
        activeSheet = nil
        await refresh()
    }

    /// Overflow-menu actions for a row, contextual to its status.
    func menuActions(for booking: BookingDTO) -> [BookingRowAction] {
        var items: [BookingRowAction] = [
            BookingRowAction(title: "View details", icon: .arrowUpRight) { [weak self] in self?.openDetail(booking) }
        ]
        let status = SchedulingPillStatus(backend: booking.status)
        switch status {
        case .pending:
            items.insert(BookingRowAction(title: "Approve", icon: .check) { [weak self] in
                Task { await self?.approve(booking) }
            }, at: 0)
            items.append(BookingRowAction(title: "Decline", icon: .x, isDestructive: true) { [weak self] in
                self?.presentDecline(booking)
            })
        case .confirmed, .active:
            items.append(BookingRowAction(title: "Reschedule", icon: .calendarClock) { [weak self] in
                self?.presentReschedule(booking)
            })
            items.append(BookingRowAction(title: "Cancel", icon: .xCircle, isDestructive: true) { [weak self] in
                self?.presentCancel(booking)
            })
        default:
            break
        }
        return items
    }

    private func approveErrorMessage(_ error: Error, verb: String) -> String {
        guard let scheduling = error as? SchedulingError else { return "Couldn't \(verb). Try again." }
        switch scheduling {
        case let .conflict(code, message):
            switch code {
            case "PAST_DEADLINE": return "It's past the deadline to \(verb) this booking."
            case "ALREADY_APPROVED": return "This booking was already approved."
            case "INVALID_STATUS": return "This booking can no longer be \(verb)d."
            default: return message ?? "Couldn't \(verb). Try again."
            }
        default:
            return scheduling.userMessage ?? "Couldn't \(verb). Try again."
        }
    }
}

/// A rendered inbox section (a day bucket, or the pending "Needs your approval").
struct BookingSection: Identifiable {
    var id: String {
        title
    }

    let title: String
    let showsApprovalDot: Bool
    let bookings: [BookingDTO]
}

#if DEBUG
extension BookingsInboxViewModel {
    static func previewLoaded(tab: BookingStatusFilter = .upcoming) -> BookingsInboxViewModel {
        let vm = BookingsInboxViewModel(owner: .personal, push: { _ in }, actions: BookingActions(owner: .personal))
        vm.selectedTab = tab
        vm.eventNames = ["et1": "30-min intro call", "et2": "Garden walkthrough"]
        vm.pendingCount = 2
        vm.bookings = [
            .preview(
                id: "b1",
                status: tab == .pending ? "pending" : "confirmed",
                ownerType: "user",
                invitee: "Dana Whitfield",
                start: "2030-06-18T21:00:00Z",
                eventTypeId: "et1"
            ),
            .preview(
                id: "b2",
                status: tab == .pending ? "pending" : "confirmed",
                ownerType: "home",
                invitee: "Mara Reyes",
                start: "2030-06-18T23:30:00Z",
                eventTypeId: "et2"
            )
        ]
        vm.phase = .ready
        vm.didLoad = true
        return vm
    }

    static func previewEmpty() -> BookingsInboxViewModel {
        let vm = BookingsInboxViewModel(owner: .personal, push: { _ in }, actions: BookingActions(owner: .personal))
        vm.phase = .ready
        vm.didLoad = true
        return vm
    }
}
#endif
