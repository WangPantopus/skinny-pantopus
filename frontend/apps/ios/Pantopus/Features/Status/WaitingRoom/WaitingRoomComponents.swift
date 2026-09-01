//
//  WaitingRoomComponents.swift
//  Pantopus
//
//  Presentational sub-pieces of the A18.4 `WaitingRoomView`: the back +
//  bell top bar (`TopBarWR`), the home-pin address row with a monospace
//  claim-ref divider (`AddressRowWR`), the warning reviewer-note card, and
//  the 2-column "Manage this claim" inline-action grid (`InlineActionsWR`).
//  Split out of `WaitingRoomView.swift` to keep each file under SwiftLint's
//  length budget.
//

import SwiftUI

// MARK: - Top bar (back chevron + bell)

struct WaitingRoomTopBar: View {
    let title: String
    let onBack: @MainActor () -> Void
    let onBell: @MainActor () -> Void

    var body: some View {
        ZStack {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                Button(action: onBack) {
                    Icon(.chevronLeft, size: 20, strokeWidth: 2.2, color: Theme.Color.appText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("waitingRoomBack")
                Spacer()
                Button(action: onBell) {
                    Icon(.bell, size: 18, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Notifications")
                .accessibilityIdentifier("waitingRoomBell")
            }
        }
        .padding(.horizontal, Spacing.s2 + 2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Loading skeleton (mirrors the loaded geometry)

struct WaitingRoomLoadingFrame: View {
    var body: some View {
        VStack(spacing: Spacing.s5) {
            Shimmer(width: 96, height: 96, cornerRadius: Radii.pill)
                .padding(.top, Spacing.s2)
            Shimmer(width: 200, height: 24, cornerRadius: Radii.sm)
            Shimmer(width: 260, height: 14, cornerRadius: Radii.sm)
            Shimmer(width: 240, height: 30, cornerRadius: Radii.pill)
            Shimmer(height: 140, cornerRadius: Radii.lg)
            Spacer(minLength: Spacing.s4)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.vertical, Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("waitingRoomLoading")
    }
}

// MARK: - Notice frame (load failure / no claim / decided claim)

struct WaitingRoomNoticeFrame: View {
    let notice: WaitingRoomNotice
    let onCta: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.alertCircle, size: 32, strokeWidth: 2.2, color: Theme.Color.appTextSecondary)
            Text(notice.headline)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("waitingRoomNoticeHeadline")
            Text(notice.body)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 290)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("waitingRoomNoticeBody")
            Button(action: onCta) {
                Text(notice.ctaLabel)
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: 240)
                    .frame(height: 50)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("waitingRoomNoticeCta")
        }
        .padding(.horizontal, Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("waitingRoomNotice")
    }
}

// MARK: - Address row (home pin + mono claim ref)

struct WaitingRoomAddressRow: View {
    let address: String
    let claimRef: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.home, size: 13, strokeWidth: 2.2, color: Theme.Color.primary600)
            Text(address)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .truncationMode(.tail)
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(width: 1, height: 12)
            Text(claimRef)
                .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3 + 2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceMuted)
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(Capsule())
        .frame(maxWidth: 300)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(address). Claim reference \(claimRef).")
        .accessibilityIdentifier("waitingRoomAddress")
    }
}

// MARK: - Reviewer note card (warning, more-info state only)

struct WaitingRoomReviewerNoteCard: View {
    let note: WaitingRoomReviewerNote

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                Circle()
                    .fill(Theme.Color.appSurface)
                    .overlay(Circle().stroke(Theme.Color.warningLight, lineWidth: 1))
                    .frame(width: 26, height: 26)
                Icon(.user, size: 13, strokeWidth: 2.2, color: Theme.Color.warning)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(note.eyebrow.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundStyle(Theme.Color.warning)
                    .kerning(0.4)
                Text(note.body)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(note.eyebrow). \(note.body)")
        .accessibilityIdentifier("waitingRoomReviewerNote")
    }
}

// MARK: - Inline action grid ("Manage this claim", 2 columns)

struct WaitingRoomInlineActionGrid: View {
    let actions: [WaitingRoomInlineAction]
    let onTap: @MainActor (WaitingRoomInlineAction) -> Void

    private let columns = [
        GridItem(.flexible(), spacing: Spacing.s2),
        GridItem(.flexible(), spacing: Spacing.s2)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: Spacing.s2) {
            ForEach(actions) { action in
                Button { onTap(action) } label: { label(for: action) }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("waitingRoomAction_\(action.id)")
            }
        }
    }

    private func label(for action: WaitingRoomInlineAction) -> some View {
        let palette = WaitingRoomActionPalette.forTone(action.tone)
        return HStack(spacing: Spacing.s2 - 2) {
            Icon(action.icon, size: 14, strokeWidth: 2.2, color: palette.fg)
            Text(action.label)
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(palette.fg)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(palette.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }
}

private struct WaitingRoomActionPalette {
    let fg: Color
    let border: Color

    static func forTone(_ tone: WaitingRoomActionTone) -> WaitingRoomActionPalette {
        switch tone {
        case .standard:
            WaitingRoomActionPalette(fg: Theme.Color.appTextSecondary, border: Theme.Color.appBorder)
        case .primary:
            WaitingRoomActionPalette(fg: Theme.Color.primary700, border: Theme.Color.primary200)
        case .danger:
            WaitingRoomActionPalette(fg: Theme.Color.error, border: Theme.Color.errorLight)
        }
    }
}
