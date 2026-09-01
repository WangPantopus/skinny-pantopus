//
//  FeedComponents.swift
//  Pantopus
//
//  Reusable building blocks for feed surfaces (Pulse today, Gigs next).
//  Each piece is a thin SwiftUI view that consumes a small content
//  model — feature code assembles them to match the design.
//

import SwiftUI

// MARK: - Avatar

/// Solid-fill tint for a `FeedAvatar`. Each case resolves to an on-scale
/// design token — no raw hex. Authors are mapped to a tint by the feed
/// view-model (business → violet, civic → slate, else sky); sample data
/// assigns per-author tints to match the design frames.
public enum FeedAvatarTint: Sendable, Hashable, CaseIterable {
    case sky, green, violet, rose, slate, amber, orange

    var color: Color {
        switch self {
        case .sky: Theme.Color.primary500
        case .green: Theme.Color.success
        case .violet: Theme.Color.magic
        case .rose: Theme.Color.rose
        case .slate: Theme.Color.slate
        case .amber: Theme.Color.warning
        case .orange: Theme.Color.handyman
        }
    }
}

/// Feed author avatar: a solid identity-tinted disc with white initials and
/// an optional sky verified check badge pinned bottom-trailing. Unlike
/// `AvatarWithIdentityRing` (profile-completion ring), the feed card design
/// (A03) shows a flat colored disc + check disc.
public struct FeedAvatar: View {
    private let initials: String
    private let tint: FeedAvatarTint
    private let verified: Bool
    private let size: CGFloat

    public init(
        initials: String,
        tint: FeedAvatarTint = .sky,
        verified: Bool = false,
        size: CGFloat = 32
    ) {
        self.initials = initials
        self.tint = tint
        self.verified = verified
        self.size = size
    }

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Circle()
                .fill(tint.color)
                .frame(width: size, height: size)
                .overlay(
                    Text(initials)
                        .font(.system(size: size >= 32 ? 13 : 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                )
            if verified {
                VerifiedBadge(size: size * 0.4, tint: Theme.Color.primary600)
                    .offset(x: 2, y: 2)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Chip row

/// One entry in `FeedChipRow`. The `id` is the filter key sent to the
/// view-model; the `label` is the display string.
public struct FeedChipItem: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

/// Horizontal scrolling chip row used by Pulse + Gigs to filter the
/// feed in place. The active chip uses the primary fill; idle chips
/// have a thin border.
public struct FeedChipRow: View {
    private let chips: [FeedChipItem]
    private let activeId: String
    private let skeleton: Bool
    private let onSelect: @MainActor (String) -> Void

    public init(
        chips: [FeedChipItem],
        activeId: String,
        skeleton: Bool = false,
        onSelect: @escaping @MainActor (String) -> Void
    ) {
        self.chips = chips
        self.activeId = activeId
        self.skeleton = skeleton
        self.onSelect = onSelect
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                if skeleton {
                    // A03 loading frame shimmers the chip row alongside
                    // the cards — widths echo the real chip labels.
                    ForEach(Array([50, 60, 92, 64, 96, 84].enumerated()), id: \.offset) { _, width in
                        Shimmer(width: CGFloat(width), height: 28, cornerRadius: Radii.pill)
                    }
                } else {
                    chipButtons
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 1)
        }
        .accessibilityIdentifier("feedChipRow")
    }

    private var chipButtons: some View {
        Group {
            ForEach(chips) { chip in
                let active = chip.id == activeId
                Button { onSelect(chip.id) } label: {
                    Text(chip.label)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(active ? Theme.Color.appTextInverse : Theme.Color.appTextStrong)
                        .padding(.horizontal, 14)
                        .frame(height: 28)
                        .background(active ? Theme.Color.primary600 : Theme.Color.appSurface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.pill, style: .continuous)
                                .stroke(active ? .clear : Theme.Color.appBorder, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(chip.label)
                .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("feedChip_\(chip.id)")
            }
        }
    }
}

// MARK: - Compose FAB

/// Pencil FAB used by feed surfaces to start a compose flow.
public struct FeedComposeFAB: View {
    private let action: @MainActor () -> Void
    private let accessibilityLabel: String

    public init(
        accessibilityLabel: String = "Compose post",
        action: @escaping @MainActor () -> Void
    ) {
        self.accessibilityLabel = accessibilityLabel
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Icon(.pencil, size: 20, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                .frame(width: 52, height: 52)
                .background(Theme.Color.primary600)
                .clipShape(Circle())
                .shadow(color: Theme.Color.primary600.opacity(0.36), radius: 12, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier("feedComposeFAB")
    }
}

// MARK: - Skeleton card

/// Single shimmer card used by the loading frame. Optionally renders an
/// extra title-line shimmer for intents whose cards have a title
/// (Event today; Gigs uses titles too).
public struct FeedSkeletonCard: View {
    private let withTitle: Bool

    public init(withTitle: Bool = false) {
        self.withTitle = withTitle
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: 9) {
                Shimmer(width: 32, height: 32, cornerRadius: Radii.xl)
                VStack(alignment: .leading, spacing: 5) {
                    Shimmer(width: 110, height: 10, cornerRadius: Radii.xs)
                    Shimmer(width: 70, height: 8, cornerRadius: Radii.xs)
                }
                Spacer(minLength: Spacing.s2)
                Shimmer(width: 42, height: 16, cornerRadius: Radii.pill)
            }
            if withTitle {
                Shimmer(height: 11, cornerRadius: Radii.xs)
                    .frame(maxWidth: 200)
            }
            Shimmer(height: 9, cornerRadius: Radii.xs)
            Shimmer(height: 9, cornerRadius: Radii.xs)
                .frame(maxWidth: .infinity)
            HStack(spacing: 14) {
                Shimmer(width: 56, height: 10, cornerRadius: Radii.xs)
                Shimmer(width: 56, height: 10, cornerRadius: Radii.xs)
                Spacer()
                Shimmer(width: 42, height: 10, cornerRadius: Radii.xs)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityHidden(true)
    }
}
