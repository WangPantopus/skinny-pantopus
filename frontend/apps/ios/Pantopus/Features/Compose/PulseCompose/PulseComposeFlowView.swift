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

/// Where a composer is in its flow, and its draft. A screen that a fold or a
/// turn of the iPhone Duo rebuilds keeps one per open composer (the Nearby
/// tab's Pulse and Messages show the composer beside the feed or the list
/// open, alone closed): the rebuilt composer carries on at the same step with
/// the same draft, photos included, instead of starting over.
@Observable
@MainActor
public final class PulseComposeSession {
    fileprivate var step: PulseComposeFlowStep
    /// The draft step's form, for the target and purpose it was made for.
    @ObservationIgnored private var draft: (step: PulseComposeFlowStep, model: PulseComposeViewModel)?
    /// The first step's homes, read once per visit to it: a screen rebuilt by a fold or a turn shows them again.
    @ObservationIgnored private var targetPicker: PulsePostTargetPickerViewModel?

    /// - Parameter editing: The composer edits a saved post, which opens on its draft.
    public init(editing: Bool = false) {
        step = editing ? .draft(.connections, nil) : .targetPicker
    }

    /// The draft for this step: the one made earlier, or a new one.
    fileprivate func draftModel(for step: PulseComposeFlowStep, make: () -> PulseComposeViewModel) -> PulseComposeViewModel {
        if let draft, draft.step == step { return draft.model }
        let model = make()
        draft = (step, model)
        return model
    }

    /// The first step's homes for this visit: the ones read earlier, or new ones.
    fileprivate func targetPickerModel() -> PulsePostTargetPickerViewModel {
        if let targetPicker { return targetPicker }
        let model = PulsePostTargetPickerViewModel()
        targetPicker = model
        return model
    }

    /// Leaving the first step: coming back to it reads the homes again, as before.
    fileprivate func leaveTargetPicker() {
        targetPicker = nil
    }

    /// A fold or a turn moved the composer to the tab's other layout: its rebuilt screens read nothing again.
    func screensMoved() {
        draft?.model.screens.screensMoved()
        targetPicker?.screens.screensMoved()
    }
}

/// Entry point for creating a new Pulse post. Wraps the RN mobile flow.
public struct PulseComposeFlowView: View {
    /// This composer's own session, unless the caller keeps one (`session`).
    @State private var ownSession: PulseComposeSession
    private let session: PulseComposeSession?

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
        session: PulseComposeSession? = nil,
        onCancel: @escaping @MainActor () -> Void = {},
        onPosted: @escaping @MainActor (String?) -> Void = { _ in }
    ) {
        _ownSession = State(initialValue: PulseComposeSession(editing: editingPostId != nil))
        self.session = session
        self.prefillFeedIntent = prefillFeedIntent
        self.editingPostId = editingPostId
        self.taskShare = taskShare
        self.prefillTitle = prefillTitle
        self.prefillBody = prefillBody
        self.prefillDraft = prefillDraft
        self.onCancel = onCancel
        self.onPosted = onPosted
    }

    private var current: PulseComposeSession {
        session ?? ownSession
    }

    public var body: some View {
        Group {
            switch current.step {
            case .targetPicker:
                PulsePostTargetPickerView(
                    viewModel: current.targetPickerModel(),
                    onSelect: handleTargetSelected,
                    onCancel: onCancel,
                    hidesNetworkTarget: taskShare != nil
                )
            case let .purposePicker(target):
                PulsePostPurposePickerView(
                    target: target,
                    onSelect: { purpose in
                        current.step = .draft(target, purpose)
                    },
                    onBack: { current.step = .targetPicker }
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
            viewModel: current.draftModel(for: .draft(target, purpose)) {
                PulseComposeViewModel(
                    intent: initialIntent,
                    identity: identity(for: target),
                    postingTarget: target,
                    composePurpose: resolvedPurpose,
                    postId: editingPostId,
                    taskShare: taskShare,
                    prefillTitle: prefillTitle,
                    prefillBody: prefillBody,
                    prefillDraft: prefillDraft
                )
            },
            managesDismiss: false,
            onCancel: onCancel,
            onPosted: onPosted
        )
    }

    private func handleTargetSelected(_ target: PulsePostingTarget) {
        current.leaveTargetPicker()
        // A task share always lands on the Local Update draft — RN skips
        // the purpose grid entirely (`gig/[id].tsx:541-542`).
        if taskShare != nil {
            current.step = .draft(target, .localUpdate)
            return
        }
        if target.isNetworkTarget {
            current.step = .draft(target, nil)
            return
        }
        if let prefill = prefillPurpose(for: target) {
            current.step = .draft(target, prefill)
            return
        }
        current.step = .purposePicker(target)
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
