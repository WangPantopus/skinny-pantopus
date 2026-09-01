//
//  WalletViewModelTests.swift
//  PantopusTests
//
//  A10.10 — Covers the Wallet VM:
//    - initial loading state,
//    - load() selecting populated vs. hold from the content,
//    - seeded states (loading / error chrome) surviving load(),
//    - the shape of the populated + hold sample fixtures.
//

import XCTest
@testable import Pantopus

@MainActor
final class WalletViewModelTests: XCTestCase {
    // MARK: - State machine

    func testInitialStateIsLoading() {
        let vm = WalletViewModel()
        guard case .loading = vm.state else {
            return XCTFail("Expected loading, got \(vm.state)")
        }
    }

    func testLoadResolvesToPopulated() async {
        let vm = WalletViewModel(content: WalletSampleData.populated)
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected populated, got \(vm.state)")
        }
        XCTAssertEqual(content.available, "847.50")
        XCTAssertFalse(content.isOnHold)
        XCTAssertEqual(content.payoutMethod?.warn, false)
        XCTAssertEqual(content.taxDocs?.ready, false)
    }

    func testLoadResolvesToHoldWhenStatePresent() async {
        let vm = WalletViewModel(content: WalletSampleData.onHold)
        await vm.load()
        guard case let .hold(content) = vm.state else {
            return XCTFail("Expected hold, got \(vm.state)")
        }
        XCTAssertNotNil(content.holdState)
        XCTAssertEqual(content.payoutMethod?.warn, true)
        XCTAssertEqual(content.taxDocs?.ready, true)
        XCTAssertEqual(content.holdState?.bannerHeadline, "Bank verification expired")
    }

    func testSeededStateSurvivesLoad() async {
        let vm = WalletViewModel(state: .error(message: "Boom"))
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected seeded error to persist, got \(vm.state)")
        }
        XCTAssertEqual(message, "Boom")
    }

    func testRefreshReloadsSameState() async {
        let vm = WalletViewModel(content: WalletSampleData.onHold)
        await vm.refresh()
        guard case .hold = vm.state else {
            return XCTFail("Expected hold after refresh, got \(vm.state)")
        }
    }

    // MARK: - Sample fixtures

    func testPopulatedFixtureShape() {
        let content = WalletSampleData.populated
        XCTAssertEqual(content.activity.count, 7)
        XCTAssertEqual(content.payoutMethod?.last4, "7421")
        XCTAssertEqual(content.payoutMethod?.bodyText, "Instant payout · 1–3 minutes")
        XCTAssertEqual(content.monthValue, "$1,284.50")
        XCTAssertTrue(content.monthMeta.contains("22%"))
        // First two rows fall on "Today" — same-day grouping renders one header.
        XCTAssertEqual(content.activity[0].day, "Today")
        XCTAssertEqual(content.activity[1].day, "Today")
        XCTAssertEqual(content.activity[2].day, "Yesterday")
    }

    func testHoldFixtureShape() {
        let content = WalletSampleData.onHold
        XCTAssertNotNil(content.holdState)
        XCTAssertEqual(content.activity.count, 4)
        XCTAssertEqual(content.payoutMethod?.bodyText, "Verification expired Nov 30")
        XCTAssertEqual(content.taxDocs?.bodyText.contains("1099-NEC"), true)
        XCTAssertEqual(
            content.holdState?.withdrawFootnote,
            "Re-verify your bank above to unlock payouts."
        )
    }

    func testActivityCategoriesCoverAuditPalette() {
        let cats = Set(WalletSampleData.populated.activity.map(\.category))
        // Audit calls out every category present in the populated frame:
        // cleaning · child-care · handyman · pet-care · bank · fee.
        XCTAssertEqual(cats, [.cleaning, .childCare, .handyman, .petCare, .bank, .fee])
    }

    func testFeeRowFlaggedAndOutbound() {
        let fee = WalletSampleData.populated.activity.first { $0.isFee }
        XCTAssertNotNil(fee)
        XCTAssertEqual(fee?.direction, .out)
        XCTAssertEqual(fee?.category, .fee)
    }

    func testBankRowIsOutboundPayout() {
        let bankRow = WalletSampleData.populated.activity.first { $0.category == .bank }
        XCTAssertNotNil(bankRow)
        XCTAssertEqual(bankRow?.direction, .out)
        XCTAssertEqual(bankRow?.description, "Withdrawal")
        XCTAssertTrue(bankRow?.counterparty.contains("7421") ?? false)
    }
}
