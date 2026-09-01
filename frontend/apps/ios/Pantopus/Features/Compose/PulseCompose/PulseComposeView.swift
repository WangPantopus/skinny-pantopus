//
//  PulseComposeView.swift
//  Pantopus
//
//  Pulse compose form — replaces the `NotYetAvailableView` placeholder
//  previously routed under `HubRoute.composePost(intent:)`. Wraps a
//  `FormShell` whose body is `PulseComposeContent` and which routes
//  submit through `PulseComposeViewModel`.
//

import PhotosUI
import SwiftUI

/// Entry point for the Pulse compose flow. The `intent` argument
/// pre-selects which sub-form renders below the intent picker. Pass a
/// non-nil `postId` to open the form in edit mode — the VM fetches the
/// saved post, prefills every field, locks the intent picker, and the
/// submit pipeline switches to `PATCH /api/posts/:id`.
public struct PulseComposeView: View {
    @State private var viewModel: PulseComposeViewModel
    @State private var photosPickerSelection: [PhotosPickerItem] = []
    @State private var showsPhotosPicker = false
    @State private var showsPlacePicker = false
    @Environment(\.dismiss) private var dismiss

    private let onPosted: @MainActor (String?) -> Void
    private let onCancel: @MainActor () -> Void
    private let managesDismiss: Bool

    /// - Parameter businessAuthorId: C2 — when non-nil the submit posts to
    ///   `POST /api/businesses/:businessId/posts` so the row is authored by
    ///   the business. Used by the Business owner dashboard's compose FAB.
    public init(
        intent: PulseComposeIntent = .ask,
        identity: PulseComposeIdentity = .personal,
        postingTarget: PulsePostingTarget? = nil,
        composePurpose: PulseComposePurpose? = nil,
        postId: String? = nil,
        businessAuthorId: String? = nil,
        managesDismiss: Bool = true,
        taskShare: PulseTaskShare? = nil,
        prefillBody: String? = nil,
        onCancel: @escaping @MainActor () -> Void = {},
        onPosted: @escaping @MainActor (String?) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: PulseComposeViewModel(
            intent: intent,
            identity: identity,
            postingTarget: postingTarget,
            composePurpose: composePurpose,
            postId: postId,
            businessAuthorId: businessAuthorId,
            taskShare: taskShare,
            prefillBody: prefillBody
        ))
        self.managesDismiss = managesDismiss
        self.onCancel = onCancel
        self.onPosted = onPosted
    }

    /// Test seam — accept a pre-built view-model so tests can drive
    /// state without touching the network.
    init(
        viewModel: PulseComposeViewModel,
        managesDismiss: Bool = true,
        onCancel: @escaping @MainActor () -> Void = {},
        onPosted: @escaping @MainActor (String?) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.managesDismiss = managesDismiss
        self.onCancel = onCancel
        self.onPosted = onPosted
    }

    public var body: some View {
        FormShell(
            title: viewModel.displayTitle,
            rightActionLabel: viewModel.ctaLabel,
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSubmitting,
            onClose: closeCompose,
            onCommit: {
                Task { await viewModel.submit() }
            },
            content: {
                shellContent
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .accessibilityIdentifier("composePulseShell")
        .photosPicker(
            isPresented: $showsPhotosPicker,
            selection: $photosPickerSelection,
            maxSelectionCount: pulseComposeMaxPhotos,
            matching: .images
        )
        .onChange(of: photosPickerSelection) { _, newItems in
            handlePicked(newItems)
        }
        .sheet(isPresented: $showsPlacePicker) {
            PlacePickerSheet(
                currentTag: viewModel.selectedPlaceTag,
                mediaLocation: viewModel.mediaCaptureLocation,
                onSelect: { tag in
                    viewModel.selectPlaceTag(tag)
                    showsPlacePicker = false
                },
                onRemove: {
                    viewModel.clearPlaceTag()
                    showsPlacePicker = false
                },
                onDismiss: { showsPlacePicker = false }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
                    .accessibilityIdentifier("composePulseToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .task {
            if viewModel.isEditing, case .loading = viewModel.prefillState {
                await viewModel.loadForEdit()
            }
            if !viewModel.isEditing {
                await viewModel.checkPlaceEligibility()
            }
        }
        .onAppear {
            Analytics.track(.screenPulseComposeViewed(intent: viewModel.activeIntent.rawValue))
        }
        .onChange(of: viewModel.shouldDismiss) { _, newValue in
            guard newValue else { return }
            let postId: String? = {
                if case let .success(id) = viewModel.state { return id }
                return nil
            }()
            viewModel.acknowledgeDismiss()
            Task {
                // Hold the success toast briefly so the user sees it.
                try? await Task.sleep(nanoseconds: 700_000_000)
                onPosted(postId)
                closeCompose()
            }
        }
    }

    private func closeCompose() {
        if managesDismiss {
            dismiss()
        } else {
            onCancel()
        }
    }

    @ViewBuilder
    private var shellContent: some View {
        switch viewModel.prefillState {
        case .loading:
            PulseComposePrefillSkeleton()
        case let .error(message):
            PulseComposePrefillError(message: message) {
                Task { await viewModel.loadForEdit() }
            }
        case .ready:
            PulseComposeContent(
                state: viewModel.contentState,
                actions: actions
            )
        }
    }

    private var actions: PulseComposeContentActions {
        PulseComposeContentActions(
            onSelectIntent: { viewModel.selectIntent($0) },
            onSelectIdentity: { viewModel.identity = $0 },
            onSelectVisibility: { viewModel.visibility = $0 },
            onSelectLostFoundKind: { viewModel.lostFoundKind = $0 },
            onSelectContactPref: { viewModel.lostFoundContactPref = $0 },
            onSelectAnnounceAudience: { viewModel.announceAudience = $0 },
            onSelectSafetyAlertKind: { viewModel.safetyAlertKind = $0 },
            onSelectAskCategory: { viewModel.askCategory = $0 },
            onSelectRecommendRating: { viewModel.recommendRating = $0 },
            onSelectDealExpires: { viewModel.dealExpiresAt = $0 },
            onUpdateField: { viewModel.update($0, to: $1) },
            onPickPhotos: { showsPhotosPicker = true },
            onRemovePhoto: { viewModel.remove(photo: $0) },
            onBodyEditingEnded: { Task { await viewModel.runPrecheck() } },
            onDismissPrecheckNudge: { viewModel.precheckNudge = nil },
            onAddLocation: { showsPlacePicker = true },
            onClearLocation: { viewModel.clearPlaceTag() }
        )
    }

    private func handlePicked(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var loaded: [PulseComposePhoto] = []
            for item in items.prefix(pulseComposeMaxPhotos) {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    // Off-main, failure-silent EXIF read. The capture
                    // location is ONLY a local place-picker anchor —
                    // it is never attached to the outgoing post.
                    let capture = await MediaLocationExtractor.imageLocation(from: data)
                    loaded.append(PulseComposePhoto(
                        data: data,
                        capturedLatitude: capture?.latitude,
                        capturedLongitude: capture?.longitude
                    ))
                }
            }
            await MainActor.run {
                viewModel.setPhotos(loaded)
                photosPickerSelection = []
            }
        }
    }
}

/// View-model → content-state projection. Lives on the view-model so
/// fixture tests can produce the same shape without `@Observable`
/// plumbing.
public extension PulseComposeViewModel {
    var contentState: PulseComposeContentState {
        PulseComposeContentState(
            activeIntent: activeIntent,
            identity: identity,
            visibility: visibility,
            lostFoundKind: lostFoundKind,
            lostFoundContactPref: lostFoundContactPref,
            announceAudience: announceAudience,
            safetyAlertKind: safetyAlertKind,
            askCategory: askCategory,
            recommendRating: recommendRating,
            dealExpiresAt: dealExpiresAt,
            eligibilityWarning: eligibilityWarning,
            precheckNudge: precheckNudge,
            precheckCooldown: precheckCooldown,
            isVisitorPost: isVisitorPost,
            fields: fields,
            photos: photos,
            selectedPlaceTag: selectedPlaceTag,
            isIntentLocked: isIntentLocked,
            isFlowMode: isFlowMode,
            composePurpose: composePurpose,
            postingTargetLabel: postingTarget?.displayLabel
        )
    }
}

/// Shimmer skeleton shown while the edit-mode prefill is in flight.
/// Mirrors the loaded geometry so layout doesn't jump on resolve.
private struct PulseComposePrefillSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            Shimmer(width: 220, height: 16, cornerRadius: Radii.sm)
            HStack(spacing: Spacing.s2) {
                Shimmer(width: 64, height: 32, cornerRadius: Radii.pill)
                Shimmer(width: 80, height: 32, cornerRadius: Radii.pill)
                Shimmer(width: 72, height: 32, cornerRadius: Radii.pill)
            }
            Shimmer(width: 160, height: 16, cornerRadius: Radii.sm)
            Shimmer(height: 44, cornerRadius: Radii.md)
            Shimmer(width: 100, height: 16, cornerRadius: Radii.sm)
            Shimmer(height: 96, cornerRadius: Radii.md)
        }
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("composePulsePrefillSkeleton")
    }
}

/// Error state shown when the edit-mode prefill fetch fails. Pairs a
/// short message with a retry CTA wired back to `loadForEdit`.
private struct PulseComposePrefillError: View {
    let message: String
    let onRetry: @MainActor () -> Void

    var body: some View {
        EmptyState(
            icon: .alertCircle,
            headline: "Couldn't load this post",
            subcopy: message,
            cta: EmptyState.CTA(title: "Try again") {
                await MainActor.run { onRetry() }
            }
        )
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s4)
        .accessibilityIdentifier("composePulsePrefillError")
    }
}

#Preview {
    PulseComposeView(intent: .ask)
}
