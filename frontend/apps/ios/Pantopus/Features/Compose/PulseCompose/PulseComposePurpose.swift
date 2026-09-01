//
//  PulseComposePurpose.swift
//  Pantopus
//
//  Purpose-driven post types for step 2 of the Pulse compose flow.
//  Maps to backend `purpose` + `postType` — aligned with
//  `@pantopus/ui-utils` PURPOSE_TO_POST_TYPE.
//

import Foundation

/// User-facing purpose selected before the draft screen.
public enum PulseComposePurpose: String, CaseIterable, Sendable, Hashable, Identifiable {
    case ask
    case headsUp = "heads_up"
    case recommend
    case lostFound = "lost_found"
    case localUpdate = "local_update"
    case neighborhoodWin = "neighborhood_win"
    case visitorGuide = "visitor_guide"
    case event
    case deal

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .ask: "Ask"
        case .headsUp: "Heads Up"
        case .recommend: "Recommend"
        case .lostFound: "Lost & Found"
        case .localUpdate: "Local Update"
        case .neighborhoodWin: "Neighborhood Win"
        case .visitorGuide: "Visitor Guide"
        case .event: "Event"
        case .deal: "Deal"
        }
    }

    public var placeholder: String {
        switch self {
        case .ask: "What do you want to ask nearby?"
        case .headsUp: "What should people nearby know?"
        case .recommend: "What are you recommending?"
        case .lostFound: "Describe what was lost or found…"
        case .localUpdate: "Share a local update with your neighbors…"
        case .neighborhoodWin: "Celebrate something great in your neighborhood…"
        case .visitorGuide: "Share tips for visitors to the area…"
        case .event: "Tell people about this event…"
        case .deal: "Describe the deal and where to find it…"
        }
    }

    /// Backend `post_type` column.
    public var postType: String {
        switch self {
        case .ask: "ask_local"
        case .headsUp: "alert"
        case .recommend: "recommendation"
        case .lostFound: "lost_found"
        case .localUpdate: "local_update"
        case .neighborhoodWin: "neighborhood_win"
        case .visitorGuide: "visitor_guide"
        case .event: "event"
        case .deal: "deal"
        }
    }

    /// Backend `purpose` enum (v1.2).
    public var apiPurpose: String {
        rawValue
    }

    /// Bridge into the legacy five-intent draft form where sections exist.
    public var legacyIntent: PulseComposeIntent {
        switch self {
        case .ask: .ask
        case .recommend: .recommend
        case .event: .event
        case .lostFound: .lost
        case .headsUp, .localUpdate, .neighborhoodWin, .visitorGuide, .deal: .announce
        }
    }

    /// Post types allowed per posting target — mirrors mobile
    /// `PostComposerModal` filtering.
    public static func allowed(for target: PulsePostingTarget) -> [PulseComposePurpose] {
        // swiftformat:disable:next redundantType
        let placeTypes: Set<String> = [
            "ask_local", "recommendation", "event", "lost_found", "alert", "deal",
            "local_update", "neighborhood_win", "visitor_guide"
        ]
        // swiftformat:disable:next redundantType
        let businessTypes: Set<String> = ["event", "deal", "local_update"]

        let allowedPostTypes: Set<String> = switch target {
        case .business: businessTypes
        case .connections: Set<String>(["general"]) // connections skip purpose grid in practice
        default: placeTypes
        }

        if target.isNetworkTarget {
            return []
        }

        return PulseComposePurpose.allCases.filter { allowedPostTypes.contains($0.postType) }
    }
}
