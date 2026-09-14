import Foundation

enum HomeInvitationAction: String, Codable { case accept, decline }
enum HomeInvitationRecoveryAction { case check, retry, cancel }

struct PendingHomeInvitationDecision: Codable, Equatable {
    let scope: HomeCreationScope
    let homeLabel: String
    let body: JSONValue
    var outcome: HomeInvitationDecisionOutcome?

    var fields: [String: JSONValue] {
        body.dictValue ?? [:]
    }

    var requestId: String {
        fields["request_id"]?.stringValue ?? ""
    }

    var homeId: String {
        fields["home_id"]?.stringValue ?? ""
    }

    var invitationId: String {
        fields["invitation_id"]?.stringValue ?? ""
    }

    var token: String {
        fields["token"]?.stringValue ?? ""
    }

    var decisionToken: String {
        fields["decision_token"]?.stringValue ?? ""
    }

    var action: HomeInvitationAction? {
        fields["action"]?.stringValue.flatMap(HomeInvitationAction.init(rawValue:))
    }

    func matches(_ expected: HomeCreationScope) -> Bool {
        scope == expected && scope.isValid && homeLabel.utf16.count <= 1000
            && Set(fields.keys) == ["request_id", "home_id", "invitation_id", "token", "action", "decision_token"]
            && [requestId, homeId, invitationId].allSatisfy { HomePostalValidation.uuid($0) }
            && !token.isEmpty && token.utf16.count <= 512 && action != nil
            && HomeClaimReviewSnapshot.validToken(decisionToken)
            && (outcome == nil || outcome?.matches(self) == true)
    }
}

struct HomeInvitationDecisionOutcome: Codable, Equatable {
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var state: String {
        fields["state"]?.stringValue ?? ""
    }

    var code: String? {
        fields["code"]?.stringValue
    }

    var isTerminal: Bool {
        ["completed", "rejected", "cancelled"].contains(state)
    }

    func matches(_ draft: PendingHomeInvitationDecision) -> Bool {
        let row = fields
        guard ["pending", "completed", "rejected", "cancelled"].contains(state),
              ["home_id", "invitation_id", "action", "decision_token"].allSatisfy({ row[$0] == draft.fields[$0] }),
              row["current_access"]?.stringValue == "not_checked", let command = row["command"]?.dictValue,
              command["actor_id"]?.stringValue == draft.scope.actorId,
              command["request_id"]?.stringValue == draft.requestId,
              HomePostalValidation.date(command["created_at"]), HomePostalValidation.date(command["updated_at"]) else { return false }
        if state == "completed", draft.action == .accept {
            guard HomePostalValidation.uuid(row["occupancy_id"]?.stringValue) else { return false }
        } else if row["occupancy_id"] != .null { return false }
        return state == "rejected" ? code?.range(of: "^[A-Z][A-Z0-9_]{1,79}$", options: .regularExpression) != nil : row["code"] == nil
    }

    func projected() -> Self {
        var row = fields
            .filter {
                ["state", "home_id", "invitation_id", "action", "decision_token", "occupancy_id", "current_access", "code"].contains($0.key)
            }
        row["command"] = .object((fields["command"]?.dictValue ?? [:])
            .filter { ["actor_id", "request_id", "created_at", "updated_at"].contains($0.key) })
        return Self(value: .object(row))
    }
}

struct HomeInvitationDecisionContext {
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var preview: [String: JSONValue] {
        fields["preview"]?.dictValue ?? [:]
    }

    var invitation: [String: JSONValue] {
        preview["invitation"]?.dictValue ?? [:]
    }

    var homeId: String {
        fields["home_id"]?.stringValue ?? ""
    }

    var invitationId: String {
        fields["invitation_id"]?.stringValue ?? ""
    }

    var decisionToken: String {
        fields["decision_token"]?.stringValue ?? ""
    }

    var homeLabel: String {
        preview["home"]?.dictValue?["name"]?.stringValue ?? "This Home"
    }

    var city: String {
        preview["home"]?.dictValue?["city"]?.stringValue ?? ""
    }

    var inviter: String {
        preview["inviter"]?.dictValue?["name"]?.stringValue ?? "The household"
    }

    var role: String {
        invitation["proposed_role"]?.stringValue ?? ""
    }

    var expiresAt: Date? {
        invitation["expires_at"]?.stringValue.flatMap(HomeInvitationValidation.date)
    }

    func matches(_ scope: HomeCreationScope, session: String) -> Bool {
        HomeInvitationValidation.session(fields["session"], scope: scope) == session
            && HomePostalValidation.uuid(homeId) && HomePostalValidation.uuid(invitationId)
            && HomeClaimReviewSnapshot.validToken(decisionToken)
            && preview["home"]?.dictValue?["id"]?.stringValue == homeId
            && invitation["id"]?.stringValue == invitationId && invitation["status"]?.stringValue == "pending"
            && HomeInvitationValidation.preview(fields["preview"])
    }
}

enum HomeInvitationValidation {
    static func date(_ value: String) -> Date? {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return parser.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    static func session(_ value: JSONValue?, scope: HomeCreationScope) -> String? {
        guard let row = value?.dictValue, row["actor_id"]?.stringValue == scope.actorId,
              let session = row["session_scope"]?.stringValue, HomeClaimReviewSnapshot.validToken(session) else { return nil }
        return session
    }

    static func preview(_ value: JSONValue?) -> Bool {
        guard let row = value?.dictValue, let invite = row["invitation"]?.dictValue,
              HomePostalValidation.uuid(invite["id"]?.stringValue), let status = invite["status"]?.stringValue,
              ["pending", "accepted", "expired", "revoked"].contains(status),
              ["expired", "alreadyUsed"].allSatisfy({ row[$0] == nil || row[$0]?.boolValue != nil }) else { return false }
        if status != "pending" {
            return row["home"] == nil && row["inviter"] == nil && row["expired"] == .bool(status == "expired")
                && row["alreadyUsed"] == .bool(status == "accepted")
        }
        guard row["expired"] != .bool(true), row["alreadyUsed"] != .bool(true),
              let home = row["home"]?.dictValue, HomePostalValidation.uuid(home["id"]?.stringValue),
              home["name"]?.stringValue != nil, home["city"]?.stringValue != nil,
              HomeResidencyReviewValidation.nullableText(home["home_type"]),
              invite["proposed_role"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false,
              HomePostalValidation.date(invite["created_at"]), HomeResidencyReviewValidation.nullableDate(invite["expires_at"]),
              ["access_start_at", "access_end_at"]
              .allSatisfy({ invite[$0] == nil || HomeResidencyReviewValidation.nullableDate(invite[$0]) }),
              let inviter = row["inviter"]?.dictValue, inviter["name"]?.stringValue != nil else { return false }
        return ["username", "profilePicture"].allSatisfy { HomeResidencyReviewValidation.nullableText(inviter[$0]) }
    }
}

enum HomeInvitationDecisionError: LocalizedError {
    case storage, changed, unknown, unavailable, sessionChanged, busy
    case refusal(String?)

    var errorDescription: String? {
        switch self {
        case .storage: "The protected original could not be read or saved. It is kept. Reopen recovery before starting another decision."
        case .changed: "The saved decision or invitation changed. Reopen recovery to review the original."
        case .unknown:
            "The result is not confirmed. Check the saved decision, retry that same decision, or confirm cancellation of the attempt."
        case .unavailable: "The invitation could not be checked right now. Retry to review its current details."
        case .sessionChanged: "Your session changed. Reopen the invitation to recover your original decision."
        case .busy: "Wait for the original invitation decision to finish being checked."
        case let .refusal(code): Self.message(code)
        }
    }

    static func message(_ code: String?) -> String {
        switch code {
        case "INVITE_EMAIL_MISMATCH": "This invitation belongs to a different account. Sign in to the account the sender invited."
        case "INVITE_DECISION_CHANGED":
            "The invitation details changed. Acknowledge this result, then review the current invitation before deciding again."
        case "INVITE_EXPIRED": "This invitation expired. Ask the household for a new invitation."
        case "INVITE_ALREADY_USED": "This invitation was already accepted, declined or withdrawn. My Homes shows your current access."
        case "INVITE_NOT_FOUND", "INVITE_INVALID": "This invitation is unavailable. Check the complete link with the sender."
        case "INVITER_ACCESS_CHANGED": "The sender can no longer grant this access. Ask the household for a new invitation."
        case "OWNERSHIP_FLOW_REQUIRED": "Use the separate ownership flow for this invitation."
        case "INVITE_POLICY_CHANGED": "The household permissions changed. Ask for a new invitation."
        case "MEMBERSHIP_RENEWAL_REQUIRED": "Your previous household access needs a new review. This invitation cannot restore it."
        default: "The decision could not continue. Review the invitation and current account before starting again."
        }
    }
}
