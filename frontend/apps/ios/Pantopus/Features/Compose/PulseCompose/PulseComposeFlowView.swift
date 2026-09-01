//
//  PulseComposeFlowView.swift
//  Pantopus
//
//  Three-step Pulse post composer: target → purpose → draft.
//  Edit mode skips straight to the draft step.
//

import SwiftUI

private enum PulseComposeFlowStep: Equatable {
    case targetPicker
    case purposePicker(PulsePostingTarget)
    case draft(PulsePostingTarget, PulseComposePurpose?)
}

/// Entry point for creating a new Pulse post. Wraps the RN mobile flow.
public struct PulseComposeFlowView: View {
    @State private var step: PulseComposeFlowStep = .targetPicker

    private let prefillFeedIntent: PulseIntent?
    private let editingPostId: String?
    /// Set when entered from a gig detail's "Share to feed" — the picker
    /// drops the Connections card and the purpose is fixed to Local
    /// Update, matching RN (`gig/[id].tsx:540-542,1474-1481`).
    private let taskShare: PulseTaskShare?
    /// Sports-lane starter prompt text seeded into the draft body.
    private let prefillBody: String?
    private let onCancel: @MainActor () -> Void
    private let onPosted: @MainActor (String?) -> Void

    public init(
        prefillFeedIntent: PulseIntent? = nil,
        editingPostId: String? = nil,
        taskShare: PulseTaskShare? = nil,
        prefillBody: String? = nil,
        onCancel: @escaping @MainActor () -> Void = {},
        onPosted: @escaping @MainActor (String?) -> Void = { _ in }
    ) {
        self.prefillFeedIntent = prefillFeedIntent
        self.editingPostId = editingPostId
        self.taskShare = taskShare
        self.prefillBody = prefillBody
        self.onCancel = onCancel
        self.onPosted = onPosted
        if editingPostId != nil {
            _step = State(initialValue: .draft(.connections, nil))
        }
    }

    public var body: some View {
        Group {
            switch step {
            case .targetPicker:
                PulsePostTargetPickerView(
                    onSelect: handleTargetSelected,
                    onCancel: onCancel,
                    hidesNetworkTarget: taskShare != nil
                )
            case let .purposePicker(target):
                PulsePostPurposePickerView(
                    target: target,
                    onSelect: { purpose in
                        step = .draft(target, purpose)
                    },
                    onBack: { step = .targetPicker }
                )
            case let .draft(target, purpose):
                draftView(target: target, purpose: purpose)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("pulseComposeFlow")
    }

    @ViewBuilder
    private func draftView(target: PulsePostingTarget, purpose: PulseComposePurpose?) -> some View {
        let resolvedPurpose = purpose ?? prefillPurpose(for: target)
        let initialIntent = resolvedPurpose?.legacyIntent
            ?? prefillFeedIntent.flatMap { PulseComposeIntent.from(feedIntent: $0) }
            ?? .ask

        PulseComposeView(
            intent: initialIntent,
            identity: identity(for: target),
            postingTarget: target,
            composePurpose: resolvedPurpose,
            postId: editingPostId,
            managesDismiss: false,
            taskShare: taskShare,
            prefillBody: prefillBody,
            onCancel: onCancel,
            onPosted: onPosted
        )
    }

    private func handleTargetSelected(_ target: PulsePostingTarget) {
        // A task share always lands on the Local Update draft — RN skips
        // the purpose grid entirely (`gig/[id].tsx:541-542`).
        if taskShare != nil {
            step = .draft(target, .localUpdate)
            return
        }
        if target.isNetworkTarget {
            step = .draft(target, nil)
            return
        }
        if let prefill = prefillPurpose(for: target) {
            step = .draft(target, prefill)
            return
        }
        step = .purposePicker(target)
    }

    private func prefillPurpose(for target: PulsePostingTarget) -> PulseComposePurpose? {
        if taskShare != nil { return .localUpdate }
        guard let feedIntent = prefillFeedIntent, feedIntent != .all else { return nil }
        let candidate = PulseComposePurpose.allCases.first { $0.legacyIntent == PulseComposeIntent.from(feedIntent: feedIntent) }
        guard let candidate else { return nil }
        return PulseComposePurpose.allowed(for: target).contains(candidate) ? candidate : nil
    }

    private func identity(for target: PulsePostingTarget) -> PulseComposeIdentity {
        switch target {
        case .home: .home
        case .business: .business
        default: .personal
        }
    }
}

#Preview {
    PulseComposeFlowView()
}
