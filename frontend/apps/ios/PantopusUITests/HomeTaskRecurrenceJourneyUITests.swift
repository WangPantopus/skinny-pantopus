import XCTest

/// Installed app and real protected recovery with loopback-only synthetic HTTP.
/// The production worker/calendar rules have separate real database acceptance.
@MainActor
final class HomeTaskRecurrenceJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18083"
    private let home = "53000000-0000-4000-8000-000000000001"
    private let taskId = "53000000-0000-4000-8000-000000000003"

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = true
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_RECURRENCE_UI"] == "1", "Requires isolated recurrence fixture")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_RECURRENCE_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            keepScreenshot("Recurrence journey final screen")
            if (testRun?.failureCount ?? 0) > 0 {
                let tree = XCTAttachment(string: app.debugDescription)
                tree.name = "Recurrence journey hierarchy"
                tree.lifetime = .keepAlways
                add(tree)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testExplicitStartColdRecoveryLaterPauseAndRevokedAccess() async throws {
        app.launch()
        try await signIn()
        try openSchedule()
        try press(element("homeTaskRecurrence.timezone"))
        let losAngeles = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Los Angeles")).firstMatch
        try press(losAngeles)
        try press(element("homeTaskRecurrence.start"))
        try require(element("homeTaskRecurrence.retry").waitForExistence(timeout: 20))
        let original = try await fixture("state")
        XCTAssertEqual(original.count("recurrence_committed"), 1)
        XCTAssertEqual(original.commands?.first?.timezone, "America/Los_Angeles")
        let originalId = try XCTUnwrap(original.commands?.first?.requestId)
        _ = try await fixture("pause-elsewhere", method: "POST")

        app.terminate()
        app.launch()
        try await signIn()
        try openSchedule()
        try require(app.staticTexts["Repeats are paused."].waitForExistence(timeout: 20))
        try press(element("homeTaskRecurrence.retry"))
        try require(element("homeTaskRecurrence.acknowledge").waitForExistence(timeout: 20))
        let recovered = try await fixture("state")
        XCTAssertEqual(recovered.recurrence?.configuration?.state, "paused")
        XCTAssertEqual(recovered.count("recurrence_replayed"), 1)
        let replay = recovered.events?.last { $0.event == "recurrence_replayed" }
        XCTAssertEqual(replay?.requestId, originalId)
        keepScreenshot("Old start confirmed while current schedule stays paused")

        // Confirmed proof also survives process death until explicit review.
        app.terminate()
        app.launch()
        try await signIn()
        try openSchedule()
        try press(element("homeTaskRecurrence.acknowledge"))
        try press(element("homeTaskRecurrence.start"))
        try press(element("homeTaskRecurrence.acknowledge"))
        try require(element("homeTaskRecurrence.pause").waitForExistence(timeout: 20))
        keepScreenshot("Active automatic schedule and pause control")
        _ = try await fixture("fail-next-reply", method: "POST")
        try press(element("homeTaskRecurrence.pause"))
        try require(element("homeTaskRecurrence.retry").waitForExistence(timeout: 20))
        XCUIDevice.shared.press(.home)
        app.activate()
        try press(element("homeTaskRecurrence.retry"))
        try press(element("homeTaskRecurrence.acknowledge"))
        try require(app.staticTexts["Repeats are paused."].waitForExistence(timeout: 20))

        _ = try await fixture("revoke", method: "POST")
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeTaskRecurrence.error").waitForExistence(timeout: 20))
        let hidden = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: element("homeTaskRecurrence.start")
        )
        try await require(XCTWaiter.fulfillment(of: [hidden], timeout: 20) == .completed)
        keepScreenshot("Current denial hides native recurrence controls")
        _ = try await fixture("restore", method: "POST")
        try press(element("homeTaskRecurrence.reload"))
        try require(app.staticTexts["Repeats are paused."].waitForExistence(timeout: 20))
        let final = try await fixture("state")
        XCTAssertEqual(final.count("recurrence_committed"), 4)
        XCTAssertEqual(final.count("recurrence_replayed"), 2)
        XCTAssertEqual(final.count("recurrence_reply_lost"), 2)
        XCTAssertEqual(final.count("fixture_rejected"), 0)
        XCTAssertEqual(final.recurrence?.revision, 4)
        XCTAssertEqual(final.recurrence?.configuration?.state, "paused")
        let proof = try XCTAttachment(data: JSONEncoder().encode(final), uniformTypeIdentifier: "public.json")
        proof.name = "Native recurrence exact command evidence"
        proof.lifetime = .keepAlways
        add(proof)
    }

    private func openSchedule() throws {
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/\(home)/tasks/\(taskId)")))
        try require(app.staticTexts["Recurring copper task"].firstMatch.waitForExistence(timeout: 30))
        try press(element("householdTaskDetail.recurrence"))
        try require(element("homeTaskRecurrence.status").waitForExistence(timeout: 20))
    }

    private func signIn() async throws {
        if element("tab.place").waitForExistence(timeout: 3) { return }
        try press(element("placeLaunchSignIn"))
        let email = element("loginEmailField"), password = element("loginPasswordField")
        try press(email)
        email.typeText("bp-task-ui@example.com")
        try press(password)
        password.typeText("synthetic-loopback-only")
        try press(element("loginSubmitButton"))
        for index in 0..<4 {
            let later = app.buttons["Not Now"].firstMatch
            guard later.waitForExistence(timeout: index == 0 ? 10 : 3) else { break }
            later.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        let signedIn = XCTNSPredicateExpectation(predicate: NSPredicate { [self] _, _ in
            element("tab.place").exists && !element("loginSubmitButton").exists
        }, object: app)
        try await require(XCTWaiter.fulfillment(of: [signedIn], timeout: 30) == .completed)
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func press(_ control: XCUIElement) throws {
        try require(control.waitForExistence(timeout: 20), "Missing required control")
        for _ in 0..<8 where !control.isHittable {
            app.swipeUp()
        }
        try require(control.isHittable && control.isEnabled, "Control unavailable")
        control.tap()
    }

    private func require(
        _ condition: Bool,
        _ message: String = "Required state unavailable",
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        guard condition else {
            XCTFail(message, file: file, line: line)
            throw JourneyStopped.requiredState
        }
    }

    private enum JourneyStopped: Error { case requiredState }

    private func keepScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func fixture(_ action: String, method: String = "GET") async throws -> RecurrenceUIEvidence {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        request.httpMethod = method
        let (data, response) = try await URLSession.shared.data(for: request)
        try require((response as? HTTPURLResponse)?.statusCode == 200)
        return try JSONDecoder().decode(RecurrenceUIEvidence.self, from: data)
    }
}

private struct RecurrenceUIEvidence: Codable {
    struct Event: Codable {
        let event: String
        let requestId: String?
        private enum CodingKeys: String, CodingKey { case event, requestId = "request_id" }
    }

    struct Command: Codable {
        let requestId: String
        let timezone: String?
        private enum CodingKeys: String, CodingKey { case requestId = "request_id", timezone }
    }

    struct State: Codable {
        struct Configuration: Codable { let state: String }
        let revision: Int
        let configuration: Configuration?
    }

    let events: [Event]?
    let recurrence: State?
    let commands: [Command]?
    func count(_ name: String) -> Int {
        events?.filter { $0.event == name }.count ?? 0
    }
}
