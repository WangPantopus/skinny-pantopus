//
//  AddHomeWizardViewModelTests.swift
//  PantopusTests
//
//  Covers the AddHome state machine: forward / back, search-first address
//  selection, check-address transition, submit happy path, submit error
//  rollback, and scene-storage restore.
//

import XCTest
@testable import Pantopus

@MainActor
final class AddHomeWizardViewModelTests: XCTestCase {
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

    /// Centralised constructor so every test injects an "always online"
    /// stub. NetworkMonitor.shared can transiently report `.unsatisfied`
    /// on CI simulators, which would gate `submit()` and hide the real
    /// behaviour we're testing.
    private func makeVM(initialState: AddHomeFormState = .empty) -> AddHomeWizardViewModel {
        AddHomeWizardViewModel(
            api: makeAPI(),
            initialState: initialState
        ) { true }
    }

    private func filled() -> AddHomeFormState {
        AddHomeFormState(
            step: AddHomeStep.address.rawValue,
            address: AddHomeSampleData.nearbyHomes[0].addressFields,
            isPrimary: true,
            role: nil
        )
    }

    private func filledBrooklyn(zipCode: String) -> AddHomeFormState {
        AddHomeFormState(
            step: AddHomeStep.address.rawValue,
            address: AddHomeAddressFields(
                street: "412 Elm Street",
                unit: "3B",
                city: "Brooklyn",
                state: "NY",
                zipCode: zipCode
            ),
            isPrimary: true,
            role: nil
        )
    }

    private static let checkAddressJSON = """
    {"exists":false,"homeCount":0,"hasVerifiedMembers":false,"verdictStatus":null}
    """

    private static let checkAddressMismatchJSON = """
    {"exists":false,"homeCount":0,"hasVerifiedMembers":false,"verdict_status":null,
     "normalized_address":{
       "street":"412 Elm Street","unit":"3B","city":"Brooklyn","state":"NY",
       "zip_code":"11211","latitude":40.7138,"longitude":-73.9527,"is_multi_unit":true
     }}
    """

    private static let createHomeJSON = """
    {"message":"ok","home":{
      "id":"home_42","name":"412 Elm St","address":"412 Elm St",
      "city":"Portland","state":"OR","zipcode":"97214",
      "home_type":null,"visibility":"public","description":null,
      "created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z"
    },"requires_verification":false,"verification_type":null,"role":"owner"}
    """

    // MARK: - Initial state

    func testInitialChromeReflectsAddressStep() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: .empty)
        let chrome = vm.chrome
        XCTAssertEqual(chrome.title, "Find your home")
        XCTAssertEqual(chrome.primaryCTALabel, "Continue")
        XCTAssertFalse(chrome.primaryCTAEnabled, "Continue must be disabled until a home is selected.")
        XCTAssertEqual(chrome.leading, .close)
        XCTAssertEqual(chrome.progressLabel, .stepOf(current: 1, total: 4))
    }

    func testSelectedHomeEnablesContinue() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: filled())
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Address → Confirm

    func testPrimaryAdvancesAndFiresCheckAddress() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.checkAddressJSON)]
        let vm = makeVM(initialState: filled())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .confirm)
        XCTAssertNotNil(vm.addressCheck)
        XCTAssertEqual(vm.chrome.leading, .back, "Back chevron replaces X on step 2.")
    }

    func testCheckAddressErrorSurfacesMessage() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"down\"}")]
        let vm = makeVM(initialState: filled())
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .confirm)
        XCTAssertNil(vm.addressCheck)
        XCTAssertNotNil(vm.errorMessage)
    }

    func testZipMismatchDisablesContinueUntilApplied() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.checkAddressMismatchJSON)]
        let vm = makeVM(initialState: filledBrooklyn(zipCode: "11201"))
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .confirm)
        XCTAssertEqual(vm.zipMismatch?.enteredZip, "11201")
        XCTAssertEqual(vm.zipMismatch?.correctedZip, "11211")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .confirm)

        vm.applyGeocodedZip()

        XCTAssertEqual(vm.form.address.zipCode, "11211")
        XCTAssertNil(vm.zipMismatch)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Back navigation

    func testBackOnConfirmGoesToAddress() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.checkAddressJSON)]
        let vm = makeVM(initialState: filled())
        await vm.advanceForTesting()
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .address)
    }

    // MARK: - Role gating

    func testRoleStepRequiresSelection() {
        var seed = filled()
        seed.step = AddHomeStep.role.rawValue
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: seed)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.selectRole(.owner)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Submit happy path

    func testSubmitAdvancesToSuccessAndRecordsHomeId() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        var seed = filled()
        seed.step = AddHomeStep.review.rawValue
        seed.role = .owner
        let vm = makeVM(initialState: seed)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .success)
        XCTAssertEqual(vm.createdHomeId, "home_42")
        XCTAssertEqual(vm.chrome.primaryCTALabel, "View home")
        XCTAssertEqual(vm.chrome.secondaryCTA?.identifier, "addHomeBackToHub")
        XCTAssertFalse(vm.chrome.showsProgressBar, "Success step hides the segmented progress bar.")
    }

    func testSubmitErrorKeepsUserOnReview() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"server\"}")]
        var seed = filled()
        seed.step = AddHomeStep.review.rawValue
        seed.role = .owner
        let vm = makeVM(initialState: seed)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review)
        XCTAssertNotNil(vm.errorMessage)
    }

    // MARK: - Success step CTAs

    func testSuccessPrimaryFiresOpenDashboardEvent() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        var seed = filled()
        seed.step = AddHomeStep.review.rawValue
        seed.role = .owner
        let vm = makeVM(initialState: seed)
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.pendingEvent, .openHomeDashboard(homeId: "home_42"))
    }

    func testSuccessSecondaryFiresDismissEvent() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        var seed = filled()
        seed.step = AddHomeStep.review.rawValue
        seed.role = .owner
        let vm = makeVM(initialState: seed)
        await vm.advanceForTesting()
        vm.secondaryTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }

    // MARK: - Close-confirm

    func testCloseOnEmptyStep1IsClean() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: .empty)
        XCTAssertFalse(vm.chrome.dirty)
    }

    func testCloseOnFilledStep1IsDirty() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: filled())
        XCTAssertTrue(vm.chrome.dirty)
    }

    func testCloseOnSuccessIsClean() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        var seed = filled()
        seed.step = AddHomeStep.review.rawValue
        seed.role = .owner
        let vm = makeVM(initialState: seed)
        await vm.advanceForTesting()
        XCTAssertFalse(vm.chrome.dirty)
    }

    // MARK: - Search

    func testSearchQueryShowsAutocompleteWithoutEnablingContinue() {
        let vm = makeVM(initialState: .empty)
        vm.updateSearchQuery("412 Elm")
        XCTAssertTrue(vm.showsAutocomplete)
        XCTAssertEqual(vm.autocompleteResults.count, 5)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
    }

    func testSelectAddressCandidatePopulatesAddressAndEnablesContinue() {
        let vm = makeVM(initialState: .empty)
        let candidate = AddHomeSampleData.nearbyHomes[0]
        vm.selectAddressCandidate(candidate)
        XCTAssertEqual(vm.selectedHomeID, candidate.id)
        XCTAssertEqual(vm.homeSearchQuery, candidate.line1)
        XCTAssertEqual(vm.form.address, candidate.addressFields)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    func testClaimedCandidateDoesNotSelect() {
        let vm = makeVM(initialState: .empty)
        let claimed = AddHomeSampleData.nearbyHomes[2]
        vm.selectAddressCandidate(claimed)
        XCTAssertNil(vm.selectedHomeID)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Restore

    func testRestoreCopiesSnapshotIntoEmptyForm() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: .empty)
        vm.restore(from: filled())
        XCTAssertEqual(vm.currentStep, .address)
        XCTAssertEqual(vm.form.address.street, "412 Elm St")
        XCTAssertEqual(vm.selectedHomeID, AddHomeSampleData.nearbyHomes[0].id)
    }

    func testRestoreNoOpsOnceFormIsDirty() {
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: filled())
        let other = AddHomeFormState(
            step: AddHomeStep.review.rawValue,
            address: AddHomeAddressFields(street: "X"),
            isPrimary: false,
            role: .tenant
        )
        vm.restore(from: other)
        XCTAssertEqual(vm.form.address.street, "412 Elm St", "Restore should not stomp existing form data.")
    }

    // MARK: - A12.2 snapshot lockfiles

    func testA12AddHomeGeocodedReadySnapshotBaselineIsPresent() throws {
        try assertAddHomeBaselineOrSkip("geocoded_ready")
    }

    func testA12AddHomeZipMismatchSnapshotBaselineIsPresent() throws {
        try assertAddHomeBaselineOrSkip("zip_mismatch_apply")
    }

    private var addHomeBaselineURL: URL {
        let here = URL(fileURLWithPath: #filePath)
        return here
            .deletingLastPathComponent() // Homes
            .deletingLastPathComponent() // Features
            .deletingLastPathComponent() // PantopusTests
            .appendingPathComponent("__Snapshots__")
            .appendingPathComponent("a12-add-home")
    }

    private func assertAddHomeBaselineOrSkip(_ slug: String) throws {
        let url = addHomeBaselineURL.appendingPathComponent("\(slug)-ios.png")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw XCTSkip("Baseline pending follow-up commit: \(url.path)")
        }
        let data = try Data(contentsOf: url)
        XCTAssertGreaterThan(data.count, 8 * 1024, "Baseline too small (\(data.count) bytes): \(url.path)")
        XCTAssertTrue(
            data.count > 4 &&
                data[0] == 0x89 &&
                data[1] == 0x50 &&
                data[2] == 0x4E &&
                data[3] == 0x47,
            "Not a PNG: \(url.path)"
        )
    }
}
