import XCTest
@testable import Pantopus

@MainActor
final class HomeResidencyReviewRecoveryTests: XCTestCase {
    private let scope = HomeResidencyReviewScope(
        origin: "http://127.0.0.1:18084",
        actorId: "ddc23600-0000-4000-8000-000000000001",
        homeId: "ddc23600-0000-4000-8000-000000000100"
    )
    private let claim = "ddc23600-0000-4000-8000-000000000202"

    func testKnownReceiptRepairsFailedStorageWithoutAnotherDecision() async throws {
        let store = Store()
        let transport = Transport()
        let coordinator = make(store, transport)
        try await coordinator.open(requestedClaim: claim)
        store.rejectWrite = true
        XCTAssertThrowsError(try coordinator.prepare(action: .approve, role: .member, reason: ""))
        XCTAssertNil(store.value)
        XCTAssertEqual(transport.decisions.count, 0)
        store.rejectWrite = false
        try coordinator.prepare(action: .approve, role: .member, reason: "")
        let original = try XCTUnwrap(store.value)
        store.rejectProof = true
        do { try await coordinator.resolve()
            XCTFail("A failed proof write must remain recoverable")
        } catch {}
        XCTAssertEqual(transport.decisions.count, 1)
        XCTAssertNotNil(coordinator.receipt)
        XCTAssertNil(store.value?.receipt)
        XCTAssertEqual(store.value?.body, original.body)
        coordinator.hide()
        try await coordinator.open(requestedClaim: claim)
        store.rejectProof = false
        try await coordinator.resolve()
        XCTAssertEqual(transport.decisions.count, 1)
        XCTAssertNotNil(store.value?.receipt)
        try await coordinator.acknowledge(requestedClaim: nil)
        XCTAssertNil(store.value)
        XCTAssertNil(coordinator.pending)
    }

    func testRetiredPreflightKeepsOriginalWithoutPostingOrReplacingMissingStorage() async throws {
        let store = Store()
        let transport = Transport()
        let coordinator = make(store, transport)
        try await coordinator.open(requestedClaim: claim)
        try coordinator.prepare(action: .reject, role: .member, reason: "Original reviewed reason")
        let original = try XCTUnwrap(store.value)
        transport.holdNextRead = true
        let task = Task { try await coordinator.resolve() }
        for _ in 0..<100 where transport.release == nil {
            await Task.yield()
        }
        XCTAssertNotNil(transport.release)
        coordinator.hide()
        transport.release?.resume()
        transport.release = nil
        do { try await task.value
            XCTFail("A retired preflight must not submit")
        } catch {}
        XCTAssertEqual(transport.decisions.count, 0)
        XCTAssertEqual(store.value, original)
        try await coordinator.open(requestedClaim: claim)
        store.value = nil
        do { try await coordinator.open(requestedClaim: claim)
            XCTFail("Unexpected loss of the unacknowledged original must fail closed")
        } catch {}
        XCTAssertThrowsError(try coordinator.prepare(action: .approve, role: .guest, reason: ""))
        XCTAssertEqual(transport.decisions.count, 0)
    }

    func testMismatchedProofCannotConfirmTheOriginal() async throws {
        let store = Store()
        let transport = Transport()
        transport.wrongActor = true
        let coordinator = make(store, transport)
        try await coordinator.open(requestedClaim: claim)
        try coordinator.prepare(action: .approve, role: .member, reason: "")
        let original = store.value
        do { try await coordinator.resolve()
            XCTFail("A different actor's proof cannot confirm this decision")
        } catch {}
        XCTAssertNil(coordinator.receipt)
        XCTAssertEqual(store.value, original)
    }

    private func make(_ store: Store, _ transport: Transport) -> HomeResidencyReviewCoordinator {
        HomeResidencyReviewCoordinator(scope: scope, store: store, transport: transport) {}
    }

    private final class Store: PendingHomeResidencyReviewStoring {
        var value: PendingHomeResidencyReview?
        var rejectWrite = false
        var rejectProof = false
        func load(scope _: HomeResidencyReviewScope) throws -> PendingHomeResidencyReview? {
            value
        }

        func replace(scope _: HomeResidencyReviewScope, expected: PendingHomeResidencyReview?, next: PendingHomeResidencyReview?) throws {
            guard value == expected else { throw HomeResidencyReviewError.changed }
            if rejectWrite || (rejectProof && next?.receipt != nil) { throw HomeResidencyReviewError.storage }
            value = next
        }
    }

    private final class Transport: HomeResidencyReviewTransport {
        var decisions: [PendingHomeResidencyReview] = []
        var wrongActor = false
        var holdNextRead = false
        var release: CheckedContinuation<Void, Never>?
        private let stamp = "2026-09-12T12:00:00Z"
        private let token = String(repeating: "a", count: 64)

        func read(scope: HomeResidencyReviewScope, claimId: String, sessionScope _: String?) async throws -> HomeResidencyCurrentReview {
            if holdNextRead { holdNextRead = false
                await withCheckedContinuation { release = $0 }
            }
            return HomeResidencyCurrentReview(value: .object([
                "ok": .bool(true), "home_id": .string(scope.homeId),
                "residency_session": .object([
                    "actor_id": .string(scope.actorId),
                    "home_id": .string(scope.homeId),
                    "session_scope": .string(token)
                ]),
                "claim": .object([
                    "id": .string(claimId), "home_id": .string(scope.homeId), "user_id": .string("ddc23600-0000-4000-8000-000000000002"),
                    "status": .string("pending"), "claimed_role": .string("member"), "claimed_address": .string("Synthetic address"),
                    "review_note": .null, "reviewed_by": .null, "reviewed_at": .null,
                    "created_at": .string(stamp), "updated_at": .string(stamp), "review_token": .string(token)
                ]),
                "occupancy": .null
            ]))
        }

        func decide(_ draft: PendingHomeResidencyReview, sessionScope _: String) async throws -> HomeResidencyReviewReceipt {
            decisions.append(draft)
            return HomeResidencyReviewReceipt(value: .object([
                "id": .string("ddc23600-0000-4000-8000-000000000901"), "home_id": .string(draft.scope.homeId),
                "claim_id": .string(draft.claimId),
                "actor_id": .string(wrongActor ? "ddc23600-0000-4000-8000-000000000002" : draft.scope.actorId),
                "request_id": .string(draft.requestId), "action": .string(draft.action.rawValue),
                "review_token": .string(draft.reviewToken),
                "legacy_request": .bool(false), "request_hash": .string(token), "created_at": .string(stamp),
                "result": .object([
                    "status": .string(draft.action == .approve ? "verified" : "rejected"),
                    "reviewed_at": .string(stamp),
                    "occupancy_id": .string("ddc23600-0000-4000-8000-000000000902"),
                    "role_base": .string("member")
                ])
            ]))
        }
    }
}
