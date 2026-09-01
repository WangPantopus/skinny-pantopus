//
//  EmergencyInfoViewModelTests.swift
//  PantopusTests
//
//  Covers the Emergency info VM (T6.4b / P17):
//    - four-state transitions (loading / loaded / empty / error)
//    - category mapping from `HomeEmergency.type`
//    - chip strip filter narrows visible sections
//    - pinned pseudo-group renders only on the "All" chip
//    - banner summary projection (item count, last reviewed, needs review)
//

import XCTest
@testable import Pantopus

@MainActor
final class EmergencyInfoViewModelTests: XCTestCase {
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

    private func makeVM() -> EmergencyInfoViewModel {
        EmergencyInfoViewModel(homeId: "home-1", api: makeAPI())
    }

    private func dto(
        id: String = "e1",
        type: String,
        label: String = "Item",
        location: String? = nil,
        details: [String: String] = [:]
    ) -> HomeEmergencyDTO {
        HomeEmergencyDTO(
            id: id,
            homeId: "home-1",
            type: type,
            label: label,
            location: location,
            details: details
        )
    }

    // MARK: - Four states

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"emergencies\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No emergency info set up")
        XCTAssertEqual(content.ctaTitle, "Add info")
    }

    func testErrorResponseRendersErrorState() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{\"error\":\"boom\"}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected error, got \(vm.state)")
            return
        }
    }

    func testLoadedResponseBucketsByCategory() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e1","home_id":"home-1","type":"shutoff_water","label":"Main water"},
              {"id":"e2","home_id":"home-1","type":"emergency_contacts","label":"911"},
              {"id":"e3","home_id":"home-1","type":"evac_plan","label":"Meeting spot"},
              {"id":"e4","home_id":"home-1","type":"first_aid","label":"Kit"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 4, "One section per category")
        XCTAssertEqual(sections.map(\.header), ["Shutoffs", "Contacts", "Evacuation", "Medical"])
    }

    // MARK: - Category mapping

    func testCategoryMappingForBackendTypes() {
        XCTAssertEqual(EmergencyCategory.from(type: "shutoff_water"), .shutoff)
        XCTAssertEqual(EmergencyCategory.from(type: "shutoff_gas"), .shutoff)
        XCTAssertEqual(EmergencyCategory.from(type: "shutoff_electric"), .shutoff)
        XCTAssertEqual(EmergencyCategory.from(type: "breaker_map"), .shutoff)
        XCTAssertEqual(EmergencyCategory.from(type: "emergency_contacts"), .contact)
        XCTAssertEqual(EmergencyCategory.from(type: "evac_plan"), .evac)
        XCTAssertEqual(EmergencyCategory.from(type: "first_aid"), .medical)
        XCTAssertEqual(EmergencyCategory.from(type: "extinguisher"), .medical)
        // Unknown / "other" falls back to .contact (safest household default).
        XCTAssertEqual(EmergencyCategory.from(type: "other"), .contact)
        XCTAssertEqual(EmergencyCategory.from(type: "unknown_value"), .contact)
    }

    func testCategoryGlyphPerType() {
        XCTAssertEqual(EmergencyCategory.glyph(for: "shutoff_water"), .droplet)
        XCTAssertEqual(EmergencyCategory.glyph(for: "shutoff_gas"), .flame)
        XCTAssertEqual(EmergencyCategory.glyph(for: "shutoff_electric"), .zap)
        XCTAssertEqual(EmergencyCategory.glyph(for: "evac_plan"), .flag)
        XCTAssertEqual(EmergencyCategory.glyph(for: "emergency_contacts"), .phone)
        XCTAssertEqual(EmergencyCategory.glyph(for: "first_aid"), .cross)
    }

    // MARK: - Row projection

    func testProjectionFillsBodyAndChips() {
        let item = dto(
            type: "emergency_contacts",
            label: "911",
            details: ["phone": "911", "detail": "Dispatcher will ask address."]
        )
        let projection = EmergencyInfoViewModel.project(dto: item, pinned: false)
        XCTAssertEqual(projection.title, "911")
        XCTAssertEqual(projection.category, .contact)
        XCTAssertEqual(projection.glyph, .phone)
        XCTAssertEqual(projection.body, "Dispatcher will ask address.")
        XCTAssertEqual(projection.bodyIcon, .phone)
        XCTAssertEqual(projection.actionTarget, "911")
        XCTAssertFalse(projection.needsReview)
    }

    func testProjectionReviewedAndNeedsReview() {
        let reviewed = dto(
            type: "shutoff_water",
            details: ["reviewed": "Aug 14", "detail": "Basement closet"]
        )
        let reviewedP = EmergencyInfoViewModel.project(dto: reviewed, pinned: false)
        XCTAssertEqual(reviewedP.lastReviewed, "Reviewed Aug 14")
        XCTAssertFalse(reviewedP.needsReview)

        let dueForReview = dto(
            type: "shutoff_water",
            details: ["needs_review": "1", "detail": "Behind fridge"]
        )
        let dueP = EmergencyInfoViewModel.project(dto: dueForReview, pinned: false)
        XCTAssertTrue(dueP.needsReview)
    }

    // MARK: - Chip filter

    func testChipFilterNarrowsToCategory() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e1","home_id":"home-1","type":"shutoff_water","label":"Main water"},
              {"id":"e2","home_id":"home-1","type":"emergency_contacts","label":"911"},
              {"id":"e3","home_id":"home-1","type":"evac_plan","label":"Meeting spot"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = EmergencyFilter.contact.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].header, "Contacts")
        XCTAssertEqual(sections[0].rows.count, 1)
    }

    // MARK: - Pinned pseudo-group

    func testPinnedSectionAppearsOnAllChipOnly() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"emergencies":[
              {"id":"e1","home_id":"home-1","type":"shutoff_water","label":"Main water",
               "details":{"pinned":"1"}},
              {"id":"e2","home_id":"home-1","type":"emergency_contacts","label":"911"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(allSections, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(allSections.first?.header, "Pinned · Quick access")

        // Switching to a single-category chip drops the pinned pseudo-group.
        vm.selectedTab = EmergencyFilter.shutoff.rawValue
        guard case let .loaded(filtered, _) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(filtered.first?.header, "Shutoffs")
        XCTAssertNotEqual(filtered.first?.header, "Pinned · Quick access")
    }

    // MARK: - Banner summary

    func testBannerSummaryNoReview() {
        let items = [
            dto(id: "e1", type: "shutoff_water", details: ["reviewed": "Aug 14"]),
            dto(id: "e2", type: "emergency_contacts", details: ["reviewed": "Aug 14"])
        ]
        let summary = EmergencyInfoViewModel.summarize(emergencies: items)
        XCTAssertEqual(summary.totalItems, 2)
        XCTAssertEqual(summary.needsReviewCount, 0)
        XCTAssertEqual(summary.lastReviewedLabel, "reviewed Aug 14")
        XCTAssertTrue(summary.hasContent)
    }

    func testBannerSummaryWithReviewBacklog() {
        let items = [
            dto(id: "e1", type: "shutoff_water", details: ["needs_review": "1"]),
            dto(id: "e2", type: "emergency_contacts", details: ["reviewed": "Aug 14"])
        ]
        let summary = EmergencyInfoViewModel.summarize(emergencies: items)
        XCTAssertEqual(summary.needsReviewCount, 1)
        XCTAssertEqual(summary.lastReviewedLabel, "reviewed Aug 14")
    }
}
