import Foundation
@testable import Pantopus

enum HomeResidencyQueueFixtures {
    static let home = "00000000-0000-4000-8000-000000000001"
    static let actor = "00000000-0000-4000-8000-000000000002"
    static let applicant = "00000000-0000-4000-8000-000000000003"
    static let claim = "00000000-0000-4000-8000-000000000004"
    static let identity = HomeResidencyQueueIdentity(homeId: home, actorId: actor)
    static let session = HomeResidencyQueueSession(actorId: actor, scope: String(repeating: "a", count: 64))
    static let date = "2026-09-13T01:02:03.123456Z"
    static var sessionJSON: JSONValue {
        .object(["actor_id": .string(actor), "session_scope": .string(session.scope)])
    }

    static var item: JSONValue {
        .object([
            "id": .string(claim), "home_id": .string(home), "user_id": .string(applicant), "status": .string("pending"),
            "created_at": .string(date), "claimed_role": .string("renter"),
            "claimant": .object(["id": .string(applicant), "username": .string("public_handle"), "name": .null])
        ])
    }

    static func page(_ claims: [JSONValue] = [item]) -> JSONValue {
        .object([
            "home_id": .string(home), "actor_id": .string(actor), "claims": .array(claims),
            "residency_session": .object(["home_id": .string(home), "actor_id": .string(actor), "session_scope": .string(session.scope)])
        ])
    }

    static func parsedPage() throws -> HomeResidencyQueuePage {
        try HomeResidencyQueuePage.parse(page(), identity: identity, session: session)
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
        guard let text = String(bytes: data, encoding: .utf8) else { throw HomeResidencyQueueError.unavailable }
        return text
    }
}
