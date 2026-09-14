import XCTest

/// Explicit opt-in against owned loopback HTTP and production SDK/SQL.
@MainActor
final class HomeCreationRecoveryJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private let street = "9141 Home Creation Fixture Way"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_CREATION_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_CREATION_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final Home creation state")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Private Home creation hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                let proof = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                proof.name = "Production Home creation HTTP SDK SQL evidence"
                proof.lifetime = .keepAlways
                add(proof)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testCommittedHomeSurvivesLostReplyAndAppRestart() async throws {
        let initialState = try await fixture("state")
        let initialCount = (initialState["events"] as? [[String: Any]])?.count ?? 0
        try openWizard()
        try completeForm(unit: "301")
        _ = try await fixture("hold", method: "POST", body: ["suffix": "/api/homes"])
        try press(element("wizardPrimaryCTA"))
        try await awaitState("held")
        let before = try await fixture("state")
        let home = try homeRow(before, unit: "301")
        XCTAssertEqual(home["secrets"] as? Int, 1)
        XCTAssertEqual(home["occupancies"] as? Int, 1)
        XCTAssertEqual(home["pending_owners"] as? Int, 1)
        XCTAssertEqual(home["preferences"] as? Int, 1)
        XCTAssertEqual(home["verified_occupancies"] as? Int, 0)
        XCTAssertTrue(home["owner_id"] is NSNull)
        keepScreen("Original save awaits lost HTTP reply")
        app.terminate()
        _ = try await fixture("release", method: "POST")
        try openWizard()
        try reveal(app.staticTexts["Home saved"])
        XCTAssertFalse(element("addHome_street").exists)
        XCTAssertFalse(element("addHome_accessSecret").exists)
        keepScreen("Restart recovers completed original setup")
        try press(element("wizardPrimaryCTA"))
        try requirePrivateHome(home)
        keepScreen("Fresh My Homes shows its unit and private setup without verified membership")
        let final = try await fixture("state")
        let finalHome = try homeRow(final, unit: "301")
        XCTAssertEqual(home["id"] as? String, finalHome["id"] as? String)
        let events = try XCTUnwrap(final["events"] as? [[String: Any]])
        let posts = events.dropFirst(initialCount).filter { $0["path"] as? String == "/api/homes" && $0["method"] as? String == "POST" }
        XCTAssertEqual(posts.count, 1, "Status recovery must not mint another command")
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
    }

    func testCancelledDelayedRequestCannotCreateAndCanReturnToEditing() async throws {
        try openWizard()
        try completeForm(unit: "302")
        _ = try await fixture("mode", method: "POST", body: ["mode": "hold_provider"])
        try press(element("wizardPrimaryCTA"))
        try await awaitState("held_provider")
        app.terminate()
        try openWizard()
        try reveal(app.staticTexts["Finish adding your Home"])
        try press(element("addHomeRecoveryCancel"))
        try press(element("addHomeRecoveryCancelConfirm"))
        try reveal(app.staticTexts["Request cancelled"])
        _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
        _ = try await fixture("release-provider", method: "POST")
        keepScreen("Cancellation wins before delayed creation")
        try press(element("wizardPrimaryCTA"))
        try reveal(element("addHome_unit"))
        XCTAssertEqual(element("addHome_unit").value as? String, "302")
        let state = try await fixture("state")
        let database = try XCTUnwrap(state["database"] as? [String: Any])
        let homes = try XCTUnwrap(database["homes"] as? [[String: Any]])
        XCTAssertFalse(homes.contains { $0["unit"] as? String == "302" })
        let commands = try XCTUnwrap(database["commands"] as? [[String: Any]])
        XCTAssertTrue(commands.contains { $0["state"] as? String == "cancelled" })
        try press(element("wizardLeadingButton"))
        try press(app.buttons["Discard"])
    }

    func testOptionalSetupRefusalRollsBackThenAllowsCorrectedRequest() async throws {
        try openWizard()
        try completeForm(unit: "303", role: "householdMember")
        _ = try await fixture("reject-next-access", method: "POST")
        try press(element("wizardPrimaryCTA"))
        try reveal(app.staticTexts["Review your Home details"])
        let state = try await fixture("state")
        let database = try XCTUnwrap(state["database"] as? [String: Any])
        let homes = try XCTUnwrap(database["homes"] as? [[String: Any]])
        XCTAssertFalse(homes.contains { $0["unit"] as? String == "303" }, "Optional setup cannot leave a partial Home")
        keepScreen("Atomic optional setup refusal leaves no Home")
        _ = try await fixture("restore-age", method: "POST")
        try press(element("wizardPrimaryCTA"))
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Address recognized"))
        try press(element("wizardPrimaryCTA"))
        try reveal(element("addHome_accessLabel"))
        XCTAssertEqual(element("addHome_accessLabel").value as? String, "Fixture network")
        try press(element("wizardPrimaryCTA"))
        try press(element("wizardPrimaryCTA"))
        try reveal(app.staticTexts["Home saved"])
        keepScreen("Corrected request commits Home and original optional setup")
        let final = try await fixture("state")
        let home = try homeRow(final, unit: "303")
        XCTAssertEqual(home["secrets"] as? Int, 1)
        try press(element("wizardPrimaryCTA"))
        try requirePrivateHome(home)
    }

    private func completeForm(unit: String, role: String = "owner") throws {
        try reveal(label("Find your home"))
        try press(app.buttons["Add address manually"])
        for (field, value) in [("street", street), ("unit", unit), ("city", "Test"), ("state", "WA"), ("zip", "98607")] {
            try fill(field, value)
        }
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Address recognized"))
        try press(element("wizardPrimaryCTA"))
        try press(element("addHome_role_" + role))
        try fill("accessLabel", "Fixture network")
        if unit == "302" {
            try press(element("wizardPrimaryCTA"))
            try reveal(label("Password/code is required"))
            XCTAssertFalse(app.staticTexts["Review and submit"].exists)
            keepScreen("Incomplete optional setup is corrected before review")
        }
        try fill("accessSecret", "synthetic-loopback-access")
        try press(element("wizardPrimaryCTA"))
        keepScreen("Review original Home and optional setup")
    }

    private func openWizard() throws {
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
        try press(app.buttons["Add a home"].firstMatch)
    }

    private func homeRow(_ state: [String: Any], unit: String) throws -> [String: Any] {
        let database = try XCTUnwrap(state["database"] as? [String: Any])
        let homes = try XCTUnwrap(database["homes"] as? [[String: Any]])
        let matching = homes.filter { $0["unit"] as? String == unit }
        XCTAssertEqual(matching.count, 1)
        return try XCTUnwrap(matching.first)
    }

    private func requirePrivateHome(_ home: [String: Any]) throws {
        XCTAssertTrue(element("myHomesList").waitForExistence(timeout: 20))
        let id = try XCTUnwrap(home["id"] as? String)
        let destination = app.buttons["myHomes.row_" + id + ".continue"]
        try reveal(destination)
        XCTAssertEqual(destination.label, "My tasks")
        let unit = try XCTUnwrap(home["unit"] as? String)
        XCTAssertTrue(label("Unit " + unit).exists)
        XCTAssertTrue(label("Private setup").exists)
        XCTAssertFalse(label("Residency verified").exists)
        XCTAssertFalse(label("Ownership verified").exists)
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

    private func fixture(_ action: String, method: String = "GET", body: [String: String]? = nil) async throws -> [String: Any] {
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
