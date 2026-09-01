//
//  WalletLifetimeTotalsTests.swift
//  PantopusTests
//
//  A10.10 — the lifetime figures `GET /api/wallet` returns beside the balance
//  (`lifetime_received` / `lifetime_withdrawals`) and the Connect capability
//  tiles on the Payout-account card. Both were decoded but never read before
//  the RN-parity pass; these lock the projection.
//

import XCTest
@testable import Pantopus

@MainActor
final class WalletLifetimeTotalsTests: XCTestCase {
    override func setUp() {
        super.setUp()
        SequencedURLProtocol.reset()
    }

    private static let balanceWithLifetimeJSON =
        #"{"wallet":{"id":"w1","balance":84750,"currency":"usd","frozen":false,"#
            + #""lifetime_withdrawals":327250,"lifetime_received":412000}}"#
    private static let balanceWithoutLifetimeJSON =
        #"{"wallet":{"id":"w1","balance":84750,"currency":"usd","frozen":false}}"#
    private static let txJSON = #"{"transactions":[],"total":0}"#
    private static let pendingJSON =
        #"{"in_review_cents":0,"releasing_soon_cents":0,"total_pending_cents":0,"#
            + #""in_review_count":0,"releasing_soon_count":0}"#
    private static let connectEnabledJSON =
        #"{"account":{"stripe_account_id":"acct_1","charges_enabled":true,"#
            + #""payouts_enabled":true,"details_submitted":true,"#
            + #""created_at":"2024-03-12T10:00:00.000Z"}}"#

    private func makeVM() -> WalletViewModel {
        WalletViewModel(
            api: APIClient(
                environment: .current,
                session: SequencedURLProtocol.makeSession(),
                retryPolicy: .none
            ),
            connectPresenter: NoopConnectPresenter()
        )
    }

    /// RN renders `lifetime_received` as "Total Earned" and
    /// `lifetime_withdrawals` as "Withdrawn" (`WalletTab.tsx:150-159`); both
    /// are formatted from the server's cents, never re-derived.
    func testLifetimeTotalsAreProjectedFromTheBalancePayload() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.balanceWithLifetimeJSON),
            .status(200, body: Self.txJSON),
            .status(200, body: Self.pendingJSON),
            .status(404, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated, got \(vm.state)")
        }
        XCTAssertEqual(content.lifetimeEarned, "$4,120.00")
        XCTAssertEqual(content.lifetimeWithdrawn, "$3,272.50")
        XCTAssertTrue(content.hasLifetimeTotals)
    }

    /// A payload without the columns hides the section instead of claiming $0.
    func testMissingLifetimeTotalsHideTheSection() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.balanceWithoutLifetimeJSON),
            .status(200, body: Self.txJSON),
            .status(200, body: Self.pendingJSON),
            .status(404, body: "{}")
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated, got \(vm.state)")
        }
        XCTAssertNil(content.lifetimeEarned)
        XCTAssertNil(content.lifetimeWithdrawn)
        XCTAssertFalse(content.hasLifetimeTotals)
    }

    /// RN's connected frame carries CARD PAYMENTS / PAYOUTS tiles rather than a
    /// single boolean (`PayoutsTab.tsx:177-190`).
    func testConnectedAccountCarriesCapabilityTiles() async {
        SequencedURLProtocol.sequence = [
            .status(200, body: Self.balanceWithLifetimeJSON),
            .status(200, body: Self.txJSON),
            .status(200, body: Self.pendingJSON),
            .status(200, body: Self.connectEnabledJSON)
        ]
        let vm = makeVM()
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected .populated, got \(vm.state)")
        }
        XCTAssertEqual(content.payoutAccount?.capabilities.map(\.key), ["cardPayments", "payouts"])
        XCTAssertEqual(content.payoutAccount?.capabilities.map(\.enabled), [true, true])
    }

    /// A still-verifying account keeps RN's tile-free frame.
    func testVerifyingAccountHasNoCapabilityTiles() {
        let account = ConnectAccountDTO(
            stripeAccountId: "acct_1",
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: true
        )
        let projected = WalletViewModel.payoutAccount(from: account)
        XCTAssertEqual(projected?.actionLabel, "Continue setup")
        XCTAssertEqual(projected?.capabilities.isEmpty, true)
    }
}

/// The read-path tests never open a browser; this satisfies the injected
/// presenter without SafariServices.
@MainActor
private final class NoopConnectPresenter: ConnectWebPresenting {
    func present(url _: URL) async {}
}
