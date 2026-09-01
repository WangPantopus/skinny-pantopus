//
//  InviteTeammateWizardViewModelTests.swift
//  PantopusTests
//
//  B2C — Invite Teammate wizard. Covers:
//    - step progression with primary CTA enable state (role → identify →
//      review), gated on display name + valid email
//    - leadingTapped behaviour on first vs interior steps
//    - submit → POST /:id/seats/invite happy path emits `.submitted(seat)`
//    - submit failure surfaces errorMessage and stays on review
//

import XCTest
@testable import Pantopus

@MainActor
final class InviteTeammateWizardViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private func makeVM(
        businessId: String = "biz_1",
        routeResponses: [String: [SequencedURLProtocol.Response]] = [:]
    ) -> InviteTeammateWizardViewModel {
        InviteTeammateWizardViewModel(
            businessId: businessId,
            api: APIClient(
                environment: .current,
                session: SequencedURLProtocol.makeSession(routeResponses: routeResponses),
                retryPolicy: .none
            )
        )
    }

    func testEmailValidation() {
        XCTAssertTrue(InviteTeammateWizardViewModel.isValidEmail("user@example.com"))
        XCTAssertFalse(InviteTeammateWizardViewModel.isValidEmail("nope"))
        XCTAssertFalse(InviteTeammateWizardViewModel.isValidEmail(""))
    }

    func testPrimaryGatedOnIdentifyUntilNameAndEmail() {
        let vm = makeVM()
        XCTAssertTrue(vm.chrome.primaryCTAEnabled) // role step
        vm.primaryTapped()
        XCTAssertEqual(vm.currentStep, .identify)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.setDisplayName("Front Desk")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled) // still needs email
        vm.setEmail("fd@example.com")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testReviewStepCarriesSendInviteLabel() {
        let vm = makeVM()
        vm.setDisplayName("Front Desk")
        vm.setEmail("fd@example.com")
        vm.primaryTapped() // role → identify
        vm.primaryTapped() // identify → review
        XCTAssertEqual(vm.currentStep, .review)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Send invite")
    }

    func testLeadingFromRoleEmitsDismissAndInteriorStepsBack() {
        let vm = makeVM()
        vm.leadingTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)

        let vm2 = makeVM()
        vm2.primaryTapped() // → identify
        vm2.leadingTapped()
        XCTAssertEqual(vm2.currentStep, .role)
        XCTAssertNil(vm2.pendingEvent)
    }

    func testSubmitSuccessEmitsSeatEvent() async {
        let vm = makeVM(routeResponses: [
            "/api/businesses/biz_1/seats/invite": [
                .status(201, body: """
                {"message":"Invite created","seat":{
                  "id":"seat_new","display_name":"Front Desk","role_base":"viewer",
                  "invite_status":"pending","invite_email":"fd@example.com",
                  "created_at":"2026-05-15T12:00:00Z","is_you":false
                },"invite_token":"tok_123"}
                """)
            ]
        ])
        vm.setRole(.viewer)
        vm.setDisplayName("Front Desk")
        vm.setEmail("fd@example.com")
        vm.primaryTapped() // role → identify
        vm.primaryTapped() // identify → review
        vm.primaryTapped() // submit
        await waitForSubmit(vm)
        guard case let .submitted(seat) = vm.pendingEvent else {
            return XCTFail("Expected .submitted, got \(String(describing: vm.pendingEvent))")
        }
        XCTAssertEqual(seat.id, "seat_new")
        XCTAssertEqual(seat.inviteStatus, "pending")
        XCTAssertNil(vm.errorMessage)
    }

    func testSubmitFailureSurfacesErrorAndStaysOnReview() async {
        let vm = makeVM(routeResponses: [
            "/api/businesses/biz_1/seats/invite": [.status(500, body: "{\"error\":\"oops\"}")]
        ])
        vm.setDisplayName("Front Desk")
        vm.setEmail("fd@example.com")
        vm.primaryTapped()
        vm.primaryTapped()
        vm.primaryTapped()
        await waitForSubmit(vm)
        XCTAssertNil(vm.pendingEvent)
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertEqual(vm.currentStep, .review)
    }

    private func waitForSubmit(
        _ vm: InviteTeammateWizardViewModel,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        for _ in 0..<40 {
            if vm.pendingEvent != nil || vm.errorMessage != nil { return }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTFail("Timed out waiting for invite submission", file: file, line: line)
    }
}
