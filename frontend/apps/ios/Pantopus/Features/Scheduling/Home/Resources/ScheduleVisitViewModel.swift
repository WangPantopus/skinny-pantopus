//
//  ScheduleVisitViewModel.swift
//  Pantopus
//
//  Stream I12 — F13 Schedule a Visit (vendor/guest). Contract-first: collects a
//  concrete visit (type, who must be home, date + time + length, entry note)
//  and creates it via `POST …/scheduling/visits` (stored as a HomeCalendarEvent;
//  the assigned members count as busy). The design's offer-slots / shareable
//  link engine has no v1 backend, so it is intentionally out of scope here.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class ScheduleVisitViewModel {
    enum LoadState: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    // MARK: Fields

    var title: String = ""
    var kind: VisitKind = .vendor
    var whoIsHome: Set<String> = []
    var date: Date = Calendar.current.startOfDay(for: Date())
    var startTime: Date = ScheduleVisitViewModel.defaultStart()
    var durationHours: Int = 1
    var entryNote: String = ""

    // MARK: State

    private(set) var loadState: LoadState = .loading
    private(set) var members: [ResourceHomeMember] = []
    private(set) var isSaving = false
    var saveError: String?
    /// Set true once the user attempts to commit, so inline errors appear.
    private(set) var didAttemptSave = false

    // MARK: Dependencies

    let homeId: String
    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    init(
        homeId: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient = .shared
    ) {
        self.homeId = homeId
        self.push = push
        self.client = client
    }

    private var owner: SchedulingOwner {
        .home(homeId: homeId)
    }

    // MARK: Load (member roster)

    func load() async {
        if case .ready = loadState { return }
        loadState = .loading
        do {
            let response: OccupantsResponse = try await client.request(
                HomesEndpoints.listOccupants(homeId: homeId)
            )
            members = ResourceHomeMember.from(occupants: response.occupants)
            loadState = .ready
        } catch let error as SchedulingError {
            loadState = .error(message: error.userMessage ?? "Couldn't load your household.")
        } catch {
            loadState = .error(message: "Couldn't load your household.")
        }
    }

    // MARK: Editing

    func toggleHost(_ id: String) {
        if whoIsHome.contains(id) { whoIsHome.remove(id) } else { whoIsHome.insert(id) }
    }

    // MARK: Validation

    var titleError: String? {
        guard didAttemptSave else { return nil }
        return title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Give this visit a title" : nil
    }

    var hostError: String? {
        guard didAttemptSave else { return nil }
        return whoIsHome.isEmpty ? "Pick at least one host who must be home" : nil
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !whoIsHome.isEmpty
            && durationHours > 0
    }

    var isDirty: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !whoIsHome.isEmpty
    }

    // MARK: Save

    /// Combine the chosen day + start time into a UTC instant.
    private var startInstant: Date? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        let time = cal.dateComponents([.hour, .minute], from: startTime)
        return cal.date(bySettingHour: time.hour ?? 9, minute: time.minute ?? 0, second: 0, of: date)
    }

    func save() async -> Bool {
        didAttemptSave = true
        guard isValid, !isSaving, let start = startInstant else { return false }
        isSaving = true
        defer { isSaving = false }
        let end = start.addingTimeInterval(TimeInterval(durationHours * 3600))
        let note = entryNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = CreateVisitRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            startAt: ResourceTime.utcISO(start),
            endAt: ResourceTime.utcISO(end),
            visitType: kind.rawValue,
            whoIsHome: Array(whoIsHome),
            locationNotes: note.isEmpty ? nil : note
        )
        do {
            let response: VisitResponse = try await client.request(
                SchedulingEndpoints.createVisit(owner: owner, request)
            )
            push(.visitDetail(homeId: homeId, eventId: response.visit.id))
            return true
        } catch let error as SchedulingError {
            saveError = Self.message(for: error)
            return false
        } catch {
            saveError = "Couldn't schedule this visit. Please try again."
            return false
        }
    }

    private static func message(for error: SchedulingError) -> String {
        if error.code == "BAD_RANGE" {
            return "Pick an end time after the start, within a 30-day window."
        }
        return error.userMessage ?? "Couldn't schedule this visit. Please try again."
    }

    private static func defaultStart() -> Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: ResourceTime.tz) ?? .current
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    }
}
