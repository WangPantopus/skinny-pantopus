//
//  PaymentsPayoutsProjectionTests.swift
//  PantopusTests
//
//  A14.6 — the Payouts card used to be a hard-coded "not connected" scaffold.
//  It now projects the live `GET /api/payments/connect/account` status into
//  RN `PayoutsTab`'s three frames: connected / verifying / never connected.
//

import XCTest
@testable import Pantopus

@MainActor
final class PaymentsPayoutsProjectionTests: XCTestCase {
    /// No account at all keeps the honest onboarding scaffold.
    func testNoConnectAccountKeepsTheNotConnectedScaffold() {
        let payouts = PaymentsViewModel.payouts(from: nil)
        guard case let .ctaChip(label, tone) = payouts.stripe.trailing else {
            return XCTFail("Expected the Connect CTA chip, got \(payouts.stripe.trailing)")
        }
        XCTAssertEqual(label, "Connect")
        XCTAssertEqual(tone, .primary)
        XCTAssertEqual(payouts.payoutMethod.trailing, .gatedDash)
        XCTAssertEqual(payouts.taxInfo.trailing, .gatedDash)
    }

    /// An account that exists but isn't onboarded surfaces "Continue setup"
    /// and keeps the downstream rows gated.
    func testVerifyingAccountSurfacesContinueSetup() {
        let payouts = PaymentsViewModel.payouts(
            from: ConnectAccountDTO(
                stripeAccountId: "acct_1",
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: true
            )
        )
        guard case let .ctaChip(label, _) = payouts.stripe.trailing else {
            return XCTFail("Expected the Continue-setup chip, got \(payouts.stripe.trailing)")
        }
        XCTAssertEqual(label, "Continue setup")
        XCTAssertEqual(payouts.stripe.subtext, "Account verification in progress")
        XCTAssertEqual(payouts.payoutMethod.trailing, .gatedDash)
    }

    /// An onboarded account swaps to the green Connected chip, dates the row
    /// from `StripeAccount.created_at`, and un-gates the payout rows.
    func testConnectedAccountRendersConnectedChipAndDate() {
        let payouts = PaymentsViewModel.payouts(
            from: ConnectAccountDTO(
                stripeAccountId: "acct_1",
                chargesEnabled: true,
                payoutsEnabled: true,
                detailsSubmitted: true,
                createdAt: "2024-03-12T10:00:00.000Z"
            )
        )
        guard case let .chipChevron(label, tone) = payouts.stripe.trailing else {
            return XCTFail("Expected the Connected chip, got \(payouts.stripe.trailing)")
        }
        XCTAssertEqual(label, "Connected")
        XCTAssertEqual(tone, .success)
        XCTAssertEqual(payouts.stripe.subtext, "Connected Mar 12, 2024")
        XCTAssertEqual(payouts.payoutMethod.trailing, .chevron)
        XCTAssertEqual(payouts.taxInfo.trailing, .chevron)
    }

    /// Without `created_at` the row states the capability instead of inventing
    /// a connection date.
    func testConnectedAccountWithoutDateFallsBackToCapabilityCopy() {
        let payouts = PaymentsViewModel.payouts(
            from: ConnectAccountDTO(
                stripeAccountId: "acct_1",
                chargesEnabled: true,
                payoutsEnabled: true,
                detailsSubmitted: true
            )
        )
        XCTAssertEqual(payouts.stripe.subtext, "Card payments and payouts enabled")
    }
}
