//
//  RetryAndErrorTests.swift
//  PantopusTests
//
//  Verifies the APIClient retry loop, typed error surfaces (401/403/404/5xx),
//  and non-idempotent no-retry invariant.
//

import XCTest
@testable import Pantopus

@MainActor
final class RetryAndErrorTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient(retries: Int = 2) -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: RetryPolicy(maxRetries: retries, baseDelay: 0.001, maxDelay: 0.010)
        )
    }

    func test5xxOnGetRetriesAndSucceeds() async throws {
        SequencedURLProtocol.sequence = [
            .status(503, body: "{}"),
            .status(503, body: "{}"),
            .status(200, body: Fixtures.feedJSON)
        ]
        let client = makeClient(retries: 2)
        let _: FeedResponse = try await client.request(
            Endpoint(method: .get, path: "/api/posts", authenticated: false)
        )
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 3, "Expected two retries + one success")
    }

    func testRetriesAreExhausted() async {
        SequencedURLProtocol.sequence = [
            .status(503, body: "{}"),
            .status(503, body: "{}"),
            .status(503, body: "{}")
        ]
        let client = makeClient(retries: 2)
        do {
            let _: FeedResponse = try await client.request(
                Endpoint(method: .get, path: "/api/posts", authenticated: false)
            )
            XCTFail("Expected server error after retries exhausted")
        } catch let APIError.server(status, _) {
            XCTAssertEqual(status, 503)
            XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 3)
        } catch {
            XCTFail("Expected APIError.server, got \(error)")
        }
    }

    func testNonIdempotentPOSTDoesNotRetry() async {
        SequencedURLProtocol.sequence = [
            .status(503, body: "{}")
        ]
        let client = makeClient(retries: 2)
        do {
            _ = try await client.request(
                Endpoint(
                    method: .post,
                    path: "/api/users/login",
                    body: LoginRequest(email: "a", password: "b"),
                    authenticated: false
                )
            )
            XCTFail("Expected server error")
        } catch APIError.server {
            XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1, "POST must not be retried")
        } catch {
            XCTFail("Expected APIError.server, got \(error)")
        }
    }

    func test404SurfacesAsNotFound() async {
        SequencedURLProtocol.sequence = [.status(404, body: "{\"error\":\"nope\"}")]
        let client = makeClient(retries: 0)
        do {
            let _: FeedResponse = try await client.request(
                Endpoint(method: .get, path: "/api/posts", authenticated: false)
            )
            XCTFail("Expected notFound")
        } catch APIError.notFound {
            // pass
        } catch {
            XCTFail("Expected APIError.notFound, got \(error)")
        }
    }

    func test403SurfacesAsForbidden() async {
        SequencedURLProtocol.sequence = [.status(403, body: "{}")]
        let client = makeClient(retries: 0)
        do {
            let _: FeedResponse = try await client.request(
                Endpoint(method: .get, path: "/api/posts", authenticated: false)
            )
            XCTFail("Expected forbidden")
        } catch APIError.forbidden {
            // pass
        } catch {
            XCTFail("Expected APIError.forbidden, got \(error)")
        }
    }

    func test400SurfacesClientError() async {
        SequencedURLProtocol.sequence = [.status(422, body: "{\"error\":\"bad\"}")]
        let client = makeClient(retries: 0)
        do {
            let _: FeedResponse = try await client.request(
                Endpoint(method: .get, path: "/api/posts", authenticated: false)
            )
            XCTFail("Expected clientError")
        } catch let APIError.clientError(status, _) {
            XCTAssertEqual(status, 422)
        } catch {
            XCTFail("Expected APIError.clientError, got \(error)")
        }
    }

    func testRetryPolicyDelaysGrow() {
        let policy = RetryPolicy(maxRetries: 2, baseDelay: 0.300, maxDelay: 5.0)
        let d1 = policy.delay(forAttempt: 1)
        let d2 = policy.delay(forAttempt: 2)
        // Base delay ±20% jitter, so 0.24...0.36 for attempt 1 and 0.72...1.08 for attempt 2.
        XCTAssertGreaterThan(d1, 0.2)
        XCTAssertLessThan(d1, 0.4)
        XCTAssertGreaterThan(d2, 0.6)
        XCTAssertLessThan(d2, 1.2)
    }
}
