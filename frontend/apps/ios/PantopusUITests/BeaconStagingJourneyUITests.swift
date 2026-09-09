import XCTest

/// Explicit operator opt-in against an isolated staging fixture. Credentials
/// come from the private runner; ordinary CI skips these live mutations.
@MainActor
final class BeaconStagingJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private var inputs: [String: String] = [:]

    override func setUp() async throws {
        try await super.setUp()
        try prepare()
    }

    private func prepare() throws {
        continueAfterFailure = false
        let env = ProcessInfo.processInfo.environment
        try XCTSkipUnless(env["RUN_BEACON_STAGING_UI"] == "1", "Requires an isolated staging fixture")
        XCTAssertEqual(env["BEACON_STAGING_API"], "https://staging-api.pantopus.com")
        for key in ["BEACON_TEST_EMAIL", "BEACON_TEST_PASSWORD", "BEACON_TEST_BODY"] {
            inputs[key] = try XCTUnwrap(env[key], "Missing private runner input")
        }
        XCTAssertTrue(inputs["BEACON_TEST_EMAIL"]?.hasPrefix("bp-ios-") == true)
        XCTAssertTrue(inputs["BEACON_TEST_EMAIL"]?.hasSuffix("@example.com") == true)
        app = XCUIApplication()
        app.launchEnvironment = [
            "PANTOPUS_API_ENV": "staging",
            "UI_TESTS_DISABLE_NOTIFICATIONS": "1"
        ]
    }

    override func tearDown() async throws {
        cleanUp()
        try await super.tearDown()
    }

    private func cleanUp() {
        guard let app else { return }
        if (testRun?.failureCount ?? 0) > 0 {
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Private staging failure hierarchy"
            add(hierarchy)
        }
        app.terminate()
        self.app = nil
    }

    func testCreatorPublishesFromNativeBeaconComposer() throws {
        XCTAssertTrue(inputs["BEACON_TEST_EMAIL"]?.hasPrefix("bp-ios-creator-") == true)
        app.launch()
        try signIn()
        tap("hubMenuButton")
        tap("navDrawer.item.my-beacon")
        XCTAssertTrue(element("beaconProfile").waitForExistence(timeout: 20))
        tap("beaconProfileComposeCTA")
        XCTAssertTrue(element("composeBroadcast").waitForExistence(timeout: 15))
        let editor = app.textViews["Broadcast message"].firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 15))
        reveal(editor)
        editor.tap()
        try editor.typeText(XCTUnwrap(inputs["BEACON_TEST_BODY"]))
        let send = app.buttons.matching(NSPredicate(
            format: "label == %@ OR label == %@", "Send your first broadcast", "Send broadcast"
        )).firstMatch
        XCTAssertTrue(send.waitForExistence(timeout: 15))
        reveal(send)
        XCTAssertTrue(send.isEnabled)
        send.tap()
        let completed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: editor)
        XCTAssertEqual(XCTWaiter.wait(for: [completed], timeout: 30), .completed)
        XCTAssertTrue(element("beaconProfile").waitForExistence(timeout: 30))
        XCTAssertFalse(element("composeBroadcast").exists)
        tapBack()
        signOut()
    }

    func testFollowerOpensTheExactAudienceNotification() throws {
        XCTAssertTrue(inputs["BEACON_TEST_EMAIL"]?.hasPrefix("bp-ios-follower-") == true)
        app.launch()
        try signIn()
        try openExactAudiencePost()
        // Also verify the authenticated session survives an ordinary cold
        // start before ending this fixture's session through normal settings.
        app.terminate()
        app.launch()
        XCTAssertTrue(element("hubMenuButton").waitForExistence(timeout: 25))
        dismissSignInPrompts()
        signOut()
    }

    func testFollowerParksSessionForNaturalExpiry() throws {
        XCTAssertTrue(inputs["BEACON_TEST_EMAIL"]?.hasPrefix("bp-ios-follower-") == true)
        app.launch()
        try signIn()
        XCUIDevice.shared.press(.home)
    }

    func testFollowerRefreshesNaturallyExpiredSession() throws {
        XCTAssertTrue(inputs["BEACON_TEST_EMAIL"]?.hasPrefix("bp-ios-follower-") == true)
        // The private runner requires a full token lifetime to have elapsed.
        // Do not call signIn here: the existing Keychain session must recover.
        app.launch()
        XCTAssertTrue(element("hubMenuButton").waitForExistence(timeout: 30))
        XCTAssertFalse(element("loginEmailField").exists)
        try openExactAudiencePost()
    }

    private func openExactAudiencePost() throws {
        tap("hubBellButton")
        XCTAssertTrue(element("notifications").waitForExistence(timeout: 20))
        tapButton("Audience notifications")
        let body = try XCTUnwrap(inputs["BEACON_TEST_BODY"])
        let message = app.staticTexts[body].firstMatch
        XCTAssertTrue(message.waitForExistence(timeout: 20))
        reveal(message)
        message.tap()
        XCTAssertTrue(element("pulsePostDetail").waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts[body].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["Beacon Simulator Studio"].exists)
    }

    private func signIn() throws {
        if element("hubMenuButton").waitForExistence(timeout: 3) {
            // A failed prior UI assertion may leave a session in Keychain.
            // Use normal logout and login so the requested fixture account is
            // established without trusting a previous screen or session.
            dismissSignInPrompts()
            signOut()
        }
        tap("placeLaunchSignIn")
        try enter(XCTUnwrap(inputs["BEACON_TEST_EMAIL"]), into: "loginEmailField")
        try enter(XCTUnwrap(inputs["BEACON_TEST_PASSWORD"]), into: "loginPasswordField")
        tap("loginSubmitButton")
        XCTAssertTrue(element("hubMenuButton").waitForExistence(timeout: 25))
        dismissSignInPrompts()
    }

    private func dismissSignInPrompts() {
        // Both the optional app-lock offer and iOS password-save sheet use
        // "Not Now". Dismiss whichever is currently on top before navigating.
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 5) else { return }
            let passwordDismiss = app.buttons.matching(NSPredicate(
                format: "label == %@ AND identifier == %@", "Not Now", ""
            )).firstMatch
            let topmost = passwordDismiss.exists ? passwordDismiss : app.buttons["appLockSetupPromptDismiss"].firstMatch
            // The password extension's remote view reports non-hittable while
            // covering the app's Face ID alert. Its last accessibility button
            // still supplies the visible button's frame; dismiss it first.
            let frame = topmost.frame
            let point = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY))
            point.tap()
        }
    }

    private func signOut() {
        tap("hubMenuButton")
        tap("navDrawer.item.settings")
        tapButton("Log out")
        XCTAssertTrue(element("placeLaunchSignIn").waitForExistence(timeout: 20))
    }

    private func tapBack() {
        let back = app.buttons.matching(NSPredicate(format: "label == %@ OR identifier == %@", "Back", "BackButton")).firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        back.tap()
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func tap(_ id: String) {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: 20), "Missing \(id)")
        reveal(target)
        XCTAssertTrue(target.isEnabled, "Disabled \(id)")
        target.tap()
    }

    private func enter(_ text: String, into id: String) {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: 15), "Missing \(id)")
        reveal(target)
        target.tap()
        target.typeText(text)
    }

    private func tapButton(_ label: String) {
        let target = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 20), "Missing button \(label)")
        reveal(target)
        XCTAssertTrue(target.isEnabled)
        target.tap()
    }

    private func reveal(_ target: XCUIElement) {
        for _ in 0..<12 where !target.isHittable {
            let scroll = app.scrollViews.containing(.any, identifier: target.identifier).allElementsBoundByIndex.last
            let frame = (scroll?.frame ?? app.frame).intersection(app.frame)
            let direction: CGFloat = target.frame.midY < frame.minY ? 1 : -1
            let origin = app.coordinate(withNormalizedOffset: .zero)
            let start = origin.withOffset(CGVector(dx: frame.maxX - 20, dy: frame.midY))
            let end = start.withOffset(CGVector(dx: 0, dy: min(160, frame.height * 0.35) * direction))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        XCTAssertTrue(target.isHittable, "Could not reveal \(target.identifier)")
    }
}
