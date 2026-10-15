//
//  PulseComposerView.swift
//  Pantopus
//
//  "New post" from the Pulse tab (Pulse S8, wireframe 2): one box, "Ask,
//  share, or make a plan…", then what Pantopus suggests, the two promises
//  and "Posting as". Cancel asks before throwing a draft away; a draft is
//  kept per account across app switches and relaunches. Same screen as
//  Android's one-box composer (PA), by copy and ids.
//

import PhotosUI
import SwiftUI

public struct PulseComposerView: View {
    @State private var model = PulseComposerModel()
    @State private var pickedPhotos: [PhotosPickerItem] = []
    @State private var showsAbout = false
    @State private var confirmsDiscard = false
    @FocusState private var textFocused: Bool
    private let onCancel: @MainActor () -> Void
    private let onPosted: @MainActor (String) -> Void

    public init(onCancel: @escaping @MainActor () -> Void, onPosted: @escaping @MainActor (String) -> Void) {
        self.onCancel = onCancel
        self.onPosted = onPosted
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    if model.showsAudienceReview {
                        Text("Your first post: here's who can read it.")
                            .pulseFont(.smallStrong)
                            .foregroundStyle(Theme.Color.info)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(Spacing.s3)
                            .background(Theme.Color.infoBg, in: RoundedRectangle(cornerRadius: Radii.md))
                            .accessibilityIdentifier("pulseComposerFirstPost")
                    }
                    textBox
                    photosRow
                    PulseComposerSuggestCard(model: model) { showsAbout = true }
                    PulseComposerTypeDetails(model: model)
                    PulseComposerPromises(model: model)
                    checkNotes
                    if let message = model.message {
                        Text(message)
                            .pulseFont(.small)
                            .foregroundStyle(Theme.Color.error)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("pulseComposerMessage")
                    }
                    PulseComposerPostingAs(name: model.firstName, label: model.postingLabel)
                }
                .padding(Spacing.s4)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .task { await model.loadAreas() }
        .onAppear { textFocused = model.draft.text.isEmpty }
        .onDisappear { model.saveNow() }
        .onChange(of: model.phase) { _, phase in
            if case let .posted(postId) = phase { onPosted(postId) }
        }
        .onChange(of: pickedPhotos) { _, items in load(items) }
        .sheet(isPresented: $showsAbout) { PulseComposerAboutSheet(model: model) }
        .confirmationDialog("Discard this post?", isPresented: $confirmsDiscard, titleVisibility: .visible) {
            Button("Discard", role: .destructive) {
                model.discard()
                onCancel()
            }
            .accessibilityIdentifier("pulseComposerDiscard")
            Button("Keep editing", role: .cancel) {}
        }
        // Asked once; the answer is stored (contract §2.10). "Not now" keeps the draft.
        .alert(model.adultSentence, isPresented: $model.asksAdultConfirmation) {
            Button("I'm 18 or older") { Task { await model.confirmAdult() } }
                .accessibilityIdentifier("pulseComposerAdultConfirm")
            Button("Not now", role: .cancel) {}
        }
        .accessibilityIdentifier("pulseComposer")
    }

    // MARK: - Pieces

    private var topBar: some View {
        HStack {
            Button("Cancel") {
                if model.draft.isBlank, model.photos.isEmpty { onCancel() } else { confirmsDiscard = true }
            }
            .pulseFont(.body)
            .frame(minHeight: 44)
            .accessibilityIdentifier("pulseComposerCancel")
            Spacer(minLength: Spacing.s2)
            Text("New post")
                .pulseFont(.headline)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Spacing.s2)
            Button {
                Task { _ = await model.post() }
            } label: {
                Text(model.phase == .posting ? "Posting…" : "Post")
                    .pulseFont(.button)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 36)
                    .background(model.canPost ? Theme.Color.primarySolid : Theme.Color.appTextMuted, in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(!model.canPost)
            .accessibilityIdentifier("pulseComposerPost")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1) }
    }

    private var textBox: some View {
        ZStack(alignment: .topLeading) {
            if model.draft.text.isEmpty {
                Text("Ask, share, or make a plan…")
                    .pulseFont(.body)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.top, 8)
                    .padding(.leading, 5)
                    .accessibilityHidden(true)
            }
            TextEditor(text: $model.draft.text)
                .pulseFont(.body)
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 120)
                .focused($textFocused)
                .accessibilityLabel("Ask, share, or make a plan")
                .accessibilityIdentifier("pulseComposerText")
        }
    }

    private var photosRow: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            if !model.photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.s2) {
                        ForEach(model.photos) { photo in thumbnail(photo) }
                    }
                }
            }
            if model.photos.count < 9 {
                PhotosPicker(selection: $pickedPhotos, maxSelectionCount: 9 - model.photos.count, matching: .images) {
                    Text("+ Photo")
                        .pulseFont(.button)
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minHeight: 44)
                }
                .accessibilityLabel("Add a photo")
                .accessibilityIdentifier("pulseComposerAddPhoto")
            }
        }
    }

    private func thumbnail(_ photo: PulseComposePhoto) -> some View {
        ZStack(alignment: .topTrailing) {
            if let image = UIImage(data: photo.data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 72, height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                    .accessibilityLabel("Photo")
            }
            Button {
                model.remove(photo: photo)
            } label: {
                Icon(.x, size: 12, color: Theme.Color.appTextInverse)
                    .frame(width: 24, height: 24)
                    .background(Theme.Color.appText.opacity(0.7), in: Circle())
            }
            .buttonStyle(.plain)
            .frame(width: 44, height: 44, alignment: .topTrailing)
            .accessibilityLabel("Remove photo")
        }
    }

    /// PS's notes (tone, national politics). They never block.
    private var checkNotes: some View {
        ForEach(Array((model.check?.suggestions ?? []).enumerated()), id: \.offset) { _, note in
            if let text = note.message, !text.isEmpty {
                Text(text)
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: Radii.md))
            }
        }
    }

    private func load(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            var loaded: [PulseComposePhoto] = []
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self) { loaded.append(PulseComposePhoto(data: data)) }
            }
            model.add(photos: loaded)
            pickedPhotos = []
        }
    }
}
