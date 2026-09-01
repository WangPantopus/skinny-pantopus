//
//  BroadcastDetailViewModel.swift
//  Pantopus
//
//  P1.3 — Backs the broadcast detail full-screen takeover. The screen
//  is pushed from the Audience Profile update-card tap; the caller
//  hands the VM both the broadcast id (the canonical route payload)
//  and a `seed` snapshot of the tapped card so the hero + delivered/
//  read counters can render immediately without a second fetch. The
//  per-broadcast endpoint that returns reactions / replies / per-tier
//  read split hasn't shipped yet; until then the seed projection
//  drives the hero + analytics, the tier breakdown is derived from
//  the persona's tier table by proportionally splitting the seed's
//  read count, and replies start empty.
//

import Foundation
import Observation

@Observable
@MainActor
public final class BroadcastDetailViewModel {
    public private(set) var state: BroadcastDetailState = .loading

    private let broadcastId: String
    private let seed: UpdateCardContent?
    private let tierSegments: [TierBreakdownContent.TierSegment]

    /// `seed` carries the tapped row's snapshot (visibility, body,
    /// counts, timestamp). `tierSegments` is the parent persona's tier
    /// ladder + member counts (used to split the broadcast's read
    /// count proportionally until the per-broadcast endpoint lands).
    public init(
        broadcastId: String,
        seed: UpdateCardContent? = nil,
        tierSegments: [TierBreakdownContent.TierSegment] = []
    ) {
        self.broadcastId = broadcastId
        self.seed = seed
        self.tierSegments = tierSegments
    }

    public func load() async {
        state = .loading
        guard let seed else {
            state = .error(message: "Couldn't load this broadcast.")
            return
        }
        state = .loaded(Self.project(broadcastId: broadcastId, seed: seed, tiers: tierSegments))
    }

    // MARK: - Projection

    static func project(
        broadcastId: String,
        seed: UpdateCardContent,
        tiers: [TierBreakdownContent.TierSegment]
    ) -> BroadcastDetailLoaded {
        let hero = BroadcastDetailHero(
            body: seed.body,
            visibility: seed.visibility,
            targetTierRank: seed.targetTierRank,
            timestamp: seed.timeAgo,
            mediaUrl: nil
        )
        let cells = analyticsCells(seed: seed)
        let breakdown = tierBreakdown(seed: seed, tiers: tiers)
        return BroadcastDetailLoaded(
            broadcastId: broadcastId,
            hero: hero,
            analyticsCells: cells,
            tierBreakdown: breakdown,
            replies: [],
            totalReplies: 0
        )
    }

    private static func analyticsCells(seed: UpdateCardContent) -> [BroadcastAnalyticsCell] {
        let readRate: String? = {
            guard seed.deliveredCount > 0 else { return nil }
            let pct = Int((Double(seed.readCount) / Double(seed.deliveredCount) * 100.0).rounded())
            return "\(pct)%"
        }()
        return [
            BroadcastAnalyticsCell(
                id: "delivered",
                label: "Delivered",
                value: shortCount(seed.deliveredCount)
            ),
            BroadcastAnalyticsCell(
                id: "read",
                label: "Read",
                value: shortCount(seed.readCount),
                sub: readRate
            ),
            BroadcastAnalyticsCell(
                id: "reactions",
                label: "Reactions",
                value: "0"
            ),
            BroadcastAnalyticsCell(
                id: "replies",
                label: "Replies",
                value: "0"
            )
        ]
    }

    /// Split the broadcast's read count across the persona's tier
    /// ladder using the parent's per-tier audience proportions. The
    /// segments are stable across reloads (tier id, rank, name) so the
    /// horizontal bar widths animate smoothly when the totals change.
    private static func tierBreakdown(
        seed: UpdateCardContent,
        tiers: [TierBreakdownContent.TierSegment]
    ) -> BroadcastTierBreakdown {
        guard !tiers.isEmpty else {
            return BroadcastTierBreakdown(total: 0, segments: [])
        }
        let audienceTotal = tiers.reduce(0) { $0 + $1.count }
        guard audienceTotal > 0 else {
            let zeroed = tiers.map { tier in
                BroadcastTierBreakdown.Segment(id: tier.id, rank: tier.rank, name: tier.name, count: 0)
            }
            return BroadcastTierBreakdown(total: 0, segments: zeroed)
        }
        // Largest-remainder allocation so the segments sum back to
        // `seed.readCount` exactly (no half-integer drift in the bar).
        let read = max(seed.readCount, 0)
        let exacts = tiers.map { tier in
            Double(tier.count) / Double(audienceTotal) * Double(read)
        }
        let floors = exacts.map { Int($0.rounded(.down)) }
        var counts = floors
        var remaining = read - floors.reduce(0, +)
        if remaining > 0 {
            let sortedByRemainder = exacts.enumerated()
                .map { (offset: $0.offset, frac: $0.element - floor($0.element)) }
                .sorted { $0.frac > $1.frac }
            for slot in sortedByRemainder {
                guard remaining > 0 else { break }
                counts[slot.offset] += 1
                remaining -= 1
            }
        }
        let segments = tiers.enumerated().map { offset, tier in
            BroadcastTierBreakdown.Segment(
                id: tier.id,
                rank: tier.rank,
                name: tier.name,
                count: counts[offset]
            )
        }
        let total = segments.reduce(0) { $0 + $1.count }
        return BroadcastTierBreakdown(total: total, segments: segments)
    }

    /// "1,247" style compact count for the 4-cell analytics grid. The
    /// design uses the unabbreviated form for sub-1000 counts and the
    /// `1.2K` style above.
    private static func shortCount(_ count: Int) -> String {
        if count < 1000 { return "\(count)" }
        let thousands = Double(count) / 1000.0
        if count < 10000 {
            return String(format: "%.1fK", thousands)
        }
        return "\(Int(thousands.rounded()))K"
    }
}
