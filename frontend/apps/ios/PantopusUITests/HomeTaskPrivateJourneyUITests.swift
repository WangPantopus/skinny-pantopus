import XCTest

/// Installed app acceptance against the loopback-only synthetic HTTP fixture.
/// No API stubs, seeded auth, hosted credentials or provider writes are used.
@MainActor
final class HomeTaskPrivateJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18081"
    private let home = "53000000-0000-4000-8000-000000000001"
    private let task = "53000000-0000-4000-8000-000000000003"
    private let title = "Copper lighthouse task"
    private let fileText = "Exact private task attachment: copper lighthouse."

    override func setUp() async throws {
        try await super.setUp()
        // Explicit throwing guards stop this async journey without aborting the
        // XCTest runner before it can export the failure's screen and evidence.
        continueAfterFailure = true
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_TASK_UI"] == "1", "Requires the isolated loopback fixture")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_TASK_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        _ = try await fixture("reset", method: "POST")
    }

    override func tearDown() async throws {
        if let app {
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = "Synthetic task journey final screen"
            screenshot.lifetime = .keepAlways
            add(screenshot)
            if (testRun?.failureCount ?? 0) > 0 {
                let hierarchy = XCTAttachment(string: app.debugDescription)
                hierarchy.name = "Synthetic task journey hierarchy"
                hierarchy.lifetime = .keepAlways
                add(hierarchy)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testCreateExactTaskAndRecoverPrivateAttachmentThroughSystemPicker() async throws {
        try downloadFixtureFile()
        app.launch()
        try await signIn()
        try app.open(link("dashboard"))
        try require(element("homeDashboard").waitForExistence(timeout: 30))
        try tapButton("Tasks")
        try require(element("householdTasksList").waitForExistence(timeout: 20))
        try tapButton("Add a task")
        if app.buttons["Retry saved request"].firstMatch.waitForExistence(timeout: 3) {
            try tapButton("Retry saved request")
        } else {
            try enter(title, into: "field_title")
            try tapButton("Save")
        }
        // An uncertain save first requires an explicit current-access reload.
        try tapButton("Try again")
        let retry = app.buttons["Retry saved request"].firstMatch
        try require(retry.waitForExistence(timeout: 20), "The interrupted create must retain its original request")
        retry.tap()
        try require(element("householdTaskDetail").waitForExistence(timeout: 30))
        try require(app.staticTexts[title].firstMatch.waitForExistence(timeout: 15))
        let created = try await fixture("state")
        XCTAssertEqual(created.receipt?.taskId, task)
        XCTAssertEqual(created.count("create_committed"), 1)
        XCTAssertEqual(created.count("create_replayed"), 1)
        // A canonical OS link must reopen the actual exact detail, including
        // the normal current-session HTTP checks, without a test-only route.
        try app.open(link("tasks/\(task)"))
        try require(app.staticTexts[title].firstMatch.waitForExistence(timeout: 30))
        try tapButton("Private attachments")
        try tapButton("Choose attachment")
        try chooseDownloadedFixture()
        try tapButton("Save or retry this attachment")
        try require(app.staticTexts["Server error 503. Please try again."].firstMatch.waitForExistence(timeout: 20))
        XCTAssertFalse(element("homeTaskMedia.notice").exists)
        try tapButton("Save or retry this attachment")
        try require(app.staticTexts["Private attachment saved."].firstMatch.waitForExistence(timeout: 30))
        let uploaded = try await fixture("state")
        XCTAssertEqual(uploaded.count("upload_committed"), 1)
        XCTAssertEqual(uploaded.count("upload_replayed"), 1)
        let uploadId = try XCTUnwrap(uploaded.media?.id)
        try tapButton("Open attachment")
        let preview = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", fileText)).firstMatch
        try require(preview.waitForExistence(timeout: 30), "The preview must display the exact downloaded text")
        keepScreenshot("Exact synthetic private attachment preview")
        _ = try await fixture("revoke", method: "POST")
        XCUIDevice.shared.press(.home)
        app.activate()
        let hidden = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: preview)
        let revoked = await XCTWaiter.fulfillment(of: [hidden], timeout: 20)
        try require(revoked == .completed, "Revoked preview remained visible")
        XCTAssertFalse(app.staticTexts["task-attachment-\(uploadId).txt"].exists)
        keepScreenshot("Revoked task attachment content hidden")
        _ = try await fixture("restore", method: "POST")
        try tapButton("Reload attachments")
        try tapButton("Remove attachment")
        let confirm = app.sheets.buttons["Remove attachment"].firstMatch
        try require(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        try require(app.buttons["Retry attachment removal"].firstMatch.waitForExistence(timeout: 20))
        try tapButton("Retry attachment removal")
        try require(app.staticTexts["Attachment removed. Its history remains."].firstMatch.waitForExistence(timeout: 30))
        XCTAssertFalse(app.buttons["Open attachment"].exists)
        let final = try await fixture("state")
        XCTAssertEqual(final.media?.id, uploadId)
        XCTAssertEqual(final.media?.state, "retired")
        XCTAssertEqual(final.media?.available, false)
        XCTAssertEqual(final.count("remove_requested"), 4)
        XCTAssertGreaterThan(final.count("denied_current_task"), 0)
        XCTAssertEqual(final.count("fixture_rejected"), 0)
        let proofData = try JSONEncoder().encode(final)
        let proofText = try XCTUnwrap(String(data: proofData, encoding: .utf8))
        let evidence = XCTAttachment(string: proofText)
        evidence.name = "Synthetic fixture exact-operation evidence"
        evidence.lifetime = .keepAlways
        add(evidence)
    }

    private func downloadFixtureFile() throws {
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        try safari.open(XCTUnwrap(URL(string: origin + "/fixture/file")))
        let download = safari.buttons["Download"].firstMatch
        try require(download.waitForExistence(timeout: 20), "Safari must receive the synthetic file through HTTP")
        download.tap()
    }

    private func chooseDownloadedFixture() throws {
        let predicate = NSPredicate(format: "label CONTAINS %@", "home-task-acceptance")
        var file = app.descendants(matching: .any).matching(predicate).firstMatch
        if !file.waitForExistence(timeout: 5) {
            let browse = app.buttons["Browse"].firstMatch
            if browse.waitForExistence(timeout: 5) { browse.tap() }
            let downloads = app.staticTexts["Downloads"].firstMatch
            if downloads.waitForExistence(timeout: 5) { downloads.tap() }
            file = app.descendants(matching: .any).matching(predicate).firstMatch
        }
        try require(file.waitForExistence(timeout: 20), "System Files picker must expose the downloaded synthetic file")
        file.tap()
        // Safari gives repeated downloads a numeric suffix. The fixture validates
        // exact multipart bytes and stable server filename, not that local suffix.
        let selected = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Selected: home-task-acceptance")).firstMatch
        try require(selected.waitForExistence(timeout: 20))
    }

    private func signIn() async throws {
        // A previous synthetic run may have completed ordinary login before a
        // later UI failure. Use its real protected session on cold restart.
        if element("tab.place").waitForExistence(timeout: 3) { return }
        try tap("placeLaunchSignIn")
        try enter("bp-task-ui@example.com", into: "loginEmailField")
        try enter("synthetic-loopback-only", into: "loginPasswordField")
        try tap("loginSubmitButton")
        // Password/biometric offers cover the signed-in controls. Dismiss the
        // ordinary OS offer before waiting for the destination behind it.
        for index in 0..<4 {
            let later = app.buttons["Not Now"].firstMatch
            guard later.waitForExistence(timeout: index == 0 ? 10 : 3) else { break }
            later.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        let signedIn = NSPredicate { [self] _, _ in
            element("tab.place").exists && !element("loginSubmitButton").exists
        }
        let arrival = XCTNSPredicateExpectation(predicate: signedIn, object: app)
        let result = await XCTWaiter.fulfillment(of: [arrival], timeout: 30)
        try require(result == .completed, "Normal sign-in did not reach the signed-in UI")
    }

    private func link(_ suffix: String) throws -> URL {
        try XCTUnwrap(URL(string: "pantopus://homes/\(home)/\(suffix)"))
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func enter(_ value: String, into id: String) throws {
        let target = element(id)
        try require(target.waitForExistence(timeout: 20), "Missing \(id)")
        target.tap()
        target.typeText(value)
    }

    private func tap(_ id: String) throws {
        try press(element(id))
    }

    private func tapButton(_ label: String) throws {
        try press(app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch)
    }

    private func press(_ target: XCUIElement) throws {
        try require(target.waitForExistence(timeout: 20), "Required journey control was not found")
        for _ in 0..<8 where !target.isHittable {
            app.swipeUp()
        }
        try require(target.isHittable)
        try require(target.isEnabled)
        target.tap()
    }

    private func require(
        _ condition: Bool,
        _ message: String = "Required journey control unavailable",
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        guard condition else {
            XCTFail(message, file: file, line: line)
            throw JourneyStopped.requiredControl
        }
    }

    private enum JourneyStopped: Error { case requiredControl }

    private func keepScreenshot(_ name: String) {
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
    }

    private func fixture(_ action: String, method: String = "GET") async throws -> TaskUIFixtureSnapshot {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        request.httpMethod = method
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        return try JSONDecoder().decode(TaskUIFixtureSnapshot.self, from: data)
    }
}

private struct TaskUIFixtureSnapshot: Codable {
    struct Receipt: Codable { let taskId: String
        private enum CodingKeys: String, CodingKey { case taskId = "task_id" }
    }

    struct Media: Codable { let id: String
        let state: String
        let available: Bool
    }

    struct Event: Codable { let event: String }
    let receipt: Receipt?
    let media: Media?
    let events: [Event]?
    func count(_ name: String) -> Int {
        events?.filter { $0.event == name }.count ?? 0
    }
}
