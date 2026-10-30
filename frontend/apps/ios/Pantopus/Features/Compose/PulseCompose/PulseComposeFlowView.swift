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
    /// A Pantopus AI post draft's headline, seeded into the draft title.
    private let prefillTitle: String?
    /// Sports-lane starter prompt text seeded into the draft body.
    private let prefillBody: String?
    /// A Pantopus AI post card: its type picks the form, and every field it
    /// carries (event times and place, a deal's end, lost or found, the
    /// Heads Up kind) starts filled in.
    private let prefillDraft: PulseComposeDraft?
    private let onCancel: @MainActor () -> Void
    private let onPosted: @MainActor (String?) -> Void

    public init(
        prefillFeedIntent: PulseIntent? = nil,
        editingPostId: String? = nil,
        taskShare: PulseTaskShare? = nil,
        prefillTitle: String? = nil,
        prefillBody: String? = nil,
        prefillDraft: PulseComposeDraft? = nil,
        onCancel: @escaping @MainActor () -> Void = {},
        onPosted: @escaping @MainActor (String?) -> Void = { _ in }
    ) {
        self.prefillFeedIntent = prefillFeedIntent
        self.editingPostId = editingPostId
        self.taskShare = taskShare
        self.prefillTitle = prefillTitle
        self.prefillBody = prefillBody
        self.prefillDraft = prefillDraft
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
                // Back returns to the first step; a swipe from the edge would close the composer.
                .swipeBackDisabled()
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
            prefillTitle: prefillTitle,
            prefillBody: prefillBody,
            prefillDraft: prefillDraft,
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
        // A card's own type wins: a deal and a Heads Up share one form family.
        if let purpose = prefillDraft?.purpose, PulseComposePurpose.allowed(for: target).contains(purpose) {
            return purpose
        }
        // A filtered feed opens its own type's form (Deals opens Deal), not the first form of its family.
        guard let postType = prefillFeedIntent?.postType,
              let candidate = PulseComposePurpose.allCases.first(where: { $0.postType == postType }) else { return nil }
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
