import Foundation

enum HomeInvitationSenderAction: String, Codable { case create, resend, withdraw }

struct HomeInvitationSenderTarget: Identifiable, Equatable {
    let action: HomeInvitationSenderAction
    let invitationId: String?
    var id: String {
        action.rawValue + (invitationId ?? "")
    }
}

struct PendingHomeInvitationSender: Codable, Equatable {
    let scope: HomeCreationScope
    /// JSON bytes are produced once and reused verbatim for every retry.
    let bodyData: Data
    let review: JSONValue
    var outcome: HomeInvitationSenderOutcome?
    var fields: [String: JSONValue] {
        (try? JSONDecoder().decode(JSONValue.self, from: bodyData).dictValue) ?? [:]
    }

    var requestId: String {
        fields["request_id"]?.stringValue ?? ""
    }

    var homeId: String {
        fields["home_id"]?.stringValue ?? ""
    }

    var invitationId: String? {
        fields["invitation_id"]?.stringValue
    }

    var token: String? {
        fields["token"]?.stringValue
    }

    var action: HomeInvitationSenderAction? {
        fields["action"]?.stringValue.flatMap(HomeInvitationSenderAction.init(rawValue:))
    }

    var intent: JSONValue {
        .object(fields.filter { !["request_id", "token", "decision_token"].contains($0.key) })
    }

    var recipient: String {
        let payload = fields["payload"]?.dictValue ?? [:]
        return payload["email"]?.stringValue ?? payload["username"]?.stringValue
            ?? review.dictValue?["recipient_label"]?.stringValue
            ?? review.dictValue?["invitee_email"]?.stringValue ?? "Original invitation"
    }

    func matches(_ expected: HomeCreationScope) -> Bool {
        guard scope == expected, scope.isValid, bodyData.count <= 16000,
              let review = review.dictValue,
              Set(review.keys).isSubset(of: [
                  "recipient_label",
                  "invitee_email",
                  "proposed_role",
                  "proposed_role_base",
                  "proposed_preset_key",
                  "expires_at",
                  "access_start_at",
                  "access_end_at"
              ]),
              review.values.allSatisfy({ $0 == .null || ($0.stringValue?.utf16.count ?? 2001) <= 2000 }),
              HomeInvitationSenderValidation.summary(review),
              HomePostalValidation.uuid(requestId), HomePostalValidation.uuid(homeId), let action,
              HomeClaimReviewSnapshot.validToken(fields["decision_token"]?.stringValue),
              action == .withdraw ? fields["token"] == .null : HomeClaimReviewSnapshot.validToken(token) else { return false }
        let common: Set<String> = ["request_id", "token", "home_id", "action", "decision_token"]
        let keys = common.union(action == .create ? ["payload"] : ["invitation_id"])
        guard Set(fields.keys) == keys, HomeInvitationSenderValidation.intent(intent) else { return false }
        return outcome == nil || outcome?.matches(self) == true
    }
}

struct HomeInvitationSenderOutcome: Codable, Equatable {
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

    var invitationId: String? {
        fields["invitation_id"]?.stringValue
    }

    var isTerminal: Bool {
        ["completed", "rejected", "cancelled"].contains(state)
    }

    var delivery: [String: JSONValue] {
        fields["delivery"]?.dictValue ?? [:]
    }

    func matches(_ original: PendingHomeInvitationSender) -> Bool {
        guard ["pending", "completed", "rejected", "cancelled"].contains(state),
              ["home_id", "action", "decision_token"].allSatisfy({ fields[$0] == original.fields[$0] }),
              let command = fields["command"]?.dictValue,
              command["actor_id"]?.stringValue == original.scope.actorId,
              command["request_id"]?.stringValue == original.requestId,
              HomePostalValidation.date(command["created_at"]), HomePostalValidation.date(command["updated_at"]),
              ["not_requested", "unconfirmed", "provider_accepted"].contains(delivery["email"]?.stringValue ?? ""),
              ["not_requested", "unconfirmed", "saved"].contains(delivery["in_app"]?.stringValue ?? "") else { return false }
        if state != "completed" || original.action == .withdraw {
            guard delivery["email"] == .string("not_requested"), delivery["in_app"] == .string("not_requested") else { return false }
        }
        if original.action == .create {
            guard state == "completed" ? HomePostalValidation.uuid(invitationId)
                : fields["invitation_id"] == .null || HomePostalValidation.uuid(invitationId) else { return false }
        } else if invitationId != original.invitationId { return false }
        return state == "rejected" ? code?.range(of: "^[A-Z][A-Z0-9_]{1,79}$", options: .regularExpression) != nil : code == nil
    }

    func projected() -> Self {
        var row = fields.filter { ["state", "home_id", "invitation_id", "action", "decision_token", "code"].contains($0.key) }
        row["command"] = .object((fields["command"]?.dictValue ?? [:])
            .filter { ["actor_id", "request_id", "created_at", "updated_at"].contains($0.key) })
        row["delivery"] = .object(delivery.filter { ["email", "in_app"].contains($0.key) })
        return Self(value: .object(row))
    }

    var deliveryMessage: String {
        let email = switch delivery["email"]?.stringValue {
        case "provider_accepted": "Email provider accepted the message; inbox delivery is not confirmed."
        case "not_requested": "No email delivery was requested."
        default: "Email delivery is unconfirmed."
        }
        let notification = switch delivery["in_app"]?.stringValue {
        case "saved": "An in-app notification was saved; push delivery is not confirmed."
        case "not_requested": "No in-app notification was requested."
        default: "In-app notification delivery is unconfirmed."
        }
        return email + " " + notification
    }
}

struct HomeInvitationSenderContext {
    let intent: JSONValue
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var token: String {
        fields["decision_token"]?.stringValue ?? ""
    }

    var invitation: [String: JSONValue] {
        fields["invitation"]?.dictValue ?? [:]
    }

    func matches(_ scope: HomeCreationScope, session: String) -> Bool {
        guard HomeInvitationSenderValidation.intent(intent),
              HomeInvitationValidation.session(fields["session"], scope: scope) == session,
              HomeClaimReviewSnapshot.validToken(token),
              ["home_id", "action"].allSatisfy({ fields[$0] == intent.dictValue?[$0] }) else { return false }
        if intent.dictValue?["action"]?.stringValue == "create" { return fields["invitation"] == .null }
        return invitation["id"] == intent.dictValue?["invitation_id"] && invitation["home_id"] == intent.dictValue?["home_id"]
            && invitation["status"]?.stringValue == "pending" && HomeInvitationSenderValidation.summary(invitation)
    }
}

enum HomeInvitationSenderValidation {
    static func summary(_ row: [String: JSONValue]) -> Bool {
        guard [
            "invitee_email",
            "proposed_role",
            "proposed_role_base",
            "proposed_preset_key",
            "expires_at",
            "access_start_at",
            "access_end_at"
        ]
        .allSatisfy({ row[$0] == nil || row[$0] == .null || row[$0]?.stringValue != nil }) else { return false }
        guard ["expires_at", "access_start_at", "access_end_at"]
            .allSatisfy({ row[$0] == nil || HomeResidencyReviewValidation.nullableDate(row[$0]) }) else { return false }
        guard let profile = row["invitee"]?.dictValue else { return row["invitee"] == nil || row["invitee"] == .null }
        return profile["id"] == row["invitee_user_id"] && HomePostalValidation.uuid(profile["id"]?.stringValue)
            && ["name", "username"].allSatisfy { profile[$0] == .null || profile[$0]?.stringValue != nil }
    }

    static func effectiveRole(_ row: [String: JSONValue]) -> String? {
        row["proposed_role_base"]?.stringValue ?? row["proposed_role"]?.stringValue
    }

    static func presetLabel(_ key: String?) -> String {
        guard let key else { return "Household role defaults" }
        if key.hasPrefix("access_request:") { return "Household approval" }
        return key.replacingOccurrences(of: "_", with: " ").capitalized
    }

    static func profileLabel(_ profile: [String: JSONValue]) -> String {
        let name = profile["name"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let username = profile["username"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !username.isEmpty { return name.isEmpty ? "@" + username : name + " (@" + username + ")" }
        return name.isEmpty ? "Invited person" : name
    }

    static func intent(_ value: JSONValue) -> Bool {
        guard let fields = value.dictValue, HomePostalValidation.uuid(fields["home_id"]?.stringValue),
              let raw = fields["action"]?.stringValue, let action = HomeInvitationSenderAction(rawValue: raw) else { return false }
        if action != .create {
            return Set(fields.keys) == ["home_id", "action", "invitation_id"] && HomePostalValidation
                .uuid(fields["invitation_id"]?.stringValue)
        }
        guard Set(fields.keys) == ["home_id", "action", "payload"], let payload = fields["payload"]?.dictValue,
              !payload.isEmpty, Set(payload.keys).isSubset(of: [
                  "email",
                  "user_id",
                  "username",
                  "relationship",
                  "preset_key",
                  "start_at",
                  "end_at",
                  "message"
              ])
        else { return false }
        return payload.values.allSatisfy { $0 == .null || ($0.stringValue?.utf16.count ?? 2001) <= 2000 }
    }

    static func encode(_ value: JSONValue) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(value)
    }
}

enum HomeInvitationSenderError: LocalizedError {
    case storage, changed, unknown, unavailable, sessionChanged
    case refusal(String?)
    var errorDescription: String? {
        switch self {
        case .storage: "The protected original could not be read or saved. Reopen invitation recovery before starting another action."
        case .changed: "The saved action or reviewed invitation changed. Reopen recovery to review the original."
        case .unknown: "The result is not confirmed. Check the saved original, retry it, or cancel its attempt."
        case .unavailable: "Current invitation details are unavailable. Reopen to check again."
        case .sessionChanged: "Your session changed. Reopen invitation recovery under the original account."
        case let .refusal(code): Self.message(code)
        }
    }

    static func message(_ code: String?) -> String {
        switch code {
        case "INVITE_SENDER_CHANGED":
            "The invitation or permission changed after review. Acknowledge this result and review the current details."
        case "MEMBERS_MANAGE_REQUIRED", "INVITER_ACCESS_CHANGED":
            "Current permission to manage invitations is unavailable. Your saved result remains recoverable."
        case "INVITE_ALREADY_USED": "This invitation was already resolved. Its existing membership has not been changed."
        case "INVITE_EXPIRED": "This invitation expired. Resending does not extend its expiry or access dates."
        case "INVITE_ALREADY_PENDING": "A pending invitation already exists. Review that invitation to resend it."
        case "MEMBER_ALREADY_EXISTS": "This person is already a member. Their existing membership has not been changed."
        default: "This action could not continue. Review the current invitation and account before starting again."
        }
    }
}
