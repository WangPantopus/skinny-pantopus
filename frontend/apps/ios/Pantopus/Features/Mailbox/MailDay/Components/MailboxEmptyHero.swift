//
//  MailboxEmptyHero.swift
//  Pantopus
//
//  A13.16 — Empty-state hero for the My Mail Day editor. Bespoke
//  120×96 mailbox illustration (shelf + body + flag + sparkles + mono
//  "0" face) on top, "Nothing new today" h2 below, two-line body copy,
//  a streak chip + last-scan chip row, then the `Scan today's stack`
//  primary CTA. Below the hero card, the host renders the yesterday
//  recap + setup nudges in their own cards.
//

import SwiftUI

struct MailboxEmptyHero: View {
    let streakDays: Int
    let lastScanLabel: String
    let onScan: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            heroCard
            scanCTA
        }
        .accessibilityIdentifier("mailDayEmptyHero")
    }

    private var heroCard: some View {
        VStack(spacing: Spacing.s0) {
            MailboxIllustration()
                .padding(.top, 28)
                .padding(.bottom, Spacing.s4)
            Text("Nothing new today")
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("No mail has been scanned since this morning. Drop today's stack on the scanner when you're ready.")
                .font(.system(size: 13))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s5)
                .padding(.top, 6)
            HStack(spacing: 6) {
                streakChip
                lastScanChip
            }
            .padding(.top, 14)
            .padding(.bottom, Spacing.s5)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, Spacing.s5)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .shadow(color: .black.opacity(0.04), radius: 3, x: 0, y: 1)
    }

    private var streakChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.flame, size: 11, strokeWidth: 2.4, color: Theme.Color.warmAmber)
            Text("\(streakDays)-day streak")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.1)
                .foregroundStyle(Theme.Color.warmAmber)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.warmAmberBg)
        .clipShape(Capsule())
        .accessibilityLabel("\(streakDays) day streak")
    }

    private var lastScanChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.clock, size: 11, strokeWidth: 2.4, color: Theme.Color.appTextStrong)
            Text("Last scan \(lastScanLabel)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, Spacing.s1)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
        .accessibilityLabel("Last scan \(lastScanLabel)")
    }

    private var scanCTA: some View {
        Button(action: onScan) {
            HStack(spacing: 7) {
                Icon(.scanLine, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text("Scan today's stack")
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .shadow(color: Theme.Color.primary600.opacity(0.30), radius: 12, x: 0, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Scan today's stack")
        .accessibilityIdentifier("mailDayEmptyScanCTA")
    }
}

// MARK: - Bespoke illustration (HEX_EXEMPT)

/// 120×96 mailbox illustration: lavender shelf + grey mailbox body with
/// dark slot, red flag, mono "0" face, and three amber sparkle dots.
struct MailboxIllustration: View {
    var body: some View {
        ZStack {
            // shelf
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(shelfLavender.opacity(0.7))
                .frame(width: 108, height: 8)
                .position(x: 60, y: 92)
            // mailbox body
            mailboxBody
                .frame(width: 84, height: 64)
                .position(x: 60, y: 56)
            // sparkles
            Circle()
                .fill(sparkleAmber)
                .frame(width: 4, height: 4)
                .position(x: 8, y: 12)
            Circle()
                .fill(sparkleLightAmber)
                .frame(width: 6, height: 6)
                .position(x: 110, y: 9)
            Circle()
                .fill(sparkleAmber)
                .frame(width: 3, height: 3)
                .position(x: 116, y: 30)
        }
        .frame(width: 120, height: 96)
        .accessibilityHidden(true)
    }

    private var mailboxBody: some View {
        ZStack(alignment: .topLeading) {
            // body fill
            UnevenRoundedRectangle(
                topLeadingRadius: Radii.sm,
                bottomLeadingRadius: Radii.xs,
                bottomTrailingRadius: Radii.xs,
                topTrailingRadius: Radii.sm,
                style: .continuous
            )
            .fill(
                LinearGradient(
                    colors: [bodyTop, bodyBottom],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .overlay(
                UnevenRoundedRectangle(
                    topLeadingRadius: Radii.sm,
                    bottomLeadingRadius: Radii.xs,
                    bottomTrailingRadius: Radii.xs,
                    topTrailingRadius: Radii.sm,
                    style: .continuous
                )
                .strokeBorder(bodyBorder, lineWidth: 1)
            )
            // slot
            Capsule()
                .fill(slotDark)
                .frame(width: 56, height: 4)
                .offset(x: 14, y: 14)
            // "0" face
            Text("0")
                .font(.system(size: 22, weight: .heavy, design: .monospaced))
                .tracking(-1)
                .foregroundStyle(Theme.Color.appTextMuted)
                .frame(width: 84, height: 30, alignment: .center)
                .offset(x: 0, y: 26)
            // flag
            Rectangle()
                .fill(Theme.Color.error)
                .frame(width: 14, height: 12)
                .clipShape(
                    UnevenRoundedRectangle(
                        topLeadingRadius: 0,
                        bottomLeadingRadius: 0,
                        bottomTrailingRadius: 2,
                        topTrailingRadius: 2,
                        style: .continuous
                    )
                )
                .offset(x: 84, y: 18)
                .shadow(color: .black.opacity(0.15), radius: 1, x: 0, y: 1)
        }
    }

    /// `0xF3F4F6` — `appSurfaceSunken` is the design-token equivalent of
    /// the gradient's top stop, but the gradient itself is bespoke. We
    /// keep the two stops here so the gradient stays a single literal.
    private var bodyTop: Color {
        Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
    }

    /// `0xD1D5DB` — `appBorderStrong`-adjacent. Bottom stop of the body.
    private var bodyBottom: Color {
        Color(red: 0xD1 / 255.0, green: 0xD5 / 255.0, blue: 0xDB / 255.0)
    }

    /// `0x9CA3AF` — `appTextMuted`-adjacent. Hairline border around the body.
    private var bodyBorder: Color {
        Color(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0)
    }

    /// `0x374151` — `appTextStrong`-adjacent. Dark slot.
    private var slotDark: Color {
        Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0)
    }

    /// `0xA78BFA` — lavender shelf. No token (the design's only lavender
    /// surface).
    private var shelfLavender: Color {
        Color(red: 0xA7 / 255.0, green: 0x8B / 255.0, blue: 0xFA / 255.0)
    }

    /// `0xFBBF24` — sparkle amber.
    private var sparkleAmber: Color {
        Color(red: 0xFB / 255.0, green: 0xBF / 255.0, blue: 0x24 / 255.0)
    }

    /// `0xFDE68A` — softer sparkle highlight.
    private var sparkleLightAmber: Color {
        Color(red: 0xFD / 255.0, green: 0xE6 / 255.0, blue: 0x8A / 255.0)
    }
}

// MARK: - Recap card

/// Yesterday's recap card. Header (date + pieces meta), 4-segment stacked
/// progress bar, then count chips below. Tapping "See full history" is a
/// no-op for now — the route lands later.
struct YesterdayRecapCard: View {
    let recap: YesterdayRecap
    let onSeeHistory: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            VStack(spacing: Spacing.s2) {
                HStack(alignment: .firstTextBaseline) {
                    Text(recap.dateLabel)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer()
                    Text("\(recap.pieces) pieces · \(recap.closedAtLabel)")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                stackedBar
                segmentLegend
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
            Button(action: onSeeHistory) {
                HStack {
                    Text("See full history")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                    Spacer()
                    Icon(.chevronRight, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("See full history")
            .accessibilityIdentifier("mailDayEmptyRecapSeeHistory")
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("mailDayEmptyRecap")
    }

    private var stackedBar: some View {
        GeometryReader { geo in
            HStack(spacing: Spacing.s0) {
                ForEach(recap.segments) { segment in
                    Rectangle()
                        .fill(segment.tint.color)
                        .frame(width: geo.size.width * CGFloat(segment.percent))
                }
            }
        }
        .frame(height: 8)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(Capsule())
        .accessibilityHidden(true)
    }

    private var segmentLegend: some View {
        HStack(spacing: 10) {
            ForEach(recap.segments) { segment in
                HStack(spacing: Spacing.s1) {
                    RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                        .fill(segment.tint.color)
                        .frame(width: 8, height: 8)
                    Text(segment.label)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
    }
}

// MARK: - Setup nudges

/// Stacked setup-nudge container. Two rows, hairline divider between, no
/// outer padding so it sits flush in the host's scroll body.
struct SetupNudgeStack: View {
    let nudges: [MailDaySetupNudge]
    let onTap: (MailDaySetupNudge) -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            ForEach(Array(nudges.enumerated()), id: \.element.id) { index, nudge in
                NudgeRow(
                    nudge: nudge,
                    isLast: index == nudges.count - 1
                ) {
                    onTap(nudge)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("mailDayEmptyNudges")
    }
}

private struct NudgeRow: View {
    let nudge: MailDaySetupNudge
    let isLast: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(nudge.tint.background)
                    Icon(nudge.icon, size: 16, strokeWidth: 2.2, color: nudge.tint.foreground)
                }
                .frame(width: 34, height: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(nudge.title)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(nudge.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(2)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.chevronRight, size: 15, strokeWidth: 2.2, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, Spacing.s3)
            .overlay(alignment: .bottom) {
                if !isLast {
                    Rectangle()
                        .fill(Theme.Color.appBorderSubtle)
                        .frame(height: 1)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(nudge.title). \(nudge.subtitle)")
        .accessibilityIdentifier("mailDayEmptyNudge.\(nudge.id)")
    }
}
