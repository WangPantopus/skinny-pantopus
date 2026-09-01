//
//  EarnOffersViewModelTests.swift
//  PantopusTests
//
//  Earn drawer paid-offer wall. Covers:
//    - the offers + balance projection (cents payout label, expiry copy,
//      engagement derived from the caller's `EarnTransaction`),
//    - a balance failure NOT taking the wall down (RN's `allSettled`),
//    - the empty + error states,
//    - the daily cap: a 429 on `POST /earn/open` lands as the first-class
//      `capNotice`, never as `.error`,
//    - reveal-code and save side actions.
//

import XCTest
@testable import Pantopus

@MainActor
final class EarnOffersViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    override func tearDown() {
        SequencedURLProtocol.reset()
        super.tearDown()
    }

    // MARK: - Paths

    private static let offersPath = "/api/mailbox/v2/earn/offers"
    private static let balancePath = "/api/mailbox/v2/earn/balance"
    private static let openPath = "/api/mailbox/v2/earn/open"
    private static let savePath = "/api/mailbox/v2/earn/save/offer_1"
    private static let revealPath = "/api/mailbox/v2/earn/reveal/offer_1"

    // MARK: - Fixtures

    private static let offersJSON = """
    {"offers":[
      {"id":"offer_1","business_name":"Corner Bakery","business_init":"CB",
       "business_color":"#B45309","offer_title":"Free coffee with any pastry",
       "offer_subtitle":"Weekdays before 11am","payout_amount":0.25,
       "expires_at":"2026-09-04T12:00:00Z","status":"active",
       "opened":false,"transaction":null},
      {"id":"offer_2","business_name":"Ridgeline Hardware","offer_title":"$10 off orders over $50",
       "payout_amount":"1.50","expires_at":null,"status":"active","opened":true,
       "transaction":{"offer_id":"offer_2","status":"verified","dwell_ms":16000,"amount":1.5}}
    ]}
    """

    private static let balanceJSON = #"{"balance":{"total":1.75,"available":0.25,"pending":1.5}}"#

    private func makeAPI(routes: [String: [SequencedURLProtocol.Response]]) -> APIClient {
        APIClient(
            environment: .current,
            session: SequencedURLProtocol.makeSession(routeResponses: routes),
            retryPolicy: .none
        )
    }

    // MARK: - Projection

    func testLoadProjectsOffersAndServerBalance() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)]
            ])
        )

        await vm.load()

        guard case let .loaded(balance, offers) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(balance.total, "1.75")
        XCTAssertEqual(balance.available, "0.25")
        XCTAssertEqual(balance.pending, "1.50")
        XCTAssertTrue(balance.hasPending)

        XCTAssertEqual(offers.count, 2)
        XCTAssertEqual(offers[0].businessName, "Corner Bakery")
        XCTAssertEqual(offers[0].initials, "CB")
        XCTAssertEqual(offers[0].payoutLabel, "25¢")
        XCTAssertEqual(offers[0].engagement, .unopened)
        XCTAssertEqual(offers[0].expiryLabel, "Offer expires Sep 4")

        // Second offer: numeric-as-string payout, no expiry, verified txn.
        XCTAssertEqual(offers[1].initials, "RH")
        XCTAssertEqual(offers[1].payoutLabel, "$1.50")
        XCTAssertEqual(offers[1].expiryLabel, "Limited time")
        XCTAssertEqual(offers[1].engagement, .earned)
    }

    func testBalanceFailureStillRendersTheWall() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [.status(500, body: #"{"error":"Server error"}"#)]
            ])
        )

        await vm.load()

        guard case let .loaded(balance, offers) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(offers.count, 2)
        XCTAssertEqual(balance, .zero)
    }

    func testEmptyOffersKeepsTheBalanceHero() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: #"{"offers":[]}"#)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)]
            ])
        )

        await vm.load()

        guard case let .empty(balance) = vm.state else {
            return XCTFail("Expected empty, got \(vm.state)")
        }
        XCTAssertEqual(balance.total, "1.75")
    }

    func testOffersFailureSurfacesError() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(500, body: #"{"error":"Server error"}"#)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)]
            ])
        )

        await vm.load()

        guard case .error = vm.state else {
            return XCTFail("Expected error, got \(vm.state)")
        }
    }

    // MARK: - Daily cap

    func testDailyCapLandsAsCapNoticeNotAnError() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)],
                Self.openPath: [
                    .status(429, body: #"{"error":"Daily offer cap reached (10/day)","capped":true}"#)
                ]
            ])
        )
        await vm.load()

        await vm.open("offer_1")

        XCTAssertEqual(vm.capNotice?.headline, "Daily cap reached")
        XCTAssertEqual(vm.capNotice?.body, "You can open up to 10 offers per day.")
        XCTAssertNil(vm.toast)
        guard case let .loaded(_, offers) = vm.state else {
            return XCTFail("Cap must not tear down the wall, got \(vm.state)")
        }
        // The envelope stays sealed — nothing was banked.
        XCTAssertEqual(offers[0].engagement, .unopened)

        vm.dismissCapNotice()
        XCTAssertNil(vm.capNotice)
    }

    // MARK: - Open → dwell

    func testOpenStartsTheDwellWindowAndReflectsTheServerBalance() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [
                    .status(200, body: Self.balanceJSON),
                    // Post-open re-read — the server, not the client, moves
                    // the number.
                    .status(200, body: #"{"balance":{"total":2.00,"available":0.25,"pending":1.75}}"#)
                ],
                Self.openPath: [
                    .status(200, body: #"{"message":"Offer opened","amount":0.25,"status":"pending"}"#)
                ]
            ])
        )
        await vm.load()

        await vm.open("offer_1")

        guard case let .loaded(balance, offers) = vm.state else {
            return XCTFail("Expected loaded, got \(vm.state)")
        }
        XCTAssertEqual(
            offers[0].engagement,
            .dwelling(secondsRemaining: EarnOfferDwell.seconds)
        )
        // Not `0.25 + 1.75` computed locally — the server's total.
        XCTAssertEqual(balance.total, "2.00")
        XCTAssertEqual(balance.pending, "1.75")

        vm.cancelDwellTimers()
    }

    // MARK: - Save / reveal

    func testSaveConfirmsWithAToast() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)],
                Self.savePath: [.status(200, body: #"{"message":"Offer saved"}"#)]
            ])
        )
        await vm.load()

        await vm.save("offer_1")

        XCTAssertEqual(vm.toast?.text, "Offer saved")
    }

    func testRevealSurfacesTheCode() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)],
                Self.revealPath: [.status(200, body: #"{"code":"BREW25"}"#)]
            ])
        )
        await vm.load()

        await vm.reveal("offer_1")

        XCTAssertEqual(vm.revealedCode?.code, "BREW25")
        XCTAssertEqual(vm.revealedCode?.businessName, "Corner Bakery")

        vm.dismissRevealedCode()
        XCTAssertNil(vm.revealedCode)
    }

    func testRevealWithNoCodeCarriesNil() async {
        let vm = EarnOffersViewModel(
            client: makeAPI(routes: [
                Self.offersPath: [.status(200, body: Self.offersJSON)],
                Self.balancePath: [.status(200, body: Self.balanceJSON)],
                Self.revealPath: [.status(200, body: #"{"code":null}"#)]
            ])
        )
        await vm.load()

        await vm.reveal("offer_1")

        XCTAssertNotNil(vm.revealedCode)
        XCTAssertNil(vm.revealedCode?.code)
    }
}
