//
//  ResourceDetailViewModel.swift
//  Pantopus
//
//  Stream I12 — F11 Resource Detail / Booking Calendar. Header (rules) + the
//  resource's upcoming bookings, grouped by day, read from the host bookings
//  list (the calendar union omits `resource_id`; see the Foundation-gap note in
//  `ResourceKit`). Pending bookings on an approval-gated resource surface an
//  Approve / Decline queue wired to the bookings lifecycle.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class ResourceDetailViewModel {
    enum ViewState: Equatable {
        case loading
        case loaded
        case error(message: String)
    }

    // MARK: Presentation models

    struct RuleChipModel: Identifiable, Hashable {
        let id = UUID()
        let icon: PantopusIcon
        let text: String
    }

    struct BookingRowModel: Identifiable, Hashable {
        let id: String
        let timeRange: String
        let who: String
        let member: ResourceHomeMember?
        let isPending: Bool
    }

    struct DaySection: Identifiable, Hashable {
        let id: String
        let title: String
        let rows: [BookingRowModel]
    }

    struct ApprovalModel: Identifiable, Hashable {
        let id: String
        let who: String
        let when: String
        let member: ResourceHomeMember?
    }

    // MARK: State

    private(set) var state: ViewState = .loading
    private(set) var resourceName = ""
    private(set) var kind: ResourceKind = .other
    private(set) var ruleChips: [RuleChipModel] = []
    private(set) var approvals: [ApprovalModel] = []
    private(set) var sections: [DaySection] = []
    var actionError: String?
    private(set) var isMutating = false

    /// Count of pending approval requests — drives the header "Pending
    /// approval (N)" badge button (F11 approval-pending frame). Mirrors
    /// `approvals.count`; surfaced as a distinct field so the view can read it
    /// without depending on the queue card being rendered.
    private(set) var pendingApprovalCount = 0

    /// View-only fully-booked variant (F11 fully-booked frame): when set, the
    /// detail shows an amber "Fully booked …" banner and the sticky CTA flips
    /// to "Book next opening · <label>". Defaults to the normal (not-full)
    /// state; the resource-detail bookings list does not expose forward
    /// availability, so the through-label and next-opening label are populated
    /// only when the backend provides them (see deferred-backend note).
    private(set) var fullyBookedThroughLabel: String?
    private(set) var nextOpeningLabel: String?
    var isFullyBooked: Bool {
        nextOpeningLabel != nil
    }

    // MARK: Dependencies

    let homeId: String
    let resourceId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var requiresApproval = false

    init(
        homeId: String,
        resourceId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.homeId = homeId
        self.resourceId = resourceId
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

    private func fetch(showLoading: Bool) async {
        if showLoading { state = .loading }
        do {
            let resources: ResourcesResponse = try await client.request(
                SchedulingEndpoints.getResources(owner: owner)
            )
            let bookingsResponse: ResourceBookingsResponse = try await client.request(
                SchedulingEndpoints.getBookings(owner: owner)
            )
            let members = await fetchMembers()

            guard let resource = resources.resources.first(where: { $0.id == resourceId }) else {
                state = .error(message: "This resource is no longer available.")
                return
            }
            apply(resource: resource, bookings: bookingsResponse.bookings, members: members)
            state = .loaded
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "Couldn't load this resource.")
        } catch {
            state = .error(message: "Couldn't load this resource.")
        }
    }

    private func fetchMembers() async -> [String: ResourceHomeMember] {
        do {
            let response: OccupantsResponse = try await client.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            return Dictionary(
                ResourceHomeMember.from(occupants: response.occupants).map { ($0.id, $0) }
            ) { first, _ in first }
        } catch {
            return [:]
        }
    }

    private func apply(resource: ResourceDTO, bookings: [ResourceBooking], members: [String: ResourceHomeMember]) {
        resourceName = resource.name
        kind = ResourceKind(wire: resource.resourceType)
        requiresApproval = resource.requiresApproval ?? false
        ruleChips = Self.buildRuleChips(resource)

        let now = Date()
        let mine = bookings
            .filter { $0.resourceId == resourceId && $0.isLive }
            .filter { booking in
                let end = booking.endAt.flatMap(SchedulingTime.parseUTC)
                    ?? booking.startAt.flatMap(SchedulingTime.parseUTC)
                return (end ?? now) >= now
            }
            .sorted { ($0.startAt ?? "") < ($1.startAt ?? "") }

        let member: (ResourceBooking) -> ResourceHomeMember? = { booking in
            members[booking.createdBy ?? ""] ?? members[booking.hostUserId ?? ""]
        }
        let who: (ResourceBooking) -> String = { booking in
            booking.inviteeName ?? member(booking)?.name ?? "Member"
        }

        approvals = requiresApproval
            ? mine.filter(\.isPending).map { booking in
                ApprovalModel(
                    id: booking.id,
                    who: who(booking),
                    when: ResourceTime.longRangeLabel(startISO: booking.startAt, endISO: booking.endAt),
                    member: member(booking)
                )
            }
            : []

        pendingApprovalCount = approvals.count

        let confirmed = requiresApproval ? mine.filter { !$0.isPending } : mine
        sections = Self.groupByDay(confirmed, who: who, member: member)
    }

    private static func buildRuleChips(_ resource: ResourceDTO) -> [RuleChipModel] {
        var chips: [RuleChipModel] = []
        if let minutes = resource.maxDurationMin, minutes > 0 {
            let hours = minutes / 60
            chips.append(RuleChipModel(icon: .timer, text: hours >= 1 ? "\(hours) hr max" : "\(minutes) min max"))
        }
        let approval = (resource.requiresApproval ?? false)
        chips.append(RuleChipModel(icon: approval ? .clock : .check, text: approval ? "Needs approval" : "No approval"))
        chips.append(RuleChipModel(icon: .users, text: WhoCanBook(wire: resource.whoCanBook).bookLabel))
        return chips
    }

    private static func groupByDay(
        _ bookings: [ResourceBooking],
        who: (ResourceBooking) -> String,
        member: (ResourceBooking) -> ResourceHomeMember?
    ) -> [DaySection] {
        var order: [Date] = []
        var grouped: [Date: [BookingRowModel]] = [:]
        var labelISO: [Date: String] = [:]
        for booking in bookings {
            guard let startISO = booking.startAt, let day = ResourceTime.dayKey(startISO) else { continue }
            if grouped[day] == nil {
                order.append(day)
                labelISO[day] = startISO
            }
            grouped[day, default: []].append(
                BookingRowModel(
                    id: booking.id,
                    timeRange: ResourceTime.rangeLabel(startISO: booking.startAt, endISO: booking.endAt),
                    who: who(booking),
                    member: member(booking),
                    isPending: booking.isPending
                )
            )
        }
        return order.map { day in
            DaySection(
                id: ResourceTime.utcISO(day),
                title: ResourceTime.daySectionLabel(labelISO[day] ?? ""),
                rows: grouped[day] ?? []
            )
        }
    }

    // MARK: Actions

    func bookThis() {
        push(.bookResource(homeId: homeId, resourceId: resourceId))
    }

    /// Fully-booked CTA — routes to the same booking sheet (the next-opening
    /// slot is selected there). No dedicated endpoint.
    func bookNextOpening() {
        push(.bookResource(homeId: homeId, resourceId: resourceId))
    }

    func edit() {
        push(.resourceEditor(homeId: homeId, resourceId: resourceId))
    }

    /// Header pending-approval badge tap — scrolls/anchors to the approval
    /// queue, which already lives in the same scroll view; surfaced as an
    /// action hook so the badge button is interactive even when the queue is
    /// the affordance the user lands on.
    func openApprovalQueue() {}

    func approve(_ id: String) async {
        await mutate { try await self.client.send(SchedulingEndpoints.approveBooking(owner: self.owner, id: id)) }
    }

    func decline(_ id: String) async {
        await mutate { try await self.client.send(SchedulingEndpoints.declineBooking(owner: self.owner, id: id)) }
    }

    private func mutate(_ body: @escaping () async throws -> Void) async {
        guard !isMutating else { return }
        isMutating = true
        defer { isMutating = false }
        do {
            try await body()
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Something went wrong. Please try again."
        } catch {
            actionError = "Something went wrong. Please try again."
        }
    }
}

private extension WhoCanBook {
    /// Header chip label ("All members" / "Specific" / "Guest link").
    var bookLabel: String {
        switch self {
        case .members: "All members"
        case .specific: "Specific"
        case .guests: "Guest link"
        }
    }
}
