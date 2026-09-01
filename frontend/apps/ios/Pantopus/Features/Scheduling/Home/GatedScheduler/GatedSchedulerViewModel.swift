//
//  GatedSchedulerViewModel.swift
//  Pantopus
//
//  Stream I10 — F15 Permission-Gated Scheduler View.
//
//  A render-mode, not a new screen: how the Home scheduler looks for a member
//  who lacks `calendar.edit`. Built as the Home Calendar/Agenda in read-only
//  mode — the FAB and per-row edit affordances are gone. The member's own
//  assignments stay actionable (Accept / Decline → RSVP). A member who lacks
//  `calendar.view` gets a no-access state (the events endpoint 403s).
//
//  The top-bar "Ask to manage" requests scheduling access. There is no
//  scheduling-permission request endpoint in migrations 159–165 (a backend
//  gap), so the request is recorded as a per-home device flag; the pending
//  banner renders faithfully and the flow is a drop-in for the future call.
//

import Foundation
import Observation

@Observable
@MainActor
final class GatedSchedulerViewModel {
    enum Phase: Equatable {
        case loading
        case noAccess
        case loaded
        case error(message: String)
    }

    private(set) var phase: Phase = .loading
    private(set) var monthStrip: MonthStripState?
    /// The member's own assignments — pinned + actionable (Accept / Decline).
    private(set) var assignments: [HomeAgendaItem] = []
    /// The rest of the schedule, read-only. One "Rest of the schedule" section
    /// when assignments exist, else the full day-grouped agenda.
    private(set) var agendaSections: [HomeAgendaSection] = []
    /// Whether the member has requested scheduling access (pending banner).
    private(set) var requested: Bool
    /// The assignment id currently being accepted / declined.
    private(set) var actioningId: String?

    // MARK: - Dependencies

    private let homeId: String
    private let api: APIClient
    /// Resolved lazily in `load()` from `AuthManager` when not injected — we
    /// avoid a `@MainActor` default-argument (Xcode 16.4 crash). Tests inject.
    private var resolvedUserId: String?
    private let now: @Sendable () -> Date
    private let calendar: Calendar
    private let timeZone: TimeZone
    private let defaults: UserDefaults

    private var events: [CalendarEventDTO] = []
    private var members: [String: HomeMember] = [:]
    private var weekAnchorIso: String

    init(
        homeId: String,
        api: APIClient = .shared,
        currentUserId: String? = nil,
        now: @escaping @Sendable () -> Date = { Date() },
        calendar: Calendar = GatedSchedulerViewModel.utcCalendar,
        timeZone: TimeZone = TimeZone(identifier: "UTC") ?? .current,
        defaults: UserDefaults = .standard
    ) {
        self.homeId = homeId
        self.api = api
        resolvedUserId = currentUserId
        self.now = now
        self.calendar = calendar
        self.timeZone = timeZone
        self.defaults = defaults
        var cal = calendar
        cal.timeZone = timeZone
        weekAnchorIso = HomeAgendaBuilder.weekAnchorIso(for: now(), calendar: cal)
        requested = defaults.bool(forKey: "scheduling.gated.\(homeId).requested")
    }

    // MARK: - Lifecycle

    func load() async {
        phase = .loading
        if resolvedUserId == nil { resolvedUserId = Self.signedInUserId() }
        do {
            async let eventsTask: GetHomeEventsResponse =
                api.request(HomesEndpoints.homeEvents(homeId: homeId))
            async let occupantsTask: OccupantsResponse =
                api.request(HomesEndpoints.listOccupants(homeId: homeId))

            let response = try await eventsTask
            events = response.events
            let occupants = await (try? occupantsTask.occupants) ?? []
            if !occupants.isEmpty {
                members = Self.memberLookup(from: occupants, currentUserId: resolvedUserId)
            }
            rebuild()
            phase = .loaded
        } catch APIError.forbidden {
            phase = .noAccess
        } catch {
            phase = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load the schedule."
            )
        }
    }

    // MARK: - Strip navigation (read-only browse)

    func shiftWeek(_ direction: HomeCalendarViewModel.WeekShift) {
        var cal = calendar
        cal.timeZone = timeZone
        guard let anchor = HomeAgendaBuilder.parseIso(weekAnchorIso, calendar: cal) else { return }
        let days = direction == .next ? 7 : -7
        guard let shifted = cal.date(byAdding: .day, value: days, to: anchor) else { return }
        weekAnchorIso = HomeAgendaBuilder.weekAnchorIso(for: shifted, calendar: cal)
        monthStrip = HomeAgendaBuilder.weekStrip(
            events: events,
            anchorIso: weekAnchorIso,
            selectedIso: nil,
            now: now(),
            calendar: cal,
            timeZone: timeZone
        )
    }

    // MARK: - Access request

    func requestAccess() {
        guard !requested else { return }
        requested = true
        defaults.set(true, forKey: "scheduling.gated.\(homeId).requested")
    }

    // MARK: - Assignment actions (RSVP)

    func accept(_ item: HomeAgendaItem) async {
        await rsvp(item, status: "going")
    }

    func decline(_ item: HomeAgendaItem) async {
        await rsvp(item, status: "declined")
    }

    private func rsvp(_ item: HomeAgendaItem, status: String) async {
        guard let eventId = item.eventId, actioningId == nil else { return }
        actioningId = item.id
        defer { actioningId = nil }
        do {
            let _: HomeEventRsvpResponse = try await api.request(
                HomesEndpoints.rsvpHomeEvent(
                    homeId: homeId,
                    eventId: eventId,
                    request: HomeEventRsvpRequest(status: status)
                )
            )
            // Optimistically clear the actioned assignment — it's resolved.
            // Drop it from the source events too; otherwise the rebuild()
            // refresh below re-derives it straight back into `assignments`.
            events.removeAll { $0.id == eventId }
            assignments.removeAll { $0.id == item.id }
            if assignments.isEmpty { rebuild() }
        } catch {
            // Leave the assignment in place so the member can retry.
        }
    }

    // MARK: - Projection

    private func rebuild() {
        var cal = calendar
        cal.timeZone = timeZone
        let nowDate = now()

        monthStrip = HomeAgendaBuilder.weekStrip(
            events: events,
            anchorIso: weekAnchorIso,
            selectedIso: nil,
            now: nowDate,
            calendar: cal,
            timeZone: timeZone
        )

        let mineIds = Set(events.filter { isMine($0) }.map(\.id))
        if resolvedUserId != nil, !mineIds.isEmpty {
            assignments = events
                .filter { mineIds.contains($0.id) }
                .compactMap { dto -> (date: Date, item: HomeAgendaItem)? in
                    guard let date = HomeAgendaBuilder.parseInstant(dto.startAt) else { return nil }
                    guard date >= cal.startOfDay(for: nowDate) else { return nil }
                    return (date, HomeAgendaBuilder.item(from: dto, start: date, members: members, calendar: cal))
                }
                .sorted { $0.date < $1.date }
                .map(\.item)
        } else {
            assignments = []
        }

        if assignments.isEmpty {
            agendaSections = HomeAgendaBuilder.sections(
                events: events,
                members: members,
                now: nowDate,
                calendar: cal,
                timeZone: timeZone,
                selectedIsoDate: nil
            )
        } else {
            // Pin assignments; the rest reads as one read-only section.
            let restSections = HomeAgendaBuilder.sections(
                events: events.filter { !mineIds.contains($0.id) },
                members: members,
                now: nowDate,
                calendar: cal,
                timeZone: timeZone,
                selectedIsoDate: nil
            )
            let restItems = restSections.flatMap(\.items)
            agendaSections = restItems.isEmpty
                ? []
                : [HomeAgendaSection(id: "rest", header: "Rest of the schedule", items: restItems)]
        }
    }

    private func isMine(_ dto: CalendarEventDTO) -> Bool {
        guard let me = resolvedUserId else { return false }
        return (dto.assignedTo ?? []).contains(me)
    }

    // MARK: - Helpers

    static func memberLookup(from occupants: [OccupantDTO], currentUserId: String?) -> [String: HomeMember] {
        var lookup: [String: HomeMember] = [:]
        for occupant in occupants where occupant.isActive {
            let trimmed = occupant.displayName?.trimmingCharacters(in: .whitespaces) ?? ""
            let name = trimmed.isEmpty ? (occupant.username ?? "Member") : trimmed
            lookup[occupant.userId] = HomeMember(
                id: occupant.userId,
                name: name,
                isYou: occupant.userId == currentUserId
            )
        }
        return lookup
    }

    static func signedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.id
        }
        return nil
    }

    static var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC") ?? .current
        cal.firstWeekday = 1
        return cal
    }
}
