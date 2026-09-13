import XCTest

/// Bounded predecessor/fix continuation of the same original; no matrix replay.
@MainActor
extension HomeInvitationSenderJourneyUITests {
    func testBaselineRemovalCloseRestoresCachedMember() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-removal-dismissal-baseline")
        let context = try await protectedRemovalContext()
        let initial = try await fixture("state")
        XCTAssertEqual(try removalRows(initial, "removal_commands").count, 0)
        try await removalSwitch(0)
        try openMembers()
        try press("tab.members")
        try openRemoval(context, index: 1)
        _ = try await fixture("fault", body: ["action": "removal_submit", "kind": "after", "target_id": context.userId(1)])
        try confirmRemoval()
        try require(element("homeMemberRemovalError"))
        let committed = try await fixture("state")
        XCTAssertEqual(try removalRows(committed, "removal_commands").count, 1)
        XCTAssertEqual(try removalRows(committed, "removal_commands").first?["state"] as? String, "completed")
        let readCount = try removalRequestCount(committed, path: "/api/homes/" + context.homeId + "/occupants")
        try press("homeMemberRemovalClose")
        try require(element("membersListRemovalRecovery"))
        try press("tab.guests")
        try press("tab.members")
        try require(removalMoreActions(context, index: 1))
        let closed = try await fixture("state")
        XCTAssertEqual(try removalRequestCount(closed, path: "/api/homes/" + context.homeId + "/occupants"), readCount)
        XCTAssertEqual(try removalDigest(committed["removal_commands"]), try removalDigest(closed["removal_commands"]))
        try await removalCheckpoint("Predecessor Close retains removed member without a new current roster read")
    }

    func testRemovalDismissalRefreshKeepsHeldAndFailedRosterUnknown() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-removal-dismissal-reader")
        let context = try await protectedRemovalContext()
        let capabilities = try await fixture("capabilities")
        XCTAssertEqual(capabilities["members_hold_actual"] as? Bool, true)
        let initial = try await fixture("state")
        XCTAssertEqual(try removalRows(initial, "removal_commands").count, 1)
        XCTAssertEqual(try removalRows(initial, "removal_commands").first?["state"] as? String, "completed")
        try await removalSwitch(0)
        try openMembers()
        try press("tab.members")
        try require(removalMoreActions(context, index: 2))
        XCTAssertFalse(try removalMoreActions(context, index: 1).exists)
        try press("membersListRemovalRecovery")
        try require(label("Removal recorded"))
        XCTAssertEqual(element("homeMemberRemovalTarget").label, try context.username(1))
        let heldCount = try await eventCount("members_response_held", action: "members")
        let releasedCount = try await eventCount("members_response_released", action: "members")
        _ = try await fixture("fault", body: ["action": "members", "kind": "hold", "remaining": 1])
        try press("homeMemberRemovalClose")
        try await waitForFixtureEvent("members_response_held", action: "members", after: heldCount)
        try assertUnconfirmedRemovalRoster(context)
        keepScreen("Close without acknowledgement starts real held read with unknown counts and retired member actions")
        _ = try await fixture("release", body: ["action": "members"])
        try await waitForFixtureEvent("members_response_released", action: "members", after: releasedCount)
        try require(removalMoreActions(context, index: 2))
        XCTAssertFalse(try removalMoreActions(context, index: 1).exists)
        // Use a second short hold for the generation race. The preceding full
        // tab checks must not consume the app's 20-second request timeout.
        try press("membersListRemovalRecovery")
        try require(label("Removal recorded"))
        _ = try await fixture("fault", body: ["action": "members", "kind": "hold", "remaining": 1])
        try press("homeMemberRemovalClose")
        try await waitForFixtureEvent("members_response_held", action: "members", after: heldCount + 1)
        try press("membersListRemovalRecovery")
        try require(label("Removal recorded"))
        _ = try await fault("members", "before", persistent: true)
        let sheet = element("homeMemberRemoval")
        sheet.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.05))
            .press(forDuration: 0.1, thenDragTo: sheet.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95)))
        try require(label("Couldn't load the list"))
        // Release before repeating tab assertions: the real app's request
        // timeout is 20 seconds, including the earlier native interactions.
        _ = try await fixture("release", body: ["action": "members"])
        try await waitForFixtureEvent("members_response_released", action: "members", after: releasedCount + 1)
        try assertUnconfirmedRemovalRoster(context)
        try require(label("Couldn't load the list"))
        try await removalCheckpoint("Interactive dismissal refresh refusal survives older real success and tab changes")
        _ = try await fault("members", "clear")
        let retry = app.buttons["Try again"].firstMatch
        try reveal(retry)
        retry.tap()
        try require(removalMoreActions(context, index: 2))
        XCTAssertFalse(try removalMoreActions(context, index: 1).exists)
        keepScreen("Explicit current roster retry keeps removed member absent")
        try press("membersListRemovalRecovery")
        try require(label("Removal recorded"))
        try acknowledgeRemoval()
        try require(removalMoreActions(context, index: 2))
        try press("membersListRemovalRecovery")
        try require(element("homeMemberRemovalEmpty"))
        try press("homeMemberRemovalClose")
        try await removalSwitch(0)
        try openGlobalRemovalRecovery()
        try require(element("homeMemberRemovalEmpty"))
        let homesReads = try await removalResponses(path: "/api/homes/my-homes")
        try press("homeMemberRemovalClose")
        try await waitRemovalState { state in
            try self.removalRows(state, "events").filter {
                $0["event"] as? String == "response" && $0["path"] as? String == "/api/homes/my-homes" && $0["status"] as? Int == 200
            }.count > homesReads
        }
        let final = try await fixture("state")
        XCTAssertEqual(try removalDigest(initial["removal_commands"]), try removalDigest(final["removal_commands"]))
        XCTAssertEqual(try removalDigest(initial["memberships"]), try removalDigest(final["memberships"]))
        XCTAssertEqual(try removalDigest(initial["audit"]), try removalDigest(final["audit"]))
        XCTAssertEqual(try removalRequestCount(final, path: "/api/homes/member-removals/commands"), 1)
        try await removalCheckpoint("Same dismissal original acknowledged with no additional removal command or membership write")
    }
}

@MainActor
private extension HomeInvitationSenderJourneyUITests {
    func removalRequestCount(_ state: [String: Any], path: String) throws -> Int {
        try removalRows(state, "events").filter { $0["event"] as? String == "request" && $0["path"] as? String == path }.count
    }

    func assertUnconfirmedRemovalRoster(_ context: ProtectedRemovalContext) throws {
        for tab in ["tab.guests", "tab.pending", "tab.members"] {
            try press(tab)
            XCTAssertEqual(element("tab.members").label, "Members")
            XCTAssertEqual(element("tab.guests").label, "Guests")
            XCTAssertEqual(element("tab.pending").label, "Pending")
            XCTAssertFalse(try removalMoreActions(context, index: 1).exists)
            XCTAssertFalse(try removalMoreActions(context, index: 2).exists)
            XCTAssertFalse(app.buttons["Invite member"].exists)
            XCTAssertFalse(element("listOfRowsTopBarAction").exists)
            XCTAssertTrue(element("membersListRemovalRecovery").exists)
        }
    }
}
