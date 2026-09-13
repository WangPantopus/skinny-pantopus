import CryptoKit
import XCTest

/// Opt-in protected removal through normal native review and recovery controls.
/// Fixture authority changes use real authorized HTTP, never membership renewal.
extension HomeInvitationSenderJourneyUITests {
    func testProtectedMemberRemovalOriginalsAndCurrentMembership() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-removal-recovery")
        let context = try await protectedRemovalContext()
        let initial = try await fixture("state")
        XCTAssertEqual(try removalRows(initial, "removal_commands").count, 0, "Continue existing originals if a driver attempt stops")
        try await removalSwitch(0)
        try await removalCheckpoint("Initial protected member removal state after normal sign-in")
        try openMembers()
        try press("tab.members")
        try await cancelHeldRemoval(context)
        try await retryCommittedRemoval(context)
        try await rejectChangedRemoval(context)
        try await rejectDeniedRemoval(context)
        try await recoverSelfLeave(context)
        try await verifyProtectedRemovals(initial: initial)
    }

    func testContinueProtectedMemberRemovalAfterAccountSwitch() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-removal-after-account-switch")
        let context = try await protectedRemovalContext()
        let committed = try await fixture("state")
        let commands = try removalRows(committed, "removal_commands")
        XCTAssertEqual(commands.count, 2)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "cancelled" }.count, 1)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "completed" }.count, 1)
        try await recoverCommittedRemoval(context, committed: committed)
        try await rejectChangedRemoval(context)
        try await rejectDeniedRemoval(context)
        try await recoverSelfLeave(context)
        try await verifyProtectedRemovals(initial: committed)
    }

    func testFinishProtectedMemberRemovalCurrentLists() async throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_INVITATION_SENDER_UI_PHASE"] == "member-removal-final-lists")
        let context = try await protectedRemovalContext()
        let initial = try await fixture("state")
        XCTAssertEqual(try removalRows(initial, "removal_commands").count, 5)
        try await removalSwitch(4)
        let count = try await removalResponses(path: "/api/homes/my-homes")
        try openGlobalRemovalRecovery()
        try require(element("homeMemberRemovalEmpty"))
        try press("homeMemberRemovalClose")
        try await verifyDepartedHomeList(context, after: count)
        try await verifyOwnerCurrentList(context)
        try await verifyProtectedRemovals(initial: initial)
    }

    private func verifyProtectedRemovals(initial: [String: Any]) async throws {
        let final = try await fixture("state")
        let commands = try removalRows(final, "removal_commands")
        XCTAssertEqual(commands.count, 5)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "completed" }.count, 2)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "cancelled" }.count, 1)
        XCTAssertEqual(commands.filter { $0["state"] as? String == "rejected" }.count, 2)
        for key in ["claims", "review_receipts", "sender_commands", "commands"] {
            XCTAssertEqual(try removalDigest(initial[key]), try removalDigest(final[key]), key)
        }
        XCTAssertFalse(try removalRows(final, "events").contains {
            $0["event"] as? String == "request" &&
                ($0["method"] as? String == "DELETE" || ($0["path"] as? String)?.hasSuffix("/move-out") == true)
        })
        try await removalCheckpoint("Final five protected originals acknowledged")
    }
}

@MainActor
extension HomeInvitationSenderJourneyUITests {
    struct ProtectedRemovalContext {
        let homeId: String
        let homeName: String
        let actors: [[String: Any]]
        func actor(_ index: Int) throws -> [String: Any] {
            try XCTUnwrap(actors.first { $0["index"] as? Int == index })
        }

        func userId(_ index: Int) throws -> String {
            try XCTUnwrap(actor(index)["id"] as? String)
        }

        func username(_ index: Int) throws -> String {
            try XCTUnwrap(actor(index)["username"] as? String)
        }
    }

    func protectedRemovalContext() async throws -> ProtectedRemovalContext {
        let inputs = try await fixture("capabilities")
        XCTAssertEqual(inputs["member_removal_actual"] as? Bool, true)
        XCTAssertEqual(inputs["protected_removal"] as? Bool, true)
        return try ProtectedRemovalContext(
            homeId: XCTUnwrap(inputs["home"] as? String),
            homeName: XCTUnwrap(inputs["home_name"] as? String),
            actors: XCTUnwrap(inputs["actors"] as? [[String: Any]])
        )
    }

    func removalRows(_ state: [String: Any], _ key: String) throws -> [[String: Any]] {
        try XCTUnwrap(state[key] as? [[String: Any]])
    }

    func removalDigest(_ value: Any?) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: XCTUnwrap(value), options: .sortedKeys)
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    func removalCheckpoint(_ name: String) async throws {
        keepScreen(name)
        for endpoint in ["state", "full-state"] {
            let state = try await fixture(endpoint)
            let data = try JSONSerialization.data(withJSONObject: state, options: .sortedKeys)
            let item = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
            item.name = name + " private " + endpoint
            item.lifetime = .keepAlways
            add(item)
        }
    }

    func removalSwitch(_ index: Int) async throws {
        app.terminate()
        app.launch()
        if try waitForSurface(["tab.place", "loginEmailField", "placeLaunchSignIn"]).identifier == "tab.place" {
            let before = try await removalResponses(path: "/api/users/logout")
            try signOutThroughSettings()
            try await waitRemovalState { state in
                try self.removalRows(state, "events").filter {
                    $0["event"] as? String == "response" && $0["path"] as? String == "/api/users/logout" && $0["status"] as? Int == 200
                }.count > before
            }
            app.terminate()
            app.launch()
        }
        try signIn(index)
    }

    func removalResponses(path: String) async throws -> Int {
        let state = try await fixture("state")
        return try removalRows(state, "events").filter {
            $0["event"] as? String == "response" && $0["path"] as? String == path && $0["status"] as? Int == 200
        }.count
    }

    @discardableResult
    func waitRemovalState(_ matches: ([String: Any]) throws -> Bool) async throws -> [String: Any] {
        let deadline = Date().addingTimeInterval(35)
        while Date() < deadline {
            let state = try await fixture("state")
            if try matches(state) { return state }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTFail("Expected exact removal HTTP/SQL boundary did not arrive")
        throw JourneyFailure.unavailable
    }

    func removalMoreActions(_ context: ProtectedRemovalContext, index: Int) throws -> XCUIElement {
        try app.buttons.matching(NSPredicate(format: "label == %@", "More actions for " + (context.username(index)))).firstMatch
    }

    func openRemoval(_ context: ProtectedRemovalContext, index: Int) throws {
        let actions = try removalMoreActions(context, index: index)
        try reveal(actions)
        actions.tap()
        try press("membersList_removeAction")
        try require(element("homeMemberRemovalSubmit"))
        XCTAssertEqual(element("homeMemberRemovalTarget").label, try context.username(index))
        XCTAssertEqual(element("homeMemberRemovalHome").label, context.homeName)
        keepScreen("Current reviewed removal names the exact member and Home")
    }

    func confirmRemoval() throws {
        try press("homeMemberRemovalSubmit")
        try reveal(app.buttons["Cancel"].firstMatch)
        keepScreen("Reviewed removal alert offers visible Cancel and explicit confirmation")
        try press("homeMemberRemovalConfirm")
    }

    func acknowledgeRemoval() throws {
        try press("homeMemberRemovalAcknowledge")
        try require(element("membersListRemovalRecovery"))
    }

    func openGlobalRemovalRecovery() throws {
        let menu = app.buttons.matching(NSPredicate(format: "identifier IN %@", ["place.menu", "hubMenuButton"])).firstMatch
        try reveal(menu)
        menu.tap()
        try press("navDrawer.item.my-homes")
        try reveal(myHomesRemovalRecoveryButton)
        myHomesRemovalRecoveryButton.tap()
    }

    var myHomesRemovalRecoveryButton: XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", "Member removal recovery")).firstMatch
    }

    func command(_ state: [String: Any], actor: String, target: String) throws -> [String: Any] {
        let matches = try removalRows(state, "removal_commands").filter {
            $0["actor_user_id"] as? String == actor && $0["target_user_id"] as? String == target
        }
        return try XCTUnwrap(matches.last)
    }

    func cancelHeldRemoval(_ context: ProtectedRemovalContext) async throws {
        try openRemoval(context, index: 1)
        try press("homeMemberRemovalSubmit")
        let cancel = app.buttons["Cancel"].firstMatch
        try reveal(cancel)
        cancel.tap()
        let initial = try await fixture("state")
        XCTAssertEqual(try removalRows(initial, "removal_commands").count, 0)
        XCTAssertFalse(try removalRows(initial, "events").contains {
            $0["event"] as? String == "request" && $0["path"] as? String == "/api/homes/member-removals/commands"
        })
        keepScreen("Local review Cancel performs zero removal commands")
        let held = try await eventCount("held_before_rpc", action: "removal_submit")
        _ = try await fixture("fault", body: ["action": "removal_submit", "kind": "hold_before", "target_id": context.userId(1)])
        try confirmRemoval()
        try await waitForFixtureEvent("held_before_rpc", action: "removal_submit", after: held)
        try await removalSwitch(0)
        try openMembers()
        try press("membersListRemovalRecovery")
        try require(element("homeMemberRemovalError"))
        try press("homeMemberRemovalCancel")
        try reveal(app.buttons["Cancel"].firstMatch)
        keepScreen("Unseen original cancellation alert offers visible Cancel")
        try press("homeMemberRemovalConfirmCancel")
        try require(label("Attempt cancelled"))
        let cancelled = try await fixture("state")
        XCTAssertEqual(try removalRows(cancelled, "removal_commands").count, 1)
        XCTAssertEqual(try removalDigest(initial["memberships"]), try removalDigest(cancelled["memberships"]))
        XCTAssertEqual(try removalDigest(initial["audit"]), try removalDigest(cancelled["audit"]))
        _ = try await fixture("release", body: ["action": "removal_submit"])
        try await waitRemovalState { state in
            try self.removalRows(state, "events").contains {
                $0["event"] as? String == "sdk_rpc" && $0["action"] as? String == "removal_submit" && $0["state"] as? String == "cancelled"
            }
        }
        try await removalCheckpoint("Unseen original cancellation wins before held submission without membership mutation")
        try acknowledgeRemoval()
        try press("tab.members")
    }

    func retryCommittedRemoval(_ context: ProtectedRemovalContext) async throws {
        try openRemoval(context, index: 1)
        _ = try await fixture("fault", body: ["action": "removal_submit", "kind": "after", "target_id": context.userId(1)])
        try confirmRemoval()
        try require(element("homeMemberRemovalError"))
        let committed = try await fixture("state")
        try await recoverCommittedRemoval(context, committed: committed)
    }

    func recoverCommittedRemoval(_ context: ProtectedRemovalContext, committed: [String: Any]) async throws {
        let originals = try removalRows(committed, "removal_commands").filter { $0["state"] as? String == "completed" }
        XCTAssertEqual(originals.count, 1)
        XCTAssertEqual(originals.first?["actor_user_id"] as? String, try context.userId(0))
        XCTAssertEqual(originals.first?["target_user_id"] as? String, try context.userId(1))
        let requestId = try XCTUnwrap(originals.first?["request_id"] as? String)
        let before = try removalRows(committed, "events").filter {
            $0["event"] as? String == "request" && $0["method"] as? String == "POST" && $0["request_id"] as? String == requestId
        }
        XCTAssertEqual(before.count, 1, "No automatic transient retry for the protected POST")
        try await removalSwitch(2)
        try openGlobalRemovalRecovery()
        try require(element("homeMemberRemovalEmpty"))
        XCTAssertFalse(element("homeMemberRemovalTarget").exists)
        try press("homeMemberRemovalClose")
        try await removalSwitch(0)
        _ = try await fault("removal_read", "before", persistent: true)
        try openMembers()
        try press("membersListRemovalRecovery")
        try require(element("homeMemberRemovalError"))
        try press("homeMemberRemovalRetry")
        try require(label("Removal recorded"))
        let replayed = try await fixture("state")
        let after = try removalRows(replayed, "events").filter {
            $0["event"] as? String == "request" && $0["method"] as? String == "POST" && $0["request_id"] as? String == requestId
        }
        XCTAssertEqual(after.count, 2)
        let hashes = after.compactMap { $0["request_hash"] as? String }
        XCTAssertEqual(hashes.count, 2)
        XCTAssertEqual(Set(hashes).count, 1)
        XCTAssertEqual(try removalDigest(committed["memberships"]), try removalDigest(replayed["memberships"]))
        XCTAssertEqual(try removalDigest(committed["audit"]), try removalDigest(replayed["audit"]))
        _ = try await fault("removal_read", "clear")
        _ = try await fault("members", "before", persistent: true)
        try await removalCheckpoint("Exact original Retry after cold account switch returns historical completion once")
        try acknowledgeRemoval()
        try require(label("Couldn't load the list"))
        XCTAssertFalse(try removalMoreActions(context, index: 1).exists)
        XCTAssertEqual(element("tab.members").label, "Members")
        try press("tab.guests")
        try press("tab.members")
        try require(label("Couldn't load the list"))
        keepScreen("Current roster failure stays unavailable without false zero or restored access")
        _ = try await fault("members", "clear")
        let retry = app.buttons["Try again"].firstMatch
        try reveal(retry)
        retry.tap()
        try require(removalMoreActions(context, index: 2))
        XCTAssertFalse(try removalMoreActions(context, index: 1).exists)
    }

    func rejectChangedRemoval(_ context: ProtectedRemovalContext) async throws {
        try openRemoval(context, index: 2)
        let path = try "/api/homes/" + context.homeId + "/members/" + (context.userId(2)) + "/role"
        try await removalAuthorizedHTTP(0, path: path, body: ["role_base": "guest"])
        try await removalAuthorizedHTTP(0, path: path, body: ["role_base": "member"])
        let before = try await fixture("state")
        try confirmRemoval()
        try require(label("Removal did not proceed"))
        let after = try await fixture("state")
        let result = try command(after, actor: context.userId(0), target: context.userId(2))
        XCTAssertEqual(result["error_code"] as? String, "MEMBER_REMOVAL_CHANGED")
        XCTAssertEqual(try removalDigest(before["memberships"]), try removalDigest(after["memberships"]))
        XCTAssertEqual(try removalDigest(before["audit"]), try removalDigest(after["audit"]))
        try await removalCheckpoint("Actual role changes invalidate the exact original review even after the role returns")
        try acknowledgeRemoval()
    }

    func rejectDeniedRemoval(_ context: ProtectedRemovalContext) async throws {
        try openRemoval(context, index: 3)
        let path = try "/api/homes/" + context.homeId + "/members/" + (context.userId(0)) + "/permissions"
        try await removalAuthorizedHTTP(0, path: path, body: ["permission": "members.manage", "allowed": false])
        let before = try await fixture("state")
        try confirmRemoval()
        try require(label("Removal did not proceed"))
        try await removalSwitch(0)
        try openGlobalRemovalRecovery()
        try require(label("Removal did not proceed"))
        let after = try await fixture("state")
        let result = try command(after, actor: context.userId(0), target: context.userId(3))
        XCTAssertEqual(result["error_code"] as? String, "MEMBERS_MANAGE_REQUIRED")
        XCTAssertEqual(try removalDigest(before["memberships"]), try removalDigest(after["memberships"]))
        XCTAssertEqual(try removalDigest(before["audit"]), try removalDigest(after["audit"]))
        try await removalCheckpoint("Denied manager still recovers its historical refusal after fresh login")
        try press("homeMemberRemovalAcknowledge")
        try require(myHomesRemovalRecoveryButton)
        try await removalAuthorizedHTTP(5, path: path, body: ["permission": "members.manage", "allowed": true])
    }

    func recoverSelfLeave(_ context: ProtectedRemovalContext) async throws {
        try await removalSwitch(4)
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/" + context.homeId + "/dashboard")))
        try require(element("homeDashboard"))
        let settings = app.buttons["Home settings"].firstMatch
        try reveal(settings)
        settings.tap()
        try require(element("homeSettings"))
        keepScreen("Current ordinary-member Home settings before self-leave review")
        let leave = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Leave this home")).firstMatch
        try reveal(leave)
        leave.tap()
        try require(element("homeMemberRemovalSubmit"))
        XCTAssertEqual(element("homeMemberRemovalTarget").label, try context.username(4))
        XCTAssertEqual(element("homeMemberRemovalSubmit").label, "Leave reviewed Home")
        let held = try await eventCount("reply_held", action: "removal_submit")
        _ = try await fixture("fault", body: ["action": "removal_submit", "kind": "hold", "target_id": context.userId(4)])
        try confirmRemoval()
        try await waitForFixtureEvent("reply_held", action: "removal_submit", after: held)
        try await removalSwitch(4)
        let count = try await removalResponses(path: "/api/homes/my-homes")
        try openGlobalRemovalRecovery()
        try require(label("Removal recorded"))
        _ = try await fixture("release", body: ["action": "removal_submit"])
        try await removalCheckpoint("Settings self-leave recovers from My Homes after its household access has ended")
        try press("homeMemberRemovalAcknowledge")
        try require(myHomesRemovalRecoveryButton)
        try await verifyDepartedHomeList(context, after: count)
        try await verifyOwnerCurrentList(context)
    }

    func verifyDepartedHomeList(_ context: ProtectedRemovalContext, after count: Int) async throws {
        try await waitRemovalState { state in
            try self.removalRows(state, "events").filter {
                $0["event"] as? String == "response" && $0["path"] as? String == "/api/homes/my-homes" && $0["status"] as? Int == 200
            }.count > count
        }
        try require(label("Review recorded"))
        XCTAssertFalse(app.staticTexts[context.homeName].exists)
        keepScreen("Fresh My Homes retains recorded history without a current Home card")
    }

    func verifyOwnerCurrentList(_ context: ProtectedRemovalContext) async throws {
        try await removalSwitch(0)
        try openMembers()
        try press("tab.members")
        try require(removalMoreActions(context, index: 2))
        XCTAssertFalse(try removalMoreActions(context, index: 4).exists)
        try press("membersListRemovalRecovery")
        try require(element("homeMemberRemovalEmpty"))
        try press("homeMemberRemovalClose")
    }

    func removalAuthorizedHTTP(_ index: Int, path: String, body: [String: Any]) async throws {
        let inputs = try await fixture("capabilities")
        let actor = try XCTUnwrap((inputs["actors"] as? [[String: Any]])?.first { $0["index"] as? Int == index })
        var token = actor["auth_token"] as? String
        if token == nil {
            var login = try URLRequest(url: XCTUnwrap(URL(string: "http://127.0.0.1:18084/api/users/login")))
            login.httpMethod = "POST"
            login.setValue("application/json", forHTTPHeaderField: "Content-Type")
            login.httpBody = try JSONSerialization.data(withJSONObject: [
                "email": XCTUnwrap(actor["email"] as? String),
                "password": "synthetic-loopback-only"
            ])
            let (data, response) = try await URLSession.shared.data(for: login)
            XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
            token = try (JSONSerialization.jsonObject(with: data) as? [String: Any])?["accessToken"] as? String
        }
        var request = try URLRequest(url: XCTUnwrap(URL(string: "http://127.0.0.1:18084" + path)))
        request.httpMethod = "POST"
        try request.setValue("Bearer " + XCTUnwrap(token), forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: request)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    }
}
