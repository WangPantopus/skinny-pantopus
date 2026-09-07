import XCTest

/// Drives the production screens and routing against an isolated, stateful API
/// fixture. Relaunches restore the real AuthManager from fake credentials.
@MainActor
final class EntryContinuityUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() async throws {
        try await super.setUp()
        prepareApp()
    }

    private func prepareApp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment = [
            "UI_TESTS_ENTRY": "1",
            "UI_TESTS_STUB_API": "1",
            "UI_TESTS_DISABLE_NOTIFICATIONS": "1"
        ]
    }

    override func tearDown() async throws {
        cleanUpApp()
        try await super.tearDown()
    }

    private func cleanUpApp() {
        if (testRun?.failureCount ?? 0) > 0 {
            capture("Failure screen")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Failure hierarchy"
            add(hierarchy)
        }
        app.terminate()
        app = nil
    }

    func testAddressSurvivesVerificationSaveFailureAndRelaunch() {
        launch(reset: true)
        enter("12 Example", into: "place.launch.address")
        tap("place.launch.suggestion.entry-address")
        tap("place.preview.continue")
        tap("loginCreateAccountLink")
        enter("entry@example.com", into: "signUpEmailField")
        enter("EntryTest9!", into: "signUpPasswordField")
        enter("EntryTest9!", into: "signUpConfirmPasswordField")
        tap("signUpTermsCheckbox")
        tapButton("Create account")
        XCTAssertTrue(app.staticTexts["Check your email"].waitForExistence(timeout: 10))

        // Simulate the verification callback after the app has been terminated.
        launch(link: "/verify-email?token=entry-token&email=entry%40example.com")
        tapButton("Continue")
        signIn()
        assertAddressArrival()

        // Fail the first save, then kill the app. Neither auth nor the draft
        // should be consumed by that failed request.
        tapButton("Save privately")
        XCTAssertTrue(element("place.arrival.error").waitForExistence(timeout: 10))
        launch()
        assertAddressArrival()
        tapButton("Save privately")
        XCTAssertTrue(app.staticTexts["Saved privately"].waitForExistence(timeout: 10))
        app.buttons["View saved places"].tap()
        XCTAssertTrue(element("savedPlaces.row.saved-entry").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["12 Example Street, Camas, WA 98607"].exists)
        capture("Saved address after interrupted registration and retry")
    }

    func testPulseLinkReturnsToTheSamePostAfterLogin() {
        launch(reset: true, link: "/app/feed?post=entry-post")
        signIn()
        XCTAssertTrue(element("pulsePostDetail").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Anyone up for a park cleanup?"].waitForExistence(timeout: 10))
        XCTAssertFalse(element("place.arrival").exists)
        capture("Pulse post after login")
    }

    func testBeaconFollowIsExplicitAndPersistsAcrossRelaunch() {
        launch(reset: true, link: "/persona/mayabuilds")
        signIn()
        XCTAssertTrue(element("beaconProfile").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Follow"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Following"].exists, "Opening a Beacon must not auto-follow it")
        app.buttons["Follow"].tap()
        tapButton("Continue")
        let freeTier = app.staticTexts["Followers"].firstMatch
        XCTAssertTrue(freeTier.waitForExistence(timeout: 10))
        reveal(freeTier)
        freeTier.tap()
        tapButton("Become a follower")
        XCTAssertTrue(app.staticTexts["You're following Maya Builds"].waitForExistence(timeout: 10))
        tapButton("Done")
        XCTAssertTrue(app.buttons["Following"].waitForExistence(timeout: 10))

        launch(link: "/persona/mayabuilds")
        XCTAssertTrue(app.buttons["Following"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Follow"].exists)
        capture("Beacon following after app relaunch")
    }

    func testNearbyFindsBeaconsWithoutAHome() {
        launch(reset: true, link: "/beacons")
        signIn()
        tap("tab.nearby")
        tap("nearbySocial.beacons")
        tap("beacons.find")
        XCTAssertTrue(element("universalSearch").waitForExistence(timeout: 10))
        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText("Maya")
        XCTAssertTrue(app.staticTexts["Maya Builds"].waitForExistence(timeout: 10))
        capture("Beacon search without a home")
        app.staticTexts["Maya Builds"].tap()
        XCTAssertTrue(element("beaconProfile").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Follow"].waitForExistence(timeout: 10))
    }

    func testMeterFailureKeepsSocialAndFollowingAccessible() {
        app.launchEnvironment["UI_TESTS_SOCIAL_METER"] = "error"
        launch(reset: true, link: "/beacons")
        signIn()
        tap("tab.nearby")
        for id in ["pulse", "beacons", "connections"] {
            XCTAssertTrue(element("nearbySocial.\(id)").waitForExistence(timeout: 10))
        }
        capture("Social discovery during a meter outage")
        tap("nearbySocial.beacons")
        tap("beacons.following")
        XCTAssertTrue(app.staticTexts["Following"].waitForExistence(timeout: 10))
        capture("Following without a home")
    }

    func testFollowingOpensTheExactUpdateWhileNotificationsAreMuted() {
        app.launchEnvironment["UI_TESTS_BEACON_UPDATE"] = "1"
        launch(reset: true, link: "/beacons")
        signIn()
        tap("beacons.following")
        XCTAssertTrue(app.staticTexts["A new workshop for our followers"].waitForExistence(timeout: 10))
        capture("Muted Beacon still has a readable update")
        tap("followingRead.beacon-return")
        XCTAssertTrue(element("pulsePostDetail").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["A new workshop for our followers"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Maya Builds"].exists)
        capture("Exact update opened from Following")
    }

    private func launch(reset: Bool = false, link: String? = nil) {
        if app.state != .notRunning { app.terminate() }
        app.launchEnvironment["UI_TESTS_ENTRY_RESET"] = reset ? "1" : "0"
        app.launchEnvironment["UI_TESTS_ENTRY_FAIL_SAVE"] = "1"
        app.launchEnvironment["UI_TESTS_ENTRY_LINK"] = link
        app.launch()
    }

    private func signIn() {
        enter("entry@example.com", into: "loginEmailField")
        enter("EntryTest9!", into: "loginPasswordField")
        tap("loginSubmitButton")
        let lockOffer = app.buttons.matching(identifier: "appLockSetupPromptDismiss").firstMatch
        if lockOffer.waitForExistence(timeout: 3) { lockOffer.tap() }
    }

    private func assertAddressArrival() {
        XCTAssertTrue(element("place.arrival").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["12 Example Street, Camas, WA 98607"].exists)
        XCTAssertTrue(app.buttons["Save privately"].exists)
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func tap(_ identifier: String) {
        let target = element(identifier)
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing \(identifier)")
        reveal(target)
        XCTAssertTrue(target.isEnabled, "Disabled \(identifier)")
        target.tap()
    }

    private func tapButton(_ label: String) {
        let target = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing button \(label)")
        reveal(target)
        XCTAssertTrue(target.isEnabled, "Disabled button \(label)")
        target.tap()
    }

    private func enter(_ text: String, into identifier: String) {
        let target = element(identifier)
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing \(identifier)")
        reveal(target)
        target.tap()
        target.typeText(text)
    }

    private func reveal(_ target: XCUIElement) {
        for _ in 0..<10 where !target.isHittable {
            // The signup form is nested in the auth scroll view. Scroll only
            // its visible content, in either direction, without hitting the
            // keyboard or overshooting a field and continuing past it.
            let scroll = app.scrollViews.containing(.any, identifier: target.identifier)
                .allElementsBoundByIndex.last
            let frame = (scroll?.frame ?? app.frame).intersection(app.frame)
            let distance = min(140, frame.height * 0.35)
            let direction: CGFloat = target.frame.midY < frame.minY ? 1 : -1
            let origin = app.coordinate(withNormalizedOffset: .zero)
            let start = origin.withOffset(CGVector(dx: frame.maxX - 20, dy: frame.midY))
            let end = start.withOffset(CGVector(dx: 0, dy: distance * direction))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        XCTAssertTrue(target.isHittable)
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
