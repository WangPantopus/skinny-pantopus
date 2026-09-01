//
//  EarnViewModelTests.swift
//  PantopusTests
//
//  A10.11 — Covers the Earn VM:
//    - initial loading state,
//    - load() selecting populated (active earner) vs. empty (new earner)
//      from the seeded content,
//    - seeded states (loading / error chrome) surviving load(),
//    - the shape of the populated + ways-to-earn fixtures.
//

import XCTest
@testable import Pantopus

@MainActor
final class EarnViewModelTests: XCTestCase {
    // MARK: - State machine

    func testInitialStateIsLoading() {
        let vm = EarnViewModel()
        guard case .loading = vm.state else {
            return XCTFail("Expected loading, got \(vm.state)")
        }
    }

    func testLoadResolvesToPopulated() async {
        let vm = EarnViewModel(content: EarnSampleData.populated)
        await vm.load()
        guard case let .populated(content) = vm.state else {
            return XCTFail("Expected populated, got \(vm.state)")
        }
        XCTAssertEqual(content.available, "312.40")
        XCTAssertEqual(content.thisWeek, "$148.00")
        XCTAssertEqual(content.pending, "$60.00")
        XCTAssertEqual(content.payoutMethod?.last4, "7421")
        XCTAssertEqual(content.autoCashOut?.isOn, true)
    }

    func testLoadResolvesToEmptyForNewEarner() async {
        let vm = EarnViewModel(content: nil)
        await vm.load()
        guard case let .empty(waysToEarn) = vm.state else {
            return XCTFail("Expected empty, got \(vm.state)")
        }
        // The new-earner frame still carries the shared `Ways to earn` rows.
        XCTAssertEqual(waysToEarn.count, 3)
        XCTAssertEqual(waysToEarn.first?.kind, .browse)
    }

    func testSeededStateSurvivesLoad() async {
        let vm = EarnViewModel(state: .error(message: "Boom"))
        await vm.load()
        guard case let .error(message) = vm.state else {
            return XCTFail("Expected seeded error to persist, got \(vm.state)")
        }
        XCTAssertEqual(message, "Boom")
    }

    func testRefreshReloadsSameState() async {
        let vm = EarnViewModel(content: nil)
        await vm.refresh()
        guard case .empty = vm.state else {
            return XCTFail("Expected empty after refresh, got \(vm.state)")
        }
    }

    // MARK: - Sample fixtures

    func testPopulatedFixtureShape() {
        let content = EarnSampleData.populated
        XCTAssertEqual(content.earnings.count, 4)
        XCTAssertEqual(content.weeklyGoal?.ringLabel, "74%")
        XCTAssertEqual(content.weeklyGoal?.headline, "$52 to go")
        XCTAssertEqual(content.taxDocs?.bodyText, "YTD earnings $4,920 · 1099 available mid-Jan")
        XCTAssertEqual(content.autoCashOut?.detail, "Every Friday · cleared balance")
        // First row is "Today"; the pending row is grouped under "Nov 29".
        XCTAssertEqual(content.earnings.first?.day, "Today")
    }

    func testWaysToEarnShape() {
        let ways = EarnSampleData.waysToEarn
        XCTAssertEqual(ways.map(\.kind), [.browse, .refer, .offer])
        // Only the first row is featured (the tinted Browse launcher).
        XCTAssertTrue(ways[0].featured)
        XCTAssertFalse(ways[1].featured)
        XCTAssertFalse(ways[2].featured)
        XCTAssertEqual(ways.map(\.accent), [.primary, .home, .business])
    }

    func testExactlyOnePendingEarning() {
        let pending = EarnSampleData.populated.earnings.filter {
            if case .pending = $0.status { return true }
            return false
        }
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.amount, "60.00")
        if case let .pending(clears) = pending.first?.status {
            XCTAssertEqual(clears, "Dec 3")
        } else {
            XCTFail("Expected the Nov 29 babysitting row to be pending")
        }
    }

    func testEarningCategoriesAreMoneyInSubset() {
        let cats = Set(EarnSampleData.populated.earnings.compactMap(\.category))
        // Earn is money-in only — no bank / fee rows (those are Wallet's).
        XCTAssertEqual(cats, [.cleaning, .petCare, .handyman, .childCare])
    }
}
