//
//  ReviewClaimDetailSheetComponents.swift
//  Pantopus
//
//  Bottom-sheet controls and shared flow layout for review-claim detail.
//

import SwiftUI

// MARK: - Challenge composer sheet

struct ChallengeComposerSheet: View {
    let claimantFirstName: String
    let coOwnerCount: Int
    @Binding var question: String
    let selectedReasons: Set<ChallengeReason>
    let isSubmitting: Bool
    let canSend: Bool
    let onToggleReason: (ChallengeReason) -> Void
    let onSend: () -> Void
    let onBack: () -> Void

    private let charLimit = 600

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 38, height: 4)
                .padding(.top, Spacing.s2)

            header
            scrollBody
            actions
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurface)
        .presentationDetents([.fraction(0.78)])
        .presentationDragIndicator(.hidden)
        .accessibilityIdentifier("reviewClaimDetail_challengeComposer")
    }

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(Theme.Color.warningBg)
                    .frame(width: 34, height: 34)
                    .overlay(
                        RoundedRectangle(cornerRadius: 9)
                            .stroke(Theme.Color.warningLight, lineWidth: 1)
                    )
                Icon(.messageCircle, size: 17, color: Theme.Color.warmAmber)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text("Challenge this claim")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("\(claimantFirstName) gets your questions and 14 days to respond.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var scrollBody: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    fieldLabel("Reasons (pick any)", required: false)
                    ReviewClaimFlowLayout(spacing: 6) {
                        ForEach(ChallengeReason.allCases) { reason in
                            ReasonChip(
                                label: reason.label,
                                selected: selectedReasons.contains(reason)
                            ) {
                                onToggleReason(reason)
                            }
                            .accessibilityIdentifier("reviewClaimDetail_reason_\(reason.rawValue)")
                        }
                    }
                }

                VStack(alignment: .leading, spacing: Spacing.s2) {
                    fieldLabel("Your questions for \(claimantFirstName)", required: true)
                    questionEditor
                    Text("\(question.count) / \(charLimit)")
                        .font(.system(size: 10.5, weight: .medium, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                visibilityCard
            }
            .padding(.bottom, Spacing.s2)
        }
    }

    private var questionEditor: some View {
        TextEditor(text: $question)
            .font(.system(size: 13.5))
            .foregroundStyle(Theme.Color.appText)
            .scrollContentBackground(.hidden)
            .frame(minHeight: 104)
            .padding(10)
            .background(Theme.Color.appSurfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("reviewClaimDetail_challengeQuestion")
    }

    private var visibilityCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            visibilityRow(icon: .eye, text: "Sent to claimant + \(coOwnerCount) co-owners")
            visibilityRow(icon: .clock, text: "14-day window")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private func visibilityRow(icon: PantopusIcon, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Icon(icon, size: 14, color: Theme.Color.appTextSecondary)
            Text(text)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s0)
        }
    }

    private var actions: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Text("Back")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 46)
                    .background(Theme.Color.appSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
            .disabled(isSubmitting)

            Button(action: onSend) {
                HStack(spacing: 7) {
                    if isSubmitting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Theme.Color.appTextInverse))
                    } else {
                        Icon(.send, size: 15, color: Theme.Color.appTextInverse)
                    }
                    Text(isSubmitting ? "Sending…" : "Send challenge")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: 46)
                .background(canSend ? Theme.Color.warmAmber : Theme.Color.appBorderStrong)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .shadow(color: canSend ? Theme.Color.warmAmber.opacity(0.28) : .clear, radius: 8, y: 6)
            }
            .buttonStyle(.plain)
            .disabled(!canSend || isSubmitting)
            .accessibilityIdentifier("reviewClaimDetail_sendChallenge")
        }
    }

    private func fieldLabel(_ text: String, required: Bool) -> some View {
        HStack(spacing: 3) {
            Text(text)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
            if required {
                Text("*")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.error)
            }
        }
    }
}

private struct ReasonChip: View {
    let label: String
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 5) {
                if selected {
                    Icon(.check, size: 11, strokeWidth: 3, color: Theme.Color.warmAmber)
                }
                Text(label)
                    .font(.system(size: 12, weight: selected ? .semibold : .medium))
                    .foregroundStyle(selected ? Theme.Color.warmAmber : Theme.Color.appTextStrong)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(selected ? Theme.Color.warningBg : Theme.Color.appSurface)
            .clipShape(Capsule())
            .overlay(
                Capsule().stroke(selected ? Theme.Color.warningLight : Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Flow layout

/// Left-to-right wrapping layout shared by the trust-chip row and the
/// reason-chip picker. Kept local to the feature (mirrors the per-feature
/// `*FlowLayout` convention elsewhere in the app).
struct ReviewClaimFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                totalHeight += rowHeight + spacing
                maxRowWidth = max(maxRowWidth, x - spacing)
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        totalHeight += rowHeight
        maxRowWidth = max(maxRowWidth, x - spacing)
        return CGSize(width: maxRowWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let maxWidth = proposal.width ?? bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Note capture sheet (reject reason)

struct ReviewClaimNoteCaptureSheet: View {
    let title: String
    let prompt: String
    let placeholder: String
    let primaryTitle: String
    let primaryRole: ButtonRole?
    @Binding var note: String
    let isSubmitting: Bool
    let onPrimary: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack {
                Text(title)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: Spacing.s0)
                Button(action: onCancel) {
                    Icon(.x, size: 22, color: Theme.Color.appTextSecondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            Text(prompt)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextEditor(text: $note)
                .frame(minHeight: 120)
                .padding(Spacing.s2)
                .background(Theme.Color.appBg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .accessibilityIdentifier("reviewClaimDetail_noteEditor")
            Button(role: primaryRole, action: onPrimary) {
                HStack(spacing: Spacing.s2) {
                    if isSubmitting {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: Theme.Color.appTextInverse))
                    }
                    Text(isSubmitting ? "Sending…" : primaryTitle)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .frame(minHeight: 48)
                .background(primaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
            }
            .buttonStyle(.plain)
            .disabled(isSubmitting)
            .accessibilityIdentifier("reviewClaimDetail_notePrimary")

            Button(action: onCancel) {
                Text("Cancel")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurface)
        .presentationDetents([.medium, .large])
    }

    private var primaryBackground: Color {
        primaryRole == .destructive ? Theme.Color.error : Theme.Color.primary600
    }
}
