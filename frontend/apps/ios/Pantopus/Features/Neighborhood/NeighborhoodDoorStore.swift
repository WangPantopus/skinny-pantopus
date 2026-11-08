//
//  NeighborhoodDoorStore.swift
//  Pantopus
//
//  Cross-tab hand-off into the launch-cut Tasks and Marketplace surfaces.
//
//  With the Pulse redesign on (Pulse S3) Tasks and Marketplace present as
//  sheets from the Pulse tab: when a deep link targets one of them, the
//  dispatcher selects the Pulse tab and stashes the surface here;
//  `PulseTabRoot` observes the stash and presents the matching sheet, whose
//  tab root then consumes the pending deep-link destination exactly as it
//  did when it was a tab.
//
//  While the Pulse redesign is off (launch cut #11) the bar's Pulse tab is
//  `NeighborhoodTabRoot`, which presents Tasks or Marketplace as sheets the
//  same way. (Its Neighborhood segment is gone since the founder's November 7
//  decision: the density window is "Verified homes nearby" on Place.)
//

import Foundation
import Observation

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
    /// `NeighborhoodTabRoot` consumes it, and Tasks and Marketplace present
    /// as sheets.
    public var pendingSurface: Surface?

    public init() {}
}
