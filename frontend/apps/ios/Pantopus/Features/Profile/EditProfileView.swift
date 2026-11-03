//
//  EditProfileView.swift
//  Pantopus
//
//  Edit Profile screen (the 11-01 redesign, `Edit.dc.html`): a live preview
//  card ("How neighbors see you · updates as you type"), then "Neighbors see
//  this" (photo and name neighbors see, username, tagline, about you, helps
//  with, links) and "Only you see this" (account name, email and phone with
//  "Show on my profile", date of birth, address, home address, who sees your
//  city, who can open your profile). Fields mirror `updateProfileSchema` at
//  `backend/routes/users.js:324-351`.
//
//  Skills (`PUT /api/users/skills`) and the name neighbors see (`PATCH
//  /api/local-profiles/me`) ride the same Save; a photo for neighbors and who
//  sees your city save at once.
//

import PhotosUI
import SwiftUI

/// Edit Profile screen — presents as a sheet from the You tab.
public struct EditProfileView: View {
    @State var viewModel: EditProfileViewModel
    /// The photo neighbors see: the picker, and the photo it picked.
    @State var showsNeighborPhotoPicker = false
    @State var neighborPhotoSelection: PhotosPickerItem?
    /// "Who sees your city": Everyone, Connections and household, Only me.
    @State var showsCityChoices = false
    /// Leaving for My homes with unsaved edits asks first.
    @State var showsLeaveWithChanges = false
    /// The prompt picker, and the answer being changed.
    @State var showsPromptPicker = false
    @State var editingPrompt: ProfilePrompt?
    @Environment(\.dismiss) var dismiss
    /// "Home address" opens My homes (the host closes this editor first).
    let onOpenMyHomes: (@MainActor () -> Void)?

    public init(onOpenMyHomes: (@MainActor () -> Void)? = nil) {
        _viewModel = State(initialValue: EditProfileViewModel())
        self.onOpenMyHomes = onOpenMyHomes
    }

    init(viewModel: EditProfileViewModel) {
        _viewModel = State(initialValue: viewModel)
        onOpenMyHomes = nil
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingFrame
            case .loaded:
                loaded
            case let .error(message):
                EmptyState(
                    icon: .alertCircle,
                    headline: "Couldn't load profile",
                    subcopy: message,
                    cta: EmptyState.CTA(title: "Try again") {
                        await viewModel.refresh()
                    }
                )
            }
        }
        .background(Theme.Color.appBg)
        // Presented as a sheet from You: a swipe down would drop unsaved
        // edits without the Close button's "Discard changes?" prompt.
        .interactiveDismissDisabled(viewModel.isDirty)
        .task { await viewModel.load() }
        .task { await viewModel.loadNeighborsAndCity() }
        // Pins are read once the profile says whose they are.
        .task(id: viewModel.accountId) { await viewModel.loadPinned() }
        .modifier(EditProfilePromptSheets(viewModel: viewModel, showsPicker: $showsPromptPicker, editing: $editingPrompt))
        .photosPicker(isPresented: $showsNeighborPhotoPicker, selection: $neighborPhotoSelection, matching: .images)
        .onChange(of: neighborPhotoSelection) { _, item in
            guard let item else { return }
            neighborPhotoSelection = nil
            uploadNeighborPhoto(item)
        }
        .confirmationDialog("Who sees your city", isPresented: $showsCityChoices, titleVisibility: .visible) {
            ForEach(EditProfileViewModel.cityAudienceChoices, id: \.self) { value in
                Button(EditProfileViewModel.cityAudienceLabel(value)) {
                    Task { await viewModel.setCityAudience(value) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your street address is never shown. This is who sees your city on your profile.")
        }
        .alert("Discard your changes?", isPresented: $showsLeaveWithChanges) {
            Button("Keep editing", role: .cancel) {}
            Button("Discard", role: .destructive) {
                viewModel.discardChanges()
                onOpenMyHomes?()
            }
        } message: {
            Text("Save them first, or discard them to open My homes.")
        }
        .onAppear { Analytics.track(.screenEditProfileViewed) }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .dismissToast(after: toast, minimum: 2) {
                        viewModel.toast = nil
                    }
                    .transition(.opacity)
                    .accessibilityIdentifier("editProfileToast")
            }
        }
        .pantopusAnimation(.componentState, value: viewModel.toast)
        .onChange(of: viewModel.shouldDismiss) { _, newValue in
            // Hold the success toast visible briefly before popping so the
            // user actually sees the confirmation.
            guard newValue else { return }
            viewModel.acknowledgeDismiss()
            Task {
                try? await Task.sleep(nanoseconds: 700_000_000)
                dismiss()
            }
        }
    }

    private var loadingFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                HStack {
                    Spacer()
                    Text("Edit profile")
                        .pantopusTextStyle(.body)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .padding(.horizontal, Spacing.s4)

                ForEach(0..<3, id: \.self) { groupIndex in
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        Shimmer(width: 96, height: 12)
                        VStack(spacing: Spacing.s3) {
                            ForEach(0..<(groupIndex == 0 ? 4 : 2), id: \.self) { _ in
                                Shimmer(height: 44, cornerRadius: Radii.md)
                            }
                        }
                        .padding(Spacing.s4)
                        .background(Theme.Color.appSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                    }
                    .padding(.horizontal, Spacing.s4)
                }
            }
            .padding(.vertical, Spacing.s4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading profile")
        .accessibilityIdentifier("editProfileSkeleton")
    }

    private var loaded: some View {
        FormShell(
            title: "Edit profile",
            isValid: viewModel.isValid,
            isDirty: viewModel.isDirty,
            isSaving: viewModel.isSaving,
            onClose: { dismiss() },
            onCommit: { Task { await viewModel.save() } },
            content: {
                previewSection
                neighborsHeader
                neighborsSection
                promptsSection
                skillsSection
                pinnedSection
                socialSection
                onlyYouHeader
                accountSection
                accountPhotoSection
                contactSection
                addressSection
                placeSection
                visibilitySection
            },
            stickyBottom: {
                AnyView(
                    EditProfileStickyBar(
                        dirtyCount: viewModel.dirtyFieldCount,
                        isValid: viewModel.isValid,
                        isSaving: viewModel.isSaving,
                        onDiscard: { viewModel.discardChanges() },
                        onSave: { Task { await viewModel.save() } }
                    )
                )
            }
        )
        .formShakeOnChange(of: viewModel.shakeTrigger)
        .accessibilityIdentifier("editProfileShell")
    }
}

#Preview {
    EditProfileView()
}
