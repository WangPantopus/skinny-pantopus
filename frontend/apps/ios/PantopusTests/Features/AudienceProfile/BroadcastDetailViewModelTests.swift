//
//  BroadcastDetailViewModelTests.swift
//  PantopusTests
//
//  P1.3 — Behavioral coverage for the Broadcast detail projection:
//  seed → loaded state with hero / analytics / proportional tier
//  breakdown; missing seed → error; tier breakdown sums to seed read
//  count with no rounding drift; replies start empty (no backend
//  endpoint yet).
//

import XCTest
@testable import Pantopus

@MainActor
final class BroadcastDetailViewModelTests: XCTestCase {
    private func seed(delivered: Int = 1247, read: Int = 892) -> UpdateCardContent {
        UpdateCardContent(
            id: "b_demo",
            body: "Today's loaf has a crumb you could read poetry through.",
            timeAgo: "Today · 9:14am",
            visibility: .publicVisible,
            targetTierRank: nil,
            deliveredCount: delivered,
            readCount: read
        )
    }

    private func tiers() -> [TierBreakdownContent.TierSegment] {
        [
            .init(id: "t1", rank: 1, name: "Followers", count: 374),
            .init(id: "t2", rank: 2, name: "Members", count: 276),
            .init(id: "t3", rank: 3, name: "Insiders", count: 160),
            .init(id: "t4", rank: 4, name: "Direct", count: 82)
        ]
    }

    func testLoadWithSeedTransitionsToLoaded() async {
        let vm = BroadcastDetailViewModel(broadcastId: "b_demo", seed: seed(), tierSegments: tiers())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        XCTAssertEqual(loaded.broadcastId, "b_demo")
        XCTAssertEqual(loaded.hero.body, seed().body)
        XCTAssertEqual(loaded.hero.visibility, .publicVisible)
        XCTAssertEqual(loaded.hero.visibilityLabel, "All beacons")
    }

    func testLoadWithoutSeedTransitionsToError() async {
        let vm = BroadcastDetailViewModel(broadcastId: "b_missing")
        await vm.load()
        guard case .error = vm.state else {
            XCTFail("Expected .error when no seed is supplied, got \(vm.state)")
            return
        }
    }

    func testAnalyticsCellsCoverDeliveredReadReactionsReplies() async {
        let vm = BroadcastDetailViewModel(broadcastId: "b_demo", seed: seed(), tierSegments: tiers())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else { XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(loaded.analyticsCells.count, 4)
        XCTAssertEqual(loaded.analyticsCells[0].id, "delivered")
        XCTAssertEqual(loaded.analyticsCells[1].id, "read")
        XCTAssertEqual(loaded.analyticsCells[2].id, "reactions")
        XCTAssertEqual(loaded.analyticsCells[3].id, "replies")
        XCTAssertEqual(loaded.analyticsCells[1].sub, "72%") // 892 / 1247 ≈ 71.5% → 72
    }

    func testTierBreakdownSegmentsSumToSeedReadCount() async {
        let vm = BroadcastDetailViewModel(broadcastId: "b_demo", seed: seed(), tierSegments: tiers())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else { XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(loaded.tierBreakdown.segments.count, 4)
        XCTAssertEqual(loaded.tierBreakdown.total, seed().readCount)
        XCTAssertEqual(loaded.tierBreakdown.segments.reduce(0) { $0 + $1.count }, seed().readCount)
        // First (largest) segment should be the largest tier (Followers).
        XCTAssertEqual(loaded.tierBreakdown.segments.first?.rank, 1)
        XCTAssertEqual(loaded.tierBreakdown.segments.first?.name, "Followers")
    }

    func testTierBreakdownWithZeroAudienceProducesZeroedSegments() async {
        let zeroedTiers: [TierBreakdownContent.TierSegment] = [
            .init(id: "t1", rank: 1, name: "Followers", count: 0),
            .init(id: "t2", rank: 2, name: "Members", count: 0)
        ]
        let vm = BroadcastDetailViewModel(broadcastId: "b_demo", seed: seed(), tierSegments: zeroedTiers)
        await vm.load()
        guard case let .loaded(loaded) = vm.state else { XCTFail("Expected .loaded")
            return
        }
        XCTAssertEqual(loaded.tierBreakdown.total, 0)
        XCTAssertTrue(loaded.tierBreakdown.segments.allSatisfy { $0.count == loaded.tierBreakdown.total })
    }

    func testRepliesStartEmptyForFreshlyLoadedBroadcast() async {
        let vm = BroadcastDetailViewModel(broadcastId: "b_demo", seed: seed(), tierSegments: tiers())
        await vm.load()
        guard case let .loaded(loaded) = vm.state else { XCTFail("Expected .loaded")
            return
        }
        XCTAssertTrue(loaded.replies.isEmpty)
        XCTAssertEqual(loaded.totalReplies, 0)
    }

    func testTierSegmentPercentRoundsToNearestInteger() {
        let segment = BroadcastTierBreakdown.Segment(id: "t", rank: 1, name: "Followers", count: 33)
        XCTAssertEqual(segment.percent(of: 100), 33)
        XCTAssertEqual(segment.percent(of: 0), 0)
        XCTAssertEqual(segment.percent(of: 3), 1100) // count > total — still computes
    }

    func testVisibilityChipLabelFollowersAndTierOrAbove() {
        let followers = BroadcastDetailHero(
            body: "x",
            visibility: .followers,
            targetTierRank: nil,
            timestamp: "now",
            mediaUrl: nil
        )
        XCTAssertEqual(followers.visibilityLabel, "Followers")

        let tier2 = BroadcastDetailHero(
            body: "x",
            visibility: .tierOrAbove,
            targetTierRank: 2,
            timestamp: "now",
            mediaUrl: nil
        )
        XCTAssertEqual(tier2.visibilityLabel, "Tier 2+")

        let tierUnranked = BroadcastDetailHero(
            body: "x",
            visibility: .tierOrAbove,
            targetTierRank: nil,
            timestamp: "now",
            mediaUrl: nil
        )
        XCTAssertEqual(tierUnranked.visibilityLabel, "Tier")
    }
}
