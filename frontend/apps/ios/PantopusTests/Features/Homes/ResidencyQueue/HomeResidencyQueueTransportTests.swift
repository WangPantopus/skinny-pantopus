import XCTest
@testable import Pantopus

@MainActor
final class HomeResidencyQueueTransportTests: XCTestCase {
    private typealias Fixtures = HomeResidencyQueueFixtures
    private let root = "/api/homes"
    private var api: APIClient!
    private var auth: AuthManager!
    private var marker: URL!
    private var transport: APIHomeResidencyQueueTransport {
        .init(api: api)
    }

    override func setUp() async throws {
        try await super.setUp()
        URLProtocolStub.reset()
        api = APIClient(environment: .current, session: TestSession.make(), retryPolicy: .none)
        marker = FileManager.default.temporaryDirectory.appendingPathComponent("queue-read-tests-" + UUID().uuidString)
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

    func testUncachedSessionBoundGETsAndStrictSuccessEnvelope() async throws {
        try URLProtocolStub.stub(
            path: root + "/residency-claims/session",
            response: .json(Fixtures.text(.object(["session": Fixtures.sessionJSON])))
        )
        try URLProtocolStub.stub(path: root + "/" + Fixtures.home + "/claims", response: .json(Fixtures.text(Fixtures.page())))
        let session = try await transport.session(actorId: Fixtures.actor)
        let page = try await transport.list(identity: Fixtures.identity, session: session)
        XCTAssertEqual(page, try Fixtures.parsedPage())
        let requests = URLProtocolStub.capturedRequests.filter {
            [root + "/residency-claims/session", root + "/" + Fixtures.home + "/claims"].contains($0.url?.path ?? "")
        }
        XCTAssertEqual(requests.count, 2)
        for request in requests {
            XCTAssertEqual(request.httpMethod, "GET")
            XCTAssertNil(request.httpBody)
            XCTAssertNil(request.httpBodyStream)
            XCTAssertNil(request.url?.query)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Cache-Control"), "no-cache, no-store")
            XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
        }
        XCTAssertNil(requests[0].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"))
        XCTAssertEqual(requests[1].value(forHTTPHeaderField: "X-Pantopus-Session-Scope"), Fixtures.session.scope)
    }

    func testWrongStatusOrMalformedSuccessCannotBecomeAnEmptyQueue() async {
        for (status, body) in [(200, "null"), (200, "{}"), (200, "{\"claims\":[]}"), (204, "{}"), (200, "[]")] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(path: root + "/" + Fixtures.home + "/claims", response: .json(body, status: status))
            do {
                _ = try await transport.list(identity: Fixtures.identity, session: Fixtures.session)
                XCTFail("Invalid success must fail closed")
            } catch { XCTAssertEqual(error as? HomeResidencyQueueError, .unavailable) }
        }
    }

    func testSafeErrorsRemainDistinctFromEmptyAndNeverDisplayServerText() async throws {
        for (status, code, expected) in [
            (403, "MEMBERS_MANAGE_REQUIRED", HomeResidencyQueueError.forbidden),
            (404, "HOME_NOT_FOUND", .homeUnavailable),
            (409, "SESSION_SCOPE_CHANGED", .sessionChanged),
            (503, "RESIDENCY_CLAIMS_UNAVAILABLE", .unavailable)
        ] {
            URLProtocolStub.reset()
            URLProtocolStub.stub(
                path: root + "/" + Fixtures.home + "/claims",
                response: .json("{\"code\":\"\(code)\",\"error\":\"untrusted raw text\"}", status: status)
            )
            do {
                _ = try await transport.list(identity: Fixtures.identity, session: Fixtures.session)
                XCTFail("A refused read cannot be an empty success")
            } catch {
                XCTAssertEqual(error as? HomeResidencyQueueError, expected)
                XCTAssertFalse(error.localizedDescription.contains("untrusted raw text"))
            }
        }
    }
}
