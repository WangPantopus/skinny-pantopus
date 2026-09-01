//
//  SocketClientAuthErrorTests.swift
//  PantopusTests
//
//  Socket auth-error handling (design §7.2 / §7.7): a refreshable auth
//  error runs one single-flight token refresh and reconnects with the new
//  token; a revocation code stops the reconnect loop and asks `AuthManager`
//  to confirm over HTTP; a fresh token lifts the stop. The Socket.IO
//  transport itself is not exercised (no server) — only the classifier
//  and the hooks around it.
//

import XCTest
@testable import Pantopus

@MainActor
final class SocketClientAuthErrorTests: XCTestCase {
    private var client: SocketClient!

    override func setUp() {
        super.setUp()
        client = SocketClient()
    }

    override func tearDown() {
        client.disconnect()
        client = nil
        super.tearDown()
    }

    func testErrorMessageExtractsStringDictionaryAndError() {
        XCTAssertEqual(SocketClient.errorMessage(from: ["Invalid token"]), "Invalid token")
        XCTAssertEqual(SocketClient.errorMessage(from: [["message": "Authentication failed"]]), "Authentication failed")
        XCTAssertEqual(SocketClient.errorMessage(from: [["code": "SESSION_REVOKED"]]), "SESSION_REVOKED")
        XCTAssertEqual(SocketClient.errorMessage(from: []), "")
        XCTAssertEqual(SocketClient.errorMessage(from: [42]), "42")
    }

    func testRefreshableAuthErrorRefreshesOnceAndReconnectsWithTheNewToken() async {
        let refreshed = expectation(description: "refresher called")
        refreshed.assertForOverFulfill = true
        var calls = 0
        client.tokenRefresher = {
            calls += 1
            refreshed.fulfill()
            return "t2"
        }
        client.revocationConfirmer = { XCTFail("no revocation on a plain auth error") }
        client.connect(token: "t1")

        // A burst of errors from one stale token coalesces into one refresh.
        client.handleSocketError("Invalid token")
        client.handleSocketError("Authentication failed")
        client.handleSocketError("jwt expired")

        await fulfillment(of: [refreshed], timeout: 2)
        // Let the recovery task finish its reconnect (bounded spin — the
        // reconnect is a couple of hops behind the refresher call).
        for _ in 0..<200 where client.authToken != "t2" {
            await Task.yield()
        }
        XCTAssertEqual(calls, 1)
        XCTAssertFalse(client.stoppedForRevocation)
        XCTAssertEqual(client.authToken, "t2", "reconnected with the rotated token")
    }

    func testNonAuthErrorsAreIgnored() async {
        client.tokenRefresher = {
            XCTFail("network errors must not trigger a refresh")
            return nil
        }
        client.connect(token: "t1")
        client.handleSocketError("Could not connect to the server.")
        client.handleSocketError("websocket: close 1006")
        await Task.yield()
        XCTAssertFalse(client.stoppedForRevocation)
    }

    func testRevocationCodesStopReconnectingAndConfirmOverHTTP() async {
        let confirmed = expectation(description: "confirmer called")
        client.revocationConfirmer = { confirmed.fulfill() }
        client.tokenRefresher = {
            XCTFail("a revoked session is not refreshed from the socket path")
            return nil
        }
        client.connect(token: "t1")

        client.handleSocketError("SESSION_REVOKED")

        await fulfillment(of: [confirmed], timeout: 2)
        XCTAssertTrue(client.stoppedForRevocation)
        XCTAssertEqual(client.connectionState, .disconnected)

        // While stopped, neither errors nor a same-token connect restart it.
        client.handleSocketError("Invalid token")
        client.connect(token: "t1")
        await Task.yield()
        XCTAssertTrue(client.stoppedForRevocation)
        XCTAssertEqual(client.connectionState, .disconnected)

        // A fresh token (new sign-in / rotated pair) lifts the stop.
        client.connect(token: "t2")
        XCTAssertFalse(client.stoppedForRevocation)
        XCTAssertEqual(client.authToken, "t2")
    }

    func testDeviceRevokedIsTerminalToo() async {
        let confirmed = expectation(description: "confirmer called")
        client.revocationConfirmer = { confirmed.fulfill() }
        client.connect(token: "t1")
        client.handleSocketError("device_revoked")
        await fulfillment(of: [confirmed], timeout: 2)
        XCTAssertTrue(client.stoppedForRevocation)
    }

    func testAuthErrorWithoutASocketIsANoOp() async {
        client.tokenRefresher = {
            XCTFail("nothing to reconnect")
            return nil
        }
        client.handleSocketError("Invalid token")
        await Task.yield()
        XCTAssertFalse(client.stoppedForRevocation)
    }
}
