//
//  InviteOwnerFormViewModelTests.swift
//  PantopusTests
//
//  Validation and ownership-share math for the A13.2 Invite Owner form.
//

import XCTest
@testable import Pantopus

@MainActor
final class InviteOwnerFormViewModelTests: XCTestCase {
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

    private func makeVM(
        currentEmail: String = "me@example.com",
        draft: InviteOwnerDraft = InviteOwnerSampleData.initialDraft(homeId: "home-1")
    ) -> InviteOwnerFormViewModel {
        InviteOwnerFormViewModel(
            homeId: "home-1",
            currentUserEmail: currentEmail,
            initialDraft: draft,
            initialState: .editing,
            api: makeAPI()
        )
    }

    // MARK: - Validation

    func testInitialStateIsCleanAndInvalidUntilContactIsEntered() async {
        let vm = makeVM()
        XCTAssertFalse(vm.isDirty)
        XCTAssertFalse(vm.isValid, "Empty contact must not be submittable.")
        XCTAssertEqual(vm.grantPercent, 25)
        XCTAssertEqual(vm.owners.first?.sharePercent, 75)

        let liveVM = InviteOwnerFormViewModel(homeId: "home-1", currentUserEmail: "me@example.com", api: makeAPI())
        liveVM.update(.email, to: "invitee@example.com")
        let loadingSubmit = await liveVM.submit()
        XCTAssertFalse(loadingSubmit, "Loading must not submit an invite.")
        SequencedURLProtocol.sequence = [.status(503, body: "{}")]
        await liveVM.load()
        XCTAssertEqual(liveVM.state, .error("We couldn't load this Home. Try again."))
        XCTAssertFalse(liveVM.isValid)
        let failedSubmit = await liveVM.submit()
        XCTAssertFalse(failedSubmit, "Failed context must not submit an invite.")

        SequencedURLProtocol.sequence = [.status(200, body: #"{"home":{"id":"other-home","address":"Other address"}}"#)]
        await liveVM.refresh()
        XCTAssertEqual(liveVM.state, .error("We couldn't confirm this Home. Try again."))
        SequencedURLProtocol.sequence = [.status(403, body: "{}")]
        await liveVM.refresh()
        XCTAssertEqual(liveVM.state, .error("We couldn't load this Home. Try again."))

        let selectedHomeJSON = #"{"home":{"id":"home-1","address":" 100 Synthetic Way ","name":" S3 W2 Home "}}"#
        SequencedURLProtocol.sequence = [.status(200, body: selectedHomeJSON)]
        await liveVM.refresh()
        XCTAssertEqual(liveVM.state, .editing)
        XCTAssertEqual(liveVM.homeContext, InviteOwnerHomeContext(title: "100 Synthetic Way", subtitle: "S3 W2 Home"))
        liveVM.update(.email, to: "invitee@example.com")
        XCTAssertTrue(liveVM.isValid)
        SequencedURLProtocol.sequence = [.status(200, body: #"{"home":{"id":"home-1","address":" ","name":" "}}"#)]
        await liveVM.refresh()
        XCTAssertEqual(liveVM.homeContext, InviteOwnerHomeContext(title: "Home", subtitle: "Selected home"))
        XCTAssertTrue(SequencedURLProtocol.capturedRequests.allSatisfy { $0.httpMethod == "GET" })
    }

    func testEmailValidationRejectsGarbage() {
        let vm = makeVM()
        vm.update(.email, to: "not-an-email")
        XCTAssertNotNil(vm.fields[.email]?.error)
        XCTAssertFalse(vm.isValid)
    }

    func testEmailValidationAcceptsRfcShape() {
        let vm = makeVM()
        vm.update(.email, to: "alex@pantopus.app")
        XCTAssertNil(vm.fields[.email]?.error)
        XCTAssertTrue(vm.isValid)
        XCTAssertTrue(vm.isDirty)
    }

    func testEmailRejectsSelfInvite() {
        let vm = makeVM(currentEmail: "Alex@example.com")
        vm.update(.email, to: "alex@example.com")
        XCTAssertEqual(vm.fields[.email]?.error, "You can't invite yourself.")
        XCTAssertFalse(vm.isValid)
    }

    func testPhoneValidatorAllowsEmptyFormattedUsAndE164() {
        let vm = makeVM()
        vm.update(.email, to: "x@y.com")
        vm.update(.phone, to: "")
        XCTAssertNil(vm.fields[.phone]?.error)
        XCTAssertTrue(vm.isValid)

        vm.update(.phone, to: "555-1212")
        XCTAssertNotNil(vm.fields[.phone]?.error)
        XCTAssertFalse(vm.isValid)

        vm.update(.phone, to: "(415) 555-0198")
        XCTAssertNil(vm.fields[.phone]?.error)
        XCTAssertTrue(vm.isValid)

        vm.update(.phone, to: "+15555550123")
        XCTAssertNil(vm.fields[.phone]?.error)
        XCTAssertTrue(vm.isValid)
    }

    func testRoleNoteIsCappedAtMaxLength() {
        let vm = makeVM()
        vm.update(.role, to: String(repeating: "a", count: vm.noteMaxLength + 10))
        XCTAssertEqual(vm.fields[.role]?.value.count, vm.noteMaxLength)
        XCTAssertNil(vm.fields[.role]?.error)
    }

    // MARK: - Ownership math

    func testSingleOwnerGrantAdjustsYouKeepShare() {
        let vm = makeVM()
        vm.updateGrantPercent(40)
        XCTAssertEqual(vm.owners.first?.sharePercent, 60)
        XCTAssertEqual(vm.availablePool, 40)
        XCTAssertFalse(vm.hasShareConflict)
    }

    func testConflictFrameReportsOverageAndDisablesSend() {
        let vm = makeVM(draft: InviteOwnerSampleData.conflict)
        XCTAssertEqual(vm.availablePool, 20)
        XCTAssertEqual(vm.totalAfterGrant, 110)
        XCTAssertEqual(vm.conflictOverage, 10)
        XCTAssertTrue(vm.hasShareConflict)
        XCTAssertFalse(vm.isValid)
        XCTAssertEqual(
            vm.conflictMessage,
            "Total would be 110%. Maria holds 50% and Marcus holds 30%. Pick 20% or less, or rebalance existing shares."
        )
    }

    func testSnapToAvailableClearsConflict() {
        let vm = makeVM(draft: InviteOwnerSampleData.conflict)
        vm.snapGrantToAvailablePool()
        XCTAssertEqual(vm.grantPercent, 20)
        XCTAssertEqual(vm.totalAfterGrant, 100)
        XCTAssertFalse(vm.hasShareConflict)
        XCTAssertTrue(vm.isValid)
    }

    func testRebalanceScalesExistingOwnersToFitGrant() {
        let vm = makeVM(draft: InviteOwnerSampleData.conflict)
        vm.rebalanceShares()
        XCTAssertEqual(vm.grantPercent, 30)
        XCTAssertEqual(vm.totalAfterGrant, 100)
        XCTAssertEqual(vm.owners.map(\.sharePercent), [44, 26])
        XCTAssertFalse(vm.hasShareConflict)
        XCTAssertTrue(vm.isValid)
    }

    // MARK: - Submit

    func testSubmitHappyPathSetsToastAndDismiss() async {
        SequencedURLProtocol.sequence = [
            .status(201, body: #"{"message":"Co-owner invitation sent.","claim_id":"c1"}"#)
        ]
        let vm = makeVM(draft: InviteOwnerSampleData.valid)
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.toast?.text, "Invite sent.")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testFastTrackDefaultsOnAndSurvivesRefresh() async {
        let vm = makeVM(draft: InviteOwnerSampleData.valid)
        XCTAssertTrue(vm.fastTrack, "RN defaults the vouch switch ON.")
        vm.fastTrack = false
        await vm.refresh()
        XCTAssertTrue(vm.fastTrack, "Refresh re-seeds the draft, including the switch.")
    }

    func testSubmitWithInvalidEmailDoesNotDismiss() async {
        let vm = makeVM()
        vm.update(.email, to: "garbage")
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testSubmitWithConflictRequiresResolution() async {
        let vm = makeVM(draft: InviteOwnerSampleData.conflict)
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertFalse(vm.shouldDismiss)
        XCTAssertEqual(vm.toast?.text, "Resolve the ownership split first.")
    }
}
