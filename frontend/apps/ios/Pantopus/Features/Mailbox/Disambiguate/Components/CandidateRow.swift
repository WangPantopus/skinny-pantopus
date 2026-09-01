//
//  CandidateRow.swift
//  Pantopus
//
//  A13.15 Disambiguate — one ranked recipient: radio-style selected ring,
//  44pt identity-gradient avatar (with a verified check badge), name +
//  `MatchBadge`, a role chip, the grant line, and an optional presence line.
//  In the unclear frame rows are inert "best guesses" (`isSelectable == false`).
//  Mirrors the Android `CandidateRow`.
//

import SwiftUI

/// A single candidate recipient row.
@MainActor
struct CandidateRow: View {
    let candidate: MailCandidate
    let isSelected: Bool
    /// `false` in the unclear frame — the row is shown but not tappable.
    let isSelectable: Bool
    let onTap: @MainActor () -> Void

    var body: some View {
        Group {
            if isSelectable {
                Button(
                    action: { onTap() },
                    label: { rowContent }
                )
                .buttonStyle(.plain)
            } else {
                rowContent
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelectable ? (isSelected ? [.isButton, .isSelected] : .isButton) : [])
        .accessibilityIdentifier("disambiguateCandidate_\(candidate.id)")
    }

    private var rowContent: some View {
        HStack(spacing: Spacing.s3) {
            radioMark
            avatar
            VStack(alignment: .leading, spacing: Spacing.s1) {
                HStack(spacing: Spacing.s2) {
                    Text(candidate.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    MatchBadge(tier: candidate.tier, percent: candidate.matchPercent)
                }
                HStack(spacing: Spacing.s2) {
                    roleChip
                    grantLine
                }
                if let presence = candidate.presence {
                    HStack(spacing: Spacing.s1) {
                        Icon(.circle, size: 6, color: Theme.Color.appTextMuted)
                        Text(presence)
                            .font(.system(size: 10.5))
                            .italic()
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(
                    isSelected ? Theme.Color.primary600 : Theme.Color.appBorder,
                    lineWidth: isSelected ? 1.5 : 1
                )
        )
    }

    // MARK: - Pieces

    private var radioMark: some View {
        ZStack {
            Circle()
                .stroke(
                    isSelected ? Theme.Color.primary600 : Theme.Color.appBorderStrong,
                    lineWidth: isSelected ? 6 : 2
                )
                .frame(width: 20, height: 20)
            if isSelected {
                Circle().fill(Theme.Color.appSurface).frame(width: 7, height: 7)
            }
        }
        .frame(width: 20, height: 20)
    }

    private var avatar: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: avatarGradient,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(candidate.initials)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .frame(width: 44, height: 44)
        .overlay(alignment: .bottomTrailing) {
            if candidate.verified { verifiedBadge }
        }
    }

    private var verifiedBadge: some View {
        Icon(.check, size: 9, strokeWidth: 4, color: Theme.Color.appTextInverse)
            .frame(width: 15, height: 15)
            .background(Theme.Color.home)
            .clipShape(Circle())
            .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
    }

    private var roleChip: some View {
        Text(candidate.role.title)
            .font(.system(size: 10.5, weight: .semibold))
            .foregroundStyle(roleColors.foreground)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 2)
            .background(roleColors.background)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill, style: .continuous))
    }

    private var grantLine: some View {
        HStack(spacing: Spacing.s1) {
            Icon(
                candidate.grant == .receivesMail ? .mail : .ban,
                size: 11,
                color: Theme.Color.appTextSecondary
            )
            Text(candidate.grant.label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    // MARK: - Role palette

    private var avatarGradient: [Color] {
        switch candidate.role {
        case .owner: [Theme.Color.primary500, Theme.Color.primary700]
        case .resident: [Theme.Color.home, Theme.Color.homeDark]
        case .guest: [Theme.Color.warning, Theme.Color.warmAmber]
        }
    }

    private var roleColors: (background: Color, foreground: Color) {
        switch candidate.role {
        case .owner: (Theme.Color.primary100, Theme.Color.primary700)
        case .resident: (Theme.Color.homeBg, Theme.Color.home)
        case .guest: (Theme.Color.appSurfaceSunken, Theme.Color.appTextStrong)
        }
    }

    private var accessibilityText: String {
        var parts =
            [
                candidate.name,
                candidate.role.title,
                candidate.grant.label,
                "\(candidate.tier.word) \(candidate.matchPercent) percent"
            ]
        if let presence = candidate.presence { parts.append(presence) }
        return parts.joined(separator: ", ")
    }
}

#Preview("Candidate rows") {
    let sample = DisambiguateMailFormViewModel.sampleCandidates(clear: true)
    return VStack(spacing: Spacing.s2) {
        CandidateRow(candidate: sample[0], isSelected: true, isSelectable: true) {}
        CandidateRow(candidate: sample[1], isSelected: false, isSelectable: true) {}
        CandidateRow(candidate: sample[2], isSelected: false, isSelectable: false) {}
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
