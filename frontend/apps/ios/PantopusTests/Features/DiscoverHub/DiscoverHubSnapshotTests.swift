//
//  DiscoverHubSnapshotTests.swift
//  PantopusTests
//
//  A11.3 Discover magazine snapshot gate. Covers the two design frames:
//  populated compact map plus three rails, and empty anchor-only map plus
//  empty hero and skeleton rail stand-ins.
//

import SwiftUI
import XCTest
@testable import Pantopus

@MainActor
final class DiscoverHubSnapshotTests: XCTestCase {
    func test_discover_hub_populated_frame_snapshots() {
        assertSnapshot(
            state: .populated(DiscoverHubSampleData.populated),
            selectedFilter: nil
        )
    }

    func test_discover_hub_empty_frame_snapshots() {
        assertSnapshot(
            state: .empty,
            selectedFilter: nil
        )
    }

    private func assertSnapshot(
        state: DiscoverHubMagazineState,
        selectedFilter: DiscoverHubMapKind?,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let renderer = ImageRenderer(
            content: DiscoverHubMagazineContentView(
                state: state,
                selectedFilter: selectedFilter,
                onBack: {},
                onOpenMap: {},
                onSelectFilter: { _ in },
                onSelectTask: { _ in },
                onSelectMarketplace: { _ in },
                onSelectPost: { _ in },
                onSeeAllTasks: {},
                onSeeAllMarketplace: {},
                onSeeAllPosts: {},
                onRetry: {},
                onNotify: {}
            )
            .frame(width: 390, height: 844)
        )
        renderer.scale = 2
        let pngData = renderer.uiImage?.pngData()
        XCTAssertNotNil(pngData, file: file, line: line)
        XCTAssertGreaterThan(pngData?.count ?? 0, 8 * 1024, file: file, line: line)
    }
}
