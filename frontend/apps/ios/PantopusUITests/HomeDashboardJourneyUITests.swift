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
        if app != nil { try? await recordEvidence() }
        if let app, app.state != .notRunning {
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

    func testAuthorityAndIntelligenceRepliesRetireAfterForegroundRevocation() async throws {
        try await openDashboard()
        for suffix in ["/dashboard-access", "/health-score", "/seasonal-checklist", "/property-value"] {
            try reveal(label(containing: "Smoke alarm check"))
            XCUIDevice.shared.press(.home)
            _ = try await fixture("hold", method: "POST", body: ["suffix": suffix])
            app.activate()
            var held = false
            for _ in 0..<100 {
                if try await fixture("state")["held"] as? Bool == true {
                    held = true
                    break
                }
                try await Task.sleep(for: .milliseconds(200))
            }
            try require(held, "Expected a produced production reply for " + suffix)
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
            keepScreen("Current denial retires " + suffix)
            _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
            try press(element("homeDashboard_accessRetry"))
        }
        try reveal(label(containing: "Smoke alarm check"))
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        XCTAssertEqual(events.filter { $0["event"] as? String == "held" }.count, 4)
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
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

    func testActualAccountSwitchColdDenialAndOriginalAccountReturn() async throws {
        try await openDashboard()
        try reveal(label(containing: "Smoke alarm check"))
        keepScreen("Original account has current Home access")
        try signOutThroughSettings()
        try await openDashboard(email: "dashboard-other@example.com")
        try require(element("homeDashboard_accessRetry").waitForExistence(timeout: 30))
        assertPrivateSummaryAbsent()
        XCTAssertFalse(element("homeDashboard_verifyOwnership").exists)
        keepScreen("Second account cannot revive the original Home summary")
        app.terminate()
        try await openDashboard(email: "dashboard-other@example.com")
        try require(element("homeDashboard_accessRetry").waitForExistence(timeout: 30))
        assertPrivateSummaryAbsent()
        keepScreen("Second account remains denied after a cold return")
        try signOutThroughSettings()
        try await openDashboard()
        try reveal(label(containing: "Smoke alarm check"))
        keepScreen("Original account has freshly restored Home authority")
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        let logins = events.filter { $0["event"] as? String == "signed_in" }.compactMap { $0["actor_id"] as? String }
        try require(logins.count >= 2)
        let original = try XCTUnwrap(logins.last)
        let second = logins[logins.count - 2]
        XCTAssertNotEqual(original, second)
        XCTAssertEqual(events.first { $0["event"] as? String == "home_read" }?["actor_id"] as? String, original)
        XCTAssertEqual(events.filter { $0["event"] as? String == "signed_out" }.count, 2)
        XCTAssertFalse(events.contains {
            $0["event"] as? String == "home_read" && $0["actor_id"] as? String == second &&
                ($0["path"] as? String)?.hasSuffix("/dashboard") == true
        })
        XCTAssertGreaterThanOrEqual(events.filter {
            $0["event"] as? String == "home_response" && $0["actor_id"] as? String == second &&
                ($0["path"] as? String)?.hasSuffix("/dashboard-access") == true && $0["status"] as? Int == 403
        }.count, 2)
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
        try await recordEvidence()
    }
}

extension HomeDashboardJourneyUITests {
    private func signOutThroughSettings() throws {
        app.terminate()
        app.launch()
        try require(element("tab.place").waitForExistence(timeout: 30))
        if !element("hubMenuButton").waitForExistence(timeout: 3) { try press(element("place.back")) }
        try press(element("hubMenuButton"))
        try press(element("navDrawer.item.settings"))
        try press(app.buttons["Log out"].firstMatch)
        try require(element("placeLaunchSignIn").waitForExistence(timeout: 30))
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

    private func openDashboard(email: String = "bill-ui@example.com") async throws {
        app.launch()
        if !element("tab.place").waitForExistence(timeout: 3) {
            if !element("loginEmailField").exists { try press(element("placeLaunchSignIn")) }
            try press(element("loginEmailField"))
            element("loginEmailField").typeText(email)
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

extension HomeDashboardJourneyUITests {
    func testMalformedIntelligenceCardsStayRetryableAndRecover() async throws {
        let cases = [
            ("malformed_health", "healthScore"), ("inconsistent_health", "healthScore"), ("wrong_home_action", "healthScore"),
            ("malformed_checklist", "seasonalChecklist"), ("wrong_home_checklist", "seasonalChecklist"),
            ("incorrect_progress", "seasonalChecklist"), ("duplicate_checklist", "seasonalChecklist"),
            ("malformed_property", "propertyValue"), ("invalid_property", "propertyValue"), ("property_error_payload", "propertyValue")
        ]
        for (mode, card) in cases {
            _ = try await fixture("mode", method: "POST", body: ["mode": mode])
            try await openDashboard()
            let retry = element("homeDashboard_" + card + "Retry")
            try reveal(retry)
            try reveal(label(containing: "Current Home information is unavailable"))
            keepScreen(mode + " rejected with Retry")
            _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
            try press(retry)
            if card == "healthScore" {
                try reveal(app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Home health score "))
                    .firstMatch)
            } else if card == "seasonalChecklist" {
                try reveal(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "homeDashboard_seasonalItemToggle_"))
                    .firstMatch)
            } else {
                try reveal(label(containing: "No property estimate is available"))
            }
            keepScreen(mode + " completed current recovery")
            app.terminate()
        }
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        XCTAssertFalse(events.contains { $0["method"] as? String == "PATCH" || $0["event"] as? String == "fixture_error" })
        try await recordEvidence()
    }

    func testChecklistCommittedButUnconfirmedRepliesRequireCurrentReload() async throws {
        for mode in ["receipt_wrong_home", "receipt_wrong_item", "receipt_missing_status", "receipt_lost_reply"] {
            _ = try await fixture("reset", method: "POST")
            try await openDashboard()
            let toggle = app.buttons["Mark Install or replace HEPA air filter complete"].firstMatch
            try reveal(toggle)
            _ = try await fixture("mode", method: "POST", body: ["mode": mode])
            try press(toggle)
            let retry = element("homeDashboard_seasonalChecklistRetry")
            try reveal(retry)
            keepScreen(mode + " requires reload before another action")
            let records = try await fixture("checklist")
            let items = try XCTUnwrap(records["items"] as? [[String: Any]])
            XCTAssertEqual(items.filter { $0["status"] as? String == "completed" }.count, 1)
            _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
            try press(retry)
            try reveal(label(containing: "1/2 done"))
            keepScreen(mode + " reload reflects the committed change")
            app.terminate()
            try await openDashboard()
            try reveal(label(containing: "1/2 done"))
            let state = try await fixture("state")
            let events = try XCTUnwrap(state["events"] as? [[String: Any]])
            XCTAssertEqual(events.filter { $0["event"] as? String == "home_read" && $0["method"] as? String == "PATCH" }.count, 1)
            XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
            try await recordEvidence()
            app.terminate()
        }
    }
}
