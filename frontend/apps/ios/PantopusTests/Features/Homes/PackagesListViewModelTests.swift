//
//  PackagesListViewModelTests.swift
//  PantopusTests
//
//  Covers the Packages VM (T6.3d / P14):
//    - four-state transitions (loading / loaded / empty / error)
//    - status taxonomy mapping (backend enum → PackageChipStatus)
//    - row projection (title fallbacks, subtitle, body recipient)
//    - tab filtering (Expected / Delivered / Archived buckets)
//    - tab counts
//    - banner summary projection
//    - courier inference (one test per carrier)
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class PackagesListViewModelTests: XCTestCase {
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

    /// Fixed "now" so banner counts are deterministic.
    private static let fixedNow: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: "2026-05-15T12:00:00.000Z") ??
            Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM(
        api: APIClient? = nil,
        currentUserId: String? = "viewer",
        memberLookup: @escaping @Sendable (String) -> String? = { _ in nil }
    ) -> PackagesListViewModel {
        let frozen = Self.fixedNow
        return PackagesListViewModel(
            homeId: "home-1",
            api: api ?? makeAPI(),
            currentUserId: currentUserId,
            memberLookup: memberLookup
        ) { frozen }
    }

    private func makePackage(
        id: String = "p",
        status: String = "expected",
        carrier: String? = nil,
        trackingNumber: String? = nil,
        description: String? = nil,
        deliveryInstructions: String? = nil,
        expectedAt: String? = nil,
        deliveredAt: String? = nil,
        pickedUpBy: String? = nil
    ) -> PackageDTO {
        PackageDTO(
            id: id,
            homeId: "home-1",
            carrier: carrier,
            trackingNumber: trackingNumber,
            vendorName: nil,
            description: description,
            deliveryInstructions: deliveryInstructions,
            status: status,
            expectedAt: expectedAt,
            deliveredAt: deliveredAt,
            pickedUpBy: pickedUpBy
        )
    }

    // MARK: - Four states

    func testEmptyResponseRendersEmptyState() async {
        SequencedURLProtocol.sequence = [.status(200, body: "{\"packages\":[]}")]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No packages tracked yet")
        XCTAssertEqual(content.ctaTitle, "Log a package")
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

    func testLoadedResponseMapsRowsToStatusChipTrailing() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"packages":[
              {"id":"p1","home_id":"home-1","carrier":"USPS",
               "tracking_number":"9405 5118 4471","description":"Birthday cards",
               "delivery_instructions":"Mailbox","status":"out_for_delivery"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, hasMore) = vm.state else {
            XCTFail("Expected loaded, got \(vm.state)")
            return
        }
        XCTAssertFalse(hasMore)
        XCTAssertEqual(sections[0].rows.count, 1)
        let row = sections[0].rows[0]
        XCTAssertEqual(row.id, "p1")
        XCTAssertEqual(row.title, "Birthday cards")
        XCTAssertEqual(row.subtitle, "USPS · Mailbox")
        guard case let .statusChip(text, variant) = row.trailing else {
            XCTFail("Expected statusChip trailing, got \(row.trailing)")
            return
        }
        XCTAssertEqual(text, "Out for delivery")
        XCTAssertEqual(variant, .info)
        // Leading is typeIcon driven by the courier palette.
        guard case let .typeIcon(icon, _, _) = row.leading else {
            XCTFail("Expected typeIcon leading, got \(row.leading)")
            return
        }
        XCTAssertEqual(icon, .mailbox) // USPS courier icon
    }

    // MARK: - Status mapping

    func testStatusMappingCoversAllSixBackendValues() {
        XCTAssertEqual(PackageChipStatus.from(raw: "expected"), .expected)
        XCTAssertEqual(PackageChipStatus.from(raw: "out_for_delivery"), .outForDelivery)
        XCTAssertEqual(PackageChipStatus.from(raw: "delivered"), .delivered)
        XCTAssertEqual(PackageChipStatus.from(raw: "picked_up"), .pickedUp)
        XCTAssertEqual(PackageChipStatus.from(raw: "lost"), .lost)
        XCTAssertEqual(PackageChipStatus.from(raw: "returned"), .returned)
    }

    func testUnknownStatusFallsBackToExpected() {
        XCTAssertEqual(PackageChipStatus.from(raw: nil), .expected)
        XCTAssertEqual(PackageChipStatus.from(raw: "bogus"), .expected)
    }

    func testStatusToTabBuckets() {
        XCTAssertEqual(PackageChipStatus.expected.tab, .expected)
        XCTAssertEqual(PackageChipStatus.outForDelivery.tab, .expected)
        XCTAssertEqual(PackageChipStatus.delivered.tab, .delivered)
        XCTAssertEqual(PackageChipStatus.pickedUp.tab, .delivered)
        XCTAssertEqual(PackageChipStatus.lost.tab, .archived)
        XCTAssertEqual(PackageChipStatus.returned.tab, .archived)
    }

    // MARK: - Per-row projection

    func testTitleFallbacksToTrackingShortWhenDescriptionMissing() {
        let projection = PackagesListViewModel.project(
            package: makePackage(
                trackingNumber: "1Z9X4 W84 2218",
                description: nil
            ),
            currentUserId: nil
        ) { _ in nil }
        XCTAssertEqual(projection.title, "Tracking #…W842218")
    }

    func testTitleFallbacksToPackageWhenBothMissing() {
        let projection = PackagesListViewModel.project(
            package: makePackage(carrier: "Amazon"),
            currentUserId: nil
        ) { _ in nil }
        XCTAssertEqual(projection.title, "Package")
    }

    func testSubtitleCombinesCourierAndDrop() {
        let projection = PackagesListViewModel.project(
            package: makePackage(
                carrier: "FedEx",
                description: "Side table",
                deliveryInstructions: "Front porch"
            ),
            currentUserId: nil
        ) { _ in nil }
        XCTAssertEqual(projection.subtitle, "FedEx · Front porch")
    }

    func testSubtitleOmitsDropWhenMissing() {
        let projection = PackagesListViewModel.project(
            package: makePackage(carrier: "Amazon", description: "Cat food"),
            currentUserId: nil
        ) { _ in nil }
        XCTAssertEqual(projection.subtitle, "Amazon")
    }

    func testBodyRendersRecipientForOtherUser() {
        let projection = PackagesListViewModel.project(
            package: makePackage(
                status: "picked_up",
                description: "Jacket",
                pickedUpBy: "user-ava"
            ),
            currentUserId: "viewer"
        ) { id in id == "user-ava" ? "Ava" : nil }
        XCTAssertEqual(projection.body, "Picked up by Ava")
    }

    func testBodyOmitsRecipientWhenPickedUpByCurrentUser() {
        let projection = PackagesListViewModel.project(
            package: makePackage(
                status: "picked_up",
                description: "Jacket",
                pickedUpBy: "viewer"
            ),
            currentUserId: "viewer"
        ) { _ in "Maria" }
        XCTAssertNil(projection.body)
    }

    func testReturnedStatusGetsMutedHighlight() {
        let projection = PackagesListViewModel.project(
            package: makePackage(status: "returned"),
            currentUserId: nil
        ) { _ in nil }
        XCTAssertEqual(projection.highlight, .muted)
        XCTAssertEqual(projection.chipVariant, .neutral)
    }

    // MARK: - Courier inference

    func testCourierInferenceAmazon() {
        XCTAssertEqual(CourierKind.from(carrier: "Amazon Logistics"), .amazon)
        XCTAssertEqual(CourierKind.from(carrier: "amzl"), .amazon)
    }

    func testCourierInferenceUSPS() {
        XCTAssertEqual(CourierKind.from(carrier: "USPS"), .usps)
        XCTAssertEqual(CourierKind.from(carrier: "United States Postal Service"), .usps)
    }

    func testCourierInferenceUPS() {
        XCTAssertEqual(CourierKind.from(carrier: "UPS"), .ups)
    }

    func testCourierInferenceFedex() {
        XCTAssertEqual(CourierKind.from(carrier: "FedEx Ground"), .fedex)
        XCTAssertEqual(CourierKind.from(carrier: "Fed Ex"), .fedex)
    }

    func testCourierInferenceDHL() {
        XCTAssertEqual(CourierKind.from(carrier: "DHL Express"), .dhl)
    }

    func testCourierInferenceFallsBackToGeneric() {
        XCTAssertEqual(CourierKind.from(carrier: nil), .generic)
        XCTAssertEqual(CourierKind.from(carrier: ""), .generic)
        XCTAssertEqual(CourierKind.from(carrier: "Some niche carrier"), .generic)
    }

    // MARK: - Tab filtering + counts

    func testTabsCountMatchesEachBucket() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"packages":[
              {"id":"a","home_id":"home-1","status":"expected"},
              {"id":"b","home_id":"home-1","status":"out_for_delivery"},
              {"id":"c","home_id":"home-1","status":"delivered"},
              {"id":"d","home_id":"home-1","status":"picked_up"},
              {"id":"e","home_id":"home-1","status":"picked_up"},
              {"id":"f","home_id":"home-1","status":"lost"},
              {"id":"g","home_id":"home-1","status":"returned"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let tabs = vm.tabs
        XCTAssertEqual(tabs.count, 3)
        XCTAssertEqual(tabs[0].label, "Expected")
        XCTAssertEqual(tabs[0].count, 2) // expected + out_for_delivery
        XCTAssertEqual(tabs[1].label, "Delivered")
        XCTAssertEqual(tabs[1].count, 3) // delivered + 2 picked_up
        XCTAssertEqual(tabs[2].label, "Archived")
        XCTAssertEqual(tabs[2].count, 2) // lost + returned
    }

    func testTabSwitchFiltersWithoutRefetch() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: """
            {"packages":[
              {"id":"in1","home_id":"home-1","status":"expected"},
              {"id":"in2","home_id":"home-1","status":"out_for_delivery"},
              {"id":"done","home_id":"home-1","status":"delivered"}
            ]}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        // Switch to Delivered tab — should render the single delivered row.
        vm.selectedTab = PackagesTab.delivered.rawValue
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected loaded after tab switch")
            return
        }
        XCTAssertEqual(sections[0].rows.count, 1)
        XCTAssertEqual(sections[0].rows[0].id, "done")
    }

    // MARK: - Banner summary

    func testBannerSummarizesInFlightAndExceptions() {
        let packages = [
            makePackage(id: "a", status: "expected", expectedAt: "2026-05-15T20:00:00Z"),
            makePackage(id: "b", status: "out_for_delivery", expectedAt: "2026-05-15T18:00:00Z"),
            makePackage(id: "c", status: "expected", expectedAt: "2026-05-20T10:00:00Z"),
            makePackage(id: "d", status: "lost"),
            makePackage(id: "e", status: "delivered")
        ]
        let summary = PackagesListViewModel.summarize(packages: packages, now: Self.fixedNow)
        XCTAssertEqual(summary.inFlightCount, 3)
        XCTAssertEqual(summary.arrivingTodayCount, 2)
        XCTAssertEqual(summary.exceptionCount, 1)
        XCTAssertTrue(summary.hasContent)
    }

    func testBannerEmptyWhenNoInFlightAndNoException() {
        let packages = [
            makePackage(id: "a", status: "delivered"),
            makePackage(id: "b", status: "picked_up")
        ]
        let summary = PackagesListViewModel.summarize(packages: packages, now: Self.fixedNow)
        XCTAssertEqual(summary.inFlightCount, 0)
        XCTAssertEqual(summary.exceptionCount, 0)
        XCTAssertFalse(summary.hasContent)
    }

    // MARK: - FAB + topBarAction contract

    func testFabIsCanonicalCreateWithHomeTint() {
        let vm = makeVM()
        guard let fab = vm.fab else {
            XCTFail("Expected FAB")
            return
        }
        XCTAssertEqual(fab.accessibilityLabel, "Log a package")
        XCTAssertEqual(fab.icon, .plus)
        XCTAssertEqual(fab.tint, .home)
        if case .canonicalCreate = fab.variant {
            // ok
        } else {
            XCTFail("Expected canonicalCreate FAB, got \(fab.variant)")
        }
    }

    func testTopBarActionIsNil() {
        let vm = makeVM()
        XCTAssertNil(vm.topBarAction)
    }
}
