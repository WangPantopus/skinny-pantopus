//
//  NeighborsSeeYouCard.swift
//  Pantopus
//
//  How neighbors see you, drawn in Privacy's header slot: one row with what
//  other people see (photo, name, handle) that opens Edit profile, where the
//  name and photo are edited (`NeighborsSeeYouViewModel` holds the state).
//  Test tags are mirrored on Android.
//

import SwiftUI

/// How neighbors see you, as one row at the top of Privacy: the photo, name
/// and handle other people see. Tapping it opens Edit profile, where the
/// name and photo neighbors see are edited now (the 11-01 redesign: one
/// editor for them).
struct NeighborsSeeYouCard: View {
    @Bindable var viewModel: NeighborsSeeYouViewModel
    let onEdit: @MainActor () -> Void

    var body: some View {
        if viewModel.state != .unavailable {
            Button(action: onEdit) {
                HStack(spacing: Spacing.s3) {
                    avatar
                    VStack(alignment: .leading, spacing: 2) {
                        Text("How neighbors see you")
                            .pantopusTextStyle(.body)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                        Text(subtitle)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("neighborsSeeYouName")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
                .padding(Spacing.s4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint("Opens Edit profile")
            .accessibilityIdentifier("neighborsSeeYou")
        }
    }

    /// "Rowan Park · @rowan", or what the row is about before it loads.
    private var subtitle: String {
        guard let view = viewModel.loaded else {
            return viewModel.state == .failed
                ? "Couldn't load how neighbors see you. Tap to edit."
                : "Your name and photo on your posts, comments and chats. Your account name stays private."
        }
        let handle = view.profile.handle.flatMap { MadeUpUsername.chosen($0) }.map { " · @\($0)" } ?? ""
        return "\(view.profile.displayName)\(handle)"
    }

    private var avatar: some View {
        let initial = String((viewModel.loaded?.profile.displayName ?? "").trimmingCharacters(in: .whitespaces).prefix(1)).uppercased()
        return ZStack {
            Circle().fill(Theme.Color.personalBg)
            if let url = viewModel.loaded?.profile.avatarUrl.flatMap(URL.init(string:)) {
                CachedAsyncImage(url: url) { phase in
                    if case let .success(image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        Text(initial).pantopusTextStyle(.h3).foregroundStyle(Theme.Color.personal)
                    }
                }
            } else {
                Text(initial).pantopusTextStyle(.h3).foregroundStyle(Theme.Color.personal)
            }
        }
        .frame(width: 48, height: 48)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}
