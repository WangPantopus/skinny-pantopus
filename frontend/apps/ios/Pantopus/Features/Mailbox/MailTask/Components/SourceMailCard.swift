//
//  SourceMailCard.swift
//  Pantopus
//
//  A17.12 — "Pulled from this mail" card. A section overline over a
//  tappable card (orange accent strip) showing the originating mail's
//  trust + category chips, sender overline, title, snippet, and an
//  "Open original mail" footer row. The whole card taps through to the
//  source mail detail.
//

import SwiftUI

struct SourceMailCard: View {
    let source: MailTaskSourceMail
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("PULLED FROM THIS MAIL")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.leading, Spacing.s1)
            Button(action: onOpen) {
                card
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailTask_sourceMail")
            .accessibilityLabel("Pulled from this mail: \(source.title). Open original mail.")
        }
        .accessibilityElement(children: .contain)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            HStack(spacing: Spacing.s1 + 2) {
                trustChip
                categoryChip
                Spacer(minLength: Spacing.s0)
                Text(source.time)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(.bottom, 7)
            Text(source.sender.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.bottom, 2)
            Text(source.title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, Spacing.s1)
            Text(source.snippet)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
            footer
                .padding(.top, Spacing.s2 + 2)
        }
        .padding(.vertical, Spacing.s3)
        .padding(.leading, Spacing.s4 + 2)
        .padding(.trailing, Spacing.s3 + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(Theme.Color.handyman).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }

    private var footer: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            HStack(spacing: Spacing.s1 + 2) {
                Icon(.mailOpen, size: 13, color: Theme.Color.categoryTask)
                Text("Open original mail")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Color.categoryTask)
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 13, color: Theme.Color.appTextMuted)
            }
            .padding(.top, Spacing.s2 + 2)
        }
    }

    private var trustChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.shieldCheck, size: 11, color: Theme.Color.success)
            Text("Verified")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.success)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.successBg)
        .clipShape(Capsule())
    }

    private var categoryChip: some View {
        HStack(spacing: Spacing.s1) {
            Circle().fill(Theme.Color.handyman).frame(width: 6, height: 6)
            Text(source.categoryLabel)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
    }
}

#if DEBUG
#Preview {
    Group {
        if let source = MailTaskSampleData.task().source {
            SourceMailCard(source: source) {}
        }
    }
    .padding()
    .background(Theme.Color.appBg)
}
#endif
