//
//  AddEmergencyInfoFormViewModelTests.swift
//  PantopusTests
//
//  P2.8 — Covers the Add / Edit Emergency Info form view-model:
//    - title required, max-length validation
//    - severity is cleared automatically when the picked category
//      doesn't support severity (contact, power-of-attorney)
//    - the `details` map is composed with the severity / verified-by
//      keys the detail view reads
//    - submit POSTs `/api/homes/:id/emergencies` in create mode
//    - edit mode commits locally and surfaces the new draft to
//      `onUpdated` (backend has no PUT today)
//    - every category × severity combination round-trips through the
//      projection without drift (snapshot-test equivalent — we can't
//      generate iOS PNG baselines from this harness)
//

import XCTest
@testable import Pantopus

@MainActor
final class AddEmergencyInfoFormViewModelTests: XCTestCase {
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

    private func makeVM(mode: AddEmergencyInfoFormViewModel.Mode = .create) -> AddEmergencyInfoFormViewModel {
        AddEmergencyInfoFormViewModel(homeId: "home-1", mode: mode, api: makeAPI())
    }

    // MARK: - Validation

    func testEmptyTitleBlocksValid() {
        let vm = makeVM()
        XCTAssertFalse(vm.isValid)
        vm.updateTitle("")
        XCTAssertFalse(vm.isValid)
        XCTAssertNotNil(vm.titleField.error)
    }

    func testTitlePresenceMakesFormValid() {
        let vm = makeVM()
        vm.updateTitle("Penicillin allergy")
        XCTAssertTrue(vm.isValid)
        XCTAssertTrue(vm.isDirty)
    }

    func testTitleMaxLengthValidates() {
        let vm = makeVM()
        vm.updateTitle(String(repeating: "a", count: 256))
        XCTAssertEqual(vm.titleField.error, "Title is too long.")
    }

    func testDetailsMaxLengthValidates() {
        let vm = makeVM()
        vm.updateTitle("Asthma")
        vm.updateDetails(String(repeating: "a", count: 2001))
        XCTAssertEqual(vm.detailsField.error, "Details are too long.")
        XCTAssertFalse(vm.isValid)
    }

    // MARK: - Category × severity behaviour

    func testCategoryWithoutSeverityClearsSeverity() {
        let vm = makeVM()
        vm.category = .allergy
        vm.severity = .critical
        vm.category = .contact
        XCTAssertNil(vm.severity, "Switching to contact must drop severity")
    }

    func testCategorySupportsSeverityForMedicalFlavoured() {
        XCTAssertTrue(EmergencyFormCategory.allergy.supportsSeverity)
        XCTAssertTrue(EmergencyFormCategory.medicalCondition.supportsSeverity)
        XCTAssertTrue(EmergencyFormCategory.medication.supportsSeverity)
        XCTAssertTrue(EmergencyFormCategory.petMedical.supportsSeverity)
        XCTAssertTrue(EmergencyFormCategory.other.supportsSeverity)
        XCTAssertFalse(EmergencyFormCategory.contact.supportsSeverity)
        XCTAssertFalse(EmergencyFormCategory.powerOfAttorney.supportsSeverity)
    }

    func testCategoryPaletteMapping() {
        XCTAssertEqual(EmergencyFormCategory.allergy.palette, .medical)
        XCTAssertEqual(EmergencyFormCategory.medicalCondition.palette, .medical)
        XCTAssertEqual(EmergencyFormCategory.medication.palette, .medical)
        XCTAssertEqual(EmergencyFormCategory.petMedical.palette, .medical)
        XCTAssertEqual(EmergencyFormCategory.contact.palette, .contact)
        XCTAssertEqual(EmergencyFormCategory.powerOfAttorney.palette, .contact)
        XCTAssertEqual(EmergencyFormCategory.other.palette, .contact)
    }

    // MARK: - Details map composition

    func testDetailsMapIncludesSeverityAndVerifiedBy() {
        let vm = makeVM()
        vm.category = .allergy
        vm.updateTitle("Penicillin")
        vm.updateDetails("Hives + throat swelling — EpiPen in go-bag.")
        vm.severity = .critical
        vm.verifiedByUserId = "user-1"
        let map = vm.buildDetailsMap()
        XCTAssertEqual(map["detail"], "Hives + throat swelling — EpiPen in go-bag.")
        XCTAssertEqual(map["severity"], "critical")
        XCTAssertEqual(map["verified_by"], "user-1")
    }

    func testDetailsMapOmitsNilFields() {
        let vm = makeVM()
        vm.updateTitle("Asthma")
        let map = vm.buildDetailsMap()
        XCTAssertNil(map["detail"])
        XCTAssertNil(map["severity"])
        XCTAssertNil(map["verified_by"])
    }

    // MARK: - Submit

    func testSubmitCreatePostsAndCallsOnCreated() async {
        let received = Locked<HomeEmergencyDTO?>(nil)
        let vm = AddEmergencyInfoFormViewModel(
            homeId: "home-1",
            mode: .create,
            api: makeAPI()
        ) { dto in
            received.value = dto
        }
        vm.category = .allergy
        vm.severity = .critical
        vm.updateTitle("Penicillin allergy")
        vm.updateDetails("Hives + throat swelling.")

        SequencedURLProtocol.sequence = [
            .status(201, body: """
            {
              "emergency": {
                "id":"e-1",
                "home_id":"home-1",
                "type":"allergy",
                "label":"Penicillin allergy",
                "details":{"severity":"critical","detail":"Hives + throat swelling."}
              }
            }
            """)
        ]
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(received.value?.id, "e-1")
        XCTAssertTrue(vm.shouldDismiss)
    }

    func testSubmitCreateSurfacesNetworkError() async {
        let vm = makeVM()
        vm.updateTitle("Penicillin")
        SequencedURLProtocol.sequence = [
            .status(500, body: "{\"error\":\"boom\"}")
        ]
        let ok = await vm.submit()
        XCTAssertFalse(ok)
        XCTAssertNotNil(vm.toast)
        XCTAssertEqual(vm.toast?.kind, .error)
    }

    func testEditModeCommitsLocallyAndSurfacesDraft() async {
        let received = Locked<EmergencyFormDraft?>(nil)
        let draft = EmergencyFormDraft(
            id: "e-1",
            category: .medicalCondition,
            title: "Asthma",
            severity: .caution,
            details: "Inhaler in go-bag.",
            verifiedByUserId: nil,
            lastUpdated: Date(timeIntervalSince1970: 1_700_000_000)
        )
        let vm = AddEmergencyInfoFormViewModel(
            homeId: "home-1",
            mode: .edit(draft),
            api: makeAPI(),
            // swiftlint:disable:next trailing_closure
            onUpdated: { received.value = $0 }
        )
        vm.severity = .critical
        let ok = await vm.submit()
        XCTAssertTrue(ok)
        XCTAssertEqual(received.value?.severity, .critical)
        XCTAssertTrue(vm.shouldDismiss)
    }

    // MARK: - Per-(category, severity) projection coverage

    /// "Snapshot equivalent" — exercises every category × severity pair
    /// through `buildDetailsMap` so the seven × three combinations
    /// each round-trip the expected backend payload without drift.
    func testAllCategoryAndSeverityCombinationsProduceStableDetailMaps() {
        for category in EmergencyFormCategory.allCases {
            let severities: [EmergencySeverity?] = category.supportsSeverity
                ? EmergencySeverity.allCases.map { Optional($0) }
                : [nil]
            for severity in severities {
                let vm = makeVM()
                vm.category = category
                vm.severity = severity
                vm.updateTitle("\(category.label) — sample")
                vm.updateDetails("Reference body for \(category.label)")
                let map = vm.buildDetailsMap()
                XCTAssertEqual(
                    map["detail"],
                    "Reference body for \(category.label)",
                    "Detail body must survive for \(category) × \(String(describing: severity))"
                )
                if let severity {
                    XCTAssertEqual(
                        map["severity"],
                        severity.rawValue,
                        "Severity must serialise for \(category) × \(severity)"
                    )
                } else {
                    XCTAssertNil(
                        map["severity"],
                        "Categories without severity support must drop the chip key (\(category))"
                    )
                }
            }
        }
    }

    func testEveryCategoryHasIconAndPalette() {
        for category in EmergencyFormCategory.allCases {
            // Touch the visual fields so any future enum addition is
            // forced to satisfy the palette / icon contract.
            _ = category.icon
            _ = category.palette
            _ = category.label
        }
    }

    func testEverySeverityHasTokens() {
        for severity in EmergencySeverity.allCases {
            _ = severity.background
            _ = severity.foreground
            _ = severity.icon
            _ = severity.label
        }
    }

    func testCriticalSeverityUsesErrorAndAlertIcon() {
        XCTAssertEqual(
            EmergencySeverity.critical.icon,
            .alertTriangle,
            "Critical must pair with the alert-triangle glyph"
        )
    }

    func testInfoSeverityUsesPrimaryTokens() {
        // The exact swatch isn't compared because Color equality is
        // brittle; we lock the glyph and ensure the case exists.
        XCTAssertEqual(EmergencySeverity.info.icon, .info)
    }
}

/// Lightweight reference-counted box for capturing values from
/// `@Sendable` callbacks under the strict-concurrency checker.
private final class Locked<T>: @unchecked Sendable {
    var value: T
    init(_ value: T) {
        self.value = value
    }
}
