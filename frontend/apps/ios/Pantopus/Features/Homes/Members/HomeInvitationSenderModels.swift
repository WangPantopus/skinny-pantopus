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

    /// What reached the invitee: "sent" means the email service took the message, not that it arrived.
    var deliveryMessage: String {
        var lines: [String] = []
        switch delivery["email"]?.stringValue {
        case "provider_accepted": lines.append("We emailed the invitation.")
        case "not_requested": break
        default: lines.append("We couldn't confirm the invitation email went out. You can share the invitation link instead.")
        }
        switch delivery["in_app"]?.stringValue {
        case "saved": lines.append(lines.isEmpty ? "It's in their Pantopus notifications." : "It's also in their Pantopus notifications.")
        case "not_requested": break
        default: lines.append("We couldn't confirm their Pantopus notification.")
        }
        if lines.isEmpty { return "No email or notification was sent. Share the invitation link so they can accept." }
        return lines.joined(separator: " ")
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
        // The web's names for the relationships it offers.
        let named = [
            "tenant": "Tenant / Roommate",
            "spouse": "Spouse / Partner",
            "extended_family": "Extended family",
            "child": "Child",
            "airbnb_guest": "Short-stay guest",
            "cleaner_vendor": "Cleaner / Vendor"
        ]
        return named[key] ?? key.replacingOccurrences(of: "_", with: " ").capitalized
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
        case .storage: "This invitation couldn't be read or saved on this device. Reload before starting another."
        case .changed: "This invitation changed. Reload to see the latest."
        case .unknown: "We couldn't confirm the result. Check again, try again, or discard this attempt."
        case .unavailable: "Couldn't load the invitation details. Reload to try again."
        case .sessionChanged: "Your sign-in changed. Reload in the account that started this invitation."
        case let .refusal(code): Self.message(code)
        }
    }

    static func message(_ code: String?) -> String {
        switch code {
        case "INVITE_SENDER_CHANGED":
            "The invitation or your permissions changed. Tap Done, then check the details again."
        case "MEMBERS_MANAGE_REQUIRED", "INVITER_ACCESS_CHANGED":
            "You don't have permission to manage this household's invitations."
        case "INVITE_ALREADY_USED": "This invitation was already answered. Nobody's membership changed."
        case "INVITE_EXPIRED": "This invitation has expired. Send a new invitation instead."
        case "INVITE_ALREADY_PENDING": "This person already has a pending invitation. You can resend it from Pending in Members."
        case "MEMBER_ALREADY_EXISTS": "This person is already in the household."
        case "MEMBERSHIP_RENEWAL_REQUIRED": "This person’s earlier household membership has ended. An invitation can't restore it."
        default: "This couldn't be completed. Check the invitation and try again."
        }
    }
}
