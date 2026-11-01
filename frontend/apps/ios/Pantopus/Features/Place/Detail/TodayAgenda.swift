//
//  TodayAgenda.swift
//  Pantopus
//
//  "Coming up at home" (the November 2026 redesign): one list for the next
//  seven days, soonest first, built on the phone from what Today already
//  loads. The address calendar's dates (pickups, tax dates, meetings,
//  hearings), the ballot's milestones, the household's tasks due in the
//  window (household members only) and, with `plans` on, the plans the
//  person hosts or is going to. Each row says whose it is and opens in place
//  to its original details, source and actions. The two-week calendar stays
//  one tap away. Parity twin of Android `TodayAgenda.kt`.
//

import SwiftUI

// MARK: - The row model

struct TodayAgendaItem: Identifiable, Equatable {
    /// Same-day order: timed items by time, then deadlines, then routine pickups.
    enum Kind: Int, Comparable {
        case timed = 0
        case deadline = 1
        case routine = 2

        static func < (lhs: Kind, rhs: Kind) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    /// Whose date this is.
    enum Owner: String {
        case address = "For this address"
        case household = "Your household"
        /// The household's pickup day as a guest sees it.
        case home = "This home's pickup day"
        case plan = "Your plan"
        case going = "Going"
    }

    enum Action: Equatable {
        case editPickup
        case link(title: String, url: URL)
        case governments
        case openBallot
        case openTask(homeId: String, taskId: String)
        case openPlan(id: String)
    }

    let id: String
    /// The home's calendar day, "2026-11-03".
    let day: String
    let time: Date?
    let kind: Kind
    let icon: PantopusIcon
    let title: String
    let subtitle: String
    let owner: Owner
    let details: [String]
    let source: String?
    let actions: [Action]
}

// MARK: - What the agenda loads beyond the place

/// The household's tasks (household members only; a refusal shows none and
/// no error) and, with `plans` on, the plans the person hosts or is going
/// to. The address calendar and the ballot come with the place itself.
@Observable
@MainActor
final class TodayAgendaModel {
    private(set) var tasks: [HomeTaskDTO] = []
    private(set) var hosting: [PlanCardDTO] = []
    private(set) var going: [PlanCardDTO] = []
    private var access: HomeTaskAccess?

    func load(homeId: String?, plans: Bool, force: Bool = false) async {
        await loadPlans(plans && PlansFlags.shared.plans, force: force)
        await loadTasks(homeId)
    }

    private func loadPlans(_ on: Bool, force: Bool) async {
        guard on else {
            hosting = []
            going = []
            return
        }
        if !force, let copy = PlansStoreReads.peekMine() { apply(copy) }
        if let snapshot = try? await PlansStoreReads.mine(force: force) { apply(snapshot.value) }
    }

    private func apply(_ mine: MyPlansResponse) {
        hosting = mine.hosting
        going = mine.going
    }

    private func loadTasks(_ homeId: String?) async {
        guard let homeId else {
            tasks = []
            access = nil
            return
        }
        if access?.homeId != homeId || access?.isCurrent != true {
            tasks = []
            access = HomeTaskAccess(homeId: homeId)
        }
        guard let access else { return }
        do {
            tasks = try await access.list().tasks
        } catch is CancellationError {
            return
        } catch {
            // No task rows for someone who can't read them; a failed re-read keeps what shows.
            if case .forbidden = error as? APIError { tasks = [] }
        }
    }
}

// MARK: - Building the list

enum TodayAgenda {
    static let windowDays = 7

    struct Inputs {
        var today: String
        var events: [PlaceCalendarEvent] = []
        /// The household can change this home's pickup schedule.
        var household = false
        /// A guest sees the household's dates as the home's, not theirs.
        var guest = false
        var ballot: BallotSummary?
        /// The election's name and date ("November 3 general election", "2026-11-03").
        var election: PlaceCivicElectionData?
        var canOpenBallot = false
        var tasks: [HomeTaskDTO] = []
        var homeId: String?
        var hosting: [PlanCardDTO] = []
        var going: [PlanCardDTO] = []
        var calendar: Calendar
    }

    /// The rows inside the window, in order.
    static func items(_ inputs: Inputs) -> [TodayAgendaItem] {
        all(inputs).filter { offset($0.day, from: inputs.today) < windowDays }
    }

    /// The first row after the window, for an empty week.
    static func next(_ inputs: Inputs) -> TodayAgendaItem? {
        all(inputs).first { offset($0.day, from: inputs.today) >= windowDays }
    }

    private static func all(_ inputs: Inputs) -> [TodayAgendaItem] {
        let ballotRows = ballotItems(inputs)
        let ballotDays = Set(ballotRows.map(\.day))
        // The calendar's election date and the ballot's milestone are the same day: keep the ballot's, with its tools.
        let events = inputs.events.filter { !($0.kind.contains("election") && ballotDays.contains(String($0.date.prefix(10)))) }
        let rows = events.map { eventItem($0, inputs: inputs) } + ballotRows + taskItems(inputs) + planItems(inputs)
        var seen = Set<String>()
        return rows
            .filter { offset($0.day, from: inputs.today) >= 0 && seen.insert($0.id).inserted }
            .sorted { lhs, rhs in
                if lhs.day != rhs.day { return lhs.day < rhs.day }
                if lhs.kind != rhs.kind { return lhs.kind < rhs.kind }
                if let left = lhs.time, let right = rhs.time, left != right { return left < right }
                return lhs.title < rhs.title
            }
    }

    // MARK: Sources

    private static let pickupKinds: Set<String> = ["garbage", "recycling", "yard_waste", "bulk_pickup", "street_sweeping"]

    private static func eventItem(_ event: PlaceCalendarEvent, inputs: Inputs) -> TodayAgendaItem {
        let day = String(event.date.prefix(10))
        let pickup = pickupKinds.contains(event.kind)
        var details: [String] = []
        if let detail = event.detail, !detail.isEmpty { details.append(detail) }
        if let moved = event.holidayMoveLine { details.append(moved) }
        var actions: [TodayAgendaItem.Action] = []
        if pickup, inputs.household { actions.append(.editPickup) }
        if let raw = event.sourceUrl, let url = URL(string: raw), url.scheme?.hasPrefix("http") == true {
            actions.append(.link(title: "Open the source", url: url))
        }
        return TodayAgendaItem(
            id: "calendar:\(event.id)",
            day: day,
            time: nil,
            kind: pickup ? .routine : .deadline,
            icon: icon(event.kind),
            title: event.title,
            subtitle: relative(day, inputs: inputs),
            owner: event.isHousehold ? (inputs.guest ? .home : .household) : .address,
            details: details,
            source: (event.source ?? "Pantopus registry") + (event.confidence == "unverified" ? " · unconfirmed, please double-check" : ""),
            actions: actions
        )
    }

    /// Election day (with that day's deadlines in its details) and the next
    /// deadline before it, each with the ballot's official tools.
    private static func ballotItems(_ inputs: Inputs) -> [TodayAgendaItem] {
        guard let card = inputs.ballot else { return [] }
        var actions = card.officialLinks.compactMap { link -> TodayAgendaItem.Action? in
            URL(string: link.url).map { .link(title: link.label, url: $0) }
        }
        if card.governments != nil { actions.append(.governments) }
        if inputs.canOpenBallot { actions.append(.openBallot) }
        let deadlines = card.deadlines.sorted { $0.date < $1.date }
        let electionDay = inputs.election.map { String($0.date.prefix(10)) }
        var rows: [TodayAgendaItem] = []
        if let election = inputs.election, let day = electionDay {
            let sameDay = deadlines.filter { String($0.date.prefix(10)) == day }
            rows.append(TodayAgendaItem(
                id: "ballot:election",
                day: day,
                time: nil,
                kind: .deadline,
                icon: .vote,
                title: election.name,
                subtitle: [relative(day, inputs: inputs), "Election day"].joined(separator: " · "),
                owner: .address,
                details: sameDay.map { deadlineLine($0) } + [card.line].compactMap { $0 },
                source: card.sourceLine,
                actions: actions
            ))
        }
        if let next = deadlines.first(where: { String($0.date.prefix(10)) != electionDay }) {
            let day = String(next.date.prefix(10))
            rows.append(TodayAgendaItem(
                id: "ballot:\(next.key)",
                day: day,
                time: nil,
                kind: .deadline,
                icon: .vote,
                title: next.label,
                subtitle: [relative(day, inputs: inputs), inputs.election?.name ?? card.title].joined(separator: " · "),
                owner: .address,
                details: [next.detail].compactMap { $0 }.filter { !$0.isEmpty },
                source: card.sourceLine,
                actions: actions
            ))
        }
        return rows
    }

    /// "By 8 p.m.: Drop box by 8 p.m. A mailed ballot needs a Nov 3 postmark."
    private static func deadlineLine(_ deadline: BallotDeadline) -> String {
        guard let detail = deadline.detail, !detail.isEmpty else { return deadline.label }
        return "\(deadline.label): \(detail)"
    }

    private static func taskItems(_ inputs: Inputs) -> [TodayAgendaItem] {
        guard let homeId = inputs.homeId else { return [] }
        return inputs.tasks.compactMap { task -> TodayAgendaItem? in
            guard ["open", "in_progress"].contains(task.status),
                  let due = PlacePresentation.parseISO(task.dueAt) ?? RadonToday.date(task.dueAt) else { return nil }
            let day = SkyNote.dayKey(due, calendar: inputs.calendar)
            let time = TodayClock.time(due, calendar: inputs.calendar)
            return TodayAgendaItem(
                id: "task:\(task.id)",
                day: day,
                time: due,
                kind: .timed,
                icon: .listChecks,
                title: task.title,
                subtitle: [relative(day, inputs: inputs), "due \(time)"].joined(separator: " · "),
                owner: .household,
                details: [task.description].compactMap { $0 }.filter { !$0.isEmpty },
                source: task.status == "in_progress" ? "Household task · in progress" : "Household task",
                actions: [.openTask(homeId: homeId, taskId: task.id)]
            )
        }
    }

    private static func planItems(_ inputs: Inputs) -> [TodayAgendaItem] {
        let hosting = inputs.hosting.map { ($0, true) }
        let going = inputs.going.map { ($0, false) }
        return (hosting + going).compactMap { card, hosts -> TodayAgendaItem? in
            guard card.state == .upcoming || card.state == .live else { return nil }
            let start = card.startsAtDate
            // A plan whose time isn't set yet shows its date alone.
            guard let day = start.map({ SkyNote.dayKey($0, calendar: inputs.calendar) }) ?? card.startsOn else { return nil }
            let when = card.state == .live ? "happening now" : start.map { TodayClock.time($0, calendar: inputs.calendar) }
            let people = hosts ? "\(card.goingCount) coming" : "Hosted by \(PlanCardLines.firstName(card.host.displayName))"
            return TodayAgendaItem(
                id: "plan:\(card.id)",
                day: String(day.prefix(10)),
                time: start,
                kind: start == nil ? .deadline : .timed,
                icon: .calendarDays,
                title: card.title,
                subtitle: [relative(String(day.prefix(10)), inputs: inputs), when, hosts ? "you're hosting" : "you're going"]
                    .compactMap { $0 }
                    .joined(separator: " · "),
                owner: hosts ? .plan : .going,
                details: [people, card.area.label].filter { !$0.isEmpty },
                source: "Plans",
                actions: [.openPlan(id: card.id)]
            )
        }
    }

    // MARK: Helpers

    static func icon(_ kind: String) -> PantopusIcon {
        switch kind {
        case "garbage", "recycling", "yard_waste", "bulk_pickup", "street_sweeping": .trash
        case "property_tax", "utility_bill": .receipt
        case "council", "school": .landmark
        case "permit_hearing", "election_deadline": .gavel
        default: .calendarDays
        }
    }

    /// Days from `today` to `day` (both "YYYY-MM-DD"), counted on dates alone.
    static func offset(_ day: String, from today: String) -> Int {
        guard let start = PlacePresentation.parseCalendarDay(today), let end = PlacePresentation.parseCalendarDay(day) else { return .max }
        return Int((end.timeIntervalSince(start) / 86400).rounded())
    }

    /// "Today", "Tomorrow", the weekday this week ("Wednesday"), else the date ("Tue, Nov 10").
    static func relative(_ day: String, inputs: Inputs) -> String {
        let utc = TimeZone(identifier: "UTC") ?? .current
        let days = offset(day, from: inputs.today)
        switch days {
        case 0: return "Today"
        case 1: return "Tomorrow"
        default:
            guard let date = PlacePresentation.parseCalendarDay(day) else { return day }
            if days >= windowDays { return date.formatted(Date.FormatStyle(timeZone: utc).weekday(.abbreviated).month(.abbreviated).day()) }
            return date.formatted(Date.FormatStyle(timeZone: utc).weekday(.wide))
        }
    }
}
