//
//  CeremonialMailOpenView.swift
//  Pantopus
//
//  T6.5d (P22) — Refreshed Ceremonial Mail Open. Four frames matching
//  `ceremonial-mail-frames.jsx`:
//
//    Frame 1 (.sealed)   — Porch arrival. Warm radial-gradient porch
//                          background, closed envelope sitting on the
//                          mat, gentle pulsing glow, "Open envelope" CTA.
//    Frame 2 (.breaking) — Mid-state. Envelope flap lifted, paper
//                          peeking up, progress dots "breaking the seal".
//                          Auto-advances to .open after ≤ 750ms.
//    Frame 3 (.open)     — Reading. Paper-bg letter body with sender +
//                          postmark, salutation, paragraphs, signature,
//                          optional voice postscript, sticky Reply /
//                          Save / Archive bottom bar.
//    Frame 4 (.replying) — Reply compose handoff. Recedes the letter
//                          to a quoted preview at the top, fades up the
//                          compose surface (paper / ink pickers + text
//                          area + send toolbar), then hands off to A25
//                          via `onWriteBack`.
//
//  Animation budget: total time from .sealed → .open ≤ 2 seconds.
//  Reduce-motion + "Skip animation" button both jump straight to
//  .open with no intermediate transitions.
//

// swiftlint:disable file_length type_body_length multiple_closures_with_trailing_closure

import SwiftUI

public struct CeremonialMailOpenView: View {
    @State private var viewModel: CeremonialMailOpenViewModel
    @State private var paperOffset: CGFloat = 24
    @State private var paperOpacity: Double = 0
    @State private var envelopeScale: Double = 1
    @State private var envelopeLift: CGFloat = 0
    @State private var glowPulse: Double = 0.85
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let onBack: @MainActor () -> Void
    private let onWriteBack: @MainActor (String) -> Void
    private let onOutcome: @MainActor (CeremonialOutcomeCTA) -> Void

    public init(
        viewModel: CeremonialMailOpenViewModel,
        onBack: @escaping @MainActor () -> Void = {},
        onWriteBack: @escaping @MainActor (String) -> Void = { _ in },
        onOutcome: @escaping @MainActor (CeremonialOutcomeCTA) -> Void = { _ in }
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
        self.onWriteBack = onWriteBack
        self.onOutcome = onOutcome
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingFrame
            case let .error(message):
                errorFrame(message: message)
            case let .loaded(letter, phase):
                framedContent(letter: letter, phase: phase)
                    .onChange(of: phase) { _, new in animateForPhase(new) }
                    .onAppear { animateForPhase(phase) }
            }
        }
        .background(Theme.Color.appBg.ignoresSafeArea())
        .task { await viewModel.load() }
        .accessibilityIdentifier("ceremonialMailOpen")
    }

    // MARK: - Loading / error

    private var loadingFrame: some View {
        VStack(spacing: Spacing.s0) {
            generalTopBar
            VStack(spacing: Spacing.s3) {
                Shimmer(height: 220, cornerRadius: 18)
                Shimmer(height: 180, cornerRadius: 18)
                Shimmer(height: 56, cornerRadius: 14)
            }
            .padding(Spacing.s4)
            Spacer()
        }
        .accessibilityIdentifier("ceremonialMailOpenLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s0) {
            generalTopBar
            EmptyState(
                icon: .alertCircle,
                headline: "Couldn't open this letter",
                subcopy: message,
                cta: EmptyState.CTA(title: "Try again") {
                    await viewModel.load()
                }
            )
            .accessibilityIdentifier("ceremonialMailOpenRetry")
        }
        .accessibilityIdentifier("ceremonialMailOpenError")
    }

    private var generalTopBar: some View {
        HStack {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("ceremonialMailOpenBackButton")
            Spacer()
            Text("Letter")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Color.clear.frame(width: 36, height: 36)
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: - Frame dispatch

    @ViewBuilder
    private func framedContent(
        letter: CeremonialMailLetter,
        phase: CeremonialMailPhase
    ) -> some View {
        switch phase {
        case .sealed, .breaking:
            PorchFrame(
                letter: letter,
                phase: phase,
                glowOpacity: glowPulse,
                envelopeScale: envelopeScale,
                envelopeLift: envelopeLift,
                onTapOpen: {
                    Task { await viewModel.startBreakingSeal(skipAnimation: reduceMotion) }
                },
                onSkipAnimation: { viewModel.openImmediately() },
                onClose: { onBack() }
            )
            .accessibilityIdentifier("ceremonialMail_frame_\(phase.rawValue)")
        case .open:
            ReadingFrame(
                letter: letter,
                opacity: paperOpacity,
                slideOffset: paperOffset,
                isVoicePlaying: viewModel.isVoicePlaying,
                onToggleVoice: { viewModel.toggleVoicePlayback() },
                onReply: {
                    viewModel.enterReplying()
                    onWriteBack(letter.sender.displayName)
                },
                onClose: { onBack() },
                onSave: {
                    onOutcome(
                        CeremonialOutcomeCTA(
                            id: "save",
                            label: "Save to records",
                            icon: .check,
                            style: .ghost
                        )
                    )
                },
                onArchive: {
                    onOutcome(
                        CeremonialOutcomeCTA(
                            id: "archive",
                            label: "Archive",
                            icon: .archive,
                            style: .ghost
                        )
                    )
                }
            )
            .accessibilityIdentifier("ceremonialMail_frame_open")
        case .replying:
            ReplyHandoffFrame(
                letter: letter,
                onBack: { viewModel.resetToOpen() },
                onContinue: { onWriteBack(letter.sender.displayName) }
            )
            .accessibilityIdentifier("ceremonialMail_frame_replying")
        }
    }

    // MARK: - Animation orchestration

    /// Drive the per-phase animations. Total user-facing time from
    /// `.sealed → .open` is ≤ 2 seconds: envelope lift 300 ms +
    /// flap rotate 450 ms (inside .breaking) + paper slide 300 ms.
    /// When reduce-motion is on we collapse to instant value
    /// assignments.
    private func animateForPhase(_ phase: CeremonialMailPhase) {
        guard !reduceMotion else {
            paperOpacity = phase == .open || phase == .replying ? 1 : 0
            paperOffset = phase == .open || phase == .replying ? 0 : 24
            envelopeScale = phase == .breaking ? 0.96 : 1
            envelopeLift = phase == .breaking ? -6 : 0
            glowPulse = 0.85
            return
        }
        switch phase {
        case .sealed:
            paperOpacity = 0
            paperOffset = 24
            envelopeScale = 1
            envelopeLift = 0
            withAnimation(
                .easeInOut(duration: 1.2).repeatForever(autoreverses: true)
            ) {
                glowPulse = 1.0
            }
        case .breaking:
            withAnimation(.easeOut(duration: 0.30)) {
                envelopeLift = -6
                envelopeScale = 1.04
            }
        case .open, .replying:
            withAnimation(.easeOut(duration: 0.30).delay(0.05)) {
                paperOpacity = 1
                paperOffset = 0
            }
            envelopeScale = 1
            envelopeLift = 0
            glowPulse = 0.85
        }
    }
}

// MARK: - Frame 1 + 2: porch arrival / opening

private struct PorchFrame: View {
    let letter: CeremonialMailLetter
    let phase: CeremonialMailPhase
    let glowOpacity: Double
    let envelopeScale: Double
    let envelopeLift: CGFloat
    let onTapOpen: @MainActor () -> Void
    let onSkipAnimation: @MainActor () -> Void
    let onClose: @MainActor () -> Void

    var body: some View {
        ZStack {
            // Porch background — radial sweep top + bottom + vignette
            ZStack {
                LinearGradient(
                    colors: [letter.stationery.porchTopColor, letter.stationery.porchBottomColor],
                    startPoint: .top,
                    endPoint: .bottom
                )
                Color.black.opacity(0.18)
                    .blendMode(.multiply)
            }
            .ignoresSafeArea()

            VStack(spacing: Spacing.s0) {
                topChrome
                Spacer()
                eyebrow
                titleStack
                envelopeHero
                senderStamp
                Spacer()
                openCTA
                skipAffordance
                pantopusFooter
                    .padding(.top, 14)
                    .padding(.bottom, Spacing.s3)
            }
            .padding(.horizontal, Spacing.s6)
        }
        .foregroundColor(Color.white.opacity(0.92))
    }

    private var topChrome: some View {
        HStack {
            Spacer()
            Button(action: onClose) {
                Icon(.x, size: 18, color: Color.white.opacity(0.85))
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.18))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("ceremonialMail_close")
        }
        .padding(.top, Spacing.s4)
    }

    private var eyebrow: some View {
        Text(phase == .sealed ? "FROM \(letter.sender.displayName.uppercased())" : "OPENING…")
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.6)
            .foregroundStyle(Color.white.opacity(0.85))
            .padding(.bottom, Spacing.s1)
    }

    private var titleStack: some View {
        Text("A letter has\narrived for you")
            .font(.system(size: 28, weight: .medium, design: .serif))
            .multilineTextAlignment(.center)
            .foregroundStyle(Color.white.opacity(phase == .sealed ? 1.0 : 0.6))
            .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
            .padding(.bottom, Spacing.s8)
    }

    private var envelopeHero: some View {
        ZStack {
            // Pulsing glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Color(red: 1, green: 0.89, blue: 0.63).opacity(0.55 * glowOpacity),
                            Color(red: 1, green: 0.69, blue: 0.42).opacity(0.18 * glowOpacity),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 30,
                        endRadius: 180
                    )
                )
                .frame(width: 320, height: 220)
                .blur(radius: 12)
            envelope
                .scaleEffect(envelopeScale)
                .offset(y: envelopeLift)
                .shadow(color: Color.black.opacity(0.42), radius: 22, y: 16)
        }
        .padding(.bottom, 22)
        .contentShape(Rectangle())
        .onTapGesture { onTapOpen() }
        .accessibilityIdentifier("ceremonialMail_envelope_tap")
        .accessibilityHint(phase == .sealed
            ? "Double-tap to open the letter."
            : "Opening in progress.")
    }

    private var envelope: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [letter.stationery.paperColor, letter.stationery.paperEdgeColor],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(width: 240, height: 158)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Color.black.opacity(0.22), lineWidth: 1)
                )
            // Flap triangle (closed: pointing down)
            Triangle()
                .fill(letter.stationery.paperEdgeColor)
                .frame(width: 240, height: phase == .sealed ? 80 : 30)
                .offset(y: phase == .sealed ? -78 : -8)
                .opacity(phase == .sealed ? 1 : 0)
                .animation(.easeOut(duration: 0.45), value: phase)
            // Wax seal medallion (centered on the closed flap fold)
            sealMedallion
                .offset(y: phase == .sealed ? -55 : -82)
                .scaleEffect(phase == .sealed ? 1 : 0.7)
                .opacity(phase == .sealed ? 1 : 0.85)
                .animation(.easeOut(duration: 0.45), value: phase)
            // Letter paper peeking up
            if phase == .breaking {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(Color(red: 250 / 255, green: 239 / 255, blue: 215 / 255))
                    .frame(width: 196, height: 96)
                    .offset(y: -42)
                    .overlay(
                        VStack(spacing: Spacing.s2) {
                            ForEach(0..<4, id: \.self) { _ in
                                Rectangle()
                                    .fill(Color(red: 60 / 255, green: 40 / 255, blue: 20 / 255).opacity(0.25))
                                    .frame(height: 1)
                                    .frame(maxWidth: .infinity)
                                    .padding(.horizontal, Spacing.s4)
                            }
                        }
                        .frame(width: 196, height: 96)
                        .offset(y: -42)
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .frame(width: 240, height: 158)
        .rotationEffect(.degrees(-3))
    }

    private var sealMedallion: some View {
        ZStack {
            Circle()
                .fill(letter.seal.color)
                .frame(width: 38, height: 38)
                .overlay(Circle().stroke(Color.black.opacity(0.28), lineWidth: 0.6))
            Text(String(letter.sender.displayName.prefix(1)))
                .font(.system(size: 18, weight: .medium, design: .serif))
                .italic()
                .foregroundColor(Color.white.opacity(0.94))
        }
    }

    private var senderStamp: some View {
        HStack(spacing: 10) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255),
                                Color(red: 122 / 255, green: 79 / 255, blue: 27 / 255)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 34, height: 34)
                    .overlay(Circle().stroke(Color.white.opacity(0.85), lineWidth: 2))
                Text(String(letter.sender.displayName.prefix(1)))
                    .font(.system(size: 14, weight: .semibold, design: .serif))
                    .foregroundColor(.white)
                Icon(.check, size: 7, color: .white)
                    .frame(width: 14, height: 14)
                    .background(Theme.Color.success)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255), lineWidth: 2))
                    .offset(x: -1, y: -1)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(letter.sender.displayName)
                    .font(.system(size: 13, weight: .semibold, design: .serif))
                    .foregroundColor(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255))
                Text("· \(letter.sender.trustLabel?.uppercased() ?? "CEREMONIAL") ·")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255).opacity(0.85))
            }
        }
        .padding(.vertical, 6)
        .padding(.leading, 6)
        .padding(.trailing, 14)
        .background(Color.white.opacity(0.14))
        .overlay(
            Capsule().stroke(Color.white.opacity(0.22), lineWidth: 1)
        )
        .clipShape(Capsule())
    }

    @ViewBuilder
    private var openCTA: some View {
        if phase == .sealed {
            Button(action: onTapOpen) {
                HStack(spacing: Spacing.s2) {
                    Text("Open envelope")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color(red: 42 / 255, green: 31 / 255, blue: 10 / 255))
                    Icon(.chevronRight, size: 14, color: Color(red: 42 / 255, green: 31 / 255, blue: 10 / 255))
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 14)
                .background(Color(red: 246 / 255, green: 236 / 255, blue: 216 / 255).opacity(0.96))
                .clipShape(Capsule())
                .shadow(color: .black.opacity(0.32), radius: 10, y: 6)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialMail_openEnvelope")
        } else {
            // Progress dots for .breaking
            HStack(spacing: 6) {
                Circle().fill(Color.white).frame(width: 6, height: 6)
                Circle().fill(Color.white).frame(width: 6, height: 6)
                Circle().fill(Color.white.opacity(0.55)).frame(width: 6, height: 6)
                Circle().fill(Color.white.opacity(0.25)).frame(width: 6, height: 6)
                Text("BREAKING THE SEAL")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(Color.white.opacity(0.85))
            }
            .padding(.vertical, 14)
        }
    }

    @ViewBuilder
    private var skipAffordance: some View {
        if phase == .sealed || phase == .breaking {
            Button(action: onSkipAnimation) {
                Text("Skip animation")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.white.opacity(0.65))
                    .underline()
            }
            .buttonStyle(.plain)
            .padding(.top, 6)
            .accessibilityIdentifier("ceremonialMail_skipAnimation")
            .accessibilityLabel("Skip animation and open the letter")
        }
    }

    private var pantopusFooter: some View {
        HStack(spacing: 7) {
            Icon(.mailbox, size: 13, color: Color.white.opacity(0.75))
            Text("PANTOPUS · VERIFIED BY ADDRESS")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.6)
                .foregroundStyle(Color.white.opacity(0.75))
        }
        .padding(.top, 14)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.white.opacity(0.22)).frame(height: 1)
        }
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.closeSubpath()
        return p
    }
}

// MARK: - Frame 3: reading

private struct ReadingFrame: View {
    let letter: CeremonialMailLetter
    let opacity: Double
    let slideOffset: CGFloat
    let isVoicePlaying: Bool
    let onToggleVoice: @MainActor () -> Void
    let onReply: @MainActor () -> Void
    let onClose: @MainActor () -> Void
    let onSave: @MainActor () -> Void
    let onArchive: @MainActor () -> Void

    var body: some View {
        ZStack {
            letter.stationery.paperColor
                .overlay(
                    LinearGradient(
                        colors: [Color.white.opacity(0.5), Color.clear],
                        startPoint: .top,
                        endPoint: .center
                    )
                )
                .ignoresSafeArea()
            VStack(spacing: Spacing.s0) {
                readingTopBar
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s0) {
                        senderRow
                        ornament
                        salutation
                        bodyParagraphs
                        signature
                        if letter.voicePostscriptUri != nil {
                            voicePostscript
                                .padding(.top, 18)
                        }
                        endOrnament
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, Spacing.s4)
                    .padding(.bottom, 110)
                    .opacity(opacity)
                    .offset(y: slideOffset)
                    .accessibilityIdentifier("ceremonialMailOpenContent")
                }
                .scrollIndicators(.hidden)
            }
            VStack {
                Spacer()
                stickyBottomBar
            }
        }
        .foregroundColor(letter.ink.color)
    }

    private var readingTopBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onClose) {
                Icon(.x, size: 14, color: letter.ink.color)
                    .frame(width: 30, height: 30)
                    .background(Color.white.opacity(0.55))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(letter.ink.color.opacity(0.14), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("ceremonialMailReading_close")
            Spacer()
            Text(letter.sender.displayName)
                .font(.system(size: 13, weight: .medium, design: .serif))
                .foregroundStyle(letter.ink.color)
            if let received = letter.receivedAt.flatMap(Self.shortDate) {
                Text("· \(received)")
                    .font(.system(size: 11))
                    .foregroundStyle(letter.ink.color.opacity(0.55))
            }
            Spacer()
            HStack(spacing: 6) {
                Button(action: {}) {
                    Icon(.share, size: 13, color: letter.ink.color)
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.55))
                        .clipShape(Circle())
                        .overlay(Circle().stroke(letter.ink.color.opacity(0.14), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Share letter")
                Button(action: onArchive) {
                    Icon(.archive, size: 13, color: letter.ink.color)
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.55))
                        .clipShape(Circle())
                        .overlay(Circle().stroke(letter.ink.color.opacity(0.14), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Archive letter")
            }
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 44)
        .background(letter.stationery.paperColor.opacity(0.55))
        .overlay(alignment: .bottom) {
            Rectangle().fill(letter.ink.color.opacity(0.10)).frame(height: 1)
        }
    }

    private var senderRow: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255),
                                Color(red: 122 / 255, green: 79 / 255, blue: 27 / 255)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 44, height: 44)
                    .overlay(Circle().stroke(Color.white.opacity(0.55), lineWidth: 2))
                Text(String(letter.sender.displayName.prefix(1)))
                    .font(.system(size: 18, weight: .medium, design: .serif))
                    .foregroundColor(.white)
                Icon(.check, size: 8, color: .white)
                    .frame(width: 16, height: 16)
                    .background(Theme.Color.success)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(letter.stationery.paperColor, lineWidth: 2))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(letter.sender.displayName)
                    .font(.system(size: 14, weight: .semibold, design: .serif))
                Text("· \(letter.sender.trustLabel ?? "Ceremonial") ·".uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.2)
                    .foregroundStyle(letter.ink.color.opacity(0.7))
            }
            Spacer()
            postmark
        }
    }

    private var postmark: some View {
        VStack(spacing: 2) {
            Text("PANTOPUS")
                .font(.system(size: 6, weight: .bold))
                .tracking(1.5)
            Text(receivedDay ?? "·")
                .font(.system(size: 18, weight: .semibold, design: .serif))
            Text("POST")
                .font(.system(size: 6, weight: .bold))
                .tracking(1.2)
        }
        .foregroundStyle(letter.seal.color)
        .frame(width: 56, height: 56)
        .overlay(
            Circle()
                .stroke(letter.seal.color, style: StrokeStyle(lineWidth: 1.2, dash: [3, 2.5]))
                .opacity(0.85)
        )
        .overlay(
            Circle()
                .stroke(letter.seal.color, lineWidth: 0.8)
                .padding(6)
                .opacity(0.7)
        )
        .rotationEffect(.degrees(-8))
    }

    private var receivedDay: String? {
        guard let iso = letter.receivedAt,
              let date = ISO8601DateFormatter().date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    private var ornament: some View {
        HStack(spacing: 10) {
            Rectangle().fill(letter.seal.color.opacity(0.4)).frame(height: 1)
            Circle().fill(letter.seal.color).frame(width: 4, height: 4)
            Rectangle().fill(letter.seal.color.opacity(0.4)).frame(height: 1)
        }
        .padding(.vertical, 18)
    }

    private var salutation: some View {
        Text("Dearest reader,")
            .font(.system(size: 19, weight: .medium, design: .serif))
            .italic()
            .padding(.bottom, 14)
    }

    private var bodyParagraphs: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            ForEach(Array(letter.bodyParagraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .font(.system(size: 15, design: .serif))
                    .lineSpacing(5)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityIdentifier("ceremonialMailPaperBody")
    }

    private var signature: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("With warmth,")
                .font(.system(size: 15, design: .serif))
                .italic()
            Text(letter.sender.displayName.split(separator: " ").first.map(String.init) ?? letter.sender.displayName)
                .font(.custom("Snell Roundhand", size: 28))
                .foregroundStyle(letter.seal.color)
        }
        .padding(.top, Spacing.s2)
    }

    private var voicePostscript: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("· VOICE POSTSCRIPT ·")
                .font(.system(size: 9, weight: .bold))
                .tracking(1.6)
                .foregroundStyle(letter.seal.color)
            Button(action: onToggleVoice) {
                HStack(spacing: Spacing.s2) {
                    Circle()
                        .fill(letter.ink.color)
                        .frame(width: 30, height: 30)
                        .overlay(
                            Icon(
                                isVoicePlaying ? .pause : .play,
                                size: 11,
                                color: letter.stationery.paperColor
                            )
                        )
                    HStack(spacing: 2) {
                        ForEach(0..<10, id: \.self) { i in
                            Rectangle()
                                .fill(i < 5 ? letter.seal.color : letter.ink.color.opacity(0.4))
                                .frame(width: 2.4)
                                .frame(height: CGFloat([7, 13, 9, 18, 14, 21, 11, 16, 8, 13][i]))
                                .cornerRadius(1.5)
                        }
                    }
                    Spacer()
                    Text(isVoicePlaying ? "0:14 / 0:32" : "0:32")
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundStyle(letter.ink.color.opacity(0.7))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .stroke(letter.ink.color.opacity(0.13), lineWidth: 1)
                        .background(
                            Capsule().fill(letter.stationery.paperColor.opacity(0.7))
                        )
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialMailVoicePostscript")
            .accessibilityLabel(isVoicePlaying ? "Pause voice postscript" : "Play voice postscript")
        }
        .padding(.top, 14)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(letter.ink.color.opacity(0.2))
                .frame(height: 1)
                .padding(.horizontal, Spacing.s0)
        }
    }

    private var endOrnament: some View {
        HStack(spacing: Spacing.s2) {
            Spacer()
            Rectangle().fill(letter.seal.color.opacity(0.55)).frame(width: 24, height: 1)
            Circle()
                .stroke(letter.seal.color.opacity(0.55), lineWidth: 0.9)
                .frame(width: 12, height: 12)
                .overlay(Circle().fill(letter.seal.color.opacity(0.55)).frame(width: 4, height: 4))
            Rectangle().fill(letter.seal.color.opacity(0.55)).frame(width: 24, height: 1)
            Spacer()
        }
        .padding(.top, 22)
    }

    private var stickyBottomBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onReply) {
                HStack(spacing: 7) {
                    Icon(.send, size: 14, color: .white)
                    Text("Reply")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(Theme.Color.primary600)
                .clipShape(Capsule())
                .shadow(color: Theme.Color.primary600.opacity(0.30), radius: 8, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialMailOutcome_write_back")
            Button(action: onSave) {
                HStack(spacing: 6) {
                    Icon(.bookmark, size: 14, color: letter.ink.color)
                    Text("Save")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(letter.ink.color)
                }
                .padding(.horizontal, Spacing.s4)
                .frame(height: 46)
                .background(Color.white.opacity(0.65))
                .overlay(Capsule().stroke(letter.ink.color.opacity(0.13), lineWidth: 1))
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialMailOutcome_save")
            Button(action: onArchive) {
                Icon(.archive, size: 15, color: letter.ink.color)
                    .frame(width: 46, height: 46)
                    .background(Color.white.opacity(0.65))
                    .overlay(Circle().stroke(letter.ink.color.opacity(0.13), lineWidth: 1))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialMailOutcome_archive")
            .accessibilityLabel("Archive letter")
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s3)
        .padding(.bottom, 14)
        .background(
            LinearGradient(
                colors: [letter.stationery.paperColor.opacity(0), letter.stationery.paperColor],
                startPoint: .top,
                endPoint: .center
            )
        )
    }

    static func shortDate(_ iso: String) -> String? {
        guard let date = ISO8601DateFormatter().date(from: iso) else { return nil }
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: date)
    }
}

// MARK: - Frame 4: reply compose handoff

private struct ReplyHandoffFrame: View {
    let letter: CeremonialMailLetter
    let onBack: @MainActor () -> Void
    let onContinue: @MainActor () -> Void

    var body: some View {
        ZStack {
            letter.stationery.paperColor.ignoresSafeArea()
            VStack(spacing: Spacing.s0) {
                topBar
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s4) {
                        letterPreview
                        composeSurface
                    }
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s4)
                    .padding(.bottom, 60)
                }
                .scrollIndicators(.hidden)
            }
            VStack {
                Spacer()
                Text("NEXT · CEREMONIAL COMPOSE →")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .tracking(1.2)
                    .foregroundStyle(letter.ink.color.opacity(0.5))
                    .padding(.bottom, 18)
            }
        }
        .foregroundColor(letter.ink.color)
        .accessibilityIdentifier("ceremonialMailWriteBackBanner")
    }

    private var topBar: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 14, color: letter.ink.color)
                    .frame(width: 30, height: 30)
                    .background(Color.white.opacity(0.55))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(letter.ink.color.opacity(0.14), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to letter")
            .accessibilityIdentifier("ceremonialMailReply_back")
            Spacer()
            Text("WRITE BACK")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(letter.ink.color.opacity(0.75))
            Spacer()
            Button(action: onContinue) {
                Text("Continue →")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 30)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("ceremonialMailReply_continue")
        }
        .padding(.horizontal, Spacing.s3)
        .frame(height: 44)
        .background(letter.stationery.paperColor.opacity(0.55))
        .overlay(alignment: .bottom) {
            Rectangle().fill(letter.ink.color.opacity(0.10)).frame(height: 1)
        }
    }

    private var letterPreview: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack {
                HStack(spacing: Spacing.s2) {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 194 / 255, green: 146 / 255, blue: 48 / 255),
                                    Color(red: 122 / 255, green: 79 / 255, blue: 27 / 255)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 28, height: 28)
                        .overlay(
                            Text(String(letter.sender.displayName.prefix(1)))
                                .font(.system(size: 13, weight: .semibold, design: .serif))
                                .foregroundColor(.white)
                        )
                    VStack(alignment: .leading, spacing: 1) {
                        Text(letter.sender.displayName)
                            .font(.system(size: 12, weight: .semibold, design: .serif))
                        Text("THEIR LETTER")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1.4)
                            .foregroundStyle(letter.ink.color.opacity(0.65))
                    }
                }
                Spacer()
            }
            Text(previewText)
                .font(.system(size: 13, design: .serif))
                .foregroundStyle(letter.ink.color.opacity(0.82))
                .lineLimit(3)
                .lineSpacing(2)
        }
        .padding(14)
        .background(letter.stationery.paperColor)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(letter.ink.color.opacity(0.12), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: letter.ink.color.opacity(0.12), radius: 8, y: 4)
    }

    private var previewText: String {
        if let first = letter.bodyParagraphs.first { return first }
        return ""
    }

    private var composeSurface: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Text("PAPER")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(letter.ink.color.opacity(0.65))
                Spacer()
                Text("INK")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(letter.ink.color.opacity(0.65))
            }
            HStack(spacing: 14) {
                paperSwatches
                Spacer()
                inkSwatches
            }
            Text("Dear \(letter.sender.displayName.split(separator: " ").first.map(String.init) ?? letter.sender.displayName),")
                .font(.system(size: 18, weight: .medium, design: .serif))
                .italic()
                .padding(.top, Spacing.s1)
            Text("Begin your reply…")
                .font(.system(size: 15, design: .serif))
                .foregroundStyle(letter.ink.color.opacity(0.5))
                .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
            HStack(spacing: 6) {
                composeIcon(.send)
                composeIcon(.image)
                composeIcon(.bookmark)
                Spacer()
                Text("0 / 600")
                    .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
                    .foregroundStyle(letter.ink.color.opacity(0.65))
            }
            .padding(.top, Spacing.s2)
            .overlay(alignment: .top) {
                Rectangle().fill(letter.ink.color.opacity(0.1)).frame(height: 1)
            }
        }
        .padding(18)
        .background(letter.stationery.paperColor)
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(letter.ink.color.opacity(0.12), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: letter.ink.color.opacity(0.10), radius: 12, y: -6)
    }

    private var paperSwatches: some View {
        HStack(spacing: 6) {
            ForEach(Array(stationerySwatches.enumerated()), id: \.offset) { idx, tone in
                Circle()
                    .fill(tone.paperColor)
                    .frame(width: 18, height: 18)
                    .overlay(
                        Circle()
                            .stroke(
                                idx == 0 ? letter.ink.color : letter.ink.color.opacity(0.2),
                                lineWidth: idx == 0 ? 2 : 1
                            )
                    )
            }
        }
    }

    private var inkSwatches: some View {
        HStack(spacing: 6) {
            ForEach(Array(inkToneOptions.enumerated()), id: \.offset) { idx, tone in
                Circle()
                    .fill(tone.color)
                    .frame(width: 18, height: 18)
                    .overlay(
                        Circle()
                            .stroke(
                                idx == 0 ? letter.ink.color : letter.ink.color.opacity(0.2),
                                lineWidth: idx == 0 ? 2 : 1
                            )
                    )
            }
        }
    }

    private var stationerySwatches: [CeremonialMailStationeryTone] {
        [letter.stationery, .winter, .spring, .summer, .evergreen]
    }

    private var inkToneOptions: [CeremonialMailInkTone] {
        [letter.ink, .iron, .ivory]
    }

    private func composeIcon(_ icon: PantopusIcon) -> some View {
        Button(action: {}) {
            Icon(icon, size: 15, color: letter.ink.color)
                .frame(width: 34, height: 34)
                .background(Color.white.opacity(0.45))
                .overlay(
                    RoundedRectangle(cornerRadius: 9)
                        .stroke(letter.ink.color.opacity(0.13), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    CeremonialMailOpenView(viewModel: CeremonialMailOpenViewModel(mailId: "preview"))
}
