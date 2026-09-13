import XCTest

/// Actual installed app and Keychain, backed by production Gig HTTP/service/local SQL.
/// Identity and geo remain synthetic; no hosted or paid provider is contacted.
@MainActor
final class HomeTaskGigJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18083"
    private var home = ""
    private var taskId = ""

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = true
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_GIG_UI"] == "1", "Requires isolated SQL-backed Gig fixture")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_GIG_UI_ORIGIN"], origin)
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
        let state = try await fixture("reset", method: "POST")
        home = state.homeId
        taskId = state.taskId
    }

    override func tearDown() async throws {
        if let app {
            keepScreenshot("Gig publication final screen")
            if (testRun?.failureCount ?? 0) > 0 {
                let tree = XCTAttachment(string: app.debugDescription)
                tree.name = "Gig publication hierarchy"
                tree.lifetime = .keepAlways
                add(tree)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testReviewedPublicationStaleSourceColdRecoveryCancelledDestinationAndRevocation() async throws {
        app.launch()
        try await signIn()
        try openPublication()
        XCTAssertTrue(["", "Public title"].contains(element("homeTaskGig.title").value as? String ?? ""))
        try fillPublicFields()
        _ = try await fixture("change-task", method: "POST")
        try press(element("homeTaskGig.publish"))
        try press(element("homeTaskGig.acknowledge"))
        try reveal(element("homeTaskGig.publish"))
        XCTAssertFalse(element("homeTaskGig.publish").isEnabled)
        let rejected = try await fixture("state")
        XCTAssertEqual(rejected.receipts.count, 0)
        try press(element("homeTaskGig.reviewed"))
        keepScreenshot("Explicit public review after a changed private source")
        try press(element("homeTaskGig.publish"))
        try reveal(element("homeTaskGig.retry"))
        let lost = try await fixture("state")
        XCTAssertEqual(lost.receipts.count, 1)
        let original = try XCTUnwrap(lost.receipts.first?.requestId)
        let gigId = try XCTUnwrap(lost.receipts.first?.gigId)
        _ = try await fixture("cancel-elsewhere", method: "POST")
        app.terminate()
        app.launch()
        try await signIn()
        try openPublication()
        try press(element("homeTaskGig.retry"))
        try reveal(element("homeTaskGig.acknowledge"))
        let recovered = try await fixture("state")
        XCTAssertEqual(recovered.receipts.first?.requestId, original)
        XCTAssertEqual(recovered.gigs.first?.status, "cancelled")
        XCTAssertEqual(recovered.gigs.first?.price, 30)
        XCTAssertEqual(recovered.commands.last?.homeTaskSource.requestId, original)
        keepScreenshot("Original native receipt confirmed after later cancellation")
        app.terminate()
        app.launch()
        try await signIn()
        try openPublication()
        try press(element("homeTaskGig.open"))
        try require(app.staticTexts["Reviewed native kitchen help"].firstMatch.waitForExistence(timeout: 30))
        let opened = try await fixture("state")
        XCTAssertEqual(opened.events.last { $0.event == "gig_opened" }?.gigId, gigId)
        try verifyDetail(status: "Cancelled", dock: "Cancelled")
        XCTAssertTrue(app.staticTexts["GENERAL"].firstMatch.exists)
        keepScreenshot("Exact current Gig destination")
        try await verifyDetailStates(gigId)
        try openPublication()
        try press(element("homeTaskGig.acknowledge"))
        try reveal(element("homeTaskGig.open"))
        XCTAssertFalse(element("homeTaskGig.publish").exists)
        _ = try await fixture("revoke", method: "POST")
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeTaskGig.error").waitForExistence(timeout: 20))
        XCTAssertFalse(element("homeTaskGig.source").exists)
        XCTAssertFalse(element("homeTaskGig.open").exists)
        keepScreenshot("Current denial hides publication source and controls")
        _ = try await fixture("restore", method: "POST")
        try press(element("homeTaskGig.reload"))
        try press(element("homeTaskGig.open"))
        let final = try await fixture("state")
        XCTAssertEqual(final.receipts.count, 1)
        XCTAssertEqual(final.gigs.count, 1)
        XCTAssertEqual(final.gigs.first?.status, "cancelled")
        XCTAssertEqual(final.commands.count, 3)
        XCTAssertEqual(final.commands[1], final.commands[2])
        let proof = try XCTAttachment(data: JSONEncoder().encode(final), uniformTypeIdentifier: "public.json")
        proof.name = "Installed native publication SQL evidence"
        proof.lifetime = .keepAlways
        add(proof)
    }

    private func verifyDetail(status: String, dock: String) throws {
        try require(app.staticTexts[status].firstMatch.waitForExistence(timeout: 20))
        let button = app.buttons.matching(NSPredicate(format: "label == %@", dock)).firstMatch
        try require(button.waitForExistence(timeout: 20))
        XCTAssertFalse(button.isEnabled)
        XCTAssertTrue(app.staticTexts["$30"].firstMatch.exists)
        XCTAssertFalse(app.buttons["Place bid"].exists)
        XCTAssertFalse(app.staticTexts["Verified address"].exists)
        XCTAssertFalse(app.staticTexts["Be the first to bid"].exists)
        XCTAssertFalse(app.staticTexts["Changed private native repair"].exists)
    }

    /// Persisted state projections, not acceptance of payment/assignment mutations.
    private func verifyDetailStates(_ gigId: String) async throws {
        for layout in ["v1", "v2"] {
            for (status, label) in [
                ("open", "Open"),
                ("assigned", "Assigned"),
                ("in_progress", "In progress"),
                ("completed", "Completed"),
                ("cancelled", "Cancelled")
            ] {
                try press(app.buttons.matching(NSPredicate(format: "label == 'Back'")).firstMatch)
                _ = try await fixture("gig-state", method: "POST", body: ["status": status, "layout": layout])
                try app.open(XCTUnwrap(URL(string: "pantopus://gigs/\(gigId)")))
                try require(app.staticTexts["Reviewed native kitchen help"].firstMatch.waitForExistence(timeout: 20))
                let visibleStatus = status == "open" && layout == "v2" ? "Open · No bids yet" : label
                try verifyDetail(
                    status: visibleStatus,
                    dock: status == "open" ? "Your task" : status == "cancelled" ? "Cancelled" : "Bidding closed"
                )
                if layout == "v2" { XCTAssertTrue(app.staticTexts["GENERAL"].firstMatch.exists) }
                keepScreenshot("Current \(layout) \(status) Gig detail")
            }
        }
    }

    private func fillPublicFields() throws {
        for (id, text) in [
            ("title", "Reviewed native kitchen help"),
            ("description", "Please help with this reviewed repair."),
            ("budget", "25")
        ] {
            let control = element("homeTaskGig.\(id)")
            try press(control)
            control.typeText(text)
            try press(element("homeTaskGig.keyboardDone"))
        }
        try press(element("homeTaskGig.address"))
        element("homeTaskGig.address").typeText("Reviewed native")
        try press(element("homeTaskGig.keyboardDone"))
        try press(element("homeTaskGig.search"))
        try press(element("homeTaskGig.suggestion"))
        try require(element("homeTaskGig.selectedLocation").waitForExistence(timeout: 20))
        try press(element("homeTaskGig.reviewed"))
    }

    private func openPublication() throws {
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/\(home)/tasks/\(taskId)")))
        try press(element("householdTaskDetail.gig"))
        try require(element("homeTaskGig.source").waitForExistence(timeout: 20))
    }

    private func signIn() async throws {
        if element("tab.place").waitForExistence(timeout: 3) { return }
        if !element("loginEmailField").exists { try press(element("placeLaunchSignIn")) }
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

    private func reveal(_ control: XCUIElement) throws {
        // SwiftUI Form virtualizes off-screen rows; scroll before requiring
        // existence, then wait for the actual reachable control.
        for _ in 0..<10 {
            if control.exists, control.isHittable { break }
            if control.exists, control.frame.midY < app.frame.midY {
                app.swipeDown()
            } else {
                app.swipeUp()
            }
        }
        try require(control.waitForExistence(timeout: 20) && control.isHittable, "Missing reachable control")
    }

    private func press(_ control: XCUIElement) throws {
        try reveal(control)
        try require(control.isEnabled, "Control unavailable")
        if control.elementType == .switch {
            control.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
        } else {
            control.tap()
        }
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

    private func fixture(_ action: String, method: String = "GET", body: [String: String]? = nil) async throws -> GigUIEvidence {
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/fixture/" + action)))
        request.httpMethod = method
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try require((response as? HTTPURLResponse)?.statusCode == 200)
        return try JSONDecoder().decode(GigUIEvidence.self, from: data)
    }
}

private struct GigUIEvidence: Codable {
    struct Receipt: Codable {
        let requestId: String
        let gigId: String
        private enum CodingKeys: String, CodingKey { case requestId = "request_id", gigId = "gig_id" }
    }

    struct Gig: Codable { let id: String
        let price: Decimal
        let status: String
    }

    struct Command: Codable, Equatable {
        struct Source: Codable, Equatable {
            let requestId: String
            let expectedUpdatedAt: String
            private enum CodingKeys: String, CodingKey { case requestId = "request_id", expectedUpdatedAt = "expected_updated_at" }
        }

        let title: String
        let description: String
        let price: Decimal
        let homeTaskSource: Source
        private enum CodingKeys: String, CodingKey { case title, description, price, homeTaskSource = "home_task_source" }
    }

    struct Event: Codable {
        let event: String
        let gigId: String?
        private enum CodingKeys: String, CodingKey { case event, gigId = "gig_id" }
    }

    let homeId: String
    let taskId: String
    let receipts: [Receipt]
    let gigs: [Gig]
    let commands: [Command]
    let events: [Event]
    private enum CodingKeys: String, CodingKey { case homeId = "home_id", taskId = "task_id", receipts, gigs, commands, events }
}
