//
//  ReviewClaimDetailSheetComponents.swift
//  Pantopus
//
//  Bottom-sheet controls and shared flow layout for review-claim detail.
//

import SwiftUI

// MARK: - Challenge composer sheet

struct ChallengeComposerSheet: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @FocusState private var questionFocused: Bool
    @ScaledMetric(relativeTo: .body) private var editorHeight = 104.0
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
        NavigationStack {
            content.toolbar(.hidden, for: .navigationBar)
        }
    }

    private var content: some View {
        VStack(spacing: Spacing.s4) {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 38, height: 4)
                .padding(.top, Spacing.s2)

            if dynamicTypeSize.isAccessibilitySize {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s4) {
                        header
                        form
                        actions
                    }
                }
                .scrollDismissesKeyboard(.interactively)
            } else {
                header
                ScrollView(showsIndicators: false) { form }
                    .scrollDismissesKeyboard(.interactively)
                actions
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurface)
        .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.large] : [.fraction(0.78), .large])
        .presentationDragIndicator(.hidden)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { questionFocused = false }
            }
        }
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
                Text("Request more information")
                    .scaledFont(16, weight: .bold)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Save questions for this claim review.")
                    .scaledFont(11.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
    }

    private var form: some View {
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
                    .scaledFont(10.5, weight: .medium)
                    .fontDesign(.monospaced)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }

            visibilityCard
        }
        .padding(.bottom, Spacing.s2)
    }

    private var questionEditor: some View {
        TextEditor(text: $question)
            .scaledFont(13.5)
            .focused($questionFocused)
            .foregroundStyle(Theme.Color.appText)
            .scrollContentBackground(.hidden)
            .frame(minHeight: editorHeight)
            .padding(10)
            .background(Theme.Color.appSurfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityIdentifier("reviewClaimDetail_challengeQuestion")
            .accessibilityLabel("Your questions for \(claimantFirstName)")
    }

    private var visibilityCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            visibilityRow(icon: .eye, text: "Saved with the claim review")
            visibilityRow(icon: .clock, text: "The claim stays under review")
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
                .scaledFont(11.5)
                .foregroundStyle(Theme.Color.appTextStrong)
            Spacer(minLength: Spacing.s0)
        }
    }

    private var actions: some View {
        actionsLayout {
            Button(action: onBack) {
                Text("Back")
                    .scaledFont(14, weight: .semibold)
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
                    Text(isSubmitting ? "Saving…" : "Save request")
                        .scaledFont(14, weight: .semibold)
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

    private var actionsLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: Spacing.s2))
            : AnyLayout(HStackLayout(spacing: Spacing.s2))
    }

    private func fieldLabel(_ text: String, required: Bool) -> some View {
        HStack(spacing: 3) {
            Text(text)
                .scaledFont(12, weight: .semibold)
                .foregroundStyle(Theme.Color.appTextStrong)
            if required {
                Text("*")
                    .scaledFont(12, weight: .semibold)
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
                    .scaledFont(12, weight: selected ? .semibold : .medium)
                    .foregroundStyle(selected ? Theme.Color.warmAmber : Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
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
        .accessibilityAddTraits(selected ? [.isSelected] : [])
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
            let size = view.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
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
            let size = view.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @FocusState private var noteFocused: Bool
    @ScaledMetric(relativeTo: .body) private var editorHeight = 120.0
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
        NavigationStack {
            content.toolbar(.hidden, for: .navigationBar)
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                HStack {
                    Text(title)
                        .scaledFont(18, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: Spacing.s0)
                    Button(action: onCancel) {
                        Icon(.x, size: 22, color: Theme.Color.appTextSecondary)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close")
                }
                Text(prompt)
                    .scaledFont(14)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextEditor(text: $note)
                    .focused($noteFocused)
                    .frame(minHeight: editorHeight)
                    .padding(Spacing.s2)
                    .background(Theme.Color.appBg)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Theme.Color.appBorder, lineWidth: 1)
                    )
                    .accessibilityIdentifier("reviewClaimDetail_noteEditor")
                    .accessibilityLabel("\(title) note")
                    .accessibilityHint(placeholder)
                Button(role: primaryRole, action: onPrimary) {
                    HStack(spacing: Spacing.s2) {
                        if isSubmitting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Theme.Color.appTextInverse))
                        }
                        Text(isSubmitting ? "Sending…" : primaryTitle)
                            .scaledFont(15, weight: .bold)
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
                        .scaledFont(14, weight: .semibold)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
            }
            .padding(Spacing.s5)
        }
        .scrollDismissesKeyboard(.interactively)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Theme.Color.appSurface)
        .presentationDetents(dynamicTypeSize.isAccessibilitySize ? [.large] : [.medium, .large])
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { noteFocused = false }
            }
        }
    }

    private var primaryBackground: Color {
        primaryRole == .destructive ? Theme.Color.errorSolid : Theme.Color.primarySolid
    }
}
