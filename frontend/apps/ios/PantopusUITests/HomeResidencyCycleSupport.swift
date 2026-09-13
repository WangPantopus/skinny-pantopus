import XCTest

@MainActor
extension HomeResidencyHistoryJourneyUITests {
    func cyclePhase(_ phase: String) throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["HOME_RESIDENCY_HISTORY_UI_PHASE"] == "cycle-" + phase)
    }

    func cycleEqual<Value: Equatable>(
        _ actual: Value,
        _ expected: Value,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(actual, expected, file: file, line: line)
    }

    func cycleRows(_ state: [String: Any], _ key: String) throws -> [[String: Any]] {
        try XCTUnwrap(state[key] as? [[String: Any]])
    }

    func cycleActor(_ index: Int) throws -> [String: Any] {
        try XCTUnwrap(actors.first { $0["index"] as? Int == index })
    }

    func cycleClaim() async throws -> [String: Any] {
        let actor = try XCTUnwrap(cycleActor(2)["id"] as? String)
        let state = try await fixture("state")
        let rows = try cycleRows(state, "claims").filter { $0["user_id"] as? String == actor }
        XCTAssertEqual(rows.count, 1)
        return try XCTUnwrap(rows.first)
    }

    func cycleMembership() async throws -> [String: Any] {
        let actor = try XCTUnwrap(cycleActor(2)["id"] as? String)
        let state = try await fixture("state")
        let rows = try cycleRows(state, "memberships").filter { $0["user_id"] as? String == actor }
        XCTAssertEqual(rows.count, 1)
        return try XCTUnwrap(rows.first)
    }

    func cycleCounts(submissions: Int, decisions: Int, removals: Int) async throws {
        let state = try await fixture("state")
        XCTAssertEqual(try cycleRows(state, "submission_commands").count, submissions)
        XCTAssertEqual(try cycleRows(state, "review_receipts").count, decisions)
        XCTAssertEqual(try cycleRows(state, "removal_commands").count, removals)
    }

    func cyclePress(_ control: XCUIElement) throws {
        try reveal(control)
        XCTAssertTrue(control.isEnabled)
        control.tap()
    }

    func cycleMyHomes() throws {
        let menu = app.buttons.matching(NSPredicate(format: "identifier IN %@", ["place.menu", "hubMenuButton"])).firstMatch
        try cyclePress(menu)
        try press("navDrawer.item.my-homes")
    }

    func cycleOpenResidency() async throws {
        let claim = try await cycleClaim()
        let claimId = try XCTUnwrap(claim["id"] as? String)
        let ids = ["myHomes.row_" + home + ".continue", "myResidency.request_" + claimId + ".continue"]
        let control = app.buttons.matching(NSPredicate(format: "identifier IN %@", ids)).firstMatch
        try cyclePress(control)
    }

    func cycleAcknowledgeReview() throws {
        try press("homeResidencyReview.acknowledge")
        let ids = ["homeResidencyReview.empty", "homeResidencyReview.noPendingClaim"]
        try reveal(app.descendants(matching: .any).matching(NSPredicate(format: "identifier IN %@", ids)).firstMatch)
        try press("homeResidencyReview.close")
        try press("homeClaimReview.residencyRecovery")
        try require(element("homeResidencyReview.empty"))
        try press("homeResidencyReview.close")
        try press("homeClaimReview.residencyHistory")
    }

    func cycleQueue() throws {
        try app.open(XCTUnwrap(URL(string: "pantopus://homes/" + home + "/members?tab=requests")))
        try require(element("membersListInvitationRecovery"))
        try cyclePress(app.buttons["Review residency claims"].firstMatch)
        try press("homeClaimReview_tab_residency")
    }

    func cyclePrepareAddress() async throws {
        let inputs = try await fixture("capabilities")
        let address = try XCTUnwrap(inputs["address"] as? [String: Any])
        if !element("addHome_street").waitForExistence(timeout: 2) {
            try cyclePress(app.buttons["Add address manually"].firstMatch)
        }
        for (field, key) in [("street", "street"), ("unit", "unit"), ("city", "city"), ("state", "state"), ("zip", "zip_code")] {
            let value = try XCTUnwrap(address[key] as? String)
            if value.isEmpty {
                let control = element("addHome_" + field)
                try require(control)
                let current = control.value as? String ?? ""
                XCTAssertTrue(current.isEmpty || current == control.placeholderValue)
                continue
            }
            try enter(value, into: "addHome_" + field)
            try press("addHomeKeyboardDone")
        }
        try press("wizardPrimaryCTA")
        if element("addHomeClaimedCorrect").waitForExistence(timeout: 8) {
            try press("addHomeClaimedCorrect")
            try require(element("addHomeClaimedAddressLabel"))
            XCTAssertTrue(try element("addHomeClaimedAddressLabel").label.contains(XCTUnwrap(address["street"] as? String)))
            try press("addHomeClaimedConfirmAddress")
        } else {
            try require(label("Address recognized"))
            try press("wizardPrimaryCTA")
        }
        try cyclePress(app.buttons["Household member"].firstMatch)
        XCTAssertFalse(element("addHome_accessSecret").exists)
        try press("wizardPrimaryCTA")
        try require(label("Review and submit"))
        keepScreen("Fresh native original reviews the exact Home and household relationship")
    }

    func cycleOpenReview(_ claim: [String: Any], approve: Bool) async throws {
        try cycleQueue()
        let cards = app.otherElements.matching(identifier: "homeClaimReview_residencyCard")
        try require(cards.firstMatch)
        XCTAssertEqual(cards.count, 1)
        let id = approve ? "homeClaimReview_residencyApprove" : "homeClaimReview_residencyReject"
        try cyclePress(cards.firstMatch.buttons[id])
        try require(element("homeResidencyReview.claimStatus"))
        let state = try await fixture("state")
        let claimId = try XCTUnwrap(claim["id"] as? String)
        let requests = try cycleRows(state, "events").filter { $0["event"] as? String == "request" }
        XCTAssertTrue(requests.contains {
            $0["method"] as? String == "GET" && ($0["path"] as? String)?.hasSuffix("/claim/" + claimId + "/review") == true
        })
    }

    func cycleConfirmReview() throws {
        let confirmation = element("homeResidencyReview.reviewed")
        try reveal(confirmation)
        XCTAssertEqual(confirmation.value as? String, "0")
        confirmation.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        XCTAssertEqual(confirmation.value as? String, "1")
    }

    func cycleOwnDecision(actor: Int, approved: Bool) async throws {
        try expectCount(1)
        let saved = try await receipts(actor: actor)
        XCTAssertEqual(saved.count, 1)
        let receiptId = try XCTUnwrap(saved.first?["id"] as? String)
        try press("homeResidencyHistory.row." + receiptId)
        try require(label(approved ? "Approval recorded" : "Rejection recorded"))
        try require(label("Current household access has not been checked."))
        if approved { try require(label("Recorded role: Member")) }
    }
}
