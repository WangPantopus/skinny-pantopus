//
//  CrewDayCrewDayViewModel.swift
//  Pantopus
//
//  15. The crew's day (build kit 01-spec.md, boards `CrewDayPrep`,
//  `DatesAnswers`, `AfterDay`): `GET /api/crew-days/:id/crew`, sending a
//  draft or a declined day to Pantopus, price checks (Set price, Can't take
//  it), release asks, inviting past customers and cancelling the day.
//

import Foundation

@Observable
@MainActor
final class CrewDayCrewDayViewModel {
    let crewDayId: String
    private(set) var state: CrewDayLoad<CrewDayCrewPageDTO> = .loading
    private(set) var working = false
    var actionError: String?
    /// A short confirmation under the page ("Sent to Pantopus.").
    var notice: String?

    init(crewDayId: String) {
        self.crewDayId = crewDayId
    }

    var page: CrewDayCrewPageDTO? {
        state.value
    }

    var day: CrewDayCrewDayDTO? {
        state.value?.day
    }

    func load() async {
        do {
            let page: CrewDayCrewPageDTO = try await APIClient.shared.request(CrewDayEndpoints.crewDay(crewDayId: crewDayId))
            state = .loaded(page)
        } catch {
            if state.value == nil { state = .failed(CrewDayErrors.sentence(for: error)) }
        }
    }

    /// A draft or a declined day goes to Pantopus for approval.
    func submit() async {
        await write(notice: "Sent to Pantopus. We'll tell you within a business day.") {
            _ = try await APIClient.shared.request(CrewDayEndpoints.submit(crewDayId: self.crewDayId), as: CrewDayWriteResponse.self)
        }
    }

    /// Cancels the day for every home; nobody is charged.
    func cancel(reason: String) async {
        await write(notice: "Cancelled. Every home was told, and nobody was charged.") {
            _ = try await APIClient.shared.request(
                CrewDayEndpoints.cancelDay(crewDayId: self.crewDayId, reason: reason),
                as: CrewDayWriteResponse.self
            )
        }
    }

    /// The crew's price for a look-first home; the household approves it before it's booked.
    func setPrice(_ home: CrewDayHomeDTO, cents: Int) async -> Bool {
        await write(notice: "Sent. The household approves \(CrewDayFormat.price(cents)) before it's booked.") {
            _ = try await APIClient.shared.request(
                CrewDayEndpoints.setPrice(crewDayId: self.crewDayId, bookingId: home.id, CrewDaySetPriceBody(priceCents: cents)),
                as: CrewDayHomeWriteResponse.self
            )
        }
    }

    /// The crew can't take a look-first home: it ends at no charge, with a note to the household.
    func cantTake(_ home: CrewDayHomeDTO, note: String) async -> Bool {
        await write(notice: "We told the household. Nothing was charged.") {
            _ = try await APIClient.shared.request(
                CrewDayEndpoints.setPrice(crewDayId: self.crewDayId, bookingId: home.id, CrewDaySetPriceBody(decline: true, note: note)),
                as: CrewDayHomeWriteResponse.self
            )
        }
    }

    /// A home released at no charge (the household's ask, or the crew's own call).
    func release(_ home: CrewDayHomeDTO) async {
        await write(notice: "Released at no charge. We told the household.") {
            _ = try await APIClient.shared.request(
                CrewDayEndpoints.release(crewDayId: self.crewDayId, bookingId: home.id),
                as: CrewDayHomeWriteResponse.self
            )
        }
    }

    /// Invites households this business served nearby, once each.
    func invitePast() async {
        var invited = 0
        await write(notice: nil) {
            let response: CrewDayInvitedResponse = try await APIClient.shared
                .request(CrewDayEndpoints.invitePast(crewDayId: self.crewDayId))
            invited = response.invited
        }
        if actionError == nil {
            notice = invited == 0 ? "Everyone nearby is already invited." : "Invited \(CrewDayFormat.homes(invited))."
        }
    }

    @discardableResult
    private func write(notice: String?, _ call: @escaping () async throws -> Void) async -> Bool {
        guard !working else { return false }
        working = true
        actionError = nil
        defer { working = false }
        do {
            try await call()
            if let notice { self.notice = notice }
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
            await load()
            return true
        } catch {
            actionError = CrewDayErrors.sentence(for: error)
            return false
        }
    }
}
