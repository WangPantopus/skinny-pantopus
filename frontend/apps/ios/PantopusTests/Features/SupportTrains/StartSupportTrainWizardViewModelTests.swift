//
//  StartSupportTrainWizardViewModelTests.swift
//  PantopusTests
//
//  P2.6 — Drives the Start-a-Support-Train wizard VM through every step
//  state (loading the first step gate, slot generation, launch happy
//  path, launch error). Mirrors the Ceremonial Mail wizard test shape
//  so the SequencedURLProtocol sequence stays the spec.
//

import XCTest
@testable import Pantopus

// swiftlint:disable force_unwrapping

@MainActor
final class StartSupportTrainWizardViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(),
            retryPolicy: .none
        )
    }

    private func waitFor(
        _ description: String,
        timeout: TimeInterval = 15.0,
        _ predicate: @MainActor () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if predicate() { return }
            try? await Task.sleep(nanoseconds: 25_000_000)
        }
        XCTFail("Timed out waiting for \(description)")
    }

    private func makeVM() -> StartSupportTrainWizardViewModel {
        let calendar = Calendar(identifier: .gregorian)
        let start = calendar.date(from: DateComponents(year: 2026, month: 5, day: 19))!
        let end = calendar.date(from: DateComponents(year: 2026, month: 5, day: 25))!
        return StartSupportTrainWizardViewModel(api: makeAPI(), startDate: start, endDate: end)
    }

    // MARK: - Step gating

    func testInitialStepIsWhoAndWhyAndCtaIsDisabled() {
        let vm = makeVM()
        XCTAssertEqual(vm.step, .whoAndWhy)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue")
    }

    func testFillingBeneficiaryAndReasonEnablesContinue() {
        let vm = makeVM()
        vm.updateBeneficiaryQuery("Chen family")
        vm.updateReason("Welcoming a new baby — meals would be wonderful.")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        XCTAssertTrue(vm.canAdvanceFromWhoAndWhy)
    }

    func testInviteRecipientBranchUpdatesCtaAndSearchAgain() {
        let vm = makeVM()
        vm.updateBeneficiaryQuery(StartSupportTrainSampleData.inviteQuery)
        vm.selectReason(.baby)
        XCTAssertTrue(vm.isInviteRecipientBranch)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Send invite & continue")
        XCTAssertEqual(vm.chrome.secondaryCTA?.label, "Search again")
        XCTAssertEqual(vm.inviteCandidate?.typedName, StartSupportTrainSampleData.inviteQuery)
        vm.secondaryTapped()
        XCTAssertEqual(vm.beneficiaryQuery, "")
        XCTAssertNil(vm.inviteCandidate)
    }

    func testReasonClampsAtCharLimit() {
        let vm = makeVM()
        let overflow = String(repeating: "a", count: 600)
        vm.updateReason(overflow)
        XCTAssertEqual(vm.reason.count, StartSupportTrainWizardViewModel.reasonCharLimit)
    }

    // MARK: - Slot generation

    func testSlotGenerationProducesOnePerDayInRange() throws {
        let calendar = Calendar(identifier: .gregorian)
        let start = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 5, day: 19)))
        let end = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 5, day: 21)))
        let slots = StartSupportTrainSlotGenerator.generate(
            startDate: start,
            endDate: end,
            durationMinutes: 60,
            startHour: 17,
            calendar: calendar
        )
        XCTAssertEqual(slots.count, 3)
        XCTAssertEqual(slots.first?.startTime, "17:00")
        XCTAssertEqual(slots.first?.endTime, "18:00")
        XCTAssertEqual(slots.first?.dateKey, "2026-05-19")
        XCTAssertEqual(slots.last?.dateKey, "2026-05-21")
    }

    func testEditingDatesInStepTwoUpdatesPreview() throws {
        let vm = makeVM()
        XCTAssertEqual(vm.generatedSlots.count, 7)
        let calendar = Calendar.current
        let newEnd = try XCTUnwrap(calendar.date(byAdding: .day, value: -3, to: vm.endDate))
        vm.setEndDate(newEnd)
        XCTAssertEqual(vm.generatedSlots.count, 4)
    }

    func testSlotGenerationClampsAt90Days() throws {
        let calendar = Calendar(identifier: .gregorian)
        let start = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))
        let end = try XCTUnwrap(calendar.date(byAdding: .day, value: 200, to: start))
        let slots = StartSupportTrainSlotGenerator.generate(
            startDate: start,
            endDate: end,
            durationMinutes: 60,
            startHour: 17,
            calendar: calendar
        )
        XCTAssertEqual(slots.count, 90)
    }

    func testEndBeforeStartCollapsesEndIntoStart() {
        let vm = makeVM()
        let earlier = vm.startDate.addingTimeInterval(-60 * 60 * 24 * 3)
        vm.setEndDate(earlier)
        XCTAssertEqual(vm.endDate, vm.startDate)
        XCTAssertEqual(vm.generatedSlots.count, 1)
    }

    // MARK: - Wizard transitions

    func testAdvancingThroughAllStepsReachesReview() {
        let vm = makeVM()
        vm.updateBeneficiaryQuery("Chen family")
        vm.updateReason("Welcoming a new baby — meals would be wonderful.")
        vm.primaryTapped()
        XCTAssertEqual(vm.step, .whatAndWhen)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue")
        vm.primaryTapped()
        XCTAssertEqual(vm.step, .reviewAndLaunch)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Launch train")
    }

    func testBackTravelsToPreviousStep() {
        let vm = makeVM()
        vm.updateBeneficiaryQuery("Chen family")
        vm.updateReason("Welcoming a new baby.")
        vm.primaryTapped()
        XCTAssertEqual(vm.step, .whatAndWhen)
        vm.leadingTapped()
        XCTAssertEqual(vm.step, .whoAndWhy)
    }

    func testCloseFromFirstStepDismissesWizard() {
        let vm = makeVM()
        vm.leadingTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    // MARK: - Launch happy path

    func testLaunchCreatesTrainAddsSlotsPublishesAndEmitsOpenEvent() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: "{\"id\":\"train_demo\"}"),
            .status(201, body: "{}"),
            .status(201, body: "{}"),
            .status(201, body: "{}"),
            .status(201, body: "{}"),
            .status(201, body: "{}"),
            .status(201, body: "{}"),
            .status(201, body: "{}"),
            .status(200, body: "{}")
        ]
        let vm = makeVM()
        vm.updateBeneficiaryQuery("Chen family")
        vm.updateReason("Welcoming a new baby.")
        vm.primaryTapped() // → whatAndWhen
        vm.primaryTapped() // → reviewAndLaunch
        vm.primaryTapped() // launch
        await waitFor("publish completes") { vm.step == .success }
        XCTAssertEqual(vm.publishedTrainId, "train_demo")
        XCTAssertEqual(vm.step, .success)
        vm.primaryTapped() // open
        XCTAssertEqual(vm.pendingEvent, .openTrain(trainId: "train_demo"))
    }

    func testLaunchErrorSurfacesMessageAndStaysOnReviewStep() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"INTERNAL\",\"message\":\"Boom\"}")
        ]
        let vm = makeVM()
        vm.updateBeneficiaryQuery("Chen family")
        vm.updateReason("Welcoming a new baby.")
        vm.primaryTapped()
        vm.primaryTapped()
        vm.primaryTapped()
        await waitFor("error surfaces") { vm.launchError != nil }
        XCTAssertEqual(vm.step, .reviewAndLaunch)
        XCTAssertNotNil(vm.launchError)
    }
}

// swiftlint:enable force_unwrapping
