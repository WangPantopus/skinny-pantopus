//
//  GigActivityAttributes.swift
//  Pantopus
//
//  Phase 6b — the ActivityKit contract for the active-task Live Activity.
//  Compiled into BOTH the app target (which starts / updates activities via
//  `GigLiveActivityController`) and the PantopusWidgets extension (which
//  renders them) — see the explicit sources entry in `project.yml`. Keep it
//  self-contained: no Theme / DTO / feature imports.
//

import ActivityKit
import Foundation

/// Lifecycle phase mirrored onto the lock screen / Dynamic Island. A
/// superset of `GigActivePhase` — the pre-start worker acks (`onMyWay`,
/// `runningLate`) get their own steps so the poster sees movement before
/// the task actually starts.
public enum GigActivityPhase: String, Codable, Hashable, Sendable {
    case assigned
    case onMyWay
    case runningLate
    case inProgress
    case markedDone
    case confirmed

    public var label: String {
        switch self {
        case .assigned: "Assigned"
        case .onMyWay: "On my way"
        case .runningLate: "Running late"
        case .inProgress: "In progress"
        case .markedDone: "Marked done"
        case .confirmed: "Confirmed"
        }
    }
}

/// Attributes for the active-gig Live Activity. The fixed identity rides
/// here; everything that changes over the task's life rides `ContentState`.
public struct GigActivityAttributes: ActivityAttributes, Sendable {
    public struct ContentState: Codable, Hashable, Sendable {
        public var phase: GigActivityPhase
        /// Minutes from a `running_late` worker-ack; `nil` otherwise.
        public var etaMinutes: Int?
        /// Display name of the assigned worker, when known to the viewer.
        public var workerName: String?

        public init(phase: GigActivityPhase, etaMinutes: Int? = nil, workerName: String? = nil) {
            self.phase = phase
            self.etaMinutes = etaMinutes
            self.workerName = workerName
        }
    }

    public let gigId: String
    public let title: String
    /// Backend category key (`handyman`, `cleaning`, …) — the extension
    /// maps it to its local accent palette.
    public let categoryKey: String

    public init(gigId: String, title: String, categoryKey: String) {
        self.gigId = gigId
        self.title = title
        self.categoryKey = categoryKey
    }
}
