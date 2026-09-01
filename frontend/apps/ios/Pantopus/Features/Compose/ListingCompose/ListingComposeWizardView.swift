//
//  ListingComposeWizardView.swift
//  Pantopus
//
//  Concrete Snap & Sell listing wizard. Composes `WizardShell` with six
//  step bodies and persists in-progress state via `@SceneStorage` so the
//  wizard survives process death.
//

import SwiftUI

/// Pushed onto the Hub stack from the Marketplace FAB. On success,
/// signals the parent stack to pop the wizard and route to the new
/// listing's detail via `onOpenListingDetail`. In edit mode (init with
/// `mode: .edit(...)`) the wizard prefills from the existing listing
/// and signals via `onListingUpdated` so the host can refresh the
/// detail screen.
public struct ListingComposeWizardView: View {
    @State private var viewModel: ListingComposeWizardViewModel
    @SceneStorage("listingComposeWizardForm") private var storedForm: String = ""
    @State private var hasRestored = false
    @State private var didLoadExisting = false
    @State private var photoPendingRemoval: ListingComposePhoto?
    @Environment(\.dismiss) private var dismiss

    private let mode: ListingComposeMode
    private let onOpenListingDetail: (String) -> Void
    private let onListingUpdated: ((String) -> Void)?

    public init(
        mode: ListingComposeMode = .create,
        onOpenListingDetail: @escaping (String) -> Void = { _ in },
        onListingUpdated: ((String) -> Void)? = nil
    ) {
        self.mode = mode
        self.onOpenListingDetail = onOpenListingDetail
        self.onListingUpdated = onListingUpdated
        _viewModel = State(initialValue: ListingComposeWizardViewModel(mode: mode))
    }

    public init(onOpenListingDetail: @escaping (String) -> Void) {
        self.init(mode: .create, onOpenListingDetail: onOpenListingDetail)
    }

    public var body: some View {
        WizardShell(model: viewModel) {
            if viewModel.isLoadingExisting {
                ListingComposeLoadingBlock()
            } else {
                stepContent
                if let error = viewModel.errorMessage {
                    ListingComposeErrorBanner(message: error)
                }
            }
        }
        .task {
            // Edit mode: fetch the listing on first appear. Idempotent
            // — the VM no-ops once the form is non-empty.
            if mode.isEdit, !didLoadExisting {
                didLoadExisting = true
                await viewModel.loadExistingIfNeeded()
            }
        }
        .onAppear {
            restoreIfNeeded()
            if let stepNumber = viewModel.currentStep.stepNumber {
                Analytics.track(
                    .screenListingComposeWizardStepViewed(
                        stepNumber: stepNumber,
                        stepName: String(describing: viewModel.currentStep)
                    )
                )
            }
        }
        .onChange(of: viewModel.form) { _, _ in persist() }
        .onChange(of: viewModel.pendingEvent) { _, event in handle(event) }
        .confirmationDialog(
            "Remove this photo?",
            isPresented: Binding(
                get: { photoPendingRemoval != nil },
                set: { if !$0 { photoPendingRemoval = nil } }
            ),
            titleVisibility: .visible,
            presenting: photoPendingRemoval
        ) { photo in
            Button("Remove photo", role: .destructive) {
                viewModel.removePhoto(id: photo.id)
                photoPendingRemoval = nil
            }
            .accessibilityIdentifier("listingCompose_removePhotoConfirm")
            Button("Cancel", role: .cancel) { photoPendingRemoval = nil }
        }
        .accessibilityIdentifier(mode.isEdit ? "listingEditWizard" : "listingComposeWizard")
    }

    @ViewBuilder
    private var stepContent: some View {
        switch viewModel.currentStep {
        case .photos:
            ListingComposePhotosStep(viewModel: viewModel) { photo in
                photoPendingRemoval = photo
            }
        case .titleCategory:
            if viewModel.isSnapReviewStep {
                if viewModel.isAnalyzing {
                    ListingComposeAnalyzingBlock()
                } else {
                    ListingComposeSnapReviewStep(viewModel: viewModel)
                }
            } else {
                ListingComposeTitleCategoryStep(viewModel: viewModel)
            }
        case .conditionDescription: ListingComposeConditionDescriptionStep(viewModel: viewModel)
        case .price: ListingComposePriceStep(viewModel: viewModel)
        case .location: ListingComposeLocationStep(viewModel: viewModel)
        case .review: ListingComposeReviewStep(viewModel: viewModel)
        case .success: ListingComposeSuccessStep()
        }
    }

    private func restoreIfNeeded() {
        guard !hasRestored else { return }
        hasRestored = true
        // Edit mode skips the SceneStorage restore — it hydrates from
        // the backend instead so a stale create-draft can't blow away
        // the listing being edited.
        guard !mode.isEdit else { return }
        guard let data = storedForm.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(ListingComposeFormState.self, from: data)
        else { return }
        viewModel.restore(from: snapshot)
    }

    private func persist() {
        // Only the create flow persists drafts. Editing an existing
        // listing should never overwrite the create-draft scene
        // storage.
        guard !mode.isEdit else { return }
        guard let data = try? JSONEncoder().encode(viewModel.form),
              let json = String(data: data, encoding: .utf8)
        else { return }
        storedForm = json
    }

    private func handle(_ event: ListingComposeOutboundEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            if !mode.isEdit { storedForm = "" }
            dismiss()
        case let .openListingDetail(listingId):
            storedForm = ""
            onOpenListingDetail(listingId)
        case let .listingUpdated(listingId):
            if let onListingUpdated {
                onListingUpdated(listingId)
            } else {
                dismiss()
            }
        }
        viewModel.pendingEvent = nil
    }
}

/// Shimmer surface shown while the Snap & Sell vision draft is in
/// flight — mirrors the loaded review geometry (photo strip, banner,
/// fields) so layout doesn't jump when suggestions resolve.
private struct ListingComposeAnalyzingBlock: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            HStack(spacing: Spacing.s2) {
                Icon(.sparkles, size: 16, color: Theme.Color.business)
                Text("Analyzing your photos…")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            Text("Pantopus is drafting your title, price, and details.")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Shimmer()
                .frame(height: 168)
            Shimmer()
                .frame(height: 52)
            Shimmer()
                .frame(height: 44)
            Shimmer()
                .frame(height: 44)
            Shimmer()
                .frame(height: 96)
        }
        .accessibilityIdentifier("listingComposeAnalyzing")
        .accessibilityLabel("Analyzing your photos")
    }
}

private struct ListingComposeLoadingBlock: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer()
                .frame(height: 24)
                .frame(maxWidth: 180)
            Shimmer()
                .frame(height: 16)
                .frame(maxWidth: .infinity)
            Shimmer()
                .frame(height: 16)
                .frame(maxWidth: 240)
            Shimmer()
                .frame(height: 128)
        }
        .accessibilityIdentifier("listingComposeEditLoading")
        .accessibilityLabel("Loading listing")
    }
}

private struct ListingComposeErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.alertCircle, size: 18, color: Theme.Color.error)
            Text(message)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.error)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.errorBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("listingComposeErrorBanner")
    }
}

private func previewOpenListingDetail(_: String) {}

#Preview {
    ListingComposeWizardView(onOpenListingDetail: previewOpenListingDetail)
}
