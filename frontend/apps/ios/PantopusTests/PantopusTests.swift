//
//  PantopusTests.swift
//  PantopusTests
//
//  Smoke tests for AppEnvironment + Info.plist wiring.
//

import XCTest
@testable import Pantopus

final class PantopusTests: XCTestCase {
    func testAppEnvironmentURLsArePopulated() {
        let env = AppEnvironment.current
        XCTAssertFalse(env.apiBaseURL.absoluteString.isEmpty)
        XCTAssertFalse(env.socketURL.absoluteString.isEmpty)
    }

    func testAppEnvironmentTargetFallback() {
        let current = AppEnvironment.Target.current
        XCTAssertTrue([.local, .staging, .production].contains(current))
    }

    func testAppEnvironmentKnownHostsByTarget() {
        // Make sure we haven't silently swapped staging/prod URLs.
        let env = AppEnvironment.current
        switch env.target {
        case .local:
            XCTAssertNotNil(env.apiBaseURL.host)
            XCTAssertTrue(["http", "https"].contains(env.apiBaseURL.scheme))
        case .staging:
            XCTAssertTrue(env.apiBaseURL.absoluteString.contains("staging"))
        case .production:
            XCTAssertEqual(env.apiBaseURL.host, "api.pantopus.app")
        }
    }
}
