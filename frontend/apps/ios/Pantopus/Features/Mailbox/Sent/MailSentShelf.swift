//
//  MailSentShelf.swift
//  Pantopus
//
//  Sent, under the Mailbox's drawer chips (Mail canvas, board "M2-Sent"):
//  "What you've sent, newest first." The cards still waiting for the 7 a.m.
//  pickup lie in a sunken well, their envelopes not postmarked yet, each
//  with Take it back; then the rest by the day they were sent, each
//  envelope as they got it (postmarked, never torn open), its picture and
//  where it is now. Never when it was opened.
//

import SwiftUI

struct MailSentShelf: View {
    let viewModel: MailSentViewModel
    let onOpen: (MailSentPiece) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("What you’ve sent, newest first.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s2)
            content
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("mailSent")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(spacing: Spacing.s4) {
                ForEach(0..<3, id: \.self) { _ in
                    Shimmer(height: 150, cornerRadius: Radii.sm)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading what you’ve sent")
        case .empty:
            EmptyState(
                icon: .send,
                headline: "Nothing sent yet.",
                subcopy: "Cards you send show up here, with when they arrive.",
                cta: nil
            )
            .padding(.top, Spacing.s8)
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("mailSentEmpty")
        case let .error(message):
            ErrorState(headline: "Couldn't load your mail", message: message) {
                await viewModel.retry()
            }
            .padding(.top, Spacing.s8)
            .padding(.horizontal, Spacing.s4)
            .accessibilityIdentifier("mailSentError")
        case .loaded:
            loaded
        }
    }

    private var loaded: some View {
        LazyVStack(alignment: .leading, spacing: 22) {
            let waiting = viewModel.waiting
            if !waiting.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    dayTitle("Waiting for pickup")
                    VStack(alignment: .leading, spacing: Spacing.s4) {
                        ForEach(waiting) { piece in
                            row(piece)
                        }
                    }
                    .padding(Spacing.s3)
                    .background(MailPaper.counter, in: RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
                    .overlay(alignment: .top) {
                        // The well's lit lip, as on the Counter.
                        RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous)
                            .strokeBorder(.white.opacity(0.7), lineWidth: 1)
                            .mask(alignment: .top) { Rectangle().frame(height: 2) }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("mailSentWaiting")
                }
            }
            ForEach(viewModel.days) { day in
                VStack(alignment: .leading, spacing: 10) {
                    dayTitle(day.title)
                    VStack(alignment: .leading, spacing: 22) {
                        ForEach(day.pieces) { piece in
                            row(piece)
                                .onAppear {
                                    if piece.id == viewModel.items.last?.id {
                                        Task { await viewModel.loadMoreIfNeeded() }
                                    }
                                }
                        }
                    }
                }
            }
            footer
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s4)
    }

    private func dayTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .tracking(0.7)
            .textCase(.uppercase)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .accessibilityAddTraits(.isHeader)
    }

    private func row(_ piece: MailSentPiece) -> some View {
        MailSentRow(
            piece: piece,
            isTakingBack: viewModel.takingBack == piece.id,
            error: viewModel.takeBackError?.id == piece.id ? viewModel.takeBackError?.message : nil,
            confirmsTakeBack: Binding(
                get: { viewModel.confirmsTakeBack?.id == piece.id },
                set: { if !$0, viewModel.confirmsTakeBack?.id == piece.id { viewModel.confirmsTakeBack = nil } }
            ),
            onOpen: { onOpen(piece) },
            onTakeBack: { viewModel.confirmsTakeBack = piece },
            onConfirmTakeBack: { Task { await viewModel.takeBack(piece) } }
        )
    }

    /// The next page's spinner, or why it didn't come.
    @ViewBuilder
    private var footer: some View {
        if let error = viewModel.loadMoreError {
            VStack(spacing: Spacing.s2) {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                Button("Try again") { Task { await viewModel.retryLoadMore() } }
                    .font(.system(size: 14, weight: .semibold))
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("mailSentLoadMoreRetry")
            }
            .frame(maxWidth: .infinity)
        } else if viewModel.next != nil {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 44)
                .accessibilityLabel("Loading more of what you’ve sent")
        }
    }
}

/// A sent card: its envelope as they got it, its picture and where it is
/// now, opening its page; Take it back while it can be.
private struct MailSentRow: View {
    let piece: MailSentPiece
    let isTakingBack: Bool
    let error: String?
    /// "Take your card back?" for this card, from its own button.
    @Binding var confirmsTakeBack: Bool
    let onOpen: () -> Void
    let onTakeBack: () -> Void
    let onConfirmTakeBack: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .bottomTrailing) {
                Button(action: onOpen) {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        MailPieceView(model: .sent(piece))
                        HStack(spacing: 10) {
                            HolidayCardPictureView(design: piece.card.design, paper: piece.card.paper, thumb: true)
                                .frame(width: 30)
                                .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                                .shadow(color: MailPaper.cardShadow.opacity(0.25), radius: 3, x: 0, y: 2)
                                .rotationEffect(.degrees(-3))
                            VStack(alignment: .leading, spacing: Spacing.s0) {
                                Text(verbatim: MailSentWords.toLine(piece))
                                    .foregroundStyle(Theme.Color.appTextStrong)
                                Text(verbatim: MailSentWords.statusLine(piece))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                            }
                            .font(.system(size: 13))
                            .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: piece.canTakeBack ? 116 : Spacing.s0)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(MailPieceButtonStyle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(MailSentWords.toLine(piece)). \(MailSentWords.statusLine(piece)).")
                .accessibilityHint("Shows the card and its trail.")
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier("mailSentRow.\(piece.id)")
                if piece.canTakeBack {
                    Button(action: onTakeBack) {
                        ZStack {
                            Text("Take it back").opacity(isTakingBack ? 0 : 1)
                            if isTakingBack { ProgressView() }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(isTakingBack)
                    .accessibilityLabel("Take it back")
                    .accessibilityIdentifier("mailSentTakeBack.\(piece.id)")
                    .confirmationDialog("Take your card back?", isPresented: $confirmsTakeBack, titleVisibility: .visible) {
                        Button("Take it back", role: .destructive, action: onConfirmTakeBack)
                            .accessibilityIdentifier("mailSentTakeBackConfirm")
                        Button("Cancel", role: .cancel) {}
                    } message: {
                        Text(MailSentWords.takeBackConfirm(piece))
                    }
                }
            }
            if let error {
                Text(verbatim: error)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
