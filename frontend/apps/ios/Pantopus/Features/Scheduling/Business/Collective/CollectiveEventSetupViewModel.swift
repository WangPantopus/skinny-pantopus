//
//  CollectiveEventSetupViewModel.swift
//  Pantopus
//
//  G2 Collective Event Setup (Stream I13) — bottom sheet hung off a business
//  service. "Require multiple staff" maps assignment_mode → collective; the
//  chosen members become the assignee set; seats-per-appointment maps to
//  seat_cap. Matches `collective-frames.jsx` (off / on / no-overlap / saving).
//
//  Backend notes (flagged in the PR): the backend collective model is
//  "all required members must be free" — there is no stored "required staff
//  count" nor an "any N of a group" selector, so those controls are local UI
//  affordances. Live no-overlap detection is deferred (would need a
//  team-availability intersection probe).
//

import Foundation
import Observation

@Observable
@MainActor
final class CollectiveEventSetupViewModel {
    enum SelectionMode: Equatable { case specific, anyN }
    enum Phase: Equatable { case loading, ready, error(String) }

    struct Pick: Identifiable, Hashable {
        let id: String
        let name: String
        let avatarURL: String?
        let role: String?
        var checked: Bool
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    let eventTypeId: String
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var requireMultiple = false
    var requiredStaff = 2
    var selectionMode: SelectionMode = .specific
    var seatsPerAppointment = 1
    private(set) var picks: [Pick] = []
    private(set) var isSaving = false
    private(set) var saveError: String?
    /// Frame 3: no-overlap warning. Set true when the checked members share no
    /// free windows. Full intersection detection is deferred (needs a
    /// team-availability probe). Set externally by the scheduler once
    /// availability data is available.
    var noOverlap: Bool = false

    var checkedCount: Int {
        picks.filter(\.checked).count
    }

    init(owner: SchedulingOwner, eventTypeId: String, client: SchedulingClient) {
        self.owner = owner
        self.eventTypeId = eventTypeId
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        do {
            let pool = try await AssignmentLoader.loadPool(owner: owner, eventTypeId: eventTypeId, client: client)
            let assignedIds = Set(pool.assignees.map(\.subjectId))
            requireMultiple = pool.eventType.assignmentMode == "collective"
            seatsPerAppointment = max(1, pool.eventType.seatCap ?? 1)
            picks = pool.members.map { member in
                Pick(
                    id: member.id,
                    name: member.name,
                    avatarURL: member.avatarURL,
                    role: member.role,
                    checked: assignedIds.contains(member.id)
                )
            }
            requiredStaff = max(2, checkedCount)
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load collective setup.")
        } catch {
            phase = .error("Couldn't load collective setup.")
        }
    }

    // MARK: Editing

    func setRequireMultiple(_ on: Bool) {
        requireMultiple = on
    }

    func selectMode(_ mode: SelectionMode) {
        selectionMode = mode
    }

    func incrementRequired() {
        requiredStaff = min(requiredStaff + 1, max(2, picks.count))
    }

    func decrementRequired() {
        requiredStaff = max(requiredStaff - 1, 1)
    }

    func incrementSeats() {
        seatsPerAppointment = min(seatsPerAppointment + 1, 50)
    }

    func decrementSeats() {
        seatsPerAppointment = max(seatsPerAppointment - 1, 1)
    }

    func toggle(_ id: String) {
        guard let idx = picks.firstIndex(where: { $0.id == id }) else { return }
        picks[idx].checked.toggle()
    }

    // MARK: Save

    func save() async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            _ = try await client.request(
                SchedulingEndpoints.updateEventType(
                    owner: owner,
                    id: eventTypeId,
                    UpdateEventTypeRequest(
                        assignmentMode: requireMultiple ? "collective" : "one_on_one",
                        seatCap: seatsPerAppointment
                    )
                ),
                as: EventTypeResponse.self
            )
            if requireMultiple {
                let assignees = picks.filter(\.checked).map {
                    AssigneesRequest.Assignee(subjectId: $0.id, subjectType: "user", weight: 1, priority: 0)
                }
                _ = try await client.request(
                    SchedulingEndpoints.setEventTypeAssignees(owner: owner, id: eventTypeId, AssigneesRequest(assignees: assignees)),
                    as: AssigneesResponse.self
                )
            }
            return true
        } catch let error as SchedulingError {
            if error.validationDetails.contains(where: { $0.code == "INVALID_ASSIGNEE" }) || error.code == "INVALID_ASSIGNEE" {
                saveError = "One of those members isn't on your team anymore. Refresh and try again."
            } else {
                saveError = error.userMessage ?? "Couldn't save collective setup."
            }
            return false
        } catch {
            saveError = "Couldn't save collective setup."
            return false
        }
    }
}
