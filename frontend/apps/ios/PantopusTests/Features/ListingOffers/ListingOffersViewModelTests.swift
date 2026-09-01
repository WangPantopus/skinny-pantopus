//
//  ListingOffersViewModelTests.swift
//  PantopusTests
//
//  T5.3.4 — Listing offers. Covers:
//    - load → loaded / empty / error transitions (listing + offers
//      fetched in parallel, error if either cold-fetch fails)
//    - row mapping: avatar leading, priceStack trailing, status chip,
//      counter pill on `countered`, leading highlight on the highest
//      pending offer, "N days old · X of Y offers" meta tail
//    - footer mapping: respondPending / undoCounter / viewTransaction /
//      none per status
//    - optimistic mutations: accept / decline / counter all flip the
//      row locally and roll back on failure
//    - listing-context header rendering against the loaded listing
//
//  Sort-menu and no-tabs/no-FAB coverage lives in
//  `ListingOffersViewModelSortTests.swift`. Shared fixtures live in
//  `ListingOffersViewModelTestCase.swift`.
//

import XCTest
@testable import Pantopus

// swiftlint:disable type_body_length

@MainActor
final class ListingOffersViewModelTests: ListingOffersViewModelTestCase {
    // MARK: - Lifecycle

    func testLoadPopulatedTransitionsToLoaded() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(sections.first?.rows.count, 3)
        // Highest offer (default): $240, $225, $175
        XCTAssertEqual(sections.first?.rows[0].id, "o-anika")
        XCTAssertEqual(sections.first?.rows[1].id, "o-marcus")
        XCTAssertEqual(sections.first?.rows[2].id, "o-daniel")
    }

    func testLoadEmptyTransitionsToEmptyWithShareCTA() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.emptyOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .empty(content) = vm.state else {
            XCTFail("Expected .empty, got \(vm.state)")
            return
        }
        XCTAssertEqual(content.headline, "No offers on this listing yet")
        XCTAssertEqual(content.ctaTitle, "Share listing")
    }

    func testListingFetchFailureCausesError() async {
        SequencedURLProtocol.sequence = [
            .status(500, body: "{}"),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error when listing fetch fails cold, got \(vm.state)")
            return
        }
    }

    func testOffersFetchFailureCausesError() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error when offers fetch fails cold, got \(vm.state)")
            return
        }
    }

    // MARK: - Listing-context header

    func testListingContextHeaderRendersListingTitleAskAndStatus() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        let context = vm.listingContext
        XCTAssertEqual(context?.title, "Mid-century walnut credenza")
        XCTAssertEqual(context?.askPrice, "$250")
        XCTAssertEqual(context?.statusChip.label, "Active")
        XCTAssertEqual(context?.offerCount, 3)
        XCTAssertEqual(context?.sortLabel, "Highest offer")
    }

    func testListingContextHeaderShowsLoadingHintBeforeFetch() {
        let vm = makeVM()
        XCTAssertEqual(vm.listingContext?.title, "Mid-century walnut credenza")
        XCTAssertEqual(vm.listingContext?.askPrice, "")
        XCTAssertEqual(vm.listingContext?.statusChip.label, "Loading…")
    }

    // MARK: - Row mapping

    func testFirstPendingRowGetsLeadingHighlight() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let leading = sections.first?.rows.first
        XCTAssertEqual(leading?.id, "o-anika")
        XCTAssertEqual(leading?.highlight, .leading)
        XCTAssertEqual(sections.first?.rows[1].highlight, nil)
    }

    func testRowMapping_PendingHasRespondFooter() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let pending = sections.first?.rows.first { $0.id == "o-anika" }
        XCTAssertEqual(pending?.footer?.actions.count, 2)
        XCTAssertEqual(pending?.footer?.actions.first?.title, "Counter")
        XCTAssertEqual(pending?.footer?.actions.first?.variant, .ghost)
        XCTAssertEqual(pending?.footer?.actions.last?.title, "Accept")
        XCTAssertEqual(pending?.footer?.actions.last?.variant, .primary)
    }

    func testRowMapping_CounteredHasUndoCounterFooterAndCounterChip() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let countered = sections.first?.rows.first { $0.id == "o-marcus" }
        XCTAssertEqual(countered?.footer?.actions.count, 2)
        XCTAssertEqual(countered?.footer?.actions.first?.title, "Withdraw counter")
        XCTAssertEqual(countered?.footer?.actions.first?.variant, .destructive)
        XCTAssertEqual(countered?.footer?.actions.last?.title, "Send counter")
        XCTAssertEqual(countered?.footer?.actions.last?.variant, .primary)
        // Counter pill chip is present alongside the status chip.
        XCTAssertEqual(countered?.chips?.count, 2)
        XCTAssertEqual(countered?.chips?.first?.text, "Countered")
        XCTAssertEqual(countered?.chips?.last?.text, "Your counter $235")
    }

    func testRowMapping_DeclinedHasNoFooter() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let declined = sections.first?.rows.first { $0.id == "o-daniel" }
        XCTAssertNil(declined?.footer)
        XCTAssertEqual(declined?.chips?.first?.text, "Declined")
    }

    func testRowMapping_AcceptedHasViewTransactionFooter() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.oneAcceptedJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let accepted = sections.first?.rows.first
        XCTAssertEqual(accepted?.footer?.actions.count, 1)
        XCTAssertEqual(accepted?.footer?.actions.first?.title, "View transaction")
    }

    func testRowMapping_CompletedHasReviewFooter() async {
        let completedJSON = """
        {"offers":[
          {"id":"o-done","listing_id":"listing-1","buyer_id":"u_anika",
           "seller_id":"u_me","amount":240,"status":"completed",
           "created_at":"2026-05-15T11:48:00Z",
           "buyer":{"id":"u_anika","first_name":"Anika","last_name":"Reyes"},
           "seller":{"id":"u_me"}}
        ]}
        """
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: completedJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = sections.first?.rows.first
        XCTAssertEqual(row?.footer?.actions.count, 2)
        XCTAssertEqual(row?.footer?.actions.first?.title, "View transaction")
        XCTAssertEqual(row?.footer?.actions.last?.title, "Leave a review")
    }

    func testRowMapping_PriceStackAndAvatar() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = sections.first?.rows.first
        XCTAssertEqual(row?.title, "Anika Reyes")
        guard case let .priceStack(amount, sublabel) = row?.trailing else {
            XCTFail("Expected priceStack trailing")
            return
        }
        XCTAssertEqual(amount, "$240")
        XCTAssertEqual(sublabel, "asking $250")
        guard case let .avatarWithBadge(name, _, _, size, _) = row?.leading else {
            XCTFail("Expected avatarWithBadge leading")
            return
        }
        XCTAssertEqual(name, "Anika Reyes")
        XCTAssertEqual(size, .large)
    }

    func testRowMapping_NoteRendersWhenMessagePresent() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let row = sections.first?.rows.first { $0.id == "o-anika" }
        XCTAssertEqual(row?.note, "Love the dovetail joinery.")
        let counteredRow = sections.first?.rows.first { $0.id == "o-marcus" }
        XCTAssertNil(counteredRow?.note)
    }

    func testRowMapping_MetaTailIncludesAgeAndIndex() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        // Marcus's $225 offer is 2 days old, position 2 of 3.
        let row = sections.first?.rows.first { $0.id == "o-marcus" }
        XCTAssertEqual(row?.metaTail, "2 days old · 2 of 3 offers")
    }

    // MARK: - Status derivation

    func testStatusFromRaw_AllVariants() {
        XCTAssertEqual(ListingOfferStatus.fromRaw("pending"), .pending)
        XCTAssertEqual(ListingOfferStatus.fromRaw("countered"), .countered)
        XCTAssertEqual(ListingOfferStatus.fromRaw("accepted"), .accepted)
        XCTAssertEqual(ListingOfferStatus.fromRaw("declined"), .declined)
        XCTAssertEqual(ListingOfferStatus.fromRaw("rejected"), .declined)
        XCTAssertEqual(ListingOfferStatus.fromRaw("expired"), .expired)
        XCTAssertEqual(ListingOfferStatus.fromRaw("withdrawn"), .withdrawn)
        XCTAssertEqual(ListingOfferStatus.fromRaw("completed"), .completed)
        XCTAssertEqual(ListingOfferStatus.fromRaw("unknown"), .pending)
    }

    // MARK: - Optimistic mutations

    func testAccept_OptimisticThenRolledBackOnFailure() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON),
            .status(500, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded")
            return
        }
        let dto = ListingOfferDTO(id: "o-anika", status: "pending")
        await vm.acceptOffer(dto)
        // Verify the chip rolled back to pending after the 500.
        guard case let .loaded(after, _) = vm.state else {
            XCTFail("Expected .loaded after rollback")
            return
        }
        XCTAssertEqual(after.first?.rows.first?.chips?.first?.text, "Pending")
        XCTAssertEqual(sections.first?.rows.first?.chips?.first?.text, "Pending")
    }

    func testAccept_OptimisticThenConfirmedOn200() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON),
            .status(200, body: "{\"offer\":{\"id\":\"o-anika\",\"status\":\"accepted\"}}")
        ]
        let vm = makeVM()
        await vm.load()
        let dto = ListingOfferDTO(id: "o-anika", status: "pending")
        await vm.acceptOffer(dto)
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after accept")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.chips?.first?.text, "Accepted")
        // Accepted footer = single "View transaction" button.
        XCTAssertEqual(sections.first?.rows.first?.footer?.actions.count, 1)
        XCTAssertEqual(sections.first?.rows.first?.footer?.actions.first?.title, "View transaction")
    }

    func testAccept_ByBuyerOfCounteredOfferPresentsCheckout() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON),
            .status(200, body: "{\"offer\":{\"id\":\"o-marcus\",\"status\":\"accepted\"}}"),
            .status(201, body: Self.intentJSON),
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.oneAcceptedJSON)
        ]
        let presenter = ListingOfferCheckoutPresenter()
        let vm = makeVM(
            api: makeAPI(),
            checkout: CheckoutCoordinator(api: makeAPI(), presenter: presenter)
        ) { "u_marcus" }
        await vm.load()
        let dto = ListingOfferDTO(
            id: "o-marcus",
            listingId: "listing-1",
            buyerId: "u_marcus",
            status: "countered"
        )

        await vm.acceptOffer(dto)

        XCTAssertEqual(presenter.presentPaymentCallCount, 1)
        XCTAssertEqual(presenter.lastClientSecret, "pi_secret_1")
        XCTAssertEqual(presenter.lastPublishableKey, "pk_test")
    }

    func testDecline_OptimisticThenConfirmedOn200() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON),
            .status(200, body: "{\"offer\":{\"id\":\"o-anika\",\"status\":\"declined\"}}")
        ]
        let vm = makeVM()
        await vm.load()
        let dto = ListingOfferDTO(id: "o-anika", status: "pending")
        await vm.declineOffer(dto)
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after decline")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.chips?.first?.text, "Declined")
        XCTAssertNil(sections.first?.rows.first?.footer)
    }

    func testCounter_OptimisticThenConfirmedOn200() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.listingJSON),
            .status(200, body: Self.threeOffersJSON),
            .status(200, body: """
            {"offer":{"id":"o-anika","status":"countered","counter_amount":230}}
            """)
        ]
        let vm = makeVM()
        await vm.load()
        let dto = ListingOfferDTO(id: "o-anika", status: "pending")
        vm.requestCounter(dto)
        XCTAssertNotNil(vm.counterTarget)
        await vm.confirmCounter(amount: 230)
        guard case let .loaded(sections, _) = vm.state else {
            XCTFail("Expected .loaded after counter")
            return
        }
        XCTAssertEqual(sections.first?.rows.first?.chips?.first?.text, "Countered")
        XCTAssertEqual(sections.first?.rows.first?.chips?.last?.text, "Your counter $230")
    }
}

@MainActor
private final class ListingOfferCheckoutPresenter: PaymentSheetPresenting {
    private(set) var presentPaymentCallCount = 0
    private(set) var lastClientSecret: String?
    private(set) var lastPublishableKey: String?

    func presentAddCard(
        setupIntentClientSecret _: String,
        customer _: String,
        ephemeralKey _: String,
        publishableKey _: String?
    ) async -> PaymentSheetOutcome {
        .completed
    }

    func presentPayment(
        clientSecret: String,
        customer _: String,
        ephemeralKey _: String,
        isSetupIntent _: Bool,
        publishableKey: String?
    ) async -> PaymentSheetOutcome {
        presentPaymentCallCount += 1
        lastClientSecret = clientSecret
        lastPublishableKey = publishableKey
        return .completed
    }
}
