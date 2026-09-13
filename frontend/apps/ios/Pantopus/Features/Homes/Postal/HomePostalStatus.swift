import Foundation

/// A fresh read permits a next action, while every write rechecks admission on
/// the server. A historical mail receipt never asserts present household access.
struct HomePostalStatus: Equatable {
    let value: JSONValue
    var fields: [String: JSONValue] {
        value.dictValue ?? [:]
    }

    var postcard: [String: JSONValue]? {
        fields["postcard"]?.dictValue
    }

    var originalRequest: [String: JSONValue]? {
        fields["request"]?.dictValue
    }

    var canRequest: Bool {
        fields["can_request"]?.boolValue == true
    }

    var canResume: Bool {
        fields["can_resume"]?.boolValue == true
    }

    var canVerify: Bool {
        fields["can_verify"]?.boolValue == true
    }

    var restriction: String? {
        fields["restriction"]?.stringValue
    }

    func matches(_ scope: HomePostalScope) -> Bool {
        let row = fields
        guard scope.isValid, row["home_id"]?.stringValue == scope.homeId, row["actor_id"]?.stringValue == scope.actorId,
              HomePostalValidation.date(row["checked_at"]), row["current_access"]?.stringValue == "not_checked",
              ["can_request", "can_resume", "can_verify"].allSatisfy({ row[$0]?.boolValue != nil }),
              ["restriction", "restriction_message"].allSatisfy({ row[$0] == .null || row[$0]?.stringValue != nil }),
              validPostcard(), validOriginal(scope) else { return false }
        if canVerify {
            guard let postcard, postcard["status"]?.stringValue == "pending",
                  ["accepted", "unknown"].contains(postcard["delivery"]?.stringValue ?? ""),
                  (postcard["attempts_remaining"]?.numberValue ?? 0) > 0 else { return false }
        }
        if canResume {
            guard originalRequest != nil, let postcard, postcard["status"]?.stringValue == "pending",
                  postcard["delivery"]?.stringValue == "not_started" else { return false }
        }
        return !canRequest || (!canVerify && !canResume)
    }

    private func validPostcard() -> Bool {
        if fields["postcard"] == .null { return true }
        guard let postcard else { return false }
        return HomePostalValidation.uuid(postcard["id"]?.stringValue)
            && HomePostalValidation.date(postcard["requested_at"]) && HomePostalValidation.date(postcard["expires_at"])
            && ["pending", "verified", "expired", "cancelled"].contains(postcard["status"]?.stringValue ?? "")
            && ["not_started", "accepted", "unknown", "rejected"].contains(postcard["delivery"]?.stringValue ?? "")
            && HomePostalValidation.attempts(postcard["attempts_remaining"], maximum: 5)
    }

    private func validOriginal(_ scope: HomePostalScope) -> Bool {
        if fields["request"] == .null { return true }
        guard let originalRequest, let address = originalRequest["address"], HomePostalValidation.address(address) != nil,
              let id = originalRequest["command"]?.dictValue?["request_id"]?.stringValue,
              HomePostalValidation.uuid(id) else { return false }
        let original = PendingHomePostalCommand(
            scope: scope,
            requestId: id,
            kind: .mail,
            postcardId: nil,
            body: .object(["request_id": .string(id), "address": address])
        )
        let result = HomePostalOutcome(value: .object(originalRequest))
        return result.state == "completed" && result.matches(original)
            && originalRequest["postcard_id"]?.stringValue == postcard?["id"]?.stringValue
    }
}
