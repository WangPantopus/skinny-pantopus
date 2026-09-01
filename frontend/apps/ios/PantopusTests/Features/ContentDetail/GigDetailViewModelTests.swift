//
//  GigDetailViewModelTests.swift
//  PantopusTests
//
//  Work item C — the gig-detail bookmark toggle. Covers the
//  `saved_by_user` seed on load, the optimistic flip (save + unsave
//  endpoints), the revert-on-failure path, and the in-flight debounce.
//

import XCTest
@testable import Pantopus

// swiftlint:disable line_length multiline_literal_brackets

// swiftlint:disable file_length type_body_length

@MainActor
final class GigDetailViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    /// Viewer is NOT the owner so `load()` issues exactly two requests:
    /// detail + questions (no owner-only bids fetch).
    private func makeVM() -> GigDetailViewModel {
        GigDetailViewModel(gigId: "g1", api: makeAPI(), currentUserId: "viewer-1")
    }

    private static func gigEnvelope(saved: Bool) -> String {
        """
        {"gig":{
          "id":"g1","title":"Hang 3 shelves","description":"IKEA Lack shelves.",
          "price":60,"category":"handyman","status":"open",
          "user_id":"owner-1","saved_by_user":\(saved)
        }}
        """
    }

    private static let questionsJSON = #"{"questions":[]}"#

    private func loadVM(saved: Bool) async -> GigDetailViewModel {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.gigEnvelope(saved: saved)),
            .status(200, body: Self.questionsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        return vm
    }

    // MARK: - Seed

    func testLoadSeedsSavedStateFromPayload() async {
        let vm = await loadVM(saved: true)
        XCTAssertTrue(vm.isSaved)
    }

    func testLoadDefaultsUnsavedWhenFlagAbsent() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: #"{"gig":{"id":"g1","title":"t","user_id":"owner-1","status":"open"}}"#),
            .status(200, body: Self.questionsJSON)
        ]
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.isSaved)
    }

    // MARK: - Optimistic toggle

    func testToggleSavePostsSaveAndSticks() async {
        let vm = await loadVM(saved: false)
        SequencedURLProtocol.sequence = [.status(200, body: #"{"success":true}"#)]
        let ok = await vm.toggleSave()
        XCTAssertTrue(ok)
        XCTAssertTrue(vm.isSaved)
        XCTAssertFalse(vm.isSaveInFlight)
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "POST")
        XCTAssertEqual(last?.url?.path, "/api/gigs/g1/save")
    }

    func testToggleSaveOnSavedGigDeletes() async {
        let vm = await loadVM(saved: true)
        SequencedURLProtocol.sequence = [.status(200, body: #"{"success":true}"#)]
        let ok = await vm.toggleSave()
        XCTAssertTrue(ok)
        XCTAssertFalse(vm.isSaved)
        let last = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(last?.httpMethod, "DELETE")
        XCTAssertEqual(last?.url?.path, "/api/gigs/g1/save")
    }

    func testToggleSaveFailureRevertsOptimisticFlip() async {
        let vm = await loadVM(saved: false)
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let ok = await vm.toggleSave()
        XCTAssertFalse(ok, "Failure reports false so the view can toast.")
        XCTAssertFalse(vm.isSaved, "The optimistic flip reverts on failure.")
        XCTAssertFalse(vm.isSaveInFlight)
    }

    func testToggleSaveBeforeLoadIsNoOp() async {
        let vm = makeVM()
        let ok = await vm.toggleSave()
        XCTAssertTrue(ok, "No gig yet — nothing to do, nothing to toast.")
        XCTAssertFalse(vm.isSaved)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    // MARK: - Phase 5 — owner bids panel (reject / counter / accept)

    private static func gigJSON(_ fields: String) -> String {
        #"{"gig":{"id":"g1","title":"Hang 3 shelves",\#(fields)}}"#
    }

    private static let pendingBidJSON =
        #"{"bids":[{"id":"b1","user_id":"bidder-1","bid_amount":55,"status":"pending","#
            + #""message":"Can do today","created_at":"2026-06-01T00:00:00Z","#
            + #""bidder":{"id":"bidder-1","displayName":"Sam Doe","verified":true}}]}"#

    /// Route-keyed stubs so conditional lifecycle fetches can't shift a
    /// strict FIFO sequence.
    private func stubRoutes(_ routes: [String: [SequencedURLProtocol.Response]]) {
        SequencedURLProtocol.routeResponses = routes
    }

    private func makeOwnerVM(
        presenter: StubAcceptPresenter = StubAcceptPresenter(),
        emitRecorder: EmitRecorder = EmitRecorder()
    ) -> GigDetailViewModel {
        let api = makeAPI()
        return GigDetailViewModel(
            gigId: "g1",
            api: api,
            checkout: CheckoutCoordinator(api: api, presenter: presenter),
            currentUserId: "owner-1",
            roomEvents: { _ in AsyncStream { $0.finish() } },
            emitRoom: { event, gigId in emitRecorder.events.append("\(event):\(gigId)") }
        )
    }

    func testOwnerOpenGigLoadsBidsPanelAndSuppressesModule() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1","is_v2":true"#))],
            "/api/gigs/g1/bids": [.status(200, body: Self.pendingBidJSON)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertTrue(vm.showOwnerBidsPanel)
        XCTAssertEqual(vm.ownerBids.map(\.id), ["b1"])
        guard case let .loaded(content) = vm.state else { return XCTFail("Expected .loaded") }
        XCTAssertFalse(
            content.modules.contains { if case .bids = $0 { true } else { false } },
            "The interactive panel supersedes the read-only bids module on open owned gigs."
        )
    }

    func testRejectBidPostsAndDimsRow() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#))],
            "/api/gigs/g1/bids": [.status(200, body: Self.pendingBidJSON)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/bids/b1/reject": [.status(200, body: #"{"message":"Bid rejected successfully"}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        let error = await vm.rejectBid(bidId: "b1")
        XCTAssertNil(error)
        XCTAssertEqual(vm.ownerBids.first?.status, "rejected")
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertEqual(request?.url?.path, "/api/gigs/g1/bids/b1/reject")
    }

    func testCounterBidPostsAndFlipsRowToCountered() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#))],
            "/api/gigs/g1/bids": [.status(200, body: Self.pendingBidJSON)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/bids/b1/counter": [.status(200, body: #"{"bid":{"id":"b1","status":"countered","counter_amount":48}}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        let error = await vm.counterBid(bidId: "b1", amount: 48, message: "Meet me at $48?")
        XCTAssertNil(error)
        XCTAssertEqual(vm.ownerBids.first?.status, "countered")
        XCTAssertEqual(vm.ownerBids.first?.counterAmount, 48)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/gigs/g1/bids/b1/counter")
    }

    func testAcceptBidFreeGigSkipsPaymentSheet() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#)),
                .status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"bidder-1""#))
            ],
            "/api/gigs/g1/bids": [
                .status(200, body: Self.pendingBidJSON),
                .status(200, body: Self.pendingBidJSON)
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/bids/b1/accept": [.status(200, body: #"{"bid":{"id":"b1","status":"accepted"},"message":"ok"}"#)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false,"reason":"Too early"}"#)]
        ])
        let presenter = StubAcceptPresenter()
        let vm = makeOwnerVM(presenter: presenter)
        await vm.load()
        let outcome = await vm.acceptBid(bidId: "b1")
        XCTAssertEqual(outcome, .accepted)
        XCTAssertEqual(presenter.presentPaymentCallCount, 0, "Free gigs never see PaymentSheet.")
        XCTAssertEqual(vm.activePhase, .assigned, "Silent refresh lands on the assigned state.")
    }

    func testAcceptBidPaidGigFinalizesAfterPaymentSheet() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1","price":60"#)),
                .status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"bidder-1","price":60"#))
            ],
            "/api/gigs/g1/bids": [
                .status(200, body: Self.pendingBidJSON),
                .status(200, body: Self.pendingBidJSON)
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/bids/b1/accept": [.status(
                200,
                body: #"{"requiresPaymentSetup":true,"clientSecret":"pi_x","customer":"cus","ephemeralKey":"ek","publishableKey":"pk"}"#
            )],
            "/api/gigs/g1/bids/b1/finalize-accept": [.status(200, body: #"{"message":"ok"}"#)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)]
        ])
        let presenter = StubAcceptPresenter()
        presenter.outcome = .completed
        let vm = makeOwnerVM(presenter: presenter)
        await vm.load()
        let outcome = await vm.acceptBid(bidId: "b1")
        XCTAssertEqual(outcome, .accepted)
        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        let paths = SequencedURLProtocol.capturedRequests.compactMap { $0.url?.path }
        XCTAssertTrue(paths.contains("/api/gigs/g1/bids/b1/finalize-accept"))
    }

    // MARK: - Phase 5 — instant accept

    func testInstantAcceptGateAndCall() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1","engagement_mode":"instant_accept","is_v2":true"#)),
                .status(
                    200,
                    body: Self
                        .gigJSON(
                            #""status":"assigned","user_id":"owner-1","accepted_by":"viewer-1","engagement_mode":"instant_accept","is_v2":true"#
                        )
                )
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/instant-accept": [.status(200, body: #"{"message":"Task accepted successfully","paymentRequired":false}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.canInstantAccept)
        guard case let .loaded(content) = vm.state else { return XCTFail("Expected .loaded") }
        XCTAssertEqual(content.dock.primary.label, "Accept this task")
        XCTAssertEqual(content.dock.primary.icon, .zap)
        let error = await vm.instantAccept()
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/instant-accept" })
        XCTAssertFalse(vm.canInstantAccept, "Assigned after refresh — gate closes.")
        XCTAssertEqual(vm.activePhase, .assigned)
    }

    func testInstantAcceptGateClosedForOwnerAndNonInstantModes() throws {
        let instant = try JSONDecoder().decode(
            GigDTO.self,
            from: Data(#"{"id":"g1","title":"t","status":"open","engagement_mode":"instant_accept"}"#.utf8)
        )
        XCTAssertTrue(GigDetailViewModel.viewerCanInstantAccept(gig: instant, viewerIsOwner: false, signedIn: true))
        XCTAssertFalse(GigDetailViewModel.viewerCanInstantAccept(gig: instant, viewerIsOwner: true, signedIn: true))
        XCTAssertFalse(GigDetailViewModel.viewerCanInstantAccept(gig: instant, viewerIsOwner: false, signedIn: false))
        let bidding = try JSONDecoder().decode(
            GigDTO.self,
            from: Data(#"{"id":"g1","title":"t","status":"open","engagement_mode":"bidding"}"#.utf8)
        )
        XCTAssertFalse(GigDetailViewModel.viewerCanInstantAccept(gig: bidding, viewerIsOwner: false, signedIn: true))
    }

    // MARK: - Phase 5 — active-task lifecycle

    /// Viewer "viewer-1" is the assigned worker.
    private func workerGig(_ status: String, extra: String = "") -> String {
        Self.gigJSON(#""status":"\#(status)","user_id":"owner-1","accepted_by":"viewer-1""# + extra)
    }

    func testWorkerAckPostsStartingNow() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: workerGig("assigned")),
                .status(200, body: workerGig("assigned", extra: #","worker_ack_status":"starting_now""#))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/worker-ack": [.status(200, body: #"{"success":true,"worker_ack_status":"starting_now"}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.activePhase, .assigned)
        XCTAssertTrue(vm.showWorkerAck)
        XCTAssertTrue(vm.canStartTask)
        let error = await vm.sendWorkerAck()
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/worker-ack" })
        XCTAssertFalse(vm.showWorkerAck, "Ack affordance hides once acknowledged.")
    }

    func testStartTaskTransitionsToInProgress() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: workerGig("assigned")),
                .status(200, body: workerGig("in_progress"))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/start": [.status(200, body: #"{"message":"ok"}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        let error = await vm.startTask()
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/start" })
        XCTAssertEqual(vm.activePhase, .inProgress)
        XCTAssertFalse(vm.canStartTask)
        XCTAssertTrue(vm.canMarkDelivered, "In-progress worker gets the delivery affordance.")
    }

    func testOwnerConfirmCompletionUnlocksTip() async {
        let markedDone = Self.gigJSON(#""status":"completed","user_id":"owner-1","accepted_by":"w1""#)
        let confirmed = Self.gigJSON(
            #""status":"completed","user_id":"owner-1","accepted_by":"w1","owner_confirmed_at":"2026-06-09T00:00:00Z""#
        )
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: markedDone), .status(200, body: confirmed)],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#), .status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/reviews/my-pending": [
                .status(200, body: #"{"pending":[{"gig_id":"g1","reviewee_id":"w1","role":"owner","reviewee_name":"Worker"}]}"#),
                .status(200, body: #"{"pending":[{"gig_id":"g1","reviewee_id":"w1","role":"owner","reviewee_name":"Worker"}]}"#)
            ],
            "/api/gigs/g1/complete": [.status(200, body: #"{"message":"ok"}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertEqual(vm.activePhase, .markedDone)
        XCTAssertTrue(vm.canConfirmCompletion)
        XCTAssertFalse(vm.canTip)
        let error = await vm.confirmCompletion()
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/complete" })
        XCTAssertEqual(vm.activePhase, .confirmed)
        XCTAssertFalse(vm.canConfirmCompletion)
        XCTAssertTrue(vm.canTip, "Confirmed completion unlocks the Block 3D tip dock.")
    }

    func testNoShowCheckGatesOwnerAffordanceAndReportCancels() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#)),
                .status(200, body: Self.gigJSON(#""status":"cancelled","user_id":"owner-1","accepted_by":"w1""#))
            ],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#), .status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [
                .status(200, body: #"{"can_report":true,"minutes_overdue":45,"reason":"Worker has not started after expected time"}"#)
            ],
            "/api/gigs/g1/report-no-show": [.status(200, body: #"{"fee":15,"message":"No-show reported successfully."}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertTrue(vm.noShowEligible)
        let error = await vm.reportNoShow(description: "Never arrived")
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/report-no-show" })
        XCTAssertNil(vm.activePhase, "Cancelled after the report — active panel goes away.")
    }

    // MARK: - Phase 5 — reviews

    func testWorkerReviewEligibilityAndSubmit() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("completed"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/reviews/my-pending": [
                .status(200, body: #"{"pending":[{"gig_id":"g1","reviewee_id":"owner-1","role":"worker","reviewee_name":"Poster"}]}"#)
            ],
            "/api/reviews": [.status(200, body: #"{"message":"ok"}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.showReviewSection)
        XCTAssertEqual(vm.pendingReview?.revieweeId, "owner-1")
        XCTAssertFalse(vm.reviewSubmitted)
        let error = await vm.submitReview(rating: 5, comment: "Great neighbor")
        XCTAssertNil(error)
        XCTAssertTrue(vm.reviewSubmitted)
        XCTAssertNil(vm.pendingReview)
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.url?.path, "/api/reviews")
        XCTAssertEqual(request?.httpMethod, "POST")
    }

    func testSubmitReview409SettlesAsAlreadyReviewed() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("completed"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/reviews/my-pending": [
                .status(200, body: #"{"pending":[{"gig_id":"g1","reviewee_id":"owner-1","role":"worker"}]}"#)
            ],
            "/api/reviews": [.status(409, body: #"{"error":"You already reviewed this gig"}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        let error = await vm.submitReview(rating: 4, comment: nil)
        XCTAssertNil(error, "409 means already reviewed — settle, don't error.")
        XCTAssertTrue(vm.reviewSubmitted)
    }

    func testMyPendingWithoutThisGigMarksReviewed() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("completed"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/reviews/my-pending": [.status(200, body: #"{"pending":[]}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.reviewSubmitted, "Completed + absent from my-pending → already reviewed.")
        XCTAssertTrue(vm.showReviewSection)
    }

    // MARK: - Phase 5 — report / cancel

    func testReportGigPostsReason() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/report": [.status(200, body: #"{"message":"Gig reported successfully.","already_reported":false}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        let result = await vm.reportGig(reason: .spam, details: "Looks fake")
        XCTAssertTrue(result.success)
        XCTAssertEqual(result.message, "Gig reported successfully.")
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.last?.url?.path, "/api/gigs/g1/report")
    }

    func testCancellationPreviewParsesZoneAndCancelPosts() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#)),
                .status(200, body: Self.gigJSON(#""status":"cancelled","user_id":"owner-1""#))
            ],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#), .status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/cancellation-preview": [.status(
                200,
                body: #"{"zone":1,"zone_label":"After acceptance (grace period expired)","fee":3,"fee_pct":5,"in_grace":false,"policy":"standard","can_reschedule":true}"#
            )],
            "/api/gigs/g1/cancel": [.status(200, body: #"{"message":"ok"}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertTrue(vm.canCancelTask)
        let preview = await vm.loadCancellationPreview()
        XCTAssertEqual(preview?.zone, 1)
        XCTAssertEqual(preview?.fee, 3)
        XCTAssertEqual(preview?.inGrace, false)
        let error = await vm.cancelTask(reason: .changedPlans)
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/cancel" })
        XCTAssertFalse(vm.canCancelTask, "Cancelled gigs can't be cancelled again.")
    }

    // MARK: - Phase 5 — realtime room

    func testRealtimeJoinsRoomAndRefetchesOnEvent() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#)),
                .status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w9""#))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ]
        ])
        let recorder = EmitRecorder()
        var continuations: [String: AsyncStream<GigRoomEvent>.Continuation] = [:]
        let vm = GigDetailViewModel(
            gigId: "g1",
            api: makeAPI(),
            currentUserId: "viewer-1",
            roomEvents: { name in
                AsyncStream { continuation in continuations[name] = continuation }
            },
            emitRoom: { event, gigId in recorder.events.append("\(event):\(gigId)") }
        )
        await vm.load()
        vm.startRealtime()
        XCTAssertEqual(recorder.events, ["gig:join:g1"])
        continuations["gig:status-change"]?.yield(GigRoomEvent(gigId: "g1", eventType: "status-change"))
        // Wait for the listener task to refetch (status flips to assigned).
        for _ in 0..<100 where vm.activePhase == nil {
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
        XCTAssertEqual(vm.activePhase, .assigned, "Room event triggers a silent refetch.")
        vm.stopRealtime()
        XCTAssertEqual(recorder.events.last, "gig:leave:g1")
    }

    // MARK: - Phase 5b — payment card

    private static let paymentJSON = #"""
    {"payment":{"id":"pay-1","payment_status":"captured_hold","payment_type":"gig_payment",
      "amount_total":10000,"amount_subtotal":10000,"amount_platform_fee":1500,
      "amount_to_payee":8500,"tip_amount":300,"refunded_amount":0},
     "stateInfo":{"label":"Payment Captured","color":"green","description":"Payment has been captured."}}
    """#

    func testOwnerPaymentLoadsOnAssignedGig() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#))],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/payment": [.status(200, body: Self.paymentJSON)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertTrue(vm.showPaymentCard)
        XCTAssertEqual(vm.payment?.amountSubtotal, 10000, "Amounts ride in cents.")
        XCTAssertEqual(vm.payment?.amountPlatformFee, 1500)
        XCTAssertEqual(vm.payment?.tipAmount, 300)
        XCTAssertEqual(vm.payment?.amountTotal, 10000)
        XCTAssertEqual(vm.paymentStateInfo?.label, "Payment Captured")
        XCTAssertEqual(vm.paymentStateInfo?.color, "green")
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/payment" })
    }

    func testPaymentSilentlyHiddenOnFailureAndNullPayment() async {
        // 404 / failure → card hides without surfacing an error.
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#))],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/payment": [.status(404, body: #"{"error":"Gig not found"}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertNil(vm.payment)
        XCTAssertFalse(vm.showPaymentCard)
        guard case .loaded = vm.state else { return XCTFail("Payment failure never degrades the page.") }
    }

    func testPaymentNotFetchedForWorkerOrOpenGig() async {
        // Worker on an assigned gig — owner-only card, no fetch.
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("assigned"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertFalse(vm.showPaymentCard)
        XCTAssertFalse(
            SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/payment" },
            "The worker's payout view lives in the wallet — no owner payment fetch."
        )
    }

    // MARK: - Phase 5b — change orders

    private static let pendingChangeOrderJSON = #"""
    {"change_orders":[{"id":"co1","gig_id":"g1","requested_by":"owner-1","type":"price_increase",
      "description":"Extra shelf to hang","amount_change":15,"time_change_minutes":30,
      "status":"pending","created_at":"2026-06-10T00:00:00Z",
      "requester":{"id":"owner-1","username":"po","name":"Poster"}}]}
    """#

    func testChangeOrdersLoadForWorkerOnAssignedGig() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("assigned"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: Self.pendingChangeOrderJSON)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.showChangesSection)
        XCTAssertEqual(vm.changeOrders.map(\.id), ["co1"])
        XCTAssertEqual(vm.changeOrders.first?.amountChange, 15)
        XCTAssertEqual(vm.changeOrders.first?.timeChangeMinutes, 30)
        XCTAssertFalse(vm.isOwnChangeOrder(vm.changeOrders[0]), "Proposed by the owner → viewer is the counterparty.")
    }

    func testProposeChangeOrderPostsBodyAndPrepends() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("in_progress"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [
                .status(200, body: #"{"change_orders":[]}"#),
                .status(201, body: #"""
                {"change_order":{"id":"co2","gig_id":"g1","requested_by":"viewer-1","type":"price_increase",
                  "description":"Found water damage behind the wall","amount_change":25,"time_change_minutes":0,
                  "status":"pending","requester":{"id":"viewer-1","name":"Worker"}}}
                """#)
            ]
        ])
        let vm = makeVM()
        await vm.load()
        let error = await vm.proposeChangeOrder(
            type: .priceIncrease,
            description: "Found water damage behind the wall",
            amountChange: 25,
            timeChangeMinutes: nil
        )
        XCTAssertNil(error)
        XCTAssertEqual(vm.changeOrders.map(\.id), ["co2"], "Created order prepends (list is newest-first).")
        XCTAssertTrue(vm.isOwnChangeOrder(vm.changeOrders[0]))
        let request = SequencedURLProtocol.capturedRequests.last
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertEqual(request?.url?.path, "/api/gigs/g1/change-orders")
        let body = String(data: request?.httpBodyData() ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains(#""type":"price_increase""#))
        XCTAssertTrue(body.contains(#""amount_change":25"#))
        XCTAssertFalse(body.contains("time_change_minutes"), "Nil deltas stay out of the payload.")
    }

    func testProposeChangeOrderRequiresDescription() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("assigned"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        let error = await vm.proposeChangeOrder(type: .other, description: "abc", amountChange: nil, timeChangeMinutes: nil)
        XCTAssertEqual(error, "Describe the change in at least 5 characters.")
        XCTAssertFalse(
            SequencedURLProtocol.capturedRequests.contains { $0.httpMethod == "POST" && $0.url?.path == "/api/gigs/g1/change-orders" },
            "Validation failures never hit the network."
        )
    }

    func testApproveChangeOrderFlipsRowAndRefreshesGig() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: workerGig("assigned")),
                .status(200, body: workerGig("assigned", extra: #","price":75"#))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [
                .status(200, body: #"{"can_report":false}"#),
                .status(200, body: #"{"can_report":false}"#)
            ],
            "/api/gigs/g1/change-orders": [
                .status(200, body: Self.pendingChangeOrderJSON),
                .status(200, body: Self.pendingChangeOrderJSON)
            ],
            "/api/gigs/g1/change-orders/co1/approve": [
                .status(200, body: #"{"change_order":{"id":"co1","status":"approved"}}"#)
            ]
        ])
        let vm = makeVM()
        await vm.load()
        let error = await vm.approveChangeOrder(orderId: "co1")
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains {
            $0.url?.path == "/api/gigs/g1/change-orders/co1/approve"
        })
        XCTAssertTrue(
            SequencedURLProtocol.capturedRequests.filter { $0.url?.path == "/api/gigs/g1" }.count >= 2,
            "Approving a price delta refreshes the gig."
        )
        XCTAssertEqual(vm.rawGig?.price, 75)
    }

    func testRejectAndWithdrawChangeOrderFlipRowsLocally() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("assigned"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: Self.pendingChangeOrderJSON)],
            "/api/gigs/g1/change-orders/co1/reject": [
                .status(200, body: #"{"change_order":{"id":"co1","status":"rejected"}}"#)
            ]
        ])
        let vm = makeVM()
        await vm.load()
        let rejectError = await vm.rejectChangeOrder(orderId: "co1")
        XCTAssertNil(rejectError)
        XCTAssertEqual(vm.changeOrders.first?.status, "rejected")
        XCTAssertEqual(vm.changeOrders.first?.description, "Extra shelf to hang", "Local flip keeps the row content.")
        // Withdraw flips a proposer-owned copy the same way.
        let withdrawn = GigDetailViewModel.changeOrderCopy(of: vm.changeOrders[0], status: "withdrawn")
        XCTAssertEqual(withdrawn.status, "withdrawn")
        XCTAssertEqual(withdrawn.requestedBy, "owner-1")
    }

    func testChangeOrdersNotFetchedOutsideActiveWindow() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#))],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertFalse(vm.showChangesSection)
        XCTAssertFalse(
            SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/change-orders" },
            "Open gigs have no change-order surface (create is assigned/in_progress only)."
        )
    }

    // MARK: - Phase 5b — running late

    func testRunningLatePostsEtaAndSurfacesBadgeForBothRoles() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: workerGig("assigned")),
                .status(200, body: workerGig("assigned", extra: #","worker_ack_status":"running_late","worker_ack_eta_minutes":20"#))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [
                .status(200, body: #"{"can_report":false}"#),
                .status(200, body: #"{"can_report":false}"#)
            ],
            "/api/gigs/g1/change-orders": [
                .status(200, body: #"{"change_orders":[]}"#),
                .status(200, body: #"{"change_orders":[]}"#)
            ],
            "/api/gigs/g1/worker-ack": [
                .status(200, body: #"{"success":true,"worker_ack_status":"running_late"}"#)
            ]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.canReportRunningLate)
        XCTAssertNil(vm.runningLateLabel)
        let error = await vm.sendRunningLate(etaMinutes: 20, note: "Stuck in traffic")
        XCTAssertNil(error)
        let ackRequest = SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/gigs/g1/worker-ack" }
        XCTAssertEqual(ackRequest?.httpMethod, "POST")
        let body = String(data: ackRequest?.httpBodyData() ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains(#""status":"running_late""#))
        XCTAssertTrue(body.contains(#""eta_minutes":20"#))
        XCTAssertTrue(body.contains("Stuck in traffic"))
        XCTAssertEqual(vm.runningLateLabel, "Running ~20 min late")
        XCTAssertFalse(vm.canReportRunningLate, "Already flagged late — the action hides, the badge stays.")
    }

    func testRunningLateGateClosedForOwnerAndAfterStart() async {
        let assignedOwnerView = Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#)
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: assignedOwnerView)],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/payment": [.status(200, body: #"{"payment":null,"stateInfo":null}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let owner = makeOwnerVM()
        await owner.load()
        XCTAssertFalse(owner.canReportRunningLate, "Owner never sees the worker's running-late action.")
        XCTAssertFalse(owner.showPaymentCard, "A null payment row keeps the card hidden.")

        SequencedURLProtocol.reset()
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("in_progress", extra: #","started_at":"2026-06-10T01:00:00Z""#))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let worker = makeVM()
        await worker.load()
        XCTAssertFalse(worker.canReportRunningLate, "Worker-ack is pre-start only (gigs.js:5838).")
    }

    // MARK: - Phase 6b — reschedule

    func testReschedulePostsIsoStartAndNoteThenRefreshes() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#)),
                .status(200, body: Self.gigJSON(
                    #""status":"assigned","user_id":"owner-1","accepted_by":"w1","scheduled_start":"2026-06-20T15:00:00Z""#
                ))
            ],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#), .status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [
                .status(200, body: #"{"can_report":false}"#),
                .status(200, body: #"{"can_report":false}"#)
            ],
            "/api/gigs/g1/reschedule": [
                .status(200, body: #"{"message":"Task rescheduled","gig":{"id":"g1","title":"Hang 3 shelves","status":"assigned"}}"#)
            ]
        ])
        let vm = makeOwnerVM()
        await vm.load()
        XCTAssertTrue(vm.canRescheduleTask)
        let newStart = Date(timeIntervalSince1970: 1_787_230_800) // 2026-08-20T13:00:00Z
        let error = await vm.rescheduleTask(scheduledStart: newStart, note: "Pushed a day, sorry!")
        XCTAssertNil(error)
        let request = SequencedURLProtocol.capturedRequests.first { $0.url?.path == "/api/gigs/g1/reschedule" }
        XCTAssertEqual(request?.httpMethod, "POST")
        let body = String(data: request?.httpBodyData() ?? Data(), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains(#""scheduled_start":"2026-08-20T13:00:00Z""#), "ISO-8601 UTC start: \(body)")
        XCTAssertTrue(body.contains("Pushed a day, sorry!"))
        XCTAssertEqual(vm.rawGig?.scheduledStart, "2026-06-20T15:00:00Z", "Silent refresh lands the new start.")
    }

    func testRescheduleGateClosedForWorkerAndNonAssigned() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: workerGig("assigned"))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)],
            "/api/gigs/g1/no-show-check": [.status(200, body: #"{"can_report":false}"#)],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)]
        ])
        let worker = makeVM()
        await worker.load()
        XCTAssertFalse(worker.canRescheduleTask, "Reschedule is poster-only (gigs.js:6405).")
        let workerError = await worker.rescheduleTask(scheduledStart: Date(), note: nil)
        XCTAssertNil(workerError)
        XCTAssertFalse(
            SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/reschedule" },
            "Closed gate never hits the network."
        )

        SequencedURLProtocol.reset()
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"open","user_id":"owner-1""#))],
            "/api/gigs/g1/bids": [.status(200, body: #"{"bids":[]}"#)],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)]
        ])
        let owner = makeOwnerVM()
        await owner.load()
        XCTAssertFalse(owner.canRescheduleTask, "Open gigs use PATCH edit, not reschedule.")
    }

    // MARK: - Phase 6b — live activity wiring

    func testLiveActivitySyncsOnEveryFetchWithParticipantFlag() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: workerGig("assigned")),
                .status(200, body: workerGig("in_progress"))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [
                .status(200, body: #"{"can_report":false}"#),
                .status(200, body: #"{"can_report":false}"#)
            ],
            "/api/gigs/g1/change-orders": [
                .status(200, body: #"{"change_orders":[]}"#),
                .status(200, body: #"{"change_orders":[]}"#)
            ],
            "/api/gigs/g1/start": [.status(200, body: #"{"message":"ok"}"#)]
        ])
        let recorder = LiveActivityRecorder()
        let vm = GigDetailViewModel(
            gigId: "g1",
            api: makeAPI(),
            currentUserId: "viewer-1",
            liveActivity: recorder,
            roomEvents: { _ in AsyncStream { $0.finish() } },
            emitRoom: { _, _ in }
        )
        await vm.load()
        XCTAssertEqual(recorder.synced, ["assigned:participant"], "Load syncs the assigned phase.")
        _ = await vm.startTask()
        XCTAssertEqual(
            recorder.synced,
            ["assigned:participant", "in_progress:participant"],
            "The post-mutation silent refresh re-syncs the live activity."
        )
    }

    func testLiveActivitySyncMarksNonParticipants() async {
        stubRoutes([
            "/api/gigs/g1": [.status(200, body: Self.gigJSON(#""status":"assigned","user_id":"owner-1","accepted_by":"w1""#))],
            "/api/gigs/g1/questions": [.status(200, body: Self.questionsJSON)]
        ])
        let recorder = LiveActivityRecorder()
        let vm = GigDetailViewModel(
            gigId: "g1",
            api: makeAPI(),
            currentUserId: "viewer-1", // neither poster nor worker
            liveActivity: recorder,
            roomEvents: { _ in AsyncStream { $0.finish() } },
            emitRoom: { _, _ in }
        )
        await vm.load()
        XCTAssertEqual(recorder.synced, ["assigned:bystander"], "Non-participants sync with the flag down (controller ends/skips).")
    }

    // MARK: - Phase 5b — worker-side no-show

    func testWorkerNoShowEligibilityMirrorsOwnerGating() async {
        stubRoutes([
            "/api/gigs/g1": [
                .status(200, body: workerGig("assigned")),
                .status(200, body: Self.gigJSON(#""status":"cancelled","user_id":"owner-1","accepted_by":"viewer-1""#))
            ],
            "/api/gigs/g1/questions": [
                .status(200, body: Self.questionsJSON),
                .status(200, body: Self.questionsJSON)
            ],
            "/api/gigs/g1/no-show-check": [
                .status(200, body: #"{"can_report":true,"hours_since_accept":26,"reason":"Poster unresponsive for 24+ hours"}"#)
            ],
            "/api/gigs/g1/change-orders": [.status(200, body: #"{"change_orders":[]}"#)],
            "/api/gigs/g1/report-no-show": [.status(200, body: #"{"fee":15,"message":"No-show reported successfully."}"#)]
        ])
        let vm = makeVM()
        await vm.load()
        XCTAssertTrue(vm.noShowEligible, "The worker can report an unresponsive poster (gigs.js:7722).")
        let error = await vm.reportNoShow(description: "No response for two days")
        XCTAssertNil(error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.contains { $0.url?.path == "/api/gigs/g1/report-no-show" })
        XCTAssertNil(vm.activePhase, "Cancelled after the report.")
    }
}

private extension URLRequest {
    /// `URLProtocol`-stubbed sessions strip `httpBody` and expose it as
    /// `httpBodyStream`; drain the stream so body assertions don't flake.
    func httpBodyData() -> Data? {
        if let direct = httpBody { return direct }
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

/// Captures `emitRoom` calls (`gig:join` / `gig:leave`).
@MainActor
final class EmitRecorder {
    var events: [String] = []
}

/// Phase 6b — records `sync` calls instead of touching ActivityKit so
/// the live-activity wiring stays assertable and deterministic.
@MainActor
final class LiveActivityRecorder: GigLiveActivityControlling {
    private(set) var synced: [String] = []

    func sync(gig: GigDTO, isParticipant: Bool, workerName _: String?) {
        synced.append("\(gig.status ?? "?"):\(isParticipant ? "participant" : "bystander")")
    }
}

/// Scripted PaymentSheet presenter for the owner accept-bid flow.
@MainActor
final class StubAcceptPresenter: PaymentSheetPresenting {
    var outcome: PaymentSheetOutcome = .completed
    private(set) var presentPaymentCallCount = 0

    func presentAddCard(
        setupIntentClientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        .completed
    }

    func presentPayment(
        clientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        isSetupIntent _: Bool,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        presentPaymentCallCount += 1
        return outcome
    }
}
