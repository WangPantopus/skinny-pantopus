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
        let tipJourney = env["RUN_NATIVE_TIP_UI"] == "1" || env["RUN_NATIVE_COMPLETION_UI"] == "1"
        try XCTSkipUnless(tipJourney || env["RUN_NATIVE_PAYMENT_SHEET_UI"] == "1", "Requires disposable local payment fixture")
        XCTAssertEqual(env["PAYMENT_SHEET_TEST_API"], tipJourney ? "http://127.0.0.1:18109" : "http://localhost:8000")
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
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_NATIVE_PAYMENT_SHEET_UI"] == "1")
        app.launch()
        signIn()
        openPayments()
        let resumeAfterVisa = ProcessInfo.processInfo.environment["PAYMENT_SHEET_RESUME_AFTER_VISA"] == "1"
        if !resumeAfterVisa {
            XCTAssertTrue(element("payments.empty").waitForExistence(timeout: 20))
            openSheet()
            closeSheet()
            XCTAssertTrue(element("payments.empty").waitForExistence(timeout: 10))
            assertAddLabel("Retry saving card")
            restartAndOpenPayments()
            assertAddLabel("Retry saving card")

            // Official Stripe test cards are entered only into Stripe's UI,
            // never posted directly to our API: https://docs.stripe.com/testing#cards.
            openSheet()
            saveTestCard("4242424242424242")
        }
        // A private operator may resume only after reconciling the exact first
        // successful setup and single default Visa against the provider/API.
        let cardA = try waitForCard(last4: "4242")
        assertDefault(cardA, allowPendingSetup: resumeAfterVisa)
        openSheet()
        saveTestCard("5555555555554444")
        let cardB = try waitForCard(last4: "4444")
        XCTAssertNotEqual(cardA, cardB)
        tap("payments.method.\(cardB)")
        tap("paymentsRow_\(cardB)_setDefault")
        assertDefault(cardB)
        XCTAssertFalse(element("payments.method.\(cardA)").label.localizedCaseInsensitiveContains("default"))

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

    /// Actual installed UI/HTTP/SQL; the opt-in loopback runner supplies synthetic
    /// authentication/provider responses and asserts zero replacement charges.
    func testExistingTipColdEntryRestartAndSamePaymentCheck() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_NATIVE_TIP_UI"] == "1")
        let fixture = try await tipFixture("reset", body: ["mode": "legacy"])
        let gig = try XCTUnwrap(fixture["gig"] as? String)
        let url = try XCTUnwrap(URL(string: "pantopus://gigs/" + gig))
        app.launch()
        if !element("tab.place").waitForExistence(timeout: 5) { signIn() }
        app.open(url)
        try tipTap("contentDetailDockPrimary")
        XCTAssertTrue(element("tip.amount.customSubmit").waitForExistence(timeout: 20))
        guard waitTipControl() else { throw tipFailure("Tip recovery control unavailable") }
        XCTAssertFalse(element("tip.amount.500").isEnabled)
        XCTAssertFalse(element("tip.amount.customInput").isEnabled)
        XCTAssertEqual(element("tip.amount.customInput").value as? String, "10.00")
        try tipTap("tip.amount.customSubmit")
        waitForAbsence(element("tip.amount.customSubmit"))
        app.terminate()
        app.launch()
        app.open(url)
        try tipTap("contentDetailDockPrimary")
        guard waitTipControl() else { throw tipFailure("Tip recovery control unavailable") }
        XCTAssertEqual(element("tip.amount.customInput").value as? String, "10.00")
        _ = try await tipFixture("provider-succeed", body: [:])
        try tipTap("tip.amount.customSubmit")
        XCTAssertTrue(app.staticTexts["Tip sent — thank you!"].waitForExistence(timeout: 20))
        let result = try await tipFixture("state")
        let commands = try XCTUnwrap(result["commands"] as? [[String: Any]])
        XCTAssertEqual(commands.count, 2)
        XCTAssertTrue(commands.allSatisfy { $0["mode"] as? String == "check" && $0["amount"] as? Int == 1000 })
        XCTAssertEqual(commands[0]["requestId"] as? String, commands[1]["requestId"] as? String)
        XCTAssertEqual(result["createCalls"] as? Int, 0)
        XCTAssertEqual(result["notificationCount"] as? Int, 1)
        let payments = try XCTUnwrap(result["payments"] as? [[String: Any]])
        XCTAssertEqual(payments.count, 1)
        XCTAssertEqual(payments[0]["id"] as? String, commands[0]["requestId"] as? String)
        XCTAssertEqual(payments[0]["originalState"] as? String, "succeeded")
        app.terminate()
        app.launch()
        app.open(url)
        XCTAssertTrue(app.staticTexts["Existing tip recovery"].waitForExistence(timeout: 20))
        XCTAssertFalse(element("contentDetailDockPrimary").exists && element("contentDetailDockPrimary").label.contains("Send a tip"))
    }

    private func tipFailure(_ message: String) -> NSError {
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "Installed tip accessibility hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        XCTFail(message)
        return NSError(domain: "InstalledTipJourney", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func tipTap(_ id: String) throws {
        let target = element(id)
        guard target.waitForExistence(timeout: 15), target.isEnabled else { throw tipFailure("Missing or disabled " + id) }
        target.tap()
    }

    private func waitTipControl() -> Bool {
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true AND enabled == true"),
            object: element("tip.amount.customSubmit")
        )
        return XCTWaiter.wait(for: [ready], timeout: 20) == .completed
    }

    private func tipFixture(_ action: String, body: [String: String]? = nil) async throws -> [String: Any] {
        let url = try XCTUnwrap(URL(string: "http://127.0.0.1:18109/fixture/" + action))
        var request = URLRequest(url: url)
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func openPayments() {
        if element("payments.addMethodBtn").exists { return }
        tap(element("place.menu").exists ? "place.menu" : "hubMenuButton")
        tap("navDrawer.item.settings")
        tap("groupedListRow_paymentsPayouts")
        print("PAYMENT_IDENTITY_GATE")
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
        if !app.textFields["Card number"].exists { tap("+ Add") }
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

    private func assertDefault(_ id: String, allowPendingSetup: Bool = false) {
        // The default badge is optimistic; wait for the API/reload operation
        // to settle before treating it as durable or restarting the app.
        let labels = allowPendingSetup ? ["Add payment method", "Retry saving card"] : ["Add payment method"]
        expectation(for: NSPredicate(format: "label IN %@ AND enabled == true", labels), evaluatedWith: element("payments.addMethodBtn"))
        waitForExpectations(timeout: 30)
        XCTAssertFalse(app.alerts["Something went wrong"].exists)
        expectation(for: NSPredicate(format: "label CONTAINS[c] %@", "default"), evaluatedWith: element("payments.method.\(id)"))
        waitForExpectations(timeout: 20)
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
        }
        if !element("loginEmailField").waitForExistence(timeout: 3) { tap("placeLaunchSignIn") }
        if element("loginRememberedAccountForget").exists { tap("loginRememberedAccountForget") }
        enter(email, into: "loginEmailField")
        enter(password, into: "loginPasswordField")
        tap("loginSubmitButton")
        dismissSignInPrompts()
        XCTAssertTrue(element("tab.place").waitForExistence(timeout: 25) || element("hubMenuButton").exists)
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
        // The enclosing navigation button returns to Hub. Use the Payments
        // bar's Back control to return to Settings before normal logout.
        let back = app.buttons.matching(NSPredicate(format: "label == %@ AND identifier == %@", "Back", "paymentsTopBar")).firstMatch
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

extension NativePaymentSheetJourneyUITests {
    /// Existing picker/handler against real local upload and completion routes.
    /// The private fixture loses the first committed response; auth/storage are synthetic.
    func testExistingCompletionProofRetryKeepsUploadedFile() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_NATIVE_COMPLETION_UI"] == "1")
        let url = try XCTUnwrap(URL(string: "pantopus://gigs/aaed0000-0000-4000-8000-000000000100"))
        app.launch()
        if !element("tab.place").waitForExistence(timeout: 5) { signIn() }
        app.open(url)
        try tipTap("contentDetailDockPrimary")
        guard element("deliveryProof.submit").waitForExistence(timeout: 20) else {
            throw tipFailure("Existing completion submit control is unavailable")
        }
        XCTAssertFalse(element("deliveryProof.submit").isEnabled)
        try tipTap("deliveryProof.photoUpload")
        let photo = app.images.matching(NSPredicate(format: "label BEGINSWITH %@", "Photo,")).firstMatch
        guard photo.waitForExistence(timeout: 15) else { throw tipFailure("Owned proof photo picker unavailable") }
        let photoFrame = photo.frame
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: photoFrame.midX, dy: photoFrame.midY)).tap()
        guard element("deliveryProof.removePhoto").waitForExistence(timeout: 15) else {
            throw tipFailure("Selected proof photo did not return to the existing sheet")
        }
        enter("Original proof after a lost reply", into: "deliveryProof.note")
        app.swipeUp()
        try tipTap("deliveryProof.submit")
        guard element("deliveryProof.error").waitForExistence(timeout: 20) else { throw tipFailure("Expected retryable lost reply") }
        XCTAssertTrue(element("deliveryProof.removePhoto").exists)
        let saved = try await completionFixtureState()
        XCTAssertEqual(saved["uploadRequests"] as? Int, 1)
        XCTAssertEqual((saved["completionRequests"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((saved["notices"] as? [[String: Any]])?.count, 1)
        let firstGig = try XCTUnwrap(saved["gig"] as? [String: Any])
        XCTAssertEqual(firstGig["status"] as? String, "completed")
        try tipTap("deliveryProof.submit")
        guard element("deliveryProof.backToTask").waitForExistence(timeout: 20) else {
            throw tipFailure("Saved proof retry did not reach its existing confirmation")
        }
        let final = try await completionFixtureState()
        XCTAssertEqual(final["uploadRequests"] as? Int, 1)
        let commands = try XCTUnwrap(final["completionRequests"] as? [NSDictionary])
        XCTAssertEqual(commands.count, 2)
        XCTAssertEqual(try XCTUnwrap(commands.first), try XCTUnwrap(commands.last))
        XCTAssertEqual((final["notices"] as? [[String: Any]])?.count, 1)
        let finalGig = try XCTUnwrap(final["gig"] as? [String: Any])
        XCTAssertEqual(firstGig["worker_completed_at"] as? String, finalGig["worker_completed_at"] as? String)
        try tipTap("deliveryProof.backToTask")
    }

    private func completionFixtureState() async throws -> [String: Any] {
        let url = try XCTUnwrap(URL(string: "http://127.0.0.1:18109/api/fixture/state"))
        let (data, response) = try await URLSession.shared.data(from: url)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
