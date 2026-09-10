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
        continueAfterFailure = false
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
        try signIn()
        try app.open(link("dashboard"))
        XCTAssertTrue(element("homeDashboard").waitForExistence(timeout: 30))
        tapButton("Tasks")
        XCTAssertTrue(element("householdTasksList").waitForExistence(timeout: 20))
        tapButton("Add a task")
        enter(title, into: "field_title")
        tap("formCommitButton")
        let retry = app.buttons["Retry saved request"].firstMatch
        XCTAssertTrue(retry.waitForExistence(timeout: 20), "The interrupted create must retain its original request")
        retry.tap()
        XCTAssertTrue(element("householdTaskDetail").waitForExistence(timeout: 30))
        XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 15))
        let created = try await fixture("state")
        XCTAssertEqual(created.receipt?.taskId, task)
        XCTAssertEqual(created.count("create_committed"), 1)
        XCTAssertEqual(created.count("create_replayed"), 1)
        // A canonical OS link must reopen the actual exact detail, including
        // the normal current-session HTTP checks, without a test-only route.
        try app.open(link("tasks/\(task)"))
        XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 30))
        tap("householdTaskDetail.attachments")
        tap("homeTaskMedia.choose")
        chooseDownloadedFixture()
        tap("homeTaskMedia.retryUpload")
        XCTAssertTrue(app.staticTexts["The upload is unconfirmed. Retry the same file."].firstMatch.waitForExistence(timeout: 20))
        XCTAssertFalse(element("homeTaskMedia.notice").exists)
        tap("homeTaskMedia.retryUpload")
        XCTAssertTrue(app.staticTexts["Private attachment saved."].firstMatch.waitForExistence(timeout: 30))
        let uploaded = try await fixture("state")
        XCTAssertEqual(uploaded.count("upload_committed"), 1)
        XCTAssertEqual(uploaded.count("upload_replayed"), 1)
        let uploadId = try XCTUnwrap(uploaded.media?.id)
        tapButton("Open attachment")
        let preview = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", fileText)).firstMatch
        XCTAssertTrue(preview.waitForExistence(timeout: 30), "The preview must display the exact downloaded text")
        keepScreenshot("Exact synthetic private attachment preview")
        _ = try await fixture("revoke", method: "POST")
        XCUIDevice.shared.press(.home)
        app.activate()
        let hidden = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: preview)
        await fulfillment(of: [hidden], timeout: 20)
        XCTAssertFalse(app.staticTexts["task-attachment-\(uploadId).txt"].exists)
        keepScreenshot("Revoked task attachment content hidden")
        _ = try await fixture("restore", method: "POST")
        tapButton("Reload attachments")
        tapButton("Remove attachment")
        let confirm = app.sheets.buttons["Remove attachment"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 10))
        confirm.tap()
        XCTAssertTrue(app.buttons["Retry attachment removal"].firstMatch.waitForExistence(timeout: 20))
        tapButton("Retry attachment removal")
        XCTAssertTrue(app.staticTexts["Attachment removed. Its history remains."].firstMatch.waitForExistence(timeout: 30))
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
        XCTAssertTrue(download.waitForExistence(timeout: 20), "Safari must receive the synthetic file through HTTP")
        download.tap()
    }

    private func chooseDownloadedFixture() {
        let predicate = NSPredicate(format: "label CONTAINS %@", "home-task-acceptance")
        var file = app.descendants(matching: .any).matching(predicate).firstMatch
        if !file.waitForExistence(timeout: 5) {
            let browse = app.buttons["Browse"].firstMatch
            if browse.waitForExistence(timeout: 5) { browse.tap() }
            let downloads = app.staticTexts["Downloads"].firstMatch
            if downloads.waitForExistence(timeout: 5) { downloads.tap() }
            file = app.descendants(matching: .any).matching(predicate).firstMatch
        }
        XCTAssertTrue(file.waitForExistence(timeout: 20), "System Files picker must expose the downloaded synthetic file")
        file.tap()
        XCTAssertTrue(app.staticTexts["Selected: home-task-acceptance.txt"].firstMatch.waitForExistence(timeout: 20))
    }

    private func signIn() throws {
        tap("placeLaunchSignIn")
        enter("bp-task-ui@example.com", into: "loginEmailField")
        enter("synthetic-loopback-only", into: "loginPasswordField")
        tap("loginSubmitButton")
        let signedIn = NSPredicate { [self] _, _ in
            element("hubMenuButton").exists || element("place.homeTools").exists || element("place.menu").exists
        }
        expectation(for: signedIn, evaluatedWith: app)
        waitForExpectations(timeout: 30)
        for _ in 0..<4 {
            let later = app.buttons["Not Now"].firstMatch
            guard later.waitForExistence(timeout: 3) else { break }
            later.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
    }

    private func link(_ suffix: String) throws -> URL {
        try XCTUnwrap(URL(string: "pantopus://homes/\(home)/\(suffix)"))
    }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func enter(_ value: String, into id: String) {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: 20), "Missing \(id)")
        target.tap()
        target.typeText(value)
    }

    private func tap(_ id: String) {
        press(element(id))
    }

    private func tapButton(_ label: String) {
        press(app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch)
    }

    private func press(_ target: XCUIElement) {
        XCTAssertTrue(target.waitForExistence(timeout: 20), "Missing \(target.identifier)")
        for _ in 0..<8 where !target.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(target.isHittable)
        XCTAssertTrue(target.isEnabled)
        target.tap()
    }

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
