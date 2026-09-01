//
//  APIErrorTests.swift
//  PantopusTests
//

import XCTest
@testable import Pantopus

final class APIErrorTests: XCTestCase {
    func testFriendlyClientMessageParsesValidationDetails() {
        let raw = """
        {"error":"Validation failed","message":"Please correct the highlighted fields.",\
        "details":[{"field":"safetyAlertKind","message":"Safety Alert Kind is required.","code":"any.required"}]}
        """
        XCTAssertEqual(
            APIError.friendlyClientMessage(raw),
            "Safety Alert Kind is required."
        )
    }
}
