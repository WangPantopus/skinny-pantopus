//
//  PostcardVerificationView.swift
//  Pantopus
//
//  A12.7 — sibling status screen showing the physical postcard hero,
//  a horizontal 3-stage status timeline (Sent · In transit · Delivered),
//  the 6-char `CodeInput`, secondary actions (Resend / Scan code) on
//  the delivered frame, and a 3-row help block on the in-transit frame.
//
//  This screen owns its own top bar (PHeader equivalent) — the wizard
//  shell isn't used here because the design strips the step counter
//  and progress rail. See VerifyLandlordWizardView for the 1-of-3 /
//  2-of-3 chrome.
//

import SwiftUI

// swiftlint:disable file_length

@MainActor
public struct PostcardVerificationView: View {
    @State private var viewModel: PostcardVerificationViewModel
    private let onClose: @MainActor () -> Void
    private let onVerified: @MainActor (String) -> Void

    init(
        homeId: String,
        viewModel: PostcardVerificationViewModel? = nil,
        onClose: @escaping @MainActor () -> Void,
        onVerified: @escaping @MainActor (String) -> Void
    ) {
        if let viewModel {
            _viewModel = State(initialValue: viewModel)
        } else {
            _viewModel = State(initialValue: PostcardVerificationViewModel(homeId: homeId))
        }
        self.onClose = onClose
        self.onVerified = onVerified
    }

    public var body: some View {
        rootContent
            .background(Theme.Color.appBg)
            .onChange(of: viewModel.pendingEvent) { _, event in
                handle(event)
            }
            .accessibilityIdentifier("postcardVerification")
    }

    private var rootContent: some View {
        VStack(spacing: Spacing.s0) {
            PostcardTopBar { viewModel.dismissTapped() }
            scrollContent
            stickyDock
        }
    }

    private var scrollContent: some View {
        ScrollView {
            contentStack
                .padding(Spacing.s4)
                .padding(.bottom, Spacing.s10)
        }
    }

    private var contentStack: some View {
        VStack(alignment: .leading, spacing: Spacing.s5) {
            postcardPreview
            PostcardHero(
                stage: viewModel.stage,
                codeEntryMode: viewModel.showsCodeEntryFrame,
                needsNewCode: viewModel.needsNewCode,
                deliveredOn: viewModel.content.deliveredOn
            )
            PostcardStatusTimeline(
                stage: viewModel.stage,
                content: viewModel.content
            )
            PostcardCodeArea(viewModel: viewModel)
            secondaryActionBlock
        }
    }

    private var postcardPreview: some View {
        Postcard(
            recipientName: viewModel.content.recipientName,
            street: viewModel.content.street,
            cityZip: viewModel.content.cityZip,
            delivered: viewModel.stage == .delivered
        )
        .frame(maxWidth: .infinity, alignment: .center)
    }

    @ViewBuilder
    private var secondaryActionBlock: some View {
        if viewModel.showsCodeEntryFrame {
            DeliveredSecondaryRow { viewModel.requestNewCode() }
        } else {
            VStack(spacing: Spacing.s3) {
                InTransitHelpBlock { viewModel.requestNewCode() }
                Button {
                    viewModel.markHasCode()
                } label: {
                    Text("I already have a code")
                        .pantopusTextStyle(.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Theme.Color.primary600)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .accessibilityIdentifier("postcardHaveCodeCTA")
            }
        }
    }

    private var stickyDock: some View {
        VStack(spacing: Spacing.s2) {
            if !viewModel.showsCodeEntryFrame, !viewModel.needsNewCode {
                HStack(spacing: Spacing.s1) {
                    Icon(.bell, size: 12, color: Theme.Color.appTextSecondary)
                    Text("You'll be notified the moment it's delivered")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            PrimaryButton(
                title: viewModel.primaryCTALabel,
                isLoading: viewModel.isSubmitting,
                isEnabled: viewModel.primaryCTAEnabled
            ) {
                await MainActor.run { viewModel.verifyTapped() }
            }
            .accessibilityIdentifier("postcardVerifyCTA")

            if viewModel.needsNewCode {
                Button {
                    viewModel.requestNewCode()
                } label: {
                    Text("Request a new code")
                        .pantopusTextStyle(.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Theme.Color.primary600)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(viewModel.isRequestingCode)
                .accessibilityIdentifier("postcardRequestNewCodeCTA")
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s6)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    private func handle(_ event: PostcardVerificationOutboundEvent?) {
        guard let event else { return }
        switch event {
        case .dismiss:
            onClose()
        case let .verified(homeId):
            onVerified(homeId)
        }
        viewModel.acknowledgePendingEvent()
    }
}

// MARK: - Top bar

private struct PostcardTopBar: View {
    let onBack: () -> Void

    var body: some View {
        ZStack {
            Text("Postcard verification")
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            HStack {
                Button(action: onBack) {
                    Icon(.arrowLeft, size: 22, color: Theme.Color.appText)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Back")
                .accessibilityIdentifier("postcardBackButton")
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            .padding(.horizontal, Spacing.s2)
        }
        .frame(height: 44)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}

// MARK: - Hero

private struct PostcardHero: View {
    let stage: PostcardDeliveryStage
    /// True once the user is holding the card — swaps the headline to
    /// the enter-your-code copy even while the timeline still reads
    /// "in transit".
    let codeEntryMode: Bool
    /// True when the backend retired the pending code (expired / too
    /// many attempts / none pending) and the only way forward is a
    /// fresh mailing.
    let needsNewCode: Bool
    let deliveredOn: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        VStack(spacing: Spacing.s3) {
            chip
            Text(headline)
                .pantopusTextStyle(.h2)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(subcopy)
                .pantopusTextStyle(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: 280)
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    @ViewBuilder
    private var chip: some View {
        switch stage {
        case .delivered:
            HStack(spacing: 5) {
                Icon(.checkCircle, size: 11, color: Theme.Color.success)
                Text("DELIVERED \(deliveredOn?.uppercased() ?? "")")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.success)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(Theme.Color.successBg)
            .clipShape(Capsule())
        case .mailed, .inTransit:
            HStack(spacing: 5) {
                Circle()
                    .fill(Theme.Color.warning)
                    .frame(width: 6, height: 6)
                    .scaleEffect(pulse && !reduceMotion ? 1.6 : 1)
                    .opacity(pulse && !reduceMotion ? 0.6 : 1)
                    .animation(
                        .easeInOut(duration: 1.6).repeatForever(autoreverses: true),
                        value: pulse
                    )
                Text("IN TRANSIT")
                    .pantopusTextStyle(.overline)
                    .foregroundStyle(Theme.Color.warning)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(Theme.Color.warningBg)
            .clipShape(Capsule())
            .onAppear { if !reduceMotion { pulse = true } }
        }
    }

    private var headline: String {
        if needsNewCode { return "Request a new code" }
        return codeEntryMode ? "Enter the code from the card" : "Your card is on the way"
    }

    private var subcopy: String {
        if needsNewCode {
            return "That code is no longer valid. We'll mail a fresh one to this address."
        }
        return codeEntryMode
            ? "6 characters, printed on the left side. Case doesn't matter."
            : "We'll push you a notification when it lands — or enter the code now if you already have it."
    }
}

// MARK: - Status timeline (horizontal, 3-stage)

/// Horizontal 3-stage timeline used by A12.7. Built inline because the
/// existing `TimelineStepper` is vertical and doesn't carry the
/// per-stage date pill or the dashed-amber connector for the current
/// in-transit state.
private struct PostcardStatusTimeline: View {
    let stage: PostcardDeliveryStage
    let content: PostcardVerificationContent

    var body: some View {
        VStack(spacing: Spacing.s3) {
            trackingHeader
            PostcardStageTrack(
                currentIndex: currentIndex,
                mailedOn: content.mailedOn,
                inTransitOn: content.inTransitOn,
                deliveredOn: content.deliveredOn
            )
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityIdentifier("postcardStatusTimeline")
    }

    private var trackingHeader: some View {
        HStack {
            Text("USPS TRACKING")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Spacer()
            Text(content.trackingNumber)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    private var currentIndex: Int {
        switch stage {
        case .mailed: 0
        case .inTransit: 1
        case .delivered: 2
        }
    }

    private var accessibilityLabelText: String {
        "Postcard tracking. " +
            "Mailed \(content.mailedOn). " +
            (content.inTransitOn.map { "In transit \($0). " } ?? "") +
            (content.deliveredOn.map { "Delivered \($0)." } ?? "Not yet delivered.")
    }
}

private struct PostcardStageTrack: View {
    let currentIndex: Int
    let mailedOn: String
    let inTransitOn: String?
    let deliveredOn: String?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.s0) {
            PostcardStageColumn(
                stageIndex: 0,
                currentIndex: currentIndex,
                label: "Mailed",
                date: mailedOn,
                icon: .send
            )
            PostcardTimelineConnector(stageIndex: 0, currentIndex: currentIndex)
            PostcardStageColumn(
                stageIndex: 1,
                currentIndex: currentIndex,
                label: "In transit",
                date: inTransitOn,
                icon: .send
            )
            PostcardTimelineConnector(stageIndex: 1, currentIndex: currentIndex)
            PostcardStageColumn(
                stageIndex: 2,
                currentIndex: currentIndex,
                label: "Delivered",
                date: deliveredOn,
                icon: .mailbox
            )
        }
    }
}

private struct PostcardStageColumn: View {
    let stageIndex: Int
    let currentIndex: Int
    let label: String
    let date: String?
    let icon: PantopusIcon

    var body: some View {
        VStack(spacing: Spacing.s2) {
            iconCircle
            labelStack
        }
        .frame(maxWidth: .infinity)
    }

    private var iconCircle: some View {
        ZStack {
            Circle()
                .fill(circleFill)
                .frame(width: 36, height: 36)
            currentRing
            Icon(
                icon,
                size: 16,
                strokeWidth: 2,
                color: iconColor
            )
        }
    }

    @ViewBuilder
    private var currentRing: some View {
        if isCurrent && currentIndex < 2 {
            Circle()
                .stroke(Theme.Color.warning, lineWidth: 2)
                .frame(width: 42, height: 42)
        }
    }

    private var labelStack: some View {
        VStack(spacing: 1) {
            Text(label)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(isComplete ? Theme.Color.appText : Theme.Color.appTextMuted)
            Text(date ?? "—")
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(isComplete ? Theme.Color.appTextSecondary : Theme.Color.appTextMuted)
        }
    }

    private var isDone: Bool {
        stageIndex < currentIndex
    }

    private var isCurrent: Bool {
        stageIndex == currentIndex
    }

    private var isComplete: Bool {
        isDone || (isCurrent && currentIndex == 2)
    }

    private var circleFill: Color {
        if isComplete && !isCurrent { return Theme.Color.success }
        if isCurrent && currentIndex < 2 { return Theme.Color.warning }
        if isCurrent && currentIndex == 2 { return Theme.Color.success }
        return Theme.Color.appSurfaceSunken
    }

    private var iconColor: Color {
        isComplete ? Theme.Color.appTextInverse : Theme.Color.appTextMuted
    }
}

private struct PostcardTimelineConnector: View {
    let stageIndex: Int
    let currentIndex: Int

    var body: some View {
        ZStack(alignment: .center) {
            Rectangle()
                .fill(Theme.Color.appSurfaceSunken)
                .frame(height: 2)
            if isDone {
                Rectangle()
                    .fill(Theme.Color.success)
                    .frame(height: 2)
            }
            if isCurrent {
                DashedAmberConnector()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 17)
    }

    private var isDone: Bool {
        stageIndex < currentIndex
    }

    private var isCurrent: Bool {
        stageIndex == currentIndex && currentIndex < 2
    }
}

/// 2pt high dashed amber overlay used for the "in transit" connector.
/// Implemented as a `Path` so we can match the design's chunky 6pt
/// stroke without relying on a `Rectangle().strokeBorder(dash:)`,
/// which can't render a horizontal dashed line inside a row layout
/// cleanly.
private struct DashedAmberConnector: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var slide = false

    var body: some View {
        GeometryReader { proxy in
            Path { path in
                path.move(to: CGPoint(x: 0, y: 1))
                path.addLine(to: CGPoint(x: proxy.size.width, y: 1))
            }
            .stroke(
                Theme.Color.warning.opacity(0.55),
                style: StrokeStyle(lineWidth: 2, dash: [6, 6], dashPhase: slide ? -12 : 0)
            )
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: false)) {
                    slide = true
                }
            }
        }
        .frame(height: 2)
    }
}

// MARK: - Code area

private struct PostcardCodeArea: View {
    @Bindable var viewModel: PostcardVerificationViewModel

    var body: some View {
        VStack(spacing: Spacing.s3) {
            CodeInput(
                value: Binding(
                    get: { viewModel.codeInput },
                    set: { viewModel.updateCode($0) }
                ),
                isDisabled: !viewModel.isCodeInputUnlocked,
                identifier: "postcardCodeInput"
            )
            if case let .error(message) = viewModel.submitState {
                Text(message)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("postcardSubmitError")
            }
            if let attempts = viewModel.attemptsRemainingLabel {
                Text(attempts)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.error)
                    .accessibilityIdentifier("postcardAttemptsRemaining")
            }
            if let expiry = viewModel.codeExpiryLabel {
                Text(expiry)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .accessibilityIdentifier("postcardCodeExpiry")
            }
            if let notice = viewModel.notice {
                Text(notice.text)
                    .pantopusTextStyle(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(notice.isError ? Theme.Color.error : Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("postcardNotice")
            }
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Secondary action rows

private struct DeliveredSecondaryRow: View {
    let onResend: () -> Void

    var body: some View {
        HStack(spacing: Spacing.s4) {
            Button(action: onResend) {
                HStack(spacing: Spacing.s1) {
                    Icon(.refreshCw, size: 12, color: Theme.Color.appTextSecondary)
                    Text("Resend")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, Spacing.s1)
                .padding(.vertical, Spacing.s1)
            }
            .accessibilityIdentifier("postcardResendCTA")
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(width: 1, height: 12)
            Button(action: {}, label: {
                HStack(spacing: Spacing.s1) {
                    Icon(.camera, size: 12, color: Theme.Color.appTextSecondary)
                    Text("Scan code")
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(.horizontal, Spacing.s1)
                .padding(.vertical, Spacing.s1)
            })
            .accessibilityIdentifier("postcardScanCTA")
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }
}

private struct InTransitHelpBlock: View {
    let onResend: () -> Void

    var body: some View {
        VStack(spacing: Spacing.s0) {
            HelpRow(
                icon: .refreshCw,
                title: "Resend postcard",
                subcopy: "Mails a fresh code to this address.",
                disabled: false,
                onTap: onResend,
                identifier: "postcardResendCTA"
            )
            Divider().background(Theme.Color.appBorder)
            HelpRow(
                icon: .edit2,
                title: "Wrong address?",
                subcopy: "Update before next print run.",
                disabled: false,
                onTap: {},
                identifier: "postcardWrongAddress"
            )
            Divider().background(Theme.Color.appBorder)
            HelpRow(
                icon: .globe,
                title: "Try email instead",
                subcopy: "Available in some regions.",
                disabled: false,
                onTap: {},
                identifier: "postcardEmailFallback"
            )
        }
        .padding(Spacing.s1)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        }
        .accessibilityIdentifier("postcardHelpBlock")
    }
}

private struct HelpRow: View {
    let icon: PantopusIcon
    let title: String
    let subcopy: String
    var trailingMeta: String?
    let disabled: Bool
    let onTap: () -> Void
    let identifier: String

    var body: some View {
        Button(action: { if !disabled { onTap() } }, label: {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .fill(Theme.Color.appSurfaceSunken)
                    .frame(width: 32, height: 32)
                    .overlay {
                        Icon(icon, size: 14, color: Theme.Color.appTextStrong)
                    }
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: Spacing.s1) {
                        Text(title)
                            .pantopusTextStyle(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.Color.appText)
                        if let trailingMeta {
                            Text("· \(trailingMeta)")
                                .pantopusTextStyle(.caption)
                                .foregroundStyle(Theme.Color.appTextMuted)
                        }
                    }
                    Text(subcopy)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
            .padding(Spacing.s3)
            .opacity(disabled ? 0.5 : 1)
        })
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityIdentifier(identifier)
    }
}

#Preview("Postcard — in transit") {
    PostcardVerificationView(
        homeId: "home-in-transit",
        onClose: {},
        onVerified: { _ in }
    )
}

#Preview("Postcard — delivered") {
    let vm = PostcardVerificationViewModel(
        homeId: "home-delivered",
        stage: .delivered
    )
    vm.updateCode("4Q2K7B")
    return PostcardVerificationView(
        homeId: "home-delivered",
        viewModel: vm,
        onClose: {},
        onVerified: { _ in }
    )
}
