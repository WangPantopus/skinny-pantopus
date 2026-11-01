//
//  ProfileOwnerSections.swift
//  Pantopus
//
//  The parts of your own profile neighbors don't see (the 11-01 redesign,
//  `Own.dc.html`, `OwnWhole.dc.html`): tips only you see, your month, the
//  "Your account" list and Log out. Preview as is in `ProfilePreviewViews.swift`.
//

import SwiftUI

// MARK: - Account-name line

/// "Your account name, Rowan Park-Lee, stays private." under the trust line.
@MainActor
struct ProfilePrivateNameLine: View {
    let text: String

    @ScaledMetric(relativeTo: .footnote) private var icon: CGFloat = 14

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Icon(.lock, size: icon, color: Theme.Color.appTextMuted)
                .alignmentGuide(.firstTextBaseline) { $0.height * 0.8 }
            Text(text)
                .scaledFont(13)
                .foregroundStyle(Theme.Color.appTextMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("profileOwnerPrivateName")
    }
}

// MARK: - Tips

/// A tip only you see (`Main.dc.html` owner: "Add a photo"), with ✕ to hide it
/// on this phone.
@MainActor
struct ProfileOwnerTipCard: View {
    let tip: ProfileOwnerTip
    let onOpen: @MainActor () -> Void
    let onDismiss: @MainActor () -> Void

    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .subheadline) private var disc: CGFloat = 40

    var body: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onOpen) {
                HStack(spacing: Spacing.s3) {
                    // At accessibility sizes the words need the room more than the picture.
                    if !typeSize.isAccessibilitySize {
                        Icon(tip.icon, size: disc * 0.5, color: Theme.Color.primaryInk)
                            .frame(width: disc, height: disc)
                            .background(Theme.Color.primary100)
                            .clipShape(Circle())
                    }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(tip.title)
                            .scaledFont(15, weight: .semibold)
                            .foregroundStyle(Theme.Color.appText)
                        Text(tip.detail)
                            .scaledFont(13)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, Spacing.s3)
                .padding(.leading, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint("Opens Edit profile")
            .accessibilityIdentifier("profileOwnerTip_\(tip.rawValue)")
            Button(action: onDismiss) {
                Icon(.x, size: 18, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.trailing, Spacing.s1)
            .accessibilityLabel("Hide this tip")
            .accessibilityIdentifier("profileOwnerTipHide_\(tip.rawValue)")
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .strokeBorder(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
    }
}

// MARK: - Your month

/// "Your October · 2 neighbors helped · 3 posts" with Share. Tapping it opens
/// the whole monthly receipt.
@MainActor
struct ProfileMonthCard: View {
    let title: String
    let detail: String
    let onOpen: @MainActor () -> Void
    let onShare: (@MainActor () -> Void)?

    @ScaledMetric(relativeTo: .subheadline) private var disc: CGFloat = 36

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Button(action: onOpen) {
                HStack(spacing: Spacing.s3) {
                    Icon(.handCoins, size: disc * 0.5, color: Theme.Color.home)
                        .frame(width: disc, height: disc)
                        .background(Theme.Color.homeBg)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .scaledFont(15, weight: .semibold)
                            .foregroundStyle(Theme.Color.appText)
                        Text(detail)
                            .scaledFont(13)
                            .foregroundStyle(Theme.Color.appTextMuted)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityHint("Shows your whole month")
            .accessibilityIdentifier("profileOwnerMonth")
            if let onShare {
                Button(action: onShare) {
                    Text("Share")
                        .scaledFont(15, weight: .semibold)
                        .foregroundStyle(Theme.Color.appText)
                        .padding(.horizontal, Spacing.s4)
                        .frame(minHeight: 44)
                        .overlay(Capsule().strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share \(title)")
                .accessibilityIdentifier("profileOwnerMonthShare")
            }
        }
        .padding(.vertical, Spacing.s3)
        .padding(.leading, 14)
        .padding(.trailing, Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

// MARK: - Your account

/// Where the "Your account" rows go.
public enum ProfileOwnerDestination: Hashable, Sendable {
    case myPosts
    case connections
    case supportTrains
    case savedPlaces
    case settings
    case help
    /// Debug builds only: the developer rows the Me screen listed.
    case developerTools
}

/// One row of "Your account".
struct ProfileAccountRow: Identifiable {
    enum Action {
        case open(ProfileOwnerDestination)
        case invite
    }

    let id: String
    let icon: PantopusIcon
    let title: String
    let value: String?
    let action: Action
}

/// "Your account": Connections, Support trains, Saved places, Invite
/// neighbors, Settings & privacy, Help; then Log out.
@MainActor
struct ProfileAccountSection: View {
    let rows: [ProfileAccountRow]
    let onRow: @MainActor (ProfileAccountRow.Action) -> Void
    let onLogOut: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("Your account")
                .scaledFont(20, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
                .padding(.bottom, 10)
            VStack(spacing: Spacing.s0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    Button {
                        onRow(row.action)
                    } label: {
                        rowLabel(row)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("profileAccount_\(row.id)")
                    if index < rows.count - 1 {
                        Rectangle()
                            .fill(Theme.Color.appBorder)
                            .frame(height: 1)
                            .padding(.leading, 48)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            Button(action: onLogOut) {
                HStack(spacing: Spacing.s3) {
                    Icon(.power, size: 20, color: Theme.Color.error)
                    Text("Log out")
                        .scaledFont(16, weight: .semibold)
                        .foregroundStyle(Theme.Color.error)
                    Spacer(minLength: Spacing.s0)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(minHeight: 52)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.top, Spacing.s4)
            .accessibilityIdentifier("profileLogOut")
        }
    }

    private func rowLabel(_ row: ProfileAccountRow) -> some View {
        HStack(spacing: Spacing.s3) {
            Icon(row.icon, size: 20, color: Theme.Color.appTextStrong)
            Text(row.title)
                .scaledFont(16)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let value = row.value {
                Text(value)
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, 14)
        .padding(.vertical, Spacing.s2)
        .frame(minHeight: 52)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - See all posts

/// "See all 10 posts" under your two latest.
@MainActor
struct ProfileSeeAllPostsButton: View {
    let count: Int
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: action) {
            Text(count >= 50 ? "See all posts" : "See all \(count) posts")
                .scaledFont(16, weight: .semibold)
                .foregroundStyle(Theme.Color.primaryInk)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("profileSeeAllPosts")
    }
}
