//
//  MailSentPieceView.swift
//  Pantopus
//
//  A sent card, opened from Sent (Mail canvas, boards "M3-SentCard" and
//  "M4-SentEmail"): Back to Sent, "Your card to <name>", the envelope as it
//  lies in their Mailbox, the card you sent (both sides, your note), its
//  trail, and Take it back while it can be. Like real mail, a card never
//  tells its sender when it was opened.
//

import SwiftUI

struct MailSentPieceView: View {
    @State private var viewModel: MailSentPieceViewModel
    /// Back to Sent.
    private let onBack: () -> Void
    @State private var showBack = false

    init(viewModel: MailSentPieceViewModel, onBack: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            header
            ScrollView {
                content
                    .frame(maxWidth: 560)
                    .padding(.horizontal, Spacing.s4)
                    .padding(.top, Spacing.s1)
                    .padding(.bottom, Spacing.s8)
                    .frame(maxWidth: .infinity)
            }
            .refreshable { await viewModel.load() }
        }
        .background(Theme.Color.appBg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailSentPiece")
    }

    /// After "Take your card back?": gone from Sent, and back to it.
    private func confirmTakeBack() {
        Task {
            guard await viewModel.takeBack() else { return }
            NotificationCenter.default.post(name: .mailboxSentChanged, object: viewModel.id)
            onBack()
        }
    }

    private var header: some View {
        Button(action: onBack) {
            HStack(spacing: 2) {
                Icon(.chevronLeft, size: 24, color: Theme.Color.primary600)
                Text("Sent")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Theme.Color.primary600)
            }
            .padding(.leading, Spacing.s1)
            .padding(.trailing, Spacing.s2)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back to Sent")
        .accessibilityIdentifier("mailSentPieceBack")
        .padding(.horizontal, Spacing.s1)
        .padding(.top, Spacing.s2)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(width: 240, height: 28)
                Shimmer(width: 200, height: 14)
                Shimmer(height: 150, cornerRadius: Radii.sm)
                Shimmer(height: 360, cornerRadius: Radii.sm)
            }
            .padding(.top, Spacing.s2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading your card")
        case let .error(message):
            ErrorState(headline: "Couldn't load your card", message: message) {
                await viewModel.retry()
            }
            .padding(.top, Spacing.s8)
        case let .gone(message):
            ErrorState(
                // A heading, like "Couldn't load your card": no closing period.
                headline: HolidayCardWords.withoutPeriod(message),
                message: "Go back to Sent to see the cards you’ve sent.",
                retryTitle: "Back to Sent"
            ) {
                // Sent drops it too, and the flag follows.
                NotificationCenter.default.post(name: .mailboxSentChanged, object: viewModel.id)
                onBack()
            }
            .padding(.top, Spacing.s8)
            .accessibilityIdentifier("mailSentPieceGone")
        case let .loaded(piece):
            loaded(piece)
        }
    }

    private func loaded(_ piece: MailSentPiece) -> some View {
        let first = HolidayCardWords.firstName(piece.toName)
        let envelope = MailPieceModel.sent(piece)
        let mailbox = piece.byEmail && piece.status != .claimed
            ? "Once they join with that address"
            : "In \(HolidayCardWords.possessive(first)) Mailbox"
        return VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: "Your card to \(piece.toName)")
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.36)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text(verbatim: MailSentWords.sentLine(piece))
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, Spacing.s1)
            section(mailbox) {
                MailPieceView(model: envelope)
            }
            section("The card you sent") {
                theCard(piece, envelope: envelope)
            }
            trail(piece)
            if piece.canTakeBack {
                takeBack(piece)
            } else if let error = viewModel.takeBackError {
                errorLine(error)
            }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(verbatim: title)
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.66)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    /// The picture side (turning over to the back) and the back with your note.
    private func theCard(_ piece: MailSentPiece, envelope: MailPieceModel) -> some View {
        let note = MailPieceModel.firstText(piece.note) ?? ""
        let from = envelope.from
        let front = HolidayCardFront(
            design: piece.card.design,
            caption: piece.card.caption,
            paper: piece.card.paper,
            year: piece.card.year,
            // Before the carrier's postmark, the day you sent it (as the web).
            mailedOn: envelope.isPostmarked
                ? envelope.postmarkDate
                : MailDates.parse(piece.sentAt).map { MailDates.postmarkDay($0, calendar: .current) }
        )
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
        let back = HolidayCardBack(paper: piece.card.paper, fromName: from, year: piece.card.year) { width in
            HolidayCardNoteText(text: .constant(note), cardWidth: width)
        }
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .shadow(color: MailPaper.cardShadow.opacity(0.28), radius: 15, x: 0, y: 14)
        return VStack(spacing: 18) {
            HolidayCardFlip(showBack: showBack) { front } back: { back }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Your card: \(HolidayCardWords.captionSentence(piece.card.caption)) On the back: \(note)")
                .frame(maxWidth: 300)
                .rotationEffect(.degrees(-1))
            HolidayCardPaperButton(title: showBack ? "Turn it back" : "Turn it over", isPressed: showBack) {
                showBack.toggle()
            }
            .accessibilityIdentifier("mailSentPieceTurn")
            HolidayCardFront(design: piece.card.design, caption: nil, paper: piece.card.paper, year: piece.card.year)
                .hidden()
                .overlay { back }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("On the back: \(note) From \(HolidayCardWords.withoutPeriod(from)).")
                .frame(maxWidth: 300)
                .rotationEffect(.degrees(1))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s1)
    }

    /// Where it has been: done steps filled, the rest hollow with "· not
    /// yet", and the lock note.
    private func trail(_ piece: MailSentPiece) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("Its trail")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.66)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.bottom, Spacing.s3)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(piece.trail.enumerated()), id: \.offset) { index, step in
                trailStep(step, piece: piece, isLast: index == piece.trail.count - 1)
            }
            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.lock, size: 15, color: Theme.Color.appTextStrong)
                    .padding(.top, 1)
                Text("Like real mail, a card never tells you when it was opened.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .padding(.top, Spacing.s4)
            .accessibilityElement(children: .combine)
        }
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailSentTrail")
    }

    private func trailStep(_ step: MailSentPiece.TrailStep, piece: MailSentPiece, isLast: Bool) -> some View {
        let detail = MailSentWords.trailDetail(step)
        return HStack(alignment: .top, spacing: 14) {
            ZStack(alignment: .top) {
                if !isLast {
                    Rectangle()
                        .fill(Theme.Color.appBorder)
                        .frame(width: 2)
                        .padding(.top, 8)
                        .frame(maxHeight: .infinity)
                }
                Circle()
                    .fill(step.done ? dotColor(step) : Theme.Color.appSurface)
                    .overlay(Circle().strokeBorder(step.done ? Color.clear : Theme.Color.appTextMuted, lineWidth: 2))
                    .frame(width: 14, height: 14)
                    .padding(.top, 3)
            }
            .frame(width: 14)
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text(verbatim: MailSentWords.trailTitle(step, piece: piece))
                    .font(.system(size: 15, weight: step.done ? .semibold : .regular))
                    .foregroundStyle(step.done ? Theme.Color.appText : Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail {
                    Text(verbatim: detail)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            .padding(.bottom, isLast ? 0 : Spacing.s4)
        }
        .accessibilityElement(children: .combine)
    }

    /// Sealed in wax red, with them in green, a card back unopened in grey,
    /// the carrier and the email in ink (the web's colors).
    private func dotColor(_ step: MailSentPiece.TrailStep) -> Color {
        switch step.step {
        case "sealed": MailPaper.wax
        case "delivered", "joined", "opens": Theme.Color.success
        case "returned": Theme.Color.appTextMuted
        default: Theme.Color.appTextStrong
        }
    }

    /// "Changed your mind?" while it can still come back.
    private func takeBack(_ piece: MailSentPiece) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s3) {
                Icon(.calendarClock, size: 20, color: MailPaper.cardLink)
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    Text("Changed your mind?")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(MailPaper.cardText)
                    Text(verbatim: MailSentWords.takeBackLine(piece))
                        .font(.system(size: 13))
                        .foregroundStyle(MailPaper.cardTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    viewModel.confirmsTakeBack = true
                } label: {
                    ZStack {
                        Text("Take it back").opacity(viewModel.takingBack ? 0 : 1)
                        if viewModel.takingBack { ProgressView().tint(MailPaper.wax) }
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(MailPaper.wax)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 44)
                    .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.wax, lineWidth: 1.5))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(viewModel.takingBack)
                .accessibilityIdentifier("mailSentPieceTakeBack")
                .confirmationDialog("Take your card back?", isPresented: $viewModel.confirmsTakeBack, titleVisibility: .visible) {
                    Button("Take it back", role: .destructive, action: confirmTakeBack)
                        .accessibilityIdentifier("mailSentTakeBackConfirm")
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text(MailSentWords.takeBackConfirm(piece))
                }
            }
            if let error = viewModel.takeBackError {
                errorLine(error)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 14)
        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(MailPaper.cardRowLine, lineWidth: 1))
    }

    private func errorLine(_ text: String) -> some View {
        Text(verbatim: text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Theme.Color.error)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("mailSentPieceError")
    }
}
