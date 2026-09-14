import XCTest

/// Opt-in installed native acceptance against production local HTTP/SDK/SQL.
@MainActor
final class HomePostalRecoveryJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private let home = "ddc23600-0000-4000-8000-000000000100"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_POSTAL_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_POSTAL_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final native postal state")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Private native postal hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                let proof = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                proof.name = "Native postal HTTP SDK SQL evidence"
                proof.lifetime = .keepAlways
                add(proof)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testOriginalMailAndCodeRecoveryThenCurrentAccessRemoval() async throws {
        try signIn()
        try openPostal()
        if ProcessInfo.processInfo.environment["HOME_POSTAL_UI_RESUME"] == "mailing_recovery" {
            try await continueOriginalMailingAfterUnavailableKeys()
        } else {
            try await failedStatusAndChangedAddress()
            try await cancellationBeforeAdmission()
            try await mailingRecovery()
        }
        try await cancelCodeBeforeAdmission()
        try await codeRecovery()
        try await retireOldApproval()
    }

    private func failedStatusAndChangedAddress() async throws {
        try require(element("homePostalRequestMail"))
        _ = try await fixture("fault", body: ["name": "get_home_postcard_current_status", "kind": "before", "persistent": true])
        try press("homePostalRefresh")
        try require(element("homePostalError"))
        XCTAssertFalse(element("homePostalRequestMail").exists)
        XCTAssertFalse(element("homePostalLine1").exists)
        keepScreen("Unavailable status hides mail actions and permits retry")
        _ = try await fixture("fault", body: ["name": "get_home_postcard_current_status", "kind": "clear"])
        try press("homePostalRetry")
        try fillAddress()
        try press("homePostalRequestMail")
        _ = try await fixture("unit", body: ["unit": "603"])
        try press("homePostalConfirmMail")
        try require(label("Review the recorded result"))
        let state = try await fixture("state")
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.count, 0)
        XCTAssertEqual(state["provider_calls"] as? Int, 0)
        try require(label("The Home address changed"))
        keepScreen("Changed apartment refuses mailing to the selected original")
        try press("homePostalAcknowledge")
        _ = try await fixture("unit", body: ["unit": "602"])
    }

    private func cancellationBeforeAdmission() async throws {
        try fillAddress()
        _ = try await fixture("native-hold", body: ["suffix": "/postcard-requests"])
        try confirmMail()
        try await awaitFlag("held_admission", action: "native-state")
        app.terminate()
        try openPostal()
        try press("homePostalCancel")
        try press("homePostalConfirmCancel")
        try require(label("Original request cancelled"))
        _ = try await fixture("native-release", body: [:])
        try await awaitCancelledWorker("begin_home_postcard_request")
        let state = try await fixture("state")
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.count, 0)
        XCTAssertEqual(state["provider_calls"] as? Int, 0)
        keepScreen("Cancellation fences the delayed original mailing")
        try press("homePostalAcknowledge")
    }

    private func mailingRecovery() async throws {
        _ = try await fixture("keys", body: ["enabled": false])
        try fillAddress()
        try confirmMail()
        try require(label("Recover your original request"))
        try await continueOriginalMailingAfterUnavailableKeys()
    }

    private func continueOriginalMailingAfterUnavailableKeys() async throws {
        try require(label("Recover your original request"))
        var state = try await fixture("state")
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.count, 0)
        XCTAssertEqual(state["provider_calls"] as? Int, 0)
        let path = "/api/homes/\(home)/postcard-requests"
        let events = state["events"] as? [[String: Any]] ?? []
        let lastRequest = events.last { $0["event"] as? String == "native_request" && $0["path"] as? String == path }
        let original = try XCTUnwrap(lastRequest?["request_id"] as? String)
        keepScreen("Unavailable initial keys retain the original without a postcard")
        _ = try await fixture("keys", body: ["enabled": true])
        _ = try await fixture("fault", body: ["name": "begin_home_postcard_request", "kind": "lost"])
        try press("homePostalRetryOriginal")
        try require(label("Recover your original request"))
        state = try await awaitDatabase {
            ($0["requests"] as? [[String: Any]])?
                .contains { $0["request_id"] as? String == original && $0["state"] as? String == "completed" } == true
        }
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual(state["provider_calls"] as? Int, 0)
        let admitted = (state["requests"] as? [[String: Any]])?.filter { $0["request_id"] as? String == original }
        XCTAssertEqual(admitted?.count, 1)
        XCTAssertEqual(admitted?.first?["state"] as? String, "completed")
        app.terminate()
        try openPostal()
        try require(label("Mailing request recorded"))
        try press("homePostalAcknowledge")
        try require(element("homePostalResume"))
        XCTAssertFalse(element("homePostalRequestMail").exists)
        _ = try await fixture("keys", body: ["enabled": false])
        try press("homePostalResume")
        try require(label("Mailing request recorded"))
        try press("homePostalAcknowledge")
        try require(element("homePostalResume"))
        state = try await fixture("state")
        XCTAssertEqual(state["provider_calls"] as? Int, 0)
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.count, 1)
        keepScreen("Missing mail keys retain only the original request")
        _ = try await fixture("keys", body: ["enabled": true])
        _ = try await fixture("delivery", body: ["state": "unknown"])
        try press("homePostalResume")
        try require(label("Mailing request recorded"))
        try press("homePostalAcknowledge")
        try require(label("Mailing outcome is unknown"))
        XCTAssertFalse(element("homePostalRequestMail").exists)
        XCTAssertFalse(element("homePostalResume").exists)
        state = try await fixture("state")
        XCTAssertEqual(state["provider_calls"] as? Int, 1)
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.count, 1)
        keepScreen("Unknown delivery exposes code entry without resending mail")
    }

    private func cancelCodeBeforeAdmission() async throws {
        _ = try await fixture("native-hold", body: ["suffix": "/verifications"])
        try enter("111111", into: "homePostalCode")
        try press("homePostalVerifyCode")
        try await awaitFlag("held_admission", action: "native-state")
        app.terminate()
        try openPostal()
        try press("homePostalCancel")
        try press("homePostalConfirmCancel")
        try require(label("Original request cancelled"))
        _ = try await fixture("native-release", body: [:])
        try await awaitCancelledWorker("verify_home_postcard_current")
        let state = try await fixture("state")
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.first?["attempts"] as? Int, 0)
        XCTAssertEqual((state["occupancy"] as? [String: Any])?["verification_status"] as? String, "pending_postcard")
        keepScreen("Cancelling a delayed code attempt spends no guess and grants no access")
        try press("homePostalAcknowledge")
    }

    private func awaitCancelledWorker(_ name: String) async throws {
        for _ in 0..<60 {
            let events = try await fixture("state")["events"] as? [[String: Any]] ?? []
            if events.contains(where: { $0["name"] as? String == name && $0["state"] as? String == "cancelled" }) { return }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("The delayed original worker must observe its recorded cancellation")
        throw JourneyError.unavailable
    }

    private func codeRecovery() async throws {
        let delivered = try await fixture("code")
        let printed = try XCTUnwrap(delivered["code"] as? String)
        _ = try await fixture("fault", body: ["name": "verify_home_postcard_current", "kind": "lost"])
        try enter(printed == "111111" ? "222222" : "111111", into: "homePostalCode")
        try press("homePostalVerifyCode")
        _ = try await awaitDatabase { ($0["cards"] as? [[String: Any]])?.first?["attempts"] as? Int == 1 }
        try require(label("Recover your original request"))
        app.terminate()
        try openPostal()
        try require(label("Review the recorded result"))
        var state = try await fixture("state")
        XCTAssertEqual((state["cards"] as? [[String: Any]])?.first?["attempts"] as? Int, 1)
        keepScreen("Lost wrong-code response consumes exactly one attempt")
        try press("homePostalAcknowledge")
        _ = try await fixture("fault", body: ["name": "verify_home_postcard_current", "kind": "lost"])
        try enter(printed, into: "homePostalCode")
        try press("homePostalVerifyCode")
        _ = try await awaitDatabase { ($0["occupancy"] as? [String: Any])?["verification_status"] as? String == "provisional" }
        try require(label("Recover your original request"))
        app.terminate()
        try openPostal()
        try require(label("Address proof recorded"))
        state = try await fixture("state")
        XCTAssertEqual((state["occupancy"] as? [String: Any])?["verification_status"] as? String, "provisional")
        XCTAssertEqual(state["provider_calls"] as? Int, 1)
        XCTAssertFalse(app.buttons["Open Home"].exists)
        keepScreen("Recovered address proof is separate from household access")
        try press("homePostalAcknowledge")
    }

    private func retireOldApproval() async throws {
        _ = try await fixture("access", body: ["state": "verified"])
        try press("homePostalRefresh")
        try require(app.buttons["Open Home"])
        XCTAssertFalse(element("homePostalAttemptsRemaining").exists)
        _ = try await fixture("hold", body: ["name": "get_home_postcard_current_status"])
        try press("homePostalRefresh")
        try await awaitFlag("held")
        _ = try await fixture("access", body: ["state": "removed"])
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(label("Household access needs review"))
        _ = try await fixture("release", body: [:])
        try require(label("Household access needs review"))
        XCTAssertFalse(app.buttons["Open Home"].exists)
        XCTAssertFalse(element("homePostalVerifyCode").exists)
        XCTAssertFalse(element("homePostalAttemptsRemaining").exists)
        keepScreen("Returning to mail verification retires old approved access")
        let state = try await fixture("state")
        XCTAssertEqual(state["provider_calls"] as? Int, 1)
        XCTAssertEqual((state["verifications"] as? [[String: Any]])?.count, 3)
    }
}

private extension HomePostalRecoveryJourneyUITests {
    func awaitDatabase(_ matches: ([String: Any]) -> Bool) async throws -> [String: Any] {
        for _ in 0..<60 {
            let state = try await fixture("state")
            if matches(state) { return state }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("Expected the original database decision before interrupting its response")
        throw JourneyError.unavailable
    }

    func openPostal() throws {
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/\(home)/verify-postcard")))
        try require(element("homePostalVerification"))
    }

    private func signIn() throws {
        app.launch()
        if element("tab.place").waitForExistence(timeout: 3) { return }
        try require(element("placeLaunchSignIn"))
        try press("placeLaunchSignIn")
        try enter("postal-ui@example.invalid", into: "loginEmailField", dismissKeyboard: false)
        try enter("synthetic-loopback-only", into: "loginPasswordField", dismissKeyboard: false)
        try press("loginSubmitButton")
        try require(element("tab.place"))
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 3) else { break }
            let password = app.buttons.matching(NSPredicate(format: "label == %@ AND identifier == %@", "Not Now", "")).firstMatch
            let target = password.exists ? password : element("appLockSetupPromptDismiss")
            let frame = target.frame
            XCTAssertFalse(frame.isEmpty)
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        }
    }

    private func fillAddress() throws {
        for (field, value) in [
            ("Line1", "Private residency fixture"), ("Line2", "602"), ("City", "Test"),
            ("State", "WA"), ("Zip", "98607"), ("Country", "US")
        ] {
            try enter(value, into: "homePostal" + field)
        }
        keepScreen("Review the complete mailing address including apartment")
    }

    private func confirmMail() throws {
        try press("homePostalRequestMail")
        try press("homePostalConfirmMail")
    }

    private func enter(_ text: String, into id: String, dismissKeyboard: Bool = true) throws {
        let field = element(id)
        try reveal(field)
        field.tap()
        let existing = field.value as? String ?? ""
        let count = existing == field.placeholderValue ? 0 : existing.count
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: count) + text)
        if dismissKeyboard {
            let done = app.keyboards.buttons["Done"]
            try require(done)
            done.tap()
            XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5))
        }
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func label(_ text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func require(_ control: XCUIElement) throws {
        XCTAssertTrue(control.waitForExistence(timeout: 30))
        if !control.exists { throw JourneyError.unavailable }
    }

    private func reveal(_ control: XCUIElement) throws {
        try require(control)
        for _ in 0..<15 {
            if control.isHittable { return }
            if control.frame.midY < app.frame.midY { app.swipeDown() } else { app.swipeUp() }
        }
        XCTFail("Postal control is not reachable")
        throw JourneyError.unavailable
    }

    private func press(_ id: String) throws {
        let control = element(id)
        try reveal(control)
        XCTAssertTrue(control.isEnabled)
        control.tap()
    }

    private func awaitFlag(_ key: String, action: String = "state") async throws {
        for _ in 0..<60 {
            if try await fixture(action)[key] as? Bool == true { return }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("Expected held original request")
        throw JourneyError.unavailable
    }

    private func fixture(_ action: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private enum JourneyError: Error { case unavailable }
}
