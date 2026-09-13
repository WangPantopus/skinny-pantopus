import XCTest
@testable import Pantopus

@MainActor
final class HomeResidencyHistoryTransportTests: XCTestCase {
    private typealias Fixtures = HomeResidencyHistoryFixtures
    private let root = "/api/homes/residency-review-history"
    private var api: APIClient!
    private var auth: AuthManager!
    private var marker: URL!
    private var transport: APIHomeResidencyHistoryTransport {
        .init(api: api)
    }

    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
        api = APIClient(environment: .current, session: TestSession.make(), retryPolicy: .none)
        marker = FileManager.default.temporaryDirectory.appendingPathComponent("history-read-tests-" + UUID().uuidString)
        auth = AuthManager(
            store: InMemorySecureStore(),
            apiClient: api,
            installMarker: InstallMarker(directory: marker),
            allowSecureEnclave: false
        )
    }

    override func tearDown() async throws {
        await auth.awaitBackgroundWork()
        auth = nil
        api = nil
        try? FileManager.default.removeItem(at: marker)
        URLProtocolStub.reset()
        try await super.tearDown()
    }

    func testSessionListDetailUseOnlyUncachedGETWithFreshScopeAndNoCommandBody() async throws {
        try URLProtocolStub.stub(path: root + "/session", response: .json(Fixtures.text(.object(["session": Fixtures.sessionJSON]))))
        try URLProtocolStub.stub(path: root + "/" + Fixtures.home, response: .json(Fixtures.text(Fixtures.page())))
        try URLProtocolStub.stub(path: root + "/" + Fixtures.home + "/" + Fixtures.id(0), response: .json(Fixtures.text(Fixtures.detail())))
        let session = try await transport.session(actorId: Fixtures.actor)
        let page = try await transport.list(identity: Fixtures.identity, session: session, after: nil)
        let item = try await transport.detail(identity: Fixtures.identity, session: session, receiptId: Fixtures.id(0))
        XCTAssertEqual(page.items.first, item)
        let requests = URLProtocolStub.capturedRequests
        XCTAssertEqual(requests.count, 3)
        for request in requests {
            XCTAssertEqual(request.httpMethod, "GET")
            XCTAssertNil(request.httpBody)
            XCTAssertNil(request.httpBodyStream)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Cache-Control"), "no-cache, no-store")
            XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
        }
        XCTAssertNil(requests[0].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"))
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), Fixtures.session.scope)
        XCTAssertEqual(requests[2].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), Fixtures.session.scope)
        XCTAssertNil(requests[1].url?.query)
    }

    func testOlderReadUsesOnlyValidatedBoundCursor() async throws {
        let cursor = try HomeResidencyHistoryCursor.parse(Fixtures.cursor(1), identity: Fixtures.identity)
        try URLProtocolStub.stub(path: root + "/" + Fixtures.home, response: .json(Fixtures.text(Fixtures.page([Fixtures.item(0)]))))
        _ = try await transport.list(identity: Fixtures.identity, session: Fixtures.session, after: cursor)
        let request = try XCTUnwrap(URLProtocolStub.capturedRequests.last)
        let components = try XCTUnwrap(URLComponents(url: XCTUnwrap(request.url), resolvingAgainstBaseURL: false))
        XCTAssertEqual(components.queryItems, [URLQueryItem(name: "after", value: cursor.raw)])
        let foreign = HomeResidencyHistoryCursor(
            raw: Fixtures.cursor(1, actor: Fixtures.applicant),
            createdAt: Fixtures.date,
            id: Fixtures.id(1)
        )
        do {
            _ = try await transport.list(identity: Fixtures.identity, session: Fixtures.session, after: foreign)
            XCTFail("A foreign cursor must fail before sending")
        } catch { XCTAssertEqual(error as? HomeResidencyHistoryError, .cursorInvalid) }
        XCTAssertEqual(URLProtocolStub.capturedRequests.count, 1)
    }

    func testSafeErrorsRemainDistinctFromEmptyAndNeverDisplayServerText() async throws {
        for (status, code, expected) in [
            (403, "MEMBERS_MANAGE_REQUIRED", HomeResidencyHistoryError.forbidden),
            (404, "HOME_NOT_FOUND", .homeUnavailable), (404, "RESIDENCY_HISTORY_NOT_FOUND", .notFound),
            (400, "RESIDENCY_HISTORY_CURSOR_INVALID", .cursorInvalid), (409, "SESSION_SCOPE_CHANGED", .sessionChanged),
            (503, "RESIDENCY_HISTORY_UNAVAILABLE", .unavailable)
        ] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(
                path: root + "/" + Fixtures.home,
                response: .json("{\"code\":\"\(code)\",\"error\":\"untrusted raw text\"}", status: status)
            )
            do {
                _ = try await transport.list(identity: Fixtures.identity, session: Fixtures.session, after: nil)
                XCTFail("A refused read cannot be an empty success")
            } catch {
                XCTAssertEqual(error as? HomeResidencyHistoryError, expected)
                XCTAssertFalse(error.localizedDescription.contains("untrusted raw text"))
            }
        }
    }

    func testWrongStatusMalformedOrForeignSuccessFailsClosed() async throws {
        for (status, body) in try [
            (200, "null"), (200, "[]"), (204, "{}"), (
                200,
                Fixtures.text(Fixtures.changing(Fixtures.page(), at: ["actor_id"], to: .string(Fixtures.applicant)))
            ),
            (
                200,
                Fixtures.text(Fixtures.changing(
                    Fixtures.page(),
                    at: ["session", "session_scope"],
                    to: .string(String(repeating: "b", count: 64))
                ))
            ),
            (403, "{\"code\":[\"MEMBERS_MANAGE_REQUIRED\"],\"error\":\"bad\"}")
        ] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(path: root + "/" + Fixtures.home, response: .json(body, status: status))
            do {
                _ = try await transport.list(identity: Fixtures.identity, session: Fixtures.session, after: nil)
                XCTFail("Malformed response must never publish history")
            } catch { XCTAssertTrue(error is HomeResidencyHistoryError) }
        }
    }

    func testSelectedReceiptAndScopeAreCheckedBeforePublicationOrDispatch() async throws {
        try URLProtocolStub.stub(path: root + "/" + Fixtures.home + "/" + Fixtures.id(1), response: .json(Fixtures.text(Fixtures.detail())))
        do {
            _ = try await transport.detail(identity: Fixtures.identity, session: Fixtures.session, receiptId: Fixtures.id(1))
            XCTFail("Wrong selected item")
        } catch { XCTAssertEqual(error as? HomeResidencyHistoryError, .unavailable) }
        do {
            _ = try await transport.list(
                identity: Fixtures.identity,
                session: .init(actorId: Fixtures.applicant, scope: Fixtures.session.scope),
                after: nil
            )
            XCTFail("Wrong account before sending")
        } catch { XCTAssertEqual(error as? HomeResidencyHistoryError, .sessionChanged) }
        XCTAssertEqual(URLProtocolStub.capturedRequests.count, 1)
    }
}
