import XCTest
@testable import Pantopus

final class HomeResidencyHistoryModelsTests: XCTestCase {
    private typealias Fixtures = HomeResidencyHistoryFixtures
    private func parse(_ value: JSONValue) throws -> HomeResidencyHistoryItem {
        try HomeResidencyHistoryItem.parse(value, identity: Fixtures.identity)
    }

    private func page(_ value: JSONValue, after: HomeResidencyHistoryCursor? = nil) throws -> HomeResidencyHistoryPage {
        try HomeResidencyHistoryPage.parse(value, identity: Fixtures.identity, session: Fixtures.session, after: after)
    }

    func testRecordedRejectionAndCurrentPendingClaimRemainDistinct() throws {
        let item = try parse(Fixtures.item())
        XCTAssertEqual(item.action, .reject)
        XCTAssertEqual(item.currentClaimStatus, "pending")
        XCTAssertEqual(item.decisionLabel, "Rejection recorded")
        XCTAssertEqual(item.applicantLabel, "Current applicant: @current_person")
        XCTAssertNil(item.role)
        XCTAssertNil(item.occupancyId)
    }

    func testEveryCanonicalRoleIsHistoricalDisplayOnlyAndUnknownLegacyStaysUnknown() throws {
        XCTAssertEqual(HomeResidencyHistoryRole.allCases.count, 8)
        for role in HomeResidencyHistoryRole.allCases {
            let raw = Fixtures.changing(Fixtures.item(approved: true), at: ["decision", "result", "role_base"], to: .string(role.rawValue))
            XCTAssertEqual(try parse(raw).role, role)
            XCTAssertFalse(role.label.isEmpty)
        }
        var legacy = Fixtures.changing(Fixtures.item(approved: true), at: ["decision", "result", "role_base"], to: .null)
        legacy = Fixtures.changing(legacy, at: ["decision", "legacy_request"], to: .bool(true))
        let item = try parse(legacy)
        XCTAssertNil(item.role)
        XCTAssertTrue(item.legacyRequest)
        XCTAssertNotNil(item.occupancyId)
    }

    func testNullCurrentProfileDoesNotInventHistoricalIdentity() throws {
        let raw = Fixtures.changing(Fixtures.item(), at: ["current", "applicant"], to: .null)
        let item = try parse(raw)
        XCTAssertNil(item.currentApplicantId)
        XCTAssertNil(item.currentUsername)
        XCTAssertEqual(item.applicantLabel, "Current applicant identity unavailable")
    }

    func testRejectsSecretOrUnrecordedFieldsAtEveryEnvelopeLevel() {
        let paths = [
            ["request_id"], ["decision", "review_token"], ["decision", "reason"], ["decision", "result", "payload_hash"],
            ["current", "review_note"], ["current", "applicant", "email"]
        ]
        for path in paths {
            XCTAssertThrowsError(
                try parse(Fixtures.changing(Fixtures.item(), at: path, to: .string("unexpected"))),
                path.joined(separator: ".")
            )
        }
        XCTAssertThrowsError(try page(Fixtures.changing(Fixtures.page(), at: ["review_token"], to: .string("unexpected"))))
    }

    func testRejectsForeignIdentityMissingFieldsAndScalarCoercions() {
        let bad: [([String], JSONValue?)] = [
            (["decision", "actor_id"], .string(Fixtures.applicant)), (["decision", "home_id"], .string(Fixtures.applicant)),
            (["decision", "claim_id"], .string("not-a-uuid")), (["decision", "id"], .null),
            (["decision", "action"], .array([.string("reject")])), (["decision", "legacy_request"], .number(0)),
            (["decision", "legacy_request"], .string("false")), (["decision", "result", "role_base"], nil),
            (["current", "claim_status"], .array([.string("pending")])), (["current", "household_access"], .string("active")),
            (["current", "applicant_lookup"], .string("snapshot")), (["current", "applicant", "name"], .string("private name")),
            (["current", "applicant", "username"], .array([.string("username")])),
            (["current", "applicant", "username"], .string(String(repeating: "x", count: 101)))
        ]
        for (path, value) in bad {
            XCTAssertThrowsError(try parse(Fixtures.changing(Fixtures.item(), at: path, to: value)), path.joined(separator: "."))
        }
    }

    func testRejectsInconsistentResultWithoutDefaultingRole() {
        for value: JSONValue in [.string("tenant"), .array([.string("member")]), .number(1), .bool(false)] {
            XCTAssertThrowsError(try parse(Fixtures.changing(
                Fixtures.item(approved: true),
                at: ["decision", "result", "role_base"],
                to: value
            )))
        }
        XCTAssertThrowsError(try parse(Fixtures.changing(
            Fixtures.item(approved: true),
            at: ["decision", "result", "occupancy_id"],
            to: .null
        )))
        XCTAssertThrowsError(try parse(Fixtures.changing(Fixtures.item(), at: ["decision", "result", "role_base"], to: .string("member"))))
        XCTAssertThrowsError(try parse(Fixtures.changing(
            Fixtures.item(),
            at: ["decision", "result", "occupancy_id"],
            to: .string(Fixtures.id(20))
        )))
        XCTAssertThrowsError(try parse(Fixtures.changing(Fixtures.item(), at: ["decision", "result", "status"], to: .string("verified"))))
    }

    func testDatesRejectRolloverAndPreserveMicrosecondOrdering() throws {
        for date in [
            "2026-02-29T00:00:00.000001Z",
            "2026-09-31T00:00:00.000001Z",
            "2026-00-01T00:00:00.000001Z",
            "2026-09-13T24:00:00.000001Z",
            "2026-09-13T00:60:00.000001Z",
            "2026-09-13T00:00:60.000001Z",
            "2026-09-13T00:00:00Z",
            "2026-09-13T00:00:00.123Z",
            "2026-09-13T00:00:00.123456+00:00"
        ] {
            XCTAssertThrowsError(try parse(Fixtures.changing(Fixtures.item(), at: ["decision", "created_at"], to: .string(date))))
        }
        for date in ["2024-02-29T00:00:00Z", "2026-09-13T00:00:00.1-07:00", "2026-09-13T00:00:00.123456+00:00"] {
            XCTAssertNoThrow(try parse(Fixtures.changing(Fixtures.item(), at: ["decision", "result", "reviewed_at"], to: .string(date))))
        }
        let newer = Fixtures.changing(Fixtures.item(0), at: ["decision", "created_at"], to: .string("2026-09-13T01:02:03.123457Z"))
        let result = try page(Fixtures.page([newer, Fixtures.item(1)]))
        XCTAssertEqual(result.items.map(\.id), [Fixtures.id(0), Fixtures.id(1)])
    }

    func testReviewedDateUsesRealGregorianCalendarAndBoundedTimeZone() {
        for date in [
            "1900-02-29T00:00:00Z",
            "2026-09-13T00:00:00+24:00",
            "2026-09-13T00:00:00-00:60",
            "0000-01-01T00:00:00Z",
            "2026-09-13T00:00:00.1234567Z"
        ] {
            XCTAssertThrowsError(try parse(Fixtures.changing(
                Fixtures.item(),
                at: ["decision", "result", "reviewed_at"],
                to: .string(date)
            )))
        }
        XCTAssertNoThrow(try parse(Fixtures.changing(
            Fixtures.item(),
            at: ["decision", "result", "reviewed_at"],
            to: .string("2000-02-29T00:00:00Z")
        )))
    }

    func testSessionRequiresExactActorScalarScopeAndFieldSet() {
        for (path, value) in [
            (["actor_id"], JSONValue.string(Fixtures.applicant)),
            (["session_scope"], .string(String(repeating: "A", count: 64))),
            (["session_scope"], .array([.string(Fixtures.session.scope)])),
            (["token"], .string("extra"))
        ] {
            XCTAssertThrowsError(try HomeResidencyHistorySession.parse(
                Fixtures.changing(Fixtures.sessionJSON, at: path, to: value),
                actorId: Fixtures.actor
            ))
        }
        XCTAssertThrowsError(try page(Fixtures.changing(
            Fixtures.page(),
            at: ["session", "session_scope"],
            to: .string(String(repeating: "b", count: 64))
        )))
    }

    func testAuthorizedEmptyIsDistinctFromMissingMalformedOrOversizedItems() throws {
        XCTAssertTrue(try page(Fixtures.page([])).items.isEmpty)
        for value: JSONValue? in [nil, .null, .object([:]), .array(Array(repeating: Fixtures.item(), count: 21))] {
            XCTAssertThrowsError(try page(Fixtures.changing(Fixtures.page(), at: ["items"], to: value)))
        }
    }

    func testSameTimeRowsRequireStrictDescendingUniqueUUIDs() throws {
        XCTAssertEqual(try page(Fixtures.page([Fixtures.item(2), Fixtures.item(1), Fixtures.item(0)])).items.count, 3)
        XCTAssertThrowsError(try page(Fixtures.page([Fixtures.item(1), Fixtures.item(2)])))
        XCTAssertThrowsError(try page(Fixtures.page([Fixtures.item(1), Fixtures.item(1)])))
        let after = try HomeResidencyHistoryCursor.parse(Fixtures.cursor(1), identity: Fixtures.identity)
        XCTAssertNoThrow(try page(Fixtures.page([Fixtures.item(0)]), after: after))
        XCTAssertThrowsError(try page(Fixtures.page([Fixtures.item(1)]), after: after))
        XCTAssertThrowsError(try page(Fixtures.page([Fixtures.item(2)]), after: after))
    }

    func testCursorRequiresCanonicalActorHomeDateAndEncoding() throws {
        XCTAssertEqual(try HomeResidencyHistoryCursor.parse(Fixtures.cursor(1), identity: Fixtures.identity).id, Fixtures.id(1))
        for cursor in [
            "",
            Fixtures.cursor(1) + "=",
            String(repeating: "a", count: 601),
            Fixtures.cursor(1, actor: Fixtures.applicant),
            Fixtures.cursor(1, home: Fixtures.applicant),
            Fixtures.cursor(1, date: "2026-09-13T01:02:03.123Z"),
            Fixtures.base64("{\"version\":true}"),
            Fixtures.base64("{\"version\":1}")
        ] {
            XCTAssertThrowsError(try HomeResidencyHistoryCursor.parse(cursor, identity: Fixtures.identity))
        }
        let canonicalBytes = Data(base64Encoded: Fixtures.cursor(1).replacingOccurrences(of: "-", with: "+").replacingOccurrences(
            of: "_",
            with: "/"
        ) + "==")
        if let canonicalBytes, let text = String(data: canonicalBytes, encoding: .utf8) {
            XCTAssertThrowsError(try HomeResidencyHistoryCursor.parse(Fixtures.base64(" " + text), identity: Fixtures.identity))
            XCTAssertThrowsError(try HomeResidencyHistoryCursor.parse(
                Fixtures.base64(text.replacingOccurrences(of: "\"version\":1", with: "\"version\":1.0")),
                identity: Fixtures.identity
            ))
        } else { XCTFail("Test cursor must decode") }
    }

    func testNextCursorMustBeLastOfFullPageAndCannotLoop() throws {
        let values = (1...20).reversed().map { Fixtures.item($0) }
        let valid = Fixtures.page(values, next: .string(Fixtures.cursor(1)))
        XCTAssertEqual(try page(valid).nextCursor?.id, Fixtures.id(1))
        XCTAssertThrowsError(try page(Fixtures.page([Fixtures.item(1)], next: .string(Fixtures.cursor(1)))))
        XCTAssertThrowsError(try page(Fixtures.page(values, next: .string(Fixtures.cursor(2)))))
        XCTAssertThrowsError(try page(Fixtures.changing(valid, at: ["next_cursor"], to: .bool(false))))
        let after = try HomeResidencyHistoryCursor.parse(Fixtures.cursor(1), identity: Fixtures.identity)
        XCTAssertThrowsError(try page(valid, after: after))
    }

    func testDetailMustMatchTheSelectedReceipt() {
        XCTAssertThrowsError(try HomeResidencyHistoryItem.parse(Fixtures.item(), identity: Fixtures.identity, receiptId: Fixtures.id(1)))
    }
}
