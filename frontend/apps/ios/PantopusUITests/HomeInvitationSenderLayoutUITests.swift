import XCTest

extension HomeInvitationSenderJourneyUITests {
    /// A fresh, read-only follow-up to the accepted sender command journey.
    func testPendingRecipientsRemainVisibleAndOpenMatchingReviews() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "pending-layout")
        let before = try await fixture("state")
        XCTAssertEqual((before["sender_commands"] as? [[String: Any]])?.count, 0)
        app.launch()
        if try waitForSurface(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier == "tab.place" {
            try signOutThroughSettings()
        }
        try signIn(0)
        try openMembers()
        try press("tab.pending")
        for index in [1, 2] {
            try require(label("Residency fixture (@residency_http_0\(index + 1))"))
        }
        keepScreen("Pending identities wrap fully above separate actions")
        for index in [1, 2] {
            let recipient = "Residency fixture (@residency_http_0\(index + 1))"
            for action in ["Resend", "Withdraw"] {
                try press("membersInvitation\(action)_" + invitationId(index))
                try require(element("homeInvitationSenderSubmit"))
                XCTAssertEqual(element("homeInvitationSenderRecipient").label, recipient)
                keepScreen("Pending recipient \(index) opens matching \(action) review")
                try press("homeInvitationSenderClose")
            }
        }
        let after = try await fixture("state")
        XCTAssertEqual((after["sender_commands"] as? [[String: Any]])?.count, 0)
        for key in ["memberships", "controlled_notifications", "controlled_email_attempts"] {
            XCTAssertEqual(
                try JSONSerialization.data(withJSONObject: XCTUnwrap(before[key]), options: .sortedKeys),
                try JSONSerialization.data(withJSONObject: XCTUnwrap(after[key]), options: .sortedKeys)
            )
        }
    }

    func testHeldOlderMemberListCannotReplaceNewerFailure() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "list-ordering")
        app.launch()
        if try waitForSurface(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier == "tab.place" {
            try signOutThroughSettings()
        }
        try signIn(0)
        try openMembers()
        try press("tab.pending")
        try require(label("Residency fixture (@residency_http_02)"))
        try press("listOfRowsTopBarAction")
        try require(element("homeClaimReview_back"))
        let held = try await eventCount("reply_held", action: "sender_list")
        _ = try await fault("sender_list", "hold")
        try press("homeClaimReview_back")
        try await waitForFixtureEvent("reply_held", action: "sender_list", after: held)
        let heldAt = Date()
        _ = try await fault("sender_list", "before", persistent: true)
        try press("listOfRowsTopBarAction")
        try require(element("homeClaimReview_back"))
        let beforeRefresh = try await memberAccessReadCount()
        try press("homeClaimReview_back")
        try require(label("Couldn't load the list"))
        let afterRefresh = try await memberAccessReadCount()
        XCTAssertGreaterThan(afterRefresh, beforeRefresh, "A newer whole fetch must reach current access; an HTTP retry is insufficient")
        XCTAssertLessThan(Date().timeIntervalSince(heldAt), 15, "Release the old success before its 20-second request timeout")
        let released = try await eventCount("reply_released", action: "sender_list")
        _ = try await fixture("release", body: [:])
        try await waitForFixtureEvent("reply_released", action: "sender_list", after: released)
        try press("tab.members")
        try press("tab.pending")
        try require(label("Couldn't load the list"))
        XCTAssertFalse(label("Residency fixture (@residency_http_02)").exists)
        XCTAssertFalse(element("tab.pending").label.contains("0"), "An unconfirmed queue must not show zero invitations")
        keepScreen("Newer list failure survives old success and tab changes")
        try press("membersListInvitationRecovery")
        try require(element("homeInvitationSenderPrepare"))
        try press("homeInvitationSenderClose")
        _ = try await fault("sender_list", "clear")
        let retry = app.buttons["Try again"].firstMatch
        try reveal(retry)
        retry.tap()
        try require(label("Residency fixture (@residency_http_02)"))
        keepScreen("Explicit current list retry restores full recipient identity")
        let state = try await fixture("state")
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 0)
    }

    private func memberAccessReadCount() async throws -> Int {
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        return events.filter { ($0["path"] as? String)?.hasSuffix("/me") == true && $0["method"] as? String == "GET" }.count
    }
}
