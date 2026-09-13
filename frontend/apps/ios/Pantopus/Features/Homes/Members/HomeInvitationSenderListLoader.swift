import Foundation

/// A manager's pending queue includes expired invitations and invitations whose
/// original sender lost authority. They remain withdrawable by a current manager.
@MainActor
enum HomeInvitationSenderListLoader {
    static func load(homeId: String, api: APIClient) async throws -> [PendingInviteDTO] {
        let scope = HomeInvitationDecisionViewModel.scope(api: api)
        let lifetime = HomeClaimSessionScope(api: api)
        guard scope.isValid, HomePostalValidation.uuid(homeId), lifetime.isCurrent else { throw HomeInvitationSenderError.sessionChanged }
        let session: JSONValue = try await api.request(Endpoint(
            method: .get,
            path: "/api/homes/invitations/sender/session",
            cachePolicy: .reloadIgnoringLocalCacheData
        ))
        guard lifetime.isCurrent, let token = HomeInvitationValidation.session(session.dictValue?["session"], scope: scope)
        else { throw HomeInvitationSenderError.sessionChanged }
        let response: JSONValue = try await api.request(Endpoint(
            method: .get,
            path: "/api/homes/\(homeId)/invitations",
            headers: [
                "X-Pantopus-Session-Scope": token,
                "Cache-Control": "no-cache, no-store"
            ],
            cachePolicy: .reloadIgnoringLocalCacheData
        ))
        guard lifetime.isCurrent, HomeInvitationValidation.session(response.dictValue?["session"], scope: scope) == token,
              let values = response.dictValue?["invitations"]?.arrayValue else { throw HomeInvitationSenderError.unavailable }
        let rows = try values.map { value in
            guard let row = invitation(value, homeId: homeId) else { throw HomeInvitationSenderError.unavailable }
            return row
        }
        guard Set(rows.map(\.id)).count == rows.count else { throw HomeInvitationSenderError.unavailable }
        return rows
    }

    static func invitation(_ value: JSONValue, homeId: String) -> PendingInviteDTO? {
        guard let row = value.dictValue, let id = row["id"]?.stringValue, HomePostalValidation.uuid(id),
              row["home_id"]?.stringValue == homeId, row["status"]?.stringValue == "pending",
              HomePostalValidation.date(row["created_at"]),
              HomeInvitationSenderValidation.summary(row),
              ["invitee_email", "proposed_role", "proposed_role_base", "expires_at", "access_start_at", "access_end_at"]
              .allSatisfy({ row[$0] == nil || row[$0] == .null || row[$0]?.stringValue != nil }),
              row["invitee_user_id"] == .null || row["invitee_user_id"] == nil || HomePostalValidation
              .uuid(row["invitee_user_id"]?.stringValue)
        else { return nil }
        let name: String
        if let profile = row["invitee"]?.dictValue {
            guard profile["id"] == row["invitee_user_id"], HomePostalValidation.uuid(profile["id"]?.stringValue),
                  ["name", "username"].allSatisfy({ profile[$0] == .null || profile[$0]?.stringValue != nil }) else { return nil }
            name = HomeInvitationSenderValidation.profileLabel(profile)
        } else {
            guard row["invitee"] == nil || row["invitee"] == .null else { return nil }
            name = row["invitee_email"]?
                .stringValue ?? (row["is_open_invite"] == .bool(true) ? "Anyone with the invitation link" : "Invited person")
        }
        return PendingInviteDTO(
            id: id,
            userId: row["invitee_user_id"]?.stringValue,
            role: HomeInvitationSenderValidation.effectiveRole(row),
            email: row["invitee_email"]?.stringValue,
            name: name,
            createdAt: row["created_at"]?.stringValue,
            expiresAt: row["expires_at"]?.stringValue
        )
    }
}
