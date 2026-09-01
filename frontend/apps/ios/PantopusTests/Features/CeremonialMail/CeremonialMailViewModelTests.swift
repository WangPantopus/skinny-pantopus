//
//  CeremonialMailViewModelTests.swift
//  PantopusTests
//
//  Covers step validation, recipient search, address loading, body
//  validation, and the final POST. Voice-postscript upload is
//  exercised separately to verify it lands on the SendMail payload.
//

import XCTest
@testable import Pantopus

@MainActor
final class CeremonialMailViewModelTests: XCTestCase {
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

    private static let recipientsJSON = """
    {"recipients":[
      {"userId":"u_maya","name":"Maya K.","username":"mayak",
       "homeId":"home_demo","homeAddress":"412 Elm St, Portland",
       "isVerified":true,"isOnPantopus":true}
    ]}
    """

    private static let homeContextJSON = """
    {"homeId":"home_demo","addressDisplay":"412 Elm St, Portland",
     "memberCount":2,"privateDeliveryAvailable":true,
     "members":[{"userId":"u_maya","name":"Maya K.","role":"co_owner"}]}
    """

    private static let sendSuccessJSON = """
    {"message":"Letter sent","mail":{"id":"mail_demo","subject":"A note from a friend","created_at":"2026-05-15T12:00:00Z"}}
    """

    // MARK: - Step gating

    func testInitialStepIsDecideAndCtaIsDisabled() {
        let vm = CeremonialMailViewModel(api: makeAPI())
        XCTAssertEqual(vm.step, .decide)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue")
    }

    func testRecipientSelectionEnablesContinueOnDecideStep() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.recipientsJSON)]
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.updateRecipientQuery("maya")
        await waitFor("recipient search results") { !vm.recipientResults.isEmpty }
        XCTAssertFalse(vm.recipientResults.isEmpty)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.selectRecipient(vm.recipientResults[0])
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        XCTAssertEqual(vm.selectedRecipient?.userId, "u_maya")
    }

    func testContinueFromDecideAdvancesToVerify() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.recipientsJSON),
            .status(200, body: Self.homeContextJSON)
        ]
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.updateRecipientQuery("maya")
        await waitFor("recipient search results") { !vm.recipientResults.isEmpty }
        vm.selectRecipient(vm.recipientResults[0])
        vm.primaryTapped()
        XCTAssertEqual(vm.step, .verify)
        await waitFor("home context") { vm.homeContext?.homeId == "home_demo" }
        XCTAssertEqual(vm.homeContext?.homeId, "home_demo")
    }

    func testVerifyContinueRequiresAddressConfirmation() {
        let vm = vmAtVerifyStep()
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.toggleAddressConfirmed(true)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        vm.primaryTapped()
        XCTAssertEqual(vm.step, .compose)
    }

    func testComposeContinueRequiresNonEmptyBody() async {
        let vm = await vmAtComposeStep()
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.updateBody("Hello!")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        vm.primaryTapped()
        XCTAssertEqual(vm.step, .commit)
    }

    // MARK: - Submit

    func testSubmitFiresSendAndTransitionsToSuccess() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.recipientsJSON),
            .status(200, body: Self.homeContextJSON),
            .status(200, body: Self.sendSuccessJSON)
        ]
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.updateRecipientQuery("maya")
        await waitFor("recipient search results") { !vm.recipientResults.isEmpty }
        vm.selectRecipient(vm.recipientResults[0])
        vm.primaryTapped() // → verify (fires home context fetch)
        await waitFor("home context") { vm.homeContext?.homeId == "home_demo" }
        vm.toggleAddressConfirmed(true)
        vm.primaryTapped() // → compose
        vm.updateBody("Dear Maya, thinking of you.")
        vm.selectStationery(.midnightBlue)
        vm.selectInk(.navy)
        vm.selectSeal(.waxRed)
        vm.primaryTapped() // → commit
        vm.selectSendTiming(.morning)
        vm.primaryTapped() // submit
        await waitFor("submit success") { vm.step == .success }
        XCTAssertEqual(vm.step, .success)
        if case let .openMail(mailId) = vm.pendingEvent {
            XCTAssertEqual(mailId, "mail_demo")
        } else {
            XCTFail("Expected pendingEvent .openMail, got \(String(describing: vm.pendingEvent))")
        }
    }

    func testSubmitFailureSurfacesError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.recipientsJSON),
            .status(200, body: Self.homeContextJSON),
            .status(500, body: "{}")
        ]
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.updateRecipientQuery("maya")
        await waitFor("recipient search results") { !vm.recipientResults.isEmpty }
        vm.selectRecipient(vm.recipientResults[0])
        vm.primaryTapped()
        await waitFor("home context") { vm.homeContext?.homeId == "home_demo" }
        vm.toggleAddressConfirmed(true)
        vm.primaryTapped()
        vm.updateBody("Hello")
        vm.primaryTapped()
        vm.primaryTapped()
        await waitFor("submit error") { vm.submitError != nil }
        XCTAssertEqual(vm.step, .commit)
        XCTAssertNotNil(vm.submitError)
    }

    // MARK: - Drafts / state

    func testEditingRecipientFieldClearsSelection() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.recipientsJSON)]
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.updateRecipientQuery("maya")
        await waitFor("recipient search results") { !vm.recipientResults.isEmpty }
        vm.selectRecipient(vm.recipientResults[0])
        XCTAssertNotNil(vm.selectedRecipient)
        vm.updateRecipientQuery("zzz")
        XCTAssertNil(vm.selectedRecipient)
    }

    func testBackFromComposeReturnsToVerifyStep() async {
        let vm = await vmAtComposeStep()
        vm.leadingTapped()
        XCTAssertEqual(vm.step, .verify)
    }

    func testLeadingFromDecideFiresDismissEvent() {
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.leadingTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    func testIntentSelectionPersistsAcrossSteps() async {
        let vm = await vmAtComposeStep()
        XCTAssertEqual(vm.intent, .sayHello)
        // Move back to step 1 and pick a different intent.
        vm.leadingTapped() // → verify
        vm.leadingTapped() // → decide
        vm.selectIntent(.condolences)
        XCTAssertEqual(vm.intent, .condolences)
    }

    func testStationeryAndInkSelectionFlowsThrough() async {
        let vm = await vmAtComposeStep()
        vm.selectStationery(.botanical)
        vm.selectInk(.forest)
        vm.selectSeal(.waxBlack)
        XCTAssertEqual(vm.stationery, .botanical)
        XCTAssertEqual(vm.ink, .forest)
        XCTAssertEqual(vm.seal, .waxBlack)
    }

    func testSendTimingDefaultsToNow() {
        let vm = CeremonialMailViewModel(api: makeAPI())
        XCTAssertEqual(vm.sendTiming, .now)
        vm.selectSendTiming(.morning)
        XCTAssertEqual(vm.sendTiming, .morning)
    }

    func testChromeProgressFractionAdvancesPerStep() async {
        let vm = await vmAtComposeStep()
        let fraction = vm.chrome.progressFraction ?? 0
        XCTAssertGreaterThan(fraction, 0.5)
    }

    func testSuccessStepHidesProgressBar() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.recipientsJSON),
            .status(200, body: Self.homeContextJSON),
            .status(200, body: Self.sendSuccessJSON)
        ]
        let vm = CeremonialMailViewModel(api: makeAPI())
        vm.updateRecipientQuery("maya")
        await waitFor("recipient search results") { !vm.recipientResults.isEmpty }
        vm.selectRecipient(vm.recipientResults[0])
        vm.primaryTapped()
        await waitFor("home context") { vm.homeContext?.homeId == "home_demo" }
        vm.toggleAddressConfirmed(true)
        vm.primaryTapped()
        vm.updateBody("Hello")
        vm.primaryTapped()
        vm.primaryTapped()
        await waitFor("submit success") { vm.step == .success }
        XCTAssertFalse(vm.chrome.showsProgressBar)
        XCTAssertEqual(vm.chrome.progressLabel, .hidden)
    }

    // MARK: - Helpers

    private func vmAtVerifyStep() -> CeremonialMailViewModel {
        SequencedURLProtocol.sequence = [.status(200, body: Self.recipientsJSON)]
        let vm = CeremonialMailViewModel(api: makeAPI())
        // Simulate a recipient already selected without waiting for
        // the search debounce.
        let recipient = MailRecipientDTO(
            userId: "u_maya",
            name: "Maya K.",
            username: "mayak",
            homeId: "home_demo",
            homeAddress: "412 Elm St",
            isVerified: true,
            homeMediaUrl: nil,
            isOnPantopus: true
        )
        vm.selectRecipient(recipient)
        vm.primaryTapped() // → verify
        return vm
    }

    private func vmAtComposeStep() async -> CeremonialMailViewModel {
        SequencedURLProtocol.sequence = [.status(200, body: Self.homeContextJSON)]
        let vm = vmAtVerifyStep()
        try? await Task.sleep(nanoseconds: 100_000_000)
        vm.toggleAddressConfirmed(true)
        vm.primaryTapped() // → compose
        return vm
    }
}
