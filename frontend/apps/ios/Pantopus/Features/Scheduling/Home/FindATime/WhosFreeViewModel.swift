//
//  WhosFreeViewModel.swift
//  Pantopus
//
//  Stream I11 — F7 Who's Free · Household Availability. A glanceable heat grid
//  composed from each member's personal availability (`GET /whos-free`, home
//  alias). Free / busy / unknown per member × time-of-day bucket; tap a free
//  block to start a find-a-time or quick-add an event. Members are resolved from
//  the home occupants (the scheduling read returns bare UUIDs). See
//  `reference/calendarly-backend-api.md`.
//

import Foundation

@Observable
@MainActor
final class WhosFreeViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    enum ViewMode: String, Hashable {
        case day
        case week
    }

    enum CellState: Hashable {
        case free
        case busy
        /// Soft-hold / maybe block — design amber `fef3c7`. The home `whos-free`
        /// read only emits free slots today, so this isn't produced from live data
        /// yet (see `deferredBackend`); the grid + legend model it for parity.
        case tentative
        /// Outside the member's working/awake window — design hatched `f9fafb`.
        /// Not distinguished by the current wire contract; modelled for parity.
        case offHours
        case unknown
    }

    struct GridRow: Identifiable, Hashable {
        let member: FindATimeMember
        let cells: [CellState]
        var id: String {
            member.id
        }
    }

    /// 2-hour buckets the design columns map to (8a … 6p).
    static let bucketHours = [8, 10, 12, 14, 16, 18]
    static let columnLabels = ["8a", "10a", "12p", "2p", "4p", "6p"]

    // Dependencies / route context.
    let homeId: String
    private(set) var tz: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    // State.
    private(set) var phase: Phase = .loading
    private(set) var rows: [GridRow] = []
    private(set) var hasUnknownMember = false
    var viewMode: ViewMode = .day
    private(set) var isActing = false
    var actionMessage: String?
    var actionError: String?

    init(
        homeId: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.homeId = homeId
        self.tz = tz
        self.push = push
        self.client = client
    }

    // MARK: - Derived

    /// True when no member has a single free block in the window.
    var hasNoFreeTime: Bool {
        !rows.isEmpty && rows.allSatisfy { row in row.cells.allSatisfy { $0 != .free } }
    }

    /// The first member who hasn't shared free/busy (all-unknown row) — drives the
    /// opted-out explainer banner ("<name> hasn't shared free/busy").
    var firstUnknownMemberName: String? {
        rows.first { row in row.cells.allSatisfy { $0 == .unknown } }?.member.displayName
    }

    var columnLabels: [String] {
        Self.columnLabels
    }

    // MARK: - Load

    func load() async {
        phase = .loading
        let calendar = tzCalendar
        let startOfDay = calendar.startOfDay(for: Date())
        let days = viewMode == .day ? 1 : 7
        let end = calendar.date(byAdding: .day, value: days, to: startOfDay) ?? startOfDay
        do {
            let occupants: OccupantsResponse = try await client.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            let free: MemberFreeResponse = try await client.request(
                SchedulingEndpoints.whosFree(
                    owner: owner,
                    // Day keys must be formatted in the same zone the
                    // start-of-day was computed in — the UTC overload shifts
                    // the requested window by a day for non-UTC homes.
                    from: SchedulingTime.isoDay(startOfDay, tz: tz),
                    to: SchedulingTime.isoDay(end, tz: tz),
                    tz: tz
                )
            )
            buildGrid(occupants: occupants, free: free)
            phase = .ready
        } catch {
            phase = .error(message: Self.message(for: error))
        }
    }

    func refresh() async {
        await load()
    }

    /// Top-bar "Add" — open the find-a-time setup to plan a household time.
    func startFindATime() {
        push(.findATimeSetup(homeId: homeId))
    }

    func setViewMode(_ mode: ViewMode) {
        guard mode != viewMode else { return }
        viewMode = mode
        Task { await load() }
    }

    private func buildGrid(occupants: OccupantsResponse, free: MemberFreeResponse) {
        let members = occupants.occupants.filter(\.isActive).map(FindATimeMember.init(occupant:))
        let sharedIds = Set(free.members)
        hasUnknownMember = false

        rows = members.map { member in
            if !sharedIds.contains(member.id) {
                hasUnknownMember = true
                return GridRow(member: member, cells: Array(repeating: .unknown, count: Self.bucketHours.count))
            }
            let freeHours = Self.freeHours(slots: free.freeByMember[member.id] ?? [], tz: tz)
            let cells = Self.bucketHours.map { hour -> CellState in
                let bucket = Set(hour..<(hour + 2))
                return bucket.isDisjoint(with: freeHours) ? .busy : .free
            }
            return GridRow(member: member, cells: cells)
        }
    }

    /// The set of local hours a member is free, derived from their free slots.
    private static func freeHours(slots: [SlotDTO], tz: String) -> Set<Int> {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: tz) ?? .current
        var hours: Set<Int> = []
        for slot in slots {
            guard let start = SchedulingTime.parseUTC(slot.start),
                  let end = SchedulingTime.parseUTC(slot.end) else { continue }
            let startHour = calendar.component(.hour, from: start)
            // Round the end hour up so a 9:00–9:30 slot still covers hour 9.
            let endComponents = calendar.dateComponents([.hour, .minute], from: end)
            let rawEnd = (endComponents.hour ?? startHour) + ((endComponents.minute ?? 0) > 0 ? 1 : 0)
            let endHour = max(startHour + 1, min(rawEnd, 24))
            for hour in startHour..<endHour {
                hours.insert(hour)
            }
        }
        return hours
    }

    // MARK: - Cell tap actions

    func rangeLabel(member: FindATimeMember, bucketIndex: Int) -> String {
        let hour = Self.bucketHours[bucketIndex]
        return "\(member.displayName) · \(Self.hourLabel(hour))–\(Self.hourLabel(hour + 2)) · free"
    }

    /// "Find a time here" — seed a single-member find-a-time anchored on the
    /// tapped day and open F5.
    func findATimeHere(member: FindATimeMember) {
        let calendar = tzCalendar
        let startOfDay = calendar.startOfDay(for: Date())
        let to = calendar.date(byAdding: .day, value: viewMode == .day ? 0 : 6, to: startOfDay) ?? startOfDay
        FindATimeDraftStore.draft = FindATimeDraft(
            homeId: homeId,
            title: "Family time",
            members: [member],
            requiredMemberIds: [member.id],
            mode: .collective,
            durationMin: 30,
            from: SchedulingTime.isoDay(startOfDay, tz: tz),
            to: SchedulingTime.isoDay(to, tz: tz),
            tz: tz,
            precomputedSlots: nil
        )
        push(.findATimeSuggested(homeId: homeId, tz: tz))
    }

    /// "Add event" — quick-add a 1-hour household event at the tapped block today.
    func addEvent(member: FindATimeMember, bucketIndex: Int) async {
        guard !isActing else { return }
        isActing = true
        actionError = nil
        let calendar = tzCalendar
        let startOfDay = calendar.startOfDay(for: Date())
        let hour = Self.bucketHours[bucketIndex]
        guard let start = calendar.date(byAdding: .hour, value: hour, to: startOfDay),
              let end = calendar.date(byAdding: .hour, value: 1, to: start) else {
            isActing = false
            return
        }
        let request = CreateHomeEventRequest(
            eventType: CalendarEventCategory.family.rawValue,
            title: "Family time",
            startAt: Self.isoUTC(start),
            endAt: Self.isoUTC(end),
            assignedTo: [member.id],
            requestRsvp: false
        )
        do {
            let _: HomeEventResponse = try await client.request(
                HomesEndpoints.createHomeEvent(homeId: homeId, request: request)
            )
            actionMessage = "Added “Family time” at \(Self.hourLabel(hour)) for \(member.displayName)."
        } catch {
            actionError = Self.message(for: error)
        }
        isActing = false
    }

    // MARK: - Helpers

    private var tzCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: tz) ?? .current
        return calendar
    }

    private static func isoUTC(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func hourLabel(_ hour24: Int) -> String {
        let normalized = ((hour24 % 24) + 24) % 24
        let period = normalized < 12 ? "AM" : "PM"
        var hour12 = normalized % 12
        if hour12 == 0 { hour12 = 12 }
        return "\(hour12) \(period)"
    }

    private static func message(for error: Error) -> String {
        if let schedulingError = error as? SchedulingError {
            return schedulingError.userMessage ?? "Couldn't load availability."
        }
        return "Couldn't load availability."
    }
}
