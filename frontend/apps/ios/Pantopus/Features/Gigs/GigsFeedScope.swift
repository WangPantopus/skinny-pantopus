//
//  GigsFeedScope.swift
//  Pantopus
//
//  Tasks-tab feed-scope segmentation. RN's Tasks tab puts three chips
//  above the category row — All / Tasks / Support Trains — and in the
//  All scope interleaves nearby Support Trains
//  (`GET /api/activities/support-trains/nearby`) into the gig feed,
//  newest first. Mirrors `apps/mobile/src/app/(tabs)/gigs.tsx:104,342-362`.
//

import Foundation

/// Which kinds of rows the Tasks feed shows.
public enum GigsFeedScope: String, CaseIterable, Sendable, Hashable, Identifiable {
    /// Tasks **and** nearby Support Trains, interleaved by recency.
    case all
    /// Tasks only — the sectioned browse surface stays available here.
    case tasks
    /// Nearby Support Trains only.
    case supportTrains = "support_trains"

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .all: "All"
        case .tasks: "Tasks"
        case .supportTrains: "Support Trains"
        }
    }

    /// Gigs are fetched in every scope except the Support-Trains-only one.
    public var includesGigs: Bool {
        self != .supportTrains
    }

    /// Support Trains are fetched in every scope except the Tasks-only one.
    public var includesSupportTrains: Bool {
        self != .tasks
    }

    /// Empty-state headline, scope-aware (RN `GigsEmptyState(feedTab)`).
    public var emptyHeadline: String {
        switch self {
        case .all: "Nothing nearby yet"
        case .tasks: "No gigs nearby"
        case .supportTrains: "No Support Trains nearby"
        }
    }

    /// Empty-state body, scope-aware.
    public var emptyBody: String {
        switch self {
        case .all: "Be the first to post a task for your neighbors."
        case .tasks: "Be the first to post one."
        case .supportTrains: "Support Trains published near you will show up here."
        }
    }
}

/// One nearby Support Train row rendered inline in the Tasks feed.
/// Mirrors RN `components/gig-browse/SupportTrainRow.tsx`.
public struct SupportTrainRowContent: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    /// "1.2mi · 3h ago" — distance + published age, either piece optional.
    public let metaLine: String
    /// "Springfield, IL · 3 open slots" (area is dropped when unknown).
    public let subtitle: String

    public init(id: String, title: String, metaLine: String, subtitle: String) {
        self.id = id
        self.title = title
        self.metaLine = metaLine
        self.subtitle = subtitle
    }
}

/// A single row in the merged Tasks feed. `sortKey` is the row's epoch
/// timestamp (gig `created_at`, train `published_at`) so both kinds sort
/// newest-first together, exactly like RN's `feedRows` memo.
public enum GigsFeedRow: Identifiable, Sendable, Hashable {
    case gig(GigCardContent, sortKey: Double)
    case supportTrain(SupportTrainRowContent, sortKey: Double)

    public var id: String {
        switch self {
        case let .gig(content, _): "gig-\(content.id)"
        case let .supportTrain(content, _): "st-\(content.id)"
        }
    }

    public var sortKey: Double {
        switch self {
        case let .gig(_, sortKey): sortKey
        case let .supportTrain(_, sortKey): sortKey
        }
    }
}
