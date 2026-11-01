//
//  EditProfileView+Prompts.swift
//  Pantopus
//
//  The editor's "Prompts" and "Pinned posts" (`Edit.dc.html`): your answers,
//  each opening its answer screen, and "Add a prompt" for the picker
//  (`PromptPicker.dc.html`); your pinned posts with Unpin. Each hides until
//  the server knows prompts or pins.
//

import SwiftUI

extension EditProfileView {
    @ViewBuilder var promptsSection: some View {
        if let prompts = viewModel.prompts {
            FormFieldGroup("Prompts") {
                ForEach(prompts, id: \.key) { prompt in
                    Button { editingPrompt = prompt } label: {
                        EditProfilePromptRow(prompt: prompt)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Change or remove your answer")
                    .accessibilityIdentifier("editProfilePrompt_\(prompt.key)")
                    Divider()
                }
                if prompts.count < ProfilePromptCatalog.maxPrompts {
                    Button { showsPromptPicker = true } label: {
                        HStack(spacing: Spacing.s2) {
                            Icon(.plus, size: 16, color: Theme.Color.primaryInk)
                            Text("Add a prompt")
                                .scaledFont(16, weight: .semibold)
                                .foregroundStyle(Theme.Color.primaryInk)
                            Spacer(minLength: Spacing.s0)
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("editProfileAddPrompt")
                }
                Text(prompts.isEmpty
                    ? "Pick up to 3. A short, friendly answer works best."
                    : "\(prompts.count) of \(ProfilePromptCatalog.maxPrompts). Tap one to change it. Answers can be up to 120 characters.")
                    .scaledFont(13)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityIdentifier("editProfilePrompts")
        }
    }

    @ViewBuilder var pinnedSection: some View {
        if let pinned = viewModel.pinnedPosts {
            FormFieldGroup("Pinned posts") {
                ForEach(pinned) { post in
                    EditProfilePinnedRow(post: post) {
                        Task { await viewModel.unpin(post.id) }
                    }
                    Divider()
                }
                Text(pinned.isEmpty
                    ? "Pin a post from its ⋯ menu. You can pin up to 3."
                    : "\(pinned.count) of \(ProfilePins.maxPins). Pin a post from its ⋯ menu. You can pin up to 3.")
                    .scaledFont(13)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .accessibilityIdentifier("editProfilePinned")
        }
    }
}

/// One answer: the prompt above it, a chevron to change it.
@MainActor
private struct EditProfilePromptRow: View {
    let prompt: ProfilePrompt

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(ProfilePromptCatalog.text(for: prompt.key) ?? "")
                    .scaledFont(13, weight: .semibold)
                    .foregroundStyle(Theme.Color.appTextMuted)
                Text(prompt.answer)
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appText)
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// A pinned post: its kind's tint and icon, its first line, Unpin.
@MainActor
private struct EditProfilePinnedRow: View {
    let post: FeedPostDTO
    let onUnpin: @MainActor () -> Void

    @ScaledMetric(relativeTo: .subheadline) private var tile: CGFloat = 36

    var body: some View {
        let intent = PulseIntent.from(postType: post.postType)
        HStack(spacing: Spacing.s3) {
            Icon(intent.icon, size: min(tile, 48) * 0.5, color: intent.tint)
                .frame(width: min(tile, 48), height: min(tile, 48))
                .background(intent.tintBackground)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityHidden(true)
            Text(ProfilePinnedPost.title(post))
                .scaledFont(15)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onUnpin) {
                Text("Unpin")
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .hitArea(horizontal: 8, vertical: 12)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Unpin \(ProfilePinnedPost.title(post))")
            .accessibilityIdentifier("editProfileUnpin_\(post.id)")
        }
        .frame(minHeight: 56)
    }
}

/// The prompt picker and an answer's own screen, over the editor.
struct EditProfilePromptSheets: ViewModifier {
    let viewModel: EditProfileViewModel
    @Binding var showsPicker: Bool
    @Binding var editing: ProfilePrompt?

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $showsPicker) {
                ProfilePromptPicker(usedKeys: Set((viewModel.prompts ?? []).map(\.key))) { prompt in
                    viewModel.setPrompt(prompt)
                }
            }
            .sheet(item: $editing) { prompt in
                NavigationStack {
                    ProfilePromptAnswerView(
                        key: prompt.key,
                        initialAnswer: prompt.answer,
                        onRemove: {
                            viewModel.removePrompt(key: prompt.key)
                            editing = nil
                        },
                        onSave: { answer in
                            viewModel.setPrompt(ProfilePrompt(key: prompt.key, answer: answer))
                            editing = nil
                        }
                    )
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { editing = nil }
                        }
                    }
                }
            }
    }
}
