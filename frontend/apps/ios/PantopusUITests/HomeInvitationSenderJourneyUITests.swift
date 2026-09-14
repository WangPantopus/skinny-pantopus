import XCTest

/// Opt-in normal native UI against the owned sender production HTTP/SDK/SQL fixture.
@MainActor
final class HomeInvitationSenderJourneyUITests: XCTestCase {
    var app: XCUIApplication!
    private let origin = "http://127.0.0.1:18084"
    private var home = ""
    private var capabilities: [[String: Any]] = []

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        try XCTSkipUnless(ProcessInfo.processInfo.environment["RUN_HOME_INVITATION_SENDER_UI"] == "1")
        XCTAssertEqual(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_ORIGIN"], origin)
        let inputs = try await fixture("capabilities")
        home = try XCTUnwrap(inputs["home"] as? String)
        capabilities = try XCTUnwrap(inputs["capabilities"] as? [[String: Any]])
        app = XCUIApplication()
        app.launchEnvironment = ["PANTOPUS_API_ENV": "local", "UI_TESTS_DISABLE_NOTIFICATIONS": "1"]
    }

    override func tearDown() async throws {
        if let app {
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "Private sender native hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
            keepScreen("Final native sender state")
            if let state = try? await fixture("state"), let data = try? JSONSerialization.data(withJSONObject: state) {
                let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
                attachment.name = "Private sender HTTP SDK SQL evidence"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
            app.terminate()
        }
        app = nil
        try await super.tearDown()
    }

    func testSenderOriginalsSurviveFailuresRestartAndMembershipChanges() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == nil)
        app.launch()
        if try waitForSurface(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier == "tab.place" {
            try signOutThroughSettings()
        }
        try signIn(0)
        try openMembers()
        try await cancelUnseenCreation()
        try await recoverCreationAcrossAccountsAndFailedRefresh()
        try await continuePendingActions()
    }

    func testResumeAfterSavedCreationSharingCheckpoint() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "resume-after-sharing")
        let state = try await fixture("state")
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 2)
        app.launch()
        try await recoverAccountIsolationAndFailedRefresh()
        try await continuePendingActions()
    }

    func testResumeAfterSavedCreationRefreshCheckpoint() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "resume-after-refresh")
        let state = try await fixture("state")
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 2)
        _ = try await fault("members", "clear")
        app.launch()
        try openMembers()
        try await continuePendingActions()
    }

    private func continuePendingActions() async throws {
        try await resendAndPreserveAcceptedMembership()
        try await withdrawPendingInvitation()
        try await rejectAuthorityChangedAfterReview()
        try await retireHeldCreationReply()
        try await verifyPrimaryJourney()
    }

    func testNativeSharingPresentationAfterPrimaryJourney() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "sharing")
        let before = try await fixture("state")
        let commands = try XCTUnwrap(before["sender_commands"] as? [[String: Any]])
        XCTAssertEqual(commands.count, 7)
        let invitation = try XCTUnwrap(commands.last {
            $0["action"] as? String == "create" && $0["state"] as? String == "completed"
        }?["invitation_id"] as? String)
        app.launch()
        try openMembers()
        try press("tab.pending")
        try press("membersInvitationResend_" + invitation)
        _ = try await fault("resend", "after")
        try confirmPrepared()
        try require(element("homeInvitationSenderRetry"))
        let delivered = try await fixture("state")
        try press("homeInvitationSenderRetry")
        try require(label("Resend saved"))
        let replayed = try await fixture("state")
        let requestId = (replayed["sender_commands"] as? [[String: Any]])?.last?["request_id"] as? String
        let posts = try XCTUnwrap(replayed["events"] as? [[String: Any]]).filter {
            $0["path"] as? String == "/api/homes/invitations/sender/commands" && $0["request_id"] as? String == requestId
        }
        XCTAssertNotNil(requestId)
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(Set(posts.compactMap { $0["request_hash"] as? String }).count, 1)
        for key in ["controlled_notifications", "controlled_email_attempts", "sender_commands"] {
            XCTAssertEqual(
                try JSONSerialization.data(withJSONObject: XCTUnwrap(delivered[key]), options: .sortedKeys),
                try JSONSerialization.data(withJSONObject: XCTUnwrap(replayed[key]), options: .sortedKeys)
            )
        }
        XCTAssertFalse(element("homeInvitationSenderShare").exists)
        try presentAndCloseSharing()
        try acknowledge()
        let after = try await fixture("state")
        let updated = try XCTUnwrap(after["sender_commands"] as? [[String: Any]])
        XCTAssertEqual(updated.count, 8)
        XCTAssertEqual(updated.last?["action"] as? String, "resend")
        XCTAssertEqual(updated.last?["state"] as? String, "completed")
    }

    func testResumeExistingSharingReceipt() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "resume-sharing-receipt")
        let before = try await fixture("state")
        XCTAssertEqual((before["sender_commands"] as? [[String: Any]])?.count, 8)
        app.launch()
        try openMembers()
        try press("membersListInvitationRecovery")
        try require(label("Resend saved"))
        try presentAndCloseSharing()
        try acknowledge()
        let after = try await fixture("state")
        XCTAssertEqual((after["sender_commands"] as? [[String: Any]])?.count, 8)
    }

    private func cancelUnseenCreation() async throws {
        try press("membersListInvitationRecovery")
        try enter("residency-http-4@example.invalid", into: "inviteMember_email")
        _ = try await fault("sender_context", "malformed", persistent: true)
        try press("homeInvitationSenderPrepare")
        try require(element("homeInvitationSenderError"))
        XCTAssertFalse(element("homeInvitationSenderSubmit").exists)
        _ = try await fault("sender_context", "clear")
        try press("homeInvitationSenderPrepare")
        try press("homeInvitationSenderSubmit")
        try require(element("homeInvitationSenderConfirm"))
        XCUIDevice.shared.press(.home)
        app.activate()
        try require(element("homeInvitationSenderPrepare"))
        XCTAssertFalse(element("homeInvitationSenderConfirm").exists)
        try press("homeInvitationSenderPrepare")
        _ = try await fault("create", "before", persistent: true)
        try confirmPrepared()
        try require(element("homeInvitationSenderCheck"))
        app.terminate()
        _ = try await fault("sender_read", "before", persistent: true)
        app.launch()
        try openMembers()
        try press("membersListInvitationRecovery")
        try require(element("homeInvitationSenderError"))
        XCTAssertTrue(element("homeInvitationSenderOriginalRecipient").label.contains("residency-http-4"))
        _ = try await fault("sender_read", "clear")
        try press("homeInvitationSenderCancel")
        try press("homeInvitationSenderConfirmCancel")
        try require(label("Attempt cancelled"))
        keepScreen("Unseen native create cancelled after cold recovery")
        try acknowledge()
    }

    private func recoverCreationAcrossAccountsAndFailedRefresh() async throws {
        try press("membersListInvitationRecovery")
        try enter("residency-http-4@example.invalid", into: "inviteMember_email")
        try press("homeInvitationSenderPrepare")
        _ = try await fixture("delivery", body: ["email": "unconfirmed", "in_app": false])
        _ = try await fault("create", "after")
        try confirmPrepared()
        try require(element("homeInvitationSenderCheck"))
        app.terminate()
        _ = try await fault("sender_read", "before", persistent: true)
        app.launch()
        try openMembers()
        try press("membersListInvitationRecovery")
        try require(element("homeInvitationSenderError"))
        _ = try await fault("sender_read", "clear")
        try press("homeInvitationSenderCheck")
        try require(label("Invitation saved"))
        try require(element("homeInvitationSenderDelivery"))
        XCTAssertTrue(element("homeInvitationSenderDelivery").label.contains("unconfirmed"))
        XCTAssertFalse(element("homeInvitationSenderShare").exists)
        try press("homeInvitationSenderCheckSharing")
        try require(element("homeInvitationSenderShare"))
        keepScreen("Saved original survives lost reply with unconfirmed delivery")
        let sharingState = try await fixture("state")
        let created = try XCTUnwrap((sharingState["sender_commands"] as? [[String: Any]])?
            .first { $0["action"] as? String == "create" && $0["state"] as? String == "completed" }?["invitation_id"] as? String)
        _ = try await fixture("sender-scenario", body: ["mode": "expire", "invitation_id": created])
        try press("homeInvitationSenderCheckSharing")
        try require(element("homeInvitationSenderError"))
        XCTAssertFalse(element("homeInvitationSenderShare").exists)
        XCTAssertTrue(label("Invitation saved").exists)
        keepScreen("Expired sharing check retires link without erasing saved creation")
        try press("homeInvitationSenderClose")
        try await recoverAccountIsolationAndFailedRefresh()
    }

    private func recoverAccountIsolationAndFailedRefresh() async throws {
        try await coldSwitch(2)
        try openMembers()
        try press("membersListInvitationRecovery")
        try require(element("inviteMember_email"))
        XCTAssertFalse(element("homeInvitationSenderOriginalRecipient").exists)
        try press("homeInvitationSenderClose")
        try await coldSwitch(0)
        try openMembers()
        try press("membersListInvitationRecovery")
        try require(label("Invitation saved"))
        XCTAssertTrue(element("homeInvitationSenderOriginalRecipient").label.contains("residency-http-4"))
        _ = try await fault("members", "before", persistent: true)
        try acknowledge()
        try require(element("membersListInvitationResult"))
        try require(label("Couldn't load the list"))
        keepScreen("Saved creation remains clear when roster refresh fails")
        _ = try await fault("members", "clear")
        try openMembers()
    }

    private func resendAndPreserveAcceptedMembership() async throws {
        let invitation = try invitationId(1)
        try press("tab.pending")
        try press("membersInvitationResend_" + invitation)
        try require(element("homeInvitationSenderSubmit"))
        _ = try await fault("resend", "after")
        try confirmPrepared()
        try require(element("homeInvitationSenderCheck"))
        try press("homeInvitationSenderRetry")
        try require(label("Resend saved"))
        let retried = try await fixture("state")
        let requestId = (retried["sender_commands"] as? [[String: Any]])?.last?["request_id"] as? String
        let requests = try XCTUnwrap(retried["events"] as? [[String: Any]]).filter {
            $0["path"] as? String == "/api/homes/invitations/sender/commands" && $0["request_id"] as? String == requestId
        }
        XCTAssertNotNil(requestId)
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(Set(requests.compactMap { $0["request_hash"] as? String }).count, 1)
        try acknowledge()
        try press("tab.pending")
        try press("membersInvitationWithdraw_" + invitation)
        try require(element("homeInvitationSenderSubmit"))
        _ = try await fixture("sender-scenario", body: ["mode": "accept", "invitation_id": invitation])
        let before = try await fixture("state")
        let memberships = try XCTUnwrap(before["memberships"] as? [[String: Any]])
        try confirmPrepared()
        try require(label("Action did not proceed"))
        let after = try await fixture("state")
        XCTAssertEqual(
            try JSONSerialization.data(withJSONObject: memberships, options: .sortedKeys),
            try JSONSerialization.data(withJSONObject: XCTUnwrap(after["memberships"]), options: .sortedKeys)
        )
        keepScreen("Resolved recipient withdrawal preserves exact membership")
        try acknowledge()
    }

    private func withdrawPendingInvitation() async throws {
        let invitation = try invitationId(2)
        _ = try await fixture("sender-scenario", body: ["mode": "expire", "invitation_id": invitation])
        try openMembers()
        try press("tab.pending")
        try press("membersInvitationWithdraw_" + invitation)
        _ = try await fault("withdraw", "after")
        try confirmPrepared()
        try require(element("homeInvitationSenderCheck"))
        app.terminate()
        app.launch()
        try openMembers()
        try press("membersListInvitationRecovery")
        try require(label("Invitation withdrawn"))
        keepScreen("Withdrawal recovered after cold launch")
        try acknowledge()
        let state = try await fixture("state")
        let invites = try XCTUnwrap(state["invitations"] as? [[String: Any]])
        XCTAssertEqual(invites.first { $0["id"] as? String == invitation }?["status"] as? String, "revoked")
    }

    private func retireHeldCreationReply() async throws {
        try press("membersListInvitationRecovery")
        try enter("residency-http-6@example.invalid", into: "inviteMember_email")
        try press("homeInvitationSenderPrepare")
        _ = try await fault("create", "hold")
        try confirmPrepared()
        try await waitForFixtureEvent("reply_held", action: "create", after: 0)
        try press("homeInvitationSenderClose")
        try press("membersListInvitationRecovery")
        try require(label("Invitation saved"))
        _ = try await fixture("release", body: [:])
        _ = try await fault("create", "clear")
        XCTAssertTrue(element("homeInvitationSenderOriginalRecipient").label.contains("residency-http-6"))
        keepScreen("Retired held reply cannot replace the recovered original")
        try acknowledge()
    }

    private func rejectAuthorityChangedAfterReview() async throws {
        try press("membersListInvitationRecovery")
        try enter("residency-http-5@example.invalid", into: "inviteMember_email")
        try press("homeInvitationSenderPrepare")
        _ = try await fixture("sender-scenario", body: ["mode": "deny_manage"])
        try confirmPrepared()
        try require(label("Action did not proceed"))
        keepScreen("Authority changed after review rejects native creation")
        try acknowledge()
        _ = try await fixture("sender-scenario", body: ["mode": "restore_manage"])
        try openMembers()
    }
}

@MainActor
extension HomeInvitationSenderJourneyUITests {
    func verifyPrimaryJourney() async throws {
        let state = try await fixture("state")
        let commands = try XCTUnwrap(state["sender_commands"] as? [[String: Any]])
        XCTAssertEqual(commands.count, 7)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "completed" }.count, 4)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "cancelled" }.count, 1)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "rejected" }.count, 2)
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        XCTAssertFalse(events.contains { $0["method"] as? String == "DELETE" && ($0["path"] as? String)?.contains("/members/") == true })
    }

    func invitationId(_ index: Int) throws -> String {
        try XCTUnwrap(capabilities.first { $0["index"] as? Int == index }?["invitation_id"] as? String)
    }

    func openMembers() throws {
        try require(element("tab.place"))
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/" + home + "/members?tab=requests")))
        try require(element("membersListInvitationRecovery"))
    }

    func confirmPrepared() throws {
        try press("homeInvitationSenderSubmit")
        try press("homeInvitationSenderConfirm")
    }

    func acknowledge() throws {
        try press("homeInvitationSenderAcknowledge")
        try require(element("membersListInvitationRecovery"))
    }

    func coldSwitch(_ index: Int) async throws {
        app.terminate()
        app.launch()
        let heldCount = try await eventCount("logout_reply_held")
        _ = try await fault("logout", "hold", persistent: true)
        try signOutThroughSettings()
        try await waitForFixtureEvent("logout_reply_held", after: heldCount)
        app.terminate()
        _ = try await fixture("release", body: [:])
        _ = try await fault("logout", "clear")
        app.launch()
        try signIn(index)
    }

    func signIn(_ index: Int) throws {
        if try waitForSurface(["loginEmailField", "placeLaunchSignIn"]).identifier == "placeLaunchSignIn" {
            try press("placeLaunchSignIn")
        }
        try enter("residency-http-\(index + 1)@example.invalid", into: "loginEmailField")
        try enter("synthetic-loopback-only", into: "loginPasswordField")
        try press("loginSubmitButton")
        for _ in 0..<4 {
            let buttons = app.buttons.matching(NSPredicate(format: "label == %@", "Not Now"))
            guard buttons.firstMatch.waitForExistence(timeout: 3) else { break }
            let frame = buttons.firstMatch.frame
            if !frame.isEmpty { app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap() }
        }
        try require(element("tab.place"))
    }

    func signOutThroughSettings() throws {
        let menu = app.buttons.matching(NSPredicate(format: "identifier IN %@", ["place.menu", "hubMenuButton"])).firstMatch
        try reveal(menu)
        menu.tap()
        try press("navDrawer.item.settings")
        let button = app.buttons["Log out"].firstMatch
        try reveal(button)
        button.tap()
        _ = try waitForSurface(["loginEmailField", "placeLaunchSignIn"])
    }

    func presentAndCloseSharing() throws {
        try press("homeInvitationSenderCheckSharing")
        try press("homeInvitationSenderShare")
        try require(element("ActivityListView"))
        keepScreen("System invitation share sheet opened without sending or changing clipboard")
        try press("header.closeButton")
    }

    func waitForSurface(_ identifiers: [String]) throws -> XCUIElement {
        let control = app.descendants(matching: .any).matching(NSPredicate(format: "identifier IN %@", identifiers)).firstMatch
        try require(control)
        return control
    }

    func eventCount(_ event: String, action: String? = nil) async throws -> Int {
        let state = try await fixture("state")
        return (state["events"] as? [[String: Any]])?.filter {
            $0["event"] as? String == event && (action == nil || $0["action"] as? String == action)
        }.count ?? 0
    }

    func waitForFixtureEvent(_ event: String, action: String? = nil, after count: Int) async throws {
        let deadline = Date().addingTimeInterval(35)
        while Date() < deadline {
            if try await eventCount(event, action: action) > count { return }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("The fixture did not reach the expected held-reply boundary")
        throw JourneyFailure.unavailable
    }

    func enter(_ text: String, into id: String) throws {
        let field = element(id)
        try reveal(field)
        field.tap()
        let old = field.value as? String ?? ""
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: old == field.placeholderValue ? 0 : old.count) + text)
    }

    func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    func label(_ text: String) -> XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    func require(_ control: XCUIElement) throws {
        guard control.waitForExistence(timeout: 35) else {
            XCTFail("Expected native sender control is missing")
            throw JourneyFailure.unavailable
        }
    }

    func reveal(_ control: XCUIElement) throws {
        try require(control)
        for _ in 0..<9 {
            if control.isHittable { return }
            app.swipeUp()
        }
        XCTFail("Native sender control is not reachable")
        throw JourneyFailure.unavailable
    }

    func press(_ id: String) throws {
        let control = element(id)
        try reveal(control)
        guard control.isEnabled else {
            XCTFail("Native sender control is disabled")
            throw JourneyFailure.unavailable
        }
        control.tap()
    }

    func fault(_ action: String, _ kind: String, persistent: Bool = false) async throws -> [String: Any] {
        try await fixture("fault", body: ["action": action, "kind": kind, "persistent": persistent])
    }

    func fixture(_ action: String, body: [String: Any]? = nil) async throws -> [String: Any] {
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

    enum JourneyFailure: Error { case unavailable }
    func keepScreen(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
