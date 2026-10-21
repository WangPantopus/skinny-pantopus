//
//  NeighborhoodDoorStore.swift
//  Pantopus
//
//  Cross-tab hand-off into the Nearby tab's two segments and the launch-cut
//  Tasks and Marketplace surfaces.
//
//  With the Pulse redesign on (Pulse S3) Tasks and Marketplace present as
//  sheets from the Pulse tab: when a deep link targets one of them, the
//  dispatcher selects the Pulse tab and stashes the surface here;
//  `PulseTabRoot` observes the stash and presents the matching sheet, whose
//  tab root then consumes the pending deep-link destination exactly as it
//  did when it was a tab.
//
//  While the Pulse redesign is off (launch cut #11) the dispatcher selects
//  the Nearby tab instead. Nearby is two segments (founder decision
//  2026-10-20): Pulse, the October 13 feed, and Neighborhood, the density
//  window and meter. A link picks the segment through `pendingSegment`, and
//  `NeighborhoodTabRoot` presents Tasks or Marketplace as sheets.
//

import Foundation
import Observation

/// The Nearby tab's two segments (founder decision 2026-10-20): Pulse on the
/// left, where the tab opens, and Neighborhood, the density map.
public enum NearbySegment: String, CaseIterable, Hashable, Sendable {
    case pulse, neighborhood

    public var label: String {
        switch self {
        case .pulse: "Pulse"
        case .neighborhood: "Neighborhood"
        }
    }
}

@Observable
@MainActor
public final class NeighborhoodDoorStore {
    public static let shared = NeighborhoodDoorStore()

    /// A neighborhood surface presented from the door.
    public enum Surface: String, Identifiable, Sendable {
        case pulse, tasks, marketplace
        public var id: String {
            rawValue
        }

        /// First-launch scope: Tasks (launch cut #4, Open gigs) and
        /// Marketplace (launch cut #3) are hidden; Pulse stays.
        public var isAvailableAtLaunch: Bool {
            switch self {
            case .pulse: true
            case .tasks: LaunchFeatures.openGigs
            case .marketplace: LaunchFeatures.marketplace
            }
        }
    }

    /// Set by the cross-tab dispatcher; consumed (nil-ed) by
    /// `PulseTabRoot` when it presents the surface. (`.pulse` is the Pulse
    /// tab itself and presents nothing.) While the Pulse redesign is off,
    /// `NeighborhoodTabRoot` consumes it: `.pulse` shows the Pulse segment,
    /// and Tasks and Marketplace present as sheets.
    public var pendingSurface: Surface?

    /// The Nearby segment a link asked for (a feed or post link: Pulse; a
    /// `/nearby` link: Neighborhood). Consumed by `NeighborhoodTabRoot`.
    public var pendingSegment: NearbySegment?

    public init() {}
}
