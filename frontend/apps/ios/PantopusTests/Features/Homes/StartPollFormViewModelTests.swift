//
//  StartPollFormViewModelTests.swift
//  PantopusTests
//
//  P2.5 — covers the Start-a-Poll form VM:
//    - per-kind options reconfiguration (yes/no auto-fills, choice kinds
//      keep min 2)
//    - add/remove option bounds (min 2, max 10, locked rows refuse removal)
//    - validation (question length 5..200, options unique + ≥2, close
//      date ≥ 1 hour ahead)
//    - wire-shape: each of the 5 client kinds maps to the right
//      `poll_type` and visibility encoding
//

import XCTest
@testable import Pantopus

@MainActor
final class StartPollFormViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    /// 2026-05-15T12:00:00Z fixed clock.
    private static let fixedNow: Date = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: "2026-05-15T12:00:00.000Z")
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func makeVM(
        kind: StartPollKind = .singleChoice,
        api: APIClient? = nil
    ) -> StartPollFormViewModel {
        let frozen = Self.fixedNow
        var counter = 0
        return StartPollFormViewModel(
            homeId: "home-1",
            api: api ?? makeAPI(),
            kind: kind,
            now: { frozen },
            idGenerator: {
                counter += 1
                return "opt-\(counter)"
            }
        )
    }

    private func futureDate(after seconds: TimeInterval) -> Date {
        Self.fixedNow.addingTimeInterval(seconds)
    }

    // MARK: - Initial pose per kind

    func testInitialPoseChoiceKindsSeedTwoEmptyOptions() {
        for kind in [StartPollKind.singleChoice, .multiChoice, .ranked, .approval] {
            let vm = makeVM(kind: kind)
            XCTAssertEqual(vm.kind, kind, "Kind should be \(kind.label)")
            XCTAssertEqual(vm.options.count, 2)
            XCTAssertTrue(vm.options.allSatisfy { !$0.isLocked }, "Choice kinds must not lock options")
            XCTAssertTrue(vm.options.allSatisfy(\.label.isEmpty))
        }
    }

    func testInitialPoseYesNoAutoFillsLockedOptions() {
        let vm = makeVM(kind: .yesNo)
        XCTAssertEqual(vm.options.count, 2)
        XCTAssertEqual(vm.options[0].label, "Yes")
        XCTAssertEqual(vm.options[1].label, "No")
        XCTAssertTrue(vm.options.allSatisfy(\.isLocked))
    }

    // MARK: - Kind switching reconfigures

    func testSwitchingToYesNoReplacesOptionsWithLockedPair() {
        let vm = makeVM(kind: .singleChoice)
        vm.updateOption(id: vm.options[0].id, to: "Apple")
        vm.updateOption(id: vm.options[1].id, to: "Banana")
        vm.setKind(.yesNo)
        XCTAssertEqual(vm.options.map(\.label), ["Yes", "No"])
        XCTAssertTrue(vm.options.allSatisfy(\.isLocked))
    }

    func testSwitchingFromYesNoSeedsFreshEditableOptions() {
        let vm = makeVM(kind: .yesNo)
        vm.setKind(.multiChoice)
        XCTAssertEqual(vm.options.count, 2)
        XCTAssertTrue(vm.options.allSatisfy { !$0.isLocked })
        XCTAssertTrue(vm.options.allSatisfy(\.label.isEmpty))
    }

    func testSwitchingBetweenChoiceKindsPreservesUserInput() {
        let vm = makeVM(kind: .singleChoice)
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        vm.updateOption(id: vm.options[1].id, to: "Navy")
        vm.setKind(.multiChoice)
        XCTAssertEqual(vm.options.map(\.label), ["Sage", "Navy"])
        vm.setKind(.ranked)
        XCTAssertEqual(vm.options.map(\.label), ["Sage", "Navy"])
        vm.setKind(.approval)
        XCTAssertEqual(vm.options.map(\.label), ["Sage", "Navy"])
    }

    // MARK: - Add / remove option bounds

    func testAddOptionStopsAtMax() {
        let vm = makeVM(kind: .multiChoice)
        for _ in 0..<20 {
            vm.addOption()
        }
        XCTAssertEqual(vm.options.count, StartPollBounds.maxOptions)
    }

    func testRemoveOptionRefusesBelowMin() {
        let vm = makeVM(kind: .singleChoice)
        XCTAssertEqual(vm.options.count, 2)
        vm.removeOption(id: vm.options[0].id)
        XCTAssertEqual(vm.options.count, 2, "Cannot drop below 2 options")
    }

    func testRemoveOptionWorksAboveMin() {
        let vm = makeVM(kind: .singleChoice)
        vm.addOption()
        XCTAssertEqual(vm.options.count, 3)
        let target = vm.options[1].id
        vm.removeOption(id: target)
        XCTAssertEqual(vm.options.count, 2)
        XCTAssertFalse(vm.options.contains { $0.id == target })
    }

    func testYesNoIgnoresAddAndRemove() {
        let vm = makeVM(kind: .yesNo)
        vm.addOption()
        vm.removeOption(id: vm.options[0].id)
        XCTAssertEqual(vm.options.count, 2)
        XCTAssertEqual(vm.options.map(\.label), ["Yes", "No"])
    }

    // MARK: - Validation

    func testQuestionTooShortFails() {
        let vm = makeVM()
        vm.updateQuestion("Hi")
        vm.updateOption(id: vm.options[0].id, to: "A")
        vm.updateOption(id: vm.options[1].id, to: "B")
        vm.closesAt = futureDate(after: 7200)
        XCTAssertNotNil(vm.firstValidationError())
        XCTAssertFalse(vm.isValid)
    }

    func testQuestionTooLongFails() {
        let vm = makeVM()
        vm.updateQuestion(String(repeating: "a", count: 201))
        XCTAssertNotNil(vm.firstValidationError())
    }

    func testMissingCloseDateFails() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour?")
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        vm.updateOption(id: vm.options[1].id, to: "Navy")
        XCTAssertEqual(vm.firstValidationError(), "Pick a close date.")
    }

    func testCloseDateLessThanHourAheadFails() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour?")
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        vm.updateOption(id: vm.options[1].id, to: "Navy")
        vm.closesAt = Self.fixedNow.addingTimeInterval(60 * 30) // 30 minutes
        XCTAssertEqual(
            vm.firstValidationError(),
            "Close date must be at least 1 hour in the future."
        )
    }

    func testDuplicateOptionsFail() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour?")
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        vm.updateOption(id: vm.options[1].id, to: "sage") // case-insensitive duplicate
        vm.closesAt = futureDate(after: 7200)
        XCTAssertEqual(vm.firstValidationError(), "Each option must be unique.")
    }

    func testFewerThanTwoOptionsFails() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour?")
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        // leave second option blank
        vm.closesAt = futureDate(after: 7200)
        XCTAssertEqual(vm.firstValidationError(), "Add at least 2 options.")
    }

    func testValidFormPasses() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour for the living room?")
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        vm.updateOption(id: vm.options[1].id, to: "Navy")
        vm.closesAt = futureDate(after: 7200)
        XCTAssertNil(vm.firstValidationError())
        XCTAssertTrue(vm.isValid)
    }

    func testYesNoSkipsCustomOptionValidation() {
        let vm = makeVM(kind: .yesNo)
        vm.updateQuestion("Replace the dishwasher?")
        vm.closesAt = futureDate(after: 7200)
        XCTAssertNil(vm.firstValidationError())
        XCTAssertTrue(vm.isValid)
    }

    // MARK: - Wire mapping

    func testWireMappingForEachKind() {
        let pairs: [(StartPollKind, String)] = [
            (.singleChoice, "single_choice"),
            (.multiChoice, "multiple_choice"),
            (.ranked, "ranking"),
            (.yesNo, "yes_no"),
            (.approval, "multiple_choice") // collapse on backend
        ]
        for (kind, expected) in pairs {
            let vm = makeVM(kind: kind)
            vm.updateQuestion("Paint colour question?")
            if kind.allowsCustomOptions {
                vm.updateOption(id: vm.options[0].id, to: "Alpha")
                vm.updateOption(id: vm.options[1].id, to: "Beta")
            }
            vm.closesAt = futureDate(after: 7200)
            let request = vm.buildRequest()
            XCTAssertEqual(request.pollType, expected, "Kind \(kind.label)")
            XCTAssertGreaterThanOrEqual(request.options.count, 2)
            XCTAssertNotNil(request.closesAt)
        }
    }

    func testAudienceWireValueAllMembersIsNil() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour question?")
        vm.updateOption(id: vm.options[0].id, to: "A")
        vm.updateOption(id: vm.options[1].id, to: "B")
        vm.closesAt = futureDate(after: 7200)
        let request = vm.buildRequest()
        XCTAssertNil(request.visibility)
    }

    func testAudienceWireValueSelectedMembersEncodesIds() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour question?")
        vm.updateOption(id: vm.options[0].id, to: "A")
        vm.updateOption(id: vm.options[1].id, to: "B")
        vm.closesAt = futureDate(after: 7200)
        vm.toggleMember("user-2")
        vm.toggleMember("user-1")
        let request = vm.buildRequest()
        // Sorted ids — deterministic for the backend.
        XCTAssertEqual(request.visibility, "selected:user-1,user-2")
    }

    func testAnonymousFlagRidesOnVisibility() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour question?")
        vm.updateOption(id: vm.options[0].id, to: "A")
        vm.updateOption(id: vm.options[1].id, to: "B")
        vm.closesAt = futureDate(after: 7200)
        vm.isAnonymous = true
        let request = vm.buildRequest()
        XCTAssertEqual(request.visibility, "anonymous")
    }

    func testAnonymousWithSelectedMembersCombines() {
        let vm = makeVM()
        vm.updateQuestion("Paint colour question?")
        vm.updateOption(id: vm.options[0].id, to: "A")
        vm.updateOption(id: vm.options[1].id, to: "B")
        vm.closesAt = futureDate(after: 7200)
        vm.toggleMember("user-1")
        vm.isAnonymous = true
        let request = vm.buildRequest()
        XCTAssertEqual(request.visibility, "selected:user-1;anonymous")
    }

    // MARK: - Submit path

    func testSubmitFailsAndShakesWhenInvalid() async {
        let vm = makeVM()
        let initialShake = vm.shakeTrigger
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.shakeTrigger, initialShake &+ 1)
        XCTAssertNotNil(vm.toast)
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.isEmpty)
    }

    func testSubmitHappyPathHitsCreatePollEndpoint() async {
        let body = """
        {"poll":{"id":"new-poll","home_id":"home-1","title":"Paint?","poll_type":"single_choice","options":["A","B"],"status":"open"}}
        """
        SequencedURLProtocol.sequence = [.status(201, body: body)]
        let vm = makeVM()
        vm.updateQuestion("Paint colour for living room?")
        vm.updateOption(id: vm.options[0].id, to: "Sage")
        vm.updateOption(id: vm.options[1].id, to: "Navy")
        vm.closesAt = futureDate(after: 7200)

        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(SequencedURLProtocol.capturedRequests.count, 1)
        let req = SequencedURLProtocol.capturedRequests[0]
        XCTAssertEqual(req.url?.path, "/api/homes/home-1/polls")
        XCTAssertEqual(req.httpMethod, "POST")
    }

    // MARK: - Dirty tracking

    func testCleanFormIsNotDirty() {
        let vm = makeVM()
        XCTAssertFalse(vm.isDirty)
    }

    func testTypingQuestionMarksDirty() {
        let vm = makeVM()
        vm.updateQuestion("anything")
        XCTAssertTrue(vm.isDirty)
    }

    func testTogglingAnonymityMarksDirty() {
        let vm = makeVM()
        vm.isAnonymous = true
        XCTAssertTrue(vm.isDirty)
    }
}
