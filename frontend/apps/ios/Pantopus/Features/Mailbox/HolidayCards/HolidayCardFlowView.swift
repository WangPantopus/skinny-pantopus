//
//  HolidayCardFlowView.swift
//  Pantopus
//
//  Send a Christmas card (launch keys `holiday_cards` + `mailbox`; the web's
//  `/app/mailbox/cards`), opened from the row at the top of Me in the
//  Mailbox. The whole screen is the cream desk the card sits on: Back, the
//  step's title and five step dots, then who it's for → pick a card → write
//  on the back → seal it for the day ("Seal and send", or "Look it over"
//  first) → look it over, with only "Seal and send" pinned under it. Once
//  today's card is sent it shows that card instead, with Take it back until
//  the pickup.
//

// swiftlint:disable file_length type_body_length

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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// The flow's own width: on an iPad window at least `WideLayout.minimumScreenWidth` wide, the window's (or the Mail
    /// pane's) whole width (`wideColumnsScreen()`).
    @State private var width: CGFloat = 0
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

    /// Write on the back, Seal it for the day and Look it over happen at the table (plan Part 9): on the chosen card's
    /// cloth under the window light. Who it's for and Pick a card stay on paper.
    private var atTable: Bool {
        guard LaunchFeatures.cardTable, viewModel.design != nil, viewModel.today == nil, viewModel.cards?.open == true else {
            return false
        }
        return viewModel.step == .write || viewModel.step == .seal || viewModel.step == .look
    }

    /// The desk's words: light at the table.
    private var desk: ColorScheme {
        atTable ? .dark : scheme
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            // A photo shared to Mail from another app waits for "Write on the back".
            ShareInCardPhotoNote()
            ScrollViewReader { scroller in
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.s3) {
                        content
                        if viewModel.step == .sent, viewModel.sent != nil || viewModel.listResults != nil {
                            if postageOn {
                                HolidayCardPaperButton(title: "Send another card", fullWidth: true) { viewModel.startOver() }
                                    .accessibilityIdentifier("sendAnotherCard")
                            }
                            // The fastest second card (experience plan Part 6).
                            if viewModel.canSendAnother, viewModel.design != nil {
                                HolidayCardPaperButton(title: "Send this card to someone else", fullWidth: true) {
                                    viewModel.sendThisCardAgain()
                                }
                                .accessibilityIdentifier("sendThisCardAgain")
                            }
                        }
                    }
                    .frame(maxWidth: column.width)
                    .padding(.horizontal, column.margin)
                    .padding(.top, Spacing.s3)
                    .padding(.bottom, Spacing.s8)
                    .frame(maxWidth: .infinity)
                    .id(Self.top)
                }
                .scrollDismissesKeyboard(.interactively)
                // Each step starts at its top (Look it over is long).
                .onChange(of: viewModel.step) { scroller.scrollTo(Self.top, anchor: .top) }
                // Back from the card rack on another card than the one tapped: the grid shows it, ticked. The card
                // shelves stay where the rack was opened from.
                .onChange(of: viewModel.largeDesign) { old, new in
                    guard new == nil, viewModel.step == .pick, !shelves, let id = viewModel.designId, id != old?.id else { return }
                    withAnimation(.easeInOut(duration: 0.3)) { scroller.scrollTo(id, anchor: .center) }
                }
                // The card shelves: a collection's shelf at the top (the line under a large card; the chosen card's as
                // they open, once they're laid out).
                .onChange(of: viewModel.shelfJump) { _, jump in go(to: jump, scroller: scroller) }
            }
            .modifier(ShelfPageCover(viewModel: viewModel, page: shelfPage, reduceMotion: reduceMotion))
            .safeAreaInset(edge: .bottom, spacing: Spacing.s0) {
                footer
                    .modifier(ShelfBarMotion(isOn: shelves && !reduceMotion, isUp: viewModel.design != nil))
            }
        }
        // At the table its words are light ink on the cloth; the cream fields, rows and cards keep their dark ink.
        .environment(\.colorScheme, desk)
        // An iPad window wide enough: Pick a card is a page across it (its shelves, grid and collection pages).
        .environment(\.holidayCardWidePage, padRoom == .page)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .background {
            if atTable {
                HolidayCardTableCloth(table: viewModel.design?.table)
            } else {
                HolidayCardDesk.background(desk).ignoresSafeArea()
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        // Full screen, like the other flows: no tab bar in any step or on the confirmation (founder, 11-09).
        .hidesTabBar()
        .task { await viewModel.load() }
        // The card being written is kept as it changes, so it comes back if the system closes the app.
        .onChange(of: viewModel.draft) { viewModel.saveDraft() }
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
            StampBooksSheet(store: viewModel.stamps, short: viewModel.stampShort, forMedia: viewModel.stampsForMedia)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        // Stamps bought (or spent elsewhere): whether a photo and greeting can go, read again without leaving the step.
        .onChange(of: viewModel.stamps.balance?.paidRemaining) { old, _ in
            guard old != nil else { return }
            viewModel.boughtStampsChanged()
            guard viewModel.cards?.media?.boughtStamp != nil else { return }
            Task { await viewModel.rereadCards() }
        }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        // A card that travels, and no town yet: "Where does it start?" (travelling card plan Part 2, D4).
        .sheet(isPresented: Binding(
            get: { viewModel.asksTown && !viewModel.sealsAtTable },
            set: { if !$0, viewModel.asksTown { viewModel.townCancelled() } }
        )) {
            CardTravelTownSheet(onChosen: viewModel.townChosen, onCancel: viewModel.townCancelled)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        // Seal it by hand: the table over the flow, from Look it over until Done.
        .modifier(CardTableSendCover(viewModel: viewModel, onDone: done))
        // "Make a photo card" (cards-next 4.2).
        .modifier(HolidayCardPhotoStudioCover(viewModel: viewModel))
        // On an iPad window wide enough, the reading column leaves the flow the whole width: the header runs it, and each
        // step lays out its own column in it (`column`). Phones and the iPhone Duo keep the column.
        .wideColumnsScreen()
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
        // A collection's page on the card shelves: Back returns to them.
        if shelves, viewModel.shelfPage != nil { return ("All collections", viewModel.step) }
        return (viewModel.step.title, viewModel.step == .sent ? nil : viewModel.step)
    }

    private var header: some View {
        VStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Button(action: back) {
                    Icon(.chevronLeft, size: 24, color: HolidayCardDesk.text(desk))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
                .accessibilityIdentifier("sendCardBack")
                Text(heading.title)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(HolidayCardDesk.text(desk))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("sendCardTitle")
                if let step = heading.dots {
                    StepDots(current: step, order: viewModel.steps)
                        .padding(.trailing, 14)
                }
            }
            .padding(.horizontal, Spacing.s1)
            .padding(.top, Spacing.s2)
            // On an iPad, Back in the window's top-left corner and the dots in its top-right.
            .topBarSpansWindow()
            if postageOn, !shelves {
                if WideLayout.isPad {
                    // Over the step's column: the first of two columns, else no wider than a phone's page.
                    let room = column
                    StampChip(store: viewModel.stamps) { viewModel.showsStampBooks = true }
                        .frame(maxWidth: padRoom == .twoColumns
                            ? max(0, (min(room.width, width - 2 * room.margin) - HolidayCardPad.gap) / 2)
                            : 560)
                        .frame(maxWidth: room.width, alignment: .leading)
                        .padding(.horizontal, room.margin)
                        .frame(maxWidth: .infinity)
                } else {
                    StampChip(store: viewModel.stamps) { viewModel.showsStampBooks = true }
                        .padding(.horizontal, Spacing.s4)
                }
            }
        }
    }

    // MARK: The room on an iPad

    /// How this step uses an iPad window (founder, 2026-11-23: "take advantage of the iPad screen"): Pick a card as a
    /// page across a window at least `HolidayCardPad.pageFrom` wide, and Write on the back, Seal it for the day
    /// and Look it over as two columns (the card beside its words) from `HolidayCardPad.twoColumnsFrom`, below the
    /// accessibility text sizes. Everything else, phones and the iPhone Duo and narrower windows keep the phone's page.
    private var padRoom: HolidayCardPadRoom {
        guard viewModel.cards?.open == true, viewModel.today == nil else { return .phone }
        switch viewModel.step {
        case .pick:
            return HolidayCardPad.isPage(width: width) ? .page : .phone
        case .write, .seal, .look:
            return HolidayCardPad.hasTwoColumns(width: width, typeSize: dynamicTypeSize) ? .twoColumns : .phone
        case .to, .sent:
            return .phone
        }
    }

    /// The step's column, as wide as it gets and its margin at each side: 560 and 16, as on a phone, unless the iPad's
    /// room says more.
    private var column: (width: CGFloat, margin: CGFloat) {
        switch padRoom {
        case .phone: (width: 560, margin: Spacing.s4)
        case .page: (width: HolidayCardPad.pageWidth, margin: HolidayCardPad.margin)
        case .twoColumns: (width: HolidayCardPad.twoColumnsWidth, margin: HolidayCardPad.twoColumnsMargin)
        }
    }

    /// Who the card is for while Look it over shows (its footer pins under it).
    private var lookRecipient: HolidayCardRecipient? {
        guard viewModel.cards != nil, viewModel.today == nil, viewModel.step == .look, viewModel.preview != nil else { return nil }
        return viewModel.recipient
    }

    /// What's pinned under the page: step 4's buttons, Look it over's footer (a list's, or one card's), step 1's button
    /// on with a list, or Pick a card's bar.
    @ViewBuilder
    private var footer: some View {
        if viewModel.step == .seal, viewModel.today == nil, let cards = viewModel.cards, cards.open, viewModel.design != nil,
           let recipient = viewModel.recipient {
            HolidayCardSealFooter(viewModel: viewModel, cards: cards, recipient: recipient)
        } else if viewModel.cards != nil, viewModel.step == .look, let entries = viewModel.recipient?.entries,
                  let look = viewModel.listPreview {
            HolidayCardListLookFooter(viewModel: viewModel, entries: entries, look: look)
        } else if let recipient = lookRecipient {
            HolidayCardLookFooter(viewModel: viewModel, byEmail: recipient.isEmail)
        } else if viewModel.step == .to, viewModel.cards?.open == true, viewModel.maxRecipients > 1, !viewModel.listed.isEmpty {
            HolidayCardListContinueBar(viewModel: viewModel)
        } else if viewModel.step == .pick, let cards = viewModel.cards, cards.open, viewModel.today == nil {
            if !cards.showsShelves {
                HolidayCardPickBar(viewModel: viewModel, cards: cards)
            } else if viewModel.design != nil {
                // The card shelves: no bar until a card is chosen; then it comes up from the bottom.
                HolidayCardPickBar(viewModel: viewModel, cards: cards, presentsRack: false)
                    .transition(reduceMotion ? .identity : .move(edge: .bottom))
            }
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
                if let note = viewModel.backNote, viewModel.step == viewModel.firstStep {
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
                    if shelves, postageOn {
                        // The card shelves: the stamps left as a chip at the line's end, where the box was.
                        HStack(spacing: Spacing.s2) {
                            toLine(recipient)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            StampLineChip(store: viewModel.stamps) { viewModel.showsStampBooks = true }
                        }
                    } else {
                        toLine(recipient)
                    }
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
                if WideLayout.isPad {
                    // The end goes at the foot of the step's second column when it has two (the stack's gap above it).
                    HolidayCardLookStep(
                        viewModel: viewModel,
                        cards: cards,
                        design: design,
                        recipient: recipient,
                        preview: preview,
                        end: AnyView(HolidayCardLookEnd(viewModel: viewModel, byEmail: recipient.isEmail).padding(.top, Spacing.s3))
                    )
                } else {
                    HolidayCardLookStep(viewModel: viewModel, cards: cards, design: design, recipient: recipient, preview: preview)
                    HolidayCardLookEnd(viewModel: viewModel, byEmail: recipient.isEmail)
                }
            }
        case .sent:
            EmptyView()
        }
    }
}

// MARK: - The card shelves

private extension HolidayCardFlowView {
    /// Pick a card shows the card shelves (server switch `card_shelves`): the stamp count is a chip on the "To" line,
    /// and the bar comes up only once a card is chosen.
    var shelves: Bool {
        guard viewModel.step == .pick, viewModel.today == nil, let cards = viewModel.cards, cards.open else { return false }
        return cards.showsShelves
    }

    /// The collection whose page lies over the card shelves, with the list it's in.
    var shelfPage: (HolidayCardCollection, HolidayCardsResponse)? {
        guard shelves, let id = viewModel.shelfPage, let cards = viewModel.cards,
              let collection = cards.pickableCollections.first(where: { $0.id == id }) else { return nil }
        return (collection, cards)
    }

    func back() {
        // A collection's page slides back off the card shelves.
        if shelfPage != nil, !reduceMotion {
            withAnimation(.easeInOut(duration: 0.3)) { _ = viewModel.back() }
            return
        }
        let today = viewModel.step != .sent && viewModel.today != nil
        if today || !viewModel.back() { onClose() }
    }

    /// A collection's shelf at the top of the page: sliding there from the line under a large card; simply there as
    /// the shelves open, once they're laid out.
    func go(to jump: HolidayCardShelfJump?, scroller: ScrollViewProxy) {
        guard let jump else { return }
        viewModel.shelfJump = nil
        let target = HolidayCardShelves.shelfId(jump.collection)
        if jump.animated, !reduceMotion {
            withAnimation(.easeInOut(duration: 0.35)) { scroller.scrollTo(target, anchor: .top) }
        } else {
            Task { @MainActor in
                await Task.yield()
                scroller.scrollTo(target, anchor: .top)
            }
        }
    }

    func toLine(_ recipient: HolidayCardRecipient) -> some View {
        Text("To \(recipient.name)")
            .font(.system(size: 14))
            .foregroundStyle(HolidayCardDesk.muted(desk))
            .lineLimit(1)
            .accessibilityIdentifier("sendCardTo")
    }
}

/// A collection's page over the card shelves, which keep their place under it (VoiceOver reads only the page). Nothing
/// with the shelves off.
private struct ShelfPageCover: ViewModifier {
    let viewModel: HolidayCardFlowViewModel
    let page: (HolidayCardCollection, HolidayCardsResponse)?
    let reduceMotion: Bool

    func body(content: Content) -> some View {
        // The same shelves under the page and after it, so they stay where they were scrolled.
        content
            .accessibilityHidden(page != nil)
            .overlay {
                if let (collection, cards) = page {
                    HolidayCardCollectionPage(viewModel: viewModel, cards: cards, collection: collection)
                        .id(collection.id)
                        .transition(reduceMotion ? .identity : .move(edge: .trailing))
                }
            }
    }
}

/// The card shelves' bar slides up as a card is chosen and down as it goes; nothing moves with Reduce Motion or with
/// the shelves off.
private struct ShelfBarMotion: ViewModifier {
    let isOn: Bool
    let isUp: Bool

    func body(content: Content) -> some View {
        if isOn {
            content.animation(.easeOut(duration: 0.25), value: isUp)
        } else {
            content
        }
    }
}

// MARK: - The card flow on an iPad

/// How a step of the card flow uses the room it has (`HolidayCardFlowView.padRoom`).
enum HolidayCardPadRoom {
    /// The phone's page: one column, 560 wide at most.
    case phone
    /// Pick a card across an iPad window, with even margins.
    case page
    /// The card in one column and its words and buttons in the other.
    case twoColumns
}

/// The card flow's measures on an iPad (founder, 2026-11-23: "take advantage of the iPad screen", and of Pick a card,
/// "the cards are messy in the screen"). Phones and the iPhone Duo never use them.
enum HolidayCardPad {
    /// Pick a card is a page from this width: an upright iPad mini, an iPad beside another app, the Mail tab's pane.
    static let pageFrom: CGFloat = 640
    /// The widest the page gets (wider windows add margin).
    static let pageWidth: CGFloat = 1280
    /// Between the cards of a row or grid on the page.
    static let gap = Spacing.s5
    /// A shelf's card on the page is about this wide or wider: as many as fit fill the page's width exactly.
    static let shelfCard: CGFloat = 200
    /// The frame every card on the page sits in, width over height: the pictures' usual shape (960 by 1022), so most
    /// fill it and the rest show a sliver of their own paper.
    static let frameAspect: CGFloat = 960.0 / 1022.0
    /// Two columns from this width: each about 440 or wider, so the card stays large beside its words; the Mail tab's
    /// pane beside the Mailbox on a 13-inch iPad held sideways (956) has them.
    static let twoColumnsFrom: CGFloat = 900
    static let twoColumnsWidth: CGFloat = 1040
    static let twoColumnsMargin = Spacing.s6

    /// The page's margin at each side: twice the gap between cards, so the next card in a row peeks past the margin
    /// by a gap's width.
    static let margin = Spacing.s10

    /// Pick a card is a page across the window: an iPad window from `pageFrom` wide, at every text size (its rows stay
    /// rows; the phone's page there would leave the rows running off from a narrow column in the middle of the window).
    @MainActor static func isPage(width: CGFloat) -> Bool {
        WideLayout.isPad && width >= pageFrom
    }

    /// Write on the back, Seal it for the day and Look it over take two columns.
    @MainActor static func hasTwoColumns(width: CGFloat, typeSize: DynamicTypeSize) -> Bool {
        WideLayout.isPad && !typeSize.isAccessibilitySize && width >= twoColumnsFrom
    }
}

private struct HolidayCardWidePageKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// Pick a card is a page across an iPad window (`HolidayCardPadRoom.page`): its rows and grids draw every card in
    /// the same frame, as many across as fit, from the page's margins.
    var holidayCardWidePage: Bool {
        get { self[HolidayCardWidePageKey.self] }
        set { self[HolidayCardWidePageKey.self] = newValue }
    }
}

/// The five steps as dots: wax red up to this one (a longer dash), cream ahead.
private struct StepDots: View {
    let current: HolidayCardStep
    /// The steps in the flow's order (Pick a card first with `improved`).
    var order = HolidayCardStep.counted

    var body: some View {
        let index = order.firstIndex(of: current) ?? 0
        HStack(spacing: 5) {
            ForEach(Array(order.enumerated()), id: \.offset) { position, _ in
                Capsule()
                    .fill(position <= index ? MailPaper.wax : MailPaper.cardDotAhead)
                    .frame(width: position == index ? 20 : 7, height: 7)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(index + 1) of \(order.count)")
        .accessibilityIdentifier("sendCardStepDots")
    }
}
