//
//  ReviewClaimDetailComponents.swift
//  Pantopus
//
//  P7.2 (A13.3) — reshaped review-claim primitives. Larger controls live
//  in sibling files to keep each file under SwiftLint's `file_length`.
//
//    • TrustChip / ClaimSummaryTile / ClaimantCard — the claimant header
//      with a 52pt gradient avatar, a "Pending Nd" chip, the claim
//      summary tile, and a row of tone-based trust chips.
//    • EvidenceStrip — a horizontal strip of bespoke, fully-drawn
//      document previews (deed / photo / utility / signed statement).
//    • StatementBlock / VerdictBar / ChallengeComposerSheet live in
//      ReviewClaimDetailVerdictComponents.swift and
//      ReviewClaimDetailSheetComponents.swift.
//

import SwiftUI

// MARK: - Presentation models

/// Tone palette for a `TrustChip`. Drawn entirely from `Theme.Color`.
enum TrustChipTone {
    case success
    case warn
    case neutral
}

/// One trust signal rendered as a pill in the claimant card.
struct TrustChipModel: Identifiable, Hashable {
    let icon: PantopusIcon
    let label: String
    let tone: TrustChipTone
    var id: String {
        label
    }
}

/// Synthetic preview style for an evidence thumbnail.
enum EvidenceKind {
    case deed
    case photo
    case utility
    case signedStatement
}

/// One evidence thumbnail in the strip.
struct EvidenceItemModel: Identifiable, Hashable {
    let id: String
    let kind: EvidenceKind
    let title: String
    let meta: String
    let badge: String?
}

/// Everything the claimant card renders. The view maps the claim DTO into
/// this; snapshots + previews construct it directly to match the design.
struct ClaimantCardModel {
    let name: String
    let email: String?
    let gradient: GradientPair
    let pendingLabel: String?
    let shareValue: String
    let shareDescriptor: String
    let trustChips: [TrustChipModel]
}

// MARK: - Trust chip

struct TrustChip: View {
    let model: TrustChipModel

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(model.icon, size: 11, color: foreground)
            Text(model.label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(foreground)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(background)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(border, lineWidth: 1))
    }

    private var foreground: Color {
        switch model.tone {
        case .success: Theme.Color.success
        case .warn: Theme.Color.warmAmber
        case .neutral: Theme.Color.appTextSecondary
        }
    }

    private var background: Color {
        switch model.tone {
        case .success: Theme.Color.successLight
        case .warn: Theme.Color.warmAmberBg
        case .neutral: Theme.Color.appSurfaceSunken
        }
    }

    private var border: Color {
        switch model.tone {
        case .success: Theme.Color.success.opacity(0.35)
        case .warn: Theme.Color.warningLight
        case .neutral: Theme.Color.appBorder
        }
    }
}

// MARK: - Claim summary tile

struct ClaimSummaryTile: View {
    let value: String
    let descriptor: String

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm)
                    .fill(Theme.Color.primary50)
                    .frame(width: 28, height: 28)
                Icon(.keyRound, size: 14, color: Theme.Color.primary600)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("Claiming")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s1) {
                    Text(value)
                        .font(.system(size: 14, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.Color.primary700)
                    Text(descriptor)
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextStrong)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }
}

// MARK: - Pending chip

private struct PendingChip: View {
    let label: String

    var body: some View {
        HStack(spacing: 3) {
            Icon(.clock, size: 9, color: Theme.Color.warmAmber)
            Text(label.uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .foregroundStyle(Theme.Color.warmAmber)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Theme.Color.warmAmberBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
    }
}

// MARK: - Claimant card

struct ClaimantCard: View {
    let model: ClaimantCardModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(model.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                            .lineLimit(1)
                        if let pending = model.pendingLabel {
                            PendingChip(label: pending)
                        }
                    }
                    if let email = model.email, !email.isEmpty {
                        HStack(spacing: Spacing.s1) {
                            Icon(.atSign, size: 11, color: Theme.Color.appTextSecondary)
                            Text(email)
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: Spacing.s0)
            }

            ClaimSummaryTile(value: model.shareValue, descriptor: model.shareDescriptor)

            if !model.trustChips.isEmpty {
                ReviewClaimFlowLayout(spacing: 6) {
                    ForEach(model.trustChips) { chip in
                        TrustChip(model: chip)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .shadow(color: Theme.Color.appText.opacity(0.04), radius: 3, y: 1)
    }

    private var avatar: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [model.gradient.start, model.gradient.end],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 52, height: 52)
            Text(initials)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .shadow(color: model.gradient.end.opacity(0.18), radius: 5, y: 4)
    }

    private var initials: String {
        let parts = model.name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}

// MARK: - Evidence strip

struct EvidenceStrip: View {
    let items: [EvidenceItemModel]
    let extraCount: Int

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(items) { item in
                    EvidenceThumb(item: item)
                }
                if extraCount > 0 {
                    EvidenceMoreTile(count: extraCount)
                }
            }
        }
    }
}

private struct EvidenceThumb: View {
    let item: EvidenceItemModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Theme.Color.appSurfaceSunken)
                EvidencePreview(kind: item.kind)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                if let badge = item.badge {
                    Text(badge.uppercased())
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Theme.Color.appText.opacity(0.78))
                        .clipShape(RoundedRectangle(cornerRadius: 3))
                        .padding(5)
                }
            }
            .frame(width: 96, height: 128)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .shadow(color: Theme.Color.appText.opacity(0.06), radius: 2, y: 1)

            VStack(alignment: .leading, spacing: 1) {
                Text(item.title)
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(item.meta)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
            .frame(width: 96, alignment: .leading)
        }
    }
}

private struct EvidenceMoreTile: View {
    let count: Int

    var body: some View {
        VStack(spacing: Spacing.s1) {
            Icon(.plus, size: 18, color: Theme.Color.appTextSecondary)
            Text("+\(count) more")
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(width: 96, height: 128)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(style: StrokeStyle(lineWidth: 1.5, dash: [4]))
                .foregroundStyle(Theme.Color.appBorderStrong)
        )
    }
}

/// Fully-drawn synthetic document previews — no real imagery. Each kind
/// hand-draws its archetype so the strip reads as documents/photos at a
/// glance without leaking a real claimant's files into the design.
private struct EvidencePreview: View {
    let kind: EvidenceKind

    var body: some View {
        switch kind {
        case .deed: deed
        case .photo: photo
        case .utility: utility
        case .signedStatement: signedStatement
        }
    }

    /// White page with title + ruled body lines + a sky "recorded" stamp.
    private var deed: some View {
        VStack(alignment: .leading, spacing: 2.5) {
            line(width: 0.6, color: Theme.Color.appTextStrong, height: 4)
            line(width: 0.85)
            line(width: 0.78)
            line(width: 0.9)
            line(width: 0.4)
            Spacer(minLength: Spacing.s0)
            RoundedRectangle(cornerRadius: 2)
                .fill(Theme.Color.primary50)
                .frame(width: 22, height: 14)
                .overlay(
                    RoundedRectangle(cornerRadius: 2)
                        .stroke(Theme.Color.primary100, lineWidth: 1)
                )
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.Color.appSurface)
        .padding(Spacing.s2)
    }

    /// Warm fall-sunset porch: gradient sky, dark porch, cream door, sun.
    private var photo: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                LinearGradient(
                    colors: [Theme.Color.warningLight, Theme.Color.handyman, Theme.Color.warmAmber],
                    startPoint: .top,
                    endPoint: .bottom
                )
                Rectangle()
                    .fill(Theme.Color.appText)
                    .frame(width: w * 0.6, height: h * 0.32)
                    .position(x: w * 0.5, y: h * 0.82)
                Rectangle()
                    .fill(Theme.Color.paperCream)
                    .frame(width: w * 0.24, height: h * 0.2)
                    .position(x: w * 0.5, y: h * 0.83)
                Circle()
                    .fill(Theme.Color.appTextInverse)
                    .frame(width: 11, height: 11)
                    .position(x: w * 0.76, y: h * 0.2)
                    .shadow(color: Theme.Color.appTextInverse.opacity(0.7), radius: 6)
            }
        }
    }

    /// Utility bill: sky logo bar, ruled lines, a faint "shimmer" line, total.
    private var utility: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                RoundedRectangle(cornerRadius: 1)
                    .fill(Theme.Color.primary600)
                    .frame(width: 16, height: 5)
                Spacer(minLength: Spacing.s0)
                RoundedRectangle(cornerRadius: 1)
                    .fill(Theme.Color.appTextMuted)
                    .frame(width: 10, height: 3)
            }
            .padding(.bottom, 2)
            line(width: 0.7)
            line(width: 0.55)
            RoundedRectangle(cornerRadius: 1)
                .fill(Theme.Color.primary100)
                .frame(width: 38, height: 2)
            Spacer(minLength: Spacing.s0)
            Text("$184.20")
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextStrong)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(5)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.Color.appSurface)
        .padding(Spacing.s2)
    }

    /// Signed statement: ruled body + a stylised handwritten signature.
    private var signedStatement: some View {
        VStack(alignment: .leading, spacing: 2.5) {
            line(width: 0.85)
            line(width: 0.7)
            line(width: 0.9)
            line(width: 0.5)
            Spacer(minLength: Spacing.s0)
            SignatureMark()
                .stroke(Theme.Color.primary700, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                .frame(height: 16)
            Rectangle()
                .fill(Theme.Color.appBorderStrong)
                .frame(height: 1)
        }
        .padding(6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Theme.Color.appSurface)
        .padding(Spacing.s2)
    }

    private func line(width: CGFloat, color: Color = Theme.Color.appBorderStrong, height: CGFloat = 2) -> some View {
        RoundedRectangle(cornerRadius: 1)
            .fill(color)
            .frame(height: height)
            .frame(maxWidth: .infinity, alignment: .leading)
            .scaleEffect(x: width, anchor: .leading)
    }
}

/// A looping cursive-ish stroke that reads as a signature scribble.
private struct SignatureMark: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let h = rect.height
        let w = rect.width
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.8))
        path.addCurve(
            to: CGPoint(x: w * 0.32, y: h * 0.1),
            control1: CGPoint(x: w * 0.05, y: h * 0.2),
            control2: CGPoint(x: w * 0.2, y: h * 0.0)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.5, y: h * 0.9),
            control1: CGPoint(x: w * 0.42, y: h * 0.2),
            control2: CGPoint(x: w * 0.4, y: h * 0.95)
        )
        path.addCurve(
            to: CGPoint(x: w * 0.78, y: h * 0.25),
            control1: CGPoint(x: w * 0.62, y: h * 0.85),
            control2: CGPoint(x: w * 0.66, y: h * 0.1)
        )
        path.addLine(to: CGPoint(x: w * 0.95, y: h * 0.55))
        return path
    }
}
