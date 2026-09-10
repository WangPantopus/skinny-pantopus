import XCTest
@testable import Pantopus

@MainActor
private final class ClaimTestSession {
    var identity: String? = "opening-account-session"
}

@MainActor
final class HomeClaimDecisionTests: XCTestCase {
    private let token = String(repeating: "a", count: 64)
    private let homePath = "/api/homes/home-1/ownership-claims/claim-1"
    private let adminPath = "/api/admin/claims/claim-1"

    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func api() -> APIClient {
        APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none)
    }

    private func claim(
        token: String? = String(repeating: "a", count: 64),
        homeId: String = "home-1",
        state: String = "submitted"
    ) -> String {
        let tokenJSON = token.map { "\"\($0)\"" } ?? "null"
        return """
        {"id":"claim-1","home_id":"\(homeId)","claimant_user_id":"claimant-1","claim_type":"resident",
        "state":"\(state)","method":"doc_upload","created_at":"2026-09-10T00:00:00Z",
        "review_token":\(tokenJSON),"identity_status":"not_started","evidence":[
        {"id":"e1","evidence_type":"title_match","provider":"attom","status":"verified","eligible_for_review":true,
        "created_at":"2026-09-10T00:00:00Z"},
        {"id":"e2","evidence_type":"deed","status":"verified","eligible_for_review":false,
        "availability_code":"CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED","created_at":"2026-09-10T00:00:00Z"}]}
        """
    }

    private func detail(token: String? = String(repeating: "a", count: 64), state: String = "submitted") -> String {
        """
        {"claim":\(claim(
            token: token,
            state: state
        )),"home":{"id":"home-1"},"claimant":{"id":"claimant-1","name":"Real claimant"},"evidence":[
        {"id":"e2","evidence_type":"deed","status":"verified","eligible_for_review":false,
        "availability_code":"CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED","created_at":"2026-09-10T00:00:00Z"}]}
        """
    }

    private func receipt(action: String = "approve", homeId: String = "home-1", replayed: Bool = false) -> String {
        let state = action == "approve" ? "approved" : "rejected"
        return """
        {"ok":true,"homeId":"\(homeId)","claimId":"claim-1","claimantId":"claimant-1","action":"\(action)","state":"\(state)","replayed":\(
            replayed
        ),
        "occupancy":{"id":"occ-1","home_id":"\(homeId)","user_id":"claimant-1"}}
        """
    }

    private func posts() -> [URLRequest] {
        SequencedURLProtocol.capturedRequests.filter { $0.httpMethod == "POST" }
    }

    private func unwrap<T>(_ value: T?) throws -> T {
        try XCTUnwrap(value)
    }

    private func assertNil(_ value: (some Any)?) {
        XCTAssertNil(value)
    }

    private func assertTrue(_ value: Bool) {
        XCTAssertTrue(value)
    }

    private func assertFalse(_ value: Bool) {
        XCTAssertFalse(value)
    }

    private func waitFor(_ condition: () -> Bool) async {
        for _ in 0..<100 {
            if condition() { return }
            try? await Task.sleep(nanoseconds: 5_000_000)
        }
        XCTFail("Timed out waiting for the injected request")
    }

    func testPreparationShowsExactClaimAndEligibleEvidenceBeforeAnyWrite() async throws {
        SequencedURLProtocol.routeResponses = [homePath: [.status(200, body: "{\"claim\":\(claim())}")]]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { "session" }
        let snapshot = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        XCTAssertEqual(snapshot.claimType, "resident")
        XCTAssertEqual(snapshot.eligibleEvidenceCount, 1)
        XCTAssertEqual(snapshot.evidenceCount, 2)
        XCTAssertEqual(snapshot.reviewToken, token)
        XCTAssertTrue(posts().isEmpty)
    }

    func testMissingOrWrongHomeSnapshotCannotPrepareDecision() async {
        for payload in [claim(token: nil), claim(token: "not-a-snapshot"), claim(homeId: "other-home")] {
            SequencedURLProtocol.sequence = [.status(200, body: "{\"claim\":\(payload)}")]
            let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { "session" }
            await assertNil(vm.prepareReview(claimId: "claim-1", action: .approve))
        }
        XCTAssertTrue(posts().isEmpty)
    }

    func testHomeDecisionSendsDisplayedSnapshotAndExactEndpoint() async throws {
        SequencedURLProtocol.routeResponses = [
            homePath: [.status(200, body: "{\"claim\":\(claim())}")],
            homePath + "/review": [.status(200, body: receipt())]
        ]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { "session" }
        let snapshot = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        await vm.review(snapshot, action: .approve)
        let request = try XCTUnwrap(posts().first)
        let body = try XCTUnwrap(request.authTestJSONBody())
        XCTAssertEqual(request.url?.path, homePath + "/review")
        XCTAssertEqual(body["review_token"] as? String, token)
        XCTAssertEqual(body["action"] as? String, "approve")
        XCTAssertEqual(posts().count, 1)
    }

    func testHomeUnknownResultRetriesSameDecisionWithoutReadingNewToken() async throws {
        SequencedURLProtocol.routeResponses = [
            homePath: [.status(200, body: "{\"claim\":\(claim())}")],
            homePath + "/review": [
                .status(503, body: "{}"),
                .status(200, body: receipt(replayed: true))
            ]
        ]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { "session" }
        let snapshot = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        await vm.review(snapshot, action: .approve)
        await assertNil(vm.prepareReview(claimId: "claim-1", action: .reject))
        let retry = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        XCTAssertEqual(retry, snapshot)
        await vm.review(retry, action: .approve)
        XCTAssertEqual(posts().count, 2)
        XCTAssertTrue(posts().allSatisfy { $0.authTestJSONBody()?["review_token"] as? String == token })
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.filter { $0.url?.path == homePath }.count, 1)
    }

    func testStaleSnapshotDoesNotAutomaticallyApproveNewEvidence() async throws {
        SequencedURLProtocol.routeResponses = [
            homePath: [.status(200, body: "{\"claim\":\(claim())}")],
            homePath + "/review": [.status(409, body: #"{"code":"CLAIM_REVIEW_CHANGED"}"#)]
        ]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { "session" }
        let snapshot = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        await vm.review(snapshot, action: .approve)
        await vm.review(snapshot, action: .approve)
        XCTAssertEqual(posts().count, 1)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 2)
    }

    func testOpeningAccountChangeBeforeConfirmationDoesNotWrite() async throws {
        let session = ClaimTestSession()
        SequencedURLProtocol.sequence = [.status(200, body: "{\"claim\":\(claim())}")]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { session.identity }
        let snapshot = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        session.identity = "another-account"
        await vm.review(snapshot, action: .approve)
        XCTAssertTrue(posts().isEmpty)
        guard case .error = vm.state else { return XCTFail("Old-account content remained visible") }
    }

    func testDelayedSnapshotFromPreviousAccountIsDiscarded() async {
        let session = ClaimTestSession()
        SequencedURLProtocol.sequence = [.status(200, body: "{\"claim\":\(claim())}", delay: 0.1)]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { session.identity }
        let load = Task { await vm.prepareReview(claimId: "claim-1", action: .approve) }
        await waitFor { !SequencedURLProtocol.capturedRequests.isEmpty }
        session.identity = "another-account"
        await assertNil(load.value)
        XCTAssertTrue(posts().isEmpty)
    }

    func testConcurrentHomeDecisionsSendOnce() async throws {
        SequencedURLProtocol.routeResponses = [
            homePath: [.status(200, body: "{\"claim\":\(claim())}")],
            homePath + "/review": [.status(200, body: receipt(), delay: 0.1)]
        ]
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { "session" }
        let snapshot = try await unwrap(vm.prepareReview(claimId: "claim-1", action: .approve))
        let first = Task { await vm.review(snapshot, action: .approve) }
        await waitFor { !self.posts().isEmpty }
        await vm.review(snapshot, action: .approve)
        await first.value
        XCTAssertEqual(posts().count, 1)
    }

    func testAdminMissingSnapshotNeverPosts() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail(token: nil))]
        let vm = ReviewClaimDetailViewModel(claimId: "claim-1", api: api()) { "session" }
        await vm.load()
        await assertFalse(vm.review(.approve))
        XCTAssertTrue(posts().isEmpty)
    }

    func testAdminUsesDisplayedSnapshotAndTruthfulResidentSuccess() async {
        SequencedURLProtocol.routeResponses = [
            adminPath: [.status(200, body: detail()), .status(200, body: detail(state: "approved"))],
            adminPath + "/review": [.status(200, body: receipt())]
        ]
        let vm = ReviewClaimDetailViewModel(claimId: "claim-1", api: api()) { "session" }
        await vm.load()
        await assertTrue(vm.review(.approve))
        XCTAssertEqual(posts().first?.authTestJSONBody()?["review_token"] as? String, token)
        XCTAssertEqual(vm.toast?.text, "Claim approved.")
    }

    func testAdminUnknownResultRequiresExactNoteAndActionOnRetry() async {
        SequencedURLProtocol.routeResponses = [
            adminPath: [.status(200, body: detail()), .status(200, body: detail(state: "rejected"))],
            adminPath + "/review": [
                .status(503, body: "{}"),
                .status(200, body: receipt(action: "reject", replayed: true))
            ]
        ]
        let vm = ReviewClaimDetailViewModel(claimId: "claim-1", api: api()) { "session" }
        await vm.load()
        await assertFalse(vm.review(.reject, note: "Evidence mismatch"))
        await assertFalse(vm.review(.reject, note: "A different reason"))
        await assertTrue(vm.review(.reject, note: "Evidence mismatch"))
        XCTAssertEqual(posts().count, 2)
        XCTAssertTrue(posts().allSatisfy { $0.authTestJSONBody()?["note"] as? String == "Evidence mismatch" })
    }

    func testAdminRejectsMismatchedReceiptAndLateAccountSuccess() async {
        for changeAccount in [false, true] {
            SequencedURLProtocol.reset()
            let session = ClaimTestSession()
            SequencedURLProtocol.routeResponses = [
                adminPath: [.status(200, body: detail())],
                adminPath + "/review": [
                    .status(
                        200,
                        body: receipt(homeId: changeAccount ? "home-1" : "other-home"),
                        delay: 0.1
                    )
                ]
            ]
            let vm = ReviewClaimDetailViewModel(claimId: "claim-1", api: api()) { session.identity }
            await vm.load()
            let review = Task { await vm.review(.approve) }
            await waitFor { !self.posts().isEmpty }
            if changeAccount { session.identity = "another-account" }
            await assertFalse(review.value)
            XCTAssertNotEqual(vm.toast?.text, "Claim approved.")
        }
    }

    func testReviewProjectionNeverInventsIdentityShareOrClaimantStatement() throws {
        let response = try JSONDecoder().decode(AdminClaimDetailResponse.self, from: Data(detail().utf8))
        XCTAssertEqual(ReviewClaimMap.shareValue(for: response.claim), "—")
        XCTAssertNil(ReviewClaimMap.statement(for: response.claim))
        XCTAssertNil(ReviewClaimMap.statementAttribution(response))
        XCTAssertEqual(ReviewClaimMap.trustChips(for: response.claim, evidenceCount: 1).map(\.label), ["Identity not confirmed"])
        XCTAssertTrue(ReviewClaimMap.evidenceItems(response.evidence).first?.meta.contains("Private re-upload required") == true)
    }

    func testWithdrawalReceiptMustBeExactAndRetainHistory() throws {
        let valid = #"""
        {"ok":true,"deleted":false,"withdrawn":true,"replayed":true,
        "homeId":"home-1","claimId":"claim-1","action":"withdraw","state":"revoked"}
        """#
        let receipt = try JSONDecoder().decode(DeleteOwnershipClaimResponse.self, from: Data(valid.utf8))
        XCTAssertTrue(receipt.matches(homeId: "home-1", claimId: "claim-1"))
        XCTAssertFalse(receipt.matches(homeId: "home-1", claimId: "another-claim"))
        XCTAssertThrowsError(try JSONDecoder().decode(DeleteOwnershipClaimResponse.self, from: Data("{}".utf8)))
        let destructive = valid.replacingOccurrences(of: "\"deleted\":false", with: "\"deleted\":true")
        XCTAssertFalse(try JSONDecoder().decode(DeleteOwnershipClaimResponse.self, from: Data(destructive.utf8)).matches(
            homeId: "home-1",
            claimId: "claim-1"
        ))
    }

    func testOpeningWithoutIdentityCannotBindToALaterLogin() async {
        let session = ClaimTestSession()
        session.identity = nil
        let vm = HomeClaimReviewViewModel(homeId: "home-1", api: api()) { session.identity }
        session.identity = "new-login"
        await assertNil(vm.prepareReview(claimId: "claim-1", action: .approve))
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testDisputedClaimCannotUseOrdinaryPlatformReview() async {
        SequencedURLProtocol.sequence = [.status(200, body: detail(state: "disputed"))]
        let vm = ReviewClaimDetailViewModel(claimId: "claim-1", api: api()) { "session" }
        await vm.load()
        await assertFalse(vm.review(.reject))
        XCTAssertTrue(posts().isEmpty)
        XCTAssertEqual(vm.toast?.text, HomeClaimReviewError.disputeReview.localizedDescription)
    }

    func testEvidenceRequirementKeepsActionableRecoveryMessage() {
        let body = #"{"code":"CLAIM_VERIFIED_EVIDENCE_REQUIRED","error":"Upload private evidence before approval."}"#
        XCTAssertEqual(
            HomeClaimReviewError.message(for: APIError.clientError(status: 409, message: body)),
            "Upload private evidence before approval."
        )
    }
}
