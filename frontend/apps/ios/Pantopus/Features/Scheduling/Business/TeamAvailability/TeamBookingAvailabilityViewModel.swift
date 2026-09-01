//
//  TeamBookingAvailabilityViewModel.swift
//  Pantopus
//
//  G3 Team Booking Availability (Stream I13). Business-only section: which team
//  members are bookable and the hours feeding round-robin. Roster names/avatars
//  come from `GET /api/businesses/:id/members`; per-member bookability +
//  week coverage are derived from `GET /team-availability` (members + free
//  grids). Admin gating from `GET /api/businesses/:id/me`. Matches
//  `teamavail-frames.jsx` (default / loading / not-bookable / gaps / gated).
//
//  Honest backend mapping (flagged in the PR):
//   • `team-availability` returns only member ids + free slots — there is no
//     per-member "bookable" WRITE and no configured-hours summary, and
//     `/availability` is self-scoped. So bookability is DERIVED from whether a
//     member has openings this week, and tapping a row opens G4 (editable for
//     yourself, read-only for teammates) per the stream's scope correction.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class TeamBookingAvailabilityViewModel {
    struct MemberRow: Identifiable, Hashable {
        let id: String // user id
        let name: String
        let title: String?
        let avatarURL: String?
        let bookable: Bool
        let summary: String
        let isSelf: Bool
        /// Drives the hours-source chip ("Personal hours" / "Business hours").
        /// The roster + `team-availability` reads expose no per-member hours
        /// source, so this defaults to the system behaviour the explainer states
        /// ("Bookings use each member's personal availability"). Per-member
        /// personal-vs-business discrimination is deferred to the backend.
        let usesPersonalHours: Bool
    }

    enum Coverage: Equatable {
        case ok(String)
        case warning(String)
    }

    enum Phase: Equatable { case loading, loaded, empty, businessOnly, error(String) }

    /// Local sheet target for G4 (member hours).
    struct MemberSheetTarget: Identifiable, Hashable {
        let id: String
        let name: String
        let isSelf: Bool
    }

    /// Local sheet target for G1/G2 (assignment), reached from the assignment picker.
    struct AssignmentTarget: Identifiable, Hashable {
        let id: String // event type id
        let name: String
        let collective: Bool
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    let tz: String
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private var currentUserId: String?

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var rows: [MemberRow] = []
    private(set) var coverage: Coverage?
    private(set) var access: BusinessTeamAccessDTO?
    private(set) var eventTypes: [EventTypeDTO] = []

    var memberSheet: MemberSheetTarget?
    var showAssignmentPicker = false
    var assignmentTarget: AssignmentTarget?

    // MARK: Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    var canManage: Bool {
        guard let access else { return true }
        return access.isOwner == true || access.permissions.contains("team.manage")
    }

    var isGated: Bool {
        access != nil && !canManage
    }

    /// Whether the assignment entry (G1/G2) should be offered.
    var hasAssignableServices: Bool {
        !eventTypes.isEmpty
    }

    init(
        owner: SchedulingOwner,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.tz = tz
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        if case let .signedIn(user) = AuthManager.shared.state { currentUserId = user.id }
        guard let businessId = owner.businessIdValue else {
            phase = .businessOnly
            return
        }
        do {
            let membersResult: BusinessTeamMembersResponse = try await client.request(
                BusinessTeamEndpoints.members(businessId: businessId)
            )
            let members = membersResult.members

            let window = Self.weekWindow(tz: tz)
            async let freeR: MemberFreeResponse? = try? client.request(
                SchedulingEndpoints.teamAvailability(owner: owner, from: window.fromISO, to: window.toISO, tz: tz)
            )
            async let accessR: BusinessTeamAccessDTO? = try? client.request(
                BusinessTeamEndpoints.access(businessId: businessId)
            )
            async let typesR: EventTypesResponse? = try? client.request(SchedulingEndpoints.getEventTypes(owner: owner))

            let free = await freeR
            access = await accessR
            eventTypes = await (typesR)?.eventTypes ?? []

            let freeByMember = free?.freeByMember ?? [:]
            rows = members.compactMap { member in
                guard let user = member.user else { return nil }
                let slots = freeByMember[user.id] ?? []
                let dayCount = Self.distinctDayCount(slots, tz: tz)
                let bookable = dayCount > 0
                let name = user.name ?? user.username ?? "Member"
                return MemberRow(
                    id: user.id,
                    name: name,
                    title: member.title ?? member.roleBase?.capitalized,
                    avatarURL: user.profilePictureUrl,
                    bookable: bookable,
                    summary: bookable ? "Open \(dayCount) day\(dayCount == 1 ? "" : "s") this week" : "Not taking bookings",
                    isSelf: currentUserId != nil && user.id == currentUserId,
                    usesPersonalHours: true
                )
            }
            coverage = Self.coverage(window: window, freeByMember: freeByMember, tz: tz)
            phase = rows.isEmpty ? .empty : .loaded
        } catch let error as SchedulingError {
            if error.code == "BUSINESS_ONLY" { phase = .businessOnly
                return
            }
            phase = .error(error.userMessage ?? "Couldn't load your team.")
        } catch {
            phase = .error("Couldn't load your team.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Navigation / presentation

    func tapMember(_ row: MemberRow) {
        memberSheet = MemberSheetTarget(id: row.id, name: row.name, isSelf: row.isSelf)
    }

    func openAssignmentPicker() {
        showAssignmentPicker = true
    }

    func chooseAssignment(_ eventType: EventTypeDTO) {
        showAssignmentPicker = false
        assignmentTarget = AssignmentTarget(
            id: eventType.id,
            name: eventType.name,
            collective: eventType.assignmentMode == "collective"
        )
    }

    // MARK: Derivations

    private struct Window {
        let fromISO: String
        let toISO: String
        let days: [String] // YYYY-MM-DD, rendered in the requested `tz`
    }

    /// Calendar pinned to the requested `tz` — window day keys must share one
    /// zone with the slots' `startLocal` (rendered server-side in that tz), or
    /// the window's edge day can never be covered (e.g. UTC is already
    /// "tomorrow" after 5 PM in America/Los_Angeles → spurious "no coverage").
    private static func tzCalendar(_ tz: String) -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz) ?? .current
        return cal
    }

    private static func ymd(_ date: Date, _ cal: Calendar) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    private static func weekWindow(tz: String) -> Window {
        let cal = tzCalendar(tz)
        let start = cal.startOfDay(for: Date())
        let days = (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
        let iso = ISO8601DateFormatter() // local instance — no shared state
        let from = iso.string(from: start)
        let to = iso.string(from: cal.date(byAdding: .day, value: 7, to: start) ?? start)
        return Window(fromISO: from, toISO: to, days: days.map { ymd($0, cal) })
    }

    /// Day key (YYYY-MM-DD in `tz`) for one slot: `startLocal` is already
    /// rendered in the requested tz; convert the UTC `start` when it's absent.
    private static func slotDayKey(_ slot: SlotDTO, tz: String) -> String? {
        if let local = slot.startLocal { return String(local.prefix(10)) }
        guard let date = SchedulingTime.parseUTC(slot.start) else { return nil }
        return ymd(date, tzCalendar(tz))
    }

    private static func distinctDayCount(_ slots: [SlotDTO], tz: String) -> Int {
        Set(slots.compactMap { slotDayKey($0, tz: tz) }).count
    }

    private static func coverage(window: Window, freeByMember: [String: [SlotDTO]], tz: String) -> Coverage? {
        guard !freeByMember.isEmpty else { return nil }
        let coveredDays = Set(freeByMember.values.flatMap { $0 }.compactMap { slotDayKey($0, tz: tz) })
        let uncovered = window.days.filter { !coveredDays.contains($0) }
        guard !uncovered.isEmpty else {
            return .ok("Your team has open hours every day this week.")
        }
        let cal = tzCalendar(tz)
        let names: [(weekday: Int, name: String)] = uncovered.compactMap { day in
            guard let weekday = Self.weekday(fromYMD: day, cal) else { return nil }
            return (weekday, Self.weekdayPlural(weekday))
        }
        let unique = Array(Set(names.map(\.name))).sorted()
        let label = unique.prefix(2).joined(separator: " & ")
        // Weekday gaps (Mon–Fri) read as a warning; weekend-only gaps are neutral.
        let hasWeekdayGap = names.contains { $0.weekday >= 2 && $0.weekday <= 6 }
        if hasWeekdayGap {
            return .warning("\(label) have no coverage — add hours for at least one member.")
        }
        return .ok("No one is available \(label).")
    }

    /// Weekday (1=Sun…7=Sat) for a `YYYY-MM-DD` string, parsed without a shared formatter.
    private static func weekday(fromYMD ymd: String, _ cal: Calendar) -> Int? {
        let parts = ymd.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var comps = DateComponents()
        comps.year = parts[0]
        comps.month = parts[1]
        comps.day = parts[2]
        guard let date = cal.date(from: comps) else { return nil }
        return cal.component(.weekday, from: date)
    }

    private static func weekdayPlural(_ weekday: Int) -> String {
        switch weekday {
        case 1: "Sundays"
        case 2: "Mondays"
        case 3: "Tuesdays"
        case 4: "Wednesdays"
        case 5: "Thursdays"
        case 6: "Fridays"
        default: "Saturdays"
        }
    }
}
