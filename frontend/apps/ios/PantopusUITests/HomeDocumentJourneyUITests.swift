import XCTest

/// Read/share acceptance against an operator-owned Home on the private staging tunnel.
/// Ordinary CI skips it; no fixture credentials or hosted identifiers are stored here.
@MainActor
final class HomeDocumentJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private var inputs: [String: String] = [:]

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        let env = ProcessInfo.processInfo.environment
        try XCTSkipUnless(env["RUN_HOME_DOCUMENT_UI"] == "1", "Requires the isolated staging Home fixture")
        XCTAssertEqual(env["DOCUMENT_TEST_API"], "http://localhost:8000")
        for key in ["DOCUMENT_TEST_EMAIL", "DOCUMENT_TEST_PASSWORD", "DOCUMENT_TEST_TITLE"] {
            inputs[key] = try XCTUnwrap(env[key], "Missing private runner input")
        }
        XCTAssertTrue(inputs["DOCUMENT_TEST_EMAIL"]?.hasPrefix("bp-doc-") == true)
        XCTAssertTrue(inputs["DOCUMENT_TEST_EMAIL"]?.hasSuffix("@example.com") == true)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            if (testRun?.failureCount ?? 0) > 0 {
                let hierarchy = XCTAttachment(string: app.debugDescription)
                hierarchy.name = "Private document fixture hierarchy"
                add(hierarchy)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testMemberOpensSharedDocumentAndSharesTheRealFile() throws {
        app.launch()
        try signIn()
        if element("place.homeTools").waitForExistence(timeout: 5) {
            tap("place.homeTools")
        } else {
            tap("hubMenuButton")
            tap("navDrawer.item.my-homes")
            let home = app.staticTexts["Document Storage Test"].firstMatch
            XCTAssertTrue(home.waitForExistence(timeout: 20))
            reveal(home)
            home.tap()
        }
        tapButton("Documents")
        XCTAssertTrue(element("documentsList").waitForExistence(timeout: 20))
        let title = try XCTUnwrap(inputs["DOCUMENT_TEST_TITLE"])
        let row = app.staticTexts[title].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 20))
        reveal(row)
        row.tap()
        XCTAssertTrue(element("documentDetailTitle").waitForExistence(timeout: 20))
        XCTAssertEqual(element("documentDetailTitle").label, title)
        XCTAssertTrue(element("documentDetailPreview").exists)
        tap("documentDetailShare")
        let save = app.cells["Save to Files"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 20), "The system did not receive a file to share")
    }

    private func signIn() throws {
        if element("place.homeTools").waitForExistence(timeout: 3) || element("hubMenuButton").exists {
            // The dedicated simulator may retain this fixture's session from
            // an earlier read. The requested private document below proves
            // access; never replace its Keychain from the runner.
            dismissSignInPrompts()
            return
        }
        tap("placeLaunchSignIn")
        try enter(XCTUnwrap(inputs["DOCUMENT_TEST_EMAIL"]), into: "loginEmailField")
        try enter(XCTUnwrap(inputs["DOCUMENT_TEST_PASSWORD"]), into: "loginPasswordField")
        tap("loginSubmitButton")
        let signedIn = NSPredicate { [self] _, _ in
            element("hubMenuButton").exists || element("place.homeTools").exists
        }
        expectation(for: signedIn, evaluatedWith: app)
        waitForExpectations(timeout: 30)
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
