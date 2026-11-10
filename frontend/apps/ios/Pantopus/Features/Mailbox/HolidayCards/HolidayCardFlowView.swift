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
    /// "See it in Sent" on a card just sent: its id; "See them in Sent" on a list: nil (Sent itself).
    private let onSeeInSent: ((String?) -> Void)?
    /// Back out of the flow (before anything is sent).
    private let onClose: () -> Void
    /// Done once it's sent ("Back to your mail", step 5's Done); `onClose` when nil.
    private let onDone: (() -> Void)?
    @Environment(\.colorScheme) private var scheme
    @Environment(\.scenePhase) private var phase
    private static let top = "sendCardTop"

    /// Cards cost digital stamps for this person.
    private var postageOn: Bool {
        viewModel.cards?.postageEnabled == true
    }

    /// The moments the stamps can have moved: each step, a card or list sent, a card taken back.
    private var stampsMoment: String {
        let sent = viewModel.sent?.id ?? "\(viewModel.listResults?.count ?? 0)"
        return "\(viewModel.step):\(sent):\(viewModel.listTakenBack.count):\(viewModel.backNote ?? "")"
    }

    init(
        viewModel: HolidayCardFlowViewModel,
        onSeeInSent: ((String?) -> Void)? = nil,
        onDone: (() -> Void)? = nil,
        onClose: @escaping () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.onSeeInSent = onSeeInSent
        self.onDone = onDone
        self.onClose = onClose
    }

    private var done: () -> Void {
        onDone ?? onClose
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            ScrollViewReader { scroller in
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        content
                        if postageOn, viewModel.step == .sent, viewModel.sent != nil || viewModel.listResults != nil {
                            HolidayCardPaperButton(title: "Send another card", fullWidth: true) { viewModel.startOver() }
                                .accessibilityIdentifier("sendAnotherCard")
                        }
                    }
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
                footer
            }
        }
        .background(HolidayCardDesk.background(scheme).ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        // Full screen, like the other flows: no tab bar in any step or on the confirmation (founder, 11-09).
        .hidesTabBar()
        .task { await viewModel.load() }
        // Digital stamps: the balance after each step, card and take-back; StoreKit purchases finished on open and resume.
        .task(id: postageOn) {
            guard postageOn else { return }
            await viewModel.stamps.recover()
            await viewModel.stamps.watch()
        }
        .task(id: stampsMoment) {
            if postageOn { await viewModel.stamps.refresh() }
        }
        .onChange(of: phase) { if phase == .active, postageOn { Task { await viewModel.stamps.recover() } } }
        // While the sealing table is up, it shows the stamp books itself, over the table.
        .sheet(isPresented: Binding(
            get: { viewModel.showsStampBooks && !viewModel.sealsAtTable },
            set: { viewModel.showsStampBooks = $0 }
        )) {
            StampBooksSheet(store: viewModel.stamps, short: viewModel.stampShort)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        // Seal it by hand: the table over the flow, from Look it over until Done.
        .modifier(CardTableSendCover(viewModel: viewModel, onDone: done))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("sendCard")
    }

    // MARK: Header

    /// What the header says and whether the dots show.
    private var heading: (title: String, dots: HolidayCardStep?) {
        guard let cards = viewModel.cards else { return ("Christmas cards", nil) }
        if viewModel.step == .sent, viewModel.sent?.byLink == true { return ("Your card is ready.", nil) }
        if viewModel.step != .sent, viewModel.today != nil { return ("Today’s card", nil) }
        if !cards.open, viewModel.step != .sent { return ("Christmas cards", nil) }
        return (viewModel.step.title, viewModel.step == .sent ? nil : viewModel.step)
    }

    private var header: some View {
        VStack(spacing: Spacing.s2) {
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
            if postageOn {
                StampChip(store: viewModel.stamps) { viewModel.showsStampBooks = true }
                    .padding(.horizontal, Spacing.s4)
            }
        }
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

    /// What's pinned under the page: Look it over's footer (a list's, or one card's), step 1's button on with a list,
    /// or Pick a card's bar.
    @ViewBuilder
    private var footer: some View {
        if viewModel.cards != nil, viewModel.step == .look, let entries = viewModel.recipient?.entries, let look = viewModel.listPreview {
            HolidayCardListLookFooter(viewModel: viewModel, entries: entries, look: look)
        } else if let recipient = lookRecipient {
            HolidayCardLookFooter(viewModel: viewModel, byEmail: recipient.isEmail)
        } else if viewModel.step == .to, viewModel.cards?.open == true, viewModel.maxRecipients > 1, !viewModel.listed.isEmpty {
            HolidayCardListContinueBar(viewModel: viewModel)
        } else if viewModel.step == .pick, let cards = viewModel.cards, cards.open, viewModel.today == nil {
            HolidayCardPickBar(viewModel: viewModel, cards: cards)
        }
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
        if viewModel.step == .sent, let results = viewModel.listResults {
            HolidayCardListSentView(
                viewModel: viewModel,
                results: results,
                cards: cards,
                onDone: done,
                onSeeInSent: onSeeInSent.map { open in { open(nil) } }
            )
        } else if viewModel.step == .sent, let sent = viewModel.sent {
            HolidayCardSentView(
                viewModel: viewModel,
                card: sent,
                cards: cards,
                title: sent.byLink ? "Your card" : "On its way",
                onDone: done,
                onSeeInSent: onSeeInSent.map { open in { open(sent.id) } }
            )
        } else if let today = viewModel.today {
            HolidayCardSentView(viewModel: viewModel, card: today, cards: cards, title: "Today’s card", onDone: onClose)
        } else if !cards.open {
            HolidayCardsClosedView(onDone: onClose)
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                if let note = viewModel.backNote, viewModel.step == .to {
                    Text(note)
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
            if let design = viewModel.design, viewModel.recipient?.entries != nil, let look = viewModel.listPreview {
                HolidayCardListLookStep(viewModel: viewModel, cards: cards, design: design, look: look)
            } else if let design = viewModel.design, let recipient = viewModel.recipient, let preview = viewModel.preview {
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
