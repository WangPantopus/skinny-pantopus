import XCTest
@testable import Pantopus

@MainActor
final class MemoryHomeCreationStore: PendingHomeCreationStoring {
    var saved: PendingHomeCreation?
    var failRead = false
    var failWrite = false

    func load(scope _: HomeCreationScope) throws -> PendingHomeCreation? {
        if failRead { throw HomeCreationRecoveryError.storage }
        return saved
    }

    func replace(scope _: HomeCreationScope, expected: PendingHomeCreation?, next: PendingHomeCreation?) throws {
        guard !failWrite, saved == expected else { throw HomeCreationRecoveryError.storage }
        saved = next
    }
}

@MainActor
final class HomeCreationRecoveryTests: XCTestCase {
    private let scope = HomeCreationScope(origin: "https://creation.example", actorId: "ddc24100-0000-4000-8000-000000000001")
    private let id = "ddc24100-0000-4000-8000-000000000002"

    private func coordinator(
        store: MemoryHomeCreationStore,
        transport: Transport,
        current: @escaping () throws -> Void = {}
    ) -> HomeCreationCoordinator {
        HomeCreationCoordinator(scope: scope, store: store, transport: transport, requireCurrent: current) { self.id }
    }

    private func prepare(_ coordinator: HomeCreationCoordinator) throws {
        var form = AddHomeFormState.empty
        form.address = AddHomeAddressFields(street: "12 Example St", unit: "", city: "Portland", state: "OR", zipCode: "97214")
        form.role = .owner
        try coordinator.prepare(
            request: CreateHomeRequest(
                address: form.address.street,
                city: form.address.city,
                state: form.address.state,
                zipCode: form.address.zipCode,
                latitude: 45.51,
                longitude: -122.6,
                isOwner: true,
                role: "owner",
                addressId: "ddc24100-0000-4000-8000-000000000010"
            ),
            form: form,
            accessItems: [AddHomeAccessItem(accessType: .wifi, label: "Example network", secretValue: "synthetic-test-password")]
        )
    }

    func testLostReplyAndProcessRestartRetryExactProtectedCommand() async throws {
        let store = MemoryHomeCreationStore()
        let transport = Transport()
        let first = coordinator(store: store, transport: transport)
        try prepare(first)
        let original = try XCTUnwrap(store.saved)
        transport.handler = { _, _ in throw HomeCreationRecoveryError.unavailable }
        do { _ = try await first.resolve(.submit)
            XCTFail("Expected a lost reply")
        } catch {}
        let reopened = coordinator(store: store, transport: transport)
        try reopened.restore()
        XCTAssertEqual(reopened.pending, original)
        transport.handler = { draft, _ in Self.outcome(draft, state: .completed) }
        _ = try await reopened.resolve(.submit)
        XCTAssertEqual(transport.requests.map(\.0.body), [original.body, original.body])
        XCTAssertEqual(reopened.outcome?.state, .completed)
        XCTAssertNotNil(store.saved, "Completion stays protected until acknowledgement")
        try reopened.acknowledge()
        XCTAssertNil(store.saved)
    }

    func testPrepareStorageFailureNeverSendsAndReadFailureBlocksReplacement() {
        let store = MemoryHomeCreationStore()
        let transport = Transport()
        let subject = coordinator(store: store, transport: transport)
        store.failWrite = true
        XCTAssertThrowsError(try prepare(subject))
        XCTAssertTrue(transport.requests.isEmpty)
        store.failWrite = false
        store.failRead = true
        XCTAssertThrowsError(try prepare(subject))
        XCTAssertThrowsError(try subject.restore())
        XCTAssertTrue(transport.requests.isEmpty)
    }

    func testFailedOutcomeWriteRetainsObservedCompletionWithoutRepeatingPost() async throws {
        let store = MemoryHomeCreationStore()
        let transport = Transport()
        let subject = coordinator(store: store, transport: transport)
        try prepare(subject)
        transport.handler = { draft, _ in
            store.failWrite = true
            return Self.outcome(draft, state: .completed)
        }
        do { _ = try await subject.resolve(.submit)
            XCTFail("Expected unavailable storage")
        } catch {}
        XCTAssertEqual(subject.outcome?.state, .completed)
        XCTAssertNil(store.saved?.outcome)
        subject.hide()
        store.failWrite = false
        _ = try await subject.resolve(.cancel)
        XCTAssertEqual(transport.requests.count, 1)
        XCTAssertEqual(store.saved?.outcome?.state, .completed)
    }

    func testCancellationMustBeConfirmedBeforeEditingOrDiscarding() async throws {
        let store = MemoryHomeCreationStore()
        let transport = Transport()
        let subject = coordinator(store: store, transport: transport)
        try prepare(subject)
        transport.handler = { draft, _ in Self.outcome(draft, state: .pending) }
        _ = try await subject.resolve(.cancel)
        XCTAssertThrowsError(try subject.acknowledge())
        transport.handler = { draft, _ in Self.outcome(draft, state: .cancelled) }
        _ = try await subject.resolve(.cancel)
        try subject.acknowledge()
        XCTAssertNil(store.saved)
    }

    func testBackgroundAndAccountChangesRetireLateOutcomeButKeepOriginal() async throws {
        let store = MemoryHomeCreationStore()
        let transport = Transport()
        var current = true
        let subject = coordinator(store: store, transport: transport) {
            if !current { throw HomeCreationRecoveryError.sessionChanged }
        }
        try prepare(subject)
        transport.handler = { draft, _ in
            subject.hide()
            return Self.outcome(draft, state: .completed)
        }
        do { _ = try await subject.resolve(.submit)
            XCTFail("Background reply must retire")
        } catch {}
        XCTAssertNil(subject.pending)
        XCTAssertNil(store.saved?.outcome)
        transport.handler = { draft, _ in
            current = false
            return Self.outcome(draft, state: .completed)
        }
        do { _ = try await subject.resolve(.check)
            XCTFail("Other session must not see outcome")
        } catch {}
        XCTAssertNil(store.saved?.outcome)
    }

    func testOtherScreenCompletionReplacesPendingButDifferentIntentCannotBeCleared() async throws {
        let store = MemoryHomeCreationStore()
        let transport = Transport()
        let subject = coordinator(store: store, transport: transport)
        try prepare(subject)
        transport.handler = { draft, _ in Self.outcome(draft, state: .pending) }
        _ = try await subject.resolve(.submit)
        var saved = try XCTUnwrap(store.saved)
        saved.outcome = Self.outcome(saved, state: .completed)
        store.saved = saved
        try subject.restore()
        XCTAssertEqual(subject.outcome?.state, .completed)
        var changed = saved.body.dictValue ?? [:]
        changed["name"] = .string("Changed elsewhere")
        store.saved = PendingHomeCreation(scope: scope, requestId: id, body: .object(changed), form: saved.form)
        XCTAssertThrowsError(try subject.acknowledge())
        XCTAssertNotNil(store.saved)
    }

    func testMalformedOrWrongAccountOutcomeCannotAuthorizeCompletion() throws {
        let store = MemoryHomeCreationStore()
        let subject = coordinator(store: store, transport: Transport())
        try prepare(subject)
        let draft = try XCTUnwrap(store.saved)
        let bytes = try JSONEncoder().encode(Self.outcome(draft, state: .completed))
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
        object["access_secret_ids"] = []
        let malformed = try JSONDecoder().decode(HomeCreationOutcome.self, from: JSONSerialization.data(withJSONObject: object))
        XCTAssertFalse(malformed.matches(draft), "Optional access setup must be part of the outcome")
        object["access_secret_ids"] = ["ddc24100-0000-4000-8000-000000000103"]
        object["command"] = [
            "actor_id": "ddc24100-0000-4000-8000-000000000999",
            "request_id": id,
            "created_at": "2026-09-11T00:00:00Z",
            "updated_at": "2026-09-11T00:00:00Z"
        ]
        let foreign = try JSONDecoder().decode(HomeCreationOutcome.self, from: JSONSerialization.data(withJSONObject: object))
        XCTAssertFalse(foreign.matches(draft))
    }

    private static func outcome(_ draft: PendingHomeCreation, state: HomeCreationOutcome.State) -> HomeCreationOutcome {
        let completed = state == .completed
        return HomeCreationOutcome(
            state: state,
            command: .init(
                actorId: draft.scope.actorId,
                requestId: draft.requestId,
                createdAt: "2026-09-11T00:00:00Z",
                updatedAt: "2026-09-11T00:00:00Z"
            ),
            home: completed ? .init(id: "ddc24100-0000-4000-8000-000000000101") : nil,
            ownershipClaimId: completed ? "ddc24100-0000-4000-8000-000000000102" : nil,
            accessSecretIds: completed ? ["ddc24100-0000-4000-8000-000000000103"] : nil,
            role: completed ? "owner" : nil,
            requiresVerification: completed ? true : nil,
            verificationType: completed ? "ownership" : nil,
            currentAccess: completed ? "not_checked" : nil,
            code: nil,
            error: nil,
            message: nil
        )
    }

    @MainActor
    private final class Transport: HomeCreationTransport {
        var requests: [(PendingHomeCreation, HomeCreationAction)] = []
        var handler: ((PendingHomeCreation, HomeCreationAction) async throws -> HomeCreationOutcome)?
        func resolve(_ draft: PendingHomeCreation, action: HomeCreationAction) async throws -> HomeCreationOutcome {
            requests.append((draft, action))
            guard let handler else { throw HomeCreationRecoveryError.unavailable }
            return try await handler(draft, action)
        }
    }
}
