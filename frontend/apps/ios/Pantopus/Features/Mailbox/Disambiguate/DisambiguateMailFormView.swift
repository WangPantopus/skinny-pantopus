//
//  DisambiguateMailFormView.swift
//  Pantopus
//
//  A13.15 Disambiguate — scanned-envelope hero with an `EnvelopeOcrBox`
//  overlay, an `OcrStrip` read-out, a ranked `CandidateRow` list with match
//  badges, quick-action chips, and (in the unclear frame) a fallback card.
//  A sticky Confirm CTA owns submit.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
struct DisambiguateMailFormView: View {
    @State private var viewModel: DisambiguateMailFormViewModel
    private let onClose: @MainActor () -> Void

    init(
        mailId: String,
        ocrRecipient: String = "",
        confidence: Double = 0.0,
        envelopeImageURL: URL? = nil,
        candidates: [MailCandidate]? = nil,
        api: APIClient = .shared,
        onClose: @escaping @MainActor () -> Void
    ) {
        _viewModel = State(initialValue: DisambiguateMailFormViewModel(
            mailId: mailId,
            ocrRecipient: ocrRecipient,
            confidence: confidence,
            envelopeImageURL: envelopeImageURL,
            candidates: candidates,
            api: api
        ))
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            FormShell(
                title: "Disambiguate",
                rightActionLabel: nil, // sticky CTA owns submit
                isValid: false,
                isDirty: viewModel.isDirty, // drives discard-confirm on close
                isSaving: false,
                onClose: onClose,
                onCommit: {}
            ) {
                scannedEnvelopeSection
                candidatesSection
                if viewModel.isUnclear {
                    fallbackSection
                }
            }
            stickyConfirm
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) { toastOverlay }
        .onChange(of: viewModel.shouldDismiss) { _, dismiss in
            if dismiss {
                viewModel.acknowledgeDismiss()
                onClose()
            }
        }
    }

    // MARK: - Scanned envelope

    private var scannedEnvelopeSection: some View {
        section("Scanned envelope") {
            VStack(spacing: Spacing.s2) {
                envelopeCard
                OcrStrip(
                    tone: viewModel.ocrTone,
                    detected: viewModel.detectedText,
                    confidence: viewModel.confidencePercent,
                    sub: viewModel.ocrSubtext
                )
            }
        }
    }

    private var envelopeCard: some View {
        EnvelopeArtwork(tone: viewModel.ocrTone, boxLabel: viewModel.ocrBoxLabel)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .accessibilityLabel("Scanned envelope, OCR \(viewModel.confidencePercent) percent confidence")
    }

    // MARK: - Candidates

    private var candidatesSection: some View {
        section(viewModel.candidatesOverline) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                if !viewModel.isUnclear {
                    HStack(spacing: Spacing.s2) {
                        QuickActionChip(icon: .userCheck, label: "This is me", isPrimary: true) {
                            viewModel.selectThisIsMe()
                        }
                        .accessibilityIdentifier("disambiguateThisIsMe")
                        QuickActionChip(icon: .forward, label: "Route to…", isPrimary: false) {
                            viewModel.routeToOther()
                        }
                        .accessibilityIdentifier("disambiguateRouteTo")
                    }
                }
                ForEach(viewModel.candidates) { candidate in
                    CandidateRow(
                        candidate: candidate,
                        isSelected: viewModel.isSelected(candidate.id),
                        isSelectable: !viewModel.isUnclear
                    ) {
                        viewModel.selectCandidate(candidate.id)
                    }
                }
                if !viewModel.isUnclear {
                    addNewPersonButton
                }
            }
        }
    }

    private var addNewPersonButton: some View {
        Button {
            viewModel.toast = ToastMessage(text: "Add a new person — coming up.", kind: .success)
        } label: {
            HStack(spacing: Spacing.s1) {
                Icon(.plus, size: 13, color: Theme.Color.primary600)
                Text("None of these — add new person")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("disambiguateAddNewPerson")
    }

    // MARK: - Fallback (unclear frame)

    private var fallbackSection: some View {
        section("Or resolve another way") {
            VStack(spacing: Spacing.s0) {
                ForEach(FallbackAction.allCases) { action in
                    FallbackRow(
                        icon: icon(for: action),
                        title: action.title,
                        subtitle: action.subtitle,
                        isDestructive: action.isDestructive,
                        showsDivider: action != FallbackAction.allCases.last,
                        identifier: "disambiguateFallback_\(action.rawValue)"
                    ) {
                        viewModel.selectFallback(action)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    private func icon(for action: FallbackAction) -> PantopusIcon {
        switch action {
        case .rescan: .scanLine
        case .typeName: .keyboard
        case .returnToSender: .undo2
        case .markAsJunk: .trash2
        }
    }

    // MARK: - Sticky CTA

    private var stickyConfirm: some View {
        VStack(spacing: Spacing.s2) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            if let hint = viewModel.confirmHint {
                Text(hint)
                    .font(.system(size: 11))
                    .italic()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.s4)
            }
            PrimaryButton(
                title: "Confirm recipient",
                isLoading: viewModel.isSubmitting,
                isEnabled: viewModel.canConfirm
            ) { await viewModel.submit() }
                .padding(.horizontal, Spacing.s4)
                .padding(.bottom, Spacing.s4)
                .accessibilityIdentifier("disambiguateConfirm")
        }
        .padding(.top, Spacing.s2)
        .background(Theme.Color.appSurface)
    }

    // MARK: - Toast

    @ViewBuilder private var toastOverlay: some View {
        if let toast = viewModel.toast {
            ToastView(message: toast)
                .padding(.bottom, Spacing.s12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: toast) {
                    try? await Task.sleep(nanoseconds: 2_500_000_000)
                    viewModel.toast = nil
                }
        }
    }

    // MARK: - Section helper

    private func section(
        _ overline: String,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(overline.uppercased())
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            content()
        }
        .padding(.horizontal, Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Envelope artwork

/// Token-pure scanned-envelope artwork with an `EnvelopeOcrBox` overlay on the
/// name line. Sender / address are sample decoration (real OCR is out of
/// scope); the tone drives the box (clean = solid sky · unclear = dashed amber
/// + water-stain) and the name redaction.
private struct EnvelopeArtwork: View {
    let tone: EnvelopeOcrTone
    let boxLabel: String

    private let envelopeHeight: CGFloat = 188

    var body: some View {
        ZStack(alignment: .topLeading) {
            Theme.Color.paperCream

            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("GLOBAL BANK · RETURN SERVICE")
                    .font(.system(size: 9, design: .monospaced))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.bottom, Spacing.s2)
                Rectangle()
                    .fill(Theme.Color.appBorderStrong)
                    .frame(width: 84, height: 2)
                    .padding(.bottom, Spacing.s3)
                Text(nameLine)
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text("412 Elm St, Apt 3B")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, Spacing.s1)
                Text("Elm Park, NY 10013")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s4)

            EnvelopeOcrBox(
                rect: CGRect(x: 14, y: 50, width: 132, height: 20),
                tone: tone,
                label: boxLabel
            )
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(height: envelopeHeight)
        .overlay(alignment: .topTrailing) { postage }
    }

    private var nameLine: String {
        tone == .clean ? "Maria K." : "M___ K___"
    }

    private var postage: some View {
        VStack(spacing: Spacing.s0) {
            Text("USA")
                .font(.system(size: 7, weight: .bold, design: .monospaced))
            Text("68¢")
                .font(.system(size: 14, weight: .heavy, design: .monospaced))
            Text("FOREVER")
                .font(.system(size: 6, design: .monospaced))
        }
        .foregroundStyle(Theme.Color.appTextSecondary)
        .frame(width: 54, height: 64)
        .background(Theme.Color.appSurface.opacity(0.5))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                .stroke(Theme.Color.appBorderStrong, style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
        )
        .padding(Spacing.s3)
    }
}

#Preview("Strong match") {
    DisambiguateMailFormView(
        mailId: "m-strong",
        ocrRecipient: "Maria K. · 412 Elm St",
        confidence: 0.97,
        envelopeImageURL: nil
    ) {}
}

#Preview("Unclear scan") {
    DisambiguateMailFormView(
        mailId: "m-unclear",
        ocrRecipient: "M___ K___ · 4__ Elm St",
        confidence: 0.31,
        envelopeImageURL: nil
    ) {}
}
