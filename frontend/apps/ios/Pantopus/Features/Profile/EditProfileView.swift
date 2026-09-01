//
//  EditProfileView.swift
//  Pantopus
//
//  Edit Profile screen. Fields mirror `updateProfileSchema` at
//  `backend/routes/users.js:324-351`. Section ordering matches the P10
//  design: About, Skills, Contact, Address, Social, Visibility.
//
//  Skills are the one group that doesn't ride the profile PATCH — they
//  commit through `PUT /api/users/skills` in the same `save()`.
//

import SwiftUI

/// Edit Profile screen — presents as a sheet from the You tab.
public struct EditProfileView: View {
    @State var viewModel: EditProfileViewModel
    @Environment(\.dismiss) private var dismiss

    public init() {
        _viewModel = State(initialValue: EditProfileViewModel())
    }

    init(viewModel: EditProfileViewModel) {
        _viewModel = State(initialValue: viewModel)
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
        .task { await viewModel.load() }
        .onAppear { Analytics.track(.screenEditProfileViewed) }
        .overlay(alignment: .bottom) {
            if let toast = viewModel.toast {
                ToastView(message: toast)
                    .padding(.bottom, Spacing.s10)
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
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
                avatarSection
                aboutSection
                skillsSection
                contactSection
                addressSection
                socialSection
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
