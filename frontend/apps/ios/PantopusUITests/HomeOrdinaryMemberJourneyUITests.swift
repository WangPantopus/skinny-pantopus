import XCTest

/// Real sender/recipient and member first use through the shipped native UI.
/// Shares only the sender driver's normal-login and bounded control helpers;
/// the member-onboarding fixture starts without recipient membership or invites.
extension HomeInvitationSenderJourneyUITests {
    func testOrdinaryMemberAdmissionBeforeTaskPolicyChange() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-baseline")
        let member = try await onboardOrdinaryMember()
        try await openCurrentMemberHome(member, baseline: true)
        try await assertBaselineTaskEntry()
    }

    func testResumeOrdinaryMemberBaselineHomeIdentity() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-baseline-home")
        let inputs = try await fixture("capabilities")
        let state = try await fixture("state")
        let actor = try XCTUnwrap((inputs["actors"] as? [[String: Any]])?.first { $0["index"] as? Int == 1 })
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 1)
        let member = try OrdinaryMemberJourney(
            homeId: XCTUnwrap(inputs["home"] as? String),
            homeName: XCTUnwrap(inputs["home_name"] as? String),
            actorId: XCTUnwrap(actor["id"] as? String),
            actorIndex: 1,
            invitationId: XCTUnwrap((state["commands"] as? [[String: Any]])?.first?["invitation_id"] as? String)
        )
        try await openCurrentMemberHome(member, baseline: true)
        try await assertBaselineTaskEntry()
    }

    func testOrdinaryMemberPrivateTaskFirstUseAndCurrentAccessRecovery() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-first-use")
        let member = try await onboardOrdinaryMember()
        try await openCurrentMemberHome(member)
        let taskId = try await createAndRecoverMemberTask(member)
        try await editAndCompleteMemberTask(member, taskId: taskId)
        try await verifyMemberTaskDenials(member, taskId: taskId)
        let state = try await fixture("state")
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["task_receipts"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual(state["claim_count"] as? Int, 0)
        XCTAssertEqual(state["ownership_claim_count"] as? Int, 0)
    }

    func testResumeOrdinaryMemberTaskAfterInputRepair() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-task-continuation")
        let inputs = try await fixture("capabilities")
        let state = try await fixture("state")
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["tasks"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["task_receipts"] as? [[String: Any]])?.count, 1)
        let actor = try XCTUnwrap((inputs["actors"] as? [[String: Any]])?.first { $0["index"] as? Int == 1 })
        let member = try OrdinaryMemberJourney(
            homeId: XCTUnwrap(inputs["home"] as? String),
            homeName: XCTUnwrap(inputs["home_name"] as? String),
            actorId: XCTUnwrap(actor["id"] as? String),
            actorIndex: 1,
            invitationId: XCTUnwrap((state["commands"] as? [[String: Any]])?.first?["invitation_id"] as? String)
        )
        let task = try XCTUnwrap((state["tasks"] as? [[String: Any]])?.first)
        let taskId = try XCTUnwrap(task["id"] as? String)
        XCTAssertEqual(task["created_by"] as? String, member.actorId)
        XCTAssertEqual(task["home_id"] as? String, member.homeId)
        try await openCurrentMemberHome(member)
        try openMemberTask(member, taskId: taskId)
        try require(label("Shared household first task"))
        try await editAndCompleteMemberTask(member, taskId: taskId)
        try await verifyMemberTaskDenials(member, taskId: taskId)
        let final = try await fixture("state")
        XCTAssertEqual((final["sender_commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((final["commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((final["tasks"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual(
            try JSONSerialization.data(withJSONObject: XCTUnwrap(final["task_receipts"]), options: .sortedKeys),
            try JSONSerialization.data(withJSONObject: XCTUnwrap(state["task_receipts"]), options: .sortedKeys)
        )
        XCTAssertEqual(final["claim_count"] as? Int, 0)
        XCTAssertEqual(final["ownership_claim_count"] as? Int, 0)
        try await createPostRepairMemberTask(member, preserving: final)
    }

    private func assertBaselineTaskEntry() async throws {
        XCTAssertFalse(element("gridTabs_tab_tasks").exists)
        XCTAssertFalse(element("gridTabs_quickAction_view_tasks").exists)
        XCTAssertFalse(app.buttons["Add a task"].exists)
        keepScreen("Ordinary Member Home is accessible but baseline task entry is unavailable")
        let state = try await fixture("state")
        XCTAssertEqual((state["sender_commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((state["tasks"] as? [[String: Any]])?.count, 0)
    }
}

@MainActor
private extension HomeInvitationSenderJourneyUITests {
    struct OrdinaryMemberJourney {
        let homeId: String
        let homeName: String
        let actorId: String
        let actorIndex: Int
        let invitationId: String
    }

    func onboardOrdinaryMember() async throws -> OrdinaryMemberJourney {
        let inputs = try await fixture("capabilities")
        let homeId = try XCTUnwrap(inputs["home"] as? String)
        let homeName = try XCTUnwrap(inputs["home_name"] as? String)
        let actors = try XCTUnwrap(inputs["actors"] as? [[String: Any]])
        let recipient = try XCTUnwrap(actors.first { $0["index"] as? Int == 1 })
        let recipientId = try XCTUnwrap(recipient["id"] as? String)
        let recipientEmail = try XCTUnwrap(recipient["email"] as? String)
        let before = try await fixture("state")
        XCTAssertEqual((before["sender_commands"] as? [[String: Any]])?.count, 0)
        XCTAssertEqual((before["commands"] as? [[String: Any]])?.count, 0)
        XCTAssertEqual((before["invitations"] as? [[String: Any]])?.count, 0)
        XCTAssertFalse((before["memberships"] as? [[String: Any]])?.contains { $0["user_id"] as? String == recipientId } ?? true)
        app.launch()
        if try waitForSurface(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier == "tab.place" {
            try signOutThroughSettings()
        }
        try signIn(0)
        try openMembers()
        try pressMemberButton("Invite member")
        try enter(recipientEmail, into: "inviteMember_email")
        // Do not select or rewrite the role. The shipped form must issue its
        // ordinary Member default, and the reviewed intent must say so.
        try press("homeInvitationSenderPrepare")
        try require(label("Role: member"))
        keepScreen("Shipped native Member invitation reviewed without a preset or role override")
        try confirmPrepared()
        try require(label("Invitation saved"))
        let issued = try await fixture("state")
        let command = try XCTUnwrap((issued["sender_commands"] as? [[String: Any]])?.first)
        XCTAssertEqual(command["action"] as? String, "create")
        XCTAssertEqual(command["state"] as? String, "completed")
        let requestId = try XCTUnwrap(command["request_id"] as? String)
        let links = try await fixture("capabilities")
        let capability = try XCTUnwrap((links["capabilities"] as? [[String: Any]])?.first {
            $0["actor_id"] as? String == recipientId && $0["sender_request_id"] as? String == requestId
        })
        let invitationId = try XCTUnwrap(capability["invitation_id"] as? String)
        XCTAssertEqual(command["invitation_id"] as? String, invitationId)
        let token = try XCTUnwrap(capability["token"] as? String)
        try acknowledge()
        try await coldSwitch(1)
        try app.open(XCTUnwrap(URL(string: "pantopus://invite/" + token)))
        try require(element("homeInvitationAccept"))
        try press("homeInvitationAccept")
        try press("homeInvitationConfirmDecision")
        try require(label("Acceptance saved"))
        try press("homeInvitationAccess")
        try require(element("homeInvitationOpenHome"))
        keepScreen("Actual recipient acceptance has current shared Home access")
        try press("homeInvitationAcknowledge")
        try require(element("tab.place"))
        let accepted = try await fixture("state")
        let membership = try XCTUnwrap((accepted["memberships"] as? [[String: Any]])?.first {
            $0["user_id"] as? String == recipientId
        })
        XCTAssertEqual(membership["role_base"] as? String, "member")
        XCTAssertEqual(membership["is_active"] as? Bool, true)
        XCTAssertEqual(membership["verification_status"] as? String, "verified")
        let decision = try XCTUnwrap((accepted["commands"] as? [[String: Any]])?.first)
        XCTAssertEqual(decision["invitation_id"] as? String, invitationId)
        XCTAssertEqual(decision["actor_id"] as? String, recipientId)
        XCTAssertEqual(decision["action"] as? String, "accept")
        XCTAssertEqual(decision["state"] as? String, "completed")
        return OrdinaryMemberJourney(homeId: homeId, homeName: homeName, actorId: recipientId, actorIndex: 1, invitationId: invitationId)
    }

    func openCurrentMemberHome(_ member: OrdinaryMemberJourney, baseline: Bool = false) async throws {
        try await openFreshMemberHomesList()
        let home = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", member.homeName)).firstMatch
        try reveal(home)
        XCTAssertFalse(label("Ownership verified").exists)
        if baseline {
            try require(label("Residency verified"))
        } else {
            try require(label("Household access"))
            XCTAssertFalse(label("Residency verified").exists)
        }
        XCTAssertFalse(label("Owner role").exists)
        keepScreen(baseline
            ? "Baseline defect: verified household occupancy is incorrectly labeled Residency verified"
            : "Fresh ordinary Member identity separates household access from verification")
        home.tap()
        try require(element("homeDashboard"))
        // The actual dashboard intentionally prefers the street/address over
        // the Home's nickname. This is the owned fixture's source-defined
        // address, not a second Home or a reason to change the app's identity.
        try require(label("Private residency fixture"))
        let state = try await fixture("state")
        let events = try XCTUnwrap(state["events"] as? [[String: Any]])
        XCTAssertTrue(events
            .contains { $0["event"] as? String == "request" && $0["method"] as? String == "GET"
                && $0["path"] as? String == "/api/homes/" + member.homeId + "/dashboard"
            })
    }

    func openFreshMemberHomesList() async throws {
        // Return to the ordinary root UI; reopen My Homes through navigation so
        // membership is freshly read rather than inferred from the saved receipt.
        app.terminate()
        app.launch()
        if try waitForSurface(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier != "tab.place" {
            try signIn(1)
        }
        let before = try await memberRequestCount(path: "/api/homes/my-homes")
        let menu = app.buttons.matching(NSPredicate(format: "identifier IN %@", ["place.menu", "hubMenuButton"])).firstMatch
        try reveal(menu)
        menu.tap()
        try press("navDrawer.item.my-homes")
        try require(element("myHomesList"))
        let loaded = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'saved Home' OR label == 'No saved Homes yet'"))
            .firstMatch
        try require(loaded)
        let after = try await memberRequestCount(path: "/api/homes/my-homes")
        XCTAssertGreaterThan(after, before)
    }

    func memberRequestCount(path: String) async throws -> Int {
        let state = try await fixture("state")
        return try XCTUnwrap(state["events"] as? [[String: Any]]).filter {
            $0["event"] as? String == "request" && $0["method"] as? String == "GET" && $0["path"] as? String == path
        }.count
    }

    func enterMemberText(_ text: String, into identifier: String) throws {
        let field = element(identifier)
        try reveal(field)
        field.tap()
        field.typeKey("a", modifierFlags: .command)
        field.typeText(text)
        let matches = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", text), object: element(identifier))
        guard XCTWaiter.wait(for: [matches], timeout: 5) == .completed else {
            XCTFail("Native task input did not preserve the intended field value")
            throw JourneyFailure.unavailable
        }
    }

    func pressMemberButton(_ title: String) throws {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", title)).firstMatch
        try reveal(button)
        XCTAssertTrue(button.isEnabled)
        button.tap()
    }

    func openMemberTasks() throws {
        try press("gridTabs_quickAction_view_tasks")
        try require(element("householdTasksList"))
    }

    func openMemberTask(_ member: OrdinaryMemberJourney, taskId: String) throws {
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/" + member.homeId + "/tasks/" + taskId)))
        try require(element("householdTaskDetail"))
    }

    func createAndRecoverMemberTask(_ member: OrdinaryMemberJourney) async throws -> String {
        try openMemberTasks()
        try pressMemberButton("Add a task")
        try enterMemberText("Shared household first task", into: "field_title")
        try enterMemberText("A useful household chore created by its ordinary member.", into: "field_notes")
        keepScreen("Ordinary Member task form with current assignment choices")
        _ = try await fault("task_create", "after")
        try pressMemberButton("Save")
        try require(label("Task unavailable"))
        let committed = try await fixture("state")
        let task = try XCTUnwrap((committed["tasks"] as? [[String: Any]])?.first)
        let receipt = try XCTUnwrap((committed["task_receipts"] as? [[String: Any]])?.first)
        let taskId = try XCTUnwrap(task["id"] as? String)
        XCTAssertEqual(task["home_id"] as? String, member.homeId)
        XCTAssertEqual(task["created_by"] as? String, member.actorId)
        XCTAssertEqual(task["visibility"] as? String, "members")
        XCTAssertEqual(receipt["task_id"] as? String, taskId)
        keepScreen("Lost Task creation reply keeps the request recoverable")
        try await openCurrentMemberHome(member)
        try openMemberTasks()
        try pressMemberButton("Add a task")
        try require(element("homeTask.savedRequest"))
        XCTAssertEqual(element("field_title").value as? String, "Shared household first task")
        try pressMemberButton("Retry saved request")
        try require(element("householdTaskDetail"))
        try require(label("Shared household first task"))
        let recovered = try await fixture("state")
        XCTAssertEqual((recovered["tasks"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((recovered["task_receipts"] as? [[String: Any]])?.count, 1)
        let posts = try XCTUnwrap(recovered["events"] as? [[String: Any]]).filter {
            $0["event"] as? String == "request" && $0["method"] as? String == "POST"
                && $0["path"] as? String == "/api/homes/" + member.homeId + "/tasks"
        }
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(Set(posts.compactMap { $0["request_id"] as? String }), try [XCTUnwrap(receipt["request_id"] as? String)])
        for post in posts {
            let hash = try XCTUnwrap(post["request_hash"] as? String)
            XCTAssertEqual(hash.count, 64)
        }
        // Swift Codable may encode JSON keys in another order after restart.
        // SQL protects canonical jsonb intent, not request byte ordering.
        XCTAssertEqual(
            try JSONSerialization.data(withJSONObject: XCTUnwrap(recovered["task_receipts"]), options: .sortedKeys),
            try JSONSerialization.data(withJSONObject: XCTUnwrap(committed["task_receipts"]), options: .sortedKeys)
        )
        XCTAssertEqual(
            try JSONSerialization.data(withJSONObject: XCTUnwrap(recovered["tasks"]), options: .sortedKeys),
            try JSONSerialization.data(withJSONObject: XCTUnwrap(committed["tasks"]), options: .sortedKeys)
        )
        keepScreen("Cold original Task retry opens the exact single saved task")
        return taskId
    }

    func editAndCompleteMemberTask(_ member: OrdinaryMemberJourney, taskId: String) async throws {
        try pressMemberButton("Edit task")
        try require(label("Household members could not be loaded."))
        keepScreen("Denied roster is unavailable while independent unassigned task editing remains ready")
        try enterMemberText("Shared household task updated", into: "field_title")
        try enterMemberText("Updated by the member who created this household task.", into: "field_notes")
        keepScreen("Exact intended title and notes survive ordinary native text entry")
        try pressMemberButton("Save")
        try require(element("householdTaskDetail"))
        try require(label("Shared household task updated"))
        try await openCurrentMemberHome(member)
        try openMemberTasks()
        try require(label("Shared household task updated"))
        try pressMemberButton("Mark done")
        try press("tab.done")
        let row = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Shared household task updated")).firstMatch
        try reveal(row)
        row.tap()
        try require(element("householdTaskDetail"))
        try require(label("Shared household task updated"))
        try require(label("Done"))
        let state = try await fixture("state")
        let task = try XCTUnwrap((state["tasks"] as? [[String: Any]])?.first { $0["id"] as? String == taskId })
        XCTAssertEqual(task["title"] as? String, "Shared household task updated")
        XCTAssertEqual(task["description"] as? String, "Updated by the member who created this household task.")
        XCTAssertEqual(task["status"] as? String, "done")
        XCTAssertFalse(task["completed_at"] is NSNull)
        keepScreen("Ordinary Member edits reopens and completes the same household task")
    }

    func verifyMemberTaskDenials(_ member: OrdinaryMemberJourney, taskId: String) async throws {
        try await refreshTaskAfterMemberScenario(member, mode: "deny_tasks_edit")
        try require(label("Shared household task updated"))
        XCTAssertFalse(app.buttons["Edit task"].exists)
        keepScreen("Task remains readable when its member loses task editing permission")
        try await openCurrentMemberHome(member)
        try openMemberTasks()
        try press("tab.done")
        try require(label("Shared household task updated"))
        XCTAssertFalse(app.buttons["Add a task"].exists)
        XCTAssertFalse(app.buttons["Mark not done"].exists)
        _ = try await fixture("member-scenario", body: ["index": member.actorIndex, "mode": "restore"])
        try openMemberTask(member, taskId: taskId)
        try require(label("Shared household task updated"))
        try await refreshTaskAfterMemberScenario(member, mode: "deny_home_view")
        try require(label("Shared household task updated"))
        keepScreen("Separate current Task permission remains valid when Home view is denied")
        _ = try await fixture("member-scenario", body: ["index": member.actorIndex, "mode": "restore"])
        try await refreshTaskAfterMemberScenario(member, mode: "deny_tasks_view")
        try require(label("Task unavailable"))
        XCTAssertFalse(label("Shared household task updated").exists)
        XCTAssertFalse(app.buttons["Edit task"].exists)
        keepScreen("Task-specific read denial removes the previously visible task")
        _ = try await fixture("member-scenario", body: ["index": member.actorIndex, "mode": "restore"])
        try pressMemberButton("Retry")
        try require(label("Shared household task updated"))
        try await refreshTaskAfterMemberScenario(member, mode: "remove")
        try require(label("Task unavailable"))
        XCTAssertFalse(label("Shared household task updated").exists)
        keepScreen("Removed household membership cannot reopen a historical task")
        try await openFreshMemberHomesList()
        try require(label("No saved Homes yet"))
        XCTAssertFalse(label(member.homeName).exists)
        keepScreen("Fresh My Homes retires the removed household identity")
        _ = try await fixture("member-scenario", body: ["index": member.actorIndex, "mode": "restore"])
        try await openCurrentMemberHome(member)
        try openMemberTask(member, taskId: taskId)
        try require(label("Shared household task updated"))
        keepScreen("Explicit current retry restores the same task after owned access restoration")
    }

    func refreshTaskAfterMemberScenario(_ member: OrdinaryMemberJourney, mode: String) async throws {
        let reads = try await eventCount("sdk_rpc", action: "task_read")
        _ = try await fixture("member-scenario", body: ["index": member.actorIndex, "mode": mode])
        XCUIDevice.shared.press(.home)
        app.activate()
        try await waitForFixtureEvent("sdk_rpc", action: "task_read", after: reads)
    }
}

@MainActor
private extension HomeInvitationSenderJourneyUITests {
    func createPostRepairMemberTask(_ member: OrdinaryMemberJourney, preserving predecessor: [String: Any]) async throws {
        let title = "Prepare household recycling"
        let notes = "Rinse containers and place them in the shared household bin."
        try await openCurrentMemberHome(member)
        try openMemberTasks()
        try pressMemberButton("Add a task")
        try require(label("Household members could not be loaded."))
        try enterMemberText(title, into: "field_title")
        try enterMemberText(notes, into: "field_notes")
        keepScreen("Deliberate second Task has exact useful title and notes before saving")
        _ = try await fault("task_create", "after")
        try pressMemberButton("Save")
        try require(label("Task unavailable"))
        let committed = try await fixture("state")
        XCTAssertEqual((committed["tasks"] as? [[String: Any]])?.count, 2)
        let task = try XCTUnwrap((committed["tasks"] as? [[String: Any]])?.first { $0["title"] as? String == title })
        let taskId = try XCTUnwrap(task["id"] as? String)
        XCTAssertEqual(task["description"] as? String, notes)
        XCTAssertEqual(task["created_by"] as? String, member.actorId)
        XCTAssertEqual(task["home_id"] as? String, member.homeId)
        XCTAssertEqual(task["visibility"] as? String, "members")
        let receipt = try XCTUnwrap((committed["task_receipts"] as? [[String: Any]])?.first { $0["task_id"] as? String == taskId })
        let requestId = try XCTUnwrap(receipt["request_id"] as? String)
        let priorReceipts = try XCTUnwrap(predecessor["task_receipts"] as? [[String: Any]])
        XCTAssertFalse(priorReceipts.contains { $0["request_id"] as? String == requestId })
        try await openCurrentMemberHome(member)
        try openMemberTasks()
        try pressMemberButton("Add a task")
        try require(element("homeTask.savedRequest"))
        XCTAssertEqual(element("field_title").value as? String, title)
        XCTAssertEqual(element("field_notes").value as? String, notes)
        XCTAssertFalse(element("field_title").isEnabled)
        XCTAssertFalse(element("field_notes").isEnabled)
        keepScreen("Corrected second Task input remains exact and locked after cold recovery")
        try pressMemberButton("Retry saved request")
        try require(element("householdTaskDetail"))
        try require(label(title))
        try require(label(notes))
        let final = try await fixture("state")
        XCTAssertEqual((final["sender_commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((final["commands"] as? [[String: Any]])?.count, 1)
        XCTAssertEqual((final["tasks"] as? [[String: Any]])?.count, 2)
        XCTAssertEqual((final["task_receipts"] as? [[String: Any]])?.count, 2)
        for key in ["tasks", "task_receipts"] {
            XCTAssertEqual(
                try JSONSerialization.data(withJSONObject: XCTUnwrap(final[key]), options: .sortedKeys),
                try JSONSerialization.data(withJSONObject: XCTUnwrap(committed[key]), options: .sortedKeys)
            )
        }
        let posts = try XCTUnwrap(final["events"] as? [[String: Any]]).filter {
            $0["event"] as? String == "request" && $0["method"] as? String == "POST"
                && $0["path"] as? String == "/api/homes/" + member.homeId + "/tasks"
        }
        XCTAssertEqual(posts.count, 4)
        XCTAssertEqual(posts.filter { $0["request_id"] as? String == requestId }.count, 2)
        XCTAssertEqual(Set(posts.compactMap { $0["request_id"] as? String }).count, 2)
        keepScreen("Second deliberate original recovers one exact Task and preserves the first receipt")
    }
}
