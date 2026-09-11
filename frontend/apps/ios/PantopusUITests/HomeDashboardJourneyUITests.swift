import XCTest

/// Installed native navigation with production dashboard/IAM/record services and owned SQL.
@MainActor
final class HomeDashboardJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18083"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_DASHBOARD_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_DASHBOARD_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final native Home state")
            let attachment = XCTAttachment(string: app.debugDescription)
            attachment.name = "Native Home hierarchy"
            attachment.lifetime = .keepAlways
            add(attachment)
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testRealSummaryUnavailableRecoveryAndCurrentVerification() async throws {
        try await openDashboard()
        try reveal(label(containing: "Smoke alarm check"))
        try require(label(containing: "Quarterly Home check").exists)
        XCTAssertFalse(label(containing: "Private legal fixture name").exists)
        keepScreen("Actual populated Home summary")

        for mode in ["summary_error", "malformed_summary", "wrong_home"] {
            _ = try await fixture("mode", method: "POST", body: ["mode": mode])
            app.terminate()
            try await openDashboard()
            try require(app.buttons["Try again"].waitForExistence(timeout: 30))
            assertPrivateSummaryAbsent()
            keepScreen(mode + " stays unavailable")
            _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
            try press(app.buttons["Try again"])
            try reveal(label(containing: "Smoke alarm check"))
        }

        _ = try await fixture("mode", method: "POST", body: ["mode": "finance_denied"])
        app.terminate()
        try await openDashboard()
        try reveal(label(containing: "Smoke alarm check"))
        XCTAssertFalse(label(containing: "142.50").exists)
        XCTAssertFalse(element("homeDashboard_billTrendsCard").exists)
        keepScreen("Current finance denial hides bill data")

        for mode in ["pending_residency", "pending_ownership", "revoked", "frozen", "denied"] {
            _ = try await fixture("mode", method: "POST", body: ["mode": mode])
            app.terminate()
            try await openDashboard()
            try require(element("homeDashboard_accessRetry").waitForExistence(timeout: 30))
            assertPrivateSummaryAbsent()
            if mode == "pending_residency" {
                try require(label(containing: "Your residency request").exists)
                XCTAssertFalse(element("homeDashboard_verifyOwnership").exists)
            } else if mode == "pending_ownership" {
                try require(element("homeDashboard_verifyOwnership").exists)
            }
            keepScreen("Current entry " + mode)
        }
        _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
        try press(element("homeDashboard_accessRetry"))
        try reveal(label(containing: "Smoke alarm check"))
        try await recordEvidence()
    }

    func testForegroundRevocationAndEarlierProducedReplyRetirement() async throws {
        try await openDashboard()
        try reveal(label(containing: "Smoke alarm check"))
        _ = try await fixture("hold", method: "POST", body: ["suffix": "/dashboard"])
        XCUIDevice.shared.press(.home)
        app.activate()
        var held = false
        for _ in 0..<50 {
            if try await fixture("state")["held"] as? Bool == true { held = true
                break
            }
            try await Task.sleep(for: .milliseconds(200))
        }
        try require(held, "Expected an already-produced production aggregate reply")
        XCUIDevice.shared.press(.home)
        _ = try await fixture("mode", method: "POST", body: ["mode": "revoked"])
        app.activate()
        try require(element("homeDashboard_accessRetry").waitForExistence(timeout: 30))
        _ = try await fixture("release", method: "POST")
        let stale = XCTNSPredicateExpectation(predicate: NSPredicate { [self] _, _ in
            label(containing: "Smoke alarm check").exists
        }, object: app)
        stale.isInverted = true
        try await require(XCTWaiter.fulfillment(of: [stale], timeout: 2) == .completed)
        assertPrivateSummaryAbsent()
        keepScreen("Revoked foreground cannot revive a held aggregate")
        _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
        try press(element("homeDashboard_accessRetry"))
        try reveal(label(containing: "Smoke alarm check"))
        try await recordEvidence()
    }

    func testIntelligenceRetryAndPrivateCreatorEntry() async throws {
        for (mode, retry) in [
            ("health_error", "homeDashboard_healthScoreRetry"),
            ("checklist_error", "homeDashboard_seasonalChecklistRetry"),
            ("property_error", "homeDashboard_propertyValueRetry")
        ] {
            _ = try await fixture("mode", method: "POST", body: ["mode": mode])
            try await openDashboard()
            try reveal(element(retry))
            keepScreen(mode + " is independently recoverable")
            _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
            try press(element(retry))
            let recovered = XCTNSPredicateExpectation(predicate: NSPredicate { [self] _, _ in
                !element(retry).exists
            }, object: app)
            try await require(XCTWaiter.fulfillment(of: [recovered], timeout: 30) == .completed)
            if mode == "health_error" {
                try reveal(app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Home health score "))
                    .firstMatch)
            } else if mode == "checklist_error" {
                try reveal(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "homeDashboard_seasonalItemToggle_"))
                    .firstMatch)
            } else {
                try reveal(label(containing: "No property estimate is available"))
            }
            keepScreen(mode + " completed current recovery")
            try reveal(label(containing: "Smoke alarm check"))
            app.terminate()
        }
        _ = try await fixture("mode", method: "POST", body: ["mode": "private_creator"])
        try await openDashboard()
        try reveal(element("homeDashboard_limitedTasks"))
        assertPrivateSummaryAbsent()
        try require(element("homeDashboard_verifyOwnership").exists)
        keepScreen("Exact private creator entry preserves own Tasks")
        try press(element("homeDashboard_limitedTasks"))
        try require(element("householdTasksList").waitForExistence(timeout: 20))
        keepScreen("Private first-use Tasks destination")
        try await recordEvidence()
    }

    private func assertPrivateSummaryAbsent() {
        XCTAssertFalse(label(containing: "Smoke alarm check").exists)
        XCTAssertFalse(label(containing: "Quarterly Home check").exists)
        XCTAssertFalse(label(containing: "142.50").exists)
        XCTAssertFalse(element("homeDashboard_billTrendsCard").exists)
    }

    private func recordEvidence() async throws {
        let state = try await fixture("state")
        let attachment = try XCTAttachment(data: JSONSerialization.data(withJSONObject: state), uniformTypeIdentifier: "public.json")
        attachment.name = "Installed Home production HTTP evidence"
        attachment.lifetime = .keepAlways
        add(attachment)
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
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Dashboard UI Fixture")).firstMatch)
        try require(element("homeDashboard").waitForExistence(timeout: 20))
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func label(containing text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
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
        _ message: String = "Required native Home state unavailable",
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
