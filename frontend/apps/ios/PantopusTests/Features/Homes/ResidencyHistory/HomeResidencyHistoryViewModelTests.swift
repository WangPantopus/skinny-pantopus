import XCTest
@testable import Pantopus

@MainActor
final class HomeResidencyHistoryViewModelTests: XCTestCase {
    private typealias Fixtures = HomeResidencyHistoryFixtures
    private var current = true

    private func make(_ transport: HistoryReadTransportStub) -> HomeResidencyHistoryViewModel {
        let model = HomeResidencyHistoryViewModel(identity: Fixtures.identity, transport: transport) { self.current }
        model.resume()
        return model
    }

    func testDelayedOlderListCannotReplaceNewerPermissionDenial() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        let old = Task { await model.refresh() }
        await transport.waitForLists(1)
        let newer = Task { await model.refresh() }
        await transport.waitForLists(2)
        transport.finishList(1, .failure(.forbidden))
        await newer.value
        XCTAssertEqual(model.state, .failure(.forbidden))
        try transport.finishList(0, .success(Fixtures.parsedPage()))
        await old.value
        XCTAssertEqual(model.state, .failure(.forbidden))
        XCTAssertEqual(transport.sessionCount, 2)
    }

    func testRefreshImmediatelyRetiresConfirmedRowsAndEmptyIsOnlyFromSuccess() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        try await ready(model, transport: transport, page: Fixtures.parsedPage())
        let refresh = Task { await model.refresh() }
        await transport.waitForLists(2)
        XCTAssertEqual(model.state, .loading)
        transport.finishList(1, .failure(.unavailable))
        await refresh.value
        XCTAssertEqual(model.state, .failure(.unavailable))
        let retry = Task { await model.retry() }
        await transport.waitForLists(3)
        XCTAssertEqual(model.state, .loading)
        try transport.finishList(2, .success(Fixtures.parsedPage([])))
        await retry.value
        XCTAssertEqual(model.state, try .list(Fixtures.parsedPage([])))
    }

    func testDelayedDetailCannotReplaceNewerListDenial() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        try await ready(model, transport: transport, page: Fixtures.parsedPage())
        let detail = Task { await model.open(Fixtures.id(0)) }
        await transport.waitForDetails(1)
        XCTAssertEqual(model.state, .loading)
        let refresh = Task { await model.refresh() }
        await transport.waitForLists(2)
        transport.finishList(1, .failure(.forbidden))
        await refresh.value
        try transport.finishDetail(0, .success(HomeResidencyHistoryItem.parse(Fixtures.item(), identity: Fixtures.identity)))
        await detail.value
        XCTAssertEqual(model.state, .failure(.forbidden))
    }

    func testAccountRetirementHidesPublishedAndDelayedPrivateContentImmediately() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        try await ready(model, transport: transport, page: Fixtures.parsedPage())
        let detail = Task { await model.open(Fixtures.id(0)) }
        await transport.waitForDetails(1)
        current = false
        XCTAssertEqual(model.state, .failure(.sessionChanged))
        XCTAssertFalse(model.isWorking)
        try transport.finishDetail(0, .success(HomeResidencyHistoryItem.parse(Fixtures.item(), identity: Fixtures.identity)))
        await detail.value
        XCTAssertEqual(model.state, .failure(.sessionChanged))
        await model.refresh()
        XCTAssertEqual(transport.sessionCount, 2, "A retired model cannot read in the replacement account")
    }

    func testSessionChangeDuringSessionReadNeverDispatchesHistoryRead() async {
        let transport = HistoryReadTransportStub()
        transport.holdSession = true
        let model = make(transport)
        let read = Task { await model.refresh() }
        await transport.waitForSession()
        current = false
        transport.releaseSession()
        await read.value
        XCTAssertEqual(model.state, .failure(.sessionChanged))
        XCTAssertEqual(transport.listRequests.count, 0)
    }

    func testUnexpectedSessionIdentityCannotReachPrivateRead() async {
        let transport = HistoryReadTransportStub()
        transport.sessionResult = .init(actorId: Fixtures.applicant, scope: Fixtures.session.scope)
        let model = make(transport)
        await model.refresh()
        XCTAssertEqual(model.state, .failure(.sessionChanged))
        XCTAssertEqual(transport.listRequests.count, 0)
    }

    func testBackgroundRetiresPendingReadAndQueuedRefreshCannotReopenIt() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        let old = Task { await model.refresh() }
        await transport.waitForLists(1)
        model.suspend()
        await model.refresh()
        XCTAssertEqual(transport.listRequests.count, 1)
        try transport.finishList(0, .success(Fixtures.parsedPage()))
        await old.value
        XCTAssertEqual(model.state, .loading)
        model.resume()
        let foreground = Task { await model.refresh() }
        await transport.waitForLists(2)
        transport.finishList(1, .failure(.forbidden))
        await foreground.value
        XCTAssertEqual(model.state, .failure(.forbidden))
    }

    func testPaginationAppendsOnlyAfterFreshSessionAndHidesPriorRowsWhileLoading() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        let first = try Fixtures.parsedPage((1...20).reversed().map { Fixtures.item($0) }, next: .string(Fixtures.cursor(1)))
        await ready(model, transport: transport, page: first)
        let more = Task { await model.loadMore() }
        await transport.waitForLists(2)
        XCTAssertEqual(model.state, .loading)
        XCTAssertEqual(transport.listRequests[1]?.raw, Fixtures.cursor(1))
        try transport.finishList(1, .success(Fixtures.parsedPage([Fixtures.item(0)])))
        await more.value
        guard case let .list(page) = model.state else { return XCTFail("Expected confirmed combined history") }
        XCTAssertEqual(page.items.count, 21)
        XCTAssertEqual(page.items.last?.id, Fixtures.id(0))
        XCTAssertNil(page.nextCursor)
        XCTAssertEqual(transport.sessionCount, 2)
    }

    func testOlderPageCannotRepopulateAfterNewerCurrentRefresh() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        let first = try Fixtures.parsedPage((1...20).reversed().map { Fixtures.item($0) }, next: .string(Fixtures.cursor(1)))
        await ready(model, transport: transport, page: first)
        let more = Task { await model.loadMore() }
        await transport.waitForLists(2)
        let refresh = Task { await model.refresh() }
        await transport.waitForLists(3)
        let recent = try Fixtures.parsedPage([Fixtures.item(100)])
        transport.finishList(2, .success(recent))
        await refresh.value
        try transport.finishList(1, .success(Fixtures.parsedPage([Fixtures.item(0)])))
        await more.value
        XCTAssertEqual(model.state, .list(recent))
    }

    func testInvalidCursorRetryStartsRecentAndDoesNotReuseOldPage() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        let first = try Fixtures.parsedPage((1...20).reversed().map { Fixtures.item($0) }, next: .string(Fixtures.cursor(1)))
        await ready(model, transport: transport, page: first)
        let more = Task { await model.loadMore() }
        await transport.waitForLists(2)
        transport.finishList(1, .failure(.cursorInvalid))
        await more.value
        XCTAssertEqual(model.state, .failure(.cursorInvalid))
        let retry = Task { await model.retry() }
        await transport.waitForLists(3)
        XCTAssertNil(transport.listRequests[2])
        try transport.finishList(2, .success(Fixtures.parsedPage([])))
        await retry.value
        XCTAssertEqual(model.state, try .list(Fixtures.parsedPage([])))
    }

    func testUnavailableOlderPageRetriesSameAnchorWithoutDisplayingCachedRows() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        let first = try Fixtures.parsedPage((1...20).reversed().map { Fixtures.item($0) }, next: .string(Fixtures.cursor(1)))
        await ready(model, transport: transport, page: first)
        let more = Task { await model.loadMore() }
        await transport.waitForLists(2)
        transport.finishList(1, .failure(.unavailable))
        await more.value
        let retry = Task { await model.retry() }
        await transport.waitForLists(3)
        XCTAssertEqual(model.state, .loading)
        XCTAssertEqual(transport.listRequests[2]?.raw, Fixtures.cursor(1))
        try transport.finishList(2, .success(Fixtures.parsedPage([Fixtures.item(0)])))
        await retry.value
        guard case let .list(page) = model.state else { return XCTFail("Expected recovered page") }
        XCTAssertEqual(page.items.count, 21)
    }

    func testUnknownSelectionDoesNotReadAndMissingDetailCannotRevealPriorItem() async throws {
        let transport = HistoryReadTransportStub()
        let model = make(transport)
        try await ready(model, transport: transport, page: Fixtures.parsedPage())
        await model.open(Fixtures.id(42))
        XCTAssertTrue(transport.detailRequests.isEmpty)
        let detail = Task { await model.open(Fixtures.id(0)) }
        await transport.waitForDetails(1)
        transport.finishDetail(0, .failure(.notFound))
        await detail.value
        XCTAssertEqual(model.state, .failure(.notFound))
    }

    private func ready(_ model: HomeResidencyHistoryViewModel, transport: HistoryReadTransportStub, page: HomeResidencyHistoryPage) async {
        let task = Task { await model.refresh() }
        await transport.waitForLists(1)
        transport.finishList(0, .success(page))
        await task.value
    }
}

@MainActor
private final class HistoryReadTransportStub: HomeResidencyHistoryTransport {
    private(set) var sessionCount = 0
    private(set) var listRequests: [HomeResidencyHistoryCursor?] = []
    private(set) var detailRequests: [String] = []
    private var lists: [CheckedContinuation<HomeResidencyHistoryPage, any Error>?] = []
    private var details: [CheckedContinuation<HomeResidencyHistoryItem, any Error>?] = []
    private var heldSession: CheckedContinuation<HomeResidencyHistorySession, Never>?
    var holdSession = false
    var sessionResult = HomeResidencyHistoryFixtures.session

    func session(actorId _: String) async throws -> HomeResidencyHistorySession {
        sessionCount += 1
        if holdSession { return await withCheckedContinuation { heldSession = $0 } }
        return sessionResult
    }

    func list(
        identity _: HomeResidencyHistoryIdentity,
        session _: HomeResidencyHistorySession,
        after: HomeResidencyHistoryCursor?
    ) async throws -> HomeResidencyHistoryPage {
        listRequests.append(after)
        return try await withCheckedThrowingContinuation { lists.append($0) }
    }

    func detail(
        identity _: HomeResidencyHistoryIdentity,
        session _: HomeResidencyHistorySession,
        receiptId: String
    ) async throws -> HomeResidencyHistoryItem {
        detailRequests.append(receiptId)
        return try await withCheckedThrowingContinuation { details.append($0) }
    }

    func waitForLists(_ count: Int) async {
        await wait { self.lists.count >= count }
    }

    func waitForDetails(_ count: Int) async {
        await wait { self.details.count >= count }
    }

    func waitForSession() async {
        await wait { self.heldSession != nil }
    }

    private func wait(_ ready: () -> Bool) async {
        for _ in 0..<1000 {
            if ready() { return }
            await Task.yield()
        }
        XCTFail("The delayed read did not reach the expected continuation")
    }

    func releaseSession() {
        heldSession?.resume(returning: sessionResult)
        heldSession = nil
    }

    func finishList(_ index: Int, _ result: Result<HomeResidencyHistoryPage, HomeResidencyHistoryError>) {
        guard lists.indices.contains(index) else { return XCTFail("Missing list continuation") }
        lists[index]?.resume(with: result.mapError { $0 as any Error })
        lists[index] = nil
    }

    func finishDetail(_ index: Int, _ result: Result<HomeResidencyHistoryItem, HomeResidencyHistoryError>) {
        guard details.indices.contains(index) else { return XCTFail("Missing detail continuation") }
        details[index]?.resume(with: result.mapError { $0 as any Error })
        details[index] = nil
    }
}
