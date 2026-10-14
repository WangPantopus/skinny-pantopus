//
//  PulsePageCardView.swift
//  Pantopus
//
//  One conversation on the Pulse page (Pulse S6; build spec §3, wireframes 1
//  and 4): name, label, distance and time with the type's name on the right
//  and the "…"; the words; the photo; the place and topic; then the type's
//  one action, the reply count and the status. VoiceOver reads the card as
//  one stop, without the action; the action and the "…" are controls of
//  their own. Same layout and words as Android (`PulseConversationCard.kt`).
//

import SwiftUI

struct PulsePageCardView: View {
    let card: PulsePageCard
    let isPending: Bool
    let onOpen: () -> Void
    let onAction: () -> Void
    /// Opens the card's "…" (the page shows its entries).
    let onMenu: () -> Void
    @ScaledMetric(relativeTo: .body) private var photoHeight: CGFloat = 160

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s2) {
                summary
                menu
            }
            footer
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pulseCard_\(card.id)")
    }

    /// Everything above the action, one VoiceOver stop that opens the post.
    private var summary: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                PlanFlowLayout(spacing: Spacing.s2) {
                    Text(card.authorName)
                        .pulseFont(.button)
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let label = card.label {
                        PulseAuthorLabelChip(label: label)
                    }
                    if !card.meta.isEmpty {
                        Text(card.meta)
                            .pulseFont(.footnote)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(card.typeName)
                    .pulseFont(.overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            if !card.text.isEmpty {
                Text(card.text)
                    .pulseFont(.body)
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(6)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let url = card.photoURL {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Theme.Color.appSurfaceSunken
                }
                .frame(maxWidth: .infinity)
                .frame(height: photoHeight)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityHidden(true)
                .accessibilityIdentifier("pulseCardPhoto_\(card.id)")
            }
            if let about = card.aboutLine {
                Text(about)
                    .pulseFont(.footnote)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(card.accessibilityLabel)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(.default, onOpen)
    }

    private var menu: some View {
        Button(action: onMenu) {
            Icon(.moreHorizontal, size: 18, color: Theme.Color.appTextSecondary)
                .frame(width: 32, height: 32)
                .hitArea(horizontal: 6, vertical: 6)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Post options")
        .accessibilityIdentifier("pulseCardMenu_\(card.id)")
    }

    /// The type's one action, then the reply count, going count and status.
    private var footer: some View {
        PlanFlowLayout(spacing: Spacing.s3) {
            if let label = card.actionLabel {
                Button(action: onAction) {
                    HStack(spacing: Spacing.s1) {
                        if card.actionDone {
                            Icon(.check, size: 14, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                                .accessibilityHidden(true)
                        }
                        Text(label)
                            .pulseFont(.button)
                            .foregroundStyle(card.actionDone ? Theme.Color.appTextInverse : Theme.Color.appText)
                    }
                    .padding(.horizontal, Spacing.s4)
                    .frame(minHeight: 44)
                    .background(card.actionDone ? Theme.Color.primarySolid : Theme.Color.appSurface)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(card.actionDone ? Color.clear : Theme.Color.appBorderStrong, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(isPending)
                .accessibilityLabel(card.actionDone ? "\(label), done" : label)
                .accessibilityIdentifier("pulseCardAction_\(card.id)")
            }
            if let replies = card.repliesText {
                Text(replies)
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityHidden(true)
            }
            if let going = card.goingText {
                Text(going)
                    .pulseFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityHidden(true)
            }
            if let status = card.status {
                PulsePostStatusPill(status: status, postId: card.id)
                    .accessibilityHidden(true)
            }
        }
    }
}

/// "Resident", "New here", …: always the words, tinted by relationship
/// (the same tints as Android's label chip).
struct PulseAuthorLabelChip: View {
    let label: PulseAuthorLabel

    private var colors: (background: Color, foreground: Color) {
        switch label {
        case .resident: (Theme.Color.successBg, Theme.Color.success)
        case .newHere: (Theme.Color.personalBg, Theme.Color.personal)
        case .official: (Theme.Color.infoBg, Theme.Color.info)
        case .business: (Theme.Color.warningBg, Theme.Color.warning)
        case .pantopus: (Theme.Color.homeBg, Theme.Color.home)
        case .nearby, .visitor: (Theme.Color.appSurfaceSunken, Theme.Color.appTextSecondary)
        }
    }

    var body: some View {
        Text(label.text)
            .pulseFont(.footnoteStrong)
            .foregroundStyle(colors.foreground)
            .lineLimit(1)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(colors.background)
            .clipShape(Capsule())
    }
}
