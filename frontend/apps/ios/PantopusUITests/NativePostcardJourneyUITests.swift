import XCTest

/// Explicit operator opt-in against disposable staging mail. Ordinary CI skips
/// these live actions; credentials, Home IDs and printed codes stay in the runner.
@MainActor
final class NativePostcardJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private var inputs: [String: String] = [:]

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        let env = ProcessInfo.processInfo.environment
        try XCTSkipUnless(env["RUN_NATIVE_POSTCARD_UI"] == "1", "Requires disposable staging mail")
        XCTAssertEqual(env["POSTCARD_TEST_API"], "http://localhost:8000")
        for key in ["POSTCARD_TEST_EMAIL", "POSTCARD_TEST_PASSWORD", "POSTCARD_TEST_HOME", "POSTCARD_TEST_CODE", "POSTCARD_TEST_URL"] {
            inputs[key] = try XCTUnwrap(env[key])
        }
        XCTAssertTrue(inputs["POSTCARD_TEST_EMAIL"]?.hasPrefix("bp-native-mail-") == true)
        XCTAssertTrue(inputs["POSTCARD_TEST_EMAIL"]?.hasSuffix("@example.com") == true)
        let homeId = try XCTUnwrap(inputs["POSTCARD_TEST_HOME"])
        XCTAssertNotNil(UUID(uuidString: homeId))
        XCTAssertEqual(inputs["POSTCARD_TEST_URL"], "pantopus://homes/\(homeId)/verify-postcard")
        XCTAssertEqual(inputs["POSTCARD_TEST_CODE"]?.count, 6)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            if (testRun?.failureCount ?? 0) > 0 {
                let attachment = XCTAttachment(string: app.debugDescription)
                attachment.name = "Private postcard fixture hierarchy"
                add(attachment)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testPrintedLinkRestartsAndConfirmsOnlyTheExactHome() throws {
        let url = try XCTUnwrap(URL(string: XCTUnwrap(inputs["POSTCARD_TEST_URL"])))
        let code = try XCTUnwrap(inputs["POSTCARD_TEST_CODE"])
        app.launch()
        try signIn()
        app.open(url)
        assertPendingPostcard()
        tap("postcardCheckStatusCTA")
        assertPendingPostcard()
        app.terminate()
        app.open(url)
        assertPendingPostcard()
        enterCode(code == "111111" ? "222222" : "111111")
        tapButton("Verify code")
        XCTAssertTrue(element("postcardSubmitError").waitForExistence(timeout: 20))
        enterCode(code)
        tapButton("Verify code")
        waitForConfirmationReturn()
        // Reopening the original card and retrying cannot send more mail or
        // extend verification; the private runner checks counters and occupancy.
        app.open(url)
        XCTAssertTrue(element("postcardLiveHeading").waitForExistence(timeout: 20))
        enterCode(code)
        tapButton("Verify code")
        waitForConfirmationReturn()
        signOut()
    }

    private func assertPendingPostcard() {
        XCTAssertTrue(element("postcardLiveHeading").waitForExistence(timeout: 20))
        let notice = element("postcardNotice")
        XCTAssertTrue(notice.waitForExistence(timeout: 20))
        XCTAssertTrue(notice.label.contains("already been requested"))
        XCTAssertFalse(app.staticTexts["Mira Patel"].exists)
        XCTAssertFalse(app.staticTexts["#9405 5036 …8421"].exists)
    }

    private func enterCode(_ code: String) {
        let field = element("postcardCodeInput")
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        // The field deliberately forwards touch to the surrounding code boxes.
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        app.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 6) + code)
    }

    private func waitForConfirmationReturn() {
        expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: element("postcardVerification"))
        waitForExpectations(timeout: 30)
        XCTAssertTrue(element("hubMenuButton").waitForExistence(timeout: 5) || element("place.homeTools").waitForExistence(timeout: 15))
    }

    private func signIn() throws {
        if element("hubMenuButton").waitForExistence(timeout: 3) || element("place.homeTools").exists {
            // A failed prior UI assertion may leave a session in Keychain.
            // Use normal logout and login so the requested fixture account is
            // established without trusting a previous screen or session.
            dismissSignInPrompts()
            signOut()
        }
        tap("placeLaunchSignIn")
        try enter(XCTUnwrap(inputs["POSTCARD_TEST_EMAIL"]), into: "loginEmailField")
        try enter(XCTUnwrap(inputs["POSTCARD_TEST_PASSWORD"]), into: "loginPasswordField")
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
        tap(element("place.menu").exists ? "place.menu" : "hubMenuButton")
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
