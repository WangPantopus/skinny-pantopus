import Foundation
@testable import Pantopus

enum HomeResidencyHistoryFixtures {
    static let home = "00000000-0000-4000-8000-000000000001"
    static let actor = "00000000-0000-4000-8000-000000000002"
    static let applicant = "00000000-0000-4000-8000-000000000003"
    static let identity = HomeResidencyHistoryIdentity(homeId: home, actorId: actor)
    static let session = HomeResidencyHistorySession(actorId: actor, scope: String(repeating: "a", count: 64))
    static let date = "2026-09-13T01:02:03.123456Z"
    static var sessionJSON: JSONValue {
        .object(["actor_id": .string(actor), "session_scope": .string(session.scope)])
    }

    static func id(_ index: Int) -> String {
        String(format: "00000000-0000-4000-8000-%012d", index + 100)
    }

    static func item(_ index: Int = 0, approved: Bool = false) -> JSONValue {
        .object([
            "decision": .object([
                "id": .string(id(index)), "home_id": .string(home), "actor_id": .string(actor),
                "claim_id": .string(id(100)), "action": .string(approved ? "approve" : "reject"),
                "created_at": .string(date), "legacy_request": .bool(false),
                "result": .object([
                    "status": .string(approved ? "verified" : "rejected"), "reviewed_at": .string(date),
                    "occupancy_id": approved ? .string(id(200)) : .null, "role_base": approved ? .string("member") : .null
                ])
            ]),
            "current": .object([
                "claim_status": .string("pending"), "applicant_lookup": .string("current_claim_reference"),
                "applicant": .object(["id": .string(applicant), "username": .string("current_person"), "name": .null]),
                "household_access": .string("not_checked")
            ])
        ])
    }

    static func cursor(
        _ index: Int,
        date: String = HomeResidencyHistoryFixtures.date,
        actor: String = HomeResidencyHistoryFixtures.actor,
        home: String = HomeResidencyHistoryFixtures.home
    ) -> String {
        let text = "{\"version\":1,\"actor_id\":\"\(actor)\",\"home_id\":\"\(home)\",\"created_at\":\"\(date)\",\"id\":\"\(id(index))\"}"
        return base64(text)
    }

    static func base64(_ value: String) -> String {
        Data(value.utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func page(_ items: [JSONValue] = [item()], next: JSONValue = .null) -> JSONValue {
        .object(["home_id": .string(home), "actor_id": .string(actor), "session": sessionJSON, "items": .array(items), "next_cursor": next])
    }

    static func detail(_ value: JSONValue = item()) -> JSONValue {
        .object(["home_id": .string(home), "actor_id": .string(actor), "session": sessionJSON, "item": value])
    }

    static func changing(_ value: JSONValue, at keys: [String], to replacement: JSONValue?) -> JSONValue {
        guard let first = keys.first, case var .object(fields) = value else { return value }
        if keys.count == 1 { fields[first] = replacement } else {
            fields[first] = changing(fields[first] ?? .null, at: Array(keys.dropFirst()), to: replacement)
        }
        return .object(fields)
    }

    static func text(_ value: JSONValue) throws -> String {
        let data = try JSONEncoder().encode(value)
        guard let text = String(bytes: data, encoding: .utf8) else { throw HomeResidencyHistoryError.unavailable }
        return text
    }

    static func parsedPage(_ items: [JSONValue] = [item()], next: JSONValue = .null) throws -> HomeResidencyHistoryPage {
        try HomeResidencyHistoryPage.parse(page(items, next: next), identity: identity, session: session, after: nil)
    }
}
