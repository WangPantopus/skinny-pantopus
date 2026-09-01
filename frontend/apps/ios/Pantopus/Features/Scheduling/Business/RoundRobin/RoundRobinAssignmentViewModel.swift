//
//  RoundRobinAssignmentViewModel.swift
//  Pantopus
//
//  G1 Round-Robin Assignment (Stream I13) — bottom sheet hung off a business
//  service. Picks which members take bookings and the fairness rule. Saving
//  REPLACES the whole assignee set via PUT /event-types/:id/assignees
//  (INVALID_ASSIGNEE surfaced). Round-robin uses weight (Balanced) / priority
//  (Priority order) / equal (Strict). Matches `roundrobin-frames.jsx`
//  (default / loading / none-selected / single-member).
//
//  Backend note: there is no dedicated "rule" column — Balanced/Priority/Strict
//  are expressed through the assignees' weight/priority and inferred on reload.
//  The encoding is a lossless sentinel scheme so the chosen rule survives a
//  save→reload round-trip even when every value is at its default:
//    · strict   → weight 1, priority 0            (the neutral shape)
//    · priority → weight 1, priority index+1      (1-based rank; >0 marks the rule)
//    · balanced → user weights, priority -1       (<0 marks the rule; weights carry the data)
//  All three are behavior-neutral for the backend's host pick
//  (bookingService.pickRoundRobinHost sorts by assigned_count, then priority
//  DESC — equal priorities don't reorder, and +1 on every rank preserves the
//  relative order the old 0-based encoding produced). `weight` is not read by
//  the pick at all. Joi (weight min 0, priority any integer) and the DB column
//  (plain integer, no CHECK) both accept the sentinel values.
//

import Foundation
import Observation

@Observable
@MainActor
final class RoundRobinAssignmentViewModel {
    enum Rule: String, CaseIterable, Equatable { case balanced, priority, strict }

    enum Phase: Equatable { case loading, ready, error(String) }

    struct Pick: Identifiable, Hashable {
        let id: String
        let name: String
        let avatarURL: String?
        let role: String?
        var checked: Bool
        var weight: Int
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    let eventTypeId: String
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    var selectedRule: Rule = .balanced
    private(set) var picks: [Pick] = []
    private(set) var isSaving = false
    private(set) var saveError: String?

    // MARK: Derived

    var checkedCount: Int {
        picks.filter(\.checked).count
    }

    var doneDisabled: Bool {
        checkedCount == 0 || isSaving
    }

    var isSingleMember: Bool {
        checkedCount == 1
    }

    var firstCheckedName: String? {
        picks.first(where: \.checked)?.name
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
            let assignedById = Dictionary(pool.assignees.map { ($0.subjectId, $0) }) { first, _ in first }
            picks = pool.members.map { member in
                let assignee = assignedById[member.id]
                return Pick(
                    id: member.id,
                    name: member.name,
                    avatarURL: member.avatarURL,
                    role: member.role,
                    checked: assignee != nil,
                    weight: assignee?.weight ?? 1
                )
            }
            // Members assigned but not in the roster fetch (defensive) — keep them.
            let knownIds = Set(picks.map(\.id))
            for assignee in pool.assignees where !knownIds.contains(assignee.subjectId) {
                picks.append(Pick(
                    id: assignee.subjectId,
                    name: "Member",
                    avatarURL: nil,
                    role: nil,
                    checked: true,
                    weight: assignee.weight ?? 1
                ))
            }
            selectedRule = Self.inferRule(pool.assignees)
            phase = .ready
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load assignment.")
        } catch {
            phase = .error("Couldn't load assignment.")
        }
    }

    // MARK: Editing

    func selectRule(_ rule: Rule) {
        selectedRule = rule
    }

    func toggle(_ id: String) {
        guard let idx = picks.firstIndex(where: { $0.id == id }) else { return }
        picks[idx].checked.toggle()
    }

    func incrementWeight(_ id: String) {
        guard let idx = picks.firstIndex(where: { $0.id == id }) else { return }
        picks[idx].weight = min(picks[idx].weight + 1, 9)
    }

    func decrementWeight(_ id: String) {
        guard let idx = picks.firstIndex(where: { $0.id == id }) else { return }
        picks[idx].weight = max(picks[idx].weight - 1, 1)
    }

    func moveUp(_ id: String) {
        guard let idx = picks.firstIndex(where: { $0.id == id }), idx > 0 else { return }
        picks.swapAt(idx, idx - 1)
    }

    func moveDown(_ id: String) {
        guard let idx = picks.firstIndex(where: { $0.id == id }), idx < picks.count - 1 else { return }
        picks.swapAt(idx, idx + 1)
    }

    // MARK: Save

    func save() async -> Bool {
        guard !doneDisabled else { return false }
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        let checked = picks.filter(\.checked)
        // Sentinel encoding (see header): the rule must survive save→reload,
        // so each rule writes a shape the other two can never produce —
        // balanced marks every row priority -1, priority ranks 1-based, strict
        // stays all-zero. Previously balanced-with-default-weights and
        // single-member priority round-tripped back as "Strict".
        let assignees: [AssigneesRequest.Assignee] = checked.enumerated().map { index, pick in
            switch selectedRule {
            case .balanced:
                AssigneesRequest.Assignee(subjectId: pick.id, subjectType: "user", weight: pick.weight, priority: -1)
            case .priority:
                AssigneesRequest.Assignee(subjectId: pick.id, subjectType: "user", weight: 1, priority: index + 1)
            case .strict:
                AssigneesRequest.Assignee(subjectId: pick.id, subjectType: "user", weight: 1, priority: 0)
            }
        }
        do {
            _ = try await client.request(
                SchedulingEndpoints.setEventTypeAssignees(owner: owner, id: eventTypeId, AssigneesRequest(assignees: assignees)),
                as: AssigneesResponse.self
            )
            return true
        } catch let error as SchedulingError {
            if error.validationDetails.contains(where: { $0.code == "INVALID_ASSIGNEE" }) || error.code == "INVALID_ASSIGNEE" {
                saveError = "One of those members isn't on your team anymore. Refresh and try again."
            } else {
                saveError = error.userMessage ?? "Couldn't save assignment."
            }
            return false
        } catch {
            saveError = "Couldn't save assignment."
            return false
        }
    }

    // MARK: Helpers

    private static func inferRule(_ assignees: [EventTypeAssigneeDTO]) -> Rule {
        guard !assignees.isEmpty else { return .balanced }
        // Sentinel decode (see header). Negative priority = balanced marker;
        // positive = priority rank. Non-default weights also read as balanced
        // so rows saved by older clients (priority 0 + custom weights) keep
        // their rule.
        if assignees.contains(where: { ($0.priority ?? 0) < 0 }) { return .balanced }
        if assignees.contains(where: { ($0.weight ?? 1) != 1 }) { return .balanced }
        if assignees.contains(where: { ($0.priority ?? 0) > 0 }) { return .priority }
        return .strict
    }
}
