//
//  ProfilePreviewViews.swift
//  Pantopus
//
//  Preview as, on your own profile (the 11-01 redesign, `PreviewMenu.dc.html`,
//  `PreviewAnyone.dc.html`): the audiences, the chooser, the preview's banner,
//  and what signed-out visitors get instead of posts. The server answers
//  exactly as each audience (`?as=`, owner only).
//

import SwiftUI

// MARK: - Audiences

/// Who your profile is previewed as. The server answers exactly as that
/// audience (`?as=`, owner only).
public enum ProfileAudience: String, CaseIterable, Sendable, Hashable, Identifiable {
    case anyone
    case neighbors
    case connections

    public var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .anyone: "Anyone with the link"
        case .neighbors: "Neighbors"
        case .connections: "Your connections"
        }
    }

    var detail: String {
        switch self {
        case .anyone: "People who aren't signed in, like someone you text your link to."
        case .neighbors: "People on Pantopus you aren't connected to."
        case .connections: "They also see posts you shared only with connections."
        }
    }

    var bannerTitle: String {
        switch self {
        case .anyone: "Previewing as anyone with the link"
        case .neighbors: "Previewing as a neighbor"
        case .connections: "Previewing as a connection"
        }
    }

    var bannerDetail: String {
        switch self {
        case .anyone: "What people who aren't signed in see."
        case .neighbors: "What people you aren't connected to see."
        case .connections: "What your connections see."
        }
    }

    var icon: PantopusIcon {
        switch self {
        case .anyone: .globe
        case .neighbors: .home
        case .connections: .users
        }
    }

    var tint: Color {
        switch self {
        case .anyone: Theme.Color.primaryInk
        case .neighbors: Theme.Color.home
        case .connections: Theme.Color.magic
        }
    }

    var tintBackground: Color {
        switch self {
        case .anyone: Theme.Color.primary100
        case .neighbors: Theme.Color.homeBg
        case .connections: Theme.Color.magicBg
        }
    }
}

// MARK: - Preview as

/// "Preview your profile as" (`PreviewMenu.dc.html`).
@MainActor
struct ProfilePreviewMenu: View {
    let onPick: @MainActor (ProfileAudience) -> Void

    @Environment(\.dismiss) private var dismiss
    @ScaledMetric(relativeTo: .body) private var disc: CGFloat = 40

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("Preview your profile as")
                    .scaledFont(22, weight: .bold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.horizontal, Spacing.s1)
                Text("See it exactly the way each group does.")
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, Spacing.s1)
                    .padding(.top, Spacing.s1)
                    .padding(.bottom, Spacing.s4)
                VStack(spacing: Spacing.s0) {
                    ForEach(Array(ProfileAudience.allCases.enumerated()), id: \.element.id) { index, audience in
                        Button {
                            onPick(audience)
                        } label: {
                            audienceRow(audience)
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("profilePreviewAs_\(audience.rawValue)")
                        if index < ProfileAudience.allCases.count - 1 {
                            Rectangle().fill(Theme.Color.appBorder).frame(height: 1).padding(.leading, 66)
                        }
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                Button {
                    dismiss()
                } label: {
                    Text("Cancel")
                        .scaledFont(17, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.top, 14)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s6)
            .padding(.bottom, Spacing.s5)
        }
        .background(Theme.Color.appSurface)
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("profilePreviewMenu")
    }

    private func audienceRow(_ audience: ProfileAudience) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(audience.icon, size: disc * 0.5, color: audience.tint)
                .frame(width: disc, height: disc)
                .background(audience.tintBackground)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(audience.title)
                    .scaledFont(17, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(audience.detail)
                    .scaledFont(14)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(minHeight: 76)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// "Previewing as anyone with the link" with Done, in place of the top bar.
@MainActor
struct ProfilePreviewBanner: View {
    let audience: ProfileAudience
    let onDone: @MainActor () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Icon(.eye, size: 20, color: Theme.Color.primaryInk)
            VStack(alignment: .leading, spacing: 0) {
                Text(audience.bannerTitle)
                    .scaledFont(15, weight: .semibold)
                    .foregroundStyle(Theme.Color.appText)
                Text(audience.bannerDetail)
                    .scaledFont(13)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            Button(action: onDone) {
                Text("Done")
                    .scaledFont(17, weight: .semibold)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("profilePreviewDone")
        }
        .padding(.vertical, Spacing.s2)
        .padding(.leading, 14)
        .padding(.trailing, Spacing.s1)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("profilePreviewBanner")
    }
}

/// What signed-out visitors get in place of posts: they can't read them.
@MainActor
struct ProfileSignInRequiredCard: View {
    let firstName: String

    var body: some View {
        VStack(spacing: Spacing.s0) {
            Icon(.lock, size: 22, color: Theme.Color.appTextSecondary)
                .frame(width: 48, height: 48)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(Circle())
                .accessibilityHidden(true)
            Text("Posts are for neighbors")
                .scaledFont(17, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .padding(.top, Spacing.s3)
                .accessibilityAddTraits(.isHeader)
            Text("Sign in or join Pantopus to see \(firstName)'s posts and pinned posts.")
                .scaledFont(15)
                .foregroundStyle(Theme.Color.appTextMuted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 280)
                .padding(.top, 6)
            Text("Sign in")
                .scaledFont(16, weight: .semibold)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s5)
                .frame(minHeight: 44)
                .overlay(Capsule().strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1))
                .padding(.top, Spacing.s4)
                // A preview: the visitor's button, shown, not used.
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s6)
        .padding(.horizontal, Spacing.s5)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("profileSignInRequired")
    }
}
