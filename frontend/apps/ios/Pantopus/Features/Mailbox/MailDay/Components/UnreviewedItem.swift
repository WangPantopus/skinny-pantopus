//
//  UnreviewedItem.swift
//  Pantopus
//
//  A13.16 — "Needs a call" mail-day card. 56pt MailThumb + label/sender
//  + AI suggestion strip (avatar disc + name + confidence %) + Route
//  primary CTA + Other secondary chip.
//

import SwiftUI

struct UnreviewedItem: View {
    let item: UnreviewedMailDayItem
    let onRoute: () -> Void
    let onSecondary: () -> Void

    private var routeFirstName: String {
        item.suggestedName.split(separator: " ").first.map(String.init) ?? item.suggestedName
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            MailThumb(kind: item.kind, size: 56)
            VStack(alignment: .leading, spacing: Spacing.s2) {
                identity
                suggestionStrip
                actionRow
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(item.label). From \(item.sender). Suggested recipient \(item.suggestedName), \(item.confidencePercent) percent confidence."
        )
        .accessibilityIdentifier("mailDayUnreviewed.\(item.id)")
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(item.label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                NewChip()
                Spacer(minLength: Spacing.s0)
            }
            Text("From \(item.sender)")
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
    }

    private var suggestionStrip: some View {
        HStack(spacing: 6) {
            SuggestedAvatar(name: item.suggestedName, tint: item.suggestedAvatar)
            HStack(spacing: 5) {
                Text("Looks like it's for ")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextStrong) +
                    Text(item.suggestedName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("· \(item.confidencePercent)%")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Theme.Color.primary700)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 6)
        .background(Theme.Color.primary50)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private var actionRow: some View {
        HStack(spacing: 6) {
            Button(action: onRoute) {
                HStack(spacing: Spacing.s1) {
                    Icon(.check, size: 13, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                    Text("Route to \(routeFirstName)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .shadow(color: Theme.Color.primary600.opacity(0.22), radius: 6, x: 0, y: 3)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Route to \(routeFirstName)")
            .accessibilityIdentifier("mailDayUnreviewedRoute.\(item.id)")

            Button(action: onSecondary) {
                HStack(spacing: Spacing.s1) {
                    Text(item.secondaryLabel)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .lineLimit(1)
                    Icon(.chevronDown, size: 12, strokeWidth: 2.4, color: Theme.Color.appTextStrong)
                }
                .padding(.horizontal, 11)
                .frame(height: 32)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(item.secondaryLabel)
            .accessibilityIdentifier("mailDayUnreviewedOther.\(item.id)")
        }
    }
}

// MARK: - Helpers

/// 22pt initials disc. The pillar tint comes from
/// `MailDaySuggestedAvatar.background`; the initials reduce to one or two
/// letters to match the design's 9.5pt tracked-text.
private struct SuggestedAvatar: View {
    let name: String
    let tint: MailDaySuggestedAvatar

    private var initials: String {
        let parts = name.split(separator: " ")
        let firsts = parts.compactMap { $0.first.map(String.init) }
        return firsts.prefix(2).joined()
    }

    var body: some View {
        Text(initials)
            .font(.system(size: 9.5, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 22, height: 22)
            .background(tint.background)
            .clipShape(Circle())
    }
}

/// Tracked "NEW" eyebrow next to the unreviewed label.
private struct NewChip: View {
    var body: some View {
        Text("NEW")
            .font(.system(size: 9, weight: .bold))
            .tracking(0.3)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .padding(.horizontal, 5)
            .padding(.vertical, 1.5)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xs, style: .continuous))
    }
}
