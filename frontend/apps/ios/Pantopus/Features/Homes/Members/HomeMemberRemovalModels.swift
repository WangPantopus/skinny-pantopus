import Foundation

struct HomeMemberRemovalTarget: Identifiable, Equatable {
    let homeId: String
    let userId: String
    var id: String {
        homeId + ":" + userId
    }
}

/// Reviewed labels explain the original; they never establish current access.
struct PendingHomeMemberRemoval: Codable, Equatable {
    let scope: HomeCreationScope
    let bodyData: Data
    let review: JSONValue
    var outcome: HomeMemberRemovalOutcome?
    var fields: [String: JSONValue] {
        (try? JSONDecoder().decode(JSONValue.self, from: bodyData).dictValue) ?? [:]
    }

    var requestId: String {
        fields["request_id"]?.stringValue ?? ""
    }

    var homeId: String {
        fields["home_id"]?.stringValue ?? ""
    }

    var targetId: String {
        fields["target_user_id"]?.stringValue ?? ""
    }

    var token: String {
        fields["decision_token"]?.stringValue ?? ""
    }

    func matches(_ expected: HomeCreationScope) -> Bool {
        guard scope == expected, scope.isValid, bodyData.count <= 4096,
              Set(fields.keys) == HomeMemberRemovalValidation.intentKeys.union(["request_id"]),
              HomePostalValidation.uuid(requestId), HomeMemberRemovalValidation.intent(fields),
              HomeMemberRemovalValidation.summary(review, homeId: homeId, targetId: targetId, actorId: scope.actorId)
        else { return false }
        return outcome == nil || (outcome?.fields["session"] == nil && outcome?.fields["replayed"] == nil && outcome?.matches(self) == true)
    }
}

struct HomeMemberRemovalContext {
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var token: String {
        fields["decision_token"]?.stringValue ?? ""
    }

    var summary: JSONValue {
        .object(fields.filter { ["home", "target"].contains($0.key) })
    }

    func matches(_ target: HomeMemberRemovalTarget, scope: HomeCreationScope, session: String) -> Bool {
        Set(fields.keys) == HomeMemberRemovalValidation.intentKeys.union(["home", "target", "session"])
            && HomeMemberRemovalValidation.intent(fields)
            && fields["home_id"]?.stringValue == target.homeId
            && fields["target_user_id"]?.stringValue == target.userId
            && HomeInvitationValidation.session(fields["session"], scope: scope) == session
            && HomeMemberRemovalValidation.summary(summary, homeId: target.homeId, targetId: target.userId, actorId: scope.actorId)
    }
}

struct HomeMemberRemovalOutcome: Codable, Equatable {
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

    var expectedStatus: Int {
        code.flatMap { HomeMemberRemovalValidation.rejections[$0] } ?? 200
    }

    func matches(_ original: PendingHomeMemberRemoval) -> Bool {
        let required = HomeMemberRemovalValidation.intentKeys.union(["state", "completed_at", "code", "status", "command"])
        guard required.isSubset(of: Set(fields.keys)), Set(fields.keys).isSubset(of: required.union(["session", "replayed"])),
              HomeMemberRemovalValidation.intentKeys.allSatisfy({ fields[$0] == original.fields[$0] }),
              ["completed", "rejected", "cancelled", "pending"].contains(state),
              fields["replayed"] == nil || fields["replayed"]?.boolValue != nil,
              let command = fields["command"]?.dictValue,
              Set(command.keys) == ["actor_id", "request_id", "created_at", "updated_at"],
              command["actor_id"]?.stringValue == original.scope.actorId,
              command["request_id"]?.stringValue == original.requestId,
              HomePostalValidation.date(command["created_at"]), HomePostalValidation.date(command["updated_at"])
        else { return false }
        if state == "completed" {
            return HomePostalValidation.date(fields["completed_at"]) && fields["code"] == .null && fields["status"] == .null
        }
        guard fields["completed_at"] == .null else { return false }
        if state == "rejected" {
            guard let code, let status = HomeMemberRemovalValidation.rejections[code] else { return false }
            return fields["status"] == .number(Double(status))
        }
        return fields["code"] == .null && fields["status"] == .null
    }

    func projected() -> Self {
        Self(value: .object(fields.filter { !["session", "replayed"].contains($0.key) }))
    }
}

enum HomeMemberRemovalValidation {
    static let intentKeys: Set<String> = ["home_id", "target_user_id", "occupancy_id", "action", "decision_token"]
    static let rejections = [
        "MEMBER_REMOVAL_CHANGED": 409, "MEMBER_ALREADY_REMOVED": 409, "MEMBERS_MANAGE_REQUIRED": 403,
        "TARGET_RANK_FORBIDDEN": 403, "OWNERSHIP_FLOW_REQUIRED": 409, "TRANSFER_REQUIRED": 409,
        "MEMBER_ROLE_UNKNOWN": 409, "MEMBER_NOT_FOUND": 404, "HOME_NOT_FOUND": 404
    ]

    static func encode(_ value: JSONValue) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(value)
    }

    static func intent(_ fields: [String: JSONValue]) -> Bool {
        ["home_id", "target_user_id", "occupancy_id"].allSatisfy { HomePostalValidation.uuid(fields[$0]?.stringValue) }
            && fields["action"] == .string("remove") && HomeClaimReviewSnapshot.validToken(fields["decision_token"]?.stringValue)
    }

    static func summary(_ value: JSONValue, homeId: String, targetId: String, actorId: String) -> Bool {
        guard let fields = value.dictValue, Set(fields.keys) == ["home", "target"],
              let home = fields["home"]?.dictValue, Set(home.keys) == ["id", "name"],
              home["id"]?.stringValue == homeId, text(home["name"]), let target = fields["target"]?.dictValue,
              Set(target.keys) == [
                  "id",
                  "name",
                  "username",
                  "role_base",
                  "is_self",
                  "is_active",
                  "verification_status",
                  "start_at",
                  "end_at",
                  "access_start_at",
                  "access_end_at"
              ],
              target["id"]?.stringValue == targetId, target["is_self"] == .bool(targetId == actorId),
              target["is_active"]?.boolValue != nil, target["name"] == .null, text(target["username"]),
              text(target["verification_status"], limit: 100),
              ["start_at", "end_at", "access_start_at", "access_end_at"].allSatisfy({
                  target[$0] == .null || HomePostalValidation.date(target[$0])
              }) else { return false }
        if target["role_base"] == .null { return targetId == actorId }
        return ["owner", "admin", "manager", "lease_resident", "member", "restricted_member", "guest", "service_provider"]
            .contains(target["role_base"]?.stringValue ?? "")
    }

    static func text(_ value: JSONValue?, limit: Int = 2000) -> Bool {
        value == .null || (value?.stringValue.map { $0.utf16.count <= limit } ?? false)
    }

    static func targetLabel(_ summary: JSONValue) -> String {
        let username = summary.dictValue?["target"]?.dictValue?["username"]?.stringValue
        return username.flatMap { $0.isEmpty ? nil : $0 } ?? "Selected household member"
    }

    static func homeLabel(_ summary: JSONValue) -> String {
        let name = summary.dictValue?["home"]?.dictValue?["name"]?.stringValue
        return name.flatMap { $0.isEmpty ? nil : $0 } ?? "Selected Home"
    }
}

enum HomeMemberRemovalError: LocalizedError {
    case storage, changed, unknown, unavailable, sessionChanged, busy
    case refusal(String?)
    var errorDescription: String? {
        switch self {
        case .storage: "The protected original could not be read or saved. Reopen removal recovery before starting another action."
        case .changed: "The original or reviewed details changed. Reopen removal recovery to check the saved action."
        case .unknown: "The original removal result is not confirmed. Check its status, retry the original, or cancel its attempt."
        case .unavailable: "Current removal details are unavailable. Reopen to check again."
        case .sessionChanged: "Your session changed. Reopen removal recovery under the original account."
        case .busy: "Removal recovery is already working in another screen. Reopen it when that action finishes."
        case let .refusal(code): Self.message(code)
        }
    }

    static func message(_ code: String?) -> String {
        switch code {
        case "MEMBER_REMOVAL_CHANGED": "The reviewed member or Home changed. This original removal did not proceed."
        case "MEMBER_ALREADY_REMOVED": "This membership has no remaining removal action. Check the current member list."
        case "MEMBERS_MANAGE_REQUIRED", "TARGET_RANK_FORBIDDEN": "Current permission does not allow this removal."
        case "TRANSFER_REQUIRED": "Transfer this Home's ownership before leaving."
        case "OWNERSHIP_FLOW_REQUIRED": "This owner's access requires the dedicated ownership flow."
        case "MEMBER_ROLE_UNKNOWN": "The member's current role could not be verified."
        case "MEMBER_NOT_FOUND", "HOME_NOT_FOUND": "The selected member or Home is no longer available for removal."
        default: "This removal could not proceed. Check the current account and Home before starting another action."
        }
    }
}
