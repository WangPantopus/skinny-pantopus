import XCTest
@testable import Pantopus

@MainActor
final class HomePostalRecoveryTests: XCTestCase {
    private let scope = HomePostalScope(
        origin: "https://postal.example",
        actorId: "ddc24200-0000-4000-8000-000000000001",
        homeId: "ddc24200-0000-4000-8000-000000000002"
    )
    private let postcardId = "ddc24200-0000-4000-8000-000000000003"

    func testLostCodeReplyAndFailedProofWriteRecoverOriginalWithoutAnotherGuess() async throws {
        let store = Store()
        let transport = Transport()
        let first = coordinator(store, transport)
        try first.prepareCode("ABC123", postcardId: postcardId)
        let original = try XCTUnwrap(store.saved)
        do { _ = try await first.resolve(.submit)
            XCTFail("A lost reply must remain recoverable")
        } catch {}
        let restarted = coordinator(store, transport)
        try restarted.restore()
        XCTAssertEqual(restarted.pending, original)
        transport.handler = { draft in
            store.failWrite = true
            return Self.receipt(draft)
        }
        do { _ = try await restarted.resolve(.check)
            XCTFail("A result must remain recoverable when proof storage fails")
        } catch {}
        XCTAssertEqual(restarted.outcome?.state, "completed")
        XCTAssertNil(store.saved?.outcome)
        restarted.hide()
        store.failWrite = false
        _ = try await restarted.resolve(.cancel)
        XCTAssertEqual(transport.actions, [.submit, .check], "Saving known proof cannot spend another code attempt")
        XCTAssertEqual(transport.requests.map(\.body), [original.body, original.body])
        _ = try restarted.acknowledge()
        XCTAssertNil(store.saved)
    }

    func testDifferentCardOrAccountAndCurrentAccessGrantCannotBecomeProof() throws {
        let store = Store()
        let subject = coordinator(store, Transport())
        try subject.prepareCode("ABC123", postcardId: postcardId)
        let draft = try XCTUnwrap(store.saved)
        let original = Self.receipt(draft)
        XCTAssertTrue(original.matches(draft))
        for (key, value) in [
            ("postcard_id", "ddc24200-0000-4000-8000-000000000999"),
            ("home_id", "ddc24200-0000-4000-8000-000000000999"),
            ("current_access", "shared")
        ] {
            var fields = original.fields
            fields[key] = .string(value)
            XCTAssertFalse(HomePostalOutcome(value: .object(fields)).matches(draft))
        }
        var fields = original.fields
        var command = try XCTUnwrap(fields["command"]?.dictValue)
        command["actor_id"] = .string("ddc24200-0000-4000-8000-000000000999")
        fields["command"] = .object(command)
        XCTAssertFalse(HomePostalOutcome(value: .object(fields)).matches(draft))
    }

    private func coordinator(_ store: Store, _ transport: Transport) -> HomePostalCoordinator {
        HomePostalCoordinator(scope: scope, store: store, transport: transport) {}
    }

    private static func receipt(_ draft: PendingHomePostalCommand) -> HomePostalOutcome {
        HomePostalOutcome(value: .object([
            "state": .string("completed"), "home_id": .string(draft.scope.homeId),
            "postcard_id": .string(draft.postcardId ?? ""), "verification_status": .string("provisional"),
            "recorded_at": .string("2026-09-12T00:00:00Z"), "challenge_window_ends_at": .string("2026-09-19T00:00:00Z"),
            "current_access": .string("not_checked"), "command": .object([
                "actor_id": .string(draft.scope.actorId), "request_id": .string(draft.requestId),
                "created_at": .string("2026-09-12T00:00:00Z"), "updated_at": .string("2026-09-12T00:00:00Z")
            ])
        ]))
    }

    private final class Store: PendingHomePostalStoring {
        var saved: PendingHomePostalCommand?
        var failWrite = false
        func load(scope _: HomePostalScope) throws -> PendingHomePostalCommand? {
            saved
        }

        func replace(scope _: HomePostalScope, expected: PendingHomePostalCommand?, next: PendingHomePostalCommand?) throws {
            guard !failWrite, saved == expected else { throw HomePostalError.storage }
            saved = next
        }
    }

    private final class Transport: HomePostalTransport {
        var requests: [PendingHomePostalCommand] = []
        var actions: [HomePostalAction] = []
        var handler: ((PendingHomePostalCommand) throws -> HomePostalOutcome)?
        func resolve(_ draft: PendingHomePostalCommand, action: HomePostalAction) async throws -> HomePostalOutcome {
            requests.append(draft)
            actions.append(action)
            guard let handler else { throw HomePostalError.unknown }
            return try handler(draft)
        }
    }
}
