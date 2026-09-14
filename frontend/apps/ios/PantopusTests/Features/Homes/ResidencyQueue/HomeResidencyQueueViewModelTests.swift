import XCTest
@testable import Pantopus

@MainActor
final class HomeResidencyQueueViewModelTests: XCTestCase {
    private typealias Fixtures = HomeResidencyQueueFixtures
    private var current = true

    private func make(_ transport: QueueReadStub) -> HomeResidencyQueueViewModel {
        let model = HomeResidencyQueueViewModel(identity: Fixtures.identity, transport: transport) { self.current }
        model.resume()
        return model
    }

    func testDeliveredOldSuccessCannotReplaceNewerForbiddenResult() async throws {
        let transport = QueueReadStub()
        let model = make(transport)
        let old = Task { await model.refresh() }
        await transport.waitForLists(1)
        let newer = Task { await model.refresh() }
        await transport.waitForLists(2)
        transport.finish(1, .failure(.forbidden))
        await newer.value
        try transport.finish(0, .success(Fixtures.parsedPage()))
        await old.value
        XCTAssertEqual(model.state, .failure(.forbidden))
        XCTAssertFalse(model.beginReview(claimId: Fixtures.claim))
    }

    func testBackgroundOrTabRetirementCannotBeUndoneByAQueuedRead() async throws {
        let transport = QueueReadStub()
        let model = make(transport)
        let old = Task { await model.refresh() }
        await transport.waitForLists(1)
        model.suspend()
        await model.refresh()
        XCTAssertEqual(transport.sessions, 1)
        try transport.finish(0, .success(Fixtures.parsedPage()))
        await old.value
        XCTAssertEqual(model.state, .loading)
        XCTAssertFalse(model.beginReview(claimId: Fixtures.claim))
        model.resume()
        let resumed = Task { await model.refresh() }
        await transport.waitForLists(2)
        transport.finish(1, .success(.init(claims: [])))
        await resumed.value
        XCTAssertEqual(model.state, .ready(.init(claims: [])))
        XCTAssertEqual(transport.sessions, 2)
    }

    func testAccountChangeImmediatelyHidesReadyRowsAndPreventsReviewOrNewRead() async throws {
        let transport = QueueReadStub()
        let model = make(transport)
        let read = Task { await model.refresh() }
        await transport.waitForLists(1)
        try transport.finish(0, .success(Fixtures.parsedPage()))
        await read.value
        current = false
        XCTAssertEqual(model.state, .failure(.sessionChanged))
        XCTAssertFalse(model.beginReview(claimId: Fixtures.claim))
        await model.refresh()
        XCTAssertEqual(transport.sessions, 1)
    }

    func testReviewRequiresAnExactReadyClaimAndRetiresBeforeOpening() async throws {
        let transport = QueueReadStub()
        let model = make(transport)
        let read = Task { await model.refresh() }
        await transport.waitForLists(1)
        try transport.finish(0, .success(Fixtures.parsedPage()))
        await read.value
        XCTAssertFalse(model.beginReview(claimId: Fixtures.actor))
        XCTAssertTrue(model.beginReview(claimId: Fixtures.claim))
        XCTAssertEqual(model.state, .loading)
        XCTAssertFalse(model.beginReview(claimId: Fixtures.claim))
    }

    func testSessionChangedDuringBootstrapNeverDispatchesList() async {
        let transport = QueueReadStub()
        transport.holdSession = true
        let model = make(transport)
        let read = Task { await model.refresh() }
        for _ in 0..<1000 {
            if transport.sessionContinuation != nil { break }
            await Task.yield()
        }
        XCTAssertNotNil(transport.sessionContinuation)
        current = false
        transport.sessionContinuation?.resume(returning: Fixtures.session)
        await read.value
        XCTAssertEqual(model.state, .failure(.sessionChanged))
        XCTAssertEqual(transport.listCount, 0)
    }
}

@MainActor
private final class QueueReadStub: HomeResidencyQueueTransport {
    var sessions = 0
    var holdSession = false
    var sessionContinuation: CheckedContinuation<HomeResidencyQueueSession, Never>?
    private var lists: [CheckedContinuation<HomeResidencyQueuePage, any Error>?] = []
    var listCount: Int {
        lists.count
    }

    func session(actorId _: String) async throws -> HomeResidencyQueueSession {
        sessions += 1
        if holdSession { return await withCheckedContinuation { sessionContinuation = $0 } }
        return HomeResidencyQueueFixtures.session
    }

    func list(identity _: HomeResidencyQueueIdentity, session _: HomeResidencyQueueSession) async throws -> HomeResidencyQueuePage {
        try await withCheckedThrowingContinuation { lists.append($0) }
    }

    func waitForLists(_ count: Int) async {
        for _ in 0..<1000 {
            if lists.count >= count { return }
            await Task.yield()
        }
        XCTFail("Expected request did not start")
    }

    func finish(_ index: Int, _ result: Result<HomeResidencyQueuePage, HomeResidencyQueueError>) {
        guard lists.indices.contains(index) else { return XCTFail("Missing continuation") }
        lists[index]?.resume(with: result.mapError { $0 as any Error })
        lists[index] = nil
    }
}
