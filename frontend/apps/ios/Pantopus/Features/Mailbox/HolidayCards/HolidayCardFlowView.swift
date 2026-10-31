//
//  HolidayCardFlowView.swift
//  Pantopus
//
//  Send a Christmas card (launch keys `holiday_cards` + `mailbox`; the web's
//  `/app/mailbox/cards`), opened from the row at the top of Me in the
//  Mailbox. The whole screen is the cream desk the card sits on: Back, the
//  step's title and five step dots, then who it's for → pick a card → write
//  on the back → seal it for the day → look it over, with "Seal and send"
//  pinned under it. Once today's card is sent it shows that card instead,
//  with Take it back until the pickup.
//

import SwiftUI

struct HolidayCardFlowView: View {
    @State private var viewModel: HolidayCardFlowViewModel
    private let onClose: () -> Void
    @Environment(\.colorScheme) private var scheme
    private static let top = "sendCardTop"

    init(viewModel: HolidayCardFlowViewModel, onClose: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onClose = onClose
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ScrollViewReader { scroller in
                ScrollView {
                    content
                        .frame(maxWidth: 560)
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s3)
                        .padding(.bottom, Spacing.s8)
                        .frame(maxWidth: .infinity)
                        .id(Self.top)
                }
                .scrollDismissesKeyboard(.interactively)
                // Each step starts at its top (Look it over is long).
                .onChange(of: viewModel.step) { scroller.scrollTo(Self.top, anchor: .top) }
            }
            .safeAreaInset(edge: .bottom, spacing: Spacing.s0) {
                if let recipient = lookRecipient {
                    HolidayCardLookFooter(viewModel: viewModel, byEmail: recipient.isEmail)
                }
            }
        }
        .background(HolidayCardDesk.background(scheme).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCard")
    }

    // MARK: Header

    /// What the header says and whether the dots show.
    private var heading: (title: String, dots: HolidayCardStep?) {
        guard let cards = viewModel.cards else { return ("Christmas cards", nil) }
        if viewModel.step != .sent, viewModel.today != nil { return ("Today’s card", nil) }
        if !cards.open, viewModel.step != .sent { return ("Christmas cards", nil) }
        return (viewModel.step.title, viewModel.step == .sent ? nil : viewModel.step)
    }

    private var header: some View {
        HStack(spacing: Spacing.s1) {
            Button(action: back) {
                Icon(.chevronLeft, size: 24, color: HolidayCardDesk.text(scheme))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("sendCardBack")
            Text(heading.title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(HolidayCardDesk.text(scheme))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("sendCardTitle")
            if let step = heading.dots {
                StepDots(current: step)
                    .padding(.trailing, 14)
            }
        }
        .padding(.horizontal, Spacing.s1)
        .padding(.top, Spacing.s2)
    }

    private func back() {
        let today = viewModel.step != .sent && viewModel.today != nil
        if today || !viewModel.back() { onClose() }
    }

    /// Who the card is for while Look it over shows (its footer pins under it).
    private var lookRecipient: HolidayCardRecipient? {
        guard viewModel.cards != nil, viewModel.today == nil, viewModel.step == .look, viewModel.preview != nil else { return nil }
        return viewModel.recipient
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Shimmer(height: 48, cornerRadius: Radii.lg)
                Shimmer(width: 220, height: 14)
                Shimmer(height: 180, cornerRadius: Radii.lg)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loading the Christmas cards")
        case let .error(message):
            ErrorState(headline: "Couldn't load the Christmas cards", message: message) {
                await viewModel.retry()
            }
            .padding(.top, Spacing.s8)
        case let .loaded(cards):
            loaded(cards)
        }
    }

    @ViewBuilder
    private func loaded(_ cards: HolidayCardsResponse) -> some View {
        if viewModel.step == .sent, let sent = viewModel.sent {
            HolidayCardSentView(viewModel: viewModel, card: sent, cards: cards, title: "On its way", onDone: onClose)
        } else if let today = viewModel.today {
            HolidayCardSentView(viewModel: viewModel, card: today, cards: cards, title: "Today’s card", onDone: onClose)
        } else if !cards.open {
            HolidayCardsClosedView(onDone: onClose)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if viewModel.tookBack, viewModel.step == .to {
                    Text("You took your card back. You can send a card again today.")
                        .font(.system(size: 14))
                        .foregroundStyle(MailPaper.cardTextSoft)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(MailPaper.cardNote, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(
                            MailPaper.cardRowLine,
                            lineWidth: 1
                        ))
                        .accessibilityIdentifier("sendCardTookBack")
                }
                if viewModel.step != .to, let recipient = viewModel.recipient {
                    Text("To \(recipient.name)")
                        .font(.system(size: 14))
                        .foregroundStyle(HolidayCardDesk.muted(scheme))
                        .lineLimit(1)
                        .accessibilityIdentifier("sendCardTo")
                }
                step(cards)
            }
        }
    }

    @ViewBuilder
    private func step(_ cards: HolidayCardsResponse) -> some View {
        switch viewModel.step {
        case .to:
            HolidayCardToStep(viewModel: viewModel)
        case .pick:
            HolidayCardPickStep(viewModel: viewModel, cards: cards)
        case .write:
            if let design = viewModel.design {
                HolidayCardWriteStep(viewModel: viewModel, cards: cards, design: design)
            }
        case .seal:
            if let design = viewModel.design, let recipient = viewModel.recipient {
                HolidayCardSealStep(viewModel: viewModel, cards: cards, design: design, recipient: recipient)
            }
        case .look:
            if let design = viewModel.design, let recipient = viewModel.recipient, let preview = viewModel.preview {
                HolidayCardLookStep(viewModel: viewModel, cards: cards, design: design, recipient: recipient, preview: preview)
            }
        case .sent:
            EmptyView()
        }
    }
}

/// The five steps as dots: wax red up to this one (a longer dash), cream ahead.
private struct StepDots: View {
    let current: HolidayCardStep

    var body: some View {
        let index = HolidayCardStep.counted.firstIndex(of: current) ?? 0
        HStack(spacing: 5) {
            ForEach(Array(HolidayCardStep.counted.enumerated()), id: \.offset) { position, _ in
                Capsule()
                    .fill(position <= index ? MailPaper.wax : MailPaper.cardDotAhead)
                    .frame(width: position == index ? 20 : 7, height: 7)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(index + 1) of \(HolidayCardStep.counted.count)")
        .accessibilityIdentifier("sendCardStepDots")
    }
}
