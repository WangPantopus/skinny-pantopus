//
//  BallotP0Tests.swift
//  PantopusTests
//
//  Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md): the card
//  fields decode from `civic_election` only when the server sends them;
//  a malformed ballot field never blanks the election section; the
//  timeline places markers exactly as the canvas (and the web) does; the
//  dashboard drops the election row the card replaces.
//

import XCTest
@testable import Pantopus

@MainActor
final class BallotP0Tests: XCTestCase {
    private let decoder = JSONDecoder()

    private func intelligence(_ electionData: String) throws -> PlaceIntelligence {
        let json = """
        {"place":{"label":"415 NE Everett St, Camas","line1":"415 NE Everett St","city":"Camas","state":"WA","postal_code":"98607"},
         "tier":"T3","region_supported":true,"generated_at":"2026-09-24T16:00:00Z",
         "groups":[{"group":"civic","label":"Civic","sections":[
           {"id":"civic_districts","group":"civic","band":"A","access":"available","status":"ready","as_of":null,
            "source":"U.S. Census Bureau","coverage":"full","unavailable_reason":null,
            "data":{"districts":[],"representatives":[]}},
           {"id":"civic_election","group":"civic","band":"A","access":"available","status":"ready",
            "as_of":"2026-09-24T00:00:00.000Z","source":"Washington Secretary of State","coverage":"full",
            "unavailable_reason":null,"data":\(electionData)}]}]}
        """
        return try decoder.decode(PlaceIntelligence.self, from: Data(json.utf8))
    }

    private let base = """
    "name":"November 3 general election","date":"2026-11-03","days_until":40,"polling_place":null,"ballot":[]
    """

    private var card: String {
        """
        {\(base),"coverage":"supported","phase":"in_season","today":"2026-09-24","title":"Your ballot",
         "subtitle":"November 3 general election","chip":"40 days",
         "line":"This address sits inside at least 5 governments.","note":null,
         "how_it_works":"Everyone here votes by mail.",
         "deadlines":[
           {"key":"ballots_mailed","label":"Ballots mailed","date":"2026-10-16","month_day":"Oct 16","days_until":22,
            "needs_action":false,"timeline":true,"detail":null},
           {"key":"register_online_mail","label":"Register by","date":"2026-10-26","month_day":"Oct 26","days_until":32,
            "needs_action":true,"timeline":true,"detail":"Online or by mail."},
           {"key":"return_by","label":"By 8 p.m.","date":"2026-11-03","month_day":"Nov 3","days_until":40,
            "needs_action":true,"timeline":true,"detail":null},
           {"key":"register_in_person","label":"Register in person","date":"2026-11-03","month_day":"Nov 3",
            "days_until":40,"needs_action":true,"timeline":false,"detail":null}],
         "election_day_notice":null,"primary_action":{"kind":"governments","label":"See your governments"},
         "official_links":[{"key":"registration","label":"Check or update registration","owner":"Secretary of State",
           "url":"https://www.sos.wa.gov/register"}],
         "governments":{"count":5,"count_is_minimum":true,"items":[{"level":"federal","name":"United States"}],
           "summary":"The United States, the state, Clark County, the Camas School District and the City of Camas.",
           "caveat":"Special districts are not counted yet.","source_line":"Boundaries: Census Bureau"},
         "ballot_week":{"show":false},
         "mover_prompt":{"text":"Moved this year? Update your registration online by Oct 26.","days_left":32,
           "url":"https://www.sos.wa.gov/register"},
         "source_line":"Washington Secretary of State","checked_at":"2026-09-24"}
        """
    }

    private func election(_ intel: PlaceIntelligence) throws -> PlaceCivicElectionData {
        let section = intel.groups.flatMap(\.sections).first { $0.id == .civicElection }
        return try XCTUnwrap(section?.civicElection)
    }

    func testDecodesTheBallotCardWhenSent() throws {
        let data = try election(intelligence(card))
        XCTAssertEqual(data.daysUntil, 40)
        let ballot = try XCTUnwrap(data.ballotCard)
        XCTAssertEqual(ballot.coverage, .supported)
        XCTAssertEqual(ballot.phase, .inSeason)
        XCTAssertEqual(ballot.chip, "40 days")
        XCTAssertEqual(ballot.deadlines.map(\.key), ["ballots_mailed", "register_online_mail", "return_by", "register_in_person"])
        XCTAssertEqual(ballot.governments?.count, 5)
        XCTAssertEqual(ballot.governments?.countIsMinimum, true)
        XCTAssertEqual(ballot.officialLinks.first?.owner, "Secretary of State")
        XCTAssertEqual(ballot.moverPrompt?.daysLeft, 32)
    }

    func testKeepsTheOldContractWhenTheFlagIsOff() throws {
        let data = try election(intelligence("{\(base)}"))
        XCTAssertEqual(data.name, "November 3 general election")
        XCTAssertNil(data.ballotCard)
    }

    func testAMalformedBallotFieldNeverBlanksTheSection() throws {
        let broken = card.replacingOccurrences(of: "\"deadlines\":[", with: "\"deadlines\":\"oops\",\"x\":[")
        let data = try election(intelligence(broken))
        XCTAssertEqual(data.daysUntil, 40)
        let ballot = try XCTUnwrap(data.ballotCard)
        XCTAssertTrue(ballot.deadlines.isEmpty)
        XCTAssertEqual(ballot.line, "This address sits inside at least 5 governments.")
    }

    func testTimelinePlacesMarkersLikeTheCanvas() throws {
        let ballot = try XCTUnwrap(election(intelligence(card)).ballotCard)
        let layout = try XCTUnwrap(BallotTimelineLayout.make(deadlines: ballot.deadlines, today: "2026-09-24", width: 326))
        XCTAssertEqual(layout.markers.map(\.key), ["today", "ballots_mailed", "register_online_mail", "return_by"])
        XCTAssertEqual(layout.markers.map(\.x), [8, 178.5, 256, 318])
        XCTAssertEqual(layout.markers.map(\.side), [.below, .above, .below, .above])
        XCTAssertEqual(layout.markers.filter(\.needsAction).map(\.key), ["register_online_mail"])
        XCTAssertEqual(layout.waitUntilX, 178.5)
        XCTAssertEqual(layout.markers.first?.secondLine, "Sep 24")
    }

    func testTimelineIsEmptyOnElectionDay() throws {
        let json = """
        {"key":"return_by","label":"By 8 p.m.","date":"2026-11-03","month_day":"Nov 3","days_until":0,
         "needs_action":true,"timeline":true,"detail":null}
        """
        let returnToday = try decoder.decode(BallotDeadline.self, from: Data(json.utf8))
        XCTAssertNil(BallotTimelineLayout.make(deadlines: [returnToday], today: "2026-11-03", width: 326))
    }

    func testDashboardDropsTheElectionRowTheCardReplaces() throws {
        let intel = try intelligence(card)
        XCTAssertNotNil(PlaceDashboardView.ballot(in: intel))
        let ids = PlaceDashboardView.groups(intel).flatMap(\.sections).map(\.id)
        XCTAssertEqual(ids, [.civicDistricts])

        let plain = try intelligence("{\(base)}")
        XCTAssertNil(PlaceDashboardView.ballot(in: plain))
        XCTAssertEqual(PlaceDashboardView.groups(plain).flatMap(\.sections).map(\.id), [.civicDistricts, .civicElection])
    }

    func testFormatting() {
        XCTAssertEqual(BallotFormat.daysLeft(32), "32 days left.")
        XCTAssertEqual(BallotFormat.daysLeft(1), "1 day left.")
        XCTAssertEqual(BallotFormat.daysLeft(0), "Last day.")
        XCTAssertEqual(BallotFormat.asOfDate("2026-09-24T00:00:00.000Z"), "Sep 24")
        XCTAssertNil(BallotFormat.asOfDate(nil))
    }
}
