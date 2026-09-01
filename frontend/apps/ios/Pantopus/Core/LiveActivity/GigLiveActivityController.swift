//
//  GigLiveActivityController.swift
//  Pantopus
//
//  Phase 6b — app-side driver for the active-task Live Activity. The gig
//  detail view-model calls `sync(...)` after every fetch (initial load,
//  post-mutation refreshes, `gig:*` room-event refetches); this controller
//  reconciles ActivityKit state from the gig: start on an active phase,
//  update on phase changes, end on terminal states. The widget UI lives in
//  the PantopusWidgets extension.
//

import ActivityKit
import Foundation

/// Injection seam so `GigDetailViewModel` can drive the Live Activity
/// without touching ActivityKit in unit tests / SwiftUI previews.
@MainActor
public protocol GigLiveActivityControlling: AnyObject {
    /// Reconcile the lock-screen activity with a freshly-fetched gig.
    /// `isParticipant` is owner-or-worker — non-participants never host
    /// an activity (and an existing one is torn down if the flag drops).
    func sync(gig: GigDTO, isParticipant: Bool, workerName: String?)
}

/// Real ActivityKit-backed controller. No-ops when the user disabled
/// Live Activities, and under XCTest / previews so
/// `GigDetailViewModelTests` stay deterministic.
@MainActor
public final class GigLiveActivityController: GigLiveActivityControlling {
    public static let shared = GigLiveActivityController()

    private let isSuppressed: Bool

    init(environment: [String: String] = ProcessInfo.processInfo.environment) {
        isSuppressed = environment["XCTestConfigurationFilePath"] != nil
            || environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
    }

    public func sync(gig: GigDTO, isParticipant: Bool, workerName: String?) {
        guard !isSuppressed, ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let existing = Activity<GigActivityAttributes>.activities
            .first { $0.attributes.gigId == gig.id }
        guard isParticipant, let phase = Self.phase(for: gig) else {
            // Open / cancelled / expired — or the viewer stopped being a
            // participant — tear down whatever is showing.
            if let existing { end(existing, finalState: nil) }
            return
        }
        let state = GigActivityAttributes.ContentState(
            phase: phase,
            etaMinutes: phase == .runningLate ? gig.workerAckEtaMinutes : nil,
            workerName: workerName
        )
        if phase == .confirmed {
            // Terminal success: land the final frame, let the system
            // dismiss it on its own schedule.
            if let existing { end(existing, finalState: state) }
            return
        }
        if let existing {
            guard existing.content.state != state else { return }
            Task { await existing.update(ActivityContent(state: state, staleDate: nil)) }
        } else {
            let attributes = GigActivityAttributes(
                gigId: gig.id,
                title: gig.title,
                categoryKey: gig.category ?? ""
            )
            _ = try? Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: nil)
            )
        }
    }

    private func end(
        _ activity: Activity<GigActivityAttributes>,
        finalState: GigActivityAttributes.ContentState?
    ) {
        Task {
            if let finalState {
                await activity.end(
                    ActivityContent(state: finalState, staleDate: nil),
                    dismissalPolicy: .default
                )
            } else {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }

    /// Map the gig's lifecycle fields to a Live Activity phase. `nil`
    /// outside the assigned → confirmed window (open / cancelled /
    /// expired). Mirrors `GigDetailViewModel.activePhase(for:)` plus the
    /// pre-start worker-ack split.
    static func phase(for gig: GigDTO) -> GigActivityPhase? {
        switch (gig.status ?? "").lowercased() {
        case "assigned":
            switch gig.workerAckStatus {
            case "starting_now": .onMyWay
            case "running_late": .runningLate
            default: .assigned
            }
        case "in_progress":
            .inProgress
        case "completed":
            (gig.ownerConfirmedAt ?? "").isEmpty ? .markedDone : .confirmed
        default:
            nil
        }
    }
}
