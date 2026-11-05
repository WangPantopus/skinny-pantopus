//
//  CrewDayCrewDayViewModel.swift
//  Pantopus
//
//  15. The crew's day, before it (build kit 01-spec.md, board
//  `CrewDayPrep`): `GET /api/crew-days/:id/crew`, sending a draft or a
//  declined day to Pantopus, and the actions the later server slices add.
//

import Foundation

@Observable
@MainActor
final class CrewDayCrewDayViewModel {
    let crewDayId: String
    private(set) var state: CrewDayLoad<CrewDayCrewDayDTO> = .loading
    private(set) var working = false
    var actionError: String?
    /// A short confirmation under the page ("Sent to Pantopus.").
    var notice: String?

    init(crewDayId: String) {
        self.crewDayId = crewDayId
    }

    var day: CrewDayCrewDayDTO? {
        state.value
    }

    func load() async {
        do {
            let day: CrewDayCrewDayDTO = try await APIClient.shared.request(CrewDayEndpoints.crewDay(crewDayId: crewDayId))
            state = .loaded(day)
        } catch {
            if state.value == nil { state = .failed(CrewDayErrors.sentence(for: error)) }
        }
    }

    /// A draft or a declined day goes to Pantopus for approval.
    func submit() async {
        await write(notice: "Sent to Pantopus. We'll tell you within a business day.") {
            try await APIClient.shared.request(CrewDayEndpoints.submit(crewDayId: self.crewDayId))
        }
    }

    /// Cancels the day for every home; nobody is charged.
    func cancel(reason: String) async {
        await write(notice: "Cancelled. Every home was told, and nobody was charged.") {
            try await APIClient.shared.request(CrewDayEndpoints.cancelDay(crewDayId: self.crewDayId, reason: reason))
        }
    }

    private func write(notice: String, _ call: @escaping () async throws -> CrewDayWriteResponse) async {
        guard !working else { return }
        working = true
        actionError = nil
        defer { working = false }
        do {
            let response = try await call()
            state = .loaded(response.crewDay)
            self.notice = notice
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
            await load()
        } catch {
            actionError = CrewDayErrors.sentence(for: error)
        }
    }
}
