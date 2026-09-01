//
//  UnlistedDecodingTests.swift
//  PantopusTests
//
//  The decoding contract for Unlisted (Wave 4). Three things here are
//  not ordinary DTO coverage — they are the product invariants stated as
//  tests, because getting any of them wrong misinforms someone who is
//  on this surface because of a specific person:
//
//  * `state_program: null` must NOT decode into the same answer as
//    `exists: false`. "We did not check" and "this state runs none" are
//    different claims and only one of them is ours to make.
//  * `removals: null` (the read failed) must NOT decode into the same
//    thing as `[]` (nothing done yet), and neither may be confused with
//    the key being absent altogether (the anonymous profile).
//  * A server value this build has never seen degrades one field —
//    never the whole list.
//

import XCTest
@testable import Pantopus

@MainActor
final class UnlistedDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    // MARK: - The profile

    func testDecodesExposureProfile() throws {
        let response = try decoder.decode(
            UnlistedProfileResponse.self,
            from: Data(Self.fullProfileJSON.utf8)
        )
        let profile = response.unlisted

        XCTAssertEqual(profile.state, "OR")
        XCTAssertEqual(profile.brokerCount, 2)
        XCTAssertEqual(profile.groups.count, 2)
        XCTAssertEqual(profile.groups[0].label, "People-search sites")
        XCTAssertEqual(profile.groups[0].category, .peopleSearch)

        let broker = profile.groups[0].brokers[0]
        XCTAssertEqual(broker.id, "whitepages")
        XCTAssertEqual(broker.method, .webForm)
        XCTAssertTrue(broker.requiresEmail)
        XCTAssertFalse(broker.requiresId)
        XCTAssertEqual(broker.optOutUrl, "https://www.whitepages.com/suppression-requests")
        XCTAssertEqual(broker.statedProcessingDays, 7)
        // The caveat is the point of the row — it must survive decoding whole.
        XCTAssertTrue(broker.note.contains("relist"))

        // `method_note` is the honesty line the UI renders verbatim.
        XCTAssertTrue(profile.methodNote.hasPrefix("We do not look your address up"))
        XCTAssertEqual(profile.registryVerifiedAt, "2026-08-27")

        // Exposure tokens resolve through the server's own label map.
        XCTAssertEqual(profile.exposureLabel("home_address"), "Home address")
        // …and an unmapped token still reads as English rather than a slug.
        XCTAssertEqual(profile.exposureLabel("boat_registration"), "Boat registration")
    }

    /// `typical_days: 0` means the site publishes NO processing time.
    /// "0 days" would read as instant, which is the opposite of true.
    func testZeroTypicalDaysIsNotStatedRatherThanZero() throws {
        let profile = try Self.decodeProfile(Self.fullProfileJSON)
        let unstated = profile.groups[1].brokers[0]
        XCTAssertEqual(unstated.typicalDays, 0)
        XCTAssertNil(unstated.statedProcessingDays)
    }

    // MARK: - The three state-program answers

    func testStateProgramExistsIsItsOwnAnswer() throws {
        let profile = try Self.decodeProfile(Self.fullProfileJSON)
        guard case let .program(program) = profile.stateProgramAnswer else {
            return XCTFail("A program with exists:true must decode to .program")
        }
        XCTAssertEqual(program.name, "Address Confidentiality Program (ACP)")
        XCTAssertEqual(program.url, "https://www.doj.state.or.us/acp/")
        XCTAssertTrue(program.eligibility.contains("Oregon residents"))
        XCTAssertEqual(program.verifiedAt, "2026-08-27")
    }

    /// `exists: false` is a REAL answer: we checked, and the state runs
    /// none. `eligibility` then carries what the state does offer, so it
    /// must not be dropped.
    func testStateProgramExistsFalseKeepsWhatTheStateDoesOffer() throws {
        let json = Self.profileJSON(
            stateProgram: """
            {"exists":false,"name":"","url":"",
             "eligibility":"Wyoming has not enacted one. Address protection is available case-by-case through a court order.",
             "source_url":"https://example.org/survey","verified_at":"2026-08-27"}
            """
        )
        let profile = try Self.decodeProfile(json)
        guard case let .noProgram(program) = profile.stateProgramAnswer else {
            return XCTFail("exists:false must decode to .noProgram, never .unconfirmed")
        }
        XCTAssertEqual(program.exists, false)
        XCTAssertTrue(program.name.isEmpty)
        XCTAssertTrue(program.eligibility.contains("court order"))
    }

    /// The same collapse by a different route: a `state_program` object
    /// that does not carry `exists` at all. Defaulting the missing field
    /// to `false` would print "your state does not run a program" off a
    /// value we never read — indistinguishable, to the reader, from us
    /// having checked. It must fall to `.unconfirmed`.
    func testStateProgramMissingExistsIsUnconfirmedNotNone() throws {
        let profile = try Self.decodeProfile(
            Self.profileJSON(
                stateProgram: """
                {"name":"","url":"","eligibility":"",
                 "source_url":"https://example.org/s","verified_at":"2026-08-27"}
                """
            )
        )
        // The object decoded — we simply have no answer off it.
        XCTAssertNotNil(profile.stateProgram)
        XCTAssertNil(profile.stateProgram?.exists)
        XCTAssertEqual(profile.stateProgramAnswer, .unconfirmed)
        if case .noProgram = profile.stateProgramAnswer {
            XCTFail("A missing `exists` must never render as 'this state has none'")
        }
    }

    /// And the null-valued form of the same field.
    func testStateProgramNullExistsIsUnconfirmedNotNone() throws {
        let profile = try Self.decodeProfile(
            Self.profileJSON(
                stateProgram: """
                {"exists":null,"name":"","url":"","eligibility":"",
                 "source_url":"https://example.org/s","verified_at":"2026-08-27"}
                """
            )
        )
        XCTAssertEqual(profile.stateProgramAnswer, .unconfirmed)
    }

    /// The one that matters most: `null` means WE DID NOT CHECK. It must
    /// never collapse into "your state has none" — that tells someone in
    /// danger that no help exists when we simply did not look.
    func testNullStateProgramIsUnconfirmedNotNone() throws {
        let profile = try Self.decodeProfile(Self.profileJSON(stateProgram: "null"))
        XCTAssertNil(profile.stateProgram)
        XCTAssertEqual(profile.stateProgramAnswer, .unconfirmed)

        // And the two are genuinely distinguishable from each other.
        let checked = try Self.decodeProfile(
            Self.profileJSON(
                stateProgram: """
                {"exists":false,"name":"","url":"","eligibility":"None enacted.",
                 "source_url":"https://example.org/s","verified_at":"2026-08-27"}
                """
            )
        )
        XCTAssertNotEqual(checked.stateProgramAnswer, profile.stateProgramAnswer)
    }

    // MARK: - removals: null vs [] vs absent

    func testRemovalsNullMeansTheReadFailedNotAnEmptyChecklist() throws {
        let profile = try Self.decodeProfile(Self.profileJSON(removals: "null"))
        XCTAssertEqual(profile.removals, .unavailable)
        // Nothing may be claimed about any broker's progress.
        XCTAssertNil(profile.removals.rows)
        XCTAssertNil(profile.removal(forBrokerId: "whitepages"))
    }

    func testEmptyRemovalsMeansNothingDoneYet() throws {
        let profile = try Self.decodeProfile(Self.profileJSON(removals: "[]"))
        XCTAssertEqual(profile.removals, .recorded([]))
        XCTAssertEqual(profile.removals.rows?.count, 0)
        XCTAssertNotEqual(profile.removals, .unavailable)
    }

    func testRecordedRemovalsDecodeWithTheirStamps() throws {
        let json = Self.profileJSON(
            removals: """
            [{"broker_id":"whitepages","status":"requested",
              "requested_at":"2026-08-20T10:00:00.000Z","confirmed_at":null},
             {"broker_id":"acxiom","status":"confirmed",
              "requested_at":"2026-08-01T10:00:00.000Z","confirmed_at":"2026-08-10T10:00:00.000Z"}]
            """
        )
        let profile = try Self.decodeProfile(json)
        XCTAssertEqual(profile.removals.rows?.count, 2)
        XCTAssertEqual(profile.removal(forBrokerId: "whitepages")?.status, .requested)
        XCTAssertNil(profile.removal(forBrokerId: "whitepages")?.confirmedAt)
        XCTAssertEqual(profile.removal(forBrokerId: "acxiom")?.status, .confirmed)
        XCTAssertEqual(profile.removal(forBrokerId: "acxiom")?.confirmedAt, "2026-08-10T10:00:00.000Z")
        XCTAssertNil(profile.removal(forBrokerId: "never-touched"))
    }

    /// The anonymous profile carries no `removals` key at all — which is
    /// a third thing again, and must not read as a failed read.
    func testAbsentRemovalsKeyIsNotApplicable() throws {
        let response = try decoder.decode(
            PublicUnlistedResponse.self,
            from: Data(Self.publicReadyJSON.utf8)
        )
        XCTAssertEqual(response.status, .ready)
        XCTAssertEqual(response.place?.state, "OR")
        XCTAssertEqual(response.unlisted?.removals, .notApplicable)
        XCTAssertNotEqual(response.unlisted?.removals, .unavailable)
    }

    func testUnsupportedRegionCarriesAMessageAndNoProfile() throws {
        let json = """
        {"status":"unsupported_region","tier":"preview",
         "message":"Address removal help is U.S.-only for now"}
        """
        let response = try decoder.decode(PublicUnlistedResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.status, .unsupportedRegion)
        XCTAssertNil(response.unlisted)
        XCTAssertEqual(response.message, "Address removal help is U.S.-only for now")
    }

    func testCouldNotPlaceIsNotAGeographicDenial() throws {
        // The server used to collapse "could not read a state out of that"
        // into "you are outside the U.S." — a confident geographic denial
        // shown to someone standing in Portland. They are different
        // answers, and only this one still carries the whole removal list.
        let json = """
        {"status":"could_not_place","tier":"preview",
         "message":"We could not tell which state that is",
         "place":{"city":null,"state":null},
         "unlisted":{"state":null,"state_program":null,"groups":[],"broker_count":19,
           "exposure_labels":{},"method_note":"We do not look your address up on these sites.",
           "registry_verified_at":null}}
        """
        let response = try decoder.decode(PublicUnlistedResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.status, .couldNotPlace)
        // The distinction is the point — never the non-US branch.
        XCTAssertNotEqual(response.status, .unsupportedRegion)
        // The removal paths are national and never needed the address.
        XCTAssertEqual(response.unlisted?.brokerCount, 19)
        // And the state answer degrades to "not checked", never "none".
        XCTAssertNil(response.unlisted?.stateProgram)
    }

    // MARK: - Unknown server vocabulary degrades, never throws

    func testUnknownEnumValuesDegradeSafely() throws {
        let json = """
        {"unlisted":{
          "state":"OR","state_program":null,
          "groups":[{"category":"telepathic_registry","label":"Telepathic registries","brokers":[
            {"id":"mindsearch","name":"MindSearch","category":"telepathic_registry",
             "exposes":["home_address"],"opt_out_url":"https://example.org/out",
             "method":"carrier_pigeon","requires_id":false,"requires_email":false,
             "typical_days":0,"note":"n","source_url":"https://example.org","verified_at":"2026-08-27"}]}],
          "broker_count":1,"exposure_labels":{"home_address":"Home address"},
          "method_note":"We do not look your address up on these sites.",
          "registry_verified_at":"2026-08-27",
          "removals":[{"broker_id":"mindsearch","status":"astral_projected",
                       "requested_at":null,"confirmed_at":null}]}}
        """
        let profile = try decoder.decode(UnlistedProfileResponse.self, from: Data(json.utf8)).unlisted

        // The row still renders — only the unrecognised fields degrade.
        XCTAssertEqual(profile.groups.count, 1)
        XCTAssertEqual(profile.groups[0].category, .unknown)
        XCTAssertEqual(profile.groups[0].label, "Telepathic registries")
        XCTAssertEqual(profile.groups[0].brokers[0].name, "MindSearch")
        XCTAssertEqual(profile.groups[0].brokers[0].method, .unknown)
        // An unknown status is never mistaken for progress.
        XCTAssertEqual(profile.removal(forBrokerId: "mindsearch")?.status, .unknown)
        XCTAssertFalse(UnlistedRemovalStatus.selectable.contains(.unknown))
    }

    // MARK: - Fixtures

    private static func decodeProfile(_ json: String) throws -> UnlistedExposureProfile {
        try JSONDecoder().decode(UnlistedProfileResponse.self, from: Data(json.utf8)).unlisted
    }

    private static let stateProgramOR = """
    {"exists":true,"name":"Address Confidentiality Program (ACP)",
     "url":"https://www.doj.state.or.us/acp/",
     "eligibility":"Oregon residents who survived domestic violence, sexual assault, stalking or trafficking.",
     "source_url":"https://www.doj.state.or.us/acp/","verified_at":"2026-08-27"}
    """

    private static let groupsJSON = """
    [{"category":"people_search","label":"People-search sites","brokers":[
       {"id":"whitepages","name":"Whitepages","category":"people_search",
        "exposes":["home_address","phone","relatives"],
        "opt_out_url":"https://www.whitepages.com/suppression-requests",
        "method":"web_form","requires_id":false,"requires_email":true,"typical_days":7,
        "note":"Removing the listing does not stop a new one appearing; people relist after a records refresh.",
        "source_url":"https://www.whitepages.com/suppression-requests","verified_at":"2026-08-27"}]},
     {"category":"marketing","label":"Marketing data brokers","brokers":[
       {"id":"acxiom","name":"Acxiom","category":"marketing","exposes":["home_address","email"],
        "opt_out_url":"https://www.acxiom.com/optout/","method":"web_form",
        "requires_id":false,"requires_email":true,"typical_days":0,
        "note":"You must click the confirmation email or the request never starts.",
        "source_url":"https://www.acxiom.com/optout/","verified_at":"2026-08-27"}]}]
    """

    // Mirrors backend/services/unlistedService.js. The second clause used
    // to claim the registry was exhaustive; it is not.
    private static let methodNote = """
    We do not look your address up on these sites — searching them would hand them your address. \
    These are the 19 sites we have verified a working removal path for — there are more we have not got to yet.
    """

    private static func profileJSON(
        stateProgram: String = UnlistedDecodingTests.stateProgramOR,
        removals: String = "[]"
    ) -> String {
        """
        {"unlisted":{
          "state":"OR","state_program":\(stateProgram),
          "groups":\(groupsJSON),"broker_count":2,
          "exposure_labels":{"home_address":"Home address","phone":"Phone number",
                             "relatives":"Relatives and household members","email":"Email address"},
          "method_note":"\(methodNote.replacingOccurrences(of: "\n", with: " "))",
          "registry_verified_at":"2026-08-27",
          "removals":\(removals)}}
        """
    }

    private static let fullProfileJSON = profileJSON()

    private static let publicReadyJSON = """
    {"status":"ready","tier":"preview","place":{"city":"Portland","state":"OR"},
     "unlisted":{"state":"OR","state_program":\(stateProgramOR),
       "groups":\(groupsJSON),"broker_count":2,
       "exposure_labels":{"home_address":"Home address"},
       "method_note":"We do not look your address up on these sites.",
       "registry_verified_at":"2026-08-27"},
     "disclaimer":"We did not save this address."}
    """
}
