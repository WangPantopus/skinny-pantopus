//
//  BallotP0Tests.swift
//  PantopusTests
//
//  Ballot P0 (docs/ballot-implementation-plan-2026-09-24.md): the card
//  fields decode from `civic_election` only when the server sends them;
//  a malformed ballot field never blanks the election section; a notice
//  needs only its lead; the Place request opts into Ballot; the timeline
//  places markers exactly as the canvas (and the web) does, moving only a
//  label that would overprint another or leave the card; the dashboard
//  drops the election row the card replaces.
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

    func testAnElectionDayNoticeNeedsOnlyItsLead() throws {
        let withDetail = card.replacingOccurrences(
            of: "\"election_day_notice\":null",
            with: "\"election_day_notice\":{\"lead\":\"Return by 8 p.m. today.\",\"detail\":\"Use a drop box.\"}"
        )
        let both = try XCTUnwrap(election(intelligence(withDetail)).ballotCard?.electionDayNotice)
        XCTAssertEqual(both.lead, "Return by 8 p.m. today.")
        XCTAssertEqual(both.detail, "Use a drop box.")

        let leadOnly = card.replacingOccurrences(
            of: "\"election_day_notice\":null",
            with: "\"election_day_notice\":{\"lead\":\"Return by 8 p.m. today.\"}"
        )
        let notice = try XCTUnwrap(election(intelligence(leadOnly)).ballotCard?.electionDayNotice)
        XCTAssertEqual(notice.lead, "Return by 8 p.m. today.")
        XCTAssertNil(notice.detail)
    }

    func testPlaceIntelligenceRequestsOptIntoBallot() {
        XCTAssertEqual(PlaceEndpoints.intelligence(homeId: "home-1").query, ["ballot": "1"])
        XCTAssertEqual(
            PlaceEndpoints.intelligence(homeId: "home-1", sections: [.civicElection]).query,
            ["ballot": "1", "sections": "civic_election"]
        )
        XCTAssertEqual(PlaceEndpoints.intelligence(homeId: "home-1").path, "/api/homes/home-1/intelligence")
    }

    // MARK: Timeline label repair (the shared spec's vectors, from real state deadlines)

    /// A timeline deadline as the server sends it.
    private func deadline(
        _ key: String,
        _ label: String,
        _ date: String,
        _ monthDay: String,
        days: Int,
        needsAction: Bool = true
    ) throws -> BallotDeadline {
        let json = """
        {"key":"\(key)","label":"\(label)","date":"\(date)","month_day":"\(monthDay)","days_until":\(days),
         "needs_action":\(needsAction),"timeline":true,"detail":null}
        """
        return try decoder.decode(BallotDeadline.self, from: Data(json.utf8))
    }

    /// Where a timeline marker's label is expected: its key, x, row, anchor and slide.
    private struct Spot {
        let key: String
        let x: CGFloat
        let side: BallotTimelineLayout.Side
        let anchor: BallotTimelineLayout.Anchor
        let dx: CGFloat

        init(_ key: String, _ x: CGFloat, _ side: BallotTimelineLayout.Side, _ anchor: BallotTimelineLayout.Anchor, dx: CGFloat = 0) {
            self.key = key
            self.x = x
            self.side = side
            self.anchor = anchor
            self.dx = dx
        }
    }

    private func assertMarkers(
        _ layout: BallotTimelineLayout?,
        _ expected: [Spot],
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let markers = try XCTUnwrap(layout, file: file, line: line).markers
        XCTAssertEqual(markers.map(\.key), expected.map(\.key), file: file, line: line)
        for (marker, spot) in zip(markers, expected) {
            XCTAssertEqual(marker.x, spot.x, accuracy: 0.01, "\(spot.key) x", file: file, line: line)
            XCTAssertEqual(marker.side, spot.side, "\(spot.key) side", file: file, line: line)
            XCTAssertEqual(marker.anchor, spot.anchor, "\(spot.key) anchor", file: file, line: line)
            XCTAssertEqual(marker.dx, spot.dx, accuracy: 0.01, "\(spot.key) dx", file: file, line: line)
        }
    }

    func testTimelineLeavesACleanLayoutAsTheCanvasHasIt() throws {
        // WA on Sep 24 at 326: nothing collides, so the repair pass changes nothing.
        let deadlines = try [
            deadline("ballots_mailed", "Ballots mailed", "2026-10-16", "Oct 16", days: 22, needsAction: false),
            deadline("register_online_mail", "Register by", "2026-10-26", "Oct 26", days: 32),
            deadline("return_by", "By 8 p.m.", "2026-11-03", "Nov 3", days: 40)
        ]
        try assertMarkers(
            BallotTimelineLayout.make(deadlines: deadlines, today: "2026-09-24", width: 326),
            [
                Spot("today", 8, .below, .start),
                Spot("ballots_mailed", 178.5, .above, .middle),
                Spot("register_online_mail", 256, .below, .middle),
                Spot("return_by", 318, .above, .end)
            ]
        )
    }

    func testTimelineMovesAnOverprintingLabelToItsOwnRow() throws {
        // OR on Oct 10 at 326: registration (Oct 13) and ballots mailed (Oct 14) are a day apart, and
        // the legacy pass left both above the track, printing over each other.
        let deadlines = try [
            deadline("register_online_mail", "Register by", "2026-10-13", "Oct 13", days: 3),
            deadline("ballots_mailed", "Ballots mailed", "2026-10-14", "Oct 14", days: 4, needsAction: false),
            deadline("return_by", "By 8 p.m.", "2026-11-03", "Nov 3", days: 24)
        ]
        try assertMarkers(
            BallotTimelineLayout.make(deadlines: deadlines, today: "2026-10-10", width: 326),
            [
                Spot("today", 8, .below, .start),
                Spot("register_online_mail", 46.75, .above, .middle),
                Spot("ballots_mailed", 59.67, .below, .start),
                Spot("return_by", 318, .above, .end)
            ]
        )
    }

    func testTimelineSlidesALabelAlongItsRowWhenNothingElseClears() throws {
        // OR on Oct 13 (today IS the registration deadline): both neighbours crowd the left edge, so
        // "Ballots mailed" slides 30.24pt right of its marker (12pt clear of "Today"), below the track.
        let deadlines = try [
            deadline("register_online_mail", "Register by", "2026-10-13", "Oct 13", days: 0),
            deadline("ballots_mailed", "Ballots mailed", "2026-10-14", "Oct 14", days: 1, needsAction: false),
            deadline("return_by", "By 8 p.m.", "2026-11-03", "Nov 3", days: 21)
        ]
        let layout = BallotTimelineLayout.make(deadlines: deadlines, today: "2026-10-13", width: 326)
        try assertMarkers(
            layout,
            [
                Spot("today", 8, .below, .start),
                Spot("register_online_mail", 8, .above, .start),
                Spot("ballots_mailed", 22.76, .below, .start, dx: 30.24),
                Spot("return_by", 318, .above, .end)
            ]
        )
        // The slide is drawn: text starts at the marker's x, less the 4 nudge, plus dx.
        XCTAssertEqual(try XCTUnwrap(layout?.markers[2]).textX, 49, accuracy: 0.01)
    }

    func testTimelineKeepsALongLabelNearTheEdgeOnTheCard() throws {
        // HI on Oct 25 at 326: "Paper forms by 4:30 p.m." (24 characters) centred on x = 42 ran off the left edge.
        let deadlines = try [
            deadline("register_online_mail", "Paper forms by 4:30 p.m.", "2026-10-26", "Oct 26", days: 1),
            deadline("return_by", "By 7 p.m.", "2026-11-03", "Nov 3", days: 9)
        ]
        try assertMarkers(
            BallotTimelineLayout.make(deadlines: deadlines, today: "2026-10-25", width: 326),
            [
                Spot("today", 8, .below, .start),
                Spot("register_online_mail", 42.44, .above, .start),
                Spot("return_by", 318, .above, .end)
            ]
        )
    }

    func testTimelineIsReadAloudWithTheReturnDeadlinesNoun() throws {
        let ballot = try XCTUnwrap(election(intelligence(card)).ballotCard)
        XCTAssertEqual(
            BallotTimelineLayout.accessibilityDescription(deadlines: ballot.deadlines, today: "2026-09-24"),
            "Timeline: today, Sep 24; ballots mailed Oct 16; register by Oct 26; return by 8 p.m. Nov 3"
        )
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

    func testStackDrawsOneLayerPerGovernment() {
        XCTAssertEqual(BallotStackGeometry.layers(for: 0), 1)
        XCTAssertEqual(BallotStackGeometry.layers(for: 5), 5)
        XCTAssertEqual(BallotStackGeometry.layers(for: 14), 9)
        // The peel board's home line starts 10 above the top layer: 212 for five.
        XCTAssertEqual(BallotStackGeometry.lineTop(layers: 5), 212)
    }

    func testStoryKeepsTheBoardsTiming() {
        let story = BallotStory(steps: 5)
        XCTAssertEqual(story.duration, 7.2, accuracy: 0.0001)
        // Government 1: hidden at 0, in by 0.18 s, held to 1.02 s, gone by 1.2 s.
        XCTAssertEqual(story.presence(0, at: 0), 0)
        XCTAssertEqual(story.presence(0, at: 0.18), 1)
        XCTAssertEqual(story.presence(0, at: 0.6), 1)
        XCTAssertEqual(story.lift(0, at: 0.6), -8)
        XCTAssertLessThan(story.presence(0, at: 1.1), 1)
        XCTAssertEqual(story.presence(0, at: 1.2), 0)
        // Government 2 takes its turn 1.2 s later.
        XCTAssertEqual(story.presence(1, at: 1.0), 0)
        XCTAssertEqual(story.presence(1, at: 1.8), 1)
        // The finished frame arrives after the last government and holds.
        XCTAssertEqual(story.presence(5, at: 6.0), 0)
        XCTAssertEqual(story.presence(5, at: 6.5), 1)
        XCTAssertEqual(story.presence(5, at: .infinity), 1)
        XCTAssertEqual(story.presence(4, at: .infinity), 0)
        XCTAssertEqual(story.bar(at: 3.6), 0.5, accuracy: 0.0001)
        XCTAssertEqual(story.bar(at: .infinity), 1)
        XCTAssertEqual(BallotGovernmentsView.overline(2, of: 5, minimum: true), "Government 2 of at least 5")
        XCTAssertEqual(BallotGovernmentsView.overline(2, of: 5, minimum: false), "Government 2 of 5")
    }

    func testFormatting() {
        XCTAssertEqual(BallotFormat.daysLeft(32), "32 days left.")
        XCTAssertEqual(BallotFormat.daysLeft(1), "1 day left.")
        XCTAssertEqual(BallotFormat.daysLeft(0), "Last day.")
        XCTAssertEqual(BallotFormat.asOfDate("2026-09-24T00:00:00.000Z"), "Sep 24")
        XCTAssertNil(BallotFormat.asOfDate(nil))
    }
}
