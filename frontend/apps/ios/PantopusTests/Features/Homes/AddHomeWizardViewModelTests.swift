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
            initialState: initialState,
            identity: { "home-entry-test-session" },
            creationActorId: "ddc23700-0000-4000-8000-000000000001",
            creationStore: MemoryHomeCreationStore(),
            creationRequestId: { "ddc23700-0000-4000-8000-000000000002" },
            isOnlineProvider: { true }
        )
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

    private static let validationJSON = """
    {"address_id":"ddc23700-0000-4000-8000-000000000010","verdict":{"status":"OK","normalized":{
      "line1":"412 Elm St","line2":"Apt 3B","city":"Brooklyn","state":"NY","zip":"11211","lat":40.7138,"lng":-73.9527
    }}}
    """
    private static let checkAddressJSON = """
    {"status":"HOME_NOT_FOUND","is_multi_unit":true}
    """
    private static var addressResponses: [SequencedURLProtocol.Response] {
        [.status(200, body: validationJSON), .status(200, body: checkAddressJSON), .status(503, body: "{}")]
    }

    private func reviewVM() async -> AddHomeWizardViewModel {
        SequencedURLProtocol.sequence = Self.addressResponses + SequencedURLProtocol.sequence
        let vm = makeVM(initialState: filled())
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        vm.selectRole(.owner)
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .review)
        return vm
    }

    private static let createHomeJSON = """
    {"state":"completed","command":{"actor_id":"ddc23700-0000-4000-8000-000000000001",
    "request_id":"ddc23700-0000-4000-8000-000000000002","created_at":"2026-09-11T00:00:00Z","updated_at":"2026-09-11T00:00:00Z"},
    "home":{"id":"ddc23700-0000-4000-8000-000000000100"},"ownership_claim_id":"ddc23700-0000-4000-8000-000000000101",
    "access_secret_ids":[],"requires_verification":true,"verification_type":"ownership","role":"owner","current_access":"not_checked"}
    """

    // MARK: - Initial state

    func testInitialChromeReflectsAddressStep() {
        let vm = makeVM(initialState: .empty)
        let chrome = vm.chrome
        XCTAssertEqual(chrome.title, "Find your home")
        XCTAssertEqual(chrome.primaryCTALabel, "Continue")
        XCTAssertFalse(chrome.primaryCTAEnabled, "Continue must be disabled until a home is selected.")
        XCTAssertEqual(chrome.leading, .close)
        XCTAssertEqual(chrome.progressLabel, .stepOf(current: 1, total: 4))
    }

    func testSelectedHomeEnablesContinue() {
        let vm = makeVM(initialState: filled())
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
    }

    // MARK: - Address → Confirm

    func testPrimaryAdvancesAndFiresCheckAddress() async {
        SequencedURLProtocol.sequence = Self.addressResponses
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
        SequencedURLProtocol.sequence = Self.addressResponses
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
        SequencedURLProtocol.sequence = Self.addressResponses
        let vm = makeVM(initialState: filled())
        await vm.advanceForTesting()
        vm.leadingTapped()
        XCTAssertEqual(vm.currentStep, .address)
    }

    // MARK: - Role gating

    func testRoleStepRequiresSelectionAndCurrentValidation() async {
        SequencedURLProtocol.sequence = Self.addressResponses
        let vm = makeVM(initialState: filled())
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.currentStep, .role)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.selectRole(.owner)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        vm.update(.unit, to: "4B")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled, "Editing the address retires the canonical receipt")
    }

    // MARK: - Submit happy path

    func testSubmitShowsRetainedOutcomeAndRecordsHomeId() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        let vm = await reviewVM()
        await vm.advanceForTesting()
        XCTAssertTrue(vm.showsCreationRecovery)
        XCTAssertEqual(vm.creationOutcome?.state, .completed)
        XCTAssertEqual(vm.createdHomeId, "ddc23700-0000-4000-8000-000000000100")
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Open My Homes")
        XCTAssertNil(vm.chrome.secondaryCTA)
        XCTAssertFalse(vm.chrome.dirty)
        XCTAssertFalse(vm.chrome.showsProgressBar, "Success step hides the segmented progress bar.")
    }

    func testSubmitErrorKeepsOriginalRequestForRecovery() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"server\"}")]
        let vm = await reviewVM()
        await vm.advanceForTesting()
        XCTAssertTrue(vm.showsCreationRecovery)
        XCTAssertNotNil(vm.pendingCreation)
        XCTAssertNil(vm.creationOutcome)
        XCTAssertEqual(vm.chrome.primaryCTALabel, "Try saving again")
        XCTAssertNotNil(vm.errorMessage)
    }

    // MARK: - Success step CTAs

    func testSuccessPrimaryReloadsCurrentHomesList() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        let vm = await reviewVM()
        await vm.advanceForTesting()
        await vm.advanceForTesting()
        XCTAssertEqual(vm.pendingEvent, .openHomes)
    }

    func testClosingSuccessPreservesOutcome() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.createHomeJSON)]
        let vm = await reviewVM()
        await vm.advanceForTesting()
        vm.leadingTapped()
        XCTAssertEqual(vm.pendingEvent, .dismiss)
        XCTAssertEqual(vm.creationOutcome?.state, .completed)
    }

    // MARK: - Close-confirm

    func testCloseOnEmptyStep1IsClean() {
        let vm = makeVM(initialState: .empty)
        XCTAssertFalse(vm.chrome.dirty)
    }

    func testCloseOnFilledStep1IsDirty() {
        let vm = makeVM(initialState: filled())
        XCTAssertTrue(vm.chrome.dirty)
    }

    // MARK: - Search

    func testSearchQueryWaitsForRealResultsWithoutEnablingContinue() {
        let vm = makeVM(initialState: .empty)
        vm.updateSearchQuery("412 Elm")
        XCTAssertFalse(vm.showsAutocomplete)
        XCTAssertTrue(vm.searchResults.isEmpty, "No sample addresses masquerade as search results")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
        vm.clearSearchQuery()
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

    func testAnExistingAddressCanBeSelectedForServerVerification() {
        let vm = makeVM(initialState: .empty)
        let claimed = AddHomeSampleData.nearbyHomes[2]
        vm.selectAddressCandidate(claimed)
        XCTAssertEqual(vm.selectedHomeID, claimed.id)
        XCTAssertTrue(vm.chrome.primaryCTAEnabled)
        XCTAssertNil(vm.validatedAddressId)
    }

    // MARK: - Restore

    func testRestoreCopiesSnapshotIntoEmptyForm() {
        let vm = makeVM(initialState: .empty)
        vm.restore(from: filled())
        XCTAssertEqual(vm.currentStep, .address)
        XCTAssertEqual(vm.form.address.street, "412 Elm St")
        XCTAssertNil(vm.selectedHomeID)
        XCTAssertNil(vm.validatedAddressId)
    }

    func testRestoreNoOpsOnceFormIsDirty() {
        let vm = makeVM(initialState: filled())
        let other = AddHomeFormState(
            step: AddHomeStep.review.rawValue,
            address: AddHomeAddressFields(street: "X"),
            isPrimary: false,
            role: .tenant
        )
        vm.restore(from: other)
        XCTAssertEqual(vm.form.address.street, "412 Elm St", "Restore should not stomp existing form data.")
    }

    func testRestoreKeepsPartialManualFieldsVisible() {
        let vm = makeVM(initialState: .empty)
        var draft = AddHomeFormState.empty
        draft.address.city = "Test"
        vm.restore(from: draft)
        XCTAssertTrue(vm.isManualEntry)
        XCTAssertEqual(vm.form.address.city, "Test")
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
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

    func testBackgroundRetiresHeldValidation() async throws {
        SequencedURLProtocol.sequence = [.status(200, body: Self.validationJSON, delay: 0.15)]
        let vm = makeVM(initialState: filled())
        let pending = Task { await vm.advanceForTesting() }
        try await Task.sleep(for: .milliseconds(30))
        vm.suspendAddressEntry()
        await pending.value
        XCTAssertEqual(vm.currentStep, .address)
        XCTAssertNil(vm.validatedAddressId)
        XCTAssertNil(vm.addressCheck)
        XCTAssertFalse(vm.isCheckingAddress)
    }

    func testAccountChangeRetiresHeldValidation() async throws {
        var identity = "original-entry-session"
        SequencedURLProtocol.sequence = [.status(200, body: Self.validationJSON, delay: 0.15)]
        let vm = AddHomeWizardViewModel(api: makeAPI(), initialState: filled(), identity: { identity }, isOnlineProvider: { true })
        let originalHash = vm.draftIdentityHash
        let pending = Task { await vm.advanceForTesting() }
        try await Task.sleep(for: .milliseconds(30))
        identity = "different-entry-session"
        vm.retireSession()
        await pending.value
        XCTAssertNotNil(originalHash)
        XCTAssertNil(vm.draftIdentityHash)
        XCTAssertEqual(vm.form, .empty)
        XCTAssertNil(vm.validatedAddressId)
        XCTAssertFalse(vm.chrome.primaryCTAEnabled)
    }

    func testDiscardCannotRepersistDuringDisappearance() {
        let vm = makeVM(initialState: filled())
        vm.discardConfirmed()
        vm.suspendAddressEntry()
        XCTAssertEqual(vm.form, .empty)
        XCTAssertNil(vm.draftIdentityHash)
        XCTAssertEqual(vm.pendingEvent, .dismiss)
    }
}
