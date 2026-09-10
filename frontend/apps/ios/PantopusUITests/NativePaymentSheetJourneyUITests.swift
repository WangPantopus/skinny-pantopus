import XCTest

/// Opt-in real Stripe SetupIntent UI, restricted to a disposable local actor.
/// Ordinary CI skips this journey. The private runner verifies test-mode Stripe,
/// exactly two created setups (including cancel/resume), and provider cleanup.
@MainActor
final class NativePaymentSheetJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private var email = ""
    private var password = ""

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        let env = ProcessInfo.processInfo.environment
        try XCTSkipUnless(env["RUN_NATIVE_PAYMENT_SHEET_UI"] == "1", "Requires disposable test-mode card setup")
        XCTAssertEqual(env["PAYMENT_SHEET_TEST_API"], "http://localhost:8000")
        email = try XCTUnwrap(env["PAYMENT_SHEET_TEST_EMAIL"])
        password = try XCTUnwrap(env["PAYMENT_SHEET_TEST_PASSWORD"])
        XCTAssertTrue(email.hasPrefix("bp-sheet-") && email.hasSuffix("@example.com"))
        XCTAssertFalse(password.isEmpty)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
    }

    override func tearDown() async throws {
        app?.terminate()
        app = nil
        email = ""
        password = ""
        try await super.tearDown()
    }

    func testCancelResumeSaveDefaultRestartAndRemoveCards() throws {
        app.launch()
        signIn()
        openPayments()
        XCTAssertTrue(element("payments.empty").waitForExistence(timeout: 20))

        openSheet()
        closeSheet()
        XCTAssertTrue(element("payments.empty").waitForExistence(timeout: 10))
        assertAddLabel("Retry saving card")
        restartAndOpenPayments()
        assertAddLabel("Retry saving card")

        // Official Stripe test cards are entered only into Stripe's UI, never
        // posted directly to our API: https://docs.stripe.com/testing#cards.
        openSheet()
        saveTestCard("4242424242424242")
        let cardA = try waitForCard(last4: "4242")
        assertDefault(cardA)
        openSheet()
        saveTestCard("5555555555554444")
        let cardB = try waitForCard(last4: "4444")
        XCTAssertNotEqual(cardA, cardB)
        tap("payments.method.\(cardB)")
        tap("paymentsRow_\(cardB)_setDefault")
        assertDefault(cardB)
        XCTAssertFalse(element("paymentsRow_\(cardA)_defaultBadge").exists)

        restartAndOpenPayments()
        XCTAssertTrue(element("payments.method.\(cardA)").waitForExistence(timeout: 20))
        XCTAssertTrue(element("payments.method.\(cardB)").exists)
        assertDefault(cardB)
        requestRemoval(cardB)
        tap("paymentsRemoveCancel")
        XCTAssertTrue(element("payments.method.\(cardB)").exists)
        assertDefault(cardB)

        removeCard(cardB)
        assertDefault(cardA)
        removeCard(cardA)
        XCTAssertTrue(element("payments.empty").waitForExistence(timeout: 20))
        assertAddLabel("Add payment method")
        tapBack()
        tapButton("Log out")
        XCTAssertTrue(element("placeLaunchSignIn").waitForExistence(timeout: 20))
    }

    private func openPayments() {
        if element("payments.screen").exists { return }
        tap(element("place.menu").exists ? "place.menu" : "hubMenuButton")
        tap("navDrawer.item.settings")
        tap("groupedListRow_paymentsPayouts")
        XCTAssertTrue(element("payments.screen").waitForExistence(timeout: 20))
        XCTAssertTrue(element("payments.addMethodBtn").waitForExistence(timeout: 20))
    }

    private func restartAndOpenPayments() {
        app.terminate()
        app.launch()
        XCTAssertTrue(element("hubMenuButton").waitForExistence(timeout: 20) || element("place.homeTools").exists)
        openPayments()
    }

    private func openSheet() {
        tap("payments.addMethodBtn")
        XCTAssertTrue(app.buttons["Set up"].waitForExistence(timeout: 30))
    }

    private func closeSheet() {
        let close = app.buttons["UIButton.Close"]
        if close.exists { close.tap() } else { tapButton("Close") }
        waitForAbsence(app.buttons["Set up"])
    }

    private func saveTestCard(_ number: String) {
        // These identifiers come from the pinned Stripe SDK's own UI tests.
        // A customer with a saved card starts at the SDK's selection screen.
        if !app.textFields["Card number"].exists { tapButton("+ Add") }
        fillStripeField("Card number", text: number)
        fillStripeField("expiration date", text: "1234")
        fillStripeField("CVC", text: "123")
        fillStripeField("ZIP", text: "12345")
        let done = app.toolbars.buttons["Done"].firstMatch
        if done.exists { done.tap() }
        tapButton("Set up")
        waitForAbsence(app.buttons["Set up"], timeout: 45)
        assertAddLabel("Add payment method")
        XCTAssertFalse(app.alerts["Something went wrong"].exists)
    }

    private func fillStripeField(_ label: String, text: String) {
        let field = app.textFields[label]
        XCTAssertTrue(field.waitForExistence(timeout: 20), "Missing Stripe field \(label)")
        field.tap()
        field.typeText(text)
    }

    private func waitForCard(last4: String) throws -> String {
        let row = app.descendants(matching: .any).matching(NSPredicate(
            format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "payments.method.", last4
        )).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30), "Saved card ending \(last4) did not appear")
        let id = String(row.identifier.dropFirst("payments.method.".count))
        XCTAssertFalse(id.isEmpty)
        return id
    }

    private func assertDefault(_ id: String) {
        // The default badge is optimistic; wait for the API/reload operation
        // to settle before treating it as durable or restarting the app.
        assertAddLabel("Add payment method")
        XCTAssertFalse(app.alerts["Something went wrong"].exists)
        XCTAssertTrue(element("paymentsRow_\(id)_defaultBadge").waitForExistence(timeout: 20))
    }

    private func assertAddLabel(_ label: String) {
        expectation(for: NSPredicate(format: "label == %@ AND enabled == true", label), evaluatedWith: element("payments.addMethodBtn"))
        waitForExpectations(timeout: 30)
    }

    private func requestRemoval(_ id: String) {
        tap("payments.method.\(id)")
        tap("paymentsRow_\(id)_remove")
        XCTAssertTrue(element("paymentsRemoveConfirm").waitForExistence(timeout: 10))
    }

    private func removeCard(_ id: String) {
        requestRemoval(id)
        tap("paymentsRemoveConfirm")
        waitForAbsence(element("payments.method.\(id)"))
        assertAddLabel("Add payment method")
        XCTAssertFalse(app.alerts["Something went wrong"].exists)
    }

    private func waitForAbsence(_ target: XCUIElement, timeout: TimeInterval = 30) {
        expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: target)
        waitForExpectations(timeout: timeout)
    }

    private func signIn() {
        if element("hubMenuButton").waitForExistence(timeout: 3) || element("place.homeTools").exists {
            dismissSignInPrompts()
            tap(element("place.menu").exists ? "place.menu" : "hubMenuButton")
            tap("navDrawer.item.settings")
            tapButton("Log out")
            XCTAssertTrue(element("placeLaunchSignIn").waitForExistence(timeout: 20))
        }
        tap("placeLaunchSignIn")
        enter(email, into: "loginEmailField")
        enter(password, into: "loginPasswordField")
        tap("loginSubmitButton")
        XCTAssertTrue(element("hubMenuButton").waitForExistence(timeout: 25))
        dismissSignInPrompts()
    }

    private func dismissSignInPrompts() {
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 5) else { return }
            let passwordDismiss = app.buttons.matching(NSPredicate(
                format: "label == %@ AND identifier == %@", "Not Now", ""
            )).firstMatch
            let topmost = passwordDismiss.exists ? passwordDismiss : app.buttons["appLockSetupPromptDismiss"].firstMatch
            let frame = topmost.frame
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        }
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
