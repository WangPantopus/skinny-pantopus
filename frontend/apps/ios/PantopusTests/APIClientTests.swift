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

    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
        client = APIClient(environment: .current, session: TestSession.make())
    }

    override func tearDown() {
        URLProtocolStub.reset()
        super.tearDown()
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
