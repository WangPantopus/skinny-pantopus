import XCTest

/// Opt-in installed app -> production invitation HTTP/SDK/SQL. All account
/// changes use the normal UI; no auth or protected-slot replacement is used.
@MainActor
final class HomeInvitationDecisionJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private var capabilities: [[String: Any]] = []

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_INVITATION_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_INVITATION_UI_ORIGIN"], origin)
        let inputs = try await fixture("capabilities")
        capabilities = try XCTUnwrap(inputs["capabilities"] as? [[String: Any]])
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            if testRun?.failureCount == 0 {
                keepScreen("Final invitation state")
                let hierarchy = XCTAttachment(string: app.debugDescription)
                hierarchy.name = "Private native invitation hierarchy"
                hierarchy.lifetime = .keepAlways
                add(hierarchy)
                if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                    let proof = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                    proof.name = "Private native invitation HTTP SDK SQL evidence"
                    proof.lifetime = .keepAlways
                    add(proof)
                }
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testOriginalDecisionsSurviveRestartAccountChangesAndRemovedAccess() async throws {
        app.launch()
        if ProcessInfo.processInfo.environment["HOME_INVITATION_UI_RESUME"] == "acceptance_accounts" {
            try signIn(2)
            try require(element("homeInvitationError"))
            XCTAssertFalse(element("homeInvitationOriginalHome").exists)
            keepScreen("Other account cannot see saved original")
            try await switchAccount(1)
            try require(label("Acceptance saved"))
            try await verifyAcceptedAccessRemoval()
        } else {
            if element("tab.place").waitForExistence(timeout: 4) { try signOutThroughSettings() }
            try signIn(1)
            try await readFailuresAndRetiredConfirmation()
            try await cancelUnseenOriginal()
            try await recoverAcceptanceAcrossAccounts()
        }
        try await recoverDeclineAndChangedTerms()
        try await retireHeldAcceptanceAndOpenCurrentHome()
        let state = try await fixture("state")
        let commands = try XCTUnwrap(state["commands"] as? [[String: Any]])
        XCTAssertEqual(commands.count, 5)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "completed" && $0["action"] as? String == "accept" }.count, 2)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "completed" && $0["action"] as? String == "decline" }.count, 1)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "cancelled" }.count, 1)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "rejected" }.count, 1)
    }

    private func readFailuresAndRetiredConfirmation() async throws {
        _ = try await fixture("fault", body: ["action": "preview", "kind": "before", "persistent": true])
        try open(1)
        try require(element("tokenAcceptError"))
        XCTAssertFalse(element("tokenAcceptExpiredFrame").exists)
        keepScreen("Unavailable preview is recoverable")
        _ = try await fixture("fault", body: ["action": "preview", "kind": "clear"])
        try press("tokenAcceptRetry")
        try require(element("homeInvitationAccept"))
        _ = try await fixture("fault", body: ["action": "context", "kind": "malformed", "persistent": true])
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeInvitationError"))
        XCTAssertFalse(element("homeInvitationAccept").exists)
        _ = try await fixture("fault", body: ["action": "context", "kind": "clear"])
        try press("homeInvitationReopen")
        try press("homeInvitationAccept")
        try require(element("homeInvitationConfirmDecision"))
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeInvitationAccept"))
        XCTAssertFalse(element("homeInvitationConfirmDecision").exists)
        let state = try await fixture("state")
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 0)
        keepScreen("Retired confirmation cannot submit")
    }

    private func cancelUnseenOriginal() async throws {
        _ = try await fixture("fault", body: ["action": "accept", "kind": "before", "persistent": true])
        try press("homeInvitationAccept")
        try press("homeInvitationConfirmDecision")
        try require(label("Recover your invitation decision"))
        try require(element("homeInvitationError"))
        app.terminate()
        app.launch()
        try open(1)
        try require(label("Recover your invitation decision"))
        try press("homeInvitationCancel")
        try press("homeInvitationConfirmCancel")
        try require(label("Decision attempt cancelled"))
        keepScreen("Unseen original cancellation recorded after restart")
        _ = try await fixture("fault", body: ["action": "accept", "kind": "clear"])
        try press("homeInvitationAcknowledge")
        try require(element("homeInvitationAccept"))
    }

    private func recoverAcceptanceAcrossAccounts() async throws {
        _ = try await fixture("fault", body: ["action": "accept", "kind": "after", "persistent": true])
        try press("homeInvitationAccept")
        try press("homeInvitationConfirmDecision")
        try require(element("homeInvitationError"))
        _ = try await fixture("fault", body: ["action": "decision_read", "kind": "before", "persistent": true])
        app.terminate()
        app.launch()
        try open(1)
        try require(element("homeInvitationError"))
        try require(label("Recover your invitation decision"))
        keepScreen("Cold read failure keeps original acceptance")
        _ = try await fixture("fault", body: ["action": "decision_read", "kind": "clear"])
        try press("homeInvitationCheck")
        try require(label("Acceptance saved"))
        try await switchAccount(2)
        try require(element("homeInvitationError"))
        XCTAssertFalse(element("homeInvitationOriginalHome").exists)
        keepScreen("Other account cannot see saved original")
        try await switchAccount(1)
        try require(label("Acceptance saved"))
        try await verifyAcceptedAccessRemoval()
    }

    private func verifyAcceptedAccessRemoval() async throws {
        _ = try await fixture("scenario", body: ["index": 1, "mode": "deny_view"])
        try press("homeInvitationAccess")
        try require(label("does not provide current shared access"))
        XCTAssertFalse(element("homeInvitationOpenHome").exists)
        _ = try await fixture("scenario", body: ["index": 1, "mode": "remove"])
        app.terminate()
        app.launch()
        try open(1)
        try require(label("Acceptance saved"))
        try press("homeInvitationAccess")
        try require(label("does not provide current shared access"))
        keepScreen("Historical acceptance does not restore removed access")
        try press("homeInvitationAcknowledge")
        try require(element("tab.place"))
    }

    private func recoverDeclineAndChangedTerms() async throws {
        try open(2)
        try require(element("homeInvitationError"))
        try await switchAccount(2)
        try require(element("homeInvitationDecline"))
        _ = try await fixture("fault", body: ["action": "decline", "kind": "after", "persistent": true])
        try press("homeInvitationDecline")
        try press("homeInvitationConfirmDecision")
        try require(element("homeInvitationError"))
        app.terminate()
        app.launch()
        try open(2)
        try require(label("Decline saved"))
        keepScreen("Lost decline recovered after restart")
        _ = try await fixture("fault", body: ["action": "decline", "kind": "clear"])
        try press("homeInvitationAcknowledge")
        try open(3)
        try require(element("homeInvitationError"))
        try await switchAccount(3)
        try press("homeInvitationAccept")
        _ = try await fixture("scenario", body: ["index": 3, "mode": "expire"])
        try press("homeInvitationConfirmDecision")
        try require(label("Decision needs review"))
        keepScreen("Reviewed invitation expiry is retained as rejection")
        try press("homeInvitationAcknowledge")
        try require(element("homeInvitationError"))
    }

    private func retireHeldAcceptanceAndOpenCurrentHome() async throws {
        try press("tokenAcceptClose")
        try open(4)
        try require(element("homeInvitationError"))
        try await switchAccount(4)
        _ = try await fixture("fault", body: ["action": "accept", "kind": "hold"])
        try press("homeInvitationAccept")
        try press("homeInvitationConfirmDecision")
        for _ in 0..<60 {
            let state = try await fixture("state")
            if (state["events"] as? [[String: Any]])?.contains(where: { $0["event"] as? String == "reply_held" }) == true { break }
            try await Task.sleep(for: .milliseconds(200))
        }
        try open(1)
        try require(label("Acceptance saved"))
        try require(label("This is an earlier invitation"))
        _ = try await fixture("release", body: [:])
        try require(element("homeInvitationDecision"))
        keepScreen("Earlier original survives a new link and retired reply")
        try press("homeInvitationAccess")
        try require(element("homeInvitationOpenHome"))
        try press("homeInvitationOpenHome")
        try require(element("homeDashboard"))
        keepScreen("Explicit current Home entry after acknowledgement")
        try open(4)
        try require(element("homeInvitationError"))
        XCTAssertFalse(element("homeInvitationOriginalHome").exists)
    }
}

@MainActor
private extension HomeInvitationDecisionJourneyUITests {
    func open(_ index: Int) throws {
        let capability = try XCTUnwrap(capabilities.first { $0["index"] as? Int == index })
        let token = try XCTUnwrap(capability["token"] as? String)
        try app.open(XCTUnwrap(URL(string: "pantopus://invite/" + token)))
    }

    private func switchAccount(_ index: Int) async throws {
        _ = try await fixture("fault", body: ["action": "logout", "kind": "hold", "persistent": true])
        try press("homeInvitationSwitchAccount")
        try press("homeInvitationConfirmSwitchAccount")
        try require(element("loginEmailField"))
        app.terminate()
        let storage = try await fixture("native-storage-check")
        XCTAssertEqual(storage["invitation_capability_count"] as? Int, 0)
        XCTAssertEqual(storage["legacy_handoff_absent"] as? Bool, true)
        _ = try await fixture("release", body: [:])
        _ = try await fixture("fault", body: ["action": "logout", "kind": "clear"])
        app.launch()
        try signIn(index)
    }

    private func signIn(_ index: Int) throws {
        if !element("loginEmailField").waitForExistence(timeout: 3) {
            try press("placeLaunchSignIn")
        }
        let capability = try XCTUnwrap(capabilities.first { $0["index"] as? Int == index })
        try enter(XCTUnwrap(capability["email"] as? String), into: "loginEmailField")
        try enter("synthetic-loopback-only", into: "loginPasswordField")
        try press("loginSubmitButton")
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 3) else { break }
            let target = buttons.firstMatch
            let frame = target.frame
            if !frame.isEmpty { app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap() }
        }
    }

    private func signOutThroughSettings() throws {
        try press(element("place.menu").exists ? "place.menu" : "hubMenuButton")
        try press("navDrawer.item.settings")
        let button = app.buttons["Log out"].firstMatch
        try reveal(button)
        button.tap()
        try require(element("placeLaunchSignIn"))
    }

    private func enter(_ text: String, into id: String) throws {
        let field = element(id)
        try reveal(field)
        field.tap()
        let old = field.value as? String ?? ""
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: old == field.placeholderValue ? 0 : old.count) + text)
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func label(_ text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func require(_ control: XCUIElement) throws {
        guard control.waitForExistence(timeout: 35) else {
            XCTFail("Expected invitation control is missing")
            throw JourneyFailure.unavailable
        }
    }

    private func reveal(_ control: XCUIElement) throws {
        try require(control)
        for _ in 0..<9 {
            if control.isHittable { return }
            app.swipeUp()
        }
        XCTFail("Invitation control is not reachable")
        throw JourneyFailure.unavailable
    }

    private func press(_ id: String) throws {
        let control = element(id)
        try reveal(control)
        guard control.isEnabled else {
            XCTFail("Invitation control is disabled")
            throw JourneyFailure.unavailable
        }
        control.tap()
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

    private enum JourneyFailure: Error { case unavailable }

    private func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
