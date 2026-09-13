import XCTest

/// Installed app, normal sign-in/navigation and real Keychain; production HTTP/service/local SQL.
@MainActor
final class HomeClaimRelationshipJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18083"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = true
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["RUN_HOME_RELATIONSHIP_UI"] == "1",
            "Requires isolated SQL relationship fixture"
        )
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_RELATIONSHIP_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreenshot("Relationship final screen")
            if (testRun?.failureCount ?? 0) > 0 {
                let tree = XCTAttachment(string: app.debugDescription)
                tree.name = "Relationship hierarchy"
                tree.lifetime = .keepAlways
                add(tree)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testReviewedResponsesColdRecoveryCurrentRejectionStaleEvidenceRevocationAndBackground() async throws {
        app.launch()
        try await signIn()
        try openReviewQueue()
        try press(element("homeClaimReview_continueReview"))
        try require(element("homeRelationship.current").waitForExistence(timeout: 20))
        XCTAssertTrue(element("homeRelationship.evidence").label.contains("0 of 1"))
        XCTAssertFalse(element("homeRelationship.submit").isEnabled)
        try prepare("Original private household response")
        keepScreenshot("Reviewed independent response with ineligible pending deed")
        _ = try await fixture("lose-reply", method: "POST")
        try press(element("homeRelationship.submit"))
        try require(element("homeRelationship.error").waitForExistence(timeout: 20))
        let lost = try await fixture("state")
        XCTAssertEqual(lost.receipts.count, 1)
        XCTAssertEqual(lost.commands.count, 1)
        _ = try await fixture("reject-elsewhere", method: "POST")
        app.terminate()
        app.launch()
        try await signIn()
        try openReviewQueue()
        XCTAssertFalse(element("homeClaimReview_continueReview").exists)
        try press(element("homeClaimReview.relationshipRecovery"))
        try press(element("homeRelationship.retry"))
        try require(element("homeRelationship.receipt").waitForExistence(timeout: 20))
        XCTAssertTrue(element("homeRelationship.current").label.contains("rejected"))
        XCTAssertTrue(element("homeRelationship.receipt").label.contains("under review"))
        keepScreenshot("Recovered original receipt alongside current rejected claim")
        app.terminate()
        app.launch()
        try await signIn()
        try openReviewQueue()
        try press(element("homeClaimReview.relationshipRecovery"))
        try require(element("homeRelationship.receipt").waitForExistence(timeout: 20))
        let cold = try await fixture("state")
        XCTAssertEqual(cold.commands.count, 2)
        XCTAssertEqual(cold.commands[0], cold.commands[1])
        XCTAssertEqual(cold.receipts.count, 1)
        try press(element("homeRelationship.acknowledge"))
        XCTAssertFalse(element("homeRelationship.submit").exists)
        try await verifyUntrustedFlagAndRevocation()
        try await verifyQualifiedFlagAfterBackground()
    }

    private func verifyUntrustedFlagAndRevocation() async throws {
        _ = try await fixture("next-claim", method: "POST")
        try press(element("homeRelationship.close"))
        try press(element("homeClaimReview_flagUnknown"))
        try prepare("Review this pending claimant")
        _ = try await fixture("change-claim", method: "POST")
        try press(element("homeRelationship.submit"))
        try press(element("homeRelationship.acknowledge"))
        try reveal(element("homeRelationship.submit"))
        XCTAssertFalse(element("homeRelationship.submit").isEnabled)
        let stale = try await fixture("state")
        XCTAssertEqual(stale.receipts.count, 1)
        try prepare("Pending deed remains unverified")
        try press(element("homeRelationship.submit"))
        try require(element("homeRelationship.receipt").waitForExistence(timeout: 20))
        XCTAssertTrue(element("homeRelationship.routing").label.contains("Sent for admin review"))
        keepScreenshot("Unknown claimant routed to admin review without a property dispute")
        _ = try await fixture("revoke", method: "POST")
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeRelationship.error").waitForExistence(timeout: 20))
        XCTAssertFalse(element("homeRelationship.current").exists)
        XCTAssertFalse(element("homeRelationship.savedNote").exists)
        XCTAssertFalse(element("homeRelationship.receipt").exists)
        XCTAssertFalse(element("homeRelationship.retry").exists)
        keepScreenshot("Revoked authority hides claim and historical receipt")
        _ = try await fixture("restore", method: "POST")
        try press(element("homeRelationship.reload"))
        try press(element("homeRelationship.acknowledge"))
    }

    private func verifyQualifiedFlagAfterBackground() async throws {
        _ = try await fixture("next-claim", method: "POST")
        try press(element("homeRelationship.close"))
        try press(element("homeClaimReview_flagUnknown"))
        try require(element("homeRelationship.evidence").waitForExistence(timeout: 20))
        XCTAssertTrue(element("homeRelationship.evidence").label.contains("1 of 1"))
        try prepare("Reviewed verified title evidence")
        _ = try await fixture("hold-read", method: "POST")
        try press(element("homeRelationship.submit"))
        let held = try await fixture("state")
        XCTAssertTrue(held.held)
        let before = held.commands.count
        XCUIDevice.shared.press(.home)
        _ = try await fixture("release-read", method: "POST")
        app.activate()
        try press(element("homeRelationship.retry"))
        try require(element("homeRelationship.receipt").waitForExistence(timeout: 20))
        let final = try await fixture("state")
        XCTAssertEqual(final.commands.count, before + 1)
        XCTAssertEqual(final.commands.count, 5)
        XCTAssertEqual(final.receipts.count, 3)
        XCTAssertEqual(final.claims[0].state, "rejected")
        XCTAssertEqual(final.claims[1].challengeState, "none")
        XCTAssertEqual(final.claims[2].state, "submitted")
        XCTAssertEqual(final.claims[2].phase, "challenged")
        XCTAssertEqual(final.claims[2].challengeState, "challenged")
        XCTAssertTrue(element("homeRelationship.current").label.contains("challenged"))
        XCTAssertTrue(element("homeRelationship.receipt").label.contains("challenged"))
        XCTAssertEqual(final.securityState, "normal")
        keepScreenshot("Qualified dispute response confirmed after background interruption")
        try press(element("homeRelationship.acknowledge"))
        XCTAssertFalse(element("homeRelationship.submit").exists)
        try press(element("homeRelationship.close"))
        try press(element("homeClaimReview.relationshipRecovery"))
        try require(element("homeRelationship.empty").waitForExistence(timeout: 20))
        _ = try await fixture("revoke", method: "POST")
        try press(element("homeRelationship.close"))
        try require(element("homeClaimReview_ownershipUnavailable").waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["No pending ownership claims"].exists)
        keepScreenshot("Denied ownership list is unavailable rather than falsely empty")
        _ = try await fixture("restore", method: "POST")
        let proof = try XCTAttachment(data: JSONEncoder().encode(final), uniformTypeIdentifier: "public.json")
        proof.name = "Installed native relationship HTTP and SQL evidence"
        proof.lifetime = .keepAlways
        add(proof)
    }

    private func prepare(_ note: String) throws {
        let field = element("homeRelationship.note")
        try press(field)
        field.typeText(note)
        try press(element("homeRelationship.keyboardDone"))
        try press(element("homeRelationship.reviewed"))
    }

    private func openReviewQueue() throws {
        // The isolated fixture leaves Place intelligence unavailable. Its
        // real error-state Back action must still reach the profile menu.
        if !element("hubAvatarButton").waitForExistence(timeout: 2) {
            try press(element("place.back"))
        }
        try press(element("hubAvatarButton"))
        let homeIdentity = app.buttons.matching(NSPredicate(format: "label == 'Home'")).firstMatch
        try require(homeIdentity.waitForExistence(timeout: 20))
        try press(homeIdentity)
        try press(element("meSectionRow_household_owners"))
        try press(app.buttons["Review claims on this home"].firstMatch)
        try require(element("homeClaimReview.relationshipRecovery").waitForExistence(timeout: 20))
    }

    private func signIn() async throws {
        if element("tab.place").waitForExistence(timeout: 3) { return }
        if !element("loginEmailField").exists { try press(element("placeLaunchSignIn")) }
        let email = element("loginEmailField"), password = element("loginPasswordField")
        try press(email)
        email.typeText("relationship-ui@example.com")
        try press(password)
        password.typeText("synthetic-loopback-only")
        try press(element("loginSubmitButton"))
        for index in 0..<4 {
            let later = app.buttons["Not Now"].firstMatch
            guard later.waitForExistence(timeout: index == 0 ? 10 : 3) else { break }
            later.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        let signedIn = XCTNSPredicateExpectation(predicate: NSPredicate { [self] _, _ in
            element("tab.place").exists && !element("loginSubmitButton").exists
        }, object: app)
        try await require(XCTWaiter.fulfillment(of: [signedIn], timeout: 30) == .completed)
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func reveal(_ control: XCUIElement) throws {
        // Let a newly presented screen appear before sending scroll gestures.
        // Scrolling the outgoing screen can interrupt its cover transition.
        if !control.exists { _ = control.waitForExistence(timeout: 3) }
        // SwiftUI Form virtualizes off-screen rows; scroll before requiring
        // existence, then wait for the actual reachable control.
        for _ in 0..<10 {
            if control.exists, control.isHittable { break }
            if control.exists, control.frame.midY < app.frame.midY {
                app.swipeDown()
            } else {
                app.swipeUp()
            }
        }
        try require(control.waitForExistence(timeout: 20) && control.isHittable, "Missing reachable control")
    }

    private func press(_ control: XCUIElement) throws {
        try reveal(control)
        try require(control.isEnabled, "Control unavailable")
        if control.elementType == .switch {
            control.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
        } else {
            control.tap()
        }
    }

    private func require(
        _ condition: Bool,
        _ message: String = "Required state unavailable",
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        guard condition else {
            XCTFail(message, file: file, line: line)
            throw JourneyStopped.requiredState
        }
    }

    private enum JourneyStopped: Error { case requiredState }

    private func keepScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func fixture(_ action: String, method: String = "GET") async throws -> RelationshipUIEvidence {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        request.httpMethod = method
        let (data, response) = try await URLSession.shared.data(for: request)
        try require((response as? HTTPURLResponse)?.statusCode == 200)
        return try JSONDecoder().decode(RelationshipUIEvidence.self, from: data)
    }
}

private struct RelationshipUIEvidence: Codable {
    struct Receipt: Codable {
        let requestId: String
        private enum CodingKeys: String, CodingKey { case requestId = "request_id" }
    }

    struct Command: Codable, Equatable {
        let action: String
        let note: String
        let requestId: String
        let reviewToken: String
        private enum CodingKeys: String, CodingKey { case action, note, requestId = "request_id", reviewToken = "review_token" }
    }

    struct Claim: Codable {
        let id: String
        let state: String
        let challengeState: String
        let phase: String
        private enum CodingKeys: String, CodingKey { case id, state, challengeState = "challenge_state", phase = "claim_phase_v2" }
    }

    let commands: [Command]
    let receipts: [Receipt]
    let claims: [Claim]
    let held: Bool
    let securityState: String
    private enum CodingKeys: String, CodingKey { case commands, receipts, claims, held, securityState = "security_state" }
}
