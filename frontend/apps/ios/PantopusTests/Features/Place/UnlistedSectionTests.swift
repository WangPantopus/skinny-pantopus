//
//  UnlistedSectionTests.swift
//  PantopusTests
//
//  What the Unlisted view-model is allowed to CLAIM about a person's
//  progress. The decoding contract lives in `UnlistedDecodingTests`;
//  these cover the step after it, where a wrong answer is the one the
//  reader actually sees.
//
//  The through-line: every state the row cannot honestly read must land
//  on `.unknown` and say so. A row that renders as "Not started" when we
//  could not read the person's saved progress tells them they have not
//  done something they may well have done — on a surface where the next
//  action is contacting a company about their home address.
//

import XCTest
@testable import Pantopus

@MainActor
final class UnlistedSectionTests: XCTestCase {
    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - What a row may claim

    /// `removals: null` is a FAILED read. No row may fall back to a
    /// confident "Not started" — an empty checklist is a claim we cannot
    /// make when we did not manage to read the checklist.
    func testFailedProgressReadLeavesEveryRowUnknown() async {
        let vm = await Self.loadedViewModel(removals: "null")

        XCTAssertTrue(vm.isProgressUnavailable)
        XCTAssertEqual(vm.rowProgress(brokerId: "whitepages"), .unknown)
        XCTAssertEqual(vm.rowProgress(brokerId: "acxiom"), .unknown)
        XCTAssertNotEqual(vm.rowProgress(brokerId: "whitepages"), .status(.todo))
    }

    /// `[]` is a successful read of "nothing done yet" — a different
    /// fact, and the only one where "Not started" is honest.
    func testEmptyProgressReadIsAnHonestNotStarted() async {
        let vm = await Self.loadedViewModel(removals: "[]")

        XCTAssertFalse(vm.isProgressUnavailable)
        XCTAssertEqual(vm.rowProgress(brokerId: "whitepages"), .status(.todo))
    }

    func testRecordedStepsAreReadBackPerBroker() async {
        let vm = await Self.loadedViewModel(
            removals: """
            [{"broker_id":"whitepages","status":"confirmed",
              "requested_at":"2026-08-01T10:00:00.000Z",
              "confirmed_at":"2026-08-10T10:00:00.000Z"}]
            """
        )

        XCTAssertEqual(vm.rowProgress(brokerId: "whitepages"), .status(.confirmed))
        // A broker with no row really has had nothing recorded.
        XCTAssertEqual(vm.rowProgress(brokerId: "acxiom"), .status(.todo))
    }

    /// A saved status this build cannot read is not progress we may
    /// render. Left as `.status(.unknown)` it would highlight no button
    /// — visually identical to a row the person never touched — and
    /// quietly lose a step they did take.
    func testUnreadableSavedStatusIsUnknownRatherThanSilentlyBlank() async {
        let vm = await Self.loadedViewModel(
            removals: """
            [{"broker_id":"whitepages","status":"astral_projected",
              "requested_at":null,"confirmed_at":null}]
            """
        )

        XCTAssertEqual(vm.rowProgress(brokerId: "whitepages"), .unknown)
        XCTAssertNotEqual(vm.rowProgress(brokerId: "whitepages"), .status(.todo))
        // The top-level card is for a failed READ; this read succeeded.
        XCTAssertFalse(vm.isProgressUnavailable)
    }

    // MARK: - Failure keeps the surface up

    /// A failed load must not collapse the section — the state program
    /// above it is the most valuable thing on the page, and the retry is
    /// how the reader gets back to it.
    func testFailedLoadSurfacesAnErrorStateRatherThanEmptiness() async {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/homes/home-1/unlisted"] = [
            .status(500, body: "{\"error\":\"Could not load your removal list.\"}")
        ]
        let vm = PlaceUnlistedViewModel(homeId: "home-1", api: Self.client())
        await vm.load()

        guard case let .error(message) = vm.state else {
            return XCTFail("A failed load must reach .error, not .loaded")
        }
        XCTAssertFalse(message.isEmpty)
    }

    // MARK: - The state program still leads on a claimed home

    func testLoadedProfileKeepsTheThreeStateAnswersDistinct() async {
        let vm = await Self.loadedViewModel(stateProgram: "null")
        guard case let .loaded(profile) = vm.state else {
            return XCTFail("Expected a loaded profile")
        }
        XCTAssertEqual(profile.stateProgramAnswer, .unconfirmed)
        // …and the method note the view renders verbatim survived.
        XCTAssertTrue(profile.methodNote.hasPrefix("We do not look your address up"))
    }

    // MARK: - Fixtures

    private static func client() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private static func loadedViewModel(
        stateProgram: String = UnlistedSectionTests.stateProgramOR,
        removals: String = "[]"
    ) async -> PlaceUnlistedViewModel {
        SequencedURLProtocol.reset()
        SequencedURLProtocol.routeResponses["/api/homes/home-1/unlisted"] = [
            .status(200, body: profileJSON(stateProgram: stateProgram, removals: removals))
        ]
        let vm = PlaceUnlistedViewModel(homeId: "home-1", api: client())
        await vm.load()
        return vm
    }

    private static let stateProgramOR = """
    {"exists":true,"name":"Address Confidentiality Program (ACP)",
     "url":"https://www.doj.state.or.us/acp/",
     "eligibility":"Oregon residents who survived domestic violence, stalking or trafficking.",
     "source_url":"https://www.doj.state.or.us/acp/","verified_at":"2026-08-27"}
    """

    private static func profileJSON(stateProgram: String, removals: String) -> String {
        """
        {"unlisted":{
          "state":"OR","state_program":\(stateProgram),
          "groups":[{"category":"people_search","label":"People-search sites","brokers":[
            {"id":"whitepages","name":"Whitepages","category":"people_search",
             "exposes":["home_address"],
             "opt_out_url":"https://www.whitepages.com/suppression-requests",
             "method":"web_form","requires_id":false,"requires_email":true,
             "typical_days":7,"note":"Sites relist after a records refresh.",
             "source_url":"https://www.whitepages.com/suppression-requests",
             "verified_at":"2026-08-27"}]},
           {"category":"marketing","label":"Marketing data brokers","brokers":[
            {"id":"acxiom","name":"Acxiom","category":"marketing",
             "exposes":["home_address"],"opt_out_url":"https://www.acxiom.com/optout/",
             "method":"web_form","requires_id":false,"requires_email":true,
             "typical_days":0,"note":"Confirm by email or it never starts.",
             "source_url":"https://www.acxiom.com/optout/","verified_at":"2026-08-27"}]}],
          "broker_count":2,
          "exposure_labels":{"home_address":"Home address"},
          "method_note":"We do not look your address up on these sites.",
          "registry_verified_at":"2026-08-27",
          "removals":\(removals)}}
        """
    }
}
