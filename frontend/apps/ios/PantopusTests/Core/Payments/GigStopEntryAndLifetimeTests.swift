import XCTest
@testable import Pantopus

@MainActor
final class GigStopEntryAndLifetimeTests: GigStopTestCase {
    private func detail(_ store: StopMemoryStore, identity: StopIdentity) -> GigDetailViewModel {
        let resolve = { identity.value }
        return GigDetailViewModel(
            gigId: gig,
            api: APIClient(environment: .current, session: SequencedURLProtocol.makeSession(), retryPolicy: .none),
            currentUserId: actor,
            stopStore: store,
            stopIdentity: resolve
        )
    }

    func testTerminalSnapshotKeepsSavedActionEntryAfterNormalActionsDisappear() async throws {
        for action in [GigStopAction.cancel, .close, .workerRelease] {
            SequencedURLProtocol.reset()
            let store = StopMemoryStore()
            let original = request(action: action)
            store.request = original
            let identity = StopIdentity()
            let model = detail(store, identity: identity)
            let owner = action == .workerRelease ? worker : actor
            let gigBody = try json(["gig": ["id": gig, "title": "Synthetic task", "status": action.resultingStatus, "user_id": owner]])
            SequencedURLProtocol.routeResponses = try [
                "/api/gigs/" + gig: [.status(200, body: gigBody)],
                "/api/gigs/" + gig + "/questions": [.status(200, body: "{\"questions\":[]}")],
                "/api/gigs/" + gig + "/bids": [.status(200, body: "{\"bids\":[]}")],
                submitPath + "/" + original.requestId: [.status(200, body: json(progress(original, completed: true)))]
            ]
            await model.load()
            XCTAssertFalse(model.canCancelTask)
            XCTAssertFalse(model.canCloseTask)
            XCTAssertFalse(model.canReplaceWorker)
            XCTAssertFalse(model.canReleaseAssignment)
            XCTAssertTrue(model.stopRecovery.available)
            let recovery = try XCTUnwrap(model.stopRecovery.makeRecoveryModel())
            await recovery.checkStatus()
            XCTAssertTrue(recovery.completed)
            XCTAssertEqual(recovery.displayedAction, action)
            model.stopRecovery.refresh()
            XCTAssertFalse(model.stopRecovery.available)
            XCTAssertTrue(posts.isEmpty)
        }
    }

    func testDetailUnavailableStillExposesProtectedOriginalParticipantRecovery() async throws {
        let store = StopMemoryStore()
        let original = request(action: .workerRelease)
        store.request = original
        let model = detail(store, identity: StopIdentity())
        SequencedURLProtocol.routeResponses = try [
            "/api/gigs/" + gig: [.status(404, body: "{}")],
            submitPath + "/" + requestId: [.status(200, body: json(progress(original, completed: true)))]
        ]
        await model.load()
        XCTAssertNil(model.rawGig)
        XCTAssertTrue(model.stopRecovery.available)
        let recovery = try XCTUnwrap(model.stopRecovery.makeRecoveryModel())
        await recovery.checkStatus()
        XCTAssertTrue(recovery.completed)
        XCTAssertTrue(posts.isEmpty)
    }

    func testUnreadableRecoveryIsVisibleButCannotStartAnotherRequest() async throws {
        let store = StopMemoryStore()
        store.fail = true
        let model = detail(store, identity: StopIdentity())
        SequencedURLProtocol.sequence = [.status(404, body: "{}")]
        await model.load()
        XCTAssertTrue(model.stopRecovery.available)
        let recovery = try XCTUnwrap(model.stopRecovery.makeRecoveryModel())
        await recovery.checkStatus()
        await recovery.submit(reason: .other)
        XCTAssertNotNil(recovery.error)
        XCTAssertFalse(recovery.maySubmit)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
        XCTAssertTrue(posts.isEmpty)
    }

    func testSavedEntryRetiresOnSessionReplacementWithoutReadingAnotherScope() {
        let store = StopMemoryStore()
        store.request = request()
        let identity = StopIdentity()
        let model = detail(store, identity: identity)
        model.stopRecovery.refresh()
        XCTAssertTrue(model.stopRecovery.available)
        identity.session = "replacement"
        XCTAssertFalse(model.stopRecovery.available)
        XCTAssertNil(model.makeStopViewModel(action: .cancel))
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testDelayedPreviewCannotPublishAfterExplicitSheetRetirement() async throws {
        let model = make(StopMemoryStore())
        SequencedURLProtocol.sequence = try [.status(200, body: preview(), delay: 0.12)]
        let read = Task { await model.checkStatus() }
        await waitForRequestCount(1)
        model.retire()
        await read.value
        XCTAssertFalse(model.isCurrent)
        XCTAssertNil(model.terms)
        XCTAssertFalse(model.maySubmit)
        XCTAssertTrue(posts.isEmpty)
    }

    func testDelayedCompletedReceiptCannotClearRecoveryAfterCloseOrReplacement() async throws {
        for replaceSession in [false, true] {
            SequencedURLProtocol.reset()
            let store = StopMemoryStore()
            let original = request()
            store.request = original
            let identity = StopIdentity()
            let model = make(store, identity: identity)
            SequencedURLProtocol.routeResponses = try [
                submitPath + "/" + requestId: [.status(200, body: json(progress(original)))],
                submitPath: [.status(200, body: json(progress(original, completed: true)), delay: 0.12)]
            ]
            await model.checkStatus()
            let write = Task { await model.retry() }
            await waitForRequestCount(2)
            if replaceSession { identity.session = "replacement" } else { model.retire() }
            await write.value
            XCTAssertFalse(model.completed)
            XCTAssertNil(model.terms)
            XCTAssertEqual(store.request, original)
            XCTAssertEqual(posts.count, 1)
        }
    }

    func testConcurrentSheetsAndRepeatedTapCannotSendCompetingRequests() async throws {
        let store = StopMemoryStore()
        let original = request()
        store.request = original
        let first = make(store)
        let second = make(store, action: .reopenBidding)
        SequencedURLProtocol.routeResponses = try [
            submitPath + "/" + requestId: [
                .status(200, body: json(progress(original))),
                .status(200, body: json(progress(original)))
            ],
            submitPath: [.status(200, body: json(progress(original)), delay: 0.12)]
        ]
        await first.checkStatus()
        await second.checkStatus()
        let send = Task { await first.retry() }
        await waitForRequestCount(3)
        await first.retry()
        await second.retry()
        await send.value
        XCTAssertEqual(posts.count, 1)
        XCTAssertEqual(store.request, original)
        XCTAssertFalse(first.completed)
    }

    func testDisappearingSavedRecordNeverTurnsRecoveryEntryIntoNewCancellation() async throws {
        let store = StopMemoryStore()
        store.request = request()
        let model = detail(store, identity: StopIdentity())
        model.stopRecovery.refresh()
        let recovery = try XCTUnwrap(model.stopRecovery.makeRecoveryModel())
        store.request = nil
        await recovery.checkStatus()
        await recovery.submit(reason: .other)
        XCTAssertFalse(recovery.maySubmit)
        XCTAssertNotNil(recovery.error)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    private func waitForRequestCount(_ count: Int) async {
        for _ in 0..<100 where SequencedURLProtocol.capturedRequests.count < count {
            try? await Task.sleep(for: .milliseconds(5))
        }
        XCTAssertGreaterThanOrEqual(SequencedURLProtocol.capturedRequests.count, count)
    }
}
