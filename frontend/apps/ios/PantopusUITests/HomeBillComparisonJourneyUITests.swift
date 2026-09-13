import XCTest

/// Normal installed app sign-in/navigation, production bill HTTP and owned SQL.
@MainActor
final class HomeBillComparisonJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18083"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_BILL_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_BILL_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final native bill state")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Native bill hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testCurrentAmountsMonthsCohortFailuresRetryEmptyAndPermission() async throws {
        try await openDashboard()
        try reveal(element("homeDashboard_billTrendsCard"))
        try require(label(containing: "104.70").waitForExistence(timeout: 20))
        try require(label(containing: "142.50").exists)
        XCTAssertFalse(label(containing: "$1.05").exists)
        keepScreen("Current fractional monthly bills")

        for mode in ["unmatched", "optout"] {
            try await setMode(mode)
            try await reopenDashboard()
            try reveal(element("homeDashboard_billTrendsCard"))
            try require(label(containing: "No comparison for this month").waitForExistence(timeout: 20))
            try require(label(containing: "142.50").exists)
            XCTAssertFalse(label(containing: "104.70").exists)
            keepScreen(mode + " has no current comparison")
        }

        for mode in ["error", "malformed", "legacy", "wrong_currency"] {
            try await setMode(mode)
            try await reopenDashboard()
            try press(element("homeDashboard_billTrendsRetry"))
            try require(element("homeDashboard_billTrendsRetry").waitForExistence(timeout: 20))
            XCTAssertFalse(label(containing: "142.50").exists)
            XCTAssertFalse(label(containing: "No paid USD bills").exists)
            keepScreen(mode + " remains retryable")
            try await setMode("current")
            try press(element("homeDashboard_billTrendsRetry"))
            try require(label(containing: "104.70").waitForExistence(timeout: 20))
            try require(label(containing: "142.50").exists)
        }

        try await setMode("empty")
        try await reopenDashboard()
        try reveal(element("homeDashboard_billTrendsCard"))
        try require(label(containing: "No paid USD bills").waitForExistence(timeout: 20))
        XCTAssertFalse(element("homeDashboard_billTrendsRetry").exists)
        keepScreen("Confirmed empty current USD bills")

        try await setMode("denied")
        try await reopenDashboard()
        try reveal(label(containing: "No property estimate is available"))
        XCTAssertFalse(element("homeDashboard_billTrendsCard").exists)
        XCTAssertFalse(label(containing: "142.50").exists)
        keepScreen("Current financial permission hides bills")
        try await setMode("current")
        try await reopenDashboard()
        try reveal(element("homeDashboard_billTrendsCard"))
        try require(label(containing: "104.70").waitForExistence(timeout: 20))
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        let reads = events.filter { $0["event"] as? String == "bill_read" }
        XCTAssertGreaterThanOrEqual(reads.count, 12)
        XCTAssertTrue(reads.allSatisfy { $0["format"] as? String == "2" && $0["currency"] as? String == "USD" })
        let evidence = try XCTAttachment(data: JSONSerialization.data(withJSONObject: state), uniformTypeIdentifier: "public.json")
        evidence.name = "Installed bill HTTP evidence"
        evidence.lifetime = .keepAlways
        add(evidence)
    }

    private func reopenDashboard() async throws {
        app.terminate()
        try await openDashboard()
    }

    func testCurrencyMonthlyTotalsAndEarlierResponseRetirement() async throws {
        try await openDashboard()
        try reveal(element("homeDashboard_billCurrency"))
        try require(label(containing: "142.50").waitForExistence(timeout: 20))
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Monthly totals")).firstMatch)
        try reveal(label(containing: "210.25"))
        try require(label(containing: "104.70").exists)
        keepScreen("USD monthly totals retain unmatched previous month")
        try selectCurrency("CAD")
        try require(label(containing: "999.99").waitForExistence(timeout: 20))
        XCTAssertFalse(label(containing: "142.50").exists)
        XCTAssertFalse(label(containing: "104.70").exists)
        keepScreen("CAD paid totals never mix USD neighbors")
        try selectCurrency("USD")
        try require(label(containing: "142.50").waitForExistence(timeout: 20))
        _ = try await fixture("hold-currency", method: "POST", body: ["currency": "CAD"])
        try selectCurrency("CAD")
        let held = try await fixture("state")
        try require(held["held"] as? Bool == true)
        XCTAssertFalse(label(containing: "142.50").exists)
        XCTAssertFalse(label(containing: "999.99").exists)
        try selectCurrency("USD")
        try require(label(containing: "142.50").waitForExistence(timeout: 20))
        _ = try await fixture("release-read", method: "POST")
        // UI remains on the current USD selection after the earlier CAD reply.
        let unexpected = XCTNSPredicateExpectation(predicate: NSPredicate { [self] _, _ in
            label(containing: "999.99").exists
        }, object: app)
        unexpected.isInverted = true
        try await require(XCTWaiter.fulfillment(of: [unexpected], timeout: 3) == .completed)
        try require(label(containing: "142.50").exists)
        keepScreen("Earlier CAD reply cannot replace current USD selection")
        let history = try await fixture("history", method: "POST")
        let periods = try XCTUnwrap(history["periods"] as? [String: String])
        try await reopenDashboard()
        try reveal(label(containing: "137.25"))
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Monthly totals")).firstMatch)
        try reveal(label(containing: "Monthly total for " + XCTUnwrap(periods["oldest"])))
        keepScreen("Oldest paid month in full 24-month history")
        try reveal(label(containing: "Monthly total for " + XCTUnwrap(periods["latest"])))
        app.swipeUp()
        let latest = try label(containing: "Monthly total for " + XCTUnwrap(periods["latest"]))
        try require(latest.isHittable)
        XCTAssertFalse(latest.frame.intersects(element("homeDashboardFab").frame))
        keepScreen("Latest paid month remains reachable after scrolling full history")
        let back = app.buttons.matching(NSPredicate(format: "label == 'Back'"))
            .allElementsBoundByIndex.filter(\.isHittable)
        XCTAssertEqual(back.count, 1)
        try press(XCTUnwrap(back.first))
        try require(element("myHomesList").waitForExistence(timeout: 20))
    }

    private func selectCurrency(_ currency: String) throws {
        try press(element("homeDashboard_billCurrency"))
        try press(app.buttons.matching(NSPredicate(format: "label == %@", currency)).firstMatch)
    }

    private func openDashboard() async throws {
        app.launch()
        if !element("tab.place").waitForExistence(timeout: 3) {
            if !element("loginEmailField").exists { try press(element("placeLaunchSignIn")) }
            try press(element("loginEmailField"))
            element("loginEmailField").typeText("bill-ui@example.com")
            try press(element("loginPasswordField"))
            element("loginPasswordField").typeText("synthetic-loopback-only")
            try press(element("loginSubmitButton"))
            for index in 0..<4 {
                let later = app.buttons["Not Now"].firstMatch
                guard later.waitForExistence(timeout: index == 0 ? 10 : 2) else { break }
                later.tap()
            }
            try require(element("tab.place").waitForExistence(timeout: 30))
        }
        if !element("hubAvatarButton").waitForExistence(timeout: 2) { try press(element("place.back")) }
        try press(element("hubAvatarButton"))
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "My homes")).firstMatch)
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Bill UI Fixture")).firstMatch)
        try require(element("homeDashboard").waitForExistence(timeout: 20))
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func label(containing text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func reveal(_ control: XCUIElement) throws {
        if !control.exists { _ = control.waitForExistence(timeout: 3) }
        for _ in 0..<12 {
            if control.exists, control.isHittable { break }
            if control.exists, control.frame.midY < app.frame.midY { app.swipeDown() } else { app.swipeUp() }
        }
        try require(control.waitForExistence(timeout: 20) && control.isHittable, "Missing reachable control")
    }

    private func press(_ control: XCUIElement) throws {
        try reveal(control)
        try require(control.isEnabled)
        control.tap()
    }

    private func require(
        _ condition: Bool,
        _ message: String = "Required native bill state unavailable",
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        guard condition else {
            XCTFail(message, file: file, line: line)
            throw JourneyStopped.requiredState
        }
    }

    private enum JourneyStopped: Error { case requiredState }

    private func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func setMode(_ mode: String) async throws {
        _ = try await fixture("mode", method: "POST", body: ["mode": mode])
    }

    private func fixture(_ action: String, method: String = "GET", body: [String: String]? = nil) async throws -> [String: Any] {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try require((response as? HTTPURLResponse)?.statusCode == 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
