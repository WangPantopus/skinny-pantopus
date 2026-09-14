import Foundation

struct HomePostalScope: Codable, Equatable, Hashable {
    let origin: String
    let actorId: String
    let homeId: String

    var isValid: Bool {
        HomeCreationScope(origin: origin, actorId: actorId).isValid && HomePostalValidation.uuid(homeId)
    }
}

struct PendingHomePostalCommand: Codable, Equatable {
    enum Kind: String, Codable { case mail, code }
    let scope: HomePostalScope
    let requestId: String
    let kind: Kind
    let postcardId: String?
    let body: JSONValue
    var outcome: HomePostalOutcome?

    func matches(_ expected: HomePostalScope) -> Bool {
        guard scope == expected, scope.isValid, HomePostalValidation.uuid(requestId), let input = body.dictValue,
              input["request_id"]?.stringValue == requestId else { return false }
        switch kind {
        case .mail:
            guard postcardId == nil, Set(input.keys) == ["request_id", "address"],
                  HomePostalValidation.address(input["address"]) != nil else { return false }
        case .code:
            guard HomePostalValidation.uuid(postcardId), Set(input.keys) == ["request_id", "code"],
                  let code = input["code"]?.stringValue,
                  code.range(of: "^[a-zA-Z0-9]{6,8}$", options: .regularExpression) != nil else { return false }
        }
        return outcome == nil || outcome?.matches(self) == true
    }

    func hasSameIntent(as other: Self) -> Bool {
        scope == other.scope && requestId == other.requestId && kind == other.kind && postcardId == other.postcardId && body == other.body
    }
}

/// Only command identity and the recorded decision are retained. Provider
/// diagnostics and present-day admission never become a durable access grant.
struct HomePostalOutcome: Codable, Equatable {
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

    func matches(_ draft: PendingHomePostalCommand) -> Bool {
        let row = fields
        guard ["pending", "completed", "rejected", "cancelled"].contains(state),
              row["home_id"]?.stringValue == draft.scope.homeId, let command = row["command"]?.dictValue,
              command["actor_id"]?.stringValue == draft.scope.actorId, command["request_id"]?.stringValue == draft.requestId,
              HomePostalValidation.date(command["created_at"]), HomePostalValidation.date(command["updated_at"]) else { return false }
        if draft.kind == .code {
            guard row["postcard_id"]?.stringValue == draft.postcardId else { return false }
        } else if state == "completed" {
            guard HomePostalValidation.uuid(row["postcard_id"]?.stringValue) else { return false }
        } else {
            guard row["postcard_id"] == .null else { return false }
        }
        if state == "rejected" {
            guard let code,
                  code.range(of: "^(POSTCARD_[A-Z_]+|HOME_NOT_FOUND|OWNERSHIP_FLOW_REQUIRED)$", options: .regularExpression) != nil else {
                return false
            }
            if code == "POSTCARD_WRONG_CODE", !HomePostalValidation.attempts(row["attempts_remaining"], maximum: 4) { return false }
        } else if row["code"] != nil { return false }
        if draft.kind == .code, state == "completed" {
            let provisional = row["verification_status"]?.stringValue == "provisional"
            return ["verified", "provisional"].contains(row["verification_status"]?.stringValue ?? "")
                && HomePostalValidation.date(row["recorded_at"]) && row["current_access"]?.stringValue == "not_checked"
                && (row["challenge_window_ends_at"] == .null || (provisional && HomePostalValidation.date(row["challenge_window_ends_at"])))
        }
        return row["verification_status"] == nil && row["recorded_at"] == nil && row["challenge_window_ends_at"] == nil
    }

    func projected() -> Self {
        let retained = [
            "state",
            "home_id",
            "postcard_id",
            "code",
            "attempts_remaining",
            "verification_status",
            "recorded_at",
            "challenge_window_ends_at",
            "current_access"
        ]
        var result = fields.filter { retained.contains($0.key) }
        if let command = fields["command"]?.dictValue {
            result["command"] = .object(command.filter { ["actor_id", "request_id", "created_at", "updated_at"].contains($0.key) })
        }
        return Self(value: .object(result))
    }

    func hasSameDecision(as other: Self) -> Bool {
        projected() == other.projected()
    }
}

enum HomePostalValidation {
    static func uuid(_ value: String?) -> Bool {
        value.flatMap(UUID.init(uuidString:)) != nil
    }

    static func date(_ value: JSONValue?) -> Bool {
        guard let text = value?.stringValue else { return false }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if formatter.date(from: text) != nil { return true }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: text) != nil
    }

    static func attempts(_ value: JSONValue?, maximum: Double) -> Bool {
        guard let number = value?.numberValue else { return false }
        return number.isFinite && number.rounded() == number && number >= 0 && number <= maximum
    }

    static func address(_ value: JSONValue?) -> HomeResidencyAddressSnapshot? {
        guard let value, let fields = value.dictValue,
              Set(fields.keys) == ["line1", "line2", "city", "state", "postal_code", "country"],
              let data = try? JSONEncoder().encode(value),
              let address = try? JSONDecoder().decode(HomeResidencyAddressSnapshot.self, from: data), address.isValid else { return nil }
        return address
    }
}

enum HomePostalError: LocalizedError {
    case storage, changed, busy, unknown, unavailable, sessionChanged
    var errorDescription: String? {
        switch self {
        case .storage: "The original postal request could not be read or saved. Keep it and retry recovery before starting another."
        case .changed: "A different postal request is saved. Reopen mail verification to recover that request."
        case .busy: "Your original postal request is still being checked. Try again shortly."
        case .unknown: "The result is not confirmed. Your original details are kept. " +
            "Check again, retry the same request, or confirm cancellation."
        case .unavailable: "Mail verification status could not be checked. Please retry."
        case .sessionChanged: "Your session changed. Reopen mail verification to recover your saved request."
        }
    }
}
