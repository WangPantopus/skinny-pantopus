//
//  CloseTrainSheet.swift
//  Pantopus
//
//  A13.13 — Manage train. The destructive close-confirmation bottom
//  sheet over the dimmed manage surface. Composition:
//    1. Red archive icon header + h3 + "9 days early" meta sub.
//    2. "What helpers will see" summary card — 3-cell summary stats
//       (18 meals · 12 neighbors · 12d coverage) + italic recipient
//       testimonial card on muted bg.
//    3. Thank-you-note textarea (66pt tall, optional).
//    4. Action row — Cancel ghost + Close & thank red destructive
//       (`flex 1.4` so the destructive CTA visually anchors the row).
//

import SwiftUI

@MainActor
public struct CloseTrainSheet: View {
    private let content: CloseTrainSheetContent
    @Binding private var thankYouNote: String
    private let onCancel: @MainActor () -> Void
    private let onConfirm: @MainActor () -> Void

    public init(
        content: CloseTrainSheetContent,
        thankYouNote: Binding<String>,
        onCancel: @escaping @MainActor () -> Void,
        onConfirm: @escaping @MainActor () -> Void
    ) {
        self.content = content
        _thankYouNote = thankYouNote
        self.onCancel = onCancel
        self.onConfirm = onConfirm
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            header
            summaryCard
            thankYouBlock
            actionRow
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .accessibilityIdentifier("manageTrainCloseSheet")
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(Theme.Color.errorBg)
                Icon(.archive, size: 17, color: Theme.Color.error)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text("Close support train?")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text(content.daysEarlyLabel)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s1)
        }
    }

    // MARK: - Summary card

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("WHAT HELPERS WILL SEE")
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s3) {
                summaryStat(content.mealsDelivered, "Meals delivered")
                summaryStat(content.neighborsHelped, "Neighbors helped")
                summaryStat(content.coverageDays, "Of coverage")
            }
            Text(content.recipientQuote)
                .font(.system(size: 12.5).italic())
                .foregroundStyle(Theme.Color.appTextStrong)
                .padding(.horizontal, Spacing.s2)
                .padding(.vertical, Spacing.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .fill(Theme.Color.appSurface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s3)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceMuted)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func summaryStat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.system(size: 17, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appText)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value)")
    }

    // MARK: - Thank-you note

    private var thankYouBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Thank-you note (optional)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurface)
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
                if thankYouNote.isEmpty {
                    Text("A few words for everyone who showed up…")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.horizontal, Spacing.s2 + 5)
                        .padding(.vertical, Spacing.s2 + 4)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $thankYouNote)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, Spacing.s2)
                    .padding(.vertical, Spacing.s2)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityIdentifier("manageTrainThankYouField")
            }
            .frame(height: 66)
        }
    }

    // MARK: - Action row

    private var actionRow: some View {
        // The design source gives the destructive CTA `flex: 1.4` while
        // Cancel sits at `flex: 1`. SwiftUI HStacks don't ship a
        // flex-ratio modifier, so a GeometryReader holds the row width
        // and the two buttons get explicit width fractions.
        GeometryReader { geo in
            let gap = Spacing.s2
            let totalFlex: CGFloat = 1 + 1.4
            let cancelWidth = (geo.size.width - gap) * (1.0 / totalFlex)
            let confirmWidth = (geo.size.width - gap) * (1.4 / totalFlex)
            HStack(spacing: gap) {
                Button(action: onCancel) {
                    Text("Cancel")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .frame(width: cancelWidth, height: 46)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .fill(Theme.Color.appSurface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                                .stroke(Theme.Color.appBorder, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("manageTrainCloseSheetCancel")
                Button(action: onConfirm) {
                    HStack(spacing: Spacing.s1) {
                        Icon(.archive, size: 15, color: Theme.Color.appTextInverse)
                        Text("Close & thank")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(width: confirmWidth, height: 46)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                            .fill(Theme.Color.error)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("manageTrainCloseSheetConfirm")
            }
        }
        .frame(height: 46)
        .padding(.top, Spacing.s2)
    }
}

#Preview("Close sheet") {
    @Previewable @State var note = ""
    return CloseTrainSheet(
        content: ManageTrainSampleData.active.close,
        thankYouNote: $note,
        onCancel: {},
        onConfirm: {}
    )
}
