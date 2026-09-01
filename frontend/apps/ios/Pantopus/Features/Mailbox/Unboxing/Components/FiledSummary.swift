//
//  FiledSummary.swift
//  Pantopus
//
//  A17.14 filed-state chrome. `FiledSummary` stacks the success
//  `FiledBanner` ("Filed to Home › Warranties" + Undo) over the collapsed
//  `FiledShots` photo summary ("4 photos saved · Originals kept in your
//  Vault"). `ScanNextCard` is the dashed launcher at the foot of the filed
//  frame ("Scan the next item"); the screen renders the AI elf + locked
//  `OcrFactsList` between them, matching the design order.
//

import SwiftUI

// MARK: - FiledSummary (banner + photo summary)

@MainActor
struct FiledSummary: View {
    let filedTo: String
    let filedSubtitle: String
    let shots: [UnboxingShot]
    let photosSavedLabel: String
    let onUndo: () -> Void
    let onViewPhotos: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            banner
            photoSummary
        }
    }

    private var banner: some View {
        HStack(spacing: Spacing.s3) {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.success)
                .frame(width: 38, height: 38)
                .overlay(Icon(.check, size: 20, strokeWidth: 2.4, color: .white))
                .shadow(color: Theme.Color.success.opacity(0.3), radius: 6, x: 0, y: 2)
            VStack(alignment: .leading, spacing: 1) {
                Text("Filed to \(filedTo)")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                Text(filedSubtitle)
                    .font(.system(size: 11.5, weight: .regular))
                    .foregroundStyle(Theme.Color.success)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onUndo) {
                Text("Undo")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.Color.success)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, 3)
                    .background(Theme.Color.appSurface)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.Color.successLight, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("unboxing_undo")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .accessibilityIdentifier("unboxing_filedBanner")
    }

    private var photoSummary: some View {
        Button(action: onViewPhotos) {
            HStack(spacing: Spacing.s3) {
                ZStack(alignment: .leading) {
                    ForEach(Array(shots.prefix(3).enumerated()), id: \.element.id) { index, _ in
                        stackedThumb
                            .offset(x: CGFloat(index) * 28)
                    }
                }
                .frame(width: 40 + 56, height: 48, alignment: .leading)
                VStack(alignment: .leading, spacing: 1) {
                    Text(photosSavedLabel)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Originals kept in your Vault")
                        .font(.system(size: 11.5, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 3) {
                    Text("View")
                        .font(.system(size: 11.5, weight: .bold))
                    Icon(.chevronRight, size: 14, strokeWidth: 2.2, color: Theme.Color.categoryUnboxingDark)
                }
                .foregroundStyle(Theme.Color.categoryUnboxingDark)
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(photosSavedLabel). Originals kept in your Vault. View photos.")
        .accessibilityIdentifier("unboxing_filedShots")
    }

    private var stackedThumb: some View {
        ZStack {
            Color(white: 0.11)
            CaptureStripeField()
        }
        .frame(width: 40, height: 48)
        .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .stroke(Theme.Color.appSurface, lineWidth: 2)
        )
    }
}

// MARK: - ScanNextCard

@MainActor
struct ScanNextCard: View {
    let accent: Color
    let accentDark: Color
    let accentBg: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(accent)
                    .frame(width: 40, height: 40)
                    .overlay(Icon(.scanLine, size: 20, strokeWidth: 2.2, color: .white))
                    .shadow(color: accent.opacity(0.3), radius: 6, x: 0, y: 2)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Scan the next item")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(accentDark)
                    Text("Keep unboxing — capture flows back to here")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 18, strokeWidth: 2.2, color: accentDark)
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity)
            .background(accentBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                    .stroke(accent.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Scan the next item")
        .accessibilityIdentifier("unboxing_scanNext")
    }
}

/// Diagonal hairline stripes for the collapsed photo thumbnails — the
/// design's "never a hand-drawn object" placeholder fill. Mirrors the
/// `CameraScanner` stripe treatment so filed thumbs match the filmstrip.
private struct CaptureStripeField: View {
    var body: some View {
        GeometryReader { proxy in
            Path { path in
                let step: CGFloat = 7
                let total = proxy.size.width + proxy.size.height
                var x: CGFloat = -proxy.size.height
                while x < total {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x + proxy.size.height, y: proxy.size.height))
                    x += step
                }
            }
            .stroke(.white.opacity(0.07), lineWidth: 1)
        }
        .accessibilityHidden(true)
    }
}
