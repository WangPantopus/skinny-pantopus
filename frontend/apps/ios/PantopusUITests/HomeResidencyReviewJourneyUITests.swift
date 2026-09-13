import XCTest

/// Opt-in installed UI, normal sign-in, real Keychain and production HTTP/SDK/SQL.
@MainActor
final class HomeResidencyReviewJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private let home = "ddc23600-0000-4000-8000-000000000100"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_RESIDENCY_REVIEW_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_RESIDENCY_REVIEW_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final native residency review state")
            let tree = XCTAttachment(string: app.debugDescription)
            tree.name = "Private native residency review hierarchy"
            tree.lifetime = .keepAlways
            add(tree)
            if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                let proof = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                proof.name = "Native residency review HTTP SDK SQL evidence"
                proof.lifetime = .keepAlways
                add(proof)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testPreparedDecisionsColdRecoveryAndCurrentAuthority() async throws {
        if ProcessInfo.processInfo.environment["HOME_RESIDENCY_REVIEW_UI_CONTINUE_PREFLIGHT"] == "1" {
            let proof = try await fixture("state")
            try assertCommands(proof, count: 5, receipts: 2, equal: [3, 4])
            XCTAssertEqual(proof["held"] as? Bool, false)
            try restartRecovery()
            try await finishRetainedPreflight()
            return
        }
        if ProcessInfo.processInfo.environment["HOME_RESIDENCY_REVIEW_UI_CONTINUE_APPROVAL"] == "1" {
            let proof = try await fixture("state")
            try assertCommands(proof, count: 2, receipts: 1, equal: [0, 1])
            XCTAssertEqual(proof["held"] as? Bool, false)
            try restartRecovery()
            try require(label("The original residency claim was approved."))
            try require(label("Membership record: Inactive"))
            keepScreen("Recovered approval and current inactive membership after interrupted acceptance")
        } else {
            try await approvalUntilColdRecovery()
        }
        try restartRecovery()
        try require(label("The original residency claim was approved."))
        let proof = try await fixture("state")
        XCTAssertEqual((proof["commands"] as? [[String: Any]])?.count, 2)
        try press("homeResidencyReview.acknowledge")
        try require(element("homeResidencyReview.empty"))
        try await rejectionThroughMembers()
        try await heldPreflightAndRevokedRead()
    }

    private func approvalUntilColdRecovery() async throws {
        try signIn()
        try openQueue()
        try openClaim(applicant: 2, approve: false)
        try enter("Cancelled private note", into: "homeResidencyReview.reason")
        try press("homeResidencyReview.close")
        let cancelled = try await fixture("state")
        XCTAssertEqual((cancelled["commands"] as? [[String: Any]])?.count, 0)
        try openClaim(applicant: 2)
        try reveal(element("homeResidencyReview.submit"))
        XCTAssertFalse(element("homeResidencyReview.submit").isEnabled)
        try await unavailableReads()
        try prepare()
        try chooseRole("Guest")
        XCTAssertFalse(element("homeResidencyReview.submit").isEnabled)
        try chooseRole("Member")
        try prepare()
        keepScreen("Prepared approval shows current claim membership limits and selected role")
        _ = try await fixture("fault", body: ["kind": "lost"])
        try press("homeResidencyReview.submit")
        _ = try await awaitDatabase { ($0["receipts"] as? [[String: Any]])?.count == 1 }
        try require(element("homeResidencyReview.retry"))
        _ = try await fixture("change", body: ["kind": "move-out", "index": 0])
        try restartRecovery()
        try press("homeResidencyReview.retry")
        try require(label("The original residency claim was approved."))
        try require(label("Membership record: Inactive"))
        keepScreen("Original approval confirmed alongside current inactive membership")
        let proof = try await fixture("state")
        try assertCommands(proof, count: 2, receipts: 1, equal: [0, 1])
    }

    private func unavailableReads() async throws {
        for kind in ["before", "malformed"] {
            _ = try await fixture("fault", body: ["kind": kind])
            try press("homeResidencyReview.reload")
            try require(element("homeResidencyReview.error"))
            XCTAssertFalse(element("homeResidencyReview.claimStatus").exists)
            XCTAssertFalse(element("homeResidencyReview.submit").exists)
            keepScreen("Failed current review hides private content and decisions: " + kind)
        }
        _ = try await fixture("fault", body: ["kind": "clear"])
        try press("homeResidencyReview.reload")
        try reveal(element("homeResidencyReview.submit"))
    }

    private func rejectionThroughMembers() async throws {
        app.terminate()
        try signIn()
        try openQueue(fromMembers: true)
        try openClaim(applicant: 3, approve: false)
        try enter("Changed claim must be reviewed again", into: "homeResidencyReview.reason")
        try prepare()
        _ = try await fixture("change", body: ["kind": "stale", "index": 1])
        try press("homeResidencyReview.submit")
        try press("homeResidencyReview.acknowledge")
        try reveal(element("homeResidencyReview.submit"))
        XCTAssertFalse(element("homeResidencyReview.submit").isEnabled)
        try enter("Original reviewed rejection", into: "homeResidencyReview.reason")
        try prepare()
        _ = try await fixture("fault", body: ["kind": "lost"])
        try press("homeResidencyReview.submit")
        _ = try await awaitDatabase { ($0["receipts"] as? [[String: Any]])?.count == 2 }
        try require(element("homeResidencyReview.retry"))
        _ = try await fixture("change", body: ["kind": "resubmit", "index": 1])
        try restartRecovery()
        try press("homeResidencyReview.retry")
        try require(label("The original residency claim was rejected."))
        try require(label("Claim status: pending"))
        try require(label("Original reason: Original reviewed rejection"))
        let proof = try await fixture("state")
        try assertCommands(proof, count: 5, receipts: 2, equal: [3, 4])
        keepScreen("Recovered original rejection remains separate from resubmitted claim")
        let denied = try await fixture("change", body: ["kind": "revoke"])
        XCTAssertEqual(denied["authority"] as? Bool, false)
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeResidencyReview.error"))
        XCTAssertFalse(element("homeResidencyReview.claimStatus").exists)
        XCTAssertFalse(label("Original reason: Original reviewed rejection").exists)
        XCTAssertFalse(element("homeResidencyReview.retry").exists)
        XCTAssertFalse(element("homeResidencyReview.acknowledge").exists)
        keepScreen("Revoked reviewer access hides current claim and historical private decision")
        _ = try await fixture("change", body: ["kind": "restore"])
        try press("homeResidencyReview.reload")
        try press("homeResidencyReview.acknowledge")
        try require(element("homeResidencyReview.empty"))
    }

    private func heldPreflightAndRevokedRead() async throws {
        try press("homeResidencyReview.close")
        try openClaim(applicant: 4)
        try prepare()
        _ = try await fixture("hold-read", body: [:])
        try press("homeResidencyReview.submit")
        try await awaitFlag("held")
        XCUIDevice.shared.press(.home)
        _ = try await fixture("release-read", body: [:])
        app.activate()
        try press("homeResidencyReview.reload")
        try require(element("homeResidencyReview.retry"))
        let state = try await fixture("state")
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 5)
        keepScreen("Background preflight retains original without sending its decision")
        try await finishRetainedPreflight()
    }

    private func finishRetainedPreflight() async throws {
        try press("homeResidencyReview.retry")
        try require(label("The original residency claim was approved."))
        var state = try await fixture("state")
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 6)
        XCTAssertEqual((state["receipts"] as? [[String: Any]])?.count, 3)
        try press("homeResidencyReview.acknowledge")
        try press("homeResidencyReview.close")
        try openClaim(applicant: 5)
        _ = try await fixture("hold-read", body: [:])
        try press("homeResidencyReview.reload")
        try await awaitFlag("held")
        _ = try await fixture("change", body: ["kind": "revoke"])
        XCUIDevice.shared.press(.home)
        _ = try await fixture("release-read", body: [:])
        app.activate()
        try press("homeResidencyReview.reload")
        try require(element("homeResidencyReview.error"))
        XCTAssertFalse(element("homeResidencyReview.claimStatus").exists)
        XCTAssertFalse(element("homeResidencyReview.submit").exists)
        keepScreen("Retired authorized reply cannot restore current review after revocation")
        _ = try await fixture("change", body: ["kind": "restore"])
        try press("homeResidencyReview.reload")
        try reveal(element("homeResidencyReview.submit"))
        try press("homeResidencyReview.close")
        try press("homeClaimReview.residencyRecovery")
        try require(element("homeResidencyReview.empty"))
        state = try await fixture("state")
        XCTAssertEqual((state["receipts"] as? [[String: Any]])?.count, 3)
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 6)
        XCTAssertEqual(state["held"] as? Bool, false)
    }

    private func openQueue(fromMembers: Bool = false) throws {
        try press("tab.place")
        if !element("hubAvatarButton").waitForExistence(timeout: 2) { try press("place.back") }
        try press("hubAvatarButton")
        let identity = app.buttons.matching(NSPredicate(format: "label == %@", "Home")).firstMatch
        try reveal(identity)
        identity.tap()
        try press(fromMembers ? "meSectionRow_household_members" : "meSectionRow_household_owners")
        let button = app.buttons[fromMembers ? "Review residency claims" : "Review claims on this home"].firstMatch
        try reveal(button)
        button.tap()
        try press("homeClaimReview_tab_residency")
    }

    private func openClaim(applicant: Int, approve: Bool = true) throws {
        let card = app.otherElements.matching(identifier: "homeClaimReview_residencyCard")
            .containing(.staticText, identifier: "Applicant \(applicant)").firstMatch
        try reveal(card)
        let action = card.buttons[approve ? "homeClaimReview_residencyApprove" : "homeClaimReview_residencyReject"]
        try reveal(action)
        action.tap()
        try require(element("homeResidencyReview.claimStatus"))
    }

    private func restartRecovery() throws {
        app.terminate()
        try signIn()
        try openQueue()
        try press("homeClaimReview.residencyRecovery")
    }

    private func prepare() throws {
        let confirmation = element("homeResidencyReview.reviewed")
        try reveal(confirmation)
        XCTAssertEqual(confirmation.value as? String, "0")
        // XCTest's switch frame includes the multiline label. Tap the visible
        // thumb, then prove the explicit confirmation actually changed state.
        confirmation.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertEqual(confirmation.value as? String, "1")
        try reveal(element("homeResidencyReview.submit"))
        XCTAssertTrue(element("homeResidencyReview.submit").isEnabled)
    }

    private func chooseRole(_ label: String) throws {
        try press("homeResidencyReview.role")
        let choice = app.buttons[label].firstMatch
        try reveal(choice)
        choice.tap()
    }

    private func assertCommands(_ state: [String: Any], count: Int, receipts: Int, equal: [Int]) throws {
        let commands = try XCTUnwrap(state["commands"] as? [[String: Any]])
        XCTAssertEqual(commands.count, count)
        XCTAssertEqual((state["receipts"] as? [[String: Any]])?.count, receipts)
        XCTAssertEqual(
            try JSONSerialization.data(withJSONObject: commands[equal[0]], options: .sortedKeys),
            try JSONSerialization.data(withJSONObject: commands[equal[1]], options: .sortedKeys)
        )
    }
}

private extension HomeResidencyReviewJourneyUITests {
    func awaitDatabase(_ matches: ([String: Any]) -> Bool) async throws -> [String: Any] {
        for _ in 0..<60 {
            let state = try await fixture("state")
            if matches(state) { return state }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("Expected the original database decision before interrupting its response")
        throw JourneyError.unavailable
    }

    private func signIn() throws {
        app.launch()
        if !element("placeLaunchSignIn").waitForExistence(timeout: 8), element("tab.place").exists { return }
        try require(element("placeLaunchSignIn"))
        try press("placeLaunchSignIn")
        try enter("residency-review-ui@example.invalid", into: "loginEmailField", dismissKeyboard: false)
        try enter("synthetic-loopback-only", into: "loginPasswordField", dismissKeyboard: false)
        try press("loginSubmitButton")
        try require(element("tab.place"))
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 3) else { break }
            let password = app.buttons.matching(NSPredicate(format: "label == %@ AND identifier == %@", "Not Now", "")).firstMatch
            let target = password.exists ? password : element("appLockSetupPromptDismiss")
            let frame = target.frame
            XCTAssertFalse(frame.isEmpty)
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        }
    }

    private func enter(_ text: String, into id: String, dismissKeyboard: Bool = true) throws {
        let field = element(id)
        try reveal(field)
        field.tap()
        let existing = field.value as? String ?? ""
        let count = existing == field.placeholderValue ? 0 : existing.count
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: count) + text)
        if dismissKeyboard {
            let done = element("homeResidencyReview.keyboardDone")
            try require(done)
            done.tap()
            XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5))
        }
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func label(_ text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func require(_ control: XCUIElement) throws {
        if !control.waitForExistence(timeout: 5) { try reveal(control) }
        guard control.exists else {
            XCTFail("Expected residency review control")
            throw JourneyError.unavailable
        }
    }

    private func reveal(_ control: XCUIElement) throws {
        if !control.exists { _ = control.waitForExistence(timeout: 3) }
        // SwiftUI Form virtualizes rows above and below the viewport. Search
        // both directions when an earlier status row is no longer in AX.
        for attempt in 0..<24 {
            if control.exists, control.isHittable { return }
            let towardTop = control.exists ? control.frame.midY < app.frame.midY : (6..<18).contains(attempt)
            if towardTop { app.swipeDown() } else { app.swipeUp() }
        }
        XCTFail("Residency review control is not reachable")
        throw JourneyError.unavailable
    }

    private func press(_ id: String) throws {
        let control = element(id)
        for _ in 0..<3 {
            try reveal(control)
            if control.exists, control.isEnabled, control.isHittable {
                control.tap()
                return
            }
            // Foreground refresh first shows a short loading Form; once the
            // claim arrives, Reload moves below virtualized rows. Locate it
            // again after loading instead of waiting on its old position.
            let loading = element("homeResidencyReview.loading")
            if loading.exists { _ = loading.waitForNonExistence(timeout: 10) }
        }
        XCTFail("Residency review control must be enabled before a tap")
        throw JourneyError.unavailable
    }

    private func awaitFlag(_ key: String, action: String = "state") async throws {
        for _ in 0..<60 {
            if try await fixture(action)[key] as? Bool == true { return }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("Expected held original request")
        throw JourneyError.unavailable
    }

    private func fixture(_ action: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private enum JourneyError: Error { case unavailable }
}
