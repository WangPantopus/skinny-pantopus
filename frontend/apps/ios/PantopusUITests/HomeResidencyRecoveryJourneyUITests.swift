import XCTest

/// Explicit opt-in against the real residency API/SDK/SQL and owned simulator.
@MainActor
final class HomeResidencyRecoveryJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private let street = "9141 Home Creation Fixture Way"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_RESIDENCY_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_RESIDENCY_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final residency recovery state")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Private residency recovery hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                let proof = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                proof.name = "Production residency HTTP SDK SQL evidence"
                proof.lifetime = .keepAlways
                add(proof)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testLostSubmissionRestartAndTruthfulCurrentStatus() async throws {
        try openWizard()
        try completeJoining(unit: "601")
        _ = try await fixture("mode", method: "POST", body: ["mode": "residency_lost_reply"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Recover your residency request"))
        let original = try await fixture("state")
        let home = try homeRow(original, unit: "601")
        XCTAssertEqual(home["occupancies"] as? Int, 1)
        XCTAssertEqual((home["claims"] as? [[String: Any]])?.first?["status"] as? String, "pending")
        keepScreen("Lost submission keeps its selected Home and unit")
        app.terminate()
        try openWizard()
        try reveal(label("Residency request saved"))
        keepScreen("Restart recovers the same submitted request")
        try press(element("wizardPrimaryCTA"))
        let homeId = try XCTUnwrap(home["id"] as? String)
        try press(element("myHomes.row_" + homeId + ".continue"))
        try reveal(label("Waiting for household review"))
        XCTAssertFalse(label("Upload proof").exists)
        XCTAssertTrue(label(street + ", 601").exists)
        keepScreen("Saved residency leads to household review")
        for kind in ["error", "malformed"] {
            _ = try await fixture("residency-read-fault", method: "POST", body: ["kind": kind, "persistent": true])
            try press(element("homeResidencyRefresh"))
            try reveal(element("homeResidencyError"))
            XCTAssertFalse(element("homeResidencyAddress").exists)
            keepScreen("Unavailable current residency is recoverable")
            _ = try await fixture("residency-read-fault", method: "POST", body: ["kind": "clear"])
            try press(element("homeResidencyRetry"))
            try reveal(label("Waiting for household review"))
        }
        _ = try await fixture("residency-state", method: "POST", body: ["home": 601, "state": "verified"])
        try press(element("homeResidencyRefresh"))
        try reveal(label("Household access is available"))
        XCTAssertTrue(app.buttons["Open Home"].exists)
        _ = try await fixture("hold", method: "POST", body: ["suffix": "/my-residency"])
        try press(element("homeResidencyRefresh"))
        try await awaitState("held")
        _ = try await fixture("residency-state", method: "POST", body: ["home": 601, "state": "removed"])
        XCUIDevice.shared.press(.home)
        app.activate()
        try reveal(label("Household access needs review"))
        _ = try await fixture("release", method: "POST")
        try reveal(label("Household access needs review"))
        XCTAssertFalse(app.buttons["Open Home"].exists)
        keepScreen("Retired approval cannot restore removed access")
        try press(app.navigationBars["Residency status"].buttons.firstMatch)
        try reveal(label(street + ", 601"))
        XCTAssertTrue(label("Review recorded").exists)
        keepScreen("Personal request stays visible after shared access is removed")
        let final = try await fixture("state")
        let events = try XCTUnwrap(final["events"] as? [[String: Any]])
        XCTAssertEqual(
            events
                .filter { $0["path"] as? String == "/api/homes/" + homeId + "/residency-submissions" && $0["method"] as? String == "POST" }
                .count,
            1
        )
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
    }

    func testCancellationFencesDelayedJoiningBeforeItArrives() async throws {
        try openWizard()
        try completeJoining(unit: "605")
        _ = try await fixture("hold-submission", method: "POST")
        try press(element("wizardPrimaryCTA"))
        try await awaitState("held_submission")
        app.terminate()
        try openWizard()
        try reveal(label("Recover your residency request"))
        try press(element("addHomeRecoveryCancel"))
        try press(element("addHomeRecoveryCancelConfirm"))
        try reveal(label("Request cancelled"))
        _ = try await fixture("release-submission", method: "POST")
        let saved = try await homeRow(fixture("state"), unit: "605")
        XCTAssertEqual(saved["occupancies"] as? Int, 0)
        XCTAssertEqual((saved["claims"] as? [[String: Any]])?.count, 0)
        keepScreen("Cancellation prevents delayed claim admission")
        try press(element("wizardPrimaryCTA"))
        try reveal(element("addHome_unit"))
        XCTAssertEqual(element("addHome_unit").value as? String, "605")
    }

    func testHouseholdSubmissionRefusesChangedUnit() async throws {
        try openWizard()
        try completeJoining(unit: "602", role: "householdMember")
        _ = try await fixture("change-unit", method: "POST", body: ["home": 602, "unit": "612"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Review your residency request"))
        let state = try await fixture("state")
        let home = try homeRow(state, unit: "612")
        XCTAssertEqual(home["occupancies"] as? Int, 0)
        keepScreen("Changed unit refuses the original admission")
        try press(element("wizardPrimaryCTA"))
        try reveal(element("addHome_unit"))
        XCTAssertEqual(element("addHome_unit").value as? String, "602")
        // Fresh address confirmation is required; restoring the original unit
        // does not auto-submit or reuse the rejected command.
        _ = try await fixture("change-unit", method: "POST", body: ["home": 602, "unit": "602"])
    }

    func testRejectedHouseholdRequestCanBeResubmitted() async throws {
        try openWizard()
        try completeJoining(unit: "604", role: "householdMember")
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Residency request saved"))
        let home = try await homeRow(fixture("state"), unit: "604")
        let claims = try XCTUnwrap(home["claims"] as? [[String: Any]])
        XCTAssertEqual(claims.count, 1)
        XCTAssertEqual(claims.first?["status"] as? String, "pending")
        XCTAssertEqual(claims.first?["claimed_role"] as? String, "household")
        XCTAssertEqual(home["occupancies"] as? Int, 1)
        keepScreen("Rejected residency is resubmitted with its current selected unit")
        try press(element("wizardPrimaryCTA"))
        let homeId = try XCTUnwrap(home["id"] as? String)
        try press(element("myHomes.row_" + homeId + ".continue"))
        try reveal(label("Waiting for household review"))
        XCTAssertFalse(app.buttons["Open Home"].exists)
    }

    func testPersonalHistoryPaginationAndUnavailableRead() async throws {
        _ = try await fixture("residency-history", method: "POST", body: ["count": 51])
        try openMyHomes()
        let more = element("myHomes.residency-more")
        for _ in 0..<50 {
            if more.exists, more.isHittable { break }
            app.swipeUp(velocity: .fast)
        }
        try press(more)
        try reveal(label("Personal historical request 50"))
        XCTAssertFalse(element("myHomes.residency-more").exists)
        keepScreen("Full personal residency history loads beyond the first page")
        _ = try await fixture("residency-read-fault", method: "POST", body: ["kind": "error", "persistent": true])
        XCUIDevice.shared.press(.home)
        app.activate()
        try reveal(element("myHomes.residency-retry"))
        XCTAssertFalse(label("Personal historical request 50").exists)
        keepScreen("Unavailable residency history offers an explicit retry")
        _ = try await fixture("residency-read-fault", method: "POST", body: ["kind": "clear"])
        try press(element("myHomes.residency-retry"))
        try reveal(label("Personal historical request 0"))
    }

    private func completeJoining(unit: String, role: String = "tenant") throws {
        try reveal(label("Find your home"))
        try press(app.buttons["Add address manually"])
        for (field, value) in [("street", street), ("unit", unit), ("city", "Test"), ("state", "WA"), ("zip", "98607")] {
            try fill(field, value)
        }
        try press(element("wizardPrimaryCTA"))
        if element("addHomeClaimedCorrect").waitForExistence(timeout: 8) {
            try press(element("addHomeClaimedCorrect"))
            try reveal(element("addHomeClaimedAddressLabel"))
            XCTAssertTrue(element("addHomeClaimedAddressLabel").label.contains(unit))
            try press(element("addHomeClaimedConfirmAddress"))
        } else {
            try reveal(label("Address recognized"))
            try press(element("wizardPrimaryCTA"))
        }
        try press(element("addHome_role_" + role))
        XCTAssertFalse(element("addHome_accessSecret").exists)
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Review and submit"))
        keepScreen("Review selected Home, apartment and residency relationship")
    }

    private func openWizard() throws {
        try openMyHomes()
        try press(app.buttons["Add a home"].firstMatch)
    }

    private func openMyHomes() throws {
        app.launch()
        if !element("tab.place").waitForExistence(timeout: 3) {
            if !element("loginEmailField").exists { try press(element("placeLaunchSignIn")) }
            try press(element("loginEmailField"))
            element("loginEmailField").typeText("entry-ui@example.invalid")
            try press(element("loginPasswordField"))
            element("loginPasswordField").typeText("synthetic-loopback-only")
            try press(element("loginSubmitButton"))
            XCTAssertTrue(element("tab.place").waitForExistence(timeout: 30))
        }
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 3) else { break }
            let passwordDismiss = app.buttons.matching(NSPredicate(format: "label == %@ AND identifier == %@", "Not Now", "")).firstMatch
            let topmost = passwordDismiss.exists ? passwordDismiss : app.buttons["appLockSetupPromptDismiss"].firstMatch
            let frame = topmost.frame
            XCTAssertFalse(frame.isEmpty)
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        }
        if !element("hubAvatarButton").waitForExistence(timeout: 2) { try press(element("place.back")) }
        try press(element("hubAvatarButton"))
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "My homes")).firstMatch)
    }

    private func homeRow(_ state: [String: Any], unit: String) throws -> [String: Any] {
        let database = try XCTUnwrap(state["database"] as? [String: Any])
        let homes = try XCTUnwrap(database["homes"] as? [[String: Any]])
        let matching = homes.filter { $0["unit"] as? String == unit }
        XCTAssertEqual(matching.count, 1)
        return try XCTUnwrap(matching.first)
    }

    private func awaitState(_ key: String) async throws {
        for _ in 0..<60 {
            if try await fixture("state")[key] as? Bool == true { return }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("Expected held production request")
        throw JourneyError.unavailable
    }

    private func fill(_ field: String, _ value: String) throws {
        let control = element("addHome_" + field)
        try press(control)
        control.typeText(value)
        try press(app.buttons["addHomeKeyboardDone"])
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func label(_ text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func reveal(_ control: XCUIElement) throws {
        _ = control.waitForExistence(timeout: 20)
        for _ in 0..<10 {
            if control.exists, control.isHittable { return }
            if control.exists, control.frame.midY < app.frame.midY { app.swipeDown() } else { app.swipeUp() }
        }
        XCTFail("Missing reachable Home creation control")
        throw JourneyError.unavailable
    }

    private func press(_ control: XCUIElement) throws {
        // iOS may offer to retain an entered network/code in Passwords when
        // the secure field leaves the hierarchy. Decline only that observed
        // system sheet; do not bypass app confirmation or account prompts.
        let passwordSheet = app.sheets["Save Password?"]
        if passwordSheet.exists {
            let decline = passwordSheet.buttons["Not Now"]
            XCTAssertTrue(decline.isHittable)
            decline.tap()
        }
        try reveal(control)
        XCTAssertTrue(control.isEnabled)
        control.tap()
    }

    private enum JourneyError: Error { case unavailable }
    private func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func fixture(_ action: String, method: String = "GET", body: [String: Any]? = nil) async throws -> [String: Any] {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        request.httpMethod = method
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}

/// Private first use shares the installed journey helpers and remains separately opt-in.
extension HomeResidencyRecoveryJourneyUITests {
    func testPrivateFirstUseKeepsSelectedHomeBeforeMail() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_PRIVATE_FIRST_USE_UI"] == "1")
        let homeId = "ddc24100-0000-4000-8000-000000000606"
        try openMyHomes()
        try press(element("myHomes.row_" + homeId + ".verification"))
        try reveal(label("Request residency review"))
        XCTAssertFalse(app.buttons["Review mail verification"].exists)
        XCTAssertFalse(app.buttons["Open Home"].exists)
        keepScreen("Private Home offers ordinary residency before mail")
        _ = try await fixture("residency-read-fault", method: "POST", body: ["kind": "error", "persistent": true])
        try press(element("homeResidencyRefresh"))
        try reveal(element("homeResidencyError"))
        _ = try await fixture("residency-read-fault", method: "POST", body: ["kind": "clear"])
        try press(element("homeResidencyRetry"))
        try reveal(label("Request residency review"))
        try press(app.buttons["Check address and request residency"])
        try reveal(label("Find your home"))
        try press(app.buttons["Add address manually"])
        for (field, value) in [("street", street), ("unit", "603"), ("city", "Test"), ("state", "WA"), ("zip", "98607")] {
            try fill(field, value)
        }
        for unit in ["603", "799"] {
            if unit == "799" {
                try press(element("wizardLeadingButton"))
                try replaceUnit(unit)
            }
            try press(element("wizardPrimaryCTA"))
            try reveal(label("This address does not match the Home you opened."))
            XCTAssertFalse(element("addHomeClaimedCorrect").exists)
            let state = try await fixture("state")
            let database = try XCTUnwrap(state["database"] as? [String: Any])
            XCTAssertEqual((database["commands"] as? [Any])?.count, 0)
            XCTAssertEqual((database["submissions"] as? [Any])?.count, 0)
            keepScreen("Different apartment cannot continue selected Home")
        }
        try press(element("wizardLeadingButton"))
        try replaceUnit("606")
        try press(element("wizardPrimaryCTA"))
        if element("addHomeClaimedCorrect").waitForExistence(timeout: 8) {
            try press(element("addHomeClaimedCorrect"))
            try press(element("addHomeClaimedConfirmAddress"))
        } else {
            try reveal(label("Address recognized"))
            try press(element("wizardPrimaryCTA"))
        }
        try press(element("addHome_role_tenant"))
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Review and submit"))
        _ = try await fixture("mode", method: "POST", body: ["mode": "residency_lost_reply"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Recover your residency request"))
        keepScreen("Lost reply retains private Home request")
        app.terminate()
        try openMyHomes()
        try press(element("myHomes.row_" + homeId + ".continue"))
        try reveal(label("Address verification is required"))
        XCTAssertTrue(app.buttons["Review mail verification"].exists)
        XCTAssertFalse(app.buttons["Open Home"].exists)
        try press(app.navigationBars["Residency status"].buttons.firstMatch)
        try press(app.buttons["Add a home"].firstMatch)
        try reveal(label("Residency request saved"))
        try press(element("wizardPrimaryCTA"))
        let final = try await fixture("state")
        let home = try homeRow(final, unit: "606")
        XCTAssertEqual(home["occupancies"] as? Int, 1)
        XCTAssertEqual(home["verified_occupancies"] as? Int, 0)
        XCTAssertEqual((home["claims"] as? [Any])?.count, 1)
        let events = try XCTUnwrap(final["events"] as? [[String: Any]])
        XCTAssertEqual(
            events
                .filter { $0["method"] as? String == "POST" && $0["path"] as? String == "/api/homes/" + homeId + "/residency-submissions" }
                .count,
            1
        )
        XCTAssertFalse(events.contains { ($0["path"] as? String)?.contains("postcard") == true })
        keepScreen("One saved request with mail remaining separate")
    }

    private func replaceUnit(_ value: String) throws {
        let control = element("addHome_unit")
        try press(control)
        let previous = control.value as? String ?? ""
        control.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count) + value)
        try press(app.buttons["addHomeKeyboardDone"])
    }
}
