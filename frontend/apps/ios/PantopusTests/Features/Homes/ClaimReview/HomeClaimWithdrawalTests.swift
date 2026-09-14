import XCTest
@testable import Pantopus

@MainActor
private final class WithdrawalSession {
    var identity: String? = "opening-session"
}

@MainActor
final class HomeClaimWithdrawalTests: XCTestCase {
    private let path = "/api/homes/home-1/ownership-claims/claim-1"
    private let claimsPath = "/api/homes/my-ownership-claims"
    private let receipt = #"""
    {"ok":true,"deleted":false,"withdrawn":true,"replayed":false,"homeId":"home-1",
    "claimId":"claim-1","action":"withdraw","state":"revoked"}
    """#

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func claims(status: String = "under_review") -> String {
        """
        {"claims":[{"id":"claim-1","home_id":"home-1","claim_type":"owner","method":"doc_upload",
        "status":"\(status)","created_at":"2026-09-10T00:00:00Z","updated_at":"2026-09-10T00:00:00Z"}]}
        """
    }

    private func model(_ session: WithdrawalSession) -> CancelClaimViewModel {
        CancelClaimViewModel(homeId: "home-1", api: APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )) {
            session.identity
        }
    }

    private func waitFor(_ condition: () -> Bool) async {
        let deadline = ContinuousClock.now.advanced(by: .seconds(10))
        while ContinuousClock.now < deadline {
            if condition() { return }
            try? await Task.sleep(for: .milliseconds(10))
        }
        XCTFail("Timed out waiting for the injected withdrawal request")
    }

    private func deletes() -> [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "DELETE" }
    }

    private func load(_ vm: CancelClaimViewModel) async {
        vm.load()
        await waitFor { vm.phase != .loading }
    }

    func testOnlyExactNonDestructiveWithdrawalDismisses() async {
        let bad = [
            "{}",
            receipt.replacingOccurrences(of: "home-1", with: "other-home"),
            receipt.replacingOccurrences(of: "claim-1", with: "other-claim"),
            receipt.replacingOccurrences(of: "\"deleted\":false", with: "\"deleted\":true"),
            receipt.replacingOccurrences(of: "\"withdrawn\":true", with: "\"withdrawn\":false")
        ]
        for payload in bad {
            SequencedURLProtocol.reset()
            SequencedURLProtocol.routeResponses = [claimsPath: [.status(200, body: claims())], path: [.status(200, body: payload)]]
            let vm = model(WithdrawalSession())
            await load(vm)
            vm.submit()
            await waitFor { vm.phase == .ready && vm.errorMessage != nil }
            XCTAssertFalse(vm.shouldDismissAfterCancel)
            XCTAssertEqual(deletes().count, 1)
        }
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses = [claimsPath: [.status(200, body: claims())], path: [.status(200, body: receipt)]]
        let vm = model(WithdrawalSession())
        await load(vm)
        vm.submit()
        await waitFor { vm.shouldDismissAfterCancel }
        XCTAssertEqual(deletes().first?.url?.path, path)
    }

    func testUnknownWithdrawalResultRetriesExactClaim() async {
        SequencedURLProtocol.routeResponses = [
            claimsPath: [.status(200, body: claims())],
            path: [
                .status(503, body: "{}"),
                .status(
                    200,
                    body: receipt.replacingOccurrences(
                        of: "\"replayed\":false",
                        with: "\"replayed\":true"
                    )
                )
            ]
        ]
        let vm = model(WithdrawalSession())
        await load(vm)
        vm.submit()
        await waitFor { vm.phase == .ready && vm.errorMessage != nil }
        XCTAssertFalse(vm.shouldDismissAfterCancel)
        vm.submit()
        await waitFor { vm.shouldDismissAfterCancel }
        XCTAssertEqual(deletes().count, 2)
        XCTAssertTrue(deletes().allSatisfy { $0.url?.path == path })
    }

    func testAccountChangedBeforeWithdrawalDoesNotSend() async {
        let session = WithdrawalSession()
        SequencedURLProtocol.sequence = [.status(200, body: claims())]
        let vm = model(session)
        await load(vm)
        session.identity = "replacement-account"
        vm.submit()
        XCTAssertTrue(deletes().isEmpty)
        XCTAssertFalse(vm.canSubmit)
    }

    func testDelayedOldAccountClaimLoadCannotEnableWithdrawal() async {
        let session = WithdrawalSession()
        SequencedURLProtocol.sequence = [.status(200, body: claims(), delay: 0.1)]
        let vm = model(session)
        vm.load()
        await waitFor { !SequencedURLProtocol.capturedRequests.isEmpty }
        session.identity = "replacement-account"
        await waitFor { vm.phase != .loading }
        vm.submit()
        XCTAssertFalse(vm.canSubmit)
        XCTAssertTrue(deletes().isEmpty)
    }

    func testDelayedOldAccountReceiptDoesNotDismissNewSession() async {
        let session = WithdrawalSession()
        SequencedURLProtocol.routeResponses = [claimsPath: [.status(200, body: claims())], path: [.status(200, body: receipt, delay: 0.1)]]
        let vm = model(session)
        await load(vm)
        vm.submit()
        await waitFor { !self.deletes().isEmpty }
        session.identity = "replacement-account"
        await waitFor { vm.errorMessage != nil }
        XCTAssertFalse(vm.shouldDismissAfterCancel)
    }

    func testConcurrentWithdrawalOnlySendsOnce() async {
        SequencedURLProtocol.routeResponses = [claimsPath: [.status(200, body: claims())], path: [.status(200, body: receipt, delay: 0.1)]]
        let vm = model(WithdrawalSession())
        await load(vm)
        vm.submit()
        vm.submit()
        await waitFor { vm.shouldDismissAfterCancel }
        XCTAssertEqual(deletes().count, 1)
    }

    func testOpaqueTerminalClaimsDoNotOfferWithdrawal() async {
        for status in ["approved", "revoked", "unknown"] {
            SequencedURLProtocol.sequence = [.status(200, body: claims(status: status))]
            let vm = model(WithdrawalSession())
            await load(vm)
            XCTAssertEqual(vm.phase, .noClaim)
            vm.submit()
        }
        XCTAssertTrue(deletes().isEmpty)
    }
}
