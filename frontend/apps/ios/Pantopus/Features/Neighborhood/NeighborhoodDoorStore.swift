//
//  NeighborhoodDoorStore.swift
//  Pantopus
//
//  Cross-tab hand-off into the launch-cut Tasks and Marketplace surfaces.
//
//  They present as sheets from the Pulse tab (Pulse S3: the Nearby door they
//  used to open from is gone, and Pulse is a tab of its own). When a deep
//  link targets one of them, the dispatcher selects the Pulse tab and
//  stashes the surface here; `PulseTabRoot` observes the stash and presents
//  the matching sheet, whose tab root then consumes the pending deep-link
//  destination exactly as it did when it was a tab.
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
    /// tab itself and presents nothing.)
    public var pendingSurface: Surface?

    public init() {}
}
