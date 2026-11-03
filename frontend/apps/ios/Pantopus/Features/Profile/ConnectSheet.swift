//
//  ConnectSheet.swift
//  Pantopus
//
//  The Connect sheet (11-01 profile redesign, `Connect.dc.html`): what
//  connecting means, an optional note (up to 500 characters; the server sends
//  it as the request notification's text and keeps no copy, `POST
//  /api/relationships/requests`), Send request, and the lighter choice of just
//  following the person's public posts.
//

import SwiftUI

/// Connect with someone, or just follow their public posts.
@MainActor
struct ConnectSheet: View {
    let firstName: String
    let name: String
    let showsInitials: Bool
    let avatarURL: URL?
    let color: ProfileAvatarColor
    let isFollowing: Bool
    /// Sends the request with the note; returns what went wrong, or nil once it's sent.
    let onSend: @MainActor (String?) async -> String?
    /// Follows the person; returns what went wrong, or nil once following.
    let onFollow: @MainActor () async -> String?

    static let noteLimit = 500

    @Environment(\.dismiss) private var dismiss
    @State private var note = ""
    @State private var isWorking = false
    @State private var errorMessage: String?
    @FocusState private var noteFocused: Bool
    @ScaledMetric(relativeTo: .body) private var noteHeight: CGFloat = 96

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                HStack(spacing: Spacing.s3) {
                    ProfileAvatarDisc(name: name, showsInitials: showsInitials, imageURL: avatarURL, color: color, size: 44)
                    Text("Connect with \(firstName)?")
                        .scaledFont(22, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                }
                Text(
                    "You'll see each other's connections-only posts and can invite each other to plans. "
                        + "\(firstName) approves your request first."
                )
                .scaledFont(16)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, Spacing.s3)

                Text("Add a note (optional)")
                    .scaledFont(13, weight: .semibold)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.top, 18)
                    .padding(.bottom, 6)
                    .accessibilityHidden(true)
                noteEditor
                Text("\(note.count) / \(Self.noteLimit)")
                    .scaledFont(12)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.top, Spacing.s1)
                    .accessibilityLabel("\(note.count) of \(Self.noteLimit) characters")

                if let errorMessage {
                    Text(errorMessage)
                        .scaledFont(14)
                        .foregroundStyle(Theme.Color.error)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, Spacing.s2)
                        .accessibilityIdentifier("connectSheetError")
                }

                ProfileActionButton(title: isWorking ? "Sending…" : "Send request", icon: .userPlus)
                    .button { send() }
                    .disabled(isWorking)
                    .padding(.top, Spacing.s3)
                    .accessibilityIdentifier("connectSheetSend")

                followSection
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s6)
            .padding(.bottom, Spacing.s5)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.Color.appSurface)
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("connectSheet")
    }

    private var noteEditor: some View {
        ZStack(alignment: .topLeading) {
            TextEditor(text: $note)
                .scaledFont(16)
                .foregroundStyle(Theme.Color.appText)
                .scrollContentBackground(.hidden)
                .focused($noteFocused)
                .padding(.horizontal, 9)
                .padding(.vertical, 6)
                .frame(minHeight: noteHeight)
                .accessibilityLabel("Add a note (optional)")
                .accessibilityIdentifier("connectSheetNote")
            if note.isEmpty {
                Text("Hi \(firstName), I'm a neighbor nearby. Would love to connect!")
                    .scaledFont(16)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 14)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(
                    noteFocused ? Theme.Color.primaryInk : Theme.Color.appBorderStrong,
                    lineWidth: noteFocused ? 2 : 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .onChange(of: note) { _, newValue in
            if newValue.count > Self.noteLimit { note = String(newValue.prefix(Self.noteLimit)) }
        }
    }

    @ViewBuilder private var followSection: some View {
        HStack(spacing: 10) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            Text("or")
                .scaledFont(13)
                .foregroundStyle(Theme.Color.appTextMuted)
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .padding(.vertical, 14)
        .accessibilityHidden(true)

        if isFollowing {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                Icon(.check, size: 16, strokeWidth: 2.5, color: Theme.Color.success)
                Text("You follow \(firstName)'s public posts.")
                    .scaledFont(16, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("connectSheetFollowing")
        } else {
            ProfileActionButton(title: "Just follow \(firstName)'s public posts", icon: nil, style: .secondary)
                .button { follow() }
                .disabled(isWorking)
                .accessibilityIdentifier("connectSheetFollow")
        }
        Text("Their public posts show up in your Pulse. No request needed.")
            .scaledFont(13)
            .foregroundStyle(Theme.Color.appTextMuted)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.s2)
    }

    private func send() {
        guard !isWorking else { return }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        run { await onSend(trimmed.isEmpty ? nil : trimmed) }
    }

    private func follow() {
        guard !isWorking else { return }
        run { await onFollow() }
    }

    /// One action at a time; the sheet closes once it worked and says why it didn't otherwise.
    private func run(_ action: @escaping @MainActor () async -> String?) {
        isWorking = true
        errorMessage = nil
        noteFocused = false
        Task {
            let failure = await action()
            isWorking = false
            if let failure {
                errorMessage = failure
            } else {
                dismiss()
            }
        }
    }
}
