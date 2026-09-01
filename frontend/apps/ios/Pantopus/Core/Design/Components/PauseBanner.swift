//
//  PauseBanner.swift
//  Pantopus
//
//  A14.5 Notifications — the warm-amber banner that replaces the Master
//  card while notifications are paused. A `bell-off` icon disc + a
//  countdown headline + a reassurance subline + a neutral "Resume" pill.
//  Driven by primitive params (no feature-model coupling) so the shared
//  `GroupedListView` can render it from a `GroupedListBanner`.
//

import SwiftUI

@MainActor
public struct PauseBanner: View {
    private let icon: PantopusIcon
    private let title: String
    private let subtitle: String?
    private let actionLabel: String
    private let onAction: (@MainActor () -> Void)?

    public init(
        icon: PantopusIcon,
        title: String,
        subtitle: String? = nil,
        actionLabel: String,
        onAction: (@MainActor () -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.subtitle = subtitle
        self.actionLabel = actionLabel
        self.onAction = onAction
    }

    public var body: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(Theme.Color.warningLight)
                    .frame(width: 32, height: 32)
                Icon(icon, size: 16, color: Theme.Color.warning)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.warning)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.warning)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: Spacing.s2)

            Button { onAction?() } label: {
                Text(actionLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 5)
                    .background(Theme.Color.appSurface)
                    .overlay(Capsule().stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("pauseBannerAction")
            .accessibilityLabel(actionLabel)
            .accessibilityAddTraits(.isButton)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pauseBanner")
    }
}

#Preview("Pause banner") {
    PauseBanner(
        icon: .bellOff,
        title: "Paused for 2 hours",
        subtitle: "Resumes 11:42 AM · Emergency alerts still come through",
        actionLabel: "Resume"
    )
    .padding(Spacing.s3)
    .background(Theme.Color.appBg)
}
