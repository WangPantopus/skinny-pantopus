import CryptoKit
import XCTest

/// Opt-in reader acceptance against a separately leased, populated history fixture.
/// Its real HTTP-created receipts are input data, not native admission/UI proof.
@MainActor
final class HomeResidencyHistoryJourneyUITests: XCTestCase {
    private var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private var home = ""
    private var authorityToken = ""
    private var actors: [[String: Any]] = []

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_RESIDENCY_HISTORY_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_RESIDENCY_HISTORY_UI_ORIGIN"], origin)
        let inputs = try await fixture("capabilities")
        XCTAssertEqual(inputs["history_acceptance"] as? Bool, true)
        XCTAssertEqual(inputs["database_scope"] as? String, "synthetic_candidate")
        home = try XCTUnwrap(inputs["home"] as? String)
        actors = try XCTUnwrap(inputs["actors"] as? [[String: Any]])
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            keepScreen("Final private native reviewer history state")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Private reviewer history hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testOwnHistoryPaginationDetailsAccountsAndReadRecovery() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_RESIDENCY_HISTORY_UI_PHASE"] == "reader")
        let before = try await fixture("full-state")
        let own = try await receipts(actor: 0)
        XCTAssertEqual(own.count, 23, "Populate through the accepted real HTTP cycle, never synthetic receipt seeding")
        try await switchAccount(0)
        try openHistory()
        try expectCount(20)
        try press("homeResidencyHistory.more")
        try expectCount(23)
        XCTAssertFalse(element("homeResidencyHistory.more").exists)
        try assertVisibleRowsBelong(to: own)
        keepScreen("Own reviewer history paginated through 23 real saved decisions")
        let recent = try XCTUnwrap(own.first)
        let receiptId = try XCTUnwrap(recent["id"] as? String)
        try press("homeResidencyHistory.row." + receiptId)
        try require(element("homeResidencyHistory.detail"))
        try require(label("Rejection recorded"))
        try require(label("Current household access has not been checked."))
        try require(label("not a saved historical name"))
        keepScreen("Recorded rejection remains separate from current claim and unchecked household access")
        _ = try await fixture("fault", body: ["action": "history_list", "kind": "before", "persistent": true])
        try press("homeResidencyHistory.refresh")
        try expectRetired()
        _ = try await fixture("fault", body: ["action": "history_list", "kind": "clear"])
        try press("homeResidencyHistory.retry")
        try expectCount(20)
        try press("homeResidencyHistory.close")
        try press("homeClaimReview.residencyRecovery")
        try require(element("homeResidencyReview.empty"))
        try press("homeResidencyReview.close")
        try await switchAccount(1)
        try openHistory()
        try expectCount(1)
        let other = try await receipts(actor: 1)
        XCTAssertEqual(other.count, 1)
        try assertVisibleRowsBelong(to: other)
        let otherId = try XCTUnwrap(other.first?["id"] as? String)
        try press("homeResidencyHistory.row." + otherId)
        try require(label("Approval recorded"))
        try require(label("Recorded role: Member"))
        try require(label("Current applicant: @history_current_applicant"))
        try require(element("homeResidencyHistory.accessNotChecked"))
        keepScreen("Normal reviewer account switch shows only its own approval")
        XCUIDevice.shared.press(.home)
        app.activate()
        try expectCount(1)
        try await assertUnchanged(before, after: fixture("full-state"))
        try await assertHistoryRequestsAreReads()
    }

    /// Keep both real-response holds short: UI screenshots and long navigation are
    /// separate from the <20-second API deadline race itself.
    func testHeldListAndDetailCannotRestoreAfterCurrentAuthorityDenial() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_RESIDENCY_HISTORY_UI_PHASE"] == "held-reader")
        try await switchAccount(1)
        try openHistory()
        try expectCount(1)
        let own = try await receipts(actor: 1)
        let item = try XCTUnwrap(own.first?["id"] as? String)
        try await prepareAuthoritySession()
        for action in ["history_list", "history_detail"] {
            if action == "history_detail" {
                try press("homeResidencyHistory.refresh")
                try expectCount(1)
            }
            let before = try await fixture("full-state")
            let count = try await eventCount("history_response_held", action: action)
            let releasedBefore = try await eventCount("history_response_released", action: action)
            _ = try await fixture("fault", body: ["action": action, "kind": "hold", "remaining": 1, "actor": 1])
            try press(action == "history_list" ? "homeResidencyHistory.refresh" : "homeResidencyHistory.row." + item)
            try await awaitEvent("history_response_held", action: action, after: count)
            let heldAt = Date()
            let held = try await lastEvent("history_response_held", action: action)
            XCTAssertEqual(held["status"] as? Int, 200)
            try await setReviewerAuthority(false)
            let denied = try await fixture("full-state")
            try press("homeResidencyHistory.refresh")
            try expectRetired()
            try require(label("Your current permission does not allow"))
            XCTAssertLessThan(Date().timeIntervalSince(heldAt), 18, "Release before the native read timeout")
            _ = try await fixture("release", body: ["action": action])
            try await awaitEvent("history_response_released", action: action, after: releasedBefore)
            let released = try await lastEvent("history_response_released", action: action)
            XCTAssertEqual(try XCTUnwrap(held["body_sha256"] as? String), released["body_sha256"] as? String)
            XCTAssertEqual(try XCTUnwrap(held["body_bytes"] as? Int), released["body_bytes"] as? Int)
            try expectRetired()
            try await assertUnchanged(denied, after: fixture("full-state"))
            try assertDecisionStateUnchanged(before, after: denied)
            keepScreen("Released old successful " + action + " cannot replace current permission denial")
            try await setReviewerAuthority(true)
            let restored = try await fixture("full-state")
            try press("homeResidencyHistory.refresh")
            try expectCount(1)
            try await assertUnchanged(restored, after: fixture("full-state"))
        }
        try await assertHistoryRequestsAreReads()
    }

    private func switchAccount(_ index: Int) async throws {
        app.terminate()
        app.launch()
        if try ready(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier == "tab.place" {
            let before = try await logoutCount()
            let menu = app.buttons.matching(NSPredicate(format: "identifier IN %@", ["place.menu", "hubMenuButton"])).firstMatch
            try reveal(menu)
            menu.tap()
            try press("navDrawer.item.settings")
            try reveal(app.buttons["Log out"].firstMatch)
            app.buttons["Log out"].firstMatch.tap()
            _ = try ready(["loginEmailField", "placeLaunchSignIn"])
            let deadline = Date().addingTimeInterval(35)
            while try await logoutCount() <= before, Date() < deadline {
                try await Task.sleep(for: .milliseconds(100))
            }
            let after = try await logoutCount()
            XCTAssertGreaterThan(after, before)
            app.terminate()
            app.launch()
        }
        if try ready(["loginEmailField", "placeLaunchSignIn"]).identifier == "placeLaunchSignIn" { try press("placeLaunchSignIn") }
        let actor = try XCTUnwrap(actors.first { $0["index"] as? Int == index })
        try enter(XCTUnwrap(actor["email"] as? String), into: "loginEmailField")
        try enter("synthetic-loopback-only", into: "loginPasswordField")
        try press("loginSubmitButton")
        for _ in 0..<4 {
            let dismiss = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now")).firstMatch
            guard dismiss.waitForExistence(timeout: 3) else { break }
            let frame = dismiss.frame
            if !frame.isEmpty { app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap() }
        }
        try require(element("tab.place"))
    }

    private func openHistory() throws {
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/" + home + "/members?tab=requests")))
        try require(element("membersListInvitationRecovery"))
        let review = app.buttons["Review residency claims"].firstMatch
        try reveal(review)
        review.tap()
        try press("homeClaimReview.residencyHistory")
    }

    private func prepareAuthoritySession() async throws {
        // A separate controlled HTTP operator session is used only to exercise
        // current permission changes. The app still signs in through its UI.
        let email = try XCTUnwrap(actors.first { $0["index"] as? Int == 0 }?["email"] as? String)
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/api/users/login")))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": "synthetic-loopback-only"])
        let (data, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let result = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        authorityToken = try XCTUnwrap(result["accessToken"] as? String)
    }

    private func setReviewerAuthority(_ allowed: Bool) async throws {
        // Explicit fixture setup through the real owner-authorized permission
        // route. No auth state is injected into the app or its protected stores.
        let inputs = try await fixture("capabilities")
        let actors = try XCTUnwrap(inputs["actors"] as? [[String: Any]])
        XCTAssertFalse(authorityToken.isEmpty)
        let reviewer = try XCTUnwrap(actors.first { $0["index"] as? Int == 1 }?["id"] as? String)
        var request = try URLRequest(url: XCTUnwrap(URL(string: origin + "/api/homes/" + home + "/members/" + reviewer + "/permissions")))
        request.httpMethod = "POST"
        request.setValue("Bearer " + authorityToken, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["permission": "members.manage", "allowed": allowed])
        let (_, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    }
}

@MainActor
private extension HomeResidencyHistoryJourneyUITests {
    func receipts(actor: Int) async throws -> [[String: Any]] {
        let id = try XCTUnwrap(actors.first { $0["index"] as? Int == actor }?["id"] as? String)
        let state = try await fixture("state")
        return try XCTUnwrap(state["review_receipts"] as? [[String: Any]]).filter { $0["actor_user_id"] as? String == id }.sorted {
            let left = ($0["created_at"] as? String ?? "") + ($0["id"] as? String ?? "")
            let right = ($1["created_at"] as? String ?? "") + ($1["id"] as? String ?? "")
            return left > right
        }
    }

    private func assertVisibleRowsBelong(to receipts: [[String: Any]]) throws {
        let ids = try Set(receipts.map { try XCTUnwrap($0["id"] as? String) })
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "homeResidencyHistory.row."))
            .allElementsBoundByIndex
        XCTAssertFalse(rows.isEmpty)
        for row in rows {
            XCTAssertTrue(ids.contains(String(row.identifier.dropFirst("homeResidencyHistory.row.".count))))
        }
    }

    private func expectCount(_ count: Int) throws {
        try require(element("homeResidencyHistory.count"))
        XCTAssertEqual(element("homeResidencyHistory.count").label, "\(count) recorded decisions loaded")
        XCTAssertFalse(element("homeResidencyHistory.error").exists)
    }

    private func expectRetired() throws {
        try require(element("homeResidencyHistory.error"))
        XCTAssertFalse(element("homeResidencyHistory.count").exists)
        XCTAssertFalse(element("homeResidencyHistory.detail").exists)
        XCTAssertFalse(element("homeResidencyHistory.empty").exists)
        XCTAssertFalse(element("homeResidencyHistory.more").exists)
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "homeResidencyHistory.row.")).count, 0)
    }

    private func assertUnchanged(_ before: [String: Any], after: [String: Any]) throws {
        XCTAssertEqual(try digest(before), try digest(after), "History reads must preserve every owned SQL row")
    }

    private func assertDecisionStateUnchanged(_ before: [String: Any], after: [String: Any]) throws {
        for key in [
            "review_receipts",
            "submission_commands",
            "removal_commands",
            "sender_commands",
            "invitation_commands",
            "claims",
            "ownership"
        ] {
            XCTAssertEqual(try digest(XCTUnwrap(before[key])), try digest(XCTUnwrap(after[key])), key)
        }
    }

    private func digest(_ value: Any) throws -> String {
        let bytes = try JSONSerialization.data(withJSONObject: value, options: .sortedKeys)
        return SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    private func assertHistoryRequestsAreReads() async throws {
        let state = try await fixture("state")
        let requests = try XCTUnwrap(state["events"] as? [[String: Any]]).filter {
            $0["event"] as? String == "request" && ($0["path"] as? String)?.hasPrefix("/api/homes/residency-review-history/") == true
        }
        XCTAssertFalse(requests.isEmpty)
        XCTAssertTrue(requests.allSatisfy { $0["method"] as? String == "GET" })
    }

    private func lastEvent(_ event: String, action: String) async throws -> [String: Any] {
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        return try XCTUnwrap(events.last { $0["event"] as? String == event && $0["action"] as? String == action })
    }

    private func eventCount(_ event: String, action: String) async throws -> Int {
        let state = try await fixture("state")
        return try XCTUnwrap(state["events"] as? [[String: Any]])
            .filter { $0["event"] as? String == event && $0["action"] as? String == action }.count
    }

    private func awaitEvent(_ event: String, action: String, after: Int) async throws {
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            if try await eventCount(event, action: action) > after { return }
            try await Task.sleep(for: .milliseconds(100))
        }
        XCTFail("Expected real held/released history response")
        throw JourneyError.unavailable
    }

    private func logoutCount() async throws -> Int {
        let state = try await fixture("state")
        return try XCTUnwrap(state["events"] as? [[String: Any]]).filter {
            $0["event"] as? String == "response" && $0["path"] as? String == "/api/users/logout" && $0["status"] as? Int == 200
        }.count
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

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func label(_ text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func ready(_ ids: [String]) throws -> XCUIElement {
        let control = app.descendants(matching: .any).matching(NSPredicate(format: "identifier IN %@", ids)).firstMatch
        try require(control)
        return control
    }

    private func require(_ control: XCUIElement) throws {
        guard control.waitForExistence(timeout: 35) else { XCTFail("Expected reviewer history control")
            throw JourneyError.unavailable
        }
    }

    private func reveal(_ control: XCUIElement) throws {
        try require(control)
        for attempt in 0..<18 {
            if control.isHittable { return }
            if control.frame.midY < app.frame.midY || (6..<12).contains(attempt) { app.swipeDown() } else { app.swipeUp() }
        }
        XCTFail("History control is not reachable")
        throw JourneyError.unavailable
    }

    private func press(_ id: String) throws {
        let control = element(id)
        try reveal(control)
        XCTAssertTrue(control.isEnabled)
        control.tap()
    }

    private func enter(_ value: String, into id: String) throws {
        let control = element(id)
        try reveal(control)
        control.tap()
        let prior = control.value as? String ?? ""
        control
            .typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: prior == control.placeholderValue ? 0 : prior.count) +
                value)
    }

    private func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private enum JourneyError: Error { case unavailable }
}
