import KeychainAccess
import XCTest
@testable import Pantopus

@MainActor
final class HomeMemberRemovalModelTests: XCTestCase {
    private let actor = "ddc25400-0000-4000-8000-000000000001"
    private let user = "ddc25400-0000-4000-8000-000000000002"
    private let home = "ddc25400-0000-4000-8000-000000000003"
    private let occupancy = "ddc25400-0000-4000-8000-000000000004"
    private let request = "ddc25400-0000-4000-8000-000000000005"
    private let date = "2026-09-13T00:00:00Z"
    private var scope: HomeCreationScope {
        .init(origin: "https://example.invalid", actorId: actor)
    }

    private var session: JSONValue {
        .object(["actor_id": .string(actor), "session_scope": .string(String(repeating: "c", count: 64))])
    }

    private var fields: [String: JSONValue] {
        [
            "request_id": .string(request),
            "home_id": .string(home),
            "target_user_id": .string(user),
            "occupancy_id": .string(occupancy),
            "action": .string("remove"),
            "decision_token": .string(String(repeating: "b", count: 64))
        ]
    }

    private var member: [String: JSONValue] {
        [
            "id": .string(user),
            "name": .null,
            "username": .string("reviewed_member"),
            "role_base": .string("member"),
            "is_self": .bool(false),
            "is_active": .bool(true),
            "verification_status": .string("verified"),
            "start_at": .string(date),
            "end_at": .null,
            "access_start_at": .null,
            "access_end_at": .null
        ]
    }

    private func summary(_ target: [String: JSONValue]? = nil) -> JSONValue {
        .object(["home": .object(["id": .string(home), "name": .string("Reviewed Home")]), "target": .object(target ?? member)])
    }

    private func original() throws -> PendingHomeMemberRemoval {
        try PendingHomeMemberRemoval(scope: scope, bodyData: HomeMemberRemovalValidation.encode(.object(fields)), review: summary())
    }

    private func outcome(state: String = "completed", code: String? = nil) -> HomeMemberRemovalOutcome {
        var row = fields.filter { $0.key != "request_id" }
        row["state"] = .string(state)
        row["completed_at"] = state == "completed" ? .string(date) : .null
        row["code"] = code.map(JSONValue.string) ?? .null
        row["status"] = code.flatMap { HomeMemberRemovalValidation.rejections[$0] }.map { .number(Double($0)) } ?? .null
        row["session"] = session
        row["command"] = .object([
            "actor_id": .string(actor), "request_id": .string(request), "created_at": .string(date), "updated_at": .string(date)
        ])
        return .init(value: .object(row))
    }

    func testAllCanonicalRolesAndUnknownSelfRoleRequireExactTypedReview() {
        for role in ["owner", "admin", "manager", "lease_resident", "member", "restricted_member", "guest", "service_provider"] {
            var target = member
            target["role_base"] = .string(role)
            XCTAssertTrue(HomeMemberRemovalValidation.summary(summary(target), homeId: home, targetId: user, actorId: actor), role)
        }
        for invalid in [JSONValue.null, .string("tenant"), .string("unknown"), .array([.string("member")]), .bool(true)] {
            var target = member
            target["role_base"] = invalid
            XCTAssertFalse(HomeMemberRemovalValidation.summary(summary(target), homeId: home, targetId: user, actorId: actor))
        }
        var target = member
        target["id"] = .string(actor)
        target["is_self"] = .bool(true)
        target["role_base"] = .null
        XCTAssertTrue(HomeMemberRemovalValidation.summary(summary(target), homeId: home, targetId: actor, actorId: actor))
        target["is_self"] = .bool(false)
        XCTAssertFalse(HomeMemberRemovalValidation.summary(summary(target), homeId: home, targetId: actor, actorId: actor))
    }

    func testPrivateProfileExtraFieldsMalformedDatesAndBooleanCoercionAreRejected() {
        let mutations: [(String, JSONValue)] = [
            ("name", .string("Private account name")), ("email", .string("private@example.invalid")),
            ("username", .array([.string("member")])), ("is_active", .string("true")), ("is_self", .number(0)),
            ("start_at", .string("not-a-date")), ("end_at", .bool(false)), ("access_end_at", .array([])),
            ("verification_status", .string(String(repeating: "x", count: 101)))
        ]
        for (key, value) in mutations {
            var target = member
            target[key] = value
            XCTAssertFalse(HomeMemberRemovalValidation.summary(summary(target), homeId: home, targetId: user, actorId: actor), key)
        }
        var target = member
        target.removeValue(forKey: "end_at")
        XCTAssertFalse(HomeMemberRemovalValidation.summary(summary(target), homeId: home, targetId: user, actorId: actor))
    }

    func testContextBindsActorHomeTargetOccupancyAndStrictShape() {
        var row = fields.filter { $0.key != "request_id" }
        row.merge(summary().dictValue ?? [:]) { _, new in new }
        row["session"] = session
        let target = HomeMemberRemovalTarget(homeId: home, userId: user)
        let sessionId = String(repeating: "c", count: 64)
        XCTAssertTrue(HomeMemberRemovalContext(value: .object(row)).matches(target, scope: scope, session: sessionId))
        for (key, value) in [
            ("home_id", JSONValue.string(user)), ("target_user_id", .string(actor)), ("occupancy_id", .string("invalid")),
            ("action", .array([.string("remove")])), ("decision_token", .string("invalid")), ("email", .string("private@example.invalid"))
        ] {
            var bad = row
            bad[key] = value
            XCTAssertFalse(HomeMemberRemovalContext(value: .object(bad)).matches(target, scope: scope, session: sessionId), key)
        }
        XCTAssertFalse(HomeMemberRemovalContext(value: .object(row)).matches(
            target,
            scope: scope,
            session: String(repeating: "d", count: 64)
        ))
    }

    func testHistoricalReceiptRequiresEveryOriginalIdentityAndConsistentStateStatus() throws {
        let original = try original()
        XCTAssertTrue(original.matches(scope))
        XCTAssertTrue(outcome().matches(original))
        for state in ["cancelled", "pending"] {
            XCTAssertTrue(outcome(state: state).matches(original))
        }
        for (code, status) in HomeMemberRemovalValidation.rejections {
            let receipt = outcome(state: "rejected", code: code)
            XCTAssertTrue(receipt.matches(original), code)
            XCTAssertEqual(receipt.expectedStatus, status)
        }
        let mutations: [(String, JSONValue)] = [
            ("home_id", .string(user)), ("target_user_id", .string(actor)), ("occupancy_id", .string(user)),
            ("action", .string("withdraw")), ("decision_token", .string(String(repeating: "d", count: 64))),
            ("state", .array([.string("completed")])), ("completed_at", .null), ("completed_at", .string("bad-date")),
            ("code", .string("MEMBER_REMOVAL_CHANGED")), ("status", .number(200)), ("private_record", .object([:])),
            ("replayed", .string("true"))
        ]
        for (key, value) in mutations {
            var row = outcome().fields
            row[key] = value
            XCTAssertFalse(HomeMemberRemovalOutcome(value: .object(row)).matches(original), key)
        }
        for field in ["actor_id", "request_id", "created_at", "updated_at"] {
            var row = outcome().fields
            var command = row["command"]?.dictValue ?? [:]
            command[field] = .string("wrong")
            row["command"] = .object(command)
            XCTAssertFalse(HomeMemberRemovalOutcome(value: .object(row)).matches(original), field)
        }
        var row = outcome(state: "rejected", code: "MEMBER_REMOVAL_CHANGED").fields
        row["status"] = .number(403)
        XCTAssertFalse(HomeMemberRemovalOutcome(value: .object(row)).matches(original))
        row["status"] = .bool(true)
        XCTAssertFalse(HomeMemberRemovalOutcome(value: .object(row)).matches(original))
        row["code"] = .string("MEMBER_REMOVAL_CONFLICT")
        row["status"] = .number(409)
        XCTAssertFalse(HomeMemberRemovalOutcome(value: .object(row)).matches(original), "Nonreceipt error must not erase an original")
    }

    func testStoredProofExcludesLiveSessionAndCannotReplaceOriginalIntent() throws {
        var draft = try original()
        draft.outcome = outcome()
        XCTAssertFalse(draft.matches(scope))
        draft.outcome = outcome().projected()
        XCTAssertTrue(draft.matches(scope))
        var body = fields
        body["target_user_id"] = .string(actor)
        let changed = try PendingHomeMemberRemoval(
            scope: scope,
            bodyData: HomeMemberRemovalValidation.encode(.object(body)),
            review: summary()
        )
        XCTAssertFalse(changed.matches(scope))
        let other = HomeCreationScope(origin: "https://other.invalid", actorId: actor)
        XCTAssertFalse(draft.matches(other))
    }

    func testDeviceOnlyKeychainReopenCompetingWriterAndCorruptionPreserveOriginal() throws {
        let service = "app.pantopus.tests.member-removal." + UUID().uuidString
        let keychain = Keychain(service: service).accessibility(.whenUnlockedThisDeviceOnly).synchronizable(false)
        defer { try? keychain.removeAll() }
        let original = try original()
        let first = PendingHomeMemberRemovalStore(service: service)
        try first.replace(scope: scope, expected: nil, next: original)
        let reopened = PendingHomeMemberRemovalStore(service: service)
        XCTAssertEqual(try reopened.load(scope: scope), original)
        XCTAssertNil(try reopened.load(scope: HomeCreationScope(origin: scope.origin, actorId: user)))
        XCTAssertNil(try reopened.load(scope: HomeCreationScope(origin: "https://other.invalid", actorId: actor)))
        XCTAssertThrowsError(try reopened.replace(scope: scope, expected: nil, next: original))
        let key = PendingHomeMemberRemovalStore.key(scope)
        let bytes = try XCTUnwrap(keychain.getData(key))
        for corrupt in ["false", "[]", "null", "{damaged-original"] {
            let data = Data(corrupt.utf8)
            try keychain.set(data, key: key)
            XCTAssertThrowsError(try reopened.load(scope: scope))
            XCTAssertThrowsError(try reopened.replace(scope: scope, expected: nil, next: original))
            XCTAssertThrowsError(try reopened.replace(scope: scope, expected: original, next: nil))
            XCTAssertEqual(try keychain.getData(key), data)
        }
        try keychain.set(bytes, key: key)
        XCTAssertEqual(try reopened.load(scope: scope), original)
        try reopened.replace(scope: scope, expected: original, next: nil)
        XCTAssertNil(try first.load(scope: scope))
    }
}
