import XCTest

/// Installed UI through production address routes and actual local SDK/SQL.
@MainActor
final class HomeAddressEntryJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18083"
    private let street = "9131 Address Entry Fixture Way"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_ADDRESS_ENTRY_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_ADDRESS_ENTRY_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final address entry state")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Address entry hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                attachment.name = "Production address HTTP SDK SQL evidence"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testManualCanonicalCorrectionRefusalRecoveryAndHeldValidationRetirement() async throws {
        try openFreshWizard()
        XCTAssertFalse(label("412 Elm St").exists)
        try press(app.buttons["Add address manually"])
        for (field, value) in [("street", street), ("city", "Test"), ("state", "WA"), ("zip", "98606")] {
            try fill(field, value)
        }
        keepScreen("Manual actual address entry")
        _ = try await fixture("mode", method: "POST", body: ["mode": "provider_outage"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Address verification is unavailable"))
        XCTAssertFalse(element("wizardPrimaryCTA").isEnabled)
        keepScreen("Unavailable validation stays retryable")
        _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
        try press(app.buttons["Try again"])
        try press(app.buttons["Apply ZIP correction to 98607"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("What's your role?"))
        keepScreen("Canonical address reaches role")
        try press(element("wizardLeadingButton"))
        try press(element("wizardLeadingButton"))
        for mode in ["missing_unit", "malformed_validation", "lookup_error"] {
            _ = try await fixture("mode", method: "POST", body: ["mode": mode])
            try press(element("wizardPrimaryCTA"))
            try reveal(app.buttons["Try again"])
            XCTAssertFalse(element("wizardPrimaryCTA").isEnabled)
            keepScreen(mode + " prevents continuation")
            _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
            try press(app.buttons["Try again"])
            try reveal(label("Address recognized"))
            try press(element("wizardPrimaryCTA"))
            try reveal(label("What's your role?"))
            try press(element("wizardLeadingButton"))
            try press(element("wizardLeadingButton"))
        }
        _ = try await fixture("hold", method: "POST", body: ["suffix": "/validate"])
        try press(element("wizardPrimaryCTA"))
        var held = false
        for _ in 0..<40 {
            if try await fixture("state")["held"] as? Bool == true { held = true
                break
            }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTAssertTrue(held)
        XCUIDevice.shared.press(.home)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 10))
        _ = try await fixture("release", method: "POST")
        app.activate()
        try reveal(label("Find your home"))
        XCTAssertFalse(label("Address recognized").exists)
        keepScreen("Background retires produced validation")
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Address recognized"))
        keepScreen("Foreground revalidation recovers")
        let finalState = try await fixture("state")
        let events = try XCTUnwrap(finalState["events"] as? [[String: Any]])
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
        XCTAssertFalse(events.contains { $0["path"] as? String == "/api/homes" && $0["method"] as? String == "POST" })
    }

    func testSearchOutageRecoveryAndPartialDraftDiscard() async throws {
        try openFreshWizard()
        try press(app.buttons["Add address manually"])
        try fill("city", "Test")
        try press(app.buttons["Close"])
        try press(app.buttons["Keep going"])
        XCTAssertEqual(element("addHome_city").value as? String, "Test")
        keepScreen("Partial manual draft survives Keep going")
        try press(app.buttons["Close"])
        try press(app.buttons["Discard"])
        try press(app.buttons["Add a home"].firstMatch)
        try reveal(label("Find your home"))
        XCTAssertFalse(element("addHome_city").exists)
        keepScreen("Discard does not restore partial address")
        _ = try await fixture("mode", method: "POST", body: ["mode": "search_error"])
        try press(element("addHomeSearchInput"))
        element("addHomeSearchInput").typeText("9131")
        try press(app.buttons["addHomeKeyboardDone"])
        try reveal(label("Address search is unavailable"))
        keepScreen("Real search outage has retry and manual fallback")
        _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
        try press(app.buttons["Try search again"])
        try press(element("addHome_searchResult_entry-fixture"))
        try reveal(element("addHome_street"))
        XCTAssertEqual(element("addHome_street").value as? String, street)
        XCTAssertEqual(element("addHome_city").value as? String, "Test")
        XCTAssertTrue(element("wizardPrimaryCTA").isEnabled)
        keepScreen("Resolved address is editable before validation")
        _ = try await fixture("mode", method: "POST", body: ["mode": "missing_unit"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Enter your unit"))
        try press(app.buttons["Edit address"])
        try fill("unit", "3B")
        _ = try await fixture("mode", method: "POST", body: ["mode": "current"])
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Address recognized"))
        XCTAssertTrue(element("wizardPrimaryCTA").isEnabled)
        keepScreen("Edited unit is validated before continuing")
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        XCTAssertTrue(events.contains { $0["event"] as? String == "google_boundary" && $0["unit"] as? String == "3B" })
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
    }

    func testDeviceLocationDenialSettingsRecoveryAndRevocation() async throws {
        try openFreshWizard()
        let initial = try await reverseCount()
        try press(element("addHome_useCurrentLocation"))
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let deny = springboard.buttons.matching(NSPredicate(format: "label MATCHES %@", "Don.t Allow")).firstMatch
        XCTAssertTrue(deny.waitForExistence(timeout: 10))
        deny.tap()
        try reveal(app.buttons["addHomeLocationSettings"])
        let deniedCount = try await reverseCount()
        XCTAssertEqual(deniedCount, initial)
        keepScreen("Denied location offers Settings and manual entry")
        try press(app.buttons["addHomeLocationSettings"])
        let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
        defer {
            let hierarchy = XCTAttachment(string: settings.debugDescription)
            hierarchy.name = "Actual location Settings hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
        XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 10))
        try openLocationSettings(settings)
        try pressSettings(settings, label: "While Using the App")
        app.activate()
        try press(element("addHome_useCurrentLocation"))
        try reveal(element("addHome_street"))
        XCTAssertEqual(element("addHome_street").value as? String, street)
        XCTAssertFalse(label("Address recognized").exists)
        let recoveredCount = try await reverseCount()
        XCTAssertGreaterThan(recoveredCount, initial)
        let locatedState = try await fixture("state")
        let locatedEvents = try XCTUnwrap(locatedState["events"] as? [[String: Any]])
        XCTAssertTrue(locatedEvents.contains {
            $0["event"] as? String == "reverse_boundary"
                && abs(($0["latitude"] as? Double ?? 0) - 45.6) < 0.01
                && abs(($0["longitude"] as? Double ?? 0) + 122.4) < 0.01
        })
        keepScreen("Device coordinate resolves editable address before canonical validation")
        // Revoke through the same real Settings page while a recent coordinate exists.
        settings.activate()
        try pressSettings(settings, label: "Never")
        app.activate()
        try press(element("addHome_useCurrentLocation"))
        try reveal(app.buttons["addHomeLocationSettings"])
        let revokedCount = try await reverseCount()
        XCTAssertEqual(revokedCount, recoveredCount)
        keepScreen("Revoked location cannot reuse the previous coordinate")
        try press(element("wizardPrimaryCTA"))
        try reveal(label("Address recognized"))
        keepScreen("Manual address remains usable after location revocation")
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        XCTAssertFalse(events.contains { $0["event"] as? String == "fixture_error" })
        XCTAssertFalse(events.contains { $0["path"] as? String == "/api/homes" && $0["method"] as? String == "POST" })
    }

    private func openLocationSettings(_ settings: XCUIApplication) throws {
        let location = settings.staticTexts["Location"].firstMatch
        if !location.waitForExistence(timeout: 3) {
            // Some simulator Settings cold starts open the root page. Exercise
            // the navigation explained by the app's recovery guidance too.
            try pressSettings(settings, label: "Apps")
            try pressSettings(settings, label: "Pantopus")
        }
        try pressSettings(settings, label: "Location")
    }

    private func pressSettings(_ settings: XCUIApplication, label: String) throws {
        let control = settings.staticTexts[label].firstMatch
        _ = control.waitForExistence(timeout: 3)
        for _ in 0..<12 {
            if control.exists, control.isHittable { control.tap()
                return
            }
            settings.swipeUp()
        }
        XCTFail("Missing real Settings control: " + label)
        throw JourneyError.unavailable
    }

    private func reverseCount() async throws -> Int {
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        return events.filter { $0["event"] as? String == "reverse_boundary" }.count
    }

    private func openFreshWizard() throws {
        try openWizard()
        // Reset only the synthetic account's prior interrupted draft through UI.
        try press(app.buttons["Close"])
        if app.buttons["Discard"].waitForExistence(timeout: 2) { try press(app.buttons["Discard"]) }
        try press(app.buttons["Add a home"].firstMatch)
        try reveal(label("Find your home"))
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
            let passwordDismiss = app.buttons.matching(NSPredicate(
                format: "label == %@ AND identifier == %@", "Not Now", ""
            )).firstMatch
            let topmost = passwordDismiss.exists ? passwordDismiss : app.buttons["appLockSetupPromptDismiss"].firstMatch
            // The password extension reports non-hittable while covering
            // the Face ID offer. Use this current remote button's own frame.
            let frame = topmost.frame
            XCTAssertFalse(frame.isEmpty)
            app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: frame.midX, dy: frame.midY))
                .tap()
        }
        if !element("hubAvatarButton").waitForExistence(timeout: 2) { try press(element("place.back")) }
        try press(element("hubAvatarButton"))
        try press(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "My homes")).firstMatch)
        try press(app.buttons["Add a home"].firstMatch)
        try reveal(label("Find your home"))
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
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func reveal(_ control: XCUIElement) throws {
        _ = control.waitForExistence(timeout: 20)
        for _ in 0..<10 {
            if control.exists, control.isHittable { return }
            if control.exists, control.frame.midY < app.frame.midY { app.swipeDown() } else { app.swipeUp() }
        }
        XCTFail("Missing reachable address entry control")
        throw JourneyError.unavailable
    }

    private func press(_ control: XCUIElement) throws {
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
        if let body { request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
