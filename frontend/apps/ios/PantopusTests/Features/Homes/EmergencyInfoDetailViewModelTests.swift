//
//  EmergencyInfoDetailViewModelTests.swift
//  PantopusTests
//
//  P2.8 — Covers the Emergency Info detail view-model:
//    - load fetches the parent list and finds the row by id
//    - missing rows render the dedicated empty state
//    - errors flip to the error state
//    - apply(updated:) optimistically swaps the loaded draft
//    - confirmDelete flips `isDeleted` so the view can pop
//    - draft seeding handles legacy (non-form) backend types
//

import XCTest
@testable import Pantopus

@MainActor
final class EmergencyInfoDetailViewModelTests: XCTestCase {
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

    private func makeVM(emergencyId: String = "e-1") -> EmergencyInfoDetailViewModel {
        EmergencyInfoDetailViewModel(
            homeId: "home-1",
            emergencyId: emergencyId,
            api: makeAPI()
        )
    }

    // MARK: - Load

    func testLoadFindsRowAndProjectsDraft() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e-1","home_id":"home-1","type":"allergy",
               "label":"Penicillin","details":{"severity":"critical","detail":"EpiPen"}}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(draft) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(draft.title, "Penicillin")
        XCTAssertEqual(draft.category, .allergy)
        XCTAssertEqual(draft.severity, .critical)
        XCTAssertEqual(draft.details, "EpiPen")
    }

    func testLoadMissingRowFlipsToMissing() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"emergencies\":[]}")]
        let vm = makeVM()
        await vm.load()
        XCTAssertEqual(vm.state, .missing)
    }

    func testLoadErrorFlipsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        if case .error = vm.state { return }
        XCTFail("Expected error, got \(vm.state)")
    }

    func testLegacyTypeStillRendersAsOther() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e-1","home_id":"home-1","type":"shutoff_water",
               "label":"Main water","location":"Basement closet",
               "details":{"detail":"Behind heater"}}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(draft) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(
            draft.category,
            .other,
            "Legacy backend types fall back to .other category in the detail surface"
        )
        XCTAssertEqual(draft.title, "Main water")
        XCTAssertEqual(draft.details, "Behind heater")
    }

    // MARK: - Local edit / delete

    func testApplyUpdatedSwapsLoadedDraft() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e-1","home_id":"home-1","type":"medication",
               "label":"Metformin","details":{"detail":"Daily 500mg"}}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let updated = EmergencyFormDraft(
            id: "e-1",
            category: .medication,
            title: "Metformin XR",
            severity: .caution,
            details: "1g nightly",
            verifiedByUserId: nil,
            lastUpdated: Date()
        )
        vm.apply(updated: updated)
        guard case let .loaded(draft) = vm.state else {
            XCTFail("Expected loaded after apply")
            return
        }
        XCTAssertEqual(draft.title, "Metformin XR")
        XCTAssertEqual(draft.severity, .caution)
    }

    func testConfirmDeleteFlipsDeletedFlag() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e-1","home_id":"home-1","type":"contact",
               "label":"Dr. Lin","details":{}}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.showsDeleteConfirm = true
        vm.confirmDelete()
        XCTAssertTrue(vm.isDeleted)
        XCTAssertFalse(vm.isDeleting)
        XCTAssertFalse(vm.showsDeleteConfirm)
    }

    func testEmergencyFormDraftFromDtoPreservesAllFields() {
        let dto = HomeEmergencyDTO(
            id: "e-1",
            homeId: "home-1",
            type: "pet_medical",
            label: "Murphy — chicken allergy",
            location: nil,
            details: [
                "detail": "Hives if exposed",
                "severity": "caution",
                "verified_by": "user-2"
            ]
        )
        let draft = EmergencyFormDraft.from(dto: dto)
        XCTAssertNotNil(draft)
        XCTAssertEqual(draft?.category, .petMedical)
        XCTAssertEqual(draft?.severity, .caution)
        XCTAssertEqual(draft?.verifiedByUserId, "user-2")
    }
}
