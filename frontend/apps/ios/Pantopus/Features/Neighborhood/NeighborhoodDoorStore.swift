//
//  NeighborhoodDoorStore.swift
//  Pantopus
//
//  Wedge Phase 1 — cross-tab hand-off into the Neighborhood door.
//
//  Pulse / Tasks / Marketplace left the root tab bar; their surfaces now
//  present from the Neighborhood tab. When a deep link (or the Hub pillar
//  grid) targets one of them, the dispatcher selects the Neighborhood tab
//  and stashes the surface here; `NeighborhoodTabRoot` observes the stash
//  and presents the matching sheet, whose tab root then consumes the
//  pending deep-link destination exactly as it did when it was a tab.
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
        public var id: String { rawValue }
    }

    /// Set by the cross-tab dispatcher; consumed (nil-ed) by
    /// `NeighborhoodTabRoot` when it presents the surface.
    public var pendingSurface: Surface?

    public init() {}
}
