//
//  CrewDayRouteViewModel.swift
//  Pantopus
//
//  16. The route (build kit 01-spec.md, board `Route`): the homes on one
//  date in the crew's order (`GET /api/crew-days/:id/route?date=`), the
//  crew's new order, On my way for the next home, and Running late.
//

import Foundation

@Observable
@MainActor
final class CrewDayRouteViewModel {
    let crewDayId: String
    private(set) var state: CrewDayLoad<CrewDayRouteDTO> = .loading
    /// The date shown (nil: the server's first date from today).
    private(set) var date: String?
    private(set) var working = false
    var actionError: String?
    var notice: String?
    /// Reordering: the homes in the order the crew is arranging them.
    var arranging: [CrewDayHomeDTO]?

    init(crewDayId: String, date: String? = nil) {
        self.crewDayId = crewDayId
        self.date = date
    }

    var route: CrewDayRouteDTO? {
        state.value
    }

    func load() async {
        do {
            let route: CrewDayRouteDTO = try await APIClient.shared.request(CrewDayEndpoints.route(crewDayId: crewDayId, date: date))
            state = .loaded(route)
            date = route.date
        } catch {
            if state.value == nil { state = .failed(CrewDayErrors.sentence(for: error)) }
        }
    }

    func show(date: String) async {
        guard date != self.date else { return }
        self.date = date
        arranging = nil
        await load()
    }

    /// The home the crew goes to next: the first one still waiting.
    var nextHome: CrewDayHomeDTO? {
        route?.homes.first { $0.status == "booked" && $0.cantGetInAt == nil }
    }

    /// Homes a "Running late" moves: every one still booked or on the way.
    var lateHomes: [CrewDayHomeDTO] {
        route?.homes.filter { ["booked", "on_the_way"].contains($0.status) } ?? []
    }

    // MARK: - Writes

    /// "On my way": the household is told this window.
    func onMyWay(_ home: CrewDayHomeDTO, start: Date, end: Date) async -> Bool {
        let who = CrewDayRouteCopy.who(home)
        return await run(done: "We told \(who) you're on the way.") {
            _ = try await APIClient.shared.request(
                CrewDayEndpoints.onTheWay(bookingId: home.id, etaStart: CrewDayFormat.iso(start), etaEnd: CrewDayFormat.iso(end)),
                as: CrewDayHomeWriteResponse.self
            )
        }
    }

    func runningLate(minutes: Int) async -> Bool {
        let count = lateHomes.count
        return await run(done: "We told \(CrewDayFormat.homes(count)) the new time.") {
            let response: CrewDayRunningLateResponse = try await APIClient.shared.request(
                CrewDayEndpoints.runningLate(crewDayId: self.crewDayId, minutes: minutes, date: self.date)
            )
            if let route = response.route { self.state = .loaded(route) }
        }
    }

    func startArranging() {
        arranging = route?.homes
    }

    func move(_ home: CrewDayHomeDTO, by offset: Int) {
        guard var list = arranging, let index = list.firstIndex(where: { $0.id == home.id }) else { return }
        let target = index + offset
        guard list.indices.contains(target) else { return }
        list.swapAt(index, target)
        arranging = list
    }

    func saveOrder() async {
        guard let list = arranging else { return }
        _ = await run(done: "Route order saved.") {
            let route: CrewDayRouteDTO = try await APIClient.shared.request(
                CrewDayEndpoints.routeOrder(crewDayId: self.crewDayId, bookingIds: list.map(\.id))
            )
            self.state = .loaded(route)
            self.arranging = nil
        }
    }

    private func run(done: String, _ call: @escaping () async throws -> Void) async -> Bool {
        guard !working else { return false }
        working = true
        actionError = nil
        defer { working = false }
        do {
            try await call()
            notice = done
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
            await load()
            return true
        } catch {
            actionError = CrewDayErrors.sentence(for: error)
            return false
        }
    }
}

/// The route's words: who a home is, its status line, and the windows.
enum CrewDayRouteCopy {
    /// "Riley", or "Home 4" outside the job window.
    static func who(_ home: CrewDayHomeDTO) -> String {
        home.firstName ?? home.label
    }

    /// "123 Maple Lane", or "Home 3".
    static func place(_ home: CrewDayHomeDTO) -> String {
        home.address?.line ?? home.label
    }

    /// "123 Maple Lane · Alex".
    static func title(_ home: CrewDayHomeDTO) -> String {
        [home.address?.line, home.firstName].compactMap { $0 }.joined(separator: " · ").nonEmpty ?? home.label
    }

    enum Tone { case done, onTheWay, waiting, cantGetIn, ended }

    static func tone(_ home: CrewDayHomeDTO) -> Tone {
        if ["done", "paid", "payment_failed", "refunded"].contains(home.status) { return .done }
        if ["cancelled", "declined"].contains(home.status) { return .ended }
        if home.status == "on_the_way" { return .onTheWay }
        if home.cantGetInAt != nil { return .cantGetIn }
        return .waiting
    }

    /// "Done 9:48 AM · 3 photos", "On the way · told 10–11 AM", "Can't get in · 9:30 AM", "Waiting".
    static func status(_ home: CrewDayHomeDTO, timezone: String?) -> String {
        switch tone(home) {
        case .done:
            let at = CrewDayFormat.time(CrewDayFormat.instant(home.doneAt), timezone: timezone)
            let photos = home.photoCount == 1 ? "1 photo" : "\(home.photoCount) photos"
            return ["Done \(at)".trimmingCharacters(in: .whitespaces), home.photoCount > 0 ? photos : nil]
                .compactMap { $0 }
                .joined(separator: " · ")
        case .onTheWay:
            let told = CrewDayFormat.window(
                from: CrewDayFormat.instant(home.eta?.start),
                to: CrewDayFormat.instant(home.eta?.end),
                timezone: timezone
            )
            return told.isEmpty ? "On the way" : "On the way · told \(told)"
        case .cantGetIn:
            return "Can't get in · \(CrewDayFormat.time(CrewDayFormat.instant(home.cantGetInAt), timezone: timezone))"
        case .ended:
            return "Cancelled"
        case .waiting:
            return waitingWords[home.status] ?? "Waiting"
        }
    }

    private static let waitingWords = [
        "new_dates": "Picking a new date",
        "price_pending": "Waiting for your price",
        "price_offered": "Price sent · waiting for the household"
    ]

    /// The first line of the access note.
    static func noteLine(_ home: CrewDayHomeDTO) -> String? {
        home.accessNote?.split(whereSeparator: \.isNewline).first.map(String.init)
    }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
