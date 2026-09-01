//
//  CreateBusinessWizardViewModelTests.swift
//  PantopusTests
//
//  Covers the A12.10 Create Business wizard state machine: step
//  transitions, category selection, search filtering, custom-category
//  backend blocking, and the chrome's dirty-tracking.
//

import Foundation
import XCTest
@testable import Pantopus

@MainActor
final class CreateBusinessWizardViewModelTests: XCTestCase {
    private func makeVM() -> CreateBusinessWizardViewModel {
        CreateBusinessWizardViewModel(
            api: APIClient(session: .shared, retryPolicy: .none)
        )
    }

    func testInitialStateIsPickCategoryWithHomeDefault() {
        let vm = makeVM()
        XCTAssertEqual(vm.currentStep, .pickCategory)
        XCTAssertEqual(vm.selectedCategoryId, .home)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Continue")
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        XCTAssertFalse(vm.chrome.dirty, "Default home selection on step 1 should not be dirty.")
        XCTAssertEqual(vm.chrome.progressLabel, .stepOf(current: 1, total: 4))
    }

    func testSelectingNonDefaultCategoryMarksDirty() {
        let vm = makeVM()
        vm.selectCategory(.tech)
        XCTAssertEqual(vm.selectedCategoryId, .tech)
        XCTAssertTrue(vm.chrome.dirty, "Picking a non-default tile must mark the wizard dirty.")
    }

    func testTypingSearchQueryMarksDirty() {
        let vm = makeVM()
        vm.searchText = "tutor"
        XCTAssertTrue(vm.isSearchActive)
        XCTAssertTrue(vm.chrome.dirty)
    }

    func testSearchHitsAreFilteredAndCapped() {
        let vm = makeVM()
        vm.searchText = "tutor"
        XCTAssertEqual(vm.searchHits.count, 3)
        XCTAssertEqual(vm.searchHits.first?.id, "tutoring-core")
        XCTAssertEqual(vm.searchHits.first?.category, .personal)
        XCTAssertTrue(vm.searchHits.allSatisfy { $0.label.lowercased().contains("tutor") })
    }

    func testEmptySearchYieldsNoHits() {
        let vm = makeVM()
        vm.searchText = "   "
        XCTAssertTrue(vm.searchHits.isEmpty)
    }

    func testSelectingSearchHitSelectsCategoryAndClearsQuery() {
        let vm = makeVM()
        vm.searchText = "tutor"
        guard let hit = vm.searchHits.first else {
            XCTFail("Expected at least one tutor hit")
            return
        }
        vm.selectSearchHit(hit)
        XCTAssertEqual(vm.selectedCategoryId, hit.category)
        XCTAssertEqual(vm.searchText, "")
        XCTAssertFalse(vm.isSearchActive)
    }

    func testPrimaryFromPickCategoryAdvancesToLegalInfo() {
        let vm = makeVM()
        vm.primaryTapped()
        XCTAssertEqual(vm.currentStep, .legalInfo)
        XCTAssertEqual(vm.chrome.progressLabel, .stepOf(current: 2, total: 4))
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Next")
    }

    func testPrimaryFromLegalInfoRequiresBasicFields() {
        let vm = makeVM()
        vm.primaryTapped() // → legalInfo
        vm.primaryTapped() // blocked without fields
        XCTAssertEqual(vm.currentStep, .legalInfo)
        XCTAssertNotNil(vm.submitError)
    }

    func testBackFromLegalInfoReturnsToPickCategory() {
        let vm = makeVM()
        vm.primaryTapped()
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .pickCategory)
    }

    func testBackClearsSubmitErrorSoItDoesNotLeakOntoThePreviousStep() {
        let vm = makeVM()
        vm.primaryTapped() // → legalInfo
        vm.primaryTapped() // blocked, sets submitError
        XCTAssertNotNil(vm.submitError)

        vm.leadingTapped() // → pickCategory

        XCTAssertEqual(vm.currentStep, .pickCategory)
        XCTAssertNil(vm.submitError)
    }

    /// `createBusinessFullSchema` rejects `name > 100` / `description > 2000`,
    /// so the setters clamp instead of letting the wizard reach a 400.
    /// (`username` is covered by inspection — its setter also schedules the
    /// availability check, which would fire a request from a unit test.)
    func testFieldSettersClampToCreateFullSchemaLimits() {
        let vm = makeVM()
        vm.setBusinessName(String(repeating: "a", count: 150))
        vm.setDescription(String(repeating: "c", count: 2500))
        XCTAssertEqual(vm.businessName.count, CreateBusinessFieldLimits.maxName)
        XCTAssertEqual(vm.descriptionText.count, CreateBusinessFieldLimits.maxDescription)
    }

    func testCloseOnPickCategoryDispatchesDismiss() {
        let vm = makeVM()
        vm.leadingTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    func testCustomCategorySubmitStaysOnPickCategoryWithBackendError() {
        let vm = makeVM()
        vm.searchText = "alpaca grooming"
        vm.submitCustomCategory()
        XCTAssertEqual(vm.selectedCategoryId, .home)
        XCTAssertEqual(vm.currentStep, .pickCategory)
        XCTAssertEqual(vm.searchText, "alpaca grooming")
        XCTAssertEqual(
            vm.submitError,
            "Custom categories aren't available yet. Pick a listed category instead."
        )
        XCTAssertFalse(vm.isSubmittingCustom)
    }

    func testCustomCategorySubmitNoopOnEmptyQuery() {
        let vm = makeVM()
        vm.searchText = "   "
        vm.submitCustomCategory()
        XCTAssertEqual(vm.currentStep, .pickCategory)
    }

    func testWhatYouGetOnlyVisibleForHomeServices() {
        let vm = makeVM()
        XCTAssertFalse(vm.whatYouGetItems.isEmpty, "Default .home should show the strip.")
        vm.selectCategory(.tech)
        XCTAssertTrue(vm.whatYouGetItems.isEmpty, "Other categories don't have a payload yet.")
    }

    /// A12.10 parity: Save-as-draft is a confirm-step-only ghost, so the
    /// earlier steps must not render it.
    func testSaveAsDraftGhostIsConfirmStepOnly() {
        let vm = makeVM()
        XCTAssertNil(vm.chrome.secondaryCTA, "Step 1 must not offer Save as draft.")
        vm.primaryTapped() // → legalInfo
        XCTAssertNil(vm.chrome.secondaryCTA, "Step 2 must not offer Save as draft.")
        // Secondary taps outside the confirm step are inert.
        vm.secondaryTapped()
        XCTAssertEqual(vm.currentStep, .legalInfo)
        XCTAssertNil(vm.pendingEvent)
    }

    func testLogoPickIsHeldUntilCreateAndCanBeSkipped() {
        let vm = makeVM()
        XCTAssertNil(vm.logoPick)
        vm.setLogoPick(
            CreateBusinessLogoPick(data: Data([0x1]), fileName: "business-logo-abc.jpg", mimeType: "image/jpeg")
        )
        XCTAssertEqual(vm.logoPick?.fileName, "business-logo-abc.jpg")
        XCTAssertFalse(vm.logoSkipped)

        vm.skipLogo()
        XCTAssertNil(vm.logoPick, "Skipping clears the staged image so it is never uploaded.")
        XCTAssertTrue(vm.logoSkipped)

        vm.unskipLogo()
        XCTAssertFalse(vm.logoSkipped)
    }

    func testChromeIdentityAccentIsBusinessViolet() {
        // Smoke-check the WizardIdentity threading by verifying the
        // chrome wires up the violet identity at the call site. We can't
        // assert the accent color directly on the chrome (it lives on
        // the identity, not the chrome), but the wizard view passes
        // `.business` into `WizardShell` — covered by the snapshot test.
        XCTAssertEqual(WizardIdentity.business.accent, Theme.Color.business)
        XCTAssertEqual(WizardIdentity.business.accentBg, Theme.Color.businessBg)
    }
}
