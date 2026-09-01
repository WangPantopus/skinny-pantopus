//
//  OffersViewModelTests.swift
//  PantopusTests
//
//  T5.2.4 — Cross-listing Offers. Covers:
//    - load → loaded / empty / error transitions
//    - tab switching (Received / Sent) flips the section without
//      refetching
//    - tab counts come from the loaded lists, not a server count
//    - row mapping: category gradient leading, priceStack trailing
//      ("$220" + "asking $240"), status chip per derived state
//    - status derivation: pending+counter → countered, pending+near-
//      expiry → expiring, pending+recent → new, accepted/assigned →
//      accepted, rejected/declined → declined, withdrawn / expired
//    - subtitle perspective: "From {name} · {city} · {time}" on
//      Received, "Your offer · {time}" on Sent
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class OffersViewModelTests: XCTestCase {
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

    /// 2026-05-15 12:00:00 UTC — Friday. Fixed so date-window tests
    /// derive the same "new" / "expiring" verdicts every run.
    private static let fixedNow: Date = {
        var components = DateComponents()
        components.year = 2026
        components.month = 5
        components.day = 15
        components.hour = 12
        components.minute = 0
        components.second = 0
        components.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return Calendar(identifier: .gregorian).date(from: components)
            ?? Date(timeIntervalSince1970: 1_778_846_400)
    }()

    private func makeVM(api: APIClient? = nil) -> OffersViewModel {
        OffersViewModel(
            api: api ?? makeAPI()
        ) { Self.fixedNow }
    }

    private static let oneReceivedOneSentJSON = (received: """
    {"offers":[
      {"id":"r1","gig_id":"g_1","user_id":"u_other","bid_amount":220,
       "message":"works for me","status":"pending",
       "created_at":"2026-05-15T11:48:00Z",
       "gig":{"id":"g_1","title":"Mid-century walnut credenza",
              "price":240,"category":"moving","status":"open",
              "user_id":"u_me"},
       "bidder":{"id":"u_other","name":"Anika R.","city":"Mid-City"}}
    ],"total":1}
    """, sent: """
    {"bids":[
      {"id":"s1","gig_id":"g_2","user_id":"u_me","bid_amount":50,
       "message":"i can do this","status":"pending",
       "created_at":"2026-05-13T09:00:00Z",
       "gig":{"id":"g_2","title":"Toddler bike, lightly used",
              "price":45,"category":"cleaning","status":"open",
              "user_id":"u_seller"}}
    ],"total":1}
    """)

    private static let emptyBothJSON = (
        received: "{\"offers\":[],\"total\":0}",
        sent: "{\"bids\":[],\"total\":0}"
    )

    // MARK: - Lifecycle

    func testLoadPopulatedTransitionsToLoadedOnReceivedTab() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.oneReceivedOneSentJSON.received),
            .status(200, body: Self.oneReceivedOneSentJSON.sent)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.id, "r1")
        XCTAssertEqual(vm.tabs[0].count, 1)
        XCTAssertEqual(vm.tabs[1].count, 1)
        XCTAssertEqual(vm.tabs[0].id, OffersTab.received)
        XCTAssertEqual(vm.tabs[1].id, OffersTab.sent)
    }

    func testLoadEmptyTransitionsToEmptyWithPostTaskCTA() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.emptyBothJSON.received),
            .status(200, body: Self.emptyBothJSON.sent)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No offers yet")
        XCTAssertEqual(content.ctaTitle, "Post a task")
    }

    func testLoadEmptySentSwitchesToBrowseCTA() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.emptyBothJSON.received),
            .status(200, body: Self.emptyBothJSON.sent)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = OffersTab.sent
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty on sent tab, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No offers sent yet")
        XCTAssertEqual(content.ctaTitle, "Browse listings")
    }

    func testLoadFailureTransitionsToErrorWhenCold() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{}"),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error, got \(vm.state)")
            return
        }
    }

    // MARK: - Tab switching

    func testTabSwitchUsesLocalListsWithoutRefetching() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.oneReceivedOneSentJSON.received),
            .status(200, body: Self.oneReceivedOneSentJSON.sent)
        ]
        let vm = makeVM()
        await vm.load()
        vm.selectedTab = OffersTab.sent
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after tab switch")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.id, "s1")
        XCTAssertEqual(vm.selectedTab, OffersTab.sent)
    }

    // MARK: - Status derivation

    func testStatusDerivation_PendingWithCounterIsCountered() {
        let dto = makeBid(
            id: "b",
            status: "pending",
            counterAmount: 185,
            createdAt: isoDays(ago: 3)
        )
        XCTAssertEqual(
            OffersViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .countered
        )
    }

    func testStatusDerivation_PendingNearExpiryIsExpiring() {
        let dto = makeBid(
            id: "b",
            status: "pending",
            createdAt: isoMinutes(ago: 30),
            expiresAt: isoMinutes(ahead: 60)
        )
        XCTAssertEqual(
            OffersViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .expiring
        )
    }

    func testStatusDerivation_PendingRecentIsNew() {
        let dto = makeBid(
            id: "b",
            status: "pending",
            createdAt: isoMinutes(ago: 30)
        )
        XCTAssertEqual(
            OffersViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .new
        )
    }

    func testStatusDerivation_PendingOldIsPending() {
        let dto = makeBid(
            id: "b",
            status: "pending",
            createdAt: isoDays(ago: 3)
        )
        XCTAssertEqual(
            OffersViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .pending
        )
    }

    func testStatusDerivation_AcceptedAndAssignedMapToAccepted() {
        let a = makeBid(id: "a", status: "accepted")
        let b = makeBid(id: "b", status: "assigned")
        XCTAssertEqual(OffersViewModel.derivedStatus(for: a, now: Self.fixedNow), .accepted)
        XCTAssertEqual(OffersViewModel.derivedStatus(for: b, now: Self.fixedNow), .accepted)
    }

    func testStatusDerivation_RejectedMapsToDeclined() {
        let dto = makeBid(id: "b", status: "rejected")
        XCTAssertEqual(
            OffersViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .declined
        )
    }

    func testStatusDerivation_WithdrawnAndExpiredPassThrough() {
        let w = makeBid(id: "w", status: "withdrawn")
        let e = makeBid(id: "e", status: "expired")
        XCTAssertEqual(OffersViewModel.derivedStatus(for: w, now: Self.fixedNow), .withdrawn)
        XCTAssertEqual(OffersViewModel.derivedStatus(for: e, now: Self.fixedNow), .expired)
    }

    func testStatusDerivation_PendingPastExpiryIsExpired() {
        let dto = makeBid(
            id: "b",
            status: "pending",
            createdAt: isoDays(ago: 3),
            expiresAt: isoMinutes(ago: 10)
        )
        XCTAssertEqual(
            OffersViewModel.derivedStatus(for: dto, now: Self.fixedNow),
            .expired
        )
    }

    // MARK: - Row mapping

    func testRowMapping_ReceivedRowHasCategoryGradientLeadingAndPriceStack() {
        let dto = makeBid(
            id: "r1",
            status: "pending",
            counterAmount: nil,
            createdAt: isoMinutes(ago: 30),
            bidAmount: 220,
            askingPrice: 240,
            category: "moving",
            bidder: BidderUserDTO(
                id: "u_other",
                username: "anika",
                name: "Anika R.",
                firstName: nil,
                profilePictureUrl: nil,
                city: "Mid-City",
                state: "NY"
            )
        )
        let row = OffersViewModel.row(
            dto: dto,
            perspective: .received,
            now: Self.fixedNow
        ) {}
        guard case let .categoryGradientIcon(icon, _) = row.leading else {
            XCTFail("Expected .categoryGradientIcon leading")
            return
        }
        XCTAssertEqual(icon, .package, "moving → package icon")
        guard case let .priceStack(amount, sublabel) = row.trailing else {
            XCTFail("Expected .priceStack trailing")
            return
        }
        XCTAssertEqual(amount, "$220")
        XCTAssertEqual(sublabel, "asking $240")
        XCTAssertEqual(row.subtitle, "From Anika R. · Mid-City · 30m")
        XCTAssertEqual(row.chips?.first?.text, "New offer")
    }

    func testRowMapping_SentRowOmitsBidderAndSaysYourOffer() {
        let dto = makeBid(
            id: "s1",
            status: "pending",
            createdAt: isoMinutes(ago: 30),
            bidAmount: 50,
            askingPrice: 45,
            category: "cleaning",
            bidder: nil
        )
        let row = OffersViewModel.row(
            dto: dto,
            perspective: .sent,
            now: Self.fixedNow
        ) {}
        XCTAssertTrue(
            row.subtitle?.hasPrefix("Your offer ·") == true,
            "Sent subtitle should start with 'Your offer ·', got \(row.subtitle ?? "nil")"
        )
    }

    func testRowMapping_CounteredRowSurfacesCounterInMetaTail() {
        let dto = makeBid(
            id: "c1",
            status: "pending",
            counterAmount: 185,
            createdAt: isoDays(ago: 2),
            bidAmount: 170,
            askingPrice: 195,
            category: "handyman"
        )
        let receivedRow = OffersViewModel.row(
            dto: dto,
            perspective: .received,
            now: Self.fixedNow
        ) {}
        XCTAssertEqual(receivedRow.metaTail, "you countered $185")
        let sentRow = OffersViewModel.row(
            dto: dto,
            perspective: .sent,
            now: Self.fixedNow
        ) {}
        XCTAssertEqual(sentRow.metaTail, "counter $185")
    }

    // MARK: - Top-bar & tabs

    func testFilterTopBarActionIsAlwaysPresent() {
        let vm = makeVM()
        XCTAssertNotNil(vm.topBarAction)
        XCTAssertEqual(vm.topBarAction?.icon, .filter)
        XCTAssertEqual(vm.topBarAction?.isEnabled, true)
    }

    func testNoFABExposed() {
        let vm = makeVM()
        XCTAssertNil(vm.fab)
    }

    func testTabsExposeReceivedAndSentInThatOrder() {
        let vm = makeVM()
        XCTAssertEqual(vm.tabs.count, 2)
        XCTAssertEqual(vm.tabs[0].id, OffersTab.received)
        XCTAssertEqual(vm.tabs[0].label, "Received")
        XCTAssertEqual(vm.tabs[1].id, OffersTab.sent)
        XCTAssertEqual(vm.tabs[1].label, "Sent")
    }

    // MARK: - Test fixtures

    private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private func isoMinutes(ago minutes: Int) -> String {
        Self.iso8601.string(from: Self.fixedNow.addingTimeInterval(-Double(minutes) * 60))
    }

    private func isoMinutes(ahead minutes: Int) -> String {
        Self.iso8601.string(from: Self.fixedNow.addingTimeInterval(Double(minutes) * 60))
    }

    private func isoDays(ago days: Int) -> String {
        Self.iso8601.string(
            from: Self.fixedNow.addingTimeInterval(-Double(days) * 24 * 3600)
        )
    }

    private func makeBid(
        id: String,
        status: String? = "pending",
        counterAmount: Double? = nil,
        createdAt: String? = nil,
        expiresAt: String? = nil,
        bidAmount: Double? = 100,
        askingPrice: Double? = nil,
        category: String? = "handyman",
        bidder: BidderUserDTO? = nil
    ) -> BidDTO {
        BidDTO(
            id: id,
            gigId: "g_\(id)",
            userId: "u",
            bidAmount: bidAmount,
            message: nil,
            proposedTime: nil,
            status: status,
            createdAt: createdAt,
            updatedAt: nil,
            expiresAt: expiresAt,
            counterAmount: counterAmount,
            counterStatus: nil,
            counteredAt: nil,
            withdrawnAt: nil,
            gig: BidGigDTO(
                id: "g_\(id)",
                title: "Gig title",
                description: nil,
                price: askingPrice,
                category: category,
                status: "open",
                userId: "u_owner"
            ),
            bidder: bidder
        )
    }
}
