//
//  AssignmentSupport.swift
//  Pantopus
//
//  Shared member-pool loading for G1 Round-robin + G2 Collective (Stream I13).
//  Both sheets configure how a business SERVICE assigns to team members, so they
//  load the same two things: the event type's current assignees (GET
//  /event-types/:id) and the full business roster (GET /api/businesses/:id/
//  members) to choose from. Saving replaces the whole assignee set via PUT
//  /event-types/:id/assignees (INVALID_ASSIGNEE surfaced).
//

import Foundation

/// A pickable team member for the assignment sheets.
struct AssignmentMember: Identifiable, Hashable {
    let id: String // user id (assignee subject_id)
    let name: String
    let avatarURL: String?
    let role: String?
}

/// The loaded assignment context for an event type.
struct AssignmentPool {
    let eventType: EventTypeDTO
    let assignees: [EventTypeAssigneeDTO]
    let members: [AssignmentMember]
}

enum AssignmentLoader {
    /// Loads the event type detail + the business roster and folds them into a
    /// pickable pool. Throws `SchedulingError` on the event-type read.
    @MainActor
    static func loadPool(
        owner: SchedulingOwner,
        eventTypeId: String,
        client: SchedulingClient
    ) async throws -> AssignmentPool {
        let detail: EventTypeDetailResponse = try await client.request(
            SchedulingEndpoints.getEventType(owner: owner, id: eventTypeId)
        )
        var members: [AssignmentMember] = []
        if let businessId = owner.businessIdValue {
            let roster: BusinessTeamMembersResponse? = try? await client.request(
                BusinessTeamEndpoints.members(businessId: businessId)
            )
            members = (roster?.members ?? []).compactMap { member in
                guard let user = member.user else { return nil }
                return AssignmentMember(
                    id: user.id,
                    name: user.name ?? user.username ?? "Member",
                    avatarURL: user.profilePictureUrl,
                    role: member.title ?? member.roleBase?.capitalized
                )
            }
        }
        return AssignmentPool(eventType: detail.eventType, assignees: detail.assignees ?? [], members: members)
    }
}
