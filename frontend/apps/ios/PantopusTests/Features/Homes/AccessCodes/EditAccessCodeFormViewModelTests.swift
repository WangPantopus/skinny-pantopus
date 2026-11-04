//
//  EditAccessCodeFormViewModelTests.swift
//  PantopusTests
//
//  P3.1 — Add / Edit Access Code form. Covers:
//    - default add pose (no secretId, no initialCategory) → wifi seed
//    - hydration of the edit pose from the list payload
//    - per-category projection (each of the six AccessCategory cases)
//    - masked vs revealed value-field state via `toggleReveal`
//    - copy-to-clipboard emits the "Copied" toast
//    - validation: empty label / value blocks submit
//    - submit POST happy path → `Code added` toast
//    - submit PUT happy path → `Code updated` toast
//
//  Network calls are mocked via `SequencedURLProtocol`.
//

import XCTest
@testable import Pantopus

@MainActor
final class EditAccessCodeFormViewModelTests: XCTestCase {
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
        secretId: String? = nil,
        initialCategory: AccessCategory? = nil,
        clipboard: @escaping @MainActor (String) -> Void = { _ in }
    ) -> EditAccessCodeFormViewModel {
        EditAccessCodeFormViewModel(
            homeId: "home_1",
            secretId: secretId,
            initialCategory: initialCategory,
            api: makeAPI(),
            clipboard: clipboard
        )
    }

    private static let editSecretsJSON = """
    {"secrets":[
      {"id":"s1","home_id":"home_1","access_type":"wifi","label":"Main network",
       "secret_value":"MaplePan@2025!","notes":"Guests use the other one",
       "visibility":"members"}
    ]}
    """

    // MARK: - Defaults

    func testAddPoseSeedsWifiCategoryAndMembersVisibility() async {
        let vm = makeVM()
        await vm.load()

        XCTAssertEqual(vm.category, .wifi)
        XCTAssertEqual(vm.visibility, .members)
        XCTAssertEqual(vm.title, "Add access code")
        XCTAssertEqual(vm.fields[.label]?.value, "")
        XCTAssertEqual(vm.fields[.value]?.value, "")
        XCTAssertFalse(vm.isEditing)
    }

    func testAddPoseRespectsInitialCategory() async {
        let vm = makeVM(initialCategory: .alarm)
        await vm.load()

        XCTAssertEqual(vm.category, .alarm)
        XCTAssertEqual(vm.fields[.category]?.value, "alarm")
    }

    // MARK: - Edit hydration

    func testEditPoseHydratesFromSecretsList() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editSecretsJSON)
        ]
        let vm = makeVM(secretId: "s1")
        await vm.load()

        XCTAssertEqual(vm.title, "Edit access code")
        XCTAssertTrue(vm.isEditing)
        XCTAssertEqual(vm.category, .wifi)
        XCTAssertEqual(vm.fields[.label]?.value, "Main network")
        XCTAssertEqual(vm.fields[.value]?.value, "MaplePan@2025!")
        XCTAssertEqual(vm.fields[.notes]?.value, "Guests use the other one")
        XCTAssertEqual(vm.visibility, .members)
        // Clean start — `isDirty` only flips after the user types.
        XCTAssertFalse(vm.isDirty)
        XCTAssertTrue(vm.isValid)
    }

    func testEditPoseMissingSecretSurfacesError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: "{\"secrets\":[]}")
        ]
        let vm = makeVM(secretId: "does-not-exist")
        await vm.load()

        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    // MARK: - Category projection

    func testEachCategorySelectsCleanly() async {
        let vm = makeVM()
        await vm.load()

        for category in AccessCategory.allCases {
            vm.selectCategory(category)
            XCTAssertEqual(vm.category, category)
            XCTAssertEqual(vm.fields[.category]?.value, category.rawValue)
        }
    }

    // MARK: - Reveal toggle

    func testToggleRevealFlipsRevealState() async {
        let vm = makeVM()
        await vm.load()

        XCTAssertFalse(vm.isRevealed)
        vm.toggleReveal()
        XCTAssertTrue(vm.isRevealed)
        vm.toggleReveal()
        XCTAssertFalse(vm.isRevealed)
    }

    // MARK: - Copy

    func testCopyValueWritesClipboardAndShowsCopiedToast() async {
        var copied: String?
        let vm = makeVM { value in copied = value }
        await vm.load()

        vm.update(.label, to: "Main")
        vm.update(.value, to: "Hunter2!")
        vm.copyValue()

        XCTAssertEqual(copied, "Hunter2!")
        XCTAssertEqual(vm.toast?.text, "Copied")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testCopyValueWithEmptyValueIsNoop() async {
        var copied: String?
        let vm = makeVM { value in copied = value }
        await vm.load()

        vm.copyValue()
        XCTAssertNil(copied)
        XCTAssertNil(vm.toast)
    }

    // MARK: - Validation

    func testValidationBlocksSubmitOnEmptyLabel() async {
        let vm = makeVM()
        await vm.load()

        vm.update(.value, to: "Hunter2!")
        XCTAssertFalse(vm.isValid, "Label required")

        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.fields[.label]?.error, "Label is required.")
    }

    func testValidationBlocksSubmitOnEmptyValue() async {
        let vm = makeVM()
        await vm.load()

        vm.update(.label, to: "Main")
        XCTAssertFalse(vm.isValid, "Code required")
    }

    // MARK: - Submit happy paths

    func testSubmitPostHappyPathSetsAddedToast() async {
        let createResponse = """
        {"secret":{"id":"s_new","home_id":"home_1","access_type":"wifi",
         "label":"Main","secret_value":"Hunter2!","visibility":"members"}}
        """
        SequencedURLProtocol.sequence = [
            .status(201, body: createResponse)
        ]
        let vm = makeVM()
        await vm.load()

        vm.update(.label, to: "Main")
        vm.update(.value, to: "Hunter2!")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.toast?.text, "Code added.")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testSubmitPutHappyPathSetsUpdatedToast() async {
        let updateResponse = """
        {"secret":{"id":"s1","home_id":"home_1","access_type":"wifi",
         "label":"Main network","secret_value":"Different!","visibility":"members"}}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.editSecretsJSON),
            .status(200, body: updateResponse)
        ]
        let vm = makeVM(secretId: "s1")
        await vm.load()

        vm.update(.value, to: "Different!")
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(vm.toast?.text, "Code updated.")
        XCTAssertEqual(vm.toast?.kind, .success)
    }

    func testSubmitFailureSurfacesErrorToast() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"Failed to create access secret\"}")
        ]
        let vm = makeVM()
        await vm.load()

        vm.update(.label, to: "Main")
        vm.update(.value, to: "Hunter2!")
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    // MARK: - Backend wire format

    func testCategoryWireMappingMatchesSchemaAllowedList() {
        // The DB CHECK constraint is
        // ['wifi','door_code','gate_code','lockbox','garage','alarm','other'].
        XCTAssertEqual(AccessCategory.wifi.backendAccessType, "wifi")
        XCTAssertEqual(AccessCategory.alarm.backendAccessType, "alarm")
        XCTAssertEqual(AccessCategory.gate.backendAccessType, "gate_code")
        XCTAssertEqual(AccessCategory.lockbox.backendAccessType, "lockbox")
        XCTAssertEqual(AccessCategory.garage.backendAccessType, "garage")
        XCTAssertEqual(AccessCategory.smartLock.backendAccessType, "other")
    }
}
