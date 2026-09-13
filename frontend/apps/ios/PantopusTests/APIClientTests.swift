//
//  APIClientTests.swift
//  PantopusTests
//
//  Covers the core request loop: happy path, 401 (maps to AuthManager),
//  5xx with body, decode errors, auth header, and the snake_case → camelCase
//  conversion round-trip.
//

import XCTest
@testable import Pantopus

@MainActor
final class APIClientTests: XCTestCase {
    private var client: APIClient!
    private var auth: AuthManager!
    private var markerDirectory: URL!

    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
        client = APIClient(environment: .current, session: TestSession.make())
        markerDirectory = FileManager.default.temporaryDirectory.appendingPathComponent("api-client-tests-" + UUID().uuidString)
        auth = AuthManager(
            store: InMemorySecureStore(),
            apiClient: client,
            installMarker: InstallMarker(directory: markerDirectory),
            allowSecureEnclave: false
        )
    }

    override func tearDown() async throws {
        await auth.awaitBackgroundWork()
        auth = nil
        client = nil
        try? FileManager.default.removeItem(at: markerDirectory)
        markerDirectory = nil
        URLProtocolStub.reset()
        try await super.tearDown()
    }

    func testDecodesSnakeCaseUser() async throws {
        URLProtocolStub.stub(
            path: "/api/users/me",
            response: .json(Fixtures.userJSON)
        )
        let user: UserDTO = try await client.request(
            Endpoint(method: .get, path: "/api/users/me")
        )
        XCTAssertEqual(user.id, "u_123")
        XCTAssertEqual(user.displayName, "Alice")
    }

    func testDoesNotAttachAuthHeaderWhenUnauthenticated() async throws {
        URLProtocolStub.stub(path: "/api/posts", response: .json(Fixtures.feedJSON))
        let _: FeedResponse = try await client.request(
            Endpoint(method: .get, path: "/api/posts", authenticated: false)
        )
        let headers = URLProtocolStub.capturedRequests.last?.allHTTPHeaderFields ?? [:]
        XCTAssertNil(headers["Authorization"], "Unauthenticated requests must not carry a Bearer token")
        XCTAssertEqual(headers["X-Client-Platform"]?.hasPrefix("ios-"), true)
        XCTAssertEqual(headers["Content-Type"], "application/json")
    }

    func testNotFoundReceiptRequiresExplicitOptIn() async throws {
        let endpoint = Endpoint(method: .get, path: "/api/homes/command-recovery", authenticated: false)
        URLProtocolStub.stub(path: endpoint.path, response: .json("{\"state\":\"rejected\"}", status: 404))
        do {
            _ = try await client.requestDataResponse(endpoint)
            XCTFail("The default not-found behavior must be preserved")
        } catch APIError.notFound {}
        let response = try await client.requestDataResponse(endpoint, includingNotFound: true)
        XCTAssertEqual(response.response.statusCode, 404)
        XCTAssertEqual(String(data: response.data, encoding: .utf8), "{\"state\":\"rejected\"}")
    }

    func testNotFoundReceiptOptInStillRejectsUnauthorizedResponse() async {
        let endpoint = Endpoint(method: .get, path: "/api/homes/command-recovery", authenticated: false)
        URLProtocolStub.stub(path: endpoint.path, response: .json("{\"state\":\"completed\"}", status: 401))
        do {
            _ = try await client.requestDataResponse(endpoint, includingForbidden: true, includingNotFound: true)
            XCTFail("Receipt options cannot expose an unauthorized response as success")
        } catch APIError.unauthorized {} catch {
            XCTFail("Expected unauthorized response")
        }
    }

    func test401TriggersUnauthorizedError() async {
        URLProtocolStub.stub(
            path: "/api/users/me",
            response: .json("{\"error\":\"unauthorized\"}", status: 401)
        )
        do {
            let _: UserDTO = try await client.request(
                Endpoint(method: .get, path: "/api/users/me")
            )
            XCTFail("Expected .unauthorized")
        } catch APIError.unauthorized {
            // pass
        } catch {
            XCTFail("Expected APIError.unauthorized, got \(error)")
        }
    }

    func test5xxIsSurfacedAsServerError() async {
        URLProtocolStub.stub(
            path: "/api/posts",
            response: .json("{\"error\":\"boom\"}", status: 503)
        )
        do {
            let _: FeedResponse = try await client.request(
                Endpoint(method: .get, path: "/api/posts", authenticated: false)
            )
            XCTFail("Expected server error")
        } catch let APIError.server(status, _) {
            XCTAssertEqual(status, 503)
        } catch {
            XCTFail("Expected APIError.server, got \(error)")
        }
    }

    func testExplicitForbiddenBodyRetainsStatusAndDefaultDenial() async throws {
        let endpoint = Endpoint(method: .get, path: "/api/homes/current/dashboard-access")
        let body = "{\"hasAccess\":false,\"verification_required\":true}"
        URLProtocolStub.stub(path: endpoint.path, response: .json(body, status: 403))
        let response = try await client.requestDataResponse(endpoint, includingForbidden: true)
        XCTAssertEqual(response.response.statusCode, 403)
        XCTAssertEqual(String(data: response.data, encoding: .utf8), body)
        do {
            _ = try await client.requestDataResponse(endpoint)
            XCTFail("Ordinary callers must still receive a forbidden error")
        } catch APIError.forbidden {} catch { XCTFail("Unexpected error: \(error)") }
    }

    func testForbiddenBodyOptInDoesNotBypassUnauthorizedResponse() async {
        let endpoint = Endpoint(method: .get, path: "/api/homes/current/dashboard-access")
        URLProtocolStub.stub(path: endpoint.path, response: .json("{}", status: 401))
        do {
            _ = try await client.requestDataResponse(endpoint, includingForbidden: true)
            XCTFail("Authentication failure cannot be treated as applicant context")
        } catch APIError.unauthorized {} catch { XCTFail("Unexpected error: \(error)") }
    }

    func testDecodeFailureSurfacesDecodingError() async {
        URLProtocolStub.stub(
            path: "/api/users/me",
            response: .json("{\"not\":\"a user\"}")
        )
        do {
            let _: UserDTO = try await client.request(
                Endpoint(method: .get, path: "/api/users/me", authenticated: false)
            )
            XCTFail("Expected decoding error")
        } catch APIError.decoding {
            // pass
        } catch {
            XCTFail("Expected APIError.decoding, got \(error)")
        }
    }

    func testQueryParamsAreAppended() async throws {
        URLProtocolStub.stub(path: "/api/posts", response: .json(Fixtures.feedJSON))
        let _: FeedResponse = try await client.request(
            Endpoint(
                method: .get,
                path: "/api/posts",
                query: ["cursor": "abc", "limit": "10"],
                authenticated: false
            )
        )
        let url = URLProtocolStub.capturedRequests.last?.url?.absoluteString ?? ""
        XCTAssertTrue(url.contains("cursor=abc"))
        XCTAssertTrue(url.contains("limit=10"))
    }
}
