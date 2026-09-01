//
//  AccessCodesViewModelTests.swift
//  PantopusTests
//
//  T6.4a — Access codes (per-home, category-grouped). Covers:
//    - load → loaded / empty / error transitions
//    - chip-strip filter selection rebuilds visible sections
//    - tap-to-reveal toggles the row's subtitle between mask / value
//    - copy emits the "Code copied" toast + writes to the bound clipboard
//    - category fallback for unknown wire `access_type` strings
//

import XCTest
@testable import Pantopus

@MainActor
final class AccessCodesViewModelTests: XCTestCase {
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
        homeId: String = "home_1",
        clipboard: @escaping @MainActor (String) -> Void = { _ in }
    ) -> AccessCodesViewModel {
        AccessCodesViewModel(
            homeId: homeId,
            homeName: "412 Birch Ln",
            api: makeAPI(),
            clipboard: clipboard
        )
    }

    private static let mixedJSON = """
    {"secrets":[
      {"id":"s1","home_id":"home_1","access_type":"wifi","label":"Main network",
       "secret_value":"MaplePan@2025!","notes":"Household · 4 members","visibility":"members"},
      {"id":"s2","home_id":"home_1","access_type":"alarm","label":"Disarm — front panel",
       "secret_value":"184729","notes":null,"visibility":"managers"},
      {"id":"s3","home_id":"home_1","access_type":"lockbox","label":"Front porch lockbox",
       "secret_value":"4218","notes":null,"visibility":"members"},
      {"id":"s4","home_id":"home_1","access_type":"smart_lock","label":"Front door",
       "secret_value":"SmartCode-9","notes":null,"visibility":"managers"}
    ]}
    """

    private static let emptyJSON = """
    {"secrets":[]}
    """

    // MARK: - Lifecycle

    func testLoadEmptyTransitionsToEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.emptyJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected .empty, got \(vm.state)")
        }
        XCTAssertEqual(content.headline, "No access codes yet")
        XCTAssertEqual(content.icon, .keyRound)
        XCTAssertEqual(content.ctaTitle, "Add your first code")
    }

    func testLoadPopulatedTransitionsToLoaded() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.mixedJSON)]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            return XCTFail("Expected .loaded, got \(vm.state)")
        }
        XCTAssertEqual(hasMore, false)
        // Sections render in displayOrder, skipping empties. Four
        // categories present: wifi, alarm, lockbox, smart_lock.
        XCTAssertEqual(sections.count, 4)
        XCTAssertEqual(sections.map(\.id), [
            "category-wifi",
            "category-alarm",
            "category-lockbox",
            "category-smart_lock"
        ])
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.title, "Main network")
        // Card-style rendering keeps the rows in a single rounded
        // container, matching Discover hub.
        for section in sections {
            if case .card = section.style { continue } else {
                XCTFail("Expected .card section style, got \(section.style)")
            }
        }
    }

    func testLoadFailureTransitionsToError() async {
        SequencedURLProtocol.sequence = [.status(500, body: "{}")]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            return XCTFail("Expected .error, got \(vm.state)")
        }
    }

    // MARK: - Chip filter

    func testSelectingChipFiltersToOneSection() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.mixedJSON)]
        let vm = makeVM()
        await vm.load()

        vm.selectChip("alarm")

        guard case let .loaded(sections, _) = vm.state else {
            return XCTFail("Expected .loaded after filter")
        }
        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections.first?.id, "category-alarm")
        XCTAssertEqual(sections.first?.rows.first?.title, "Disarm — front panel")
    }

    func testSelectingChipWithNoMatchesShowsFilteredEmpty() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.mixedJSON)]
        let vm = makeVM()
        await vm.load()

        vm.selectChip("garage")

        guard case let .empty(content) = vm.state else {
            return XCTFail("Expected .empty after filter, got \(vm.state)")
        }
        XCTAssertEqual(content.headline, "No garage codes yet")
        XCTAssertEqual(content.ctaTitle, "Add Garage code")
    }

    // MARK: - Reveal toggle

    func testToggleRevealFlipsSubtitleBetweenMaskAndValue() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.mixedJSON)]
        let vm = makeVM()
        await vm.load()

        let wifiSecret = HomeAccessSecretDTO(
            id: "s1",
            homeId: "home_1",
            accessType: "wifi",
            label: "Main network",
            secretValue: "MaplePan@2025!"
        )

        let maskedRow = vm.rowFor(wifiSecret)
        XCTAssertEqual(maskedRow.subtitle, AccessCodesViewModel.mask(for: wifiSecret.secretValue))

        vm.toggleReveal("s1")
        XCTAssertTrue(vm.revealedIds.contains("s1"))

        let revealedRow = vm.rowFor(wifiSecret)
        XCTAssertEqual(revealedRow.subtitle, "MaplePan@2025!")

        vm.toggleReveal("s1")
        XCTAssertFalse(vm.revealedIds.contains("s1"))
    }

    // MARK: - Copy + toast

    func testCopyValueWritesToClipboardAndShowsToast() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.mixedJSON)]
        var copied: String?
        let vm = makeVM { value in
            copied = value
        }
        await vm.load()

        vm.copyValue(for: "s2")

        XCTAssertEqual(copied, "184729")
        XCTAssertEqual(vm.toastMessage, "Code copied")
    }

    func testCopyForUnknownIdIsANoop() async {
        SequencedURLProtocol.sequence = [.status(200, body: Self.mixedJSON)]
        var copied: String?
        let vm = makeVM { value in
            copied = value
        }
        await vm.load()

        vm.copyValue(for: "does-not-exist")

        XCTAssertNil(copied)
        XCTAssertNil(vm.toastMessage)
    }

    // MARK: - Category fallback

    func testCategoryFromUnknownAccessTypeFallsBackToLockbox() {
        XCTAssertEqual(AccessCategory.from(accessType: "totally_unknown_type"), .lockbox)
        XCTAssertEqual(AccessCategory.from(accessType: nil), .lockbox)
    }

    func testCategoryFromFuzzyAccessTypeMatchesSubstring() {
        XCTAssertEqual(AccessCategory.from(accessType: "guest_wifi_pool"), .wifi)
        XCTAssertEqual(AccessCategory.from(accessType: "garage_opener_2"), .garage)
        XCTAssertEqual(AccessCategory.from(accessType: "smart_door"), .smartLock)
    }

    // MARK: - Mask geometry

    func testMaskHasAtLeastFourDots() {
        XCTAssertEqual(AccessCodesViewModel.mask(for: "12").count, 4)
        XCTAssertEqual(AccessCodesViewModel.mask(for: "").count, 4)
    }

    func testMaskCapsAtTwelveDots() {
        let long = String(repeating: "A", count: 50)
        XCTAssertEqual(AccessCodesViewModel.mask(for: long).count, 12)
    }
}
