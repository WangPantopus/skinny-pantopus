//
//  StampsSnapshotTests.swift
//  PantopusTests
//
//  A17.11 — build-validity snapshots for the Stamps screen in both
//  designed states (populated wallet + empty "No stamps yet"), the
//  loading shimmer, and the feature-local primitives (book hero, sheet,
//  wallet rail, usage history). Mirrors the host-and-lay-out shape every
//  other feature snapshot test in the repo uses.
//

import SwiftUI
import UIKit
import XCTest
@testable import Pantopus

@MainActor
final class StampsSnapshotTests: XCTestCase {
    private func assertRenders(
        _ view: some View,
        size: CGSize = CGSize(width: 390, height: 1400),
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let host = UIHostingController(rootView: view.frame(width: size.width, height: size.height))
        host.overrideUserInterfaceStyle = .light
        host.view.frame = CGRect(origin: .zero, size: size)
        host.loadViewIfNeeded()
        host.view.layoutIfNeeded()
        XCTAssertGreaterThan(host.view.frame.size.width, 0, file: file, line: line)
        XCTAssertGreaterThan(host.view.frame.size.height, 0, file: file, line: line)
    }

    // MARK: - Full screen states

    func test_stamps_populatedFrame_renders() {
        assertRenders(StampsPopulatedFrame(content: StampsSampleData.populated))
    }

    func test_stamps_emptyFrame_renders() {
        assertRenders(StampsEmptyFrame(content: StampsSampleData.empty))
    }

    func test_stamps_loadingState_renders() {
        // Before load() the screen sits in the shimmer skeleton state.
        assertRenders(StampsView(viewModel: StampsViewModel(seed: .populated)))
    }

    // MARK: - Primitives

    func test_bookHero_renders() {
        assertRenders(
            StampBookHero(book: StampsSampleData.populated.book),
            size: CGSize(width: 390, height: 220)
        )
    }

    func test_sheet_renders() {
        assertRenders(
            StampSheet(book: StampsSampleData.populated.book),
            size: CGSize(width: 390, height: 320)
        )
    }

    func test_walletRail_renders() {
        assertRenders(
            WalletRail(
                stamps: StampsSampleData.populated.wallet,
                summary: StampsSampleData.populated.walletSummary
            ),
            size: CGSize(width: 390, height: 220)
        )
    }

    func test_usageHistory_renders() {
        assertRenders(
            UsageHistoryCard(
                usage: StampsSampleData.populated.usage,
                window: StampsSampleData.populated.usageWindow
            ),
            size: CGSize(width: 390, height: 400)
        )
    }
}
