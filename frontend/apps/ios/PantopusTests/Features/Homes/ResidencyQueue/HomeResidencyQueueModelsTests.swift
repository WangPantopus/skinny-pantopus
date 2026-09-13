import XCTest
@testable import Pantopus

final class HomeResidencyQueueModelsTests: XCTestCase {
    private typealias Fixtures = HomeResidencyQueueFixtures

    func testNullReferencesRemainUnknownAndNeverInventAnIdentityRoleOrDate() throws {
        var row = Fixtures.item
        for key in ["claimant", "claimed_role", "created_at"] {
            row = Fixtures.changing(row, at: [key], to: .null)
        }
        let claim = try HomeResidencyQueueClaim.parse(row, homeId: Fixtures.home)
        XCTAssertEqual(claim.applicantLabel, "Applicant identity unavailable")
        XCTAssertEqual(claim.roleLabel, "Requested relationship unspecified")
        XCTAssertEqual(claim.dateLabel, "Date unavailable")
        let valid = try Fixtures.parsedPage()
        XCTAssertEqual(valid.claims.first?.applicantLabel, "@public_handle")
        XCTAssertEqual(valid.claims.first?.dateLabel, "Requested 2026-09-13 (UTC)")
    }

    func testPrivateFieldsAndMalformedReferencesFailTheWholeCollection() {
        let mutations: [([String], JSONValue?)] = [
            (["claimed_address"], .string("private address")), (["claimant", "name"], .string("private name")),
            (["claimant", "email"], .string("private email")), (["claimant", "id"], .string(Fixtures.actor)),
            (["home_id"], .string(Fixtures.actor)), (["status"], .string("verified")), (["id"], .string("bad")),
            (["created_at"], nil), (["claimed_role"], .string("member")), (["claimant"], .array([])),
            (["claimant", "username"], .string(String(repeating: "x", count: 101)))
        ]
        for (keys, replacement) in mutations {
            XCTAssertThrowsError(try HomeResidencyQueuePage.parse(
                Fixtures.page([Fixtures.changing(Fixtures.item, at: keys, to: replacement)]),
                identity: Fixtures.identity,
                session: Fixtures.session
            ), "Rejected mutation: \(keys)")
        }
    }

    func testCalendarDatesMustBeCanonicalAndActuallyExist() {
        for date in [
            "2026-02-29T01:02:03.123456Z",
            "2026-09-31T01:02:03.123456Z",
            "2026-09-13T24:00:00.123456Z",
            "2026-09-13T01:02:03Z",
            "0000-01-01T01:02:03.123456Z"
        ] {
            XCTAssertThrowsError(try HomeResidencyQueueClaim.parse(
                Fixtures.changing(Fixtures.item, at: ["created_at"], to: .string(date)),
                homeId: Fixtures.home
            ))
        }
        XCTAssertTrue(HomeResidencyQueueValidation.date("2024-02-29T23:59:59.999999Z"))
    }

    func testCollectionRejectsMissingRowsForeignSessionsDuplicatesAndWrongOrder() throws {
        for (keys, value) in [
            (["claims"], JSONValue.null),
            (["actor_id"], .string(Fixtures.applicant)),
            (["residency_session", "home_id"], .string(Fixtures.actor)),
            (["residency_session", "session_scope"], .string(String(repeating: "b", count: 64)))
        ] {
            XCTAssertThrowsError(try HomeResidencyQueuePage.parse(
                Fixtures.changing(Fixtures.page(), at: keys, to: value),
                identity: Fixtures.identity,
                session: Fixtures.session
            ))
        }
        XCTAssertThrowsError(try HomeResidencyQueuePage.parse(
            Fixtures.page([Fixtures.item, Fixtures.item]),
            identity: Fixtures.identity,
            session: Fixtures.session
        ))
        var next = Fixtures.changing(Fixtures.item, at: ["id"], to: .string(Fixtures.home))
        XCTAssertThrowsError(
            try HomeResidencyQueuePage.parse(Fixtures.page([Fixtures.item, next]), identity: Fixtures.identity, session: Fixtures.session),
            "Duplicate applicant"
        )
        next = Fixtures.changing(next, at: ["user_id"], to: .string(Fixtures.actor))
        next = Fixtures.changing(next, at: ["claimant"], to: .null)
        next = Fixtures.changing(next, at: ["created_at"], to: .null)
        XCTAssertEqual(
            try HomeResidencyQueuePage.parse(Fixtures.page([Fixtures.item, next]), identity: Fixtures.identity, session: Fixtures.session)
                .claims.count,
            2
        )
        XCTAssertThrowsError(try HomeResidencyQueuePage.parse(
            Fixtures.page([next, Fixtures.item]),
            identity: Fixtures.identity,
            session: Fixtures.session
        ))
        XCTAssertTrue(try HomeResidencyQueuePage.parse(Fixtures.page([]), identity: Fixtures.identity, session: Fixtures.session).claims
            .isEmpty)
    }
}
